import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FLAPS, DEFECT_LOCATIONS, DEFECT_PRESETS, REGIONS } from '../data/index';
import {
  cameraPresetForDefect,
  computeDefectAreaCm2,
  findNearestDefectLocation,
  runFlapAdvisor,
} from './advisorEngine';

test('Distal third tibia Gustilo IIIB ranks ALT/Gracilis/MSAP above Gastrocnemius', () => {
  const preset = DEFECT_PRESETS.find((p) => p.id === 'preset-distal-tibia');
  assert.ok(preset, 'Distal tibia preset must exist');
  const res = runFlapAdvisor(preset.input, INITIAL_FLAPS, DEFECT_LOCATIONS);
  assert.equal(res.recommendations.length, 5);
  const topIds = res.recommendations.map((r) => r.flap.id);
  assert.ok(
    topIds.includes('alt-flap') || topIds.includes('gracilis-flap') || topIds.includes('msap-flap'),
    `Expected free workhorse flaps in top 5, got: ${topIds.join(', ')}`
  );
  assert.ok(
    !topIds.slice(0, 3).includes('gastrocnemius-flap'),
    'Gastrocnemius must NOT rank in top 3 for distal third tibia'
  );
});

test('Autologous breast reconstruction ranks DIEP #1', () => {
  const preset = DEFECT_PRESETS.find((p) => p.id === 'preset-breast-autologous');
  assert.ok(preset);
  const res = runFlapAdvisor(preset.input, INITIAL_FLAPS, DEFECT_LOCATIONS);
  assert.equal(
    res.recommendations[0].flap.id,
    'diep-flap',
    `Expected DIEP #1, got ${res.recommendations[0].flap.id}`
  );
});

test('Segmental mandibular composite defect ranks Fibula Osteocutaneous #1', () => {
  const preset = DEFECT_PRESETS.find((p) => p.id === 'preset-mandible-composite');
  assert.ok(preset);
  const res = runFlapAdvisor(preset.input, INITIAL_FLAPS, DEFECT_LOCATIONS);
  assert.equal(
    res.recommendations[0].flap.id,
    'fibula-flap',
    `Expected Fibula #1, got ${res.recommendations[0].flap.id}`
  );
  // Long bone gap (>14 cm) adds explicit Bone Span boost to Fibula
  const longBoneRes = runFlapAdvisor(
    { ...preset.input, boneLengthCm: 18 },
    INITIAL_FLAPS,
    DEFECT_LOCATIONS
  );
  assert.equal(longBoneRes.recommendations[0].flap.id, 'fibula-flap');
  assert.ok(
    longBoneRes.recommendations[0].scoreBreakdown.some((b) => b.category === 'Bone Span'),
    'Expected transparent Bone Span rule entry for 18 cm osseous defect'
  );
});

test('Proximal third tibia / knee defect with local preference ranks Gastrocnemius #1', () => {
  const preset = DEFECT_PRESETS.find((p) => p.id === 'preset-proximal-tibia');
  assert.ok(preset);
  const res = runFlapAdvisor(preset.input, INITIAL_FLAPS, DEFECT_LOCATIONS);
  assert.equal(
    res.recommendations[0].flap.id,
    'gastrocnemius-flap',
    `Expected Gastrocnemius #1, got ${res.recommendations[0].flap.id}`
  );
});

test('Major nasal subunit reconstruction ranks Paramedian Forehead Flap #1', () => {
  const preset = DEFECT_PRESETS.find((p) => p.id === 'preset-nasal-subunit');
  assert.ok(preset);
  const res = runFlapAdvisor(preset.input, INITIAL_FLAPS, DEFECT_LOCATIONS);
  assert.equal(
    res.recommendations[0].flap.id,
    'paramedian-forehead-flap',
    `Expected Paramedian Forehead Flap #1, got ${res.recommendations[0].flap.id}`
  );
});

test('Phase 4 presets: Middle tibia ranks Soleus #1 and Plantar Heel ranks Medial Plantar #1', () => {
  const midTibia = DEFECT_PRESETS.find((p) => p.id === 'preset-middle-tibia');
  assert.ok(midTibia, 'Middle tibia preset must exist');
  const midRes = runFlapAdvisor(midTibia.input, INITIAL_FLAPS, DEFECT_LOCATIONS);
  assert.equal(midRes.recommendations[0].flap.id, 'soleus-flap');

  const plantar = DEFECT_PRESETS.find((p) => p.id === 'preset-plantar-heel');
  assert.ok(plantar, 'Plantar heel preset must exist');
  const heelRes = runFlapAdvisor(plantar.input, INITIAL_FLAPS, DEFECT_LOCATIONS);
  assert.equal(heelRes.recommendations[0].flap.id, 'medial-plantar-flap');
});

test('Phase 4 presets: Scalp & Abdominal wall return transparent breakdown, area, and donor morbidity', () => {
  assert.ok(DEFECT_PRESETS.length >= 12, `Expected >=12 presets, got ${DEFECT_PRESETS.length}`);
  const scalp = DEFECT_PRESETS.find((p) => p.id === 'preset-scalp-calvarium');
  const abdom = DEFECT_PRESETS.find((p) => p.id === 'preset-abdominal-wall');
  assert.ok(scalp && abdom);

  const scalpRes = runFlapAdvisor(scalp.input, INITIAL_FLAPS, DEFECT_LOCATIONS);
  assert.ok(
    ['alt-flap', 'ld-flap', 'tpff-flap'].includes(scalpRes.recommendations[0].flap.id),
    `Expected ALT/LD/TPFF for scalp, got ${scalpRes.recommendations[0].flap.id}`
  );
  assert.ok(scalpRes.recommendations[0].scoreBreakdown.length >= 3);
  assert.ok(scalpRes.recommendations[0].donorMorbiditySummary.length > 5);

  const abdomRes = runFlapAdvisor(abdom.input, INITIAL_FLAPS, DEFECT_LOCATIONS);
  assert.equal(abdomRes.recommendations[0].flap.id, 'alt-flap');
  assert.equal(abdomRes.defectAreaRectCm2, 150);
  assert.ok(abdomRes.defectAreaEllipseCm2 > 115 && abdomRes.defectAreaEllipseCm2 < 120);
});

test('computeDefectAreaCm2, findNearestDefectLocation, and cameraPresetForDefect work deterministically', () => {
  const area = computeDefectAreaCm2(10, 8);
  assert.equal(area.rectangular, 80);
  assert.equal(area.elliptical, 62.8);

  const nearScalp = findNearestDefectLocation([0, 1.75, 0.02], DEFECT_LOCATIONS);
  assert.equal(nearScalp?.id, 'scalp');

  const nearHeel = findNearestDefectLocation([-0.11, 0.03, 0.01], DEFECT_LOCATIONS);
  assert.equal(nearHeel?.id, 'foot-plantar');

  assert.equal(cameraPresetForDefect('sacrum-ischium'), 'back');
  assert.equal(cameraPresetForDefect('foot-plantar'), 'foot');
  assert.equal(cameraPresetForDefect('mandible'), 'head-neck');

  const validRegionIds = new Set(REGIONS.map((r) => r.id));
  for (const loc of DEFECT_LOCATIONS) {
    const presetId = cameraPresetForDefect(loc.id);
    assert.ok(
      validRegionIds.has(presetId),
      `Defect location ${loc.id} mapped to unknown camera preset ${presetId}`
    );
  }
});
