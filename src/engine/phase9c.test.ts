import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DEFAULT_VESSEL_PRESET_ID,
  DEFAULT_VESSEL_SIDE_FILTER,
  VESSEL_PRESETS,
  compilePresetRegex,
  getVesselPreset,
  matchesVesselPreset,
  matchesVesselSide,
  shouldShowVessel,
  summarizeVesselFilterStats,
} from '../models/vesselDeclutter';
import {
  MergedSubMeshRecord,
  applySubMeshVisibilityFilter,
  extractSubMeshGeometry,
  resolveMergedPick,
} from '../models/glbLoader';

test('Sub-Phase 9c: vesselPresets.json exposes all 5 required presets with valid regexes and Surgical default', () => {
  assert.equal(DEFAULT_VESSEL_PRESET_ID, 'surgical');
  assert.equal(DEFAULT_VESSEL_SIDE_FILTER, 'both');
  assert.equal(VESSEL_PRESETS.length, 5);

  const ids = VESSEL_PRESETS.map((p) => p.id);
  assert.deepEqual(ids, ['surgical', 'upper_limb', 'lower_limb', 'trunk_shoulder', 'all']);

  assert.equal(getVesselPreset('surgical').label, 'Surgical (default)');
  assert.equal(getVesselPreset('upper_limb').label, 'Upper limb');
  assert.equal(getVesselPreset('lower_limb').label, 'Lower limb');
  assert.equal(getVesselPreset('trunk_shoulder').label, 'Trunk wall and shoulder girdle');
  assert.equal(getVesselPreset('all').label, 'All vessels');

  for (const preset of VESSEL_PRESETS) {
    if (preset.mode !== 'all') {
      const re = compilePresetRegex(preset);
      assert.ok(re instanceof RegExp, `Preset ${preset.id} must compile to a valid RegExp`);
    } else {
      assert.equal(compilePresetRegex(preset), null);
    }
  }
});

test('Sub-Phase 9c: Surgical preset hides brain/cardiac/visceral clutter and keeps key reconstructive pedicles', () => {
  // Must hide intracranial, spinal, pulmonary segmental/lobar, cardiac, and visceral branches
  const mustHide = [
    'middle cerebral artery',
    'anterior cerebral artery',
    'superior cerebellar artery',
    'anterior choroidal artery',
    'basilar artery',
    'posterior communicating artery',
    'anterior spinal artery',
    'left coronary artery',
    'great cardiac vein',
    'hepatic portal vein',
    'proper hepatic artery',
    'superior pancreaticoduodenal artery',
    'appendicular artery',
    'right colic artery',
    'sigmoid artery',
    'segmental pulmonary artery',
    'lingular artery',
  ];
  for (const name of mustHide) {
    assert.equal(
      matchesVesselPreset(name, 'surgical'),
      false,
      `Surgical preset should hide "${name}"`
    );
  }

  // Must keep reconstructive workhorse vessels (including 9g(d) explicit list)
  const mustKeep = [
    'femoral artery',
    'descending branch of lateral circumflex femoral artery',
    'radial artery',
    'ulnar artery',
    'brachial artery',
    'inferior epigastric artery',
    'superior epigastric artery',
    'thoracodorsal artery',
    'internal thoracic artery',
    'popliteal artery',
    'posterior tibial artery',
    'dorsalis pedis artery',
    'abdominal aorta',
    'inferior vena cava',
    'great saphenous vein',
    'cephalic vein',
  ];
  for (const name of mustKeep) {
    assert.equal(
      matchesVesselPreset(name, 'surgical'),
      true,
      `Surgical preset should keep "${name}"`
    );
  }
});

test('Sub-Phase 9c: Regional presets (Upper limb, Lower limb, Trunk & shoulder) and All vessels filter accurately', () => {
  // Upper limb
  assert.equal(matchesVesselPreset('radial artery', 'upper_limb'), true);
  assert.equal(matchesVesselPreset('cephalic vein', 'upper_limb'), true);
  assert.equal(matchesVesselPreset('radialis indicis artery', 'upper_limb'), true);
  assert.equal(matchesVesselPreset('femoral artery', 'upper_limb'), false);
  assert.equal(matchesVesselPreset('inferior epigastric artery', 'upper_limb'), false);

  // Lower limb
  assert.equal(matchesVesselPreset('femoral artery', 'lower_limb'), true);
  assert.equal(matchesVesselPreset('dorsalis pedis artery', 'lower_limb'), true);
  assert.equal(matchesVesselPreset('great saphenous vein', 'lower_limb'), true);
  assert.equal(matchesVesselPreset('external iliac artery', 'lower_limb'), true);
  assert.equal(matchesVesselPreset('radial artery', 'lower_limb'), false);
  assert.equal(matchesVesselPreset('thoracodorsal artery', 'lower_limb'), false);

  // Trunk wall and shoulder girdle
  assert.equal(matchesVesselPreset('inferior epigastric artery', 'trunk_shoulder'), true);
  assert.equal(matchesVesselPreset('internal thoracic artery', 'trunk_shoulder'), true);
  assert.equal(matchesVesselPreset('thoracodorsal artery', 'trunk_shoulder'), true);
  assert.equal(matchesVesselPreset('circumflex scapular artery', 'trunk_shoulder'), true);
  assert.equal(matchesVesselPreset('internal jugular vein', 'trunk_shoulder'), true);
  assert.equal(matchesVesselPreset('femoral artery', 'trunk_shoulder'), false);
  assert.equal(matchesVesselPreset('middle cerebral artery', 'trunk_shoulder'), false);

  // All vessels
  assert.equal(matchesVesselPreset('middle cerebral artery', 'all'), true);
  assert.equal(matchesVesselPreset('femoral artery', 'all'), true);
  assert.equal(matchesVesselPreset('hepatic portal vein', 'all'), true);
});

test('Sub-Phase 9c: Side filter (Left / Right / Both) hides opposite side and preserves midline trunks', () => {
  assert.equal(matchesVesselSide('left', 'both'), true);
  assert.equal(matchesVesselSide('right', 'both'), true);
  assert.equal(matchesVesselSide('midline', 'both'), true);

  assert.equal(matchesVesselSide('left', 'left'), true);
  assert.equal(matchesVesselSide('right', 'left'), false);
  assert.equal(matchesVesselSide('midline', 'left'), true);

  assert.equal(matchesVesselSide('right', 'right'), true);
  assert.equal(matchesVesselSide('left', 'right'), false);
  assert.equal(matchesVesselSide('midline', 'right'), true);

  // Combined preset + side summary
  const sample = [
    { name: 'middle cerebral artery', laterality: 'left', system: 'arteries' as const },
    { name: 'femoral artery', laterality: 'left', system: 'arteries' as const },
    { name: 'femoral artery', laterality: 'right', system: 'arteries' as const },
    { name: 'radial artery', laterality: 'right', system: 'arteries' as const },
    { name: 'abdominal aorta', laterality: 'midline', system: 'arteries' as const },
    { name: 'great saphenous vein', laterality: 'left', system: 'veins' as const },
    { name: 'hepatic portal vein', laterality: 'midline', system: 'veins' as const },
  ];

  const surgicalBoth = summarizeVesselFilterStats(sample, 'surgical', 'both');
  assert.equal(surgicalBoth.totalVessels, 7);
  assert.equal(surgicalBoth.visibleArteries, 4); // hides middle cerebral
  assert.equal(surgicalBoth.visibleVeins, 1); // hides hepatic portal
  assert.equal(surgicalBoth.hiddenVessels, 2);

  const lowerLeft = summarizeVesselFilterStats(sample, 'lower_limb', 'left');
  assert.equal(lowerLeft.visibleArteries, 1); // only left femoral
  assert.equal(lowerLeft.visibleVeins, 1); // only left great saphenous
  assert.equal(lowerLeft.visibleVessels, 2);

  const allRight = summarizeVesselFilterStats(sample, 'all', 'right');
  // right femoral, right radial, midline aorta, midline hepatic portal = 4 visible
  assert.equal(allRight.visibleVessels, 4);
});

test('Sub-Phase 9c: applySubMeshVisibilityFilter declutters merged vessel mesh while preserving picking & restoration', () => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        // Sub-mesh 0: middle cerebral artery (left)
        0, 1.6, 0, 0.05, 1.6, 0, 0, 1.65, 0,
        // Sub-mesh 1: femoral artery (left)
        0.1, 0.7, 0, 0.12, 0.7, 0, 0.1, 0.8, 0,
        // Sub-mesh 2: femoral artery (right)
        -0.1, 0.7, 0, -0.12, 0.7, 0, -0.1, 0.8, 0,
      ],
      3
    )
  );
  geo.setAttribute('aMeshIndex', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 2, 2, 2], 1));
  geo.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);

  const subs: MergedSubMeshRecord[] = [
    {
      meshKey: 'arteries:artery:0',
      subMeshIndex: 0,
      meshName: 'middle cerebral artery [FJ1111]',
      system: 'arteries',
      materialBucket: 'artery',
      anatomyId: 'middle_cerebral_artery',
      label: 'middle cerebral artery',
      category: 'Artery',
      laterality: 'left',
      mapped: false,
      linkedFlapIds: [],
      sourceModel: 'bodyparts3d',
      fjCode: 'FJ1111',
      vertexStart: 0,
      vertexCount: 3,
      indexStart: 0,
      indexCount: 3,
      center: [0.02, 1.62, 0],
      boundsMin: [0, 1.6, 0],
      boundsMax: [0.05, 1.65, 0],
    },
    {
      meshKey: 'arteries:artery:1',
      subMeshIndex: 1,
      meshName: 'femoral artery [FJ2074]',
      system: 'arteries',
      materialBucket: 'artery',
      anatomyId: 'femoral_artery',
      label: 'femoral artery',
      category: 'Artery',
      laterality: 'left',
      mapped: true,
      linkedFlapIds: ['alt-flap'],
      sourceModel: 'bodyparts3d',
      fjCode: 'FJ2074',
      vertexStart: 3,
      vertexCount: 3,
      indexStart: 3,
      indexCount: 3,
      center: [0.11, 0.75, 0],
      boundsMin: [0.1, 0.7, 0],
      boundsMax: [0.12, 0.8, 0],
    },
    {
      meshKey: 'arteries:artery:2',
      subMeshIndex: 2,
      meshName: 'femoral artery [FJ2143]',
      system: 'arteries',
      materialBucket: 'artery',
      anatomyId: 'femoral_artery',
      label: 'femoral artery',
      category: 'Artery',
      laterality: 'right',
      mapped: true,
      linkedFlapIds: ['alt-flap'],
      sourceModel: 'bodyparts3d',
      fjCode: 'FJ2143',
      vertexStart: 6,
      vertexCount: 3,
      indexStart: 6,
      indexCount: 3,
      center: [-0.11, 0.75, 0],
      boundsMin: [-0.12, 0.7, 0],
      boundsMax: [-0.1, 0.8, 0],
    },
  ];

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.userData = { isMergedSystemMesh: true, subMeshes: subs };

  // Filter: Surgical + Right -> only sub-mesh 2 (right femoral artery) remains
  const visibleCount = applySubMeshVisibilityFilter(mesh, (rec) =>
    shouldShowVessel(
      { name: rec.label, meshName: rec.meshName, laterality: rec.laterality, centerXMeters: rec.center[0] },
      'surgical',
      'right'
    )
  );
  assert.equal(visibleCount, 1);
  assert.equal(mesh.geometry.index?.count, 3);

  // Triangle 0 in filtered buffer (indices [6, 7, 8]) must pick right femoral artery (FJ2143)
  const idxAttr = mesh.geometry.index!;
  const picked = resolveMergedPick({
    object: mesh,
    face: {
      a: idxAttr.getX(0),
      b: idxAttr.getX(1),
      c: idxAttr.getX(2),
      normal: new THREE.Vector3(0, 0, 1),
      materialIndex: 0,
    },
    distance: 1,
    point: new THREE.Vector3(-0.11, 0.75, 0),
  } as THREE.Intersection);
  assert.equal(picked?.fjCode, 'FJ2143');
  assert.equal(picked?.laterality, 'right');

  // Extraction still works cleanly for sub-mesh 2
  const extracted = extractSubMeshGeometry(mesh, subs[2]);
  assert.ok(extracted && extracted.getAttribute('position').count === 3);
  extracted.dispose();

  // Restore All + Both -> all 9 indices restored
  const restoredCount = applySubMeshVisibilityFilter(mesh, null);
  assert.equal(restoredCount, 3);
  assert.equal(mesh.geometry.index?.count, 9);

  geo.dispose();
  (mesh.material as THREE.Material).dispose();
});
