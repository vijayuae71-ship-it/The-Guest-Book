import { useState, useCallback, useRef, useEffect } from 'react';
import { loadFaceModels, detectFaces, areModelsLoaded, cropFaceFromCanvas } from '../utils/faceApi';
import { clusterFaces } from '../utils/faceClustering';
import * as api from '../utils/api';

export function useFaceDetection(eventId, photos, userId) {
  const [status, setStatus] = useState('idle'); // idle | loading-models | detecting | clustering | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [clusters, setClusters] = useState([]);
  const [processedIds, setProcessedIds] = useState(new Set());
  const [error, setError] = useState(null);
  const queueRef = useRef([]);
  const processingRef = useRef(false);

  const loadModels = useCallback(async () => {
    if (areModelsLoaded()) return true;
    setStatus('loading-models');
    setError(null);
    try {
      await loadFaceModels((msg) => {
        console.log('[FaceDetection]', msg);
      });
      return true;
    } catch (err) {
      console.error('[FaceDetection] Model load failed:', err);
      setError('Failed to load face detection models: ' + (err.message || 'Unknown error'));
      setStatus('error');
      return false;
    }
  }, []);

  const processPhoto = useCallback(async (photo) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          console.log('[FaceDetection] Processing photo:', photo.id, 'size:', img.naturalWidth, 'x', img.naturalHeight);
          const faces = await detectFaces(img);
          console.log('[FaceDetection] Detected', faces.length, 'faces in photo:', photo.id);
          if (faces.length > 0) {
            // Generate face thumbnails by cropping from the loaded image
            const facesWithThumbnails = faces.map((f) => {
              let thumbnail = null;
              try {
                thumbnail = cropFaceFromCanvas(img, f.box, 96);
              } catch (e) {
                console.warn('Failed to crop face thumbnail:', e);
              }
              return {
                descriptor: f.descriptor,
                box: f.box,
                score: f.score,
                thumbnail,
              };
            });

            await api.saveFaces(photo.id, {
              eventId: photo.event_id || photo.eventId,
              faces: facesWithThumbnails,
            });
          }
          resolve(faces);
        } catch (err) {
          console.error('[FaceDetection] Detection failed for photo:', photo.id, err);
          resolve([]);
        }
      };
      img.onerror = (e) => {
        console.error('[FaceDetection] Image failed to load for photo:', photo.id, img.src);
        resolve([]);
      };
      const eid = photo.event_id || photo.eventId;
      img.src = `/uploads/${eid}/${photo.filename}?uid=${encodeURIComponent(userId || '')}`;
    });
  }, [userId]);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    setStatus('detecting');

    const total = queueRef.current.length;
    let current = 0;
    let totalFacesFound = 0;
    let failedPhotos = 0;

    while (queueRef.current.length > 0) {
      const photo = queueRef.current.shift();
      current++;
      setProgress({ current, total });
      try {
        const faces = await processPhoto(photo);
        totalFacesFound += faces.length;
      } catch {
        failedPhotos++;
      }
      setProcessedIds((prev) => new Set([...prev, photo.id]));
    }

    processingRef.current = false;

    console.log(`[FaceDetection] Scan complete: ${totalFacesFound} faces in ${total} photos (${failedPhotos} failed)`);

    if (totalFacesFound === 0 && total > 0) {
      setError(`No faces detected in ${total} ${total === 1 ? 'photo' : 'photos'}. Try uploading clearer photos with visible faces.`);
      setStatus('done');
      return;
    }

    setStatus('clustering');

    // Fetch all faces and cluster
    try {
      const res = await api.getFaces(eventId);
      const faces = (res.faces || []).map((f) => ({
        ...f,
        descriptor: typeof f.descriptor === 'string' ? JSON.parse(f.descriptor) : f.descriptor,
      }));

      if (faces.length > 0) {
        const newClusters = clusterFaces(faces);
        setClusters(newClusters);

        // Save clusters to server
        await api.saveClusters({
          clusters: newClusters.map((c) => ({
            id: c.id,
            eventId,
            faceIds: c.faces.map((f) => f.id),
            label: c.label,
          })),
        });
      }
    } catch (err) {
      console.error('Clustering failed:', err);
      setError('Face grouping failed. Please try again.');
    }

    setStatus('done');
  }, [eventId, processPhoto]);

  const startDetection = useCallback(async (forceRescan = false) => {
    if (!photos || photos.length === 0) return;

    setError(null);
    const modelsReady = await loadModels();
    if (!modelsReady) return;

    // Clear previous face data on rescan
    if (forceRescan) {
      try {
        await api.clearFaces(eventId);
        setClusters([]);
      } catch (e) {
        console.warn('[FaceDetection] Failed to clear face data:', e);
      }
    }

    // Get already-processed photo IDs from server
    let existingFaces = [];
    if (!forceRescan) {
      try {
        const res = await api.getFaces(eventId);
        existingFaces = res.faces || [];
      } catch (e) {
        // continue - treat all as unprocessed
      }
    }

    const processedPhotoIds = new Set(existingFaces.map((f) => f.photo_id || f.photoId));

    // Queue unprocessed photos (or all photos if force rescan)
    const unprocessed = forceRescan ? photos : photos.filter((p) => !processedPhotoIds.has(p.id));
    if (unprocessed.length === 0) {
      // Still cluster existing faces
      setStatus('clustering');
      const faces = existingFaces.map((f) => ({
        ...f,
        descriptor: typeof f.descriptor === 'string' ? JSON.parse(f.descriptor) : f.descriptor,
      }));
      if (faces.length > 0) {
        setClusters(clusterFaces(faces));
      }
      setStatus('done');
      return;
    }

    queueRef.current = [...unprocessed];
    await processQueue();
  }, [photos, eventId, loadModels, processQueue]);

  return {
    status,
    progress,
    clusters,
    error,
    startDetection,
    isProcessing: status === 'detecting' || status === 'loading-models' || status === 'clustering',
  };
}
