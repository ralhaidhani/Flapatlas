import type { AnatomicalSystemId, LoadedFileSourceOrigin } from './modelManifest';

export const MODEL_CACHE_DB_NAME = 'flapatlas-bp3d-v4';
const DB_VERSION = 1;
const STORE_NAME = 'glb_models';

export const OFFLINE_PACK_CACHE_VERSION = 'v12-4';
export const OFFLINE_PACK_CACHE_NAME = `flapatlas-offline-pack-${OFFLINE_PACK_CACHE_VERSION}`;

/** Legacy cache names purged automatically on boot */
const LEGACY_INDEXEDDB_NAMES = ['flapatlas-glb-cache-v1', 'flapatlas-glb-cache'];
const LEGACY_CACHE_STORAGE_NAMES = [
  'flapatlas-glb-cdn-cache',
  'flapatlas-local-3d-assets-cache',
  'flapatlas-bp3d-v4-cdn-cache',
  'google-fonts-cache',
  'gstatic-fonts-cache',
];

let legacyPurgePromise: Promise<void> | null = null;

export interface CachedGlbRecord {
  key: string;
  system: AnatomicalSystemId;
  fileName: string;
  sourceUrl: string;
  sourceKind: 'local' | 'remote' | 'uploaded';
  byteLength: number;
  cachedAtIso: string;
  buffer: ArrayBuffer;
}

export interface CachedGlbMetadata {
  key: string;
  system: AnatomicalSystemId;
  fileName: string;
  sourceUrl: string;
  sourceKind: 'local' | 'remote' | 'uploaded';
  byteLength: number;
  cachedAtIso: string;
}

export interface FetchGlbResult {
  buffer: ArrayBuffer;
  fromCache: boolean;
  sourceUrl: string;
  sourceOrigin: LoadedFileSourceOrigin;
  byteLength: number;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Purges older Z-Anatomy IndexedDB databases, removed font/CDN caches, and stale
 * offline-pack cache versions so outdated assets are cleaned up automatically.
 */
export function purgeLegacyModelCaches(): Promise<void> {
  if (legacyPurgePromise) return legacyPurgePromise;

  legacyPurgePromise = (async () => {
    if (hasIndexedDb()) {
      await Promise.all(
        LEGACY_INDEXEDDB_NAMES.map(
          (dbName) =>
            new Promise<void>((resolve) => {
              try {
                const req = indexedDB.deleteDatabase(dbName);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              } catch {
                resolve();
              }
            })
        )
      );
    }

    if (typeof caches !== 'undefined' && typeof caches.delete === 'function') {
      const toDelete = new Set<string>(LEGACY_CACHE_STORAGE_NAMES);
      if (typeof caches.keys === 'function') {
        try {
          const existing = await caches.keys();
          for (const key of existing) {
            if (key.startsWith('flapatlas-offline-pack-') && key !== OFFLINE_PACK_CACHE_NAME) {
              toDelete.add(key);
            }
          }
        } catch {
          // ignore
        }
      }
      await Promise.all(
        Array.from(toDelete).map(async (cacheName) => {
          try {
            await caches.delete(cacheName);
          } catch {
            // ignore in restricted contexts
          }
        })
      );
    }
  })();

  return legacyPurgePromise;
}

function openCacheDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  return purgeLegacyModelCaches().then(
    () =>
      new Promise((resolve) => {
        try {
          const req = indexedDB.open(MODEL_CACHE_DB_NAME, DB_VERSION);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

export async function getCachedGlb(key: string): Promise<CachedGlbRecord | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as CachedGlbRecord | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

export async function putCachedGlb(record: CachedGlbRecord): Promise<boolean> {
  const db = await openCacheDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    } finally {
      db.close();
    }
  });
}

export async function listCachedGlbs(): Promise<CachedGlbMetadata[]> {
  const db = await openCacheDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result as CachedGlbRecord[] | undefined) ?? [];
        resolve(all.map(({ buffer: _buf, ...meta }) => meta));
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    } finally {
      db.close();
    }
  });
}

export async function listCachedUploadedGlbs(): Promise<CachedGlbRecord[]> {
  const db = await openCacheDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result as CachedGlbRecord[] | undefined) ?? [];
        resolve(all.filter((r) => r.sourceKind === 'uploaded'));
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    } finally {
      db.close();
    }
  });
}

export async function clearCachedGlbs(sourceKind?: 'local' | 'remote' | 'uploaded'): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      if (!sourceKind) {
        store.clear();
      } else {
        const req = store.getAll();
        req.onsuccess = () => {
          const all = (req.result as CachedGlbRecord[] | undefined) ?? [];
          for (const rec of all) {
            if (rec.sourceKind === sourceKind) {
              store.delete(rec.key);
            }
          }
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    } finally {
      db.close();
    }
  });
}

async function readResponseWithProgress(
  resp: Response,
  sourceUrl: string,
  onBytesProgress?: (loadedBytes: number, totalBytes: number, sourceUrl: string) => void
): Promise<ArrayBuffer> {
  const headerLen = Number(resp.headers.get('content-length') || 0);
  const totalBytes = Number.isFinite(headerLen) && headerLen > 0 ? headerLen : 0;

  if (!resp.body || typeof resp.body.getReader !== 'function' || !onBytesProgress) {
    const buffer = await resp.arrayBuffer();
    if (onBytesProgress) {
      onBytesProgress(buffer.byteLength, Math.max(totalBytes, buffer.byteLength), sourceUrl);
    }
    return buffer;
  }

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loadedBytes += value.byteLength;
      onBytesProgress(loadedBytes, Math.max(totalBytes, loadedBytes), sourceUrl);
    }
  }

  const merged = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

/**
 * Fetches a GLB ArrayBuffer with IndexedDB `flapatlas-bp3d-v4` caching and
 * automatic fallback across candidate URLs (jsDelivr CDN -> GitHub Raw).
 */
export async function fetchGlbWithCache(params: {
  cacheKey: string;
  url: string;
  fallbackUrls?: string[];
  system: AnatomicalSystemId;
  fileName: string;
  sourceKind: 'local' | 'remote' | 'uploaded';
  skipCache?: boolean;
  signal?: AbortSignal;
  onBytesProgress?: (loadedBytes: number, totalBytes: number, sourceUrl: string) => void;
}): Promise<FetchGlbResult> {
  if (!params.skipCache) {
    const cached = await getCachedGlb(params.cacheKey);
    if (cached && cached.buffer && cached.buffer.byteLength > 12) {
      if (params.onBytesProgress) {
        params.onBytesProgress(cached.buffer.byteLength, cached.buffer.byteLength, cached.sourceUrl);
      }
      return {
        buffer: cached.buffer,
        fromCache: true,
        sourceUrl: cached.sourceUrl,
        sourceOrigin: 'Cache',
        byteLength: cached.buffer.byteLength,
      };
    }
  }

  const candidates = [params.url, ...(params.fallbackUrls || [])].filter(
    (u, idx, arr) => Boolean(u) && arr.indexOf(u) === idx
  );

  let lastError: Error | null = null;

  for (const candidateUrl of candidates) {
    if (params.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const isRemote = /^https?:\/\//i.test(candidateUrl);
      const resp = await fetch(candidateUrl, {
        mode: isRemote ? 'cors' : 'same-origin',
        signal: params.signal,
      });

      if (!resp.ok) {
        lastError = new Error(`HTTP ${resp.status} loading ${params.fileName} from ${candidateUrl}`);
        continue;
      }

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        lastError = new Error(`${params.fileName} not found at ${candidateUrl} (HTML response)`);
        continue;
      }

      const buffer = await readResponseWithProgress(resp, candidateUrl, params.onBytesProgress);
      if (buffer.byteLength < 12) {
        lastError = new Error(
          `${params.fileName} is empty or corrupted (${buffer.byteLength} bytes)`
        );
        continue;
      }

      // Validate glTF binary magic ("glTF" = 0x46546C67) when .glb
      if (params.fileName.toLowerCase().endsWith('.glb')) {
        const magic = new DataView(buffer).getUint32(0, true);
        if (magic !== 0x46546c67) {
          lastError = new Error(`${params.fileName} is not a valid GLB binary`);
          continue;
        }
      }

      await putCachedGlb({
        key: params.cacheKey,
        system: params.system,
        fileName: params.fileName,
        sourceUrl: candidateUrl,
        sourceKind: params.sourceKind,
        byteLength: buffer.byteLength,
        cachedAtIso: new Date().toISOString(),
        buffer,
      });

      return {
        buffer,
        fromCache: false,
        sourceUrl: candidateUrl,
        sourceOrigin: isRemote ? 'GitHub' : 'Local',
        byteLength: buffer.byteLength,
      };
    } catch (err) {
      if (params.signal?.aborted) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error(`Failed to fetch ${params.fileName}`);
}
