import { calculateZPlasty } from './zplastyCalc';

export interface SerialZPlastyResult {
  angleDeg: number;
  totalScarCm: number;
  unitCount: number;
  unitLimbLengthCm: number;
  theoreticalGainPercent: number;
  newTotalLengthCm: number;
  absoluteGainCm: number;
  transverseTensionReductionFactor: number;
  scarRotationDeg: number;
  clinicalNote: string;
}

export function calculateSerialZPlasty(
  angleDeg: number,
  totalScarCm: number,
  unitCount: number
): SerialZPlastyResult {
  const count = Math.max(1, Math.min(4, Math.round(unitCount)));
  const scar = Math.max(1, Math.min(24, totalScarCm));
  const unitLimbLengthCm = Number((scar / count).toFixed(2));
  const single = calculateZPlasty(angleDeg, scar);

  const tensionNote =
    count === 1
      ? single.clinicalNote
      : `${count} serial ${single.angleDeg}° Z-plasties achieve the same +${single.theoreticalGainPercent}% total lengthening as one large Z-plasty while reducing lateral skin tension and transverse width needed by ~${Math.round((1 - 1 / count) * 100)}% (each limb = ${unitLimbLengthCm} cm). Ideal for digits, neck, and perioral scars.`;

  return {
    angleDeg: single.angleDeg,
    totalScarCm: scar,
    unitCount: count,
    unitLimbLengthCm,
    theoreticalGainPercent: single.theoreticalGainPercent,
    newTotalLengthCm: single.newLengthCm,
    absoluteGainCm: single.absoluteGainCm,
    transverseTensionReductionFactor: Number((1 / count).toFixed(2)),
    scarRotationDeg: single.scarRotationDeg,
    clinicalNote: tensionNote,
  };
}

export type RhomboidVariant = 'limberg' | 'dufourmentel';

export interface RhomboidFlapResult {
  variant: RhomboidVariant;
  sideLengthCm: number;
  acuteAngleDeg: number;
  obtuseAngleDeg: number;
  shortDiagonalCm: number;
  longDiagonalCm: number;
  defectAreaCm2: number;
  flapLimbLengthCm: number;
  backCutAngleDeg: number;
  closingVectorNote: string;
  clinicalNote: string;
}

export function calculateRhomboidFlap(
  sideLengthCm: number,
  variant: RhomboidVariant
): RhomboidFlapResult {
  const s = Math.max(0.8, Math.min(10, sideLengthCm));
  const acuteAngleDeg = 60;
  const obtuseAngleDeg = 120;
  const rad60 = (60 * Math.PI) / 180;
  const shortDiagonalCm = Number(s.toFixed(2)); // for 60/120 rhombus, short diagonal = side length
  const longDiagonalCm = Number((s * Math.sqrt(3)).toFixed(2));
  const defectAreaCm2 = Number((s * s * Math.sin(rad60)).toFixed(2));

  if (variant === 'limberg') {
    return {
      variant,
      sideLengthCm: Number(s.toFixed(2)),
      acuteAngleDeg,
      obtuseAngleDeg,
      shortDiagonalCm,
      longDiagonalCm,
      defectAreaCm2,
      flapLimbLengthCm: Number(s.toFixed(2)),
      backCutAngleDeg: 60,
      closingVectorNote:
        'Secondary donor defect closes directly along the short-diagonal extension — orient parallel to Lines of Maximal Extensibility (LME), perpendicular to RSTLs.',
      clinicalNote:
        'Classic Limberg 60°/120° rhombus yields 4 possible flaps (2 off each 120° corner). Pick the flap whose donor closure runs parallel to LME and avoids pulling free margins (eyelid, alar rim, lip).',
    };
  }

  return {
    variant,
    sideLengthCm: Number(s.toFixed(2)),
    acuteAngleDeg,
    obtuseAngleDeg,
    shortDiagonalCm,
    longDiagonalCm,
    defectAreaCm2,
    flapLimbLengthCm: Number(s.toFixed(2)),
    backCutAngleDeg: 30,
    closingVectorNote:
      'First incision bisects the angle between the short-diagonal extension and the adjacent rhomboid side; second limb runs parallel to the long diagonal.',
    clinicalNote:
      'Dufourmentel modification adapts to ANY acute defect angle (not restricted to 60°), creates a wider vascular base and smaller standing cone, and reduces rotational arc compared with Limberg.',
  };
}

export interface BilobedFlapResult {
  defectDiameterCm: number;
  primaryLobeDiameterCm: number;
  secondaryLobeDiameterCm: number;
  totalRotationArcDeg: number;
  primaryArcDeg: number;
  secondaryArcDeg: number;
  burowConeLengthCm: number;
  nasalSuitability: 'Ideal (≤1.5 cm)' | 'Borderline (1.6–2.0 cm)' | 'Too Large (>2.0 cm — consider forehead flap)';
  clinicalNote: string;
}

export function calculateBilobedFlap(defectDiameterCm: number): BilobedFlapResult {
  const d = Math.max(0.5, Math.min(3.5, defectDiameterCm));
  const primaryLobeDiameterCm = Number(d.toFixed(2));
  const secondaryLobeDiameterCm = Number((d * 0.8).toFixed(2));
  const burowConeLengthCm = Number((d * 0.5).toFixed(2));

  let nasalSuitability: BilobedFlapResult['nasalSuitability'] = 'Ideal (≤1.5 cm)';
  let clinicalNote =
    'Zitelli 90° bilobed geometry (45° primary + 45° secondary) transfers upper nasal sidewall laxity to distal nasal tip/ala without standing-cone dog-ears. Size Primary Lobe = 100% of defect diameter to prevent alar rim elevation.';

  if (d > 2.0) {
    nasalSuitability = 'Too Large (>2.0 cm — consider forehead flap)';
    clinicalNote =
      'Distal nasal defects >2.0 cm exceed safe bilobed laxity and risk severe alar notching or nasal valve collapse. Escalate to Paramedian Forehead Flap or cheek interpolation.';
  } else if (d > 1.5) {
    nasalSuitability = 'Borderline (1.6–2.0 cm)';
    clinicalNote =
      'Borderline size for distal nose (1.6–2.0 cm). Requires generous upper nasal sidewall laxity, deep sub-nasalis elevation, and meticulous peripheral undermining to prevent trapdooring.';
  }

  return {
    defectDiameterCm: Number(d.toFixed(2)),
    primaryLobeDiameterCm,
    secondaryLobeDiameterCm,
    totalRotationArcDeg: 90,
    primaryArcDeg: 45,
    secondaryArcDeg: 45,
    burowConeLengthCm,
    nasalSuitability,
    clinicalNote,
  };
}

export type KeystoneBehanType = 'I' | 'IIA' | 'IIB' | 'III' | 'IV';

export interface KeystoneFlapResult {
  behanType: KeystoneBehanType;
  defectWidthCm: number;
  defectLengthCm: number;
  flapWidthCm: number;
  outerArcLengthCm: number;
  lateralLimbAngleDeg: number;
  fascialDivisionRequired: boolean;
  secondaryStsgLikely: boolean;
  subtypeSummary: string;
  clinicalNote: string;
}

export function calculateKeystoneFlap(
  defectWidthCm: number,
  defectLengthCm: number,
  behanType: KeystoneBehanType
): KeystoneFlapResult {
  const w = Math.max(1.0, Math.min(15.0, defectWidthCm));
  const l = Math.max(w * 1.2, Math.min(28.0, defectLengthCm));
  const flapWidthCm = Number(w.toFixed(1)); // Behan 1:1 width rule
  const outerArcLengthCm = Number((l + w * 1.4).toFixed(1));

  const subtypeMeta: Record<
    KeystoneBehanType,
    { fascial: boolean; stsg: boolean; summary: string; note: string }
  > = {
    I: {
      fascial: false,
      stsg: false,
      summary: 'Type I — Standard skin-only incision (deep fascia intact)',
      note: 'Best for trunk, thigh, and lax regions where defects ≤2–4 cm close cleanly via dual V-Y end advancement without fascial release.',
    },
    IIA: {
      fascial: true,
      stsg: false,
      summary: 'Type IIA — Division of outer deep fascia along convex border',
      note: 'Dividing the deep fascia along the outer convex arc adds significant mobility over the lower leg, forearm, and tighter anatomical envelopes while closing primarily.',
    },
    IIB: {
      fascial: true,
      stsg: true,
      summary: 'Type IIB — Deep fascia divided + STSG on secondary defect',
      note: 'Used when primary closure of the outer arc would create excessive tension (e.g., tight shin/ankle); transfers well-vascularized skin over exposed bone/tendon and grafts the benign secondary bed.',
    },
    III: {
      fascial: true,
      stsg: false,
      summary: 'Type III — Double opposing keystone islands (bilateral)',
      note: 'Recruits tissue symmetrically from BOTH sides of a wide defect (sacrum, midline back, wide extremity excision >5–8 cm), halving single-side advancement tension.',
    },
    IV: {
      fascial: true,
      stsg: false,
      summary: 'Type IV — Subfascial undermining up to 50% of island',
      note: 'Rotational keystone variant for joint/contour defects: up to 50% of the island is elevated subfascially while preserving perforators in the remaining 50% base.',
    },
  };

  const meta = subtypeMeta[behanType];

  return {
    behanType,
    defectWidthCm: Number(w.toFixed(1)),
    defectLengthCm: Number(l.toFixed(1)),
    flapWidthCm,
    outerArcLengthCm,
    lateralLimbAngleDeg: 90,
    fascialDivisionRequired: meta.fascial,
    secondaryStsgLikely: meta.stsg,
    subtypeSummary: meta.summary,
    clinicalNote: meta.note,
  };
}

export interface AngiosomePerforasomeEntry {
  id: string;
  name: string;
  sourceArtery: string;
  regionGroup: 'Head & Neck' | 'Trunk' | 'Upper Extremity' | 'Lower Extremity' | 'Perineum & Pelvis';
  adjacentAngiosomes: string[];
  linkingVesselType: 'Choke vessels' | 'True anastomoses' | 'Mixed';
  perforasomePattern: string;
  safeCaptureNote: string;
  delayNote: string;
  linkedFlapIds: string[];
  linkedVesselId: string | null;
  cameraPreset: string;
  accentColor: string;
}

/**
 * Curated Taylor Angiosome & Saint-Cyr Perforasome Atlas (14 core surgical territories).
 * Every linkedFlapId, linkedVesselId (non-null), and cameraPreset maps to real entities in src/data.
 */
export const ANGIOSOME_PERFORASOME_ATLAS: ReadonlyArray<AngiosomePerforasomeEntry> = [
  {
    id: 'ang-diea',
    name: 'Deep Inferior Epigastric (DIEA) Angiosome',
    sourceArtery: 'Deep inferior epigastric artery (external iliac)',
    regionGroup: 'Trunk',
    adjacentAngiosomes: ['Superior epigastric (SEA)', 'Superficial inferior epigastric (SIEA)', 'Deep circumflex iliac (DCIA)', 'Intercostal (T8–T12)'],
    linkingVesselType: 'Choke vessels',
    perforasomePattern: 'Medial row perforators communicate across midline via direct/indirect linking vessels; lateral row runs predominantly ipsilateral toward flank.',
    safeCaptureNote: 'Reliably captures Hartrampf Zones I–III (Holm I, II, ipsilateral III); Zone IV crosses 2+ choke zones and carries high fat necrosis risk.',
    delayNote: 'Preoperative DIEA ligation (surgical delay 2–3 weeks) dilates choke vessels between SEA and DIEA, significantly boosting pedicled TRAM reliability.',
    linkedFlapIds: ['diep-flap', 'tram-flap', 'vram-flap'],
    linkedVesselId: 'v-diea',
    cameraPreset: 'abdomen',
    accentColor: '#0284c7',
  },
  {
    id: 'ang-lcfa',
    name: 'Lateral Circumflex Femoral (LCFA) Angiosome',
    sourceArtery: 'Descending & ascending branches of LCFA (profunda femoris)',
    regionGroup: 'Lower Extremity',
    adjacentAngiosomes: ['Profunda femoris posterior perforators', 'Superficial femoral medial perforators', 'Superior lateral genicular'],
    linkingVesselType: 'Mixed',
    perforasomePattern: 'Axial longitudinal linking vessels along intermuscular septum connect Perforators A, B, and C along the anterolateral thigh axis.',
    safeCaptureNote: 'Single large Perforator B safely captures up to ~25 × 10 cm longitudinally along the ASIS–patella axis via axial linking vessels.',
    delayNote: 'Include ≥2 perforators or supercharge distal tip when harvesting mega-ALT flaps (>30 cm) extending toward the lateral knee.',
    linkedFlapIds: ['alt-flap', 'tfl-flap', 'rectus-femoris-flap', 'amt-flap'],
    linkedVesselId: 'v-lcfa-desc',
    cameraPreset: 'lower-limb-ant',
    accentColor: '#0f766e',
  },
  {
    id: 'ang-thoracodorsal',
    name: 'Thoracodorsal / Subscapular Angiosome',
    sourceArtery: 'Thoracodorsal & circumflex scapular arteries (subscapular trunk)',
    regionGroup: 'Trunk',
    adjacentAngiosomes: ['Posterior intercostal (T6–T11)', 'Lumbar segmental', 'Thoracoacromial', 'Transverse cervical'],
    linkingVesselType: 'Mixed',
    perforasomePattern: 'Descending muscular branch and transverse branch of thoracodorsal artery form rich intramuscular + suprafascial perforasome networks.',
    safeCaptureNote: 'Massive composite/chimeric capture (LD + TDAP + Serratus + Scapular tip) from a single subscapular pedicle; distal lumbar zone depends on choke capture.',
    delayNote: 'Extended LD flaps reaching the iliac crest rely on choke anastomoses with lumbar perforators—avoid tension at distal tip.',
    linkedFlapIds: ['ld-flap', 'tdap-flap', 'serratus-anterior-flap', 'scapular-flap'],
    linkedVesselId: 'v-thoracodorsal',
    cameraPreset: 'back',
    accentColor: '#0d9488',
  },
  {
    id: 'ang-radial',
    name: 'Radial Artery Forearm Angiosome',
    sourceArtery: 'Radial artery (brachial bifurcation)',
    regionGroup: 'Upper Extremity',
    adjacentAngiosomes: ['Ulnar artery', 'Posterior interosseous artery (PIA)', 'Anterior interosseous artery'],
    linkingVesselType: 'True anastomoses',
    perforasomePattern: 'Dense ladder of septocutaneous perforators in lateral intermuscular septum feeding longitudinally oriented axial linking vessels.',
    safeCaptureNote: 'Exceptionally robust skin paddle perfusion across virtually the entire volar-radial forearm; true anastomoses via palmar arches permit reverse-flow pedicled transfer.',
    delayNote: 'Rarely requires delay; mandatory Allen test confirms intact ulnar-to-radial palmar arch anastomoses before trunk harvest.',
    linkedFlapIds: ['rfff-flap', 'pia-flap'],
    linkedVesselId: 'v-radial',
    cameraPreset: 'upper-limb-ant',
    accentColor: '#0369a1',
  },
  {
    id: 'ang-peroneal',
    name: 'Peroneal (Fibular) Artery Angiosome',
    sourceArtery: 'Peroneal artery (tibioperoneal trunk)',
    regionGroup: 'Lower Extremity',
    adjacentAngiosomes: ['Posterior tibial artery', 'Anterior tibial artery', 'Lateral calcaneal & sural territories'],
    linkingVesselType: 'Choke vessels',
    perforasomePattern: 'Septocutaneous perforators emerge along posterior crural septum (especially middle-to-distal third) with longitudinal axial linking along fibula.',
    safeCaptureNote: 'Peroneal perforasome reliably supports fibula skin paddles up to 20 × 8 cm and lateral leg propeller flaps when aligned longitudinally over the posterior septum.',
    delayNote: 'Verify 3-vessel runoff on CTA (exclude peronea arteria magna) so leg foot perfusion across choke zones is not compromised.',
    linkedFlapIds: ['fibula-flap', 'peroneal-perforator-flap', 'peroneus-brevis-flap'],
    linkedVesselId: 'v-peroneal',
    cameraPreset: 'lower-limb-ant',
    accentColor: '#10b981',
  },
  {
    id: 'ang-pta',
    name: 'Posterior Tibial Artery (PTA) Angiosome',
    sourceArtery: 'Posterior tibial artery & medial/lateral plantar branches',
    regionGroup: 'Lower Extremity',
    adjacentAngiosomes: ['Peroneal artery', 'Anterior tibial / dorsalis pedis', 'Medial sural'],
    linkingVesselType: 'True anastomoses',
    perforasomePattern: 'Regularly spaced septocutaneous perforators (4–7, 9–12, 14–18 cm above medial malleolus) plus specialized weight-bearing medial plantar instep perforasome.',
    safeCaptureNote: 'True anastomoses between posterior tibial and plantar arches power durable medial plantar instep flaps and medial leg propeller flaps.',
    delayNote: 'In diabetic/PAD feet, revascularize the specific angiosome directly feeding the ulcer (angiosome-directed revascularization principle).',
    linkedFlapIds: ['ptap-flap', 'medial-plantar-flap', 'soleus-flap'],
    linkedVesselId: null,
    cameraPreset: 'foot',
    accentColor: '#059669',
  },
  {
    id: 'ang-sural',
    name: 'Medial Sural & Neurocutaneous Sural Angiosome',
    sourceArtery: 'Medial sural artery (popliteal) & peroneal-sural septal anastomoses distally',
    regionGroup: 'Lower Extremity',
    adjacentAngiosomes: ['Lateral sural', 'Posterior tibial', 'Peroneal (distal 5 cm pivot)'],
    linkingVesselType: 'Choke vessels',
    perforasomePattern: 'Proximally supplied by musculocutaneous MSAP perforators; distally supplied retrograde via neurocutaneous vasa nervorum/vasa vasorum linked to peroneal perforator.',
    safeCaptureNote: 'Reverse sural flap relies on choke capture in the upper calf—high venous congestion risk in diabetics/smokers if harvested too proximally.',
    delayNote: 'Two-stage surgical delay (10–14 days) markedly reduces tip necrosis in high-risk reverse sural flaps by opening choke vessels.',
    linkedFlapIds: ['gastrocnemius-flap', 'msap-flap', 'reverse-sural-flap'],
    linkedVesselId: 'v-sural-medial',
    cameraPreset: 'lower-limb-post',
    accentColor: '#0ea5e9',
  },
  {
    id: 'ang-thoracoacromial',
    name: 'Thoracoacromial & Internal Mammary (IMA) Angiosomes',
    sourceArtery: 'Thoracoacromial pectoral branch + 1st–4th IMA perforators',
    regionGroup: 'Trunk',
    adjacentAngiosomes: ['Lateral thoracic', 'Anterior intercostal', 'Superior epigastric'],
    linkingVesselType: 'Choke vessels',
    perforasomePattern: 'Pectoralis major forms a Type V dual territory (dominant thoracoacromial + segmental IMA); deltopectoral skin bridges IMA perforators laterally across choke zone to deltoid.',
    safeCaptureNote: 'Skin paddles placed inferomedially over pectoralis major are most reliable; deltopectoral extensions beyond the deltopectoral groove cross choke vessels.',
    delayNote: 'Delaying the lateral deltoid extension of a deltopectoral flap for 14–21 days significantly improves distal tip survival.',
    linkedFlapIds: ['pec-major-flap', 'deltopectoral-flap'],
    linkedVesselId: 'v-thoracoacromial',
    cameraPreset: 'chest-breast',
    accentColor: '#ea580c',
  },
  {
    id: 'ang-gluteal',
    name: 'Superior & Inferior Gluteal (SGA / IGA) Angiosomes',
    sourceArtery: 'Superior & inferior gluteal arteries (internal iliac)',
    regionGroup: 'Perineum & Pelvis',
    adjacentAngiosomes: ['Lumbar (L4) perforators', 'Profunda femoris posterior thigh', 'Internal pudendal'],
    linkingVesselType: 'Choke vessels',
    perforasomePattern: 'Dense vertical musculocutaneous perforators pierce gluteus maximus in upper (SGA) and lower (IGA) halves, linking horizontally across dense gluteal adipose tissue.',
    safeCaptureNote: 'Allows generous SGAP/IGAP breast volume and large sacral/ischial gluteal rotation or V-Y advancement flaps.',
    delayNote: 'In sacral pressure ulcers, preserve an intact muscle or wide dermal-subfascial base so secondary revisions remain possible.',
    linkedFlapIds: ['sgap-flap', 'igap-flap', 'gluteal-rotation-flap', 'lap-flap'],
    linkedVesselId: 'v-sga',
    cameraPreset: 'back',
    accentColor: '#7c3aed',
  },
  {
    id: 'ang-profunda',
    name: 'Profunda Femoris & Medial Circumflex (MCFA) Angiosomes',
    sourceArtery: 'Profunda femoris perforators (1st–3rd) & ascending MCFA',
    regionGroup: 'Lower Extremity',
    adjacentAngiosomes: ['Inferior gluteal', 'Lateral circumflex femoral', 'Obturator / internal pudendal'],
    linkingVesselType: 'Choke vessels',
    perforasomePattern: 'MCFA supplies proximal medial thigh transverse skin (TUG); 1st–3rd profunda perforators pierce adductor magnus to supply posterior-medial subgluteal crescent (PAP).',
    safeCaptureNote: 'Avoid extending TUG flaps too far posteriorly or anteriorly beyond the proximal medial thigh angiosome to prevent distal tip necrosis.',
    delayNote: 'Preoperative MRA/CTA identifies dominant profunda perforator anatomy and prevents chasing diminutive branches.',
    linkedFlapIds: ['gracilis-flap', 'tug-flap', 'pap-flap'],
    linkedVesselId: 'v-profunda-perf',
    cameraPreset: 'lower-limb-post',
    accentColor: '#6366f1',
  },
  {
    id: 'ang-scia',
    name: 'Superficial Circumflex Iliac (SCIA) & SIEA Angiosomes',
    sourceArtery: 'SCIA and SIEA (common femoral artery)',
    regionGroup: 'Perineum & Pelvis',
    adjacentAngiosomes: ['Deep inferior epigastric (DIEA)', 'Deep circumflex iliac (DCIA)', 'Lateral circumflex femoral'],
    linkingVesselType: 'Choke vessels',
    perforasomePattern: 'Axial superficial oblique course parallel to inguinal ligament; superficial branch supplies thin groin/SCIP skin, deep branch supplies iliac crest bone/sartorius.',
    safeCaptureNote: 'SIEA perfusion rarely crosses the abdominal midline reliably (strictly hemiabdominal territory); SCIP reliably captures thin groin paddles.',
    delayNote: 'SIEA is absent or <1.5 mm in up to half of patients—always inspect vessel caliber before committing to SIEA over DIEP.',
    linkedFlapIds: ['groin-flap', 'siea-flap', 'dcia-flap'],
    linkedVesselId: 'v-scia',
    cameraPreset: 'perineum',
    accentColor: '#14b8a6',
  },
  {
    id: 'ang-ophthalmic',
    name: 'Ophthalmic / Supratrochlear Forehead Angiosome',
    sourceArtery: 'Supratrochlear & supraorbital arteries (internal carotid → ophthalmic)',
    regionGroup: 'Head & Neck',
    adjacentAngiosomes: ['Superficial temporal artery', 'Angular / facial artery'],
    linkingVesselType: 'True anastomoses',
    perforasomePattern: 'Vertical axial ascent 1.7–2.2 cm from midline piercing corrugator into subcutaneous plane over frontalis; true anastomoses across midline and with angular artery.',
    safeCaptureNote: 'Narrow 1.2–1.5 cm axial pedicle reliably supports full nasal resurfacing all the way to columella via rich vertical dermal-subcutaneous plexus.',
    delayNote: 'In heavy smokers or scarred foreheads, stage into 3-stage forehead flap (intermediate thinning at 3 weeks, division at 6 weeks).',
    linkedFlapIds: ['paramedian-forehead-flap', 'bilobed-rhomboid-flap'],
    linkedVesselId: 'v-supratrochlear',
    cameraPreset: 'head-neck',
    accentColor: '#f59e0b',
  },
  {
    id: 'ang-facial',
    name: 'Facial, Labial & Submental Angiosome',
    sourceArtery: 'Facial artery, submental artery & superior/inferior labial arcades',
    regionGroup: 'Head & Neck',
    adjacentAngiosomes: ['Transverse facial (STA)', 'Infraorbital (maxillary)', 'Contralateral facial (true anastomoses across lips)'],
    linkingVesselType: 'True anastomoses',
    perforasomePattern: 'True anastomoses across the upper and lower labial arcades and dense facial perforators power bidirectional antegrade/retrograde FAMM, submental, nasolabial, and cross-lip flaps.',
    safeCaptureNote: 'True anastomoses with the angular artery permit superiorly based reverse-flow FAMM and nasolabial flaps even when proximal facial inflow is divided.',
    delayNote: 'For submental flaps, always include the ipsilateral anterior belly of digastric to protect the deep submental arterial course.',
    linkedFlapIds: ['famm-flap', 'submental-island-flap', 'nasolabial-flap', 'abbe-estlander-flap', 'cervicofacial-flap'],
    linkedVesselId: null,
    cameraPreset: 'head-neck',
    accentColor: '#ec4899',
  },
  {
    id: 'ang-pudendal',
    name: 'Internal Pudendal Perineal Angiosome',
    sourceArtery: 'Internal pudendal artery (anterior division of internal iliac)',
    regionGroup: 'Perineum & Pelvis',
    adjacentAngiosomes: ['External pudendal (femoral)', 'Obturator', 'Medial circumflex femoral', 'Inferior gluteal'],
    linkingVesselType: 'True anastomoses',
    perforasomePattern: 'Dense perineal/labial anastomotic arcade between internal pudendal (posteriorly) and external pudendal (anteriorly) supports bidirectional perineal & vaginal flaps.',
    safeCaptureNote: 'Powers posteriorly based Singapore pudendal thigh flaps and either anteriorly or posteriorly based Martius labial fat pads.',
    delayNote: 'Avoid aggressive posterior undermining past the perineal body to preserve entering internal pudendal perforators.',
    linkedFlapIds: ['pudendal-thigh-flap', 'martius-flap'],
    linkedVesselId: null,
    cameraPreset: 'perineum',
    accentColor: '#db2777',
  },
];
