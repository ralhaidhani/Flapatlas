import {
  PerforatorAbbreviationRecord,
  PerforatorAbbreviationRecordSchema,
  PerforatorFactRecord,
  PerforatorFactRecordSchema,
  PerforatorNomenclatureExample,
  PerforatorNomenclatureExampleSchema,
  TerritoryRegionFamily,
} from './schemas';

/**
 * Phase 11a (§2.4) — Cutaneous perforator facts, exact Fig 23.51 authorised
 * perforator-territory abbreviations (p. 343), Fig 23.52 nomenclature (pp. 342–343),
 * and preoperative assessment modalities (pp. 338–339, Fig 23.48C).
 */

export const PERFORATOR_FACTS: readonly PerforatorFactRecord[] = [
  {
    id: 'perf-fact-total-count',
    name: 'Total Cutaneous Perforators',
    category: 'quantitative',
    summary:
      'Approximately 400 cutaneous perforators >= 0.5 mm in diameter supply the integument across the human body.',
    sourceRef: { chapter: 23, page: '323–324, 341', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-fact-direct-vs-indirect',
    name: 'Direct vs. Indirect Perforators (~40% / 60%)',
    category: 'classification',
    summary:
      'Roughly 40% are direct cutaneous perforators (piercing deep fascia between deep tissues: axial and septocutaneous) and 60% are indirect perforators (terminal muscular branches penetrating muscle, e.g. DIEA perforators).',
    sourceRef: { chapter: 23, page: '324', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-fact-mc-vs-sc',
    name: 'Musculocutaneous vs. Septocutaneous (~60% / 40%)',
    category: 'classification',
    summary:
      'Approximately 60% of cutaneous perforators are musculocutaneous and 40% are septocutaneous.',
    sourceRef: { chapter: 23, page: '341', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-fact-direct-origins',
    name: 'Three Origins of Direct Cutaneous Vessels',
    category: 'classification',
    summary:
      'Direct cutaneous vessels arise (1) from a source artery just beneath deep fascia (e.g. superficial inferior epigastric), (2) as direct continuations of a source artery (cutaneous branches of external carotid), or (3) from a deep source artery or muscle branch following intermuscular septa (septocutaneous LCFA branches).',
    sourceRef: { chapter: 23, page: '324', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-fact-regional-density',
    name: 'Regional Perforator Size & Density',
    category: 'density',
    summary:
      'Perforators are larger, longer, and fewer in the head, neck, torso, arm, and thigh; smaller, shorter, and more numerous in the forearm, leg, hands, and feet; highest density of small perforators occurs in fixed skin of the palms and soles.',
    sourceRef: { chapter: 23, page: '324, 341', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-fact-emergence-sites',
    name: 'Fixed-Skin Emergence Sites',
    category: 'emergence_sites',
    summary:
      'Perforators emerge preferentially at fixed skin sites: muscle perimeters and intermuscular septa, flexor surfaces of joints, near dorsal and ventral midlines, skull base, orbital margins, nostrils, parotid, facial creases, borders of trapezius and SCM, hyoid, clavicle/sternum, and subcutaneous border of tibia. Arteries radiate from fixed to mobile areas; veins converge from mobile to fixed.',
    sourceRef: { chapter: 23, page: '334', figureOrTable: 'Box 23.1 / Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-fact-leg-lines',
    name: 'Leg Perforator Septal Lines',
    category: 'leg_lines',
    summary:
      'Anterior tibial perforators emerge between tibialis anterior and extensor digitorum longus; posterior tibial perforators emerge between flexor digitorum longus and soleus; lateral peroneal septocutaneous perforators are easiest to dissect distally, while proximal peroneal perforators often follow long intramuscular courses.',
    sourceRef: { chapter: 23, page: '332.e4', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-fact-preop-doppler',
    name: 'Handheld Doppler Assessment',
    category: 'preop_assessment',
    summary:
      'Handheld acoustic Doppler is portable and accessible but limited by background vessel signals, inter-observer variability, and reduced reliability in obese patients.',
    sourceRef: { chapter: 23, page: '338–339', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-fact-preop-duplex',
    name: 'Colour Duplex Ultrasonography',
    category: 'preop_assessment',
    summary:
      'Colour duplex ultrasound maps perforator flow direction and caliber without ionizing radiation, though it remains operator-dependent.',
    sourceRef: { chapter: 23, page: '338–339', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-fact-preop-cta',
    name: 'CT Angiography & DIEP Grid Coding',
    category: 'preop_assessment',
    summary:
      'CT angiography is the most accurate modality for perforator position, diameter, and intramuscular course, resolving perforators down to 0.3 mm. DIEP CTA grids record R/L distance from midline (mm), distance inferior to umbilicus (mm), and perforator caliber (mm).',
    sourceRef: { chapter: 23, page: '338–339', figureOrTable: 'Fig 23.48C / Text' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: false,
  },
].map((f) => PerforatorFactRecordSchema.parse(f));

interface RawFig23_51Code {
  code: string;
  arteryName: string;
  regionFamily: TerritoryRegionFamily;
  bodyAngiosomeId?: string;
  headNeckAngiosomeId?: string;
}

/**
 * Exact Fig 23.51 (p. 343) authorised perforator-territory abbreviation list (56 codes).
 * Labels that appear in the figure without a caption definition must NEVER be added here.
 */
const RAW_FIG_23_51_CODES: readonly RawFig23_51Code[] = [
  { code: 'AIA', arteryName: 'Anterior interosseous a.', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-39' },
  { code: 'ATA', arteryName: 'Anterior tibial a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-26' },
  { code: 'BA', arteryName: 'Brachial a.', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-14' },
  { code: 'CSA', arteryName: 'Circumflex scapular a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-12' },
  { code: 'DCA', arteryName: 'Dorsal carpal arch', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-16' },
  { code: 'DCIA', arteryName: 'Deep circumflex iliac a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-33' },
  { code: 'DGA', arteryName: 'Descending genicular a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-22a' },
  { code: 'DIEA', arteryName: 'Deep inferior epigastric a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-34' },
  { code: 'DPA', arteryName: 'Dorsalis pedis a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-26' },
  { code: 'DPAA', arteryName: 'Deep palmar arch', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-16' },
  { code: 'DPIA', arteryName: 'Dorsal branch of posterior intercostal a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-17' },
  { code: 'EPA', arteryName: 'External pudendal a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-32' },
  { code: 'FA', arteryName: 'Facial a.', regionFamily: 'head_neck', bodyAngiosomeId: 'angio-2', headNeckAngiosomeId: 'hn-2' },
  { code: 'IGA', arteryName: 'Inferior gluteal a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-20' },
  { code: 'IOA', arteryName: 'Infraorbital a.', regionFamily: 'head_neck', bodyAngiosomeId: 'angio-3', headNeckAngiosomeId: 'hn-1' },
  { code: 'IPA', arteryName: 'Internal pudendal a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-40' },
  { code: 'ITA', arteryName: 'Internal thoracic (mammary) a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-35' },
  { code: 'IUCA', arteryName: 'Inferior ulnar collateral a.', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-14' },
  { code: 'LA', arteryName: 'Lumbar aa.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-18' },
  { code: 'LCA', arteryName: 'Lateral calcaneal a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-24' },
  { code: 'LCFA', arteryName: 'Lateral circumflex femoral a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-27' },
  { code: 'LIGA', arteryName: 'Lateral inferior genicular a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-22' },
  { code: 'LPA', arteryName: 'Lateral plantar a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-25' },
  { code: 'LPIA', arteryName: 'Lateral branches of posterior intercostal a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-17' },
  { code: 'LSA', arteryName: 'Lateral sural a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-23' },
  { code: 'LSGA', arteryName: 'Lateral superior genicular a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-22' },
  { code: 'LTA', arteryName: 'Lateral thoracic (mammary) a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-36' },
  { code: 'MA', arteryName: 'Mental a.', regionFamily: 'head_neck', bodyAngiosomeId: 'angio-3', headNeckAngiosomeId: 'hn-1' },
  { code: 'MCA', arteryName: 'Medial calcaneal a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-30' },
  { code: 'MCFA', arteryName: 'Medial circumflex femoral a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-21' },
  { code: 'MIGA', arteryName: 'Medial inferior genicular a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-22' },
  { code: 'MSA', arteryName: 'Medial sural a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-23' },
  { code: 'MSGA', arteryName: 'Medial superior genicular a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-22' },
  { code: 'OCA', arteryName: 'Occipital a.', regionFamily: 'head_neck', bodyAngiosomeId: 'angio-6', headNeckAngiosomeId: 'hn-6' },
  { code: 'OPA', arteryName: 'Ophthalmic a.', regionFamily: 'head_neck', bodyAngiosomeId: 'angio-4', headNeckAngiosomeId: 'hn-3' },
  { code: 'PA', arteryName: 'Popliteal a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-22' },
  { code: 'PAURA', arteryName: 'Posterior auricular a.', regionFamily: 'head_neck', headNeckAngiosomeId: 'hn-5' },
  { code: 'PBA', arteryName: 'Profunda brachii a.', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-13' },
  { code: 'PCHA', arteryName: 'Posterior circumflex humeral a.', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-11' },
  { code: 'PFA', arteryName: 'Profunda femoris a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-21' },
  { code: 'PIA', arteryName: 'Posterior interosseous a.', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-38' },
  { code: 'PNA', arteryName: 'Peroneal a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-24' },
  { code: 'PRCA', arteryName: 'Posterior radial collateral a.', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-13' },
  { code: 'PTA', arteryName: 'Posterior tibial a.', regionFamily: 'lower_limb', bodyAngiosomeId: 'angio-30' },
  { code: 'RA', arteryName: 'Radial a.', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-16' },
  { code: 'RRA', arteryName: 'Radial recurrent a.', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-16' },
  { code: 'SCIA', arteryName: 'Superficial circumflex iliac a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-32' },
  { code: 'SEA', arteryName: 'Superior epigastric a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-35' },
  { code: 'SGA', arteryName: 'Superior gluteal a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-19' },
  { code: 'SIEA', arteryName: 'Superficial inferior epigastric a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-32' },
  { code: 'SMA', arteryName: 'Submental a.', regionFamily: 'head_neck', bodyAngiosomeId: 'angio-2', headNeckAngiosomeId: 'hn-2' },
  { code: 'SPA', arteryName: 'Superficial palmar arch', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-15' },
  { code: 'STA', arteryName: 'Superficial temporal a.', regionFamily: 'head_neck', bodyAngiosomeId: 'angio-5', headNeckAngiosomeId: 'hn-4' },
  { code: 'STHA', arteryName: 'Superior thyroid a.', regionFamily: 'head_neck', bodyAngiosomeId: 'angio-1', headNeckAngiosomeId: 'hn-10' },
  { code: 'SUCA', arteryName: 'Superior ulnar collateral a.', regionFamily: 'upper_limb', bodyAngiosomeId: 'angio-14' },
  { code: 'TAA', arteryName: 'Thoracoacromial a.', regionFamily: 'trunk', bodyAngiosomeId: 'angio-9' },
];

export const FIG_23_51_PERFORATOR_CODES: readonly PerforatorAbbreviationRecord[] =
  RAW_FIG_23_51_CODES.map((c) =>
    PerforatorAbbreviationRecordSchema.parse({
      id: `perf-code-${c.code.toLowerCase()}`,
      name: `${c.code} — ${c.arteryName}`,
      perforasomeCode: c.code,
      arteryName: c.arteryName,
      regionFamily: c.regionFamily,
      bodyAngiosomeId: c.bodyAngiosomeId,
      headNeckAngiosomeId: c.headNeckAngiosomeId,
      sourceRef: { chapter: 23, page: '343', figureOrTable: 'Fig 23.51' },
      evidenceType: 'figure_caption',
      verificationStatus: 'needs_review',
      schematic: false,
    })
  );

export const AUTHORISED_PERFORASOME_CODES: ReadonlySet<string> = new Set(
  FIG_23_51_PERFORATOR_CODES.map((c) => c.perforasomeCode)
);

export const PERFORATOR_CODE_BY_ABBR: ReadonlyMap<string, PerforatorAbbreviationRecord> = new Map(
  FIG_23_51_PERFORATOR_CODES.map((c) => [c.perforasomeCode, c])
);

export const PERFORATOR_NOMENCLATURE_RULE = {
  id: 'perf-nomenclature-rule',
  name: 'Gent / Ch. 23 Perforator Flap Nomenclature',
  formula: '<source artery> + AP (artery perforator) + -<muscle initials> (or -s for septocutaneous)',
  sourceRef: { chapter: 23 as const, page: '342–343', figureOrTable: 'Fig 23.52' },
  evidenceType: 'figure_caption' as const,
  verificationStatus: 'needs_review' as const,
  schematic: false,
};

export const PERFORATOR_NOMENCLATURE_EXAMPLES: readonly PerforatorNomenclatureExample[] = [
  {
    id: 'perf-nom-dieap-ra',
    name: 'DIEAP-ra',
    code: 'DIEAP-ra',
    sourceCode: 'DIEA',
    muscleSuffix: 'ra',
    septocutaneous: false,
    meaning: 'Deep inferior epigastric artery perforator traversing rectus abdominis.',
    relatedFlapIds: ['diep-flap'],
    sourceRef: { chapter: 23, page: '343', figureOrTable: 'Fig 23.52' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-nom-lcfap-vl',
    name: 'LCFAP-vl',
    code: 'LCFAP-vl',
    sourceCode: 'LCFA',
    muscleSuffix: 'vl',
    septocutaneous: false,
    meaning: 'Lateral circumflex femoral artery perforator traversing vastus lateralis (ALT flap).',
    relatedFlapIds: ['alt-flap'],
    sourceRef: { chapter: 23, page: '343', figureOrTable: 'Fig 23.52' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-nom-smap',
    name: 'SMAP',
    code: 'SMAP',
    sourceCode: 'SMA',
    bodyAngiosomeId: 'angio-2',
    septocutaneous: false,
    meaning: 'Submental artery perforator flap.',
    relatedFlapIds: ['submental-island-flap'],
    sourceRef: { chapter: 23, page: '343', figureOrTable: 'Fig 23.52' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-nom-pioap-s',
    name: 'PIOAP-s',
    code: 'PIOAP-s',
    sourceCode: 'PIA',
    bodyAngiosomeId: 'angio-38',
    septocutaneous: true,
    meaning: 'Posterior interosseous artery septocutaneous perforator flap.',
    relatedFlapIds: ['pia-flap'],
    sourceRef: { chapter: 23, page: '343', figureOrTable: 'Fig 23.52' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-nom-tap-ld',
    name: 'TAP-ld',
    code: 'TAP-ld',
    bodyAngiosomeId: 'angio-37',
    muscleSuffix: 'ld',
    septocutaneous: false,
    meaning: 'Thoracodorsal artery perforator traversing latissimus dorsi (TDAP flap).',
    relatedFlapIds: ['tdap-flap'],
    sourceRef: { chapter: 23, page: '343', figureOrTable: 'Fig 23.52' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-nom-sgap-gm',
    name: 'SGAP-gm',
    code: 'SGAP-gm',
    sourceCode: 'SGA',
    muscleSuffix: 'gm',
    septocutaneous: false,
    meaning: 'Superior gluteal artery perforator traversing gluteus maximus.',
    relatedFlapIds: ['sgap-flap'],
    sourceRef: { chapter: 23, page: '343', figureOrTable: 'Fig 23.52' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'perf-nom-igap-gm',
    name: 'IGAP-gm',
    code: 'IGAP-gm',
    sourceCode: 'IGA',
    muscleSuffix: 'gm',
    septocutaneous: false,
    meaning: 'Inferior gluteal artery perforator traversing gluteus maximus.',
    relatedFlapIds: ['igap-flap'],
    sourceRef: { chapter: 23, page: '343', figureOrTable: 'Fig 23.52' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: false,
  },
].map((e) => PerforatorNomenclatureExampleSchema.parse(e));
