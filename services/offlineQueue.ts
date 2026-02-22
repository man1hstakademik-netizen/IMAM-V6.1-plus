/**
 * @license
 * IMAM System - Integrated Madrasah Academic Manager
 */

export interface QueueItem {
  key: string;
  attendanceId: string;
  fieldName: string;
  payload: any;
  createdAt: number;
  retryCount?: number;
  lastAttemptAt?: number;
  deviceId?: string;
}

const DB_NAME = 'imam-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'attendance_queue';
const FALLBACK_KEY = 'imam_attendance_queue_v2_fallback';

const hasIndexedDb = () => typeof window !== 'undefined' && !!window.indexedDB;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};



const getDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = openDb().then((db) => {
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      return db;
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
};

const readFallback = (): QueueItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeFallback = (items: QueueItem[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));
};

export const upsertQueueItem = async (item: QueueItem): Promise<void> => {
  if (!hasIndexedDb()) {
    const list = readFallback();
    const idx = list.findIndex(x => x.key === item.key);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    writeFallback(list);
    return;
  }

  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const list = readFallback();
    const idx = list.findIndex(x => x.key === item.key);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    writeFallback(list);
  }
};

export const getQueueItems = async (): Promise<QueueItem[]> => {
  if (!hasIndexedDb()) return readFallback();
  try {
    const db = await getDb();
    return await new Promise<QueueItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const rows = (req.result || []) as QueueItem[];
        rows.sort((a, b) => a.createdAt - b.createdAt);
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readFallback();
  }
};

export const deleteQueueItem = async (key: string): Promise<void> => {
  if (!hasIndexedDb()) {
    writeFallback(readFallback().filter(x => x.key !== key));
    return;
  }
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    writeFallback(readFallback().filter(x => x.key !== key));
  }
};

export const countQueueItems = async (): Promise<number> => {
  if (!hasIndexedDb()) return readFallback().length;
  try {
    const db = await getDb();
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readFallback().length;
  }
};
