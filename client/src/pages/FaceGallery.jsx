import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Scan,
  Edit3,
  Check,
  X,
  Image as ImageIcon,
  Users,
  User,
  ChevronDown,
  Filter,
  Camera,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import {
  getEvent,
  getPhotos,
  getClusters,
  getFaces,
  updateClusterLabel,
} from '../utils/api';
import { useUser } from '../context/UserContext';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { detectSingleFace, loadFaceModels, areModelsLoaded } from '../utils/faceApi';
import { FACE_DISTANCE_THRESHOLD } from '../utils/constants';

export default function FaceGallery() {
  const { code } = useParams();
  const { userId } = useUser();

  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // All faces data (with thumbnails) for building cluster thumbnails
  const [facesData, setFacesData] = useState([]);

  // Filtered view
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [filteredPhotos, setFilteredPhotos] = useState([]);

  // Editing cluster name
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef(null);

  // Selfie match ("Find Me") state
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [selfieMatching, setSelfieMatching] = useState(false);
  const [selfieToast, setSelfieToast] = useState(null);
  const selfieInputRef = useRef(null);

  const eventId = event?._id || event?.id || code;

  // Face detection hook
  const {
    status: detectionStatus,
    progress: detectionProgress,
    clusters: detectedClusters,
    error: detectionError,
    startDetection,
    isProcessing,
  } = useFaceDetection(eventId, photos, userId);

  const analyzing = isProcessing;

  // Load data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const eventRes = await getEvent(code);
        if (cancelled) return;
        const eventData = eventRes.event || eventRes;
        setEvent(eventData);

        const eid = eventData._id || eventData.id || code;
        const photosData = await getPhotos(eid).catch(() => ({ photos: [] }));
        if (cancelled) return;
        const photoList = Array.isArray(photosData)
          ? photosData
          : photosData.photos || [];
        setPhotos(photoList);

        // Load faces data (includes thumbnails)
        try {
          const facesRes = await getFaces(eid);
          setFacesData(facesRes.faces || []);
        } catch {
          setFacesData([]);
        }

        try {
          const clusterData = await getClusters(eid);
          const clusterList = Array.isArray(clusterData)
            ? clusterData
            : clusterData.clusters || [];
          setClusters(clusterList);
        } catch {
          setClusters([]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Update clusters when detection completes
  useEffect(() => {
    if (detectionStatus === 'done' && detectedClusters.length > 0) {
      setClusters(detectedClusters);
      // Re-fetch faces data to get thumbnails
      if (eventId) {
        getFaces(eventId).then((res) => {
          setFacesData(res.faces || []);
        }).catch(() => {});
      }
    }
  }, [detectionStatus, detectedClusters, eventId]);

  // Focus edit input
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
    }
  }, [editingId]);

  const getPhotoUrl = (photo, thumb = false) => {
    const uidParam = `?uid=${encodeURIComponent(userId)}`;
    if (thumb && photo.thumbnail)
      return `/uploads/${eventId}/${photo.thumbnail}${uidParam}`;
    if (photo.url) return photo.url;
    return `/uploads/${eventId}/${photo.filename || photo.file}${uidParam}`;
  };

  // Get face thumbnail from either the cluster data or the faces data
  const getFaceThumbnail = (cluster) => {
    // 1. Check if the cluster has face_thumbnail from the server query
    if (cluster.face_thumbnail) return cluster.face_thumbnail;

    // 2. Check inline cluster faces (from useFaceDetection results)
    if (cluster.faces?.[0]?.thumbnail) return cluster.faces[0].thumbnail;

    // 3. Look up the representative face in facesData
    const repFaceId = cluster.representative_face_id;
    if (repFaceId && facesData.length > 0) {
      const face = facesData.find((f) => f.id === repFaceId);
      if (face?.thumbnail) return face.thumbnail;
    }

    // 4. Find any face in this cluster that has a thumbnail
    const clusterId = cluster._id || cluster.id;
    if (clusterId && facesData.length > 0) {
      const clusterFace = facesData.find(
        (f) => f.cluster_id === clusterId && f.thumbnail
      );
      if (clusterFace?.thumbnail) return clusterFace.thumbnail;
    }

    return null;
  };

  const handleSelectCluster = (cluster) => {
    setSelectedCluster(cluster);
    // Get photo IDs from cluster faces
    const photoIds = new Set();

    // From inline faces
    if (cluster.faces) {
      cluster.faces.forEach((f) => {
        const pid = f.photoId || f.photo_id;
        if (pid) photoIds.add(pid);
      });
    }

    // From facesData (match by cluster_id)
    const clusterId = cluster._id || cluster.id;
    facesData.forEach((f) => {
      if (f.cluster_id === clusterId) {
        const pid = f.photo_id || f.photoId;
        if (pid) photoIds.add(pid);
      }
    });

    const matched = photos.filter(
      (p) => photoIds.has(p._id) || photoIds.has(p.id)
    );
    setFilteredPhotos(matched);
  };

  const handleStartEdit = (e, cluster) => {
    e.stopPropagation();
    setEditingId(cluster._id || cluster.id);
    setEditName(cluster.label || cluster.name || '');
  };

  const handleSaveEdit = async (cluster) => {
    const id = cluster._id || cluster.id;
    const newLabel = editName.trim();
    setEditingId(null);

    if (!newLabel || newLabel === (cluster.label || cluster.name || ''))
      return;

    try {
      await updateClusterLabel(id, newLabel);
      setClusters((prev) =>
        prev.map((c) =>
          (c._id || c.id) === id ? { ...c, label: newLabel } : c
        )
      );
      // Also update selectedCluster if editing in filtered view
      if (selectedCluster && (selectedCluster._id || selectedCluster.id) === id) {
        setSelectedCluster((prev) => ({ ...prev, label: newLabel }));
      }
    } catch {
      // revert silently
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleScanFaces = (forceRescan = false) => {
    setError('');
    startDetection(forceRescan);
  };

  // --- Find Me (selfie match) logic ---
  function euclideanDistance(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
  }

  const handleFindMe = () => {
    setSelfieToast(null);
    selfieInputRef.current?.click();
  };

  const handleSelfieSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    e.target.value = '';

    setSelfieMatching(true);
    setSelfieToast(null);

    try {
      // Ensure face models are loaded
      if (!areModelsLoaded()) {
        await loadFaceModels();
      }

      // Load the selected image
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load selfie image'));
        image.src = URL.createObjectURL(file);
      });

      // Detect a single face in the selfie
      const selfieResult = await detectSingleFace(img);
      URL.revokeObjectURL(img.src);

      if (!selfieResult || !selfieResult.descriptor) {
        setSelfieToast({ type: 'error', message: "Couldn't find your face. Try a clearer selfie." });
        setSelfieMatching(false);
        return;
      }

      const selfieDescriptor = selfieResult.descriptor;

      // Compare against all faces in facesData that have a cluster_id and descriptor
      let bestDistance = Infinity;
      let bestClusterId = null;

      for (const face of facesData) {
        if (!face.cluster_id || !face.descriptor) continue;
        const dist = euclideanDistance(selfieDescriptor, face.descriptor);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestClusterId = face.cluster_id;
        }
      }

      if (bestDistance < FACE_DISTANCE_THRESHOLD && bestClusterId) {
        // Find the matching cluster object
        const matchedCluster = clusters.find(
          (c) => (c._id || c.id) === bestClusterId
        );

        if (matchedCluster) {
          handleSelectCluster(matchedCluster);
          const matchedCount =
            matchedCluster.faces?.length || matchedCluster.photoCount || matchedCluster.face_count || 0;
          setSelfieToast({
            type: 'success',
            message: `Found you! Showing your ${matchedCount} photos`,
          });
        } else {
          setSelfieToast({ type: 'error', message: "Couldn't find your face. Try a clearer selfie." });
        }
      } else {
        setSelfieToast({ type: 'error', message: "Couldn't find your face. Try a clearer selfie." });
      }
    } catch (err) {
      console.error('[FindMe] Selfie matching error:', err);
      setSelfieToast({ type: 'error', message: "Couldn't find your face. Try a clearer selfie." });
    } finally {
      setSelfieMatching(false);
    }
  };

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (selfieToast) {
      const timer = setTimeout(() => setSelfieToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [selfieToast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  // --- Filtered view (photos for selected person) ---
  if (selectedCluster) {
    const clusterLabel =
      selectedCluster.label || selectedCluster.name || 'Unknown Person';
    const clusterThumb = getFaceThumbnail(selectedCluster);
    const clusterId = selectedCluster._id || selectedCluster.id;
    const isEditing = editingId === clusterId;

    return (
      <div className="min-h-screen bg-slate-950">
        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Header with face thumbnail and name */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setSelectedCluster(null)}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>

            {/* Face circle */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 ring-2 ring-indigo-500/40 flex-shrink-0">
              {clusterThumb ? (
                <img
                  src={clusterThumb}
                  alt={clusterLabel}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <User size={18} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(selectedCluster);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-0"
                    placeholder="Enter name"
                  />
                  <button
                    onClick={() => handleSaveEdit(selectedCluster)}
                    className="p-1 text-green-400 hover:text-green-300"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 text-slate-500 hover:text-slate-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => handleStartEdit(e, selectedCluster)}
                  className="flex items-center gap-1.5 text-white hover:text-indigo-300 transition-colors group"
                >
                  <h1 className="text-lg font-semibold truncate">
                    {clusterLabel}
                  </h1>
                  <Edit3
                    size={13}
                    className="text-slate-600 group-hover:text-indigo-400 flex-shrink-0"
                  />
                </button>
              )}
              <p className="text-xs text-slate-500">
                {filteredPhotos.length}{' '}
                {filteredPhotos.length === 1 ? 'photo' : 'photos'}
              </p>
            </div>
          </div>

          {filteredPhotos.length === 0 ? (
            <div className="text-center py-16">
              <ImageIcon
                size={32}
                className="mx-auto text-slate-700 mb-3"
              />
              <p className="text-sm text-slate-500">
                No matching photos found
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {filteredPhotos.map((photo, i) => (
                <div
                  key={photo._id || photo.id || i}
                  className="aspect-square overflow-hidden rounded-lg bg-slate-800/50"
                >
                  <img
                    src={getPhotoUrl(photo, true)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Main clusters view ---
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to={`/event/${code}`}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">
              People in Photos
            </h1>
            <p className="text-xs text-slate-500">
              {event?.name || 'Event'} &middot; {clusters.length}{' '}
              {clusters.length === 1 ? 'person' : 'people'} found
            </p>
          </div>
          {photos.length > 0 && (
            <div className="flex gap-2">
              {clusters.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleScanFaces(true)}
                  disabled={analyzing}
                >
                  Rescan
                </Button>
              )}
              {clusters.length > 0 && facesData.length > 0 && (
                <button
                  onClick={handleFindMe}
                  disabled={selfieMatching || analyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25"
                >
                  <Camera size={15} />
                  {selfieMatching ? 'Matching...' : 'Find Me'}
                </button>
              )}
              <Button
                size="sm"
                icon={Scan}
                onClick={() => handleScanFaces(false)}
                loading={analyzing}
                disabled={analyzing}
              >
                {analyzing ? 'Scanning...' : 'Scan Faces'}
              </Button>
            </div>
          )}
        </div>

        {/* Hidden file input for selfie capture */}
        <input
          ref={selfieInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleSelfieSelected}
        />

        {/* Detection progress */}
        {analyzing && (
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Spinner size={18} />
              <div className="flex-1">
                <p className="text-sm text-indigo-300 font-medium">
                  {detectionStatus === 'loading-models'
                    ? 'Loading AI models...'
                    : detectionStatus === 'detecting'
                      ? 'Detecting faces...'
                      : detectionStatus === 'clustering'
                        ? 'Grouping faces...'
                        : 'Analyzing photos...'}
                </p>
                {detectionStatus === 'detecting' &&
                  detectionProgress.total > 0 && (
                    <p className="text-xs text-indigo-400/70">
                      Photo {detectionProgress.current} of{' '}
                      {detectionProgress.total}
                    </p>
                  )}
              </div>
            </div>
            {detectionStatus === 'detecting' &&
              detectionProgress.total > 0 && (
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${(detectionProgress.current / detectionProgress.total) * 100}%`,
                    }}
                  />
                </div>
              )}
          </div>
        )}

        {(error || detectionError) && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
            <p className="text-sm text-red-400">
              {error || detectionError}
            </p>
          </div>
        )}

        {/* Selfie matching progress */}
        {selfieMatching && (
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-6">
            <div className="flex items-center gap-3">
              <Spinner size={18} />
              <p className="text-sm text-purple-300 font-medium">
                Matching your face...
              </p>
            </div>
          </div>
        )}

        {/* Selfie match toast */}
        {selfieToast && (
          <div
            className={`p-3 rounded-xl mb-6 flex items-center justify-between ${
              selfieToast.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            <p
              className={`text-sm ${
                selfieToast.type === 'success'
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {selfieToast.message}
            </p>
            <button
              onClick={() => setSelfieToast(null)}
              className="p-1 text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {clusters.length === 0 && !analyzing ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-slate-600" />
            </div>
            <p className="text-slate-400 mb-1">No faces detected yet</p>
            <p className="text-sm text-slate-600 max-w-xs mx-auto mb-4">
              Tap "Scan Faces" to detect and group faces in your photos
            </p>
            {photos.length > 0 && (
              <Button
                icon={Scan}
                onClick={handleScanFaces}
                disabled={analyzing}
              >
                Scan Faces
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {clusters.map((cluster) => {
              const id = cluster._id || cluster.id;
              const isEditing = editingId === id;
              const faceSrc = getFaceThumbnail(cluster);
              const photoCount =
                cluster.faces?.length || cluster.photoCount || cluster.face_count || 0;
              const label = cluster.label || cluster.name || 'Unknown';

              return (
                <div
                  key={id}
                  className="rounded-2xl bg-slate-900/60 border border-slate-800/50 p-4 flex flex-col items-center group hover:border-slate-700/60 transition-colors"
                >
                  {/* Face thumbnail */}
                  <button
                    onClick={() => handleSelectCluster(cluster)}
                    className="w-20 h-20 rounded-full overflow-hidden bg-slate-800 mb-3 ring-2 ring-slate-700 hover:ring-indigo-500/50 transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {faceSrc ? (
                      <img
                        src={faceSrc}
                        alt={label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                        <User size={28} className="text-slate-500" />
                      </div>
                    )}
                  </button>

                  {/* Name label */}
                  {isEditing ? (
                    <div className="flex items-center gap-1 w-full">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            handleSaveEdit(cluster);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-0"
                        placeholder="Enter name"
                      />
                      <button
                        onClick={() => handleSaveEdit(cluster)}
                        className="p-1 text-green-400 hover:text-green-300"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1 text-slate-500 hover:text-slate-300"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleStartEdit(e, cluster)}
                      className="flex items-center gap-1 text-sm font-medium text-slate-200 hover:text-white transition-colors group/edit"
                    >
                      <span className="truncate max-w-[100px]">
                        {label}
                      </span>
                      <Edit3
                        size={11}
                        className="text-slate-600 group-hover/edit:text-indigo-400 flex-shrink-0"
                      />
                    </button>
                  )}

                  <p className="text-xs text-slate-500 mt-1">
                    {photoCount}{' '}
                    {photoCount === 1 ? 'photo' : 'photos'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
