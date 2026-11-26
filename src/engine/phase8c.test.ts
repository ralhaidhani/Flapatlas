import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_FLAPS } from '../data/index';
import {
  ANCHOR_MODEL_VERSION,
  computeAnchorDeltaCm,
  DEFAULT_ANCHORS,
  isLayerSchematic,
  mergeAnchorsWithCalibration,
  parseAnchorsImportJson,
  REQUIRED_ANCHOR_IDS,
  resolveFlapOverlayRelativeToAnchors,
  SCHEMATIC_TAG_TEXT,
  snapPathToSourceVessel,
  SourceVesselCandidate,
  transformPointRelativeToAnchors,
} from '../models/anchorSystem';

test('Phase 8c / Phase 10d: anchors.json contains all 13 required bp3d-4.0 skeletal landmarks with valid 3D coordinates', () => {
  assert.equal(DEFAULT_ANCHORS.length, 13);
  const ids = new Set(DEFAULT_ANCHORS.map((a) => a.id));
  for (const requiredId of REQUIRED_ANCHOR_IDS) {
    assert.ok(ids.has(requiredId), `Missing required landmark anchor: ${requiredId}`);
  }
  for (const anchor of DEFAULT_ANCHORS) {
    assert.equal(anchor.defaultProceduralPos.length, 3);
    assert.equal(anchor.position.length, 3);
    assert.ok(
      anchor.defaultProceduralPos.every((v) => typeof v === 'number' && Number.isFinite(v)),
      `Invalid defaultProceduralPos for ${anchor.id}`
    );
    assert.ok(
      anchor.position.every((v) => typeof v === 'number' && Number.isFinite(v)),
      `Invalid position for ${anchor.id}`
    );
    assert.equal(anchor.source, 'default');
  }
  assert.equal(SCHEMATIC_TAG_TEXT, 'Schematic — not from source model');
});

test('Phase 8c: mergeAnchorsWithCalibration and parseAnchorsImportJson handle array, map, and invalid inputs', () => {
  const merged = mergeAnchorsWithCalibration(DEFAULT_ANCHORS, {
    asis: {
      position: [0.145, 0.942, 0.088],
      snappedSkeletonMesh: 'Ilium.r',
      updatedAtIso: '2026-11-20T00:00:00.000Z',
      modelVersion: ANCHOR_MODEL_VERSION,
    },
  });

  const asis = merged.find((a) => a.id === 'asis');
  assert.ok(asis);
  assert.equal(asis.source, 'calibrated');
  assert.deepEqual(asis.position, [0.145, 0.942, 0.088]);
  assert.equal(asis.snappedSkeletonMesh, 'Ilium.r');
  assert.ok(computeAnchorDeltaCm(asis) > 0);

  const psis = merged.find((a) => a.id === 'psis');
  assert.ok(psis);
  assert.equal(psis.source, 'default');
  assert.equal(computeAnchorDeltaCm(psis), 0);

  // Import array format
  const arrayImport = parseAnchorsImportJson(
    JSON.stringify([
      { id: 'asis', position: [0.14, 0.95, 0.09], snappedSkeletonMesh: 'Hip bone.r' },
      { id: 'mastoid', position: [0.072, 1.56, -0.025] },
      { id: 'unknown_id', position: [0, 0, 0] },
    ])
  );
  assert.equal(arrayImport.ok, true);
  assert.equal(arrayImport.count, 2);
  assert.deepEqual(arrayImport.overrides?.asis.position, [0.14, 0.95, 0.09]);
  assert.equal(arrayImport.overrides?.asis.snappedSkeletonMesh, 'Hip bone.r');

  // Import keyed map format
  const mapImport = parseAnchorsImportJson(
    JSON.stringify({
      umbilicus: { position: [0, 1.015, 0.115] },
    })
  );
  assert.equal(mapImport.ok, true);
  assert.equal(mapImport.count, 1);
  assert.deepEqual(mapImport.overrides?.umbilicus.position, [0, 1.015, 0.115]);

  // Reject malformed JSON and empty payload
  assert.equal(parseAnchorsImportJson('{not valid json').ok, false);
  assert.equal(parseAnchorsImportJson(JSON.stringify([{ id: 'bogus', position: [1, 2, 3] }])).ok, false);
});

test('Phase 8c: anchor-relative IDW overlay warp has zero drift in procedural baseline and tracks calibrated landmarks without mutating clinical measurements', () => {
  const altFlap = INITIAL_FLAPS.find((f) =>
    f.name.toLowerCase().includes('anterolateral thigh')
  )!;
  assert.ok(altFlap, 'ALT flap must exist in dataset');

  const originalDimensions = JSON.stringify(altFlap.dimensions);
  const originalPedicleLength = JSON.stringify(altFlap.vascular_anatomy.dominant_pedicle);

  // Procedural baseline: zero displacement
  const baselinePoint = transformPointRelativeToAnchors(
    altFlap.spec3d.paddleCenter,
    DEFAULT_ANCHORS,
    false
  );
  assert.deepEqual(baselinePoint.point, altFlap.spec3d.paddleCenter);

  // Calibrate right-side ASIS and Superolateral Patella laterally (-4 cm in X) and superiorly (+3 cm in Y)
  const asisDefault = DEFAULT_ANCHORS.find((a) => a.id === 'asis')!;
  const patellaDefault = DEFAULT_ANCHORS.find((a) => a.id === 'superolateral_patella')!;
  const calibrated = mergeAnchorsWithCalibration(DEFAULT_ANCHORS, {
    asis: {
      position: [
        asisDefault.position[0] - 0.04,
        asisDefault.position[1] + 0.03,
        asisDefault.position[2],
      ],
      snappedSkeletonMesh: 'Ilium.r',
      updatedAtIso: '2026-11-20T00:00:00.000Z',
      modelVersion: ANCHOR_MODEL_VERSION,
    },
    superolateral_patella: {
      position: [
        patellaDefault.position[0] - 0.04,
        patellaDefault.position[1] + 0.03,
        patellaDefault.position[2],
      ],
      snappedSkeletonMesh: 'Patella.r',
      updatedAtIso: '2026-11-20T00:00:00.000Z',
      modelVersion: ANCHOR_MODEL_VERSION,
    },
  });

  const resolvedDefault = resolveFlapOverlayRelativeToAnchors(altFlap, DEFAULT_ANCHORS, {
    useRealModelFrame: true,
  });
  const resolvedShifted = resolveFlapOverlayRelativeToAnchors(altFlap, calibrated, {
    useRealModelFrame: true,
  });

  assert.equal(resolvedShifted.calibratedAnchorCount, 2);
  assert.equal(resolvedShifted.paddleProvenance, 'schematic');
  assert.equal(resolvedShifted.perforatorsProvenance, 'schematic');
  assert.equal(resolvedShifted.pedicleProvenance, 'schematic');
  assert.ok(resolvedShifted.drivingAnchorLabels.length > 0);

  // Expanding ASIS & Patella laterally (-X on right, mirrored +X on left) must expand ALT paddle outward (|X| increases) and superiorly (+Y)
  assert.ok(
    Math.abs(resolvedShifted.paddleCenter[0]) - Math.abs(resolvedDefault.paddleCenter[0]) > 0.01,
    'ALT paddle radial X should expand outward following lateral ASIS/Patella calibration'
  );
  assert.ok(
    resolvedShifted.paddleCenter[1] - resolvedDefault.paddleCenter[1] > 0.007,
    'ALT paddle Y should follow calibrated ASIS/Patella shift'
  );
  assert.ok(
    resolvedShifted.perforatorPositions.length ===
      altFlap.vascular_anatomy.perforators.filter((p) => Boolean(p.position3d)).length
  );
  if (resolvedShifted.perforatorPositions.length > 0) {
    assert.ok(
      Math.abs(resolvedShifted.perforatorPositions[0][0]) -
        Math.abs(resolvedDefault.perforatorPositions[0][0]) >
        0.005,
      'ALT perforators should move relative to calibrated landmarks'
    );
  }

  // Clinical measurements must remain completely untouched
  assert.equal(JSON.stringify(altFlap.dimensions), originalDimensions);
  assert.equal(JSON.stringify(altFlap.vascular_anatomy.dominant_pedicle), originalPedicleLength);
});

test('Phase 8c: snapPathToSourceVessel snaps pedicle to real GLB vessel mesh when present and falls back to schematic when absent', () => {
  const altFlap = INITIAL_FLAPS.find((f) =>
    f.name.toLowerCase().includes('anterolateral thigh')
  )!;
  const basePath: Array<[number, number, number]> = [
    [0.11, 0.84, 0.04],
    [0.125, 0.72, 0.055],
    [0.145, 0.61, 0.068],
  ];

  // Absent vessels -> schematic fallback
  const noSnap = snapPathToSourceVessel(
    basePath,
    [],
    altFlap.vascular_anatomy.dominant_pedicle.artery
  );
  assert.equal(noSnap.snappedToSource, false);
  assert.equal(noSnap.matchedMeshName, null);
  assert.deepEqual(noSnap.points, basePath);

  // Matching source vessel within proximity -> snaps pedicle to source mesh
  const matchingCandidates: SourceVesselCandidate[] = [
    {
      meshName: 'Lateral circumflex femoral artery.r',
      system: 'arteries',
      anatomyId: 'lcfa',
      label: 'Lateral circumflex femoral artery',
      center: [0.138, 0.735, 0.064],
      boundsMin: [0.12, 0.68, 0.05],
      boundsMax: [0.15, 0.8, 0.075],
    },
  ];

  const snapped = snapPathToSourceVessel(
    basePath,
    matchingCandidates,
    altFlap.vascular_anatomy.dominant_pedicle.artery
  );
  assert.equal(snapped.snappedToSource, true);
  assert.equal(snapped.matchedMeshName, 'Lateral circumflex femoral artery.r');
  assert.ok(Math.abs(snapped.points[1][0] - 0.138) < 0.008);

  const resolvedWithVessel = resolveFlapOverlayRelativeToAnchors(altFlap, DEFAULT_ANCHORS, {
    useRealModelFrame: true,
    sourceVesselCandidates: [
      {
        meshName: 'Lateral circumflex femoral artery.r',
        system: 'arteries',
        anatomyId: 'lcfa',
        label: 'Lateral circumflex femoral artery',
        center: resolvedPedicleMid(altFlap),
        boundsMin: [0.05, 0.55, 0.01],
        boundsMax: [0.22, 0.9, 0.12],
      },
    ],
  });
  assert.equal(resolvedWithVessel.pedicleProvenance, 'source-vessel');
  assert.equal(resolvedWithVessel.snappedVesselMeshName, 'Lateral circumflex femoral artery.r');
});

function resolvedPedicleMid(flap: (typeof INITIAL_FLAPS)[number]): [number, number, number] {
  const res = resolveFlapOverlayRelativeToAnchors(flap, DEFAULT_ANCHORS, {
    useRealModelFrame: true,
  });
  return res.pediclePath[Math.floor(res.pediclePath.length / 2)];
}

test('Phase 8c: isLayerSchematic flags skin, vessels, and surgical overlays as Schematic under Z-Anatomy GLB pack', () => {
  const zAnatomySystems = ['skeleton', 'muscles', 'organs', 'nerves'] as const;
  const loaded = [...zAnatomySystems];

  // Real Z-Anatomy model systems -> NOT schematic
  assert.equal(isLayerSchematic('skeleton', loaded, true), false);
  assert.equal(isLayerSchematic('muscle', loaded, true), false);
  assert.equal(isLayerSchematic('organs', loaded, true), false);
  assert.equal(isLayerSchematic('nerves', loaded, true), false);
  assert.equal(isLayerSchematic('landmarks', loaded, true), false);

  // Missing in Z-Anatomy + clinical overlays -> MUST be flagged Schematic
  assert.equal(isLayerSchematic('skin', loaded, true), true);
  assert.equal(isLayerSchematic('arteries', loaded, true), true);
  assert.equal(isLayerSchematic('veins', loaded, true), true);
  assert.equal(isLayerSchematic('perforators', loaded, true), true);
  assert.equal(isLayerSchematic('perforasomes', loaded, true), true);
  assert.equal(isLayerSchematic('paddle', loaded, true), true);
  assert.equal(isLayerSchematic('cuttingGuides', loaded, true), true);

  // Procedural fallback mode -> all layers are schematic
  assert.equal(isLayerSchematic('skeleton', loaded, false), true);
  assert.equal(isLayerSchematic('muscle', loaded, false), true);
});
