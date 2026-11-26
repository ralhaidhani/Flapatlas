import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FLAPS, REGIONS, VESSELS } from '../data/index';
import {
  ANGIOSOME_PERFORASOME_ATLAS,
  calculateBilobedFlap,
  calculateKeystoneFlap,
  calculateRhomboidFlap,
  calculateSerialZPlasty,
} from './localFlapCalc';
import { calculatePedicleReach, calculatePerforatorHotspot, FLAP_REACH_PRESETS } from './reachCalculator';

test('Serial Z-plasty preserves lengthening gain while reducing transverse tension proportionally', () => {
  const single = calculateSerialZPlasty(60, 6.0, 1);
  const triple = calculateSerialZPlasty(60, 6.0, 3);

  assert.equal(single.theoreticalGainPercent, 75);
  assert.equal(triple.theoreticalGainPercent, 75);
  assert.equal(triple.newTotalLengthCm, single.newTotalLengthCm);
  assert.equal(triple.unitLimbLengthCm, 2.0);
  assert.ok(triple.transverseTensionReductionFactor < 0.4);
});

test('Rhomboid Limberg vs Dufourmentel calculations compute exact 60/120 geometry', () => {
  const limberg = calculateRhomboidFlap(4.0, 'limberg');
  assert.equal(limberg.shortDiagonalCm, 4.0);
  assert.equal(limberg.backCutAngleDeg, 60);
  assert.ok(Math.abs(limberg.defectAreaCm2 - 13.86) < 0.1);

  const duf = calculateRhomboidFlap(4.0, 'dufourmentel');
  assert.equal(duf.backCutAngleDeg, 30);
  assert.equal(duf.defectAreaCm2, limberg.defectAreaCm2);
});

test('Bilobed Zitelli 90° calculator flags nasal suitability thresholds accurately', () => {
  const ideal = calculateBilobedFlap(1.2);
  assert.equal(ideal.primaryLobeDiameterCm, 1.2);
  assert.equal(ideal.secondaryLobeDiameterCm, 0.96);
  assert.equal(ideal.totalRotationArcDeg, 90);
  assert.match(ideal.nasalSuitability, /Ideal/);

  const large = calculateBilobedFlap(2.4);
  assert.match(large.nasalSuitability, /Too Large/);
});

test('Keystone Behan Types I-IV compute 1:1 flap width and subtype flags', () => {
  const typeI = calculateKeystoneFlap(3.5, 7.0, 'I');
  assert.equal(typeI.flapWidthCm, 3.5);
  assert.equal(typeI.fascialDivisionRequired, false);
  assert.equal(typeI.secondaryStsgLikely, false);

  const typeIIB = calculateKeystoneFlap(5.0, 10.0, 'IIB');
  assert.equal(typeIIB.fascialDivisionRequired, true);
  assert.equal(typeIIB.secondaryStsgLikely, true);
});

test('All 14 Angiosome & Perforasome Atlas entries link to valid flaps, vessels, and camera presets', () => {
  assert.ok(ANGIOSOME_PERFORASOME_ATLAS.length >= 14);
  const flapIds = new Set(INITIAL_FLAPS.map((f) => f.id));
  const vesselIds = new Set(VESSELS.map((v) => v.id));
  const regionIds = new Set(REGIONS.map((r) => r.id));

  for (const entry of ANGIOSOME_PERFORASOME_ATLAS) {
    assert.ok(entry.linkedFlapIds.length >= 1, `${entry.id} has no linked flaps`);
    for (const fid of entry.linkedFlapIds) {
      assert.ok(flapIds.has(fid), `${entry.id} links to unknown flap "${fid}"`);
    }
    if (entry.linkedVesselId) {
      assert.ok(vesselIds.has(entry.linkedVesselId), `${entry.id} links to unknown vessel "${entry.linkedVesselId}"`);
    }
    assert.ok(regionIds.has(entry.cameraPreset), `${entry.id} uses invalid cameraPreset "${entry.cameraPreset}"`);
  }
});

test('Expanded Reach Presets and TDAP/FIBULA Perforator Hotspots resolve to real flaps', () => {
  const flapIds = new Set(INITIAL_FLAPS.map((f) => f.id));
  assert.ok(FLAP_REACH_PRESETS.length >= 7);

  for (const p of FLAP_REACH_PRESETS) {
    assert.ok(flapIds.has(p.flapId), `Reach preset ${p.id} references unknown flap "${p.flapId}"`);
    const r = calculatePedicleReach(p);
    assert.ok(['Comfortable', 'Borderline', 'Insufficient'].includes(r.verdict));
  }

  const tdap = calculatePerforatorHotspot({ flapType: 'TDAP', landmarkSpanCm: 36 });
  assert.equal(tdap.flapId, 'tdap-flap');
  assert.match(tdap.primaryHotspotCm, /8–10 cm/);

  const fib = calculatePerforatorHotspot({ flapType: 'FIBULA', landmarkSpanCm: 40 });
  assert.equal(fib.flapId, 'fibula-flap');
  assert.match(fib.primaryHotspotCm, /24 cm/);
});
