
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateImage } from '../services/geminiService';
import { AspectRatio, ASPECT_RATIOS, GeneratedImage, WatermarkTextEffect, WATERMARK_EFFECTS, WatermarkPosition, WATERMARK_POSITIONS, WatermarkSize, WATERMARK_SIZES, Resolution, RESOLUTIONS, StylePreset, STYLE_PRESETS } from '../types';
import { WandIcon, DownloadIcon, AlertCircleIcon, LoaderIcon, ImageIcon, HistoryIcon, TrashIcon, ShareIcon, StampIcon, EditIcon, SettingsIcon, XIcon, UploadCloudIcon, ArchiveIcon, CheckSquareIcon, SquareIcon, RefreshCwIcon } from './Icons';
import JSZip from 'jszip';

const MAX_HISTORY_ITEMS = 5; 

interface ImageGeneratorProps {
  isSettingsOpen?: boolean;
  onSettingsClose?: () => void;
}

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
  const [showRefFilters, setShowRefFilters] = useState(false);
  const [refFilters, setRefFilters] = useState({
    hueRotate: 0,
    brightness: 100,
    contrast: 100
  });
  
  // General Settings
  const [outputFormat, setOutputFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [smartEnhance, setSmartEnhance] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [stylePreset, setStylePreset] = useState<StylePreset>('none');

  // Watermark states
  const [showWatermark, setShowWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState('TdAnimator');
  const [watermarkTextEffect, setWatermarkTextEffect] = useState<WatermarkTextEffect>('none');
  const [watermarkOpacity, setWatermarkOpacity] = useState(70); // 0-100
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottomRight');
  const [watermarkSize, setWatermarkSize] = useState<WatermarkSize>('medium');

  // Batch Selection States
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Image editing states
  const [isEditing, setIsEditing] = useState(false);
  const [currentEditingImage, setCurrentEditingImage] = useState<GeneratedImage | null>(null);
  const [editingSettings, setEditingSettings] = useState({
    hueRotate: 0, // -180 to 180 degrees
    brightness: 100, // 0 to 200%
    contrast: 100, // 0 to 200% (for sharpness)
  });
  const [editedPreviewUrl, setEditedPreviewUrl] = useState<string | null>(null); // For canvas-based final preview/save
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Clear selection when exiting selection mode
  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedIds(new Set());
    }
  }, [isSelectionMode]);

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
    if (isSelectionMode) return; // Don't restore if in selection mode
    setGeneratedImage(item);
    setPrompt(item.prompt);
    setAspectRatio(item.aspectRatio as AspectRatio);
    setResolution(item.resolution || 'hd');
    setStylePreset(item.stylePreset || 'none');
    setWatermarkTextEffect(item.watermarkTextEffect || 'none');
    setWatermarkOpacity(item.watermarkOpacity || 70);
    setWatermarkPosition(item.watermarkPosition || 'bottomRight');
    setWatermarkSize(item.watermarkSize || 'medium');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
           // item.base64 is the raw base64 string
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError("Görsel boyutu 5MB'dan küçük olmalıdır.");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setReferenceImage(event.target.result as string);
          setRefFilters({ hueRotate: 0, brightness: 100, contrast: 100 });
          setShowRefFilters(false);
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setRefFilters({ hueRotate: 0, brightness: 100, contrast: 100 });
    setShowRefFilters(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processReferenceImage = useCallback(async (base64Data: string, filters: typeof refFilters): Promise<string> => {
    if (filters.hueRotate === 0 && filters.brightness === 100 && filters.contrast === 100) {
      return base64Data;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Data);
          return;
        }

        ctx.filter = `brightness(${filters.brightness}%) hue-rotate(${filters.hueRotate}deg) contrast(${filters.contrast}%)`;
        ctx.drawImage(img, 0, 0);
        
        const mimeTypeMatch = base64Data.match(/^data:(image\/\w+);base64,/);
        const type = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
        
        resolve(canvas.toDataURL(type));
      };
      img.onerror = (e) => reject(e);
      img.src = base64Data;
    });
  }, []);

  const handleGenerate = useCallback(async (overrideConfig?: Partial<GeneratedImage>) => {
    // 1. Determine effective values (use override or current state)
    const effectivePrompt = overrideConfig?.prompt ?? prompt;
    const effectiveAspectRatio = (overrideConfig?.aspectRatio as AspectRatio) ?? aspectRatio;
    const effectiveResolution = (overrideConfig?.resolution as Resolution) ?? resolution;
    const effectiveStyle = (overrideConfig?.stylePreset as StylePreset) ?? stylePreset;

    if (!effectivePrompt.trim()) {
      setError("Lütfen oluşturmak istediğiniz görsel için bir açıklama girin.");
      return;
    }

    // Update UI to match what is being generated
    if (overrideConfig) {
       setPrompt(effectivePrompt);
       setAspectRatio(effectiveAspectRatio);
       setResolution(effectiveResolution);
       setStylePreset(effectiveStyle);
       // Note: Regenerating usually means text-to-image unless user has manually re-uploaded the ref image
    }

    setIsLoading(true);
    setError(null);
    
    try {
      let finalPrompt = effectivePrompt.trim();
      
      const selectedStyle = STYLE_PRESETS.find(s => s.value === effectiveStyle);
      if (selectedStyle && selectedStyle.promptModifier) {
        // Use current referenceImage state even when regenerating, or null if none
        if (referenceImage) {
            finalPrompt += `. Redraw this image in ${selectedStyle.label} style. ${selectedStyle.promptModifier}`;
        } else {
            finalPrompt += selectedStyle.promptModifier;
        }
      } else if (referenceImage) {
         finalPrompt += ". Use the reference image as inspiration.";
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

      let processedRefImage = referenceImage;
      if (referenceImage) {
        processedRefImage = await processReferenceImage(referenceImage, refFilters);
      }

      const result = await generateImage(
          finalPrompt, 
          effectiveAspectRatio, 
          outputFormat,
          processedRefImage || undefined
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
      };

      setGeneratedImage(newImage);
      saveToHistory(newImage);

    } catch (err: any) {
      setError(err.message || "Görüntü oluşturulurken beklenmeyen bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, aspectRatio, resolution, stylePreset, negativePrompt, history, watermarkTextEffect, watermarkOpacity, watermarkPosition, watermarkSize, outputFormat, smartEnhance, referenceImage, refFilters, processReferenceImage]);

  const handleRegenerate = useCallback((item: GeneratedImage) => {
    handleGenerate(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [handleGenerate]);

  const applyWatermark = useCallback(async (
    imageDataUrl: string, 
    text: string, 
    effect: WatermarkTextEffect,
    opacity: number,
    position: WatermarkPosition,
    size: WatermarkSize,
    ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageDataUrl); 
          return;
        }

        ctx.drawImage(img, 0, 0);

        const mimeTypeMatch = imageDataUrl.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

        const baseFontSize = Math.max(20, img.width * 0.035);
        let dynamicFontSize = baseFontSize;
        switch(size) {
            case 'small': dynamicFontSize *= 0.7; break;
            case 'large': dynamicFontSize *= 1.3; break;
            case 'extraLarge': dynamicFontSize *= 1.6; break;
            case 'medium': default: break;
        }
        
        ctx.font = `bold ${dynamicFontSize}px sans-serif`;
        ctx.globalAlpha = opacity / 100;
        
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = 0;
        ctx.lineJoin = 'miter';

        const textMetrics = ctx.measureText(text);
        const textHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
        const padding = img.width * 0.025;

        const drawSingleWatermark = (x: number, y: number) => {
          switch (effect) {
            case 'outline':
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'; 
                ctx.lineWidth = Math.max(2, dynamicFontSize * 0.08);
                ctx.lineJoin = 'round';
                ctx.strokeText(text, x, y);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                break;
            case 'shadow':
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                break;
            case 'glow':
                ctx.shadowColor = 'rgba(255, 255, 255, 0.7)'; 
                ctx.shadowBlur = Math.max(8, dynamicFontSize * 0.2); 
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                break;
            case 'emboss':
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowOffsetX = Math.max(1, dynamicFontSize * 0.05);
                ctx.shadowOffsetY = Math.max(1, dynamicFontSize * 0.05);
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillText(text, x, y); 
                ctx.shadowColor = 'rgba(255,255,255,0.6)';
                ctx.shadowOffsetX = -Math.max(1, dynamicFontSize * 0.05);
                ctx.shadowOffsetY = -Math.max(1, dynamicFontSize * 0.05);
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(100,100,100,0.8)';
                break;
            case 'vintage':
                ctx.fillStyle = 'rgba(200, 180, 150, 0.9)'; 
                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                ctx.shadowBlur = 2;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                break;
            case 'neon':
                ctx.fillStyle = 'rgba(0, 255, 255, 0.9)'; 
                ctx.shadowColor = 'rgba(0, 255, 255, 1)';
                ctx.shadowBlur = Math.max(10, dynamicFontSize * 0.3);
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                break;
            case 'none':
            default:
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                ctx.shadowBlur = 2;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                break;
          }
          ctx.fillText(text, x, y);
        };

        let x: number, y: number;

        if (position === 'tile') {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const textWidth = textMetrics.width;
          const rotateAngle = -25 * Math.PI / 180; 
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(rotateAngle);
          ctx.translate(-canvas.width / 2, -canvas.height / 2);

          for (let i = -canvas.height; i < canvas.height * 2; i += textHeight * 3) {
            for (let j = -canvas.width; j < canvas.width * 2; j += textWidth * 1.5) {
              drawSingleWatermark(j, i);
            }
          }
          ctx.setTransform(1, 0, 0, 1, 0, 0);

        } else {
          switch (position) {
            case 'topLeft':
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              x = padding;
              y = padding;
              break;
            case 'topRight':
              ctx.textAlign = 'right';
              ctx.textBaseline = 'top';
              x = img.width - padding;
              y = padding;
              break;
            case 'bottomLeft':
              ctx.textAlign = 'left';
              ctx.textBaseline = 'bottom';
              x = padding;
              y = img.height - padding;
              break;
            case 'center':
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              x = img.width / 2;
              y = img.height / 2;
              break;
            case 'bottomRight':
            default:
              ctx.textAlign = 'right';
              ctx.textBaseline = 'bottom';
              x = img.width - padding;
              y = img.height - padding;
              break;
          }
          drawSingleWatermark(x, y);
        }

        ctx.globalAlpha = 1; 
        resolve(canvas.toDataURL(mimeType));
      };
      img.onerror = () => resolve(imageDataUrl);
      img.src = imageDataUrl;
    });
  }, []);

  const applyImageFilters = useCallback(async (
    imageDataUrl: string,
    filters: typeof editingSettings,
    mimeType: string,
    applyWatermarkFlag: boolean,
    wmText: string,
    wmEffect: WatermarkTextEffect,
    wmOpacity: number,
    wmPosition: WatermarkPosition,
    wmSize: WatermarkSize,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context not available.'));
        }

        ctx.filter = `
          brightness(${filters.brightness}%)
          hue-rotate(${filters.hueRotate}deg)
          contrast(${filters.contrast}%)
        `;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none'; 

        let finalDataUrl = canvas.toDataURL(mimeType);

        if (applyWatermarkFlag && wmText.trim()) {
          try {
            finalDataUrl = await applyWatermark(finalDataUrl, wmText.trim(), wmEffect, wmOpacity, wmPosition, wmSize);
          } catch (wmError) {
            console.error("Filigran eklenirken hata oluştu", wmError);
          }
        }
        resolve(finalDataUrl);
      };
      img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
      img.src = imageDataUrl;
    });
  }, [applyWatermark]);

  const handleDownload = useCallback(async (imageToDownload: GeneratedImage = generatedImage!) => {
    if (!imageToDownload) return;

    let imageUrl = `data:${imageToDownload.mimeType};base64,${imageToDownload.base64}`;
    
    if (showWatermark && watermarkText.trim()) {
      try {
        imageUrl = await applyWatermark(
          imageUrl, 
          watermarkText.trim(), 
          watermarkTextEffect, 
          watermarkOpacity, 
          watermarkPosition, 
          watermarkSize
        );
      } catch (e) {
        console.error("Filigran eklenirken hata oluştu", e);
      }
    }

    const ext = imageToDownload.mimeType === 'image/png' ? 'png' : 'jpg';
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `tdanimator-${imageToDownload.timestamp}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImage, showWatermark, watermarkText, watermarkTextEffect, watermarkOpacity, watermarkPosition, watermarkSize, applyWatermark]);

  const handleShare = useCallback(async (imageToShare: GeneratedImage = generatedImage!) => {
    if (!imageToShare) return;

    try {
      let imageUrl = `data:${imageToShare.mimeType};base64,${imageToShare.base64}`;
      
      if (showWatermark && watermarkText.trim()) {
        imageUrl = await applyWatermark(
          imageUrl, 
          watermarkText.trim(), 
          watermarkTextEffect,
          watermarkOpacity, 
          watermarkPosition, 
          watermarkSize
        );
      }

      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const ext = imageToShare.mimeType === 'image/png' ? 'png' : 'jpg';
      const file = new File([blob], `tdanimator-${imageToShare.timestamp}.${ext}`, { type: imageToShare.mimeType });

      if (navigator.share) {
        await navigator.share({
          title: 'TdAnimator ile oluşturuldu',
          text: `TdAnimator ile oluşturuldu: "${imageToShare.prompt}"`,
          files: [file],
        });
      } else {
        alert('Cihazınız doğrudan paylaşmayı desteklemiyor.');
      }
    } catch (error) {
      console.error('Paylaşım hatası:', error);
    }
  }, [generatedImage, showWatermark, watermarkText, watermarkTextEffect, watermarkOpacity, watermarkPosition, watermarkSize, applyWatermark]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
        handleGenerate();
    }
  };

  const getWatermarkPreviewStyle = useCallback(() => {
    const baseStyle: React.CSSProperties = {
      fontSize: 'clamp(12px, 3.5vw, 32px)', 
      textShadow: 'none', 
      filter: 'none', 
      color: `rgba(255, 255, 255, ${watermarkOpacity / 100})`,
      position: 'absolute',
      fontWeight: 'bold',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      zIndex: 10,
    };

    const padding = '2.5%';

    switch (watermarkPosition) {
        case 'topLeft':
            baseStyle.top = padding;
            baseStyle.left = padding;
            baseStyle.textAlign = 'left';
            break;
        case 'topRight':
            baseStyle.top = padding;
            baseStyle.right = padding;
            baseStyle.textAlign = 'right';
            break;
        case 'bottomLeft':
            baseStyle.bottom = padding;
            baseStyle.left = padding;
            baseStyle.textAlign = 'left';
            break;
        case 'center':
            baseStyle.top = '50%';
            baseStyle.left = '50%';
            baseStyle.transform = 'translate(-50%, -50%)';
            baseStyle.textAlign = 'center';
            break;
        case 'bottomRight':
        default:
            baseStyle.bottom = padding;
            baseStyle.right = padding;
            baseStyle.textAlign = 'right';
            break;
    }

    switch(watermarkSize) {
        case 'small': baseStyle.fontSize = 'clamp(10px, 2.5vw, 24px)'; break;
        case 'large': baseStyle.fontSize = 'clamp(16px, 4.5vw, 40px)'; break;
        case 'extraLarge': baseStyle.fontSize = 'clamp(20px, 5.5vw, 48px)'; break;
        case 'medium': default: break;
    }

    switch (watermarkTextEffect) {
      case 'outline':
        baseStyle.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
        break;
      case 'shadow':
        baseStyle.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.8)';
        break;
      case 'glow':
        baseStyle.textShadow = '0 0 8px rgba(255, 255, 255, 0.7), 0 0 12px rgba(255, 255, 255, 0.5)';
        break;
      case 'emboss':
        baseStyle.textShadow = '1px 1px 1px rgba(0,0,0,0.6), -1px -1px 1px rgba(255,255,255,0.6)';
        baseStyle.color = `rgba(200, 200, 200, ${watermarkOpacity / 100})`;
        break;
      case 'vintage':
        baseStyle.color = `rgba(200, 180, 150, ${watermarkOpacity / 100})`; 
        baseStyle.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.3)';
        break;
      case 'neon':
        baseStyle.color = `rgba(0, 255, 255, ${watermarkOpacity / 100})`; 
        baseStyle.textShadow = `0 0 10px rgba(0, 255, 255, 1), 0 0 20px rgba(0, 255, 255, 0.8)`;
        break;
      case 'none':
      default:
        baseStyle.filter = 'drop-shadow(0 2px 2px rgba(0,0,0,0.8))';
        break;
    }
    return baseStyle;
  }, [watermarkTextEffect, watermarkOpacity, watermarkPosition, watermarkSize]);

  const handleOpenEditor = useCallback((imageToEdit: GeneratedImage) => {
    setCurrentEditingImage(imageToEdit);
    setEditingSettings({ hueRotate: 0, brightness: 100, contrast: 100 }); 
    setEditedPreviewUrl(`data:${imageToEdit.mimeType};base64,${imageToEdit.base64}`); 
    setIsEditing(true);
  }, []);

  const getEditorPreviewFilterStyle = useCallback(() => {
    return {
      filter: `brightness(${editingSettings.brightness}%) hue-rotate(${editingSettings.hueRotate}deg) contrast(${editingSettings.contrast}%)`
    };
  }, [editingSettings]);


  const handleApplyEditsAndDownload = useCallback(async () => {
    if (!currentEditingImage) return;

    try {
      const originalDataUrl = `data:${currentEditingImage.mimeType};base64,${currentEditingImage.base64}`;
      const finalDataUrl = await applyImageFilters(
        originalDataUrl,
        editingSettings,
        currentEditingImage.mimeType,
        showWatermark,
        watermarkText,
        watermarkTextEffect,
        watermarkOpacity,
        watermarkPosition,
        watermarkSize,
      );

      const ext = currentEditingImage.mimeType === 'image/png' ? 'png' : 'jpg';
      const link = document.createElement('a');
      link.href = finalDataUrl;
      link.download = `tdanimator-edited-${currentEditingImage.timestamp}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsEditing(false); 
    } catch (err) {
      console.error("Düzenlenmiş görsel indirilirken hata oluştu:", err);
      setError("Düzenlenmiş görsel indirilemedi.");
    }
  }, [currentEditingImage, editingSettings, applyImageFilters, showWatermark, watermarkText, watermarkTextEffect, watermarkOpacity, watermarkPosition, watermarkSize]);

  const handleResetEdits = useCallback(() => {
    setEditingSettings({ hueRotate: 0, brightness: 100, contrast: 100 });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setCurrentEditingImage(null);
    setEditedPreviewUrl(null);
    setEditingSettings({ hueRotate: 0, brightness: 100, contrast: 100 });
    setError(null); 
  }, []);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Controls */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl relative">
          
          <div className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-slate-300 mb-2 pr-10">
                Görsel Açıklaması & Referans
              </label>
              <div className="relative">
                <textarea
                  ref={textAreaRef}
                  id="prompt"
                  className="w-full bg-darker border border-white/10 rounded-xl p-4 pb-12 text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all min-h-[140px]"
                  placeholder="Görselinizi detaylı bir şekilde tanımlayın... (örn., 'Kızıl saçlı anime karakteri')"
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                />
                
                {/* Reference Image Preview & Upload Button Area */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                   {/* Upload Button */}
                   <div className="flex items-center gap-2">
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
                        title="Referans Resim Ekle"
                      >
                        <UploadCloudIcon className="w-5 h-5" />
                        <span className="text-xs font-medium">Referans Resim</span>
                      </label>
                   </div>

                   {/* Character Count */}
                   <div className="text-xs text-slate-500">
                     {prompt.length} karakter
                   </div>
                </div>
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
                                style={{
                                  filter: `brightness(${refFilters.brightness}%) hue-rotate(${refFilters.hueRotate}deg) contrast(${refFilters.contrast}%)`
                                }}
                              />
                          </div>
                          <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-white truncate">Referans Görsel</span>
                              <span className="text-[10px] text-slate-400 truncate">
                                {showRefFilters ? 'Filtreler Aktif' : 'Stil için kullanılacak'}
                              </span>
                          </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setShowRefFilters(!showRefFilters)}
                            className={`p-1.5 rounded-lg transition-colors ${showRefFilters ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                            title="Görseli Düzenle"
                        >
                            <SettingsIcon className="w-4 h-4" />
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

                  {/* Inline Reference Image Filters */}
                  {showRefFilters && (
                     <div className="p-3 bg-darker/50 border border-white/5 rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        {/* Hue */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400">
                             <span>Renk Tonu</span>
                             <span className="text-primary">{refFilters.hueRotate}°</span>
                          </div>
                          <input
                            type="range"
                            min="-180"
                            max="180"
                            value={refFilters.hueRotate}
                            onChange={(e) => setRefFilters(prev => ({...prev, hueRotate: Number(e.target.value)}))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer range-sm accent-primary"
                          />
                        </div>
                         {/* Brightness */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400">
                             <span>Parlaklık</span>
                             <span className="text-primary">{refFilters.brightness}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={refFilters.brightness}
                            onChange={(e) => setRefFilters(prev => ({...prev, brightness: Number(e.target.value)}))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer range-sm accent-primary"
                          />
                        </div>
                        {/* Contrast */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400">
                             <span>Keskinlik/Kontrast</span>
                             <span className="text-primary">{refFilters.contrast}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={refFilters.contrast}
                            onChange={(e) => setRefFilters(prev => ({...prev, contrast: Number(e.target.value)}))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer range-sm accent-primary"
                          />
                        </div>
                        <button 
                          onClick={() => setRefFilters({ hueRotate: 0, brightness: 100, contrast: 100 })}
                          className="w-full text-[10px] text-slate-500 hover:text-slate-300 py-1 border border-white/5 rounded hover:bg-white/5 transition-colors"
                        >
                          Filtreleri Sıfırla
                        </button>
                     </div>
                  )}
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
                      ${!!referenceImage ? 'opacity-50 cursor-not-allowed border-transparent' : ''}
                      ${resolution === res.value 
                        ? 'bg-primary/20 border-primary text-white' 
                        : 'bg-darker border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5'}
                    `}
                  >
                    {res.label}
                  </button>
                ))}
              </div>
               {referenceImage && (
                  <p className="text-[10px] text-orange-400 mt-1">
                    * Referans resim kullanıldığında çözünürlük otomatik ayarlanır.
                  </p>
              )}
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
                <li>İstemediğiniz nesneleri "Genel Ayarlar" kısmından filtreleyebilirsiniz.</li>
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
                          role="progressbar" 
                          aria-valuenow={0} 
                          aria-valuemin={0} 
                          aria-valuemax={100}
                          aria-label="Görsel oluşturuluyor"
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
                          {/* CSS-based Watermark Preview (Only for non-tiled positions) */}
                          {showWatermark && watermarkText.trim() && watermarkPosition !== 'tile' && (
                            <div 
                              className="font-bold z-10 select-none"
                              style={getWatermarkPreviewStyle()}
                            >
                              {watermarkText}
                            </div>
                          )}
                          {/* CSS-based Watermark Preview (Tiled position, approximated) */}
                          {showWatermark && watermarkText.trim() && watermarkPosition === 'tile' && (
                            <div className="absolute inset-0 z-10 overflow-hidden opacity-50">
                                <div 
                                    className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] rotate-[-25deg] flex flex-wrap justify-around items-center"
                                    style={{
                                        opacity: watermarkOpacity / 100,
                                        fontSize: getWatermarkPreviewStyle().fontSize,
                                        color: getWatermarkPreviewStyle().color,
                                        textShadow: getWatermarkPreviewStyle().textShadow,
                                        filter: getWatermarkPreviewStyle().filter,
                                    }}
                                >
                                    {Array.from({ length: 50 }).map((_, i) => ( 
                                        <span key={i} className="p-4" style={{ whiteSpace: 'nowrap' }}>
                                            {watermarkText}
                                        </span>
                                    ))}
                                </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="absolute inset-0 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-6 bg-gradient-to-t from-black/80 via-transparent to-transparent rounded-lg">
                            <div className="flex gap-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                              <button 
                                  onClick={() => handleOpenEditor(generatedImage)}
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
          <div className="bg-surface border border-white/10 rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
              <div className="flex items-center gap-2 text-slate-200">
                <HistoryIcon className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Geçmiş Çalışmalar</h3>
              </div>
              
              <div className="flex items-center gap-2">
                {isSelectionMode ? (
                  <>
                     <button 
                      onClick={() => setIsSelectionMode(false)}
                      className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      Vazgeç
                    </button>
                    <button 
                      onClick={handleSelectAll}
                      className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      {selectedIds.size === history.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                    </button>
                    {selectedIds.size > 0 && (
                        <>
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
                  </>
                ) : (
                  <>
                     <button 
                        onClick={() => setIsSelectionMode(true)}
                        className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <CheckSquareIcon className="w-3.5 h-3.5" />
                        Seç
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

                        {/* Regenerate Button (Only when not in selection mode) */}
                        {!isSelectionMode && (
                            <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRegenerate(item);
                                    }}
                                    className="p-1.5 bg-black/50 hover:bg-primary text-white rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                                    title="Bu ayarlarla tekrar oluştur"
                                >
                                    <RefreshCwIcon className="w-4 h-4" />
                                </div>
                            </div>
                        )}

                        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity p-3 flex flex-col justify-end ${isSelectionMode ? (isSelected ? 'opacity-40' : 'opacity-0') : 'opacity-0 group-hover:opacity-100'}`}>
                            {!isSelectionMode && (
                                <p className="text-white text-[10px] line-clamp-3 font-medium leading-tight">
                                {item.prompt}
                                </p>
                            )}
                        </div>
                    </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal (Existing Code) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onSettingsClose}></div>
          <div className="relative w-full max-w-xl bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
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

            <div className="space-y-8">
                {/* Section 0: Style Presets */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Stil Şablonu</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {STYLE_PRESETS.map((style) => (
                            <button
                                key={style.value}
                                onClick={() => setStylePreset(style.value)}
                                className={`p-2 text-xs rounded-lg border transition-all text-left ${stylePreset === style.value ? 'bg-primary/20 border-primary text-white' : 'bg-darker border-white/10 text-slate-400 hover:bg-white/5'}`}
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>
                </div>

                <hr className="border-white/5" />

                {/* Section 1: Format & Enhance */}
                <div className="space-y-4">
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Çıktı Formatı</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setOutputFormat('image/jpeg')}
                                className={`p-3 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2 ${outputFormat === 'image/jpeg' ? 'bg-primary/20 border-primary text-white' : 'bg-darker border-white/10 text-slate-400 hover:border-white/20'}`}
                            >
                                JPG
                            </button>
                            <button 
                                onClick={() => setOutputFormat('image/png')}
                                className={`p-3 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2 ${outputFormat === 'image/png' ? 'bg-primary/20 border-primary text-white' : 'bg-darker border-white/10 text-slate-400 hover:border-white/20'}`}
                            >
                                PNG
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Akıllı Geliştirme</h3>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={smartEnhance} 
                                    onChange={(e) => setSmartEnhance(e.target.checked)} 
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                        <p className="text-xs text-slate-400">
                            Otomatik olarak "8k, high quality, highly detailed" gibi anahtar kelimeler ekleyerek görsel kalitesini artırır.
                        </p>
                    </div>
                </div>

                <hr className="border-white/5" />

                {/* Section 2: Negative Prompt */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Negatif Prompt (İstenmeyenler)</h3>
                    <p className="text-xs text-slate-400 mb-2">Görselde olmamasını istediğiniz şeyleri yazın (örn. "bulanık, düşük kalite, insan").</p>
                    <textarea
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        className="w-full bg-darker border border-white/10 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-primary outline-none resize-none h-20"
                        placeholder="Neleri hariç tutmak istersiniz?"
                    />
                </div>

                <hr className="border-white/5" />

                {/* Section 3: Watermark */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                             <StampIcon className="w-4 h-4 text-primary" />
                             Filigran
                        </h3>
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
                        <div className="space-y-4 p-4 bg-darker/50 rounded-xl border border-white/5 animate-in slide-in-from-top-2">
                            {/* Text */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Filigran Metni</label>
                                <input
                                    type="text"
                                    value={watermarkText}
                                    onChange={(e) => setWatermarkText(e.target.value)}
                                    placeholder="Filigran metnini girin"
                                    aria-label="Filigran metni"
                                    className="w-full bg-darker border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-primary outline-none"
                                    maxLength={30}
                                />
                            </div>

                            {/* Opacity */}
                            <div className="space-y-2">
                                <label htmlFor="wmOpacity" className="block text-xs font-medium text-slate-400">
                                    Saydamlık: <span className="text-primary">{watermarkOpacity}%</span>
                                </label>
                                <input
                                    id="wmOpacity"
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={watermarkOpacity}
                                    onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer range-sm accent-primary"
                                />
                            </div>

                            {/* Position */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Konum</label>
                                <div className="grid grid-cols-3 gap-2">
                                {WATERMARK_POSITIONS.map((pos) => (
                                    <button
                                    key={pos.value}
                                    onClick={() => setWatermarkPosition(pos.value)}
                                    className={`
                                        p-2 rounded-lg border text-xs transition-all
                                        ${watermarkPosition === pos.value 
                                        ? 'bg-primary/20 border-primary text-white' 
                                        : 'bg-darker border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5'}
                                    `}
                                    >
                                    {pos.label}
                                    </button>
                                ))}
                                </div>
                            </div>

                            {/* Size */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Boyut</label>
                                <div className="grid grid-cols-4 gap-2">
                                {WATERMARK_SIZES.map((size) => (
                                    <button
                                    key={size.value}
                                    onClick={() => setWatermarkSize(size.value)}
                                    className={`
                                        p-2 rounded-lg border text-xs transition-all
                                        ${watermarkSize === size.value 
                                        ? 'bg-primary/20 border-primary text-white' 
                                        : 'bg-darker border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5'}
                                    `}
                                    >
                                    {size.label}
                                    </button>
                                ))}
                                </div>
                            </div>

                            {/* Effects */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Efekt</label>
                                <div className="grid grid-cols-2 gap-2">
                                {WATERMARK_EFFECTS.map((effect) => (
                                    <button
                                    key={effect.value}
                                    onClick={() => setWatermarkTextEffect(effect.value)}
                                    className={`
                                        p-2 rounded-lg border text-xs transition-all
                                        ${watermarkTextEffect === effect.value 
                                        ? 'bg-primary/20 border-primary text-white' 
                                        : 'bg-darker border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5'}
                                    `}
                                    >
                                    {effect.label}
                                    </button>
                                ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-white/10">
                <button 
                    onClick={onSettingsClose}
                    className="w-full bg-primary hover:bg-primaryHover text-white font-bold py-3 px-6 rounded-xl transition-all"
                >
                    Kaydet ve Kapat
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Editing Modal (Existing Code) */}
      {isEditing && currentEditingImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-5xl h-[90vh] bg-surface border border-white/10 rounded-2xl p-8 shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <EditIcon className="w-6 h-6 text-primary" />
                Görseli Düzenle
              </h2>
              <button 
                onClick={handleCancelEdit}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
                aria-label="Düzenlemeyi İptal Et"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
              {/* Image Preview */}
              <div className="lg:col-span-2 flex items-center justify-center bg-darker rounded-xl overflow-hidden p-4 relative">
                {editedPreviewUrl ? (
                  <img 
                    src={editedPreviewUrl}
                    alt="Düzenlenen Görsel Önizlemesi"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                    style={getEditorPreviewFilterStyle()}
                  />
                ) : (
                  <LoaderIcon className="w-12 h-12 animate-spin text-primary" />
                )}
              </div>

              {/* Controls */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                {/* Renk Tonu */}
                <div className="space-y-2">
                  <label htmlFor="hueRotate" className="block text-sm font-medium text-slate-300">
                    Renk Tonu: <span className="text-primary">{editingSettings.hueRotate}°</span>
                  </label>
                  <input
                    id="hueRotate"
                    type="range"
                    min="-180"
                    max="180"
                    value={editingSettings.hueRotate}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, hueRotate: Number(e.target.value) }))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer range-sm accent-primary"
                    aria-label="Görselin renk tonunu ayarla"
                  />
                </div>

                {/* Parlaklık */}
                <div className="space-y-2">
                  <label htmlFor="brightness" className="block text-sm font-medium text-slate-300">
                    Parlaklık: <span className="text-primary">{editingSettings.brightness}%</span>
                  </label>
                  <input
                    id="brightness"
                    type="range"
                    min="0"
                    max="200"
                    value={editingSettings.brightness}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, brightness: Number(e.target.value) }))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer range-sm accent-primary"
                    aria-label="Görselin parlaklığını ayarla"
                  />
                </div>

                {/* Keskinlik (Kontrast ile simüle edildi) */}
                <div className="space-y-2">
                  <label htmlFor="contrast" className="block text-sm font-medium text-slate-300">
                    Keskinlik: <span className="text-primary">{editingSettings.contrast}%</span>
                  </label>
                  <input
                    id="contrast"
                    type="range"
                    min="0"
                    max="200"
                    value={editingSettings.contrast}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, contrast: Number(e.target.value) }))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer range-sm accent-primary"
                    aria-label="Görselin keskinliğini ayarla"
                  />
                </div>

                {/* Buttons */}
                <div className="mt-auto space-y-3">
                  <button
                    onClick={handleApplyEditsAndDownload}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-lg bg-primary hover:bg-primaryHover text-white transition-all shadow-lg shadow-primary/10"
                  >
                    <DownloadIcon className="w-5 h-5" />
                    Uygula & İndir
                  </button>
                  <button
                    onClick={handleResetEdits}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all"
                  >
                    <HistoryIcon className="w-5 h-5 rotate-180" />
                    Sıfırla
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <TrashIcon className="w-5 h-5" />
                    İptal
                  </button>
                </div>
              </div>
            </div>
            {error && (
              <div className="p-4 mt-6 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
                <AlertCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">{error}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGenerator;
