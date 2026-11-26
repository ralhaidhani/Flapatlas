import * as THREE from 'three';
import {
  BODY_ANGIOSOME_BY_ID,
  BODY_ANGIOSOMES,
  FIG_23_51_PERFORATOR_CODES,
  type BodyAngiosomeRecord,
  type TerritoryRegionFamily,
} from '../data/territories/index';
import type { LoadedGlbBody, MergedSubMeshRecord } from './glbLoader';
import { TERRITORY_SLOT_BY_ID } from './territoryPalette';
import type { TerritorySideFilter } from './territorySearch';

/**
 * Phase 11e (§6) — Real-Artery Perforator Emergence Corridors & Perforasome Jigsaw Tiling.
 *
 * Strict clinical & honesty rules:
 * 1. Corridors are computed ONLY for source arteries that have a real BodyParts3D mesh
 *    (`bp3dCoverage === 'full' || bp3dCoverage === 'partial'` AND `reachesSkin === true`).
 *    The 12 absent/schematic-only territories NEVER get invented corridor dots.
 * 2. Every corridor carries the mandatory tag:
 *    "Expected perforator zone — schematic; individual perforators vary"
 * 3. Regional size/spacing rules follow Morris & Taylor (Neligan Vol. 1, Ch. 23, pp. 324, 332.e1–e4, 341):
 *    - Proximal (head/neck, torso, arm, thigh): larger, fewer, wider spacing
 *    - Distal (forearm, leg, hand, foot): smaller, shorter, more numerous, tighter spacing
 *    - Linear rows along radial & ulnar arteries; anterior & medial-posterior leg septal lines
 * 4. Selected-flap perforasomes (Fig. 23.25, p. 333) use a fixed decorative constant radius
 *    and Voronoi jigsaw tiling — NEVER derived from flap dimensions.
 */

export type Vec3Tuple = [number, number, number];

export const CORRIDOR_SCHEMATIC_TAG =
  'Expected perforator zone — schematic; individual perforators vary';

export const PERFORASOME_SCHEMATIC_TAG = 'Schematic extent — not a measurement';

/** Decorative constant radius (4.4 cm) for Fig. 23.25 perforasome glow tiling — never a clinical measurement. */
export const PERFORASOME_DECORATIVE_RADIUS_M = 0.044;

export type CorridorDensityTier = 'proximal' | 'distal';
export type CorridorZoomTier = 'close' | 'medium' | 'clustered_far' | 'hidden_far';

export interface PerforatorCorridorSpec {
  territoryId: string;
  slotId: number;
  fig23_23Number: string;
  name: string;
  abbr: string;
  regionFamily: TerritoryRegionFamily;
  densityTier: CorridorDensityTier;
  dotSpacingMeters: number;
  dotRadiusMeters: number;
  maxSkinProjectionDistMeters: number;
  emphasisLabel: string;
  septalLineNote?: string;
  perforasomeCodes: string[];
  bp3dCoverage: 'full' | 'partial';
  sourcePage: string;
}

export interface CorridorDotInstance {
  territoryId: string;
  slotId: number;
  side: 'left' | 'right' | 'midline';
  position: Vec3Tuple;
  normal: Vec3Tuple;
  radiusMeters: number;
  densityTier: CorridorDensityTier;
  orderIndex: number;
}

export interface SkinSurfaceSpatialGrid {
  cellSize: number;
  positions: Float32Array;
  normals: Float32Array;
  vertexCount: number;
  cells: Map<string, number[]>;
  boundsMin: Vec3Tuple;
  boundsMax: Vec3Tuple;
}

export interface PerforasomeJigsawTile {
  id: string;
  label: string;
  perforatorIndex: number;
  center: Vec3Tuple;
  normal: Vec3Tuple;
  /** Ordered boundary polygon points in 3-D world space (closed loop without repeating index 0) */
  outlinePoints: Vec3Tuple[];
  /** Triangle positions (xyz triplets) for rendering soft translucent jigsaw fill */
  trianglePositions: Float32Array;
  colorHex: string;
  colorHexColorblind: string;
}

const DISTAL_TERRITORY_IDS = new Set<string>([
  'angio-15', // Ulnar
  'angio-16', // Radial
  'angio-25', // Lateral plantar
  'angio-26', // Anterior tibial / dorsalis pedis
  'angio-29', // Medial plantar
  'angio-30', // Posterior tibial
  'angio-39', // Anterior interosseous
]);

const SPECIAL_CORRIDOR_NOTES: Record<
  string,
  { emphasisLabel: string; septalLineNote: string; spacingOverride?: number; radiusOverride?: number }
> = {
  'angio-16': {
    emphasisLabel: 'Distal forearm · linear radial row',
    septalLineNote:
      'Cutaneous perforators emerge in a neat row along the radial artery (intermuscular septum between brachioradialis and FCR; Ch. 23, pp. 332.e1–e3, Figs. 23.26–23.29).',
    spacingOverride: 0.015,
    radiusOverride: 0.0044,
  },
  'angio-15': {
    emphasisLabel: 'Distal forearm · linear ulnar row',
    septalLineNote:
      'Cutaneous perforators emerge in a row along the ulnar artery (FCU–FDS septum; proximal forearm perforators are mostly musculocutaneous; Ch. 23, pp. 332.e1–e3).',
    spacingOverride: 0.015,
    radiusOverride: 0.0044,
  },
  'angio-26': {
    emphasisLabel: 'Anterior leg septal line',
    septalLineNote:
      'Anterior leg perforator line: anterior tibial perforators emerge along the septum between tibialis anterior and extensor digitorum longus (Ch. 23, p. 332.e4).',
    spacingOverride: 0.017,
    radiusOverride: 0.0046,
  },
  'angio-30': {
    emphasisLabel: 'Medial-posterior leg septal line',
    septalLineNote:
      'Posterior tibial perforators emerge along the septum between flexor digitorum longus and soleus (Ch. 23, p. 332.e4).',
    spacingOverride: 0.017,
    radiusOverride: 0.0046,
  },
  'angio-34': {
    emphasisLabel: 'Proximal torso · larger, widely spaced perforators',
    septalLineNote:
      'Indirect (musculocutaneous) DIEA perforators traverse rectus abdominis toward peri-/infra-umbilical abdominal skin (Ch. 23, p. 324, Fig. 23.48C).',
    spacingOverride: 0.028,
    radiusOverride: 0.0072,
  },
  'angio-27': {
    emphasisLabel: 'Proximal thigh · larger, widely spaced perforators',
    septalLineNote:
      'Descending branch of LCFA supplies musculocutaneous and septocutaneous perforators along the rectus femoris–vastus lateralis intermuscular septum (Ch. 23, p. 324).',
    spacingOverride: 0.03,
    radiusOverride: 0.007,
  },
  'angio-37': {
    emphasisLabel: 'Proximal posterior trunk · larger, widely spaced',
    septalLineNote:
      'Thoracodorsal perforators emerge along the anterior lateral border of latissimus dorsi (Ch. 23, pp. 324, 343).',
    spacingOverride: 0.03,
    radiusOverride: 0.007,
  },
  'angio-13': {
    emphasisLabel: 'Proximal arm · lateral intermuscular septum',
    septalLineNote:
      'Posterior radial collateral / profunda brachii septocutaneous perforators follow the lateral intermuscular septum of the arm (Ch. 23, p. 341).',
    spacingOverride: 0.028,
    radiusOverride: 0.0052,
  },
};

const CODES_BY_ANGIOSOME_ID = new Map<string, string[]>();
for (const rec of FIG_23_51_PERFORATOR_CODES) {
  if (!rec.bodyAngiosomeId) continue;
  const arr = CODES_BY_ANGIOSOME_ID.get(rec.bodyAngiosomeId) ?? [];
  if (!arr.includes(rec.perforasomeCode)) {
    arr.push(rec.perforasomeCode);
  }
  CODES_BY_ANGIOSOME_ID.set(rec.bodyAngiosomeId, arr);
}

/**
 * Returns corridor specs strictly for real BodyParts3D source arteries (`full` or `partial` coverage)
 * that reach the skin. Never includes the 12 `none` (schematic-only) angiosomes.
 */
export function getRealSourceArteryCorridorSpecs(): PerforatorCorridorSpec[] {
  const specs: PerforatorCorridorSpec[] = [];

  for (const a of BODY_ANGIOSOMES) {
    if (a.bp3dCoverage === 'none' || !a.reachesSkin || a.bp3dArteries.length === 0) {
      continue;
    }
    const slot = TERRITORY_SLOT_BY_ID.get(a.id);
    if (!slot) continue;

    // Territories 31 & 32 share the single BP3D femoral artery mesh; avoid duplicate overlapping dots on 32
    if (a.id === 'angio-32') continue;

    const isDistal = DISTAL_TERRITORY_IDS.has(a.id);
    const special = SPECIAL_CORRIDOR_NOTES[a.id];

    const dotSpacingMeters = special?.spacingOverride ?? (isDistal ? 0.016 : 0.032);
    const dotRadiusMeters = special?.radiusOverride ?? (isDistal ? 0.0046 : 0.007);

    // Deeper proximal trunks (e.g. DIEA, lumbar, posterior intercostal) can sit up to ~11 cm from skin
    const maxSkinProjectionDistMeters =
      a.regionFamily === 'trunk' ? 0.125 : a.regionFamily === 'lower_limb' ? 0.11 : 0.095;

    specs.push({
      territoryId: a.id,
      slotId: slot.slotId,
      fig23_23Number: String(a.fig23_23Number),
      name: a.id === 'angio-31' ? 'Femoral (31+32)' : a.name,
      abbr: a.abbr,
      regionFamily: a.regionFamily,
      densityTier: isDistal ? 'distal' : 'proximal',
      dotSpacingMeters,
      dotRadiusMeters,
      maxSkinProjectionDistMeters,
      emphasisLabel:
        special?.emphasisLabel ??
        (isDistal
          ? 'Distal limb · smaller, more numerous perforators'
          : 'Proximal region · larger, fewer perforators'),
      septalLineNote: special?.septalLineNote,
      perforasomeCodes: CODES_BY_ANGIOSOME_ID.get(a.id) ?? (a.abbr ? [a.abbr] : []),
      bp3dCoverage: a.bp3dCoverage,
      sourcePage: isDistal ? '324, 332.e1–e4, 341' : '324, 334, 341',
    });
  }

  return specs;
}

const CORRIDOR_SPEC_BY_ID = new Map<string, PerforatorCorridorSpec>(
  getRealSourceArteryCorridorSpecs().map((s) => [s.territoryId, s])
);

export function getCorridorSpecForTerritory(territoryId: string): PerforatorCorridorSpec | null {
  if (territoryId === 'angio-32') {
    return CORRIDOR_SPEC_BY_ID.get('angio-31') ?? null;
  }
  return CORRIDOR_SPEC_BY_ID.get(territoryId) ?? null;
}

/**
 * Checks whether a territory is eligible for a real-artery perforator corridor.
 * Strictly returns false for all 12 absent/schematic-only angiosomes.
 */
export function isRealCorridorTerritory(territoryId: string): boolean {
  const body: BodyAngiosomeRecord | undefined = BODY_ANGIOSOME_BY_ID.get(territoryId);
  if (!body) return false;
  return body.bp3dCoverage !== 'none' && body.reachesSkin && body.bp3dArteries.length > 0;
}

/**
 * Extracts an ordered 3-D centreline polyline along a vessel mesh's dominant spatial axis
 * by binning vertices into `spacingMeters` slices and averaging each slice centroid.
 * Pure, deterministic, fast (< 0.5 ms per artery).
 */
export function extractArteryCentrelinePoints(
  rawCoords: Float32Array | number[],
  spacingMeters: number,
  maxPoints = 36
): Vec3Tuple[] {
  const count = Math.floor(rawCoords.length / 3);
  if (count === 0) return [];
  if (count === 1) {
    return [[rawCoords[0], rawCoords[1], rawCoords[2]]];
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let meanX = 0;
  let meanY = 0;
  let meanZ = 0;

  for (let i = 0; i < count; i++) {
    const x = rawCoords[i * 3];
    const y = rawCoords[i * 3 + 1];
    const z = rawCoords[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
    meanX += x;
    meanY += y;
    meanZ += z;
  }
  meanX /= count;
  meanY /= count;
  meanZ /= count;

  // Power-iteration dominant eigenvector of 3×3 covariance for smooth diagonal arteries too
  let cxx = 0;
  let cxy = 0;
  let cxz = 0;
  let cyy = 0;
  let cyz = 0;
  let czz = 0;
  const stride = count > 2400 ? Math.floor(count / 1200) : 1;
  for (let i = 0; i < count; i += stride) {
    const dx = rawCoords[i * 3] - meanX;
    const dy = rawCoords[i * 3 + 1] - meanY;
    const dz = rawCoords[i * 3 + 2] - meanZ;
    cxx += dx * dx;
    cxy += dx * dy;
    cxz += dx * dz;
    cyy += dy * dy;
    cyz += dy * dz;
    czz += dz * dz;
  }

  let ax = maxX - minX;
  let ay = maxY - minY;
  let az = maxZ - minZ;
  const initLen = Math.hypot(ax, ay, az) || 1;
  ax /= initLen;
  ay /= initLen;
  az /= initLen;

  for (let iter = 0; iter < 6; iter++) {
    const nx = cxx * ax + cxy * ay + cxz * az;
    const ny = cxy * ax + cyy * ay + cyz * az;
    const nz = cxz * ax + cyz * ay + czz * az;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) break;
    ax = nx / len;
    ay = ny / len;
    az = nz / len;
  }

  let minProj = Infinity;
  let maxProj = -Infinity;
  for (let i = 0; i < count; i++) {
    const p =
      (rawCoords[i * 3] - meanX) * ax +
      (rawCoords[i * 3 + 1] - meanY) * ay +
      (rawCoords[i * 3 + 2] - meanZ) * az;
    if (p < minProj) minProj = p;
    if (p > maxProj) maxProj = p;
  }

  const span = maxProj - minProj;
  if (span < 0.004) {
    return [[meanX, meanY, meanZ]];
  }

  const step = Math.max(0.006, spacingMeters);
  const binCount = Math.min(maxPoints, Math.max(2, Math.round(span / step) + 1));
  const sumX = new Float64Array(binCount);
  const sumY = new Float64Array(binCount);
  const sumZ = new Float64Array(binCount);
  const binN = new Uint32Array(binCount);

  const invSpan = (binCount - 1) / span;
  for (let i = 0; i < count; i++) {
    const x = rawCoords[i * 3];
    const y = rawCoords[i * 3 + 1];
    const z = rawCoords[i * 3 + 2];
    const p = (x - meanX) * ax + (y - meanY) * ay + (z - meanZ) * az;
    const b = Math.min(binCount - 1, Math.max(0, Math.round((p - minProj) * invSpan)));
    sumX[b] += x;
    sumY[b] += y;
    sumZ[b] += z;
    binN[b]++;
  }

  const out: Vec3Tuple[] = [];
  for (let b = 0; b < binCount; b++) {
    if (binN[b] === 0) continue;
    const n = binN[b];
    out.push([sumX[b] / n, sumY[b] / n, sumZ[b] / n]);
  }
  return out;
}

/**
 * Builds a compact 3-D spatial hash over skin vertices and normals for fast nearest-skin projection.
 */
export function buildSkinSurfaceSpatialGrid(
  positions: Float32Array,
  normals: Float32Array | null,
  cellSize = 0.032
): SkinSurfaceSpatialGrid {
  const vertexCount = Math.floor(positions.length / 3);
  const normArr =
    normals && normals.length >= vertexCount * 3 ? normals : new Float32Array(vertexCount * 3);
  const cells = new Map<string, number[]>();
  const inv = 1 / Math.max(0.005, cellSize);

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;

    const key = `${Math.floor(x * inv)},${Math.floor(y * inv)},${Math.floor(z * inv)}`;
    let bucket = cells.get(key);
    if (!bucket) {
      bucket = [];
      cells.set(key, bucket);
    }
    bucket.push(i);
  }

  return {
    cellSize,
    positions,
    normals: normArr,
    vertexCount,
    cells,
    boundsMin: [minX, minY, minZ],
    boundsMax: [maxX, maxY, maxZ],
  };
}

/**
 * Finds the nearest skin surface vertex & outward normal for a 3-D query point.
 */
export function findNearestSkinSurfacePoint(
  point: Vec3Tuple,
  grid: SkinSurfaceSpatialGrid,
  maxDistanceMeters = 0.14
): { position: Vec3Tuple; normal: Vec3Tuple; distance: number } | null {
  if (grid.vertexCount === 0) return null;
  const inv = 1 / grid.cellSize;
  const cx = Math.floor(point[0] * inv);
  const cy = Math.floor(point[1] * inv);
  const cz = Math.floor(point[2] * inv);

  const maxRing = Math.min(5, Math.ceil(maxDistanceMeters / grid.cellSize));
  const maxDistSq = maxDistanceMeters * maxDistanceMeters;

  let bestIdx = -1;
  let bestDistSq = maxDistSq;

  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (
            ring > 0 &&
            Math.abs(dx) < ring &&
            Math.abs(dy) < ring &&
            Math.abs(dz) < ring
          ) {
            continue;
          }
          const bucket = grid.cells.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k++) {
            const idx = bucket[k];
            const vx = grid.positions[idx * 3];
            const vy = grid.positions[idx * 3 + 1];
            const vz = grid.positions[idx * 3 + 2];
            const ddx = vx - point[0];
            const ddy = vy - point[1];
            const ddz = vz - point[2];
            const dSq = ddx * ddx + ddy * ddy + ddz * ddz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestIdx = idx;
            }
          }
        }
      }
    }
    // Early exit once we have a match strictly inside the current shell radius
    if (bestIdx !== -1 && bestDistSq <= (ring * grid.cellSize) ** 2) {
      break;
    }
  }

  if (bestIdx === -1) return null;

  const sx = grid.positions[bestIdx * 3];
  const sy = grid.positions[bestIdx * 3 + 1];
  const sz = grid.positions[bestIdx * 3 + 2];
  let nx = grid.normals[bestIdx * 3];
  let ny = grid.normals[bestIdx * 3 + 1];
  let nz = grid.normals[bestIdx * 3 + 2];
  let nLen = Math.hypot(nx, ny, nz);

  if (nLen < 0.1) {
    // Fallback outward normal along artery -> skin direction
    nx = sx - point[0];
    ny = sy - point[1];
    nz = sz - point[2];
    nLen = Math.hypot(nx, ny, nz) || 1;
  }

  nx /= nLen;
  ny /= nLen;
  nz /= nLen;

  // Ensure normal points outward (away from the interior artery centreline)
  const outDot = (sx - point[0]) * nx + (sy - point[1]) * ny + (sz - point[2]) * nz;
  if (outDot < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }

  return {
    position: [sx, sy, sz],
    normal: [nx, ny, nz],
    distance: Math.sqrt(bestDistSq),
  };
}

/**
 * Projects a vessel centreline onto the nearest skin surface along the outward normal,
 * deduplicating dots closer than `minSpacingMeters` so dots remain clean and rhythmic.
 */
export function projectCentrelineOntoSkin(
  centreline: Vec3Tuple[],
  skinGrid: SkinSurfaceSpatialGrid,
  options: {
    maxProjectionDistanceMeters: number;
    minDotSpacingMeters: number;
    normalOffsetMeters?: number;
  }
): Array<{ position: Vec3Tuple; normal: Vec3Tuple }> {
  const offset = options.normalOffsetMeters ?? 0.0046;
  const minSpacingSq = (options.minDotSpacingMeters * 0.72) ** 2;
  const out: Array<{ position: Vec3Tuple; normal: Vec3Tuple }> = [];

  for (const pt of centreline) {
    const hit = findNearestSkinSurfacePoint(pt, skinGrid, options.maxProjectionDistanceMeters);
    if (!hit) continue;

    const px = hit.position[0] + hit.normal[0] * offset;
    const py = hit.position[1] + hit.normal[1] * offset;
    const pz = hit.position[2] + hit.normal[2] * offset;

    let tooClose = false;
    for (let i = out.length - 1; i >= Math.max(0, out.length - 6); i--) {
      const prev = out[i].position;
      const dSq = (px - prev[0]) ** 2 + (py - prev[1]) ** 2 + (pz - prev[2]) ** 2;
      if (dSq < minSpacingSq) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    out.push({
      position: [px, py, pz],
      normal: hit.normal,
    });
  }

  return out;
}

/**
 * Extracts world-space skin vertices + normals from the loaded BodyParts3D skin system.
 */
export function buildSkinSurfaceGridFromLoadedBody(
  body: LoadedGlbBody | null
): SkinSurfaceSpatialGrid | null {
  if (!body) return null;
  const skinRoot = body.systemGroups.skin;
  if (!skinRoot) return null;

  skinRoot.updateMatrixWorld(true);
  const posChunks: number[] = [];
  const normChunks: number[] = [];
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const normalMat = new THREE.Matrix3();

  skinRoot.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geom = obj.geometry;
    const posAttr = geom?.getAttribute('position');
    if (!posAttr) return;
    if (!geom.getAttribute('normal')) {
      geom.computeVertexNormals();
    }
    const normAttr = geom.getAttribute('normal');
    normalMat.getNormalMatrix(obj.matrixWorld);

    // Subsample gracefully if ultra-dense (> 60k vertices) while keeping <= ~25k vertices for instant lookup
    const stride = posAttr.count > 35000 ? 2 : 1;
    for (let i = 0; i < posAttr.count; i += stride) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(obj.matrixWorld);
      posChunks.push(v.x, v.y, v.z);
      if (normAttr) {
        n.fromBufferAttribute(normAttr, i).applyMatrix3(normalMat).normalize();
        normChunks.push(n.x, n.y, n.z);
      } else {
        normChunks.push(0, 0, 1);
      }
    }
  });

  if (posChunks.length === 0) return null;
  return buildSkinSurfaceSpatialGrid(
    new Float32Array(posChunks),
    new Float32Array(normChunks),
    0.03
  );
}

function buildArteryMeshLookup(body: LoadedGlbBody): Map<string, THREE.Mesh> {
  const lookup = new Map<string, THREE.Mesh>();
  const arteriesGroup = body.systemGroups.arteries;
  if (!arteriesGroup) return lookup;

  arteriesGroup.updateMatrixWorld(true);
  arteriesGroup.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const list = obj.userData?.subMeshes as MergedSubMeshRecord[] | undefined;
    if (!list) return;
    for (const s of list) {
      lookup.set(s.meshKey, obj);
    }
  });
  return lookup;
}

function collectWorldCoordsForSubMeshes(
  subMeshes: MergedSubMeshRecord[],
  meshLookup: Map<string, THREE.Mesh>
): Float32Array {
  const coords: number[] = [];
  const v = new THREE.Vector3();

  for (const rec of subMeshes) {
    const mergedMesh = meshLookup.get(rec.meshKey);
    if (!mergedMesh) {
      coords.push(rec.center[0], rec.center[1], rec.center[2]);
      continue;
    }
    const posAttr = mergedMesh.geometry.getAttribute('position');
    if (!posAttr) continue;

    const start = rec.vertexStart;
    const end = Math.min(posAttr.count, start + rec.vertexCount);
    const count = Math.max(0, end - start);
    if (count === 0) {
      coords.push(rec.center[0], rec.center[1], rec.center[2]);
      continue;
    }
    const stride = count > 2400 ? Math.floor(count / 1200) : 1;
    for (let i = start; i < end; i += stride) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(mergedMesh.matrixWorld);
      coords.push(v.x, v.y, v.z);
    }
  }

  return new Float32Array(coords);
}

/**
 * Computes all real-source-artery perforator emergence corridors on the loaded BodyParts3D model.
 * Strictly skips any angiosome whose real BP3D meshes are missing.
 */
export function buildAllRealArteryCorridors(
  body: LoadedGlbBody,
  skinGrid: SkinSurfaceSpatialGrid
): {
  dots: CorridorDotInstance[];
  realTerritoryIds: string[];
} {
  const specs = getRealSourceArteryCorridorSpecs();
  const arteryByFj = new Map<string, MergedSubMeshRecord[]>();
  const meshLookup = buildArteryMeshLookup(body);

  for (const sub of body.allSubMeshes) {
    if (sub.system !== 'arteries' || !sub.fjCode) continue;
    const key = sub.fjCode.toUpperCase();
    const arr = arteryByFj.get(key) ?? [];
    arr.push(sub);
    arteryByFj.set(key, arr);
  }

  const dots: CorridorDotInstance[] = [];
  const realTerritorySet = new Set<string>();

  for (const spec of specs) {
    const bodyRec = BODY_ANGIOSOME_BY_ID.get(spec.territoryId);
    if (!bodyRec || bodyRec.bp3dCoverage === 'none') continue;

    const sideBuckets: Array<{ side: 'left' | 'right' | 'midline'; fjs: string[] }> = [
      { side: 'right', fjs: [] },
      { side: 'left', fjs: [] },
      { side: 'midline', fjs: [] },
    ];

    for (const art of bodyRec.bp3dArteries) {
      sideBuckets[0].fjs.push(...art.right);
      sideBuckets[1].fjs.push(...art.left);
      sideBuckets[2].fjs.push(...art.midline);
    }

    for (const bucket of sideBuckets) {
      if (bucket.fjs.length === 0) continue;
      const matchedMeshes: MergedSubMeshRecord[] = [];
      for (const fj of bucket.fjs) {
        const list = arteryByFj.get(fj.toUpperCase());
        if (list) matchedMeshes.push(...list);
      }
      if (matchedMeshes.length === 0) continue;

      const worldCoords = collectWorldCoordsForSubMeshes(matchedMeshes, meshLookup);
      if (worldCoords.length < 3) continue;

      const centreline = extractArteryCentrelinePoints(worldCoords, spec.dotSpacingMeters, 34);
      const projected = projectCentrelineOntoSkin(centreline, skinGrid, {
        maxProjectionDistanceMeters: spec.maxSkinProjectionDistMeters,
        minDotSpacingMeters: spec.dotSpacingMeters,
      });

      if (projected.length > 0) {
        realTerritorySet.add(spec.territoryId);
        projected.forEach((p, idx) => {
          dots.push({
            territoryId: spec.territoryId,
            slotId: spec.slotId,
            side: bucket.side,
            position: p.position,
            normal: p.normal,
            radiusMeters: spec.dotRadiusMeters,
            densityTier: spec.densityTier,
            orderIndex: idx,
          });
        });
      }
    }
  }

  return {
    dots,
    realTerritoryIds: Array.from(realTerritorySet),
  };
}

/**
 * Classifies camera distance into zoom tiers for corridor clustering / hiding (§6:
 * "Instanced meshes only; cluster/hide at far zoom").
 */
export function classifyCorridorZoomTier(cameraDistanceMeters: number): CorridorZoomTier {
  if (cameraDistanceMeters > 3.6) return 'hidden_far';
  if (cameraDistanceMeters > 2.65) return 'clustered_far';
  if (cameraDistanceMeters > 1.35) return 'medium';
  return 'close';
}

/**
 * Filters and clusters corridor dots based on active side filter, focused territory,
 * and camera zoom distance.
 */
export function filterCorridorDotsForView(
  allDots: readonly CorridorDotInstance[],
  options: {
    sideFilter: TerritorySideFilter;
    focusedTerritoryId: string | null;
    cameraDistanceMeters: number;
  }
): {
  visibleDots: CorridorDotInstance[];
  zoomTier: CorridorZoomTier;
} {
  const zoomTier = classifyCorridorZoomTier(options.cameraDistanceMeters);

  // Resolve femoral 31/32 alias
  const effectiveFocusId =
    options.focusedTerritoryId === 'angio-32' ? 'angio-31' : options.focusedTerritoryId;

  // At very far zoom with no focus, hide all dots cleanly to prevent clutter
  if (zoomTier === 'hidden_far' && !effectiveFocusId) {
    return { visibleDots: [], zoomTier };
  }

  const out: CorridorDotInstance[] = [];
  for (let i = 0; i < allDots.length; i++) {
    const dot = allDots[i];

    // Side filter check (midline dots show on all side filters)
    if (
      options.sideFilter !== 'both' &&
      dot.side !== 'midline' &&
      dot.side !== options.sideFilter
    ) {
      continue;
    }

    // Focus mode: show ONLY the focused territory's real artery corridor at full density
    if (effectiveFocusId) {
      if (dot.territoryId !== effectiveFocusId) continue;
      out.push(dot);
      continue;
    }

    // Unfocused overview: cluster/thin based on zoom tier
    if (zoomTier === 'clustered_far') {
      // Far zoom: hide dense distal corridors, keep every 3rd proximal landmark dot
      if (dot.densityTier === 'distal') continue;
      if (dot.orderIndex % 3 !== 0) continue;
    } else if (zoomTier === 'medium') {
      // Medium zoom: keep all proximal dots and every 2nd distal dot
      if (dot.densityTier === 'distal' && dot.orderIndex % 2 !== 0) continue;
    }

    out.push(dot);
  }

  return { visibleDots: out, zoomTier };
}

const JIGSAW_PALETTE_STANDARD = ['#0d9488', '#e11d48', '#d97706', '#2563eb', '#7c3aed', '#059669'];
const JIGSAW_PALETTE_CB = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00'];

/**
 * Phase 11e (§6 — Perforasome concept, Fig. 23.25, p. 333).
 *
 * Builds Voronoi jigsaw-tiled soft territory glows around the selected flap's own perforators.
 * - Radius is strictly a decorative constant (`PERFORASOME_DECORATIVE_RADIUS_M = 0.044 m`),
 *   NEVER derived from clinical flap dimensions.
 * - Adjacent perforators are clipped along their exact perpendicular bisector half-planes so
 *   their tiles lock together like a jigsaw without overlapping.
 */
export function buildPerforasomeJigsawTiles(
  perforators: ReadonlyArray<{ id: string; label: string; position: Vec3Tuple }>,
  fallbackNormal: Vec3Tuple,
  skinGrid: SkinSurfaceSpatialGrid | null = null,
  decorativeRadiusMeters = PERFORASOME_DECORATIVE_RADIUS_M
): PerforasomeJigsawTile[] {
  if (perforators.length === 0) return [];

  const radius = Math.max(0.02, Math.min(0.06, decorativeRadiusMeters));

  // Snap each perforator center onto skin surface if available
  const snapped = perforators.map((p) => {
    if (skinGrid) {
      const hit = findNearestSkinSurfacePoint(p.position, skinGrid, 0.12);
      if (hit) {
        return {
          ...p,
          center: [
            hit.position[0] + hit.normal[0] * 0.0045,
            hit.position[1] + hit.normal[1] * 0.0045,
            hit.position[2] + hit.normal[2] * 0.0045,
          ] as Vec3Tuple,
          normal: hit.normal,
        };
      }
    }
    const nLen = Math.hypot(fallbackNormal[0], fallbackNormal[1], fallbackNormal[2]) || 1;
    const norm: Vec3Tuple = [
      fallbackNormal[0] / nLen,
      fallbackNormal[1] / nLen,
      fallbackNormal[2] / nLen,
    ];
    return {
      ...p,
      center: [
        p.position[0] + norm[0] * 0.0045,
        p.position[1] + norm[1] * 0.0045,
        p.position[2] + norm[2] * 0.0045,
      ] as Vec3Tuple,
      normal: norm,
    };
  });

  // Compute shared tangent frame (uAxis, vAxis) around the mean normal
  let avgNx = 0;
  let avgNy = 0;
  let avgNz = 0;
  let avgCx = 0;
  let avgCy = 0;
  let avgCz = 0;
  for (const s of snapped) {
    avgNx += s.normal[0];
    avgNy += s.normal[1];
    avgNz += s.normal[2];
    avgCx += s.center[0];
    avgCy += s.center[1];
    avgCz += s.center[2];
  }
  const nMag = Math.hypot(avgNx, avgNy, avgNz) || 1;
  const nVec = new THREE.Vector3(avgNx / nMag, avgNy / nMag, avgNz / nMag);
  const origin = new THREE.Vector3(
    avgCx / snapped.length,
    avgCy / snapped.length,
    avgCz / snapped.length
  );

  const refUp = Math.abs(nVec.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const uAxis = new THREE.Vector3().crossVectors(refUp, nVec).normalize();
  const vAxis = new THREE.Vector3().crossVectors(nVec, uAxis).normalize();

  // Project perforator centers into 2-D tangent coordinates
  const centers2D = snapped.map((s) => {
    const rel = new THREE.Vector3(
      s.center[0] - origin.x,
      s.center[1] - origin.y,
      s.center[2] - origin.z
    );
    return { x: rel.dot(uAxis), y: rel.dot(vAxis) };
  });

  // Sutherland-Hodgman half-plane clip in 2-D
  const clipPolygonAgainstHalfPlane = (
    poly: Array<{ x: number; y: number }>,
    ax: number,
    ay: number,
    bx: number,
    by: number
  ): Array<{ x: number; y: number }> => {
    if (poly.length < 3) return [];
    // Keep points closer to A than B (with tiny 1.5 mm visual seam gap for crisp jigsaw look)
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-5) return poly;
    const nx = dx / dist;
    const ny = dy / dist;
    const mx = (ax + bx) * 0.5 - nx * 0.0012;
    const my = (ay + by) * 0.5 - ny * 0.0012;

    const evalSide = (p: { x: number; y: number }) => (p.x - mx) * nx + (p.y - my) * ny; // <= 0 is inside

    const out: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < poly.length; i++) {
      const curr = poly[i];
      const next = poly[(i + 1) % poly.length];
      const cVal = evalSide(curr);
      const nVal = evalSide(next);
      const cIn = cVal <= 0;
      const nIn = nVal <= 0;

      if (cIn && nIn) {
        out.push(next);
      } else if (cIn && !nIn) {
        const t = cVal / (cVal - nVal);
        out.push({ x: curr.x + (next.x - curr.x) * t, y: curr.y + (next.y - curr.y) * t });
      } else if (!cIn && nIn) {
        const t = cVal / (cVal - nVal);
        out.push({ x: curr.x + (next.x - curr.x) * t, y: curr.y + (next.y - curr.y) * t });
        out.push(next);
      }
    }
    return out;
  };

  const segments = 24;
  const tiles: PerforasomeJigsawTile[] = [];

  for (let i = 0; i < snapped.length; i++) {
    const ci = centers2D[i];
    // Start with a smooth regular 24-gon of decorative constant radius
    let poly: Array<{ x: number; y: number }> = [];
    for (let s = 0; s < segments; s++) {
      const ang = (s / segments) * Math.PI * 2;
      poly.push({
        x: ci.x + Math.cos(ang) * radius,
        y: ci.y + Math.sin(ang) * radius,
      });
    }

    // Clip against every sibling perforator to produce exact non-overlapping jigsaw tiles
    for (let j = 0; j < snapped.length; j++) {
      if (j === i) continue;
      poly = clipPolygonAgainstHalfPlane(poly, ci.x, ci.y, centers2D[j].x, centers2D[j].y);
      if (poly.length < 3) break;
    }

    if (poly.length < 3) continue;

    // Lift polygon vertices back to 3-D and gently conform each vertex to the skin surface
    const outline3D: Vec3Tuple[] = poly.map((pt) => {
      const wPos: Vec3Tuple = [
        origin.x + uAxis.x * pt.x + vAxis.x * pt.y,
        origin.y + uAxis.y * pt.x + vAxis.y * pt.y,
        origin.z + uAxis.z * pt.x + vAxis.z * pt.y,
      ];
      if (skinGrid) {
        const hit = findNearestSkinSurfacePoint(wPos, skinGrid, 0.08);
        if (hit) {
          return [
            hit.position[0] + hit.normal[0] * 0.0042,
            hit.position[1] + hit.normal[1] * 0.0042,
            hit.position[2] + hit.normal[2] * 0.0042,
          ];
        }
      }
      return wPos;
    });

    // Fan-triangulate from the tile's perforator center
    const triCoords: number[] = [];
    const c3 = snapped[i].center;
    for (let k = 0; k < outline3D.length; k++) {
      const a = outline3D[k];
      const b = outline3D[(k + 1) % outline3D.length];
      triCoords.push(c3[0], c3[1], c3[2], a[0], a[1], a[2], b[0], b[1], b[2]);
    }

    tiles.push({
      id: snapped[i].id,
      label: snapped[i].label,
      perforatorIndex: i,
      center: c3,
      normal: snapped[i].normal,
      outlinePoints: outline3D,
      trianglePositions: new Float32Array(triCoords),
      colorHex: JIGSAW_PALETTE_STANDARD[i % JIGSAW_PALETTE_STANDARD.length],
      colorHexColorblind: JIGSAW_PALETTE_CB[i % JIGSAW_PALETTE_CB.length],
    });
  }

  return tiles;
}
