import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateZPlasty } from './zplastyCalc';
import { calculatePedicleReach, calculatePerforatorHotspot } from './reachCalculator';

test('Z-plasty calculator reproduces canonical 30/45/60/75/90 degree theoretical gains', () => {
  assert.equal(calculateZPlasty(30, 4).theoreticalGainPercent, 25);
  assert.equal(calculateZPlasty(45, 4).theoreticalGainPercent, 50);
  const sixty = calculateZPlasty(60, 4);
  assert.equal(sixty.theoreticalGainPercent, 75);
  assert.equal(sixty.absoluteGainCm, 3);
  assert.equal(sixty.newLengthCm, 7);
  assert.equal(sixty.scarRotationDeg, 90);
  assert.equal(calculateZPlasty(75, 4).theoreticalGainPercent, 100);
  assert.equal(calculateZPlasty(90, 4).theoreticalGainPercent, 120);
});

test('Pedicle reach calculator evaluates Comfortable, Borderline, and Insufficient verdicts', () => {
  const ok = calculatePedicleReach({
    pivotToDefectEdgeCm: 6,
    defectLengthCm: 6,
    pedicleEffectiveLengthCm: 17,
    tunnelingOverheadCm: 2,
  });
  assert.equal(ok.verdict, 'Comfortable');
  assert.equal(ok.marginCm, 3);

  const tight = calculatePedicleReach({
    pivotToDefectEdgeCm: 6,
    defectLengthCm: 6,
    pedicleEffectiveLengthCm: 15,
    tunnelingOverheadCm: 2,
  });
  assert.equal(tight.verdict, 'Borderline');

  const short = calculatePedicleReach({
    pivotToDefectEdgeCm: 10,
    defectLengthCm: 8,
    pedicleEffectiveLengthCm: 14,
    tunnelingOverheadCm: 2,
  });
  assert.equal(short.verdict, 'Insufficient');
  assert.equal(short.marginCm, -6);
});

test('Perforator hotspot calculator computes ALT midpoint & SGAP medial-third accurately', () => {
  const alt = calculatePerforatorHotspot({ flapType: 'ALT', landmarkSpanCm: 44 });
  assert.match(alt.primaryHotspotCm, /22 cm from ASIS/);

  const sgap = calculatePerforatorHotspot({ flapType: 'SGAP', landmarkSpanCm: 24 });
  assert.match(sgap.primaryHotspotCm, /8 cm lateral to PSIS/);
});
