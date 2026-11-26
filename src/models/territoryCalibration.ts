import * as THREE from 'three';
import {
  headNeckMuscleTerritories,
  MUSCLE_TERRITORIES,
} from '../data/territories/index';
import type { LoadedGlbBody, MergedSubMeshRecord } from './glbLoader';
import {
  sampleTerritoryFieldAtWorldPos,
  type TerritoryFieldData,
} from './territoryFieldCore';
import { TERRITORY_SLOT_BY_INDEX } from './territoryPalette';
import type { Vec3Tuple } from './territorySeeds';

/**
 * Phase 11b (§3.4) — Automated Muscle Territory Calibration Audit.
 *
 * For every muscle in Table 23.2 (leg muscles) and Table 23.3 (head & neck muscles)
 * that exists in the loaded BodyParts3D 4.0 mesh set, counts how many distinct primary
 * angiosome territories the muscle intersects in the baked 3-D field and compares
 * against Morris & Taylor Ch. 23.
 *
 * CRITICAL HONESTY RULE:
 * Mismatches are NEVER auto-fixed and NEVER hidden — every mismatch is emitted
 * explicitly as a `"territory calibration warning"`.
 */

export interface MuscleCalibrationEntry {
  muscleId: string;
  muscleName: string;
  normalizedName: string;
  sourceTable: 'Table 23.2 (Leg)' | 'Table 23.3 (Head & Neck)';
  expectedCount: number;
  expectedVariantCount?: number;
  computedCount: number;
  intersectedTerritoryIds: string[];
  intersectedTerritoryLabels: string[];
  matchedSubMeshCount: number;
  sampledPointCount: number;
  status: 'match' | 'warning' | 'absent_in_bp3d';
  warningMessage?: string;
}

export interface TerritoryCalibrationReport {
  checkedAtIso: string;
  totalTableMuscles: number;
  checkedInBp3dCount: number;
  absentInBp3dCount: number;
  matchedCount: number;
  warningCount: number;
  entries: MuscleCalibrationEntry[];
  warnings: MuscleCalibrationEntry[];
}

const _tmpVec = new THREE.Vector3();

function normalizeMuscleKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\[fj\d+\]/g, '')
    .replace(/\b(left|right|bilateral|muscle)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findMatchingMuscleSubMeshes(
  allSubMeshes: readonly MergedSubMeshRecord[],
  normalizedTarget: string
): MergedSubMeshRecord[] {
  const target = normalizeMuscleKey(normalizedTarget);
  if (!target) return [];

  // Prefer right-side meshes when bilateral so bilateral mirror symmetry doesn't double-count
  const matches = allSubMeshes.filter((sm) => {
    if (sm.system !== 'muscles') return false;
    const norm = normalizeMuscleKey(sm.normalizedName || sm.label || sm.meshName);
    const grp = normalizeMuscleKey(sm.groupLabel || '');
    return (
      norm === target ||
      grp === target ||
      norm.includes(target) ||
      (target.length >= 6 && target.includes(norm) && norm.length >= 6)
    );
  });

  const rightOnly = matches.filter((m) => m.laterality === 'right');
  return rightOnly.length > 0 ? rightOnly : matches;
}

function sampleMusclePointsFromSubMesh(
  subMesh: MergedSubMeshRecord,
  body?: LoadedGlbBody | null
): Vec3Tuple[] {
  const pts: Vec3Tuple[] = [];

  if (body) {
    const sysGroup = body.systemGroups[subMesh.system];
    let targetMesh: THREE.Mesh | null = null;
    if (sysGroup) {
      sysGroup.traverse((obj) => {
        if (targetMesh) return;
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          const list = m.userData.subMeshes as MergedSubMeshRecord[] | undefined;
          if (list && list.some((s) => s.meshKey === subMesh.meshKey)) {
            targetMesh = m;
          }
        }
      });
    }
    if (targetMesh) {
      const mesh = targetMesh as THREE.Mesh;
      const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (posAttr) {
        mesh.updateMatrixWorld(true);
        const start = subMesh.vertexStart;
        const end = Math.min(posAttr.count, start + subMesh.vertexCount);
        const count = Math.max(0, end - start);
        const stride = Math.max(1, Math.floor(count / 64));
        for (let i = 0; i < count; i += stride) {
          const idx = start + i;
          _tmpVec.set(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));
          _tmpVec.applyMatrix4(mesh.matrixWorld);
          pts.push([_tmpVec.x, _tmpVec.y, _tmpVec.z]);
        }
        if (pts.length > 0) return pts;
      }
    }
  }

  // Fallback for pure-logic unit tests or when geometry buffer is unavailable: 3×3×3 AABB grid
  const [minX, minY, minZ] = subMesh.boundsMin;
  const [maxX, maxY, maxZ] = subMesh.boundsMax;
  for (const tx of [0.2, 0.5, 0.8]) {
    for (const ty of [0.15, 0.5, 0.85]) {
      for (const tz of [0.2, 0.5, 0.8]) {
        pts.push([
          minX + (maxX - minX) * tx,
          minY + (maxY - minY) * ty,
          minZ + (maxZ - minZ) * tz,
        ]);
      }
    }
  }
  return pts;
}

/**
 * Pure & deterministic muscle territory count audit (works in both browser & `node:test`).
 */
export function runTerritoryMuscleCalibration(params: {
  field: TerritoryFieldData;
  allSubMeshes: readonly MergedSubMeshRecord[];
  body?: LoadedGlbBody | null;
}): TerritoryCalibrationReport {
  const { field, allSubMeshes, body = null } = params;

  interface AuditTarget {
    id: string;
    name: string;
    normalizedName: string;
    sourceTable: 'Table 23.2 (Leg)' | 'Table 23.3 (Head & Neck)';
    expectedCount: number;
    expectedVariantCount?: number;
  }

  const targets: AuditTarget[] = [];

  // Leg muscles from Table 23.2 (those carrying explicit angiosomeCount)
  for (const m of MUSCLE_TERRITORIES) {
    if (m.region === 'leg' && typeof m.angiosomeCount === 'number') {
      targets.push({
        id: m.id,
        name: m.name,
        normalizedName: m.normalizedAnatomyName,
        sourceTable: 'Table 23.2 (Leg)',
        expectedCount: m.angiosomeCount,
        expectedVariantCount: m.angiosomeCountVariant,
      });
    }
  }

  // Head & Neck muscles from Table 23.3
  for (const hnM of headNeckMuscleTerritories) {
    targets.push({
      id: hnM.id,
      name: hnM.name,
      normalizedName: hnM.normalizedAnatomyName,
      sourceTable: 'Table 23.3 (Head & Neck)',
      expectedCount: hnM.territoryCount,
      expectedVariantCount: hnM.territoryCountVariant,
    });
  }

  const entries: MuscleCalibrationEntry[] = [];

  for (const target of targets) {
    const matchedSubs = findMatchingMuscleSubMeshes(allSubMeshes, target.normalizedName);
    if (matchedSubs.length === 0) {
      entries.push({
        muscleId: target.id,
        muscleName: target.name,
        normalizedName: target.normalizedName,
        sourceTable: target.sourceTable,
        expectedCount: target.expectedCount,
        expectedVariantCount: target.expectedVariantCount,
        computedCount: 0,
        intersectedTerritoryIds: [],
        intersectedTerritoryLabels: [],
        matchedSubMeshCount: 0,
        sampledPointCount: 0,
        status: 'absent_in_bp3d',
      });
      continue;
    }

    const slotHits = new Map<number, number>();
    let totalValidSamples = 0;

    for (const sm of matchedSubs) {
      const samplePts = sampleMusclePointsFromSubMesh(sm, body);
      for (const pt of samplePts) {
        const res = sampleTerritoryFieldAtWorldPos(field, pt);
        if (!res.inside || res.primarySlot === 0) continue;
        totalValidSamples += 1;
        slotHits.set(res.primarySlot, (slotHits.get(res.primarySlot) ?? 0) + 1);
      }
    }

    // Require >= 5% hit share (or >= 2 hits) to filter out single-voxel boundary grazing
    const minHits = Math.max(2, Math.floor(totalValidSamples * 0.05));
    const significantSlots = Array.from(slotHits.entries())
      .filter(([, count]) => count >= minHits)
      .sort((a, b) => b[1] - a[1])
      .map(([slotId]) => slotId);

    // Fallback to top hit if muscle had very few valid samples
    if (significantSlots.length === 0 && slotHits.size > 0) {
      const top = Array.from(slotHits.entries()).sort((a, b) => b[1] - a[1])[0];
      if (top) significantSlots.push(top[0]);
    }

    const intersectedIds: string[] = [];
    const intersectedLabels: string[] = [];
    for (const sId of significantSlots) {
      const meta = TERRITORY_SLOT_BY_INDEX.get(sId);
      if (meta) {
        intersectedIds.push(meta.territoryId);
        intersectedLabels.push(meta.label);
      }
    }

    const computedCount = significantSlots.length;
    const isMatch =
      computedCount === target.expectedCount ||
      (typeof target.expectedVariantCount === 'number' &&
        computedCount === target.expectedVariantCount);

    const expectedLabel =
      typeof target.expectedVariantCount === 'number'
        ? `${target.expectedCount} (or ${target.expectedVariantCount})`
        : `${target.expectedCount}`;

    entries.push({
      muscleId: target.id,
      muscleName: target.name,
      normalizedName: target.normalizedName,
      sourceTable: target.sourceTable,
      expectedCount: target.expectedCount,
      expectedVariantCount: target.expectedVariantCount,
      computedCount,
      intersectedTerritoryIds: intersectedIds,
      intersectedTerritoryLabels: intersectedLabels,
      matchedSubMeshCount: matchedSubs.length,
      sampledPointCount: totalValidSamples,
      status: isMatch ? 'match' : 'warning',
      warningMessage: isMatch
        ? undefined
        : `Territory calibration warning: ${target.name} intersects ${computedCount} computed territory${computedCount === 1 ? '' : 'ies'} vs ${expectedLabel} in ${target.sourceTable} (Morris & Taylor Ch. 23).`,
    });
  }

  const warnings = entries.filter((e) => e.status === 'warning');
  const matchedCount = entries.filter((e) => e.status === 'match').length;
  const absentInBp3dCount = entries.filter((e) => e.status === 'absent_in_bp3d').length;

  return {
    checkedAtIso: new Date().toISOString(),
    totalTableMuscles: targets.length,
    checkedInBp3dCount: matchedCount + warnings.length,
    absentInBp3dCount,
    matchedCount,
    warningCount: warnings.length,
    entries,
    warnings,
  };
}
