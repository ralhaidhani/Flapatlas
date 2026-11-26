import * as THREE from 'three';
import type { LandmarkAnchor } from './anchorSystem';
import type { LoadedGlbBody } from './glbLoader';
import {
  runTerritoryMuscleCalibration,
  type TerritoryCalibrationReport,
} from './territoryCalibration';
import {
  computeTerritoryCacheSignature,
  loadCachedTerritoryField,
  saveCachedTerritoryField,
  TERRITORY_FIELD_CACHE_KEY,
} from './territoryFieldCache';
import {
  bakeTerritoryField3D,
  type TerritoryFieldBakeInput,
  type TerritoryFieldData,
} from './territoryFieldCore';
import type {
  TerritoryWorkerBakeRequest,
  TerritoryWorkerOutboundMessage,
} from './territoryFieldWorker';
import {
  buildTerritorySeedsFromLoadedBody,
  extractSkinEnvelopeSamples,
} from './territorySeeds';
import {
  buildVertexColorTerritoryFallbackMesh,
  createTerritoryShaderResources,
  disposeTerritoryGpuResources,
  patchMaterialWithTerritoryField,
  type TerritoryGpuResources,
  type TerritoryShaderTissueKind,
} from './territoryShader';

/**
 * Phase 11b (§3.3) — Territory Field Engine Orchestrator.
 *
 * Coordinates:
 * 1. Seed extraction from loaded BP3D 4.0 `arteries` + calibrated landmarks
 * 2. IndexedDB cache lookup (`territoryField-bp3d-4.0-v1`)
 * 3. Non-blocking Web Worker bake on cache miss (with automatic main-thread fallback)
 * 4. GPU `Data3DTexture` + PBR shader patching (or per-vertex fallback if `!isWebGL2`)
 * 5. Automated muscle calibration audit against Tables 23.2 & 23.3
 */

export interface TerritoryFieldBuildResult {
  field: TerritoryFieldData;
  fromCache: boolean;
  cacheKey: string;
  cacheSignature: string;
  realSeedTerritoryCount: number;
  schematicSeedTerritoryCount: number;
  clusterCount: number;
  unresolvedFjs: Array<{ territoryId: string; missingFjs: string[] }>;
  calibrationReport: TerritoryCalibrationReport;
}

export interface TerritoryFieldProgressUpdate {
  pct: number;
  label: string;
}

let nextWorkerRequestId = 1;

function bakeFieldInWorker(
  input: TerritoryFieldBakeInput,
  onProgress?: (update: TerritoryFieldProgressUpdate) => void,
  signal?: AbortSignal
): Promise<TerritoryFieldData> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(
      bakeTerritoryField3D(input, (pct, label) => onProgress?.({ pct, label }))
    );
  }

  return new Promise<TerritoryFieldData>((resolve, reject) => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('./territoryFieldWorker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      // Fallback gracefully if bundled environment forbids module workers
      resolve(bakeTerritoryField3D(input, (pct, label) => onProgress?.({ pct, label })));
      return;
    }

    const requestId = nextWorkerRequestId++;
    let settled = false;

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
        worker = null;
      }
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException('Territory field bake cancelled', 'AbortError'));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    worker.onmessage = (ev: MessageEvent<TerritoryWorkerOutboundMessage>) => {
      const msg = ev.data;
      if (!msg || msg.requestId !== requestId) return;
      if (msg.type === 'progress') {
        onProgress?.({ pct: msg.pct, label: msg.label });
      } else if (msg.type === 'done') {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(msg.field);
      } else if (msg.type === 'error') {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(msg.message));
      }
    };

    const fallbackToMainThread = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        resolve(bakeTerritoryField3D(input, (pct, label) => onProgress?.({ pct, label })));
      } catch (err) {
        reject(err);
      }
    };

    worker.onerror = fallbackToMainThread;
    worker.onmessageerror = fallbackToMainThread;

    const payload: TerritoryWorkerBakeRequest = {
      type: 'bake',
      requestId,
      input,
    };

    worker.postMessage(payload);
  });
}

/**
 * Builds or loads the 3-D territory field from IndexedDB for a loaded BodyParts3D 4.0 body.
 */
export async function buildOrLoadTerritoryField(params: {
  body: LoadedGlbBody;
  anchors: readonly LandmarkAnchor[];
  visualWeights?: Readonly<Record<string, number>>;
  voxelSizeMeters?: number;
  forceRebuild?: boolean;
  onProgress?: (update: TerritoryFieldProgressUpdate) => void;
  signal?: AbortSignal;
}): Promise<TerritoryFieldBuildResult> {
  const {
    body,
    anchors,
    visualWeights = {},
    voxelSizeMeters = 0.008,
    forceRebuild = false,
    onProgress,
    signal,
  } = params;

  onProgress?.({ pct: 5, label: 'Building vascular territory field…' });

  const seeds = buildTerritorySeedsFromLoadedBody({
    body,
    anchors,
    visualWeights,
  });

  const cacheSignature = computeTerritoryCacheSignature({
    voxelSizeMeters,
    anchors,
    visualWeights,
    clusterCount: seeds.clusters.length,
    realSeedCount: seeds.realSeedTerritoryCount,
  });

  let field: TerritoryFieldData | null = null;
  let fromCache = false;

  if (!forceRebuild) {
    field = await loadCachedTerritoryField(cacheSignature);
    if (field) {
      fromCache = true;
      onProgress?.({ pct: 96, label: 'Loaded vascular territory field from cache' });
    }
  }

  if (signal?.aborted) {
    throw new DOMException('Territory field build cancelled', 'AbortError');
  }

  if (!field) {
    const skinPoints = extractSkinEnvelopeSamples(body);
    const bakeInput: TerritoryFieldBakeInput = {
      boundsMin: seeds.landmarks.bodyBoundsMin,
      boundsMax: seeds.landmarks.bodyBoundsMax,
      voxelSizeMeters,
      landmarks: seeds.landmarks,
      clusters: seeds.clusters,
      skinPoints: skinPoints.length >= 9 ? skinPoints : undefined,
    };

    field = await bakeFieldInWorker(bakeInput, onProgress, signal);

    if (signal?.aborted) {
      throw new DOMException('Territory field build cancelled', 'AbortError');
    }

    // Persist asynchronously (non-blocking)
    void saveCachedTerritoryField(field, cacheSignature);
  }

  const calibrationReport = runTerritoryMuscleCalibration({
    field,
    allSubMeshes: body.allSubMeshes,
    body,
  });

  onProgress?.({ pct: 100, label: 'Vascular territory field ready' });

  return {
    field,
    fromCache,
    cacheKey: TERRITORY_FIELD_CACHE_KEY,
    cacheSignature,
    realSeedTerritoryCount: seeds.realSeedTerritoryCount,
    schematicSeedTerritoryCount: seeds.schematicSeedTerritoryCount,
    clusterCount: seeds.clusters.length,
    unresolvedFjs: seeds.unresolvedFjs,
    calibrationReport,
  };
}

/**
 * Attaches the territory field shader (WebGL2 `Data3DTexture`) or per-vertex color
 * fallback mesh (WebGL1) to the loaded BP3D body.
 *
 * Always initializes with `uTerritoryEnabled = 0` so Mode Off is 100% identical to Phase 10.
 */
export function attachTerritoryResourcesToBody(params: {
  body: LoadedGlbBody;
  field: TerritoryFieldData;
  isWebGL2: boolean;
  colorblindMode: boolean;
}): TerritoryGpuResources {
  const { body, field, isWebGL2, colorblindMode } = params;
  const resources = createTerritoryShaderResources(field, colorblindMode);

  if (isWebGL2) {
    const patchSystem = (
      systemId: 'skin' | 'muscles' | 'skeleton',
      tissueKind: TerritoryShaderTissueKind
    ) => {
      const grp = body.systemGroups[systemId];
      if (!grp) return;
      grp.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (mat instanceof THREE.MeshStandardMaterial) {
            patchMaterialWithTerritoryField(mat, resources.uniforms, tissueKind);
          }
        }
      });
    };

    patchSystem('skin', 'skin');
    patchSystem('muscles', 'muscle');
    patchSystem('skeleton', 'bone');
  } else {
    // Graceful WebGL1 fallback: per-vertex color copy of the skin mesh (hidden while Mode Off)
    const skinGroup = body.systemGroups.skin;
    let firstSkinMesh: THREE.Mesh | null = null;
    if (skinGroup) {
      skinGroup.traverse((obj) => {
        if (!firstSkinMesh && (obj as THREE.Mesh).isMesh) {
          firstSkinMesh = obj as THREE.Mesh;
        }
      });
    }
    if (firstSkinMesh) {
      const fallback = buildVertexColorTerritoryFallbackMesh(
        firstSkinMesh,
        field,
        colorblindMode
      );
      resources.fallbackMesh = fallback;
      body.root.add(fallback);
    }
  }

  return resources;
}

export function detachAndDisposeTerritoryResources(
  body: LoadedGlbBody | null,
  resources: TerritoryGpuResources | null
): void {
  if (!resources) return;
  if (resources.fallbackMesh && body) {
    body.root.remove(resources.fallbackMesh);
  }
  disposeTerritoryGpuResources(resources);
}
