import { z } from 'zod';

/**
 * Phase 11a — Shared Zod schemas for Vascular Territories data layer.
 * Single clinical source: Morris SF, Taylor GI. Vascular territories.
 * In: Neligan PC, Plastic Surgery, Vol 1 (Principles), Chapter 23 (pp. 321–345).
 */

export const TerritoryEvidenceTypeSchema = z.enum([
  'text',
  'figure_caption',
  'table',
  'figure_visual_approximate',
]);
export type TerritoryEvidenceType = z.infer<typeof TerritoryEvidenceTypeSchema>;

export const TerritoryVerificationStatusSchema = z.enum([
  'needs_review',
  'partially_verified',
  'verified',
]);
export type TerritoryVerificationStatus = z.infer<typeof TerritoryVerificationStatusSchema>;

export const TerritorySourceRefSchema = z.object({
  chapter: z.literal(23),
  page: z.string().min(1),
  figureOrTable: z.string().min(1),
});
export type TerritorySourceRef = z.infer<typeof TerritorySourceRefSchema>;

export const Bp3dCoverageSchema = z.enum(['full', 'partial', 'none']);
export type Bp3dCoverage = z.infer<typeof Bp3dCoverageSchema>;

export const TerritoryRegionFamilySchema = z.enum([
  'head_neck',
  'trunk',
  'upper_limb',
  'lower_limb',
]);
export type TerritoryRegionFamily = z.infer<typeof TerritoryRegionFamilySchema>;

export const AngiosomeBp3dArterySchema = z.object({
  name: z.string().min(1),
  left: z.array(z.string().min(1)),
  right: z.array(z.string().min(1)),
  midline: z.array(z.string().min(1)),
});
export type AngiosomeBp3dArtery = z.infer<typeof AngiosomeBp3dArterySchema>;

export const AngiosomeNumberSchema = z.union([z.number().int().min(1).max(40), z.literal('22a')]);
export type AngiosomeNumber = z.infer<typeof AngiosomeNumberSchema>;

export const RawAngiosomeBp3dEntrySchema = z.object({
  id: AngiosomeNumberSchema,
  name: z.string().min(1),
  abbr: z.string(),
  bp3d_coverage: Bp3dCoverageSchema,
  note: z.string(),
  bp3d_arteries: z.array(AngiosomeBp3dArterySchema),
  schematic_hint: z.string().optional(),
});
export type RawAngiosomeBp3dEntry = z.infer<typeof RawAngiosomeBp3dEntrySchema>;

export const RawHeadNeck13EntrySchema = z.object({
  n: z.number().int().min(1).max(13),
  name: z.string().min(1),
  bp3d: Bp3dCoverageSchema,
  reaches_skin: z.boolean().optional(),
  fj: z
    .object({
      left: z.array(z.string().min(1)).optional(),
      right: z.array(z.string().min(1)).optional(),
      midline: z.array(z.string().min(1)).optional(),
    })
    .optional(),
});
export type RawHeadNeck13Entry = z.infer<typeof RawHeadNeck13EntrySchema>;

export const AngiosomeBp3dMapFileSchema = z.object({
  source: z.string().min(1),
  angiosomes: z.array(RawAngiosomeBp3dEntrySchema).length(41),
  head_and_neck_13: z.array(RawHeadNeck13EntrySchema).length(13),
});
export type AngiosomeBp3dMapFile = z.infer<typeof AngiosomeBp3dMapFileSchema>;

/**
 * Base metadata required on every Phase 11 territory data record.
 * Enforces: records with evidenceType === 'figure_visual_approximate' MUST have schematic: true.
 */
export const BaseTerritoryRecordFields = {
  id: z.string().min(1),
  name: z.string().min(1),
  sourceRef: TerritorySourceRefSchema,
  evidenceType: TerritoryEvidenceTypeSchema,
  verificationStatus: TerritoryVerificationStatusSchema.default('needs_review'),
  schematic: z.boolean(),
};

export function enforceApproximateIsSchematic<
  T extends { evidenceType: TerritoryEvidenceType; schematic: boolean }
>(record: T): boolean {
  return record.evidenceType !== 'figure_visual_approximate' || record.schematic === true;
}

export const APPROXIMATE_SCHEMATIC_ERROR =
  'Records with evidenceType "figure_visual_approximate" must set schematic: true';

export const BodyAngiosomeRecordSchema = z
  .object({
    ...BaseTerritoryRecordFields,
    fig23_23Number: AngiosomeNumberSchema,
    abbr: z.string(),
    regionFamily: TerritoryRegionFamilySchema,
    bp3dCoverage: Bp3dCoverageSchema,
    bp3dArteries: z.array(AngiosomeBp3dArterySchema),
    note: z.string(),
    schematicHint: z.string().optional(),
    reachesSkin: z.boolean(),
    crossesMidline: z.boolean(),
    sharedMeshGroup: z.string().optional(),
    visualTuning: z.object({
      weight: z.number().positive(),
      isClinicalMeasurement: z.literal(false),
    }),
  })
  .refine(enforceApproximateIsSchematic, { message: APPROXIMATE_SCHEMATIC_ERROR });
export type BodyAngiosomeRecord = z.infer<typeof BodyAngiosomeRecordSchema>;

export const HeadNeckAngiosomeRecordSchema = z
  .object({
    ...BaseTerritoryRecordFields,
    fig23_37Number: z.number().int().min(1).max(13),
    bp3dCoverage: Bp3dCoverageSchema,
    reachesSkin: z.boolean(),
    bodyAngiosomeId: z.string().optional(),
    bp3dArteries: z.array(AngiosomeBp3dArterySchema),
    schematicHint: z.string().optional(),
    crossesMidline: z.boolean(),
  })
  .refine(enforceApproximateIsSchematic, { message: APPROXIMATE_SCHEMATIC_ERROR });
export type HeadNeckAngiosomeRecord = z.infer<typeof HeadNeckAngiosomeRecordSchema>;

export const HeadNeckMuscleGroupCategorySchema = z.enum([
  'mastication',
  'posterior_neck',
  'lateral_neck',
  'anterior_neck',
  'aerodigestive',
]);
export type HeadNeckMuscleGroupCategory = z.infer<typeof HeadNeckMuscleGroupCategorySchema>;

export const HeadNeckMuscleTerritoryRecordSchema = z
  .object({
    ...BaseTerritoryRecordFields,
    group: HeadNeckMuscleGroupCategorySchema,
    territoryCount: z.number().int().min(1).max(5),
    territoryCountVariant: z.number().int().min(1).max(5).optional(),
    variantNote: z.string().optional(),
    bilateral: z.boolean().optional(),
    bp3dPresent: z.boolean(),
    normalizedAnatomyName: z.string().min(1),
    clinicalNote: z.string().optional(),
  })
  .refine(enforceApproximateIsSchematic, { message: APPROXIMATE_SCHEMATIC_ERROR });
export type HeadNeckMuscleTerritoryRecord = z.infer<typeof HeadNeckMuscleTerritoryRecordSchema>;

export const TerritoryClinicalNoteRecordSchema = z
  .object({
    ...BaseTerritoryRecordFields,
    region: z.enum(['head_neck', 'leg', 'forearm', 'trunk', 'general']),
    summary: z.string().min(1),
    relatedAngiosomeIds: z.array(z.string()).default([]),
    relatedHeadNeckIds: z.array(z.string()).default([]),
  })
  .refine(enforceApproximateIsSchematic, { message: APPROXIMATE_SCHEMATIC_ERROR });
export type TerritoryClinicalNoteRecord = z.infer<typeof TerritoryClinicalNoteRecordSchema>;

export const NeurovascularTypeSchema = z.enum(['Type I', 'Type II', 'Type III', 'Type IV']);
export type NeurovascularType = z.infer<typeof NeurovascularTypeSchema>;

export const MuscleVenousTypeSchema = z.enum(['Type I', 'Type II', 'Type III']);
export type MuscleVenousType = z.infer<typeof MuscleVenousTypeSchema>;

export const MuscleTerritoryRecordSchema = z
  .object({
    ...BaseTerritoryRecordFields,
    normalizedAnatomyName: z.string().min(1),
    region: z.enum(['leg', 'forearm', 'trunk', 'upper_limb', 'lower_limb', 'head_neck']),
    angiosomeCount: z.number().int().min(1).max(5).optional(),
    angiosomeCountVariant: z.number().int().min(1).max(5).optional(),
    supplyingAngiosomeIds: z.array(z.string()).default([]),
    neurovascularType: NeurovascularTypeSchema.optional(),
    venousType: MuscleVenousTypeSchema.optional(),
    bp3dPresent: z.boolean(),
    clinicalNote: z.string().optional(),
  })
  .refine(enforceApproximateIsSchematic, { message: APPROXIMATE_SCHEMATIC_ERROR });
export type MuscleTerritoryRecord = z.infer<typeof MuscleTerritoryRecordSchema>;

export const PerforatorFactRecordSchema = z
  .object({
    ...BaseTerritoryRecordFields,
    category: z.enum([
      'quantitative',
      'classification',
      'density',
      'emergence_sites',
      'leg_lines',
      'preop_assessment',
    ]),
    summary: z.string().min(1),
  })
  .refine(enforceApproximateIsSchematic, { message: APPROXIMATE_SCHEMATIC_ERROR });
export type PerforatorFactRecord = z.infer<typeof PerforatorFactRecordSchema>;

export const PerforatorAbbreviationRecordSchema = z
  .object({
    ...BaseTerritoryRecordFields,
    perforasomeCode: z.string().min(2).max(8),
    arteryName: z.string().min(1),
    bodyAngiosomeId: z.string().optional(),
    headNeckAngiosomeId: z.string().optional(),
    regionFamily: TerritoryRegionFamilySchema,
  })
  .refine(enforceApproximateIsSchematic, { message: APPROXIMATE_SCHEMATIC_ERROR });
export type PerforatorAbbreviationRecord = z.infer<typeof PerforatorAbbreviationRecordSchema>;

export const PerforatorNomenclatureExampleSchema = z
  .object({
    ...BaseTerritoryRecordFields,
    code: z.string().min(1),
    sourceCode: z.string().min(1).optional(),
    bodyAngiosomeId: z.string().optional(),
    muscleSuffix: z.string().optional(),
    septocutaneous: z.boolean(),
    meaning: z.string().min(1),
    relatedFlapIds: z.array(z.string()).default([]),
  })
  .refine(enforceApproximateIsSchematic, { message: APPROXIMATE_SCHEMATIC_ERROR });
export type PerforatorNomenclatureExample = z.infer<typeof PerforatorNomenclatureExampleSchema>;

export const DesignPrincipleRecordSchema = z
  .object({
    ...BaseTerritoryRecordFields,
    category: z.enum([
      'box_23_1',
      'survival_and_design',
      'fasciocutaneous_musculocutaneous',
      'venous_return',
      'propeller_rule',
      'composite_flaps',
      'delay_physiology',
      'neurovascular_pattern',
      'bone_vascular_supply',
    ]),
    summary: z.string().min(1),
    readOnlyRule: z.boolean().optional(),
    educationalCardOnly: z.boolean().optional(),
    patternCode: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
  })
  .refine(enforceApproximateIsSchematic, { message: APPROXIMATE_SCHEMATIC_ERROR });
export type DesignPrincipleRecord = z.infer<typeof DesignPrincipleRecordSchema>;

export const DelayMilestoneRecordSchema = z
  .object({
    ...BaseTerritoryRecordFields,
    order: z.number().int().min(1).max(4),
    timeWindowLabel: z.string().min(1),
    vascularState: z.string().min(1),
    visualScaleFactor: z.number().positive(),
    isClinicalMeasurement: z.literal(false),
  })
  .refine(enforceApproximateIsSchematic, { message: APPROXIMATE_SCHEMATIC_ERROR });
export type DelayMilestoneRecord = z.infer<typeof DelayMilestoneRecordSchema>;

export interface Bp3dSeedResolutionResult {
  territoryId: string;
  declaredCoverage: Bp3dCoverage;
  effectiveCoverage: Bp3dCoverage;
  resolvedLeftFjs: string[];
  resolvedRightFjs: string[];
  resolvedMidlineFjs: string[];
  missingFjs: string[];
  downgradedToSchematic: boolean;
}

/**
 * Resolves an angiosome's declared BodyParts3D FJ ids against the set of FJ ids
 * actually present in the loaded GLB meshes (`extras.fj`). If any declared FJ
 * id is missing, records it for the QA report and downgrades coverage if no
 * real meshes remain.
 */
export function resolveAngiosomeBp3dFjs(
  territory: Pick<BodyAngiosomeRecord, 'id' | 'bp3dCoverage' | 'bp3dArteries'>,
  loadedFjIds: ReadonlySet<string>
): Bp3dSeedResolutionResult {
  const normalizedLoaded = new Set(Array.from(loadedFjIds, (id) => id.trim().toUpperCase()));
  const resolvedLeftFjs: string[] = [];
  const resolvedRightFjs: string[] = [];
  const resolvedMidlineFjs: string[] = [];
  const missingFjs: string[] = [];

  for (const artery of territory.bp3dArteries) {
    for (const fj of artery.left) {
      if (normalizedLoaded.has(fj.trim().toUpperCase())) {
        resolvedLeftFjs.push(fj);
      } else {
        missingFjs.push(fj);
      }
    }
    for (const fj of artery.right) {
      if (normalizedLoaded.has(fj.trim().toUpperCase())) {
        resolvedRightFjs.push(fj);
      } else {
        missingFjs.push(fj);
      }
    }
    for (const fj of artery.midline) {
      if (normalizedLoaded.has(fj.trim().toUpperCase())) {
        resolvedMidlineFjs.push(fj);
      } else {
        missingFjs.push(fj);
      }
    }
  }

  const totalResolved =
    resolvedLeftFjs.length + resolvedRightFjs.length + resolvedMidlineFjs.length;
  let effectiveCoverage: Bp3dCoverage = territory.bp3dCoverage;
  let downgradedToSchematic = false;

  if (territory.bp3dCoverage !== 'none') {
    if (totalResolved === 0) {
      effectiveCoverage = 'none';
      downgradedToSchematic = true;
    } else if (missingFjs.length > 0 && territory.bp3dCoverage === 'full') {
      effectiveCoverage = 'partial';
      downgradedToSchematic = true;
    }
  }

  return {
    territoryId: territory.id,
    declaredCoverage: territory.bp3dCoverage,
    effectiveCoverage,
    resolvedLeftFjs,
    resolvedRightFjs,
    resolvedMidlineFjs,
    missingFjs,
    downgradedToSchematic,
  };
}
