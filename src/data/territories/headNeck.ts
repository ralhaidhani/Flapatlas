import { VERIFIED_ANGIOSOME_BP3D_MAP } from './angiosomes';
import {
  AngiosomeBp3dArtery,
  HeadNeckAngiosomeRecord,
  HeadNeckAngiosomeRecordSchema,
  HeadNeckMuscleTerritoryRecord,
  HeadNeckMuscleTerritoryRecordSchema,
  TerritoryClinicalNoteRecord,
  TerritoryClinicalNoteRecordSchema,
} from './schemas';

/**
 * Phase 11a (§2.2) — Head & Neck angiosomes (Fig 23.37, p. 332.e11) — 13 territories,
 * verbatim muscle tables (Tables 23.3–23.4, pp. 332.e8–e9), and clinical notes.
 *
 * Kept strictly separate from Fig 23.23 body numbering.
 */

const HN_TO_BODY_ANGIOSOME_ID: Readonly<Record<number, string | undefined>> = {
  1: 'angio-3', // Internal maxillary
  2: 'angio-2', // Facial
  3: 'angio-4', // Ophthalmic
  4: 'angio-5', // Superficial temporal
  5: undefined, // Posterior auricular (distinct in Fig 23.37)
  6: 'angio-6', // Occipital
  7: 'angio-8', // Transverse cervical
  8: 'angio-7', // Deep cervical
  9: 'angio-1', // Inferior thyroid (partial match with Fig 23.23 #1 Thyroid)
  10: 'angio-1', // Superior thyroid (absent in BP3D)
  11: undefined, // Vertebral (deep tissue only)
  12: undefined, // Ascending pharyngeal (deep tissue only)
  13: undefined, // Lingual (deep tissue only)
};

const HN_SCHEMATIC_HINTS: Readonly<Record<number, string>> = {
  1: 'Deep midface and buccal/pterygoid region with small midface cutaneous patches (Fig 23.37 #1).',
  2: 'Central and lower face: cheek, lips, nasolabial region, and chin (Fig 23.37 #2).',
  3: 'Forehead, upper eyelid, and orbital region; cutaneous supraorbital/supratrochlear branches absent in BP3D.',
  4: 'Temple and parietal scalp anterior and superior to the auricle (Fig 23.37 #4).',
  5: 'Retroauricular skin and posterior auricle (Fig 23.37 #5).',
  6: 'Occipital scalp and upper posterior neck (Fig 23.37 #6).',
  10: 'Upper anterior neck / superior thyroid region (superior thyroid artery absent in BP3D).',
  11: 'Deep cervical spine and suboccipital musculature; does not reach skin.',
  12: 'Deep pharyngeal wall and skull-base musculature; does not reach skin.',
  13: 'Deep tongue and floor-of-mouth musculature; does not reach skin.',
};

const HN_MIDLINE_CROSSING = new Set<number>([2, 3, 4, 6]);

function buildHeadNeckArteries(
  n: number,
  entryFj?: { left?: string[]; right?: string[]; midline?: string[] }
): AngiosomeBp3dArtery[] {
  if (entryFj && (entryFj.left?.length || entryFj.right?.length || entryFj.midline?.length)) {
    const raw = VERIFIED_ANGIOSOME_BP3D_MAP.head_and_neck_13.find((x) => x.n === n);
    return [
      {
        name: `${(raw?.name ?? `head-neck ${n}`).toLowerCase()} artery`,
        left: entryFj.left ?? [],
        right: entryFj.right ?? [],
        midline: entryFj.midline ?? [],
      },
    ];
  }
  const bodyId = HN_TO_BODY_ANGIOSOME_ID[n];
  if (bodyId && (n === 3 || n === 7 || n === 8)) {
    const bodyNum = Number(bodyId.replace('angio-', ''));
    const bodyEntry = VERIFIED_ANGIOSOME_BP3D_MAP.angiosomes.find((a) => a.id === bodyNum);
    return bodyEntry ? bodyEntry.bp3d_arteries : [];
  }
  return [];
}

export const HEAD_NECK_ANGIOSOMES: readonly HeadNeckAngiosomeRecord[] =
  VERIFIED_ANGIOSOME_BP3D_MAP.head_and_neck_13.map((entry) => {
    const reachesSkin = entry.reaches_skin ?? true;
    const isSchematicOnly = entry.bp3d === 'none';

    return HeadNeckAngiosomeRecordSchema.parse({
      id: `hn-${entry.n}`,
      fig23_37Number: entry.n,
      name: entry.name,
      bp3dCoverage: entry.bp3d,
      reachesSkin,
      bodyAngiosomeId: HN_TO_BODY_ANGIOSOME_ID[entry.n],
      bp3dArteries: buildHeadNeckArteries(entry.n, entry.fj),
      schematicHint: HN_SCHEMATIC_HINTS[entry.n],
      crossesMidline: HN_MIDLINE_CROSSING.has(entry.n),
      sourceRef: {
        chapter: 23,
        page: '332.e11',
        figureOrTable: 'Fig 23.37',
      },
      evidenceType: isSchematicOnly ? 'figure_visual_approximate' : 'figure_caption',
      verificationStatus: 'needs_review',
      schematic: entry.bp3d !== 'full',
    });
  });

export const HEAD_NECK_ANGIOSOME_BY_ID: ReadonlyMap<string, HeadNeckAngiosomeRecord> = new Map(
  HEAD_NECK_ANGIOSOMES.map((a) => [a.id, a])
);

export const HEAD_NECK_ANGIOSOME_BY_NUMBER: ReadonlyMap<number, HeadNeckAngiosomeRecord> =
  new Map(HEAD_NECK_ANGIOSOMES.map((a) => [a.fig23_37Number, a]));

/**
 * Verbatim head-and-neck muscle & aerodigestive groupings from Tables 23.3–23.4 (pp. 332.e8–e9).
 */
const rawHeadNeckMuscleTerritories: Array<
  Omit<HeadNeckMuscleTerritoryRecord, 'verificationStatus' | 'evidenceType'>
> = [
  // Mastication (Table 23.3)
  {
    id: 'hn-muscle-lateral-pterygoid',
    name: 'Lateral pterygoid',
    group: 'mastication',
    territoryCount: 1,
    bp3dPresent: true,
    normalizedAnatomyName: 'lateral pterygoid',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-medial-pterygoid',
    name: 'Medial pterygoid',
    group: 'mastication',
    territoryCount: 1,
    bp3dPresent: true,
    normalizedAnatomyName: 'medial pterygoid',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-buccinator',
    name: 'Buccinator',
    group: 'mastication',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'buccinator',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-temporalis',
    name: 'Temporalis',
    group: 'mastication',
    territoryCount: 2,
    bp3dPresent: false,
    normalizedAnatomyName: 'temporalis',
    clinicalNote: 'Absent in BodyParts3D 4.0; displayed with schematic outline and table badge.',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: true,
  },
  {
    id: 'hn-muscle-masseter',
    name: 'Masseter',
    group: 'mastication',
    territoryCount: 2,
    bp3dPresent: false,
    normalizedAnatomyName: 'masseter',
    clinicalNote: 'Absent in BodyParts3D 4.0; displayed with schematic outline and table badge.',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: true,
  },

  // Posterior neck (Table 23.3)
  {
    id: 'hn-muscle-obliquus-capitis-superior',
    name: 'Obliquus capitis superior',
    group: 'posterior_neck',
    territoryCount: 1,
    bp3dPresent: true,
    normalizedAnatomyName: 'obliquus capitis superior',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-levator-scapulae',
    name: 'Levator scapulae',
    group: 'posterior_neck',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'levator scapulae',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-rectus-capitis-posterior-major',
    name: 'Rectus capitis posterior major',
    group: 'posterior_neck',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'rectus capitis posterior major',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-rectus-capitis-posterior-minor',
    name: 'Rectus capitis posterior minor',
    group: 'posterior_neck',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'rectus capitis posterior minor',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-splenius-capitis',
    name: 'Splenius capitis',
    group: 'posterior_neck',
    territoryCount: 3,
    bp3dPresent: true,
    normalizedAnatomyName: 'splenius capitis',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-splenius-cervicis',
    name: 'Splenius cervicis',
    group: 'posterior_neck',
    territoryCount: 3,
    bp3dPresent: true,
    normalizedAnatomyName: 'splenius cervicis',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-semispinalis-capitis',
    name: 'Semispinalis capitis',
    group: 'posterior_neck',
    territoryCount: 3,
    bp3dPresent: true,
    normalizedAnatomyName: 'semispinalis capitis',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-semispinalis-cervicis',
    name: 'Semispinalis cervicis',
    group: 'posterior_neck',
    territoryCount: 3,
    bp3dPresent: true,
    normalizedAnatomyName: 'semispinalis cervicis',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-obliquus-capitis-inferior',
    name: 'Obliquus capitis inferior',
    group: 'posterior_neck',
    territoryCount: 3,
    bp3dPresent: true,
    normalizedAnatomyName: 'obliquus capitis inferior',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-longissimus-cervicis',
    name: 'Longissimus cervicis',
    group: 'posterior_neck',
    territoryCount: 3,
    bp3dPresent: true,
    normalizedAnatomyName: 'longissimus cervicis',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-trapezius',
    name: 'Trapezius',
    group: 'posterior_neck',
    territoryCount: 4,
    territoryCountVariant: 5,
    variantNote:
      'Four territories when dorsal scapular artery arises from the transverse cervical artery; five territories when dorsal scapular arises separately.',
    bp3dPresent: true,
    normalizedAnatomyName: 'trapezius',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-longissimus-capitis',
    name: 'Longissimus capitis',
    group: 'posterior_neck',
    territoryCount: 5,
    bp3dPresent: true,
    normalizedAnatomyName: 'longissimus capitis',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },

  // Lateral neck (Table 23.3)
  {
    id: 'hn-muscle-scalene-anterior',
    name: 'Scalenus anterior',
    group: 'lateral_neck',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'anterior scalene',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-scalene-medius',
    name: 'Scalenus medius',
    group: 'lateral_neck',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'middle scalene',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-scalene-posterior',
    name: 'Scalenus posterior',
    group: 'lateral_neck',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'posterior scalene',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-sternocleidomastoid',
    name: 'Sternocleidomastoid',
    group: 'lateral_neck',
    territoryCount: 4,
    bp3dPresent: true,
    normalizedAnatomyName: 'sternocleidomastoid',
    clinicalNote:
      'Principal territories are occipital and superior thyroid; a skin paddle placed over the lower pole has a high incidence of loss.',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },

  // Anterior neck (Table 23.3)
  {
    id: 'hn-muscle-thyrohyoid',
    name: 'Thyrohyoid',
    group: 'anterior_neck',
    territoryCount: 1,
    bp3dPresent: true,
    normalizedAnatomyName: 'thyrohyoid',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-sternohyoid',
    name: 'Sternohyoid',
    group: 'anterior_neck',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'sternohyoid',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-longus-cervicis',
    name: 'Longus cervicis (colli)',
    group: 'anterior_neck',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'longus colli',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-longus-capitis',
    name: 'Longus capitis',
    group: 'anterior_neck',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'longus capitis',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-digastric',
    name: 'Digastric',
    group: 'anterior_neck',
    territoryCount: 3,
    bp3dPresent: true,
    normalizedAnatomyName: 'digastric',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },
  {
    id: 'hn-muscle-omohyoid',
    name: 'Omohyoid',
    group: 'anterior_neck',
    territoryCount: 3,
    bp3dPresent: true,
    normalizedAnatomyName: 'omohyoid',
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3' },
    schematic: false,
  },

  // Aerodigestive (Table 23.4)
  {
    id: 'hn-aero-external-nose',
    name: 'External nose (bilateral)',
    group: 'aerodigestive',
    territoryCount: 2,
    bilateral: true,
    bp3dPresent: false,
    normalizedAnatomyName: 'external nose',
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4' },
    schematic: true,
  },
  {
    id: 'hn-aero-internal-nose',
    name: 'Internal nose (bilateral)',
    group: 'aerodigestive',
    territoryCount: 3,
    bilateral: true,
    bp3dPresent: false,
    normalizedAnatomyName: 'internal nose',
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4' },
    schematic: true,
  },
  {
    id: 'hn-aero-geniohyoid',
    name: 'Geniohyoid (extrinsic tongue / floor of mouth)',
    group: 'aerodigestive',
    territoryCount: 1,
    bp3dPresent: true,
    normalizedAnatomyName: 'geniohyoid',
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4' },
    schematic: false,
  },
  {
    id: 'hn-aero-styloglossus',
    name: 'Styloglossus (extrinsic tongue)',
    group: 'aerodigestive',
    territoryCount: 1,
    bp3dPresent: true,
    normalizedAnatomyName: 'styloglossus',
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4' },
    schematic: false,
  },
  {
    id: 'hn-aero-genioglossus',
    name: 'Genioglossus (extrinsic tongue)',
    group: 'aerodigestive',
    territoryCount: 1,
    bp3dPresent: true,
    normalizedAnatomyName: 'genioglossus',
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4' },
    schematic: false,
  },
  {
    id: 'hn-aero-hyoglossus',
    name: 'Hyoglossus (extrinsic tongue)',
    group: 'aerodigestive',
    territoryCount: 1,
    bp3dPresent: true,
    normalizedAnatomyName: 'hyoglossus',
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4' },
    schematic: false,
  },
  {
    id: 'hn-aero-mylohyoid',
    name: 'Mylohyoid (floor of mouth)',
    group: 'aerodigestive',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'mylohyoid',
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4' },
    schematic: false,
  },
  {
    id: 'hn-aero-stylopharyngeus',
    name: 'Stylopharyngeus',
    group: 'aerodigestive',
    territoryCount: 2,
    bp3dPresent: true,
    normalizedAnatomyName: 'stylopharyngeus',
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4' },
    schematic: false,
  },
  {
    id: 'hn-aero-intrinsic-tongue',
    name: 'Intrinsic tongue muscles',
    group: 'aerodigestive',
    territoryCount: 2,
    bp3dPresent: false,
    normalizedAnatomyName: 'intrinsic tongue',
    clinicalNote: 'Poorly vascularised midline raphe creates tip-necrosis risk after unilateral lingual ligation.',
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4' },
    schematic: true,
  },
  {
    id: 'hn-aero-palate-pharynx-oesophagus-trachea',
    name: 'Palate–pharynx–oesophagus–trachea',
    group: 'aerodigestive',
    territoryCount: 5,
    bp3dPresent: false,
    normalizedAnatomyName: 'palate pharynx oesophagus trachea',
    clinicalNote: 'Five territories from hard palate to upper oesophagus, with paucity of vessels in the midline of the palate.',
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4' },
    schematic: true,
  },
];

export const headNeckMuscleTerritories: readonly HeadNeckMuscleTerritoryRecord[] =
  rawHeadNeckMuscleTerritories.map((item) =>
    HeadNeckMuscleTerritoryRecordSchema.parse({
      ...item,
      evidenceType: 'table',
      verificationStatus: 'needs_review',
    })
  );

export const HEAD_NECK_CLINICAL_NOTES: readonly TerritoryClinicalNoteRecord[] = [
  {
    id: 'hn-note-scm',
    name: 'Sternocleidomastoid (4 territories)',
    region: 'head_neck',
    summary:
      'SCM spans four angiosomes with occipital and superior thyroid as principal supplies; a skin paddle at its lower pole carries a high incidence of loss.',
    relatedAngiosomeIds: ['angio-6', 'angio-1'],
    relatedHeadNeckIds: ['hn-6', 'hn-10'],
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3 / Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'hn-note-platysma',
    name: 'Platysma (Carotid–Subclavian Bridge)',
    region: 'head_neck',
    summary:
      'Platysma links the external carotid and subclavian arterial systems and can therefore be raised on either pedicle.',
    relatedAngiosomeIds: ['angio-2', 'angio-8'],
    relatedHeadNeckIds: ['hn-2', 'hn-7'],
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'hn-note-orbicularis-oris',
    name: 'Orbicularis Oris & Abbé Flap',
    region: 'head_neck',
    summary:
      'Orbicularis oris connects left and right sides across the midline via facial artery labial branches, enabling cross-lip transfer (Abbé flap).',
    relatedAngiosomeIds: ['angio-2'],
    relatedHeadNeckIds: ['hn-2'],
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'hn-note-ocular-muscles',
    name: 'Ocular Muscles (Ophthalmic Angiosome)',
    region: 'head_neck',
    summary: 'All six extraocular muscles lie wholly within the ophthalmic angiosome.',
    relatedAngiosomeIds: ['angio-4'],
    relatedHeadNeckIds: ['hn-3'],
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'hn-note-mastication',
    name: 'Muscles of Mastication (3 Territories)',
    region: 'head_neck',
    summary:
      'Collectively, the muscles of mastication span three territories: superficial temporal, internal maxillary, and facial.',
    relatedAngiosomeIds: ['angio-5', 'angio-3', 'angio-2'],
    relatedHeadNeckIds: ['hn-4', 'hn-1', 'hn-2'],
    sourceRef: { chapter: 23, page: '332.e8', figureOrTable: 'Table 23.3 / Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'hn-note-tongue-midline',
    name: 'Tongue Midline Raphe',
    region: 'head_neck',
    summary:
      'The tongue has a poorly vascularised midline fibrous raphe, carrying tip-necrosis risk after unilateral lingual artery ligation.',
    relatedAngiosomeIds: [],
    relatedHeadNeckIds: ['hn-13'],
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4 / Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'hn-note-ear-nose-scalp',
    name: 'External Ear, External Nose & Scalp Arcades',
    region: 'head_neck',
    summary:
      'The external ear and external nose each span two angiosomes; the scalp contains rich longitudinal and transverse arcades crossing the midline.',
    relatedAngiosomeIds: ['angio-4', 'angio-5', 'angio-6'],
    relatedHeadNeckIds: ['hn-3', 'hn-4', 'hn-5', 'hn-6'],
    sourceRef: { chapter: 23, page: '332.e9', figureOrTable: 'Table 23.4 / Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'hn-note-avalvular-veins',
    name: 'Head & Neck Venous Drainage',
    region: 'head_neck',
    summary: 'Most veins of the head and neck are avalvular, permitting bidirectional drainage.',
    relatedAngiosomeIds: [],
    relatedHeadNeckIds: ['hn-1', 'hn-2', 'hn-3', 'hn-4', 'hn-5', 'hn-6'],
    sourceRef: { chapter: 23, page: '332.e11', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
].map((n) => TerritoryClinicalNoteRecordSchema.parse(n));
