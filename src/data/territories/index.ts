import {
  ANGIOSOME_FOUNDATION_NOTES,
  BODY_ANGIOSOME_BY_ID,
  BODY_ANGIOSOME_BY_NUMBER,
  BODY_ANGIOSOMES,
  formatAngiosomeId,
  getBodyAngiosomeByNumber,
  getBodyAngiosomeDisplayLabel,
  summarizeBp3dCoverageCounts,
  VERIFIED_ANGIOSOME_BP3D_MAP,
} from './angiosomes';
import {
  DELAY_MILESTONES,
  DELAY_THREE_STEP_EXPLAINER,
  DESIGN_PRINCIPLES,
  FIG_23_46_UPPER_LIMB_CUTANEOUS_NERVES,
} from './designPrinciples';
import {
  HEAD_NECK_ANGIOSOME_BY_ID,
  HEAD_NECK_ANGIOSOME_BY_NUMBER,
  HEAD_NECK_ANGIOSOMES,
  HEAD_NECK_CLINICAL_NOTES,
  headNeckMuscleTerritories,
} from './headNeck';
import {
  findMuscleTerritoryByName,
  LEG_AND_FOREARM_TERRITORY_NOTES,
  MUSCLE_TERRITORIES,
  MUSCLE_TERRITORY_BY_NORMALIZED_NAME,
  MUSCLE_VENOUS_TYPE_DESCRIPTIONS,
  NEUROVASCULAR_TYPE_DESCRIPTIONS,
} from './muscleTerritories';
import {
  AUTHORISED_PERFORASOME_CODES,
  FIG_23_51_PERFORATOR_CODES,
  PERFORATOR_CODE_BY_ABBR,
  PERFORATOR_FACTS,
  PERFORATOR_NOMENCLATURE_EXAMPLES,
  PERFORATOR_NOMENCLATURE_RULE,
} from './perforatorFacts';
import {
  BodyAngiosomeRecordSchema,
  DelayMilestoneRecordSchema,
  DesignPrincipleRecordSchema,
  HeadNeckAngiosomeRecordSchema,
  HeadNeckMuscleTerritoryRecordSchema,
  MuscleTerritoryRecordSchema,
  PerforatorAbbreviationRecordSchema,
  PerforatorFactRecordSchema,
  PerforatorNomenclatureExampleSchema,
  resolveAngiosomeBp3dFjs,
  TerritoryClinicalNoteRecordSchema,
} from './schemas';

export * from './schemas';
export * from './angiosomes';
export * from './headNeck';
export * from './muscleTerritories';
export * from './perforatorFacts';
export * from './designPrinciples';

export interface TerritoryDataAuditReport {
  allValid: boolean;
  totalRecords: number;
  counts: {
    bodyAngiosomes: number;
    headNeckAngiosomes: number;
    headNeckMuscleTerritories: number;
    muscleTerritories: number;
    perforatorFacts: number;
    perforatorCodes: number;
    nomenclatureExamples: number;
    designPrinciples: number;
    delayMilestones: number;
    clinicalNotes: number;
  };
  bp3dCoverage: {
    total: number;
    full: number;
    partial: number;
    none: number;
  };
  schemaErrors: string[];
  missingSourceRefIds: string[];
  crossReferenceErrors: string[];
  approximateNonSchematicIds: string[];
  unresolvedLoadedFjs: Array<{ territoryId: string; missingFjs: string[] }>;
}

/**
 * Exhaustive Phase 11a Clinical Data-Integrity QA audit across all vascular
 * territory datasets: Zod schema compliance, sourceRef coverage,
 * figure_visual_approximate => schematic:true invariant, cross-reference integrity,
 * and optional runtime BP3D FJ verification against loaded `extras.fj` sets.
 */
export function auditTerritoryDataset(options?: {
  validFlapIds?: ReadonlySet<string>;
  loadedFjIds?: ReadonlySet<string>;
}): TerritoryDataAuditReport {
  const schemaErrors: string[] = [];
  const missingSourceRefIds: string[] = [];
  const crossReferenceErrors: string[] = [];
  const approximateNonSchematicIds: string[] = [];
  const seenIds = new Set<string>();

  const checkCollection = <
    T extends {
      id: string;
      sourceRef?: { chapter?: number; page?: string; figureOrTable?: string };
      evidenceType?: string;
      schematic?: boolean;
    }
  >(
    label: string,
    items: readonly T[],
    schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } } }
  ) => {
    for (const item of items) {
      if (seenIds.has(item.id)) {
        crossReferenceErrors.push(`${label}: duplicate record id "${item.id}"`);
      }
      seenIds.add(item.id);

      const parsed = schema.safeParse(item);
      if (!parsed.success) {
        const msg = parsed.error?.issues.map((i) => i.message).join('; ') ?? 'schema failed';
        schemaErrors.push(`${label}.${item.id}: ${msg}`);
      }

      if (
        !item.sourceRef ||
        item.sourceRef.chapter !== 23 ||
        !item.sourceRef.page?.trim() ||
        !item.sourceRef.figureOrTable?.trim()
      ) {
        missingSourceRefIds.push(`${label}.${item.id}`);
      }

      if (item.evidenceType === 'figure_visual_approximate' && item.schematic !== true) {
        approximateNonSchematicIds.push(`${label}.${item.id}`);
      }
    }
  };

  checkCollection('bodyAngiosomes', BODY_ANGIOSOMES, BodyAngiosomeRecordSchema);
  checkCollection('headNeckAngiosomes', HEAD_NECK_ANGIOSOMES, HeadNeckAngiosomeRecordSchema);
  checkCollection(
    'headNeckMuscleTerritories',
    headNeckMuscleTerritories,
    HeadNeckMuscleTerritoryRecordSchema
  );
  checkCollection('muscleTerritories', MUSCLE_TERRITORIES, MuscleTerritoryRecordSchema);
  checkCollection('perforatorFacts', PERFORATOR_FACTS, PerforatorFactRecordSchema);
  checkCollection(
    'perforatorCodes',
    FIG_23_51_PERFORATOR_CODES,
    PerforatorAbbreviationRecordSchema
  );
  checkCollection(
    'nomenclatureExamples',
    PERFORATOR_NOMENCLATURE_EXAMPLES,
    PerforatorNomenclatureExampleSchema
  );
  checkCollection('designPrinciples', DESIGN_PRINCIPLES, DesignPrincipleRecordSchema);
  checkCollection('delayMilestones', DELAY_MILESTONES, DelayMilestoneRecordSchema);
  checkCollection('headNeckNotes', HEAD_NECK_CLINICAL_NOTES, TerritoryClinicalNoteRecordSchema);
  checkCollection(
    'legForearmNotes',
    LEG_AND_FOREARM_TERRITORY_NOTES,
    TerritoryClinicalNoteRecordSchema
  );

  // Cross-reference validation
  for (const hn of HEAD_NECK_ANGIOSOMES) {
    if (hn.bodyAngiosomeId && !BODY_ANGIOSOME_BY_ID.has(hn.bodyAngiosomeId)) {
      crossReferenceErrors.push(
        `headNeck.${hn.id}: unknown bodyAngiosomeId "${hn.bodyAngiosomeId}"`
      );
    }
  }

  for (const m of MUSCLE_TERRITORIES) {
    for (const angioId of m.supplyingAngiosomeIds) {
      if (!BODY_ANGIOSOME_BY_ID.has(angioId)) {
        crossReferenceErrors.push(
          `muscleTerritories.${m.id}: unknown supplyingAngiosomeId "${angioId}"`
        );
      }
    }
  }

  for (const code of FIG_23_51_PERFORATOR_CODES) {
    if (code.bodyAngiosomeId && !BODY_ANGIOSOME_BY_ID.has(code.bodyAngiosomeId)) {
      crossReferenceErrors.push(
        `perforatorCodes.${code.perforasomeCode}: unknown bodyAngiosomeId "${code.bodyAngiosomeId}"`
      );
    }
    if (code.headNeckAngiosomeId && !HEAD_NECK_ANGIOSOME_BY_ID.has(code.headNeckAngiosomeId)) {
      crossReferenceErrors.push(
        `perforatorCodes.${code.perforasomeCode}: unknown headNeckAngiosomeId "${code.headNeckAngiosomeId}"`
      );
    }
  }

  for (const ex of PERFORATOR_NOMENCLATURE_EXAMPLES) {
    if (ex.sourceCode && !AUTHORISED_PERFORASOME_CODES.has(ex.sourceCode)) {
      crossReferenceErrors.push(
        `nomenclatureExamples.${ex.id}: unauthorised sourceCode "${ex.sourceCode}"`
      );
    }
    if (ex.bodyAngiosomeId && !BODY_ANGIOSOME_BY_ID.has(ex.bodyAngiosomeId)) {
      crossReferenceErrors.push(
        `nomenclatureExamples.${ex.id}: unknown bodyAngiosomeId "${ex.bodyAngiosomeId}"`
      );
    }
    if (options?.validFlapIds) {
      for (const flapId of ex.relatedFlapIds) {
        if (!options.validFlapIds.has(flapId)) {
          crossReferenceErrors.push(
            `nomenclatureExamples.${ex.id}: unknown relatedFlapId "${flapId}"`
          );
        }
      }
    }
  }

  for (const note of [...HEAD_NECK_CLINICAL_NOTES, ...LEG_AND_FOREARM_TERRITORY_NOTES]) {
    for (const angioId of note.relatedAngiosomeIds) {
      if (!BODY_ANGIOSOME_BY_ID.has(angioId)) {
        crossReferenceErrors.push(`notes.${note.id}: unknown relatedAngiosomeId "${angioId}"`);
      }
    }
    for (const hnId of note.relatedHeadNeckIds) {
      if (!HEAD_NECK_ANGIOSOME_BY_ID.has(hnId)) {
        crossReferenceErrors.push(`notes.${note.id}: unknown relatedHeadNeckId "${hnId}"`);
      }
    }
  }

  // Coverage invariants from verified Appendix A (24 full, 5 partial, 12 none)
  const bp3dCoverage = summarizeBp3dCoverageCounts();
  if (bp3dCoverage.full !== 24 || bp3dCoverage.partial !== 5 || bp3dCoverage.none !== 12) {
    crossReferenceErrors.push(
      `Expected BP3D coverage 24 full / 5 partial / 12 none, got ${bp3dCoverage.full} / ${bp3dCoverage.partial} / ${bp3dCoverage.none}`
    );
  }

  // Optional runtime FJ resolution check against loaded GLB extras.fj
  const unresolvedLoadedFjs: Array<{ territoryId: string; missingFjs: string[] }> = [];
  if (options?.loadedFjIds && options.loadedFjIds.size > 0) {
    for (const angio of BODY_ANGIOSOMES) {
      const res = resolveAngiosomeBp3dFjs(angio, options.loadedFjIds);
      if (res.missingFjs.length > 0) {
        unresolvedLoadedFjs.push({ territoryId: angio.id, missingFjs: res.missingFjs });
      }
    }
  }

  const clinicalNotesCount =
    HEAD_NECK_CLINICAL_NOTES.length + LEG_AND_FOREARM_TERRITORY_NOTES.length;

  const counts = {
    bodyAngiosomes: BODY_ANGIOSOMES.length,
    headNeckAngiosomes: HEAD_NECK_ANGIOSOMES.length,
    headNeckMuscleTerritories: headNeckMuscleTerritories.length,
    muscleTerritories: MUSCLE_TERRITORIES.length,
    perforatorFacts: PERFORATOR_FACTS.length,
    perforatorCodes: FIG_23_51_PERFORATOR_CODES.length,
    nomenclatureExamples: PERFORATOR_NOMENCLATURE_EXAMPLES.length,
    designPrinciples: DESIGN_PRINCIPLES.length,
    delayMilestones: DELAY_MILESTONES.length,
    clinicalNotes: clinicalNotesCount,
  };

  const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return {
    allValid:
      schemaErrors.length === 0 &&
      missingSourceRefIds.length === 0 &&
      crossReferenceErrors.length === 0 &&
      approximateNonSchematicIds.length === 0,
    totalRecords,
    counts,
    bp3dCoverage,
    schemaErrors,
    missingSourceRefIds,
    crossReferenceErrors,
    approximateNonSchematicIds,
    unresolvedLoadedFjs,
  };
}

export const TERRITORY_DATASETS_SUMMARY = {
  verifiedMap: VERIFIED_ANGIOSOME_BP3D_MAP,
  foundationNotes: ANGIOSOME_FOUNDATION_NOTES,
  bodyAngiosomes: BODY_ANGIOSOMES,
  bodyAngiosomeById: BODY_ANGIOSOME_BY_ID,
  bodyAngiosomeByNumber: BODY_ANGIOSOME_BY_NUMBER,
  headNeckAngiosomes: HEAD_NECK_ANGIOSOMES,
  headNeckAngiosomeById: HEAD_NECK_ANGIOSOME_BY_ID,
  headNeckAngiosomeByNumber: HEAD_NECK_ANGIOSOME_BY_NUMBER,
  headNeckMuscleTerritories,
  headNeckClinicalNotes: HEAD_NECK_CLINICAL_NOTES,
  muscleTerritories: MUSCLE_TERRITORIES,
  muscleTerritoryByNormalizedName: MUSCLE_TERRITORY_BY_NORMALIZED_NAME,
  neurovascularTypeDescriptions: NEUROVASCULAR_TYPE_DESCRIPTIONS,
  muscleVenousTypeDescriptions: MUSCLE_VENOUS_TYPE_DESCRIPTIONS,
  legAndForearmNotes: LEG_AND_FOREARM_TERRITORY_NOTES,
  perforatorFacts: PERFORATOR_FACTS,
  perforatorCodes: FIG_23_51_PERFORATOR_CODES,
  perforatorCodeByAbbr: PERFORATOR_CODE_BY_ABBR,
  perforatorNomenclatureRule: PERFORATOR_NOMENCLATURE_RULE,
  perforatorNomenclatureExamples: PERFORATOR_NOMENCLATURE_EXAMPLES,
  designPrinciples: DESIGN_PRINCIPLES,
  delayMilestones: DELAY_MILESTONES,
  delayThreeStepExplainer: DELAY_THREE_STEP_EXPLAINER,
  upperLimbCutaneousNerves: FIG_23_46_UPPER_LIMB_CUTANEOUS_NERVES,
  formatAngiosomeId,
  getBodyAngiosomeByNumber,
  getBodyAngiosomeDisplayLabel,
  findMuscleTerritoryByName,
};
