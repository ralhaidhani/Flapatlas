import type { LandmarkAnchor } from './anchorSystem';
import type { TerritoryFieldData } from './territoryFieldCore';
import type { Vec3Tuple } from './territorySeeds';

/**
 * Phase 11b (§3.3) — IndexedDB persistence for the baked 3-D territory field.
 * Stores the active BP3D 4.0 field under key `territoryField-bp3d-4.0-v1`, alongside
 * a deterministic signature of visual weights & anchor calibration so edits trigger
 * a clean re-bake while subsequent app visits load instantaneously from IndexedDB.
 */

export const TERRITORY_FIELD_CACHE_DB = 'flapatlas-territory-field-v1';
export const TERRITORY_FIELD_CACHE_STORE = 'territory_fields';
export const TERRITORY_FIELD_CACHE_KEY = 'territoryField-bp3d-4.0-v1';

export interface CachedTerritoryFieldRecord {
  key: string;
  signature: string;
  cachedAtIso: string;
  version: string;
  dims: [number, number, number];
  boundsMin: Vec3Tuple;
  boundsMax: Vec3Tuple;
  voxelSizeMeters: number;
  voxelsBuffer: ArrayBuffer;
  neighborsBySlot: Record<number, number[]>;
  buildMs: number;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Computes a deterministic cache signature covering:
 * - cache version (`territoryField-bp3d-4.0-v1`)
 * - voxel size
 * - calibrated anchor positions (mm precision)
 * - visual Voronoi tuning weights (Editor-only constants)
 * - number of real vs schematic seed clusters
 */
export function computeTerritoryCacheSignature(params: {
  voxelSizeMeters: number;
  anchors: readonly LandmarkAnchor[];
  visualWeights: Readonly<Record<string, number>>;
  clusterCount: number;
  realSeedCount: number;
}): string {
  const anchorParts = [...params.anchors]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (a) =>
        `${a.id}:${a.position.map((n) => Math.round(n * 1000)).join(',')}`
    )
    .join('|');

  const weightParts = Object.entries(params.visualWeights)
    .filter(([, v]) => Number.isFinite(v) && Math.abs(v - 1.0) > 1e-4)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v.toFixed(3)}`)
    .join('|');

  const payload = [
    TERRITORY_FIELD_CACHE_KEY,
    `vs=${Math.round(params.voxelSizeMeters * 10000)}`,
    `cc=${params.clusterCount}`,
    `rs=${params.realSeedCount}`,
    `a=${anchorParts}`,
    `w=${weightParts}`,
  ].join('::');

  return `${TERRITORY_FIELD_CACHE_KEY}-${fnv1aHex(payload)}`;
}

function openTerritoryCacheDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(TERRITORY_FIELD_CACHE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TERRITORY_FIELD_CACHE_STORE)) {
          db.createObjectStore(TERRITORY_FIELD_CACHE_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadCachedTerritoryField(
  expectedSignature: string
): Promise<TerritoryFieldData | null> {
  const db = await openTerritoryCacheDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TERRITORY_FIELD_CACHE_STORE, 'readonly');
      const store = tx.objectStore(TERRITORY_FIELD_CACHE_STORE);
      const req = store.get(TERRITORY_FIELD_CACHE_KEY);
      req.onsuccess = () => {
        const rec = req.result as CachedTerritoryFieldRecord | undefined;
        if (!rec || rec.signature !== expectedSignature || !(rec.voxelsBuffer instanceof ArrayBuffer)) {
          resolve(null);
          return;
        }
        const expectedLen = rec.dims[0] * rec.dims[1] * rec.dims[2] * 4;
        if (rec.voxelsBuffer.byteLength !== expectedLen) {
          resolve(null);
          return;
        }
        resolve({
          version: rec.version,
          dims: rec.dims,
          boundsMin: rec.boundsMin,
          boundsMax: rec.boundsMax,
          voxelSizeMeters: rec.voxelSizeMeters,
          voxels: new Uint8Array(rec.voxelsBuffer),
          neighborsBySlot: rec.neighborsBySlot,
          buildMs: rec.buildMs,
        });
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveCachedTerritoryField(
  field: TerritoryFieldData,
  signature: string
): Promise<boolean> {
  const db = await openTerritoryCacheDb();
  if (!db) return false;

  // Store a clean ArrayBuffer copy so caller retains ownership of `field.voxels`
  const voxelsCopy = new Uint8Array(field.voxels.byteLength);
  voxelsCopy.set(field.voxels);
  const voxelsBuffer: ArrayBuffer = voxelsCopy.buffer;

  const record: CachedTerritoryFieldRecord = {
    key: TERRITORY_FIELD_CACHE_KEY,
    signature,
    cachedAtIso: new Date().toISOString(),
    version: field.version,
    dims: field.dims,
    boundsMin: field.boundsMin,
    boundsMax: field.boundsMax,
    voxelSizeMeters: field.voxelSizeMeters,
    voxelsBuffer,
    neighborsBySlot: field.neighborsBySlot,
    buildMs: field.buildMs,
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TERRITORY_FIELD_CACHE_STORE, 'readwrite');
      const store = tx.objectStore(TERRITORY_FIELD_CACHE_STORE);
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function clearCachedTerritoryField(): Promise<void> {
  const db = await openTerritoryCacheDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(TERRITORY_FIELD_CACHE_STORE, 'readwrite');
      const store = tx.objectStore(TERRITORY_FIELD_CACHE_STORE);
      const req = store.delete(TERRITORY_FIELD_CACHE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
