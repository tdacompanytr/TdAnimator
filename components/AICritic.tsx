
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RobotIcon, UploadCloudIcon, LoaderIcon, StarIcon, ThumbsDownIcon, ThumbsUpIcon, ZapIcon, ImageIcon, XIcon, WandIcon, AlertCircleIcon, CheckSquareIcon, DownloadIcon, SettingsIcon } from './Icons';
import { analyzeImage, generateImage, getSettingsAdvice } from '../services/geminiService';
import { AICriticAnalysis, GeneratedImage, User, CriticPersona, AnalysisDepth } from '../types';

interface AICriticProps {
    user: User | null;
    isSettingsOpen?: boolean;
    onSettingsClose?: () => void;
    initialMessage?: string;
}

const AICritic: React.FC<AICriticProps> = ({ user, isSettingsOpen = false, onSettingsClose = () => {}, initialMessage }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [analysis, setAnalysis] = useState<AICriticAnalysis | null>(null);
  const [textAdvice, setTextAdvice] = useState<string | null>(null); // For text-only advice
  const [fixedImage, setFixedImage] = useState<GeneratedImage | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'fixed' | 'compare'>('compare');
  
  // AI Settings State
  const [persona, setPersona] = useState<CriticPersona>('balanced');
  const [depth, setDepth] = useState<AnalysisDepth>('detailed');

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const canInteract = user?.role === 'admin' || user?.role === 'editor';

  // Handle Initial Message (from Generator)
  useEffect(() => {
    if (initialMessage && canInteract) {
        handleTextConsultation(initialMessage);
    }
  }, [initialMessage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canInteract) return;
    const file = e.target.files?.[0];
    processFile(file);
  };

  const processFile = (file?: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImage(event.target.result as string);
          setAnalysis(null);
          setTextAdvice(null);
          setFixedImage(null);
          setError(null);
          setActiveTab('compare'); // Default to compare to show the 'Start' button on right
        }
      };
      reader.readAsDataURL(file);
    } else if (file) {
        setError("Lütfen geçerli bir resim dosyası yükleyin.");
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canInteract) return;
    setIsDragging(true);
  }, [canInteract]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!canInteract) {
        setError("İzleyici rolünde analiz başlatamazsınız.");
        return;
    }

    const file = e.dataTransfer.files?.[0];
    processFile(file);
  }, [canInteract]);

  const handleSend = async () => {
     if (!canInteract) {
         setError("İzleyici rolünde işlem yapamazsınız.");
         return;
     }

     // If no image, treat as text consultation
     if (!image) {
         if (!chatInput.trim()) {
             fileInputRef.current?.click();
             return;
         }
         await handleTextConsultation(chatInput);
         setChatInput('');
         return;
     }

     if (!analysis && !fixedImage) {
         await startAnalysis(chatInput);
         setChatInput('');
         return;
     }

     if (fixedImage) {
         if (!chatInput.trim()) return;
         await handleRefine(chatInput);
         setChatInput('');
         return;
     }
  };

  const handleTextConsultation = async (text: string) => {
      setIsAnalyzing(true);
      setError(null);
      setTextAdvice(null);
      setAnalysis(null);
      
      try {
          const advice = await getSettingsAdvice(text);
          setTextAdvice(advice);
      } catch (err: any) {
          setError(err.message || "Tavsiye alınamadı.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const startAnalysis = async (userInstruction?: string) => {
    if (!image) return;
    setIsAnalyzing(true);
    setError(null);
    setTextAdvice(null);
    setActiveTab('compare'); 
    try {
      // Pass configuration settings
      const config = { persona, depth };
      const result = await analyzeImage(image, userInstruction, config);
      setAnalysis(result);
      await handleAutoFix(result.improvedPrompt, image);
    } catch (err: any) {
      setError(err.message || "Analiz sırasında bir hata oluştu.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoFix = async (prompt: string, refImage: string) => {
    setIsFixing(true);
    try {
      const result = await generateImage(prompt, '1:1', 'image/png', refImage, undefined, 'gemini-flash');
      setFixedImage({
        base64: result.imageBytes,
        mimeType: result.mimeType,
        prompt: prompt,
        timestamp: Date.now(),
        aspectRatio: '1:1',
        resolution: 'hd',
        watermarkTextEffect: 'none',
        watermarkOpacity: 0,
        watermarkPosition: 'bottomRight',
        watermarkSize: 'medium'
      });
      setActiveTab('compare');
    } catch (err: any) {
      setError("Düzeltme sırasında hata: " + err.message);
    } finally {
      setIsFixing(false);
    }
  };

  const handleRefine = async (instruction: string) => {
    if (!fixedImage || !image) return;
    setIsFixing(true);
    try {
      const currentPrompt = fixedImage.prompt;
      const refinedPrompt = `${currentPrompt}. IMPORTANT UPDATE: ${instruction}.`;
      const result = await generateImage(refinedPrompt, '1:1', 'image/png', image, undefined, 'gemini-flash');
      setFixedImage({
        ...fixedImage,
        base64: result.imageBytes,
        prompt: refinedPrompt,
        timestamp: Date.now()
      });
    } catch (err: any) {
      setError("Güncelleme hatası: " + err.message);
    } finally {
      setIsFixing(false);
    }
  };

  const clearAll = () => {
      setImage(null);
      setAnalysis(null);
      setTextAdvice(null);
      setFixedImage(null);
      setChatInput('');
      setError(null);
      setActiveTab('original');
  };

  const getPersonaLabel = (p: CriticPersona) => {
      switch(p) {
          case 'strict': return 'Katı';
          case 'gentle': return 'Nazik';
          case 'roast': return 'Roast';
          default: return 'Dengeli';
      }
  };

  const getDepthLabel = (d: AnalysisDepth) => {
      switch(d) {
          case 'brief': return 'Özet';
          case 'technical': return 'Teknik';
          default: return 'Detaylı';
      }
  };

  return (
    <div 
        className="h-[calc(100vh-140px)] min-h-[600px] bg-darker rounded-3xl overflow-hidden relative flex flex-col lg:flex-row border border-white/5 shadow-2xl"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {/* Settings Modal for AI Critic */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onSettingsClose}></div>
          <div className="relative w-full max-w-md bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300">
             <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                     <SettingsIcon className="w-6 h-6 text-indigo-400" />
                     AI Analiz Ayarları
                 </h2>
                 <button onClick={onSettingsClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                     <XIcon className="w-5 h-5" />
                 </button>
             </div>
             
             <div className="space-y-6">
                 {/* Persona Setting */}
                 <div>
                     <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Eleştirmen Kişiliği</label>
                     <div className="grid grid-cols-2 gap-3">
                         {[
                             { id: 'strict', label: 'Katı & Mükemmeliyetçi', desc: 'Hatalara odaklanır.' },
                             { id: 'balanced', label: 'Dengeli (Varsayılan)', desc: 'Objektif yaklaşım.' },
                             { id: 'gentle', label: 'Nazik & Yapıcı', desc: 'Motivasyon odaklı.' },
                             { id: 'roast', label: 'Mizahi (Roast)', desc: 'İğneleyici eleştiri.' },
                         ].map((p) => (
                             <button
                                key={p.id}
                                onClick={() => setPersona(p.id as CriticPersona)}
                                className={`p-3 text-left rounded-xl border transition-all ${persona === p.id ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}
                             >
                                 <div className="font-bold text-xs mb-1">{p.label}</div>
                                 <div className="text-[10px] opacity-70 leading-tight">{p.desc}</div>
                             </button>
                         ))}
                     </div>
                 </div>

                 {/* Depth Setting */}
                 <div>
                     <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Analiz Derinliği</label>
                     <div className="grid grid-cols-3 gap-2">
                         {[
                             { id: 'brief', label: 'Özet', icon: <ZapIcon className="w-3 h-3" /> },
                             { id: 'detailed', label: 'Detaylı', icon: <CheckSquareIcon className="w-3 h-3" /> },
                             { id: 'technical', label: 'Teknik', icon: <SettingsIcon className="w-3 h-3" /> },
                         ].map((d) => (
                             <button
                                key={d.id}
                                onClick={() => setDepth(d.id as AnalysisDepth)}
                                className={`p-2 flex items-center justify-center gap-2 text-xs font-bold rounded-lg border transition-all ${depth === d.id ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}
                             >
                                 {d.icon}
                                 {d.label}
                             </button>
                         ))}
                     </div>
                 </div>
                 
                 <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-200">
                     <p><strong>Not:</strong> Bu ayarlar yapay zekanın görselinizi nasıl yorumlayacağını ve oluşturacağı düzeltme önerilerini değiştirir.</p>
                 </div>
             </div>

             <div className="mt-8">
                 <button onClick={onSettingsClose} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all">
                     Ayarları Kaydet
                 </button>
             </div>
          </div>
        </div>
      )}

      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[120px]"></div>
      </div>

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-darker/90 backdrop-blur-xl flex flex-col items-center justify-center border-4 border-dashed border-indigo-500/50 m-4 rounded-2xl animate-in fade-in duration-200">
            <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                <UploadCloudIcon className="w-12 h-12 text-indigo-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Dosyayı Bırakın</h2>
            <p className="text-indigo-300/70 text-lg">Yapay zeka analizi için hazır</p>
        </div>
      )}

      {/* LEFT PANEL: Sidebar / Intelligence Center */}
      <div className="w-full lg:w-80 bg-surface/30 border-r border-white/5 backdrop-blur-sm flex flex-col z-10 max-h-[40%] lg:max-h-full">
         <div className="p-6 border-b border-white/5 flex justify-between items-center">
             <div>
                 <h2 className="text-lg font-bold text-white flex items-center gap-2">
                     <RobotIcon className="w-5 h-5 text-indigo-400" />
                     {textAdvice ? "AI Asistanı" : "AI Analiz Raporu"}
                 </h2>
                 <p className="text-xs text-slate-500 mt-1">Gemini 2.5 Vision Engine</p>
             </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
             {(!image && !textAdvice) ? (
                 <div className="flex flex-col items-center justify-center h-full text-center opacity-40 space-y-4">
                     <WandIcon className="w-12 h-12 text-indigo-300" />
                     <p className="text-sm text-slate-300 px-4">Bir görsel yükleyin veya aşağıdaki sohbet alanından aklınızdaki fikri sorun.</p>
                 </div>
             ) : (isAnalyzing && !analysis && !textAdvice) ? (
                  <div className="flex flex-col items-center justify-center h-40 space-y-3 animate-pulse">
                      <LoaderIcon className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs text-indigo-300">Yapay zeka düşünüyor...</p>
                  </div>
             ) : textAdvice ? (
                 /* Text Advice View */
                 <div className="space-y-4 animate-in slide-in-from-left-4">
                     <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                         <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <ZapIcon className="w-4 h-4" /> Tavsiye
                         </h3>
                         <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {textAdvice}
                         </div>
                     </div>
                 </div>
             ) : !analysis ? (
                 <div className="flex flex-col items-center justify-center h-40 space-y-3 animate-pulse">
                     {/* Waiting state for image analysis */}
                     <div className="text-center space-y-3 w-full">
                         <div className="text-xs text-slate-400 bg-white/5 px-3 py-1 rounded-full inline-block mb-2">Bekleniyor</div>
                         <button 
                            onClick={() => startAnalysis()}
                            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all animate-pulse hover:animate-none"
                         >
                            Analizi Başlat
                         </button>
                     </div>
                 </div>
             ) : (
                 <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
                     {/* Score Card */}
                     <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-2xl p-5 text-center relative overflow-hidden group">
                         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                         <span className="text-xs text-indigo-200 uppercase tracking-widest font-bold mb-2 block">Estetik Puanı</span>
                         <div className="text-5xl font-black text-white drop-shadow-lg flex items-center justify-center gap-1">
                             {analysis.score}<span className="text-lg text-white/50 font-medium">/10</span>
                         </div>
                         <div className="flex justify-center mt-2 gap-1">
                             {[...Array(5)].map((_, i) => (
                                 <StarIcon key={i} className={`w-4 h-4 ${i < Math.round(analysis.score / 2) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`} />
                             ))}
                         </div>
                         <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-indigo-300/60 uppercase tracking-wide font-bold border-t border-white/5 pt-2">
                             <span>{getPersonaLabel(persona)}</span>
                             <span className="text-white/20">•</span>
                             <span>{getDepthLabel(depth)}</span>
                         </div>
                     </div>

                     {/* Critique Section */}
                     <div className="space-y-3">
                         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                             <ThumbsDownIcon className="w-4 h-4 text-red-400" /> Geliştirilmeli
                         </h3>
                         <ul className="space-y-2">
                             {analysis.critique.map((point, idx) => (
                                 <li key={idx} className="text-xs text-slate-300 bg-red-500/5 border border-red-500/10 p-2 rounded-lg border-l-2 border-l-red-500">
                                     {point}
                                 </li>
                             ))}
                         </ul>
                     </div>

                     {/* Good Points Section */}
                     <div className="space-y-3">
                         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                             <ThumbsUpIcon className="w-4 h-4 text-green-400" /> Güçlü Yanlar
                         </h3>
                         <ul className="space-y-2">
                             {analysis.goodPoints.map((point, idx) => (
                                 <li key={idx} className="text-xs text-slate-300 bg-green-500/5 border border-green-500/10 p-2 rounded-lg border-l-2 border-l-green-500">
                                     {point}
                                 </li>
                             ))}
                         </ul>
                     </div>
                 </div>
             )}
         </div>
      </div>

      {/* RIGHT PANEL: Visual Workspace */}
      <div className="flex-1 flex flex-col relative z-10 min-h-0">
         
         {/* Top Bar */}
         {image && (
             <div className="h-16 flex-none border-b border-white/5 flex items-center justify-between px-6 bg-surface/20 backdrop-blur-md">
                 <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
                     <button 
                        onClick={() => setActiveTab('original')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'original' ? 'bg-white/10 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                     >
                         Orijinal
                     </button>
                     <button 
                        onClick={() => setActiveTab('fixed')}
                        disabled={!fixedImage}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'fixed' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white disabled:opacity-50'}`}
                     >
                         AI Sonuç
                     </button>
                     <button 
                        onClick={() => setActiveTab('compare')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'compare' ? 'bg-white/10 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                     >
                         Karşılaştır
                     </button>
                 </div>
                 <div className="flex items-center gap-3">
                     {fixedImage && (
                         <button 
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = `data:${fixedImage.mimeType};base64,${fixedImage.base64}`;
                                link.download = `ai-fix-${Date.now()}.png`;
                                link.click();
                            }}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
                            title="Sonucu İndir"
                        >
                            <DownloadIcon className="w-5 h-5" />
                         </button>
                     )}
                     <button 
                        onClick={clearAll}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                        title="Çalışmayı Sil"
                     >
                        <XIcon className="w-5 h-5" />
                     </button>
                 </div>
             </div>
         )}

         {/* Canvas Area */}
         <div className="flex-1 bg-black/20 p-6 flex items-center justify-center overflow-hidden relative group">
             {/* Subtle Grid Pattern */}
             <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
             
             {!image ? (
                 <div className="text-center space-y-4 max-w-md">
                     {textAdvice ? (
                        <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <RobotIcon className="w-12 h-12 text-indigo-400" />
                        </div>
                     ) : (
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20 transition-all hover:scale-105 flex items-center gap-3 mx-auto"
                        >
                            <UploadCloudIcon className="w-6 h-6" />
                            Görsel Yükle
                        </button>
                     )}
                     <p className="text-xs text-slate-500">{textAdvice ? "Yapay zeka ayarlarınızı inceliyor..." : "veya aşağıdan sohbeti kullanın"}</p>
                 </div>
             ) : (
                 <div className="relative w-full h-full flex items-center justify-center">
                     
                     {/* Original Only View */}
                     {activeTab === 'original' && (
                         <div className="relative max-h-full border border-white/10 shadow-2xl rounded-lg overflow-hidden animate-in zoom-in duration-300">
                             <img src={image} alt="Original" className="max-h-[50vh] lg:max-h-[60vh] object-contain" />
                             <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded">Orijinal</div>
                         </div>
                     )}

                     {/* Fixed Only View */}
                     {activeTab === 'fixed' && fixedImage && (
                         <div className="relative max-h-full border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 rounded-lg overflow-hidden animate-in zoom-in duration-300">
                             <img src={`data:${fixedImage.mimeType};base64,${fixedImage.base64}`} alt="Fixed" className="max-h-[50vh] lg:max-h-[60vh] object-contain" />
                             <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                                 <ZapIcon className="w-3 h-3" /> AI Sonuç
                             </div>
                         </div>
                     )}

                     {/* Compare (Side by Side) View */}
                     {activeTab === 'compare' && (
                         <div className="flex flex-col md:flex-row gap-4 w-full h-full items-center justify-center px-4">
                            <div className="relative border border-white/10 shadow-xl rounded-lg overflow-hidden flex-1 max-h-[35vh] md:max-h-[60vh] flex justify-center">
                                <img src={image} alt="Original" className="h-full object-contain" />
                                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur text-slate-300 text-[10px] font-bold px-2 py-1 rounded">Öncesi</div>
                            </div>
                            
                            <div className="hidden md:flex items-center justify-center text-slate-500">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                    <span className="text-xs font-bold">VS</span>
                                </div>
                            </div>

                            <div className="relative border border-indigo-500/30 shadow-xl shadow-indigo-500/10 rounded-lg overflow-hidden flex-1 max-h-[35vh] md:max-h-[60vh] flex justify-center">
                                {fixedImage ? (
                                    <>
                                        <img src={`data:${fixedImage.mimeType};base64,${fixedImage.base64}`} alt="Fixed" className="h-full object-contain" />
                                        <div className="absolute bottom-2 right-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded">Sonrası</div>
                                    </>
                                ) : (
                                    <div className="w-full h-full bg-black/20 flex flex-col items-center justify-center min-h-[200px]">
                                        {isAnalyzing || isFixing ? (
                                            <div className="text-center">
                                                <LoaderIcon className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                                                <span className="text-xs text-indigo-300">{isAnalyzing ? 'Analiz ediliyor...' : 'İyileştiriliyor...'}</span>
                                            </div>
                                        ) : (
                                            <div className="text-center flex flex-col items-center gap-3 p-4">
                                                <div className="opacity-50">
                                                    <RobotIcon className="w-10 h-10 mx-auto mb-2 text-slate-500" />
                                                </div>
                                                <button 
                                                    onClick={() => startAnalysis()}
                                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105 flex items-center gap-2"
                                                >
                                                    <ZapIcon className="w-4 h-4" />
                                                    Yapay Zekayı Çalıştır
                                                </button>
                                                <span className="text-xs text-slate-500 max-w-[200px]">
                                                    Görseli analiz et ve otomatik olarak iyileştir.
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                         </div>
                     )}

                 </div>
             )}
         </div>

         {/* Static Command Bar (Moved from absolute to static flex item) */}
         <div className="flex-none p-4 w-full flex justify-center z-20 bg-surface/20 border-t border-white/5 backdrop-blur-md">
             <div className={`
                w-full max-w-2xl bg-darker/90 backdrop-blur-xl border border-white/20 rounded-2xl p-2 shadow-2xl flex items-center gap-2 transition-all duration-300
                ${isAnalyzing || isFixing ? 'opacity-50 pointer-events-none scale-95' : 'hover:border-indigo-500/50 hover:shadow-indigo-500/20 focus-within:border-indigo-500/50 focus-within:shadow-indigo-500/20'}
             `}>
                 <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden" 
                    accept="image/*"
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
                    title="Görsel Değiştir"
                >
                    <ImageIcon className="w-5 h-5" />
                </button>
                
                <div className="h-8 w-px bg-white/10 mx-1"></div>

                <input 
                    ref={chatInputRef}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={!canInteract}
                    placeholder={!image ? "Bir şey sor... (Örn: 'Cyberpunk için hangi renkler?')" : fixedImage ? "Sonucu beğenmedin mi? Örn: 'Daha parlak yap'" : "Sohbet ederek başlat... (Örn: 'Renkleri düzelt')"}
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder-slate-400 px-2"
                    autoComplete="off"
                />

                <button 
                    onClick={handleSend}
                    disabled={(!image && !chatInput.trim()) || !canInteract}
                    className={`
                        px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all
                        ${(image || chatInput.trim()) && canInteract
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'}
                    `}
                >
                    {fixedImage ? 'Düzenle' : (image ? 'Analiz Et' : 'Gönder')}
                    {fixedImage ? <WandIcon className="w-4 h-4" /> : <ZapIcon className="w-4 h-4" />}
                </button>
             </div>
         </div>
         
         {/* Error Toast */}
         {error && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm backdrop-blur-md animate-in slide-in-from-bottom-2 z-50">
                <AlertCircleIcon className="w-4 h-4" />
                {error}
            </div>
         )}

      </div>
    </div>
  );
};

export default AICritic;
