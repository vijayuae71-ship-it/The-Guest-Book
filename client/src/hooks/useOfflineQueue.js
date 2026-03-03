import { useState, useEffect, useCallback, useRef } from 'react';
import { addToQueue, getQueuedUploads, processQueue, getQueueCount, clearQueue } from '../utils/offlineQueue';
import { uploadPhotos } from '../utils/api';

export function useOfflineQueue(eventId) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const processingRef = useRef(false);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Refresh queue count
  const refreshCount = useCallback(async () => {
    if (eventId) {
      const count = await getQueueCount(eventId);
      setQueueCount(count);
    }
  }, [eventId]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Queue files for later upload
  const queueFiles = useCallback(async (files, userId, userName) => {
    await addToQueue(eventId, files, userId, userName);
    await refreshCount();
  }, [eventId, refreshCount]);

  // Process the queue (upload pending items)
  const syncQueue = useCallback(async () => {
    if (processingRef.current || !isOnline || !eventId) return;
    processingRef.current = true;
    setSyncing(true);

    try {
      const result = await processQueue(eventId, uploadPhotos, (progress) => {
        setSyncProgress(progress);
      });
      await refreshCount();
      return result;
    } finally {
      processingRef.current = false;
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [eventId, isOnline, refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0 && !processingRef.current) {
      syncQueue();
    }
  }, [isOnline, queueCount, syncQueue]);

  // Listen for service worker sync messages
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'SYNC_UPLOADS' && isOnline && !processingRef.current) {
        syncQueue();
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, [isOnline, syncQueue]);

  // Clear queue for this event
  const clearEventQueue = useCallback(async () => {
    await clearQueue(eventId);
    await refreshCount();
  }, [eventId, refreshCount]);

  return {
    isOnline,
    queueCount,
    syncing,
    syncProgress,
    queueFiles,
    syncQueue,
    clearEventQueue,
    refreshCount,
  };
}
