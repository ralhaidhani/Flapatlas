import * as THREE from 'three';
import type { AnatomicalSystemId } from './modelManifest';
import type { BoundingBoxSummary } from './modelNormalization';

export interface VesselAlignmentTransform {
  /** X offset in centimeters (clamped to [-15, 15], 0.1 cm = 1 mm step) */
  offsetXCm: number;
  /** Y offset in centimeters (clamped to [-15, 15], 0.1 cm = 1 mm step) */
  offsetYCm: number;
  /** Z offset in centimeters (clamped to [-15, 15], 0.1 cm = 1 mm step) */
  offsetZCm: number;
  /** Uniform scale multiplier (clamped to [0.90, 1.10], i.e. 90%–110%) */
  scale: number;
}

export const VESSEL_ALIGNMENT_LIMITS = {
  minOffsetCm: -15,
  maxOffsetCm: 15,
  stepOffsetCm: 0.1,
  minScale: 0.9,
  maxScale: 1.1,
  alignedThresholdCm: 1.0,
} as const;

export const DEFAULT_VESSEL_ALIGNMENT: VesselAlignmentTransform = {
  offsetXCm: 0,
  offsetYCm: 0,
  offsetZCm: 0,
  scale: 1,
};

/** BodyParts3D systems grouped together under one shared alignment transform. */
export const ALIGNED_SYSTEM_IDS: readonly AnatomicalSystemId[] = [
  'arteries',
  'veins',
  'skin',
] as const;

export function isAlignedSystem(system: AnatomicalSystemId): boolean {
  return system === 'arteries' || system === 'veins' || system === 'skin';
}

export interface CalibrationViewHint {
  id: string;
  structure: string;
  text: string;
}

/** Verbatim anatomical alignment reference hints shown beside the Calibration View preset. */
export const CALIBRATION_VIEW_HINTS: readonly CalibrationViewHint[] = [
  {
    id: 'abdominal-aorta',
    structure: 'Abdominal aorta',
    text: 'The abdominal aorta must lie directly in front of the lumbar vertebral bodies.',
  },
  {
    id: 'femoral-artery',
    structure: 'Femoral artery',
    text: 'The femoral artery runs over the front of the femoral head toward the medial thigh.',
  },
  {
    id: 'internal-thoracic',
    structure: 'Internal thoracic artery',
    text: 'The internal thoracic artery runs just lateral to the sternal border behind the costal cartilages.',
  },
  {
    id: 'skin-surface',
    structure: 'Skin surface',
    text: 'The skin surface must enclose the muscles.',
  },
] as const;

function sanitizeFinite(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Clamps and normalizes a partial VesselAlignmentTransform:
 * - X/Y/Z offsets clamped to [-15, 15] cm with 0.1 cm (1 mm) precision
 * - Uniform scale clamped to [0.90, 1.10] (90%–110%)
 */
export function clampVesselAlignment(
  input?: Partial<VesselAlignmentTransform> | null
): VesselAlignmentTransform {
  const rawX = sanitizeFinite(input?.offsetXCm, DEFAULT_VESSEL_ALIGNMENT.offsetXCm);
  const rawY = sanitizeFinite(input?.offsetYCm, DEFAULT_VESSEL_ALIGNMENT.offsetYCm);
  const rawZ = sanitizeFinite(input?.offsetZCm, DEFAULT_VESSEL_ALIGNMENT.offsetZCm);
  const rawScale = sanitizeFinite(input?.scale, DEFAULT_VESSEL_ALIGNMENT.scale);

  return {
    offsetXCm: roundTo(
      Math.max(VESSEL_ALIGNMENT_LIMITS.minOffsetCm, Math.min(VESSEL_ALIGNMENT_LIMITS.maxOffsetCm, rawX)),
      1
    ),
    offsetYCm: roundTo(
      Math.max(VESSEL_ALIGNMENT_LIMITS.minOffsetCm, Math.min(VESSEL_ALIGNMENT_LIMITS.maxOffsetCm, rawY)),
      1
    ),
    offsetZCm: roundTo(
      Math.max(VESSEL_ALIGNMENT_LIMITS.minOffsetCm, Math.min(VESSEL_ALIGNMENT_LIMITS.maxOffsetCm, rawZ)),
      1
    ),
    scale: roundTo(
      Math.max(VESSEL_ALIGNMENT_LIMITS.minScale, Math.min(VESSEL_ALIGNMENT_LIMITS.maxScale, rawScale)),
      4
    ),
  };
}

export function isDefaultVesselAlignment(transform: VesselAlignmentTransform): boolean {
  return (
    Math.abs(transform.offsetXCm) < 1e-4 &&
    Math.abs(transform.offsetYCm) < 1e-4 &&
    Math.abs(transform.offsetZCm) < 1e-4 &&
    Math.abs(transform.scale - 1) < 1e-4
  );
}

export function areVesselAlignmentsEqual(
  a: VesselAlignmentTransform,
  b: VesselAlignmentTransform
): boolean {
  return (
    Math.abs(a.offsetXCm - b.offsetXCm) < 1e-4 &&
    Math.abs(a.offsetYCm - b.offsetYCm) < 1e-4 &&
    Math.abs(a.offsetZCm - b.offsetZCm) < 1e-4 &&
    Math.abs(a.scale - b.scale) < 1e-4
  );
}

/**
 * Computes the local Three.js Group `position` and uniform `scale` for the shared
 * `{ arteries, veins, skin }` alignment group so that:
 * 1) Uniform scaling pivots cleanly around `pivotMeters` (keeping the group centre stationary
 *    when adjusting scale so X/Y/Z centre alignment does not drift).
 * 2) User X/Y/Z cm offsets always act in world anatomical axes (+X subject left, +Y superior,
 *    +Z anterior), accounting for `orientationRotatedY` if the parent root was rotated 180° around Y.
 */
export function computeAlignmentGroupLocalTransform(
  transform: VesselAlignmentTransform,
  pivotMeters: [number, number, number] = [0, 0.85, 0],
  orientationRotatedY = false
): { position: [number, number, number]; scale: number } {
  const clean = clampVesselAlignment(transform);
  const s = clean.scale;
  const signXZ = orientationRotatedY ? -1 : 1;
  const dx = (clean.offsetXCm / 100) * signXZ;
  const dy = clean.offsetYCm / 100;
  const dz = (clean.offsetZCm / 100) * signXZ;

  return {
    position: [
      roundTo(dx + pivotMeters[0] * (1 - s), 6),
      roundTo(dy + pivotMeters[1] * (1 - s), 6),
      roundTo(dz + pivotMeters[2] * (1 - s), 6),
    ],
    scale: s,
  };
}

/**
 * Applies the shared alignment transform directly to the Three.js Group containing
 * arteries + veins + skin so all three systems move and scale identically.
 */
export function applyVesselAlignmentToGroup(
  group: THREE.Object3D,
  transform: VesselAlignmentTransform,
  pivotMeters: [number, number, number] = [0, 0.85, 0],
  orientationRotatedY = false
): void {
  const { position, scale } = computeAlignmentGroupLocalTransform(
    transform,
    pivotMeters,
    orientationRotatedY
  );
  group.position.set(position[0], position[1], position[2]);
  group.scale.setScalar(scale);
  group.updateMatrix();
  group.updateMatrixWorld(true);
}

/**
 * Transforms an axis-aligned sub-mesh bounding box & center from local model space
 * into world space after applying both the shared BodyParts3D alignment transform
 * (for arteries/veins/skin) and optional root 180° Y rotation.
 */
export function transformSubMeshBoundsWithAlignment(
  sub: {
    system: AnatomicalSystemId;
    center: [number, number, number];
    boundsMin: [number, number, number];
    boundsMax: [number, number, number];
  },
  alignment: VesselAlignmentTransform,
  pivotMeters: [number, number, number],
  orientationRotatedY: boolean
): {
  center: [number, number, number];
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
} {
  let minX = sub.boundsMin[0];
  let minY = sub.boundsMin[1];
  let minZ = sub.boundsMin[2];
  let maxX = sub.boundsMax[0];
  let maxY = sub.boundsMax[1];
  let maxZ = sub.boundsMax[2];
  let cx = sub.center[0];
  let cy = sub.center[1];
  let cz = sub.center[2];

  if (isAlignedSystem(sub.system)) {
    const { position, scale } = computeAlignmentGroupLocalTransform(
      alignment,
      pivotMeters,
      orientationRotatedY
    );
    minX = minX * scale + position[0];
    minY = minY * scale + position[1];
    minZ = minZ * scale + position[2];
    maxX = maxX * scale + position[0];
    maxY = maxY * scale + position[1];
    maxZ = maxZ * scale + position[2];
    cx = cx * scale + position[0];
    cy = cy * scale + position[1];
    cz = cz * scale + position[2];
  }

  if (orientationRotatedY) {
    return {
      center: [roundTo(-cx, 4), roundTo(cy, 4), roundTo(-cz, 4)],
      boundsMin: [roundTo(-maxX, 4), roundTo(minY, 4), roundTo(-maxZ, 4)],
      boundsMax: [roundTo(-minX, 4), roundTo(maxY, 4), roundTo(-minZ, 4)],
    };
  }

  return {
    center: [roundTo(cx, 4), roundTo(cy, 4), roundTo(cz, 4)],
    boundsMin: [roundTo(minX, 4), roundTo(minY, 4), roundTo(minZ, 4)],
    boundsMax: [roundTo(maxX, 4), roundTo(maxY, 4), roundTo(maxZ, 4)],
  };
}

/**
 * Matches only the three calibration reference arterial structures for the Calibration View preset:
 * - Abdominal aorta
 * - Femoral arteries (left & right; BodyParts3D FJ2074 / FJ2143)
 * - Internal thoracic arteries (left & right; BodyParts3D FJ1972 / FJ1937)
 */
const CALIBRATION_ARTERY_FJ_CODES = new Set([
  'FJ2074', // left femoral artery
  'FJ2143', // right femoral artery
  'FJ1972', // left internal thoracic artery
  'FJ1937', // right internal thoracic artery
]);

export function isCalibrationReferenceArtery(
  name: string,
  fjCode?: string,
  rawMeshName?: string
): boolean {
  if (fjCode && CALIBRATION_ARTERY_FJ_CODES.has(fjCode.trim().toUpperCase())) {
    return true;
  }

  const checkSingle = (candidate: string | undefined): boolean => {
    if (!candidate) return false;

    const embeddedFj = candidate.match(/\b(FJ\d+)\b/i);
    if (embeddedFj && CALIBRATION_ARTERY_FJ_CODES.has(embeddedFj[1].toUpperCase())) {
      return true;
    }

    const normalized = candidate
      .replace(/^\s*FJ[A-Za-z0-9]+[\s_-]+/i, '')
      .replace(/\s*\[FJ[A-Za-z0-9_-]+\]\s*$/i, '')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\.(l|r|el|er|ol|or)$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!normalized) return false;

    // Abdominal aorta (and procedural Thoracoabdominal Aorta fallback)
    if (
      /\babdominal\s+aorta\b|\baorta\s+abdominalis\b|\bthoracoabdominal\s+aorta\b/.test(normalized)
    ) {
      return true;
    }

    // Main femoral arteries (exclude circumflex femoral, deep femoral / profunda, perforating branches)
    if (
      !/circumflex|deep|profunda|perforat|branch|genicular|epigastric|pudendal|lateral|medial/.test(
        normalized
      ) &&
      /^(left |right )?(common |superficial )?(femoral artery|arteria femoralis)$/.test(normalized)
    ) {
      return true;
    }

    // Internal thoracic (internal mammary) arteries (exclude branches like musculophrenic / pericardiacophrenic)
    if (
      !/branch|perforat|pericard|musculophren|intercostal|sternal/.test(normalized) &&
      /^(left |right )?(internal\s+(thoracic|mammary)\s+artery|arteria\s+thoracica\s+interna)$/.test(
        normalized
      )
    ) {
      return true;
    }

    return false;
  };

  return checkSingle(name) || checkSingle(rawMeshName);
}

export interface SystemBoundsMetrics {
  present: boolean;
  minMeters: [number, number, number];
  maxMeters: [number, number, number];
  centerMeters: [number, number, number];
  sizeCm: [number, number, number];
  heightCm: number;
}

export interface CenterDeltaCm {
  dxCm: number;
  dyCm: number;
  dzCm: number;
  distanceCm: number;
}

export interface AlignmentDiagnosticsSummary {
  skeleton: SystemBoundsMetrics;
  muscles: SystemBoundsMetrics;
  vessels: SystemBoundsMetrics;
  skin: SystemBoundsMetrics;
  vesselsVsSkeletonCm: CenterDeltaCm | null;
  skinVsSkeletonCm: CenterDeltaCm | null;
  musclesVsSkeletonCm: CenterDeltaCm | null;
  /** True when both skeleton and vessels are loaded and centre difference <= 1.0 cm */
  isVesselAligned: boolean;
  /** Count of calibration reference arteries matched in loaded arterial meshes */
  calibrationArteryCount: number;
}

export function computeSystemBoundsMetrics(
  box: BoundingBoxSummary | null | undefined
): SystemBoundsMetrics {
  if (!box) {
    return {
      present: false,
      minMeters: [0, 0, 0],
      maxMeters: [0, 0, 0],
      centerMeters: [0, 0, 0],
      sizeCm: [0, 0, 0],
      heightCm: 0,
    };
  }
  const sx = Math.max(0, box.max.x - box.min.x);
  const sy = Math.max(0, box.max.y - box.min.y);
  const sz = Math.max(0, box.max.z - box.min.z);
  const cx = (box.min.x + box.max.x) * 0.5;
  const cy = (box.min.y + box.max.y) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;

  return {
    present: true,
    minMeters: [roundTo(box.min.x, 4), roundTo(box.min.y, 4), roundTo(box.min.z, 4)],
    maxMeters: [roundTo(box.max.x, 4), roundTo(box.max.y, 4), roundTo(box.max.z, 4)],
    centerMeters: [roundTo(cx, 4), roundTo(cy, 4), roundTo(cz, 4)],
    sizeCm: [roundTo(sx * 100, 1), roundTo(sy * 100, 1), roundTo(sz * 100, 1)],
    heightCm: roundTo(sy * 100, 1),
  };
}

function computeCenterDeltaCm(
  target: SystemBoundsMetrics,
  reference: SystemBoundsMetrics
): CenterDeltaCm | null {
  if (!target.present || !reference.present) return null;
  const dxCm = roundTo((target.centerMeters[0] - reference.centerMeters[0]) * 100, 2);
  const dyCm = roundTo((target.centerMeters[1] - reference.centerMeters[1]) * 100, 2);
  const dzCm = roundTo((target.centerMeters[2] - reference.centerMeters[2]) * 100, 2);
  const distanceCm = roundTo(Math.hypot(dxCm, dyCm, dzCm), 2);
  return { dxCm, dyCm, dzCm, distanceCm };
}

/**
 * Computes full bounding-box, height, and centre-difference diagnostics across
 * skeleton, muscles, vessels (arteries + veins), and skin.
 * Marks `isVesselAligned = true` when the vessel group centre is within 1.0 cm of
 * the skeleton centre.
 */
export function computeAlignmentDiagnostics(
  boxes: {
    skeleton?: BoundingBoxSummary | null;
    muscles?: BoundingBoxSummary | null;
    vessels?: BoundingBoxSummary | null;
    skin?: BoundingBoxSummary | null;
  },
  calibrationArteryCount = 0
): AlignmentDiagnosticsSummary {
  const skeleton = computeSystemBoundsMetrics(boxes.skeleton);
  const muscles = computeSystemBoundsMetrics(boxes.muscles);
  const vessels = computeSystemBoundsMetrics(boxes.vessels);
  const skin = computeSystemBoundsMetrics(boxes.skin);

  const vesselsVsSkeletonCm = computeCenterDeltaCm(vessels, skeleton);
  const skinVsSkeletonCm = computeCenterDeltaCm(skin, skeleton);
  const musclesVsSkeletonCm = computeCenterDeltaCm(muscles, skeleton);

  const isVesselAligned = Boolean(
    vesselsVsSkeletonCm &&
      vesselsVsSkeletonCm.distanceCm <= VESSEL_ALIGNMENT_LIMITS.alignedThresholdCm + 1e-6
  );

  return {
    skeleton,
    muscles,
    vessels,
    skin,
    vesselsVsSkeletonCm,
    skinVsSkeletonCm,
    musclesVsSkeletonCm,
    isVesselAligned,
    calibrationArteryCount,
  };
}

/**
 * Helper to measure a Three.js Object3D's current world-space bounding box as a BoundingBoxSummary,
 * safely ignoring visibility flags so hidden layers (e.g. muscles during Calibration View) still
 * report accurate alignment diagnostics.
 */
export function measureObjectWorldBounds(obj: THREE.Object3D | null | undefined): BoundingBoxSummary | null {
  if (!obj) return null;
  obj.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();
  let hasAny = false;

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      if (!child.geometry.boundingBox) {
        child.geometry.computeBoundingBox();
      }
      if (child.geometry.boundingBox && !child.geometry.boundingBox.isEmpty()) {
        meshBox.copy(child.geometry.boundingBox);
        meshBox.applyMatrix4(child.matrixWorld);
        if (!hasAny) {
          box.copy(meshBox);
          hasAny = true;
        } else {
          box.union(meshBox);
        }
      }
    }
  });

  if (!hasAny || box.isEmpty()) return null;
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}

/** Formats alignment diagnostics for structured browser console inspection. */
export function formatAlignmentDiagnosticsForConsole(
  diag: AlignmentDiagnosticsSummary,
  transform: VesselAlignmentTransform
): string {
  const fmtRow = (label: string, m: SystemBoundsMetrics, delta: CenterDeltaCm | null) => {
    if (!m.present) return `  ${label.padEnd(9)}: not loaded`;
    const minStr = `[${m.minMeters.map((v) => v.toFixed(3)).join(', ')}]`;
    const maxStr = `[${m.maxMeters.map((v) => v.toFixed(3)).join(', ')}]`;
    const ctrStr = `[${m.centerMeters.map((v) => (v * 100).toFixed(1)).join(', ')}] cm`;
    const deltaStr = delta
      ? ` | Δ vs skeleton: (${delta.dxCm >= 0 ? '+' : ''}${delta.dxCm}, ${delta.dyCm >= 0 ? '+' : ''}${delta.dyCm}, ${delta.dzCm >= 0 ? '+' : ''}${delta.dzCm}) cm (|Δ|=${delta.distanceCm} cm)`
      : '';
    return `  ${label.padEnd(9)}: h=${m.heightCm.toFixed(1)} cm | bbox ${minStr}..${maxStr} m | ctr ${ctrStr}${deltaStr}`;
  };

  const status = !diag.vessels.present
    ? 'NO VESSELS LOADED'
    : diag.isVesselAligned
      ? 'ALIGNED (<= 1.0 cm)'
      : `OFFSET (${diag.vesselsVsSkeletonCm?.distanceCm ?? '?'} cm)`;

  return [
    `[FlapAtlas Alignment Diagnostics] Status: ${status} | Transform: X=${transform.offsetXCm}cm Y=${transform.offsetYCm}cm Z=${transform.offsetZCm}cm Scale=${(transform.scale * 100).toFixed(1)}%`,
    fmtRow('Skeleton', diag.skeleton, null),
    fmtRow('Muscles', diag.muscles, diag.musclesVsSkeletonCm),
    fmtRow('Vessels', diag.vessels, diag.vesselsVsSkeletonCm),
    fmtRow('Skin', diag.skin, diag.skinVsSkeletonCm),
  ].join('\n');
}
