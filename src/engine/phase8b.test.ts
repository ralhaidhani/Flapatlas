import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INITIAL_FLAPS, VESSELS } from '../data/index';
import {
  CANONICAL_TA_MAPPINGS,
  mapMeshNameToAnatomy,
} from '../models/anatomyMap';
import {
  computeClippingPlaneParams,
  computeStructureFocusCamera,
  DEFAULT_BODY_BOUNDS,
  SearchableAnatomyStructure,
  searchAnatomyStructures,
} from '../models/clippingAndSearch';
import {
  extractSubMeshGeometry,
  MergedSubMeshRecord,
  prepareSubMeshGeometry,
} from '../models/glbLoader';

test('Phase 8b: computeClippingPlaneParams produces accurate Axial, Sagittal, and Coronal planes', () => {
  const axial50 = computeClippingPlaneParams(
    'axial',
    { enabled: true, position: 50, inverted: false },
    DEFAULT_BODY_BOUNDS
  );
  assert.deepEqual(axial50.normal, [0, -1, 0]);
  assert.equal(axial50.worldCoordMeters, 0.88);
  assert.equal(axial50.constant, 0.88);
  assert.match(axial50.readoutLabel, /88 cm/);

  const axialFlipped = computeClippingPlaneParams(
    'axial',
    { enabled: true, position: 50, inverted: true },
    DEFAULT_BODY_BOUNDS
  );
  assert.deepEqual(axialFlipped.normal, [0, 1, 0]);
  assert.equal(axialFlipped.constant, -0.88);

  const sagittalMid = computeClippingPlaneParams(
    'sagittal',
    { enabled: true, position: 50, inverted: false },
    DEFAULT_BODY_BOUNDS
  );
  assert.deepEqual(sagittalMid.normal, [-1, 0, 0]);
  assert.equal(sagittalMid.worldCoordMeters, 0);
  assert.match(sagittalMid.readoutLabel, /Midline/);

  const coronalFront = computeClippingPlaneParams(
    'coronal',
    { enabled: true, position: 100, inverted: false },
    DEFAULT_BODY_BOUNDS
  );
  assert.deepEqual(coronalFront.normal, [0, 0, -1]);
  assert.equal(coronalFront.worldCoordMeters, DEFAULT_BODY_BOUNDS.maxZ);
  assert.match(coronalFront.readoutLabel, /Ant/);
});

test('Phase 8b: searchAnatomyStructures ranks main muscle belly ahead of insertion tags and supports laterality tokens', () => {
  const catalog: SearchableAnatomyStructure[] = [
    {
      key: 'muscles:tendon:0',
      anatomyId: 'latissimus_dorsi',
      label: 'Latissimus dorsi muscle',
      meshName: 'Latissimus dorsi muscle.er',
      system: 'muscles',
      category: 'Muscle',
      laterality: 'right',
      mapped: true,
      linkedFlapIds: ['ld-flap', 'tdap-flap'],
      center: [-0.12, 1.25, -0.09],
      boundsMin: [-0.2, 1.05, -0.13],
      boundsMax: [-0.04, 1.42, -0.05],
    },
    {
      key: 'muscles:muscle:1',
      anatomyId: 'latissimus_dorsi',
      label: 'Latissimus dorsi muscle',
      meshName: 'Latissimus dorsi muscle.r',
      system: 'muscles',
      category: 'Muscle',
      laterality: 'right',
      mapped: true,
      linkedFlapIds: ['ld-flap', 'tdap-flap'],
      center: [-0.12, 1.25, -0.09],
      boundsMin: [-0.2, 1.05, -0.13],
      boundsMax: [-0.04, 1.42, -0.05],
    },
    {
      key: 'muscles:muscle:2',
      anatomyId: 'latissimus_dorsi',
      label: 'Latissimus dorsi muscle',
      meshName: 'Latissimus dorsi muscle.l',
      system: 'muscles',
      category: 'Muscle',
      laterality: 'left',
      mapped: true,
      linkedFlapIds: ['ld-flap', 'tdap-flap'],
      center: [0.12, 1.25, -0.09],
      boundsMin: [0.04, 1.05, -0.13],
      boundsMax: [0.2, 1.42, -0.05],
    },
    {
      key: 'skeleton:bone:3',
      anatomyId: 'fibula',
      label: 'Fibula',
      meshName: 'Fibula.l',
      system: 'skeleton',
      category: 'Bone',
      laterality: 'left',
      mapped: true,
      linkedFlapIds: ['fibula-flap'],
      center: [0.11, 0.28, -0.02],
      boundsMin: [0.09, 0.08, -0.04],
      boundsMax: [0.13, 0.45, 0.0],
    },
  ];

  const latResults = searchAnatomyStructures(catalog, 'latissimus', 5);
  assert.equal(latResults.length, 3);
  // Main muscle belly (.r or .l) must rank ahead of insertion sub-mesh (.er)
  assert.notEqual(latResults[0].meshName, 'Latissimus dorsi muscle.er');
  assert.equal(latResults[2].meshName, 'Latissimus dorsi muscle.er');

  const leftOnly = searchAnatomyStructures(catalog, 'latissimus left', 5);
  assert.equal(leftOnly.length, 1);
  assert.equal(leftOnly[0].meshName, 'Latissimus dorsi muscle.l');
});

test('Phase 8b: computeStructureFocusCamera auto-selects posterior camera for dorsal structures', () => {
  const dorsalGoal = computeStructureFocusCamera(
    [-0.18, 1.05, -0.13],
    [-0.04, 1.42, -0.06],
    [-0.11, 1.24, -0.095]
  );
  // Posterior structure (cz < -0.025) must fly camera to negative Z side
  assert.ok(dorsalGoal.pos[2] < dorsalGoal.target[2]);

  const anteriorGoal = computeStructureFocusCamera(
    [-0.14, 1.28, 0.04],
    [0.0, 1.44, 0.12],
    [-0.07, 1.36, 0.08]
  );
  // Anterior structure must fly camera to positive Z side
  assert.ok(anteriorGoal.pos[2] > anteriorGoal.target[2]);
});

test('Phase 8b: 100% of linkedFlapIds in CANONICAL_TA_MAPPINGS exist in INITIAL_FLAPS and map key Z-Anatomy structures', () => {
  const validFlapIds = new Set(INITIAL_FLAPS.map((f) => f.id));
  for (const mapping of CANONICAL_TA_MAPPINGS) {
    for (const fid of mapping.linkedFlapIds) {
      assert.ok(
        validFlapIds.has(fid),
        `Broken flap link "${fid}" in CANONICAL_TA_MAPPINGS entry "${mapping.targetId}"`
      );
    }
  }

  const ctx = { vessels: VESSELS, flaps: INITIAL_FLAPS };
  const samples: Array<[string, 'muscles' | 'skeleton' | 'organs' | 'nerves', string, 'left' | 'right' | 'midline']> = [
    ['External abdominal oblique muscle.r', 'muscles', 'external_oblique', 'right'],
    ['Latissimus dorsi muscle.l', 'muscles', 'latissimus_dorsi', 'left'],
    ['Sternocleidomastoid muscle.r', 'muscles', 'sternocleidomastoid', 'right'],
    ['Sciatic nerve.l', 'nerves', 'n-sciatic', 'left'],
    ['Jejunum', 'organs', 'organ_jejunum', 'midline'],
    ['Calcaneus.l', 'skeleton', 'bone_calcaneus', 'left'],
  ];

  for (const [meshName, sys, expectedId, expectedSide] of samples) {
    const res = mapMeshNameToAnatomy(meshName, sys, ctx);
    assert.equal(res.mapped, true, `Expected ${meshName} to map`);
    assert.equal(res.anatomyId, expectedId);
    assert.equal(res.laterality, expectedSide);
  }
});

test('Phase 8b: extractSubMeshGeometry cleanly extracts exact sub-mesh triangles from merged geometry', () => {
  const boxA = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const boxB = new THREE.BoxGeometry(0.2, 0.2, 0.2);

  const matA = new THREE.Matrix4().makeTranslation(-0.2, 1.0, 0);
  const matB = new THREE.Matrix4().makeTranslation(0.25, 1.4, 0.05);

  const prepA = prepareSubMeshGeometry(boxA, matA, 0, false)!;
  const prepB = prepareSubMeshGeometry(boxB, matB, 1, false)!;
  assert.ok(prepA && prepB);

  const idxCountA = prepA.index!.count;
  const idxCountB = prepB.index!.count;
  const vertCountA = prepA.getAttribute('position').count;
  const vertCountB = prepB.getAttribute('position').count;

  const mergedGeo = mergeGeometries([prepA, prepB], false)!;
  assert.ok(mergedGeo);

  const recB: MergedSubMeshRecord = {
    meshKey: 'muscles:muscle:1',
    subMeshIndex: 1,
    meshName: 'Latissimus dorsi muscle.l',
    system: 'muscles',
    materialBucket: 'muscle',
    anatomyId: 'latissimus_dorsi',
    label: 'Latissimus dorsi muscle',
    category: 'Muscle',
    laterality: 'left',
    mapped: true,
    linkedFlapIds: ['ld-flap'],
    vertexStart: vertCountA,
    vertexCount: vertCountB,
    indexStart: idxCountA,
    indexCount: idxCountB,
    center: [0.25, 1.4, 0.05],
    boundsMin: [0.15, 1.3, -0.05],
    boundsMax: [0.35, 1.5, 0.15],
  };

  const mergedMesh = new THREE.Mesh(mergedGeo, new THREE.MeshStandardMaterial());
  mergedMesh.userData = { isMergedSystemMesh: true, subMeshes: [recB] };
  mergedMesh.updateMatrixWorld(true);

  const extracted = extractSubMeshGeometry(mergedMesh, recB);
  assert.ok(extracted);
  assert.equal(extracted.index?.count, idxCountB);
  extracted.computeBoundingBox();
  const center = new THREE.Vector3();
  extracted.boundingBox!.getCenter(center);
  assert.ok(Math.abs(center.x - 0.25) < 0.002);
  assert.ok(Math.abs(center.y - 1.4) < 0.002);
  assert.ok(Math.abs(center.z - 0.05) < 0.002);

  boxA.dispose();
  boxB.dispose();
  prepA.dispose();
  prepB.dispose();
  mergedGeo.dispose();
  extracted.dispose();
});
