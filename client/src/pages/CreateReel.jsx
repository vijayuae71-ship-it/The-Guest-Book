import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Play,
  Pause,
  Download,
  ChevronRight,
  ChevronLeft,
  Film,
  Layers,
  Settings,
  Wand2,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Pencil,
  Images,
  Music,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { getEvent, getPhotos } from '../utils/api';
import { useUser } from '../context/UserContext';
import ReelGenerator from '../utils/reelGenerator';
import MusicGenerator from '../utils/musicGenerator';

const TRANSITIONS = [
  {
    key: 'fade',
    label: 'Fade',
    desc: 'Smooth crossfade',
    color: 'from-indigo-500 to-blue-500',
  },
  {
    key: 'slide',
    label: 'Slide',
    desc: 'Horizontal slide',
    color: 'from-purple-500 to-pink-500',
  },
  {
    key: 'zoom',
    label: 'Zoom',
    desc: 'Zoom & fade',
    color: 'from-amber-500 to-orange-500',
  },
  {
    key: 'kenburns',
    label: 'Ken Burns',
    desc: 'Pan & zoom',
    color: 'from-emerald-500 to-teal-500',
  },
];

const ASPECT_RATIOS = [
  { key: '9:16', label: 'Portrait', w: 1080, h: 1920 },
  { key: '1:1', label: 'Square', w: 1080, h: 1080 },
  { key: '16:9', label: 'Landscape', w: 1920, h: 1080 },
];

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 20;

export default function CreateReel() {
  const { code } = useParams();
  const { userId } = useUser();

  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Step control
  const [step, setStep] = useState(1);

  // Step 1: Photo selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Step 2: Settings
  const [transition, setTransition] = useState('fade');
  const [duration, setDuration] = useState(3);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [musicStyle, setMusicStyle] = useState('none');

  // Music preview
  const [musicStyles, setMusicStyles] = useState([]);
  const [previewingStyle, setPreviewingStyle] = useState(null);
  const [previewPlaying, setPreviewPlaying] = useState(null);
  const audioCtxRef = useRef(null);
  const previewSourceRef = useRef(null);
  const previewBlobUrlRef = useRef(null);

  // Step 3: Generation
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null);
  const [genError, setGenError] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [playing, setPlaying] = useState(false);

  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  const eventId = event?._id || event?.id || code;

  // Load event and photos
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

  // Load music styles
  useEffect(() => {
    const styles = MusicGenerator.getStyles();
    setMusicStyles(styles);
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopMusicPreview();
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
      }
    };
  }, []);

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

  const togglePhoto = (photo) => {
    const id = photo._id || photo.id;
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_PHOTOS) return prev;
      return [...prev, id];
    });
  };

  const getSelectedPhotos = useCallback(() => {
    return selectedIds
      .map((id) => photos.find((p) => (p._id || p.id) === id))
      .filter(Boolean);
  }, [selectedIds, photos]);

  const getSelectionOrder = (photo) => {
    const id = photo._id || photo.id;
    const idx = selectedIds.indexOf(id);
    return idx >= 0 ? idx + 1 : 0;
  };

  // --- Music preview ---
  function getAudioContext() {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }

  function stopMusicPreview() {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch {
        // ignore
      }
      previewSourceRef.current = null;
    }
    setPreviewPlaying(null);
  }

  async function handleMusicPreview(styleKey) {
    // If already playing this style, stop it
    if (previewPlaying === styleKey) {
      stopMusicPreview();
      return;
    }

    stopMusicPreview();
    setPreviewingStyle(styleKey);

    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const gen = new MusicGenerator(ctx);
      const wavBlob = await gen.getTrackBlob(styleKey, 5);
      const arrayBuffer = await wavBlob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (previewSourceRef.current === source) {
          setPreviewPlaying(null);
          previewSourceRef.current = null;
        }
      };
      source.start(0);
      previewSourceRef.current = source;
      setPreviewPlaying(styleKey);
    } catch (err) {
      console.error('Music preview failed:', err);
    } finally {
      setPreviewingStyle(null);
    }
  }

  // --- Auto Reel ---
  const handleAutoReel = () => {
    if (photos.length < MIN_PHOTOS) return;

    // Pick 5-8 photos with variety
    const targetCount = Math.min(Math.max(5, Math.floor(photos.length * 0.4)), 8, photos.length);

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
        // Pick a photo spread across time (take from different positions in the array)
        const step = Math.max(1, Math.floor(available.length / (targetCount - picked.length + 1)));
        const photo = available[Math.min(step - 1, available.length - 1)];
        const pid = photo._id || photo.id;
        picked.push(photo);
        pickedIds.add(pid);
        // Remove from pool
        byUploader[uploader] = byUploader[uploader].filter((p) => (p._id || p.id) !== pid);
      }
      uploaderIdx++;
    }

    // If we still need more, fill from remaining photos
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

    setSelectedIds(picked.map((p) => p._id || p.id));

    // Random transition (not 'fade' always to keep it interesting)
    const randomTransition = TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)].key;
    setTransition(randomTransition);

    // Random music style (not 'none')
    const musicOptions = musicStyles.filter((s) => s.key !== 'none');
    if (musicOptions.length > 0) {
      const randomMusic = musicOptions[Math.floor(Math.random() * musicOptions.length)].key;
      setMusicStyle(randomMusic);
    }

    setDuration(3);
    setAspectRatio('9:16');

    // Jump to step 3
    setStep(3);
  };

  // --- Generate ---
  const handleGenerate = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = ASPECT_RATIOS.find((r) => r.key === aspectRatio);
    const selectedPhotos = getSelectedPhotos();
    const urls = selectedPhotos.map((p) => getPhotoUrl(p));

    // Calculate total reel duration
    const totalDurationMs =
      selectedPhotos.length * (duration * 1000) +
      (selectedPhotos.length - 1) * 500;
    const totalDurationSec = totalDurationMs / 1000;

    setGenerating(true);
    setGenProgress({ phase: 'loading', progress: 0 });
    setGenError('');
    setVideoUrl(null);

    try {
      let musicBlob = null;

      // Generate music if a style is selected
      if (musicStyle !== 'none') {
        setGenProgress({
          phase: 'music',
          progress: 0,
          detail: `Generating ${musicStyles.find((s) => s.key === musicStyle)?.label || musicStyle} music...`,
        });

        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const musicGen = new MusicGenerator(ctx);
        musicBlob = await musicGen.getTrackBlob(musicStyle, totalDurationSec);

        setGenProgress({
          phase: 'music',
          progress: 100,
          detail: 'Music ready',
        });
      }

      const generator = new ReelGenerator(canvas, {
        fps: 30,
        photoDuration: duration * 1000,
        transitionDuration: 500,
        transition,
        width: ratio?.w || 1080,
        height: ratio?.h || 1920,
        musicBlob,
      });

      setGenProgress({ phase: 'loading', progress: 0 });

      const blobUrl = await generator.generate(urls, (prog) => {
        setGenProgress(prog);
      });
      setVideoUrl(blobUrl);
    } catch (err) {
      console.error('Reel generation failed:', err);
      setGenError(err.message || 'Reel generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `reel-${code}-${Date.now()}.webm`;
    a.click();
  };

  const handleEditSettings = () => {
    setStep(2);
  };

  const handleChangePhotos = () => {
    setStep(1);
  };

  const handleRegenerate = () => {
    setVideoUrl(null);
    setGenProgress(null);
    setPlaying(false);
  };

  const handleStepClick = (s) => {
    // Allow clicking any step that has been completed (less than current)
    // or is the current step
    if (s <= step) {
      // If navigating away from generated state, keep video url for later
      setStep(s);
    }
  };

  // Get the progress label text
  const getProgressLabel = () => {
    if (!genProgress) return '';
    if (genProgress.phase === 'music') {
      return genProgress.detail || 'Generating music...';
    }
    if (genProgress.phase === 'loading') {
      return genProgress.detail || 'Loading photos...';
    }
    if (genProgress.phase === 'generating') {
      const musicLabel = musicStyle !== 'none'
        ? ` with ${musicStyles.find((s) => s.key === musicStyle)?.label || musicStyle} music`
        : '';
      return `Generating reel${musicLabel}... ${genProgress.progress}%`;
    }
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to={`/event/${code}`}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Create Reel</h1>
            <p className="text-xs text-slate-500">
              {event?.name || 'Event'}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { num: 1, label: 'Photos' },
            { num: 2, label: 'Settings' },
            { num: 3, label: 'Generate' },
          ].map(({ num: s, label }) => (
            <React.Fragment key={s}>
              <button
                onClick={() => handleStepClick(s)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
                  ${s <= step ? 'cursor-pointer' : 'cursor-default'}
                  ${
                    s === step
                      ? 'bg-indigo-500 text-white'
                      : s < step
                        ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                        : 'bg-slate-800 text-slate-500'
                  }
                `}
              >
                {s < step ? (
                  <Check size={14} />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs">
                    {s}
                  </span>
                )}
                <span className="hidden sm:inline">{label}</span>
              </button>
              {s < 3 && (
                <div
                  className={`flex-1 h-0.5 rounded ${
                    s < step ? 'bg-indigo-500/40' : 'bg-slate-800'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ===== STEP 1: SELECT PHOTOS ===== */}
        {step === 1 && (
          <div>
            {/* Auto Reel Card */}
            {photos.length >= MIN_PHOTOS && (
              <button
                onClick={handleAutoReel}
                className="w-full mb-5 p-5 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 relative overflow-hidden group transition-all hover:shadow-xl hover:shadow-indigo-500/20 active:scale-[0.99]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-lg font-bold text-white">Auto Reel</p>
                    <p className="text-sm text-white/70">
                      AI picks the best photos & settings
                    </p>
                  </div>
                  <ChevronRight size={20} className="text-white/50" />
                </div>
              </button>
            )}

            {/* Divider */}
            {photos.length >= MIN_PHOTOS && (
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  Or select manually
                </span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <Layers size={18} className="text-indigo-400" />
              <h2 className="text-base font-semibold text-white">
                Select Photos
              </h2>
              <span className="ml-auto text-sm text-slate-400">
                {selectedIds.length}/{MAX_PHOTOS}
              </span>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-16">
                <Film
                  size={32}
                  className="mx-auto text-slate-700 mb-3"
                />
                <p className="text-sm text-slate-500">
                  No photos available
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 mb-6">
                {photos.map((photo) => {
                  const order = getSelectionOrder(photo);
                  const isSelected = order > 0;
                  return (
                    <button
                      key={photo._id || photo.id}
                      onClick={() => togglePhoto(photo)}
                      className={`
                        relative aspect-square overflow-hidden rounded-lg
                        ${
                          isSelected
                            ? 'ring-2 ring-indigo-500'
                            : 'ring-1 ring-slate-800'
                        }
                      `}
                    >
                      <img
                        src={getThumbUrl(photo)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-indigo-500/20">
                          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                            {order}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              fullWidth
              size="lg"
              disabled={selectedIds.length < MIN_PHOTOS}
              onClick={() => setStep(2)}
              icon={ChevronRight}
            >
              Next ({selectedIds.length} selected)
            </Button>
          </div>
        )}

        {/* ===== STEP 2: SETTINGS ===== */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Settings size={18} className="text-indigo-400" />
              <h2 className="text-base font-semibold text-white">
                Settings
              </h2>
            </div>

            {/* Transition picker */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Transition Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TRANSITIONS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTransition(t.key)}
                    className={`
                      p-3 rounded-xl border text-left transition-all
                      ${
                        transition === t.key
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                      }
                    `}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${t.color} mb-2 flex items-center justify-center`}
                    >
                      <Wand2 size={14} className="text-white" />
                    </div>
                    <p className="text-sm font-medium text-white">
                      {t.label}
                    </p>
                    <p className="text-xs text-slate-500">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Background Music picker */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                <span className="flex items-center gap-2">
                  <Music size={14} className="text-indigo-400" />
                  Background Music
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {musicStyles.map((style) => {
                  const isSelected = musicStyle === style.key;
                  const isPreviewing = previewingStyle === style.key;
                  const isPlayingThis = previewPlaying === style.key;

                  return (
                    <div
                      key={style.key}
                      className={`
                        relative p-3 rounded-xl border text-left transition-all cursor-pointer
                        ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                        }
                      `}
                      onClick={() => setMusicStyle(style.key)}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg leading-none">{style.emoji}</span>
                            <p className="text-sm font-medium text-white truncate">
                              {style.label}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {style.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </div>

                      {/* Preview button - only show for non-none styles */}
                      {style.key !== 'none' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMusicPreview(style.key);
                          }}
                          disabled={isPreviewing}
                          className={`
                            mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all
                            ${
                              isPlayingThis
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                            }
                          `}
                        >
                          {isPreviewing ? (
                            <Spinner size={12} />
                          ) : isPlayingThis ? (
                            <Volume2 size={12} className="text-indigo-400 animate-pulse" />
                          ) : (
                            <Play size={12} />
                          )}
                          {isPreviewing
                            ? 'Loading...'
                            : isPlayingThis
                              ? 'Playing'
                              : 'Preview'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Duration slider */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Duration per Photo:{' '}
                <span className="text-indigo-400">{duration}s</span>
              </label>
              <input
                type="range"
                min={2}
                max={5}
                step={0.5}
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>2s</span>
                <span>5s</span>
              </div>
            </div>

            {/* Aspect ratio */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Aspect Ratio
              </label>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.key}
                    onClick={() => setAspectRatio(ar.key)}
                    className={`
                      flex-1 p-3 rounded-xl border text-center transition-all
                      ${
                        aspectRatio === ar.key
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                      }
                    `}
                  >
                    <p className="text-sm font-medium text-white">
                      {ar.key}
                    </p>
                    <p className="text-xs text-slate-500">{ar.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  stopMusicPreview();
                  setStep(1);
                }}
                icon={ChevronLeft}
              >
                Back
              </Button>
              <Button
                fullWidth
                size="lg"
                onClick={() => {
                  stopMusicPreview();
                  setStep(3);
                }}
                icon={ChevronRight}
              >
                Preview
              </Button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: PREVIEW & GENERATE ===== */}
        {step === 3 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Film size={18} className="text-indigo-400" />
              <h2 className="text-base font-semibold text-white">
                Preview & Generate
              </h2>
            </div>

            {/* Canvas / Video preview */}
            <div className="relative w-full mb-4 flex justify-center">
              {videoUrl ? (
                <div className="relative max-w-sm w-full">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full rounded-2xl bg-black"
                    onEnded={() => setPlaying(false)}
                    playsInline
                  />
                  <button
                    onClick={handlePlayPause}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    {!playing && (
                      <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <Play
                          size={24}
                          className="text-white ml-0.5"
                        />
                      </div>
                    )}
                  </button>
                </div>
              ) : (
                <div className="relative max-w-sm w-full">
                  <canvas
                    ref={canvasRef}
                    className="w-full rounded-2xl bg-slate-900 border border-slate-800"
                    style={{
                      aspectRatio:
                        aspectRatio === '9:16'
                          ? '9/16'
                          : aspectRatio === '1:1'
                            ? '1/1'
                            : '16/9',
                      maxHeight: '60vh',
                    }}
                  />
                  {!generating && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Film
                          size={32}
                          className="mx-auto text-slate-600 mb-2"
                        />
                        <p className="text-sm text-slate-500">
                          Ready to generate
                        </p>
                        <p className="text-xs text-slate-600">
                          {selectedIds.length} photos, {transition} transition
                          {musicStyle !== 'none' && (
                            <span>
                              , {musicStyles.find((s) => s.key === musicStyle)?.label || musicStyle} music
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Progress */}
            {generating && genProgress && (
              <div className="mb-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/50">
                <div className="flex items-center gap-3 mb-2">
                  <Spinner size={16} />
                  <p className="text-sm text-slate-300">
                    {getProgressLabel()}
                  </p>
                </div>
                {genProgress.phase === 'music' && (
                  <div className="flex items-center gap-2 mb-2">
                    <Music size={14} className="text-indigo-400" />
                    <p className="text-xs text-indigo-400">
                      {musicStyles.find((s) => s.key === musicStyle)?.emoji}{' '}
                      {musicStyles.find((s) => s.key === musicStyle)?.label || musicStyle}
                    </p>
                  </div>
                )}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        genProgress.phase === 'music'
                          ? Math.min(genProgress.progress || 0, 100) * 0.2
                          : genProgress.phase === 'loading'
                            ? 20 + (genProgress.progress || 0) * 0.3
                            : 50 + (genProgress.progress || 0) * 0.5
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              {videoUrl ? (
                <>
                  <Button
                    fullWidth
                    size="lg"
                    icon={Download}
                    onClick={handleDownload}
                    className="shadow-xl shadow-indigo-500/20"
                  >
                    Download Reel
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      fullWidth
                      size="lg"
                      onClick={handleChangePhotos}
                      icon={Images}
                    >
                      Change Photos
                    </Button>
                    <Button
                      variant="secondary"
                      fullWidth
                      size="lg"
                      onClick={handleEditSettings}
                      icon={Pencil}
                    >
                      Edit Settings
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    fullWidth
                    size="lg"
                    onClick={handleRegenerate}
                    icon={RotateCcw}
                  >
                    Regenerate
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    fullWidth
                    size="lg"
                    icon={Wand2}
                    onClick={handleGenerate}
                    loading={generating}
                    disabled={generating}
                    className="shadow-xl shadow-indigo-500/20"
                  >
                    {generating ? 'Generating...' : 'Generate Reel'}
                  </Button>
                  {genError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-sm text-red-400">{genError}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      fullWidth
                      size="lg"
                      onClick={() => setStep(1)}
                      disabled={generating}
                      icon={ChevronLeft}
                    >
                      Photos
                    </Button>
                    <Button
                      variant="secondary"
                      fullWidth
                      size="lg"
                      onClick={() => setStep(2)}
                      disabled={generating}
                      icon={Settings}
                    >
                      Settings
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
