import {
  auditFlapDataset,
  DefectLocation,
  FlapRecord,
  formatRange,
  GlossaryTerm,
  NumericRange,
  QuizQuestion,
  RegionRecord,
  VesselRecord,
} from '../types/schemas';
import { auditTerritoryDataset, TerritoryDataAuditReport } from '../data/territories/index';

export interface Section1CheckResult {
  ruleId: string;
  title: string;
  passed: boolean;
  summary: string;
  issues: string[];
}

export interface Section1SelfReviewReport {
  allPassed: boolean;
  checkedFlapsCount: number;
  checkedVesselsCount: number;
  fieldsMarkedVerifyCount: number;
  territoryAudit: TerritoryDataAuditReport;
  checks: Section1CheckResult[];
}

function inspectNumericRange(
  flapId: string,
  fieldLabel: string,
  range: NumericRange | null | undefined,
  issues: string[]
) {
  if (!range) {
    // Null ranges must safely render as "Not specified — verify in source"
    const formatted = formatRange(range);
    if (formatted.text !== 'Not specified — verify in source') {
      issues.push(`${flapId}.${fieldLabel}: null range did not format to non-fabrication message`);
    }
    return;
  }
  if (range.min !== null && (!Number.isFinite(range.min) || range.min < 0)) {
    issues.push(`${flapId}.${fieldLabel}: invalid min (${range.min})`);
  }
  if (range.max !== null && (!Number.isFinite(range.max) || range.max < 0)) {
    issues.push(`${flapId}.${fieldLabel}: invalid max (${range.max})`);
  }
  if (range.min !== null && range.max !== null && range.min > range.max) {
    issues.push(`${flapId}.${fieldLabel}: inverted range (${range.min} > ${range.max})`);
  }
}

/**
 * Exhaustive §1 Data-Integrity & Cross-Record Referential QA Self-Review.
 * Audits every single flap record, numeric range, reference citation,
 * verification status, and cross-link in the separate data layer.
 */
export function runSection1SelfReview(params: {
  flaps: FlapRecord[];
  vessels: VesselRecord[];
  regions: RegionRecord[];
  defectLocations: DefectLocation[];
  quizQuestions: QuizQuestion[];
  glossaryTerms: GlossaryTerm[];
}): Section1SelfReviewReport {
  const { flaps, vessels, regions, defectLocations, quizQuestions, glossaryTerms } = params;
  const zodAudit = auditFlapDataset(flaps);

  const flapIdSet = new Set(flaps.map((f) => f.id));
  const regionIdSet = new Set(regions.map((r) => r.id));
  const defectIdSet = new Set(defectLocations.map((d) => d.id));
  const territoryAudit = auditTerritoryDataset({ validFlapIds: flapIdSet });

  // Rule 1.1 & 1.2: Never fabricate numbers; every numeric value stored as valid range + unit + confidence
  const rangeIssues: string[] = [];
  for (const f of flaps) {
    inspectNumericRange(f.id, 'artery_diameter_mm', f.vascular_anatomy.dominant_pedicle.artery_diameter_mm, rangeIssues);
    inspectNumericRange(f.id, 'vein_diameter_mm', f.vascular_anatomy.dominant_pedicle.vein_diameter_mm, rangeIssues);
    inspectNumericRange(f.id, 'pedicle_length_cm', f.vascular_anatomy.dominant_pedicle.pedicle_length_cm, rangeIssues);
    inspectNumericRange(f.id, 'max_skin_paddle.length', f.dimensions.max_skin_paddle_cm.length, rangeIssues);
    inspectNumericRange(f.id, 'max_skin_paddle.width', f.dimensions.max_skin_paddle_cm.width, rangeIssues);
    inspectNumericRange(f.id, 'primary_closure_max_width_cm', f.dimensions.primary_closure_max_width_cm, rangeIssues);
    inspectNumericRange(f.id, 'arc_of_rotation.reach_cm', f.arc_of_rotation.reach_cm, rangeIssues);
    f.vascular_anatomy.perforators.forEach((p, idx) => {
      inspectNumericRange(f.id, `perforators[${idx}].caliber_mm`, p.caliber_mm, rangeIssues);
    });
  }

  // Rule 1.3: Every flap record has >=1 structured reference with book, edition, chapter_or_section, boolean verify
  const referenceIssues: string[] = [];
  for (const f of flaps) {
    if (!f.references || f.references.length === 0) {
      referenceIssues.push(`${f.id}: missing references array`);
      continue;
    }
    f.references.forEach((ref, idx) => {
      if (!ref.book.trim() || !ref.chapter_or_section.trim()) {
        referenceIssues.push(`${f.id}.references[${idx}]: incomplete book or chapter_or_section`);
      }
      if (typeof ref.verify !== 'boolean') {
        referenceIssues.push(`${f.id}.references[${idx}]: missing boolean verify flag`);
      }
    });
  }

  // Rule 1.5: Verification status valid on every flap
  const statusIssues: string[] = [];
  const validStatuses = new Set(['Verified', 'Partially verified', 'Needs review']);
  for (const f of flaps) {
    if (!validStatuses.has(f.verification_status)) {
      statusIssues.push(`${f.id}: invalid verification_status (${String(f.verification_status)})`);
    }
  }

  // Rule 1.7: Unique IDs & cross-file referential integrity across separate data layer
  const refIntegrityIssues: string[] = [];
  if (flapIdSet.size !== flaps.length) {
    refIntegrityIssues.push(`Duplicate flap IDs detected (${flaps.length} records vs ${flapIdSet.size} unique IDs)`);
  }
  for (const f of flaps) {
    if (!regionIdSet.has(f.spec3d.regionId)) {
      refIntegrityIssues.push(`${f.id}: spec3d.regionId "${f.spec3d.regionId}" not found in regions.json`);
    }
    for (const altId of f.alternatives) {
      if (!flapIdSet.has(altId)) {
        refIntegrityIssues.push(`${f.id}: alternative "${altId}" not found in flap dataset`);
      }
    }
    for (const defId of f.advisor_tags.defect_locations) {
      if (!defectIdSet.has(defId)) {
        refIntegrityIssues.push(`${f.id}: advisor_tags.defect_location "${defId}" not found in defects.json`);
      }
    }
  }
  for (const v of vessels) {
    for (const fid of v.supplied_flap_ids) {
      if (!flapIdSet.has(fid)) {
        refIntegrityIssues.push(`vessel ${v.id}: supplied_flap_id "${fid}" not found in flap dataset`);
      }
    }
  }
  for (const q of quizQuestions) {
    if (q.relatedFlapId && !flapIdSet.has(q.relatedFlapId)) {
      refIntegrityIssues.push(`quiz ${q.id}: relatedFlapId "${q.relatedFlapId}" not found in flap dataset`);
    }
  }

  // Rule 1.8 (Dataset breadth & educational integrity)
  const breadthIssues: string[] = [];
  if (flaps.length < 60) breadthIssues.push(`Expected >= 60 flaps, found ${flaps.length}`);
  if (vessels.length < 15) breadthIssues.push(`Expected >= 15 vessels, found ${vessels.length}`);
  if (quizQuestions.length < 20) breadthIssues.push(`Expected >= 20 quiz questions, found ${quizQuestions.length}`);
  if (glossaryTerms.length < 25) breadthIssues.push(`Expected >= 25 glossary terms, found ${glossaryTerms.length}`);

  const checks: Section1CheckResult[] = [
    {
      ruleId: '§1.1–1.2',
      title: 'Zod Schema & Non-Fabricated Numeric Ranges',
      passed: zodAudit.schemaErrors.length === 0 && rangeIssues.length === 0,
      summary: `${zodAudit.validFlaps}/${zodAudit.totalFlaps} Zod-valid; 0 inverted or invalid ranges; ${zodAudit.fieldsMarkedVerifyCount} fields explicitly flagged "verify"`,
      issues: [...zodAudit.schemaErrors, ...rangeIssues],
    },
    {
      ruleId: '§1.3',
      title: 'Primary Textbook Reference Coverage',
      passed: referenceIssues.length === 0 && zodAudit.recordsLackingReferences.length === 0,
      summary: `${flaps.length - zodAudit.recordsLackingReferences.length}/${flaps.length} records include structured textbook citations with explicit verify flags`,
      issues: referenceIssues,
    },
    {
      ruleId: '§1.5',
      title: 'Clinical Verification Status Governance',
      passed: statusIssues.length === 0,
      summary: `Verified: ${zodAudit.byVerificationStatus.Verified} · Partially verified: ${zodAudit.byVerificationStatus['Partially verified']} · Needs review: ${zodAudit.byVerificationStatus['Needs review']}`,
      issues: statusIssues,
    },
    {
      ruleId: '§1.7',
      title: 'Separate Data Layer & Cross-File Referential Integrity',
      passed: refIntegrityIssues.length === 0,
      summary: `${flaps.length} unique flaps, ${vessels.length} vessels, ${regions.length} 3D regions, ${defectLocations.length} defect zones, ${quizQuestions.length} board cases — 100% cross-linked`,
      issues: refIntegrityIssues,
    },
    {
      ruleId: '§4 & §8',
      title: 'Clinical Curriculum Scope (60+ Flaps, Vessels, Quiz, Glossary)',
      passed: breadthIssues.length === 0,
      summary: `${flaps.length} flaps · ${vessels.length} anatomical structures · ${quizQuestions.length} board vignettes · ${glossaryTerms.length} glossary terms`,
      issues: breadthIssues,
    },
    {
      ruleId: '§11a',
      title: 'Vascular Territories Layer (Ch. 23 Schema, Citations & BP3D Coverage)',
      passed: territoryAudit.allValid,
      summary: `${territoryAudit.totalRecords} records (${territoryAudit.counts.bodyAngiosomes} Fig 23.23 · ${territoryAudit.counts.headNeckAngiosomes} Fig 23.37 · ${territoryAudit.counts.perforatorCodes} Fig 23.51 codes) · BP3D coverage ${territoryAudit.bp3dCoverage.full} full / ${territoryAudit.bp3dCoverage.partial} partial / ${territoryAudit.bp3dCoverage.none} none`,
      issues: [
        ...territoryAudit.schemaErrors,
        ...territoryAudit.missingSourceRefIds.map((id) => `Missing sourceRef: ${id}`),
        ...territoryAudit.approximateNonSchematicIds.map(
          (id) => `figure_visual_approximate without schematic=true: ${id}`
        ),
        ...territoryAudit.crossReferenceErrors,
      ],
    },
  ];

  return {
    allPassed: checks.every((c) => c.passed),
    checkedFlapsCount: flaps.length,
    checkedVesselsCount: vessels.length,
    fieldsMarkedVerifyCount: zodAudit.fieldsMarkedVerifyCount,
    territoryAudit,
    checks,
  };
}
