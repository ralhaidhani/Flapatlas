import rawBp3dMap from './angiosome_bp3d_map.json';
import {
  AngiosomeBp3dMapFile,
  AngiosomeBp3dMapFileSchema,
  AngiosomeNumber,
  BodyAngiosomeRecord,
  BodyAngiosomeRecordSchema,
  TerritoryRegionFamily,
} from './schemas';

/**
 * Phase 11a (§2.1) — The 40 body angiosomes (+ 22a = 41 entries) from
 * Morris SF, Taylor GI. Vascular territories. Neligan PC, Plastic Surgery,
 * Vol 1 (Principles), Chapter 23, Fig 23.23 (p. 332).
 *
 * Numbering is strictly Fig 23.23's and is never mixed with the 13 head-and-neck
 * numbering of Fig 23.37 (`headNeck.ts`).
 */

export const VERIFIED_ANGIOSOME_BP3D_MAP: AngiosomeBp3dMapFile =
  AngiosomeBp3dMapFileSchema.parse(rawBp3dMap);

export const ANGIOSOME_FOUNDATION_NOTES = {
  definition: {
    id: 'angiosome-definition',
    name: 'Angiosome Definition',
    summary:
      'An angiosome is a composite 3-D block of tissue (skin, fascia, muscle, bone, and nerve) supplied by one source artery and its accompanying vein(s); adjacent angiosomes are linked by reduced-caliber choke vessels or by true anastomoses without reduction in caliber.',
    sourceRef: { chapter: 23 as const, page: '321', figureOrTable: 'Text' },
    evidenceType: 'text' as const,
    verificationStatus: 'needs_review' as const,
    schematic: false,
  },
  subdivision: {
    id: 'angiosome-subdivision',
    name: '3-D Jigsaw & Subdivisions',
    summary:
      'The body forms a 3-D vascular jigsaw; the initial 40 body territories were later subdivided into 61 territories (perforator atlas, Fig 23.51), and the head and neck—originally mapped as eight—comprise 13 territories.',
    sourceRef: { chapter: 23 as const, page: '329', figureOrTable: 'Text / Fig 23.51' },
    evidenceType: 'text' as const,
    verificationStatus: 'needs_review' as const,
    schematic: false,
  },
  trueAnastomosisNote: {
    id: 'angiosome-true-anastomoses',
    name: 'Choke Vessels vs. True Anastomoses',
    summary:
      'Adjacent territories are linked by reduced-caliber choke vessels or by true anastomoses; true anastomoses occur variably, most commonly along cutaneous nerves or where skin is mobile.',
    sourceRef: { chapter: 23 as const, page: '331', figureOrTable: 'Text' },
    evidenceType: 'text' as const,
    verificationStatus: 'needs_review' as const,
    schematic: false,
  },
};

function getRegionFamilyForFig23_23(id: AngiosomeNumber): TerritoryRegionFamily {
  if (id === '22a') return 'lower_limb';
  if (id >= 1 && id <= 8) return 'head_neck';
  if ((id >= 9 && id <= 10) || (id >= 17 && id <= 20) || (id >= 33 && id <= 37) || id === 40) {
    return 'trunk';
  }
  if ((id >= 11 && id <= 16) || id === 38 || id === 39) {
    return 'upper_limb';
  }
  return 'lower_limb';
}

/**
 * Only midline-crossing structures explicitly named in §2.2 (scalp, lips, forehead)
 * are allowed to cross the calibrated midline in the 3D territory field.
 */
const MIDLINE_CROSSING_BODY_NUMBERS = new Set<AngiosomeNumber>([2, 4, 5, 6]);

export function formatAngiosomeId(num: AngiosomeNumber): string {
  return `angio-${String(num)}`;
}

const rawBodyAngiosomes: BodyAngiosomeRecord[] = VERIFIED_ANGIOSOME_BP3D_MAP.angiosomes.map(
  (entry) => {
    const isSharedFemoral = entry.id === 31 || entry.id === 32;
    const isSchematicOnly = entry.bp3d_coverage === 'none';

    return BodyAngiosomeRecordSchema.parse({
      id: formatAngiosomeId(entry.id),
      fig23_23Number: entry.id,
      name: entry.name,
      abbr: entry.abbr,
      regionFamily: getRegionFamilyForFig23_23(entry.id),
      bp3dCoverage: entry.bp3d_coverage,
      bp3dArteries: entry.bp3d_arteries,
      note: entry.note,
      schematicHint: entry.schematic_hint,
      reachesSkin: true,
      crossesMidline: MIDLINE_CROSSING_BODY_NUMBERS.has(entry.id),
      sharedMeshGroup: isSharedFemoral ? 'femoral-31-32' : undefined,
      visualTuning: {
        weight: 1.0,
        isClinicalMeasurement: false,
      },
      sourceRef: {
        chapter: 23,
        page: '332',
        figureOrTable: 'Fig 23.23',
      },
      evidenceType: isSchematicOnly ? 'figure_visual_approximate' : 'figure_caption',
      verificationStatus: 'needs_review',
      schematic: entry.bp3d_coverage !== 'full',
    });
  }
);

export const BODY_ANGIOSOMES: readonly BodyAngiosomeRecord[] = rawBodyAngiosomes;

export const BODY_ANGIOSOME_BY_ID: ReadonlyMap<string, BodyAngiosomeRecord> = new Map(
  BODY_ANGIOSOMES.map((a) => [a.id, a])
);

export const BODY_ANGIOSOME_BY_NUMBER: ReadonlyMap<AngiosomeNumber, BodyAngiosomeRecord> =
  new Map(BODY_ANGIOSOMES.map((a) => [a.fig23_23Number, a]));

export function getBodyAngiosomeByNumber(num: AngiosomeNumber): BodyAngiosomeRecord | undefined {
  return BODY_ANGIOSOME_BY_NUMBER.get(num);
}

export function getBodyAngiosomeDisplayLabel(a: BodyAngiosomeRecord): string {
  if (a.sharedMeshGroup === 'femoral-31-32') {
    return `Femoral (31+32) · ${a.name}`;
  }
  return `${String(a.fig23_23Number)}. ${a.name}${a.abbr ? ` (${a.abbr})` : ''}`;
}

export function summarizeBp3dCoverageCounts(): {
  total: number;
  full: number;
  partial: number;
  none: number;
} {
  let full = 0;
  let partial = 0;
  let none = 0;
  for (const a of BODY_ANGIOSOMES) {
    if (a.bp3dCoverage === 'full') full += 1;
    else if (a.bp3dCoverage === 'partial') partial += 1;
    else none += 1;
  }
  return { total: BODY_ANGIOSOMES.length, full, partial, none };
}
