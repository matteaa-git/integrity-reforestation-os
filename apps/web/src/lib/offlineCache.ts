/**
 * offlineCache.ts
 *
 * IndexedDB-backed cache that mirrors the productionDb `app_data` rows. Used
 * to serve reads from local storage when Supabase is unreachable, and to
 * keep the UI snappy when it is.
 *
 * Strategy:
 *   Online  → sb fetch wins; cache is updated as a side-effect.
 *   Offline → cache is read directly; UI shows the last-known snapshot.
 *
 * One IDBDatabase, one object store keyed by "<table>:<id>", with a secondary
 * index on `table` so we can quickly grab every record for a given table.
 */

const CACHE_DB    = "integrity_offline_cache";
const CACHE_STORE = "records";
const DB_VERSION  = 1;

interface CacheRow {
  key: string;          // `${table}:${id}`
  table: string;
  id: string;
  data: unknown;
  cachedAt: number;
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        const store = db.createObjectStore(CACHE_STORE, { keyPath: "key" });
        store.createIndex("table", "table", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error ?? new Error("offlineCache open failed"));
  });
  return dbPromise;
}

/** All records previously cached for a given table. Empty list if none. */
export async function getCachedAll<T>(table: string): Promise<T[]> {
  if (!hasIndexedDB()) return [];
  try {
    const db = await openDb();
    return await new Promise<T[]>((resolve, reject) => {
      const tx    = db.transaction(CACHE_STORE, "readonly");
      const index = tx.objectStore(CACHE_STORE).index("table");
      const req   = index.getAll(table);
      req.onsuccess = () => resolve((req.result as CacheRow[]).map(r => r.data as T));
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[offlineCache] getCachedAll failed:", table, err);
    return [];
  }
}

/** Replace every record for `table` with the supplied set, atomically. */
export async function setCachedAll<T extends { id: string }>(
  table: string,
  records: T[],
): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx     = db.transaction(CACHE_STORE, "readwrite");
      const store  = tx.objectStore(CACHE_STORE);
      const index  = store.index("table");
      const cursor = index.openCursor(IDBKeyRange.only(table));
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c) {
          c.delete();
          c.continue();
        } else {
          // Cursor exhausted — insert fresh records in the same tx.
          for (const r of records) {
            store.put({
              key: `${table}:${r.id}`,
              table,
              id: r.id,
              data: r,
              cachedAt: Date.now(),
            } satisfies CacheRow);
          }
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[offlineCache] setCachedAll failed:", table, err);
  }
}

/** Insert or update a single record. Used after a successful write. */
export async function cacheRecord<T extends { id: string }>(
  table: string,
  record: T,
): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).put({
        key: `${table}:${record.id}`,
        table,
        id: record.id,
        data: record,
        cachedAt: Date.now(),
      } satisfies CacheRow);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[offlineCache] cacheRecord failed:", table, record.id, err);
  }
}

/** Remove a single record by id. Used after a successful delete. */
export async function removeCachedRecord(table: string, id: string): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).delete(`${table}:${id}`);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[offlineCache] removeCachedRecord failed:", table, id, err);
  }
}

/** True when the browser believes it has a network connection. */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
