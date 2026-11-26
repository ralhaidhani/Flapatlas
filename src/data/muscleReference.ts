import { z } from 'zod';
import rawMuscleReferenceData from './muscleReference.json';
import type { Laterality } from '../models/anatomyMap';
import type { AnatomicalSystemId } from '../models/modelManifest';
import type { IndexedLoadedVessel } from '../models/vesselSearch';
import type { FlapRecord } from '../types/schemas';

export const MUSCLE_REFERENCE_FOOTER =
  "Summary of standard anatomical references (e.g. Gray's Anatomy); verify before teaching or clinical use.";

export const MuscleBloodSupplySchema = z.object({
  dominant: z.array(z.string()),
  minor: z.array(z.string()),
  mathesNahai: z.string().nullable(),
});

export const MuscleReferenceEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  bp3dGroup: z.string().min(1),
  inBodyParts3D: z.boolean(),
  region: z.string().min(1),
  origin: z.string(),
  insertion: z.string(),
  action: z.string(),
  bloodSupply: MuscleBloodSupplySchema,
  nerveSupply: z.string(),
  relatedFlaps: z.array(z.string()),
  pearl: z.string(),
  verificationStatus: z.enum(['needs_review', 'partially_verified', 'verified']),
});

export const MuscleReferenceDatasetSchema = z.object({
  schemaVersion: z.number().int().positive(),
  basis: z.string(),
  muscles: z.array(MuscleReferenceEntrySchema).min(1),
});

export type MuscleBloodSupply = z.infer<typeof MuscleBloodSupplySchema>;
export type MuscleReferenceEntry = z.infer<typeof MuscleReferenceEntrySchema>;
export type MuscleReferenceDataset = z.infer<typeof MuscleReferenceDatasetSchema>;

export const MUSCLE_REFERENCE_DATASET: MuscleReferenceDataset =
  MuscleReferenceDatasetSchema.parse(rawMuscleReferenceData);

export const MUSCLE_REFERENCES: readonly MuscleReferenceEntry[] =
  MUSCLE_REFERENCE_DATASET.muscles;

export const MUSCLE_REFERENCE_BY_ID: ReadonlyMap<string, MuscleReferenceEntry> = new Map(
  MUSCLE_REFERENCES.map((entry) => [entry.id, entry])
);

/**
 * Normalize an anatomical muscle string (group label, bp3dGroup, or mesh label)
 * into a canonical lowercase lookup token without side/part noise.
 */
export function normalizeMuscleLookupKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^group:/, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b(left|right|bilateral|midline)\b/g, ' ')
    .replace(
      /\b(clavicular|acromial|spinal|sternal|sternocostal|abdominal|descending|transverse|ascending|upper|middle|lower|medial|lateral|long|short|superficial|deep|anterior|posterior|superior|inferior)\s+(part|head|belly|portion|fibers|fibres)\s+(of\s+)?/g,
      ' '
    )
    .replace(/\b(part|head|belly|portion)\s+of\s+/g, ' ')
    .replace(/\bperoneus\b/g, 'fibularis')
    .replace(/\bfascia\s+lata\b/g, 'fasciae latae')
    .replace(/\bmuscles?\b/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MUSCLE_BY_NORMALIZED_KEY: ReadonlyMap<string, MuscleReferenceEntry> = (() => {
  const map = new Map<string, MuscleReferenceEntry>();
  for (const entry of MUSCLE_REFERENCES) {
    const keys = [
      entry.id.replace(/-/g, ' '),
      entry.bp3dGroup,
      entry.name,
      normalizeMuscleLookupKey(entry.bp3dGroup),
      normalizeMuscleLookupKey(entry.name),
    ];
    for (const k of keys) {
      const norm = normalizeMuscleLookupKey(k);
      if (norm && !map.has(norm)) {
        map.set(norm, entry);
      }
    }
  }
  // Common Latin / TA / abbreviated aliases pointing strictly to the 35 existing entries
  const aliases: Array<[string, string]> = [
    ['tfl', 'tfl'],
    ['tensor fascia lata', 'tfl'],
    ['tensor fasciae latae', 'tfl'],
    ['scm', 'sternocleidomastoid'],
    ['sternocleidomastoid', 'sternocleidomastoid'],
    ['fhl', 'flexor-hallucis-longus'],
    ['fcr', 'flexor-carpi-radialis'],
    ['fcu', 'flexor-carpi-ulnaris'],
    ['external abdominal oblique', 'external-oblique'],
    ['abdominal external oblique', 'external-oblique'],
    ['internal abdominal oblique', 'internal-oblique'],
    ['abdominal internal oblique', 'internal-oblique'],
    ['peroneus longus', 'fibularis-longus'],
    ['peroneus brevis', 'fibularis-brevis'],
    ['gastrocnemius', 'gastrocnemius'],
    ['triceps', 'triceps-brachii'],
    ['deltoid', 'deltoid'],
    ['pec major', 'pectoralis-major'],
    ['pec minor', 'pectoralis-minor'],
    ['latissimus', 'latissimus-dorsi'],
  ];
  for (const [alias, targetId] of aliases) {
    const found = MUSCLE_REFERENCE_BY_ID.get(targetId);
    const norm = normalizeMuscleLookupKey(alias);
    if (found && norm && !map.has(norm)) {
      map.set(norm, found);
    }
  }
  return map;
})();

export interface MuscleSelectionQuery {
  id?: string | null;
  label?: string | null;
  meshName?: string | null;
  normalizedName?: string | null;
  groupId?: string | null;
  groupLabel?: string | null;
  partLabel?: string | null;
}

/**
 * Resolve any tapped muscle or part of a logical muscle group to its entry in
 * muscleReference.json. Checks specific muscle identity first (so e.g.
 * Rectus femoris & Vastus lateralis inside group:quadriceps_femoris resolve to
 * their own entries) before falling back to bp3dGroup / groupId / groupLabel
 * (so any part of the deltoid resolves to "deltoid").
 */
export function findMuscleReferenceForSelection(
  query: MuscleSelectionQuery | null | undefined
): MuscleReferenceEntry | null {
  if (!query) return null;

  if (query.id) {
    const directById = MUSCLE_REFERENCE_BY_ID.get(query.id);
    if (directById) return directById;
    const hyphenId = query.id.replace(/_/g, '-').toLowerCase();
    const directHyphen = MUSCLE_REFERENCE_BY_ID.get(hyphenId);
    if (directHyphen) return directHyphen;
  }

  // Ordered candidates: specific part/muscle name BEFORE super-group,
  // then logical group (groupId/groupLabel) for multi-part muscles like Deltoid.
  const orderedCandidates = [
    query.partLabel,
    query.normalizedName,
    query.meshName,
    query.label,
    query.groupId,
    query.groupLabel,
    query.id,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  for (const raw of orderedCandidates) {
    const norm = normalizeMuscleLookupKey(raw);
    if (!norm) continue;
    const exact = MUSCLE_BY_NORMALIZED_KEY.get(norm);
    if (exact) return exact;
  }

  // Secondary substring match for verbose BP3D names (e.g., "clavicular head of pectoralis major")
  for (const raw of orderedCandidates) {
    const norm = normalizeMuscleLookupKey(raw);
    if (!norm) continue;
    for (const entry of MUSCLE_REFERENCES) {
      const grpNorm = normalizeMuscleLookupKey(entry.bp3dGroup);
      if (grpNorm.length >= 5 && (norm.includes(grpNorm) || grpNorm.includes(norm))) {
        return entry;
      }
    }
  }

  return null;
}

/**
 * Explicit keyword-to-flap-id hints so every relatedFlaps chip in muscleReference.json
 * resolves cleanly to the matching FlapRecord(s) in FlapAtlas 3D.
 */
const RELATED_FLAP_HINTS: Array<{ pattern: RegExp; flapIds: string[] }> = [
  { pattern: /\blatissimus dorsi\b/i, flapIds: ['ld-flap'] },
  { pattern: /\btdap\b|\bthoracodorsal artery perforator\b/i, flapIds: ['tdap-flap'] },
  { pattern: /\bpectoralis major\b/i, flapIds: ['pec-major-flap'] },
  { pattern: /\bserratus anterior\b/i, flapIds: ['serratus-anterior-flap'] },
  { pattern: /\btrapezius\b/i, flapIds: ['trapezius-flap'] },
  { pattern: /\bdeltopectoral\b/i, flapIds: ['deltopectoral-flap'] },
  { pattern: /\bpedicled tram\b|\bvram\b/i, flapIds: ['tram-flap', 'vram-flap'] },
  { pattern: /\bfree tram\b|\bmuscle-sparing tram\b/i, flapIds: ['tram-flap'] },
  { pattern: /\bdiep\b/i, flapIds: ['diep-flap'] },
  { pattern: /\bexternal oblique\b/i, flapIds: ['external-oblique-flap'] },
  { pattern: /\bdcia\b|\bdeep circumflex iliac\b/i, flapIds: ['dcia-flap'] },
  { pattern: /\bsgap\b/i, flapIds: ['sgap-flap'] },
  { pattern: /\bigap\b/i, flapIds: ['igap-flap'] },
  { pattern: /\bgluteal myocutaneous\b|\bgluteus maximus rotation/i, flapIds: ['gluteal-rotation-flap'] },
  { pattern: /\btfl\b|\btensor fascia/i, flapIds: ['tfl-flap'] },
  { pattern: /\balt\b|\banterolateral thigh\b/i, flapIds: ['alt-flap'] },
  { pattern: /\brectus femoris\b/i, flapIds: ['rectus-femoris-flap'] },
  { pattern: /\btug\b|\btransverse upper gracilis\b/i, flapIds: ['tug-flap'] },
  { pattern: /\bgracilis\b/i, flapIds: ['gracilis-flap'] },
  { pattern: /\bpap\b|\bprofunda artery perforator\b/i, flapIds: ['pap-flap'] },
  { pattern: /\bmsap\b|\bmedial sural artery perforator\b/i, flapIds: ['msap-flap'] },
  { pattern: /\bgastrocnemius\b/i, flapIds: ['gastrocnemius-flap'] },
  { pattern: /\bsoleus\b/i, flapIds: ['soleus-flap'] },
  { pattern: /\bposterior tibial\b/i, flapIds: ['ptap-flap'] },
  { pattern: /\bperoneal artery perforator\b/i, flapIds: ['peroneal-perforator-flap'] },
  { pattern: /\bfibula free flap\b/i, flapIds: ['fibula-flap'] },
  { pattern: /\bperoneus brevis\b|\bfibularis brevis\b/i, flapIds: ['peroneus-brevis-flap'] },
  { pattern: /\bradial forearm\b/i, flapIds: ['rfff-flap'] },
  { pattern: /\bulnar artery flap\b|\bulnar forearm\b/i, flapIds: ['ulnar-forearm-flap'] },
  { pattern: /\bsternocleidomastoid\b/i, flapIds: ['scm-flap'] },
  { pattern: /\bsubmental\b/i, flapIds: ['submental-island-flap'] },
  { pattern: /\btemporalis muscle flap\b/i, flapIds: ['temporalis-muscle-flap'] },
  { pattern: /\btemporoparietal fascia\b/i, flapIds: ['tpff-flap'] },
  { pattern: /\bscapular\b|\bparascapular\b/i, flapIds: ['scapular-flap'] },
  { pattern: /\blateral arm\b/i, flapIds: ['lateral-arm-flap'] },
  { pattern: /\bmedial plantar\b|\binstep\b/i, flapIds: ['medial-plantar-flap'] },
];

/**
 * Resolve a free-text entry from `muscle.relatedFlaps[]` to FlapRecord IDs present in `flaps`.
 */
export function findRelatedFlapIdsForText(chipText: string, flaps: FlapRecord[]): string[] {
  const availableIds = new Set(flaps.map((f) => f.id));
  const matched: string[] = [];

  for (const hint of RELATED_FLAP_HINTS) {
    if (hint.pattern.test(chipText)) {
      for (const id of hint.flapIds) {
        if (availableIds.has(id) && !matched.includes(id)) {
          matched.push(id);
        }
      }
    }
  }

  if (matched.length > 0) return matched;

  const lower = chipText.toLowerCase();
  for (const f of flaps) {
    const fName = f.name.toLowerCase();
    if (lower.includes(fName) || fName.includes(lower)) {
      if (!matched.includes(f.id)) matched.push(f.id);
    }
  }
  return matched;
}

/**
 * Find all MuscleReferenceEntry items whose relatedFlaps link to a given flapId.
 * Useful for showing clickable muscle reference chips (including schematic muscles
 * like Latissimus dorsi on LD / TDAP flaps) right on the Flap Detail panel.
 */
export function findMuscleReferencesForFlap(
  flapId: string,
  flaps: FlapRecord[]
): MuscleReferenceEntry[] {
  const results: MuscleReferenceEntry[] = [];
  for (const entry of MUSCLE_REFERENCES) {
    const linked = entry.relatedFlaps.some((txt) =>
      findRelatedFlapIdsForText(txt, flaps).includes(flapId)
    );
    if (linked) {
      results.push(entry);
    }
  }
  return results;
}

const VESSEL_STOP_WORDS = new Set([
  'artery',
  'arteries',
  'vein',
  'veins',
  'branch',
  'branches',
  'muscular',
  'perforating',
  'perforator',
  'perforators',
  'of',
  'the',
  'and',
  'from',
  'segmental',
  'minor',
  'pedicle',
  'pedicles',
  'multiple',
  'via',
  'to',
  'in',
  'a',
  'an',
  'with',
  'or',
  'deep',
  'superficial',
]);

function extractVesselSignatureTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(left|right|bilateral|midline)\b/g, ' ')
    .replace(/\bfibular\b/g, 'peroneal')
    .replace(/\binternal mammary\b/g, 'internal thoracic')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !VESSEL_STOP_WORDS.has(tok));
}

function normalizeVesselPhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(left|right|bilateral|midline)\b/g, ' ')
    .replace(/\bfibular\b/g, 'peroneal')
    .replace(/\binternal mammary\b/g, 'internal thoracic')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match a blood-supply chip text (e.g. "Posterior circumflex humeral artery",
 * "Thoracodorsal artery") against currently loaded 3D vessels so chips with
 * real 3D meshes are interactive and can highlight them in the viewport.
 */
export function findMatchingLoadedVesselsForText(
  vesselText: string,
  loadedVessels: IndexedLoadedVessel[],
  preferredSide?: Laterality
): IndexedLoadedVessel[] {
  if (!vesselText.trim() || loadedVessels.length === 0) return [];

  const targetPhrase = normalizeVesselPhrase(vesselText);
  const targetTokens = extractVesselSignatureTokens(vesselText);
  if (targetTokens.length === 0) return [];

  const scored: Array<{ vessel: IndexedLoadedVessel; score: number }> = [];

  for (const v of loadedVessels) {
    if (v.system !== 'arteries' && v.system !== 'veins') continue;
    const vPhrase = normalizeVesselPhrase(v.name);
    const vTokens = new Set(extractVesselSignatureTokens(v.name));
    if (vTokens.size === 0) continue;

    let score = 0;
    if (vPhrase === targetPhrase) {
      score = 100;
    } else if (vPhrase.includes(targetPhrase) || targetPhrase.includes(vPhrase)) {
      score = 80;
    } else {
      let overlap = 0;
      for (const tok of targetTokens) {
        if (vTokens.has(tok)) overlap += 1;
      }
      const minLen = Math.min(targetTokens.length, vTokens.size);
      // Require strong lexical overlap (all distinctive tokens match when <= 2, or >= 2 matching tokens with >= 65% ratio)
      if (
        (targetTokens.length === 1 && overlap === 1 && vTokens.size <= 3) ||
        (targetTokens.length >= 2 && overlap >= 2 && overlap / minLen >= 0.65)
      ) {
        score = Math.round((overlap / Math.max(targetTokens.length, vTokens.size)) * 70);
      }
    }

    if (score >= 40) {
      if (preferredSide && preferredSide !== 'midline' && v.side === preferredSide) {
        score += 12;
      }
      scored.push({ vessel: v, score });
    }
  }

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0].score;
  const threshold = Math.max(40, topScore - 18);
  const best = scored.filter((s) => s.score >= threshold).map((s) => s.vessel);

  // If preferredSide matches exist, narrow to preferredSide + midline so highlighting feels focused
  if (preferredSide && preferredSide !== 'midline') {
    const sideMatches = best.filter((v) => v.side === preferredSide || v.side === 'midline');
    if (sideMatches.length > 0) return sideMatches;
  }
  return best;
}

export interface UnmappedMuscleReportItem {
  meshKey: string;
  meshName: string;
  label: string;
  side: Laterality;
  groupId?: string;
  groupLabel?: string;
  fjCode?: string;
  system: AnatomicalSystemId;
}

/**
 * Scan loaded 3D sub-meshes in the muscles system and return those without an entry
 * in muscleReference.json (grouped cleanly for the Editor "Unmapped muscles" report).
 */
export function findUnmappedMuscleMeshes(
  subMeshes: Array<{
    meshKey: string;
    meshName: string;
    label: string;
    normalizedName?: string;
    system: AnatomicalSystemId;
    laterality: Laterality;
    groupId?: string;
    groupLabel?: string;
    partLabel?: string;
    fjCode?: string;
  }>
): UnmappedMuscleReportItem[] {
  const unmapped: UnmappedMuscleReportItem[] = [];
  for (const sub of subMeshes) {
    if (sub.system !== 'muscles') continue;
    const match = findMuscleReferenceForSelection({
      label: sub.label,
      meshName: sub.meshName,
      normalizedName: sub.normalizedName,
      groupId: sub.groupId,
      groupLabel: sub.groupLabel,
      partLabel: sub.partLabel,
    });
    if (!match) {
      unmapped.push({
        meshKey: sub.meshKey,
        meshName: sub.meshName,
        label: sub.label,
        side: sub.laterality,
        groupId: sub.groupId,
        groupLabel: sub.groupLabel,
        fjCode: sub.fjCode,
        system: sub.system,
      });
    }
  }
  unmapped.sort((a, b) => a.label.localeCompare(b.label));
  return unmapped;
}
