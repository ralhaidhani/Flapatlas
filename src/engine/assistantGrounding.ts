import { filterAndSearchFlaps } from './searchEngine';
import type { AdvisorInput } from './advisorEngine';
import type { DefectLocation, FlapRecord, VesselRecord } from '../types/schemas';

export type AssistantCapabilityMode =
  | 'qa'
  | 'compare'
  | 'technique'
  | 'alternatives'
  | 'quiz'
  | 'advisor-parse';

export interface GroundedContextSource {
  id: string;
  name: string;
  shortLabel: string;
  kind: 'flap' | 'vessel';
  verificationStatus?: FlapRecord['verification_status'];
  regionGroup?: string;
}

export interface GroundedContextBundle {
  flapRecords: Array<Record<string, unknown>>;
  vesselRecords: Array<Record<string, unknown>>;
  sources: GroundedContextSource[];
}

export const NOT_AVAILABLE_FALLBACK =
  'Not available in the current dataset — please consult the primary references.';

const VALID_MISSING_TISSUES = new Set([
  'Skin',
  'Subcutaneous fat',
  'Fascia',
  'Muscle',
  'Bone',
  'Tendon',
  'Nerve',
  'Mucosa / lining',
  'Composite (through-and-through)',
]);

const VALID_WOUND_CHARS = new Set([
  'Exposed bone',
  'Exposed tendon',
  'Exposed hardware',
  'Exposed vessels / dura / implant',
  'Radiated field',
  'Infection / osteomyelitis',
  'Dead space',
  'Contaminated / chronic wound',
  'Active malignancy',
]);

const VALID_GOALS = new Set([
  'Thin / pliable coverage',
  'Bulk / volume',
  'Sensation',
  'Motor function',
  'Color / texture match',
  'Durability',
  'Weight-bearing surface',
  'Contour',
]);

const VALID_PATIENT_FACTORS = new Set([
  'High BMI',
  'Smoker',
  'Diabetes',
  'Peripheral vascular disease',
  'Prior abdominal surgery',
  'Prior surgery at donor site',
  'Anticoagulation',
  'Age > 70 / frail',
  'Scar concealment priority',
]);

const VALID_DEPTHS = new Set<AdvisorInput['depth']>([
  'Superficial',
  'Full-thickness',
  'Deep / cavitary',
]);

const VALID_RECIPIENT_STATUS = new Set<AdvisorInput['recipientVesselStatus']>([
  'Available',
  'Zone of injury',
  'Previous radiation',
  'Vein graft likely',
]);

const VALID_MOBILIZATION = new Set<AdvisorInput['mobilizationPreference']>([
  'Any',
  'Local / Regional preferred',
  'Free flap acceptable',
  'Short OR time',
]);

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Retrieves compact, strictly grounded flap & vessel context records from the
 * local FlapAtlas dataset for a user query. Always preserves explicit mentions
 * (e.g., "DIEP vs SIEA vs TRAM") and falls back to the currently viewed flap.
 */
export function retrieveGroundedContext(
  query: string,
  flaps: FlapRecord[],
  vessels: VesselRecord[],
  selectedFlapId?: string | null,
  maxFlaps = 5,
  maxVessels = 3
): GroundedContextBundle {
  const qNorm = normalizeToken(query);
  const qWords = new Set(qNorm.split(' ').filter((w) => w.length >= 2));

  const pickedFlaps = new Map<string, FlapRecord>();

  // 1. Direct exact / acronym mention detection (handles multi-flap comparisons like "DIEP vs SIEA vs TRAM")
  for (const f of flaps) {
    if (pickedFlaps.size >= maxFlaps) break;
    const candidates = [f.id.replace(/-flap$/, ''), f.name, ...f.synonyms];
    const hit = candidates.some((cand) => {
      const c = normalizeToken(cand);
      if (!c) return false;
      if (c.length <= 5) {
        return qWords.has(c);
      }
      return qNorm.includes(c);
    });
    if (hit) {
      pickedFlaps.set(f.id, f);
    }
  }

  // 2. Fuzzy search fill via Fuse.js engine
  if (pickedFlaps.size < maxFlaps && query.trim()) {
    const fuzzy = filterAndSearchFlaps(flaps, { query });
    for (const f of fuzzy) {
      if (pickedFlaps.size >= maxFlaps) break;
      if (!pickedFlaps.has(f.id)) {
        pickedFlaps.set(f.id, f);
      }
    }
  }

  // 3. Include currently selected flap if room remains or nothing matched
  const activeFlap = selectedFlapId ? flaps.find((f) => f.id === selectedFlapId) : flaps[0];
  if (activeFlap && (pickedFlaps.size === 0 || pickedFlaps.size < maxFlaps)) {
    pickedFlaps.set(activeFlap.id, activeFlap);
  }

  // 4. Retrieve relevant vessels (explicit mention OR linked to retrieved flaps)
  const pickedVessels = new Map<string, VesselRecord>();
  const flapIdSet = new Set(pickedFlaps.keys());
  for (const v of vessels) {
    if (pickedVessels.size >= maxVessels) break;
    const vNorm = normalizeToken(v.name);
    const directMention =
      (vNorm.length > 4 && qNorm.includes(vNorm)) ||
      vNorm
        .split(' ')
        .filter((w) => w.length >= 5)
        .some((w) => qWords.has(w));
    const linkedToPickedFlap = v.supplied_flap_ids.some((id) => flapIdSet.has(id));
    if (directMention || linkedToPickedFlap) {
      pickedVessels.set(v.id, v);
    }
  }

  const flapList = Array.from(pickedFlaps.values()).slice(0, maxFlaps);
  const vesselList = Array.from(pickedVessels.values()).slice(0, maxVessels);

  const flapRecords = flapList.map((f) => ({
    record_type: 'flap',
    id: f.id,
    name: f.name,
    synonyms: f.synonyms,
    region: f.region,
    region_group: f.region_group,
    reconstructive_ladder_level: f.reconstructive_ladder_level,
    verification_status: f.verification_status,
    last_reviewed: f.last_reviewed,
    classification: f.classification,
    tissue_components: f.tissue_components,
    dominant_pedicle: f.vascular_anatomy.dominant_pedicle,
    minor_pedicles: f.vascular_anatomy.minor_pedicles,
    angiosome: f.vascular_anatomy.angiosome,
    venous_drainage_notes: f.vascular_anatomy.venous_drainage_notes,
    vascular_variants: f.vascular_anatomy.vascular_variants,
    perforators: f.vascular_anatomy.perforators.map((p) => ({
      label: p.label,
      type: p.type,
      location: p.location,
      relation_to_landmarks: p.relation_to_landmarks,
      typical_count: p.typical_count,
      caliber_mm: p.caliber_mm,
    })),
    nerves: f.nerves,
    dimensions: f.dimensions,
    arc_of_rotation: f.arc_of_rotation,
    indications: f.indications,
    contraindications: f.contraindications,
    advantages: f.advantages,
    disadvantages: f.disadvantages,
    donor_site: f.donor_site,
    technique: {
      patient_positioning: f.technique.patient_positioning,
      preoperative_planning: f.technique.preoperative_planning,
      landmarks: f.technique.landmarks,
      design: f.technique.design,
      harvest_steps: f.technique.harvest_steps,
      pearls: f.technique.pearls,
      pitfalls: f.technique.pitfalls,
    },
    recipient_vessels_options: f.recipient_vessels_options,
    complications: f.complications,
    alternatives: f.alternatives,
    references: f.references,
  }));

  const vesselRecords = vesselList.map((v) => ({
    record_type: 'vessel',
    id: v.id,
    name: v.name,
    category: v.category,
    origin: v.origin,
    course: v.course,
    branches: v.branches,
    relations: v.relations,
    diameter_mm: v.diameter_mm,
    angiosome: v.angiosome,
    variants: v.variants,
    clinical_relevance: v.clinical_relevance,
    supplied_flap_ids: v.supplied_flap_ids,
    references: v.references,
  }));

  const sources: GroundedContextSource[] = [
    ...flapList.map((f) => ({
      id: f.id,
      name: f.name,
      shortLabel: f.synonyms[0] || f.name.split(' ')[0],
      kind: 'flap' as const,
      verificationStatus: f.verification_status,
      regionGroup: f.region_group,
    })),
    ...vesselList.map((v) => ({
      id: v.id,
      name: v.name,
      shortLabel: v.name.replace(/\s*\([^)]*\)/g, '').trim(),
      kind: 'vessel' as const,
    })),
  ];

  return { flapRecords, vesselRecords, sources };
}

/**
 * Builds the strict §9 system instruction enforcing dataset-only grounding,
 * explicit "verify" flagging, and non-diagnostic educational disclaimer.
 */
export function buildGroundedSystemInstruction(mode: AssistantCapabilityMode = 'qa'): string {
  const modeGuidance: Record<AssistantCapabilityMode, string> = {
    qa: 'Answer clearly in concise surgical prose with bulleted key parameters and textbook citations from the provided records.',
    compare:
      'Compare the retrieved flaps concisely across dominant pedicle, caliber/length, dimensions, sensate/bone capability, donor morbidity, and indications using structured headings and bullet points (one section per parameter or per flap) using only the provided records.',
    technique:
      'Summarize patient positioning, preoperative imaging, surface landmarks, harvest sequence, pearls, and pitfalls strictly from the provided flap record.',
    alternatives:
      'Explain why a primary flap may be contraindicated using the contraindications field and propose grounded alternative flaps listed in the dataset.',
    quiz: 'Create 1 high-yield board/fellowship question grounded strictly in the provided records, then reveal the answer key and textbook reference below a separator.',
    'advisor-parse':
      'Extract structured Flap Advisor parameters from the user scenario as JSON matching the required schema. Only pick locationId and checkbox strings from the supplied allowed lists. Never rank flaps yourself — the deterministic rule-based Flap Advisor engine performs all flap ranking.',
  };

  return [
    'You are Ask FlapAtlas, a strictly grounded educational assistant for plastic and reconstructive surgeons.',
    'NON-NEGOTIABLE GROUNDING RULES:',
    '1. ONLY state anatomical facts, numeric ranges, vessel calibers, pedicle lengths, classifications, landmarks, indications, complications, and textbook citations that explicitly appear in the supplied CONTEXT RECORDS JSON.',
    '2. NEVER invent, guess, extrapolate, or recall numbers, dimensions, vessel diameters, or textbook references from outside the supplied context.',
    `3. If the answer or requested detail is not present in the CONTEXT RECORDS, state verbatim: "${NOT_AVAILABLE_FALLBACK}"`,
    '4. Whenever citing any numeric value marked confidence: "verify" or a reference marked verify: true, explicitly note "(flagged for clinical verification)".',
    '5. Always include a concise educational safety reminder: for education and reference only, not a substitute for clinical judgment or preoperative imaging (CTA/Doppler/MRA).',
    '6. Formatting: Keep responses crisp and scannable in a narrow clinical sidebar using short headings and bullet points. NEVER output HTML tags (such as <br>) or Markdown pipe tables.',
    `7. Mode task: ${modeGuidance[mode]}`,
  ].join('\n');
}

export interface ParsedAdvisorScenario {
  summary: string;
  input: AdvisorInput;
}

/**
 * Validates and sanitizes structured JSON returned by Gemini in `advisor-parse`
 * mode so it safely populates the deterministic Flap Advisor engine.
 */
export function parseAdvisorScenarioPayload(
  raw: unknown,
  defectLocations: DefectLocation[]
): ParsedAdvisorScenario | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const validLocIds = new Set(defectLocations.map((d) => d.id));
  const rawLoc = typeof obj.locationId === 'string' ? obj.locationId.trim() : '';
  const locationId = validLocIds.has(rawLoc) ? rawLoc : defectLocations[0]?.id || 'leg-distal-ankle';

  const clampDim = (val: unknown, fallback: number, min = 1, max = 45): number => {
    const n = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
    return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
  };

  const filterList = (arr: unknown, allowed: Set<string>): string[] =>
    Array.isArray(arr)
      ? Array.from(new Set(arr.filter((x): x is string => typeof x === 'string' && allowed.has(x))))
      : [];

  const depth: AdvisorInput['depth'] =
    typeof obj.depth === 'string' && VALID_DEPTHS.has(obj.depth as AdvisorInput['depth'])
      ? (obj.depth as AdvisorInput['depth'])
      : 'Full-thickness';

  const recipientVesselStatus: AdvisorInput['recipientVesselStatus'] =
    typeof obj.recipientVesselStatus === 'string' &&
    VALID_RECIPIENT_STATUS.has(obj.recipientVesselStatus as AdvisorInput['recipientVesselStatus'])
      ? (obj.recipientVesselStatus as AdvisorInput['recipientVesselStatus'])
      : 'Available';

  const mobilizationPreference: AdvisorInput['mobilizationPreference'] =
    typeof obj.mobilizationPreference === 'string' &&
    VALID_MOBILIZATION.has(obj.mobilizationPreference as AdvisorInput['mobilizationPreference'])
      ? (obj.mobilizationPreference as AdvisorInput['mobilizationPreference'])
      : 'Any';

  const missingTissues = filterList(obj.missingTissues, VALID_MISSING_TISSUES);
  const input: AdvisorInput = {
    locationId,
    lengthCm: clampDim(obj.lengthCm, 10),
    widthCm: clampDim(obj.widthCm, 6),
    depth,
    boneLengthCm:
      typeof obj.boneLengthCm === 'number' && Number.isFinite(obj.boneLengthCm) && obj.boneLengthCm > 0
        ? clampDim(obj.boneLengthCm, 0, 1, 25)
        : undefined,
    missingTissues: missingTissues.length > 0 ? missingTissues : ['Skin', 'Subcutaneous fat'],
    woundCharacteristics: filterList(obj.woundCharacteristics, VALID_WOUND_CHARS),
    functionalGoals: filterList(obj.functionalGoals, VALID_GOALS),
    recipientVesselStatus,
    patientFactors: filterList(obj.patientFactors, VALID_PATIENT_FACTORS),
    mobilizationPreference,
  };

  const summary =
    typeof obj.summary === 'string' && obj.summary.trim()
      ? obj.summary.trim()
      : `Structured Flap Advisor scenario mapped to ${locationId} (${input.lengthCm} × ${input.widthCm} cm).`;

  return { summary, input };
}
