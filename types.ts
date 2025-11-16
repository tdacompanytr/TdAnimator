
export interface GeneratedImage {
  base64: string;
  mimeType: string;
  prompt: string;
  timestamp: number;
  aspectRatio: string;
  resolution?: Resolution;
  stylePreset?: StylePreset;
  watermarkTextEffect: WatermarkTextEffect;
  watermarkOpacity: number;
  watermarkPosition: WatermarkPosition;
  watermarkSize: WatermarkSize;
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16';
export type Resolution = 'standard' | 'hd' | '4k' | '8k';
export type StylePreset = 
  | 'none' 
  | 'cinematic' 
  | 'anime' 
  | 'photographic' 
  | 'digital-art' 
  | 'comic-book' 
  | 'pixel-art' 
  | '3d-model' 
  | 'oil-painting' 
  | 'watercolor' 
  | 'cyberpunk' 
  | 'steampunk' 
  | 'sketch' 
  | 'low-poly' 
  | 'vintage' 
  | 'fantasy'
  | 'origami'
  | 'neon-punk';

export type WatermarkTextEffect = 'none' | 'outline' | 'shadow' | 'glow' | 'emboss' | 'vintage' | 'neon';
export type WatermarkPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center' | 'tile';
export type WatermarkSize = 'small' | 'medium' | 'large' | 'extraLarge';

export const ASPECT_RATIOS: { value: AspectRatio; label: string; description: string }[] = [
  { value: '1:1', label: 'Kare (1:1)', description: 'Instagram ve profil resimleri için ideal' },
  { value: '16:9', label: 'Yatay (16:9)', description: 'Sinematik, masaüstü duvar kağıtları' },
  { value: '9:16', label: 'Dikey (9:16)', description: 'Hikayeler ve telefon ekranları için ideal' },
  { value: '4:3', label: 'Standart (4:3)', description: 'Klasik fotoğraf oranı' },
  { value: '3:4', label: 'Portre (3:4)', description: 'Dikey fotoğrafçılık oranı' },
];

export const RESOLUTIONS: { value: Resolution; label: string; promptSuffix: string }[] = [
  { value: 'standard', label: 'Standart', promptSuffix: '' },
  { value: 'hd', label: 'HD', promptSuffix: ', high quality, detailed' },
  { value: '4k', label: '4K', promptSuffix: ', 4k resolution, highly detailed, sharp focus' },
  { value: '8k', label: '8K', promptSuffix: ', 8k resolution, hyper realistic, masterpiece, extremely detailed' },
];

export const STYLE_PRESETS: { value: StylePreset; label: string; promptModifier: string }[] = [
  { value: 'none', label: 'Yok (Varsayılan)', promptModifier: '' },
  { value: 'cinematic', label: 'Sinematik', promptModifier: ', cinematic lighting, dramatic atmosphere, movie scene, color graded' },
  { value: 'anime', label: 'Anime / Manga', promptModifier: ', anime style, manga art, vibrant colors, studio ghibli style' },
  { value: 'photographic', label: 'Fotografik', promptModifier: ', photorealistic, shot on 35mm, bokeh, professional photography' },
  { value: 'digital-art', label: 'Dijital Sanat', promptModifier: ', digital art, concept art, trending on artstation, highly detailed' },
  { value: 'oil-painting', label: 'Yağlı Boya', promptModifier: ', oil painting style, textured brushstrokes, masterpiece, classical art style' },
  { value: 'watercolor', label: 'Suluboya', promptModifier: ', watercolor painting, soft edges, translucent colors, artistic, dreamy' },
  { value: 'comic-book', label: 'Çizgi Roman', promptModifier: ', comic book style, thick lines, bold colors, graphic novel' },
  { value: 'cyberpunk', label: 'Cyberpunk', promptModifier: ', cyberpunk style, neon lights, futuristic, high tech, rain, night city' },
  { value: 'steampunk', label: 'Steampunk', promptModifier: ', steampunk style, brass and copper gears, victorian industrial, mechanical details' },
  { value: 'sketch', label: 'Karakalem / Çizim', promptModifier: ', pencil sketch, charcoal drawing, rough lines, monochrome, artistic sketch' },
  { value: 'pixel-art', label: 'Piksel Sanatı', promptModifier: ', pixel art, 16-bit, retro game style' },
  { value: '3d-model', label: '3D Model', promptModifier: ', 3d render, unreal engine 5, octane render, ray tracing' },
  { value: 'low-poly', label: 'Low Poly', promptModifier: ', low poly style, geometric shapes, sharp edges, minimalist, 3d render' },
  { value: 'vintage', label: 'Vintage / Retro', promptModifier: ', vintage photo style, retro aesthetic, 1980s style, grain, faded colors' },
  { value: 'fantasy', label: 'Fantastik', promptModifier: ', high fantasy style, magical atmosphere, detailed background, epic composition' },
  { value: 'origami', label: 'Origami', promptModifier: ', origami style, paper folding art, paper texture, geometric' },
  { value: 'neon-punk', label: 'Neon Punk', promptModifier: ', neon punk style, vibrant neon colors, dark background, glowing lights, stylized' },
];

export const WATERMARK_EFFECTS: { value: WatermarkTextEffect; label: string }[] = [
  { value: 'none', label: 'Yok' },
  { value: 'outline', label: 'Dış Hat' },
  { value: 'shadow', label: 'Gölge' },
  { value: 'glow', label: 'Parıltı' },
  { value: 'emboss', label: 'Kabartma' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'neon', label: 'Neon' },
];

export const WATERMARK_POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: 'topLeft', label: 'Sol Üst' },
  { value: 'topRight', label: 'Sağ Üst' },
  { value: 'bottomLeft', label: 'Sol Alt' },
  { value: 'bottomRight', label: 'Sağ Alt' },
  { value: 'center', label: 'Merkez' },
  { value: 'tile', label: 'Döşeme' },
];

export const WATERMARK_SIZES: { value: WatermarkSize; label: string }[] = [
  { value: 'small', label: 'Küçük' },
  { value: 'medium', label: 'Orta' },
  { value: 'large', label: 'Büyük' },
  { value: 'extraLarge', label: 'Çok Büyük' },
];
