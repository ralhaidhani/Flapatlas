import {
  DelayMilestoneRecord,
  DelayMilestoneRecordSchema,
  DesignPrincipleRecord,
  DesignPrincipleRecordSchema,
} from './schemas';

/**
 * Phase 11a (§2.5) — Paraphrased flap-design principles (Box 23.1, survival rules,
 * fasciocutaneous/musculocutaneous & venous drainage, read-only Propeller flap rule,
 * composite flaps, surgical delay physiology & milestones, educational neurovascular
 * patterns A–E, and forearm/leg bone vascular supply notes).
 */

export const DESIGN_PRINCIPLES: readonly DesignPrincipleRecord[] = [
  // ---- Box 23.1 (p. 334) & Vascular Architecture ----
  {
    id: 'principle-connective-framework',
    name: 'Connective-Tissue Framework',
    category: 'box_23_1',
    summary: 'Vessels travel along and within the body’s connective-tissue framework rather than crossing free spaces.',
    sourceRef: { chapter: 23, page: '334', figureOrTable: 'Box 23.1' },
    evidenceType: 'table',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-fixed-to-mobile',
    name: 'Fixed-to-Mobile Flow Polarity',
    category: 'box_23_1',
    summary: 'Arteries radiate outward from fixed-skin anchor zones toward mobile areas, whereas veins converge from mobile areas back to fixed zones.',
    sourceRef: { chapter: 23, page: '334', figureOrTable: 'Box 23.1' },
    evidenceType: 'table',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-hitchhike-nerves',
    name: 'Vessels Hitchhike With Nerves',
    category: 'box_23_1',
    summary: 'Cutaneous and muscular vessels consistently track alongside nerves, providing reliable neurovascular landmarks during dissection.',
    sourceRef: { chapter: 23, page: '334', figureOrTable: 'Box 23.1' },
    evidenceType: 'table',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-growth-differentiation',
    name: 'Growth & Differentiation',
    category: 'box_23_1',
    summary: 'Vessel caliber, length, and longitudinal orientation mirror the differential growth of the tissues they supply.',
    sourceRef: { chapter: 23, page: '334', figureOrTable: 'Box 23.1 / Fig 23.39' },
    evidenceType: 'table',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-roman-aqueduct-arcades',
    name: 'Continuous 3-D Network of Arcades',
    category: 'box_23_1',
    summary: 'Vessels interconnect across deep, fascial, and subdermal planes as tiered 3-D arcades likened to a Roman aqueduct.',
    sourceRef: { chapter: 23, page: '321, 336', figureOrTable: 'Box 23.1 / Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-law-of-equilibrium',
    name: 'Law of Equilibrium',
    category: 'box_23_1',
    summary: 'Adjacent vascular territories stand in inverse proportion—for example, a dominant superficial inferior epigastric system implies a reciprocal smaller DIEA territory and potential superficial venous dependence in a DIEAP flap.',
    sourceRef: { chapter: 23, page: '334, 337', figureOrTable: 'Box 23.1 / Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-constant-destination',
    name: 'Constant Destination, Variable Origin',
    category: 'box_23_1',
    summary: 'Vessels maintain a relatively constant target territory despite variable proximal origins (e.g. SIEA and SCIA arising separately from the common femoral artery or via a shared trunk).',
    sourceRef: { chapter: 23, page: '334', figureOrTable: 'Box 23.1' },
    evidenceType: 'table',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-valvular-avalvular-veins',
    name: 'Linked Valvular & Avalvular Venous Channels',
    category: 'box_23_1',
    summary: 'Venous networks combine directional valved conduits with oscillating avalvular bridging veins that mirror arterial choke junctions, while skeletal muscles act as the prime movers of venous return.',
    sourceRef: { chapter: 23, page: '334, 337', figureOrTable: 'Box 23.1 / Fig 23.44' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },

  // ---- Flap Survival & Design (pp. 331–332, 339–344) ----
  {
    id: 'principle-safe-boundary-capture',
    name: 'Adjacent Territory Capture & Survival Limit',
    category: 'survival_and_design',
    summary: 'Each angiosome defines the safe boundary per tissue layer, and a flap can reliably capture the adjacent cutaneous territory in any direction; in ~80% of animal experiments survival ended at the junction of the second and third territory, with a third territory potentially captured after delay.',
    sourceRef: { chapter: 23, page: '331–332, 339', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-intramuscular-shunt',
    name: 'Intramuscular Bypass Shunt',
    category: 'survival_and_design',
    summary: 'Because most muscles span two or more angiosomes with junctions located inside the muscle belly, skin of an adjacent territory can be captured reliably through the underlying muscle.',
    sourceRef: { chapter: 23, page: '331–332', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-survival-determinants',
    name: 'Determinants of Viable Flap Length',
    category: 'survival_and_design',
    summary: 'Surviving flap length depends on dominant vessel caliber/length, captured adjacent arterial/venous span, connecting choke-vessel caliber/length, favourable versus unfavourable venous return, and total flap volume—so large spaced perforators (torso, scalp) support longer flaps than small dense perforators (sole).',
    sourceRef: { chapter: 23, page: '339–340', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },

  // ---- Fasciocutaneous, Musculocutaneous & Venous Return (pp. 340–341) ----
  {
    id: 'principle-deep-fascia-inclusion',
    name: 'Deep Fascia Inclusion Rule',
    category: 'fasciocutaneous_musculocutaneous',
    summary: 'Include deep fascia where skin is tightly bound to fascia (scalp, extremities), whereas fascial inclusion is unnecessary where skin glides freely (iliac fossa, breast); "septocutaneous" can also be a surgical plane rather than strict anatomy (radial/ulnar flaps).',
    sourceRef: { chapter: 23, page: '340–341', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-skin-muscle-adherence',
    name: 'Firmly Bound vs. Gliding Muscles',
    category: 'fasciocutaneous_musculocutaneous',
    summary: 'Skin firmly bound to underlying muscle (gluteus maximus, latissimus dorsi) has dependable musculocutaneous perfusion, whereas skin overlying muscles that glide beneath fascia (gracilis) has tenuous cutaneous supply.',
    sourceRef: { chapter: 23, page: '340', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-distally-based-venous',
    name: 'Venous Orientation in Distally vs. Proximally Based Flaps',
    category: 'venous_return',
    summary: 'Perforators radiate in stellate patterns with veins converging on the pedicle so distally based perforator flaps drain back toward that pedicle; limb longitudinal subcutaneous veins favour proximally based flaps, lower abdominal SIEV drains distally toward the groin, and scalp veins are largely valveless.',
    sourceRef: { chapter: 23, page: '340–341', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'principle-musculocutaneous-venous-types',
    name: 'Musculocutaneous Venous Pathways (Pedicled TRAM)',
    category: 'venous_return',
    summary: 'Type I muscles drain favourably regardless of skin-paddle placement, whereas paddles over the distal venous territory of Type II/III muscles face valves opposing the pedicle—a key congestion mechanism in the pedicled TRAM flap.',
    sourceRef: { chapter: 23, page: '341', figureOrTable: 'Text / Fig 23.14' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },

  // ---- Propeller Flap Read-Only Rule Card (Fig 23.50, p. 340) ----
  {
    id: 'principle-propeller-flap-rule',
    name: 'Propeller Flap Design Rule (Read-Only)',
    category: 'propeller_rule',
    summary:
      'Designed as an island perforator flap rotated around the largest uninjured perforator adjacent to the defect with blade length relation a = b + c + 1 cm (as printed in Fig 23.50): blade b closes the donor site while blade a covers the defect; release deep fascia around the perforator to prevent kinking.',
    readOnlyRule: true,
    sourceRef: { chapter: 23, page: '340', figureOrTable: 'Fig 23.50' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: true,
  },

  // ---- Composite Flaps (p. 344) ----
  {
    id: 'principle-composite-scia-dcia',
    name: 'Composite Inter-Layer Angiosome Interconnection',
    category: 'composite_flaps',
    summary:
      'Direct cutaneous SCIA perforators interconnect with indirect perforators of the DCIA: a DCIA osteocutaneous flap perfuses the SCIA skin territory, and conversely the SCIA can perfuse the anterior iliac crest and attached musculature.',
    sourceRef: { chapter: 23, page: '344', figureOrTable: 'Text' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },

  // ---- Delay Concept (pp. 342–344, Figs 23.53–23.56) ----
  {
    id: 'principle-delay-techniques',
    name: 'Surgical Delay Options & Permanent Choke Dilation',
    category: 'delay_physiology',
    summary:
      'Delay options include partial margin incision, ligation of non-pedicle vessels, or staged partial/complete elevation; choke vessel dilation becomes permanent and irreversible, shifting the potential line of necrosis outward to the next choke junction or beyond.',
    sourceRef: { chapter: 23, page: '342–344', figureOrTable: 'Figs 23.53–23.56' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },

  // ---- Neurovascular Relationship Patterns A–E (pp. 326–328, 335; Figs 23.15–23.16, 23.46) ----
  {
    id: 'nv-pattern-a',
    name: 'Neurovascular Pattern A — True Anastomotic Companion',
    category: 'neurovascular_pattern',
    patternCode: 'A',
    summary:
      'A long artery joined to its neighbouring artery by a true anastomosis courses directly alongside the cutaneous nerve.',
    educationalCardOnly: true,
    sourceRef: { chapter: 23, page: '326–328', figureOrTable: 'Figs 23.15–23.16' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: true,
  },
  {
    id: 'nv-pattern-b',
    name: 'Neurovascular Pattern B — Chain-Linked Hitchhiking',
    category: 'neurovascular_pattern',
    patternCode: 'B',
    summary:
      'A chain-linked series of sequential arteries hitchhikes along the course of the cutaneous nerve.',
    educationalCardOnly: true,
    sourceRef: { chapter: 23, page: '326–328', figureOrTable: 'Figs 23.15–23.16' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: true,
  },
  {
    id: 'nv-pattern-c',
    name: 'Neurovascular Pattern C — Shared Fascial Emergence',
    category: 'neurovascular_pattern',
    patternCode: 'C',
    summary: 'Cutaneous nerve and accompanying artery pierce the deep fascia together as a paired bundle.',
    educationalCardOnly: true,
    sourceRef: { chapter: 23, page: '326–328', figureOrTable: 'Figs 23.15–23.16' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: true,
  },
  {
    id: 'nv-pattern-d',
    name: 'Neurovascular Pattern D — Parallel Then Convergent',
    category: 'neurovascular_pattern',
    patternCode: 'D',
    summary:
      'The nerve initially runs parallel to one artery, then approaches the neighbouring artery and descends along its branches.',
    educationalCardOnly: true,
    sourceRef: { chapter: 23, page: '326–328', figureOrTable: 'Figs 23.15–23.16' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: true,
  },
  {
    id: 'nv-pattern-e',
    name: 'Neurovascular Pattern E — Arcade Crossing',
    category: 'neurovascular_pattern',
    patternCode: 'E',
    summary:
      'The nerve crosses primary and secondary arterial arcades before turning to run parallel with the vascular network.',
    educationalCardOnly: true,
    sourceRef: { chapter: 23, page: '326–328', figureOrTable: 'Figs 23.15–23.16' },
    evidenceType: 'figure_caption',
    verificationStatus: 'needs_review',
    schematic: true,
  },
  {
    id: 'nv-clinical-examples',
    name: 'Venous Pairing & Named Neurovascular Flaps',
    category: 'neurovascular_pattern',
    summary:
      'Superficial veins track cutaneous nerves in the horizontal subdermal plane while deep veins follow arteries (venae comitantes). Named examples: lateral intercostal neurovascular perforators, saphenous system, lateral femoral cutaneous nerve with SCIA, Pontén long/short saphenous flaps, and sural/saphenous neurovascular flaps.',
    educationalCardOnly: true,
    sourceRef: { chapter: 23, page: '326–328, 335', figureOrTable: 'Figs 23.15–23.16, 23.46' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: true,
  },

  // ---- Bone Vascular Supply Cards (11d reference) ----
  {
    id: 'bone-radius-ulna',
    name: 'Radius & Ulna Angiosome Supply',
    category: 'bone_vascular_supply',
    summary:
      'Bone receives blood via attached muscles, periosteal, and nutrient branches: the radius is supplied predominantly by the radial artery (proximal branches + distal septoperiosteal branches) with its nutrient artery from the anterior interosseous artery; the ulna is supplied predominantly by the ulnar artery.',
    sourceRef: { chapter: 23, page: '332.e1–332.e3', figureOrTable: 'Figs 23.26–23.29' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
  {
    id: 'bone-tibia-fibula',
    name: 'Tibia & Fibula Angiosome Supply',
    category: 'bone_vascular_supply',
    summary:
      'The fibula sits within the peroneal angiosome (periosteal and nutrient supply with distal septocutaneous perforators in the posterior intermuscular septum), while the tibia bridges anterior tibial and posterior tibial angiosomes via periosteal and muscular attachments.',
    sourceRef: { chapter: 23, page: '332.e4–332.e5', figureOrTable: 'Figs 23.30–23.33' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: false,
  },
].map((p) => DesignPrincipleRecordSchema.parse(p));

/**
 * Printed surgical delay physiology milestones (pp. 342–344, Figs 23.53–23.56).
 * Visual scale factors are decorative animation weights only (not clinical measurements).
 */
export const DELAY_MILESTONES: readonly DelayMilestoneRecord[] = [
  {
    id: 'delay-milestone-1',
    name: 'Immediate Vasoconstriction',
    order: 1,
    timeWindowLabel: '0 h (Immediate)',
    vascularState: 'Immediate sympathetic vasoconstriction across the choke anastomotic zone.',
    visualScaleFactor: 0.7,
    isClinicalMeasurement: false,
    sourceRef: { chapter: 23, page: '342–344', figureOrTable: 'Figs 23.53–23.56' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: true,
  },
  {
    id: 'delay-milestone-2',
    name: 'Gradual Dilation',
    order: 2,
    timeWindowLabel: '0–48 h',
    vascularState: 'Gradual opening and caliber increase of connecting choke vessels over the first 48 hours.',
    visualScaleFactor: 1.1,
    isClinicalMeasurement: false,
    sourceRef: { chapter: 23, page: '342–344', figureOrTable: 'Figs 23.53–23.56' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: true,
  },
  {
    id: 'delay-milestone-3',
    name: 'Dramatic Dilation',
    order: 3,
    timeWindowLabel: '48–72 h',
    vascularState: 'Dramatic choke-vessel dilation driven by vascular smooth muscle hyperplastic/hypertrophic remodelling.',
    visualScaleFactor: 1.55,
    isClinicalMeasurement: false,
    sourceRef: { chapter: 23, page: '342–344', figureOrTable: 'Figs 23.53–23.56' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: true,
  },
  {
    id: 'delay-milestone-4',
    name: 'Permanent Plateau',
    order: 4,
    timeWindowLabel: '~7 days',
    vascularState: 'Plateau reached by ~7 days; enlargement is permanent and irreversible, shifting the necrosis boundary outward.',
    visualScaleFactor: 1.85,
    isClinicalMeasurement: false,
    sourceRef: { chapter: 23, page: '342–344', figureOrTable: 'Figs 23.53–23.56' },
    evidenceType: 'text',
    verificationStatus: 'needs_review',
    schematic: true,
  },
].map((m) => DelayMilestoneRecordSchema.parse(m));

export const DELAY_THREE_STEP_EXPLAINER = [
  {
    step: 1,
    title: 'Flap raised without delay',
    summary: 'Necrosis typically occurs at the junction of the second and third territory (choke anastomosis).',
  },
  {
    step: 2,
    title: 'Delay procedure performed',
    summary: 'Choke vessels permanently dilate over 48–72 h (plateau by ~7 days), shifting the necrosis line outward.',
  },
  {
    step: 3,
    title: 'Divided and re-elevated',
    summary: 'Secondary division and elevation safely captures an additional territory for the longest viable flap.',
  },
] as const;

/**
 * Upper-limb cutaneous nerves labelled in Fig 23.46 (p. 335).
 * Educational reference list only — BodyParts3D has no peripheral limb nerve meshes.
 */
export const FIG_23_46_UPPER_LIMB_CUTANEOUS_NERVES: readonly string[] = [
  'Axillary nerve',
  'Lower lateral brachial cutaneous nerve',
  'Supraclavicular nerves',
  'Intercostobrachial nerve',
  'Posterior antebrachial cutaneous nerve',
  'Medial antebrachial cutaneous nerve',
  'Medial brachial cutaneous nerve',
  'Lateral antebrachial cutaneous nerve',
  'Dorsal branch of ulnar nerve',
  'Superficial radial nerve',
  'Median nerve (cutaneous branches)',
  'Ulnar nerve (cutaneous branches)',
];
