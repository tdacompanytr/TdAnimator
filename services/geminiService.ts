import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio } from "../types";

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
  referenceImageBase64?: string // Optional reference image for style transfer/editing
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
      
      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/jpeg', // Assuming input is jpeg/png, standardized to generic image mime if needed, or pass actual
              },
            },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      // Extract the generated image from the content candidates
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error("Referans görsel ile üretim başarısız oldu.");
      }

      const generatedPart = candidates[0].content.parts.find(p => p.inlineData);
      
      if (!generatedPart || !generatedPart.inlineData || !generatedPart.inlineData.data) {
        throw new Error("API geçerli bir görsel verisi döndürmedi.");
      }

      return {
        imageBytes: generatedPart.inlineData.data,
        mimeType: 'image/png', // Flash Image output is typically PNG
      };

    } else {
      // CASE 2: Text Only (Text-to-Image)
      // Use Imagen 3 for high quality generation
      const model = 'imagen-4.0-generate-001';
      
      const response = await ai.models.generateImages({
        model: model,
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: outputMimeType,
          aspectRatio: aspectRatio,
        },
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("API yanıt döndürdü ancak içinde görsel verisi bulunamadı. İsteminiz güvenlik filtrelerine takılmış olabilir.");
      }

      const generatedImage = response.generatedImages[0];
      
      if (!generatedImage.image || !generatedImage.image.imageBytes) {
        throw new Error("API yanıtı eksik veri içeriyor.");
      }

      return {
        imageBytes: generatedImage.image.imageBytes,
        mimeType: outputMimeType,
      };
    }

  } catch (error: any) {
    console.error("GenAI Hata Detayı:", error);
    
    const errorMessage = (error.message || error.toString()).toLowerCase();
    let friendlyMessage = "Görüntü oluşturulurken beklenmeyen bir hata oluştu.";

    // Detaylı Hata Analizi
    if (errorMessage.includes("safety") || errorMessage.includes("blocked") || errorMessage.includes("finish_reason")) {
      friendlyMessage = "⚠️ Güvenlik Uyarısı: Girdiğiniz açıklama (prompt) veya referans görsel yapay zeka güvenlik filtrelerine takıldı.";
    } 
    else if (errorMessage.includes("429") || errorMessage.includes("resource_exhausted") || errorMessage.includes("quota")) {
      friendlyMessage = "⏳ Kota Sınırı Aşıldı: Servis şu anda çok yoğun veya günlük kullanım limitiniz doldu. Lütfen birkaç dakika bekleyip tekrar deneyin.";
    } 
    else if (errorMessage.includes("400") || errorMessage.includes("invalid_argument")) {
      friendlyMessage = "❌ Geçersiz İstek: Açıklamanız model tarafından işlenemedi. Lütfen referans görselin boyutunu veya formatını kontrol edin.";
    } 
    else if (errorMessage.includes("401") || errorMessage.includes("unauthenticated")) {
      friendlyMessage = "🔑 Kimlik Doğrulama Hatası: API anahtarı geçersiz.";
    } 
    else if (errorMessage.includes("503") || errorMessage.includes("500")) {
      friendlyMessage = "☁️ Sunucu Hatası: Google yapay zeka sunucularında geçici bir problem yaşanıyor.";
    }
    else {
      const technicalDetail = errorMessage.length > 100 ? errorMessage.substring(0, 100) + "..." : errorMessage;
      friendlyMessage = `Beklenmeyen bir hata: ${technicalDetail}.`;
    }

    throw new Error(friendlyMessage);
  }
};