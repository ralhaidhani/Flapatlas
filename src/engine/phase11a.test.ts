import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFECT_LOCATIONS,
  GLOSSARY_TERMS,
  INITIAL_FLAPS,
  QUIZ_QUESTIONS,
  REGIONS,
  VESSELS,
} from '../data/index';
import {
  auditTerritoryDataset,
  AUTHORISED_PERFORASOME_CODES,
  BODY_ANGIOSOMES,
  BodyAngiosomeRecordSchema,
  DELAY_MILESTONES,
  DESIGN_PRINCIPLES,
  FIG_23_46_UPPER_LIMB_CUTANEOUS_NERVES,
  FIG_23_51_PERFORATOR_CODES,
  findMuscleTerritoryByName,
  getBodyAngiosomeByNumber,
  getBodyAngiosomeDisplayLabel,
  HEAD_NECK_ANGIOSOMES,
  HEAD_NECK_CLINICAL_NOTES,
  headNeckMuscleTerritories,
  MUSCLE_TERRITORIES,
  PERFORATOR_FACTS,
  PERFORATOR_NOMENCLATURE_EXAMPLES,
  resolveAngiosomeBp3dFjs,
  summarizeBp3dCoverageCounts,
  VERIFIED_ANGIOSOME_BP3D_MAP,
} from '../data/territories/index';
import { runSection1SelfReview } from './dataIntegrityQa';

test('Phase 11a: Fig 23.23 body angiosomes match verified Appendix A (41 entries, 24 full / 5 partial / 12 none)', () => {
  assert.equal(VERIFIED_ANGIOSOME_BP3D_MAP.angiosomes.length, 41);
  assert.equal(BODY_ANGIOSOMES.length, 41);

  const cov = summarizeBp3dCoverageCounts();
  assert.deepEqual(cov, { total: 41, full: 24, partial: 5, none: 12 });

  // Key clinical landmarks from §2.1 & Acceptance Criteria
  const diea = getBodyAngiosomeByNumber(34);
  assert.equal(diea?.name, 'Deep inferior epigastric');
  assert.equal(diea?.bp3dCoverage, 'full');
  assert.deepEqual(diea?.bp3dArteries[0].left, ['FJ3511']);
  assert.deepEqual(diea?.bp3dArteries[0].right, ['FJ3604']);

  const lcfa = getBodyAngiosomeByNumber(27);
  assert.equal(lcfa?.name, 'Lateral circumflex femoral');
  assert.equal(lcfa?.bp3dCoverage, 'full');

  const dga = getBodyAngiosomeByNumber('22a');
  assert.equal(dga?.name, 'Descending genicular (saphenous)');
  assert.equal(dga?.bp3dCoverage, 'full');

  // Shared single femoral artery mesh for 31 + 32
  const sfa = getBodyAngiosomeByNumber(31);
  const cfa = getBodyAngiosomeByNumber(32);
  assert.equal(sfa?.sharedMeshGroup, 'femoral-31-32');
  assert.equal(cfa?.sharedMeshGroup, 'femoral-31-32');
  assert.match(getBodyAngiosomeDisplayLabel(sfa!), /Femoral \(31\+32\)/);

  // Absent-from-BP3D territories carry schematic_hint and schematic=true
  for (const absentNum of [2, 3, 5, 6, 19, 20, 21, 23, 24, 28, 33, 40] as const) {
    const rec = getBodyAngiosomeByNumber(absentNum);
    assert.ok(rec, `Missing angiosome ${absentNum}`);
    assert.equal(rec.bp3dCoverage, 'none');
    assert.equal(rec.schematic, true);
    assert.ok(rec.schematicHint && rec.schematicHint.length > 5);
  }
});

test('Phase 11a: Zod invariant rejects figure_visual_approximate records unless schematic === true', () => {
  const sample = BODY_ANGIOSOMES[1]; // facial (figure_visual_approximate)
  const invalid = BodyAngiosomeRecordSchema.safeParse({
    ...sample,
    evidenceType: 'figure_visual_approximate',
    schematic: false,
  });
  assert.equal(invalid.success, false);
});

test('Phase 11a: resolveAngiosomeBp3dFjs uses explicit left/right/midline arrays and downgrades missing FJ ids', () => {
  const diea = getBodyAngiosomeByNumber(34)!;
  const fullLoaded = new Set(['FJ3511', 'FJ3604']);
  const ok = resolveAngiosomeBp3dFjs(diea, fullLoaded);
  assert.equal(ok.effectiveCoverage, 'full');
  assert.equal(ok.downgradedToSchematic, false);
  assert.deepEqual(ok.resolvedLeftFjs, ['FJ3511']);
  assert.deepEqual(ok.resolvedRightFjs, ['FJ3604']);
  assert.equal(ok.missingFjs.length, 0);

  const partialLoaded = new Set(['FJ3511']);
  const partial = resolveAngiosomeBp3dFjs(diea, partialLoaded);
  assert.equal(partial.effectiveCoverage, 'partial');
  assert.equal(partial.downgradedToSchematic, true);
  assert.deepEqual(partial.missingFjs, ['FJ3604']);

  const noneLoaded = new Set<string>();
  const none = resolveAngiosomeBp3dFjs(diea, noneLoaded);
  assert.equal(none.effectiveCoverage, 'none');
  assert.equal(none.downgradedToSchematic, true);
  assert.deepEqual(none.missingFjs, ['FJ3511', 'FJ3604']);
});

test('Phase 11a: Head & Neck Fig 23.37 (13 territories) & Tables 23.3–23.4 muscle counts are exact and separate from Fig 23.23', () => {
  assert.equal(HEAD_NECK_ANGIOSOMES.length, 13);
  assert.equal(HEAD_NECK_ANGIOSOMES[0].id, 'hn-1');
  assert.equal(HEAD_NECK_ANGIOSOMES[0].name, 'Internal maxillary');

  // Territories 11–13 do not reach the skin
  for (const deepNum of [11, 12, 13]) {
    const rec = HEAD_NECK_ANGIOSOMES.find((h) => h.fig23_37Number === deepNum);
    assert.ok(rec);
    assert.equal(rec.reachesSkin, false);
  }
  for (let n = 1; n <= 10; n++) {
    const rec = HEAD_NECK_ANGIOSOMES.find((h) => h.fig23_37Number === n);
    assert.equal(rec?.reachesSkin, true);
  }

  // Verbatim Table 23.3 checks
  const trapezius = headNeckMuscleTerritories.find((m) => m.id === 'hn-muscle-trapezius');
  assert.equal(trapezius?.territoryCount, 4);
  assert.equal(trapezius?.territoryCountVariant, 5);

  const scm = headNeckMuscleTerritories.find((m) => m.id === 'hn-muscle-sternocleidomastoid');
  assert.equal(scm?.territoryCount, 4);

  const temporalis = headNeckMuscleTerritories.find((m) => m.id === 'hn-muscle-temporalis');
  const masseter = headNeckMuscleTerritories.find((m) => m.id === 'hn-muscle-masseter');
  assert.equal(temporalis?.territoryCount, 2);
  assert.equal(temporalis?.bp3dPresent, false);
  assert.equal(masseter?.territoryCount, 2);
  assert.equal(masseter?.bp3dPresent, false);

  assert.ok(HEAD_NECK_CLINICAL_NOTES.length >= 8);
});

test('Phase 11a: Muscle angiosome counts (Table 23.2), Neurovascular Types I–IV (Table 23.1), and Venous Types I–III (Fig 23.14)', () => {
  // Leg Table 23.2 exact counts
  for (const name of ['tibialis anterior', 'extensor digitorum longus', 'extensor hallucis longus', 'peroneus tertius']) {
    assert.equal(findMuscleTerritoryByName(name)?.angiosomeCount, 1, `Expected 1 territory for ${name}`);
  }
  for (const name of ['peroneus longus', 'peroneus brevis', 'flexor digitorum longus', 'flexor hallucis longus']) {
    assert.equal(findMuscleTerritoryByName(name)?.angiosomeCount, 2, `Expected 2 territories for ${name}`);
  }
  for (const name of ['gastrocnemius', 'soleus', 'popliteus', 'tibialis posterior']) {
    assert.equal(findMuscleTerritoryByName(name)?.angiosomeCount, 3, `Expected 3 territories for ${name}`);
  }

  // Table 23.1 neurovascular classification counts (9 Type I, 13 Type II, 16 Type III, 5 Type IV)
  const nvCount = (t: string) => MUSCLE_TERRITORIES.filter((m) => m.neurovascularType === t).length;
  assert.equal(nvCount('Type I'), 9);
  assert.equal(nvCount('Type II'), 13);
  assert.equal(nvCount('Type III'), 16);
  assert.equal(nvCount('Type IV'), 5);

  // Fig 23.14 venous exemplars
  assert.equal(findMuscleTerritoryByName('supraspinatus')?.venousType, 'Type I');
  assert.equal(findMuscleTerritoryByName('gracilis')?.venousType, 'Type II');
  assert.equal(findMuscleTerritoryByName('sartorius')?.venousType, 'Type III');

  // Absent BP3D muscles explicitly flagged schematic=true
  assert.equal(findMuscleTerritoryByName('latissimus dorsi')?.bp3dPresent, false);
  assert.equal(findMuscleTerritoryByName('latissimus dorsi')?.schematic, true);
  assert.equal(findMuscleTerritoryByName('rectus abdominis')?.bp3dPresent, false);
  assert.equal(findMuscleTerritoryByName('internal oblique')?.bp3dPresent, false);
});

test('Phase 11a: Perforator facts, exact 56 Fig 23.51 codes, Fig 23.52 nomenclature & Design/Delay/Neurovascular cards', () => {
  assert.equal(FIG_23_51_PERFORATOR_CODES.length, 56);
  assert.equal(AUTHORISED_PERFORASOME_CODES.size, 56);
  assert.ok(AUTHORISED_PERFORASOME_CODES.has('DIEA'));
  assert.ok(AUTHORISED_PERFORASOME_CODES.has('LCFA'));
  assert.ok(AUTHORISED_PERFORASOME_CODES.has('PAURA'));
  assert.ok(AUTHORISED_PERFORASOME_CODES.has('STHA'));

  assert.equal(PERFORATOR_NOMENCLATURE_EXAMPLES.length, 7);
  assert.ok(PERFORATOR_FACTS.length >= 10);

  // Propeller read-only rule card
  const propeller = DESIGN_PRINCIPLES.find((p) => p.category === 'propeller_rule');
  assert.ok(propeller);
  assert.equal(propeller.readOnlyRule, true);
  assert.match(propeller.summary, /a = b \+ c \+ 1 cm/);

  // 4 Delay milestones
  assert.equal(DELAY_MILESTONES.length, 4);
  assert.deepEqual(
    DELAY_MILESTONES.map((m) => m.timeWindowLabel),
    ['0 h (Immediate)', '0–48 h', '48–72 h', '~7 days']
  );

  // Neurovascular patterns A–E are educational-only schematic cards
  const nvPatterns = DESIGN_PRINCIPLES.filter((p) => p.patternCode !== undefined);
  assert.deepEqual(
    nvPatterns.map((p) => p.patternCode),
    ['A', 'B', 'C', 'D', 'E']
  );
  for (const p of nvPatterns) {
    assert.equal(p.educationalCardOnly, true);
    assert.equal(p.schematic, true);
  }
  assert.equal(FIG_23_46_UPPER_LIMB_CUTANEOUS_NERVES.length, 12);
});

test('Phase 11a: auditTerritoryDataset & Clinical Data-Integrity Self-Review (§11a) pass with zero issues', () => {
  const validFlapIds = new Set(INITIAL_FLAPS.map((f) => f.id));
  const audit = auditTerritoryDataset({ validFlapIds });

  assert.equal(audit.schemaErrors.length, 0, audit.schemaErrors.join('\n'));
  assert.equal(audit.missingSourceRefIds.length, 0, audit.missingSourceRefIds.join('\n'));
  assert.equal(audit.approximateNonSchematicIds.length, 0);
  assert.equal(audit.crossReferenceErrors.length, 0, audit.crossReferenceErrors.join('\n'));
  assert.equal(audit.allValid, true);
  assert.ok(audit.totalRecords >= 200);

  const selfReview = runSection1SelfReview({
    flaps: INITIAL_FLAPS,
    vessels: VESSELS,
    regions: REGIONS,
    defectLocations: DEFECT_LOCATIONS,
    quizQuestions: QUIZ_QUESTIONS,
    glossaryTerms: GLOSSARY_TERMS,
  });
  assert.equal(selfReview.allPassed, true);
  const check11a = selfReview.checks.find((c) => c.ruleId === '§11a');
  assert.ok(check11a, 'Expected §11a check in Clinical Data-Integrity Self-Review');
  assert.equal(check11a.passed, true, check11a.issues.join('\n'));
});
