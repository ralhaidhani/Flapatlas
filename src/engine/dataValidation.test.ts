import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FLAPS, INITIAL_FLAP_AUDIT, VESSELS, REGIONS, DEFECT_LOCATIONS, DEFECT_PRESETS, QUIZ_QUESTIONS } from '../data/index';
import { formatRange } from '../types/schemas';
import { filterAndSearchFlaps } from './searchEngine';

test('All 60+ flap JSON records pass Zod schema validation with zero errors and unique IDs', () => {
  assert.equal(INITIAL_FLAP_AUDIT.schemaErrors.length, 0, `Schema errors: ${INITIAL_FLAP_AUDIT.schemaErrors.join('\n')}`);
  assert.ok(INITIAL_FLAPS.length >= 60, `Expected at least 60 flaps for Phase 5, got ${INITIAL_FLAPS.length}`);
  assert.equal(INITIAL_FLAP_AUDIT.validFlaps, INITIAL_FLAP_AUDIT.totalFlaps);

  const seenIds = new Set<string>();
  const validRegionIds = new Set(REGIONS.map((r) => r.id));
  for (const flap of INITIAL_FLAPS) {
    assert.ok(!seenIds.has(flap.id), `Duplicate flap id detected: ${flap.id}`);
    seenIds.add(flap.id);
    assert.ok(
      validRegionIds.has(flap.spec3d.regionId),
      `Flap ${flap.id} has unknown spec3d.regionId "${flap.spec3d.regionId}"`
    );
  }
});

test('Every flap defaults to Needs review and includes at least one reference', () => {
  assert.equal(INITIAL_FLAP_AUDIT.recordsLackingReferences.length, 0);
  for (const flap of INITIAL_FLAPS) {
    assert.equal(flap.verification_status, 'Needs review', `Flap ${flap.id} should default to Needs review`);
    assert.ok(flap.references.length >= 1, `Flap ${flap.id} missing references`);
  }
});

test('formatRange never fabricates missing numbers and converts units accurately', () => {
  const nullRes = formatRange(null);
  assert.equal(nullRes.text, 'Not specified — verify in source');
  assert.equal(nullRes.isUnspecified, true);
  assert.equal(nullRes.isVerify, true);

  const metricRes = formatRange({ min: 8, max: 12, unit: 'cm', confidence: 'high' }, 'metric');
  assert.equal(metricRes.text, '8–12 cm');
  assert.equal(metricRes.isVerify, false);

  const imperialRes = formatRange({ min: 10, max: 20, unit: 'cm', confidence: 'moderate' }, 'imperial');
  assert.match(imperialRes.text, /in$/);
});

test('Fuzzy search and faceted filters find DIEP, ALT, and vessel-linked flaps', () => {
  const diepMatches = filterAndSearchFlaps(INITIAL_FLAPS, { query: 'deep inferior epigastric' });
  assert.ok(diepMatches.some((f) => f.id === 'diep-flap'), 'Expected DIEP flap in search results');

  const boneFlaps = filterAndSearchFlaps(INITIAL_FLAPS, { boneOnly: true });
  assert.ok(boneFlaps.some((f) => f.id === 'fibula-flap'), 'Expected Fibula flap in bone filter');
  assert.ok(boneFlaps.every((f) => f.advisor_tags.provides_bone));

  assert.ok(VESSELS.length >= 10);
  assert.ok(REGIONS.length >= 10);
  assert.ok(DEFECT_LOCATIONS.length >= 12);
  assert.ok(DEFECT_PRESETS.length >= 8);
  assert.ok(QUIZ_QUESTIONS.length >= 6);
});
