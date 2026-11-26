import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import {
  findMatchingLoadedVesselsForText,
  findMuscleReferenceForSelection,
  findMuscleReferencesForFlap,
  findRelatedFlapIdsForText,
  findUnmappedMuscleMeshes,
  MUSCLE_REFERENCE_BY_ID,
  MUSCLE_REFERENCE_DATASET,
  MUSCLE_REFERENCE_FOOTER,
  MUSCLE_REFERENCES,
  MuscleReferenceDatasetSchema,
  normalizeMuscleLookupKey,
} from '../data/muscleReference';
import { INITIAL_FLAPS } from '../data/index';
import type { MergedSubMeshRecord } from '../models/glbLoader';
import {
  attachSubMeshVisibilityShader,
  disposeSubMeshVisibilityController,
  FAINT_SKELETON_ALPHA_BYTE,
  GHOST_ALPHA_BYTE,
  setSingleSubMeshVisibilityTexel,
  updateSubMeshVisibilityBuffer,
} from '../models/subMeshVisibilityShader';
import { useAtlasStore } from '../store/useAtlasStore';

function makeMockSubMesh(
  idx: number,
  meshKey: string,
  system: MergedSubMeshRecord['system'],
  label: string,
  extra?: Partial<MergedSubMeshRecord>
): MergedSubMeshRecord {
  return {
    subMeshIndex: idx,
    meshKey,
    meshName: meshKey,
    anatomyId: meshKey,
    label,
    normalizedName: label.toLowerCase(),
    category: system === 'muscles' ? 'Muscle' : system === 'skeleton' ? 'Bone' : 'Artery',
    system,
    materialBucket: system === 'muscles' ? 'muscle' : system === 'skeleton' ? 'bone' : 'artery',
    laterality: 'left',
    mapped: true,
    linkedFlapIds: [],
    boundsMin: [0, 0, 0],
    boundsMax: [1, 1, 1],
    center: [0.5, 0.5, 0.5],
    vertexStart: idx * 3,
    vertexCount: 3,
    indexStart: idx * 3,
    indexCount: 3,
    ...extra,
  };
}

function makeMergedSystemMesh(records: MergedSubMeshRecord[]): THREE.Mesh {
  const vertCount = records.length * 3;
  const positions = new Float32Array(vertCount * 3);
  const meshIndices = new Float32Array(vertCount);
  const indices = new Uint16Array(vertCount);
  for (let r = 0; r < records.length; r++) {
    for (let v = 0; v < 3; v++) {
      const vi = r * 3 + v;
      positions[vi * 3] = v;
      positions[vi * 3 + 1] = r;
      positions[vi * 3 + 2] = 0;
      meshIndices[vi] = r;
      indices[vi] = vi;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aMeshIndex', new THREE.BufferAttribute(meshIndices, 1));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  const mat = new THREE.MeshStandardMaterial({ color: 0xb85550 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = {
    isMergedSystemMesh: true,
    subMeshes: records,
  };
  return mesh;
}

test('A1. muscleReference.json is verbatim copy of attached file and passes Zod validation (35 entries)', () => {
  const attachedPath = path.resolve(
    process.cwd(),
    'public/assets/aistudio/muscle_reference_078bfa2c.json'
  );
  const srcPath = path.resolve(process.cwd(), 'src/data/muscleReference.json');

  const attachedRaw = fs.readFileSync(attachedPath, 'utf-8');
  const srcRaw = fs.readFileSync(srcPath, 'utf-8');
  assert.equal(srcRaw, attachedRaw, 'src/data/muscleReference.json must match attached file verbatim');

  const parsed = MuscleReferenceDatasetSchema.parse(JSON.parse(srcRaw));
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.muscles.length, 35);
  assert.equal(MUSCLE_REFERENCES.length, 35);
  assert.equal(MUSCLE_REFERENCE_DATASET.muscles.length, 35);

  // Every entry must remain needs_review (do not invent verification)
  for (const m of MUSCLE_REFERENCES) {
    assert.equal(m.verificationStatus, 'needs_review', `${m.id} must have verificationStatus=needs_review`);
  }

  // Exact 5 muscles marked absent from BodyParts3D (Schematic)
  const schematicIds = MUSCLE_REFERENCES.filter((m) => !m.inBodyParts3D)
    .map((m) => m.id)
    .sort();
  assert.deepEqual(schematicIds, [
    'internal-oblique',
    'latissimus-dorsi',
    'masseter',
    'rectus-abdominis',
    'temporalis',
  ]);

  assert.equal(
    MUSCLE_REFERENCE_FOOTER,
    "Summary of standard anatomical references (e.g. Gray's Anatomy); verify before teaching or clinical use."
  );
});

test('B1. Tapping any part of deltoid resolves to the full deltoid reference entry', () => {
  const clavicular = findMuscleReferenceForSelection({
    label: 'Clavicular part of right deltoid',
    meshName: 'clavicular part of right deltoid',
    normalizedName: 'clavicular part of right deltoid',
    groupId: 'group:deltoid',
    groupLabel: 'Deltoid Muscle',
    partLabel: 'Clavicular part',
  });
  assert.ok(clavicular, 'Clavicular part of deltoid must resolve');
  assert.equal(clavicular.id, 'deltoid');
  assert.equal(clavicular.name, 'Deltoid');
  assert.equal(clavicular.bloodSupply.mathesNahai, 'III');
  assert.ok(clavicular.origin.length > 0);
  assert.ok(clavicular.insertion.length > 0);
  assert.ok(clavicular.action.length > 0);
  assert.ok(clavicular.bloodSupply.dominant.length > 0);
  assert.ok(clavicular.nerveSupply.length > 0);
  assert.ok(clavicular.relatedFlaps.length > 0);
  assert.ok(clavicular.pearl.length > 0);

  const acromial = findMuscleReferenceForSelection({
    label: 'Acromial part of left deltoid',
    groupId: 'group:deltoid',
    groupLabel: 'Deltoid',
  });
  assert.equal(acromial?.id, 'deltoid');

  const spinal = findMuscleReferenceForSelection({
    label: 'Spinal part of deltoid',
    groupId: 'group:deltoid',
  });
  assert.equal(spinal?.id, 'deltoid');
});

test('B2. Specific muscles inside multi-muscle groups resolve individually without collision', () => {
  const rf = findMuscleReferenceForSelection({
    label: 'Left rectus femoris',
    groupId: 'group:quadriceps_femoris',
    groupLabel: 'Quadriceps Femoris',
  });
  assert.equal(rf?.id, 'rectus-femoris');

  const vl = findMuscleReferenceForSelection({
    label: 'Right vastus lateralis',
    groupId: 'group:quadriceps_femoris',
    groupLabel: 'Quadriceps Femoris',
  });
  assert.equal(vl?.id, 'vastus-lateralis');

  const pecMajor = findMuscleReferenceForSelection({
    label: 'Sternocostal head of right pectoralis major',
    groupId: 'group:pectoralis_major',
    groupLabel: 'Pectoralis Major',
  });
  assert.equal(pecMajor?.id, 'pectoralis-major');

  assert.equal(normalizeMuscleLookupKey('Clavicular part of right deltoid'), 'deltoid');
});

test('B3. Unmapped muscles return null and are reported in Editor Unmapped muscles report', () => {
  const unmapped = findMuscleReferenceForSelection({
    label: 'Left omohyoid superior belly',
    meshName: 'superior belly of left omohyoid',
    groupId: 'group:omohyoid',
    groupLabel: 'Omohyoid',
  });
  assert.equal(unmapped, null);

  const report = findUnmappedMuscleMeshes([
    makeMockSubMesh(0, 'm_deltoid_clav', 'muscles', 'Clavicular part of left deltoid', {
      groupId: 'group:deltoid',
      groupLabel: 'Deltoid',
    }),
    makeMockSubMesh(1, 'm_omohyoid', 'muscles', 'Left omohyoid', {
      groupId: 'group:omohyoid',
      groupLabel: 'Omohyoid',
    }),
    makeMockSubMesh(2, 'b_femur', 'skeleton', 'Left femur'),
  ]);

  assert.equal(report.length, 1);
  assert.equal(report[0].meshKey, 'm_omohyoid');
  assert.equal(report[0].label, 'Left omohyoid');
  assert.equal(report[0].side, 'left');
  assert.equal(report[0].groupLabel, 'Omohyoid');
});

test('B4 / C1. Latissimus-related flap chip resolves cleanly & links to schematic Latissimus dorsi entry', () => {
  const ldEntry = MUSCLE_REFERENCE_BY_ID.get('latissimus-dorsi');
  assert.ok(ldEntry);
  assert.equal(ldEntry.inBodyParts3D, false);

  // Flap -> Muscle reference reverse mapping (for FlapDetailPanel chips)
  const ldFlapMuscles = findMuscleReferencesForFlap('ld-flap', INITIAL_FLAPS);
  assert.ok(
    ldFlapMuscles.some((m) => m.id === 'latissimus-dorsi' && !m.inBodyParts3D),
    'ld-flap must link to schematic latissimus-dorsi muscle reference'
  );

  // Related flap text -> FlapRecord id mapping (for MuscleReferenceCard chips)
  const serratus = MUSCLE_REFERENCE_BY_ID.get('serratus-anterior');
  assert.ok(serratus);
  const serratusFlapIds = serratus.relatedFlaps.flatMap((txt) =>
    findRelatedFlapIdsForText(txt, INITIAL_FLAPS)
  );
  assert.ok(
    serratusFlapIds.includes('ld-flap') || serratusFlapIds.includes('serratus-anterior-flap'),
    'Serratus anterior related flaps must link to real flap records'
  );

  const ldFlapIds = ldEntry.relatedFlaps.flatMap((txt) =>
    findRelatedFlapIdsForText(txt, INITIAL_FLAPS)
  );
  assert.ok(ldFlapIds.includes('ld-flap'), 'Latissimus dorsi related flaps must include ld-flap');
  assert.ok(ldFlapIds.includes('tdap-flap'), 'Latissimus dorsi related flaps must include tdap-flap');

  // Blood supply vessel chip matching against loaded 3D vessels
  const matches = findMatchingLoadedVesselsForText(
    'Thoracodorsal artery (branch of subscapular artery)',
    [
      {
        key: 'a_td_l',
        anatomyId: 'a_td_l',
        meshName: 'Left thoracodorsal artery',
        name: 'Left thoracodorsal artery',
        system: 'arteries',
        category: 'Artery',
        side: 'left',
        mapped: true,
        linkedFlapIds: ['ld-flap'],
        center: [0, 1, 0],
        boundsMin: [0, 1, 0],
        boundsMax: [0.1, 1.1, 0.1],
      },
      {
        key: 'a_fem_l',
        anatomyId: 'a_fem_l',
        meshName: 'Left femoral artery',
        name: 'Left femoral artery',
        system: 'arteries',
        category: 'Artery',
        side: 'left',
        mapped: true,
        linkedFlapIds: [],
        center: [0, 0.5, 0],
        boundsMin: [0, 0.5, 0],
        boundsMax: [0.1, 0.6, 0.1],
      },
    ],
    'left'
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].key, 'a_td_l');
});

test('E1. O(1) DataTexture visibility shader updates texels with ZERO geometry rebuilds', () => {
  const records = [
    makeMockSubMesh(0, 'm_deltoid_clav', 'muscles', 'Clavicular part of left deltoid'),
    makeMockSubMesh(1, 'm_deltoid_acrom', 'muscles', 'Acromial part of left deltoid'),
    makeMockSubMesh(2, 'm_biceps', 'muscles', 'Left biceps brachii'),
  ];
  const mesh = makeMergedSystemMesh(records);
  const originalGeo = mesh.geometry;
  const originalPosAttr = mesh.geometry.getAttribute('position');
  const originalIdxAttr = mesh.geometry.getIndex();

  const ctrl = attachSubMeshVisibilityShader(mesh);
  assert.ok(ctrl, 'Visibility shader controller must attach to merged mesh with aMeshIndex');
  assert.equal(ctrl.count, 3);
  assert.equal(ctrl.uniforms.uSubMeshVisEnabled.value, 0);

  // Hide deltoid clavicular part only in O(1)
  setSingleSubMeshVisibilityTexel(ctrl, 0, 'hidden');
  assert.equal(ctrl.data[0], 0);
  assert.equal(ctrl.data[4], 255);

  // Ghost others (keep biceps visible, ghost both deltoid parts)
  const mixedSummary = updateSubMeshVisibilityBuffer(ctrl, (rec) =>
    rec.meshKey === 'm_biceps' ? 'visible' : 'ghost'
  );
  assert.equal(mixedSummary.opaqueCount, 1);
  assert.equal(mixedSummary.ghostCount, 2);
  assert.equal(mixedSummary.hiddenCount, 0);
  assert.equal(mixedSummary.allVisibleGhosted, false);
  assert.equal(ctrl.uniforms.uSubMeshVisEnabled.value, 1);
  assert.equal(ctrl.uniforms.uSubMeshVisUseDither.value, 1);
  assert.equal(ctrl.data[0], 255);
  assert.equal(ctrl.data[1], GHOST_ALPHA_BYTE);
  assert.equal(ctrl.data[8], 255);
  assert.equal(ctrl.data[9], 255);

  // Faint skeleton (all visible sub-meshes ghosted -> smooth alpha blending, dither off)
  const allGhostSummary = updateSubMeshVisibilityBuffer(ctrl, () => 'faint-skeleton');
  assert.equal(allGhostSummary.allVisibleGhosted, true);
  assert.equal(ctrl.uniforms.uSubMeshVisUseDither.value, 0);
  assert.equal(ctrl.data[1], FAINT_SKELETON_ALPHA_BYTE);

  // Restore all
  const restored = updateSubMeshVisibilityBuffer(ctrl, () => 'visible');
  assert.equal(restored.hasOverride, false);
  assert.equal(ctrl.uniforms.uSubMeshVisEnabled.value, 0);

  // Verify ZERO geometry or buffer rebuilds occurred
  assert.equal(mesh.geometry, originalGeo);
  assert.equal(mesh.geometry.getAttribute('position'), originalPosAttr);
  assert.equal(mesh.geometry.getIndex(), originalIdxAttr);

  disposeSubMeshVisibilityController(ctrl);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});

test('D1. Store Hide / Isolate / Ghost / Restore / 20-step Undo-Redo survives mode changes', () => {
  const store = useAtlasStore;
  store.getState().restoreAllVisibility();

  // Hide whole deltoid group
  store.getState().hideSubMeshes({
    id: 'group:deltoid:left',
    label: 'Deltoid',
    side: 'left',
    system: 'muscles',
    meshKeys: ['m_deltoid_clav', 'm_deltoid_acrom', 'm_deltoid_spin'],
    partOnly: false,
  });
  assert.equal(store.getState().visibilityState.hiddenItems.length, 1);
  assert.equal(store.getState().visibilityUndoStack.length, 1);

  // Switch modes (tab + territory mode) — visibility state must survive
  store.getState().setActiveTab('layers');
  store.getState().setTerritoryMode('angiosomes');
  store.getState().setTerritoryMode('off');
  store.getState().setActiveTab('anatomy');
  assert.equal(store.getState().visibilityState.hiddenItems.length, 1);

  // Isolate with faint skeleton
  store.getState().isolateSubMeshes(['m_biceps'], 'Biceps brachii', true);
  assert.deepEqual(store.getState().visibilityState.isolatedMeshKeys, ['m_biceps']);
  assert.equal(store.getState().visibilityState.isolateKeepSkeleton, true);

  // Ghost others replaces isolation
  store.getState().ghostOthersForSubMeshes(['m_gracilis'], 'Gracilis');
  assert.deepEqual(store.getState().visibilityState.ghostOthersKeys, ['m_gracilis']);
  assert.deepEqual(store.getState().visibilityState.isolatedMeshKeys, []);

  // Undo restores isolation; Undo again restores hidden-only; Redo brings isolation back
  store.getState().undoVisibility();
  assert.deepEqual(store.getState().visibilityState.isolatedMeshKeys, ['m_biceps']);
  assert.deepEqual(store.getState().visibilityState.ghostOthersKeys, []);

  store.getState().redoVisibility();
  assert.deepEqual(store.getState().visibilityState.ghostOthersKeys, ['m_gracilis']);

  // Restore individual hidden item
  store.getState().restoreHiddenItem('group:deltoid:left');
  assert.equal(store.getState().visibilityState.hiddenItems.length, 0);

  // 20-step undo history cap
  for (let i = 0; i < 25; i++) {
    store.getState().hideSubMeshes({
      id: `item_${i}`,
      label: `Muscle ${i}`,
      side: 'left',
      system: 'muscles',
      meshKeys: [`key_${i}`],
    });
  }
  assert.equal(store.getState().visibilityUndoStack.length, 20);

  // Restore all clears everything
  store.getState().restoreAllVisibility();
  assert.equal(store.getState().visibilityState.hiddenItems.length, 0);
  assert.equal(store.getState().visibilityState.isolatedMeshKeys.length, 0);
  assert.equal(store.getState().visibilityState.ghostOthersKeys.length, 0);
});
