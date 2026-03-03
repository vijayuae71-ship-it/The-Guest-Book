import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Film, Play, Pause, RotateCcw, Download, X, Check, ChevronLeft, ChevronRight, Repeat } from 'lucide-react';

export default function GifCreator({ eventId, userId, photos, isOpen, onClose }) {
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [step, setStep] = useState('select'); // select, preview
  const [isBoomerang, setIsBoomerang] = useState(false);
  const [speed, setSpeed] = useState(200); // ms per frame
  const [playing, setPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const imagesRef = useRef([]);

  // Preload images
  useEffect(() => {
    if (step !== 'preview' || selectedPhotos.length === 0) return;
    imagesRef.current = [];
    let loaded = 0;
    selectedPhotos.forEach((photo, i) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imagesRef.current[i] = img;
        loaded++;
        if (loaded === selectedPhotos.length) {
          drawFrame(0);
        }
      };
      img.src = `/uploads/${eventId}/${photo.filename}?uid=${userId}`;
    });
  }, [step, selectedPhotos, eventId, userId]);

  const drawFrame = useCallback((frameIdx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frames = isBoomerang
      ? [...selectedPhotos, ...selectedPhotos.slice(1, -1).reverse()]
      : selectedPhotos;
    const idx = frameIdx % frames.length;
    const img = imagesRef.current[selectedPhotos.indexOf(frames[idx])];
    if (!img) return;

    const ctx = canvas.getContext('2d');
    const size = 500;
    canvas.width = size;
    canvas.height = size;

    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    setCurrentFrame(frameIdx);
  }, [selectedPhotos, isBoomerang]);

  // Playback
  useEffect(() => {
    if (playing) {
      const totalFrames = isBoomerang
        ? selectedPhotos.length * 2 - 2
        : selectedPhotos.length;
      intervalRef.current = setInterval(() => {
        setCurrentFrame(prev => {
          const next = (prev + 1) % totalFrames;
          drawFrame(next);
          return next;
        });
      }, speed);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, drawFrame, isBoomerang, selectedPhotos.length]);

  const togglePhoto = (photo) => {
    setSelectedPhotos(prev => {
      const exists = prev.find(p => p.id === photo.id);
      if (exists) return prev.filter(p => p.id !== photo.id);
      if (prev.length >= 20) return prev;
      return [...prev, photo];
    });
  };

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    try {
      // Generate as animated sequence (individual frames download as zip-like)
      // Since true GIF encoding needs a library, we'll create a video via MediaRecorder
      const canvas = canvasRef.current;
      if (!canvas) return;

      const stream = canvas.captureStream(0);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${isBoomerang ? 'boomerang' : 'animation'}_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setGenerating(false);
      };

      recorder.start();
      const frames = isBoomerang
        ? [...selectedPhotos, ...selectedPhotos.slice(1, -1).reverse()]
        : selectedPhotos;

      for (let i = 0; i < frames.length; i++) {
        const idx = selectedPhotos.indexOf(frames[i]);
        const img = imagesRef.current[idx];
        if (img) {
          const ctx = canvas.getContext('2d');
          const size = 500;
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        }
        stream.getVideoTracks()[0].requestFrame?.();
        await new Promise(r => setTimeout(r, speed));
      }

      recorder.stop();
    } catch (err) {
      console.error('Failed to generate:', err);
      setGenerating(false);
    }
  }, [selectedPhotos, isBoomerang, speed]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">
            {step === 'select' ? 'Select Photos' : 'Preview Animation'}
          </h2>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      {step === 'select' ? (
        <>
          {/* Photo selection grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-slate-400 mb-3">
              Select 2-20 photos in order. Tap to select/deselect.
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(photos || []).filter(p => p.status === 'approved').map(photo => {
                const idx = selectedPhotos.findIndex(p => p.id === photo.id);
                const isSelected = idx >= 0;
                return (
                  <div key={photo.id} className="aspect-square relative cursor-pointer rounded-lg overflow-hidden"
                    onClick={() => togglePhoto(photo)}>
                    <img src={`/uploads/${eventId}/${photo.thumbnail || photo.filename}?uid=${userId}`}
                      alt="" className="w-full h-full object-cover" loading="lazy" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-indigo-500/40 flex items-center justify-center">
                        <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
            <span className="text-sm text-slate-400">{selectedPhotos.length} selected</span>
            <button onClick={() => setStep('preview')} disabled={selectedPhotos.length < 2}
              className="px-5 py-2 bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-40">
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Preview */}
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <canvas ref={canvasRef} className="w-full max-w-[400px] aspect-square rounded-xl bg-slate-800" />

            <div className="flex items-center gap-4 mt-4">
              <button onClick={() => setPlaying(!playing)}
                className="p-3 bg-slate-800 rounded-full text-white hover:bg-slate-700">
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
            </div>

            {/* Controls */}
            <div className="w-full max-w-[400px] mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Speed</span>
                <div className="flex gap-2">
                  {[100, 200, 300, 500].map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={`px-2 py-1 text-xs rounded ${speed === s ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {s}ms
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400 flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5" /> Boomerang
                </span>
                <button onClick={() => setIsBoomerang(!isBoomerang)}
                  className={`w-10 h-5 rounded-full transition-colors ${isBoomerang ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isBoomerang ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-700 flex gap-3">
            <button onClick={() => { setStep('select'); setPlaying(false); }}
              className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl">Back</button>
            <button onClick={handleDownload} disabled={generating}
              className="flex-1 px-4 py-2.5 bg-indigo-500 text-white rounded-xl flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              {generating ? 'Creating...' : 'Download'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
