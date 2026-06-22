import type { Channel } from '../types/index.ts';

const DB_NAME = 'iptv-db';
const DB_VERSION = 1;
const STORE_NAME = 'channels-store';
const KEY_NAME = 'channels-list';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const CHUNK_SIZE = 5000;

/**
 * Saves the channels array to the IndexedDB store in chunks of 5000 items.
 */
export async function saveChannelsToDB(channels: Channel[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Clear the store first to remove old chunks/keys
      const clearReq = store.clear();

      clearReq.onsuccess = () => {
        try {
          const total = channels.length;
          let chunkIndex = 0;
          for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = channels.slice(i, i + CHUNK_SIZE);
            store.put(chunk, `chunk-${chunkIndex}`);
            chunkIndex++;
          }
          // Save the chunk count for loading
          store.put(chunkIndex, 'chunk-count');
        } catch (err) {
          reject(err);
        }
      };

      clearReq.onerror = () => reject(clearReq.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('[DB] Failed to save channels to IndexedDB:', error);
  }
}

/**
 * Loads the channels array from IndexedDB. Returns null if not found.
 * Supports fallback to the old single-key structure if chunk-count is not found.
 */
export async function loadChannelsFromDB(): Promise<Channel[] | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countReq = store.get('chunk-count');

      countReq.onsuccess = () => {
        const chunkCount = countReq.result as number | undefined;

        // Fallback for backward compatibility if old data exists under channels-list
        if (chunkCount === undefined) {
          const oldReq = store.get(KEY_NAME);
          oldReq.onsuccess = () => {
            if (oldReq.result) {
              resolve(oldReq.result);
            } else {
              resolve(null);
            }
          };
          oldReq.onerror = () => resolve(null);
          return;
        }

        if (chunkCount === 0) {
          resolve([]);
          return;
        }

        const chunks: Channel[][] = [];
        let loadedCount = 0;
        let failed = false;

        for (let i = 0; i < chunkCount; i++) {
          const req = store.get(`chunk-${i}`);
          req.onsuccess = () => {
            if (failed) return;
            chunks[i] = req.result as Channel[];
            loadedCount++;
            if (loadedCount === chunkCount) {
              resolve(chunks.flat());
            }
          };
          req.onerror = () => {
            failed = true;
            reject(req.error);
          };
        }
      };

      countReq.onerror = () => reject(countReq.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('[DB] Failed to load channels from IndexedDB:', error);
    return null;
  }
}

/**
 * Clears all stored data in IndexedDB.
 */
export async function clearChannelsDB(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[DB] Failed to clear IndexedDB:', error);
  }
}

