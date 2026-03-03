import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wand2 } from 'lucide-react';
import { applyFilter, FILTER_LIST } from '../../utils/photoFilters';

export default function PhotoFilterPicker({ imageFile, onFilterApply, onCancel }) {
  const [previews, setPreviews] = useState({});
  const [selectedFilter, setSelectedFilter] = useState('original');
  const [intensity, setIntensity] = useState(100);
  const [applying, setApplying] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  // Generate preview URL
  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Generate filter thumbnails
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = async () => {
      // Create small thumbnail for previews
      const thumbCanvas = document.createElement('canvas');
      const thumbSize = 80;
      thumbCanvas.width = thumbSize;
      thumbCanvas.height = thumbSize;
      const tctx = thumbCanvas.getContext('2d');
      const scale = Math.max(thumbSize / img.width, thumbSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      tctx.drawImage(img, (thumbSize - w) / 2, (thumbSize - h) / 2, w, h);

      const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.6);
      const results = { original: thumbUrl };

      for (const filter of FILTER_LIST) {
        if (filter.key === 'original') continue;
        try {
          const result = await applyFilter(thumbUrl, filter.key, 100);
          results[filter.key] = result.dataUrl;
        } catch {
          results[filter.key] = thumbUrl;
        }
      }

      setPreviews(results);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const handleApply = useCallback(async () => {
    if (selectedFilter === 'original') {
      onFilterApply?.(imageFile);
      return;
    }

    setApplying(true);
    try {
      const result = await applyFilter(imageUrl, selectedFilter, intensity);
      if (result.blob) {
        const filteredFile = new File(
          [result.blob],
          imageFile.name,
          { type: 'image/jpeg', lastModified: Date.now() }
        );
        onFilterApply?.(filteredFile);
      }
    } catch (err) {
      console.error('Filter failed:', err);
      onFilterApply?.(imageFile);
    }
    setApplying(false);
  }, [imageFile, imageUrl, selectedFilter, intensity, onFilterApply]);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Preview */}
      <div className="relative aspect-square max-h-[300px] bg-slate-800 flex items-center justify-center overflow-hidden">
        {imageUrl && (
          <img
            src={selectedFilter === 'original' ? imageUrl : (previews[selectedFilter] || imageUrl)}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* Filter strip */}
      <div className="flex overflow-x-auto gap-2 px-3 py-3 scrollbar-hide">
        {FILTER_LIST.map(filter => (
          <button
            key={filter.key}
            onClick={() => setSelectedFilter(filter.key)}
            className={`flex flex-col items-center gap-1 shrink-0 ${
              selectedFilter === filter.key ? 'opacity-100' : 'opacity-60'
            }`}
          >
            <div className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
              selectedFilter === filter.key ? 'border-indigo-500' : 'border-transparent'
            }`}>
              {previews[filter.key] ? (
                <img src={previews[filter.key]} alt={filter.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-700 animate-pulse" />
              )}
            </div>
            <span className={`text-[10px] ${
              selectedFilter === filter.key ? 'text-indigo-400 font-medium' : 'text-slate-500'
            }`}>
              {filter.name}
            </span>
          </button>
        ))}
      </div>

      {/* Intensity slider */}
      {selectedFilter !== 'original' && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="range"
            min="0" max="100" value={intensity}
            onChange={e => setIntensity(parseInt(e.target.value))}
            className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-xs text-slate-400 w-8 text-right">{intensity}%</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-3 pb-3">
        <button onClick={onCancel} className="flex-1 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">
          Skip
        </button>
        <button
          onClick={handleApply}
          disabled={applying}
          className="flex-1 px-3 py-2 bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {applying ? 'Applying...' : 'Apply Filter'}
        </button>
      </div>
    </div>
  );
}
