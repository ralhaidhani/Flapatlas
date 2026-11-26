import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ALIGNED_SYSTEM_IDS,
  CALIBRATION_VIEW_HINTS,
  DEFAULT_VESSEL_ALIGNMENT,
  applyVesselAlignmentToGroup,
  clampVesselAlignment,
  computeAlignmentDiagnostics,
  computeAlignmentGroupLocalTransform,
  formatAlignmentDiagnosticsForConsole,
  isAlignedSystem,
  isCalibrationReferenceArtery,
  measureObjectWorldBounds,
  transformSubMeshBoundsWithAlignment,
} from '../models/vesselAlignment';
import {
  applySubMeshVisibilityFilter,
  extractSubMeshGeometry,
  MergedSubMeshRecord,
} from '../models/glbLoader';

test('Sub-Phase 9b: default alignment is 0 cm offsets and scale 1, with strict clamping', () => {
  assert.deepEqual(DEFAULT_VESSEL_ALIGNMENT, {
    offsetXCm: 0,
    offsetYCm: 0,
    offsetZCm: 0,
    scale: 1,
  });

  // Clamps offsets to [-15, 15] cm with 0.1 cm (1 mm) precision and scale to [0.90, 1.10]
  const clampedHigh = clampVesselAlignment({
    offsetXCm: 22.74,
    offsetYCm: -19.86,
    offsetZCm: 1.24,
    scale: 1.25,
  });
  assert.equal(clampedHigh.offsetXCm, 15);
  assert.equal(clampedHigh.offsetYCm, -15);
  assert.equal(clampedHigh.offsetZCm, 1.2);
  assert.equal(clampedHigh.scale, 1.1);

  const clampedLow = clampVesselAlignment({
    offsetXCm: Number.NaN,
    offsetYCm: -0.04,
    offsetZCm: 3.45,
    scale: 0.72,
  });
  assert.equal(clampedLow.offsetXCm, 0);
  assert.equal(clampedLow.offsetYCm, 0);
  assert.equal(clampedLow.offsetZCm, 3.5);
  assert.equal(clampedLow.scale, 0.9);
});

test('Sub-Phase 9b: arteries, veins, and skin share the exact same alignment group transform', () => {
  assert.deepEqual([...ALIGNED_SYSTEM_IDS], ['arteries', 'veins', 'skin']);
  assert.equal(isAlignedSystem('arteries'), true);
  assert.equal(isAlignedSystem('veins'), true);
  assert.equal(isAlignedSystem('skin'), true);
  assert.equal(isAlignedSystem('skeleton'), false);
  assert.equal(isAlignedSystem('muscles'), false);

  const group = new THREE.Group();
  const arteries = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.1));
  arteries.position.set(0, 0.85, 0);
  const veins = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.1));
  veins.position.set(0, 0.85, 0);
  const skin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.7, 0.25));
  skin.position.set(0, 0.85, 0);
  group.add(arteries, veins, skin);

  const pivot: [number, number, number] = [0, 0.85, 0];
  applyVesselAlignmentToGroup(
    group,
    { offsetXCm: -2.5, offsetYCm: 1.4, offsetZCm: 0.8, scale: 1.05 },
    pivot,
    false
  );

  // Verify uniform scaling pivots cleanly around (0, 0.85, 0) so center shifts by exact cm offset
  const artBounds = measureObjectWorldBounds(arteries)!;
  const skinBounds = measureObjectWorldBounds(skin)!;
  assert.ok(artBounds && skinBounds);

  const artCenterX = (artBounds.min.x + artBounds.max.x) * 0.5;
  const artCenterY = (artBounds.min.y + artBounds.max.y) * 0.5;
  const artCenterZ = (artBounds.min.z + artBounds.max.z) * 0.5;
  assert.ok(Math.abs(artCenterX - -0.025) < 1e-4, `Expected X=-0.025, got ${artCenterX}`);
  assert.ok(Math.abs(artCenterY - 0.864) < 1e-4, `Expected Y=0.864, got ${artCenterY}`);
  assert.ok(Math.abs(artCenterZ - 0.008) < 1e-4, `Expected Z=0.008, got ${artCenterZ}`);

  // Skin height scales by 1.05x (1.70 m -> 1.785 m) and shares the exact same center shift
  const skinHeight = skinBounds.max.y - skinBounds.min.y;
  assert.ok(Math.abs(skinHeight - 1.785) < 1e-4, `Expected skin height 1.785m, got ${skinHeight}`);
  assert.ok(Math.abs((skinBounds.min.x + skinBounds.max.x) * 0.5 - -0.025) < 1e-4);

  // Also verify orientationRotatedY negates X/Z offsets so world-space directions remain anatomical
  const rotTransform = computeAlignmentGroupLocalTransform(
    { offsetXCm: 2.0, offsetYCm: 1.0, offsetZCm: -3.0, scale: 1.0 },
    [0, 0.85, 0],
    true
  );
  assert.deepEqual(rotTransform.position, [-0.02, 0.01, 0.03]);

  // Verify sub-mesh bounds helper matches world alignment
  const wb = transformSubMeshBoundsWithAlignment(
    {
      system: 'arteries',
      center: [0, 0.85, 0],
      boundsMin: [-0.1, 0.55, -0.05],
      boundsMax: [0.1, 1.15, 0.05],
    },
    { offsetXCm: -2.5, offsetYCm: 1.4, offsetZCm: 0.8, scale: 1.05 },
    pivot,
    false
  );
  assert.ok(Math.abs(wb.center[0] - -0.025) < 1e-3);
  assert.ok(Math.abs(wb.center[1] - 0.864) < 1e-3);
  assert.ok(Math.abs(wb.center[2] - 0.008) < 1e-3);
});

test('Sub-Phase 9b: bounding box diagnostics compute heights, center deltas, and 1 cm Aligned threshold', () => {
  const skel = { min: { x: -0.22, y: 0.0, z: -0.12 }, max: { x: 0.22, y: 1.72, z: 0.12 } };
  const musc = { min: { x: -0.24, y: 0.02, z: -0.13 }, max: { x: 0.24, y: 1.70, z: 0.13 } };
  const skin = { min: { x: -0.26, y: 0.0, z: -0.14 }, max: { x: 0.26, y: 1.74, z: 0.14 } };

  // Misaligned vessels: shifted +2.5 cm in X -> distance = 2.5 cm > 1.0 cm -> NOT Aligned
  const vesselsFar = {
    min: { x: -0.175, y: 0.10, z: -0.10 },
    max: { x: 0.225, y: 1.62, z: 0.10 },
  };
  const diagFar = computeAlignmentDiagnostics(
    { skeleton: skel, muscles: musc, vessels: vesselsFar, skin },
    5
  );
  assert.equal(diagFar.skeleton.heightCm, 172.0);
  assert.equal(diagFar.muscles.heightCm, 168.0);
  assert.equal(diagFar.skin.heightCm, 174.0);
  assert.equal(diagFar.vessels.heightCm, 152.0);
  assert.equal(diagFar.vesselsVsSkeletonCm?.dxCm, 2.5);
  assert.equal(diagFar.vesselsVsSkeletonCm?.distanceCm, 2.5);
  assert.equal(diagFar.isVesselAligned, false);
  assert.equal(diagFar.calibrationArteryCount, 5);

  // Aligned vessels: shifted +0.6 cm in X, -0.5 cm in Y -> distance ~ 0.78 cm <= 1.0 cm -> Aligned
  const vesselsNear = {
    min: { x: -0.194, y: 0.095, z: -0.10 },
    max: { x: 0.206, y: 1.615, z: 0.10 },
  };
  const diagNear = computeAlignmentDiagnostics(
    { skeleton: skel, muscles: musc, vessels: vesselsNear, skin },
    5
  );
  assert.equal(diagNear.isVesselAligned, true);
  assert.ok((diagNear.vesselsVsSkeletonCm?.distanceCm ?? 99) <= 1.0);

  const consoleText = formatAlignmentDiagnosticsForConsole(diagNear, DEFAULT_VESSEL_ALIGNMENT);
  assert.match(consoleText, /ALIGNED/i);
  assert.match(consoleText, /Skeleton/);
  assert.match(consoleText, /Muscles/);
  assert.match(consoleText, /Vessels/);
  assert.match(consoleText, /Skin/);
});

test('Sub-Phase 9b: Calibration View matches only abdominal aorta, femoral, and internal thoracic arteries + 4 hints', () => {
  assert.equal(CALIBRATION_VIEW_HINTS.length, 4);
  assert.ok(CALIBRATION_VIEW_HINTS.some((h) => /lumbar vertebral bodies/i.test(h.text)));
  assert.ok(CALIBRATION_VIEW_HINTS.some((h) => /femoral head toward the medial thigh/i.test(h.text)));
  assert.ok(CALIBRATION_VIEW_HINTS.some((h) => /sternal border behind the costal cartilages/i.test(h.text)));
  assert.ok(CALIBRATION_VIEW_HINTS.some((h) => /skin surface must enclose the muscles/i.test(h.text)));

  // Positive matches (including FJ-prefixed mesh names & parenthetical clinical labels)
  assert.equal(isCalibrationReferenceArtery('abdominal aorta'), true);
  assert.equal(isCalibrationReferenceArtery('femoral artery', 'FJ2143'), true);
  assert.equal(isCalibrationReferenceArtery('femoral artery', 'FJ2074'), true);
  assert.equal(isCalibrationReferenceArtery('left femoral artery'), true);
  assert.equal(isCalibrationReferenceArtery('internal thoracic artery', 'FJ1937'), true);
  assert.equal(isCalibrationReferenceArtery('right internal thoracic artery'), true);
  assert.equal(isCalibrationReferenceArtery('Internal Mammary Artery (IMA)'), true);
  assert.equal(isCalibrationReferenceArtery('FJ1972_right internal thoracic artery'), true);
  assert.equal(isCalibrationReferenceArtery('FJ1937_left internal thoracic artery'), true);
  assert.equal(
    isCalibrationReferenceArtery('Unmapped vessel', undefined, 'FJ1972_right internal thoracic artery'),
    true
  );

  // Negative matches (should be hidden in Calibration View)
  assert.equal(isCalibrationReferenceArtery('middle cerebral artery', 'FJ1111'), false);
  assert.equal(isCalibrationReferenceArtery('lateral circumflex femoral artery', 'FJ2078'), false);
  assert.equal(isCalibrationReferenceArtery('inferior epigastric artery', 'FJ3604'), false);
  assert.equal(isCalibrationReferenceArtery('radial artery', 'FJ2242'), false);
  assert.equal(isCalibrationReferenceArtery('coronary artery'), false);
  assert.equal(isCalibrationReferenceArtery('internal thoracic perforating branch'), false);
});

test('Sub-Phase 9b: applySubMeshVisibilityFilter isolates Calibration View arteries and preserves extraction', () => {
  // Build a merged mesh with 2 triangles (sub-mesh 0 = abdominal aorta, sub-mesh 1 = middle cerebral artery)
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 1.0, 0.02, 0.01, 1.0, 0.02, 0, 1.15, 0.02, // sub-mesh 0
        0, 1.65, 0.01, 0.01, 1.65, 0.01, 0, 1.68, 0.01, // sub-mesh 1
      ],
      3
    )
  );
  geo.setAttribute('aMeshIndex', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1], 1));
  geo.setIndex(new THREE.Uint16BufferAttribute([0, 1, 2, 3, 4, 5], 1));
  geo.computeVertexNormals();

  const records: MergedSubMeshRecord[] = [
    {
      meshKey: 'arteries:artery:0',
      subMeshIndex: 0,
      meshName: 'abdominal aorta [FJ1000]',
      system: 'arteries',
      materialBucket: 'artery',
      anatomyId: 'abdominal_aorta',
      label: 'abdominal aorta',
      category: 'Artery',
      laterality: 'midline',
      mapped: true,
      linkedFlapIds: [],
      sourceModel: 'bodyparts3d',
      fjCode: 'FJ1000',
      vertexStart: 0,
      vertexCount: 3,
      indexStart: 0,
      indexCount: 3,
      center: [0, 1.05, 0.02],
      boundsMin: [0, 1.0, 0.02],
      boundsMax: [0.01, 1.15, 0.02],
    },
    {
      meshKey: 'arteries:artery:1',
      subMeshIndex: 1,
      meshName: 'middle cerebral artery [FJ1001]',
      system: 'arteries',
      materialBucket: 'artery',
      anatomyId: 'middle_cerebral_artery',
      label: 'middle cerebral artery',
      category: 'Artery',
      laterality: 'right',
      mapped: false,
      linkedFlapIds: [],
      sourceModel: 'bodyparts3d',
      fjCode: 'FJ1001',
      vertexStart: 3,
      vertexCount: 3,
      indexStart: 3,
      indexCount: 3,
      center: [0, 1.66, 0.01],
      boundsMin: [0, 1.65, 0.01],
      boundsMax: [0.01, 1.68, 0.01],
    },
  ];

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.userData = { isMergedSystemMesh: true, subMeshes: records };

  // Filter to calibration reference arteries -> only sub-mesh 0 remains (3 indices)
  const visibleCount = applySubMeshVisibilityFilter(mesh, (r) =>
    isCalibrationReferenceArtery(r.label, r.fjCode)
  );
  assert.equal(visibleCount, 1);
  assert.equal(mesh.geometry.getIndex()?.count, 3);

  // Picking/extracting either record still works cleanly via stashed fullIndex
  const extractedAorta = extractSubMeshGeometry(mesh, records[0]);
  assert.ok(extractedAorta && extractedAorta.getIndex()?.count === 3);

  // Restoring null filter restores all 6 indices
  const restoredCount = applySubMeshVisibilityFilter(mesh, null);
  assert.equal(restoredCount, 2);
  assert.equal(mesh.geometry.getIndex()?.count, 6);
});
