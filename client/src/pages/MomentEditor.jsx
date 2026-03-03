import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Save,
  Plus,
  X,
  Type,
  Smile,
  Bold,
  Italic,
  Underline,
  Move,
  Trash2,
  Check,
  ChevronDown,
  Palette,
  RotateCcw,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { getEvent, getPhotos, uploadPhotos } from '../utils/api';
import { useUser } from '../context/UserContext';

// --- Filter presets ---
const PHOTO_FILTERS = [
  { key: 'original', label: 'Original', css: 'none' },
  { key: 'bw', label: 'B&W', css: 'grayscale(100%) contrast(1.1)' },
  { key: 'vintage', label: 'Vintage', css: 'sepia(0.6) contrast(1.05) brightness(0.95) saturate(0.8)' },
  { key: 'vibrant', label: 'Vibrant', css: 'saturate(1.6) contrast(1.1) brightness(1.05)' },
];

// --- Font options ---
const FONTS = [
  { key: 'sans', label: 'Sans', family: 'Inter, system-ui, sans-serif' },
  { key: 'serif', label: 'Serif', family: 'Georgia, Times New Roman, serif' },
  { key: 'mono', label: 'Mono', family: 'ui-monospace, monospace' },
  { key: 'cursive', label: 'Script', family: 'Segoe Script, cursive' },
  { key: 'display', label: 'Display', family: 'Impact, Arial Black, sans-serif' },
];

const FONT_SIZES = [14, 18, 24, 32, 42, 56, 72];

const COLORS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f43f5e', '#6366f1', '#d946ef', '#0ea5e9',
];

const EMOJI_LIST = [
  '😍', '🥰', '😂', '🤣', '❤️', '🔥', '✨', '🎉', '🎊', '💕',
  '🥳', '😎', '💖', '🌟', '👏', '🙌', '💯', '🫶', '😘', '💐',
  '🎂', '🍾', '🥂', '📸', '🌈', '⭐', '💝', '🎵', '💃', '🕺',
  '👑', '🦋', '🌸', '🌺', '🍀', '💎', '🎈', '🎁', '🏆', '💪',
];

let overlayIdCounter = 0;

export default function MomentEditor() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userId, userName } = useUser();

  const photoIndex = parseInt(searchParams.get('photo') || '0', 10);
  const initialFilter = searchParams.get('filter') || 'original';

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(photoIndex);
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [error, setError] = useState('');

  // Overlays: array of { id, type: 'text'|'emoji', x, y, ...props }
  const [overlays, setOverlays] = useState([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);
  const [activePanel, setActivePanel] = useState(null); // 'text' | 'emoji' | 'format' | 'filter' | null

  // Text editing form state
  const [textInput, setTextInput] = useState('');
  const [textFont, setTextFont] = useState('sans');
  const [textSize, setTextSize] = useState(32);
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textUnderline, setTextUnderline] = useState(false);
  const [textShadow, setTextShadow] = useState(true);

  // Drag state
  const [dragging, setDragging] = useState(null);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  // Canvas/image area ref
  const imageAreaRef = useRef(null);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const eventId = event?._id || event?.id || code;
  const currentFilter = PHOTO_FILTERS.find((f) => f.key === activeFilter) || PHOTO_FILTERS[0];

  // --- Load data ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const eventRes = await getEvent(code);
        const evt = eventRes.event || eventRes;
        if (cancelled) return;
        setEvent(evt);
        const eid = evt._id || evt.id || code;
        const photosData = await getPhotos(eid).catch(() => ({ photos: [] }));
        if (cancelled) return;
        const list = Array.isArray(photosData) ? photosData : photosData.photos || [];
        setPhotos(list);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [code]);

  const getPhotoUrl = useCallback((photo, thumb = false) => {
    const uidParam = `?uid=${encodeURIComponent(userId)}`;
    const eid = eventId;
    if (thumb && photo.thumbnail) return `/uploads/${eid}/${photo.thumbnail}${uidParam}`;
    if (photo.url) return photo.url;
    return `/uploads/${eid}/${photo.filename || photo.file}${uidParam}`;
  }, [userId, eventId]);

  const currentPhoto = photos[currentPhotoIdx];

  // --- Add text overlay ---
  const handleAddText = () => {
    if (!textInput.trim()) return;
    const id = ++overlayIdCounter;
    const fontObj = FONTS.find((f) => f.key === textFont) || FONTS[0];
    setOverlays((prev) => [
      ...prev,
      {
        id,
        type: 'text',
        text: textInput.trim(),
        x: 50,
        y: 50,
        fontFamily: fontObj.family,
        fontKey: textFont,
        fontSize: textSize,
        color: textColor,
        bold: textBold,
        italic: textItalic,
        underline: textUnderline,
        shadow: textShadow,
      },
    ]);
    setTextInput('');
    setSelectedOverlayId(id);
    setActivePanel(null);
  };

  // --- Add emoji overlay ---
  const handleAddEmoji = (emoji) => {
    const id = ++overlayIdCounter;
    setOverlays((prev) => [
      ...prev,
      {
        id,
        type: 'emoji',
        text: emoji,
        x: 50,
        y: 50,
        fontSize: 48,
      },
    ]);
    setSelectedOverlayId(id);
  };

  // --- Delete overlay ---
  const handleDeleteOverlay = (id) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  };

  // --- Update selected overlay formatting ---
  const updateSelectedOverlay = (updates) => {
    if (!selectedOverlayId) return;
    setOverlays((prev) =>
      prev.map((o) => (o.id === selectedOverlayId ? { ...o, ...updates } : o))
    );
  };

  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId);

  // --- Load format state from selected overlay ---
  useEffect(() => {
    if (selectedOverlay && selectedOverlay.type === 'text') {
      setTextFont(selectedOverlay.fontKey || 'sans');
      setTextSize(selectedOverlay.fontSize || 32);
      setTextColor(selectedOverlay.color || '#ffffff');
      setTextBold(selectedOverlay.bold || false);
      setTextItalic(selectedOverlay.italic || false);
      setTextUnderline(selectedOverlay.underline || false);
      setTextShadow(selectedOverlay.shadow !== false);
    }
  }, [selectedOverlayId]);

  // --- Drag handling ---
  const getRelativePos = (clientX, clientY) => {
    const rect = imageAreaRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleOverlayPointerDown = (e, overlay) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedOverlayId(overlay.id);
    setDragging(overlay.id);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY, ox: overlay.x, oy: overlay.y };
  };

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = imageAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    const dx = ((clientX - dragStartRef.current.x) / rect.width) * 100;
    const dy = ((clientY - dragStartRef.current.y) / rect.height) * 100;
    const nx = Math.max(0, Math.min(100, dragStartRef.current.ox + dx));
    const ny = Math.max(0, Math.min(100, dragStartRef.current.oy + dy));

    setOverlays((prev) =>
      prev.map((o) => (o.id === dragging ? { ...o, x: nx, y: ny } : o))
    );
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
      return () => {
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('mouseup', handlePointerUp);
        window.removeEventListener('touchmove', handlePointerMove);
        window.removeEventListener('touchend', handlePointerUp);
      };
    }
  }, [dragging, handlePointerMove, handlePointerUp]);

  // --- Render canvas with overlays baked in ---
  const renderCanvas = async () => {
    if (!currentPhoto) return null;
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = getPhotoUrl(currentPhoto);
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');

    // Draw filtered image
    ctx.filter = currentFilter.css;
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';

    const scaleX = img.naturalWidth / 100;
    const scaleY = img.naturalHeight / 100;

    // Draw overlays
    for (const overlay of overlays) {
      const px = overlay.x * scaleX;
      const py = overlay.y * scaleY;

      if (overlay.type === 'emoji') {
        const size = overlay.fontSize * (img.naturalWidth / 400);
        ctx.font = `${size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(overlay.text, px, py);
      } else if (overlay.type === 'text') {
        const size = overlay.fontSize * (img.naturalWidth / 400);
        const weight = overlay.bold ? 'bold' : 'normal';
        const style = overlay.italic ? 'italic' : 'normal';
        ctx.font = `${style} ${weight} ${size}px ${overlay.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (overlay.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = size * 0.15;
          ctx.shadowOffsetX = size * 0.04;
          ctx.shadowOffsetY = size * 0.04;
        }

        ctx.fillStyle = overlay.color;
        ctx.fillText(overlay.text, px, py);

        if (overlay.underline) {
          const metrics = ctx.measureText(overlay.text);
          const lineY = py + size * 0.35;
          ctx.strokeStyle = overlay.color;
          ctx.lineWidth = Math.max(1, size * 0.06);
          ctx.beginPath();
          ctx.moveTo(px - metrics.width / 2, lineY);
          ctx.lineTo(px + metrics.width / 2, lineY);
          ctx.stroke();
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    }

    return canvas;
  };

  // --- Save to event gallery (upload to server) ---
  const handleSave = async () => {
    if (!currentPhoto) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const canvas = await renderCanvas();
      if (!canvas) throw new Error('Failed to render');

      // Convert canvas to blob
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92)
      );

      const filename = `moment_${Date.now()}_${currentPhoto.filename || 'photo'}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('userName', userName || 'Anonymous');
      formData.append('photos', file);

      await uploadPhotos(eventId, formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError('Failed to save moment to gallery');
    } finally {
      setSaving(false);
    }
  };

  // --- Download to device ---
  const handleDownload = async () => {
    if (!currentPhoto) return;
    setDownloading(true);
    try {
      const canvas = await renderCanvas();
      if (!canvas) throw new Error('Failed to render');

      const link = document.createElement('a');
      link.download = `moment_${currentPhoto.filename || currentPhoto.file || 'photo'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.92);
      link.click();
    } catch {
      setError('Failed to download moment');
    } finally {
      setDownloading(false);
    }
  };

  // --- Clear all overlays ---
  const handleClearAll = () => {
    setOverlays([]);
    setSelectedOverlayId(null);
  };

  // --- Click on image area to deselect ---
  const handleImageAreaClick = (e) => {
    if (e.target === imageAreaRef.current || e.target.tagName === 'IMG') {
      setSelectedOverlayId(null);
    }
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!currentPhoto) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-slate-400 mb-4">No photo selected</p>
        <Button variant="secondary" onClick={() => navigate(`/event/${code}`)}>
          Back to Event
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col z-50 select-none">
      {/* ===== TOP BAR ===== */}
      <header className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800/50 flex-shrink-0">
        <button
          onClick={() => navigate(`/event/${code}`)}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <p className="text-sm font-medium text-slate-300">Edit Moment</p>
        <div className="flex items-center gap-1">
          {overlays.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
              title="Clear all overlays"
            >
              <RotateCcw size={18} />
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Download to device"
          >
            {downloading ? <Spinner size={16} /> : <Download size={18} />}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${
              saveSuccess ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {saving ? <Spinner size={14} /> : saveSuccess ? <Check size={16} /> : <Save size={16} />}
            {saveSuccess ? 'Saved!' : 'Save'}
          </button>
        </div>
      </header>

      {/* ===== IMAGE AREA ===== */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center bg-black"
        ref={imageAreaRef}
        onClick={handleImageAreaClick}
      >
        <img
          src={getPhotoUrl(currentPhoto)}
          alt=""
          className="max-w-full max-h-full object-contain"
          style={{ filter: currentFilter.css }}
          draggable={false}
        />

        {/* Overlays */}
        {overlays.map((overlay) => {
          const isSelected = selectedOverlayId === overlay.id;
          const style = {
            position: 'absolute',
            left: `${overlay.x}%`,
            top: `${overlay.y}%`,
            transform: 'translate(-50%, -50%)',
            cursor: dragging === overlay.id ? 'grabbing' : 'grab',
            zIndex: isSelected ? 20 : 10,
            touchAction: 'none',
            userSelect: 'none',
          };

          if (overlay.type === 'emoji') {
            return (
              <div
                key={overlay.id}
                style={{ ...style, fontSize: overlay.fontSize }}
                className={`${isSelected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-black/50 rounded-lg' : ''}`}
                onMouseDown={(e) => handleOverlayPointerDown(e, overlay)}
                onTouchStart={(e) => handleOverlayPointerDown(e, overlay)}
              >
                <span className="leading-none">{overlay.text}</span>
                {isSelected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteOverlay(overlay.id); }}
                    className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          }

          // text overlay
          const fontObj = FONTS.find((f) => f.key === overlay.fontKey) || FONTS[0];
          return (
            <div
              key={overlay.id}
              style={{
                ...style,
                fontFamily: overlay.fontFamily || fontObj.family,
                fontSize: overlay.fontSize,
                color: overlay.color,
                fontWeight: overlay.bold ? 'bold' : 'normal',
                fontStyle: overlay.italic ? 'italic' : 'normal',
                textDecoration: overlay.underline ? 'underline' : 'none',
                textShadow: overlay.shadow ? '2px 2px 6px rgba(0,0,0,0.7)' : 'none',
                whiteSpace: 'nowrap',
              }}
              className={`${isSelected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-black/50 rounded px-1' : ''}`}
              onMouseDown={(e) => handleOverlayPointerDown(e, overlay)}
              onTouchStart={(e) => handleOverlayPointerDown(e, overlay)}
            >
              {overlay.text}
              {isSelected && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteOverlay(overlay.id); }}
                  className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== BOTTOM TOOLBAR ===== */}
      <div className="flex-shrink-0 bg-slate-900/95 border-t border-slate-800/50">
        {/* Toolbar buttons */}
        <div className="flex items-center justify-center gap-1 px-3 py-2 border-b border-slate-800/30">
          <button
            onClick={() => setActivePanel(activePanel === 'text' ? null : 'text')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${activePanel === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Type size={18} />
            <span className="text-[10px]">Text</span>
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'emoji' ? null : 'emoji')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${activePanel === 'emoji' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Smile size={18} />
            <span className="text-[10px]">Emoji</span>
          </button>
          {selectedOverlay && selectedOverlay.type === 'text' && (
            <button
              onClick={() => setActivePanel(activePanel === 'format' ? null : 'format')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${activePanel === 'format' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Bold size={18} />
              <span className="text-[10px]">Format</span>
            </button>
          )}
          <button
            onClick={() => setActivePanel(activePanel === 'filter' ? null : 'filter')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${activePanel === 'filter' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Palette size={18} />
            <span className="text-[10px]">Filter</span>
          </button>
        </div>

        {/* ===== PANELS ===== */}
        <div className="max-h-[280px] overflow-y-auto">
          {/* --- TEXT PANEL --- */}
          {activePanel === 'text' && (
            <div className="p-3 space-y-3 me-animate-in">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
                  placeholder="Type your text..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  autoFocus
                />
                <Button size="sm" icon={Plus} onClick={handleAddText} disabled={!textInput.trim()}>
                  Add
                </Button>
              </div>

              {/* Font family */}
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Font</p>
                <div className="flex gap-1.5 overflow-x-auto er-no-scrollbar pb-1">
                  {FONTS.map((font) => (
                    <button
                      key={font.key}
                      onClick={() => {
                        setTextFont(font.key);
                        if (selectedOverlay?.type === 'text') {
                          updateSelectedOverlay({ fontKey: font.key, fontFamily: font.family });
                        }
                      }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${textFont === font.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                      style={{ fontFamily: font.family }}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Size</p>
                <div className="flex gap-1.5 overflow-x-auto er-no-scrollbar pb-1">
                  {FONT_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setTextSize(size);
                        if (selectedOverlay?.type === 'text') {
                          updateSelectedOverlay({ fontSize: size });
                        }
                      }}
                      className={`flex-shrink-0 w-9 h-9 rounded-lg text-xs font-medium transition-colors ${textSize === size ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Color</p>
                <div className="flex gap-1.5 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setTextColor(color);
                        if (selectedOverlay?.type === 'text') {
                          updateSelectedOverlay({ color });
                        }
                      }}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${textColor === color ? 'border-white scale-110' : 'border-slate-600 hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Style toggles */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setTextBold(!textBold);
                    if (selectedOverlay?.type === 'text') {
                      updateSelectedOverlay({ bold: !selectedOverlay.bold });
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${textBold ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <Bold size={14} /> Bold
                </button>
                <button
                  onClick={() => {
                    setTextItalic(!textItalic);
                    if (selectedOverlay?.type === 'text') {
                      updateSelectedOverlay({ italic: !selectedOverlay.italic });
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${textItalic ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <Italic size={14} /> Italic
                </button>
                <button
                  onClick={() => {
                    setTextUnderline(!textUnderline);
                    if (selectedOverlay?.type === 'text') {
                      updateSelectedOverlay({ underline: !selectedOverlay.underline });
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${textUnderline ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <Underline size={14} /> Underline
                </button>
                <button
                  onClick={() => {
                    setTextShadow(!textShadow);
                    if (selectedOverlay?.type === 'text') {
                      updateSelectedOverlay({ shadow: !selectedOverlay.shadow });
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${textShadow ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  Shadow
                </button>
              </div>
            </div>
          )}

          {/* --- EMOJI PANEL --- */}
          {activePanel === 'emoji' && (
            <div className="p-3 me-animate-in">
              <div className="grid grid-cols-8 gap-2">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleAddEmoji(emoji)}
                    className="w-10 h-10 flex items-center justify-center text-2xl rounded-lg hover:bg-slate-800 transition-colors active:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* --- FORMAT PANEL (for selected text) --- */}
          {activePanel === 'format' && selectedOverlay?.type === 'text' && (
            <div className="p-3 space-y-3 me-animate-in">
              <p className="text-xs text-slate-400">
                Editing: <span className="text-white font-medium">"{selectedOverlay.text}"</span>
              </p>

              {/* Font family */}
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Font</p>
                <div className="flex gap-1.5 overflow-x-auto er-no-scrollbar pb-1">
                  {FONTS.map((font) => (
                    <button
                      key={font.key}
                      onClick={() => updateSelectedOverlay({ fontKey: font.key, fontFamily: font.family })}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${selectedOverlay.fontKey === font.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                      style={{ fontFamily: font.family }}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Size</p>
                <div className="flex gap-1.5 overflow-x-auto er-no-scrollbar pb-1">
                  {FONT_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSelectedOverlay({ fontSize: size })}
                      className={`flex-shrink-0 w-9 h-9 rounded-lg text-xs font-medium transition-colors ${selectedOverlay.fontSize === size ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Color</p>
                <div className="flex gap-1.5 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateSelectedOverlay({ color })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${selectedOverlay.color === color ? 'border-white scale-110' : 'border-slate-600 hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Style toggles */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => updateSelectedOverlay({ bold: !selectedOverlay.bold })}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedOverlay.bold ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <Bold size={14} /> Bold
                </button>
                <button
                  onClick={() => updateSelectedOverlay({ italic: !selectedOverlay.italic })}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedOverlay.italic ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <Italic size={14} /> Italic
                </button>
                <button
                  onClick={() => updateSelectedOverlay({ underline: !selectedOverlay.underline })}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedOverlay.underline ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <Underline size={14} /> Underline
                </button>
                <button
                  onClick={() => updateSelectedOverlay({ shadow: !selectedOverlay.shadow })}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedOverlay.shadow ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  Shadow
                </button>
              </div>
            </div>
          )}

          {/* --- FILTER PANEL --- */}
          {activePanel === 'filter' && (
            <div className="p-3 me-animate-in">
              <div className="flex gap-3 justify-center overflow-x-auto er-no-scrollbar">
                {PHOTO_FILTERS.map((filter) => {
                  const isActive = activeFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      onClick={() => setActiveFilter(filter.key)}
                      className={`flex flex-col items-center gap-1 flex-shrink-0 transition-all duration-200
                        ${isActive ? 'opacity-100 scale-105' : 'opacity-60 hover:opacity-80'}
                      `}
                    >
                      <div className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors
                        ${isActive ? 'border-indigo-400' : 'border-transparent'}
                      `}>
                        <img
                          src={getPhotoUrl(currentPhoto, true)}
                          alt=""
                          className="w-full h-full object-cover"
                          style={{ filter: filter.css }}
                        />
                      </div>
                      <span className={`text-[11px] ${isActive ? 'text-white font-medium' : 'text-slate-500'}`}>
                        {filter.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-lg mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Success toast */}
      {saveSuccess && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-lg mx-auto">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
            <Check size={16} className="text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-400">Moment saved to event gallery</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes me-slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .me-animate-in { animation: me-slide-in 0.2s ease-out; }
        .er-no-scrollbar::-webkit-scrollbar { display: none; }
        .er-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
