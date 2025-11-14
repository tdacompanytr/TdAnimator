export interface GeneratedImage {
  base64: string;
  mimeType: string;
  prompt: string;
  timestamp: number;
  aspectRatio: string;
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16';

export const ASPECT_RATIOS: { value: AspectRatio; label: string; description: string }[] = [
  { value: '1:1', label: 'Kare (1:1)', description: 'Instagram ve profil resimleri için ideal' },
  { value: '16:9', label: 'Yatay (16:9)', description: 'Sinematik, masaüstü duvar kağıtları' },
  { value: '9:16', label: 'Dikey (9:16)', description: 'Hikayeler ve telefon ekranları için ideal' },
  { value: '4:3', label: 'Standart (4:3)', description: 'Klasik fotoğraf oranı' },
  { value: '3:4', label: 'Portre (3:4)', description: 'Dikey fotoğrafçılık oranı' },
];