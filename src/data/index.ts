import coreA from './flaps_core_a.json';
import coreB from './flaps_core_b.json';
import extended from './flaps_extended.json';
import phase5HnTrunk from './flaps_phase5_hn_trunk.json';
import phase5UpperLower from './flaps_phase5_upper_lower.json';
import phase5LowerLocal from './flaps_phase5_lower_local.json';
import vesselsRaw from './vessels.json';
import regionsRaw from './regions.json';
import defectsRaw from './defects.json';
import glossaryRaw from './glossary.json';
import quizRaw from './quiz.json';

import {
  FlapRecord,
  FlapRecordSchema,
  VesselRecord,
  VesselRecordSchema,
  RegionRecord,
  RegionRecordSchema,
  DefectLocation,
  DefectLocationSchema,
  DefectPreset,
  DefectPresetSchema,
  GlossaryTerm,
  GlossaryTermSchema,
  QuizQuestion,
  QuizQuestionSchema,
  auditFlapDataset,
  DatasetAuditReport,
} from '../types/schemas';

import { inferRealVesselMapKey } from '../models/flapVesselLinker';

const rawAllFlaps: unknown[] = [
  ...coreA,
  ...coreB,
  ...extended,
  ...phase5HnTrunk,
  ...phase5UpperLower,
  ...phase5LowerLocal,
];

export const INITIAL_FLAP_AUDIT: DatasetAuditReport = auditFlapDataset(rawAllFlaps);

export const INITIAL_FLAPS: FlapRecord[] = rawAllFlaps
  .map((item) => {
    const res = FlapRecordSchema.safeParse(item);
    if (!res.success) return null;
    const flap = res.data;
    const inferredKey = inferRealVesselMapKey(flap);
    return inferredKey && !flap.real_vessel_map_key
      ? { ...flap, real_vessel_map_key: inferredKey }
      : flap;
  })
  .filter((x): x is FlapRecord => x !== null);

export const VESSELS: VesselRecord[] = (vesselsRaw as unknown[])
  .map((v) => VesselRecordSchema.safeParse(v))
  .filter((r) => r.success)
  .map((r) => r.data);

export const REGIONS: RegionRecord[] = (regionsRaw as unknown[])
  .map((r) => RegionRecordSchema.safeParse(r))
  .filter((r) => r.success)
  .map((r) => r.data);

export const DEFECT_LOCATIONS: DefectLocation[] = ((defectsRaw as { locations: unknown[] }).locations || [])
  .map((d) => DefectLocationSchema.safeParse(d))
  .filter((r) => r.success)
  .map((r) => r.data);

export const DEFECT_PRESETS: DefectPreset[] = ((defectsRaw as { presets: unknown[] }).presets || [])
  .map((p) => DefectPresetSchema.safeParse(p))
  .filter((r) => r.success)
  .map((r) => r.data);

export const GLOSSARY_TERMS: GlossaryTerm[] = ((glossaryRaw as { terms: unknown[] }).terms || [])
  .map((t) => GlossaryTermSchema.safeParse(t))
  .filter((r) => r.success)
  .map((r) => r.data);

export const CLASSIFICATIONS = (glossaryRaw as {
  classifications: {
    mathes_nahai: Array<{ type: string; pattern: string; examples: string }>;
    cormack_lamberty: Array<{ type: string; pattern: string; examples: string }>;
    nakajima: Array<{ type: string; pattern: string; examples: string }>;
    gent_consensus: Array<{ rule: string; detail: string }>;
    reconstructive_ladder: Array<{ rung: string; indication: string; examples: string }>;
  };
}).classifications;

export const QUIZ_QUESTIONS: QuizQuestion[] = (quizRaw as unknown[])
  .map((q) => QuizQuestionSchema.safeParse(q))
  .filter((r) => r.success)
  .map((r) => r.data);

export * from './territories/index';
