import { z } from 'zod';

export const ConfidenceSchema = z.enum(['high', 'moderate', 'verify']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const VerificationStatusSchema = z.enum([
  'Verified',
  'Partially verified',
  'Needs review',
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const NumericRangeSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  unit: z.enum(['mm', 'cm', 'cm2', 'deg']),
  confidence: ConfidenceSchema,
  note: z.string().optional(),
});
export type NumericRange = z.infer<typeof NumericRangeSchema>;

export const PerforatorSchema = z.object({
  label: z.string(),
  type: z.enum(['Musculocutaneous', 'Septocutaneous', 'Direct cutaneous', 'Mixed']),
  location: z.string(),
  relation_to_landmarks: z.string(),
  typical_count: z.string(),
  caliber_mm: NumericRangeSchema.nullable(),
  position3d: z.tuple([z.number(), z.number(), z.number()]).optional(),
});
export type Perforator = z.infer<typeof PerforatorSchema>;

export const ReferenceSchema = z.object({
  book: z.string(),
  edition: z.string(),
  chapter_or_section: z.string(),
  note: z.string().optional(),
  verify: z.boolean(),
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const Flap3DSpecSchema = z.object({
  regionId: z.string(),
  side: z.enum(['right', 'left', 'midline']),
  paddleCenter: z.tuple([z.number(), z.number(), z.number()]),
  paddleNormal: z.tuple([z.number(), z.number(), z.number()]),
  paddleSize: z.tuple([z.number(), z.number()]), // [length_m, width_m] in 3D body meters (~1.75m height)
  pediclePath: z.array(z.tuple([z.number(), z.number(), z.number()])),
  minorPediclePath: z.array(z.tuple([z.number(), z.number(), z.number()])).optional(),
  nervePath: z.array(z.tuple([z.number(), z.number(), z.number()])).optional(),
  pivotPoint: z.tuple([z.number(), z.number(), z.number()]),
  arcRadius: z.number(), // meters on 1.75m body
  typicalRecipientPoint: z.tuple([z.number(), z.number(), z.number()]),
  angiosomeColor: z.string(),
});
export type Flap3DSpec = z.infer<typeof Flap3DSpecSchema>;

export const FlapRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  synonyms: z.array(z.string()),
  region: z.string(),
  region_group: z.enum([
    'Head & Neck',
    'Trunk',
    'Upper Extremity',
    'Lower Extremity',
    'Perineum & Pelvis',
    'Local / Random Pattern',
  ]),
  flap_type: z.array(z.string()),
  classification: z.object({
    mathes_nahai: z.string().nullable(),
    cormack_lamberty: z.string().nullable(),
    perforator_type: z.string().nullable(),
  }),
  tissue_components: z.array(z.string()),
  vascular_anatomy: z.object({
    dominant_pedicle: z.object({
      artery: z.string(),
      artery_origin: z.string(),
      artery_diameter_mm: NumericRangeSchema.nullable(),
      veins: z.string(),
      vein_diameter_mm: NumericRangeSchema.nullable(),
      pedicle_length_cm: NumericRangeSchema.nullable(),
    }),
    minor_pedicles: z.array(z.string()),
    perforators: z.array(PerforatorSchema),
    angiosome: z.string(),
    venous_drainage_notes: z.string(),
    vascular_variants: z.array(z.string()),
  }),
  nerves: z.object({
    motor: z.array(z.string()),
    sensory: z.array(z.string()),
    can_be_sensate: z.boolean(),
    donor_numbness_note: z.string(),
  }),
  dimensions: z.object({
    max_skin_paddle_cm: z.object({
      length: NumericRangeSchema.nullable(),
      width: NumericRangeSchema.nullable(),
    }),
    thickness_notes: z.string(),
    primary_closure_max_width_cm: NumericRangeSchema.nullable(),
  }),
  arc_of_rotation: z.object({
    pivot_point: z.string(),
    reach_description: z.string(),
    reach_cm: NumericRangeSchema.nullable(),
  }),
  indications: z.array(z.string()),
  contraindications: z.array(z.string()),
  advantages: z.array(z.string()),
  disadvantages: z.array(z.string()),
  donor_site: z.object({
    closure: z.string(),
    morbidity: z.array(z.string()),
    functional_loss: z.string(),
  }),
  technique: z.object({
    patient_positioning: z.string(),
    preoperative_planning: z.array(z.string()),
    landmarks: z.array(z.string()),
    design: z.string(),
    harvest_steps: z.array(z.string()),
    pearls: z.array(z.string()),
    pitfalls: z.array(z.string()),
  }),
  recipient_vessels_options: z.array(z.string()),
  complications: z.array(z.string()),
  alternatives: z.array(z.string()),
  reconstructive_ladder_level: z.enum([
    'Primary closure',
    'Skin graft',
    'Local flap',
    'Regional flap',
    'Free flap',
  ]),
  advisor_tags: z.object({
    defect_locations: z.array(z.string()),
    provides_bone: z.boolean(),
    provides_muscle: z.boolean(),
    provides_thin_pliable: z.boolean(),
    provides_bulk: z.boolean(),
    provides_motor: z.boolean(),
    provides_gliding_or_durable: z.boolean(),
    pedicled_capable: z.boolean(),
    free_capable: z.boolean(),
    chimeric_capable: z.boolean(),
    technical_difficulty: z.enum(['Low', 'Moderate', 'High']),
    typical_or_time: z.string(),
  }),
  spec3d: Flap3DSpecSchema,
  real_vessel_map_key: z.string().optional(),
  references: z.array(ReferenceSchema).min(1),
  verification_status: VerificationStatusSchema,
  last_reviewed: z.string().nullable(),
});
export type FlapRecord = z.infer<typeof FlapRecordSchema>;

export const VesselRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['Artery', 'Vein', 'Nerve', 'Muscle']),
  origin: z.string(),
  course: z.string(),
  branches: z.array(z.string()),
  relations: z.string(),
  diameter_mm: NumericRangeSchema.nullable(),
  angiosome: z.string().optional(),
  variants: z.array(z.string()),
  clinical_relevance: z.string(),
  supplied_flap_ids: z.array(z.string()),
  regionId: z.string(),
  path3d: z.array(z.tuple([z.number(), z.number(), z.number()])),
  references: z.array(ReferenceSchema),
});
export type VesselRecord = z.infer<typeof VesselRecordSchema>;

export const RegionRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  region_group: z.string(),
  cameraPosition: z.tuple([z.number(), z.number(), z.number()]),
  cameraTarget: z.tuple([z.number(), z.number(), z.number()]),
  landmarks: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      position: z.tuple([z.number(), z.number(), z.number()]),
      clinicalNote: z.string(),
    })
  ),
  angiosomeTerritory: z.string(),
  angiosomeColor: z.string(),
});
export type RegionRecord = z.infer<typeof RegionRecordSchema>;

export const DefectLocationSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.string(),
  position3d: z.tuple([z.number(), z.number(), z.number()]),
  defaultRecipientVessels: z.array(z.string()),
  ladderSummary: z.array(z.string()),
});
export type DefectLocation = z.infer<typeof DefectLocationSchema>;

export const DefectPresetSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  ladderSteps: z.array(z.string()),
  input: z.object({
    locationId: z.string(),
    lengthCm: z.number(),
    widthCm: z.number(),
    depth: z.enum(['Superficial', 'Full-thickness', 'Deep / cavitary']),
    boneLengthCm: z.number().optional(),
    missingTissues: z.array(z.string()),
    woundCharacteristics: z.array(z.string()),
    functionalGoals: z.array(z.string()),
    recipientVesselStatus: z.enum(['Available', 'Zone of injury', 'Previous radiation', 'Vein graft likely']),
    patientFactors: z.array(z.string()),
    mobilizationPreference: z.enum(['Any', 'Local / Regional preferred', 'Free flap acceptable', 'Short OR time']),
  }),
});
export type DefectPreset = z.infer<typeof DefectPresetSchema>;

export const GlossaryTermSchema = z.object({
  id: z.string(),
  term: z.string(),
  abbreviation: z.string().optional(),
  category: z.string(),
  definition: z.string(),
  clinicalExample: z.string().optional(),
});
export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;

export const QuizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['mcq', 'case', 'landmark']),
  topic: z.string(),
  difficulty: z.enum(['Resident', 'Fellow', 'Board']),
  prompt: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number(),
  explanation: z.string(),
  relatedFlapId: z.string().optional(),
  referenceNote: z.string(),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export function formatRange(
  range: NumericRange | null | undefined,
  unitSystem: 'metric' | 'imperial' = 'metric'
): { text: string; isVerify: boolean; isUnspecified: boolean } {
  if (!range || (range.min === null && range.max === null)) {
    return {
      text: 'Not specified — verify in source',
      isVerify: true,
      isUnspecified: true,
    };
  }
  const factor =
    unitSystem === 'imperial'
      ? range.unit === 'cm'
        ? 0.3937
        : range.unit === 'mm'
          ? 0.03937
          : range.unit === 'cm2'
            ? 0.155
            : 1
      : 1;
  const displayUnit =
    unitSystem === 'imperial'
      ? range.unit === 'cm'
        ? 'in'
        : range.unit === 'mm'
          ? 'in'
          : range.unit === 'cm2'
            ? 'in²'
            : '°'
      : range.unit === 'cm2'
        ? 'cm²'
        : range.unit === 'deg'
          ? '°'
          : range.unit;

  const fmt = (v: number) => {
    const val = v * factor;
    return val < 10 ? Number(val.toFixed(1)).toString() : Math.round(val).toString();
  };

  let text = '';
  if (range.min !== null && range.max !== null) {
    text = range.min === range.max ? `${fmt(range.min)} ${displayUnit}` : `${fmt(range.min)}–${fmt(range.max)} ${displayUnit}`;
  } else if (range.max !== null) {
    text = `up to ${fmt(range.max)} ${displayUnit}`;
  } else if (range.min !== null) {
    text = `≥ ${fmt(range.min)} ${displayUnit}`;
  }
  return {
    text,
    isVerify: range.confidence === 'verify',
    isUnspecified: false,
  };
}

export interface DatasetAuditReport {
  totalFlaps: number;
  validFlaps: number;
  schemaErrors: string[];
  byVerificationStatus: Record<VerificationStatus, number>;
  fieldsMarkedVerifyCount: number;
  verifyBreakdownByFlap: Array<{ flapId: string; flapName: string; verifyFields: string[] }>;
  recordsLackingReferences: string[];
}

export function auditFlapDataset(rawFlaps: unknown[]): DatasetAuditReport {
  const schemaErrors: string[] = [];
  const byVerificationStatus: Record<VerificationStatus, number> = {
    Verified: 0,
    'Partially verified': 0,
    'Needs review': 0,
  };
  let validFlaps = 0;
  let fieldsMarkedVerifyCount = 0;
  const verifyBreakdownByFlap: Array<{ flapId: string; flapName: string; verifyFields: string[] }> = [];
  const recordsLackingReferences: string[] = [];

  for (let i = 0; i < rawFlaps.length; i++) {
    const parsed = FlapRecordSchema.safeParse(rawFlaps[i]);
    if (!parsed.success) {
      schemaErrors.push(`Flap index ${i}: ${parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
      continue;
    }
    validFlaps++;
    const f = parsed.data;
    byVerificationStatus[f.verification_status]++;
    if (f.references.length === 0) {
      recordsLackingReferences.push(f.id);
    }

    const vFields: string[] = [];
    const checkRange = (label: string, r: NumericRange | null | undefined) => {
      if (!r || r.confidence === 'verify' || (r.min === null && r.max === null)) {
        vFields.push(label);
      }
    };

    checkRange('Artery diameter', f.vascular_anatomy.dominant_pedicle.artery_diameter_mm);
    checkRange('Vein diameter', f.vascular_anatomy.dominant_pedicle.vein_diameter_mm);
    checkRange('Pedicle length', f.vascular_anatomy.dominant_pedicle.pedicle_length_cm);
    checkRange('Max skin paddle length', f.dimensions.max_skin_paddle_cm.length);
    checkRange('Max skin paddle width', f.dimensions.max_skin_paddle_cm.width);
    checkRange('Primary closure width', f.dimensions.primary_closure_max_width_cm);
    if (f.arc_of_rotation.reach_cm && f.arc_of_rotation.reach_cm.confidence === 'verify') {
      vFields.push('Arc reach');
    }
    f.vascular_anatomy.perforators.forEach((p, idx) => {
      if (p.caliber_mm && p.caliber_mm.confidence === 'verify') {
        vFields.push(`Perforator ${p.label || idx + 1} caliber`);
      }
    });
    if (f.references.some((ref) => ref.verify)) {
      vFields.push('Reference citation section');
    }

    fieldsMarkedVerifyCount += vFields.length;
    if (vFields.length > 0) {
      verifyBreakdownByFlap.push({ flapId: f.id, flapName: f.name, verifyFields: vFields });
    }
  }

  return {
    totalFlaps: rawFlaps.length,
    validFlaps,
    schemaErrors,
    byVerificationStatus,
    fieldsMarkedVerifyCount,
    verifyBreakdownByFlap,
    recordsLackingReferences,
  };
}
