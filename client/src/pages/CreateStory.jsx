import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Image as ImageIcon,
  Type,
  Smile,
  Plus,
  X,
  Save,
  Play,
  Download,
  ChevronLeft,
  ChevronRight,
  Bold,
  Palette,
  Move,
  Trash2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { getEvent, getPhotos, createStory } from '../utils/api';
import { useUser } from '../context/UserContext';
import { STORY_SLIDE_DURATION } from '../utils/constants';

const TEXT_COLORS = [
  '#ffffff',
  '#000000',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
];

const EMOJI_LIST = [
  '❤️', '🔥', '😂', '🎉', '✨', '💯', '🥳', '🤩',
  '😍', '👏', '💪', '🙌', '🎊', '⭐', '🌟', '💫',
  '🎵', '🎶', '📸', '🎨', '🌈', '💐', '🎁', '🍾',
  '🥂', '🎂', '👑', '💎', '🦋', '🌸', '🌺', '🏆',
];

const AUTO_CAPTIONS = [
  'Memories \u2728',
  'Best night ever!',
  'Living our best life',
  'Squad goals \ud83d\udd25',
  'Unforgettable moments',
  'Cheers! \ud83e\udd42',
  'So much fun!',
  'Forever grateful \ud83d\udcab',
  'Good vibes only \u2764\ufe0f',
  'What a night! \ud83c\udf89',
  'Love this crew \ud83d\ude0d',
  'Making memories \ud83d\udcf8',
  'The best people \ud83d\udc51',
  'Can\u2019t stop smiling \ud83d\ude01',
  'Epic moments \ud83c\udf1f',
  'Together is better \ud83d\ude4c',
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function createSlide(photoUrl, photoId) {
  return {
    id: generateId(),
    photoUrl: photoUrl || null,
    photoId: photoId || null,
    textOverlays: [],
    stickers: [],
  };
}

// Draggable element component with touch + mouse support
function DraggableElement({
  element,
  onMove,
  onRemove,
  containerRef,
  isSelected,
  onSelect,
}) {
  const elRef = useRef(null);
  const dragState = useRef({
    active: false,
    startX: 0,
    startY: 0,
    elStartX: 0,
    elStartY: 0,
  });

  const handleStart = useCallback(
    (clientX, clientY) => {
      onSelect?.(element.id);
      const container = containerRef.current;
      if (!container) return;

      dragState.current = {
        active: true,
        startX: clientX,
        startY: clientY,
        elStartX: element.x,
        elStartY: element.y,
      };
    },
    [element, containerRef, onSelect]
  );

  const handleMove = useCallback(
    (clientX, clientY) => {
      const ds = dragState.current;
      if (!ds.active) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const dx = ((clientX - ds.startX) / rect.width) * 100;
      const dy = ((clientY - ds.startY) / rect.height) * 100;

      onMove(element.id, {
        x: Math.max(0, Math.min(90, ds.elStartX + dx)),
        y: Math.max(0, Math.min(90, ds.elStartY + dy)),
      });
    },
    [element.id, containerRef, onMove]
  );

  const handleEnd = useCallback(() => {
    dragState.current.active = false;
  }, []);

  // Mouse events
  const handleMouseDown = (e) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);

    const onMouseMove = (ev) => handleMove(ev.clientX, ev.clientY);
    const onMouseUp = () => {
      handleEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Touch events
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  return (
    <div
      ref={elRef}
      className={`absolute cursor-move select-none ${isSelected ? 'z-20' : 'z-10'}`}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {element.type === 'text' ? (
        <div
          className="relative group"
          style={{
            color: element.color || '#ffffff',
            fontSize: `${element.fontSize || 24}px`,
            fontWeight: element.bold ? 'bold' : 'normal',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            backgroundColor: element.bgColor || 'transparent',
            padding: element.bgColor ? '4px 12px' : '0',
            borderRadius: element.bgColor ? '8px' : '0',
            whiteSpace: 'nowrap',
          }}
        >
          {element.text}
          {isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(element.id);
              }}
              className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ) : (
        <div className="relative group text-3xl sm:text-4xl">
          {element.emoji}
          {isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(element.id);
              }}
              className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CreateStory() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { userId, userName } = useUser();

  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingStory, setDownloadingStory] = useState(false);

  // Slides
  const [slides, setSlides] = useState([createSlide()]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState(null);

  // Modals
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Text input state
  const [newText, setNewText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textFontSize, setTextFontSize] = useState(24);
  const [textBold, setTextBold] = useState(false);
  const [textBgColor, setTextBgColor] = useState('');

  // Preview mode
  const [previewing, setPreviewing] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewTimerRef = useRef(null);

  const containerRef = useRef(null);
  const eventId = event?._id || event?.id || code;

  const activeSlide = slides[activeSlideIndex] || slides[0];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const eventRes = await getEvent(code);
        if (cancelled) return;
        const evt = eventRes.event || eventRes;
        setEvent(evt);
        const photosData = await getPhotos(evt.id || code).catch(() => ({ photos: [] }));
        if (cancelled) return;
        setPhotos(
          Array.isArray(photosData) ? photosData : photosData.photos || []
        );
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Preview auto-play
  useEffect(() => {
    if (previewing) {
      previewTimerRef.current = setInterval(() => {
        setPreviewIndex((prev) => {
          if (prev >= slides.length - 1) {
            setPreviewing(false);
            return 0;
          }
          return prev + 1;
        });
      }, STORY_SLIDE_DURATION);
    }
    return () => {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    };
  }, [previewing, slides.length]);

  const getPhotoUrl = (photo) => {
    const uidParam = `?uid=${encodeURIComponent(userId)}`;
    if (photo.url) return photo.url;
    return `/uploads/${eventId}/${photo.filename || photo.file}${uidParam}`;
  };

  const getThumbUrl = (photo) => {
    const uidParam = `?uid=${encodeURIComponent(userId)}`;
    if (photo.thumbnail)
      return `/uploads/${eventId}/${photo.thumbnail}${uidParam}`;
    return getPhotoUrl(photo);
  };

  const updateSlide = (index, updates) => {
    setSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  // Photo selection
  const handleSelectPhoto = (photo) => {
    const url = getPhotoUrl(photo);
    const id = photo._id || photo.id;
    updateSlide(activeSlideIndex, { photoUrl: url, photoId: id });
    setShowPhotoPicker(false);
  };

  // Add text overlay
  const handleAddText = () => {
    if (!newText.trim()) return;
    const textOverlay = {
      id: generateId(),
      type: 'text',
      text: newText.trim(),
      x: 10 + Math.random() * 30,
      y: 30 + Math.random() * 30,
      color: textColor,
      fontSize: textFontSize,
      bold: textBold,
      bgColor: textBgColor || null,
    };
    const updated = [
      ...activeSlide.textOverlays,
      textOverlay,
    ];
    updateSlide(activeSlideIndex, { textOverlays: updated });
    setNewText('');
    setShowTextInput(false);
  };

  // Add sticker
  const handleAddSticker = (emoji) => {
    const sticker = {
      id: generateId(),
      type: 'sticker',
      emoji,
      x: 30 + Math.random() * 40,
      y: 30 + Math.random() * 40,
    };
    const updated = [...activeSlide.stickers, sticker];
    updateSlide(activeSlideIndex, { stickers: updated });
    setShowEmojiPicker(false);
  };

  // Move element
  const handleMoveElement = useCallback(
    (elId, pos) => {
      setSlides((prev) =>
        prev.map((s, i) => {
          if (i !== activeSlideIndex) return s;
          return {
            ...s,
            textOverlays: s.textOverlays.map((t) =>
              t.id === elId ? { ...t, ...pos } : t
            ),
            stickers: s.stickers.map((st) =>
              st.id === elId ? { ...st, ...pos } : st
            ),
          };
        })
      );
    },
    [activeSlideIndex]
  );

  // Remove element
  const handleRemoveElement = useCallback(
    (elId) => {
      setSlides((prev) =>
        prev.map((s, i) => {
          if (i !== activeSlideIndex) return s;
          return {
            ...s,
            textOverlays: s.textOverlays.filter((t) => t.id !== elId),
            stickers: s.stickers.filter((st) => st.id !== elId),
          };
        })
      );
      setSelectedElementId(null);
    },
    [activeSlideIndex]
  );

  // Add new slide
  const handleAddSlide = () => {
    const newSlide = createSlide();
    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIndex(slides.length);
  };

  // Remove slide
  const handleRemoveSlide = (index) => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== index));
    if (activeSlideIndex >= index && activeSlideIndex > 0) {
      setActiveSlideIndex(activeSlideIndex - 1);
    }
  };

  // --- Auto Story ---
  const handleAutoStory = () => {
    if (photos.length === 0) return;

    // Pick 3-6 photos with variety across uploaders
    const targetCount = Math.min(Math.max(3, Math.floor(photos.length * 0.5)), 6, photos.length);

    // Group photos by uploader for variety
    const byUploader = {};
    photos.forEach((p) => {
      const uploader = p.uploadedBy || p.userId || 'unknown';
      if (!byUploader[uploader]) byUploader[uploader] = [];
      byUploader[uploader].push(p);
    });

    const uploaders = Object.keys(byUploader);
    const picked = [];
    const pickedIds = new Set();

    // Round-robin across uploaders for variety
    let uploaderIdx = 0;
    let safetyCounter = 0;
    while (picked.length < targetCount && safetyCounter < photos.length * 2) {
      safetyCounter++;
      const uploader = uploaders[uploaderIdx % uploaders.length];
      const available = byUploader[uploader].filter((p) => !pickedIds.has(p._id || p.id));
      if (available.length > 0) {
        const step = Math.max(1, Math.floor(available.length / (targetCount - picked.length + 1)));
        const photo = available[Math.min(step - 1, available.length - 1)];
        const pid = photo._id || photo.id;
        picked.push(photo);
        pickedIds.add(pid);
        byUploader[uploader] = byUploader[uploader].filter((p) => (p._id || p.id) !== pid);
      }
      uploaderIdx++;
    }

    // Fill remaining if needed
    if (picked.length < targetCount) {
      for (const p of photos) {
        if (picked.length >= targetCount) break;
        const pid = p._id || p.id;
        if (!pickedIds.has(pid)) {
          picked.push(p);
          pickedIds.add(pid);
        }
      }
    }

    // Shuffle captions so each slide gets a unique one
    const shuffledCaptions = [...AUTO_CAPTIONS].sort(() => Math.random() - 0.5);

    // Build slides with auto-generated overlays
    const autoSlides = picked.map((photo, idx) => {
      const url = getPhotoUrl(photo);
      const id = photo._id || photo.id;

      // Pick a random caption for this slide
      const caption = shuffledCaptions[idx % shuffledCaptions.length];
      const textOverlay = {
        id: generateId(),
        type: 'text',
        text: caption,
        x: 8 + Math.random() * 20,
        y: 65 + Math.random() * 15,
        color: '#ffffff',
        fontSize: 22 + Math.floor(Math.random() * 6),
        bold: true,
        bgColor: 'rgba(0,0,0,0.45)',
      };

      // Pick 1-2 random emoji stickers
      const stickerCount = 1 + Math.floor(Math.random() * 2);
      const stickers = [];
      const usedEmojis = new Set();
      for (let s = 0; s < stickerCount; s++) {
        let emoji;
        let attempts = 0;
        do {
          emoji = EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)];
          attempts++;
        } while (usedEmojis.has(emoji) && attempts < 10);
        usedEmojis.add(emoji);
        stickers.push({
          id: generateId(),
          type: 'sticker',
          emoji,
          x: 10 + Math.random() * 70,
          y: 5 + Math.random() * 25,
        });
      }

      return {
        id: generateId(),
        photoUrl: url,
        photoId: id,
        textOverlays: [textOverlay],
        stickers,
      };
    });

    setSlides(autoSlides);
    setActiveSlideIndex(0);
    setSelectedElementId(null);
  };

  // --- Download story slides as images ---
  const handleDownloadStory = async () => {
    const validSlides = slides.filter((s) => s.photoUrl);
    if (validSlides.length === 0) return;
    setDownloadingStory(true);

    try {
      for (let i = 0; i < validSlides.length; i++) {
        const slide = validSlides[i];
        const canvas = document.createElement('canvas');
        // 9:16 aspect ratio at reasonable resolution
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');

        // Draw background
        if (slide.photoUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = slide.photoUrl;
          });

          // Cover-fit the image
          const imgRatio = img.naturalWidth / img.naturalHeight;
          const canvasRatio = canvas.width / canvas.height;
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
          if (imgRatio > canvasRatio) {
            sw = img.naturalHeight * canvasRatio;
            sx = (img.naturalWidth - sw) / 2;
          } else {
            sh = img.naturalWidth / canvasRatio;
            sy = (img.naturalHeight - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        } else {
          // Gradient fallback
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          grad.addColorStop(0, '#312e81');
          grad.addColorStop(1, '#581c87');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw text overlays
        for (const t of slide.textOverlays) {
          const px = (t.x / 100) * canvas.width;
          const py = (t.y / 100) * canvas.height;
          const fontSize = (t.fontSize || 24) * (canvas.width / 400);
          const weight = t.bold ? 'bold' : 'normal';

          // Background pill
          if (t.bgColor) {
            ctx.font = `${weight} ${fontSize}px Inter, system-ui, sans-serif`;
            const metrics = ctx.measureText(t.text);
            const padX = fontSize * 0.5;
            const padY = fontSize * 0.2;
            ctx.fillStyle = t.bgColor;
            const radius = fontSize * 0.3;
            const rx = px - padX;
            const ry = py - fontSize * 0.4 - padY;
            const rw = metrics.width + padX * 2;
            const rh = fontSize * 1.2 + padY * 2;
            ctx.beginPath();
            ctx.roundRect(rx, ry, rw, rh, radius);
            ctx.fill();
          }

          ctx.font = `${weight} ${fontSize}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = t.color || '#ffffff';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = fontSize * 0.15;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = fontSize * 0.08;
          ctx.fillText(t.text, px, py);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        // Draw stickers
        for (const st of slide.stickers) {
          const px = (st.x / 100) * canvas.width;
          const py = (st.y / 100) * canvas.height;
          const size = canvas.width / 10;
          ctx.font = `${size}px serif`;
          ctx.textBaseline = 'middle';
          ctx.fillText(st.emoji, px, py);
        }

        // Trigger download
        const link = document.createElement('a');
        link.download = `story_slide_${i + 1}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.92);
        link.click();

        // Small delay between downloads so browser doesn't block them
        if (i < validSlides.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    } catch (err) {
      console.error('Failed to download story:', err);
    } finally {
      setDownloadingStory(false);
    }
  };

  // Save story
  const handleSave = async () => {
    setSaving(true);
    try {
      const storyData = {
        userId,
        userName,
        slides: slides.map((s) => ({
          photoId: s.photoId,
          photoUrl: s.photoUrl,
          textOverlays: s.textOverlays.map((t) => ({
            text: t.text,
            x: t.x,
            y: t.y,
            color: t.color,
            fontSize: t.fontSize,
            bold: t.bold,
            bgColor: t.bgColor,
          })),
          stickers: s.stickers.map((st) => ({
            emoji: st.emoji,
            x: st.x,
            y: st.y,
          })),
        })),
      };

      await createStory(eventId, storyData);

      // Auto-start preview, then navigate back
      setPreviewing(true);
      setPreviewIndex(0);

      setTimeout(() => {
        navigate(`/event/${code}`);
      }, slides.length * STORY_SLIDE_DURATION + 500);
    } catch (err) {
      console.error('Failed to save story:', err);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  // ===== PREVIEW MODE =====
  if (previewing) {
    const previewSlide = slides[previewIndex];
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Progress bars */}
        <div className="flex gap-1 px-2 pt-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/20"
            >
              <div
                className={`h-full bg-white transition-all ${
                  i < previewIndex
                    ? 'w-full'
                    : i === previewIndex
                      ? 'w-full duration-[5000ms] ease-linear'
                      : 'w-0'
                }`}
                style={
                  i === previewIndex
                    ? {
                        animation: `story-progress ${STORY_SLIDE_DURATION}ms linear`,
                      }
                    : {}
                }
              />
            </div>
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={() => {
            setPreviewing(false);
            if (previewTimerRef.current)
              clearInterval(previewTimerRef.current);
          }}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 text-white"
        >
          <X size={20} />
        </button>

        {/* Slide content */}
        <div className="flex-1 relative overflow-hidden">
          {previewSlide?.photoUrl && (
            <img
              src={previewSlide.photoUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {!previewSlide?.photoUrl && (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-purple-900" />
          )}

          {/* Overlays */}
          {previewSlide?.textOverlays?.map((t) => (
            <div
              key={t.id || t.text}
              className="absolute"
              style={{
                left: `${t.x}%`,
                top: `${t.y}%`,
                color: t.color || '#ffffff',
                fontSize: `${t.fontSize || 24}px`,
                fontWeight: t.bold ? 'bold' : 'normal',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                backgroundColor: t.bgColor || 'transparent',
                padding: t.bgColor ? '4px 12px' : '0',
                borderRadius: t.bgColor ? '8px' : '0',
              }}
            >
              {t.text}
            </div>
          ))}
          {previewSlide?.stickers?.map((st) => (
            <div
              key={st.id || st.emoji}
              className="absolute text-3xl sm:text-4xl"
              style={{
                left: `${st.x}%`,
                top: `${st.y}%`,
              }}
            >
              {st.emoji}
            </div>
          ))}
        </div>

        <style>{`
          @keyframes story-progress {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
      </div>
    );
  }

  // ===== EDITOR MODE =====
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <Link
            to={`/event/${code}`}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold text-white">Create Story</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={Play}
            onClick={() => {
              setPreviewing(true);
              setPreviewIndex(0);
            }}
            disabled={slides.every((s) => !s.photoUrl)}
          >
            Preview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Download}
            onClick={handleDownloadStory}
            loading={downloadingStory}
            disabled={slides.every((s) => !s.photoUrl)}
          >
            Download
          </Button>
          <Button
            size="sm"
            icon={Save}
            onClick={handleSave}
            loading={saving}
          >
            Save
          </Button>
        </div>
      </div>

      {/* Auto Story Card */}
      {photos.length > 0 && (
        <div className="px-4 pt-4">
          <button
            onClick={handleAutoStory}
            className="w-full p-5 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 relative overflow-hidden group transition-all hover:shadow-xl hover:shadow-indigo-500/20 active:scale-[0.99]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Sparkles size={24} className="text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="text-lg font-bold text-white">Auto Story</p>
                <p className="text-sm text-white/70">
                  AI picks photos &amp; adds text overlays
                </p>
              </div>
              <ChevronRight size={20} className="text-white/50" />
            </div>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">
              Or create manually
            </span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>
        </div>
      )}

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <div
          ref={containerRef}
          className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-slate-900 border border-slate-800"
          style={{ aspectRatio: '9/16' }}
          onClick={() => setSelectedElementId(null)}
        >
          {/* Background photo */}
          {activeSlide.photoUrl ? (
            <img
              src={activeSlide.photoUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <div className="text-center">
                <ImageIcon
                  size={32}
                  className="mx-auto text-slate-600 mb-2"
                />
                <p className="text-sm text-slate-500">
                  Tap "Add Photo" below
                </p>
              </div>
            </div>
          )}

          {/* Text overlays */}
          {activeSlide.textOverlays.map((t) => (
            <DraggableElement
              key={t.id}
              element={t}
              onMove={handleMoveElement}
              onRemove={handleRemoveElement}
              containerRef={containerRef}
              isSelected={selectedElementId === t.id}
              onSelect={setSelectedElementId}
            />
          ))}

          {/* Stickers */}
          {activeSlide.stickers.map((st) => (
            <DraggableElement
              key={st.id}
              element={st}
              onMove={handleMoveElement}
              onRemove={handleRemoveElement}
              containerRef={containerRef}
              isSelected={selectedElementId === st.id}
              onSelect={setSelectedElementId}
            />
          ))}
        </div>
      </div>

      {/* Slide strip */}
      <div className="px-4 py-3 border-t border-slate-800/50">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 cs-no-scrollbar">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => setActiveSlideIndex(i)}
              className={`
                relative flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden border-2 transition-all
                ${
                  i === activeSlideIndex
                    ? 'border-indigo-500'
                    : 'border-slate-700 hover:border-slate-600'
                }
              `}
            >
              {slide.photoUrl ? (
                <img
                  src={slide.photoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <span className="text-xs text-slate-500">
                    {i + 1}
                  </span>
                </div>
              )}
              {slides.length > 1 && i === activeSlideIndex && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSlide(i);
                  }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                >
                  <X size={10} />
                </button>
              )}
            </button>
          ))}

          {/* Add slide button */}
          <button
            onClick={handleAddSlide}
            className="flex-shrink-0 w-14 h-20 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-400 hover:border-slate-600 transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="px-4 py-3 border-t border-slate-800/50 safe-bottom">
        <div className="flex justify-center gap-3">
          <button
            onClick={() => setShowPhotoPicker(true)}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <ImageIcon size={20} className="text-indigo-400" />
            <span className="text-xs text-slate-400">Photo</span>
          </button>
          <button
            onClick={() => {
              setNewText('');
              setShowTextInput(true);
            }}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <Type size={20} className="text-purple-400" />
            <span className="text-xs text-slate-400">Text</span>
          </button>
          <button
            onClick={() => setShowEmojiPicker(true)}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <Smile size={20} className="text-amber-400" />
            <span className="text-xs text-slate-400">Sticker</span>
          </button>
        </div>
      </div>

      {/* ===== PHOTO PICKER MODAL ===== */}
      <Modal
        open={showPhotoPicker}
        onClose={() => setShowPhotoPicker(false)}
        title="Select Photo"
      >
        {photos.length === 0 ? (
          <div className="text-center py-8">
            <ImageIcon
              size={28}
              className="mx-auto text-slate-600 mb-2"
            />
            <p className="text-sm text-slate-500">
              No photos available
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-[50vh] overflow-y-auto mt-2">
            {photos.map((photo) => (
              <button
                key={photo._id || photo.id}
                onClick={() => handleSelectPhoto(photo)}
                className="aspect-square rounded-lg overflow-hidden bg-slate-800 hover:ring-2 hover:ring-indigo-500 transition-all"
              >
                <img
                  src={getThumbUrl(photo)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* ===== TEXT INPUT MODAL ===== */}
      <Modal
        open={showTextInput}
        onClose={() => setShowTextInput(false)}
        title="Add Text"
      >
        <div className="space-y-4 mt-2">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
            placeholder="Type your text..."
            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-lg"
            autoFocus
          />

          {/* Preview */}
          {newText && (
            <div className="p-4 rounded-xl bg-slate-800/50 flex justify-center">
              <span
                style={{
                  color: textColor,
                  fontSize: `${textFontSize}px`,
                  fontWeight: textBold ? 'bold' : 'normal',
                  backgroundColor: textBgColor || 'transparent',
                  padding: textBgColor ? '4px 12px' : '0',
                  borderRadius: textBgColor ? '8px' : '0',
                }}
              >
                {newText}
              </span>
            </div>
          )}

          {/* Color picker */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">
              Text Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setTextColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    textColor === c
                      ? 'border-indigo-400 scale-110'
                      : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Size slider */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">
              Font Size: {textFontSize}px
            </label>
            <input
              type="range"
              min={14}
              max={48}
              value={textFontSize}
              onChange={(e) =>
                setTextFontSize(parseInt(e.target.value))
              }
              className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Bold + BG toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setTextBold(!textBold)}
              className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-1.5 transition-all ${
                textBold
                  ? 'border-indigo-500 bg-indigo-500/10 text-white'
                  : 'border-slate-700 text-slate-400'
              }`}
            >
              <Bold size={14} />
              Bold
            </button>
            <button
              onClick={() =>
                setTextBgColor(textBgColor ? '' : 'rgba(0,0,0,0.5)')
              }
              className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-1.5 transition-all ${
                textBgColor
                  ? 'border-indigo-500 bg-indigo-500/10 text-white'
                  : 'border-slate-700 text-slate-400'
              }`}
            >
              <Palette size={14} />
              Background
            </button>
          </div>

          <Button
            fullWidth
            onClick={handleAddText}
            disabled={!newText.trim()}
          >
            Add Text
          </Button>
        </div>
      </Modal>

      {/* ===== EMOJI PICKER MODAL ===== */}
      <Modal
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        title="Add Sticker"
      >
        <div className="grid grid-cols-8 gap-2 mt-2">
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleAddSticker(emoji)}
              className="text-2xl p-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </Modal>

      <style>{`
        .cs-no-scrollbar::-webkit-scrollbar { display: none; }
        .cs-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
