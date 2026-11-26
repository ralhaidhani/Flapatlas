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
  buildGroundedSystemInstruction,
  NOT_AVAILABLE_FALLBACK,
  parseAdvisorScenarioPayload,
  retrieveGroundedContext,
} from './assistantGrounding';
import { runSection1SelfReview } from './dataIntegrityQa';

test('Phase 7: §1 Data-Integrity Self-Review passes 100% across all 62 flaps and linked datasets', () => {
  const report = runSection1SelfReview({
    flaps: INITIAL_FLAPS,
    vessels: VESSELS,
    regions: REGIONS,
    defectLocations: DEFECT_LOCATIONS,
    quizQuestions: QUIZ_QUESTIONS,
    glossaryTerms: GLOSSARY_TERMS,
  });

  for (const check of report.checks) {
    assert.equal(
      check.passed,
      true,
      `Check ${check.ruleId} (${check.title}) failed: ${check.issues.join(' | ')}`
    );
  }
  assert.equal(report.allPassed, true);
  assert.ok(report.checkedFlapsCount >= 62);
  assert.ok(report.fieldsMarkedVerifyCount > 0);
});

test('Phase 7: retrieveGroundedContext pulls multi-flap comparison records + linked vessels + verification status', () => {
  const bundle = retrieveGroundedContext(
    'Compare DIEP vs SIEA vs TRAM for autologous breast reconstruction',
    INITIAL_FLAPS,
    VESSELS,
    'alt-flap'
  );

  const ids = bundle.flapRecords.map((r) => String(r.id));
  assert.ok(ids.includes('diep-flap'), 'Expected DIEP in grounded context');
  assert.ok(ids.includes('siea-flap'), 'Expected SIEA in grounded context');
  assert.ok(ids.includes('tram-flap'), 'Expected TRAM in grounded context');
  assert.ok(bundle.vesselRecords.length >= 1, 'Expected at least 1 linked vessel in grounded context');
  const flapSources = bundle.sources.filter((s) => s.kind === 'flap');
  assert.ok(flapSources.every((s) => Boolean(s.verificationStatus)));
});

test('Phase 7: buildGroundedSystemInstruction enforces §9 verbatim fallback and educational disclaimer', () => {
  const inst = buildGroundedSystemInstruction('qa');
  assert.ok(inst.includes(NOT_AVAILABLE_FALLBACK));
  assert.ok(inst.includes('confidence: "verify"'));
  assert.ok(inst.toLowerCase().includes('not a substitute for clinical judgment'));

  const advisorInst = buildGroundedSystemInstruction('advisor-parse');
  assert.ok(advisorInst.includes('deterministic rule-based Flap Advisor engine'));
});

test('Phase 7: parseAdvisorScenarioPayload sanitizes valid & malformed model JSON into safe AdvisorInput', () => {
  const parsed = parseAdvisorScenarioPayload(
    {
      summary: 'Distal tibia Gustilo IIIB open fracture with exposed hardware',
      locationId: 'leg-distal-ankle',
      lengthCm: 14,
      widthCm: 8,
      depth: 'Deep / cavitary',
      missingTissues: ['Skin', 'Fascia', 'InventedTissue'],
      woundCharacteristics: ['Exposed bone', 'Exposed hardware', 'BogusFlag'],
      functionalGoals: ['Thin / pliable coverage', 'Durability'],
      recipientVesselStatus: 'Available',
      patientFactors: ['Smoker'],
      mobilizationPreference: 'Free flap acceptable',
    },
    DEFECT_LOCATIONS
  );

  assert.ok(parsed);
  assert.equal(parsed.input.locationId, 'leg-distal-ankle');
  assert.equal(parsed.input.lengthCm, 14);
  assert.equal(parsed.input.widthCm, 8);
  assert.deepEqual(parsed.input.missingTissues, ['Skin', 'Fascia']);
  assert.deepEqual(parsed.input.woundCharacteristics, ['Exposed bone', 'Exposed hardware']);

  // Invalid locationId falls back safely without throwing
  const fallback = parseAdvisorScenarioPayload(
    { locationId: 'non-existent-zone', lengthCm: 999, widthCm: -5 },
    DEFECT_LOCATIONS
  );
  assert.ok(fallback);
  assert.equal(fallback.input.locationId, DEFECT_LOCATIONS[0].id);
  assert.equal(fallback.input.lengthCm, 45);
  assert.equal(fallback.input.widthCm, 1);
});
