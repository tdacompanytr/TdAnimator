import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

// Initialize the client
// We create a function to get the client to ensure fresh instances if needed,
// though for this simple app a singleton is also fine.
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
      throw new Error("API boş yanıt döndürdü. İstem filtrelenmiş olabilir.");
    }

    const generatedImage = response.generatedImages[0];
    
    if (!generatedImage.image || !generatedImage.image.imageBytes) {
      throw new Error("API yanıt verdi fakat görüntü verisi eksik.");
    }

    return {
      imageBytes: generatedImage.image.imageBytes,
      mimeType: 'image/jpeg',
    };

  } catch (error: any) {
    console.error("GenAI Error Details:", error);
    
    // Extract error message string and potential details
    const errorMessage = error.message || error.toString();
    let friendlyMessage = "Görüntü oluşturulamadı.";

    // Detailed error analysis based on common API error patterns
    if (errorMessage.includes("SAFETY") || errorMessage.includes("blocked") || errorMessage.includes("Safety")) {
      friendlyMessage = "⚠️ Güvenlik Uyarısı: İsteminiz (prompt) yapay zeka güvenlik filtrelerine takıldı. Lütfen şiddet, nefret söylemi veya cinsel içerik barındırmayan farklı bir açıklama deneyin.";
    } else if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
      friendlyMessage = "⏳ Kota Sınırı Aşıldı: Servis şu anda çok yoğun veya kullanım limitine ulaşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.";
    } else if (errorMessage.includes("400") || errorMessage.includes("INVALID_ARGUMENT")) {
      friendlyMessage = "❌ Geçersiz İstek: Girdiğiniz açıklama model tarafından işlenemiyor. Çok uzun veya karmaşık bir ifade kullanmış olabilirsiniz.";
    } else if (errorMessage.includes("401") || errorMessage.includes("UNAUTHENTICATED")) {
      friendlyMessage = "🔑 Yetkilendirme Hatası: API anahtarı geçersiz veya eksik. Lütfen sistem yöneticisi ile görüşün.";
    } else if (errorMessage.includes("403") || errorMessage.includes("PERMISSION_DENIED")) {
      friendlyMessage = "🚫 Erişim Reddedildi: Bu API'yi kullanma yetkiniz yok veya bölgenizde desteklenmiyor.";
    } else if (errorMessage.includes("503") || errorMessage.includes("500") || errorMessage.includes("internal")) {
      friendlyMessage = "☁️ Sunucu Hatası: Google servislerinde geçici bir sorun yaşanıyor. Lütfen daha sonra tekrar deneyin.";
    } else if (errorMessage.includes("fetch failed") || errorMessage.includes("network")) {
      friendlyMessage = "🌐 Bağlantı Hatası: İnternet bağlantınızı kontrol edin veya güvenlik duvarı ayarlarını gözden geçirin.";
    } else {
      // Include technical details for unknown errors but keep it readable
      friendlyMessage = `Beklenmeyen bir hata oluştu: ${errorMessage.substring(0, 150)}${errorMessage.length > 150 ? '...' : ''}`;
    }

    throw new Error(friendlyMessage);
  }
};