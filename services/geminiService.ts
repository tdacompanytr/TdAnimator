
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AspectRatio, AIModel, AICriticAnalysis, CriticPersona, AnalysisDepth, MusicGenre, CoverStyle } from "../types";

// Initialize the client
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY ortam değişkeni ayarlanmamış. Lütfen API anahtarınızı kontrol edin.");
  }
  return new GoogleGenAI({ apiKey });
};

export interface GenerateImageResult {
  imageBytes: string; // base64 string
  mimeType: string;
}

export const generateImage = async (
  prompt: string,
  aspectRatio: AspectRatio = '1:1',
  outputMimeType: 'image/jpeg' | 'image/png' = 'image/jpeg',
  referenceImageBase64?: string, // Optional reference image for style transfer/editing
  seed?: number, // Optional seed for reproducibility
  modelType: AIModel = 'gemini-flash' // Defaulted to Flash
): Promise<GenerateImageResult> => {
  try {
    const ai = getAiClient();
    
    // Decide which model and method to use based on whether a reference image is provided
    if (referenceImageBase64) {
      // CASE 1: Image + Text (Image-to-Image / Style Transfer)
      // We must use 'gemini-2.5-flash-image' for multimodal inputs that generate images
      
      const model = 'gemini-2.5-flash-image';
      
      // Extract pure base64 if it contains the data URL prefix
      const base64Data = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");
      
      // Force the model to prioritize the reference image structure
      const finalPrompt = `
      TASK: Image-to-Image Transformation.
      
      STRICT INSTRUCTION:
      1. You MUST PRESERVE the main subject, composition, geometry, and structure of the attached Reference Image.
      2. Do NOT hallucinate new subjects. If the image shows a person, keep that person. If it shows a car, keep that car.
      3. Apply the ARTISTIC STYLE, LIGHTING, and MOOD described in the prompt to the Reference Image.
      
      STYLE PROMPT: "${prompt}"
      
      OUTPUT: A high-quality image file. Do NOT provide text output.`;

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            {
              text: finalPrompt,
            },
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/jpeg', // Assuming input is jpeg/png
              },
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        },
      });

      // Extract the generated image from the content candidates
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error("Referans görsel ile üretim başarısız oldu.");
      }

      const candidate = candidates[0];
      // Safety check for content existence
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
          const reason = candidate.finishReason;
          if (reason === 'SAFETY' || reason === 'RECITATION' || reason === 'BLOCKLIST') {
             throw new Error("Görsel oluşturma güvenlik filtrelerine takıldı.");
          }
          if (reason === 'NO_IMAGE') {
             throw new Error("Model bu istekle görsel oluşturulamayacağına karar verdi. Lütfen açıklamanızı (prompt) değiştirin.");
          }
          throw new Error(`Model (${model}) içerik oluşturamadı. (Sebep: ${reason || 'Bilinmiyor'})`);
      }

      // Find the image part, do not assume it is the first part.
      let generatedPart = null;
      let textResponse = "";

      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          generatedPart = part;
        }
        if (part.text) {
          textResponse += part.text;
        }
      }
      
      if (!generatedPart || !generatedPart.inlineData || !generatedPart.inlineData.data) {
        if (textResponse.trim().length > 0) {
             throw new Error(`Model görsel oluşturmadı. Model Mesajı: "${textResponse.substring(0, 200)}..."`);
        }
        throw new Error("API geçerli bir görsel verisi döndürmedi.");
      }

      return {
        imageBytes: generatedPart.inlineData.data,
        mimeType: 'image/png', // Flash Image output is typically PNG
      };

    } else {
      // CASE 2: Text Only (Text-to-Image) - GEMINI ONLY (Imagen Removed)
      
      let modelName = 'gemini-2.5-flash-image'; // Default
      
      if (modelType === 'gemini-lite') {
            // gemini-flash-lite-latest is text-only, so we fallback to the fastest image model
            modelName = 'gemini-2.5-flash-image';
      } 
      // 'gemini-flash' uses default

      try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio,
                    // imageSize: "1K" // Optional
                }
            }
          });

          const candidates = response.candidates;
          if (!candidates || candidates.length === 0) {
            throw new Error(`${modelName} ile üretim başarısız oldu.`);
          }
          
          const candidate = candidates[0];
          
          // Robust safety check for missing content or parts
          if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
              const reason = candidate.finishReason;
              if (reason === 'SAFETY' || reason === 'RECITATION' || reason === 'BLOCKLIST') {
                  throw new Error("Görsel oluşturma güvenlik filtrelerine takıldı.");
              }
              if (reason === 'NO_IMAGE') {
                   throw new Error("Model görsel oluşturulamayacağına karar verdi (NO_IMAGE). Lütfen açıklamanızı değiştirin veya basitleştirin.");
              }
              // If it's an unknown reason, it might be a glitch or refusal.
              throw new Error(`${modelName} boş içerik döndürdü. (Sebep: ${reason || 'Bilinmiyor'})`);
          }

          // Find the image part
          let generatedPart = null;
          let textResponse = "";

          for (const part of candidate.content.parts) {
            if (part.inlineData) {
                generatedPart = part;
            }
            if (part.text) {
                textResponse += part.text;
            }
          }

          if (!generatedPart || !generatedPart.inlineData || !generatedPart.inlineData.data) {
             if (textResponse.trim().length > 0) {
                 throw new Error(`Model görsel oluşturmadı. Model Mesajı: "${textResponse.substring(0, 200)}..."`);
             }
             throw new Error(`${modelName} geçerli görsel verisi döndürmedi.`);
          }

          return {
            imageBytes: generatedPart.inlineData.data,
            mimeType: 'image/png',
          };
      } catch (error: any) {
          throw error;
      }
    }

  } catch (error: any) {
    console.error("GenAI Hata Detayı:", error);
    
    const errorMessage = (error.message || error.toString()).toLowerCase();
    let friendlyMessage = "Görüntü oluşturulurken beklenmeyen bir hata oluştu.";

    // Detaylı Hata Analizi
    if (errorMessage.includes("safety") || errorMessage.includes("blocked") || errorMessage.includes("güvenlik")) {
      friendlyMessage = "⚠️ Güvenlik Uyarısı: Girdiğiniz açıklama (prompt) veya referans görsel yapay zeka güvenlik filtrelerine takıldı.";
    } 
    else if (errorMessage.includes("no_image") || errorMessage.includes("görsel oluşturulamayacağına karar verdi")) {
       friendlyMessage = "🚫 Görsel Oluşturulamadı: Model isteğinizi reddetti (NO_IMAGE). Lütfen daha basit veya net bir prompt deneyin.";
    }
    else if (errorMessage.includes("model görsel oluşturmadı") || errorMessage.includes("model mesajı")) {
       // Extract the message if possible or show generic
       friendlyMessage = `⚠️ Model Reddi: ${error.message.replace("Model görsel oluşturmadı.", "")}`;
    }
    else if (errorMessage.includes("429") || errorMessage.includes("resource_exhausted") || errorMessage.includes("quota")) {
      friendlyMessage = "⏳ Kota Sınırı Aşıldı: Servis şu anda çok yoğun veya günlük kullanım limitiniz doldu. Lütfen birkaç dakika bekleyip tekrar deneyin.";
    } 
    else if (errorMessage.includes("400") || errorMessage.includes("invalid_argument")) {
        if (errorMessage.includes("text output")) {
             friendlyMessage = "❌ Model Hatası: Seçilen model görsel oluşturmayı desteklemiyor.";
        } else {
             friendlyMessage = "❌ Geçersiz İstek: Açıklamanız model tarafından işlenemedi.";
        }
    } 
    else if (errorMessage.includes("403") || errorMessage.includes("permission_denied")) {
      friendlyMessage = "🚫 Yetki Hatası: Erişim izniniz olmayan bir model kullanılıyor.";
    }
    else if (errorMessage.includes("401") || errorMessage.includes("unauthenticated")) {
      friendlyMessage = "🔑 Kimlik Doğrulama Hatası: API anahtarı geçersiz.";
    } 
    else if (errorMessage.includes("503") || errorMessage.includes("500")) {
      friendlyMessage = "☁️ Sunucu Hatası: Google yapay zeka sunucularında geçici bir problem yaşanıyor.";
    }
     else if (errorMessage.includes("boş içerik") || errorMessage.includes("undefined")) {
         friendlyMessage = "⚠️ İçerik Oluşturulamadı: Model isteğinizi işleyemedi (Muhtemelen güvenlik veya politika ihlali).";
    }
    else {
      const technicalDetail = errorMessage.length > 100 ? errorMessage.substring(0, 100) + "..." : errorMessage;
      friendlyMessage = `Hata: ${technicalDetail}`;
    }

    throw new Error(friendlyMessage);
  }
};

export const suggestSmartCrop = async (imageBase64: string): Promise<{ ratio: string; reason: string }> => {
  try {
    const ai = getAiClient();
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          },
          {
            text: `Analyze this image's composition, subject placement, and aesthetic balance. 
            Determine the single best aspect ratio from the following list: ['1:1', '16:9', '4:3', '9:16', '3:4'].
            
            Return the result in JSON format with two keys:
            1. "ratio": The selected ratio string (e.g. "16:9").
            2. "reason": A very brief explanation (max 10 words) of why this ratio fits best (e.g. "Landscape composition suits the mountains").`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ratio: { type: Type.STRING },
            reason: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text; 
    if (!text) throw new Error("Empty response from AI");
    
    const result = JSON.parse(text);
    return {
      ratio: result.ratio || 'original',
      reason: result.reason || 'Optimal composition detected.'
    };

  } catch (error) {
    console.error("Smart Crop Analysis Failed:", error);
    throw new Error("Yapay zeka görsel analizi yapamadı.");
  }
};

export const enhancePrompt = async (prompt: string): Promise<{label: string; text: string}[]> => {
  try {
    if (!prompt.trim()) return [];
    
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            text: `You are an expert prompt engineer for AI image generators. 
            Your task is to analyze the user's input and generate 3 detailed, high-quality prompt variations.
            
            User Input: "${prompt}"
            
            **LANGUAGE RULES:**
            1. **Detect the language** of the "User Input".
            2. The generated prompt suggestions ('text') MUST be written in the **SAME LANGUAGE** as the "User Input". (e.g., if input is Turkish, output Turkish prompts; if English, output English).
            3. The 'label' must be localized to **Turkish** regardless of the input language (Use labels: 'Geliştirilmiş', 'Sanatsal', 'Sinematik').

            **VARIATION RULES:**
            1. "Geliştirilmiş" (Enhanced): Expand the description with sensory details, lighting (e.g. volumetric, cinematic), and texture.
            2. "Sanatsal" (Artistic): Reimagine the scene in a specific art style (e.g. Cyberpunk, Impressionist) with focus on color and mood.
            3. "Sinematik" (Cinematic): Focus on camera work (e.g. 35mm, wide angle), depth of field, and dramatic atmosphere.
            
            Return the result in JSON format as an array of objects with 'label' and 'text' keys.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              text: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Prompt enhancement failed", error);
    throw new Error("Prompt geliştirme başarısız oldu.");
  }
};

export const analyzeImage = async (
    imageBase64: string, 
    userInstruction?: string,
    config?: { persona?: CriticPersona; depth?: AnalysisDepth }
): Promise<AICriticAnalysis> => {
  try {
    const ai = getAiClient();
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const instructionToUse = userInstruction || 'Bu görseli analiz et ve eleştir.';

    // Dynamic System Prompt Construction based on Settings
    const persona = config?.persona || 'balanced';
    const depth = config?.depth || 'detailed';

    let personaInstruction = "";
    if (persona === 'strict') {
        personaInstruction = "Role: Ruthless, perfectionist art critic. Focus heavily on flaws, technical errors, and anatomy issues. Do not hold back.";
    } else if (persona === 'gentle') {
        personaInstruction = "Role: Kind, supportive art coach. Focus on potential, effort, and artistic vision. Frame flaws as 'opportunities for growth'. Be encouraging.";
    } else if (persona === 'roast') {
        personaInstruction = "Role: Sarcastic comedian. Roast the image's flaws with wit and humor, but still be observant.";
    } else { // balanced
        personaInstruction = "Role: Constructive, professional art critic. Balance your critique with objective observation.";
    }

    let depthInstruction = "";
    if (depth === 'brief') {
        depthInstruction = "Keep descriptions short, punchy, and to the point. Max 1 sentence per point.";
    } else if (depth === 'technical') {
        depthInstruction = "Focus on technical terms: lighting composition, color theory, anatomy, perspective, rendering techniques.";
    } else { // detailed
        depthInstruction = "Provide detailed explanations for each point.";
    }

    const promptText = `${personaInstruction}
            
            **INPUT:**
            Image: [Provided via inline data]
            User Instruction: "${instructionToUse}"
            Depth Mode: ${depthInstruction}

            **TASK 1: Language Detection & Output Language**
            - **DEFAULT LANGUAGE IS TURKISH.** Unless the "User Instruction" is explicitly in English or another language, you **MUST** output the 'critique' and 'goodPoints' arrays in **TURKISH**.
            - If the user writes in English, you may reply in English. 
            - But for the general analysis without specific text input, use **TURKISH**.

            **TASK 2: Analysis**
            - Analyze the provided image for aesthetic quality, flaws, anatomy issues, lighting, and composition.
            - Give a score out of 10.

            **TASK 3: Lists (CRITICAL RULES)**
            - **Flaws ('critique'):** List at least 3 specific flaws or areas for improvement (In TURKISH by default).
            - **Positives ('goodPoints'):** List at least 3 POSITIVE aspects. **IMPORTANT:** Even if the image is of low quality or has many errors, you MUST find positive traits (e.g., "Interesting color palette", "Good concept", "Dynamic composition potential", "Effort"). **The 'goodPoints' array MUST NOT be empty.** (In TURKISH by default).

            **TASK 4: Solution ('improvedPrompt')**
            - Write a HIGHLY DETAILED prompt in **ENGLISH** (standard for image generators).
            - This prompt should describe the scene but EXPLICITLY FIX all the flaws mentioned.
            - Add quality boosters like "masterpiece, best quality, 4k, highly detailed".
            - If the User Instruction asked for a specific change (e.g., "make it cyberpunk"), ensure the prompt reflects this.
            
            **OUTPUT FORMAT:**
            Return ONLY JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          },
          {
            text: promptText
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            critique: { type: Type.ARRAY, items: { type: Type.STRING } },
            goodPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvedPrompt: { type: Type.STRING }
          },
          required: ["score", "critique", "goodPoints", "improvedPrompt"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI Critic");

    return JSON.parse(text);

  } catch (error) {
    console.error("AI Analysis failed", error);
    throw new Error("Yapay zeka analizi sırasında bir hata oluştu.");
  }
};

export const getSettingsAdvice = async (settingsContext: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `
            You are a professional Creative Director and AI Image Generation Expert.
            The user wants advice on their current image generation settings.
            
            CURRENT SETTINGS:
            ${settingsContext}
            
            TASK:
            1. Analyze the combination of Prompt, Style, Lighting, Mood, etc.
            2. Identify any conflicts (e.g., "Cyberpunk style" with "Natural Lighting" might conflict).
            3. Suggest improvements to make the image more impactful.
            4. If the prompt is too simple, suggest details to add.
            
            OUTPUT RULES:
            - Write in **TURKISH** (Türkçe).
            - Be concise but helpful.
            - Use bullet points for suggestions.
            - Tone: Professional, encouraging, and expert.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] }
        });

        return response.text || "Tavsiye oluşturulamadı.";
    } catch (error) {
        console.error("Settings Advice failed", error);
        throw new Error("Tavsiye alınırken bir hata oluştu.");
    }
};

export const analyzeAudioForImage = async (
    audioBase64: string,
    userDescription?: string,
    hasReferenceImage: boolean = false,
    genre: MusicGenre = 'none',
    style: CoverStyle = 'none'
): Promise<{ prompt: string; descriptionTR: string }> => {
    try {
        const ai = getAiClient();
        const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, "");

        const prompt = `
            You are a professional Album Art Designer.
            Listen to this audio file. Analyze its genre, mood, tempo, instrumentation, and emotional vibe.
            
            USER SETTINGS:
            - User Description: "${userDescription || 'None'}"
            - Explicit Genre: ${genre !== 'none' ? genre : 'Detect automatically'}
            - Explicit Visual Style: ${style !== 'none' ? style : 'Detect automatically'}
            
            ${hasReferenceImage 
              ? `**CRITICAL: The user has provided a REFERENCE IMAGE.
                 DO NOT suggest a specific subject matter (like 'a cat', 'a car').
                 Focus completely on the STYLE, ATMOSPHERE, LIGHTING, and COLOR PALETTE that matches the song.**`
              : 'Describe the subject matter, art style, colors, and lighting for a new album cover.'}

            Based on the audio AND the User Settings above, generate two outputs:
            1. "prompt": A high-quality AI image generation prompt in ENGLISH. Includes art style, mood, colors, lighting, quality keywords (4k, masterpiece). 
               Make sure to incorporate the ${style} style if specified.
            2. "descriptionTR": A detailed description of this visual concept in TURKISH (Türkçe). Explain what the cover looks like and the mood it conveys.

            OUTPUT FORMAT:
            Return ONLY a valid JSON object with keys "prompt" and "descriptionTR".
            Do NOT use Markdown code blocks.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'audio/mp3',
                            data: base64Data
                        }
                    },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        prompt: { type: Type.STRING },
                        descriptionTR: { type: Type.STRING }
                    },
                    required: ["prompt", "descriptionTR"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("Audio analysis returned empty result.");
        
        let result;
        try {
            // Remove markdown code blocks if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(cleanText);
        } catch (e) {
            console.warn("JSON Parse Error, falling back to raw text", e);
             // Fallback: If JSON parsing fails, treat text as prompt and generic TR desc
            return {
                prompt: text.substring(0, 500),
                descriptionTR: "Ses analizi yapıldı, görsel oluşturuluyor."
            };
        }

        return {
            prompt: result.prompt || "Abstract album art",
            descriptionTR: result.descriptionTR || "Müzik analiz edildi ve kapak tasarlandı."
        };

    } catch (error: any) {
        console.error("Audio Analysis Failed:", error);
        throw new Error("Şarkı analizi başarısız oldu: " + (error.message || "Bilinmeyen hata"));
    }
};
