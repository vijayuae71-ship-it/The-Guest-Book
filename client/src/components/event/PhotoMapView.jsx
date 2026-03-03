import React, { useMemo, useRef, useEffect, useState } from 'react';
import { MapPin, Image as ImageIcon } from 'lucide-react';

function parseGPSFromExif(photo) {
  // Check for GPS data in the taken_at or other fields
  // For now, use width/height as rough indicators;
  // Real GPS would come from EXIF processing
  if (photo.latitude && photo.longitude) {
    return { lat: photo.latitude, lng: photo.longitude };
  }
  return null;
}

export default function PhotoMapView({ photos, eventId, userId, onPhotoClick }) {
  const canvasRef = useRef(null);
  const [hoveredPhoto, setHoveredPhoto] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);

  const geoPhotos = useMemo(() => {
    return (photos || []).filter(p => p.latitude && p.longitude).map(p => ({
      ...p,
      lat: parseFloat(p.latitude),
      lng: parseFloat(p.longitude),
    }));
  }, [photos]);

  // Cluster nearby photos
  const clusters = useMemo(() => {
    if (geoPhotos.length === 0) return [];

    const clustered = [];
    const used = new Set();
    const threshold = 0.001; // ~111m

    for (let i = 0; i < geoPhotos.length; i++) {
      if (used.has(i)) continue;
      const cluster = { photos: [geoPhotos[i]], lat: geoPhotos[i].lat, lng: geoPhotos[i].lng };
      used.add(i);

      for (let j = i + 1; j < geoPhotos.length; j++) {
        if (used.has(j)) continue;
        const dlat = Math.abs(geoPhotos[j].lat - cluster.lat);
        const dlng = Math.abs(geoPhotos[j].lng - cluster.lng);
        if (dlat < threshold && dlng < threshold) {
          cluster.photos.push(geoPhotos[j]);
          used.add(j);
        }
      }

      // Recalculate center
      cluster.lat = cluster.photos.reduce((s, p) => s + p.lat, 0) / cluster.photos.length;
      cluster.lng = cluster.photos.reduce((s, p) => s + p.lng, 0) / cluster.photos.length;
      clustered.push(cluster);
    }

    return clustered;
  }, [geoPhotos]);

  if (geoPhotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <MapPin className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">No location data</p>
        <p className="text-sm mt-1 text-center px-8">
          Photos with GPS metadata will appear on a map here.
          Make sure location services are enabled when taking photos.
        </p>
      </div>
    );
  }

  // Calculate bounds
  const minLat = Math.min(...geoPhotos.map(p => p.lat));
  const maxLat = Math.max(...geoPhotos.map(p => p.lat));
  const minLng = Math.min(...geoPhotos.map(p => p.lng));
  const maxLng = Math.max(...geoPhotos.map(p => p.lng));
  const padding = 0.2;
  const latRange = (maxLat - minLat) || 0.01;
  const lngRange = (maxLng - minLng) || 0.01;

  return (
    <div className="px-4 pb-8">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-4 h-4 text-indigo-400" />
        <span className="text-sm text-slate-300">
          {geoPhotos.length} photo{geoPhotos.length !== 1 ? 's' : ''} with location data
        </span>
      </div>

      {/* Map visualization */}
      <div className="relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700" style={{ height: 400 }}>
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {[0.2, 0.4, 0.6, 0.8].map(f => (
            <React.Fragment key={f}>
              <line x1={`${f * 100}%`} y1="0" x2={`${f * 100}%`} y2="100%" stroke="#334155" strokeWidth="0.5" />
              <line x1="0" y1={`${f * 100}%`} x2="100%" y2={`${f * 100}%`} stroke="#334155" strokeWidth="0.5" />
            </React.Fragment>
          ))}
        </svg>

        {/* Photo pins */}
        {clusters.map((cluster, i) => {
          const x = ((cluster.lng - minLng + lngRange * padding) / (lngRange * (1 + 2 * padding))) * 100;
          const y = ((maxLat - cluster.lat + latRange * padding) / (latRange * (1 + 2 * padding))) * 100;
          const isSelected = selectedCluster === i;

          return (
            <div
              key={i}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => setSelectedCluster(isSelected ? null : i)}
            >
              <div className={`
                flex items-center justify-center rounded-full transition-all duration-200
                ${isSelected ? 'w-12 h-12 bg-indigo-500 ring-4 ring-indigo-500/30' : 'w-8 h-8 bg-indigo-500/80 hover:bg-indigo-500 hover:scale-110'}
              `}>
                {cluster.photos.length > 1 ? (
                  <span className="text-xs font-bold text-white">{cluster.photos.length}</span>
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-white" />
                )}
              </div>
            </div>
          );
        })}

        {/* Coordinate labels */}
        <div className="absolute bottom-2 left-3 text-[10px] text-slate-500">
          {minLat.toFixed(4)}&deg;, {minLng.toFixed(4)}&deg;
        </div>
        <div className="absolute top-2 right-3 text-[10px] text-slate-500">
          {maxLat.toFixed(4)}&deg;, {maxLng.toFixed(4)}&deg;
        </div>
      </div>

      {/* Selected cluster photos */}
      {selectedCluster !== null && clusters[selectedCluster] && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-slate-300 mb-2">
            {clusters[selectedCluster].photos.length} photo{clusters[selectedCluster].photos.length !== 1 ? 's' : ''} at this location
          </h3>
          <div className="grid grid-cols-4 gap-1.5">
            {clusters[selectedCluster].photos.map(photo => (
              <div
                key={photo.id}
                className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-slate-800"
                onClick={() => onPhotoClick?.(photo)}
              >
                <img
                  src={`/uploads/${eventId}/${photo.thumbnail || photo.filename}?uid=${userId}`}
                  alt=""
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
