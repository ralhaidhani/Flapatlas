import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FLAPS } from '../data/index';
import { buildTechniqueStages } from './techniqueStages';
import {
  buildRelativeMetricBars,
  COMPARE_PRESETS,
  computeSharedScalePaddles,
  rowHasDifferences,
} from './compareMetrics';

test('buildTechniqueStages returns canonical 7 stages grounded in flap anatomy', () => {
  const alt = INITIAL_FLAPS.find((f) => f.id === 'alt-flap')!;
  const stages = buildTechniqueStages(alt, 'metric');
  assert.equal(stages.length, 7);
  assert.equal(stages[0].stepNumber, 1);
  assert.equal(stages[6].stepNumber, 7);
  assert.match(stages[2].title, /Perforator/i);
  assert.ok(stages.every((s) => s.description.length > 15 && s.anatomicalWarning.length > 10));

  // Pedicled muscle flap should recommend arc animation at stage 5
  const gastroc = INITIAL_FLAPS.find((f) => f.id === 'gastrocnemius-flap')!;
  const gastrocStages = buildTechniqueStages(gastroc, 'metric');
  assert.equal(gastrocStages[4].recommendedAnimation, 'arc');

  // Pure free flap (DIEP) should recommend transfer animation at stage 5
  const diep = INITIAL_FLAPS.find((f) => f.id === 'diep-flap')!;
  const diepStages = buildTechniqueStages(diep, 'metric');
  assert.equal(diepStages[4].recommendedAnimation, 'transfer');
});

test('computeSharedScalePaddles preserves uniform relative scale without fabricating null paddles', () => {
  const diep = INITIAL_FLAPS.find((f) => f.id === 'diep-flap')!;
  const rfff = INITIAL_FLAPS.find((f) => f.id === 'rfff-flap')!;
  const paddles = computeSharedScalePaddles([diep, rfff]);
  assert.equal(paddles.length, 2);
  // DIEP max length (45 cm) is significantly larger than RFFF max length
  assert.ok(paddles[0].rx > paddles[1].rx);

  const nullFlap = {
    ...diep,
    id: 'null-paddle-test',
    dimensions: { ...diep.dimensions, max_skin_paddle_cm: { length: null, width: null } },
  };
  const withNull = computeSharedScalePaddles([diep, nullFlap]);
  assert.equal(withNull[1].hasDimensions, false);
  assert.equal(withNull[1].rx, 0);
});

test('buildRelativeMetricBars, rowHasDifferences, and COMPARE_PRESETS are valid', () => {
  const alt = INITIAL_FLAPS.find((f) => f.id === 'alt-flap')!;
  const diep = INITIAL_FLAPS.find((f) => f.id === 'diep-flap')!;
  const bars = buildRelativeMetricBars(
    [alt, diep],
    (f) => f.vascular_anatomy.dominant_pedicle.pedicle_length_cm
  );
  assert.equal(bars.length, 2);
  assert.ok(bars.every((b) => b.percentOfMax > 0 && b.percentOfMax <= 100));

  assert.equal(rowHasDifferences(['Free', 'Free']), false);
  assert.equal(rowHasDifferences(['Free', 'Pedicled']), true);

  for (const preset of COMPARE_PRESETS) {
    assert.ok(preset.flapIds.length >= 2);
    for (const id of preset.flapIds) {
      assert.ok(
        INITIAL_FLAPS.some((f) => f.id === id),
        `Preset ${preset.id} references missing flap ${id}`
      );
    }
  }
});
