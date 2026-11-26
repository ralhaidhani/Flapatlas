import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ANCHORS } from '../models/anchorSystem';
import {
  buildSchematicMuscleOutline,
  SCHEMATIC_MUSCLE_BADGE,
} from '../models/bp3dCoverage';
import {
  BONE_GENERAL_SUPPLY_NOTE,
  BONE_NO_INVENTED_BORDERS_NOTE,
  formatMuscleTerritoryCountBadge,
  getBoneEducationalCards,
  getDeepTissueMuscleCatalog,
  getNeurovascularEducationalData,
  NERVE_NO_GEOMETRY_NOTICE,
  REQUIRED_ABSENT_BP3D_MUSCLE_IDS,
  resolveBoneDeepTissueInfo,
  resolveMuscleDeepTissueInfo,
} from '../models/deepTissueTerritories';
import type { TerritoryCalibrationReport } from '../models/territoryCalibration';
import { useAtlasStore } from '../store/useAtlasStore';

test('Phase 11d: Leg Table 23.2 book counts match acceptance criteria (3 territories vs 1 territory)', () => {
  const threeTerritoryMuscles = [
    'gastrocnemius',
    'soleus',
    'popliteus',
    'tibialis posterior',
  ];
  for (const name of threeTerritoryMuscles) {
    const info = resolveMuscleDeepTissueInfo(name);
    assert.ok(info, `Expected muscle record for ${name}`);
    assert.equal(info.territoryCount, 3, `${name} must have book count 3`);
    assert.equal(info.territoryCountBadge, 'Three territories');
    assert.equal(info.bp3dPresent, true);
    assert.equal(info.schematicTag, null);
  }

  const oneTerritoryMuscles = [
    'tibialis anterior',
    'extensor digitorum longus',
    'extensor hallucis longus',
    'peroneus tertius',
  ];
  for (const name of oneTerritoryMuscles) {
    const info = resolveMuscleDeepTissueInfo(name);
    assert.ok(info, `Expected muscle record for ${name}`);
    assert.equal(info.territoryCount, 1, `${name} must have book count 1`);
    assert.equal(info.territoryCountBadge, 'One territory');
    assert.equal(info.bp3dPresent, true);
  }

  const twoTerritoryMuscles = [
    'peroneus longus',
    'peroneus brevis',
    'flexor digitorum longus',
    'flexor hallucis longus',
  ];
  for (const name of twoTerritoryMuscles) {
    const info = resolveMuscleDeepTissueInfo(name);
    assert.ok(info, `Expected muscle record for ${name}`);
    assert.equal(info.territoryCount, 2, `${name} must have book count 2`);
    assert.equal(info.territoryCountBadge, 'Two territories');
  }
});

test('Phase 11d: Composite BP3D labels resolve cleanly and Table 23.1 Neurovascular Types I-IV attach', () => {
  const gastrocHead = resolveMuscleDeepTissueInfo('Medial head of right gastrocnemius [FJ1234]');
  assert.ok(gastrocHead);
  assert.equal(gastrocHead.territoryCount, 3);
  assert.equal(gastrocHead.neurovascularType, 'Type III');

  const ld = resolveMuscleDeepTissueInfo('Latissimus dorsi');
  assert.ok(ld);
  assert.equal(ld.neurovascularType, 'Type I');

  const vl = resolveMuscleDeepTissueInfo('Vastus lateralis');
  assert.ok(vl);
  assert.equal(vl.neurovascularType, 'Type II');

  const rectus = resolveMuscleDeepTissueInfo('Rectus abdominis');
  assert.ok(rectus);
  assert.equal(rectus.neurovascularType, 'Type IV');
  assert.equal(rectus.venousType, 'Type II');

  assert.equal(formatMuscleTerritoryCountBadge(4, 5), 'Four (or five) territories');
  assert.equal(formatMuscleTerritoryCountBadge(undefined), null);
});

test('Phase 11d: All 7 absent BP3D muscles resolve with schematic tag and valid bony-landmark outlines', () => {
  const catalog = getDeepTissueMuscleCatalog();
  const anchorMap: Record<string, [number, number, number]> = {};
  for (const a of DEFAULT_ANCHORS) {
    anchorMap[a.id] = a.position;
  }

  assert.equal(REQUIRED_ABSENT_BP3D_MUSCLE_IDS.length, 7);

  for (const outlineId of REQUIRED_ABSENT_BP3D_MUSCLE_IDS) {
    const entry = catalog.absentBp3d.find((m) => m.schematicOutlineId === outlineId);
    assert.ok(entry, `Absent BP3D muscle catalog must include ${outlineId}`);
    assert.equal(entry.bp3dPresent, false);
    assert.equal(entry.schematicTag, SCHEMATIC_MUSCLE_BADGE);

    const rightOutline = buildSchematicMuscleOutline(outlineId, 'right', anchorMap);
    const leftOutline = buildSchematicMuscleOutline(outlineId, 'left', anchorMap);
    assert.ok(rightOutline, `Expected right-side schematic outline for ${outlineId}`);
    assert.ok(leftOutline, `Expected left-side schematic outline for ${outlineId}`);
    assert.ok(rightOutline.anchorPoints.length >= 1, `${outlineId} must anchor to bony landmarks`);
    assert.ok(
      Math.sign(rightOutline.center[0]) !== Math.sign(leftOutline.center[0]),
      `${outlineId} schematic outline must mirror cleanly across midline`
    );
  }

  // Masseter & temporalis carry Table 23.3 count ("Two territories"), not derived from geometry
  const masseter = resolveMuscleDeepTissueInfo('masseter');
  const temporalis = resolveMuscleDeepTissueInfo('temporalis');
  assert.equal(masseter?.territoryCount, 2);
  assert.equal(masseter?.territoryCountBadge, 'Two territories');
  assert.equal(temporalis?.territoryCount, 2);
  assert.equal(temporalis?.territoryCountBadge, 'Two territories');
});

test('Phase 11d: Calibration mismatches are surfaced transparently on resolved muscle entries', () => {
  const mockReport: TerritoryCalibrationReport = {
    checkedAtIso: '2026-11-24T00:00:00.000Z',
    totalTableMuscles: 2,
    checkedInBp3dCount: 2,
    absentInBp3dCount: 0,
    matchedCount: 1,
    warningCount: 1,
    entries: [
      {
        muscleId: 'muscle-gastrocnemius',
        muscleName: 'Gastrocnemius',
        normalizedName: 'gastrocnemius',
        sourceTable: 'Table 23.2 (Leg)',
        expectedCount: 3,
        computedCount: 2,
        intersectedTerritoryIds: ['angio-23', 'angio-30'],
        intersectedTerritoryLabels: ['23. Sural', '30. Posterior tibial'],
        matchedSubMeshCount: 2,
        sampledPointCount: 64,
        status: 'warning',
        warningMessage:
          'Territory calibration warning: Gastrocnemius intersects 2 computed territories vs 3 in Table 23.2 (Leg) (Morris & Taylor Ch. 23).',
      },
      {
        muscleId: 'muscle-tibialis-anterior',
        muscleName: 'Tibialis anterior',
        normalizedName: 'tibialis anterior',
        sourceTable: 'Table 23.2 (Leg)',
        expectedCount: 1,
        computedCount: 1,
        intersectedTerritoryIds: ['angio-26'],
        intersectedTerritoryLabels: ['26. Anterior tibial'],
        matchedSubMeshCount: 1,
        sampledPointCount: 64,
        status: 'match',
      },
    ],
    warnings: [],
  };
  mockReport.warnings = mockReport.entries.filter((e) => e.status === 'warning');

  const gastroc = resolveMuscleDeepTissueInfo('gastrocnemius', mockReport);
  assert.equal(gastroc?.territoryCountBadge, 'Three territories'); // Book count never overwritten
  assert.equal(gastroc?.calibrationEntry?.status, 'warning');
  assert.match(gastroc?.calibrationEntry?.warningMessage || '', /calibration warning/i);

  const tibAnt = resolveMuscleDeepTissueInfo('tibialis anterior', mockReport);
  assert.equal(tibAnt?.territoryCountBadge, 'One territory');
  assert.equal(tibAnt?.calibrationEntry?.status, 'match');
});

test('Phase 11d: Bone cards cover Radius/Ulna and Tibia/Fibula without inventing osseous boundaries', () => {
  const cards = getBoneEducationalCards();
  assert.equal(cards.length, 2);

  const radiusCard = resolveBoneDeepTissueInfo('Right radius');
  assert.equal(radiusCard.generalSupplyNote, BONE_GENERAL_SUPPLY_NOTE);
  assert.equal(radiusCard.noInventedBordersNote, BONE_NO_INVENTED_BORDERS_NOTE);
  assert.equal(radiusCard.specificCard?.id, 'bone-radius-ulna');
  assert.match(radiusCard.specificCard?.summary || '', /radial artery/i);
  assert.match(radiusCard.specificCard?.summary || '', /septoperiosteal/i);
  assert.match(radiusCard.specificCard?.summary || '', /anterior interosseous/i);
  assert.match(radiusCard.specificCard?.summary || '', /ulnar artery/i);

  const fibulaCard = resolveBoneDeepTissueInfo('Left fibula');
  assert.equal(fibulaCard.specificCard?.id, 'bone-tibia-fibula');
  assert.match(fibulaCard.specificCard?.summary || '', /peroneal angiosome/i);
  assert.match(fibulaCard.specificCard?.summary || '', /tibia/i);

  const genericBone = resolveBoneDeepTissueInfo('Right femur');
  assert.equal(genericBone.specificCard, null);
  assert.match(genericBone.generalSupplyNote, /periosteal/i);
});

test('Phase 11d: Nerves return educational Patterns A-E and Fig 23.46 list with zero 3D geometry notice', () => {
  const nv = getNeurovascularEducationalData();
  assert.equal(nv.noGeometryNotice, NERVE_NO_GEOMETRY_NOTICE);
  assert.deepEqual(
    nv.patterns.map((p) => p.patternCode),
    ['A', 'B', 'C', 'D', 'E']
  );
  for (const pat of nv.patterns) {
    assert.equal(pat.educationalCardOnly, true);
  }
  assert.ok(nv.clinicalExamples);
  assert.equal(nv.clinicalExamples.educationalCardOnly, true);
  assert.equal(nv.upperLimbCutaneousNerves.length, 12);
});

test('Phase 11d: Store clears selectedSchematicMuscleId on Off and restores pre-entry layer snapshot', () => {
  const store = useAtlasStore;
  store.getState().reset3DView();
  store.getState().setLayer('organs', { visible: true, opacity: 0.85 });
  const preOrgans = { ...store.getState().layers.organs };
  const preNerves = { ...store.getState().layers.nerves };

  store.getState().setTerritoryMode('angiosomes');
  assert.equal(store.getState().layers.nerves.visible, false, 'Nerves layer stays off in Territory Mode');

  store.getState().setSelectedSchematicMuscleId('latissimus_dorsi');
  assert.equal(store.getState().selectedSchematicMuscleId, 'latissimus_dorsi');
  assert.ok(store.getState().territoryDepth >= 45, 'Selecting schematic muscle shifts to Deep Muscle depth');
  assert.equal(store.getState().focusedTerritoryId, null);

  // Focusing a territory clears schematic muscle selection (mutual exclusion)
  store.getState().focusTerritory('angio-37');
  assert.equal(store.getState().selectedSchematicMuscleId, null);
  assert.equal(store.getState().focusedTerritoryId, 'angio-37');

  // Re-select schematic muscle, then exit to Off
  store.getState().setSelectedSchematicMuscleId('rectus_abdominis');
  assert.equal(store.getState().selectedSchematicMuscleId, 'rectus_abdominis');

  store.getState().setTerritoryMode('off');
  assert.equal(store.getState().selectedSchematicMuscleId, null);
  assert.deepEqual(store.getState().layers.organs, preOrgans);
  assert.deepEqual(store.getState().layers.nerves, preNerves);
});
