import React, { useMemo } from 'react';
import { Clock, Camera, Users } from 'lucide-react';

function formatTimeGroup(dateStr) {
  if (!dateStr) return 'Unknown Time';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return 'Just Now';
  if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function groupPhotosByTime(photos) {
  const groups = {};
  for (const photo of photos) {
    const dateStr = photo.taken_at || photo.uploaded_at;
    if (!dateStr) {
      const key = 'unknown';
      if (!groups[key]) groups[key] = { label: 'Unknown Time', photos: [] };
      groups[key].photos.push(photo);
      continue;
    }
    const date = new Date(dateStr);
    // Group by hour
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    if (!groups[key]) {
      groups[key] = {
        label: date.toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
        timestamp: date.getTime(),
        photos: [],
      };
    }
    groups[key].photos.push(photo);
  }
  return Object.values(groups).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export default function EventTimeline({ photos, eventId, userId, onPhotoClick }) {
  const groups = useMemo(() => groupPhotosByTime(photos || []), [photos]);

  if (!photos || photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Clock className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">No moments yet</p>
        <p className="text-sm mt-1">Photos will appear here in chronological order</p>
      </div>
    );
  }

  return (
    <div className="relative px-4 pb-8">
      {/* Timeline line */}
      <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-slate-700" />

      {groups.map((group, gi) => (
        <div key={gi} className="relative mb-8">
          {/* Timeline dot */}
          <div className="absolute left-5 w-5 h-5 rounded-full bg-indigo-500 border-2 border-slate-900 z-10 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>

          {/* Time label */}
          <div className="ml-14 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-indigo-400">{group.label}</span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Camera className="w-3 h-3" />
                {group.photos.length}
              </span>
            </div>
            {/* Uploaders */}
            <div className="flex items-center gap-1 mt-1">
              {[...new Set(group.photos.map(p => p.uploader_name).filter(Boolean))].slice(0, 3).map((name, i) => (
                <span key={i} className="text-xs text-slate-500">
                  {name}{i < 2 ? ',' : ''}
                </span>
              ))}
            </div>
          </div>

          {/* Photo grid */}
          <div className="ml-14 grid grid-cols-3 gap-1.5 rounded-lg overflow-hidden">
            {group.photos.slice(0, 9).map((photo) => (
              <div
                key={photo.id}
                className="aspect-square relative cursor-pointer group overflow-hidden bg-slate-800"
                onClick={() => onPhotoClick?.(photo)}
              >
                <img
                  src={`/uploads/${eventId}/${photo.thumbnail || photo.filename}?uid=${userId}`}
                  alt={photo.original_name || ''}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                    <p className="text-[10px] text-white truncate">{photo.caption}</p>
                  </div>
                )}
              </div>
            ))}
            {group.photos.length > 9 && (
              <div className="aspect-square bg-slate-800/80 flex items-center justify-center rounded-lg">
                <span className="text-lg font-bold text-slate-300">+{group.photos.length - 9}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
