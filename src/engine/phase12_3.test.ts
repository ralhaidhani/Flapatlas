import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { INITIAL_FLAPS } from '../data/index';
import {
  hasOperativeGuide,
  loadOperativeGuide,
  OPERATIVE_GUIDE_BANNER,
  OPERATIVE_PHASE_ORDER,
  OperativeGuideSchema,
} from '../data/operative';
import ALT_OPERATIVE_GUIDE from '../data/operative/alt-flap';
import {
  auditOperativeGuideUnresolvedNames,
  resolveOperativeStepView,
  resolveOperativeStructureName,
  type LoadedStructureCatalogItem,
} from '../data/operative/structureResolver';
import { useAtlasStore } from '../store/useAtlasStore';

const MOCK_CATALOG: LoadedStructureCatalogItem[] = [
  {
    meshKey: 'm_rf_l',
    meshName: 'left rectus femoris [FJ1440]',
    normalizedName: 'left rectus femoris',
    anatomyId: 'rectus_femoris',
    label: 'Left rectus femoris',
    system: 'muscles',
    laterality: 'left',
    groupId: 'group:quadriceps_femoris',
    groupLabel: 'Quadriceps Femoris',
  },
  {
    meshKey: 'm_rf_r',
    meshName: 'right rectus femoris [FJ1441]',
    normalizedName: 'right rectus femoris',
    anatomyId: 'rectus_femoris',
    label: 'Right rectus femoris',
    system: 'muscles',
    laterality: 'right',
    groupId: 'group:quadriceps_femoris',
    groupLabel: 'Quadriceps Femoris',
  },
  {
    meshKey: 'm_vl_l',
    meshName: 'left vastus lateralis [FJ1442]',
    normalizedName: 'left vastus lateralis',
    anatomyId: 'vastus_lateralis',
    label: 'Left vastus lateralis',
    system: 'muscles',
    laterality: 'left',
    groupId: 'group:quadriceps_femoris',
    groupLabel: 'Quadriceps Femoris',
  },
  {
    meshKey: 'm_tfl_l',
    meshName: 'left tensor fasciae latae [FJ1450]',
    normalizedName: 'left tensor fasciae latae',
    anatomyId: 'tfl',
    label: 'Left tensor fasciae latae',
    system: 'muscles',
    laterality: 'left',
    groupId: 'group:tensor_fasciae_latae',
    groupLabel: 'Tensor Fasciae Latae',
  },
  {
    meshKey: 'a_lcfa_desc_l',
    meshName: 'descending branch of left lateral circumflex femoral artery [FJ2063]',
    normalizedName: 'descending branch of left lateral circumflex femoral artery',
    anatomyId: 'v-lcfa-desc',
    label: 'Descending branch of left lateral circumflex femoral artery',
    system: 'arteries',
    laterality: 'left',
  },
  {
    meshKey: 'a_lcfa_l',
    meshName: 'left lateral circumflex femoral artery [FJ2078]',
    normalizedName: 'left lateral circumflex femoral artery',
    anatomyId: 'v-lcfa-desc',
    label: 'Left lateral circumflex femoral artery',
    system: 'arteries',
    laterality: 'left',
  },
  {
    meshKey: 'b_patella_l',
    meshName: 'left patella [FJ1100]',
    normalizedName: 'left patella',
    anatomyId: 'patella',
    label: 'Left patella',
    system: 'skeleton',
    laterality: 'left',
  },
];

test('12-3.1 ALT operative guide matches attached JSON verbatim and satisfies Zod schema & honesty rules', () => {
  const attachedPath = path.resolve(
    process.cwd(),
    'public/assets/aistudio/alt_operative_guide_example_2d919d7a.json'
  );
  const rawAttached = JSON.parse(fs.readFileSync(attachedPath, 'utf-8'));
  const parsedAttached = OperativeGuideSchema.parse(rawAttached);

  assert.deepEqual(ALT_OPERATIVE_GUIDE, parsedAttached);
  assert.equal(ALT_OPERATIVE_GUIDE.contentBasis, 'model_knowledge_summary');
  assert.equal(ALT_OPERATIVE_GUIDE.verificationStatus, 'needs_review');
  assert.equal(ALT_OPERATIVE_GUIDE.steps.length, 9);
  assert.equal(ALT_OPERATIVE_GUIDE.adjacent.perforator.length, 5);
  assert.equal(ALT_OPERATIVE_GUIDE.adjacent.flap.length, 2);
  assert.equal(ALT_OPERATIVE_GUIDE.avoidNecrosis.length, 8);
  assert.equal(ALT_OPERATIVE_GUIDE.numbers.length, 2);
  for (const num of ALT_OPERATIVE_GUIDE.numbers) {
    assert.equal(num.verify, true);
  }
  assert.equal(
    OPERATIVE_GUIDE_BANNER,
    'Educational summary compiled from standard references — verify against the primary source before clinical use.'
  );
  assert.deepEqual(Array.from(OPERATIVE_PHASE_ORDER), [
    'Marking',
    'Exposure',
    'Perforator',
    'Pedicle',
    'Elevation',
    'Harvest',
    'Donor site',
    'Inset',
  ]);
});

test('12-3.2 Lazy loader serves ALT guide only; every other flap resolves to null (empty state)', async () => {
  assert.equal(hasOperativeGuide('alt-flap'), true);
  const alt = await loadOperativeGuide('alt-flap');
  assert.ok(alt);
  assert.equal(alt.steps.length, 9);

  const otherFlaps = INITIAL_FLAPS.filter((f) => f.id !== 'alt-flap');
  assert.ok(otherFlaps.length > 0);
  for (const f of otherFlaps) {
    assert.equal(hasOperativeGuide(f.id), false, `${f.id} must not have a fabricated operative guide`);
    const res = await loadOperativeGuide(f.id);
    assert.equal(res, null);
  }
});

test('12-3.3 Step Show-in-3D view resolver maps real meshes, handles layer hides, and reports unresolved names', () => {
  // Step 2: highlight rectus femoris + vastus lateralis, hide tensor fasciae latae
  const step2 = ALT_OPERATIVE_GUIDE.steps[1];
  const res2 = resolveOperativeStepView(step2.view, MOCK_CATALOG, 'left');
  assert.deepEqual(res2.highlightMeshKeys.sort(), ['m_rf_l', 'm_vl_l']);
  assert.deepEqual(res2.hideMeshKeys, ['m_tfl_l']);
  assert.equal(res2.layerVisibilityPatch.skin?.visible, true);
  assert.equal(res2.layerVisibilityPatch.muscle?.visible, true);
  assert.equal(res2.layerVisibilityPatch.arteries?.visible, false);
  assert.equal(res2.cameraPreset, 'lower-limb-ant');
  assert.equal(res2.unresolvedNames.length, 0);

  // Step 4: hide "skin" is a layer alias (not an unresolved mesh name)
  const step4 = ALT_OPERATIVE_GUIDE.steps[3];
  const res4 = resolveOperativeStepView(step4.view, MOCK_CATALOG, 'left');
  assert.equal(res4.layerVisibilityPatch.skin?.visible, false);
  assert.equal(res4.layerVisibilityPatch.muscle?.visible, true);
  assert.equal(res4.layerVisibilityPatch.arteries?.visible, true);
  assert.equal(res4.layerVisibilityPatch.veins?.visible, true);
  assert.deepEqual(res4.highlightMeshKeys.sort(), ['a_lcfa_desc_l', 'm_vl_l']);
  assert.equal(res4.unresolvedNames.length, 0);

  // Adjacent structures: real meshes resolve, missing peripheral nerves / fascia return resolved: false
  const lfcNerve = resolveOperativeStructureName(
    'Lateral femoral cutaneous nerve',
    MOCK_CATALOG,
    'left'
  );
  assert.equal(lfcNerve.resolved, false);

  const rfAdj = resolveOperativeStructureName('Rectus femoris', MOCK_CATALOG, 'left');
  assert.equal(rfAdj.resolved, true);
  assert.deepEqual(rfAdj.matchedMeshKeys, ['m_rf_l']);

  // Full Editor audit collects unresolved names without crashing
  const unresolved = auditOperativeGuideUnresolvedNames(
    ALT_OPERATIVE_GUIDE,
    'alt-flap',
    MOCK_CATALOG,
    'left'
  );
  assert.ok(unresolved.some((u) => u.name === 'anterior superior iliac spine' && u.stepN === 1));
  assert.ok(unresolved.some((u) => u.name === 'Nerve to vastus lateralis'));
  assert.ok(unresolved.some((u) => u.name === 'Lateral femoral cutaneous nerve'));
  assert.ok(unresolved.some((u) => u.name === 'Fascia lata / iliotibial tract'));
  assert.ok(!unresolved.some((u) => u.name.toLowerCase() === 'skin'));
});

test('12-3.4 Store applyOperativeStepView saves pre-tab layers once and clearOperativeView restores them', () => {
  const store = useAtlasStore;
  store.getState().clearOperativeView();

  // Set distinctive initial layer configuration before entering operative guide
  store.getState().setLayer('skin', { visible: true, opacity: 0.42 });
  store.getState().setLayer('arteries', { visible: true, opacity: 0.95 });
  store.getState().setLayer('muscle', { visible: false, opacity: 0.88 });

  // Apply Step 2 (turns muscle ON, arteries OFF)
  const res2 = resolveOperativeStepView(ALT_OPERATIVE_GUIDE.steps[1].view, MOCK_CATALOG, 'left');
  store.getState().applyOperativeStepView({
    flapId: 'alt-flap',
    stepN: 2,
    layerVisibilityPatch: res2.layerVisibilityPatch,
    highlightMeshKeys: res2.highlightMeshKeys,
    hideMeshKeys: res2.hideMeshKeys,
    cameraPreset: res2.cameraPreset,
  });

  assert.equal(store.getState().operativeViewState.active, true);
  assert.equal(store.getState().operativeViewState.stepN, 2);
  assert.equal(store.getState().layers.muscle.visible, true);
  assert.equal(store.getState().layers.arteries.visible, false);
  assert.deepEqual(store.getState().operativeViewState.hideMeshKeys, ['m_tfl_l']);

  // Step forward to Step 4 (hides skin) — original snapshot must remain intact
  const res4 = resolveOperativeStepView(ALT_OPERATIVE_GUIDE.steps[3].view, MOCK_CATALOG, 'left');
  store.getState().applyOperativeStepView({
    flapId: 'alt-flap',
    stepN: 4,
    layerVisibilityPatch: res4.layerVisibilityPatch,
    highlightMeshKeys: res4.highlightMeshKeys,
    hideMeshKeys: res4.hideMeshKeys,
    cameraPreset: res4.cameraPreset,
  });
  assert.equal(store.getState().layers.skin.visible, false);
  assert.equal(store.getState().layers.arteries.visible, true);

  // Leave Operative guide tab -> exact pre-tab layers restored and operative hides/highlights cleared
  store.getState().clearOperativeView();
  assert.equal(store.getState().operativeViewState.active, false);
  assert.deepEqual(store.getState().operativeViewState.highlightMeshKeys, []);
  assert.deepEqual(store.getState().operativeViewState.hideMeshKeys, []);
  assert.equal(store.getState().layers.skin.visible, true);
  assert.equal(store.getState().layers.skin.opacity, 0.42);
  assert.equal(store.getState().layers.arteries.visible, true);
  assert.equal(store.getState().layers.muscle.visible, false);
});
