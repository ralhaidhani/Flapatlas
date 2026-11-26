import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FLAPS } from '../data/index';
import { BODY_ANGIOSOMES } from '../data/territories/index';
import { bakeTerritoryField3D } from '../models/territoryFieldCore';
import { TERRITORY_SLOT_BY_ID } from '../models/territoryPalette';
import {
  computeTerritoryDepthLayerPatch,
  computeTerritoryFocusBounds,
  findFlapsForTerritory,
  formatCoverageBadgeLabel,
  getTerritoryDetailModel,
  getTerritorySourceArteryFjs,
  searchTerritoriesAndCodes,
} from '../models/territorySearch';
import { useAtlasStore } from '../store/useAtlasStore';

test('Phase 11c: Entering Angiosomes snapshots layers & leaving Off restores exact state', () => {
  const store = useAtlasStore;
  store.getState().reset3DView();

  // Configure distinctive custom user state before entering Territory Mode
  store.getState().setLayer('skin', { visible: true, opacity: 0.22 });
  store.getState().setLayer('organs', { visible: true, opacity: 0.88 });
  store.getState().setLayer('perforators', { visible: true, opacity: 1.0 });
  store.getState().setShow3DLabels(true);
  store.getState().setVesselPreset('surgical');
  store.getState().setVesselSideFilter('left');

  // Enter Angiosomes mode
  store.getState().setTerritoryMode('angiosomes');
  const activeState = store.getState();
  assert.equal(activeState.territoryMode, 'angiosomes');
  assert.equal(activeState.territorySheetOpen, true);
  assert.ok(activeState.territoryLayerSnapshot, 'Snapshot must be saved on entry');
  assert.equal(activeState.layers.organs.visible, false, 'Organs auto-hidden on entry');
  assert.equal(activeState.layers.perforators.visible, false, 'Procedural perforators hidden');
  assert.equal(activeState.layers.landmarks.visible, false, 'Landmark pins hidden');
  assert.equal(activeState.layers.cuttingGuides.visible, false, 'Cutting guides hidden');
  assert.equal(activeState.show3DLabels, false, 'Permanent 3D labels suppressed');
  assert.equal(activeState.layers.skin.visible, true, 'Skin visible to carry territories');
  assert.ok(activeState.layers.skin.opacity >= 0.65, 'Skin translucent-vivid for territory colors');

  // Switch to Venosomes -> snapshot remains original pre-entry state
  store.getState().setTerritoryMode('venosomes');
  assert.equal(store.getState().territoryMode, 'venosomes');
  assert.equal(store.getState().layers.veins.visible, true);
  assert.equal(store.getState().territoryLayerSnapshot?.layers.organs.visible, true);

  // Focus a territory and enable neighbors, then exit to Off
  store.getState().focusTerritory('angio-34', 'right');
  store.getState().setShowTerritoryNeighbors(true);
  store.getState().setTerritoryMode('off');

  const restored = store.getState();
  assert.equal(restored.territoryMode, 'off');
  assert.equal(restored.territoryLayerSnapshot, null);
  assert.equal(restored.focusedTerritoryId, null);
  assert.equal(restored.showTerritoryNeighbors, false);
  assert.equal(restored.layers.skin.opacity, 0.22);
  assert.equal(restored.layers.organs.visible, true);
  assert.equal(restored.layers.organs.opacity, 0.88);
  assert.equal(restored.layers.perforators.visible, true);
  assert.equal(restored.show3DLabels, true);
  assert.equal(restored.vesselPreset, 'surgical');
  assert.equal(restored.vesselSideFilter, 'left');
});

test('Phase 11c: Tissue Depth slider transitions cleanly across Skin -> Deep Muscle -> Bone', () => {
  const skinPatch = computeTerritoryDepthLayerPatch(0, 'angiosomes', false);
  assert.equal(skinPatch.skin.visible, true);
  assert.ok(skinPatch.skin.opacity >= 0.7);
  assert.ok(skinPatch.muscle.opacity <= 0.25, 'Muscles ghosted in Skin view');
  assert.ok(skinPatch.skeleton.opacity <= 0.3, 'Bones ghosted in Skin view');
  assert.equal(skinPatch.organs.visible, false);

  const musclePatch = computeTerritoryDepthLayerPatch(58, 'angiosomes', true);
  assert.equal(musclePatch.skin.visible, false, 'Skin peeled in Deep Muscle view');
  assert.equal(musclePatch.muscle.visible, true);
  assert.ok(musclePatch.muscle.opacity >= 0.9, 'Muscles vivid in Deep Muscle view');

  const bonePatch = computeTerritoryDepthLayerPatch(96, 'angiosomes', true);
  assert.equal(bonePatch.skin.visible, false);
  assert.equal(bonePatch.muscle.visible, false, 'Muscles peeled in Bone view');
  assert.equal(bonePatch.skeleton.visible, true);
  assert.ok(bonePatch.skeleton.opacity >= 0.95, 'Skeleton solid in Bone view');
});

test('Phase 11c: Coverage badges across all 41 body angiosomes match 24 Real / 5 Partial / 12 Schematic', () => {
  const counts = { 'Real mesh': 0, 'Partial mesh': 0, 'Schematic only': 0 };
  for (const a of BODY_ANGIOSOMES) {
    counts[formatCoverageBadgeLabel(a.bp3dCoverage)] += 1;
  }
  assert.equal(counts['Real mesh'], 24);
  assert.equal(counts['Partial mesh'], 5);
  assert.equal(counts['Schematic only'], 12);
});

test('Phase 11c: Source artery FJ filtering respects explicit left/right/both arrays', () => {
  const dieaBoth = getTerritorySourceArteryFjs('angio-34', 'both');
  const dieaRight = getTerritorySourceArteryFjs('angio-34', 'right');
  const dieaLeft = getTerritorySourceArteryFjs('angio-34', 'left');

  assert.equal(dieaLeft.has('FJ3511'), true);
  assert.equal(dieaLeft.has('FJ3604'), false);
  assert.equal(dieaRight.has('FJ3604'), true);
  assert.equal(dieaRight.has('FJ3511'), false);
  assert.equal(dieaBoth.has('FJ3511') && dieaBoth.has('FJ3604'), true);

  // Schematic-only territory returns empty FJ set
  const sgaFjs = getTerritorySourceArteryFjs('angio-19', 'both');
  assert.equal(sgaFjs.size, 0);
});

test('Phase 11c: Territory detail model & flap linking resolve clinical records accurately', () => {
  const dieaDetail = getTerritoryDetailModel('angio-34', null, INITIAL_FLAPS);
  assert.ok(dieaDetail);
  assert.equal(dieaDetail.displayNumber, '34');
  assert.equal(dieaDetail.abbr, 'DIEA');
  assert.equal(dieaDetail.coverageLabel, 'Real mesh');
  assert.equal(dieaDetail.isSchematic, false);
  assert.ok(dieaDetail.linkedFlaps.some((f) => f.id === 'diep-flap'));
  assert.ok(dieaDetail.linkedFlaps.some((f) => f.id === 'tram-flap'));
  assert.match(dieaDetail.neighborClinicalNote, /choke vessels or true anastomoses/i);

  const sgaDetail = getTerritoryDetailModel('angio-19', null, INITIAL_FLAPS);
  assert.ok(sgaDetail);
  assert.equal(sgaDetail.coverageLabel, 'Schematic only');
  assert.equal(sgaDetail.isSchematic, true);
  assert.ok(sgaDetail.linkedFlaps.some((f) => f.id === 'sgap-flap'));

  const ataDetail = getTerritoryDetailModel('angio-26', null, INITIAL_FLAPS);
  assert.ok(ataDetail);
  assert.ok(
    ataDetail.muscles.some((m) => m.name.toLowerCase().includes('tibialis anterior') && m.territoryCountLabel === '1 territory'),
    'Anterior tibial territory includes Tibialis anterior (1 territory)'
  );

  const suralDetail = getTerritoryDetailModel('angio-23', null, INITIAL_FLAPS);
  assert.ok(suralDetail);
  assert.ok(
    suralDetail.muscles.some((m) => m.name.toLowerCase().includes('gastrocnemius') && m.territoryCountLabel === '3 territories'),
    'Sural territory includes Gastrocnemius (3 territories)'
  );

  const altFlaps = findFlapsForTerritory('angio-27', INITIAL_FLAPS);
  assert.ok(altFlaps.some((f) => f.id === 'alt-flap'));

  // Deep-only Head & Neck territory (HN-11 Vertebral)
  const vertebralDetail = getTerritoryDetailModel('hn-11', null, INITIAL_FLAPS);
  assert.ok(vertebralDetail);
  assert.equal(vertebralDetail.isDeepOnly, true);
  assert.equal(vertebralDetail.reachesSkin, false);
});

test('Phase 11c: Global search resolves angiosomes, abbreviations, numbers, and Fig 23.51 perforator codes', () => {
  const dieaResults = searchTerritoriesAndCodes('DIEA', 6);
  assert.ok(dieaResults.length > 0);
  assert.equal(dieaResults[0].territoryId, 'angio-34');
  assert.equal(dieaResults[0].coverageLabel, 'Real mesh');

  const lcfaResults = searchTerritoriesAndCodes('LCFA', 6);
  assert.ok(lcfaResults.length > 0);
  assert.equal(lcfaResults[0].territoryId, 'angio-27');

  const dgaResults = searchTerritoriesAndCodes('22a', 6);
  assert.ok(dgaResults.length > 0);
  assert.equal(dgaResults[0].territoryId, 'angio-22a');

  const sieaResults = searchTerritoriesAndCodes('SIEA', 6);
  assert.ok(sieaResults.some((r) => r.code === 'SIEA'));

  const vertebralResults = searchTerritoriesAndCodes('vertebral', 6);
  assert.ok(vertebralResults.some((r) => r.territoryId === 'hn-11'));
});

test('Phase 11c: computeTerritoryFocusBounds isolates right (-X) and left (+X) territory centroids', () => {
  const slot34 = TERRITORY_SLOT_BY_ID.get('angio-34')!;
  const landmarks = {
    midlineX: 0,
    ischialTuberosityRight: [-0.06, 0.78, -0.02] as [number, number, number],
    medialMalleolusRight: [-0.06, 0.08, 0] as [number, number, number],
    olecranonRight: [-0.25, 1.05, -0.03] as [number, number, number],
    medialCanthusRight: [-0.018, 1.6, 0.08] as [number, number, number],
    mentalProtuberance: [0, 1.49, 0.085] as [number, number, number],
    vertex: [0, 1.72, 0] as [number, number, number],
    bodyBoundsMin: [-0.28, 0, -0.14] as [number, number, number],
    bodyBoundsMax: [0.28, 1.72, 0.14] as [number, number, number],
  };

  const field = bakeTerritoryField3D({
    boundsMin: [-0.14, 0.85, -0.1],
    boundsMax: [0.14, 1.15, 0.1],
    voxelSizeMeters: 0.02,
    landmarks,
    clusters: [
      {
        slotId: slot34.slotId,
        territoryId: slot34.territoryId,
        side: 'right',
        regionFamily: 'trunk',
        isDeepOnly: false,
        isSchematic: false,
        crossesMidline: false,
        weight: 1.0,
        points: new Float32Array([-0.05, 0.98, 0.06]),
      },
      {
        slotId: slot34.slotId,
        territoryId: slot34.territoryId,
        side: 'left',
        regionFamily: 'trunk',
        isDeepOnly: false,
        isSchematic: false,
        crossesMidline: false,
        weight: 1.0,
        points: new Float32Array([0.05, 0.98, 0.06]),
      },
    ],
  });

  const rightBounds = computeTerritoryFocusBounds(field, slot34.slotId, 'right');
  const leftBounds = computeTerritoryFocusBounds(field, slot34.slotId, 'left');
  assert.ok(rightBounds && rightBounds.center[0] < 0, 'Right territory centroid is negative X');
  assert.ok(leftBounds && leftBounds.center[0] > 0, 'Left territory centroid is positive X');
});
