import React, { useState, useEffect, useCallback } from 'react';
import { FolderPlus, Folder, Trash2, Edit3, Plus, X, Check, Image as ImageIcon, ChevronRight } from 'lucide-react';

export default function AlbumsManager({ eventId, userId, photos, onPhotoClick }) {
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumPhotos, setAlbumPhotos] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  // Load albums
  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/albums/${eventId}`).then(r => r.json()).then(d => setAlbums(d.albums || [])).catch(() => {});
  }, [eventId]);

  // Load album photos
  useEffect(() => {
    if (!selectedAlbum) { setAlbumPhotos([]); return; }
    fetch(`/api/albums/${selectedAlbum.id}/photos`).then(r => r.json()).then(d => setAlbumPhotos(d.photos || [])).catch(() => {});
  }, [selectedAlbum]);

  const createAlbum = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`/api/albums/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), creatorId: userId }),
      });
      const d = await res.json();
      if (d.album) setAlbums(prev => [d.album, ...prev]);
      setNewName(''); setNewDesc(''); setShowCreate(false);
    } catch (err) { console.error(err); }
  }, [eventId, userId, newName, newDesc]);

  const deleteAlbum = useCallback(async (albumId) => {
    try {
      await fetch(`/api/albums/${albumId}`, { method: 'DELETE' });
      setAlbums(prev => prev.filter(a => a.id !== albumId));
      if (selectedAlbum?.id === albumId) setSelectedAlbum(null);
    } catch (err) { console.error(err); }
  }, [selectedAlbum]);

  const saveEdit = useCallback(async (albumId) => {
    try {
      const res = await fetch(`/api/albums/${albumId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      });
      const d = await res.json();
      if (d.album) setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, ...d.album } : a));
      setEditingId(null);
    } catch (err) { console.error(err); }
  }, [editName]);

  const addPhotosToAlbum = useCallback(async () => {
    if (!selectedAlbum || selectedPhotoIds.size === 0) return;
    setLoading(true);
    try {
      await fetch(`/api/albums/${selectedAlbum.id}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: [...selectedPhotoIds] }),
      });
      // Reload album photos
      const res = await fetch(`/api/albums/${selectedAlbum.id}/photos`);
      const d = await res.json();
      setAlbumPhotos(d.photos || []);
      setShowAddPhotos(false);
      setSelectedPhotoIds(new Set());
      // Update count
      setAlbums(prev => prev.map(a => a.id === selectedAlbum.id ? { ...a, photo_count: (d.photos || []).length } : a));
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [selectedAlbum, selectedPhotoIds]);

  const removePhotoFromAlbum = useCallback(async (photoId) => {
    if (!selectedAlbum) return;
    try {
      await fetch(`/api/albums/${selectedAlbum.id}/photos/${photoId}`, { method: 'DELETE' });
      setAlbumPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch (err) { console.error(err); }
  }, [selectedAlbum]);

  // Album photos view
  if (selectedAlbum) {
    return (
      <div className="px-4 pb-8">
        <button onClick={() => setSelectedAlbum(null)} className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 mb-4">
          <ChevronRight className="w-4 h-4 rotate-180" /> Back to Albums
        </button>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{selectedAlbum.name}</h3>
            {selectedAlbum.description && <p className="text-xs text-slate-400 mt-0.5">{selectedAlbum.description}</p>}
          </div>
          <button
            onClick={() => setShowAddPhotos(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm hover:bg-indigo-500/30"
          >
            <Plus className="w-4 h-4" /> Add Photos
          </button>
        </div>

        {albumPhotos.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Folder className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No photos in this album yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {albumPhotos.map(photo => (
              <div key={photo.id} className="aspect-square relative group rounded-lg overflow-hidden bg-slate-800">
                <img
                  src={`/uploads/${eventId}/${photo.thumbnail || photo.filename}?uid=${userId}`}
                  alt="" className="w-full h-full object-cover cursor-pointer"
                  onClick={() => onPhotoClick?.(photo)}
                  loading="lazy"
                />
                <button
                  onClick={() => removePhotoFromAlbum(photo.id)}
                  className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add photos modal */}
        {showAddPhotos && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center">
            <div className="bg-slate-900 w-full max-w-md max-h-[80vh] rounded-t-2xl sm:rounded-2xl border border-slate-700 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <h3 className="text-base font-semibold text-white">Add Photos to Album</h3>
                <button onClick={() => { setShowAddPhotos(false); setSelectedPhotoIds(new Set()); }} className="text-slate-400"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 grid grid-cols-4 gap-1.5">
                {(photos || []).map(photo => {
                  const isSelected = selectedPhotoIds.has(photo.id);
                  return (
                    <div key={photo.id} className="aspect-square relative cursor-pointer rounded-lg overflow-hidden"
                      onClick={() => setSelectedPhotoIds(prev => {
                        const next = new Set(prev);
                        if (isSelected) next.delete(photo.id); else next.add(photo.id);
                        return next;
                      })}
                    >
                      <img src={`/uploads/${eventId}/${photo.thumbnail || photo.filename}?uid=${userId}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-indigo-500/40 flex items-center justify-center">
                          <Check className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-slate-700 flex gap-2">
                <button onClick={() => { setShowAddPhotos(false); setSelectedPhotoIds(new Set()); }}
                  className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button onClick={addPhotosToAlbum} disabled={selectedPhotoIds.size === 0 || loading}
                  className="flex-1 px-4 py-2 bg-indigo-500 text-white rounded-xl disabled:opacity-40">
                  {loading ? 'Adding...' : `Add ${selectedPhotoIds.size} Photo${selectedPhotoIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Albums list view
  return (
    <div className="px-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Folder className="w-4 h-4 text-indigo-400" /> Albums
        </h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm hover:bg-indigo-500/30"
        >
          <FolderPlus className="w-4 h-4" /> New
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-2">
          <input
            type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Album name" className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)" className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="flex-1 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm">Cancel</button>
            <button onClick={createAlbum} disabled={!newName.trim()} className="flex-1 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-40">Create</button>
          </div>
        </div>
      )}

      {/* Album cards */}
      {albums.length === 0 && !showCreate ? (
        <div className="text-center py-12 text-slate-500">
          <Folder className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No albums yet</p>
          <p className="text-xs mt-1">Create albums to organize photos by moment</p>
        </div>
      ) : (
        <div className="space-y-2">
          {albums.map(album => (
            <div key={album.id} className="bg-slate-800 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-750 transition-colors"
              onClick={() => { if (editingId !== album.id) setSelectedAlbum(album); }}
            >
              <div className="w-14 h-14 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                <Folder className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                {editingId === album.id ? (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 bg-slate-700 text-white rounded px-2 py-1 text-sm border border-slate-600" />
                    <button onClick={() => saveEdit(album.id)} className="text-green-400"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white truncate">{album.name}</p>
                    {album.description && <p className="text-xs text-slate-400 truncate">{album.description}</p>}
                    <p className="text-xs text-slate-500 mt-0.5">{album.photo_count || 0} photos</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setEditingId(album.id); setEditName(album.name); }} className="p-1.5 text-slate-500 hover:text-slate-300"><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteAlbum(album.id)} className="p-1.5 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
