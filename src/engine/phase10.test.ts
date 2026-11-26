import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_FLAPS, VESSELS } from '../data/index';
import {
  buildMeshMappingReport,
  mapMeshNameToAnatomy,
  parseTerminologiaMeshName,
  resolveLogicalAnatomyGroup,
} from '../models/anatomyMap';
import {
  ANCHOR_MODEL_VERSION,
  DEFAULT_ANCHORS,
  detectStaleAnchorCalibration,
  mergeAnchorsWithCalibration,
  proposeBp3dAnchorsFromSubMeshes,
} from '../models/anchorSystem';
import {
  assessFlapBp3dCoverage,
  buildSchematicMuscleOutline,
  SCHEMATIC_MUSCLE_BADGE,
  SCHEMATIC_NERVE_BADGE,
  SCHEMATIC_ONLY_STRUCTURES_CATALOG,
} from '../models/bp3dCoverage';
import { searchAnatomyStructures, SearchableAnatomyStructure } from '../models/clippingAndSearch';
import { resolveFlapRealVessels } from '../models/flapVesselLinker';
import { classifyMaterialBucket, MergedSubMeshRecord } from '../models/glbLoader';
import {
  BODYPARTS3D_PHASE10_ATTRIBUTION,
  DEFAULT_CDN_MODEL_BASE_URL,
  DEFAULT_MODEL_MANIFEST,
  DEFAULT_RAW_MODEL_BASE_URL,
  buildManifestForBaseUrl,
  groupManifestByStage,
} from '../models/modelManifest';
import { MODEL_CACHE_DB_NAME } from '../models/modelCache';

test('Phase 10a: GitHub manifest points to ralhaidhani/flapatlas-models with Raw fallback, bumped cache, and hidden organs', () => {
  assert.equal(MODEL_CACHE_DB_NAME, 'flapatlas-bp3d-v4');
  assert.ok(DEFAULT_CDN_MODEL_BASE_URL.includes('ralhaidhani/flapatlas-models'));
  assert.ok(DEFAULT_RAW_MODEL_BASE_URL.includes('raw.githubusercontent.com/ralhaidhani/flapatlas-models/main'));

  const entries = buildManifestForBaseUrl(DEFAULT_CDN_MODEL_BASE_URL);
  assert.equal(entries.length, 7);
  assert.deepEqual(
    entries.map((e) => e.fileName),
    [
      'skeleton.glb',
      'muscles.glb',
      'skin.glb',
      'arteries.glb',
      'veins.glb',
      'nerves.glb',
      'organs.glb',
    ]
  );
  for (const e of entries) {
    assert.ok(
      e.fallbackUrls.some((u) => u.startsWith(DEFAULT_RAW_MODEL_BASE_URL)),
      `${e.fileName} must include GitHub Raw fallback URL`
    );
  }
  const organs = entries.find((e) => e.system === 'organs');
  assert.equal(organs?.hiddenByDefault, true);
  assert.equal(organs?.stage, 3);

  const other = DEFAULT_MODEL_MANIFEST.find((e) => e.system === 'other');
  assert.equal(other?.enabledByDefault, false);

  const stages = groupManifestByStage(entries);
  assert.equal(stages.length, 3);
  assert.deepEqual(stages[0].entries.map((e) => e.system), ['skeleton', 'muscles']);
  assert.deepEqual(stages[1].entries.map((e) => e.system), ['skin', 'arteries', 'veins', 'nerves']);
  assert.deepEqual(stages[2].entries.map((e) => e.system), ['organs']);
});

test('Phase 10b: FMA name normalization, FMA<->TA aliases, logical muscle groups, and FJ/FMA unmapped report', () => {
  const ctx = { vessels: VESSELS, flaps: INITIAL_FLAPS };

  // Strip [FJxxxx] and left/right/bilateral
  const parsed = parseTerminologiaMeshName('right vastus lateralis [FJ1234]');
  assert.equal(parsed.normalizedName, 'vastus lateralis');
  assert.equal(parsed.laterality, 'right');

  // FMA <-> TA alias: fibularis longus <-> peroneus longus
  const fibLongus = mapMeshNameToAnatomy('left fibularis longus [FJ2210]', 'muscles', ctx);
  assert.equal(fibLongus.mapped, true);
  assert.equal(fibLongus.laterality, 'left');

  // Logical muscle groups
  const deltoidClav = resolveLogicalAnatomyGroup('clavicular part of deltoid [FJ1001]');
  const deltoidAcrom = resolveLogicalAnatomyGroup('acromial part of deltoid [FJ1002]');
  const deltoidSpin = resolveLogicalAnatomyGroup('spinal part of deltoid [FJ1003]');
  assert.equal(deltoidClav?.groupId, 'group:deltoid');
  assert.equal(deltoidAcrom?.groupId, 'group:deltoid');
  assert.equal(deltoidSpin?.groupId, 'group:deltoid');

  const pecMajor = resolveLogicalAnatomyGroup('right sternocostal part of pectoralis major [FJ1101]');
  assert.equal(pecMajor?.groupId, 'group:pectoralis_major');

  const trap = resolveLogicalAnatomyGroup('descending part of trapezius [FJ1110]');
  assert.equal(trap?.groupId, 'group:trapezius');

  const biceps = resolveLogicalAnatomyGroup('long head of biceps brachii [FJ1120]');
  assert.equal(biceps?.groupId, 'group:biceps_brachii');

  const quad = resolveLogicalAnatomyGroup('right vastus lateralis [FJ1234]');
  assert.equal(quad?.groupId, 'group:quadriceps_femoris');

  // Unmapped meshes report includes fj, fma, normalizedName, system
  const report = buildMeshMappingReport(
    [
      {
        meshName: 'left mystery tendon slip [FJ9999]',
        system: 'muscles',
        fj: 'FJ9999',
        fma: 'FMA99999',
        side: 'left',
      },
    ],
    'BodyParts3D 4.0',
    ctx
  );
  assert.equal(report.unmappedCount, 1);
  assert.equal(report.unmappedEntries[0].fj, 'FJ9999');
  assert.equal(report.unmappedEntries[0].fma, 'FMA99999');
  assert.equal(report.unmappedEntries[0].normalizedName, 'mystery tendon slip');
  assert.equal(report.unmappedEntries[0].system, 'muscles');
});

test('Phase 10b: Search matches anatomical name, FMA<->TA alias, logical group, FMA ID, and FJ ID', () => {
  const structures: SearchableAnatomyStructure[] = [
    {
      key: 'muscles:muscle:1',
      meshName: 'clavicular part of deltoid [FJ1001]',
      label: 'Deltoid — Clavicular part',
      category: 'Muscle',
      system: 'muscles',
      laterality: 'right',
      mapped: true,
      anatomyId: 'deltoid',
      groupId: 'group:deltoid',
      groupLabel: 'Deltoid',
      partLabel: 'clavicular part',
      fjCode: 'FJ1001',
      fmaCode: 'FMA32521',
      center: [-0.2, 1.42, 0.02],
      boundsMin: [-0.24, 1.38, -0.02],
      boundsMax: [-0.16, 1.46, 0.06],
      linkedFlapIds: [],
    },
    {
      key: 'muscles:muscle:2',
      meshName: 'left fibularis longus [FJ2210]',
      label: 'Fibularis Longus (L)',
      category: 'Muscle',
      system: 'muscles',
      laterality: 'left',
      mapped: true,
      anatomyId: 'peroneus_longus',
      fjCode: 'FJ2210',
      fmaCode: 'FMA22539',
      center: [0.11, 0.28, -0.01],
      boundsMin: [0.09, 0.14, -0.03],
      boundsMax: [0.13, 0.42, 0.01],
      linkedFlapIds: ['fibula-free-flap'],
    },
  ];

  // Search by logical group
  assert.equal(searchAnatomyStructures(structures, 'deltoid')[0]?.groupId, 'group:deltoid');
  // Search by TA alias ("peroneus longus") finds FMA "fibularis longus"
  assert.equal(searchAnatomyStructures(structures, 'peroneus longus')[0]?.fjCode, 'FJ2210');
  // Search by FJ ID
  assert.equal(searchAnatomyStructures(structures, 'FJ1001')[0]?.key, 'muscles:muscle:1');
  // Search by FMA ID
  assert.equal(searchAnatomyStructures(structures, 'FMA22539')[0]?.key, 'muscles:muscle:2');
});

test('Phase 10c: Honest schematic badges for absent BP3D muscles & peripheral nerves + bony-anchored outline', () => {
  const ldFlap = INITIAL_FLAPS.find((f) => f.name.toLowerCase().includes('latissimus dorsi'));
  const tramFlap = INITIAL_FLAPS.find((f) => f.name.toLowerCase().includes('tram'));
  const altFlap = INITIAL_FLAPS.find((f) => f.name.toLowerCase().includes('anterolateral thigh'));
  const suralFlap = INITIAL_FLAPS.find((f) => f.name.toLowerCase().includes('sural'));

  assert.ok(ldFlap && tramFlap && altFlap && suralFlap);

  const ldCov = assessFlapBp3dCoverage(ldFlap);
  assert.equal(ldCov.hasSchematicDependency, true);
  assert.equal(ldCov.muscleBadge, SCHEMATIC_MUSCLE_BADGE);
  assert.equal(ldCov.missingMuscle?.id, 'latissimus_dorsi');

  const tramCov = assessFlapBp3dCoverage(tramFlap);
  assert.equal(tramCov.hasSchematicDependency, true);
  assert.equal(tramCov.muscleBadge, SCHEMATIC_MUSCLE_BADGE);
  assert.equal(tramCov.missingMuscle?.id, 'rectus_abdominis');

  // ALT uses vastus lateralis (present in BP3D) so missingMuscle must be null,
  // while its sensory lateral femoral cutaneous nerve is peripheral -> schematic nerve badge
  const altCov = assessFlapBp3dCoverage(altFlap);
  assert.equal(altCov.missingMuscle, null);
  assert.equal(altCov.muscleBadge, null);
  assert.equal(altCov.nerveBadge, SCHEMATIC_NERVE_BADGE);

  const suralCov = assessFlapBp3dCoverage(suralFlap);
  assert.equal(suralCov.nerveBadge, SCHEMATIC_NERVE_BADGE);

  // Build bony-landmark-anchored schematic outline for latissimus dorsi
  const anchorsById: Record<string, [number, number, number]> = {};
  for (const a of DEFAULT_ANCHORS) {
    anchorsById[a.id] = a.position;
  }
  const outline = buildSchematicMuscleOutline('latissimus_dorsi', 'right', anchorsById);
  assert.ok(outline, 'Latissimus dorsi schematic outline must build from bony anchors');
  assert.equal(outline.center.length, 3);
  assert.ok(outline.anchorPoints.length >= 3);
  assert.ok(SCHEMATIC_ONLY_STRUCTURES_CATALOG.length >= 8);
});

test('Phase 10d: Liver hepatovenous segment stays in organs; ALT primary pedicle is FJ2057/FJ2063; 13 bp3d-4.0 anchors auto-propose & reject stale overrides', () => {
  // Liver hepatovenous segment classification
  assert.equal(classifyMaterialBucket('veins', 'hepatovenous segment II [FJ4410]'), 'organ');
  assert.equal(classifyMaterialBucket('organs', 'hepatovenous segment IV [FJ4412]'), 'organ');

  // ALT primary pedicle = descending branch of LCFA (FJ2057 right / FJ2063 left), parent LCFA secondary (FJ2158 right / FJ2078 left)
  const altFlap = INITIAL_FLAPS.find((f) => f.name.toLowerCase().includes('anterolateral thigh'));
  assert.ok(altFlap);
  const makeVessel = (fj: string, name: string, side: 'right' | 'left'): MergedSubMeshRecord => ({
    meshKey: `arteries:artery:${fj}`,
    subMeshIndex: 1,
    meshName: `${name} [${fj}]`,
    system: 'arteries',
    materialBucket: 'artery',
    anatomyId: fj,
    label: name,
    category: 'Artery',
    laterality: side,
    mapped: true,
    linkedFlapIds: [altFlap.id],
    sourceModel: 'bodyparts3d',
    fjCode: fj,
    vertexStart: 0,
    vertexCount: 10,
    indexStart: 0,
    indexCount: 12,
    center: [side === 'right' ? -0.1 : 0.1, 0.72, 0.04],
    boundsMin: [-0.12, 0.65, 0.02],
    boundsMax: [0.12, 0.78, 0.06],
  });

  const altMeshes = [
    makeVessel('FJ2057', 'right descending branch of lateral circumflex femoral artery', 'right'),
    makeVessel('FJ2158', 'right lateral circumflex femoral artery', 'right'),
    makeVessel('FJ2063', 'left descending branch of lateral circumflex femoral artery', 'left'),
    makeVessel('FJ2078', 'left lateral circumflex femoral artery', 'left'),
  ];
  const rightAlt = resolveFlapRealVessels(altFlap, 'right', altMeshes);
  const rightDesc = rightAlt.resolvedVessels.find((v) => v.fjCode === 'FJ2057');
  const rightParent = rightAlt.resolvedVessels.find((v) => v.fjCode === 'FJ2158');
  assert.equal(rightDesc?.pedicleTier, 'primary');
  assert.equal(rightParent?.pedicleTier, 'secondary');

  const leftAlt = resolveFlapRealVessels(altFlap, 'left', altMeshes);
  const leftDesc = leftAlt.resolvedVessels.find((v) => v.fjCode === 'FJ2063');
  const leftParent = leftAlt.resolvedVessels.find((v) => v.fjCode === 'FJ2078');
  assert.equal(leftDesc?.pedicleTier, 'primary');
  assert.equal(leftParent?.pedicleTier, 'secondary');

  // 13 landmarks tagged bp3d-4.0
  const defaults = DEFAULT_ANCHORS;
  assert.equal(defaults.length, 13);
  assert.ok(defaults.every((a) => a.modelVersion === ANCHOR_MODEL_VERSION));
  assert.ok(defaults.some((a) => a.id === 'iliac_crest'));
  assert.ok(defaults.some((a) => a.id === 'greater_trochanter'));

  // Stale anchor detection & rejection
  const staleOverrides = {
    asis: {
      id: 'asis' as const,
      position: [-0.14, 0.99, 0.11] as [number, number, number],
      updatedAtIso: '2025-01-01T00:00:00Z',
      // Missing modelVersion or legacy version
    },
  };
  const staleCheck = detectStaleAnchorCalibration(staleOverrides);
  assert.equal(staleCheck.hasStaleEntries, true);
  assert.deepEqual(staleCheck.staleIds, ['asis']);
  const merged = mergeAnchorsWithCalibration(defaults, staleOverrides);
  const mergedAsis = merged.find((a) => a.id === 'asis');
  assert.equal(mergedAsis?.source, 'default', 'Stale pre-bp3d-4.0 anchor overrides must be ignored');

  // Auto-propose from BP3D skeleton sub-meshes
  const mockBone = (name: string, min: [number, number, number], max: [number, number, number]): MergedSubMeshRecord => ({
    meshKey: `skeleton:bone:${name}`,
    subMeshIndex: 1,
    meshName: name,
    system: 'skeleton',
    materialBucket: 'bone',
    anatomyId: name,
    label: name,
    category: 'Skeleton',
    laterality: 'right',
    mapped: true,
    linkedFlapIds: [],
    sourceModel: 'bodyparts3d',
    vertexStart: 0,
    vertexCount: 10,
    indexStart: 0,
    indexCount: 12,
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    boundsMin: min,
    boundsMax: max,
  });

  const proposed = proposeBp3dAnchorsFromSubMeshes([
    mockBone('right hip bone [FJ100]', [-0.14, 0.72, -0.08], [-0.01, 0.94, 0.08]),
    mockBone('right femur [FJ101]', [-0.15, 0.42, -0.04], [-0.06, 0.82, 0.04]),
    mockBone('right patella [FJ102]', [-0.11, 0.43, 0.03], [-0.07, 0.47, 0.06]),
    mockBone('right fibula [FJ103]', [-0.12, 0.04, -0.03], [-0.09, 0.40, 0.01]),
    mockBone('right humerus [FJ104]', [-0.24, 1.02, -0.03], [-0.15, 1.38, 0.02]),
    mockBone('right scapula [FJ105]', [-0.19, 1.18, -0.12], [-0.06, 1.40, -0.04]),
    mockBone('right temporal bone [FJ106]', [-0.08, 1.48, -0.04], [-0.03, 1.56, 0.02]),
  ]);

  assert.ok(proposed.asis, 'ASIS must be proposed from hip bone');
  assert.ok(proposed.psis, 'PSIS must be proposed from hip bone');
  assert.ok(proposed.pubic_tubercle, 'Pubic tubercle must be proposed from hip bone');
  assert.ok(proposed.iliac_crest, 'Iliac crest must be proposed from hip bone');
  assert.ok(proposed.greater_trochanter, 'Greater trochanter must be proposed from femur');
  assert.ok(proposed.superolateral_patella, 'Patella landmark must be proposed');
  assert.ok(proposed.fibular_head, 'Fibular head must be proposed');
  assert.ok(proposed.lateral_malleolus, 'Lateral malleolus must be proposed');
  assert.ok(proposed.medial_epicondyle, 'Medial epicondyle must be proposed');
  assert.ok(proposed.acromion, 'Acromion must be proposed');
  assert.ok(proposed.inferior_angle_scapula, 'Inferior angle of scapula must be proposed');
  assert.ok(proposed.mastoid, 'Mastoid must be proposed');
  assert.equal(proposed.asis.modelVersion, ANCHOR_MODEL_VERSION);
});

test('Phase 10e: Exact verbatim attribution text contains BodyParts3D CC BY 4.0 and zero Z-Anatomy text', () => {
  assert.equal(
    BODYPARTS3D_PHASE10_ATTRIBUTION,
    'Anatomical geometry: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International. Modified: converted from OBJ to glTF, axes and units transformed, split by body system, Draco-compressed, names normalised.'
  );
  assert.ok(!BODYPARTS3D_PHASE10_ATTRIBUTION.toLowerCase().includes('z-anatomy'));
});
