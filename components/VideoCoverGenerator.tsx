
import React, { useState, useRef, useCallback } from 'react';
import { UploadCloudIcon, VideoIcon, FilmIcon, YoutubeIcon, LoaderIcon, WandIcon, DownloadIcon, XIcon, AlertCircleIcon, ImageIcon, ClapperboardIcon } from './Icons';
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canInteract = user?.role === 'admin' || user?.role === 'editor';

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
    if (file.size > 50 * 1024 * 1024) { // 50MB Limit
        setError("Dosya boyutu 50MB'dan küçük olmalıdır.");
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
    
    try {
        setProcessingStep('analyzing');
        const reader = new FileReader();
        reader.readAsDataURL(mediaFile);
        
        reader.onloadend = async () => {
            try {
                const base64Media = reader.result as string;
                
                const analysisResult = await analyzeVideoForThumbnail(
                    base64Media, 
                    userPrompt, 
                    selectedCategory, 
                    selectedStyle,
                    mediaFile.type 
                );
                
                setGeneratedPrompt(analysisResult.descriptionTR);

                setProcessingStep('generating');
                const result = await generateImage(
                    analysisResult.prompt, 
                    aspectRatio, 
                    'image/jpeg', 
                    undefined, 
                    undefined, 
                    'gemini-flash'
                );
                
                setGeneratedCover(`data:${result.mimeType};base64,${result.imageBytes}`);
                
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full min-h-[600px]">
        {/* LEFT PANEL: Input */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-400">
                    <VideoIcon className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Video Kapağı / Thumbnail</h2>
                    <p className="text-sm text-slate-400">Videonu yükle, dikkat çekici bir kapak tasarla.</p>
                </div>
            </div>

            {/* Video Upload Area */}
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
                            <p className="text-base font-bold text-white">MP4 Videosunu Sürükle</p>
                            <p className="text-xs text-slate-500 mt-1">veya bilgisayarından seç (Max 50MB)</p>
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
                        <div className="w-full max-w-xs aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative shadow-xl">
                            {mediaSrc && (
                                <video src={mediaSrc} controls className="w-full h-full object-cover" />
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-white font-bold text-sm truncate max-w-xs">{mediaFile.name}</p>
                            <p className="text-slate-400 text-[10px]">{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>

                        <button 
                            onClick={removeFile}
                            className="absolute top-2 right-2 p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                            title="Dosyayı Kaldır"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
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
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Kapak Stili</label>
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
                    </div>
                </div>
            </div>

             {/* Aspect Ratio Toggle */}
             <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Kapak Formatı</label>
                <div className="flex bg-darker rounded-lg p-1 border border-white/10 w-fit">
                    <button 
                        onClick={() => setAspectRatio('16:9')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${aspectRatio === '16:9' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Yatay (16:9)
                    </button>
                    <button 
                        onClick={() => setAspectRatio('9:16')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${aspectRatio === '9:16' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Dikey / Shorts (9:16)
                    </button>
                </div>
            </div>

            {/* Details Input */}
            <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Kapak Detayları (Opsiyonel)
                </label>
                <textarea 
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Örn: Şaşırmış yüz ifadesi olsun, sağ tarafta patlama efekti, büyük ve parlak yazı alanı bırak..."
                    disabled={isProcessing || !canInteract}
                    className="w-full h-32 bg-darker border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                />
            </div>

            <button
                onClick={handleGenerate}
                disabled={!mediaFile || isProcessing || !canInteract}
                className={`
                    w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all
                    ${!mediaFile || isProcessing || !canInteract
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/25'}
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
                    
                    <div className={`relative w-full max-w-xl shadow-2xl rounded-xl overflow-hidden group/cover ${aspectRatio === '9:16' ? 'max-w-sm aspect-[9/16]' : 'aspect-video'}`}>
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
                        
                        {/* YouTube UI Simulation Overlay (Optional Visual Flair) */}
                        {aspectRatio === '16:9' && (
                            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-80 pointer-events-none">
                                12:45
                            </div>
                        )}
                    </div>

                    <div className="mt-8 px-6 text-center w-full max-w-lg">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                            <p className="text-xs text-red-300 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                                <YoutubeIcon className="w-4 h-4" /> AI Stratejisi
                            </p>
                            <p className="text-sm text-slate-300 leading-relaxed">{generatedPrompt}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center opacity-40 max-w-sm">
                    <div className="w-32 h-32 border-4 border-dashed border-white/20 rounded-xl mx-auto mb-6 flex items-center justify-center">
                        <FilmIcon className="w-16 h-16 text-white/20" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Henüz Kapak Yok</h3>
                    <p className="text-slate-400">
                        Videonu yükle, YouTube veya sosyal medya için tıklanabilir bir kapak tasarla.
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};

export default VideoCoverGenerator;
