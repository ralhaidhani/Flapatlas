import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  BODYPARTS3D_CC_BY_4_ATTRIBUTION,
  DEFAULT_CDN_MODEL_BASE_URL,
  DEFAULT_MODEL_MANIFEST,
  buildManifestForBaseUrl,
  inferSystemFromFilename,
} from '../models/modelManifest';
import {
  createBucketMaterial,
  createHoverHighlightGroup,
  disposeSelectionHighlightGroup,
  parseBodyParts3DNodeExtras,
  prepareSubMeshGeometry,
  resolveMergedPick,
  MergedSubMeshRecord,
} from '../models/glbLoader';
import { isLayerSchematic } from '../models/anchorSystem';
import { DEFAULT_LAYERS } from '../store/useAtlasStore';

test('Phase 9a / Phase 10: modelManifest includes arteries, veins, and skin with CC BY 4.0 & verbatim BodyParts3D attribution', () => {
  const expectedAttribution =
    'Anatomical geometry: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International. Modified: converted from OBJ to glTF, axes and units transformed, split by body system, Draco-compressed, names normalised.';
  assert.equal(BODYPARTS3D_CC_BY_4_ATTRIBUTION, expectedAttribution);

  for (const sys of ['arteries', 'veins', 'skin'] as const) {
    const entry = DEFAULT_MODEL_MANIFEST.find((e) => e.system === sys);
    assert.ok(entry, `Manifest must contain entry with system "${sys}"`);
    assert.equal(entry.system, sys);
    assert.equal(entry.fileName, `${sys}.glb`);
    assert.equal(entry.license, 'CC BY 4.0');
    assert.equal(entry.attribution, expectedAttribution);
    assert.equal(inferSystemFromFilename(`${sys}.glb`), sys);
  }

  // Unified BodyParts3D 4.0 CDN loads all 7 enabledByDefault systems (excluding other.glb)
  const cdnEntries = buildManifestForBaseUrl(DEFAULT_CDN_MODEL_BASE_URL);
  assert.deepEqual(
    cdnEntries.map((e) => e.system),
    ['skeleton', 'muscles', 'skin', 'arteries', 'veins', 'nerves', 'organs']
  );

  // Custom remote URL automatically includes all 7 active systems (excluding other.glb)
  const remoteEntries = buildManifestForBaseUrl('https://cdn.example.org/flapatlas-bp3d');
  const remoteSystems = remoteEntries.map((e) => e.system);
  assert.ok(remoteSystems.includes('arteries'));
  assert.ok(remoteSystems.includes('veins'));
  assert.ok(remoteSystems.includes('skin'));
  assert.ok(!remoteSystems.includes('other'));
});

test('Phase 9a: parseBodyParts3DNodeExtras reads node.extras and strips [FJxxxx] from display name', () => {
  const fromExtras = parseBodyParts3DNodeExtras(
    'inferior epigastric artery [FJ3604]',
    {
      fj: 'FJ3604',
      fma: 'FMA20737',
      name: 'inferior epigastric artery',
      side: 'right',
      system: 'arteries',
    },
    null
  );
  assert.ok(fromExtras);
  assert.equal(fromExtras.name, 'inferior epigastric artery');
  assert.ok(!fromExtras.name.includes('FJ3604'), 'Display name must never include raw [FJxxxx]');
  assert.equal(fromExtras.fj, 'FJ3604');
  assert.equal(fromExtras.fma, 'FMA20737');
  assert.equal(fromExtras.side, 'right');
  assert.equal(fromExtras.system, 'arteries');

  // Fallback parsing when extras are only on parent node or encoded in node name
  const fromSkinName = parseBodyParts3DNodeExtras('skin [FJ2810]', null, null, null);
  assert.ok(fromSkinName);
  assert.equal(fromSkinName.name, 'skin');
  assert.equal(fromSkinName.fj, 'FJ2810');
  assert.equal(fromSkinName.side, 'midline');

  // Non-BodyParts3D Z-Anatomy mesh returns null
  const zAnatomyNode = parseBodyParts3DNodeExtras('Vastus lateralis muscle.r', {}, null, null);
  assert.equal(zAnatomyNode, null);
});

test('Phase 9a / Phase 10: BodyParts3D PBR materials & default layers match spec (skin 15% DoubleSide depthWrite=false, organs hidden, vessels ON)', () => {
  assert.equal(DEFAULT_LAYERS.arteries.visible, true);
  assert.equal(DEFAULT_LAYERS.veins.visible, true);
  assert.equal(DEFAULT_LAYERS.skin.visible, true);
  assert.equal(DEFAULT_LAYERS.skin.opacity, 0.15);
  assert.equal(DEFAULT_LAYERS.organs.visible, false);

  const skinMat = createBucketMaterial('skin', false);
  assert.equal(skinMat.transparent, true);
  assert.equal(skinMat.opacity, 0.15);
  assert.equal(skinMat.depthWrite, false);
  assert.equal(skinMat.side, THREE.DoubleSide);

  const arteryMat = createBucketMaterial('artery', false);
  const veinMat = createBucketMaterial('vein', false);
  assert.equal(arteryMat.color.getHex(), 0xd62424);
  assert.ok(arteryMat.color.r > 0.6 && arteryMat.color.b < 0.05, 'Arteries must be saturated red');
  assert.equal(veinMat.color.getHex(), 0x1b4fb8);
  assert.ok(veinMat.color.b > 0.4 && veinMat.color.r < 0.05, 'Veins must be deep blue');

  skinMat.dispose();
  arteryMat.dispose();
  veinMat.dispose();
});

test('Phase 9a: Welded BodyParts3D geometry computes smooth normals, preserves aMeshIndex picking, and creates hover highlight cleanly', () => {
  // Simulate an already-welded BodyParts3D mesh with NO normals attribute
  const rawCyl = new THREE.CylinderGeometry(0.004, 0.004, 0.12, 10, 1);
  rawCyl.deleteAttribute('normal');
  rawCyl.deleteAttribute('uv');
  assert.equal(rawCyl.getAttribute('normal'), undefined);

  const prepared = prepareSubMeshGeometry(rawCyl, new THREE.Matrix4(), 7, true, true);
  assert.ok(prepared);
  const normAttr = prepared.getAttribute('normal');
  assert.ok(normAttr && normAttr.count === prepared.getAttribute('position').count);
  // Check normal vector is unit-length
  const nx = normAttr.getX(0);
  const ny = normAttr.getY(0);
  const nz = normAttr.getZ(0);
  assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < 1e-3, 'Computed vertex normals must be unit-length');

  const idxAttr = prepared.getAttribute('aMeshIndex');
  assert.ok(idxAttr);
  assert.equal(idxAttr.getX(0), 7);

  const rec: MergedSubMeshRecord = {
    meshKey: 'arteries:artery:7',
    subMeshIndex: 7,
    meshName: 'inferior epigastric artery [FJ3604]',
    system: 'arteries',
    materialBucket: 'artery',
    anatomyId: 'diea',
    label: 'inferior epigastric artery',
    category: 'Artery',
    laterality: 'right',
    mapped: true,
    linkedFlapIds: ['diep-flap'],
    sourceModel: 'bodyparts3d',
    fjCode: 'FJ3604',
    fmaCode: 'FMA20737',
    vertexStart: 0,
    vertexCount: prepared.getAttribute('position').count,
    indexStart: 0,
    indexCount: prepared.index?.count ?? 0,
    center: [-0.04, 0.96, 0.08],
    boundsMin: [-0.05, 0.9, 0.07],
    boundsMax: [-0.03, 1.02, 0.09],
  };
  const subList: MergedSubMeshRecord[] = new Array(8);
  subList[7] = rec;

  const mergedMesh = new THREE.Mesh(prepared, new THREE.MeshStandardMaterial());
  mergedMesh.userData = { isMergedSystemMesh: true, subMeshes: subList };

  const picked = resolveMergedPick({
    object: mergedMesh,
    face: { a: 0, b: 1, c: 2 },
  } as unknown as THREE.Intersection);
  assert.ok(picked);
  assert.equal(picked.label, 'inferior epigastric artery');
  assert.equal(picked.sourceModel, 'bodyparts3d');
  assert.equal(picked.fjCode, 'FJ3604');
  assert.equal(picked.laterality, 'right');

  // Hover highlight group builds & disposes cleanly with clipping planes
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.2);
  const hoverGroup = createHoverHighlightGroup(prepared.clone(), [clipPlane], 0xfef08a);
  assert.equal(hoverGroup.children.length, 2);
  disposeSelectionHighlightGroup(hoverGroup);
  assert.equal(hoverGroup.children.length, 0);

  rawCyl.dispose();
  prepared.dispose();
  (mergedMesh.material as THREE.Material).dispose();
});

test('Phase 9a: Schematic tags clear automatically once BodyParts3D arteries, veins, and skin load', () => {
  // Before upload (Z-Anatomy only)
  const zOnly = ['skeleton', 'muscles', 'organs', 'nerves'] as const;
  assert.equal(isLayerSchematic('skin', [...zOnly], true), true);
  assert.equal(isLayerSchematic('arteries', [...zOnly], true), true);
  assert.equal(isLayerSchematic('veins', [...zOnly], true), true);

  // After uploading BodyParts3D arteries, veins, skin
  const combined = [...zOnly, 'arteries', 'veins', 'skin'] as const;
  assert.equal(isLayerSchematic('skin', [...combined], true), false);
  assert.equal(isLayerSchematic('arteries', [...combined], true), false);
  assert.equal(isLayerSchematic('veins', [...combined], true), false);
  // Perforators & paddles remain schematic (BodyParts3D has no perforator meshes)
  assert.equal(isLayerSchematic('perforators', [...combined], true), true);
  assert.equal(isLayerSchematic('paddle', [...combined], true), true);
});
