import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getAnatomyPalette } from './bodyModelConfig';
import {
  AnatomicalSystemId,
  LoadedFileSourceOrigin,
  ModelManifestEntry,
  SYSTEM_LOAD_ORDER,
  getBundledDracoPath,
  groupManifestByStage,
} from './modelManifest';
import { BoundingBoxSummary, SharedBodyNormalization, mergeBoundingBoxes } from './modelNormalization';
import { fetchGlbWithCache, CachedGlbRecord } from './modelCache';
import {
  AnatomyMapperContext,
  Laterality,
  MeshMappingReport,
  buildMeshMappingReport,
  mapMeshNameToAnatomy,
} from './anatomyMap';
import { isAlignedSystem } from './vesselAlignment';

export type TissueMaterialBucket =
  | 'bone'
  | 'cartilage'
  | 'muscle'
  | 'tendon'
  | 'organ'
  | 'nerve'
  | 'artery'
  | 'vein'
  | 'skin'
  | 'fascia'
  | 'other';

export interface BodyParts3DNodeExtras {
  fj?: string;
  fma?: string;
  name: string;
  side: Laterality;
  system?: string;
}

export interface LoadedSystemFileStats {
  system: AnatomicalSystemId;
  fileName: string;
  source: LoadedFileSourceOrigin;
  sourceUrl: string;
  meshCount: number;
  triangleCount: number;
  byteLength: number;
  sizeMB: number;
  isLegacyZAnatomy: boolean;
}

export interface MergedSubMeshRecord {
  meshKey: string;
  subMeshIndex: number;
  meshName: string;
  normalizedName?: string;
  system: AnatomicalSystemId;
  materialBucket: TissueMaterialBucket;
  anatomyId: string;
  label: string;
  category: string;
  laterality: Laterality;
  mapped: boolean;
  linkedFlapIds: string[];
  sourceModel?: 'z-anatomy' | 'bodyparts3d';
  fjCode?: string;
  fmaCode?: string;
  groupId?: string;
  groupLabel?: string;
  partLabel?: string;
  vertexStart: number;
  vertexCount: number;
  indexStart: number;
  indexCount: number;
  center: [number, number, number];
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
}

export interface LoadedGlbBody {
  root: THREE.Group;
  /** Shared parent group for aligned systems (identity when unified BP3D 4.0 is loaded) */
  bp3dAlignmentGroup: THREE.Group;
  /** Base local-space pivot [x, y, z] in meters for uniform alignment scaling of bp3dAlignmentGroup */
  bp3dAlignmentPivot: [number, number, number];
  systemGroups: Partial<Record<AnatomicalSystemId, THREE.Group>>;
  /** Merged per-bucket meshes (low draw calls) ready for raycasting */
  interactiveMeshes: THREE.Object3D[];
  /** Complete catalog of every anatomical structure across merged buffers */
  allSubMeshes: MergedSubMeshRecord[];
  loadedSystems: AnatomicalSystemId[];
  /** Per-file telemetry for About/Credits & Model Manager Loaded Files Table */
  loadedFiles: LoadedSystemFileStats[];
  /** True only if any loaded mesh originated from a legacy Z-Anatomy GLB */
  hasLegacyZAnatomy: boolean;
  /** Total logical anatomical structures */
  meshCount: number;
  /** Actual WebGL draw calls emitted by the real anatomical model */
  drawCallCount: number;
  /** True if root was rotated 180° around Y so anterior faces +Z */
  orientationRotatedY: boolean;
  /** Exact measured height in meters (real 1:1 scale — NO rescaling applied) */
  detectedHeightMeters: number;
  normalization: SharedBodyNormalization;
  mappingReport: MeshMappingReport;
  updatePalette: (colorblindMode: boolean) => void;
  dispose: () => void;
}

export interface ProgressiveLoadProgress {
  stageLabel: string;
  loadedSystems: AnatomicalSystemId[];
  loadedCount: number;
  totalCount: number;
  pct: number;
  currentFile?: string;
  currentSourceUrl?: string;
  fromCache?: boolean;
  loadedBytes?: number;
  totalBytes?: number;
  failedSystems: Array<{ system: AnatomicalSystemId; error: string }>;
}

export interface ProgressiveModelPackOptions {
  entries: ModelManifestEntry[];
  sourceKind: CachedGlbRecord['sourceKind'];
  sourceLabel: string;
  mapperContext: AnatomyMapperContext;
  colorblindMode?: boolean;
  /** Optional pre-loaded binary buffers keyed by manifest entry id (e.g., uploaded files) */
  preloadedBuffers?: Record<string, ArrayBuffer>;
  /** Keep real 1:1 meter scale (default true for Z-Anatomy files — do NOT rescale) */
  preserveRealScale?: boolean;
  /** Merge static sub-meshes per system/material into single meshes with `aMeshIndex` (default true) */
  mergeStaticGeometry?: boolean;
  /** Compute smooth vertex normals via mergeVertices + computeVertexNormals (default true) */
  smoothNormals?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: ProgressiveLoadProgress) => void;
  onStageReady?: (partialBody: LoadedGlbBody) => void;
}

let sharedDracoLoader: DRACOLoader | null = null;

function createConfiguredGltfLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
    // Served offline-first from /public/draco/ relative to import.meta.env.BASE_URL
    sharedDracoLoader.setDecoderPath(getBundledDracoPath());
  }
  loader.setDRACOLoader(sharedDracoLoader);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

interface ParsedGlbResult {
  scene: THREE.Group;
  originalNames: WeakMap<THREE.Object3D, string>;
  originalExtras: WeakMap<THREE.Object3D, Record<string, unknown>>;
}

function normalizeBodyParts3DSide(raw: unknown): Laterality {
  if (typeof raw !== 'string') return 'midline';
  const lower = raw.trim().toLowerCase();
  if (lower === 'left' || lower === 'l' || lower === 'sinister') return 'left';
  if (lower === 'right' || lower === 'r' || lower === 'dexter') return 'right';
  return 'midline';
}

function stripBracketedFjCode(raw: string): { cleanName: string; fjFromName?: string } {
  const match = raw.trim().match(/^(.+?)\s*\[(FJ[A-Za-z0-9_-]+)\]$/i);
  if (match) {
    return {
      cleanName: match[1].trim(),
      fjFromName: match[2].toUpperCase(),
    };
  }
  return { cleanName: raw.trim() };
}

/**
 * Extracts BodyParts3D 4.0 `node.extras = { fj, fma, name, side, system }` from
 * Three.js `userData` / parent `userData` / raw glTF JSON node extras, with safe
 * fallback parsing of `"<name> [FJxxxx]"` node names. Never returns raw `[FJxxxx]`
 * in the display `name`.
 */
export function parseBodyParts3DNodeExtras(
  rawName: string,
  userData?: Record<string, unknown> | null,
  jsonNodeExtras?: Record<string, unknown> | null,
  parentUserData?: Record<string, unknown> | null
): BodyParts3DNodeExtras | null {
  const sources = [userData, jsonNodeExtras, parentUserData].filter(
    (s): s is Record<string, unknown> => Boolean(s && typeof s === 'object')
  );

  let fj: string | undefined;
  let fma: string | undefined;
  let name: string | undefined;
  let sideRaw: unknown;
  let system: string | undefined;

  for (const src of sources) {
    if (!fj && typeof src.fj === 'string' && src.fj.trim()) fj = src.fj.trim().toUpperCase();
    if (!fma && typeof src.fma === 'string' && src.fma.trim()) fma = src.fma.trim();
    if (!name && typeof src.name === 'string' && src.name.trim()) name = src.name.trim();
    if (sideRaw === undefined && typeof src.side === 'string' && src.side.trim()) {
      sideRaw = src.side;
    }
    if (!system && typeof src.system === 'string' && src.system.trim()) {
      system = src.system.trim().toLowerCase();
    }
  }

  const parsedFromName = stripBracketedFjCode(rawName);
  if (!fj && parsedFromName.fjFromName) {
    fj = parsedFromName.fjFromName;
  }

  const hasBp3dSignal = Boolean(fj || fma || (name && sideRaw !== undefined));
  if (!hasBp3dSignal) return null;

  const cleanName = stripBracketedFjCode(name || parsedFromName.cleanName || rawName).cleanName;
  return {
    fj,
    fma,
    name: cleanName || 'Unnamed structure',
    side: normalizeBodyParts3DSide(sideRaw),
    system,
  };
}

/**
 * Recovers exact unsanitized Z-Anatomy / BodyParts3D names and glTF `node.extras`
 * before Three.js `PropertyBinding.sanitizeNodeName` alters punctuation.
 * Prefers `node.name` BEFORE `mesh.name` because bilateral mirrored Z-Anatomy nodes share
 * a single mesh name while the node carries the `.l` / `.r` / `.er` / `.ol` side suffix.
 */
function extractOriginalGltfMetadata(gltf: {
  scene: THREE.Group;
  parser?: {
    associations?: Map<unknown, unknown>;
    json?: {
      nodes?: Array<{ name?: string; mesh?: number; extras?: Record<string, unknown> }>;
      meshes?: Array<{ name?: string; extras?: Record<string, unknown> }>;
    };
  };
}): {
  originalNames: WeakMap<THREE.Object3D, string>;
  originalExtras: WeakMap<THREE.Object3D, Record<string, unknown>>;
} {
  const originalNames = new WeakMap<THREE.Object3D, string>();
  const originalExtras = new WeakMap<THREE.Object3D, Record<string, unknown>>();
  const associations = gltf.parser?.associations;
  const json = gltf.parser?.json;
  if (!associations || !json) return { originalNames, originalExtras };

  gltf.scene.traverse((obj) => {
    const assoc = associations.get(obj) as { nodes?: number; meshes?: number } | undefined;
    let raw: string | undefined;
    let extras: Record<string, unknown> | undefined;

    if (assoc) {
      if (typeof assoc.nodes === 'number') {
        const nodeJson = json.nodes?.[assoc.nodes];
        if (nodeJson?.name) raw = nodeJson.name;
        if (nodeJson?.extras && typeof nodeJson.extras === 'object') extras = nodeJson.extras;
      }
      if (!raw && typeof assoc.meshes === 'number' && json.meshes?.[assoc.meshes]?.name) {
        raw = json.meshes[assoc.meshes].name;
      }
      if (!extras && typeof assoc.meshes === 'number' && json.meshes?.[assoc.meshes]?.extras) {
        extras = json.meshes[assoc.meshes].extras;
      }
    }
    if ((!raw || !extras) && obj.parent) {
      const parentAssoc = associations.get(obj.parent) as
        | { nodes?: number; meshes?: number }
        | undefined;
      if (typeof parentAssoc?.nodes === 'number') {
        const parentNodeJson = json.nodes?.[parentAssoc.nodes];
        if (!raw && parentNodeJson?.name) raw = parentNodeJson.name;
        if (!extras && parentNodeJson?.extras && typeof parentNodeJson.extras === 'object') {
          extras = parentNodeJson.extras;
        }
      }
    }
    if (raw) {
      originalNames.set(obj, raw);
    }
    if (extras) {
      originalExtras.set(obj, extras);
    }
  });

  return { originalNames, originalExtras };
}

function parseGlbBuffer(loader: GLTFLoader, buffer: ArrayBuffer): Promise<ParsedGlbResult> {
  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (gltf) => {
        const { originalNames, originalExtras } = extractOriginalGltfMetadata(
          gltf as unknown as Parameters<typeof extractOriginalGltfMetadata>[0]
        );
        resolve({ scene: gltf.scene, originalNames, originalExtras });
      },
      (err) => reject(err instanceof Error ? err : new Error(String(err)))
    );
  });
}

/**
 * Classifies each mesh into a fine-grained PBR material bucket so tendons & aponeuroses
 * render pearl white while muscle bellies render deep red, bone renders ivory, cartilage
 * renders pale blue-ivory, organs render pinkish, and nerves render yellow.
 */
export function classifyMaterialBucket(
  system: AnatomicalSystemId,
  rawName: string
): TissueMaterialBucket {
  const lower = rawName.toLowerCase();
  if (system === 'muscles') {
    // Keep Tensor fasciae latae muscle belly in the deep-red muscle bucket
    if (/tensor\s+fascia/i.test(lower)) {
      return /\.(o|e)\d*(r|l)?$/i.test(lower) ? 'tendon' : 'muscle';
    }
    // Outer investing fascia sheaths & intermuscular septa go to the toggleable fascia layer
    if (/\bfascia\b|\bfascial\b|\binvesting\b|\bseptum\b|\bsubcutaneous\b/i.test(lower)) {
      return 'fascia';
    }
    // True tendons, aponeuroses, retinacula, sheaths, ligaments & muscular insertions -> pearl white
    if (
      /tendon|tendo|aponeuro|retinac|vagina|ligament|insertion|linea alba|tract|band|\.(o|e)\d*(r|l)?$/i.test(
        lower
      )
    ) {
      return 'tendon';
    }
    return 'muscle';
  }
  if (system === 'skeleton') {
    if (/cartilage|menisc|disc|labrum|ligament|capsule|synovial|membrane|bursa/i.test(lower)) {
      return 'cartilage';
    }
    return 'bone';
  }
  if (system === 'veins') {
    // Keep liver hepatovenous segment meshes classified as organs, never veins
    if (/hepatovenous\s+segment/i.test(lower)) return 'organ';
    return 'vein';
  }
  if (system === 'organs') return 'organ';
  if (system === 'nerves') return 'nerve';
  if (system === 'arteries') return 'artery';
  if (system === 'skin') return 'skin';
  if (system === 'fascia') return 'fascia';
  return 'other';
}

function isZAnatomyFloatingTextLabel(rawName: string): boolean {
  return /\.g$/i.test(rawName.trim());
}

export function getBucketColorHex(bucket: TissueMaterialBucket, colorblindMode: boolean): number {
  const pal = getAnatomyPalette(colorblindMode);
  if (colorblindMode) {
    switch (bucket) {
      case 'bone':
        return pal.bone;
      case 'cartilage':
        return 0xdce4ea;
      case 'muscle':
        return pal.muscle;
      case 'tendon':
        return 0xf3efe6;
      case 'organ':
        return pal.organs;
      case 'nerve':
        return pal.nerve;
      case 'artery':
        return pal.artery;
      case 'vein':
        return pal.vein;
      case 'skin':
        return pal.skin;
      case 'fascia':
        return pal.fascia;
      default:
        return pal.other;
    }
  }
  switch (bucket) {
    case 'bone':
      return 0xede5d4; // Warm anatomical ivory
    case 'cartilage':
      return 0xd9e2e6; // Pale pearl-blue cartilage & joint capsules
    case 'muscle':
      return 0x942426; // Deep anatomical crimson-red muscle belly
    case 'tendon':
      return 0xf2eee5; // Pearl white tendons, aponeuroses & insertions
    case 'organ':
      return 0xd87986; // Pinkish viscera & parenchyma
    case 'nerve':
      return 0xe8c32a; // Anatomical nerve yellow
    case 'artery':
      return 0xd62424; // Saturated arterial crimson-red (BodyParts3D)
    case 'vein':
      return 0x1b4fb8; // Deep anatomical venous blue (BodyParts3D)
    case 'skin':
      return 0xebd0be; // Pale translucent whole-body skin surface
    case 'fascia':
      return 0xe5e0d8; // Translucent fibrous investing fascia
    default:
      return pal.other;
  }
}

export function createBucketMaterial(
  bucket: TissueMaterialBucket,
  colorblindMode: boolean
): THREE.MeshStandardMaterial {
  const color = getBucketColorHex(bucket, colorblindMode);
  switch (bucket) {
    case 'skin':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.02,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    case 'bone':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.56,
        metalness: 0.03,
      });
    case 'cartilage':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.42,
        metalness: 0.04,
      });
    case 'muscle':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.48,
        metalness: 0.04,
      });
    case 'tendon':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.34,
        metalness: 0.06,
      });
    case 'organ':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.42,
        metalness: 0.05,
      });
    case 'nerve':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.38,
        metalness: 0.04,
      });
    case 'artery':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.34,
        metalness: 0.08,
      });
    case 'vein':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.38,
        metalness: 0.06,
      });
    case 'fascia':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.08,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      });
    default:
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.56,
        metalness: 0.04,
      });
  }
}

/**
 * Reverses triangle winding order in-place. Essential when baking a world matrix
 * with negative determinant (e.g. Z-Anatomy `.l` mirrored left-side nodes with scale [-1,-1,-1])
 * so surface normals point outward instead of inside-out.
 */
export function flipGeometryWinding(geom: THREE.BufferGeometry): void {
  const index = geom.getIndex();
  if (index) {
    const arr = index.array as Uint16Array | Uint32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    index.needsUpdate = true;
  } else {
    const pos = geom.getAttribute('position');
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 3) {
      const x1 = pos.getX(i + 1);
      const y1 = pos.getY(i + 1);
      const z1 = pos.getZ(i + 1);
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      pos.setXYZ(i + 2, x1, y1, z1);
    }
    pos.needsUpdate = true;
  }
}

/**
 * Prepares a single sub-mesh geometry in world space with:
 *   1) Only `position` retained (strips stray/mismatched attributes before welding)
 *   2) Negative-determinant mirror winding correction (critical for Z-Anatomy `.l` nodes)
 *   3) Smooth vertex normals via `mergeVertices` + `computeVertexNormals()`
 *   4) Per-vertex `aMeshIndex` Float32BufferAttribute for O(1) merged-mesh pick resolution
 */
export function prepareSubMeshGeometry(
  sourceGeometry: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  subMeshIndex: number,
  smoothNormals: boolean,
  alreadyWelded = false
): THREE.BufferGeometry | null {
  const posAttr = sourceGeometry.getAttribute('position');
  if (!posAttr || posAttr.count < 3) return null;

  // Build clean position-only BufferGeometry so mergeVertices & mergeGeometries have 100% uniform attributes
  const clean = new THREE.BufferGeometry();
  const posClone = posAttr.clone();
  clean.setAttribute('position', posClone);
  if (sourceGeometry.index) {
    clean.setIndex(sourceGeometry.index.clone());
  }

  const det = worldMatrix.determinant();
  clean.applyMatrix4(worldMatrix);
  if (det < 0) {
    flipGeometryWinding(clean);
  }

  let processed: THREE.BufferGeometry = clean;
  if (smoothNormals && !alreadyWelded) {
    try {
      // Weld coincident hard-edged vertices (0.1 mm tolerance in meters) for smooth organic normals
      const welded = mergeVertices(clean, 1e-4);
      if (welded && welded.getAttribute('position')?.count >= 3) {
        clean.dispose();
        processed = welded;
      }
    } catch {
      // Fall back to unwelded geometry if mergeVertices encounters degenerate faces
    }
  }

  processed.computeVertexNormals();

  // Ensure uniform indexed topology for mergeGeometries
  if (!processed.index) {
    const count = processed.getAttribute('position').count;
    const indices =
      count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    processed.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  const vertCount = processed.getAttribute('position').count;
  const meshIdxArray = new Float32Array(vertCount);
  meshIdxArray.fill(subMeshIndex);
  processed.setAttribute('aMeshIndex', new THREE.BufferAttribute(meshIdxArray, 1));

  return processed;
}

/**
 * Resolves a raycast hit on a merged system mesh back to the exact original Z-Anatomy
 * sub-mesh record in O(1) using the per-vertex `aMeshIndex` attribute.
 */
export function resolveMergedPick(
  hit: THREE.Intersection | null | undefined
): MergedSubMeshRecord | null {
  if (!hit || !hit.object) return null;
  const subMeshes = hit.object.userData?.subMeshes as MergedSubMeshRecord[] | undefined;
  if (!subMeshes || subMeshes.length === 0) return null;

  if (hit.face && hit.object instanceof THREE.Mesh) {
    const attr = hit.object.geometry.getAttribute('aMeshIndex');
    if (attr) {
      const idx = Math.round(attr.getX(hit.face.a));
      if (idx >= 0 && idx < subMeshes.length) {
        return subMeshes[idx];
      }
    }
  }
  return subMeshes[0] ?? null;
}

/**
 * Finds the merged (or unmerged) Three.js mesh and its sub-mesh record for a given `meshKey`.
 */
export function findMergedMeshForSubMesh(
  body: LoadedGlbBody,
  meshKey: string
): { mesh: THREE.Mesh; record: MergedSubMeshRecord } | null {
  for (const obj of body.interactiveMeshes) {
    if (!(obj instanceof THREE.Mesh)) continue;
    const subMeshes = obj.userData?.subMeshes as MergedSubMeshRecord[] | undefined;
    if (!subMeshes) continue;
    const match = subMeshes.find((r) => r.meshKey === meshKey);
    if (match) {
      return { mesh: obj, record: match };
    }
  }
  return null;
}

/**
 * Extracts a standalone world-space `BufferGeometry` for a single anatomical structure
 * from a merged per-system mesh (or clones an unmerged mesh) in O(k) time where k is
 * the sub-mesh's own triangle count. Used for crisp click/search outline highlighting
 * without breaking the low-draw-call merged mesh architecture.
 */
export function extractSubMeshGeometry(
  sourceMesh: THREE.Mesh,
  record?: MergedSubMeshRecord | null
): THREE.BufferGeometry | null {
  const srcGeom = sourceMesh.geometry;
  if (!srcGeom) return null;

  const srcPos = srcGeom.getAttribute('position');
  if (!srcPos || srcPos.count < 3) return null;
  const srcNorm = srcGeom.getAttribute('normal');

  sourceMesh.updateWorldMatrix(true, false);
  const worldMat = sourceMesh.matrixWorld;
  const det = worldMat.determinant();

  // Unmerged standalone mesh path (procedural rig or single-mesh upload)
  if (!sourceMesh.userData?.isMergedSystemMesh || !record) {
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', srcPos.clone());
    if (srcNorm) out.setAttribute('normal', srcNorm.clone());
    if (srcGeom.index) out.setIndex(srcGeom.index.clone());
    out.applyMatrix4(worldMat);
    if (det < 0) flipGeometryWinding(out);
    if (!out.getAttribute('normal') || det < 0) out.computeVertexNormals();
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  }

  const srcIndex =
    (sourceMesh.userData?.fullIndex as THREE.BufferAttribute | undefined) || srcGeom.getIndex();
  const compactPositions: number[] = [];
  const compactNormals: number[] = [];
  const compactIndices: number[] = [];
  const remap = new Map<number, number>();

  const pushVertex = (origIdx: number): number => {
    const existing = remap.get(origIdx);
    if (existing !== undefined) return existing;
    const nextIdx = remap.size;
    remap.set(origIdx, nextIdx);
    compactPositions.push(srcPos.getX(origIdx), srcPos.getY(origIdx), srcPos.getZ(origIdx));
    if (srcNorm) {
      compactNormals.push(srcNorm.getX(origIdx), srcNorm.getY(origIdx), srcNorm.getZ(origIdx));
    }
    return nextIdx;
  };

  if (srcIndex && record.indexCount >= 3) {
    const end = Math.min(srcIndex.count, record.indexStart + record.indexCount);
    for (let i = record.indexStart; i < end; i++) {
      const origVert = srcIndex.getX(i);
      compactIndices.push(pushVertex(origVert));
    }
  } else {
    // Fallback: scan triangles by `aMeshIndex` attribute
    const meshIdxAttr = srcGeom.getAttribute('aMeshIndex');
    if (!meshIdxAttr) return null;
    if (srcIndex) {
      for (let i = 0; i + 2 < srcIndex.count; i += 3) {
        const a = srcIndex.getX(i);
        if (Math.round(meshIdxAttr.getX(a)) === record.subMeshIndex) {
          compactIndices.push(
            pushVertex(a),
            pushVertex(srcIndex.getX(i + 1)),
            pushVertex(srcIndex.getX(i + 2))
          );
        }
      }
    } else {
      for (let i = 0; i + 2 < srcPos.count; i += 3) {
        if (Math.round(meshIdxAttr.getX(i)) === record.subMeshIndex) {
          compactIndices.push(pushVertex(i), pushVertex(i + 1), pushVertex(i + 2));
        }
      }
    }
  }

  if (compactPositions.length < 9 || compactIndices.length < 3) return null;

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(compactPositions, 3));
  if (compactNormals.length === compactPositions.length) {
    out.setAttribute('normal', new THREE.Float32BufferAttribute(compactNormals, 3));
  }
  const vertCount = remap.size;
  const idxTyped =
    vertCount > 65535 ? new Uint32Array(compactIndices) : new Uint16Array(compactIndices);
  out.setIndex(new THREE.BufferAttribute(idxTyped, 1));

  out.applyMatrix4(worldMat);
  if (det < 0) flipGeometryWinding(out);
  if (!out.getAttribute('normal') || det < 0) {
    out.computeVertexNormals();
  }
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/**
 * Filters which logical sub-meshes inside a merged per-system mesh are rendered by
 * rebuilding a compact index buffer from the lazily-stashed `userData.fullIndex`.
 * Pass `predicate = null` to restore all sub-meshes at full fidelity.
 * Returns the number of visible sub-meshes after filtering.
 */
export function applySubMeshVisibilityFilter(
  mesh: THREE.Mesh,
  predicate: ((record: MergedSubMeshRecord) => boolean) | null
): number {
  const subMeshes = mesh.userData?.subMeshes as MergedSubMeshRecord[] | undefined;
  const geom = mesh.geometry;
  if (!geom || !subMeshes || subMeshes.length === 0) return 0;

  // Cache the pristine full index buffer once so repeated filter switches are lossless
  if (!mesh.userData.fullIndex) {
    const curIdx = geom.getIndex();
    if (!curIdx) return subMeshes.length;
    mesh.userData.fullIndex = curIdx;
  }
  const fullIndex = mesh.userData.fullIndex as THREE.BufferAttribute;

  if (!predicate) {
    if (geom.getIndex() !== fullIndex) {
      geom.setIndex(fullIndex);
    }
    geom.setDrawRange(0, Infinity);
    return subMeshes.length;
  }

  const fullArr = fullIndex.array;
  const matchedRecords: MergedSubMeshRecord[] = [];
  let totalIndices = 0;

  for (let i = 0; i < subMeshes.length; i++) {
    const rec = subMeshes[i];
    if (predicate(rec)) {
      matchedRecords.push(rec);
      const safeEnd = Math.min(fullArr.length, rec.indexStart + rec.indexCount);
      if (safeEnd > rec.indexStart) {
        totalIndices += safeEnd - rec.indexStart;
      }
    }
  }

  if (totalIndices === 0) {
    if (geom.getIndex() !== fullIndex) {
      geom.setIndex(fullIndex);
    }
    geom.setDrawRange(0, 0);
    return 0;
  }

  const posCount = geom.getAttribute('position')?.count ?? 0;
  const filteredArr =
    posCount > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);
  let writeCursor = 0;
  for (let i = 0; i < matchedRecords.length; i++) {
    const rec = matchedRecords[i];
    const start = rec.indexStart;
    const end = Math.min(fullArr.length, start + rec.indexCount);
    for (let k = start; k < end; k++) {
      filteredArr[writeCursor++] = fullArr[k];
    }
  }

  geom.setIndex(new THREE.BufferAttribute(filteredArr, 1));
  geom.setDrawRange(0, totalIndices);
  return matchedRecords.length;
}

/**
 * Builds a crisp selection highlight group (full-opacity emissive tissue mesh +
 * BackSide inverted-hull outline + subtle crease edges) that respects Three.js clipping planes
 * and stays fast on software WebGL without post-processing passes.
 */
export function createSelectionHighlightGroup(
  geom: THREE.BufferGeometry,
  baseColorHex: number,
  clippingPlanes: THREE.Plane[] = [],
  outlineColorHex = 0x14b8a6
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'AnatomySelectionHighlight';

  const coreMat = new THREE.MeshStandardMaterial({
    color: baseColorHex,
    emissive: outlineColorHex,
    emissiveIntensity: 0.32,
    roughness: 0.36,
    metalness: 0.06,
    side: clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    clippingPlanes,
    clipShadows: false,
  });
  const coreMesh = new THREE.Mesh(geom, coreMat);
  coreMesh.name = 'SelectionHighlightCore';
  coreMesh.renderOrder = 10;
  group.add(coreMesh);

  // Inverted-hull silhouette outline extruded along smooth vertex normals
  const outlineMat = new THREE.MeshBasicMaterial({
    color: outlineColorHex,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    clippingPlanes,
  });
  outlineMat.customProgramCacheKey = () => 'flapatlas-outline-hull-v1';
  outlineMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 _outlineNorm = length(normal) > 0.0001 ? normalize(normal) : vec3(0.0);
       transformed += _outlineNorm * 0.0032;`
    );
  };
  const outlineMesh = new THREE.Mesh(geom, outlineMat);
  outlineMesh.name = 'SelectionHighlightOutline';
  outlineMesh.renderOrder = 11;
  group.add(outlineMesh);

  // Crisp subtle silhouette/crease lines so concave surfaces remain legible
  const edgesGeo = new THREE.EdgesGeometry(geom, 32);
  const edgesMat = new THREE.LineBasicMaterial({
    color: 0x5eead4,
    transparent: true,
    opacity: 0.42,
    clippingPlanes,
  });
  const edgesLine = new THREE.LineSegments(edgesGeo, edgesMat);
  edgesLine.name = 'SelectionHighlightEdges';
  edgesLine.renderOrder = 12;
  group.add(edgesLine);

  return group;
}

export interface FlapVesselPulseHandle {
  coreMat: THREE.MeshStandardMaterial;
  outlineMat: THREE.MeshBasicMaterial | null;
  baseEmissiveIntensity: number;
}

/**
 * Builds a role-styled 3D highlight group for a flap-linked BodyParts3D vessel mesh:
 * - role "pedicle": bright red artery with BackSide silhouette outline + pulse handle
 * - role "vein":    bright blue vein with crisp rim outline
 * - role "source":  medium red source trunk
 */
export function createFlapVesselHighlightGroup(
  geom: THREE.BufferGeometry,
  style: {
    colorHex: number;
    emissiveHex: number;
    baseEmissiveIntensity: number;
    outlineColorHex: number | null;
    pulse: boolean;
  },
  role: 'pedicle' | 'vein' | 'source',
  clippingPlanes: THREE.Plane[] = []
): { group: THREE.Group; pulseHandle: FlapVesselPulseHandle | null } {
  const group = new THREE.Group();
  group.name = `FlapVesselHighlight_${role}`;

  const coreMat = new THREE.MeshStandardMaterial({
    color: style.colorHex,
    emissive: style.emissiveHex,
    emissiveIntensity: style.baseEmissiveIntensity,
    roughness: role === 'pedicle' ? 0.24 : role === 'vein' ? 0.3 : 0.36,
    metalness: 0.08,
    side: clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    clippingPlanes,
    clipShadows: false,
  });
  const coreMesh = new THREE.Mesh(geom, coreMat);
  coreMesh.name = `FlapVesselCore_${role}`;
  coreMesh.renderOrder = role === 'pedicle' ? 14 : role === 'vein' ? 13 : 12;
  group.add(coreMesh);

  let outlineMat: THREE.MeshBasicMaterial | null = null;
  if (style.outlineColorHex !== null) {
    outlineMat = new THREE.MeshBasicMaterial({
      color: style.outlineColorHex,
      side: THREE.BackSide,
      transparent: true,
      opacity: role === 'pedicle' ? 0.92 : 0.72,
      depthWrite: false,
      clippingPlanes,
    });
    const hullThickness = role === 'pedicle' ? '0.0024' : '0.0016';
    outlineMat.customProgramCacheKey = () => `flapatlas-flap-vessel-outline-${role}-v1`;
    outlineMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec3 _fvNorm = length(normal) > 0.0001 ? normalize(normal) : vec3(0.0);
         transformed += _fvNorm * ${hullThickness};`
      );
    };
    const outlineMesh = new THREE.Mesh(geom, outlineMat);
    outlineMesh.name = `FlapVesselOutline_${role}`;
    outlineMesh.renderOrder = role === 'pedicle' ? 15 : 13;
    group.add(outlineMesh);
  }

  return {
    group,
    pulseHandle: style.pulse
      ? {
          coreMat,
          outlineMat,
          baseEmissiveIntensity: style.baseEmissiveIntensity,
        }
      : null,
  };
}

/**
 * Lightweight hover outline group (BackSide inverted-hull extrusion + subtle crease lines)
 * used on pointer hover so vessels and structures respond immediately without mutating
 * the underlying merged mesh materials.
 */
export function createHoverHighlightGroup(
  geom: THREE.BufferGeometry,
  clippingPlanes: THREE.Plane[] = [],
  outlineColorHex = 0x38bdf8
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'AnatomyHoverHighlight';

  const outlineMat = new THREE.MeshBasicMaterial({
    color: outlineColorHex,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    clippingPlanes,
  });
  outlineMat.customProgramCacheKey = () => 'flapatlas-hover-outline-hull-v1';
  outlineMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 _hoverNorm = length(normal) > 0.0001 ? normalize(normal) : vec3(0.0);
       transformed += _hoverNorm * 0.0024;`
    );
  };
  const outlineMesh = new THREE.Mesh(geom, outlineMat);
  outlineMesh.name = 'HoverHighlightOutline';
  outlineMesh.renderOrder = 9;
  group.add(outlineMesh);

  const edgesGeo = new THREE.EdgesGeometry(geom, 38);
  const edgesMat = new THREE.LineBasicMaterial({
    color: outlineColorHex,
    transparent: true,
    opacity: 0.55,
    clippingPlanes,
  });
  const edgesLine = new THREE.LineSegments(edgesGeo, edgesMat);
  edgesLine.name = 'HoverHighlightEdges';
  edgesLine.renderOrder = 9;
  group.add(edgesLine);

  return group;
}

export function disposeSelectionHighlightGroup(group: THREE.Group): void {
  const seenGeoms = new Set<THREE.BufferGeometry>();
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      if (obj.geometry && !seenGeoms.has(obj.geometry)) {
        seenGeoms.add(obj.geometry);
        obj.geometry.dispose();
      }
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else if (obj.material) {
        obj.material.dispose();
      }
    }
  });
  group.clear();
}

/**
 * Evaluates whether the loaded skeleton/body faces the Anterior camera (+Z) using
 * known anterior landmarks (sternum, nasal bone, patella, mandible) vs posterior
 * landmarks (sacrum, occipital bone, calcaneus, scapula).
 */
export function shouldRotateRootToFaceAnterior(
  subMeshes: Array<{ meshName: string; center: [number, number, number] }>
): boolean {
  let anteriorZSum = 0;
  let anteriorCount = 0;
  let posteriorZSum = 0;
  let posteriorCount = 0;

  for (const item of subMeshes) {
    const lower = item.meshName.toLowerCase();
    if (/sternum|manubrium|nasal bone|patella|mandible/.test(lower)) {
      anteriorZSum += item.center[2];
      anteriorCount += 1;
    } else if (/sacrum|occipital bone|calcaneus|scapula/.test(lower)) {
      posteriorZSum += item.center[2];
      posteriorCount += 1;
    }
  }

  if (anteriorCount === 0 || posteriorCount === 0) return false;
  return anteriorZSum / anteriorCount < posteriorZSum / posteriorCount;
}

/**
 * Creates a clean wireframe skeletal loading placeholder (~1.80 m tall) shown
 * while Stage 1 GLB models are downloading/decompressing.
 */
export function createSkeletonLoadingPlaceholder(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'LoadingSkeletonPlaceholder';

  const mat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });

  const parts: Array<[THREE.BufferGeometry, number, number, number]> = [
    [new THREE.SphereGeometry(0.095, 12, 10), 0, 1.66, 0], // Cranium
    [new THREE.CylinderGeometry(0.045, 0.055, 0.1, 8), 0, 1.53, 0], // Neck
    [new THREE.CylinderGeometry(0.155, 0.125, 0.49, 12), 0, 1.24, 0], // Thorax/Trunk
    [new THREE.CylinderGeometry(0.125, 0.135, 0.18, 12), 0, 0.91, 0], // Pelvis
    [new THREE.CylinderGeometry(0.042, 0.032, 0.58, 8), -0.23, 1.18, 0], // Right arm
    [new THREE.CylinderGeometry(0.042, 0.032, 0.58, 8), 0.23, 1.18, 0], // Left arm
    [new THREE.CylinderGeometry(0.062, 0.04, 0.82, 10), -0.095, 0.43, 0], // Right leg
    [new THREE.CylinderGeometry(0.062, 0.04, 0.82, 10), 0.095, 0.43, 0], // Left leg
  ];

  for (const [geo, x, y, z] of parts) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  return group;
}

/**
 * Progressively loads a multi-system pack of Draco/Meshopt-compressed Z-Anatomy GLB files:
 *   Stage 1: skeleton.glb + muscles.glb
 *   Stage 2: organs.glb
 *   Stage 3: nerves.glb (and optional systems)
 *
 * Uses the real 1:1 meter scale (NO rescaling), verifies Anterior (+Z) orientation,
 * applies per-system PBR materials (including pearl-white tendons), computes smooth vertex
 * normals with negative-determinant mirror winding correction, and merges static geometry
 * per material bucket with an `aMeshIndex` per-vertex attribute to keep draw calls low (~5–6)
 * for smooth tablet and desktop performance.
 */
export async function loadAnatomicalModelPack(
  options: ProgressiveModelPackOptions
): Promise<LoadedGlbBody> {
  const {
    entries,
    sourceKind,
    sourceLabel,
    mapperContext,
    colorblindMode = false,
    preloadedBuffers,
    preserveRealScale = true,
    mergeStaticGeometry = true,
    smoothNormals = true,
    signal,
    onProgress,
    onStageReady,
  } = options;

  if (entries.length === 0) {
    throw new Error('No GLB model entries configured.');
  }

  const gltfLoader = createConfiguredGltfLoader();
  const root = new THREE.Group();
  root.name = 'RealAnatomicalBodyRoot';

  const bp3dAlignmentGroup = new THREE.Group();
  bp3dAlignmentGroup.name = 'BodyParts3DAlignmentGroup';
  root.add(bp3dAlignmentGroup);

  const systemGroups: Partial<Record<AnatomicalSystemId, THREE.Group>> = {};
  const interactiveMeshes: THREE.Object3D[] = [];
  const allSubMeshes: MergedSubMeshRecord[] = [];
  const loadedSystems: AnatomicalSystemId[] = [];
  const loadedFiles: LoadedSystemFileStats[] = [];
  const failedSystems: Array<{ system: AnatomicalSystemId; error: string }> = [];
  const allDiscoveredMeshes: Array<{
    meshName: string;
    system: AnatomicalSystemId;
    fj?: string;
    fma?: string;
    side?: Laterality;
  }> = [];
  const systemBoxes: BoundingBoxSummary[] = [];
  const alignedBoxes: BoundingBoxSummary[] = [];
  const skeletonBoxes: BoundingBoxSummary[] = [];

  let meshCount = 0;
  let drawCallCount = 0;
  let completedFiles = 0;
  let orientationChecked = false;
  let orientationRotatedY = false;
  let hasLegacyZAnatomy = false;
  const totalFiles = entries.length;

  const dispose = () => {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });
  };

  const updatePalette = (cbMode: boolean) => {
    for (const sys of SYSTEM_LOAD_ORDER) {
      const grp = systemGroups[sys];
      if (!grp) continue;
      grp.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          const bucket = (obj.userData?.materialBucket as TissueMaterialBucket) || 'other';
          obj.material.color.setHex(getBucketColorHex(bucket, cbMode));
        }
      });
    }
  };

  const buildSnapshot = (): LoadedGlbBody => {
    const mergedBox = mergeBoundingBoxes(systemBoxes) ?? {
      min: { x: -0.35, y: -0.078, z: -0.045 },
      max: { x: 0.35, y: 1.641, z: 0.247 },
    };
    const detectedHeightMeters = Number(
      Math.max(0.01, mergedBox.max.y - mergedBox.min.y).toFixed(3)
    );
    const detectedHeightCm = Number((detectedHeightMeters * 100).toFixed(1));

    const identityNormalization: SharedBodyNormalization = {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      sourceHeightUnits: detectedHeightMeters,
      targetHeightMeters: detectedHeightMeters,
      targetHeightCm: detectedHeightCm,
      referenceSystems: loadedSystems.length > 0 ? [...loadedSystems] : ['skeleton'],
    };

    const pivotSourceBox =
      mergeBoundingBoxes(alignedBoxes) ?? mergeBoundingBoxes(skeletonBoxes) ?? mergedBox;
    const bp3dAlignmentPivot: [number, number, number] = [
      Number(((pivotSourceBox.min.x + pivotSourceBox.max.x) * 0.5).toFixed(4)),
      Number(((pivotSourceBox.min.y + pivotSourceBox.max.y) * 0.5).toFixed(4)),
      Number(((pivotSourceBox.min.z + pivotSourceBox.max.z) * 0.5).toFixed(4)),
    ];

    return {
      root,
      bp3dAlignmentGroup,
      bp3dAlignmentPivot,
      systemGroups,
      interactiveMeshes,
      allSubMeshes,
      loadedSystems: [...loadedSystems],
      loadedFiles: [...loadedFiles],
      hasLegacyZAnatomy,
      meshCount,
      drawCallCount,
      orientationRotatedY,
      detectedHeightMeters,
      normalization: identityNormalization,
      mappingReport: buildMeshMappingReport(allDiscoveredMeshes, sourceLabel, mapperContext),
      updatePalette,
      dispose,
    };
  };

  const stages = groupManifestByStage(entries);

  for (const stage of stages) {
    if (signal?.aborted) {
      dispose();
      throw new Error('Model loading cancelled');
    }

    onProgress?.({
      stageLabel: stage.label,
      loadedSystems: [...loadedSystems],
      loadedCount: completedFiles,
      totalCount: totalFiles,
      pct: Math.round((completedFiles / totalFiles) * 100),
      failedSystems: [...failedSystems],
    });

    const parsedStageModels: Array<{
      entry: ModelManifestEntry;
      scene: THREE.Group;
      originalNames: WeakMap<THREE.Object3D, string>;
      originalExtras: WeakMap<THREE.Object3D, Record<string, unknown>>;
      sourceOrigin: LoadedFileSourceOrigin;
      sourceUrl: string;
      byteLength: number;
    }> = [];

    const countBp3dNodes = (parsed: ParsedGlbResult): number => {
      let hits = 0;
      parsed.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const nm = parsed.originalNames.get(obj) || obj.name || '';
          const ex = parseBodyParts3DNodeExtras(
            nm,
            obj.userData as Record<string, unknown> | undefined,
            parsed.originalExtras.get(obj),
            obj.parent?.userData as Record<string, unknown> | undefined
          );
          if (ex) hits += 1;
        }
      });
      return hits;
    };

    const results = await Promise.allSettled(
      stage.entries.map(async (entry) => {
        let buffer = preloadedBuffers?.[entry.id];
        let sourceOrigin: LoadedFileSourceOrigin = 'Local';
        let sourceUrl = entry.url;
        let fromCache = false;

        if (!buffer) {
          const fetched = await fetchGlbWithCache({
            cacheKey: `bp3d4:${sourceKind}:${entry.system}:${entry.url}`,
            url: entry.url,
            fallbackUrls: entry.fallbackUrls,
            system: entry.system,
            fileName: entry.fileName,
            sourceKind,
            signal,
            onBytesProgress: (loadedBytes, totalBytes, urlInFlight) => {
              onProgress?.({
                stageLabel: stage.label,
                loadedSystems: [...loadedSystems],
                loadedCount: completedFiles,
                totalCount: totalFiles,
                pct: Math.min(
                  99,
                  Math.round(
                    ((completedFiles + (totalBytes > 0 ? loadedBytes / totalBytes : 0.5)) /
                      totalFiles) *
                      100
                  )
                ),
                currentFile: entry.fileName,
                currentSourceUrl: urlInFlight,
                fromCache: false,
                loadedBytes,
                totalBytes,
                failedSystems: [...failedSystems],
              });
            },
          });
          buffer = fetched.buffer;
          sourceOrigin = fetched.sourceOrigin;
          sourceUrl = fetched.sourceUrl;
          fromCache = fetched.fromCache;
        }

        let parsed = await parseGlbBuffer(gltfLoader, buffer);

        // Stale-CDN safeguard: if an expected BP3D 4.0 remote system parsed with 0 BP3D extras
        // (e.g., stale jsDelivr @main cache serving legacy Z-Anatomy), retry automatically from GitHub Raw.
        const expectsBp3d =
          entry.sourceName.toLowerCase().includes('bodyparts3d') &&
          sourceKind === 'remote' &&
          !preloadedBuffers?.[entry.id];
        if (expectsBp3d && countBp3dNodes(parsed) === 0 && entry.fallbackUrls.length > 0) {
          const rawFallback = entry.fallbackUrls[entry.fallbackUrls.length - 1];
          if (rawFallback && rawFallback !== sourceUrl) {
            const retried = await fetchGlbWithCache({
              cacheKey: `bp3d4:raw:${entry.system}:${rawFallback}`,
              url: rawFallback,
              system: entry.system,
              fileName: entry.fileName,
              sourceKind: 'remote',
              skipCache: true,
              signal,
            });
            buffer = retried.buffer;
            sourceOrigin = retried.sourceOrigin;
            sourceUrl = retried.sourceUrl;
            fromCache = false;
            parsed = await parseGlbBuffer(gltfLoader, buffer);
          }
        }

        if (fromCache) {
          onProgress?.({
            stageLabel: stage.label,
            loadedSystems: [...loadedSystems],
            loadedCount: completedFiles,
            totalCount: totalFiles,
            pct: Math.round((completedFiles / totalFiles) * 100),
            currentFile: entry.fileName,
            currentSourceUrl: sourceUrl,
            fromCache: true,
            loadedBytes: buffer.byteLength,
            totalBytes: buffer.byteLength,
            failedSystems: [...failedSystems],
          });
        }

        return {
          entry,
          scene: parsed.scene,
          originalNames: parsed.originalNames,
          originalExtras: parsed.originalExtras,
          sourceOrigin,
          sourceUrl,
          byteLength: buffer.byteLength,
        };
      })
    );

    for (let i = 0; i < results.length; i++) {
      completedFiles += 1;
      const res = results[i];
      const entry = stage.entries[i];
      if (res.status === 'fulfilled') {
        parsedStageModels.push(res.value);
      } else {
        // Optional files returning 404 are handled gracefully without aborting the loader
        if (!entry.optional) {
          failedSystems.push({
            system: entry.system,
            error: res.reason instanceof Error ? res.reason.message : String(res.reason),
          });
        }
      }
    }

    // Build merged PBR geometry per material bucket inside each loaded system
    for (const {
      entry,
      scene: sysScene,
      originalNames,
      originalExtras,
      sourceOrigin,
      sourceUrl,
      byteLength,
    } of parsedStageModels) {
      sysScene.updateMatrixWorld(true);

      const sysGroup = systemGroups[entry.system] ?? new THREE.Group();
      sysGroup.name = `system_${entry.system}`;
      if (!systemGroups[entry.system]) {
        if (entry.hiddenByDefault) {
          sysGroup.visible = false;
        }
        systemGroups[entry.system] = sysGroup;
        if (isAlignedSystem(entry.system)) {
          bp3dAlignmentGroup.add(sysGroup);
        } else {
          root.add(sysGroup);
        }
      }

      const bucketMap = new Map<
        TissueMaterialBucket,
        {
          geometries: THREE.BufferGeometry[];
          records: MergedSubMeshRecord[];
          runningVertexOffset: number;
          runningIndexOffset: number;
        }
      >();

      const rawMeshes: THREE.Mesh[] = [];
      sysScene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          rawMeshes.push(obj);
        }
      });

      const tmpBox = new THREE.Box3();
      const tmpCenter = new THREE.Vector3();
      let fileMeshCount = 0;
      let fileTriangleCount = 0;
      let fileLegacyCount = 0;

      for (const srcMesh of rawMeshes) {
        const rawName =
          originalNames.get(srcMesh) || srcMesh.name || `${entry.system}_mesh_${meshCount + 1}`;
        // Skip legacy Z-Anatomy floating 3D Blender group title meshes (e.g. "Skeletal system.g")
        if (isZAnatomyFloatingTextLabel(rawName)) {
          srcMesh.geometry?.dispose();
          continue;
        }

        const bp3dExtras = parseBodyParts3DNodeExtras(
          rawName,
          srcMesh.userData as Record<string, unknown> | undefined,
          originalExtras.get(srcMesh),
          srcMesh.parent?.userData as Record<string, unknown> | undefined
        );
        const isBodyParts3D = Boolean(bp3dExtras);
        if (!isBodyParts3D) {
          fileLegacyCount += 1;
          hasLegacyZAnatomy = true;
        }

        const effectiveName = bp3dExtras?.name || rawName;
        const bucket = classifyMaterialBucket(entry.system, effectiveName);
        const isHepatovenousSegment = /hepatovenous\s+segment/i.test(effectiveName);
        const targetSystem: AnatomicalSystemId = isHepatovenousSegment
          ? 'organs'
          : entry.system === 'muscles' && bucket === 'fascia'
            ? 'fascia'
            : entry.system;

        let entryBucket = bucketMap.get(bucket);
        if (!entryBucket) {
          entryBucket = {
            geometries: [],
            records: [],
            runningVertexOffset: 0,
            runningIndexOffset: 0,
          };
          bucketMap.set(bucket, entryBucket);
        }

        const localSubIdx = entryBucket.records.length;
        // Always compute clean smooth normals via mergeVertices + computeVertexNormals
        const prepared = prepareSubMeshGeometry(
          srcMesh.geometry,
          srcMesh.matrixWorld,
          localSubIdx,
          smoothNormals,
          false
        );
        srcMesh.geometry?.dispose();
        if (Array.isArray(srcMesh.material)) {
          srcMesh.material.forEach((m) => m.dispose());
        } else if (srcMesh.material) {
          srcMesh.material.dispose();
        }
        if (!prepared) continue;

        prepared.computeBoundingBox();
        if (prepared.boundingBox && !prepared.boundingBox.isEmpty()) {
          tmpBox.copy(prepared.boundingBox);
          tmpBox.getCenter(tmpCenter);
          const boxSum: BoundingBoxSummary = {
            min: { x: tmpBox.min.x, y: tmpBox.min.y, z: tmpBox.min.z },
            max: { x: tmpBox.max.x, y: tmpBox.max.y, z: tmpBox.max.z },
          };
          systemBoxes.push(boxSum);
          if (isAlignedSystem(targetSystem)) {
            alignedBoxes.push(boxSum);
          } else if (targetSystem === 'skeleton') {
            skeletonBoxes.push(boxSum);
          }
        } else {
          tmpBox.makeEmpty();
          tmpCenter.set(0, 1, 0);
        }

        meshCount += 1;
        fileMeshCount += 1;
        const lookupName = bp3dExtras ? bp3dExtras.name : rawName;
        const mapped = mapMeshNameToAnatomy(lookupName, targetSystem, mapperContext, {
          fj: bp3dExtras?.fj,
          fma: bp3dExtras?.fma,
          side: bp3dExtras?.side,
        });
        allDiscoveredMeshes.push({
          meshName: rawName,
          system: targetSystem,
          fj: bp3dExtras?.fj,
          fma: bp3dExtras?.fma,
          side: bp3dExtras?.side,
        });

        const bp3dCategory =
          targetSystem === 'arteries'
            ? 'Artery'
            : targetSystem === 'veins'
              ? 'Vein'
              : targetSystem === 'skin'
                ? 'Skin'
                : targetSystem === 'organs'
                  ? 'Organ'
                  : targetSystem === 'nerves'
                    ? 'Nerve'
                    : targetSystem === 'skeleton'
                      ? 'Skeleton'
                      : mapped.category;

        const vertCount = prepared.getAttribute('position').count;
        const idxCount = prepared.index ? prepared.index.count : 0;
        fileTriangleCount += idxCount > 0 ? Math.floor(idxCount / 3) : Math.floor(vertCount / 3);

        const subRecord: MergedSubMeshRecord = {
          meshKey: `${targetSystem}:${bucket}:${localSubIdx}`,
          subMeshIndex: localSubIdx,
          meshName: rawName,
          normalizedName: mapped.normalizedName,
          system: targetSystem,
          materialBucket: bucket,
          anatomyId: mapped.anatomyId,
          label: bp3dExtras ? bp3dExtras.name : mapped.label,
          category: bp3dExtras ? bp3dCategory : mapped.category,
          laterality: bp3dExtras ? bp3dExtras.side : mapped.laterality,
          mapped: mapped.mapped,
          linkedFlapIds: mapped.linkedFlapIds,
          sourceModel: isBodyParts3D ? 'bodyparts3d' : 'z-anatomy',
          fjCode: bp3dExtras?.fj || mapped.fjCode,
          fmaCode: bp3dExtras?.fma || mapped.fmaCode,
          groupId: mapped.groupId,
          groupLabel: mapped.groupLabel,
          partLabel: mapped.partLabel,
          vertexStart: entryBucket.runningVertexOffset,
          vertexCount: vertCount,
          indexStart: entryBucket.runningIndexOffset,
          indexCount: idxCount,
          center: [
            Number(tmpCenter.x.toFixed(4)),
            Number(tmpCenter.y.toFixed(4)),
            Number(tmpCenter.z.toFixed(4)),
          ],
          boundsMin: [
            Number((tmpBox.isEmpty() ? 0 : tmpBox.min.x).toFixed(4)),
            Number((tmpBox.isEmpty() ? 0 : tmpBox.min.y).toFixed(4)),
            Number((tmpBox.isEmpty() ? 0 : tmpBox.min.z).toFixed(4)),
          ],
          boundsMax: [
            Number((tmpBox.isEmpty() ? 0 : tmpBox.max.x).toFixed(4)),
            Number((tmpBox.isEmpty() ? 0 : tmpBox.max.y).toFixed(4)),
            Number((tmpBox.isEmpty() ? 0 : tmpBox.max.z).toFixed(4)),
          ],
        };

        entryBucket.geometries.push(prepared);
        entryBucket.records.push(subRecord);
        entryBucket.runningVertexOffset += vertCount;
        entryBucket.runningIndexOffset += idxCount;
        allSubMeshes.push(subRecord);
      }

      // Merge per material bucket into 1 low-draw-call static mesh (with `aMeshIndex` pick table)
      for (const [bucket, data] of bucketMap.entries()) {
        if (data.geometries.length === 0) continue;

        const targetSystem: AnatomicalSystemId =
          data.records[0]?.system ||
          (entry.system === 'muscles' && bucket === 'fascia' ? 'fascia' : entry.system);
        let targetGroup = systemGroups[targetSystem];
        if (!targetGroup) {
          targetGroup = new THREE.Group();
          targetGroup.name = `system_${targetSystem}`;
          if (targetSystem === 'fascia' || targetSystem === 'organs') {
            targetGroup.visible = false;
          }
          systemGroups[targetSystem] = targetGroup;
          if (isAlignedSystem(targetSystem)) {
            bp3dAlignmentGroup.add(targetGroup);
          } else {
            root.add(targetGroup);
          }
        }

        if (mergeStaticGeometry) {
          const merged = mergeGeometries(data.geometries, false);
          data.geometries.forEach((g) => g.dispose());
          if (!merged) continue;
          merged.computeBoundingSphere();
          merged.computeBoundingBox();

          const mat = createBucketMaterial(bucket, colorblindMode);
          const mergedMesh = new THREE.Mesh(merged, mat);
          mergedMesh.name = `merged_${targetSystem}_${bucket}`;
          mergedMesh.castShadow = targetSystem !== 'skin' && targetSystem !== 'fascia';
          mergedMesh.receiveShadow = targetSystem !== 'skin';
          if (targetSystem === 'skin') {
            mergedMesh.renderOrder = 3;
          }
          mergedMesh.frustumCulled = true;
          mergedMesh.userData = {
            isMergedSystemMesh: true,
            is_real_scan_mesh: true,
            anatomy_system: targetSystem,
            materialBucket: bucket,
            subMeshes: data.records,
          };

          targetGroup.add(mergedMesh);
          interactiveMeshes.push(mergedMesh);
          drawCallCount += 1;
        } else {
          const baseMat = createBucketMaterial(bucket, colorblindMode);
          for (let k = 0; k < data.geometries.length; k++) {
            const g = data.geometries[k];
            const rec = data.records[k];
            const m = new THREE.Mesh(g, baseMat.clone());
            m.name = rec.meshName;
            m.castShadow = targetSystem !== 'skin' && targetSystem !== 'fascia';
            m.receiveShadow = true;
            m.userData = {
              is_real_scan_mesh: true,
              anatomy_system: targetSystem,
              materialBucket: bucket,
              anatomy_id: rec.anatomyId,
              anatomy_label: rec.label,
              anatomy_category: rec.category,
              anatomy_laterality: rec.laterality,
              anatomy_mapped: rec.mapped,
              anatomy_mesh_name: rec.meshName,
              linked_flap_ids: rec.linkedFlapIds,
              subMeshes: [rec],
            };
            targetGroup.add(m);
            interactiveMeshes.push(m);
            drawCallCount += 1;
          }
          baseMat.dispose();
        }
      }

      if (!loadedSystems.includes(entry.system)) {
        loadedSystems.push(entry.system);
      }

      loadedFiles.push({
        system: entry.system,
        fileName: entry.fileName,
        source: sourceOrigin,
        sourceUrl,
        meshCount: fileMeshCount,
        triangleCount: fileTriangleCount,
        byteLength,
        sizeMB: Number((byteLength / (1024 * 1024)).toFixed(2)),
        isLegacyZAnatomy: fileMeshCount > 0 && fileLegacyCount === fileMeshCount,
      });
    }

    // Verify Anterior (+Z) orientation once Stage 1 landmarks are available.
    // Unified BodyParts3D 4.0 files are guaranteed +Z anterior & +X subject's left, so never rotate them.
    if (!orientationChecked && allSubMeshes.length > 0) {
      orientationChecked = true;
      const allBp3d = allSubMeshes.every((s) => s.sourceModel === 'bodyparts3d');
      orientationRotatedY = allBp3d ? false : shouldRotateRootToFaceAnterior(allSubMeshes);
      if (orientationRotatedY) {
        root.rotation.y = Math.PI;
        root.updateMatrixWorld(true);
      }
    }

    void preserveRealScale;

    onProgress?.({
      stageLabel: stage.label,
      loadedSystems: [...loadedSystems],
      loadedCount: completedFiles,
      totalCount: totalFiles,
      pct: Math.round((completedFiles / totalFiles) * 100),
      failedSystems: [...failedSystems],
    });

    if (parsedStageModels.length > 0 && onStageReady) {
      onStageReady(buildSnapshot());
    }
  }

  if (loadedSystems.length === 0) {
    dispose();
    const firstErr = failedSystems[0]?.error || 'No anatomical GLB files could be loaded.';
    throw new Error(firstErr);
  }

  return buildSnapshot();
}

/**
 * Convenience loader for a single combined external GLB/GLTF file (e.g., single-file upload).
 * Uses real 1:1 meter scale, smooth normals, and Terminologia Anatomica mesh classification.
 */
export async function loadExternalBodyGlb(
  url: string,
  mapperContext?: AnatomyMapperContext,
  colorblindMode = false
): Promise<LoadedGlbBody> {
  const gltfLoader = createConfiguredGltfLoader();
  const gltf = await gltfLoader.loadAsync(url);

  const root = new THREE.Group();
  root.name = 'ExternalGlbBodyRoot';

  const bp3dAlignmentGroup = new THREE.Group();
  bp3dAlignmentGroup.name = 'BodyParts3DAlignmentGroup';
  root.add(bp3dAlignmentGroup);

  const model = gltf.scene;
  model.updateMatrixWorld(true);

  const systemGroups: Partial<Record<AnatomicalSystemId, THREE.Group>> = {};
  const interactiveMeshes: THREE.Object3D[] = [];
  const allSubMeshes: MergedSubMeshRecord[] = [];
  const discovered: Array<{ meshName: string; system: AnatomicalSystemId }> = [];
  const loadedSystemsSet = new Set<AnatomicalSystemId>();
  const boxes: BoundingBoxSummary[] = [];
  let meshIdx = 0;

  const ctx: AnatomyMapperContext = mapperContext ?? { vessels: [], flaps: [] };
  const { originalNames } = extractOriginalGltfMetadata(
    gltf as unknown as Parameters<typeof extractOriginalGltfMetadata>[0]
  );

  const tmpBox = new THREE.Box3();
  const tmpCenter = new THREE.Vector3();

  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const rawName = originalNames.get(obj) || obj.name || `anatomy_mesh_${meshIdx + 1}`;
      if (isZAnatomyFloatingTextLabel(rawName)) {
        obj.visible = false;
        return;
      }
      meshIdx += 1;
      if (obj.geometry && !obj.geometry.attributes.normal) {
        obj.geometry.computeVertexNormals();
      }
      const lower = rawName.toLowerCase();
      const inferredSystem: AnatomicalSystemId =
        lower.includes('artery') || lower.includes('arteria') || lower.includes('aorta')
          ? 'arteries'
          : lower.includes('vein') || lower.includes('vena')
            ? 'veins'
            : lower.includes('nerve') || lower.includes('nervus') || lower.includes('plexus')
              ? 'nerves'
              : lower.includes('bone') ||
                  lower.includes('femur') ||
                  lower.includes('tibia') ||
                  lower.includes('fibula') ||
                  lower.includes('skull') ||
                  lower.includes('rib') ||
                  lower.includes('scapula') ||
                  lower.includes('mandib')
                ? 'skeleton'
                : lower.includes('skin') || lower.includes('body')
                  ? 'skin'
                  : lower.includes('organ') || lower.includes('heart') || lower.includes('lung')
                    ? 'organs'
                    : 'muscles';

      loadedSystemsSet.add(inferredSystem);
      discovered.push({ meshName: rawName, system: inferredSystem });
      const mapped = mapMeshNameToAnatomy(rawName, inferredSystem, ctx);
      const bucket = classifyMaterialBucket(inferredSystem, rawName);

      tmpBox.setFromObject(obj);
      if (!tmpBox.isEmpty()) {
        tmpBox.getCenter(tmpCenter);
        boxes.push({
          min: { x: tmpBox.min.x, y: tmpBox.min.y, z: tmpBox.min.z },
          max: { x: tmpBox.max.x, y: tmpBox.max.y, z: tmpBox.max.z },
        });
      }

      const rec: MergedSubMeshRecord = {
        meshKey: `${inferredSystem}:${bucket}:${meshIdx}`,
        subMeshIndex: 0,
        meshName: rawName,
        system: inferredSystem,
        materialBucket: bucket,
        anatomyId: mapped.anatomyId,
        label: mapped.label,
        category: mapped.category,
        laterality: mapped.laterality,
        mapped: mapped.mapped,
        linkedFlapIds: mapped.linkedFlapIds,
        vertexStart: 0,
        vertexCount: obj.geometry?.getAttribute('position')?.count ?? 0,
        indexStart: 0,
        indexCount: obj.geometry?.index?.count ?? 0,
        center: [tmpCenter.x, tmpCenter.y, tmpCenter.z],
        boundsMin: [tmpBox.min.x, tmpBox.min.y, tmpBox.min.z],
        boundsMax: [tmpBox.max.x, tmpBox.max.y, tmpBox.max.z],
      };
      allSubMeshes.push(rec);

      obj.userData = {
        ...obj.userData,
        anatomy_id: mapped.anatomyId,
        anatomy_label: mapped.label,
        anatomy_category: mapped.category,
        anatomy_system: inferredSystem,
        materialBucket: bucket,
        anatomy_laterality: mapped.laterality,
        anatomy_mapped: mapped.mapped,
        anatomy_mesh_name: rawName,
        linked_flap_ids: mapped.linkedFlapIds,
        is_real_scan_mesh: true,
        subMeshes: [rec],
      };
      interactiveMeshes.push(obj);
    }
  });

  const orientationRotatedY = shouldRotateRootToFaceAnterior(allSubMeshes);
  if (orientationRotatedY) {
    root.rotation.y = Math.PI;
  }

  root.add(model);

  const mergedBox = mergeBoundingBoxes(boxes) ?? {
    min: { x: -0.35, y: 0, z: -0.15 },
    max: { x: 0.35, y: 1.8, z: 0.15 },
  };
  const detectedHeightMeters = Number(
    Math.max(0.01, mergedBox.max.y - mergedBox.min.y).toFixed(3)
  );
  const detectedHeightCm = Number((detectedHeightMeters * 100).toFixed(1));

  const dispose = () => {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });
  };

  return {
    root,
    bp3dAlignmentGroup,
    bp3dAlignmentPivot: [0, 0.85, 0],
    systemGroups,
    interactiveMeshes,
    allSubMeshes,
    loadedSystems: Array.from(loadedSystemsSet),
    loadedFiles: [
      {
        system: Array.from(loadedSystemsSet)[0] || 'other',
        fileName: url.split('/').pop() || 'custom.glb',
        source: /^https?:\/\//i.test(url) ? 'GitHub' : 'Local',
        sourceUrl: url,
        meshCount: meshIdx,
        triangleCount: allSubMeshes.reduce(
          (acc, s) => acc + (s.indexCount > 0 ? Math.floor(s.indexCount / 3) : Math.floor(s.vertexCount / 3)),
          0
        ),
        byteLength: 0,
        sizeMB: 0,
        isLegacyZAnatomy: !allSubMeshes.some((s) => s.sourceModel === 'bodyparts3d'),
      },
    ],
    hasLegacyZAnatomy: !allSubMeshes.some((s) => s.sourceModel === 'bodyparts3d'),
    meshCount: meshIdx,
    drawCallCount: interactiveMeshes.length,
    orientationRotatedY,
    detectedHeightMeters,
    normalization: {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      sourceHeightUnits: detectedHeightMeters,
      targetHeightMeters: detectedHeightMeters,
      targetHeightCm: detectedHeightCm,
      referenceSystems: Array.from(loadedSystemsSet),
    },
    mappingReport: buildMeshMappingReport(discovered, url, ctx),
    updatePalette: () => {
      void colorblindMode;
    },
    dispose,
  };
}
