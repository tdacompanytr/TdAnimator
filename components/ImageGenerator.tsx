import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateImage } from '../services/geminiService';
import { AspectRatio, ASPECT_RATIOS, GeneratedImage } from '../types';
import { WandIcon, DownloadIcon, AlertCircleIcon, LoaderIcon, ImageIcon, HistoryIcon, TrashIcon, ShareIcon, StampIcon } from './Icons';

const MAX_HISTORY_ITEMS = 6; // Limit storage to prevent quota issues

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  
  // Watermark states
  const [showWatermark, setShowWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState('TdAnimator');
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('imagen_studio_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Geçmiş yüklenirken hata oluştu:", e);
    }
  }, []);

  const saveToHistory = (newImage: GeneratedImage) => {
    try {
      // Add new image to the beginning and slice to max items
      const updatedHistory = [newImage, ...history].slice(0, MAX_HISTORY_ITEMS);
      setHistory(updatedHistory);
      localStorage.setItem('imagen_studio_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error("Geçmiş kaydedilirken hata oluştu (Muhtemelen depolama alanı dolu):", e);
      // If saving fails (e.g. quota exceeded), we still update the state so the user sees it in the current session
      const updatedHistory = [newImage, ...history].slice(0, MAX_HISTORY_ITEMS);
      setHistory(updatedHistory);
    }
  };

  const clearHistory = () => {
    if (confirm('Tüm geçmişi silmek istediğinize emin misiniz?')) {
      setHistory([]);
      localStorage.removeItem('imagen_studio_history');
    }
  };

  const handleRestore = (item: GeneratedImage) => {
    setGeneratedImage(item);
    setPrompt(item.prompt);
    setAspectRatio(item.aspectRatio as AspectRatio);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Lütfen oluşturmak istediğiniz görsel için bir açıklama girin.");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await generateImage(prompt.trim(), aspectRatio);
      
      const newImage: GeneratedImage = {
        base64: result.imageBytes,
        mimeType: result.mimeType,
        prompt: prompt.trim(),
        timestamp: Date.now(),
        aspectRatio: aspectRatio
      };

      setGeneratedImage(newImage);
      saveToHistory(newImage);

    } catch (err: any) {
      setError(err.message || "Görüntü oluşturulurken beklenmeyen bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, aspectRatio, history]);

  // Helper function to apply watermark on a canvas and return Data URL
  const applyWatermark = async (base64: string, mimeType: string, text: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(`data:${mimeType};base64,${base64}`);
          return;
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Draw Watermark
        const fontSize = Math.max(20, img.width * 0.035); 
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        
        // Text Shadow for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        
        const padding = img.width * 0.025;
        ctx.fillText(text, img.width - padding, img.height - padding);

        resolve(canvas.toDataURL(mimeType));
      };
      // Handle load error by returning original
      img.onerror = () => resolve(`data:${mimeType};base64,${base64}`);
      
      img.src = `data:${mimeType};base64,${base64}`;
    });
  };

  const handleDownload = useCallback(async () => {
    if (!generatedImage) return;

    let imageUrl = `data:${generatedImage.mimeType};base64,${generatedImage.base64}`;
    
    if (showWatermark && watermarkText.trim()) {
      try {
        imageUrl = await applyWatermark(generatedImage.base64, generatedImage.mimeType, watermarkText.trim());
      } catch (e) {
        console.error("Filigran eklenirken hata oluştu", e);
      }
    }

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `tdanimator-${generatedImage.timestamp}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImage, showWatermark, watermarkText]);

  const handleShare = useCallback(async () => {
    if (!generatedImage) return;

    try {
      let imageUrl = `data:${generatedImage.mimeType};base64,${generatedImage.base64}`;
      
      if (showWatermark && watermarkText.trim()) {
        imageUrl = await applyWatermark(generatedImage.base64, generatedImage.mimeType, watermarkText.trim());
      }

      // Convert Data URL to Blob
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], `tdanimator-${generatedImage.timestamp}.jpg`, { type: generatedImage.mimeType });

      if (navigator.share) {
        await navigator.share({
          title: 'TdAnimator ile oluşturuldu',
          text: `TdAnimator ile oluşturuldu: "${generatedImage.prompt}"`,
          files: [file],
        });
      } else {
        alert('Cihazınız doğrudan paylaşmayı desteklemiyor. Lütfen görseli indirin ve manuel olarak paylaşın.');
      }
    } catch (error) {
      console.error('Paylaşım hatası:', error);
    }
  }, [generatedImage, showWatermark, watermarkText]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
        handleGenerate();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Controls */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-slate-300 mb-2">
                Görsel Açıklaması (Prompt)
              </label>
              <div className="relative">
                <textarea
                  ref={textAreaRef}
                  id="prompt"
                  className="w-full bg-darker border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all min-h-[140px]"
                  placeholder="Görselinizi detaylı bir şekilde tanımlayın... (örn., 'Neon ışıkları altında yağmurlu bir sokak, siberpunk tarzı, 8k çözünürlük')"
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                />
                <div className="absolute bottom-3 right-3 text-xs text-slate-500">
                  {prompt.length} karakter
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                En Boy Oranı
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.value}
                    onClick={() => setAspectRatio(ratio.value)}
                    disabled={isLoading}
                    className={`
                      p-3 text-left rounded-lg border transition-all flex flex-col gap-1
                      ${aspectRatio === ratio.value 
                        ? 'bg-primary/20 border-primary text-white' 
                        : 'bg-darker border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5'}
                    `}
                  >
                    <span className="font-medium text-sm">{ratio.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Watermark Controls */}
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 cursor-pointer">
                  <StampIcon className="w-4 h-4 text-primary" />
                  Filigran Ekle
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showWatermark} 
                    onChange={(e) => setShowWatermark(e.target.checked)} 
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              {showWatermark && (
                <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="Filigran metnini girin"
                    className="w-full bg-darker border border-white/10 rounded-lg p-2 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-primary outline-none"
                    maxLength={30}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className={`
                w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold text-lg transition-all shadow-lg mt-2
                ${isLoading || !prompt.trim()
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-primaryHover text-white hover:shadow-primary/25 shadow-primary/10'}
              `}
            >
              {isLoading ? (
                <>
                  <LoaderIcon className="animate-spin w-5 h-5" />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <WandIcon className="w-5 h-5" />
                  Görüntü Oluştur
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
                <AlertCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">{error}</div>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-surface/50 border border-white/5 rounded-xl p-6 text-slate-400 text-sm space-y-2">
            <h4 className="font-semibold text-slate-200">Daha iyi sonuçlar için ipuçları:</h4>
            <ul className="list-disc pl-5 space-y-1 marker:text-slate-600">
                <li>Aydınlatmayı belirtin (örn. "sinematik ışık", "gün batımı").</li>
                <li>Sanat tarzını belirtin (örn. "yağlı boya", "3D render", "fotogerçekçi").</li>
                <li>Ruh halini tanımlayın (örn. "gizemli", "neşeli", "karanlık").</li>
            </ul>
        </div>
      </div>

      {/* Right Column: Preview & History */}
      <div className="lg:col-span-8 flex flex-col gap-8">
        {/* Main Preview */}
        <div className="h-full min-h-[500px] bg-surface border border-white/10 rounded-2xl overflow-hidden flex flex-col relative shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent pointer-events-none"></div>
            
            <div className="flex-1 flex items-center justify-center p-6 bg-black/20">
                {isLoading ? (
                    <div className="text-center space-y-6 animate-pulse">
                        <div className="relative mx-auto w-24 h-24">
                            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
                            <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 border border-primary/50">
                                <LoaderIcon className="w-10 h-10 text-primary animate-spin" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-medium text-white">Görseliniz hazırlanıyor...</h3>
                            <p className="text-slate-400 max-w-sm mx-auto">
                                Bu işlem genellikle 5-10 saniye sürer. Yapay zeka isteğinizi işliyor.
                            </p>
                        </div>
                    </div>
                ) : generatedImage ? (
                    <div className="relative group w-full h-full flex items-center justify-center">
                        <div className="relative max-w-full max-h-[70vh]">
                          <img 
                              src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`} 
                              alt={generatedImage.prompt}
                              className="w-full h-full object-contain rounded-lg shadow-2xl"
                          />
                          {/* CSS-based Watermark Preview */}
                          {showWatermark && watermarkText.trim() && (
                            <div className="absolute bottom-[2.5%] right-[2.5%] text-white/85 font-bold z-10 pointer-events-none select-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" style={{ fontSize: 'clamp(12px, 3.5%, 32px)' }}>
                              {watermarkText}
                            </div>
                          )}
                        </div>
                        
                        <div className="absolute inset-0 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-6 bg-gradient-to-t from-black/80 via-transparent to-transparent rounded-lg">
                            <div className="flex gap-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                              <button 
                                  onClick={handleShare}
                                  className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold py-3 px-6 rounded-full hover:bg-white/20 transition-colors shadow-lg"
                              >
                                  <ShareIcon className="w-5 h-5" />
                                  Paylaş
                              </button>
                              <button 
                                  onClick={handleDownload}
                                  className="flex items-center gap-2 bg-white text-dark font-bold py-3 px-6 rounded-full hover:bg-slate-200 transition-colors shadow-lg"
                              >
                                  <DownloadIcon className="w-5 h-5" />
                                  İndir
                              </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-4 opacity-40 max-w-md mx-auto">
                        <div className="w-24 h-24 mx-auto bg-white/5 rounded-full flex items-center justify-center">
                            <ImageIcon className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-medium text-white">Henüz görsel oluşturulmadı</h3>
                        <p className="text-slate-400">
                            Sol panele bir açıklama girin ve görselinizi oluşturmak için butona tıklayın.
                        </p>
                    </div>
                )}
            </div>
        </div>

        {/* History Section */}
        {history.length > 0 && (
          <div className="bg-surface border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-200">
                <HistoryIcon className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Geçmiş Çalışmalar</h3>
              </div>
              <button 
                onClick={clearHistory}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                Geçmişi Temizle
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {history.map((item) => (
                <button
                  key={item.timestamp}
                  onClick={() => handleRestore(item)}
                  className="group relative aspect-square bg-black/40 rounded-xl overflow-hidden border border-white/5 hover:border-primary/50 hover:ring-2 hover:ring-primary/20 transition-all text-left"
                >
                  <img 
                    src={`data:${item.mimeType};base64,${item.base64}`} 
                    alt={item.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                    <p className="text-white text-[10px] line-clamp-3 font-medium leading-tight">
                      {item.prompt}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGenerator;