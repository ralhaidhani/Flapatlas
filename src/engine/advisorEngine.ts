import type { DefectLocation, FlapRecord } from '../types/schemas';

export interface AdvisorInput {
  locationId: string;
  lengthCm: number;
  widthCm: number;
  depth: 'Superficial' | 'Full-thickness' | 'Deep / cavitary';
  boneLengthCm?: number;
  missingTissues: string[];
  woundCharacteristics: string[];
  functionalGoals: string[];
  recipientVesselStatus: 'Available' | 'Zone of injury' | 'Previous radiation' | 'Vein graft likely';
  patientFactors: string[];
  mobilizationPreference: 'Any' | 'Local / Regional preferred' | 'Free flap acceptable' | 'Short OR time';
}

export interface ScoreBreakdownItem {
  category: string;
  delta: number;
  detail: string;
}

export interface AdvisorRecommendation {
  flap: FlapRecord;
  score: number; // 0-100
  scoreBreakdown: ScoreBreakdownItem[];
  sizeStatus: 'green' | 'yellow' | 'red';
  sizeNote: string;
  reachStatus: 'optimal' | 'caution' | 'limited';
  reachNote: string;
  donorMorbiditySummary: string;
  reasons: string[];
  warnings: string[];
  suggestedMode: 'Pedicled / Local' | 'Free Tissue Transfer' | 'Pedicled or Free';
  backupIds: string[];
}

export interface AdvisorResult {
  recommendations: AdvisorRecommendation[];
  reconstructiveLadder: string[];
  recipientVessels: string[];
  generalWarnings: string[];
  defectAreaRectCm2: number;
  defectAreaEllipseCm2: number;
}

export function computeDefectAreaCm2(lengthCm: number, widthCm: number): {
  rectangular: number;
  elliptical: number;
} {
  const l = Math.max(0.5, Number.isFinite(lengthCm) ? lengthCm : 1);
  const w = Math.max(0.5, Number.isFinite(widthCm) ? widthCm : 1);
  return {
    rectangular: Math.round(l * w * 10) / 10,
    elliptical: Math.round(((Math.PI * l * w) / 4) * 10) / 10,
  };
}

export function findNearestDefectLocation(
  point3d: [number, number, number],
  locations: DefectLocation[]
): DefectLocation | null {
  if (!locations.length) return null;
  let best = locations[0];
  let bestDistSq = Infinity;
  for (const loc of locations) {
    const dx = loc.position3d[0] - point3d[0];
    const dy = loc.position3d[1] - point3d[1];
    const dz = loc.position3d[2] - point3d[2];
    const dSq = dx * dx + dy * dy + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = loc;
    }
  }
  return best;
}

export function cameraPresetForDefect(locationId: string): string {
  switch (locationId) {
    case 'scalp':
    case 'nose':
    case 'oral-cavity':
    case 'mandible':
    case 'cheek-lip':
    case 'neck':
      return 'head-neck';
    case 'chest-sternum':
    case 'breast':
      return 'chest-breast';
    case 'abdomen-wall':
      return 'abdomen';
    case 'sacrum-ischium':
      return 'back';
    case 'hand-digits':
      return 'hand';
    case 'forearm-elbow':
    case 'shoulder-arm':
      return 'upper-limb-ant';
    case 'groin-perineum':
      return 'perineum';
    case 'leg-proximal':
    case 'leg-middle':
      return 'lower-limb-ant';
    case 'leg-distal-ankle':
    case 'foot-plantar':
      return 'foot';
    default:
      return 'anterior-full';
  }
}

const GOLD_STANDARD_BOOSTS: Record<string, string[]> = {
  'leg-distal-ankle': [
    'alt-flap',
    'gracilis-flap',
    'msap-flap',
    'ld-flap',
    'reverse-sural-flap',
    'peroneal-perforator-flap',
    'medial-plantar-flap',
  ],
  'foot-plantar': [
    'medial-plantar-flap',
    'reverse-sural-flap',
    'alt-flap',
    'rfff-flap',
    'gracilis-flap',
  ],
  'leg-proximal': ['gastrocnemius-flap', 'msap-flap', 'alt-flap'],
  'leg-middle': ['soleus-flap', 'peroneal-perforator-flap', 'alt-flap', 'gracilis-flap'],
  breast: [
    'diep-flap',
    'tram-flap',
    'siea-flap',
    'pap-flap',
    'tug-flap',
    'sgap-flap',
    'ld-flap',
    'tdap-flap',
  ],
  mandible: ['fibula-flap', 'dcia-flap', 'scapular-flap'],
  nose: ['paramedian-forehead-flap', 'nasolabial-flap'],
  'chest-sternum': ['pec-major-flap', 'vram-flap', 'ld-flap'],
  'abdomen-wall': ['alt-flap', 'vram-flap', 'ld-flap', 'gracilis-flap'],
  'sacrum-ischium': ['gluteal-rotation-flap', 'sgap-flap', 'gracilis-flap'],
  'hand-digits': [
    'pia-flap',
    'rfff-flap',
    'kite-fdma-flap',
    'lateral-arm-flap',
    'groin-flap',
    'tpff-flap',
    'alt-flap',
  ],
  'oral-cavity': ['rfff-flap', 'alt-flap', 'msap-flap', 'fibula-flap', 'pec-major-flap'],
  scalp: ['alt-flap', 'ld-flap', 'tpff-flap'],
  neck: ['pec-major-flap', 'alt-flap', 'rfff-flap', 'ld-flap', 'scapular-flap'],
  'shoulder-arm': ['ld-flap', 'tdap-flap', 'scapular-flap', 'alt-flap'],
  'groin-perineum': ['gracilis-flap', 'vram-flap', 'alt-flap'],
};

function evaluateSize(
  flap: FlapRecord,
  lengthCm: number,
  widthCm: number
): {
  status: 'green' | 'yellow' | 'red';
  points: number;
  note: string;
} {
  const maxL = flap.dimensions.max_skin_paddle_cm.length?.max;
  const maxW = flap.dimensions.max_skin_paddle_cm.width?.max;

  if (maxL == null || maxW == null) {
    if (flap.advisor_tags.provides_muscle) {
      return {
        status: lengthCm <= 20 && widthCm <= 12 ? 'green' : 'yellow',
        points: lengthCm <= 14 && widthCm <= 10 ? 14 : 9,
        note: `Muscle flap coverage + STSG readily covers ${lengthCm}×${widthCm} cm (verify primary source for upper reach).`,
      };
    }
    return {
      status: 'yellow',
      points: 5,
      note: 'Max skin paddle not specified — verify dimensions against primary reference.',
    };
  }

  const reqLong = Math.max(lengthCm, widthCm);
  const reqShort = Math.min(lengthCm, widthCm);
  const availLong = Math.max(maxL, maxW);
  const availShort = Math.min(maxL, maxW);

  if (reqLong <= availLong * 0.85 && reqShort <= availShort * 0.85) {
    return {
      status: 'green',
      points: 14,
      note: `Defect (${lengthCm}×${widthCm} cm) fits comfortably within max paddle (${maxL}×${maxW} cm).`,
    };
  }
  if (reqLong <= availLong * 1.08 && reqShort <= availShort * 1.08) {
    const primaryW = flap.dimensions.primary_closure_max_width_cm?.max;
    const closureHint =
      primaryW && reqShort > primaryW
        ? ` Width exceeds primary donor closure (~${primaryW} cm) — STSG may be needed.`
        : '';
    return {
      status: 'yellow',
      points: 7,
      note: `Near upper dimension limit (${maxL}×${maxW} cm).${closureHint}`,
    };
  }
  return {
    status: 'red',
    points: -18,
    note: `Defect (${lengthCm}×${widthCm} cm) exceeds typical paddle limits (${maxL}×${maxW} cm).`,
  };
}

export function runFlapAdvisor(
  input: AdvisorInput,
  flaps: FlapRecord[],
  locations: DefectLocation[]
): AdvisorResult {
  const location = locations.find((l) => l.id === input.locationId);
  const area = computeDefectAreaCm2(input.lengthCm, input.widthCm);
  const needsBone = input.missingTissues.includes('Bone');
  const boneLengthCm = input.boneLengthCm ?? 8;
  const needsComposite = input.missingTissues.includes('Composite (through-and-through)');
  const needsMuscleOrDeadSpace =
    input.missingTissues.includes('Muscle') ||
    input.woundCharacteristics.includes('Dead space') ||
    input.woundCharacteristics.includes('Infection / osteomyelitis') ||
    input.woundCharacteristics.includes('Contaminated / chronic wound');
  const needsThin = input.functionalGoals.includes('Thin / pliable coverage');
  const needsBulk = input.functionalGoals.includes('Bulk / volume');
  const needsSensate = input.functionalGoals.includes('Sensation');
  const needsMotor = input.functionalGoals.includes('Motor function');
  const needsColorMatch = input.functionalGoals.includes('Color / texture match');
  const needsDurable = input.functionalGoals.includes('Durability');
  const needsWeightBearing = input.functionalGoals.includes('Weight-bearing surface');
  const hasExposedBoneOrHardware =
    input.woundCharacteristics.includes('Exposed bone') ||
    input.woundCharacteristics.includes('Exposed hardware') ||
    input.woundCharacteristics.includes('Exposed vessels / dura / implant');
  const isIrradiated =
    input.woundCharacteristics.includes('Radiated field') ||
    input.recipientVesselStatus === 'Previous radiation';
  const highBMI = input.patientFactors.includes('High BMI');
  const pvdOrDiabetes =
    input.patientFactors.includes('Peripheral vascular disease') ||
    input.patientFactors.includes('Diabetes');
  const priorAbdomSurgery = input.patientFactors.includes('Prior abdominal surgery');
  const smoker = input.patientFactors.includes('Smoker');
  const anticoagulated = input.patientFactors.includes('Anticoagulation');
  const frailOrElderly = input.patientFactors.includes('Age > 70 / frail');

  const generalWarnings: string[] = [];
  if (hasExposedBoneOrHardware) {
    generalWarnings.push(
      'Exposed bone, hardware, vessels, or dura requires vascularized flap coverage (avoid skin graft alone).'
    );
  }
  if (input.recipientVesselStatus === 'Zone of injury') {
    generalWarnings.push(
      'Zone of injury: plan anastomosis proximal to injury zone or prepare a long pedicle / vein graft.'
    );
  }
  if (isIrradiated) {
    generalWarnings.push(
      'Irradiated field: import non-irradiated distant/free vascularized tissue and inspect recipient vessels carefully.'
    );
  }
  if (smoker) {
    generalWarnings.push(
      'Active smoking increases random-pattern tip necrosis and donor-site wound healing complications.'
    );
  }
  if (anticoagulated) {
    generalWarnings.push(
      'Therapeutic anticoagulation elevates hematoma and pedicle compression risk — meticulous hemostasis and drain monitoring required.'
    );
  }
  if (input.woundCharacteristics.includes('Active malignancy')) {
    generalWarnings.push(
      'Active malignancy: confirm negative oncologic margins prior to complex microvascular inset and preserve backup surveillance planes.'
    );
  }

  const goldList = GOLD_STANDARD_BOOSTS[input.locationId] || [];

  const scored = flaps.map((flap) => {
    let score = 22;
    const scoreBreakdown: ScoreBreakdownItem[] = [
      { category: 'Base', delta: 22, detail: 'Baseline reconstructive candidacy' },
    ];
    const reasons: string[] = [];
    const warnings: string[] = [];

    const addPoints = (category: string, delta: number, detail: string) => {
      score += delta;
      if (delta !== 0) {
        scoreBreakdown.push({ category, delta, detail });
      }
    };

    // 1. Anatomic location match (highest clinical weight)
    const directLocationMatch =
      flap.advisor_tags.defect_locations.includes(input.locationId) ||
      (input.locationId === 'foot-plantar' &&
        (flap.id === 'medial-plantar-flap' ||
          flap.advisor_tags.defect_locations.includes('leg-distal-ankle'))) ||
      (input.locationId === 'neck' &&
        (flap.advisor_tags.defect_locations.includes('oral-cavity') ||
          flap.id === 'pec-major-flap' ||
          flap.id === 'ld-flap')) ||
      (input.locationId === 'shoulder-arm' &&
        (flap.id === 'ld-flap' ||
          flap.id === 'tdap-flap' ||
          flap.id === 'scapular-flap' ||
          flap.id === 'alt-flap'));

    if (directLocationMatch) {
      addPoints('Location', 30, `Established indication for ${location?.label || input.locationId}`);
      reasons.push(`Established indication for ${location?.label || input.locationId}.`);
    } else if (flap.advisor_tags.free_capable) {
      addPoints('Location', 8, 'Versatile free-flap option transferable to distant defects');
      reasons.push('Versatile free-flap option transferable to distant defects.');
    } else {
      addPoints('Location', -35, `Outside pedicled arc of rotation for ${location?.label || input.locationId}`);
      warnings.push(
        `Outside typical pedicled arc of rotation for ${location?.label || input.locationId}.`
      );
    }

    // Gold-standard order tie-breaker & clinical hierarchy
    const goldIndex = goldList.indexOf(flap.id);
    if (goldIndex !== -1) {
      const hierarchyBoost = Math.round(Math.max(4, 18 - goldIndex * 2.5));
      addPoints('Algorithm Hierarchy', hierarchyBoost, `Tier #${goldIndex + 1} classic workhorse for region`);
    }

    // Critical anatomical contraindication checks
    if (
      (input.locationId === 'leg-distal-ankle' || input.locationId === 'foot-plantar') &&
      flap.id === 'gastrocnemius-flap'
    ) {
      addPoints('Reach Limit', -40, 'Gastrocnemius arc reaches proximal third / knee only');
      warnings.push('Gastrocnemius arc reaches only proximal third / knee — cannot reach distal tibia/foot.');
    }
    if (
      (input.locationId === 'leg-distal-ankle' || input.locationId === 'foot-plantar') &&
      flap.id === 'soleus-flap'
    ) {
      addPoints('Reach Limit', -22, 'Soleus unreliable for distal third / ankle / foot');
      warnings.push('Soleus reliably covers middle third; unreliable for distal third / ankle defects.');
    }

    // 2. Missing Bone & Composite requirements (critical)
    if (needsBone) {
      if (flap.advisor_tags.provides_bone) {
        addPoints('Vascularized Bone', 30, 'Provides vascularized bone segment');
        reasons.push('Provides vascularized bone for segmental osseous reconstruction.');
        if (boneLengthCm > 12 && flap.id === 'fibula-flap') {
          addPoints('Bone Span', 10, `Long bone defect (${boneLengthCm} cm) favors fibula (up to 25 cm)`);
          reasons.push(`Long ${boneLengthCm} cm osseous gap strongly favors Free Fibula (up to 25 cm bone stock).`);
        } else if (boneLengthCm > 14 && flap.id !== 'fibula-flap') {
          addPoints('Bone Span', -8, `Bone gap (${boneLengthCm} cm) exceeds typical non-fibular bone stock`);
          warnings.push(`Segment length (${boneLengthCm} cm) may exceed typical iliac/scapular bone length.`);
        }
      } else {
        addPoints('Vascularized Bone', -34, 'Lacks vascularized bone');
        warnings.push('Does not provide vascularized bone required for osseous defect.');
      }
    } else if (flap.advisor_tags.provides_bone && input.locationId !== 'mandible') {
      addPoints('Tissue Fit', -6, 'Osseous harvest morbidity unnecessary for soft-tissue-only defect');
    }

    if (needsComposite) {
      if (flap.advisor_tags.chimeric_capable || flap.flap_type.includes('Osteocutaneous')) {
        addPoints('Composite / Chimeric', 8, 'Supports multi-paddle / chimeric composite reconstruction');
        reasons.push('Chimeric / multi-component design handles through-and-through composite lining + cover.');
      }
    }

    // 3. Size compatibility
    const sizeEval = evaluateSize(flap, input.lengthCm, input.widthCm);
    addPoints('Size Fit', sizeEval.points, sizeEval.note);
    if (sizeEval.status === 'green') {
      reasons.push(sizeEval.note);
    } else if (sizeEval.status === 'red') {
      warnings.push(sizeEval.note);
    }

    // 4. Functional goals & tissue characteristics
    if (needsThin) {
      if (flap.advisor_tags.provides_thin_pliable) {
        addPoints('Contour / Pliability', 10, 'Thin, pliable profile matches goal');
        reasons.push('Thin, pliable tissue profile ideal for contour/gliding.');
      } else if (flap.advisor_tags.provides_bulk) {
        addPoints('Contour / Pliability', -6, 'Bulky profile may require secondary debulking');
        warnings.push('Relatively bulky — may require secondary debulking.');
      }
    }

    if (needsBulk || needsMuscleOrDeadSpace) {
      if (flap.advisor_tags.provides_bulk || flap.advisor_tags.provides_muscle) {
        addPoints('Dead Space / Bulk', 10, 'Provides vascularized muscle or soft-tissue bulk');
        reasons.push('Provides reliable soft-tissue bulk / dead-space obliteration.');
      }
    }

    if (needsSensate) {
      if (flap.nerves.can_be_sensate) {
        addPoints('Sensate Potential', 9, `Neurotizable via ${flap.nerves.sensory[0] || 'cutaneous nerve'}`);
        reasons.push(`Sensate option via ${flap.nerves.sensory[0] || 'cutaneous nerve'}.`);
      } else {
        addPoints('Sensate Potential', -5, 'Not routinely innervated as sensate');
        warnings.push('Not routinely innervated as a sensate flap.');
      }
    }

    if (needsMotor) {
      if (flap.advisor_tags.provides_motor) {
        addPoints('Motor Function', 18, 'Capable of functioning muscle transfer');
        reasons.push('Capable of functioning free muscle transfer (motor neurotization).');
      } else {
        addPoints('Motor Function', -14, 'No functional motor restoration');
      }
    }

    if (needsWeightBearing) {
      if (flap.id === 'medial-plantar-flap') {
        addPoints('Glabrous Weight-Bearing', 22, 'Like-with-like sensate glabrous plantar skin');
        reasons.push('Provides native shear-resistant glabrous plantar skin with preserved protective sensation.');
      } else if (flap.advisor_tags.provides_gliding_or_durable && flap.nerves.can_be_sensate) {
        addPoints('Weight-Bearing Durability', 6, 'Durable sensate coverage option');
      }
    }

    if (needsColorMatch && input.locationId === 'nose' && flap.region_group === 'Head & Neck') {
      addPoints('Color / Texture Match', 14, 'Regional facial skin color & sebaceous match');
      reasons.push('Superior facial skin color, thickness, and sebaceous texture match.');
    }

    if (needsDurable && flap.advisor_tags.provides_gliding_or_durable) {
      addPoints('Durability', 5, 'Durable gliding or shear-resistant tissue');
    }

    if (input.locationId === 'abdomen-wall' && flap.id === 'alt-flap') {
      addPoints('Fascia Lata Strength', 10, 'Vascularized fascia lata restores abdominal wall strength');
      reasons.push('Includes vascularized fascia lata for dynamic full-thickness abdominal wall reconstruction.');
    }

    // 5. Mobilization preference & Frailty
    if (input.mobilizationPreference === 'Local / Regional preferred') {
      const isPrimaryRegionalOrLocal =
        flap.reconstructive_ladder_level === 'Regional flap' ||
        flap.reconstructive_ladder_level === 'Local flap';
      if (isPrimaryRegionalOrLocal && directLocationMatch) {
        addPoints('Transfer Preference', 18, 'Primary regional/local flap avoids microsurgery');
        reasons.push('Primary regional/local flap avoids microsurgical anastomosis.');
      } else if (flap.advisor_tags.pedicled_capable && directLocationMatch) {
        addPoints('Transfer Preference', 8, 'Pedicled transfer feasible');
        reasons.push('Can be executed as a pedicled flap.');
      } else if (!flap.advisor_tags.pedicled_capable) {
        addPoints('Transfer Preference', -14, 'Requires microvascular free transfer');
      }
    } else if (input.mobilizationPreference === 'Short OR time' || frailOrElderly) {
      if (flap.advisor_tags.technical_difficulty === 'Low') {
        addPoints('OR Time / Frailty', 12, `Shorter OR time (${flap.advisor_tags.typical_or_time})`);
        reasons.push(`Lower technical complexity (${flap.advisor_tags.typical_or_time}).`);
      } else if (flap.advisor_tags.technical_difficulty === 'High') {
        addPoints('OR Time / Frailty', -10, `Extended microsurgical OR time (${flap.advisor_tags.typical_or_time})`);
        warnings.push(`Longer microsurgical OR time (${flap.advisor_tags.typical_or_time}).`);
      }
    } else if (input.mobilizationPreference === 'Free flap acceptable') {
      if (flap.advisor_tags.free_capable) {
        addPoints('Transfer Preference', 4, 'Supports microvascular free tissue transfer');
      }
    }

    // 6. Recipient vessels & zone of injury
    const pedLenMax = flap.vascular_anatomy.dominant_pedicle.pedicle_length_cm?.max ?? 0;
    let reachStatus: AdvisorRecommendation['reachStatus'] = 'optimal';
    if (!directLocationMatch && !flap.advisor_tags.free_capable) {
      reachStatus = 'limited';
    } else if (
      input.recipientVesselStatus === 'Zone of injury' ||
      input.recipientVesselStatus === 'Vein graft likely'
    ) {
      if (pedLenMax >= 10) {
        addPoints('Pedicle Reach', 8, `Long pedicle (up to ${pedLenMax} cm) reaches outside zone of injury`);
        reasons.push(`Long pedicle (up to ${pedLenMax} cm) helps reach out of zone of injury.`);
      } else if (flap.advisor_tags.free_capable && pedLenMax > 0 && pedLenMax < 7) {
        reachStatus = 'caution';
        addPoints('Pedicle Reach', -7, `Short pedicle (≤${pedLenMax} cm) may require vein grafts`);
        warnings.push(`Short pedicle (≤${pedLenMax} cm) may necessitate vein grafts.`);
      } else {
        reachStatus = 'caution';
      }
    } else if (
      (input.locationId === 'leg-distal-ankle' || input.locationId === 'foot-plantar') &&
      (flap.id === 'gastrocnemius-flap' || flap.id === 'soleus-flap')
    ) {
      reachStatus = 'limited';
    }

    // 7. Patient factors
    if (highBMI && ['alt-flap', 'lateral-arm-flap'].includes(flap.id) && needsThin) {
      addPoints('Patient BMI', -6, 'Subcutaneous thigh/arm thickness increases with BMI');
      warnings.push('Thigh/arm subcutaneous thickness increases significantly with high BMI.');
    }
    if (highBMI && flap.id === 'diep-flap' && input.locationId === 'breast') {
      addPoints('Patient BMI', 5, 'Abundant lower abdominal tissue volume for breast mound');
      reasons.push('Abundant lower abdominal tissue volume available in higher BMI.');
    }
    if (priorAbdomSurgery && ['diep-flap', 'siea-flap', 'tram-flap', 'vram-flap'].includes(flap.id)) {
      addPoints('Prior Surgery', -16, 'Prior abdominal surgery risks divided DIEA/SIEA perforators');
      warnings.push('Prior abdominal surgery may have divided DIEA/SIEA perforators — CTA mandatory.');
    }
    if (
      pvdOrDiabetes &&
      ['fibula-flap', 'reverse-sural-flap', 'peroneal-perforator-flap', 'medial-plantar-flap'].includes(flap.id)
    ) {
      addPoints('Vascular Runoff', -12, 'PVD/diabetes risks distal lower-extremity runoff');
      warnings.push('PVD / diabetes compromises lower-extremity distal runoff — obtain CTA/angiography first.');
    }
    if (input.patientFactors.includes('Prior surgery at donor site')) {
      warnings.push('Verify donor pedicle patency with preoperative CTA/Doppler given prior donor surgery.');
    }
    if (input.patientFactors.includes('Scar concealment priority')) {
      if (['diep-flap', 'pap-flap', 'sgap-flap', 'groin-flap'].includes(flap.id)) {
        addPoints('Scar Concealment', 5, 'Donor scar well concealed in swimsuit / crease');
      } else if (flap.id === 'rfff-flap') {
        addPoints('Scar Concealment', -6, 'Visible forearm donor site (often requires STSG)');
        warnings.push('Visible forearm donor site with frequent STSG requirement.');
      }
    }

    // Breast specific preference: muscle-sparing DIEP over TRAM unless contraindicated
    if (input.locationId === 'breast' && flap.id === 'diep-flap' && !priorAbdomSurgery) {
      addPoints('Breast Standard', 8, 'Muscle-sparing gold standard for autologous breast');
      reasons.push('Gold-standard muscle-sparing autologous breast reconstruction.');
    }
    if (input.locationId === 'breast' && flap.id === 'siea-flap') {
      warnings.push('SIEA artery is absent or <1.5 mm in a significant proportion of patients — prepare DIEP backup.');
    }

    // Determine suggested mode
    let suggestedMode: AdvisorRecommendation['suggestedMode'] = 'Free Tissue Transfer';
    if (flap.advisor_tags.pedicled_capable && flap.advisor_tags.free_capable) {
      suggestedMode =
        directLocationMatch && input.mobilizationPreference === 'Local / Regional preferred'
          ? 'Pedicled / Local'
          : 'Pedicled or Free';
    } else if (flap.advisor_tags.pedicled_capable) {
      suggestedMode = 'Pedicled / Local';
    }

    const reachNote = flap.advisor_tags.pedicled_capable
      ? flap.arc_of_rotation.reach_description
      : `Free transfer via ${flap.vascular_anatomy.dominant_pedicle.artery} (pedicle ${
          flap.vascular_anatomy.dominant_pedicle.pedicle_length_cm?.max
            ? `up to ${flap.vascular_anatomy.dominant_pedicle.pedicle_length_cm.max} cm`
            : 'verify in source'
        }).`;

    const donorMorbiditySummary = `${flap.donor_site.closure}${
      flap.donor_site.morbidity[0] ? ` · Risk: ${flap.donor_site.morbidity[0]}` : ''
    }`;

    const rawScore = score;
    const displayScore = Math.max(8, Math.min(98, Math.round(score * 0.82)));

    return {
      flap,
      score: displayScore,
      scoreBreakdown,
      _rawScore: rawScore,
      sizeStatus: sizeEval.status,
      sizeNote: sizeEval.note,
      reachStatus,
      reachNote,
      donorMorbiditySummary,
      reasons: reasons.slice(0, 4),
      warnings: warnings.slice(0, 3),
      suggestedMode,
      backupIds: [],
    };
  });

  scored.sort((a, b) => b._rawScore - a._rawScore);
  const top5: AdvisorRecommendation[] = scored.slice(0, 5).map(({ _rawScore: _, ...rest }) => rest);

  // Assign backup IDs from the remaining top options
  top5.forEach((rec, idx) => {
    rec.backupIds = top5
      .filter((_, j) => j !== idx)
      .slice(0, 2)
      .map((other) => other.flap.id);
  });

  return {
    recommendations: top5,
    reconstructiveLadder: location?.ladderSummary || [
      '1. Primary closure / secondary intention if tension-free and no exposed vital structures',
      '2. Split- or full-thickness skin graft if well-vascularized wound bed',
      '3. Local or regional pedicled flap',
      '4. Microvascular free tissue transfer',
    ],
    recipientVessels: location?.defaultRecipientVessels || [
      'Verify nearest healthy named vessels outside zone of injury',
    ],
    generalWarnings,
    defectAreaRectCm2: area.rectangular,
    defectAreaEllipseCm2: area.elliptical,
  };
}
