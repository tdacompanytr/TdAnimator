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
  // New metadata fields
  lighting?: string;
  cameraAngle?: string;
  colorTone?: string;
  composition?: string;
  mood?: string;
  seed?: number;
  model?: string; // Stores which model generated this
}

// User & Role Types
export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  username: string;
  role: UserRole;
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

// New Types
export type LightingType = 'none' | 'studio' | 'natural' | 'golden' | 'dramatic' | 'neon' | 'dark' | 'volumetric';
export type CameraAngle = 'none' | 'wide' | 'close-up' | 'macro' | 'drone' | 'isometric' | 'low-angle' | 'eye-level';
export type ColorTone = 'none' | 'vibrant' | 'bw' | 'sepia' | 'pastel' | 'muted' | 'cool' | 'warm';
export type Composition = 'none' | 'symmetrical' | 'golden-ratio' | 'rule-of-thirds' | 'minimalist' | 'centered' | 'chaotic' | 'framed';
export type Mood = 'none' | 'happy' | 'dark' | 'mysterious' | 'peaceful' | 'energetic' | 'melancholic' | 'romantic' | 'eerie';

// AI Model Types - Removed Imagen 3 and Gemini Pro
export type AIModel = 'gemini-flash' | 'gemini-lite';

export const AI_MODELS: { value: AIModel; label: string; description: string; icon: string }[] = [
  { value: 'gemini-flash', label: 'Gemini 2.5 Flash', description: 'Hızlı, dengeli ve çok yönlü.', icon: 'zap' },
  { value: 'gemini-lite', label: 'Gemini Flash Lite', description: 'En hızlı üretim, düşük bekleme süresi.', icon: 'rabbit' },
];

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

// New Configuration Arrays
export const LIGHTING_TYPES: { value: LightingType; label: string; promptModifier: string }[] = [
  { value: 'none', label: 'Varsayılan', promptModifier: '' },
  { value: 'studio', label: 'Stüdyo Işığı', promptModifier: ', studio lighting, professional lighting, softbox' },
  { value: 'natural', label: 'Doğal Işık', promptModifier: ', natural lighting, sunlight, daylight' },
  { value: 'golden', label: 'Altın Saat', promptModifier: ', golden hour, warm lighting, sunset glow' },
  { value: 'dramatic', label: 'Dramatik', promptModifier: ', dramatic lighting, high contrast, chiaroscuro' },
  { value: 'neon', label: 'Neon', promptModifier: ', neon lighting, colorful lights, cyberpunk atmosphere' },
  { value: 'dark', label: 'Karanlık/Loş', promptModifier: ', dark atmosphere, dim lighting, mysterious' },
  { value: 'volumetric', label: 'Hacimsel', promptModifier: ', volumetric lighting, god rays, misty atmosphere' },
];

export const CAMERA_ANGLES: { value: CameraAngle; label: string; promptModifier: string }[] = [
  { value: 'none', label: 'Varsayılan', promptModifier: '' },
  { value: 'wide', label: 'Geniş Açı', promptModifier: ', wide angle shot, panoramic view' },
  { value: 'close-up', label: 'Yakın Çekim', promptModifier: ', close-up shot, detailed face' },
  { value: 'macro', label: 'Makro', promptModifier: ', macro photography, extreme close-up, microscopic details' },
  { value: 'drone', label: 'Drone / Kuş Bakışı', promptModifier: ', aerial view, drone shot, bird\'s eye view' },
  { value: 'low-angle', label: 'Alt Açı', promptModifier: ', low angle shot, looking up, imposing' },
  { value: 'isometric', label: 'İzometrik', promptModifier: ', isometric view, 3d diagram style' },
];

export const COLOR_TONES: { value: ColorTone; label: string; promptModifier: string }[] = [
  { value: 'none', label: 'Varsayılan', promptModifier: '' },
  { value: 'vibrant', label: 'Canlı & Parlak', promptModifier: ', vibrant colors, saturated, colorful' },
  { value: 'bw', label: 'Siyah & Beyaz', promptModifier: ', black and white, monochrome, grayscale' },
  { value: 'sepia', label: 'Sepya / Eskitme', promptModifier: ', sepia tone, old photo style' },
  { value: 'pastel', label: 'Pastel', promptModifier: ', pastel colors, soft tones, dreamy' },
  { value: 'muted', label: 'Soluk / Mat', promptModifier: ', muted colors, desaturated, matte look' },
  { value: 'cool', label: 'Soğuk Tonlar', promptModifier: ', cool color palette, blue tones, cold atmosphere' },
  { value: 'warm', label: 'Sıcak Tonlar', promptModifier: ', warm color palette, orange and yellow tones, cozy' },
];

export const COMPOSITIONS: { value: Composition; label: string; promptModifier: string }[] = [
    { value: 'none', label: 'Varsayılan', promptModifier: '' },
    { value: 'symmetrical', label: 'Simetrik', promptModifier: ', symmetrical composition, perfectly balanced, centered' },
    { value: 'golden-ratio', label: 'Altın Oran', promptModifier: ', golden ratio composition, perfect proportions, fibonacci spiral' },
    { value: 'rule-of-thirds', label: '1/3 Kuralı', promptModifier: ', rule of thirds composition, dynamic framing' },
    { value: 'minimalist', label: 'Minimalist', promptModifier: ', minimalist composition, plenty of negative space, simple background' },
    { value: 'chaotic', label: 'Kaotik / Karmaşık', promptModifier: ', chaotic composition, busy scene, maximalist, detailed' },
    { value: 'framed', label: 'Çerçeveli', promptModifier: ', framed composition, view through a window or arch' },
];

export const MOODS: { value: Mood; label: string; promptModifier: string }[] = [
    { value: 'none', label: 'Varsayılan', promptModifier: '' },
    { value: 'happy', label: 'Neşeli', promptModifier: ', happy atmosphere, cheerful, positive vibes, bright' },
    { value: 'dark', label: 'Karanlık', promptModifier: ', dark mood, gloomy, gothic atmosphere, scary' },
    { value: 'mysterious', label: 'Gizemli', promptModifier: ', mysterious atmosphere, enigmatic, fog, intrigue' },
    { value: 'peaceful', label: 'Huzurlu', promptModifier: ', peaceful atmosphere, calm, serene, zen' },
    { value: 'energetic', label: 'Enerjik', promptModifier: ', energetic atmosphere, action packed, dynamic movement' },
    { value: 'romantic', label: 'Romantik', promptModifier: ', romantic atmosphere, soft lighting, love, dreamy' },
    { value: 'eerie', label: 'Ürkütücü', promptModifier: ', eerie atmosphere, unsettling, horror vibe, haunted' },
];

export interface AICriticAnalysis {
  score: number;
  critique: string[];
  goodPoints: string[];
  improvedPrompt: string;
}

// AI Critic Settings Types
export type CriticPersona = 'strict' | 'balanced' | 'gentle' | 'roast';
export type AnalysisDepth = 'brief' | 'detailed' | 'technical';