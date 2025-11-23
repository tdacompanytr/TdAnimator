
import React, { useState, useRef, useCallback } from 'react';
import { UploadCloudIcon, MusicIcon, DiscIcon, LoaderIcon, WandIcon, DownloadIcon, XIcon, AlertCircleIcon, HeadphonesIcon, ImageIcon, SettingsIcon, SparklesIcon } from './Icons';
import { analyzeAudioForImage, generateImage } from '../services/geminiService';
import { User, MusicGenre, CoverStyle, MUSIC_GENRES, COVER_STYLES } from '../types';

interface CoverArtGeneratorProps {
  user: User | null;
}

type MockupType = 'flat' | 'vinyl' | 'cd';

const CoverArtGenerator: React.FC<CoverArtGeneratorProps> = ({ user }) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  // Reference Image for Cover Art
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  
  // New Settings
  const [selectedGenre, setSelectedGenre] = useState<MusicGenre>('none');
  const [selectedStyle, setSelectedStyle] = useState<CoverStyle>('none');
  const [mockupType, setMockupType] = useState<MockupType>('flat');
  
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
    setShowRefineInput(false);
    
    try {
        // 1. Convert Audio to Base64
        setProcessingStep('analyzing');
        const reader = new FileReader();
        reader.readAsDataURL(audioFile);
        
        reader.onloadend = async () => {
            try {
                const base64Audio = reader.result as string;
                
                // 2. Analyze Audio with Gemini (Now passing genre and style)
                const analysisResult = await analyzeAudioForImage(
                    base64Audio, 
                    userPrompt, 
                    !!referenceImage, 
                    selectedGenre, 
                    selectedStyle
                );
                
                // Set UI text to Turkish description
                setGeneratedPrompt(analysisResult.descriptionTR);

                // 3. Generate Image
                // We pass the ENGLISH prompt for generation
                setProcessingStep('generating');
                const result = await generateImage(
                    analysisResult.prompt, 
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

  const handleRefine = async () => {
    if (!generatedCover || !refinePrompt.trim() || !canInteract) return;

    setIsRefining(true);
    setError(null);

    try {
        const result = await generateImage(
            refinePrompt,
            '1:1', 
            'image/jpeg', 
            generatedCover, // Use current image as reference
            undefined, 
            'gemini-flash'
        );

        setGeneratedCover(`data:${result.mimeType};base64,${result.imageBytes}`);
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
                    border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center p-6 relative overflow-hidden group min-h-[160px]
                    ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : audioFile ? 'border-indigo-500/50 bg-indigo-900/10' : 'border-white/10 bg-darker hover:border-white/20 hover:bg-white/5'}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {!audioFile ? (
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                            <UploadCloudIcon className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-base font-bold text-white">MP3 Dosyasını Sürükle</p>
                            <p className="text-xs text-slate-500 mt-1">veya bilgisayarından seç (Max 10MB)</p>
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
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors ${!canInteract ? 'bg-slate-700 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                        >
                            Dosya Seç
                        </button>
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 relative z-10">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl animate-spin-slow">
                            <DiscIcon className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-center">
                            <p className="text-white font-bold text-sm truncate max-w-xs">{audioFile.name}</p>
                            <p className="text-slate-400 text-[10px]">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        
                        {audioSrc && (
                            <audio controls src={audioSrc} className="w-full max-w-xs mt-1 opacity-80 h-8" />
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

            {/* New Settings Section: Genre & Style */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Müzik Türü</label>
                    <div className="relative">
                        <select 
                            value={selectedGenre}
                            onChange={(e) => setSelectedGenre(e.target.value as MusicGenre)}
                            className="w-full bg-darker border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500 appearance-none"
                            disabled={isProcessing}
                        >
                            {MUSIC_GENRES.map(g => (
                                <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-2.5 pointer-events-none text-slate-500">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Kapak Stili</label>
                    <div className="relative">
                        <select 
                            value={selectedStyle}
                            onChange={(e) => setSelectedStyle(e.target.value as CoverStyle)}
                            className="w-full bg-darker border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500 appearance-none"
                            disabled={isProcessing}
                        >
                            {COVER_STYLES.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-2.5 pointer-events-none text-slate-500">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Description Input & Reference Image */}
            <div className="flex-1 min-h-[140px]">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Kapak Detayları (Opsiyonel)
                </label>
                <div className="relative h-full">
                    <textarea 
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        placeholder="Örn: Cyberpunk şehri, neon ışıklar, hüzünlü atmosfer..."
                        disabled={isProcessing || !canInteract}
                        className="w-full h-full bg-darker border border-white/10 rounded-xl p-4 pb-12 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
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
                            <p className="text-slate-400 text-[10px] truncate">Kapakta bu görselin yapısı korunacak.</p>
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
        <div className="bg-black/20 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden group min-h-[500px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none"></div>
            
            {/* Mockup Toggle Buttons */}
            {generatedCover && (
                <div className="absolute top-6 right-6 z-20 flex bg-white/5 backdrop-blur-md rounded-lg p-1 border border-white/10">
                    <button 
                        onClick={() => setMockupType('flat')} 
                        className={`p-2 rounded-md text-xs font-bold transition-all ${mockupType === 'flat' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Düz Görünüm"
                    >
                        <SquareIcon className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setMockupType('vinyl')} 
                        className={`p-2 rounded-md text-xs font-bold transition-all ${mockupType === 'vinyl' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Plak Görünümü"
                    >
                        <DiscIcon className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setMockupType('cd')} 
                        className={`p-2 rounded-md text-xs font-bold transition-all ${mockupType === 'cd' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="CD Görünümü"
                    >
                        <MusicIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {generatedCover ? (
                <div className="flex flex-col items-center w-full">
                    
                    {/* Visualizer Area */}
                    <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
                        
                        {/* FLAT VIEW */}
                        {mockupType === 'flat' && (
                            <div className="relative w-full h-full shadow-2xl rounded-xl overflow-hidden group/cover animate-in zoom-in duration-500">
                                <img src={generatedCover} alt="Generated Cover" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
                                    <button 
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = generatedCover!;
                                            link.download = `cover-art-${Date.now()}.jpg`;
                                            link.click();
                                        }}
                                        className="bg-white text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                                    >
                                        <DownloadIcon className="w-5 h-5" /> İndir
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* VINYL MOCKUP */}
                        {mockupType === 'vinyl' && (
                            <div className="relative w-[90%] h-[90%] animate-in zoom-in duration-500 flex items-center justify-center">
                                {/* Sleeve */}
                                <div className="absolute left-0 top-0 bottom-0 w-[95%] bg-white/5 rounded-md border border-white/10 shadow-2xl z-0 transform -translate-x-4">
                                     <img src={generatedCover} alt="Sleeve" className="w-full h-full object-cover opacity-30 blur-sm rounded-md" />
                                </div>
                                {/* Record */}
                                <div className="relative z-10 w-full h-full rounded-full bg-black border-[6px] border-black shadow-2xl flex items-center justify-center overflow-hidden ml-12">
                                     {/* Grooves */}
                                     <div className="absolute inset-0 rounded-full border-[20px] border-white/5 opacity-20"></div>
                                     <div className="absolute inset-4 rounded-full border-[20px] border-white/5 opacity-20"></div>
                                     <div className="absolute inset-10 rounded-full border-[20px] border-white/5 opacity-20"></div>
                                     
                                     {/* Center Label (Generated Image) */}
                                     <div className="w-[45%] h-[45%] rounded-full overflow-hidden border-4 border-black relative">
                                        <img src={generatedCover} alt="Label" className="w-full h-full object-cover animate-spin-slow" style={{ animationDuration: '8s' }} />
                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-full pointer-events-none"></div>
                                     </div>
                                </div>
                                
                                {/* Download Overlay for Vinyl */}
                                <div className="absolute bottom-[-60px] flex justify-center">
                                    <button 
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = generatedCover!;
                                            link.download = `cover-art-${Date.now()}.jpg`;
                                            link.click();
                                        }}
                                        className="bg-white text-black px-6 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform shadow-lg"
                                    >
                                        <DownloadIcon className="w-4 h-4" /> Resmi İndir
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CD MOCKUP */}
                        {mockupType === 'cd' && (
                             <div className="relative w-[80%] h-[80%] animate-in zoom-in duration-500 flex items-center justify-center">
                                {/* Case */}
                                <div className="absolute inset-0 bg-white/10 border border-white/20 rounded-md backdrop-blur-sm shadow-2xl z-20 flex items-center justify-center">
                                    <div className="w-[12px] h-full absolute left-2 border-r border-white/10 bg-white/5"></div>
                                </div>
                                {/* CD / Art */}
                                <div className="w-[90%] h-[90%] bg-black relative z-10 shadow-lg">
                                    <img src={generatedCover} alt="CD Cover" className="w-full h-full object-cover" />
                                </div>

                                <div className="absolute bottom-[-60px] flex justify-center">
                                    <button 
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = generatedCover!;
                                            link.download = `cover-art-${Date.now()}.jpg`;
                                            link.click();
                                        }}
                                        className="bg-white text-black px-6 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:scale-105 transition-transform shadow-lg"
                                    >
                                        <DownloadIcon className="w-4 h-4" /> Resmi İndir
                                    </button>
                                </div>
                             </div>
                        )}

                    </div>

                    {/* Magic Refine Toolbar */}
                    <div className="mt-8 w-full max-w-md">
                        {!showRefineInput ? (
                             <button 
                                onClick={() => setShowRefineInput(true)}
                                disabled={isRefining || !canInteract}
                                className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                            >
                                <SparklesIcon className="w-4 h-4" />
                                Sihirli Düzenle
                            </button>
                        ) : (
                            <div className="bg-darker border border-white/20 rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex gap-2 mb-2">
                                    <SparklesIcon className="w-4 h-4 text-purple-400 mt-0.5" />
                                    <p className="text-xs text-slate-300 font-medium">Görselin üzerinde ne değiştirelim?</p>
                                </div>
                                <input 
                                    type="text" 
                                    value={refinePrompt}
                                    onChange={(e) => setRefinePrompt(e.target.value)}
                                    placeholder="Örn: Arka planı mavi yap, logoyu kaldır..."
                                    className="w-full bg-surface border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-purple-500 mb-3"
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
                                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isRefining ? <LoaderIcon className="w-3 h-3 animate-spin" /> : 'Uygula'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 px-6 text-center w-full max-w-lg">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <p className="text-xs text-indigo-300 uppercase tracking-widest font-bold mb-2">AI Analizi</p>
                            <p className="text-sm text-slate-300 leading-relaxed">{generatedPrompt}</p>
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

// Simple Icon for Square View
const SquareIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    </svg>
);

export default CoverArtGenerator;
