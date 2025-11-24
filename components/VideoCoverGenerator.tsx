
import React, { useState, useRef, useCallback } from 'react';
import { UploadCloudIcon, VideoIcon, FilmIcon, YoutubeIcon, LoaderIcon, WandIcon, DownloadIcon, XIcon, AlertCircleIcon, ImageIcon, ClapperboardIcon, SparklesIcon } from './Icons';
import { analyzeVideoForThumbnail, generateImage } from '../services/geminiService';
import { User, VideoCategory, ThumbnailStyle, VIDEO_CATEGORIES, THUMBNAIL_STYLES } from '../types';

interface VideoCoverGeneratorProps {
  user: User | null;
}

const VideoCoverGenerator: React.FC<VideoCoverGeneratorProps> = ({ user }) => {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  
  // Settings
  const [selectedCategory, setSelectedCategory] = useState<VideoCategory>('none');
  const [selectedStyle, setSelectedStyle] = useState<ThumbnailStyle>('none');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>(''); // 'analyzing', 'generating'
  const [generatedCover, setGeneratedCover] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Refine States
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canInteract = user?.role === 'admin' || user?.role === 'editor';

  // --- Helper Function: Compress Image to < 2MB ---
  const compressImageTo2MB = (base64Str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Calculate approximate size in bytes
        const getSizeInBytes = (str: string) => {
            const padding = (str.match(/=+$/) || [''])[0].length;
            return (str.length * 3 / 4) - padding;
        };

        const originalSize = getSizeInBytes(base64Str.split(',')[1]);
        const LIMIT = 2 * 1024 * 1024; // 2MB in bytes

        // If already smaller than 2MB, return as is
        if (originalSize <= LIMIT) {
            resolve(base64Str);
            return;
        }

        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                resolve(base64Str); // Fallback
                return;
            }

            ctx.drawImage(img, 0, 0);

            // Start compressing
            let quality = 0.9;
            let newBase64 = canvas.toDataURL('image/jpeg', quality);
            
            // Loop until size is acceptable or quality is too low
            while (getSizeInBytes(newBase64.split(',')[1]) > LIMIT && quality > 0.1) {
                quality -= 0.1;
                newBase64 = canvas.toDataURL('image/jpeg', quality);
            }

            resolve(newBase64);
        };
        img.onerror = (e) => reject(e);
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canInteract) return;
    setIsDragging(true);
  }, [canInteract]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!canInteract) return;

    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('video/'))) {
        processMediaFile(file);
    } else {
        setError("Lütfen geçerli bir Video dosyası (MP4) yükleyin.");
    }
  }, [canInteract]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canInteract) return;
    const file = e.target.files?.[0];
    if (file) processMediaFile(file);
  };

  const processMediaFile = (file: File) => {
    // Limit increased to 10GB as requested
    const MAX_SIZE = 10 * 1024 * 1024 * 1024; 

    if (file.size > MAX_SIZE) { 
        setError("Dosya boyutu 10GB'dan küçük olmalıdır.");
        return;
    }
    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setMediaSrc(url);
    setError(null);
    setGeneratedCover(null);
  };

  const removeFile = () => {
    setMediaFile(null);
    setMediaSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!mediaFile || !canInteract) return;
    
    setIsProcessing(true);
    setError(null);
    setShowRefineInput(false);
    
    try {
        setProcessingStep('analyzing');
        const reader = new FileReader();
        reader.readAsDataURL(mediaFile);
        
        reader.onloadend = async () => {
            try {
                const base64Media = reader.result as string;
                
                // Analyze Video
                const analysisResult = await analyzeVideoForThumbnail(
                    base64Media, 
                    userPrompt, 
                    selectedCategory,
                    selectedStyle,
                    mediaFile.type // e.g. video/mp4
                );
                
                setGeneratedPrompt(analysisResult.descriptionTR);

                // Generate Image
                setProcessingStep('generating');
                const result = await generateImage(
                    analysisResult.prompt, 
                    aspectRatio, // 16:9 or 9:16
                    'image/jpeg', 
                    undefined, 
                    undefined, 
                    'gemini-flash'
                );
                
                const rawBase64 = `data:${result.mimeType};base64,${result.imageBytes}`;
                
                // Compress to ensure < 2MB for YouTube
                const compressedBase64 = await compressImageTo2MB(rawBase64);
                
                setGeneratedCover(compressedBase64);
                
            } catch (err: any) {
                setError(err.message || "İşlem sırasında bir hata oluştu.");
            } finally {
                setIsProcessing(false);
            }
        };

        reader.onerror = () => {
            setError("Dosya okunamadı.");
            setIsProcessing(false);
        };

    } catch (e: any) {
        setError(e.message);
        setIsProcessing(false);
    }
  };

  const handleRefine = async () => {
    if (!generatedCover || !refinePrompt.trim() || !canInteract) return;

    setIsRefining(true);
    setError(null);

    try {
        const result = await generateImage(
            refinePrompt,
            aspectRatio, // Use current aspect ratio
            'image/jpeg', 
            generatedCover, // Use current image as reference
            undefined, 
            'gemini-flash'
        );

        const rawBase64 = `data:${result.mimeType};base64,${result.imageBytes}`;
        
        // Compress to ensure < 2MB for YouTube
        const compressedBase64 = await compressImageTo2MB(rawBase64);

        setGeneratedCover(compressedBase64);
        setShowRefineInput(false);
        setRefinePrompt('');
        setGeneratedPrompt(`(Düzenlendi) ${refinePrompt}`);
    } catch (err: any) {
        setError(err.message || "Düzenleme sırasında hata oluştu.");
    } finally {
        setIsRefining(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full min-h-[600px]">
        {/* LEFT PANEL: Input */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-400">
                    <VideoIcon className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Video Kapağı (Thumbnail)</h2>
                    <p className="text-sm text-slate-400">Videonu yükle, en ilgi çekici anı yakalayalım.</p>
                </div>
            </div>

            {/* Media Upload Area */}
            <div 
                className={`
                    border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center p-6 relative overflow-hidden group min-h-[200px]
                    ${isDragging ? 'border-red-500 bg-red-500/10' : mediaFile ? 'border-red-500/50 bg-red-900/10' : 'border-white/10 bg-darker hover:border-white/20 hover:bg-white/5'}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {!mediaFile ? (
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                            <UploadCloudIcon className="w-8 h-8 text-red-400" />
                        </div>
                        <div>
                            <p className="text-base font-bold text-white">Video Dosyasını Sürükle (MP4)</p>
                            <p className="text-xs text-slate-500 mt-1">veya bilgisayarından seç (Max 10GB)</p>
                        </div>
                        <input 
                            type="file" 
                            accept="video/mp4,video/quicktime,video/webm" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!canInteract}
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors ${!canInteract ? 'bg-slate-700 text-slate-500' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                        >
                            Video Seç
                        </button>
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 relative z-10">
                        <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                            <FilmIcon className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-center">
                            <p className="text-white font-bold text-sm truncate max-w-xs">{mediaFile.name}</p>
                            <p className="text-slate-400 text-[10px]">{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        
                        {mediaSrc && (
                            <div className="mt-2 w-full max-w-xs flex justify-center">
                                <video src={mediaSrc} controls className="h-24 rounded-lg border border-white/10" />
                            </div>
                        )}

                        <button 
                            onClick={removeFile}
                            className="absolute top-0 right-0 p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                            title="Dosyayı Kaldır"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-2 gap-4">
                {/* Category Selection */}
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Video Kategorisi</label>
                    <div className="relative">
                        <select 
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as VideoCategory)}
                            className="w-full bg-darker border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-red-500 appearance-none"
                            disabled={isProcessing}
                        >
                            {VIDEO_CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-2.5 pointer-events-none text-slate-500">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </div>
                </div>

                {/* Style Selection */}
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Thumbnail Stili</label>
                    <div className="relative">
                        <select 
                            value={selectedStyle}
                            onChange={(e) => setSelectedStyle(e.target.value as ThumbnailStyle)}
                            className="w-full bg-darker border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-red-500 appearance-none"
                            disabled={isProcessing}
                        >
                            {THUMBNAIL_STYLES.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-2.5 pointer-events-none text-slate-500">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Format Selection (16:9 vs 9:16) */}
             <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Video Formatı</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setAspectRatio('16:9')}
                        className={`p-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${aspectRatio === '16:9' ? 'bg-red-600/20 border-red-500 text-white' : 'bg-darker border-white/10 text-slate-400'}`}
                    >
                        <YoutubeIcon className="w-4 h-4" /> Yatay (YouTube)
                    </button>
                    <button
                        onClick={() => setAspectRatio('9:16')}
                        className={`p-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${aspectRatio === '9:16' ? 'bg-red-600/20 border-red-500 text-white' : 'bg-darker border-white/10 text-slate-400'}`}
                    >
                        <div className="w-3 h-5 border-2 border-current rounded-sm"></div> Dikey (Shorts/Reels)
                    </button>
                </div>
            </div>

            {/* Description Input */}
            <div className="flex-1 min-h-[100px]">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Ek Detaylar (Opsiyonel)
                </label>
                <textarea 
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Örn: Videoda şaşırdığım bir an var, arka plan renkli olsun..."
                    disabled={isProcessing || !canInteract}
                    className="w-full h-full bg-darker border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                />
            </div>

            <button
                onClick={handleGenerate}
                disabled={!mediaFile || isProcessing || !canInteract}
                className={`
                    w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all
                    ${!mediaFile || isProcessing || !canInteract
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-red-500/25'}
                `}
            >
                {isProcessing ? (
                    <>
                        <LoaderIcon className="w-6 h-6 animate-spin" />
                        {processingStep === 'analyzing' ? 'Video İzleniyor...' : 'Kapak Tasarlanıyor...'}
                    </>
                ) : (
                    <>
                        <WandIcon className="w-6 h-6" />
                        Kapağı Oluştur
                    </>
                )}
            </button>
            
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-2 text-sm">
                    <AlertCircleIcon className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}
        </div>

        {/* RIGHT PANEL: Output */}
        <div className="bg-black/20 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden group min-h-[500px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent pointer-events-none"></div>

            {generatedCover ? (
                <div className="flex flex-col items-center w-full animate-in zoom-in duration-500">
                    
                    {/* Visualizer Area */}
                    <div className={`relative w-full ${aspectRatio === '16:9' ? 'aspect-video max-w-2xl' : 'aspect-[9/16] max-w-sm'} shadow-2xl rounded-xl overflow-hidden group/cover`}>
                        <img src={generatedCover} alt="Generated Thumbnail" className="w-full h-full object-cover" />
                        
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
                            <button 
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = generatedCover!;
                                    link.download = `thumbnail-${Date.now()}.jpg`;
                                    link.click();
                                }}
                                className="bg-white text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                            >
                                <DownloadIcon className="w-5 h-5" /> İndir
                            </button>
                        </div>
                        
                        {/* Fake Youtube UI Overlay for Preview */}
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            10:24
                        </div>
                    </div>

                    {/* Magic Refine Toolbar */}
                    <div className="mt-6 w-full max-w-md">
                        {!showRefineInput ? (
                             <button 
                                onClick={() => setShowRefineInput(true)}
                                disabled={isRefining || !canInteract}
                                className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                            >
                                <SparklesIcon className="w-4 h-4" />
                                AI Düzenleme Modu
                            </button>
                        ) : (
                            <div className="bg-darker border border-white/20 rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex gap-2 mb-2">
                                    <SparklesIcon className="w-4 h-4 text-purple-400 mt-0.5" />
                                    <p className="text-xs text-slate-300 font-medium">Thumbnail üzerinde ne değiştirelim?</p>
                                </div>
                                <input 
                                    type="text" 
                                    value={refinePrompt}
                                    onChange={(e) => setRefinePrompt(e.target.value)}
                                    placeholder="Örn: Yazıları kaldır, daha parlak yap, patlama ekle..."
                                    className="w-full bg-surface border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-red-500 mb-3"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                />
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => setShowRefineInput(false)}
                                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button 
                                        onClick={handleRefine}
                                        disabled={isRefining || !refinePrompt.trim()}
                                        className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isRefining ? <LoaderIcon className="w-3 h-3 animate-spin" /> : 'Uygula'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 px-6 text-center w-full max-w-lg">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <p className="text-xs text-red-300 uppercase tracking-widest font-bold mb-2 flex items-center justify-center gap-2">
                                <ClapperboardIcon className="w-3 h-3" />
                                AI Video Analizi
                            </p>
                            <p className="text-sm text-slate-300 leading-relaxed">{generatedPrompt}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center opacity-40 max-w-sm">
                    <div className="w-32 h-32 border-4 border-dashed border-white/20 rounded-xl mx-auto mb-6 flex items-center justify-center">
                        <YoutubeIcon className="w-16 h-16 text-white/20" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Thumbnail Hazır Değil</h3>
                    <p className="text-slate-400">
                        Sol taraftan videonu yükle ve "Kapağı Oluştur" butonuna bas. Yapay zeka videonun en "tıklanabilir" anını bulup tasarlayacak.
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};

export default VideoCoverGenerator;
