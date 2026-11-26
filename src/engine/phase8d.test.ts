import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANATOMICAL_MODEL_SOURCES,
  BODYPARTS3D_PHASE10_ATTRIBUTION,
  DEFAULT_MODEL_MANIFEST,
} from '../models/modelManifest';

const EXPECTED_PHASE_10_ATTRIBUTION =
  'Anatomical geometry: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International. Modified: converted from OBJ to glTF, axes and units transformed, split by body system, Draco-compressed, names normalised.';

test('Phase 8d / Phase 10e: BodyParts3D required attribution matches verbatim CC BY 4.0 license text & gates legacy Z-Anatomy', () => {
  assert.equal(BODYPARTS3D_PHASE10_ATTRIBUTION, EXPECTED_PHASE_10_ATTRIBUTION);

  const bp3dSource = ANATOMICAL_MODEL_SOURCES.find((s) => s.id === 'bodyparts3d-4.0');
  const legacyZSource = ANATOMICAL_MODEL_SOURCES.find((s) => s.id === 'z-anatomy-legacy');

  assert.ok(bp3dSource, 'BodyParts3D 4.0 primary source credit must exist');
  assert.equal(bp3dSource.license, 'CC Attribution 4.0 International (CC BY 4.0)');
  assert.equal(bp3dSource.requiredAttribution, EXPECTED_PHASE_10_ATTRIBUTION);
  assert.ok(!bp3dSource.legacyOnly);

  // Legacy Z-Anatomy must be strictly gated behind legacyOnly so it never appears by default
  assert.ok(legacyZSource?.legacyOnly === true);
});

test('Phase 8d / Phase 10e: Every active model manifest entry carries valid BodyParts3D CC BY 4.0 attribution', () => {
  assert.equal(DEFAULT_MODEL_MANIFEST.length, 8);
  const activeEntries = DEFAULT_MODEL_MANIFEST.filter((e) => e.enabledByDefault);
  assert.equal(activeEntries.length, 7);
  for (const entry of activeEntries) {
    assert.equal(entry.attribution, EXPECTED_PHASE_10_ATTRIBUTION);
    assert.equal(entry.license, 'CC BY 4.0');
    assert.ok(entry.sourceUrl.startsWith('https://'));
    assert.ok(entry.fallbackUrls.length >= 1);
  }
});
