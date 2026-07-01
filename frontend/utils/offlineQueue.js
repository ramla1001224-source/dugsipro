/**
 * offlineQueue.js - IndexedDB-based queue for offline mutations
 *
 * Mutations (POST/PUT/PATCH/DELETE) made while offline are saved here.
 * When the app comes back online, the queue is flushed in order.
 */

const DB_NAME = 'dugsi-pro-offline';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';

/** Open (or create) the IndexedDB database */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Add a request to the queue */
export async function enqueueRequest(method, url, data, headers = {}) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      method: method.toUpperCase(),
      url,
      data: data ? JSON.stringify(data) : null,
      headers: JSON.stringify(headers),
      timestamp: Date.now(),
      retries: 0,
    };
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Get all pending items (ordered by timestamp ASC) */
export async function getPendingRequests() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const req = index.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Count pending items */
export async function getPendingCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a successfully synced item */
export async function removeRequest(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Clear all items (after full successful sync) */
export async function clearQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Flush the entire queue to the server.
 * @param {function} onProgress - called with (synced, total) after each item
 */
export async function flushQueue(onProgress) {
  const items = await getPendingRequests();
  if (!items.length) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const headers = item.headers ? JSON.parse(item.headers) : {};
      const body = item.data ? item.data : undefined;

      const fetchOptions = {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };
      if (body && item.method !== 'DELETE') {
        fetchOptions.body = body;
      }

      const response = await fetch(item.url, fetchOptions);
      if (response.ok || response.status === 409) {
        // 409 = conflict/duplicate, treat as done
        await removeRequest(item.id);
        success++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }

    if (onProgress) onProgress(success + failed, items.length);
  }

  return { success, failed };
}
