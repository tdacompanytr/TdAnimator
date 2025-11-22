
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateImage, suggestSmartCrop, enhancePrompt } from '../services/geminiService';
import { AspectRatio, ASPECT_RATIOS, GeneratedImage, WatermarkTextEffect, WATERMARK_EFFECTS, WatermarkPosition, WATERMARK_POSITIONS, WatermarkSize, WATERMARK_SIZES, Resolution, RESOLUTIONS, StylePreset, STYLE_PRESETS, LightingType, LIGHTING_TYPES, CameraAngle, CAMERA_ANGLES, ColorTone, COLOR_TONES, Composition, COMPOSITIONS, Mood, MOODS, AIModel, AI_MODELS } from '../types';
import { WandIcon, DownloadIcon, AlertCircleIcon, LoaderIcon, ImageIcon, HistoryIcon, TrashIcon, ShareIcon, StampIcon, EditIcon, SettingsIcon, XIcon, UploadCloudIcon, ArchiveIcon, CheckSquareIcon, SquareIcon, RefreshCwIcon, LayersIcon, BrushIcon, SparklesIcon, CropIcon, RotateCwIcon, FlipVerticalIcon, SlidersIcon, MaximizeIcon, CopyIcon, ZapIcon, ScanEyeIcon, CpuIcon, BrainIcon, RabbitIcon, LightbulbIcon } from './Icons';
import JSZip from 'jszip';

const MAX_HISTORY_ITEMS = 5; 

interface ImageGeneratorProps {
  isSettingsOpen?: boolean;
  onSettingsClose?: () => void;
}

// Advanced Editor Types
interface EditState {
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
  sepia: number;
  blur: number;
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  cropRatio: 'original' | '1:1' | '16:9' | '4:3' | '9:16';
  zoom: number; // For simple cropping simulation
}

const DEFAULT_EDIT_STATE: EditState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hueRotate: 0,
  sepia: 0,
  blur: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  cropRatio: 'original',
  zoom: 1,
};

// Helper component for collapsible sections
const CollapsibleSection = ({ 
  title, 
  icon, 
  isOpen, 
  onToggle, 
  children 
}: { 
  title: string; 
  icon: React.ReactNode; 
  isOpen: boolean; 
  onToggle: () => void; 
  children?: React.ReactNode;
}) => (
  <div className="border border-white/10 rounded-xl bg-surface/50 overflow-hidden transition-all duration-200">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-3 text-sm font-bold text-slate-200 uppercase tracking-wider">
        <div className="text-primary">{icon}</div>
        {title}
      </div>
      <div className={`text-slate-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </button>
    
    <div 
      className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}
    >
      <div className="p-4 pt-0 border-t border-white/5">
         <div className="pt-4 space-y-6">
            {children}
         </div>
      </div>
    </div>
  </div>
);

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ isSettingsOpen = false, onSettingsClose = () => {} }) => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [resolution, setResolution] = useState<Resolution>('hd');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  
  // Reference Image State
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Prompt Enhancement State
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [promptSuggestions, setPromptSuggestions] = useState<{label: string, text: string}[]>([]);
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false);
  
  // General Settings
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini-flash');
  const [outputFormat, setOutputFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [smartEnhance, setSmartEnhance] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [stylePreset, setStylePreset] = useState<StylePreset>('none');
  
  // Advanced Settings
  const [lighting, setLighting] = useState<LightingType>('none');
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>('none');
  const [colorTone, setColorTone] = useState<ColorTone>('none');
  const [composition, setComposition] = useState<Composition>('none');
  const [mood, setMood] = useState<Mood>('none');
  const [seed, setSeed] = useState<number | undefined>(undefined);

  // Watermark states
  const [showWatermark, setShowWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState('TdAnimator');
  const [watermarkTextEffect, setWatermarkTextEffect] = useState<WatermarkTextEffect>('none');
  const [watermarkOpacity, setWatermarkOpacity] = useState(70); // 0-100
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottomRight');
  const [watermarkSize, setWatermarkSize] = useState<WatermarkSize>('medium');

  // Settings UI State
  const [activeSections, setActiveSections] = useState({
    art: true,
    scene: false,
    tuning: false,
    watermark: false
  });

  // Batch Selection States
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showVariationInput, setShowVariationInput] = useState(false);
  const [batchVariationPrompt, setBatchVariationPrompt] = useState('');

  // --- Image Editor States ---
  const [isEditing, setIsEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<'generated' | 'reference' | 'batch'>('generated');
  const [editingImageSrc, setEditingImageSrc] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(DEFAULT_EDIT_STATE);
  const [activeEditTab, setActiveEditTab] = useState<'adjust' | 'transform'>('transform');
  const [isAnalyzingCrop, setIsAnalyzingCrop] = useState(false);
  const [aiCropMessage, setAiCropMessage] = useState<string | null>(null);
  
  // References
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Process image updates in editor
  useEffect(() => {
    if (isEditing && editingImageSrc && canvasRef.current) {
      updateCanvasPreview();
    }
  }, [isEditing, editingImageSrc, editState]);


  const toggleSection = (section: keyof typeof activeSections) => {
    setActiveSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const saveToHistory = (newImage: GeneratedImage) => {
    let itemsToSave = [newImage, ...history];

    while (itemsToSave.length > 0) {
      try {
        if (itemsToSave.length > MAX_HISTORY_ITEMS) {
          itemsToSave = itemsToSave.slice(0, MAX_HISTORY_ITEMS);
        }
        const serialized = JSON.stringify(itemsToSave);
        localStorage.setItem('imagen_studio_history', serialized);
        setHistory(itemsToSave);
        break; 
      } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          if (itemsToSave.length > 1) {
            itemsToSave.pop(); 
            continue; 
          } else {
            console.warn("Görsel çok büyük, LocalStorage kotası yetersiz.");
            setHistory([newImage, ...history].slice(0, MAX_HISTORY_ITEMS));
            break;
          }
        } else {
          console.error("Geçmiş kaydedilemedi:", e);
          setHistory([newImage, ...history].slice(0, MAX_HISTORY_ITEMS));
          break;
        }
      }
    }
  };

  const clearHistory = () => {
    if (confirm('Tüm geçmişi silmek istediğinize emin misiniz?')) {
      setHistory([]);
      localStorage.removeItem('imagen_studio_history');
      setIsSelectionMode(false);
    }
  };

  const handleRestore = (item: GeneratedImage) => {
    if (isSelectionMode) return;
    setGeneratedImage(item);
    setPrompt(item.prompt);
    setAspectRatio(item.aspectRatio as AspectRatio);
    setResolution(item.resolution || 'hd');
    setStylePreset(item.stylePreset || 'none');
    setWatermarkTextEffect(item.watermarkTextEffect || 'none');
    setWatermarkOpacity(item.watermarkOpacity || 70);
    setWatermarkPosition(item.watermarkPosition || 'bottomRight');
    setWatermarkSize(item.watermarkSize || 'medium');
    if (item.lighting) setLighting(item.lighting as LightingType);
    if (item.cameraAngle) setCameraAngle(item.cameraAngle as CameraAngle);
    if (item.colorTone) setColorTone(item.colorTone as ColorTone);
    if (item.composition) setComposition(item.composition as Composition);
    if (item.mood) setMood(item.mood as Mood);
    if (item.seed) setSeed(item.seed);
    // If previous model is not in current list (e.g. imagen-3), fallback to default
    if (item.model && (item.model === 'gemini-flash' || item.model === 'gemini-lite')) {
        setSelectedModel(item.model as AIModel);
    } else {
        setSelectedModel('gemini-flash');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUseAsReference = (item: GeneratedImage) => {
    const dataUrl = `data:${item.mimeType};base64,${item.base64}`;
    setReferenceImage(dataUrl);
    
    // Akıllı Prompt Mantığı:
    if (!prompt.trim()) {
        setPrompt(item.prompt);
    }
    
    // Referans resmin oranını korumak mantıklıdır
    setAspectRatio(item.aspectRatio as AspectRatio);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
        textAreaRef.current?.focus();
    }, 500);
  };

  const toggleSelection = (timestamp: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(timestamp)) {
      newSelected.delete(timestamp);
    } else {
      newSelected.add(timestamp);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map(item => item.timestamp)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`${selectedIds.size} adet görseli silmek istediğinize emin misiniz?`)) {
        const newHistory = history.filter(item => !selectedIds.has(item.timestamp));
        setHistory(newHistory);
        localStorage.setItem('imagen_studio_history', JSON.stringify(newHistory));
        setIsSelectionMode(false);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return;
    setIsLoading(true); 
    try {
      const zip = new JSZip();
      const folder = zip.folder("tdanimator-collection");
      
      let count = 0;
      selectedIds.forEach((id) => {
        const item = history.find(h => h.timestamp === id);
        if (item) {
           const ext = item.mimeType === 'image/png' ? 'png' : 'jpg';
           folder?.file(`tdanimator-${id}.${ext}`, item.base64, {base64: true});
           count++;
        }
      });

      if (count > 0) {
        const content = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tdanimator-gallery-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsSelectionMode(false);
      }
    } catch (e) {
      console.error("ZIP creation failed", e);
      setError("ZIP dosyası oluşturulurken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchEdit = () => {
    if (selectedIds.size === 0) return;
    
    // Find the first selected image to use as reference for the editor
    const firstSelectedId = Array.from(selectedIds)[0];
    const item = history.find(h => h.timestamp === firstSelectedId);
    
    if (item) {
      const src = `data:${item.mimeType};base64,${item.base64}`;
      setEditingImageSrc(src);
      setEditTarget('batch');
      setEditState(DEFAULT_EDIT_STATE);
      setActiveEditTab('transform');
      setIsEditing(true);
    }
  };

  const handleBatchVariations = async () => {
    if (selectedIds.size === 0) return;
    if (!batchVariationPrompt.trim()) {
      setError("Lütfen varyasyon için bir ek açıklama girin.");
      return;
    }
    
    setShowVariationInput(false);
    setIsLoading(true);
    setIsSelectionMode(false);

    try {
      const selectedItems = history.filter(h => selectedIds.has(h.timestamp));
      
      // Process sequentially to avoid rate limits and overwhelming the browser
      for (const item of selectedItems) {
        const newPrompt = `${item.prompt} ${batchVariationPrompt.trim()}`;
        
        // Using the original parameters but with modified prompt
        // Fallback model to selectedModel if item.model is invalid (e.g. deleted models)
        let modelToUse = selectedModel;
        if (item.model && (item.model === 'gemini-flash' || item.model === 'gemini-lite')) {
            modelToUse = item.model as AIModel;
        }

        await handleGenerate({
           prompt: newPrompt,
           aspectRatio: item.aspectRatio as AspectRatio,
           resolution: item.resolution,
           stylePreset: item.stylePreset,
           lighting: item.lighting as LightingType,
           cameraAngle: item.cameraAngle as CameraAngle,
           colorTone: item.colorTone as ColorTone,
           composition: item.composition as Composition,
           mood: item.mood as Mood,
           model: modelToUse
        });
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setBatchVariationPrompt('');
      
    } catch (err: any) {
      setError(err.message || "Toplu varyasyon oluşturulurken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  // Prompt Enhancement Handler
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setIsEnhancingPrompt(true);
    setShowPromptSuggestions(false);
    try {
      const suggestions = await enhancePrompt(prompt);
      setPromptSuggestions(suggestions);
      setShowPromptSuggestions(true);
    } catch (e) {
      console.error("Prompt enhancement failed", e);
      // Fallback or silent fail, maybe show error toast
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            setError("Lütfen sadece resim dosyası yükleyin.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError("Görsel boyutu 5MB'dan küçük olmalıdır.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setReferenceImage(event.target.result as string);
                setError(null);
            }
        };
        reader.readAsDataURL(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Görsel boyutu 5MB'dan küçük olmalıdır.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setReferenceImage(event.target.result as string);
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = useCallback(async (overrideConfig?: Partial<GeneratedImage>) => {
    const effectivePrompt = overrideConfig?.prompt ?? prompt;
    const effectiveAspectRatio = (overrideConfig?.aspectRatio as AspectRatio) ?? aspectRatio;
    const effectiveResolution = (overrideConfig?.resolution as Resolution) ?? resolution;
    const effectiveStyle = (overrideConfig?.stylePreset as StylePreset) ?? stylePreset;
    
    const effectiveLighting = overrideConfig?.lighting ?? lighting;
    const effectiveCamera = overrideConfig?.cameraAngle ?? cameraAngle;
    const effectiveColor = overrideConfig?.colorTone ?? colorTone;
    const effectiveComposition = overrideConfig?.composition ?? composition;
    const effectiveMood = overrideConfig?.mood ?? mood;
    const effectiveSeed = overrideConfig?.seed ?? seed;
    const effectiveModel = (overrideConfig?.model as AIModel) ?? selectedModel;

    if (!effectivePrompt.trim()) {
      setError("Lütfen oluşturmak istediğiniz görsel için bir açıklama girin.");
      return;
    }

    if (overrideConfig) {
       setPrompt(effectivePrompt);
       setAspectRatio(effectiveAspectRatio);
       setResolution(effectiveResolution);
       setStylePreset(effectiveStyle);
       setLighting(effectiveLighting as LightingType);
       setCameraAngle(effectiveCamera as CameraAngle);
       setColorTone(effectiveColor as ColorTone);
       setComposition(effectiveComposition as Composition);
       setMood(effectiveMood as Mood);
       setSeed(effectiveSeed);
       if (overrideConfig.model) setSelectedModel(overrideConfig.model as AIModel);
    }

    setIsLoading(true);
    setError(null);
    setShowPromptSuggestions(false);
    
    try {
      let finalPrompt = effectivePrompt.trim();
      
      const selectedStylePreset = STYLE_PRESETS.find(s => s.value === effectiveStyle);
      if (selectedStylePreset && selectedStylePreset.promptModifier) {
        if (referenceImage) {
            finalPrompt += `. Redraw this image in ${selectedStylePreset.label} style. ${selectedStylePreset.promptModifier}`;
        } else {
            finalPrompt += selectedStylePreset.promptModifier;
        }
      } else if (referenceImage) {
         finalPrompt += ". Use the reference image as inspiration.";
      }

      const selectedLighting = LIGHTING_TYPES.find(l => l.value === effectiveLighting);
      if (selectedLighting && selectedLighting.promptModifier) {
        finalPrompt += selectedLighting.promptModifier;
      }

      const selectedCamera = CAMERA_ANGLES.find(c => c.value === effectiveCamera);
      if (selectedCamera && selectedCamera.promptModifier) {
        finalPrompt += selectedCamera.promptModifier;
      }

      const selectedColor = COLOR_TONES.find(c => c.value === effectiveColor);
      if (selectedColor && selectedColor.promptModifier) {
        finalPrompt += selectedColor.promptModifier;
      }

      const selectedComposition = COMPOSITIONS.find(c => c.value === effectiveComposition);
      if (selectedComposition && selectedComposition.promptModifier) {
        finalPrompt += selectedComposition.promptModifier;
      }

      const selectedMood = MOODS.find(c => c.value === effectiveMood);
      if (selectedMood && selectedMood.promptModifier) {
        finalPrompt += selectedMood.promptModifier;
      }

      if (!referenceImage) {
          const selectedRes = RESOLUTIONS.find(r => r.value === effectiveResolution);
          if (selectedRes?.promptSuffix) {
            finalPrompt += selectedRes.promptSuffix;
          }
      }

      if (smartEnhance && !referenceImage) {
        finalPrompt += ", masterpiece, professional photography, cinematic lighting, sharp focus";
      }

      if (negativePrompt.trim()) {
         finalPrompt += ` --no ${negativePrompt.trim()}`; 
         finalPrompt += `. Exclude the following: ${negativePrompt.trim()}.`;
      }

      const result = await generateImage(
          finalPrompt, 
          effectiveAspectRatio, 
          outputFormat,
          referenceImage || undefined,
          effectiveSeed,
          effectiveModel
      );
      
      const newImage: GeneratedImage = {
        base64: result.imageBytes,
        mimeType: result.mimeType,
        prompt: effectivePrompt.trim(),
        timestamp: Date.now(),
        aspectRatio: effectiveAspectRatio,
        resolution: effectiveResolution,
        stylePreset: effectiveStyle,
        watermarkTextEffect: watermarkTextEffect,
        watermarkOpacity: watermarkOpacity,
        watermarkPosition: watermarkPosition,
        watermarkSize: watermarkSize,
        lighting: effectiveLighting,
        cameraAngle: effectiveCamera,
        colorTone: effectiveColor,
        composition: effectiveComposition,
        mood: effectiveMood,
        seed: effectiveSeed,
        model: effectiveModel
      };

      setGeneratedImage(newImage);
      saveToHistory(newImage);

    } catch (err: any) {
      setError(err.message || "Görüntü oluşturulurken beklenmeyen bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, aspectRatio, resolution, stylePreset, negativePrompt, history, watermarkTextEffect, watermarkOpacity, watermarkPosition, watermarkSize, outputFormat, smartEnhance, referenceImage, lighting, cameraAngle, colorTone, composition, mood, seed, selectedModel]);

  const handleRegenerate = useCallback((item: GeneratedImage) => {
    handleGenerate(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [handleGenerate]);

  // ------------------------------------------------------------------
  // EDITOR FUNCTIONS
  // ------------------------------------------------------------------

  const openEditor = (source: 'generated' | 'reference', imageItem?: GeneratedImage) => {
    let src = '';
    if (source === 'generated' && imageItem) {
        src = `data:${imageItem.mimeType};base64,${imageItem.base64}`;
    } else if (source === 'reference' && referenceImage) {
        src = referenceImage;
    } else {
        return;
    }

    setEditingImageSrc(src);
    setEditTarget(source);
    setEditState(DEFAULT_EDIT_STATE);
    setActiveEditTab('transform');
    setIsEditing(true);
    setAiCropMessage(null);
  };

  const handleAiSmartCrop = async () => {
    if (!editingImageSrc) return;
    setIsAnalyzingCrop(true);
    setAiCropMessage(null);
    try {
      const result = await suggestSmartCrop(editingImageSrc);
      if (result.ratio && result.ratio !== 'original') {
        setEditState(prev => ({ ...prev, cropRatio: result.ratio as any }));
        setAiCropMessage(`Öneri: ${result.ratio} - ${result.reason}`);
      } else {
        setAiCropMessage("Yapay zeka mevcut oranın en iyisi olduğunu düşünüyor.");
      }
    } catch (error) {
      setAiCropMessage("Analiz sırasında bir hata oluştu.");
    } finally {
      setIsAnalyzingCrop(false);
    }
  };

  const updateCanvasPreview = () => {
    if (!canvasRef.current || !editingImageSrc) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
        // 1. Calculate Dimensions based on Rotation
        const isRotated90 = editState.rotation % 180 !== 0;
        const canvasWidth = isRotated90 ? img.height : img.width;
        const canvasHeight = isRotated90 ? img.width : img.height;
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // 2. Apply Filters
        ctx.filter = `brightness(${editState.brightness}%) contrast(${editState.contrast}%) saturate(${editState.saturation}%) hue-rotate(${editState.hueRotate}deg) sepia(${editState.sepia}%) blur(${editState.blur}px)`;

        // 3. Transformations (Rotate & Flip)
        ctx.save();
        
        // Move to center
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        
        // Rotate
        ctx.rotate((editState.rotation * Math.PI) / 180);
        
        // Flip (Scale)
        const scaleX = editState.flipH ? -1 : 1;
        const scaleY = editState.flipV ? -1 : 1;
        ctx.scale(scaleX, scaleY);

        // Draw Image (centered around origin)
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        
        ctx.restore();
    };
    img.src = editingImageSrc;
  };

  const processImageWithEdits = (base64: string, mimeType: string): Promise<string> => {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.src = `data:${mimeType};base64,${base64}`;
          img.onload = () => {
              const tempCanvas = document.createElement('canvas');
              const ctx = tempCanvas.getContext('2d');
              if(!ctx) {
                  reject("Canvas context failure");
                  return;
              }

              const isRotated90 = editState.rotation % 180 !== 0;
              const canvasWidth = isRotated90 ? img.height : img.width;
              const canvasHeight = isRotated90 ? img.width : img.height;
              
              tempCanvas.width = canvasWidth;
              tempCanvas.height = canvasHeight;

              ctx.filter = `brightness(${editState.brightness}%) contrast(${editState.contrast}%) saturate(${editState.saturation}%) hue-rotate(${editState.hueRotate}deg) sepia(${editState.sepia}%) blur(${editState.blur}px)`;

              ctx.save();
              ctx.translate(canvasWidth / 2, canvasHeight / 2);
              ctx.rotate((editState.rotation * Math.PI) / 180);
              const scaleX = editState.flipH ? -1 : 1;
              const scaleY = editState.flipV ? -1 : 1;
              ctx.scale(scaleX, scaleY);
              ctx.drawImage(img, -img.width / 2, -img.height / 2);
              ctx.restore();

              // Apply simple crop logic (center zoom)
              if (editState.zoom > 1 || editState.cropRatio !== 'original') {
                  const finalCanvas = document.createElement('canvas');
                  const finalCtx = finalCanvas.getContext('2d');
                  if (!finalCtx) {
                     resolve(tempCanvas.toDataURL(outputFormat));
                     return;
                  }

                  let finalWidth = tempCanvas.width;
                  let finalHeight = tempCanvas.height;
                  let sx = 0;
                  let sy = 0;

                  if (editState.cropRatio !== 'original') {
                    const [rw, rh] = editState.cropRatio.split(':').map(Number);
                    const targetRatio = rw / rh;
                    const sourceRatio = tempCanvas.width / tempCanvas.height;

                    if (sourceRatio > targetRatio) {
                        finalHeight = tempCanvas.height;
                        finalWidth = finalHeight * targetRatio;
                        sx = (tempCanvas.width - finalWidth) / 2;
                    } else {
                        finalWidth = tempCanvas.width;
                        finalHeight = finalWidth / targetRatio;
                        sy = (tempCanvas.height - finalHeight) / 2;
                    }
                  }

                  if (editState.zoom > 1) {
                    const zoomedWidth = finalWidth / editState.zoom;
                    const zoomedHeight = finalHeight / editState.zoom;
                    sx += (finalWidth - zoomedWidth) / 2;
                    sy += (finalHeight - zoomedHeight) / 2;
                    finalWidth = zoomedWidth;
                    finalHeight = zoomedHeight;
                  }

                  finalCanvas.width = finalWidth;
                  finalCanvas.height = finalHeight;
                  finalCtx.drawImage(tempCanvas, sx, sy, finalWidth, finalHeight, 0, 0, finalWidth, finalHeight);
                  resolve(finalCanvas.toDataURL(outputFormat));
              } else {
                  resolve(tempCanvas.toDataURL(outputFormat));
              }
          };
          img.onerror = reject;
      });
  };

  const handleSaveEditor = async () => {
    if (!canvasRef.current || !editingImageSrc) return;
    
    if (editTarget === 'batch') {
        setIsEditing(false);
        setIsLoading(true);
        setIsSelectionMode(false);
        
        try {
            const itemsToProcess = history.filter(h => selectedIds.has(h.timestamp));
            const processedItems: GeneratedImage[] = [];

            for (const item of itemsToProcess) {
                try {
                    const resultDataUrl = await processImageWithEdits(item.base64, item.mimeType);
                    const base64Data = resultDataUrl.split(',')[1];
                    
                    processedItems.push({
                        ...item,
                        timestamp: Date.now() + Math.random(), // Unique ID
                        base64: base64Data,
                        mimeType: outputFormat === 'image/png' ? 'image/png' : 'image/jpeg',
                        prompt: item.prompt + " (Edited)"
                    });
                } catch (e) {
                    console.error("Batch edit failed for item", item.timestamp, e);
                }
            }

            // Save all new items
            const mergedHistory = [...processedItems, ...history].slice(0, MAX_HISTORY_ITEMS);
            setHistory(mergedHistory);
            localStorage.setItem('imagen_studio_history', JSON.stringify(mergedHistory));
            
            // Show first processed image
            if (processedItems.length > 0) {
                setGeneratedImage(processedItems[0]);
            }

        } catch (e) {
            setError("Toplu düzenleme sırasında hata oluştu.");
        } finally {
            setIsLoading(false);
        }
        return;
    }

    const sourceCanvas = canvasRef.current;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Determine Crop Dimensions
    let finalWidth = sourceCanvas.width;
    let finalHeight = sourceCanvas.height;
    let sx = 0;
    let sy = 0;

    // Handle Aspect Ratio Crop
    if (editState.cropRatio !== 'original') {
        const [rw, rh] = editState.cropRatio.split(':').map(Number);
        const targetRatio = rw / rh;
        const sourceRatio = sourceCanvas.width / sourceCanvas.height;

        if (sourceRatio > targetRatio) {
            // Source is wider than target -> Crop width
            finalHeight = sourceCanvas.height;
            finalWidth = finalHeight * targetRatio;
            sx = (sourceCanvas.width - finalWidth) / 2;
        } else {
            // Source is taller than target -> Crop height
            finalWidth = sourceCanvas.width;
            finalHeight = finalWidth / targetRatio;
            sy = (sourceCanvas.height - finalHeight) / 2;
        }
    }

    // Apply Zoom (Center Crop)
    if (editState.zoom > 1) {
        const zoomedWidth = finalWidth / editState.zoom;
        const zoomedHeight = finalHeight / editState.zoom;
        sx += (finalWidth - zoomedWidth) / 2;
        sy += (finalHeight - zoomedHeight) / 2;
        finalWidth = zoomedWidth;
        finalHeight = zoomedHeight;
    }

    // Set final canvas size
    tempCanvas.width = finalWidth;
    tempCanvas.height = finalHeight;

    // Draw the cropped region from the processed preview canvas
    tempCtx.drawImage(
        sourceCanvas,
        sx, sy, finalWidth, finalHeight, // Source Crop
        0, 0, finalWidth, finalHeight    // Dest
    );

    const finalDataUrl = tempCanvas.toDataURL(outputFormat);

    if (editTarget === 'reference') {
        setReferenceImage(finalDataUrl);
        setIsEditing(false);
    } else {
        // For generated image, download directly
        const ext = outputFormat === 'image/png' ? 'png' : 'jpg';
        const link = document.createElement('a');
        link.href = finalDataUrl;
        link.download = `tdanimator-edited-${Date.now()}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsEditing(false);
    }
  };

  // ------------------------------------------------------------------
  // UTILS
  // ------------------------------------------------------------------

  const handleDownload = useCallback(async (imageToDownload: GeneratedImage = generatedImage!) => {
    if (!imageToDownload) return;
    const link = document.createElement('a');
    link.href = `data:${imageToDownload.mimeType};base64,${imageToDownload.base64}`;
    link.download = `tdanimator-${imageToDownload.timestamp}.${imageToDownload.mimeType === 'image/png' ? 'png' : 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImage]);

  const handleShare = useCallback(async (imageToShare: GeneratedImage = generatedImage!) => {
    if (!imageToShare) return;
    try {
      const res = await fetch(`data:${imageToShare.mimeType};base64,${imageToShare.base64}`);
      const blob = await res.blob();
      const ext = imageToShare.mimeType === 'image/png' ? 'png' : 'jpg';
      const file = new File([blob], `tdanimator-${imageToShare.timestamp}.${ext}`, { type: imageToShare.mimeType });
      if (navigator.share) {
        await navigator.share({
          title: 'TdAnimator',
          text: imageToShare.prompt,
          files: [file],
        });
      }
    } catch (error) {
      console.error('Paylaşım hatası:', error);
    }
  }, [generatedImage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
        handleGenerate();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Controls */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl relative">
          
          <div className="space-y-4">
            
            {/* AI Model Selection */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Oluşturucu Modeli
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {AI_MODELS.map((model) => (
                        <button
                            key={model.value}
                            onClick={() => setSelectedModel(model.value)}
                            disabled={isLoading}
                            className={`
                                relative p-3 rounded-xl border text-left transition-all overflow-hidden group
                                ${selectedModel === model.value 
                                    ? 'bg-primary/10 border-primary' 
                                    : 'bg-darker border-white/10 hover:bg-white/5'}
                            `}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                {model.icon === 'cpu' && <CpuIcon className={`w-4 h-4 ${selectedModel === model.value ? 'text-primary' : 'text-slate-400'}`} />}
                                {model.icon === 'zap' && <ZapIcon className={`w-4 h-4 ${selectedModel === model.value ? 'text-yellow-400' : 'text-slate-400'}`} />}
                                {model.icon === 'brain' && <BrainIcon className={`w-4 h-4 ${selectedModel === model.value ? 'text-purple-400' : 'text-slate-400'}`} />}
                                {model.icon === 'rabbit' && <RabbitIcon className={`w-4 h-4 ${selectedModel === model.value ? 'text-green-400' : 'text-slate-400'}`} />}
                                
                                <span className={`text-xs font-bold ${selectedModel === model.value ? 'text-white' : 'text-slate-300'}`}>
                                    {model.label}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight">
                                {model.description}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            <hr className="border-white/5" />

            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-slate-300 mb-2 pr-10">
                Görsel Açıklaması & Referans
              </label>
              {/* Drag and Drop Container */}
              <div 
                className={`relative transition-all rounded-xl border-2 ${isDragging ? 'border-primary bg-primary/5 border-dashed' : 'border-transparent'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <textarea
                  ref={textAreaRef}
                  id="prompt"
                  className="w-full bg-darker border border-white/10 rounded-xl p-4 pb-12 text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all min-h-[140px]"
                  placeholder="Görselinizi detaylı bir şekilde tanımlayın... (örn., 'Kızıl saçlı anime karakteri')"
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    if (error) setError(null);
                    // If typing, hide suggestions
                    if (showPromptSuggestions) setShowPromptSuggestions(false);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                />

                {/* Prompt Enhancement Button */}
                {prompt.trim().length > 3 && !isLoading && (
                   <button
                     onClick={handleEnhancePrompt}
                     disabled={isEnhancingPrompt}
                     className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 text-xs font-bold transition-all"
                     title="AI ile prompt'u geliştir"
                   >
                      {isEnhancingPrompt ? <LoaderIcon className="w-3 h-3 animate-spin" /> : <LightbulbIcon className="w-3 h-3" />}
                      {isEnhancingPrompt ? 'Geliştiriliyor...' : 'AI İle Geliştir'}
                   </button>
                )}
                
                {/* Reference Image Preview & Upload Button Area */}
                <div className="absolute bottom-3 left-3 flex items-center justify-between z-10 pointer-events-none">
                   {/* Upload Button - Pointer events enabled for button */}
                   <div className="flex items-center gap-2 pointer-events-auto">
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden"
                        id="image-upload"
                      />
                      <label 
                        htmlFor="image-upload" 
                        className="cursor-pointer flex items-center gap-2 text-slate-400 hover:text-primary transition-colors p-2 rounded-lg hover:bg-white/5"
                        title="Referans Resim Ekle veya Sürükleyip Bırakın"
                      >
                        <UploadCloudIcon className="w-5 h-5" />
                        <span className="text-xs font-medium hidden sm:inline">Resim Yükle</span>
                      </label>
                   </div>
                </div>

                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-darker/80 backdrop-blur-sm rounded-xl border-2 border-primary border-dashed pointer-events-none">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
                                <UploadCloudIcon className="w-8 h-8 text-primary" />
                            </div>
                            <p className="text-white font-bold text-lg">Görseli Buraya Bırakın</p>
                            <p className="text-slate-300 text-sm">Referans resim olarak ayarlanacak</p>
                        </div>
                    </div>
                )}

                {/* Suggestions Overlay Popover */}
                {showPromptSuggestions && promptSuggestions.length > 0 && (
                  <div className="absolute z-30 bottom-full left-0 right-0 mb-2 bg-surface border border-white/10 rounded-xl shadow-2xl p-3 animate-in slide-in-from-bottom-2">
                     <div className="flex justify-between items-center mb-2 px-1">
                        <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1">
                           <SparklesIcon className="w-3 h-3" />
                           AI Önerileri
                        </h4>
                        <button onClick={() => setShowPromptSuggestions(false)} className="text-slate-400 hover:text-white">
                           <XIcon className="w-3 h-3" />
                        </button>
                     </div>
                     <div className="space-y-2">
                        {promptSuggestions.map((sug, idx) => (
                           <button
                              key={idx}
                              onClick={() => {
                                 setPrompt(sug.text);
                                 setShowPromptSuggestions(false);
                              }}
                              className="w-full text-left p-2 rounded-lg bg-darker hover:bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all group"
                           >
                              <div className="flex justify-between items-center mb-1">
                                 <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">{sug.label}</span>
                                 <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">Uygula</span>
                              </div>
                              <p className="text-xs text-slate-300 group-hover:text-white transition-colors">{sug.text}</p>
                           </button>
                        ))}
                     </div>
                  </div>
                )}

              </div>

              {/* Reference Image Preview Box */}
              {referenceImage && (
                <div className="mt-3 flex flex-col gap-2 animate-in slide-in-from-top-2">
                  <div className="p-3 bg-darker border border-white/10 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/20 shrink-0">
                              <img 
                                src={referenceImage} 
                                alt="Referans" 
                                className="w-full h-full object-cover"
                              />
                          </div>
                          <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-white truncate">Referans Görsel</span>
                              <span className="text-[10px] text-slate-400 truncate">Stil için kullanılacak</span>
                          </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                            onClick={() => openEditor('reference')}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Görseli Düzenle (Kırp/Döndür)"
                        >
                            <EditIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={removeReferenceImage}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Referans görseli kaldır"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                  </div>
                  
                  {/* Reference Image Tips */}
                  <div className="mt-1 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-200 space-y-2">
                     <h5 className="font-bold flex items-center gap-1.5">
                        <LightbulbIcon className="w-3.5 h-3.5" />
                        Referans Görsel İpuçları
                     </h5>
                     <ul className="list-disc pl-4 space-y-1 opacity-80">
                         <li>Yapay zeka bu görselin <strong>kompozisyonunu</strong> ve <strong>renk paletini</strong> temel alır.</li>
                         <li>Prompt alanına yazdıklarınız, bu görselin üzerine <strong>değişiklik</strong> olarak uygulanır.</li>
                         <li>En iyi sonuç için stil ön ayarlarından birini seçerek dönüşümü yönlendirin.</li>
                     </ul>
                  </div>
                </div>
              )}

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

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Çözünürlük / Kalite
              </label>
              <div className="grid grid-cols-4 gap-2">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.value}
                    onClick={() => setResolution(res.value)}
                    disabled={isLoading || !!referenceImage}
                    className={`
                      p-2 text-center rounded-lg border transition-all text-xs font-medium
                      ${(!!referenceImage) ? 'opacity-50 cursor-not-allowed border-transparent' : ''}
                      ${resolution === res.value 
                        ? 'bg-primary/20 border-primary text-white' 
                        : 'bg-darker border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5'}
                    `}
                  >
                    {res.label}
                  </button>
                ))}
              </div>
               {(referenceImage) && (
                  <p className="text-[10px] text-orange-400 mt-1">
                    * Referans resim modunda çözünürlük otomatik ayarlanır.
                  </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Çıktı Formatı
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOutputFormat('image/jpeg')}
                  className={`
                    p-2 text-center rounded-lg border transition-all text-xs font-medium
                    ${outputFormat === 'image/jpeg' 
                      ? 'bg-primary/20 border-primary text-white' 
                      : 'bg-darker border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5'}
                  `}
                >
                  JPG
                </button>
                <button
                  onClick={() => setOutputFormat('image/png')}
                  className={`
                    p-2 text-center rounded-lg border transition-all text-xs font-medium
                    ${outputFormat === 'image/png' 
                      ? 'bg-primary/20 border-primary text-white' 
                      : 'bg-darker border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5'}
                  `}
                >
                  PNG
                </button>
              </div>
            </div>

            <button
              onClick={() => handleGenerate()}
              disabled={isLoading || !prompt.trim()}
              className={`
                w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold text-lg transition-all shadow-lg mt-4
                ${isLoading || !prompt.trim()
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-primaryHover text-white hover:shadow-primary/25 shadow-primary/10'}
              `}
            >
              {isLoading ? (
                <>
                  <LoaderIcon className="animate-spin w-5 h-5" />
                  {referenceImage ? 'Dönüştürülüyor...' : 'Oluşturuluyor...'}
                </>
              ) : (
                <>
                  <WandIcon className="w-5 h-5" />
                  {referenceImage ? 'Görseli Dönüştür' : 'Görüntü Oluştur'}
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
                <li><strong>Referans Resim:</strong> Kendi çiziminizi veya bir fotoğrafı yükleyerek stilini değiştirebilirsiniz.</li>
                <li>Aydınlatmayı belirtin (örn. "sinematik ışık", "gün batımı").</li>
                <li>Sanat tarzını belirtin (örn. "yağlı boya", "3D render", "fotogerçekçi").</li>
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
                    <div className="text-center space-y-6 animate-pulse relative w-full h-full flex flex-col items-center justify-center">
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
                        {/* Progress Bar */}
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent bg-[length:200%_100%] animate-progress-bar-loading"
                        ></div>
                    </div>
                ) : generatedImage ? (
                    <div className="relative group w-full h-full flex items-center justify-center">
                        <div className="relative max-w-full max-h-[70vh]">
                          <img 
                              src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`} 
                              alt={generatedImage.prompt}
                              className="w-full h-full object-contain rounded-lg shadow-2xl"
                          />
                        </div>
                        
                        <div className="absolute inset-0 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-6 bg-gradient-to-t from-black/80 via-transparent to-transparent rounded-lg">
                            <div className="flex flex-wrap justify-center gap-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                              <button 
                                  onClick={() => handleUseAsReference(generatedImage)}
                                  className="flex items-center gap-2 bg-primary hover:bg-primaryHover border border-white/10 text-white font-bold py-3 px-6 rounded-full transition-colors shadow-lg"
                                  title="Bu görseli referans alarak yeni varyasyonlar oluştur"
                              >
                                  <LayersIcon className="w-5 h-5" />
                                  Referans Al
                              </button>
                              <button 
                                  onClick={() => openEditor('generated', generatedImage)}
                                  className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold py-3 px-6 rounded-full hover:bg-white/20 transition-colors shadow-lg"
                              >
                                  <EditIcon className="w-5 h-5" />
                                  Düzenle
                              </button>
                              <button 
                                  onClick={() => handleShare(generatedImage)}
                                  className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold py-3 px-6 rounded-full hover:bg-white/20 transition-colors shadow-lg"
                              >
                                  <ShareIcon className="w-5 h-5" />
                                  Paylaş
                              </button>
                              <button 
                                  onClick={() => handleDownload(generatedImage)}
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
                            Sol panele bir açıklama girin veya bir referans resim yükleyerek görselinizi oluşturun.
                        </p>
                    </div>
                )}
            </div>
        </div>

        {/* History Section */}
        {history.length > 0 && (
          <div className="bg-surface border border-white/10 rounded-2xl p-6 relative">
            <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
              <div className="flex items-center gap-2 text-slate-200">
                <HistoryIcon className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Geçmiş Çalışmalar</h3>
              </div>
              
              <div className="flex items-center gap-2">
                {isSelectionMode ? (
                  <>
                     {selectedIds.size > 0 && (
                        <>
                             <button 
                                onClick={handleBatchEdit}
                                className="text-xs text-white bg-blue-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                                title="Seçilenleri Toplu Düzenle"
                            >
                                <CopyIcon className="w-3.5 h-3.5" />
                                Toplu Düzenle
                            </button>
                             <button 
                                onClick={() => setShowVariationInput(true)}
                                className="text-xs text-white bg-purple-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/20"
                                title="Seçilenlerden Varyasyon Üret"
                            >
                                <ZapIcon className="w-3.5 h-3.5" />
                                Toplu Varyasyon
                            </button>
                             <button 
                                onClick={handleBatchDelete}
                                className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                            >
                                <TrashIcon className="w-3.5 h-3.5" />
                                Sil ({selectedIds.size})
                            </button>
                            <button 
                                onClick={handleBatchDownload}
                                className="text-xs text-white bg-primary flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-primaryHover transition-colors shadow-lg shadow-primary/20"
                            >
                                <ArchiveIcon className="w-3.5 h-3.5" />
                                ZIP İndir ({selectedIds.size})
                            </button>
                        </>
                    )}
                    <div className="h-6 w-px bg-white/10 mx-1"></div>
                    <button 
                      onClick={handleSelectAll}
                      className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      {selectedIds.size === history.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                    </button>
                     <button 
                      onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedIds(new Set());
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      İptal
                    </button>
                  </>
                ) : (
                  <>
                     <button 
                        onClick={() => setIsSelectionMode(true)}
                        className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <CheckSquareIcon className="w-3.5 h-3.5" />
                        Seç / Toplu İşlem
                      </button>
                      <button 
                        onClick={clearHistory}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        Temizle
                      </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Batch Variation Input Modal */}
            {showVariationInput && (
                <div className="absolute top-20 left-0 right-0 z-50 mx-6 p-4 bg-darker/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl animate-in slide-in-from-top-5">
                    <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        <ZapIcon className="w-4 h-4 text-purple-500" />
                        Toplu Varyasyon Oluştur
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">
                        Seçilen {selectedIds.size} görselin promptlarına aşağıdaki metin eklenecek ve yeniden oluşturulacaktır.
                    </p>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={batchVariationPrompt}
                            onChange={(e) => setBatchVariationPrompt(e.target.value)}
                            placeholder="Örn: karlı bir günde, neon ışıklar altında..."
                            className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                            autoFocus
                        />
                        <button 
                            onClick={handleBatchVariations}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                            Oluştur
                        </button>
                         <button 
                            onClick={() => setShowVariationInput(false)}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                            İptal
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {history.map((item) => {
                const isSelected = selectedIds.has(item.timestamp);
                return (
                    <button
                    key={item.timestamp}
                    onClick={() => isSelectionMode ? toggleSelection(item.timestamp) : handleRestore(item)}
                    className={`
                        group relative aspect-square bg-black/40 rounded-xl overflow-hidden border transition-all text-left
                        ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-white/5 hover:border-primary/50 hover:ring-2 hover:ring-primary/20'}
                    `}
                    >
                        <img 
                            src={`data:${item.mimeType};base64,${item.base64}`} 
                            alt={item.prompt}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        
                        {/* Selection Overlay */}
                        {isSelectionMode && (
                            <div className={`absolute top-2 right-2 z-10`}>
                                {isSelected ? (
                                    <div className="bg-primary text-white rounded-md shadow-sm p-0.5">
                                        <CheckSquareIcon className="w-5 h-5" />
                                    </div>
                                ) : (
                                    <div className="bg-black/40 text-white/70 rounded-md backdrop-blur-sm p-0.5 hover:bg-black/60 hover:text-white">
                                        <SquareIcon className="w-5 h-5" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Model Badge */}
                        {!isSelectionMode && item.model === 'gemini-flash' && (
                           <div className="absolute top-2 left-2 bg-yellow-500/20 text-yellow-200 text-[8px] px-1.5 py-0.5 rounded border border-yellow-500/30 backdrop-blur-sm font-bold">
                              FLASH
                           </div>
                        )}
                         {!isSelectionMode && item.model === 'gemini-lite' && (
                           <div className="absolute top-2 left-2 bg-green-500/20 text-green-200 text-[8px] px-1.5 py-0.5 rounded border border-green-500/30 backdrop-blur-sm font-bold">
                              LITE
                           </div>
                        )}

                        {/* Action Buttons (Only when not in selection mode) */}
                        {!isSelectionMode && (
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-2">
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRegenerate(item);
                                    }}
                                    className="p-2 bg-white/10 hover:bg-primary text-white rounded-lg backdrop-blur-sm transition-colors cursor-pointer flex items-center justify-center"
                                    title="Tekrarla"
                                >
                                    <RefreshCwIcon className="w-4 h-4" />
                                </div>
                                 <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUseAsReference(item);
                                    }}
                                    className="px-3 py-1 bg-white/10 hover:bg-primary text-white rounded-lg backdrop-blur-sm transition-colors cursor-pointer flex items-center gap-1"
                                    title="Referans Al"
                                >
                                    <LayersIcon className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold">Ref</span>
                                </div>
                            </div>
                        )}
                    </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onSettingsClose}></div>
          <div className="relative w-full max-w-2xl bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-surface py-2 z-10 border-b border-white/5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <SettingsIcon className="w-6 h-6 text-primary" />
                Gelişmiş Ayarlar
              </h2>
              <button 
                onClick={onSettingsClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
                {/* Group 1: Aesthetics & Style */}
                <CollapsibleSection title="Sanat & Atmosfer" icon={<BrushIcon className="w-5 h-5" />} isOpen={activeSections.art} onToggle={() => toggleSection('art')}>
                    <div className="space-y-6">
                        {/* Style Presets */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {STYLE_PRESETS.map((style) => (
                                <button key={style.value} onClick={() => setStylePreset(style.value)} className={`p-2 text-xs rounded-lg border transition-all text-left ${stylePreset === style.value ? 'bg-primary/20 border-primary text-white' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}>
                                    {style.label}
                                </button>
                            ))}
                        </div>
                        
                        {/* Moods & Color Tones */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                             <div className="space-y-3">
                                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ruh Hali (Mood)</h3>
                                 <div className="grid grid-cols-1 gap-1.5">{MOODS.map((m) => (<button key={m.value} onClick={() => setMood(m.value)} className={`p-2 text-xs rounded-lg border transition-all text-left ${mood === m.value ? 'bg-primary/20 border-primary text-white' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}>{m.label}</button>))}</div>
                            </div>
                            <div className="space-y-3">
                                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Renk Tonu</h3>
                                 <div className="grid grid-cols-1 gap-1.5">{COLOR_TONES.map((c) => (<button key={c.value} onClick={() => setColorTone(c.value)} className={`p-2 text-xs rounded-lg border transition-all text-left ${colorTone === c.value ? 'bg-primary/20 border-primary text-white' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}>{c.label}</button>))}</div>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* Group 2: Composition & Scene */}
                <CollapsibleSection title="Kompozisyon & Sahne" icon={<LayersIcon className="w-5 h-5" />} isOpen={activeSections.scene} onToggle={() => toggleSection('scene')}>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-3">
                             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kompozisyon</h3>
                             <div className="grid grid-cols-1 gap-1.5">{COMPOSITIONS.map((c) => (<button key={c.value} onClick={() => setComposition(c.value)} className={`p-2 text-xs rounded-lg border transition-all text-left ${composition === c.value ? 'bg-primary/20 border-primary text-white' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}>{c.label}</button>))}</div>
                        </div>
                        <div className="space-y-3">
                             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kamera Açısı</h3>
                             <div className="grid grid-cols-1 gap-1.5">{CAMERA_ANGLES.map((c) => (<button key={c.value} onClick={() => setCameraAngle(c.value)} className={`p-2 text-xs rounded-lg border transition-all text-left ${cameraAngle === c.value ? 'bg-primary/20 border-primary text-white' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}>{c.label}</button>))}</div>
                        </div>
                         <div className="space-y-3">
                             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aydınlatma</h3>
                             <div className="grid grid-cols-1 gap-1.5">{LIGHTING_TYPES.map((l) => (<button key={l.value} onClick={() => setLighting(l.value)} className={`p-2 text-xs rounded-lg border transition-all text-left ${lighting === l.value ? 'bg-primary/20 border-primary text-white' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}>{l.label}</button>))}</div>
                        </div>
                    </div>
                </CollapsibleSection>
                
                {/* Group 3: Fine Tuning / Controls */}
                <CollapsibleSection title="İnce Ayarlar & Kontroller" icon={<SlidersIcon className="w-5 h-5" />} isOpen={activeSections.tuning} onToggle={() => toggleSection('tuning')}>
                    <div className="space-y-6">
                         {/* Smart Enhance */}
                         <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Akıllı Geliştirme</h3><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={smartEnhance} onChange={(e) => setSmartEnhance(e.target.checked)} className="sr-only peer"/><div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div></label></div>
                         
                         {/* Negative Prompt */}
                         <div className="space-y-3"><h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Negatif Prompt</h3><textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} className="w-full bg-darker border border-white/10 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-primary outline-none resize-none h-20" placeholder="Neleri hariç tutmak istersiniz?"/></div>
                         
                         {/* Seed */}
                         <div className="pt-4 border-t border-white/5">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Seed (Tohum)</h3>
                            <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    placeholder="Rastgele" 
                                    value={seed === undefined ? '' : seed} 
                                    onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)} 
                                    className="w-full bg-darker border border-white/10 rounded-lg p-2 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-primary outline-none"
                                />
                                <button 
                                    onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                                    className="bg-white/5 hover:bg-white/10 text-slate-300 px-3 rounded-lg border border-white/10 transition-colors text-xs"
                                    title="Rastgele Seed Üret"
                                >
                                    <RefreshCwIcon className="w-4 h-4" />
                                </button>
                                 <button 
                                    onClick={() => setSeed(undefined)}
                                    className="bg-white/5 hover:bg-white/10 text-slate-300 px-3 rounded-lg border border-white/10 transition-colors text-xs"
                                    title="Sıfırla"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Aynı seed değeri ve aynı prompt ile benzer görseller üretebilirsiniz.</p>
                        </div>
                    </div>
                </CollapsibleSection>
                
                {/* Group 4: Watermark */}
                <CollapsibleSection title="Filigran" icon={<StampIcon className="w-5 h-5" />} isOpen={activeSections.watermark} onToggle={() => toggleSection('watermark')}>
                   <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4"><span className="text-sm text-slate-300">Filigran Ekle</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={showWatermark} onChange={(e) => setShowWatermark(e.target.checked)} className="sr-only peer"/><div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div></label></div>
                        {showWatermark && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <div><label className="block text-xs font-medium text-slate-400 mb-1">Filigran Metni</label><input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} className="w-full bg-darker border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none" maxLength={30}/></div>
                                <div><label className="block text-xs font-medium text-slate-400">Saydamlık</label><input type="range" min="0" max="100" value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer range-sm accent-primary"/></div>
                            </div>
                        )}
                   </div>
                </CollapsibleSection>
            </div>
            
            <div className="mt-8 pt-4 border-t border-white/10">
                <button onClick={onSettingsClose} className="w-full bg-primary hover:bg-primaryHover text-white font-bold py-3 px-6 rounded-xl transition-all">Kaydet ve Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* ADVANCED IMAGE EDITOR MODAL */}
      {isEditing && editingImageSrc && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-6xl h-[90vh] bg-darker border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
             
             {/* Header */}
             <div className="flex items-center justify-between p-6 border-b border-white/10 bg-surface/50">
                <div className="flex items-center gap-3">
                   <EditIcon className="w-6 h-6 text-primary" />
                   <h2 className="text-xl font-bold text-white">
                     {editTarget === 'generated' ? 'Görsel Düzenleyici' : 
                      editTarget === 'reference' ? 'Referans Görseli Düzenle' : 'Toplu Düzenleme Modu'}
                   </h2>
                   {editTarget === 'batch' && (
                       <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-full border border-blue-500/30">
                           {selectedIds.size} görsel seçildi
                       </span>
                   )}
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setEditState(DEFAULT_EDIT_STATE)} className="text-sm text-slate-400 hover:text-white px-4 py-2 hover:bg-white/5 rounded-lg transition-colors">
                        Sıfırla
                    </button>
                    <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
             </div>

             <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Tools */}
                <div className="w-80 bg-surface/30 border-r border-white/10 flex flex-col overflow-y-auto custom-scrollbar">
                   {/* Tab Switcher */}
                   <div className="p-4 grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setActiveEditTab('transform')}
                        className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${activeEditTab === 'transform' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-slate-400 hover:bg-white/5'}`}
                      >
                        Dönüştür
                      </button>
                      <button 
                        onClick={() => setActiveEditTab('adjust')}
                        className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${activeEditTab === 'adjust' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-slate-400 hover:bg-white/5'}`}
                      >
                        Ayarlar
                      </button>
                   </div>

                   <div className="p-6 space-y-8">
                      {activeEditTab === 'transform' && (
                        <>
                            {/* AI Smart Crop */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <SparklesIcon className="w-4 h-4" /> Akıllı Kırpma
                                </h3>
                                <button
                                  onClick={handleAiSmartCrop}
                                  disabled={isAnalyzingCrop}
                                  className="w-full p-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all"
                                >
                                  {isAnalyzingCrop ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <ScanEyeIcon className="w-4 h-4" />}
                                  {isAnalyzingCrop ? 'Analiz Ediliyor...' : 'AI En İyi Oranı Bul'}
                                </button>
                                {aiCropMessage && (
                                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200 animate-in fade-in slide-in-from-top-2">
                                    {aiCropMessage}
                                  </div>
                                )}
                            </div>

                            <div className="h-px bg-white/10 w-full my-4"></div>

                            {/* Rotation & Flip */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <RotateCwIcon className="w-4 h-4" /> Yönlendirme
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setEditState(s => ({...s, rotation: (s.rotation - 90) % 360}))} className="p-3 bg-dark border border-white/10 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 flex flex-col items-center gap-2 text-xs transition-all">
                                        <RotateCwIcon className="w-5 h-5 -scale-x-100" /> Sol
                                    </button>
                                    <button onClick={() => setEditState(s => ({...s, rotation: (s.rotation + 90) % 360}))} className="p-3 bg-dark border border-white/10 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 flex flex-col items-center gap-2 text-xs transition-all">
                                        <RotateCwIcon className="w-5 h-5" /> Sağ
                                    </button>
                                    <button onClick={() => setEditState(s => ({...s, flipH: !s.flipH}))} className={`p-3 border rounded-xl flex flex-col items-center gap-2 text-xs transition-all ${editState.flipH ? 'bg-primary/20 border-primary text-white' : 'bg-dark border-white/10 text-slate-300 hover:bg-white/5'}`}>
                                        <FlipVerticalIcon className="w-5 h-5 rotate-90" /> Yatay Çevir
                                    </button>
                                    <button onClick={() => setEditState(s => ({...s, flipV: !s.flipV}))} className={`p-3 border rounded-xl flex flex-col items-center gap-2 text-xs transition-all ${editState.flipV ? 'bg-primary/20 border-primary text-white' : 'bg-dark border-white/10 text-slate-300 hover:bg-white/5'}`}>
                                        <FlipVerticalIcon className="w-5 h-5" /> Dikey Çevir
                                    </button>
                                </div>
                            </div>

                            {/* Crop / Aspect Ratio */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <CropIcon className="w-4 h-4" /> Kırpma Oranı
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {['original', '1:1', '16:9', '4:3', '9:16'].map((ratio) => (
                                        <button 
                                            key={ratio}
                                            onClick={() => setEditState(s => ({...s, cropRatio: ratio as any}))}
                                            className={`p-2 text-xs rounded-lg border transition-all ${editState.cropRatio === ratio ? 'bg-primary/20 border-primary text-white' : 'bg-dark border-white/10 text-slate-400 hover:bg-white/5'}`}
                                        >
                                            {ratio === 'original' ? 'Orijinal' : ratio}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Zoom / Scale */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <MaximizeIcon className="w-4 h-4" /> Yakınlaştır (Kırp)
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Uzak</span>
                                        <span>{Math.round(editState.zoom * 100)}%</span>
                                    </div>
                                    <input 
                                        type="range" min="1" max="3" step="0.1" 
                                        value={editState.zoom} 
                                        onChange={(e) => setEditState(s => ({...s, zoom: parseFloat(e.target.value)}))}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer range-sm accent-primary"
                                    />
                                </div>
                            </div>
                        </>
                      )}

                      {activeEditTab === 'adjust' && (
                        <div className="space-y-6">
                             {[
                                { label: 'Parlaklık', key: 'brightness', min: 0, max: 200, icon: <SettingsIcon /> },
                                { label: 'Kontrast', key: 'contrast', min: 0, max: 200, icon: <SettingsIcon /> },
                                { label: 'Doygunluk', key: 'saturation', min: 0, max: 200, icon: <SettingsIcon /> },
                                { label: 'Renk Tonu', key: 'hueRotate', min: -180, max: 180, icon: <SettingsIcon /> },
                                { label: 'Sepya', key: 'sepia', min: 0, max: 100, icon: <SettingsIcon /> },
                                { label: 'Bulanıklık', key: 'blur', min: 0, max: 20, step: 0.5, icon: <SettingsIcon /> },
                             ].map((filter) => (
                                <div key={filter.label} className="space-y-2">
                                    <div className="flex justify-between text-xs font-medium text-slate-300">
                                        <span className="flex items-center gap-2">{filter.label}</span>
                                        <span className="text-primary">{(editState as any)[filter.key]}</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min={filter.min} max={filter.max} step={filter.step || 1}
                                        value={(editState as any)[filter.key]} 
                                        onChange={(e) => setEditState(s => ({...s, [filter.key]: parseFloat(e.target.value)}))}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer range-sm accent-primary"
                                    />
                                </div>
                             ))}
                        </div>
                      )}
                   </div>
                </div>

                {/* Center: Canvas Preview */}
                <div className="flex-1 bg-black/40 flex items-center justify-center p-8 overflow-hidden relative">
                    {/* Checkerboard background */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    
                    <canvas 
                        ref={canvasRef} 
                        className="max-w-full max-h-full object-contain shadow-2xl border border-white/10"
                    />
                </div>
             </div>

             {/* Footer */}
             <div className="p-6 border-t border-white/10 bg-surface/50 flex justify-end gap-4">
                 <button onClick={() => setIsEditing(false)} className="px-6 py-3 rounded-xl text-slate-300 hover:bg-white/5 transition-colors font-medium">
                     İptal
                 </button>
                 <button onClick={handleSaveEditor} className="px-8 py-3 rounded-xl bg-primary hover:bg-primaryHover text-white font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
                     {editTarget === 'reference' ? 'Referansı Güncelle' : 
                      editTarget === 'batch' ? `Tümüne Uygula (${selectedIds.size})` : 'Uygula ve İndir'}
                 </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGenerator;
