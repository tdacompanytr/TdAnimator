
import React, { useState, useRef, useCallback } from 'react';
import { UploadCloudIcon, MusicIcon, DiscIcon, LoaderIcon, WandIcon, DownloadIcon, XIcon, AlertCircleIcon, HeadphonesIcon, ImageIcon } from './Icons';
import { analyzeAudioForImage, generateImage } from '../services/geminiService';
import { User } from '../types';

interface CoverArtGeneratorProps {
  user: User | null;
}

const CoverArtGenerator: React.FC<CoverArtGeneratorProps> = ({ user }) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  // Reference Image for Cover Art
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>(''); // 'analyzing', 'generating'
  const [generatedCover, setGeneratedCover] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null); // New Ref for image input
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
    if (file && file.type.startsWith('audio/')) {
        processAudioFile(file);
    } else {
        setError("Lütfen geçerli bir MP3/Ses dosyası yükleyin.");
    }
  }, [canInteract]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canInteract) return;
    const file = e.target.files?.[0];
    if (file) processAudioFile(file);
  };

  // Handle Reference Image Selection
  const handleRefImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canInteract) return;
    const file = e.target.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            setError("Lütfen geçerli bir resim dosyası seçin.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setReferenceImage(event.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const processAudioFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit for browser perf
        setError("Dosya boyutu 10MB'dan küçük olmalıdır.");
        return;
    }
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    setAudioSrc(url);
    setError(null);
    setGeneratedCover(null);
  };

  const removeFile = () => {
    setAudioFile(null);
    setAudioSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeRefImage = () => {
      setReferenceImage(null);
      if (refImageInputRef.current) refImageInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!audioFile || !canInteract) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
        // 1. Convert Audio to Base64
        setProcessingStep('analyzing');
        const reader = new FileReader();
        reader.readAsDataURL(audioFile);
        
        reader.onloadend = async () => {
            try {
                const base64Audio = reader.result as string;
                
                // 2. Analyze Audio with Gemini
                // Pass true if referenceImage exists, so it generates STYLE prompts, not SUBJECT prompts.
                const aiPrompt = await analyzeAudioForImage(base64Audio, userPrompt, !!referenceImage);
                setGeneratedPrompt(aiPrompt);

                // 3. Generate Image
                // We pass the reference image if it exists. 
                // The service handles mixing the prompt + reference image logic.
                setProcessingStep('generating');
                const result = await generateImage(
                    aiPrompt, 
                    '1:1', 
                    'image/jpeg', 
                    referenceImage || undefined, // Pass reference image here
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
                <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                    <MusicIcon className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Şarkı Kapağı Oluşturucu</h2>
                    <p className="text-sm text-slate-400">Şarkını yükle, yapay zeka ruhunu hissetsin.</p>
                </div>
            </div>

            {/* Audio Upload Area */}
            <div 
                className={`
                    flex-1 border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center p-8 relative overflow-hidden group min-h-[200px]
                    ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : audioFile ? 'border-indigo-500/50 bg-indigo-900/10' : 'border-white/10 bg-darker hover:border-white/20 hover:bg-white/5'}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {!audioFile ? (
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                            <UploadCloudIcon className="w-10 h-10 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-white">MP3 Dosyasını Sürükle</p>
                            <p className="text-sm text-slate-500 mt-1">veya bilgisayarından seç (Max 10MB)</p>
                        </div>
                        <input 
                            type="file" 
                            accept="audio/*" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!canInteract}
                            className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${!canInteract ? 'bg-slate-700 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                        >
                            Dosya Seç
                        </button>
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 relative z-10">
                        <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl animate-spin-slow">
                            <DiscIcon className="w-12 h-12 text-white" />
                        </div>
                        <div className="text-center">
                            <p className="text-white font-bold text-lg truncate max-w-xs">{audioFile.name}</p>
                            <p className="text-slate-400 text-xs">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        
                        {audioSrc && (
                            <audio controls src={audioSrc} className="w-full max-w-xs mt-2 opacity-80" />
                        )}

                        <button 
                            onClick={removeFile}
                            className="absolute top-0 right-0 p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                            title="Dosyayı Kaldır"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
                
                {/* Background Visualizer Effect (Fake) */}
                {audioFile && (
                    <div className="absolute inset-0 pointer-events-none opacity-20 flex items-end justify-center gap-1 pb-4">
                        {[...Array(20)].map((_,i) => (
                            <div key={i} className="w-2 bg-indigo-500 rounded-t-sm animate-pulse" style={{ height: `${Math.random() * 50 + 10}%`, animationDuration: `${Math.random() * 0.5 + 0.5}s` }}></div>
                        ))}
                    </div>
                )}
            </div>

            {/* Description Input & Reference Image */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Kapak Detayları (Opsiyonel)
                </label>
                <div className="relative">
                    <textarea 
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        placeholder="Örn: Cyberpunk şehri, neon ışıklar, hüzünlü atmosfer..."
                        disabled={isProcessing || !canInteract}
                        className="w-full bg-darker border border-white/10 rounded-xl p-4 pb-12 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-32"
                    />
                    
                    {/* Image Upload Button (Inside Textarea) */}
                    <div className="absolute bottom-3 left-3 z-10">
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={refImageInputRef} 
                            onChange={handleRefImageSelect} 
                            className="hidden" 
                            id="cover-ref-upload"
                        />
                        <button 
                            onClick={() => refImageInputRef.current?.click()}
                            disabled={isProcessing || !canInteract}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-white/5 
                                ${referenceImage ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/30' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'}`}
                            title="Referans Resim Ekle"
                        >
                            <ImageIcon className="w-4 h-4" />
                            {referenceImage ? 'Resim Değiştir' : 'Resim Ekle'}
                        </button>
                    </div>

                    <div className="absolute bottom-3 right-3 text-slate-600">
                        <HeadphonesIcon className="w-5 h-5" />
                    </div>
                </div>

                {/* Reference Image Preview */}
                {referenceImage && (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 shrink-0 relative group">
                            <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white">Referans Görsel Aktif</p>
                            <p className="text-[10px] text-slate-400 truncate">Kapakta bu görselin yapısı korunacak.</p>
                        </div>
                        <button 
                            onClick={removeRefImage}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <button
                onClick={handleGenerate}
                disabled={!audioFile || isProcessing || !canInteract}
                className={`
                    w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all
                    ${!audioFile || isProcessing || !canInteract
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25'}
                `}
            >
                {isProcessing ? (
                    <>
                        <LoaderIcon className="w-6 h-6 animate-spin" />
                        {processingStep === 'analyzing' ? 'Şarkı Dinleniyor...' : 'Kapak Tasarlanıyor...'}
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
        <div className="bg-black/20 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none"></div>
            
            {generatedCover ? (
                <div className="relative w-full max-w-md aspect-square shadow-2xl rounded-xl overflow-hidden group/cover animate-in zoom-in duration-500">
                    <img src={generatedCover} alt="Generated Cover" className="w-full h-full object-cover" />
                    
                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
                        <button 
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = generatedCover;
                                link.download = `cover-art-${Date.now()}.jpg`;
                                link.click();
                            }}
                            className="bg-white text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                        >
                            <DownloadIcon className="w-5 h-5" /> İndir
                        </button>
                        <div className="px-6 text-center">
                            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">AI Analizi</p>
                            <p className="text-sm text-white line-clamp-4">{generatedPrompt}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center opacity-40 max-w-sm">
                    <div className="w-32 h-32 border-4 border-dashed border-white/20 rounded-xl mx-auto mb-6 flex items-center justify-center">
                        <DiscIcon className="w-16 h-16 text-white/20" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Henüz Kapak Yok</h3>
                    <p className="text-slate-400">
                        Sol taraftan bir şarkı yükle ve "Kapağı Oluştur" butonuna bas. Yapay zeka şarkıyı dinleyip uygun görseli tasarlayacak.
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};

export default CoverArtGenerator;
