import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FLAPS } from '../data/index';
import {
  SearchableAnatomyStructure,
  searchAnatomyStructures,
} from '../models/clippingAndSearch';
import {
  extractLoadedVesselsIndex,
  findFlapsUsingVessel,
  normalizeVesselNameForMapLookup,
  searchLoadedVessels,
} from '../models/vesselSearch';

const MOCK_STRUCTURES: SearchableAnatomyStructure[] = [
  {
    key: 'arteries:0',
    anatomyId: 'bp3d_fj3511',
    label: 'inferior epigastric artery',
    meshName: 'FJ3511',
    system: 'arteries',
    category: 'Artery',
    laterality: 'left',
    mapped: true,
    linkedFlapIds: [],
    sourceModel: 'bodyparts3d',
    fjCode: 'FJ3511',
    fmaCode: 'FMA20740',
    center: [-0.04, 0.94, 0.08],
    boundsMin: [-0.055, 0.84, 0.07],
    boundsMax: [-0.025, 1.04, 0.09],
  },
  {
    key: 'arteries:1',
    anatomyId: 'bp3d_fj3604',
    label: 'inferior epigastric artery',
    meshName: 'FJ3604',
    system: 'arteries',
    category: 'Artery',
    laterality: 'right',
    mapped: true,
    linkedFlapIds: [],
    sourceModel: 'bodyparts3d',
    fjCode: 'FJ3604',
    fmaCode: 'FMA20739',
    center: [0.04, 0.94, 0.08],
    boundsMin: [0.025, 0.84, 0.07],
    boundsMax: [0.055, 1.04, 0.09],
  },
  {
    key: 'veins:0',
    anatomyId: 'bp3d_fj3512',
    label: 'inferior epigastric vein',
    meshName: 'FJ3512',
    system: 'veins',
    category: 'Vein',
    laterality: 'left',
    mapped: true,
    linkedFlapIds: [],
    sourceModel: 'bodyparts3d',
    fjCode: 'FJ3512',
    fmaCode: 'FMA44332',
    center: [-0.042, 0.94, 0.078],
    boundsMin: [-0.056, 0.84, 0.068],
    boundsMax: [-0.026, 1.04, 0.088],
  },
  {
    key: 'veins:1',
    anatomyId: 'bp3d_fj3605',
    label: 'inferior epigastric vein',
    meshName: 'FJ3605',
    system: 'veins',
    category: 'Vein',
    laterality: 'right',
    mapped: true,
    linkedFlapIds: [],
    sourceModel: 'bodyparts3d',
    fjCode: 'FJ3605',
    fmaCode: 'FMA44331',
    center: [0.042, 0.94, 0.078],
    boundsMin: [0.026, 0.84, 0.068],
    boundsMax: [0.056, 1.04, 0.088],
  },
  {
    key: 'arteries:2',
    anatomyId: 'bp3d_fj2074',
    label: 'femoral artery',
    meshName: 'FJ2074',
    system: 'arteries',
    category: 'Artery',
    laterality: 'left',
    mapped: true,
    linkedFlapIds: [],
    sourceModel: 'bodyparts3d',
    fjCode: 'FJ2074',
    fmaCode: 'FMA70248',
    center: [-0.09, 0.72, 0.03],
    boundsMin: [-0.11, 0.52, 0.01],
    boundsMax: [-0.07, 0.92, 0.05],
  },
  {
    key: 'veins:2',
    anatomyId: 'bp3d_fj1993',
    label: 'internal thoracic vein',
    meshName: 'FJ1993',
    system: 'veins',
    category: 'Vein',
    laterality: 'midline',
    mapped: true,
    linkedFlapIds: [],
    sourceModel: 'bodyparts3d',
    fjCode: 'FJ1993',
    fmaCode: 'FMA4728',
    center: [0.0, 1.32, 0.08],
    boundsMin: [-0.03, 1.18, 0.07],
    boundsMax: [0.03, 1.46, 0.09],
  },
  {
    key: 'skeleton:0',
    anatomyId: 'bone_femur_l',
    label: 'Femur',
    meshName: 'Femur.l',
    system: 'skeleton',
    category: 'Bone',
    laterality: 'left',
    mapped: true,
    linkedFlapIds: [],
    sourceModel: 'z-anatomy',
    center: [-0.1, 0.65, 0],
    boundsMin: [-0.14, 0.44, -0.04],
    boundsMax: [-0.06, 0.86, 0.04],
  },
];

test('extractLoadedVesselsIndex indexes only arteries and veins with name, side, FJ, and FMA', () => {
  const indexed = extractLoadedVesselsIndex(MOCK_STRUCTURES);
  assert.equal(indexed.length, 6);
  assert.ok(indexed.every((v) => v.system === 'arteries' || v.system === 'veins'));

  const dieaLeft = indexed.find((v) => v.fjCode === 'FJ3511');
  assert.ok(dieaLeft);
  assert.equal(dieaLeft.name, 'inferior epigastric artery');
  assert.equal(dieaLeft.side, 'left');
  assert.equal(dieaLeft.fmaCode, 'FMA20740');
});

test('searchLoadedVessels finds left & right meshes for "inferior epigastric"', () => {
  const indexed = extractLoadedVesselsIndex(MOCK_STRUCTURES);
  const results = searchLoadedVessels(indexed, 'inferior epigastric');
  assert.equal(results.length, 4);
  const fjCodes = results.map((r) => r.fjCode);
  assert.ok(fjCodes.includes('FJ3511'));
  assert.ok(fjCodes.includes('FJ3604'));
  assert.ok(fjCodes.includes('FJ3512'));
  assert.ok(fjCodes.includes('FJ3605'));
  // Arteries rank ahead of veins on exact tie, left before right
  assert.equal(results[0].fjCode, 'FJ3511');
  assert.equal(results[1].fjCode, 'FJ3604');
});

test('searchLoadedVessels supports multi-token side filter and exact FJ / FMA code lookup', () => {
  const indexed = extractLoadedVesselsIndex(MOCK_STRUCTURES);

  const leftOnly = searchLoadedVessels(indexed, 'inferior epigastric left');
  assert.equal(leftOnly.length, 2);
  assert.ok(leftOnly.every((v) => v.side === 'left'));

  const byFj = searchLoadedVessels(indexed, 'FJ3511');
  assert.equal(byFj.length, 1);
  assert.equal(byFj[0].fjCode, 'FJ3511');

  const byFma = searchLoadedVessels(indexed, 'FMA20740');
  assert.equal(byFma.length, 1);
  assert.equal(byFma[0].fjCode, 'FJ3511');
});

test('searchAnatomyStructures inline 3D search also indexes FJ and FMA codes', () => {
  const byFj = searchAnatomyStructures(MOCK_STRUCTURES, 'FJ2074');
  assert.equal(byFj.length, 1);
  assert.equal(byFj[0].fjCode, 'FJ2074');

  const byFma = searchAnatomyStructures(MOCK_STRUCTURES, 'FMA20739');
  assert.equal(byFma.length, 1);
  assert.equal(byFma[0].fjCode, 'FJ3604');
});

test('findFlapsUsingVessel resolves DIEP from FJ3511/FJ3604 and ALT+SIEA from femoral FJ2074', () => {
  const dieaMatches = findFlapsUsingVessel(
    { fjCode: 'FJ3511', name: 'inferior epigastric artery' },
    INITIAL_FLAPS
  );
  assert.ok(dieaMatches.some((m) => m.flapId === 'diep-flap' && m.role === 'pedicle'));

  const femoralMatches = findFlapsUsingVessel(
    { fjCode: 'FJ2074', name: 'femoral artery' },
    INITIAL_FLAPS
  );
  const femoralFlapIds = femoralMatches.map((m) => m.flapId);
  assert.ok(femoralFlapIds.includes('alt-flap'));
  assert.ok(femoralFlapIds.includes('siea-flap'));
  assert.ok(femoralMatches.every((m) => m.role === 'source'));

  const midlineVeinMatches = findFlapsUsingVessel(
    { fjCode: 'FJ1993', name: 'internal thoracic vein' },
    INITIAL_FLAPS
  );
  assert.ok(
    midlineVeinMatches.some(
      (m) => m.flapId === 'deltopectoral-flap' && m.role === 'vein' && m.matchedSide === 'midline'
    )
  );
});

test('findFlapsUsingVessel resolves curated textbook vessel names without FJ codes', () => {
  assert.equal(
    normalizeVesselNameForMapLookup('Deep Inferior Epigastric Artery (DIEA)'),
    'inferior epigastric artery'
  );
  const curatedDiea = findFlapsUsingVessel(
    { name: 'Deep Inferior Epigastric Artery (DIEA)' },
    INITIAL_FLAPS
  );
  assert.ok(curatedDiea.some((m) => m.flapId === 'diep-flap' && m.role === 'pedicle'));
});
