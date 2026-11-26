import anchorsRaw from '../data/anchors.json';
import type { FlapRecord } from '../types/schemas';
import type { AnatomicalSystemId } from './modelManifest';
import type { LayerKey } from '../store/useAtlasStore';

export const SCHEMATIC_TAG_TEXT = 'Schematic — not from source model';
export const ANCHOR_MODEL_VERSION = 'bp3d-4.0';

export type AnchorSide = 'right' | 'left' | 'midline';

export interface LandmarkAnchor {
  id: string;
  name: string;
  shortLabel: string;
  side: AnchorSide;
  region: string;
  cameraPreset: string;
  clinicalNote: string;
  /** Reference 3D coordinates in meters on the 1.75 m procedural body frame */
  defaultProceduralPos: [number, number, number];
  /** Active calibrated 3D coordinates in meters (1:1 real scale, BodyParts3D 4.0 frame) */
  position: [number, number, number];
  skeletonHintKeywords: string[];
  modelVersion?: string;
  source: 'default' | 'calibrated';
  /** Optional BP3D bone/skin mesh name recorded when picked or auto-proposed */
  snappedSkeletonMesh?: string;
  updatedAtIso?: string;
}

export interface AnchorCalibrationOverride {
  position: [number, number, number];
  modelVersion?: string;
  snappedSkeletonMesh?: string;
  updatedAtIso: string;
}

export type AnchorCalibrationMap = Record<string, AnchorCalibrationOverride>;

export interface SourceVesselCandidate {
  meshName: string;
  system: AnatomicalSystemId;
  anatomyId: string;
  label: string;
  center: [number, number, number];
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
}

export interface AnchorProposalSubMeshInput {
  meshName: string;
  normalizedName?: string;
  system: AnatomicalSystemId;
  laterality: 'right' | 'left' | 'midline';
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  center: [number, number, number];
}

export interface VesselSnapResult {
  points: Array<[number, number, number]>;
  snappedToSource: boolean;
  matchedMeshName: string | null;
}

export interface ResolvedFlapOverlaySpec {
  paddleCenter: [number, number, number];
  pediclePath: Array<[number, number, number]>;
  minorPediclePath?: Array<[number, number, number]>;
  nervePath?: Array<[number, number, number]>;
  perforatorPositions: Array<[number, number, number]>;
  pivotPoint: [number, number, number];
  paddleProvenance: 'schematic';
  perforatorsProvenance: 'schematic';
  pedicleProvenance: 'source-vessel' | 'schematic';
  snappedVesselMeshName: string | null;
  drivingAnchorLabels: string[];
  calibratedAnchorCount: number;
}

export const REQUIRED_ANCHOR_IDS = [
  'asis',
  'psis',
  'iliac_crest',
  'pubic_tubercle',
  'greater_trochanter',
  'umbilicus',
  'superolateral_patella',
  'fibular_head',
  'lateral_malleolus',
  'medial_epicondyle',
  'acromion',
  'inferior_angle_scapula',
  'mastoid',
] as const;

export const DEFAULT_ANCHORS: LandmarkAnchor[] = (anchorsRaw as LandmarkAnchor[]).map((a) => ({
  ...a,
  modelVersion: a.modelVersion || ANCHOR_MODEL_VERSION,
  defaultProceduralPos: [
    a.defaultProceduralPos[0],
    a.defaultProceduralPos[1],
    a.defaultProceduralPos[2],
  ],
  position: [a.position[0], a.position[1], a.position[2]],
  skeletonHintKeywords: [...a.skeletonHintKeywords],
}));

/**
 * Checks whether a persisted anchor override map contains stale non-BP3D-4.0
 * (e.g., legacy Z-Anatomy) entries that should be ignored and trigger a
 * "Please recalibrate" banner.
 */
export function detectStaleAnchorCalibration(
  overrides: AnchorCalibrationMap | null | undefined
): { hasStaleEntries: boolean; staleIds: string[] } {
  if (!overrides) return { hasStaleEntries: false, staleIds: [] };
  const staleIds: string[] = [];
  for (const [id, ov] of Object.entries(overrides)) {
    if (!ov) continue;
    if (ov.modelVersion !== ANCHOR_MODEL_VERSION) {
      staleIds.push(id);
    }
  }
  return { hasStaleEntries: staleIds.length > 0, staleIds };
}

/**
 * Merges saved IndexedDB calibration overrides onto the canonical BP3D 4.0 anchors.json
 * baseline. Any persisted override missing `modelVersion === "bp3d-4.0"` is ignored so
 * stale Z-Anatomy coordinates are never applied to unified BodyParts3D 4.0 geometry.
 */
export function mergeAnchorsWithCalibration(
  defaults: LandmarkAnchor[],
  overrides: AnchorCalibrationMap | null | undefined
): LandmarkAnchor[] {
  if (!overrides) {
    return defaults.map((a) => ({
      ...a,
      modelVersion: ANCHOR_MODEL_VERSION,
      defaultProceduralPos: [...a.defaultProceduralPos] as [number, number, number],
      position: [...a.position] as [number, number, number],
    }));
  }
  return defaults.map((a) => {
    const ov = overrides[a.id];
    if (
      ov &&
      ov.modelVersion === ANCHOR_MODEL_VERSION &&
      Array.isArray(ov.position) &&
      ov.position.length === 3 &&
      ov.position.every((n) => typeof n === 'number' && Number.isFinite(n))
    ) {
      return {
        ...a,
        modelVersion: ANCHOR_MODEL_VERSION,
        position: [
          Number(ov.position[0].toFixed(4)),
          Number(ov.position[1].toFixed(4)),
          Number(ov.position[2].toFixed(4)),
        ],
        source: 'calibrated',
        snappedSkeletonMesh: ov.snappedSkeletonMesh,
        updatedAtIso: ov.updatedAtIso,
      };
    }
    return {
      ...a,
      modelVersion: ANCHOR_MODEL_VERSION,
      defaultProceduralPos: [...a.defaultProceduralPos] as [number, number, number],
      position: [...a.position] as [number, number, number],
    };
  });
}

function r4(n: number): number {
  return Number(n.toFixed(4));
}

/**
 * Auto-proposes all 13 BodyParts3D 4.0 landmark anchors directly from the loaded
 * BP3D skeleton & skin sub-mesh bounds (unified coordinate frame: Y-up, +Z anterior,
 * -X right, +X left). Returns overrides tagged with `modelVersion: "bp3d-4.0"`.
 */
export function proposeBp3dAnchorsFromSubMeshes(
  subMeshes: AnchorProposalSubMeshInput[]
): AnchorCalibrationMap {
  const nowIso = new Date().toISOString();
  const out: AnchorCalibrationMap = {};

  const findRightBone = (pattern: RegExp): AnchorProposalSubMeshInput | undefined =>
    subMeshes.find(
      (s) =>
        s.system === 'skeleton' &&
        s.laterality === 'right' &&
        (pattern.test(s.normalizedName || '') || pattern.test(s.meshName.toLowerCase()))
    );

  const findMidlineBone = (pattern: RegExp): AnchorProposalSubMeshInput | undefined =>
    subMeshes.find(
      (s) =>
        s.system === 'skeleton' &&
        (pattern.test(s.normalizedName || '') || pattern.test(s.meshName.toLowerCase()))
    );

  const skinMesh = subMeshes.find((s) => s.system === 'skin');

  const hip = findRightBone(/\bhip bone\b|\bos coxae\b|\bilium\b/);
  if (hip) {
    const [minX, minY, minZ] = hip.boundsMin;
    const [maxX, maxY, maxZ] = hip.boundsMax;
    const w = maxX - minX;
    const h = maxY - minY;
    const d = maxZ - minZ;

    // ASIS: anterolateral superior iliac spine
    out.asis = {
      position: [r4(minX + w * 0.14), r4(minY + h * 0.695), r4(maxZ - d * 0.01)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: hip.meshName,
      updatedAtIso: nowIso,
    };
    // PSIS: posteromedial upper iliac spine
    out.psis = {
      position: [r4(maxX - w * 0.32), r4(minY + h * 0.68), r4(minZ + d * 0.02)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: hip.meshName,
      updatedAtIso: nowIso,
    };
    // Iliac crest: superolateral rim
    out.iliac_crest = {
      position: [r4(minX + w * 0.015), r4(maxY - h * 0.005), r4(minZ + d * 0.49)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: hip.meshName,
      updatedAtIso: nowIso,
    };
    // Pubic tubercle: anteromedial inferior pubic crest
    out.pubic_tubercle = {
      position: [r4(maxX - w * 0.15), r4(minY + h * 0.29), r4(maxZ - d * 0.03)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: hip.meshName,
      updatedAtIso: nowIso,
    };
  }

  const femur = findRightBone(/\bfemur\b/);
  if (femur) {
    const [minX, minY, minZ] = femur.boundsMin;
    const [, maxY, maxZ] = femur.boundsMax;
    const h = maxY - minY;
    const d = maxZ - minZ;
    // Greater trochanter: lateralmost proximal femoral prominence
    out.greater_trochanter = {
      position: [r4(minX + 0.001), r4(maxY - h * 0.06), r4(minZ + d * 0.36)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: femur.meshName,
      updatedAtIso: nowIso,
    };
  }

  const patella = findRightBone(/\bpatella\b/);
  if (patella) {
    const [minX, , ] = patella.boundsMin;
    const [, maxY, maxZ] = patella.boundsMax;
    out.superolateral_patella = {
      position: [r4(minX), r4(maxY), r4(maxZ - 0.002)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: patella.meshName,
      updatedAtIso: nowIso,
    };
  }

  const fibula = findRightBone(/\bfibula\b/);
  if (fibula) {
    const [minX, minY, minZ] = fibula.boundsMin;
    const [maxX, maxY, maxZ] = fibula.boundsMax;
    const midZ = (minZ + maxZ) * 0.5;
    out.fibular_head = {
      position: [r4(minX + (maxX - minX) * 0.06), r4(maxY - 0.003), r4(midZ)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: fibula.meshName,
      updatedAtIso: nowIso,
    };
    out.lateral_malleolus = {
      position: [r4(minX + (maxX - minX) * 0.3), r4(minY + 0.003), r4(minZ + (maxZ - minZ) * 0.32)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: fibula.meshName,
      updatedAtIso: nowIso,
    };
  }

  const humerus = findRightBone(/\bhumerus\b/);
  if (humerus) {
    const [minX, minY, minZ] = humerus.boundsMin;
    const [maxX, maxY, maxZ] = humerus.boundsMax;
    const w = maxX - minX;
    const h = maxY - minY;
    // Medial epicondyle: distal medial prominence of right humerus (toward +X)
    out.medial_epicondyle = {
      position: [r4(maxX - w * 0.16), r4(minY + h * 0.04), r4((minZ + maxZ) * 0.5 - 0.004)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: humerus.meshName,
      updatedAtIso: nowIso,
    };
  }

  const scapula = findRightBone(/\bscapula\b/);
  if (scapula) {
    const [minX, minY, minZ] = scapula.boundsMin;
    const [maxX, maxY, maxZ] = scapula.boundsMax;
    const w = maxX - minX;
    const h = maxY - minY;
    const d = maxZ - minZ;
    out.acromion = {
      position: [r4(minX + w * 0.015), r4(maxY - h * 0.035), r4(minZ + d * 0.71)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: scapula.meshName,
      updatedAtIso: nowIso,
    };
    out.inferior_angle_scapula = {
      position: [r4(maxX - w * 0.3), r4(minY + h * 0.012), r4(minZ + d * 0.12)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: scapula.meshName,
      updatedAtIso: nowIso,
    };
  }

  const temporal = findRightBone(/\btemporal bone\b/);
  if (temporal) {
    const [minX, minY, minZ] = temporal.boundsMin;
    const [maxX, maxY, maxZ] = temporal.boundsMax;
    const w = maxX - minX;
    const h = maxY - minY;
    const d = maxZ - minZ;
    out.mastoid = {
      position: [r4(minX + w * 0.16), r4(minY + h * 0.085), r4(minZ + d * 0.31)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: temporal.meshName,
      updatedAtIso: nowIso,
    };
  }

  // Umbilicus: anterior midline on skin.glb at L3-L4 height
  const l3 = findMidlineBone(/\bthird lumbar vertebra\b|\bl3\b/);
  const l4 = findMidlineBone(/\bfourth lumbar vertebra\b|\bl4\b/);
  if (l3 || l4 || skinMesh) {
    const umbY =
      l3 && l4
        ? (l3.boundsMin[1] + l4.boundsMax[1]) * 0.5
        : l3
          ? l3.boundsMin[1]
          : l4
            ? l4.boundsMax[1]
            : 0.962;
    const umbZ = skinMesh ? Math.min(skinMesh.boundsMax[2] - 0.034, 0.214) : 0.212;
    out.umbilicus = {
      position: [0, r4(umbY), r4(umbZ)],
      modelVersion: ANCHOR_MODEL_VERSION,
      snappedSkeletonMesh: skinMesh?.meshName || l3?.meshName || l4?.meshName,
      updatedAtIso: nowIso,
    };
  }

  return out;
}

/**
 * Validates and extracts an AnchorCalibrationMap from imported JSON text
 * (supports either the full anchors.json array format or a keyed override map).
 */
export function parseAnchorsImportJson(rawJson: string): {
  ok: boolean;
  overrides?: AnchorCalibrationMap;
  count?: number;
  message: string;
} {
  try {
    const parsed = JSON.parse(rawJson);
    const validIds = new Set(DEFAULT_ANCHORS.map((a) => a.id));
    const overrides: AnchorCalibrationMap = {};
    const nowIso = new Date().toISOString();

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (
          item &&
          typeof item.id === 'string' &&
          validIds.has(item.id) &&
          Array.isArray(item.position) &&
          item.position.length === 3 &&
          item.position.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))
        ) {
          overrides[item.id] = {
            position: [
              Number(item.position[0].toFixed(4)),
              Number(item.position[1].toFixed(4)),
              Number(item.position[2].toFixed(4)),
            ],
            modelVersion:
              typeof item.modelVersion === 'string' ? item.modelVersion : ANCHOR_MODEL_VERSION,
            snappedSkeletonMesh:
              typeof item.snappedSkeletonMesh === 'string' ? item.snappedSkeletonMesh : undefined,
            updatedAtIso: typeof item.updatedAtIso === 'string' ? item.updatedAtIso : nowIso,
          };
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
        if (!validIds.has(id) || !entry || typeof entry !== 'object') continue;
        const e = entry as Record<string, unknown>;
        if (
          Array.isArray(e.position) &&
          e.position.length === 3 &&
          e.position.every((n) => typeof n === 'number' && Number.isFinite(n))
        ) {
          overrides[id] = {
            position: [
              Number((e.position[0] as number).toFixed(4)),
              Number((e.position[1] as number).toFixed(4)),
              Number((e.position[2] as number).toFixed(4)),
            ],
            modelVersion:
              typeof e.modelVersion === 'string' ? e.modelVersion : ANCHOR_MODEL_VERSION,
            snappedSkeletonMesh:
              typeof e.snappedSkeletonMesh === 'string' ? e.snappedSkeletonMesh : undefined,
            updatedAtIso: typeof e.updatedAtIso === 'string' ? e.updatedAtIso : nowIso,
          };
        }
      }
    }

    const count = Object.keys(overrides).length;
    if (count === 0) {
      return {
        ok: false,
        message: 'No valid landmark anchor coordinates found in JSON.',
      };
    }
    return {
      ok: true,
      overrides,
      count,
      message: `Imported ${count} calibrated landmark anchor${count === 1 ? '' : 's'}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Invalid JSON: ${err instanceof Error ? err.message : 'parse error'}`,
    };
  }
}

interface ControlPoint {
  id: string;
  label: string;
  ref: [number, number, number];
  delta: [number, number, number];
}

function buildAnchorControlPoints(
  anchors: LandmarkAnchor[],
  useRealModelFrame: boolean
): ControlPoint[] {
  const pts: ControlPoint[] = [];
  for (const a of anchors) {
    const targetPos =
      useRealModelFrame || a.source === 'calibrated' ? a.position : a.defaultProceduralPos;
    const dx = targetPos[0] - a.defaultProceduralPos[0];
    const dy = targetPos[1] - a.defaultProceduralPos[1];
    const dz = targetPos[2] - a.defaultProceduralPos[2];

    pts.push({
      id: a.id,
      label: a.shortLabel,
      ref: a.defaultProceduralPos,
      delta: [dx, dy, dz],
    });

    if (a.side !== 'midline' && Math.abs(a.defaultProceduralPos[0]) > 0.015) {
      pts.push({
        id: `${a.id}_mirror`,
        label: a.shortLabel,
        ref: [-a.defaultProceduralPos[0], a.defaultProceduralPos[1], a.defaultProceduralPos[2]],
        delta: [-dx, dy, dz],
      });
    }
  }
  return pts;
}

/**
 * Smoothly repositions any 3D flap overlay point relative to the calibrated
 * anatomical landmark anchors using inverse-distance weighted (IDW) interpolation.
 */
export function transformPointRelativeToAnchors(
  point: [number, number, number],
  anchors: LandmarkAnchor[],
  useRealModelFrame: boolean
): { point: [number, number, number]; nearestAnchors: string[] } {
  const controlPts = buildAnchorControlPoints(anchors, useRealModelFrame);
  if (controlPts.length === 0) {
    return { point: [point[0], point[1], point[2]], nearestAnchors: [] };
  }

  const ranked = controlPts
    .map((cp) => {
      const ddx = point[0] - cp.ref[0];
      const ddy = point[1] - cp.ref[1];
      const ddz = point[2] - cp.ref[2];
      return {
        cp,
        dist: Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz),
      };
    })
    .sort((a, b) => a.dist - b.dist);

  const localPool = ranked.slice(0, Math.min(3, ranked.length));
  const nearestAnchors = Array.from(new Set(localPool.slice(0, 2).map((r) => r.cp.label)));

  let sumW = 0;
  let accDx = 0;
  let accDy = 0;
  let accDz = 0;

  const epsilon = 0.015;
  const power = 2.8;

  for (const item of localPool) {
    const w = 1 / Math.pow(item.dist + epsilon, power);
    sumW += w;
    accDx += w * item.cp.delta[0];
    accDy += w * item.cp.delta[1];
    accDz += w * item.cp.delta[2];
  }

  if (sumW <= 0) {
    return { point: [point[0], point[1], point[2]], nearestAnchors };
  }

  return {
    point: [
      Number((point[0] + accDx / sumW).toFixed(4)),
      Number((point[1] + accDy / sumW).toFixed(4)),
      Number((point[2] + accDz / sumW).toFixed(4)),
    ],
    nearestAnchors,
  };
}

function tokenizeVesselName(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(
      (t) =>
        t.length >= 3 &&
        ![
          'artery',
          'vein',
          'branch',
          'descending',
          'ascending',
          'transverse',
          'the',
          'and',
          'of',
        ].includes(t)
    );
}

/**
 * Checks whether a real source vessel mesh exists in the loaded GLB model
 * matching the flap pedicle artery. If found within anatomical proximity, snaps
 * the pedicle path smoothly onto that source vessel mesh.
 */
export function snapPathToSourceVessel(
  path: Array<[number, number, number]>,
  sourceVesselCandidates: SourceVesselCandidate[],
  arteryName: string
): VesselSnapResult {
  if (path.length === 0 || sourceVesselCandidates.length === 0) {
    return {
      points: path,
      snappedToSource: false,
      matchedMeshName: null,
    };
  }

  const tokens = tokenizeVesselName(arteryName);
  const mid = path[Math.floor(path.length / 2)];

  let best: SourceVesselCandidate | null = null;
  let bestScore = -1;

  for (const cand of sourceVesselCandidates) {
    if (cand.system !== 'arteries' && cand.system !== 'veins') continue;
    const haystack = `${cand.meshName} ${cand.label} ${cand.anatomyId}`.toLowerCase();
    const tokenHits = tokens.filter((t) => haystack.includes(t)).length;
    if (tokenHits === 0) continue;

    const dist = Math.hypot(
      cand.center[0] - mid[0],
      cand.center[1] - mid[1],
      cand.center[2] - mid[2]
    );
    if (dist > 0.16) continue;

    const score = tokenHits * 10 - dist * 25;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  if (!best) {
    return {
      points: path,
      snappedToSource: false,
      matchedMeshName: null,
    };
  }

  const shiftX = best.center[0] - mid[0];
  const shiftY = best.center[1] - mid[1];
  const shiftZ = best.center[2] - mid[2];

  const snapped: Array<[number, number, number]> = path.map((pt, idx) => {
    const t = path.length > 1 ? idx / (path.length - 1) : 0.5;
    const w = 1.0 - t * 0.45;
    return [
      Number((pt[0] + shiftX * w).toFixed(4)),
      Number((pt[1] + shiftY * w).toFixed(4)),
      Number((pt[2] + shiftZ * w).toFixed(4)),
    ];
  });

  return {
    points: snapped,
    snappedToSource: true,
    matchedMeshName: best.meshName,
  };
}

/**
 * Resolves all 3D visual overlay coordinates for a flap relative to the calibrated
 * landmark anchors and snaps pedicle paths to real source vessel meshes when available.
 * Never modifies any clinical measurements in the FlapRecord.
 */
export function resolveFlapOverlayRelativeToAnchors(
  flap: FlapRecord,
  anchors: LandmarkAnchor[],
  options: {
    useRealModelFrame: boolean;
    sourceVesselCandidates?: SourceVesselCandidate[];
  }
): ResolvedFlapOverlaySpec {
  const { useRealModelFrame, sourceVesselCandidates = [] } = options;
  const spec = flap.spec3d;

  const paddleRes = transformPointRelativeToAnchors(spec.paddleCenter, anchors, useRealModelFrame);
  const pivotRes = transformPointRelativeToAnchors(spec.pivotPoint, anchors, useRealModelFrame);

  const rawPediclePath = spec.pediclePath.map(
    (pt) => transformPointRelativeToAnchors(pt, anchors, useRealModelFrame).point
  );
  const vesselSnap = snapPathToSourceVessel(
    rawPediclePath,
    sourceVesselCandidates,
    flap.vascular_anatomy.dominant_pedicle.artery
  );

  const minorPediclePath = spec.minorPediclePath?.map(
    (pt) => transformPointRelativeToAnchors(pt, anchors, useRealModelFrame).point
  );
  const nervePath = spec.nervePath?.map(
    (pt) => transformPointRelativeToAnchors(pt, anchors, useRealModelFrame).point
  );

  const perforatorPositions: Array<[number, number, number]> = [];
  for (const perf of flap.vascular_anatomy.perforators) {
    if (!perf.position3d) continue;
    perforatorPositions.push(
      transformPointRelativeToAnchors(perf.position3d, anchors, useRealModelFrame).point
    );
  }

  return {
    paddleCenter: paddleRes.point,
    pediclePath: vesselSnap.points,
    minorPediclePath,
    nervePath,
    perforatorPositions,
    pivotPoint: pivotRes.point,
    paddleProvenance: 'schematic',
    perforatorsProvenance: 'schematic',
    pedicleProvenance: vesselSnap.snappedToSource ? 'source-vessel' : 'schematic',
    snappedVesselMeshName: vesselSnap.matchedMeshName,
    drivingAnchorLabels: paddleRes.nearestAnchors,
    calibratedAnchorCount: anchors.filter((a) => a.source === 'calibrated').length,
  };
}

/**
 * Reports whether a 3D layer is a schematic procedural overlay (not sourced
 * from the loaded real anatomical GLB model).
 */
export function isLayerSchematic(
  layerKey: LayerKey,
  loadedSystems: AnatomicalSystemId[],
  isRealModelActive: boolean
): boolean {
  if (!isRealModelActive) return true;
  switch (layerKey) {
    case 'skeleton':
      return !loadedSystems.includes('skeleton');
    case 'muscle':
      return !loadedSystems.includes('muscles');
    case 'organs':
      return !loadedSystems.includes('organs');
    case 'nerves':
      return !loadedSystems.includes('nerves');
    case 'skin':
      return !loadedSystems.includes('skin');
    case 'arteries':
      return !loadedSystems.includes('arteries');
    case 'veins':
      return !loadedSystems.includes('veins');
    case 'landmarks':
      return false;
    default:
      return true;
  }
}

/**
 * Computes Euclidean distance in centimeters between an anchor's active position
 * and its default BP3D 4.0 baseline position.
 */
export function computeAnchorDeltaCm(anchor: LandmarkAnchor): number {
  const baseline = DEFAULT_ANCHORS.find((d) => d.id === anchor.id)?.position ?? anchor.position;
  const d = Math.hypot(
    anchor.position[0] - baseline[0],
    anchor.position[1] - baseline[1],
    anchor.position[2] - baseline[2]
  );
  return Number((d * 100).toFixed(1));
}
