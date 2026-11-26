import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRITORY_SLOTS,
  TERRITORY_SLOT_BY_ID,
  TERRITORY_SLOT_BY_INDEX,
  createTerritoryPaletteLutTexture,
} from '../models/territoryPalette';
import {
  mirrorPointsArrayAcrossMidline,
  samplePolylinePoints,
  subsamplePointsAtSpacing,
  type ExtraBp3dLandmarks,
  type TerritorySeedCluster,
} from '../models/territorySeeds';
import {
  bakeTerritoryField3D,
  sampleTerritoryFieldAtWorldPos,
} from '../models/territoryFieldCore';
import { computeTerritoryCacheSignature } from '../models/territoryFieldCache';
import { runTerritoryMuscleCalibration } from '../models/territoryCalibration';
import {
  createTerritoryShaderResources,
  disposeTerritoryGpuResources,
  setNeighborBitmaskUniforms,
} from '../models/territoryShader';
import { DEFAULT_ANCHORS } from '../models/anchorSystem';
import type { MergedSubMeshRecord } from '../models/glbLoader';

function makeSyntheticLandmarks(): ExtraBp3dLandmarks {
  return {
    midlineX: 0,
    ischialTuberosityRight: [-0.065, 0.78, -0.02],
    medialMalleolusRight: [-0.055, 0.08, 0.01],
    olecranonRight: [-0.24, 1.05, -0.03],
    medialCanthusRight: [-0.018, 1.56, 0.09],
    mentalProtuberance: [0, 1.44, 0.085],
    vertex: [0, 1.7, 0.01],
    bodyBoundsMin: [-0.36, 0.0, -0.14],
    bodyBoundsMax: [0.36, 1.72, 0.14],
  };
}

test('Phase 11b: Territory palette slot registry & LUT texture cover all 45 canonical slots', () => {
  assert.equal(TERRITORY_SLOTS.length, 45);
  assert.equal(TERRITORY_SLOT_BY_ID.size, 45);
  assert.equal(TERRITORY_SLOT_BY_INDEX.size, 45);

  const diea = TERRITORY_SLOT_BY_ID.get('angio-34');
  assert.ok(diea, 'DIEA angio-34 must have a canonical slot');
  assert.equal(diea.isDeepOnly, false);

  const lingual = TERRITORY_SLOT_BY_ID.get('hn-13');
  assert.ok(lingual, 'Deep-only HN-13 Lingual must have a canonical slot');
  assert.equal(lingual.isDeepOnly, true);

  const lutStd = createTerritoryPaletteLutTexture(false);
  const lutCb = createTerritoryPaletteLutTexture(true);
  assert.equal(lutStd.image.width, 64);
  assert.equal(lutStd.image.height, 2);
  assert.equal((lutStd.image.data as Uint8Array).length, 64 * 2 * 4);
  // Colorblind LUT should differ from standard LUT on at least several slots
  let diffCount = 0;
  const dStd = lutStd.image.data as Uint8Array;
  const dCb = lutCb.image.data as Uint8Array;
  for (let i = 0; i < 64 * 4; i++) {
    if (dStd[i] !== dCb[i]) diffCount++;
  }
  assert.ok(diffCount > 20, 'Colorblind Okabe-Ito LUT must provide distinct hues');
  lutStd.dispose();
  lutCb.dispose();
});

test('Phase 11b: 5 mm spatial subsampler deduplicates dense meshes and midline mirroring is symmetric', () => {
  const dense = new Float32Array([
    -0.1, 0.5, 0.05,
    -0.101, 0.501, 0.051, // within same 5 mm bucket
    -0.102, 0.502, 0.051, // within same 5 mm bucket
    -0.12, 0.5, 0.05,     // distinct bucket (20 mm away)
    -0.14, 0.52, 0.05,    // distinct bucket
  ]);
  const sub = subsamplePointsAtSpacing(dense, 0.005, 48);
  assert.equal(sub.length / 3, 3, 'Should keep 3 distinct 5 mm spatial cells');

  const mirrored = mirrorPointsArrayAcrossMidline(sub, 0.02);
  // First point x = -0.1 mirrored across midlineX = 0.02 -> 2*0.02 - (-0.1) = 0.14
  assert.ok(Math.abs(mirrored[0] - 0.14) < 1e-5);
  assert.ok(Math.abs(mirrored[1] - sub[1]) < 1e-5);
  assert.ok(Math.abs(mirrored[2] - sub[2]) < 1e-5);
});

test('Phase 11b: Weighted Voronoi law of equilibrium expands territory when visual weight increases', () => {
  const landmarks = makeSyntheticLandmarks();
  const slotA = TERRITORY_SLOT_BY_ID.get('angio-34')!.slotId; // DIEA
  const slotB = TERRITORY_SLOT_BY_ID.get('angio-36')!.slotId; // Internal thoracic

  const makeClusters = (weightA: number): TerritorySeedCluster[] => [
    {
      slotId: slotA,
      territoryId: 'angio-34',
      regionFamily: 'trunk',
      side: 'right',
      isSchematic: false,
      isDeepOnly: false,
      crossesMidline: false,
      weight: weightA,
      points: new Float32Array([-0.05, 0.96, 0.08]),
    },
    {
      slotId: slotB,
      territoryId: 'angio-36',
      regionFamily: 'trunk',
      side: 'right',
      isSchematic: false,
      isDeepOnly: false,
      crossesMidline: false,
      weight: 1.0,
      points: new Float32Array([-0.05, 1.16, 0.08]),
    },
  ];

  // Point slightly closer to slotB (y = 1.08 vs midpoint 1.06)
  const probe: [number, number, number] = [-0.05, 1.08, 0.08];

  const fieldEqual = bakeTerritoryField3D({
    boundsMin: [-0.2, 0.85, -0.05],
    boundsMax: [0.05, 1.25, 0.14],
    voxelSizeMeters: 0.015,
    landmarks,
    clusters: makeClusters(1.0),
  });
  assert.equal(sampleTerritoryFieldAtWorldPos(fieldEqual, probe).primarySlot, slotB);

  const fieldBoosted = bakeTerritoryField3D({
    boundsMin: [-0.2, 0.85, -0.05],
    boundsMax: [0.05, 1.25, 0.14],
    voxelSizeMeters: 0.015,
    landmarks,
    clusters: makeClusters(1.8),
  });
  assert.equal(
    sampleTerritoryFieldAtWorldPos(fieldBoosted, probe).primarySlot,
    slotA,
    'Raising visual weight must shift the weighted-Voronoi border toward neighbor'
  );
});

test('Phase 11b: Region barriers prevent limb↔trunk leaks, midline barrier holds, and deep-only HN excludes skin shell', () => {
  const landmarks = makeSyntheticLandmarks();
  const radialSlot = TERRITORY_SLOT_BY_ID.get('angio-16')!.slotId; // upper_limb
  const dieaSlot = TERRITORY_SLOT_BY_ID.get('angio-34')!.slotId;   // trunk (no midline cross)
  const facialSlot = TERRITORY_SLOT_BY_ID.get('angio-2')!.slotId;  // head_neck (crosses midline)
  const lingualSlot = TERRITORY_SLOT_BY_ID.get('hn-13')!.slotId;   // head_neck deep-only

  // Skin shell point right on the anterior chin surface where lingual is close
  const chinSkinPoint = new Float32Array([-0.02, 1.48, 0.11]);

  const field = bakeTerritoryField3D({
    boundsMin: landmarks.bodyBoundsMin,
    boundsMax: landmarks.bodyBoundsMax,
    voxelSizeMeters: 0.022,
    landmarks,
    skinPoints: chinSkinPoint,
    clusters: [
      {
        slotId: radialSlot,
        territoryId: 'angio-16',
        regionFamily: 'upper_limb',
        side: 'right',
        isSchematic: false,
        isDeepOnly: false,
        crossesMidline: false,
        weight: 1.0,
        points: new Float32Array([-0.24, 0.98, 0.04]),
      },
      {
        slotId: dieaSlot,
        territoryId: 'angio-34',
        regionFamily: 'trunk',
        side: 'right',
        isSchematic: false,
        isDeepOnly: false,
        crossesMidline: false,
        weight: 1.0,
        points: new Float32Array([-0.04, 0.98, 0.09]),
      },
      {
        slotId: facialSlot,
        territoryId: 'angio-2',
        regionFamily: 'head_neck',
        side: 'right',
        isSchematic: true,
        isDeepOnly: false,
        crossesMidline: true,
        weight: 1.0,
        points: new Float32Array([-0.03, 1.5, 0.09]),
      },
      {
        slotId: lingualSlot,
        territoryId: 'hn-13',
        regionFamily: 'head_neck',
        side: 'right',
        isSchematic: true,
        isDeepOnly: true,
        crossesMidline: false,
        weight: 1.0,
        // Place lingual deep behind chin skin AND test skin-shell voxel exclusion
        points: new Float32Array([-0.02, 1.48, 0.09]),
      },
    ],
  });

  // 1. Trunk voxel near right flank should NOT be claimed by radial (upper_limb)
  const trunkSample = sampleTerritoryFieldAtWorldPos(field, [-0.11, 0.98, 0.07]);
  assert.notEqual(trunkSample.primarySlot, radialSlot, 'Upper-limb seed must not leak onto trunk');

  // 2. Left abdomen voxel (+X) must NOT be claimed by right-only DIEA
  const leftTrunkSample = sampleTerritoryFieldAtWorldPos(field, [0.05, 0.98, 0.09]);
  assert.notEqual(leftTrunkSample.primarySlot, dieaSlot, 'Right DIEA must not cross midline');

  // 3. Left face (+X) CAN be reached by midline-crossing facial angiosome (#2)
  const leftFaceSample = sampleTerritoryFieldAtWorldPos(field, [0.03, 1.5, 0.09]);
  assert.equal(leftFaceSample.primarySlot, facialSlot, 'Facial territory (#2) may cross midline');

  // 4. Skin-shell voxel at chin must NOT receive deep-only Lingual (HN-13)
  const chinSkinSample = sampleTerritoryFieldAtWorldPos(field, [-0.02, 1.48, 0.11]);
  assert.equal(chinSkinSample.isSkinShell, true);
  assert.notEqual(
    chinSkinSample.primarySlot,
    lingualSlot,
    'Deep-only HN-13 Lingual must never paint skin-shell voxels'
  );
});

test('Phase 11b: Key anatomical zones resolve accurately & compute boundary distance + adjacency', () => {
  const landmarks = makeSyntheticLandmarks();
  const sDiea = TERRITORY_SLOT_BY_ID.get('angio-34')!.slotId;
  const sLcfa = TERRITORY_SLOT_BY_ID.get('angio-27')!.slotId;
  const sTda = TERRITORY_SLOT_BY_ID.get('angio-37')!.slotId;
  const sRadial = TERRITORY_SLOT_BY_ID.get('angio-16')!.slotId;
  const sAta = TERRITORY_SLOT_BY_ID.get('angio-26')!.slotId;
  const sIta = TERRITORY_SLOT_BY_ID.get('angio-36')!.slotId;

  const clusters: TerritorySeedCluster[] = [
    {
      slotId: sDiea,
      territoryId: 'angio-34',
      regionFamily: 'trunk',
      side: 'right',
      isSchematic: false,
      isDeepOnly: false,
      crossesMidline: false,
      weight: 1.0,
      points: samplePolylinePoints([[-0.04, 0.88, 0.1], [-0.04, 1.04, 0.1]], 0.02),
    },
    {
      slotId: sIta,
      territoryId: 'angio-36',
      regionFamily: 'trunk',
      side: 'right',
      isSchematic: false,
      isDeepOnly: false,
      crossesMidline: false,
      weight: 1.0,
      points: samplePolylinePoints([[-0.04, 1.15, 0.1], [-0.04, 1.32, 0.09]], 0.02),
    },
    {
      slotId: sTda,
      territoryId: 'angio-37',
      regionFamily: 'trunk',
      side: 'right',
      isSchematic: false,
      isDeepOnly: false,
      crossesMidline: false,
      weight: 1.0,
      points: samplePolylinePoints([[-0.13, 1.04, -0.09], [-0.14, 1.24, -0.08]], 0.02),
    },
    {
      slotId: sLcfa,
      territoryId: 'angio-27',
      regionFamily: 'lower_limb',
      side: 'right',
      isSchematic: false,
      isDeepOnly: false,
      crossesMidline: false,
      weight: 1.0,
      points: samplePolylinePoints([[-0.13, 0.56, 0.04], [-0.12, 0.74, 0.04]], 0.02),
    },
    {
      slotId: sRadial,
      territoryId: 'angio-16',
      regionFamily: 'upper_limb',
      side: 'right',
      isSchematic: false,
      isDeepOnly: false,
      crossesMidline: false,
      weight: 1.0,
      points: samplePolylinePoints([[-0.25, 0.84, 0.03], [-0.24, 1.02, 0.02]], 0.02),
    },
    {
      slotId: sAta,
      territoryId: 'angio-26',
      regionFamily: 'lower_limb',
      side: 'right',
      isSchematic: false,
      isDeepOnly: false,
      crossesMidline: false,
      weight: 1.0,
      points: samplePolylinePoints([[-0.09, 0.14, 0.04], [-0.09, 0.42, 0.04]], 0.02),
    },
  ];

  const field = bakeTerritoryField3D({
    boundsMin: landmarks.bodyBoundsMin,
    boundsMax: landmarks.bodyBoundsMax,
    voxelSizeMeters: 0.02,
    landmarks,
    clusters,
  });

  // Verify the 5 clinical calibration zones from §11b
  assert.equal(sampleTerritoryFieldAtWorldPos(field, [-0.04, 0.96, 0.1]).primarySlot, sDiea);
  assert.equal(sampleTerritoryFieldAtWorldPos(field, [-0.13, 0.65, 0.05]).primarySlot, sLcfa);
  assert.equal(sampleTerritoryFieldAtWorldPos(field, [-0.13, 1.14, -0.09]).primarySlot, sTda);
  assert.equal(sampleTerritoryFieldAtWorldPos(field, [-0.25, 0.92, 0.03]).primarySlot, sRadial);
  assert.equal(sampleTerritoryFieldAtWorldPos(field, [-0.09, 0.28, 0.04]).primarySlot, sAta);

  // Boundary voxel between DIEA (y=1.04) and ITA (y=1.15) should show small boundary distance
  const borderSample = sampleTerritoryFieldAtWorldPos(field, [-0.04, 1.095, 0.1]);
  assert.ok(
    borderSample.boundaryDistanceNormalized < 0.45,
    `Expected low boundary distance at DIEA/ITA junction, got ${borderSample.boundaryDistanceNormalized}`
  );
  assert.ok(
    field.neighborsBySlot[sDiea]?.includes(sIta),
    'DIEA and Internal Thoracic must appear as mutual neighbors in neighborsBySlot'
  );
});

test('Phase 11b: Cache signature invalidates on weight or anchor edits & bitmask encodes all 3 lanes', () => {
  const sigBase = computeTerritoryCacheSignature({
    voxelSizeMeters: 0.008,
    anchors: DEFAULT_ANCHORS,
    visualWeights: {},
    clusterCount: 80,
    realSeedCount: 29,
  });
  const sigWeight = computeTerritoryCacheSignature({
    voxelSizeMeters: 0.008,
    anchors: DEFAULT_ANCHORS,
    visualWeights: { 'angio-34': 1.25 },
    clusterCount: 80,
    realSeedCount: 29,
  });
  assert.notEqual(sigBase, sigWeight, 'Visual weight change must invalidate cache signature');

  const shiftedAnchors = DEFAULT_ANCHORS.map((a, idx) =>
    idx === 0
      ? { ...a, position: [a.position[0] + 0.015, a.position[1], a.position[2]] as [number, number, number] }
      : a
  );
  const sigAnchor = computeTerritoryCacheSignature({
    voxelSizeMeters: 0.008,
    anchors: shiftedAnchors,
    visualWeights: {},
    clusterCount: 80,
    realSeedCount: 29,
  });
  assert.notEqual(sigBase, sigAnchor, 'Anchor calibration change must invalidate cache signature');

  // Verify neighbor bitmask encoding across lanes 0, 1, 2
  const miniField = bakeTerritoryField3D({
    boundsMin: [-0.1, 0, -0.1],
    boundsMax: [0.1, 0.2, 0.1],
    voxelSizeMeters: 0.025,
    landmarks: makeSyntheticLandmarks(),
    clusters: [],
  });
  const gpu = createTerritoryShaderResources(miniField, false);
  assert.equal(gpu.uniforms.uTerritoryEnabled.value, 0, 'Territory shader must default to OFF (0)');
  setNeighborBitmaskUniforms(gpu.uniforms, [1, 21, 22, 43, 44, 45]);
  assert.equal(gpu.uniforms.uNeighborMask0.value, Math.pow(2, 1) + Math.pow(2, 21));
  assert.equal(gpu.uniforms.uNeighborMask1.value, Math.pow(2, 0) + Math.pow(2, 21));
  assert.equal(gpu.uniforms.uNeighborMask2.value, Math.pow(2, 0) + Math.pow(2, 1));
  disposeTerritoryGpuResources(gpu);
});

test('Phase 11b: Muscle calibration audit reports mismatches honestly as territory calibration warnings', () => {
  const landmarks = makeSyntheticLandmarks();
  const sAta = TERRITORY_SLOT_BY_ID.get('angio-26')!.slotId;
  const sPta = TERRITORY_SLOT_BY_ID.get('angio-25')!.slotId;

  // Bake a field where the anterior leg has only 1 territory (ATA)
  const field = bakeTerritoryField3D({
    boundsMin: [-0.2, 0.05, -0.1],
    boundsMax: [0.05, 0.5, 0.1],
    voxelSizeMeters: 0.02,
    landmarks,
    clusters: [
      {
        slotId: sAta,
        territoryId: 'angio-26',
        regionFamily: 'lower_limb',
        side: 'right',
        isSchematic: false,
        isDeepOnly: false,
        crossesMidline: false,
        weight: 1.0,
        points: new Float32Array([-0.08, 0.25, 0.04]),
      },
      {
        slotId: sPta,
        territoryId: 'angio-25',
        regionFamily: 'lower_limb',
        side: 'right',
        isSchematic: false,
        isDeepOnly: false,
        crossesMidline: false,
        weight: 1.0,
        points: new Float32Array([-0.08, 0.25, -0.07]),
      },
    ],
  });

  // Synthetic BP3D muscle sub-meshes:
  // - tibialis anterior (Table 23.2 expects 1 territory -> should MATCH)
  // - soleus (Table 23.2 expects 3 territories, placed purely inside PTA -> must emit WARNING!)
  const fakeMuscles: MergedSubMeshRecord[] = [
    {
      meshKey: 'm-ta',
      subMeshIndex: 0,
      meshName: 'right tibialis anterior [FJ1001]',
      normalizedName: 'tibialis anterior',
      system: 'muscles',
      materialBucket: 'muscle',
      anatomyId: 'tibialis-anterior',
      label: 'Tibialis anterior',
      category: 'muscle',
      laterality: 'right',
      mapped: true,
      linkedFlapIds: [],
      vertexStart: 0,
      vertexCount: 0,
      indexStart: 0,
      indexCount: 0,
      center: [-0.08, 0.25, 0.04],
      boundsMin: [-0.1, 0.18, 0.02],
      boundsMax: [-0.06, 0.32, 0.06],
    },
    {
      meshKey: 'm-soleus',
      subMeshIndex: 1,
      meshName: 'right soleus [FJ1002]',
      normalizedName: 'soleus',
      system: 'muscles',
      materialBucket: 'muscle',
      anatomyId: 'soleus',
      label: 'Soleus',
      category: 'muscle',
      laterality: 'right',
      mapped: true,
      linkedFlapIds: [],
      vertexStart: 0,
      vertexCount: 0,
      indexStart: 0,
      indexCount: 0,
      center: [-0.08, 0.25, -0.07],
      boundsMin: [-0.1, 0.18, -0.09],
      boundsMax: [-0.06, 0.32, -0.05],
    },
  ];

  const report = runTerritoryMuscleCalibration({
    field,
    allSubMeshes: fakeMuscles,
  });

  const taEntry = report.entries.find((e) => e.normalizedName === 'tibialis anterior');
  assert.ok(taEntry, 'Tibialis anterior must appear in calibration report');
  assert.equal(taEntry.status, 'match');
  assert.equal(taEntry.computedCount, 1);

  const soleusEntry = report.entries.find((e) => e.normalizedName === 'soleus');
  assert.ok(soleusEntry, 'Soleus must appear in calibration report');
  assert.equal(soleusEntry.status, 'warning', 'Mismatch MUST emit explicit warning, never auto-fix');
  assert.equal(soleusEntry.expectedCount, 3);
  assert.equal(soleusEntry.computedCount, 1);
  assert.match(soleusEntry.warningMessage || '', /Territory calibration warning/i);
  assert.ok(report.warnings.some((w) => w.normalizedName === 'soleus'));
});
