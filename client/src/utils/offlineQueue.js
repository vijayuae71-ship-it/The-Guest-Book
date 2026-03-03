// Offline Upload Queue using IndexedDB

const DB_NAME = 'guestbook-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-uploads';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('eventId', 'eventId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addToQueue(eventId, files, userId, userName) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const entries = [];
  for (const file of files) {
    // Store the file as ArrayBuffer since File objects can't be stored in IndexedDB reliably
    const arrayBuffer = await file.arrayBuffer();
    const entry = {
      eventId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData: arrayBuffer,
      userId,
      userName,
      createdAt: new Date().toISOString(),
      status: 'pending', // pending | uploading | failed
      retries: 0,
    };
    store.add(entry);
    entries.push(entry);
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  return entries;
}

export async function getQueuedUploads(eventId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('eventId');

  return new Promise((resolve, reject) => {
    const request = eventId ? index.getAll(eventId) : store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function removeFromQueue(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearQueue(eventId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  if (eventId) {
    const index = store.index('eventId');
    const request = index.openCursor(eventId);
    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } else {
    store.clear();
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function processQueue(eventId, uploadFn, onProgress) {
  const items = await getQueuedUploads(eventId);
  const pending = items.filter(i => i.status === 'pending' || i.status === 'failed');

  if (pending.length === 0) return { uploaded: 0, failed: 0 };

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    onProgress?.({ current: i + 1, total: pending.length, fileName: item.fileName });

    try {
      // Reconstruct a File object from the stored ArrayBuffer
      const file = new File([item.fileData], item.fileName, { type: item.fileType });
      const formData = new FormData();
      formData.append('photos', file);
      if (item.userId) formData.append('uploaderId', item.userId);
      if (item.userName) formData.append('uploaderName', item.userName);

      await uploadFn(item.eventId, formData);
      await removeFromQueue(item.id);
      uploaded++;
    } catch (err) {
      console.error('[OfflineQueue] Upload failed for:', item.fileName, err);
      failed++;
      // Update retry count
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record = await new Promise((resolve) => {
          const r = store.get(item.id);
          r.onsuccess = () => resolve(r.result);
        });
        if (record) {
          record.retries = (record.retries || 0) + 1;
          record.status = 'failed';
          store.put(record);
        }
        await new Promise((resolve) => { tx.oncomplete = resolve; });
        db.close();
      } catch (e) {
        // ignore update error
      }
    }
  }

  return { uploaded, failed };
}

export function getQueueCount(eventId) {
  return getQueuedUploads(eventId).then(items => items.length).catch(() => 0);
}
