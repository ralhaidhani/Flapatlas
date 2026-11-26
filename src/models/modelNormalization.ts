import { BODY_MODEL_CONFIG } from './bodyModelConfig';
import type { AnatomicalSystemId } from './modelManifest';

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBoxSummary {
  min: Vec3Tuple;
  max: Vec3Tuple;
}

export interface SharedBodyNormalization {
  /** Uniform scale factor mapping source model height -> targetHeightMeters (default 1.75 m = 175 cm) */
  scale: number;
  /** Translation offset applied AFTER scaling so feet rest at groundY (0) and X/Z are centered at 0 */
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  /** Measured raw height in source file units (e.g., ~1750 for mm, ~175 for cm, ~1.75 for m) */
  sourceHeightUnits: number;
  /** Target calibrated height in meters (1.75 m = 175 cm) */
  targetHeightMeters: number;
  /** Target calibrated height in centimeters (175 cm) */
  targetHeightCm: number;
  /** Which system(s) established the shared reference bounding box */
  referenceSystems: AnatomicalSystemId[];
}

/**
 * Merges multiple bounding boxes from co-registered source systems (e.g., skin + skeleton)
 * into a single combined bounding box before computing the shared normalization transform.
 */
export function mergeBoundingBoxes(boxes: BoundingBoxSummary[]): BoundingBoxSummary | null {
  if (boxes.length === 0) return null;
  const min: Vec3Tuple = { x: Infinity, y: Infinity, z: Infinity };
  const max: Vec3Tuple = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const b of boxes) {
    if (
      !Number.isFinite(b.min.x) ||
      !Number.isFinite(b.min.y) ||
      !Number.isFinite(b.min.z) ||
      !Number.isFinite(b.max.x) ||
      !Number.isFinite(b.max.y) ||
      !Number.isFinite(b.max.z)
    ) {
      continue;
    }
    min.x = Math.min(min.x, b.min.x);
    min.y = Math.min(min.y, b.min.y);
    min.z = Math.min(min.z, b.min.z);
    max.x = Math.max(max.x, b.max.x);
    max.y = Math.max(max.y, b.max.y);
    max.z = Math.max(max.z, b.max.z);
  }

  if (!Number.isFinite(min.y) || !Number.isFinite(max.y)) return null;
  return { min, max };
}

/**
 * Computes a deterministic uniform scale & grounding transform from a reference
 * full-body bounding box so the body stands upright at `targetHeightMeters` (1.75 m = 175 cm),
 * centered horizontally at x = 0, z = 0, with feet grounded at y = groundY (0).
 *
 * CRITICAL: For split per-system GLB files exported from the same Blender/Z-Anatomy scene
 * (skin, skeleton, muscles, arteries, veins, nerves, organs, other), compute this transform
 * ONCE from the full-height reference system(s) (skin and/or skeleton) and apply the EXACT
 * same transform to every other system so internal organs and vessels remain millimeter-aligned.
 */
export function computeSharedBodyNormalization(
  refBox: BoundingBoxSummary,
  referenceSystems: AnatomicalSystemId[] = ['skeleton'],
  targetHeightMeters = BODY_MODEL_CONFIG.bodyHeightMeters,
  groundY = BODY_MODEL_CONFIG.groundY
): SharedBodyNormalization {
  const rawHeight = Math.max(refBox.max.y - refBox.min.y, 1e-4);
  const scale = targetHeightMeters / rawHeight;

  const centerX = (refBox.min.x + refBox.max.x) * 0.5;
  const centerZ = (refBox.min.z + refBox.max.z) * 0.5;

  return {
    scale,
    offsetX: -centerX * scale,
    offsetY: groundY - refBox.min.y * scale,
    offsetZ: -centerZ * scale,
    sourceHeightUnits: Number(rawHeight.toFixed(4)),
    targetHeightMeters,
    targetHeightCm: Math.round(targetHeightMeters * 100),
    referenceSystems,
  };
}

/**
 * Pure helper applying a `SharedBodyNormalization` transform to any 3D point
 * (used for unit verification and anchor projection).
 */
export function applyNormalizationToPoint(
  pt: Vec3Tuple,
  norm: SharedBodyNormalization
): Vec3Tuple {
  return {
    x: pt.x * norm.scale + norm.offsetX,
    y: pt.y * norm.scale + norm.offsetY,
    z: pt.z * norm.scale + norm.offsetZ,
  };
}

/**
 * Formats human-readable scale calibration diagnostics (e.g., detects whether
 * the raw Blender/Z-Anatomy export was in meters, centimeters, or millimeters).
 */
export function describeSourceUnits(sourceHeightUnits: number): string {
  if (sourceHeightUnits > 800) return 'millimeters (mm)';
  if (sourceHeightUnits > 80) return 'centimeters (cm)';
  if (sourceHeightUnits > 0.8 && sourceHeightUnits < 3.0) return 'meters (m)';
  return 'custom units';
}
