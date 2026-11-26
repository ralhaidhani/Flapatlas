import type { TerritoryRegionFamily } from '../data/territories/schemas';
import type { ExtraBp3dLandmarks, SeedSide, TerritorySeedCluster, Vec3Tuple } from './territorySeeds';

/**
 * Phase 11b (§3.2–3.3) — Pure 3-D Vascular Territory Field Baker.
 * Runs identically inside the Web Worker (production) and Node.js (`node:test`).
 *
 * Produces an RGBA8 3D voxel buffer (`dims = [nx, ny, nz]`, target ≈ 8 mm voxels):
 *   R: primary territory slotId (0 = outside body envelope, 1..63 = territory slot)
 *   G: secondary territory slotId (2nd nearest; used for neighbor graph & junctions)
 *   B: boundary-distance channel (0 = right on choke junction, 255 = >= 35 mm interior)
 *   A: metadata bitfield:
 *        bit 0 (1)  = inside body envelope
 *        bit 1 (2)  = skin-surface shell voxel (deep-only territories excluded)
 *        bit 2 (4)  = primary territory is schematic-seeded (renders hatched)
 *        bit 3 (8)  = primary side RIGHT (-X)
 *        bit 4 (16) = primary side LEFT (+X)
 */

export const FIELD_FLAG_INSIDE = 1;
export const FIELD_FLAG_SKIN_SHELL = 2;
export const FIELD_FLAG_SCHEMATIC = 4;
export const FIELD_FLAG_SIDE_RIGHT = 8;
export const FIELD_FLAG_SIDE_LEFT = 16;

export interface TerritoryFieldBakeInput {
  boundsMin: Vec3Tuple;
  boundsMax: Vec3Tuple;
  /** Target voxel size in metres (default 0.008 m = 8 mm) */
  voxelSizeMeters?: number;
  landmarks: ExtraBp3dLandmarks;
  clusters: TerritorySeedCluster[];
  /** Optional subsampled skin vertices [x,y,z,...] for accurate skin-shell detection */
  skinPoints?: Float32Array;
}

export interface TerritoryFieldData {
  version: string;
  dims: [number, number, number];
  boundsMin: Vec3Tuple;
  boundsMax: Vec3Tuple;
  voxelSizeMeters: number;
  /** Flat RGBA8 voxel array: length === dims[0] * dims[1] * dims[2] * 4 */
  voxels: Uint8Array;
  /** Computed adjacent territory slotIds per slotId */
  neighborsBySlot: Record<number, number[]>;
  buildMs: number;
}

export interface TerritorySampleResult {
  inside: boolean;
  primarySlot: number;
  secondarySlot: number;
  boundaryDistanceNormalized: number;
  isSkinShell: boolean;
  isSchematic: boolean;
  side: SeedSide;
}

const REGION_INDEX: Record<TerritoryRegionFamily, number> = {
  head_neck: 0,
  trunk: 1,
  upper_limb: 2,
  lower_limb: 3,
};

/**
 * Classifies a 3D world point (BP3D metres: Y-up, +Z anterior, -X right, +X left)
 * into anatomical region family masks so limb territories never leak onto the trunk
 * and trunk territories never bleed down the arms or legs.
 */
export function classifyAnatomicalRegionFamily(
  x: number,
  y: number,
  z: number,
  boundsMin: Vec3Tuple,
  boundsMax: Vec3Tuple,
  midlineX: number
): TerritoryRegionFamily {
  const minY = boundsMin[1];
  const h = Math.max(0.5, boundsMax[1] - minY);
  const yNorm = (y - minY) / h; // 0 = soles, 1 = vertex
  const absX = Math.abs(x - midlineX);

  // Head & Neck: above clavicular/suprasternal plane (~81.5% height)
  if (yNorm >= 0.815) {
    return 'head_neck';
  }

  // Lower limb: below inguinal/gluteal fold (~47.5% height)
  // Slight anterior/posterior taper: gluteal region stays in trunk up to ~45% posteriorly
  const midZ = (boundsMin[2] + boundsMax[2]) * 0.5;
  const lowerCutoff = z < midZ ? 0.445 : 0.485;
  if (yNorm < lowerCutoff) {
    return 'lower_limb';
  }

  // Upper limb vs Trunk: lateral to the torso/axillary wall (absX > shoulder-trunk boundary)
  // Trunk half-width tapers slightly from chest (~0.165 m) to waist (~0.155 m)
  if (yNorm <= 0.83 && yNorm >= 0.36) {
    const trunkHalfWidth = yNorm > 0.72 ? 0.162 : 0.152;
    if (absX > trunkHalfWidth) {
      return 'upper_limb';
    }
  }

  return 'trunk';
}

/**
 * Computes which region families are allowed to compete for a voxel in `voxelFamily`.
 * Allows narrow physiological overlap at anatomical transition zones (neck-trunk,
 * shoulder-arm, groin-thigh) while enforcing strict trunk↔limb isolation.
 */
function getAllowedFamiliesMask(
  voxelFamily: TerritoryRegionFamily,
  yNorm: number,
  absX: number
): number {
  let mask = 1 << REGION_INDEX[voxelFamily];
  // Neck/shoulder transition (suprascapular / transverse cervical / acromiothoracic)
  if (yNorm >= 0.76 && yNorm <= 0.855 && absX <= 0.21) {
    mask |= (1 << REGION_INDEX.head_neck) | (1 << REGION_INDEX.trunk);
  }
  // Shoulder/axilla bridge (deltoid, PCHA, circumflex scapular, acromiothoracic)
  if (yNorm >= 0.72 && yNorm <= 0.83 && absX >= 0.13 && absX <= 0.22) {
    mask |= (1 << REGION_INDEX.trunk) | (1 << REGION_INDEX.upper_limb);
  }
  // Groin / gluteal-thigh transition (common femoral, inferior gluteal, profunda)
  if (yNorm >= 0.43 && yNorm <= 0.52) {
    mask |= (1 << REGION_INDEX.trunk) | (1 << REGION_INDEX.lower_limb);
  }
  return mask;
}

/**
 * Builds a fast per-Y-slice XZ envelope + spatial lookup from skin vertices so
 * voxel inside/skin-shell queries run in O(1) without ray-triangle intersection overhead.
 */
function buildBodySliceEnvelope(
  dims: [number, number, number],
  boundsMin: Vec3Tuple,
  voxelSize: number,
  skinPoints?: Float32Array
): {
  sliceMinX: Float32Array;
  sliceMaxX: Float32Array;
  sliceMinZ: Float32Array;
  sliceMaxZ: Float32Array;
  hasSkinShellGrid: boolean;
  skinShellGrid: Uint8Array;
} {
  const [nx, ny, nz] = dims;
  const sliceMinX = new Float32Array(ny).fill(Infinity);
  const sliceMaxX = new Float32Array(ny).fill(-Infinity);
  const sliceMinZ = new Float32Array(ny).fill(Infinity);
  const sliceMaxZ = new Float32Array(ny).fill(-Infinity);
  const skinShellGrid = new Uint8Array(nx * ny * nz);

  const hasSkin = Boolean(skinPoints && skinPoints.length >= 3);
  if (hasSkin && skinPoints) {
    const inv = 1 / voxelSize;
    for (let i = 0; i < skinPoints.length; i += 3) {
      const px = skinPoints[i];
      const py = skinPoints[i + 1];
      const pz = skinPoints[i + 2];
      const ix = Math.max(0, Math.min(nx - 1, Math.floor((px - boundsMin[0]) * inv)));
      const iy = Math.max(0, Math.min(ny - 1, Math.floor((py - boundsMin[1]) * inv)));
      const iz = Math.max(0, Math.min(nz - 1, Math.floor((pz - boundsMin[2]) * inv)));

      if (px < sliceMinX[iy]) sliceMinX[iy] = px;
      if (px > sliceMaxX[iy]) sliceMaxX[iy] = px;
      if (pz < sliceMinZ[iy]) sliceMinZ[iy] = pz;
      if (pz > sliceMaxZ[iy]) sliceMaxZ[iy] = pz;

      // Mark 3×3×3 neighborhood (~12 mm shell around skin surface)
      for (let dz = -1; dz <= 1; dz++) {
        const zz = iz + dz;
        if (zz < 0 || zz >= nz) continue;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = iy + dy;
          if (yy < 0 || yy >= ny) continue;
          const base = (zz * ny + yy) * nx;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = ix + dx;
            if (xx >= 0 && xx < nx) {
              skinShellGrid[base + xx] = 1;
            }
          }
        }
      }
    }
  }

  return {
    sliceMinX,
    sliceMaxX,
    sliceMinZ,
    sliceMaxZ,
    hasSkinShellGrid: hasSkin,
    skinShellGrid,
  };
}

/**
 * Bakes the 3-D weighted-Voronoi vascular territory field into a compact RGBA8 Uint8Array.
 */
export function bakeTerritoryField3D(
  input: TerritoryFieldBakeInput,
  onProgress?: (pct: number, label: string) => void
): TerritoryFieldData {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const voxelSize = input.voxelSizeMeters ?? 0.008;
  const pad = voxelSize * 1.5;

  const boundsMin: Vec3Tuple = [
    input.boundsMin[0] - pad,
    input.boundsMin[1] - pad,
    input.boundsMin[2] - pad,
  ];
  const boundsMax: Vec3Tuple = [
    input.boundsMax[0] + pad,
    input.boundsMax[1] + pad,
    input.boundsMax[2] + pad,
  ];

  const nx = Math.max(8, Math.min(128, Math.ceil((boundsMax[0] - boundsMin[0]) / voxelSize)));
  const ny = Math.max(8, Math.min(256, Math.ceil((boundsMax[1] - boundsMin[1]) / voxelSize)));
  const nz = Math.max(8, Math.min(96, Math.ceil((boundsMax[2] - boundsMin[2]) / voxelSize)));
  const dims: [number, number, number] = [nx, ny, nz];

  // Snap boundsMax to exact voxel grid extent so CPU sampling and GPU sampler3D UVW align 1:1
  const snappedBoundsMax: Vec3Tuple = [
    boundsMin[0] + nx * voxelSize,
    boundsMin[1] + ny * voxelSize,
    boundsMin[2] + nz * voxelSize,
  ];

  const voxels = new Uint8Array(nx * ny * nz * 4);
  const midlineX = input.landmarks.midlineX;
  const bodyMin = input.landmarks.bodyBoundsMin ?? boundsMin;
  const bodyMax = input.landmarks.bodyBoundsMax ?? snappedBoundsMax;
  const minY = bodyMin[1];
  const height = Math.max(0.5, bodyMax[1] - minY);

  // Pre-compute per-cluster bounding boxes + inverse weight for fast rejection
  const prepared = input.clusters
    .filter((c) => c.points.length >= 3)
    .map((c) => {
      let cMinX = Infinity;
      let cMinY = Infinity;
      let cMinZ = Infinity;
      let cMaxX = -Infinity;
      let cMaxY = -Infinity;
      let cMaxZ = -Infinity;
      const pts = c.points;
      for (let i = 0; i < pts.length; i += 3) {
        if (pts[i] < cMinX) cMinX = pts[i];
        if (pts[i] > cMaxX) cMaxX = pts[i];
        if (pts[i + 1] < cMinY) cMinY = pts[i + 1];
        if (pts[i + 1] > cMaxY) cMaxY = pts[i + 1];
        if (pts[i + 2] < cMinZ) cMinZ = pts[i + 2];
        if (pts[i + 2] > cMaxZ) cMaxZ = pts[i + 2];
      }
      const w = Math.max(0.2, Math.min(4.0, c.weight || 1.0));
      return {
        slotId: c.slotId,
        familyBit: 1 << REGION_INDEX[c.regionFamily],
        side: c.side,
        isSchematic: c.isSchematic,
        isDeepOnly: c.isDeepOnly,
        crossesMidline: c.crossesMidline,
        invWeightSq: 1 / (w * w),
        points: pts,
        pointCount: pts.length / 3,
        cMinX,
        cMinY,
        cMinZ,
        cMaxX,
        cMaxY,
        cMaxZ,
      };
    });

  const envelope = buildBodySliceEnvelope(dims, boundsMin, voxelSize, input.skinPoints);
  const neighborSets = new Map<number, Set<number>>();
  const boundaryScaleMeters = 0.035; // 35 mm normalization for B channel
  const reportEveryZ = Math.max(1, Math.floor(nz / 10));

  for (let iz = 0; iz < nz; iz++) {
    const vz = boundsMin[2] + (iz + 0.5) * voxelSize;
    if (onProgress && iz % reportEveryZ === 0) {
      onProgress(Math.round((iz / nz) * 95), 'Building vascular territory field…');
    }

    for (let iy = 0; iy < ny; iy++) {
      const vy = boundsMin[1] + (iy + 0.5) * voxelSize;
      const yNorm = (vy - minY) / height;

      // Fast slice-envelope reject if skin envelope is present
      const sMinX = envelope.sliceMinX[iy];
      const sMaxX = envelope.sliceMaxX[iy];
      const sMinZ = envelope.sliceMinZ[iy];
      const sMaxZ = envelope.sliceMaxZ[iy];
      const hasSliceBounds = Number.isFinite(sMinX) && Number.isFinite(sMinZ);
      if (hasSliceBounds && (vz < sMinZ - 0.02 || vz > sMaxZ + 0.02)) {
        continue;
      }

      const rowBase = (iz * ny + iy) * nx;

      for (let ix = 0; ix < nx; ix++) {
        const vx = boundsMin[0] + (ix + 0.5) * voxelSize;
        if (hasSliceBounds && (vx < sMinX - 0.02 || vx > sMaxX + 0.02)) {
          continue;
        }

        const voxelIdx = rowBase + ix;
        const isSkinShell = envelope.hasSkinShellGrid
          ? envelope.skinShellGrid[voxelIdx] === 1
          : ix === 0 || ix === nx - 1 || iz === 0 || iz === nz - 1;

        const absX = Math.abs(vx - midlineX);
        const voxelFamily = classifyAnatomicalRegionFamily(
          vx,
          vy,
          vz,
          bodyMin,
          bodyMax,
          midlineX
        );
        const allowedMask = getAllowedFamiliesMask(voxelFamily, yNorm, absX);
        const voxelIsRight = vx <= midlineX;

        let bestSlot = 0;
        let bestDistSq = Infinity;
        let bestSchematic = false;
        let bestSide: SeedSide = voxelIsRight ? 'right' : 'left';

        let secondSlot = 0;
        let secondDistSq = Infinity;

        for (let cIdx = 0; cIdx < prepared.length; cIdx++) {
          const cl = prepared[cIdx];

          // Deep-only territories (HN 11–13) are excluded from skin-shell voxels
          if (cl.isDeepOnly && isSkinShell) continue;

          // Anatomical region-family barrier
          if ((cl.familyBit & allowedMask) === 0) continue;

          // Midline barrier (only scalp/forehead/lips may cross midline)
          if (!cl.crossesMidline) {
            if (voxelIsRight && cl.side === 'left') continue;
            if (!voxelIsRight && cl.side === 'right') continue;
          }

          // Fast AABB lower-bound distance check before per-point loop
          const dxBox = vx < cl.cMinX ? cl.cMinX - vx : vx > cl.cMaxX ? vx - cl.cMaxX : 0;
          const dyBox = vy < cl.cMinY ? cl.cMinY - vy : vy > cl.cMaxY ? vy - cl.cMaxY : 0;
          const dzBox = vz < cl.cMinZ ? cl.cMinZ - vz : vz > cl.cMaxZ ? vz - cl.cMaxZ : 0;
          const boxWeightedSq = (dxBox * dxBox + dyBox * dyBox + dzBox * dzBox) * cl.invWeightSq;
          if (boxWeightedSq >= secondDistSq) continue;

          // Closest point in cluster
          let minSq = Infinity;
          const pts = cl.points;
          for (let p = 0; p < pts.length; p += 3) {
            const dx = vx - pts[p];
            const dy = vy - pts[p + 1];
            const dz = vz - pts[p + 2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < minSq) minSq = d2;
          }

          const weightedSq = minSq * cl.invWeightSq;
          if (weightedSq < bestDistSq) {
            if (bestSlot !== cl.slotId && bestSlot !== 0) {
              secondSlot = bestSlot;
              secondDistSq = bestDistSq;
            }
            bestSlot = cl.slotId;
            bestDistSq = weightedSq;
            bestSchematic = cl.isSchematic;
            bestSide = cl.side;
          } else if (cl.slotId !== bestSlot && weightedSq < secondDistSq) {
            secondSlot = cl.slotId;
            secondDistSq = weightedSq;
          }
        }

        if (bestSlot === 0) continue;

        const d1 = Math.sqrt(bestDistSq);
        const d2 = Number.isFinite(secondDistSq) ? Math.sqrt(secondDistSq) : d1 + boundaryScaleMeters;
        // Boundary distance ≈ (d2 - d1) / 2 in weighted metres
        const boundaryDistMeters = Math.max(0, (d2 - d1) * 0.5);
        const boundaryByte = Math.max(
          0,
          Math.min(255, Math.round((boundaryDistMeters / boundaryScaleMeters) * 255))
        );

        let flags = FIELD_FLAG_INSIDE;
        if (isSkinShell) flags |= FIELD_FLAG_SKIN_SHELL;
        if (bestSchematic) flags |= FIELD_FLAG_SCHEMATIC;
        if (bestSide === 'right') flags |= FIELD_FLAG_SIDE_RIGHT;
        else if (bestSide === 'left') flags |= FIELD_FLAG_SIDE_LEFT;

        const outIdx = voxelIdx * 4;
        voxels[outIdx] = bestSlot;
        voxels[outIdx + 1] = secondSlot;
        voxels[outIdx + 2] = boundaryByte;
        voxels[outIdx + 3] = flags;

        // Record true anatomical adjacency along boundary voxels (< 12 mm from junction)
        if (secondSlot !== 0 && secondSlot !== bestSlot && boundaryDistMeters < 0.012) {
          let sA = neighborSets.get(bestSlot);
          if (!sA) {
            sA = new Set<number>();
            neighborSets.set(bestSlot, sA);
          }
          sA.add(secondSlot);

          let sB = neighborSets.get(secondSlot);
          if (!sB) {
            sB = new Set<number>();
            neighborSets.set(secondSlot, sB);
          }
          sB.add(bestSlot);
        }
      }
    }
  }

  const neighborsBySlot: Record<number, number[]> = {};
  for (const [slot, set] of neighborSets.entries()) {
    neighborsBySlot[slot] = Array.from(set).sort((a, b) => a - b);
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  onProgress?.(100, 'Vascular territory field ready');

  return {
    version: 'territoryField-bp3d-4.0-v1',
    dims,
    boundsMin,
    boundsMax: snappedBoundsMax,
    voxelSizeMeters: voxelSize,
    voxels,
    neighborsBySlot,
    buildMs: Math.round(t1 - t0),
  };
}

/**
 * Samples the baked 3D territory field at any world-space point (metres).
 * Used for tap/hover identification, muscle calibration auditing, and per-vertex fallback.
 */
export function sampleTerritoryFieldAtWorldPos(
  field: TerritoryFieldData,
  pos: Vec3Tuple
): TerritorySampleResult {
  const [nx, ny, nz] = field.dims;
  const spanX = Math.max(1e-5, field.boundsMax[0] - field.boundsMin[0]);
  const spanY = Math.max(1e-5, field.boundsMax[1] - field.boundsMin[1]);
  const spanZ = Math.max(1e-5, field.boundsMax[2] - field.boundsMin[2]);

  const u = (pos[0] - field.boundsMin[0]) / spanX;
  const v = (pos[1] - field.boundsMin[1]) / spanY;
  const w = (pos[2] - field.boundsMin[2]) / spanZ;

  if (u < 0 || u > 1 || v < 0 || v > 1 || w < 0 || w > 1) {
    return {
      inside: false,
      primarySlot: 0,
      secondarySlot: 0,
      boundaryDistanceNormalized: 1,
      isSkinShell: false,
      isSchematic: false,
      side: 'midline',
    };
  }

  const ix = Math.max(0, Math.min(nx - 1, Math.floor(u * nx)));
  const iy = Math.max(0, Math.min(ny - 1, Math.floor(v * ny)));
  const iz = Math.max(0, Math.min(nz - 1, Math.floor(w * nz)));
  const base = ((iz * ny + iy) * nx + ix) * 4;

  const primarySlot = field.voxels[base];
  const secondarySlot = field.voxels[base + 1];
  const boundaryByte = field.voxels[base + 2];
  const flags = field.voxels[base + 3];

  const side: SeedSide =
    (flags & FIELD_FLAG_SIDE_RIGHT) !== 0
      ? 'right'
      : (flags & FIELD_FLAG_SIDE_LEFT) !== 0
        ? 'left'
        : 'midline';

  return {
    inside: (flags & FIELD_FLAG_INSIDE) !== 0 && primarySlot !== 0,
    primarySlot,
    secondarySlot,
    boundaryDistanceNormalized: boundaryByte / 255,
    isSkinShell: (flags & FIELD_FLAG_SKIN_SHELL) !== 0,
    isSchematic: (flags & FIELD_FLAG_SCHEMATIC) !== 0,
    side,
  };
}
