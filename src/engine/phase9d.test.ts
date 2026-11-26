import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_FLAPS } from '../data/index';
import {
  computeFlapVesselUnionCamera,
  DEFAULT_DONOR_SIDE,
  FLAP_PEDICLE_MAP,
  getExpectedFjSpecsForMapKey,
  getFlapVesselRoleStyle,
  inferRealVesselMapKey,
  REAL_VESSEL_TAG_TEXT,
  resolveFlapRealVessels,
  SCHEMATIC_OVERLAY_TAG_TEXT,
} from '../models/flapVesselLinker';
import type { MergedSubMeshRecord } from '../models/glbLoader';

function makeBp3dSubMesh(
  fjCode: string,
  name: string,
  side: 'left' | 'right' | 'midline',
  system: 'arteries' | 'veins',
  center: [number, number, number]
): MergedSubMeshRecord {
  return {
    meshKey: `${system}:${system === 'arteries' ? 'artery' : 'vein'}:${fjCode}`,
    subMeshIndex: 0,
    meshName: `${name} [${fjCode}]`,
    system,
    materialBucket: system === 'arteries' ? 'artery' : 'vein',
    anatomyId: `bp3d_${fjCode.toLowerCase()}`,
    label: name,
    category: system === 'arteries' ? 'Artery' : 'Vein',
    laterality: side,
    mapped: true,
    linkedFlapIds: [],
    sourceModel: 'bodyparts3d',
    fjCode,
    fmaCode: 'FMA00000',
    vertexStart: 0,
    vertexCount: 12,
    indexStart: 0,
    indexCount: 18,
    center,
    boundsMin: [center[0] - 0.02, center[1] - 0.06, center[2] - 0.02],
    boundsMax: [center[0] + 0.02, center[1] + 0.06, center[2] + 0.02],
  };
}

test('Phase 9d: flapPedicleMap.json preserves exact 18 mapped flaps & 9 not_in_dataset entries', () => {
  assert.equal(Object.keys(FLAP_PEDICLE_MAP.flaps).length, 18);
  assert.equal(Object.keys(FLAP_PEDICLE_MAP.not_in_dataset).length, 9);
  assert.equal(DEFAULT_DONOR_SIDE, 'right');
  assert.equal(REAL_VESSEL_TAG_TEXT, 'Real mesh — BodyParts3D reference model');
  assert.equal(SCHEMATIC_OVERLAY_TAG_TEXT, 'Schematic — not from source model');
});

test('Phase 9d: INITIAL_FLAPS assigns real_vessel_map_key without altering clinical measurements or verification status', () => {
  const coreARaw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src/data/flaps_core_a.json'), 'utf8')
  ) as Array<Record<string, unknown>>;

  const alt = INITIAL_FLAPS.find((f) => f.id === 'alt-flap');
  const diep = INITIAL_FLAPS.find((f) => f.id === 'diep-flap');
  const sgap = INITIAL_FLAPS.find((f) => f.id === 'sgap-flap');
  const fibula = INITIAL_FLAPS.find((f) => f.id === 'fibula-flap');
  const deltopectoral = INITIAL_FLAPS.find((f) => f.id === 'deltopectoral-flap');
  const mfc = INITIAL_FLAPS.find((f) => f.id === 'mfc-flap');

  assert.equal(alt?.real_vessel_map_key, 'ALT (anterolateral thigh)');
  assert.equal(diep?.real_vessel_map_key, 'DIEP / free TRAM');
  assert.equal(sgap?.real_vessel_map_key, 'SGAP / IGAP');
  assert.equal(fibula?.real_vessel_map_key, 'Fibula free flap / peroneal perforator');
  assert.equal(deltopectoral?.real_vessel_map_key, 'Internal mammary perforator (IMAP)');
  assert.equal(mfc?.real_vessel_map_key, 'Genicular / popliteal region');

  // Verify zero mutation of clinical measurements or verification_status against raw JSON
  for (const raw of coreARaw) {
    const parsed = INITIAL_FLAPS.find((f) => f.id === raw.id);
    assert.ok(parsed, `Expected ${String(raw.id)} in INITIAL_FLAPS`);
    assert.deepEqual(parsed.vascular_anatomy, raw.vascular_anatomy);
    assert.deepEqual(parsed.dimensions, raw.dimensions);
    assert.equal(parsed.verification_status, raw.verification_status);
  }
});

test('Phase 9d: Left/Right donor switch resolves opposite-side FJ codes and keeps midline entries on both sides', () => {
  const altRight = getExpectedFjSpecsForMapKey('ALT (anterolateral thigh)', 'right');
  const altLeft = getExpectedFjSpecsForMapKey('ALT (anterolateral thigh)', 'left');

  assert.deepEqual(
    altRight.map((s) => s.fjCode),
    ['FJ2143', 'FJ2057', 'FJ2158', 'FJ2201']
  );
  assert.deepEqual(
    altLeft.map((s) => s.fjCode),
    ['FJ2074', 'FJ2063', 'FJ2078', 'FJ2188']
  );
  // Zero overlap between left and right lateralized ALT codes
  for (const r of altRight) {
    assert.ok(!altLeft.some((l) => l.fjCode === r.fjCode));
  }

  // Midline vein FJ1993 in IMAP must appear on BOTH Right and Left donor sides
  const imapRight = getExpectedFjSpecsForMapKey('Internal mammary perforator (IMAP)', 'right');
  const imapLeft = getExpectedFjSpecsForMapKey('Internal mammary perforator (IMAP)', 'left');
  assert.deepEqual(
    imapRight.map((s) => s.fjCode),
    ['FJ1937', 'FJ1993']
  );
  assert.deepEqual(
    imapLeft.map((s) => s.fjCode),
    ['FJ1972', 'FJ1993']
  );
});

test('Phase 9d: resolves ALT meshes by extras.fj, computes union bbox/camera, and hides procedural pedicle only when pedicle resolves', () => {
  const alt = INITIAL_FLAPS.find((f) => f.id === 'alt-flap')!;
  const loaded: MergedSubMeshRecord[] = [
    makeBp3dSubMesh('FJ2143', 'right femoral artery', 'right', 'arteries', [-0.11, 0.78, 0.04]),
    makeBp3dSubMesh('FJ2057', 'right descending branch of lateral circumflex femoral artery', 'right', 'arteries', [-0.14, 0.71, 0.05]),
    makeBp3dSubMesh('FJ2158', 'right lateral circumflex femoral artery', 'right', 'arteries', [-0.13, 0.76, 0.04]),
    makeBp3dSubMesh('FJ2201', 'right lateral circumflex femoral vein', 'right', 'veins', [-0.135, 0.74, 0.045]),
    makeBp3dSubMesh('FJ2074', 'left femoral artery', 'left', 'arteries', [0.11, 0.78, 0.04]),
    makeBp3dSubMesh('FJ2063', 'left descending branch of lateral circumflex femoral artery', 'left', 'arteries', [0.14, 0.71, 0.05]),
    makeBp3dSubMesh('FJ2078', 'left lateral circumflex femoral artery', 'left', 'arteries', [0.13, 0.76, 0.04]),
    makeBp3dSubMesh('FJ2188', 'left lateral circumflex femoral vein', 'left', 'veins', [0.135, 0.74, 0.045]),
  ];

  const rightRes = resolveFlapRealVessels(alt, 'right', loaded);
  assert.equal(rightRes.status, 'resolved');
  assert.equal(rightRes.resolvedVessels.length, 4);
  assert.equal(rightRes.hasResolvedPedicleArtery, true);
  assert.equal(rightRes.hasResolvedVein, true);
  assert.equal(rightRes.hasResolvedSource, true);
  assert.ok(rightRes.unionBounds);
  assert.ok(rightRes.unionBounds.center[0] < 0, 'Right donor union center should be on -X side');

  const leftRes = resolveFlapRealVessels(alt, 'left', loaded);
  assert.equal(leftRes.status, 'resolved');
  assert.deepEqual(
    leftRes.resolvedVessels.map((v) => v.fjCode),
    ['FJ2074', 'FJ2063', 'FJ2078', 'FJ2188']
  );
  assert.ok(leftRes.unionBounds && leftRes.unionBounds.center[0] > 0, 'Left donor union center should be on +X side');

  const camRight = computeFlapVesselUnionCamera(rightRes.unionBounds!, 'right');
  const camLeft = computeFlapVesselUnionCamera(leftRes.unionBounds!, 'left');
  assert.ok(camRight.target[0] < 0);
  assert.ok(camLeft.target[0] > 0);

  // Selective procedural hiding: if ONLY source + vein exist (no pedicle), hasResolvedPedicleArtery must be false
  const partialOnlySourceAndVein = loaded.filter((m) => m.fjCode === 'FJ2143' || m.fjCode === 'FJ2201');
  const partialRes = resolveFlapRealVessels(alt, 'right', partialOnlySourceAndVein);
  assert.equal(partialRes.status, 'partial');
  assert.equal(partialRes.hasResolvedPedicleArtery, false);
  assert.equal(partialRes.hasResolvedSource, true);
  assert.equal(partialRes.hasResolvedVein, true);
});

test('Phase 9d: not_in_dataset flaps emit exact schematic-only notice and never hide procedural vessel', () => {
  const sgap = INITIAL_FLAPS.find((f) => f.id === 'sgap-flap')!;
  const fibula = INITIAL_FLAPS.find((f) => f.id === 'fibula-flap')!;
  const loaded = [
    makeBp3dSubMesh('FJ2143', 'right femoral artery', 'right', 'arteries', [-0.11, 0.78, 0.04]),
  ];

  const sgapRes = resolveFlapRealVessels(sgap, 'right', loaded);
  assert.equal(sgapRes.status, 'not_in_dataset');
  assert.equal(sgapRes.hasResolvedPedicleArtery, false);
  assert.equal(
    sgapRes.notInDatasetNotice,
    'No reference mesh for: superior gluteal artery, inferior gluteal artery — schematic only'
  );

  const fibRes = resolveFlapRealVessels(fibula, 'left', loaded);
  assert.equal(fibRes.status, 'not_in_dataset');
  assert.equal(fibRes.hasResolvedPedicleArtery, false);
  assert.equal(
    fibRes.notInDatasetNotice,
    'No reference mesh for: peroneal (fibular) artery — schematic only'
  );

  // Also test dynamic synonym matching for Dorsalis Pedis custom flap
  assert.equal(
    inferRealVesselMapKey({
      name: 'Dorsalis Pedis Flap',
      synonyms: ['Dorsalis pedis free flap'],
    }),
    'Dorsalis pedis flap'
  );
});

test('Phase 9d: vessel role highlight styles enforce pedicle pulse+outline, vein blue, source medium red', () => {
  const ped = getFlapVesselRoleStyle('pedicle', false);
  const vein = getFlapVesselRoleStyle('vein', false);
  const src = getFlapVesselRoleStyle('source', false);

  assert.equal(ped.pulse, true);
  assert.notEqual(ped.outlineColorHex, null);
  assert.equal(vein.pulse, false);
  assert.equal(vein.colorHex, 0x2563eb);
  assert.equal(src.pulse, false);
  assert.equal(src.outlineColorHex, null);
  assert.equal(src.colorHex, 0xc8323c);
});
