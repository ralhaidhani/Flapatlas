import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FLAPS } from '../data/index';
import { getCalibratedPaddleSummary, resolveAnatomyDetailCard } from './flapMetrics';

test('getCalibratedPaddleSummary calculates elliptical area cleanly and respects null values', () => {
  const diep = INITIAL_FLAPS.find((f) => f.id === 'diep-flap')!;
  const metric = getCalibratedPaddleSummary(diep, 'metric');
  assert.match(metric.dimensionsText, /cm ×/);
  assert.match(metric.areaText, /cm²/);

  const imperial = getCalibratedPaddleSummary(diep, 'imperial');
  assert.match(imperial.dimensionsText, /in ×/);
  assert.match(imperial.areaText, /in²/);

  // Null skin paddle must never fabricate numbers
  const nullPaddleFlap = {
    ...diep,
    dimensions: {
      ...diep.dimensions,
      max_skin_paddle_cm: { length: null, width: null },
    },
  };
  const nullSummary = getCalibratedPaddleSummary(nullPaddleFlap, 'metric');
  assert.equal(nullSummary.dimensionsText, 'Not specified — verify in source');
  assert.equal(nullSummary.isVerify, true);
});

test('resolveAnatomyDetailCard resolves vessels, companion veins, muscles, and bones', () => {
  const diea = resolveAnatomyDetailCard('v-diea', 'DIEA', 'Artery', 'metric');
  assert.match(diea.name, /Deep Inferior Epigastric/i);
  assert.ok(diea.suppliedFlapIds.includes('diep-flap'));

  const dieaVein = resolveAnatomyDetailCard('v-diea_vein', 'DIEA Vein', 'Vein', 'metric');
  assert.equal(dieaVein.category, 'Vein');
  assert.match(dieaVein.name, /Venae Comitantes/);

  const pec = resolveAnatomyDetailCard('muscle_pec_major_r', 'Right Pectoralis Major', 'Muscle', 'metric');
  assert.equal(pec.category, 'Muscle');
  assert.ok(pec.suppliedFlapIds.includes('pec-major-flap'));
  assert.match(pec.clinicalRelevance, /Mathes–Nahai Type V/);

  const fibula = resolveAnatomyDetailCard('bone_fibula_l', 'Left Fibula', 'Skeleton', 'metric');
  assert.ok(fibula.suppliedFlapIds.includes('fibula-flap'));
});
