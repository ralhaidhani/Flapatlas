import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { INITIAL_FLAPS, VESSELS } from '../data/index';
import {
  DEFAULT_CDN_MODEL_BASE_URL,
  DEFAULT_MODEL_MANIFEST,
  buildManifestForBaseUrl,
  groupManifestByStage,
  inferSystemFromFilename,
} from '../models/modelManifest';
import {
  applyNormalizationToPoint,
  computeSharedBodyNormalization,
  describeSourceUnits,
  mergeBoundingBoxes,
} from '../models/modelNormalization';
import {
  buildMeshMappingReport,
  mapMeshNameToAnatomy,
  parseTerminologiaMeshName,
} from '../models/anatomyMap';
import {
  classifyMaterialBucket,
  prepareSubMeshGeometry,
  resolveMergedPick,
  shouldRotateRootToFaceAnterior,
  MergedSubMeshRecord,
} from '../models/glbLoader';

test('Phase 8a / Phase 10: Unified BodyParts3D 4.0 CDN manifest stages skeleton+muscles -> skin+vessels+nerves -> organs and excludes other.glb by default', () => {
  const defaultEntries = buildManifestForBaseUrl(DEFAULT_CDN_MODEL_BASE_URL);
  const defaultSystems = defaultEntries.map((e) => e.system);
  assert.deepEqual(defaultSystems, [
    'skeleton',
    'muscles',
    'skin',
    'arteries',
    'veins',
    'nerves',
    'organs',
  ]);
  assert.ok(!defaultSystems.includes('other'), 'other.glb must NOT be loaded by default');

  const stages = groupManifestByStage(defaultEntries);
  assert.equal(stages.length, 3);
  assert.deepEqual(
    stages[0].entries.map((e) => e.system),
    ['skeleton', 'muscles']
  );
  assert.deepEqual(
    stages[1].entries.map((e) => e.system),
    ['skin', 'arteries', 'veins', 'nerves']
  );
  assert.deepEqual(
    stages[2].entries.map((e) => e.system),
    ['organs']
  );

  // Full manifest includes 7 active BodyParts3D 4.0 systems + optional other.glb (off by default) = 8 entries
  assert.equal(DEFAULT_MODEL_MANIFEST.length, 8);
  for (const entry of DEFAULT_MODEL_MANIFEST) {
    assert.ok(entry.attribution.includes('BodyParts3D'));
    if (entry.enabledByDefault) {
      assert.equal(entry.license, 'CC BY 4.0');
    }
  }

  assert.equal(inferSystemFromFilename('skeleton.glb'), 'skeleton');
  assert.equal(inferSystemFromFilename('muscles.glb'), 'muscles');
  assert.equal(inferSystemFromFilename('organs.glb'), 'organs');
  assert.equal(inferSystemFromFilename('other.glb'), 'other');
});

test('Phase 8a: Material bucketing distinguishes pearl-white tendons/insertions from deep-red muscles, investing fascia, and cartilage', () => {
  assert.equal(classifyMaterialBucket('muscles', 'Vastus lateralis muscle.r'), 'muscle');
  assert.equal(classifyMaterialBucket('muscles', 'Tensor fasciae latae.r'), 'muscle');
  assert.equal(classifyMaterialBucket('muscles', 'Investing abdominal fascia.r'), 'fascia');
  assert.equal(classifyMaterialBucket('muscles', 'Calcaneal tendon.l'), 'tendon');
  assert.equal(classifyMaterialBucket('muscles', 'Epicranial aponeurosis'), 'tendon');
  assert.equal(classifyMaterialBucket('muscles', 'Rectus abdominis muscle.er'), 'tendon');
  assert.equal(classifyMaterialBucket('muscles', 'Levator scapulae.o2l'), 'tendon');
  assert.equal(classifyMaterialBucket('skeleton', 'Femur.r'), 'bone');
  assert.equal(classifyMaterialBucket('skeleton', 'Nasal septal cartilage'), 'cartilage');
  assert.equal(classifyMaterialBucket('organs', 'Right atrium'), 'organ');
  assert.equal(classifyMaterialBucket('nerves', 'Cochlear nerve.l'), 'nerve');
});

test('Phase 8a: Merged geometry preserves negative-determinant .l mirror normals, smooth normals, and O(1) aMeshIndex pick resolution', () => {
  const box = new THREE.BoxGeometry(0.1, 0.2, 0.1);
  // Mirror matrix with negative determinant [-1, -1, -1] like Z-Anatomy `.l` left-side nodes
  const mirroredMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(0.086, 0.443, 0.007),
    new THREE.Quaternion(-1, 0, 0, 0),
    new THREE.Vector3(-1, -1, -1)
  );
  assert.ok(mirroredMatrix.determinant() < 0);

  const prepared = prepareSubMeshGeometry(box, mirroredMatrix, 42, true);
  assert.ok(prepared);
  assert.ok(prepared.getAttribute('normal'), 'Smooth vertex normals must be computed');
  const idxAttr = prepared.getAttribute('aMeshIndex');
  assert.ok(idxAttr, 'Per-vertex aMeshIndex attribute must exist');
  assert.equal(idxAttr.getX(0), 42);

  // Verify O(1) pick resolution from a merged mesh
  const subRecord: MergedSubMeshRecord = {
    meshKey: 'skeleton:bone:42',
    subMeshIndex: 42,
    meshName: 'Patella.l',
    system: 'skeleton',
    materialBucket: 'bone',
    anatomyId: 'bone_patella',
    label: 'Patella (L)',
    category: 'Skeleton',
    laterality: 'left',
    mapped: true,
    linkedFlapIds: ['alt-flap'],
    vertexStart: 0,
    vertexCount: prepared.getAttribute('position').count,
    indexStart: 0,
    indexCount: prepared.index?.count ?? 0,
    center: [0.086, 0.443, 0.007],
    boundsMin: [0.036, 0.343, -0.043],
    boundsMax: [0.136, 0.543, 0.057],
  };
  const subList: MergedSubMeshRecord[] = new Array(43);
  subList[42] = subRecord;

  const mergedMesh = new THREE.Mesh(prepared, new THREE.MeshStandardMaterial());
  mergedMesh.userData = { isMergedSystemMesh: true, subMeshes: subList };

  const fakeHit = {
    object: mergedMesh,
    face: { a: 0, b: 1, c: 2 },
  } as unknown as THREE.Intersection;

  const picked = resolveMergedPick(fakeHit);
  assert.ok(picked);
  assert.equal(picked.meshName, 'Patella.l');
  assert.equal(picked.laterality, 'left');
  assert.equal(picked.anatomyId, 'bone_patella');

  box.dispose();
  prepared.dispose();
  (mergedMesh.material as THREE.Material).dispose();
});

test('Phase 8a: Anterior orientation check detects backward-facing skeletons and keeps Z-Anatomy (+Z) unrotated', () => {
  const forwardFacing = [
    { meshName: 'Body of sternum', center: [0, 1.3, 0.092] as [number, number, number] },
    { meshName: 'Nasal bone.r', center: [-0.004, 1.59, 0.088] as [number, number, number] },
    { meshName: 'Sacrum', center: [0, 0.93, -0.059] as [number, number, number] },
    { meshName: 'Occipital bone', center: [0, 1.6, -0.058] as [number, number, number] },
  ];
  assert.equal(shouldRotateRootToFaceAnterior(forwardFacing), false);

  const backwardFacing = [
    { meshName: 'Body of sternum', center: [0, 1.3, -0.092] as [number, number, number] },
    { meshName: 'Sacrum', center: [0, 0.93, 0.059] as [number, number, number] },
  ];
  assert.equal(shouldRotateRootToFaceAnterior(backwardFacing), true);
});

test('Phase 8a: Terminologia Anatomica mapper parses Z-Anatomy .er/.ol/.l/.r suffixes & Unmapped Meshes report', () => {
  const ctx = { vessels: VESSELS, flaps: INITIAL_FLAPS };

  const parsedRectus = parseTerminologiaMeshName('Rectus abdominis muscle.er');
  assert.equal(parsedRectus.laterality, 'right');
  assert.equal(parsedRectus.normalizedName, 'rectus abdominis muscle');

  const parsedOriginLeft = parseTerminologiaMeshName('Levator scapulae.o2l');
  assert.equal(parsedOriginLeft.laterality, 'left');
  assert.equal(parsedOriginLeft.normalizedName, 'levator scapulae');

  const mappedRectus = mapMeshNameToAnatomy('Rectus abdominis muscle.er', 'muscles', ctx);
  assert.equal(mappedRectus.mapped, true);
  assert.equal(mappedRectus.laterality, 'right');
  assert.equal(mappedRectus.anatomyId, 'rectus_abdominis');

  const mappedFemur = mapMeshNameToAnatomy('Femur.r', 'skeleton', ctx);
  assert.equal(mappedFemur.mapped, true);
  assert.equal(mappedFemur.laterality, 'right');
  assert.equal(mappedFemur.anatomyId, 'bone_femur');

  const report = buildMeshMappingReport(
    [
      { meshName: 'Rectus abdominis muscle.er', system: 'muscles' },
      { meshName: 'Femur.r', system: 'skeleton' },
      { meshName: 'Unknown accessory slip.l', system: 'muscles' },
    ],
    'Z-Anatomy CDN',
    ctx
  );
  assert.equal(report.totalMeshes, 3);
  assert.equal(report.mappedCount, 2);
  assert.equal(report.unmappedCount, 1);
  assert.equal(report.unmappedEntries[0].laterality, 'left');
});

test('Phase 8a: Bounding box utilities remain intact for custom non-meter user packs', () => {
  const merged = mergeBoundingBoxes([
    { min: { x: -0.3, y: 0, z: -0.1 }, max: { x: 0.3, y: 1.8, z: 0.1 } },
  ]);
  assert.ok(merged);
  const norm = computeSharedBodyNormalization(merged, ['skeleton'], 1.75, 0);
  const foot = applyNormalizationToPoint({ x: 0, y: 0, z: 0 }, norm);
  assert.ok(Math.abs(foot.y) < 1e-6);
  assert.equal(describeSourceUnits(1.8), 'meters (m)');
});
