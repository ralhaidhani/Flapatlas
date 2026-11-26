import { z } from 'zod';

export const OPERATIVE_GUIDE_BANNER =
  'Educational summary compiled from standard references — verify against the primary source before clinical use.';

export const OPERATIVE_PHASE_ORDER = [
  'Marking',
  'Exposure',
  'Perforator',
  'Pedicle',
  'Elevation',
  'Harvest',
  'Donor site',
  'Inset',
] as const;

export type OperativePhase = (typeof OPERATIVE_PHASE_ORDER)[number];

export const OperativeSeveritySchema = z.enum(['critical', 'major', 'minor']);
export type OperativeSeverity = z.infer<typeof OperativeSeveritySchema>;

export const OperativeRefSchema = z.object({
  book: z.string().min(1),
  locator: z.string().min(1),
  pageVerified: z.boolean(),
});

export const OperativeWarningSchema = z.object({
  text: z.string().min(1),
  severity: OperativeSeveritySchema,
  why: z.string().min(1),
});

export const OperativeStepViewSchema = z.object({
  camera: z.string().optional(),
  layers: z.array(z.string()),
  highlight: z.array(z.string()),
  hide: z.array(z.string()),
});

export const OperativeStepSchema = z.object({
  n: z.number().int().positive(),
  phase: z.string().min(1),
  title: z.string().min(1),
  actions: z.array(z.string()),
  structuresAtRisk: z.array(z.string()),
  pearls: z.array(z.string()),
  warnings: z.array(OperativeWarningSchema),
  view: OperativeStepViewSchema,
});

export const OperativeAdjacentItemSchema = z.object({
  structure: z.string().min(1),
  relation: z.string().min(1),
  risk: z.string().min(1),
});

export const OperativeAvoidNecrosisItemSchema = z.object({
  stage: z.string().min(1),
  rule: z.string().min(1),
  rationale: z.string().min(1),
  severity: OperativeSeveritySchema,
});

export const OperativeNumberItemSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  verify: z.boolean(),
});

export const OperativeGuideSchema = z.object({
  flapId: z.string().min(1),
  contentBasis: z.literal('model_knowledge_summary'),
  verificationStatus: z.enum(['needs_review', 'partially_verified', 'verified']),
  refs: z.array(OperativeRefSchema),
  overview: z.string(),
  preop: z.array(z.string()),
  steps: z.array(OperativeStepSchema),
  adjacent: z.object({
    perforator: z.array(OperativeAdjacentItemSchema),
    flap: z.array(OperativeAdjacentItemSchema),
  }),
  avoidNecrosis: z.array(OperativeAvoidNecrosisItemSchema),
  monitoring: z.array(z.string()),
  salvage: z.array(z.string()),
  numbers: z.array(OperativeNumberItemSchema),
});

export type OperativeRef = z.infer<typeof OperativeRefSchema>;
export type OperativeWarning = z.infer<typeof OperativeWarningSchema>;
export type OperativeStepView = z.infer<typeof OperativeStepViewSchema>;
export type OperativeStep = z.infer<typeof OperativeStepSchema>;
export type OperativeAdjacentItem = z.infer<typeof OperativeAdjacentItemSchema>;
export type OperativeAvoidNecrosisItem = z.infer<typeof OperativeAvoidNecrosisItemSchema>;
export type OperativeNumberItem = z.infer<typeof OperativeNumberItemSchema>;
export type OperativeGuide = z.infer<typeof OperativeGuideSchema>;

export interface OperativeUnresolvedNameRecord {
  flapId: string;
  source: 'step-highlight' | 'step-hide' | 'adjacent-perforator' | 'adjacent-flap';
  stepN?: number;
  name: string;
}
