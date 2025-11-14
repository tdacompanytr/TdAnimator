import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

// Initialize the client
// We create a function to get the client to ensure fresh instances if needed,
// though for this simple app a singleton is also fine.
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY ortam değişkeni ayarlanmamış.");
  }
  return new GoogleGenAI({ apiKey });
};

export interface GenerateImageResult {
  imageBytes: string; // base64 string
  mimeType: string;
}

export const generateImage = async (
  prompt: string,
  aspectRatio: AspectRatio = '1:1'
): Promise<GenerateImageResult> => {
  try {
    const ai = getAiClient();
    
    // Using the Imagen 3 model as requested
    const model = 'imagen-4.0-generate-001';
    
    const response = await ai.models.generateImages({
      model: model,
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: aspectRatio,
        // safetySettings could be added here if needed, generally defaults are good
      },
    });

    // Verify we have a valid response structure
    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("Görüntü oluşturulamadı. İstem engellenmiş olabilir veya servis şu anda yoğun.");
    }

    const generatedImage = response.generatedImages[0];
    
    if (!generatedImage.image || !generatedImage.image.imageBytes) {
      throw new Error("API'den eksik görüntü verisi alındı.");
    }

    return {
      imageBytes: generatedImage.image.imageBytes,
      mimeType: 'image/jpeg',
    };

  } catch (error: any) {
    console.error("Error generating image:", error);
    // Improve error message for user
    let message = "Görüntü oluşturulamadı.";
    if (error.message) {
      message += ` ${error.message}`;
    }
    throw new Error(message);
  }
};