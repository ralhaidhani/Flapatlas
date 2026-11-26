import {
  BODY_ANGIOSOME_BY_ID,
  DESIGN_PRINCIPLES,
  FIG_23_46_UPPER_LIMB_CUTANEOUS_NERVES,
  HEAD_NECK_ANGIOSOME_BY_ID,
  HEAD_NECK_CLINICAL_NOTES,
  headNeckMuscleTerritories,
  LEG_AND_FOREARM_TERRITORY_NOTES,
  MUSCLE_TERRITORIES,
  MUSCLE_VENOUS_TYPE_DESCRIPTIONS,
  NEUROVASCULAR_TYPE_DESCRIPTIONS,
  type DesignPrincipleRecord,
  type MuscleVenousType,
  type NeurovascularType,
  type TerritorySourceRef,
} from '../data/territories/index';
import {
  ABSENT_BP3D_MUSCLES,
  SCHEMATIC_MUSCLE_BADGE,
  type AbsentBp3dStructureInfo,
} from './bp3dCoverage';
import type {
  MuscleCalibrationEntry,
  TerritoryCalibrationReport,
} from './territoryCalibration';
import { TERRITORY_SLOT_BY_ID } from './territoryPalette';

/**
 * Phase 11d (§5) — Pure Deep-Tissue Resolver: Muscle, Bone & Nerve.
 *
 * Strictly read-only educational synthesis from Morris & Taylor (Neligan Vol. 1, Ch. 23):
 * - Muscles: merges Leg Table 23.2, Head & Neck Table 23.3, Forearm Figs 23.26–23.29,
 *   Neurovascular Table 23.1 (Type I–IV), Venous Fig 23.14 (Type I–III), and the 7 muscles
 *   absent from BodyParts3D 4.0 (rendered via bony-landmark schematic outlines).
 * - Bone: general periosteal / muscular / nutrient supply + Radius/Ulna and Tibia/Fibula
 *   text cards. Never invents osseous territory boundaries beyond the 3-D field.
 * - Nerves: educational neurovascular pattern cards A–E (Figs 23.15–23.16) + Fig 23.46
 *   upper-limb cutaneous nerve list. Zero peripheral nerve geometry drawn on the 3-D body.
 */

export type DeepTissueMuscleGroup =
  | 'leg'
  | 'forearm'
  | 'head_neck'
  | 'trunk_limb_nv'
  | 'absent_bp3d';

export interface DeepTissueAngiosomeChip {
  territoryId: string;
  label: string;
  shortLabel: string;
  hexStandard: string;
  hexColorblind: string;
}

export interface DeepTissueMuscleEntry {
  id: string;
  name: string;
  normalizedName: string;
  regionGroup: DeepTissueMuscleGroup;
  /** Book territory count from Table 23.2 / Table 23.3 / Forearm text (never invented) */
  territoryCount?: number;
  territoryCountVariant?: number;
  /** Human-readable clinical badge (e.g. "Three territories", "One territory") */
  territoryCountBadge: string | null;
  neurovascularType?: NeurovascularType;
  neurovascularLabel?: string;
  neurovascularMeaning?: string;
  venousType?: MuscleVenousType;
  venousLabel?: string;
  venousSummary?: string;
  bp3dPresent: boolean;
  /** Non-null when absent from BP3D 4.0 */
  schematicTag: string | null;
  /** Key passed to `buildSchematicMuscleOutline()` when `!bp3dPresent` */
  schematicOutlineId: string | null;
  anchorLandmarkIds: string[];
  supplyingAngiosomes: DeepTissueAngiosomeChip[];
  clinicalNote?: string;
  sourceRef: TerritorySourceRef;
  calibrationEntry?: MuscleCalibrationEntry;
}

export interface DeepTissueMuscleCatalog {
  leg: DeepTissueMuscleEntry[];
  forearm: DeepTissueMuscleEntry[];
  headNeck: DeepTissueMuscleEntry[];
  trunkLimbNv: DeepTissueMuscleEntry[];
  absentBp3d: DeepTissueMuscleEntry[];
  all: DeepTissueMuscleEntry[];
}

export interface BoneEducationalCard {
  id: 'bone-radius-ulna' | 'bone-tibia-fibula';
  title: string;
  summary: string;
  focusRegion: 'forearm' | 'lower_leg';
  focusButtonLabel: string;
  bonesMatched: string[];
  relatedAngiosomes: DeepTissueAngiosomeChip[];
  sourceRef: TerritorySourceRef;
}

export interface BoneDeepTissueInfo {
  boneLabel: string;
  generalSupplyNote: string;
  noInventedBordersNote: string;
  specificCard: BoneEducationalCard | null;
}

export interface NeurovascularEducationalData {
  noGeometryNotice: string;
  patterns: DesignPrincipleRecord[];
  clinicalExamples: DesignPrincipleRecord | null;
  upperLimbCutaneousNerves: readonly string[];
  sourceRef: TerritorySourceRef;
}

/** The 7 muscles explicitly named as absent from BP3D in Phase 11 §5. */
export const REQUIRED_ABSENT_BP3D_MUSCLE_IDS: readonly string[] = [
  'latissimus_dorsi',
  'rectus_abdominis',
  'internal_oblique',
  'transversus_abdominis',
  'quadratus_lumborum',
  'masseter',
  'temporalis',
];

export const BONE_GENERAL_SUPPLY_NOTE =
  'Bone is supplied through attached muscles, periosteal plexuses, and nutrient branches rather than isolated osseous angiosomes.';

export const BONE_NO_INVENTED_BORDERS_NOTE =
  'Skeleton colouring follows the shared 3-D vascular territory field — no separate osseous territory boundaries are invented.';

export const NERVE_NO_GEOMETRY_NOTICE =
  'Educational neurovascular pattern cards only — BodyParts3D has no peripheral nerve geometry; no peripheral nerves are drawn on the 3-D body.';

const NUMBER_WORD_MAP: Readonly<Record<number, string>> = {
  1: 'One',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
};

/**
 * Formats a book muscle territory count cleanly without inventing unprinted counts.
 * E.g. 1 -> "One territory", 3 -> "Three territories", 4 (variant 5) -> "Four (or five) territories".
 */
export function formatMuscleTerritoryCountBadge(
  count?: number,
  variant?: number
): string | null {
  if (typeof count !== 'number' || count <= 0) return null;
  const word = NUMBER_WORD_MAP[count] ?? String(count);
  if (typeof variant === 'number' && variant > count) {
    const varWord = (NUMBER_WORD_MAP[variant] ?? String(variant)).toLowerCase();
    return `${word} (or ${varWord}) territories`;
  }
  return count === 1 ? `${word} territory` : `${word} territories`;
}

function normalizeLookupKey(raw: string): string {
  return raw
    .replace(/\[[^\]]+\]/g, '')
    .toLowerCase()
    .replace(/\b(left|right|bilateral|muscle|musculus|m\.|head of|belly of|medial head of|lateral head of|long head of|short head of|anterior part of|posterior part of|upper|lower)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const MUSCLE_LOOKUP_ALIASES: Readonly<Record<string, string>> = {
  'peroneus longus': 'fibularis longus',
  'peroneus brevis': 'fibularis brevis',
  'peroneus tertius': 'fibularis tertius',
  'fibularis longus': 'fibularis longus',
  'fibularis brevis': 'fibularis brevis',
  'fibularis tertius': 'fibularis tertius',
  'internal abdominal oblique': 'internal oblique',
  'abdominal internal oblique': 'internal oblique',
  'transverse abdominal': 'transversus abdominis',
  'triceps': 'triceps brachii',
  'biceps': 'biceps brachii',
  'scm': 'sternocleidomastoid',
  'ecrl': 'extensor carpi radialis longus',
  'ecrb': 'extensor carpi radialis brevis',
  'fdp': 'flexor digitorum profundus',
  'fcu': 'flexor carpi ulnaris',
  'fds': 'flexor digitorum superficialis',
  'scalenus anterior': 'anterior scalene',
  'scalenus medius': 'middle scalene',
  'scalenus posterior': 'posterior scalene',
  'longus cervicis': 'longus colli',
  'latissimus dorsi': 'latissimus dorsi',
  'rectus abdominis': 'rectus abdominis',
  'quadratus lumborum': 'quadratus lumborum',
  'erector spinae': 'erector spinae',
};

const ABSENT_OUTLINE_ID_BY_NORMALIZED_NAME: Readonly<Record<string, string>> = {
  'latissimus dorsi': 'latissimus_dorsi',
  'rectus abdominis': 'rectus_abdominis',
  'internal oblique': 'internal_oblique',
  'internal abdominal oblique': 'internal_oblique',
  'transversus abdominis': 'transversus_abdominis',
  'quadratus lumborum': 'quadratus_lumborum',
  masseter: 'masseter',
  temporalis: 'temporalis',
  'erector spinae': 'erector_spinae',
};

function resolveAngiosomeChips(ids: readonly string[]): DeepTissueAngiosomeChip[] {
  const out: DeepTissueAngiosomeChip[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    const slot = TERRITORY_SLOT_BY_ID.get(id);
    if (!slot) continue;
    seen.add(id);
    const body = BODY_ANGIOSOME_BY_ID.get(id);
    const hn = HEAD_NECK_ANGIOSOME_BY_ID.get(id);
    out.push({
      territoryId: id,
      label: body ? `${body.fig23_23Number}. ${body.name}` : hn ? `HN-${hn.fig23_37Number}. ${hn.name}` : slot.label,
      shortLabel: slot.shortLabel,
      hexStandard: slot.hexStandard,
      hexColorblind: slot.hexColorblind,
    });
  }
  return out;
}

function findAbsentRecord(outlineId: string | null): AbsentBp3dStructureInfo | undefined {
  if (!outlineId) return undefined;
  return ABSENT_BP3D_MUSCLES.find((m) => m.id === outlineId);
}

function attachCalibration(
  normalizedName: string,
  report?: TerritoryCalibrationReport | null
): MuscleCalibrationEntry | undefined {
  if (!report) return undefined;
  const target = normalizeLookupKey(normalizedName);
  const canonical = MUSCLE_LOOKUP_ALIASES[target] ?? target;
  return report.entries.find((e) => {
    const en = normalizeLookupKey(e.normalizedName);
    const ec = MUSCLE_LOOKUP_ALIASES[en] ?? en;
    return ec === canonical;
  });
}

function buildAllDeepTissueMuscleEntries(
  calibrationReport?: TerritoryCalibrationReport | null
): DeepTissueMuscleEntry[] {
  const byNorm = new Map<string, DeepTissueMuscleEntry>();

  // 1. Seed from MUSCLE_TERRITORIES (Table 23.2 Leg, Forearm Figs 23.26-29, Table 23.1 NV, Fig 23.14 Venous)
  for (const m of MUSCLE_TERRITORIES) {
    const norm = m.normalizedAnatomyName.toLowerCase();
    const outlineId = !m.bp3dPresent ? ABSENT_OUTLINE_ID_BY_NORMALIZED_NAME[norm] ?? null : null;
    const absentRec = findAbsentRecord(outlineId);
    const nvMeta = m.neurovascularType ? NEUROVASCULAR_TYPE_DESCRIPTIONS[m.neurovascularType] : undefined;
    const venousMeta = m.venousType ? MUSCLE_VENOUS_TYPE_DESCRIPTIONS[m.venousType] : undefined;

    const regionGroup: DeepTissueMuscleGroup = !m.bp3dPresent
      ? 'absent_bp3d'
      : m.region === 'leg'
        ? 'leg'
        : m.region === 'forearm'
          ? 'forearm'
          : m.region === 'head_neck'
            ? 'head_neck'
            : 'trunk_limb_nv';

    byNorm.set(norm, {
      id: m.id,
      name: m.name,
      normalizedName: norm,
      regionGroup,
      territoryCount: m.angiosomeCount,
      territoryCountVariant: m.angiosomeCountVariant,
      territoryCountBadge: formatMuscleTerritoryCountBadge(
        m.angiosomeCount,
        m.angiosomeCountVariant
      ),
      neurovascularType: m.neurovascularType,
      neurovascularLabel: nvMeta?.label,
      neurovascularMeaning: nvMeta?.clinicalMeaning,
      venousType: m.venousType,
      venousLabel: venousMeta?.label,
      venousSummary: venousMeta?.summary,
      bp3dPresent: m.bp3dPresent,
      schematicTag: m.bp3dPresent ? null : SCHEMATIC_MUSCLE_BADGE,
      schematicOutlineId: outlineId,
      anchorLandmarkIds: absentRec?.anchorLandmarkIds ?? [],
      supplyingAngiosomes: resolveAngiosomeChips(m.supplyingAngiosomeIds),
      clinicalNote: m.clinicalNote,
      sourceRef: m.sourceRef,
      calibrationEntry: attachCalibration(norm, calibrationReport),
    });
  }

  // 2. Merge Head & Neck Table 23.3 muscles (enriching overlapping entries like trapezius, digastric, levator scapulae)
  for (const hnm of headNeckMuscleTerritories) {
    if (hnm.group === 'aerodigestive') continue; // Aerodigestive mucosal structures are Table 23.4, not skeletal muscle outlines
    const norm = hnm.normalizedAnatomyName.toLowerCase();
    const existing = byNorm.get(norm);
    if (existing) {
      if (existing.territoryCount === undefined) {
        existing.territoryCount = hnm.territoryCount;
        existing.territoryCountVariant = hnm.territoryCountVariant;
        existing.territoryCountBadge = formatMuscleTerritoryCountBadge(
          hnm.territoryCount,
          hnm.territoryCountVariant
        );
      }
      if (!existing.clinicalNote && (hnm.clinicalNote || hnm.variantNote)) {
        existing.clinicalNote = hnm.clinicalNote ?? hnm.variantNote;
      }
      continue;
    }

    const outlineId = !hnm.bp3dPresent
      ? ABSENT_OUTLINE_ID_BY_NORMALIZED_NAME[norm] ?? null
      : null;
    const absentRec = findAbsentRecord(outlineId);

    const hnSupplyIds =
      hnm.group === 'mastication'
        ? ['angio-3', 'angio-5', 'angio-2']
        : norm === 'sternocleidomastoid'
          ? ['angio-6', 'angio-1', 'angio-8']
          : norm === 'trapezius'
            ? ['angio-8', 'angio-6', 'angio-10']
            : ['angio-6', 'angio-7', 'angio-8'];

    byNorm.set(norm, {
      id: hnm.id,
      name: hnm.name,
      normalizedName: norm,
      regionGroup: hnm.bp3dPresent ? 'head_neck' : 'absent_bp3d',
      territoryCount: hnm.territoryCount,
      territoryCountVariant: hnm.territoryCountVariant,
      territoryCountBadge: formatMuscleTerritoryCountBadge(
        hnm.territoryCount,
        hnm.territoryCountVariant
      ),
      bp3dPresent: hnm.bp3dPresent,
      schematicTag: hnm.bp3dPresent ? null : SCHEMATIC_MUSCLE_BADGE,
      schematicOutlineId: outlineId,
      anchorLandmarkIds: absentRec?.anchorLandmarkIds ?? [],
      supplyingAngiosomes: resolveAngiosomeChips(hnSupplyIds),
      clinicalNote: hnm.clinicalNote ?? hnm.variantNote,
      sourceRef: hnm.sourceRef,
      calibrationEntry: attachCalibration(norm, calibrationReport),
    });
  }

  // 3. Ensure ALL 7 explicitly named absent BP3D muscles (§5) exist with schematic outlines & honest notes
  const supplementaryAbsentMeta: Array<{
    outlineId: string;
    normalizedName: string;
    name: string;
    supplyingAngiosomeIds: string[];
    clinicalNote: string;
  }> = [
    {
      outlineId: 'transversus_abdominis',
      normalizedName: 'transversus abdominis',
      name: 'Transversus abdominis',
      supplyingAngiosomeIds: ['angio-33', 'angio-17', 'angio-18'],
      clinicalNote:
        'Absent in BodyParts3D 4.0 — shown as a bony-landmark schematic outline (iliac crest, ASIS, umbilicus). Deep abdominal wall muscle traversed by DCIA, intercostal, and lumbar territories; territory count & Table 23.1 NV type not separately tabulated in Ch. 23.',
    },
    {
      outlineId: 'quadratus_lumborum',
      normalizedName: 'quadratus lumborum',
      name: 'Quadratus lumborum',
      supplyingAngiosomeIds: ['angio-18', 'angio-33'],
      clinicalNote:
        'Absent in BodyParts3D 4.0 — shown as a bony-landmark schematic outline (iliac crest, PSIS). Posterior abdominal wall muscle within the lumbar / DCIA deep zone; territory count & Table 23.1 NV type not separately tabulated in Ch. 23.',
    },
  ];

  for (const sup of supplementaryAbsentMeta) {
    if (byNorm.has(sup.normalizedName)) continue;
    const absentRec = findAbsentRecord(sup.outlineId);
    byNorm.set(sup.normalizedName, {
      id: `muscle-${sup.outlineId.replace(/_/g, '-')}`,
      name: sup.name,
      normalizedName: sup.normalizedName,
      regionGroup: 'absent_bp3d',
      territoryCount: undefined,
      territoryCountBadge: null,
      bp3dPresent: false,
      schematicTag: SCHEMATIC_MUSCLE_BADGE,
      schematicOutlineId: sup.outlineId,
      anchorLandmarkIds: absentRec?.anchorLandmarkIds ?? [],
      supplyingAngiosomes: resolveAngiosomeChips(sup.supplyingAngiosomeIds),
      clinicalNote: sup.clinicalNote,
      sourceRef: {
        chapter: 23,
        page: '328–332',
        figureOrTable: 'Text / BP3D 4.0 Coverage',
      },
    });
  }

  return Array.from(byNorm.values());
}

/**
 * Returns the complete grouped Deep-Tissue Muscle Catalog for UI browsing & unit tests.
 */
export function getDeepTissueMuscleCatalog(
  calibrationReport?: TerritoryCalibrationReport | null
): DeepTissueMuscleCatalog {
  const all = buildAllDeepTissueMuscleEntries(calibrationReport);

  const leg = all
    .filter((m) => m.regionGroup === 'leg')
    .sort((a, b) => (b.territoryCount ?? 0) - (a.territoryCount ?? 0) || a.name.localeCompare(b.name));

  const forearm = all
    .filter((m) => m.regionGroup === 'forearm')
    .sort((a, b) => (a.territoryCount ?? 99) - (b.territoryCount ?? 99) || a.name.localeCompare(b.name));

  const headNeck = all
    .filter((m) => m.regionGroup === 'head_neck')
    .sort((a, b) => (b.territoryCount ?? 0) - (a.territoryCount ?? 0) || a.name.localeCompare(b.name));

  const trunkLimbNv = all
    .filter((m) => m.regionGroup === 'trunk_limb_nv')
    .sort((a, b) => a.name.localeCompare(b.name));

  // Order absent muscles with the 7 explicitly required §5 muscles first, followed by erector spinae
  const absentOrder = [...REQUIRED_ABSENT_BP3D_MUSCLE_IDS, 'erector_spinae'];
  const absentBp3d = all
    .filter((m) => !m.bp3dPresent && m.schematicOutlineId !== null)
    .sort((a, b) => {
      const ia = absentOrder.indexOf(a.schematicOutlineId || '');
      const ib = absentOrder.indexOf(b.schematicOutlineId || '');
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  return {
    leg,
    forearm,
    headNeck,
    trunkLimbNv,
    absentBp3d,
    all,
  };
}

/**
 * Resolves any BP3D muscle name, muscle ID, or schematic outline ID to its Ch. 23 Deep Tissue profile.
 */
export function resolveMuscleDeepTissueInfo(
  nameOrId: string,
  calibrationReport?: TerritoryCalibrationReport | null
): DeepTissueMuscleEntry | null {
  if (!nameOrId || !nameOrId.trim()) return null;
  const all = buildAllDeepTissueMuscleEntries(calibrationReport);

  // Direct ID or schematicOutlineId match
  const exactId = all.find(
    (m) => m.id === nameOrId || m.schematicOutlineId === nameOrId
  );
  if (exactId) return exactId;

  const cleaned = normalizeLookupKey(nameOrId);
  if (!cleaned) return null;
  const canonical = MUSCLE_LOOKUP_ALIASES[cleaned] ?? cleaned;

  const exactNorm = all.find((m) => m.normalizedName === canonical);
  if (exactNorm) return exactNorm;

  // Substring fallback for composite BP3D labels (e.g. "Medial head of gastrocnemius", "Right gastrocnemius")
  const rawLower = nameOrId.toLowerCase();
  for (const m of all) {
    if (
      canonical.includes(m.normalizedName) ||
      rawLower.includes(m.normalizedName) ||
      (m.normalizedName.length >= 7 && m.normalizedName.includes(canonical) && canonical.length >= 6)
    ) {
      return m;
    }
  }

  // Check alias substring (e.g. "peroneus longus muscle" -> fibularis longus)
  for (const [alias, target] of Object.entries(MUSCLE_LOOKUP_ALIASES)) {
    if (cleaned.includes(alias) || rawLower.includes(alias)) {
      const hit = all.find((m) => m.normalizedName === target);
      if (hit) return hit;
    }
  }

  return null;
}

/**
 * Returns the two mandatory Ch. 23 Bone Vascular Supply text cards (Radius/Ulna & Tibia/Fibula).
 */
export function getBoneEducationalCards(): BoneEducationalCard[] {
  const radiusUlna = DESIGN_PRINCIPLES.find((p) => p.id === 'bone-radius-ulna');
  const tibiaFibula = DESIGN_PRINCIPLES.find((p) => p.id === 'bone-tibia-fibula');

  const cards: BoneEducationalCard[] = [];
  if (radiusUlna) {
    cards.push({
      id: 'bone-radius-ulna',
      title: radiusUlna.name,
      summary: radiusUlna.summary,
      focusRegion: 'forearm',
      focusButtonLabel: 'Frame Radius & Ulna',
      bonesMatched: ['radius', 'ulna'],
      relatedAngiosomes: resolveAngiosomeChips(['angio-16', 'angio-15', 'angio-39', 'angio-38']),
      sourceRef: radiusUlna.sourceRef,
    });
  }
  if (tibiaFibula) {
    cards.push({
      id: 'bone-tibia-fibula',
      title: tibiaFibula.name,
      summary: tibiaFibula.summary,
      focusRegion: 'lower_leg',
      focusButtonLabel: 'Frame Tibia & Fibula',
      bonesMatched: ['tibia', 'fibula'],
      relatedAngiosomes: resolveAngiosomeChips(['angio-24', 'angio-26', 'angio-30']),
      sourceRef: tibiaFibula.sourceRef,
    });
  }
  return cards;
}

/**
 * Resolves bone vascular supply context for any clicked BP3D skeleton mesh without inventing osseous boundaries.
 */
export function resolveBoneDeepTissueInfo(boneLabel: string): BoneDeepTissueInfo {
  const lower = boneLabel.toLowerCase();
  const cards = getBoneEducationalCards();

  let specificCard: BoneEducationalCard | null = null;
  if (/\bradius\b|\bulna\b/.test(lower)) {
    specificCard = cards.find((c) => c.id === 'bone-radius-ulna') ?? null;
  } else if (/\btibia\b|\bfibula\b/.test(lower)) {
    specificCard = cards.find((c) => c.id === 'bone-tibia-fibula') ?? null;
  }

  return {
    boneLabel,
    generalSupplyNote: BONE_GENERAL_SUPPLY_NOTE,
    noInventedBordersNote: BONE_NO_INVENTED_BORDERS_NOTE,
    specificCard,
  };
}

/**
 * Returns the educational Neurovascular Patterns A–E cards + Fig 23.46 cutaneous nerves list (§2.5 & §5).
 * Strictly educational cards only — never returns 3D nerve geometry.
 */
export function getNeurovascularEducationalData(): NeurovascularEducationalData {
  const allNv = DESIGN_PRINCIPLES.filter((p) => p.category === 'neurovascular_pattern');
  const patterns = allNv
    .filter((p) => Boolean(p.patternCode))
    .sort((a, b) => (a.patternCode || '').localeCompare(b.patternCode || ''));
  const clinicalExamples = allNv.find((p) => p.id === 'nv-clinical-examples') ?? null;

  return {
    noGeometryNotice: NERVE_NO_GEOMETRY_NOTICE,
    patterns,
    clinicalExamples,
    upperLimbCutaneousNerves: FIG_23_46_UPPER_LIMB_CUTANEOUS_NERVES,
    sourceRef: {
      chapter: 23,
      page: '326–328, 335',
      figureOrTable: 'Figs 23.15–23.16, 23.46',
    },
  };
}

/**
 * Paraphrased Ch. 23 clinical notes relevant to deep muscle vascular territories.
 */
export function getDeepMuscleClinicalNotes() {
  return [...LEG_AND_FOREARM_TERRITORY_NOTES, ...HEAD_NECK_CLINICAL_NOTES.slice(0, 2)];
}
