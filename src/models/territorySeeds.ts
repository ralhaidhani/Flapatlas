import * as THREE from 'three';
import {
  BODY_ANGIOSOMES,
  HEAD_NECK_ANGIOSOMES,
  resolveAngiosomeBp3dFjs,
} from '../data/territories/index';
import type { TerritoryRegionFamily } from '../data/territories/schemas';
import type { LandmarkAnchor } from './anchorSystem';
import type { LoadedGlbBody, MergedSubMeshRecord } from './glbLoader';
import { TERRITORY_SLOT_BY_ID } from './territoryPalette';

/**
 * Phase 11b (§3.1) — Territory seed generator.
 * - Real mesh seeds: subsampled from loaded BP3D artery meshes (`extras.fj`) at ≈ 5 mm spacing.
 * - Schematic seeds: polylines/capsules built from calibrated + auto-proposed BP3D landmarks,
 *   mirrored cleanly left↔right across the calibrated midline.
 * - Deep-only seeds (HN 11–13): flagged `deepOnly: true` so they never paint skin voxels.
 */

export type Vec3Tuple = [number, number, number];
export type SeedSide = 'right' | 'left' | 'midline';

export interface TerritorySeedCluster {
  slotId: number;
  territoryId: string;
  regionFamily: TerritoryRegionFamily;
  side: SeedSide;
  isSchematic: boolean;
  isDeepOnly: boolean;
  crossesMidline: boolean;
  /** Visual tuning weight (default 1.0; NOT a clinical measurement) */
  weight: number;
  /** Flattened xyz positions in BP3D world metres: [x0, y0, z0, x1, y1, z1, ...] */
  points: Float32Array;
}

export interface ExtraBp3dLandmarks {
  midlineX: number;
  ischialTuberosityRight: Vec3Tuple;
  medialMalleolusRight: Vec3Tuple;
  olecranonRight: Vec3Tuple;
  medialCanthusRight: Vec3Tuple;
  mentalProtuberance: Vec3Tuple;
  vertex: Vec3Tuple;
  bodyBoundsMin: Vec3Tuple;
  bodyBoundsMax: Vec3Tuple;
}

export interface BuiltTerritorySeedsResult {
  clusters: TerritorySeedCluster[];
  landmarks: ExtraBp3dLandmarks;
  unresolvedFjs: Array<{ territoryId: string; missingFjs: string[] }>;
  realSeedTerritoryCount: number;
  schematicSeedTerritoryCount: number;
}

const _tmpV = new THREE.Vector3();

/**
 * Spatial-hash subsampler at `spacingMeters` (default 5 mm = 0.005 m) with an optional
 * cap on representative points per cluster so the 3D voxel baker stays well under 1–2 s.
 */
export function subsamplePointsAtSpacing(
  rawCoords: Float32Array | number[],
  spacingMeters = 0.005,
  maxPoints = 48
): Float32Array {
  const count = Math.floor(rawCoords.length / 3);
  if (count === 0) return new Float32Array(0);

  const inv = 1 / Math.max(1e-4, spacingMeters);
  const visited = new Set<string>();
  const kept: number[] = [];

  for (let i = 0; i < count; i++) {
    const x = rawCoords[i * 3];
    const y = rawCoords[i * 3 + 1];
    const z = rawCoords[i * 3 + 2];
    const key = `${Math.floor(x * inv)},${Math.floor(y * inv)},${Math.floor(z * inv)}`;
    if (!visited.has(key)) {
      visited.add(key);
      kept.push(x, y, z);
    }
  }

  const keptCount = kept.length / 3;
  if (keptCount <= maxPoints) {
    return new Float32Array(kept);
  }

  // Deterministic stride reduction to maxPoints while preserving endpoints
  const out = new Float32Array(maxPoints * 3);
  const step = (keptCount - 1) / Math.max(1, maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const srcIdx = Math.min(keptCount - 1, Math.round(i * step));
    out[i * 3] = kept[srcIdx * 3];
    out[i * 3 + 1] = kept[srcIdx * 3 + 1];
    out[i * 3 + 2] = kept[srcIdx * 3 + 2];
  }
  return out;
}

/**
 * Samples a polyline into evenly spaced points (~10 mm spacing) for schematic capsule seeds.
 */
export function samplePolylinePoints(waypoints: Vec3Tuple[], spacingMeters = 0.012): Float32Array {
  if (waypoints.length === 0) return new Float32Array(0);
  if (waypoints.length === 1) return new Float32Array(waypoints[0]);

  const out: number[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const dist = Math.hypot(dx, dy, dz);
    const steps = Math.max(1, Math.ceil(dist / Math.max(0.004, spacingMeters)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push(a[0] + dx * t, a[1] + dy * t, a[2] + dz * t);
    }
  }
  const last = waypoints[waypoints.length - 1];
  out.push(last[0], last[1], last[2]);
  return new Float32Array(out);
}

/**
 * Mirrors a point or polyline left↔right across `midlineX` (BP3D: -X = right, +X = left).
 */
export function mirrorPointAcrossMidline(pt: Vec3Tuple, midlineX: number): Vec3Tuple {
  return [2 * midlineX - pt[0], pt[1], pt[2]];
}

export function mirrorPointsArrayAcrossMidline(
  pts: Float32Array,
  midlineX: number
): Float32Array {
  const out = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i += 3) {
    out[i] = 2 * midlineX - pts[i];
    out[i + 1] = pts[i + 1];
    out[i + 2] = pts[i + 2];
  }
  return out;
}

/**
 * Auto-proposes extra landmarks needed for schematic territory hints directly from the
 * loaded BP3D skeleton & skin sub-meshes, falling back cleanly to anthropometric ratios
 * of the body bounding box when a specific bone mesh is absent.
 */
export function proposeExtraBp3dLandmarks(
  subMeshes: readonly MergedSubMeshRecord[],
  anchors: readonly LandmarkAnchor[]
): ExtraBp3dLandmarks {
  const anchorById = new Map(anchors.map((a) => [a.id, a.position]));

  // Compute overall body bounds from skin + skeleton (prefer skin if available)
  const skinSub = subMeshes.find((s) => s.system === 'skin');
  let minX = -0.34;
  let minY = -0.08;
  let minZ = -0.05;
  let maxX = 0.34;
  let maxY = 1.65;
  let maxZ = 0.25;

  if (skinSub) {
    [minX, minY, minZ] = skinSub.boundsMin;
    [maxX, maxY, maxZ] = skinSub.boundsMax;
  } else if (subMeshes.length > 0) {
    minX = Infinity;
    minY = Infinity;
    minZ = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    maxZ = -Infinity;
    for (const s of subMeshes) {
      if (s.boundsMin[0] < minX) minX = s.boundsMin[0];
      if (s.boundsMin[1] < minY) minY = s.boundsMin[1];
      if (s.boundsMin[2] < minZ) minZ = s.boundsMin[2];
      if (s.boundsMax[0] > maxX) maxX = s.boundsMax[0];
      if (s.boundsMax[1] > maxY) maxY = s.boundsMax[1];
      if (s.boundsMax[2] > maxZ) maxZ = s.boundsMax[2];
    }
  }

  const h = Math.max(0.5, maxY - minY);
  const d = Math.max(0.1, maxZ - minZ);
  const midlineX = anchorById.get('umbilicus')?.[0] ?? (minX + maxX) * 0.5;

  const findRightBone = (rx: RegExp): MergedSubMeshRecord | undefined =>
    subMeshes.find(
      (s) =>
        s.system === 'skeleton' &&
        s.laterality === 'right' &&
        (rx.test(s.normalizedName || '') || rx.test(s.meshName.toLowerCase()))
    );

  const findAnyBone = (rx: RegExp): MergedSubMeshRecord | undefined =>
    subMeshes.find(
      (s) =>
        s.system === 'skeleton' &&
        (rx.test(s.normalizedName || '') || rx.test(s.meshName.toLowerCase()))
    );

  const hip = findRightBone(/\bhip bone\b|\bos coxae\b|\bischium\b/);
  const tibia = findRightBone(/\btibia\b/);
  const ulna = findRightBone(/\bulna\b/);
  const skull = findAnyBone(/\bcranium\b|\bskull\b|\bfrontal bone\b|\bparietal bone\b/);
  const mandible = findAnyBone(/\bmandible\b/);

  const ischialTuberosityRight: Vec3Tuple = hip
    ? [
        hip.boundsMin[0] + (hip.boundsMax[0] - hip.boundsMin[0]) * 0.65,
        hip.boundsMin[1] + (hip.boundsMax[1] - hip.boundsMin[1]) * 0.08,
        hip.boundsMin[2] + (hip.boundsMax[2] - hip.boundsMin[2]) * 0.25,
      ]
    : [midlineX - 0.065, minY + h * 0.455, minZ + d * 0.34];

  const medialMalleolusRight: Vec3Tuple = tibia
    ? [
        tibia.boundsMax[0] - (tibia.boundsMax[0] - tibia.boundsMin[0]) * 0.12,
        tibia.boundsMin[1] + (tibia.boundsMax[1] - tibia.boundsMin[1]) * 0.04,
        tibia.center[2],
      ]
    : [midlineX - 0.055, minY + h * 0.05, minZ + d * 0.48];

  const olecranonRight: Vec3Tuple = ulna
    ? [ulna.center[0], ulna.boundsMax[1] - 0.015, ulna.boundsMin[2] + 0.008]
    : [midlineX - 0.22, minY + h * 0.62, minZ + d * 0.34];

  const vertex: Vec3Tuple = [midlineX, maxY - 0.01, minZ + d * 0.46];

  const mentalProtuberance: Vec3Tuple = mandible
    ? [midlineX, mandible.boundsMin[1] + 0.01, mandible.boundsMax[2] - 0.005]
    : [midlineX, maxY - h * 0.125, maxZ - d * 0.14];

  const medialCanthusRight: Vec3Tuple = skull
    ? [midlineX - 0.018, skull.boundsMin[1] + (skull.boundsMax[1] - skull.boundsMin[1]) * 0.44, skull.boundsMax[2] - 0.01]
    : [midlineX - 0.018, maxY - h * 0.068, maxZ - d * 0.15];

  return {
    midlineX,
    ischialTuberosityRight,
    medialMalleolusRight,
    olecranonRight,
    medialCanthusRight,
    mentalProtuberance,
    vertex,
    bodyBoundsMin: [minX, minY, minZ],
    bodyBoundsMax: [maxX, maxY, maxZ],
  };
}

function lerp3(a: Vec3Tuple, b: Vec3Tuple, t: number): Vec3Tuple {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function offset3(a: Vec3Tuple, dx: number, dy: number, dz: number): Vec3Tuple {
  return [a[0] + dx, a[1] + dy, a[2] + dz];
}

/**
 * Builds right-side schematic waypoints (mirrored to left automatically) for
 * territories with `bp3dCoverage === 'none' | 'partial'` (and deep-only HN 12–13)
 * using the calibrated + auto-proposed BP3D landmarks.
 */
function buildRightSideSchematicWaypoints(
  territoryId: string,
  anchors: ReadonlyMap<string, Vec3Tuple>,
  extra: ExtraBp3dLandmarks
): Vec3Tuple[] | null {
  const m = extra.midlineX;
  const h = Math.max(0.5, extra.bodyBoundsMax[1] - extra.bodyBoundsMin[1]);
  const minY = extra.bodyBoundsMin[1];
  const minZ = extra.bodyBoundsMin[2];
  const maxZ = extra.bodyBoundsMax[2];
  const midZ = (minZ + maxZ) * 0.5;

  const a = (id: string, fallback: Vec3Tuple): Vec3Tuple => anchors.get(id) ?? fallback;

  const asis = a('asis', [m - 0.125, minY + h * 0.55, midZ + 0.05]);
  const psis = a('psis', [m - 0.05, minY + h * 0.55, minZ + 0.06]);
  const iliacCrest = a('iliac_crest', [m - 0.14, minY + h * 0.58, midZ]);
  const pubic = a('pubic_tubercle', [m - 0.025, minY + h * 0.49, midZ + 0.05]);
  const gTroc = a('greater_trochanter', [m - 0.155, minY + h * 0.51, midZ]);
  const patella = a('superolateral_patella', [m - 0.1, minY + h * 0.29, midZ + 0.05]);
  const fibHead = a('fibular_head', [m - 0.115, minY + h * 0.25, midZ - 0.01]);
  const latMall = a('lateral_malleolus', [m - 0.11, minY + h * 0.05, midZ - 0.01]);
  const medEpi = a('medial_epicondyle', [m - 0.2, minY + h * 0.62, midZ - 0.01]);
  const mastoid = a('mastoid', [m - 0.062, minY + h * 0.9, midZ - 0.02]);

  const isch = extra.ischialTuberosityRight;
  const medMall = extra.medialMalleolusRight;
  const olec = extra.olecranonRight;
  const canthus = extra.medialCanthusRight;
  const chin = extra.mentalProtuberance;
  const vertex = extra.vertex;

  switch (territoryId) {
    case 'angio-1': // Thyroid (partial: superior thyroid missing)
      return [
        offset3(chin, -0.02, -0.055, -0.035),
        offset3(chin, -0.022, -0.095, -0.038),
      ];
    case 'angio-2': // Facial (cheek, lips, nasolabial, chin)
      return [
        offset3(chin, -0.015, 0.005, 0.005),
        offset3(chin, -0.038, 0.042, 0.002),
        offset3(canthus, -0.012, -0.025, 0.006),
      ];
    case 'angio-3': // Buccal (internal maxillary)
      return [
        offset3(canthus, -0.036, -0.036, -0.025),
        offset3(chin, -0.052, 0.045, -0.035),
      ];
    case 'angio-4': // Ophthalmic (forehead + orbital cutaneous branches)
      return [
        offset3(canthus, -0.008, 0.01, 0.008),
        offset3(canthus, -0.025, 0.042, 0.006),
        offset3(vertex, -0.025, -0.035, 0.06),
      ];
    case 'angio-5': // Superficial temporal (temple + parietal scalp)
      return [
        offset3(mastoid, -0.008, 0.035, 0.028),
        offset3(mastoid, -0.012, 0.09, 0.015),
        offset3(vertex, -0.035, -0.012, 0.01),
      ];
    case 'angio-6': // Occipital (occipital scalp + upper posterior neck)
      return [
        offset3(mastoid, 0.012, -0.03, -0.038),
        offset3(mastoid, 0.018, 0.025, -0.06),
        offset3(vertex, -0.02, -0.035, -0.058),
      ];
    case 'angio-19': // Superior gluteal (upper gluteal)
      return [
        offset3(psis, -0.025, 0.005, -0.025),
        lerp3(offset3(psis, -0.02, 0.005, -0.025), offset3(gTroc, 0.01, 0.03, -0.045), 0.65),
      ];
    case 'angio-20': // Inferior gluteal (lower gluteal + upper posterior thigh)
      return [
        offset3(isch, -0.025, 0.018, -0.038),
        offset3(isch, -0.04, -0.045, -0.04),
      ];
    case 'angio-21': // Profunda femoris (posterior & medial thigh)
      return [
        lerp3(offset3(isch, -0.02, -0.07, -0.015), offset3(patella, 0.01, 0.04, -0.075), 0.15),
        lerp3(offset3(isch, -0.02, -0.07, -0.015), offset3(patella, 0.01, 0.04, -0.075), 0.8),
      ];
    case 'angio-23': // Sural (calf / posterior leg)
      return [
        offset3(fibHead, 0.035, -0.015, -0.055),
        lerp3(offset3(fibHead, 0.035, -0.015, -0.055), offset3(medMall, -0.015, 0.05, -0.055), 0.72),
      ];
    case 'angio-24': // Peroneal (lateral leg along fibula)
      return [
        offset3(fibHead, -0.005, -0.02, -0.008),
        offset3(latMall, -0.005, 0.02, -0.008),
      ];
    case 'angio-28': // Adductor (medial thigh)
      return [
        offset3(pubic, -0.025, -0.04, -0.015),
        lerp3(offset3(pubic, -0.025, -0.04, -0.015), offset3(patella, 0.055, 0.04, -0.025), 0.68),
      ];
    case 'angio-33': // Deep circumflex iliac (iliac crest + lateral lower abdomen)
      return [
        offset3(asis, -0.005, 0.015, 0.005),
        offset3(iliacCrest, -0.005, 0.01, 0.0),
      ];
    case 'angio-38': // Posterior interosseous (dorsal mid & distal forearm)
      return [
        offset3(olec, -0.015, -0.05, -0.015),
        offset3(olec, -0.04, -0.22, -0.012),
      ];
    case 'angio-40': // Internal pudendal (perineum & gluteal fold)
      return [
        offset3(isch, 0.032, -0.015, 0.01),
        offset3(pubic, 0.008, -0.035, -0.025),
      ];
    case 'hn-5': // Posterior auricular (retroauricular)
      return [offset3(mastoid, -0.006, 0.012, -0.008), offset3(mastoid, -0.008, 0.04, -0.018)];
    case 'hn-12': // Ascending pharyngeal (deep only)
      return [offset3(mastoid, 0.035, -0.015, 0.015), offset3(mastoid, 0.038, -0.05, 0.018)];
    case 'hn-13': // Lingual (deep tongue / floor of mouth, deep only)
      return [offset3(chin, -0.012, 0.012, -0.038), offset3(chin, -0.016, 0.005, -0.065)];
    default:
      // Generic fallback for any downgraded full territory (e.g. forearm/arm)
      if (territoryId === 'angio-16' || territoryId === 'angio-15') {
        return [medEpi, offset3(medEpi, -0.03, -0.22, 0.02)];
      }
      return null;
  }
}

/**
 * Extracts world-space vertex positions for a sub-mesh from a merged Three.js mesh.
 */
function extractSubMeshWorldPoints(
  body: LoadedGlbBody,
  subMesh: MergedSubMeshRecord
): Float32Array {
  // Locate the parent THREE.Mesh holding this sub-mesh's system & bucket
  const sysGroup = body.systemGroups[subMesh.system];
  if (!sysGroup) return new Float32Array(subMesh.center);

  let targetMesh: THREE.Mesh | null = null;
  sysGroup.traverse((obj) => {
    if (targetMesh) return;
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const list = mesh.userData.subMeshes as MergedSubMeshRecord[] | undefined;
      if (list && list.some((s) => s.meshKey === subMesh.meshKey)) {
        targetMesh = mesh;
      }
    }
  });

  if (!targetMesh) return new Float32Array(subMesh.center);
  const mesh = targetMesh as THREE.Mesh;
  const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!posAttr) return new Float32Array(subMesh.center);

  mesh.updateMatrixWorld(true);
  const start = subMesh.vertexStart;
  const end = Math.min(posAttr.count, start + subMesh.vertexCount);
  const count = Math.max(0, end - start);
  if (count === 0) return new Float32Array(subMesh.center);

  const raw = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const idx = start + i;
    _tmpV.set(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));
    _tmpV.applyMatrix4(mesh.matrixWorld);
    raw[i * 3] = _tmpV.x;
    raw[i * 3 + 1] = _tmpV.y;
    raw[i * 3 + 2] = _tmpV.z;
  }
  return raw;
}

/**
 * Builds all real-mesh and schematic territory seed clusters from the loaded BP3D 4.0
 * model and calibrated anchors.
 */
export function buildTerritorySeedsFromLoadedBody(params: {
  body: LoadedGlbBody;
  anchors: readonly LandmarkAnchor[];
  visualWeights?: Readonly<Record<string, number>>;
}): BuiltTerritorySeedsResult {
  const { body, anchors, visualWeights = {} } = params;
  const anchorMap = new Map<string, Vec3Tuple>(anchors.map((a) => [a.id, a.position]));
  const landmarks = proposeExtraBp3dLandmarks(body.allSubMeshes, anchors);

  // Build FJ -> SubMesh lookup strictly from loaded `extras.fj`
  const subMeshByFj = new Map<string, MergedSubMeshRecord[]>();
  const loadedFjSet = new Set<string>();
  for (const sm of body.allSubMeshes) {
    if (!sm.fjCode) continue;
    const key = sm.fjCode.trim().toUpperCase();
    loadedFjSet.add(key);
    const list = subMeshByFj.get(key) ?? [];
    list.push(sm);
    subMeshByFj.set(key, list);
  }

  const collectPointsForFjs = (fjs: readonly string[]): Float32Array => {
    const chunks: Float32Array[] = [];
    let total = 0;
    for (const fj of fjs) {
      const matches = subMeshByFj.get(fj.trim().toUpperCase());
      if (!matches) continue;
      for (const sm of matches) {
        const pts = extractSubMeshWorldPoints(body, sm);
        if (pts.length > 0) {
          chunks.push(pts);
          total += pts.length;
        }
      }
    }
    if (total === 0) return new Float32Array(0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    return subsamplePointsAtSpacing(merged, 0.005, 32);
  };

  const clusters: TerritorySeedCluster[] = [];
  const unresolvedFjs: Array<{ territoryId: string; missingFjs: string[] }> = [];
  let realSeedTerritoryCount = 0;
  let schematicSeedTerritoryCount = 0;

  // 1. Body angiosomes (Fig 23.23 — 41 entries)
  for (const angio of BODY_ANGIOSOMES) {
    const slot = TERRITORY_SLOT_BY_ID.get(angio.id);
    if (!slot) continue;

    // Territories 31 (SFA) and 32 (CFA) share the single BP3D femoral artery mesh:
    // keep them unified as slot 31 ("femoral 31+32") unless split by calibration,
    // by emitting 31 for the lower 75% and 32 for the upper 25% of the femoral mesh!
    const weight = visualWeights[angio.id] ?? angio.visualTuning.weight ?? 1.0;
    const res = resolveAngiosomeBp3dFjs(angio, loadedFjSet);
    if (res.missingFjs.length > 0) {
      unresolvedFjs.push({ territoryId: angio.id, missingFjs: res.missingFjs });
    }

    let addedReal = false;

    const pushRealSide = (side: SeedSide, fjs: readonly string[]) => {
      if (fjs.length === 0) return;
      let pts = collectPointsForFjs(fjs);
      if (pts.length === 0) return;

      // Split shared femoral artery mesh vertically between CFA (#32 proximal) and SFA (#31 distal)
      if (angio.sharedMeshGroup === 'femoral-31-32' && pts.length >= 6) {
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 1; i < pts.length; i += 3) {
          if (pts[i] < minY) minY = pts[i];
          if (pts[i] > maxY) maxY = pts[i];
        }
        const splitY = maxY - (maxY - minY) * 0.25;
        const filtered: number[] = [];
        for (let i = 0; i < pts.length; i += 3) {
          const y = pts[i + 1];
          const keep = angio.fig23_23Number === 32 ? y >= splitY : y <= splitY;
          if (keep) filtered.push(pts[i], y, pts[i + 2]);
        }
        if (filtered.length >= 3) {
          pts = new Float32Array(filtered);
        }
      }

      clusters.push({
        slotId: slot.slotId,
        territoryId: angio.id,
        regionFamily: angio.regionFamily,
        side,
        isSchematic: angio.bp3dCoverage === 'none',
        isDeepOnly: false,
        crossesMidline: angio.crossesMidline,
        weight,
        points: pts,
      });
      addedReal = true;
    };

    pushRealSide('right', res.resolvedRightFjs);
    pushRealSide('left', res.resolvedLeftFjs);
    if (res.resolvedMidlineFjs.length > 0) {
      // Split midline-tagged bilateral artery sets (e.g., posterior intercostals, lumbar, plantar branches)
      // into right (-X) and left (+X) clusters across midlineX so side filtering works cleanly!
      const allMidPts = collectPointsForFjs(res.resolvedMidlineFjs);
      const rightPts: number[] = [];
      const leftPts: number[] = [];
      for (let i = 0; i < allMidPts.length; i += 3) {
        if (allMidPts[i] <= landmarks.midlineX) {
          rightPts.push(allMidPts[i], allMidPts[i + 1], allMidPts[i + 2]);
        } else {
          leftPts.push(allMidPts[i], allMidPts[i + 1], allMidPts[i + 2]);
        }
      }
      if (rightPts.length >= 3) {
        clusters.push({
          slotId: slot.slotId,
          territoryId: angio.id,
          regionFamily: angio.regionFamily,
          side: 'right',
          isSchematic: false,
          isDeepOnly: false,
          crossesMidline: angio.crossesMidline,
          weight,
          points: new Float32Array(rightPts),
        });
        addedReal = true;
      }
      if (leftPts.length >= 3) {
        clusters.push({
          slotId: slot.slotId,
          territoryId: angio.id,
          regionFamily: angio.regionFamily,
          side: 'left',
          isSchematic: false,
          isDeepOnly: false,
          crossesMidline: angio.crossesMidline,
          weight,
          points: new Float32Array(leftPts),
        });
        addedReal = true;
      }
    }

    // Add schematic seeds for `none`, `partial` (cutaneous/missing branch supplement), or downgraded real seeds
    if (res.effectiveCoverage === 'none' || res.effectiveCoverage === 'partial') {
      const rightWaypoints = buildRightSideSchematicWaypoints(angio.id, anchorMap, landmarks);
      if (rightWaypoints && rightWaypoints.length > 0) {
        const rightPts = samplePolylinePoints(rightWaypoints, 0.014);
        const leftPts = mirrorPointsArrayAcrossMidline(rightPts, landmarks.midlineX);
        clusters.push({
          slotId: slot.slotId,
          territoryId: angio.id,
          regionFamily: angio.regionFamily,
          side: 'right',
          isSchematic: true,
          isDeepOnly: false,
          crossesMidline: angio.crossesMidline,
          weight,
          points: rightPts,
        });
        clusters.push({
          slotId: slot.slotId,
          territoryId: angio.id,
          regionFamily: angio.regionFamily,
          side: 'left',
          isSchematic: true,
          isDeepOnly: false,
          crossesMidline: angio.crossesMidline,
          weight,
          points: leftPts,
        });
      }
    }

    if (addedReal) realSeedTerritoryCount += 1;
    else schematicSeedTerritoryCount += 1;
  }

  // 2. Deep-only Head & Neck territories (11 Vertebral, 12 Ascending pharyngeal, 13 Lingual) + HN #5
  for (const hnNum of [11, 12, 13, 5]) {
    const hn = HEAD_NECK_ANGIOSOMES.find((h) => h.fig23_37Number === hnNum);
    if (!hn) continue;
    const slot = TERRITORY_SLOT_BY_ID.get(hn.id);
    if (!slot) continue;
    const weight = visualWeights[hn.id] ?? 1.0;

    if (hn.bp3dArteries.length > 0) {
      const leftFjs = hn.bp3dArteries.flatMap((a) => a.left);
      const rightFjs = hn.bp3dArteries.flatMap((a) => a.right);
      const rPts = collectPointsForFjs(rightFjs);
      const lPts = collectPointsForFjs(leftFjs);
      if (rPts.length >= 3) {
        clusters.push({
          slotId: slot.slotId,
          territoryId: hn.id,
          regionFamily: 'head_neck',
          side: 'right',
          isSchematic: false,
          isDeepOnly: !hn.reachesSkin,
          crossesMidline: hn.crossesMidline,
          weight,
          points: rPts,
        });
      }
      if (lPts.length >= 3) {
        clusters.push({
          slotId: slot.slotId,
          territoryId: hn.id,
          regionFamily: 'head_neck',
          side: 'left',
          isSchematic: false,
          isDeepOnly: !hn.reachesSkin,
          crossesMidline: hn.crossesMidline,
          weight,
          points: lPts,
        });
      }
    } else {
      const rightWaypoints = buildRightSideSchematicWaypoints(hn.id, anchorMap, landmarks);
      if (rightWaypoints && rightWaypoints.length > 0) {
        const rPts = samplePolylinePoints(rightWaypoints, 0.014);
        const lPts = mirrorPointsArrayAcrossMidline(rPts, landmarks.midlineX);
        clusters.push({
          slotId: slot.slotId,
          territoryId: hn.id,
          regionFamily: 'head_neck',
          side: 'right',
          isSchematic: true,
          isDeepOnly: !hn.reachesSkin,
          crossesMidline: hn.crossesMidline,
          weight,
          points: rPts,
        });
        clusters.push({
          slotId: slot.slotId,
          territoryId: hn.id,
          regionFamily: 'head_neck',
          side: 'left',
          isSchematic: true,
          isDeepOnly: !hn.reachesSkin,
          crossesMidline: hn.crossesMidline,
          weight,
          points: lPts,
        });
      }
    }
  }

  return {
    clusters,
    landmarks,
    unresolvedFjs,
    realSeedTerritoryCount,
    schematicSeedTerritoryCount,
  };
}

/**
 * Extracts subsampled skin surface vertices (~12 mm spacing) in world coordinates
 * so the 3D field baker can accurately mark inside-body vs skin-shell voxels.
 */
export function extractSkinEnvelopeSamples(body: LoadedGlbBody): Float32Array {
  const skinSub = body.allSubMeshes.find((s) => s.system === 'skin');
  if (!skinSub) return new Float32Array(0);
  const raw = extractSubMeshWorldPoints(body, skinSub);
  return subsamplePointsAtSpacing(raw, 0.014, 1800);
}
