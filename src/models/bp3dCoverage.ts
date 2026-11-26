/**
 * Phase 10c — BodyParts3D 4.0 Anatomical Coverage & Schematic Representation Registry
 *
 * Explicitly documents which flap-relevant muscles, bones, and peripheral nerves
 * are present vs absent in BodyParts3D Release 4.0 so missing structures are NEVER
 * mislabeled as real BP3D meshes and always display a clear schematic badge +
 * bony-landmark-anchored procedural outline.
 */

import type { FlapRecord } from '../types/schemas';

export const SCHEMATIC_MUSCLE_BADGE = 'Schematic — muscle not present in BodyParts3D';
export const SCHEMATIC_NERVE_BADGE = 'Schematic — nerve not present in BodyParts3D';

export interface AbsentBp3dStructureInfo {
  id: string;
  name: string;
  category: 'muscle' | 'nerve';
  reason: string;
  /** Bony landmarks used to anchor a translucent procedural schematic outline */
  anchorLandmarkIds: string[];
  matchPatterns: RegExp[];
}

/**
 * Confirmed muscles absent (or only partially decomposed) in BodyParts3D 4.0.
 */
export const ABSENT_BP3D_MUSCLES: AbsentBp3dStructureInfo[] = [
  {
    id: 'latissimus_dorsi',
    name: 'Latissimus dorsi',
    category: 'muscle',
    reason: 'Not included in BodyParts3D 4.0 muscle release',
    anchorLandmarkIds: ['inferior_angle_scapula', 'iliac_crest', 'acromion'],
    matchPatterns: [/\blatissimus\s*dorsi\b/i, /\btdap\b/i],
  },
  {
    id: 'rectus_abdominis',
    name: 'Rectus abdominis',
    category: 'muscle',
    reason: 'Not included in BodyParts3D 4.0 muscle release (TRAM / VRAM / DIEP rectus bed is schematic)',
    anchorLandmarkIds: ['pubic_tubercle', 'umbilicus', 'asis'],
    matchPatterns: [
      /\brectus\s*abdominis\b/i,
      /\btram\b/i,
      /\bvram\b/i,
      /\bdiep\b/i,
      /\bdeep\s+inferior\s+epigastric\s+perforator\b/i,
    ],
  },
  {
    id: 'internal_oblique',
    name: 'Internal abdominal oblique',
    category: 'muscle',
    reason: 'Not included in BodyParts3D 4.0 muscle release',
    anchorLandmarkIds: ['iliac_crest', 'asis', 'umbilicus'],
    matchPatterns: [/\binternal\s*(?:abdominal\s*)?oblique\b/i],
  },
  {
    id: 'transversus_abdominis',
    name: 'Transversus abdominis',
    category: 'muscle',
    reason: 'Not included in BodyParts3D 4.0 muscle release',
    anchorLandmarkIds: ['iliac_crest', 'asis', 'umbilicus'],
    matchPatterns: [/\btransversus\s*abdominis\b/i],
  },
  {
    id: 'quadratus_lumborum',
    name: 'Quadratus lumborum',
    category: 'muscle',
    reason: 'Not included in BodyParts3D 4.0 muscle release',
    anchorLandmarkIds: ['iliac_crest', 'psis'],
    matchPatterns: [/\bquadratus\s*lumborum\b/i],
  },
  {
    id: 'masseter',
    name: 'Masseter',
    category: 'muscle',
    reason: 'Not included in BodyParts3D 4.0 muscle release',
    anchorLandmarkIds: ['mastoid'],
    matchPatterns: [/\bmasseter\b/i],
  },
  {
    id: 'temporalis',
    name: 'Temporalis',
    category: 'muscle',
    reason: 'Not included in BodyParts3D 4.0 muscle release (temporalis / TPFF muscle is schematic)',
    anchorLandmarkIds: ['mastoid'],
    matchPatterns: [/\btemporalis\b/i, /\btemporoparietal\b/i, /\btpff\b/i],
  },
  {
    id: 'erector_spinae',
    name: 'Erector spinae (composite)',
    category: 'muscle',
    reason: 'Not present as a single muscle mesh (represented only by iliocostalis, longissimus & spinalis components)',
    anchorLandmarkIds: ['psis', 'inferior_angle_scapula'],
    matchPatterns: [/\berector\s*spinae\b/i],
  },
];

/**
 * BodyParts3D `nerves.glb` contains ~34 orbital/cranial branches only (optic,
 * oculomotor branches, trochlear, ophthalmic, frontal, supra-/infratrochlear,
 * nasociliary, lacrimal, ethmoidal, ciliary). All peripheral sensory & motor
 * flap nerves are absent from BP3D and rendered strictly as schematic references.
 */
const BP3D_PRESENT_CRANIAL_NERVE_PATTERNS: RegExp[] = [
  /\boptic\b/i,
  /\boculomotor\b/i,
  /\btrochlear\b/i,
  /\bophthalmic\b/i,
  /\bfrontal\s+nerve\b/i,
  /\bsupratrochlear\b/i,
  /\binfratrochlear\b/i,
  /\bnasociliary\b/i,
  /\blacrimal\s+nerve\b/i,
  /\bethmoidal\s+nerve\b/i,
  /\bciliary\s+nerve\b/i,
];

const PERIPHERAL_NERVE_EXTRACTION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Lateral femoral cutaneous nerve', pattern: /\blateral\s+femoral\s+cutaneous\b|\blfcn\b/i },
  { label: 'Sural nerve', pattern: /\bsural\s+nerve\b|\bmedial\s+sural\s+cutaneous\b/i },
  { label: 'Thoracodorsal nerve', pattern: /\bthoracodorsal\s+nerve\b/i },
  { label: 'Obturator nerve', pattern: /\bobturator\s+nerve\b/i },
  { label: 'Lateral antebrachial cutaneous nerve', pattern: /\blateral\s+antebrachial\s+cutaneous\b|\blabcn\b/i },
  { label: 'Medial antebrachial cutaneous nerve', pattern: /\bmedial\s+antebrachial\s+cutaneous\b|\bmabcn\b/i },
  { label: 'Posterior brachial / antebrachial cutaneous nerve', pattern: /\bposterior\s+(?:brachial|antebrachial)\s+cutaneous\b|\blower\s+lateral\s+brachial\s+cutaneous\b/i },
  { label: 'Superficial radial nerve', pattern: /\bsuperficial\s+(?:branch\s+of\s+)?radial\s+nerve\b/i },
  { label: 'Posterior interosseous nerve', pattern: /\bposterior\s+interosseous\s+nerve\b/i },
  { label: 'Saphenous nerve', pattern: /\bsaphenous\s+nerve\b/i },
  { label: 'Superficial peroneal / fibular nerve', pattern: /\bsuperficial\s+(?:peroneal|fibular)\s+nerve\b/i },
  { label: 'Deep peroneal / fibular nerve', pattern: /\bdeep\s+(?:peroneal|fibular)\s+nerve\b/i },
  { label: 'Tibial / medial plantar nerve', pattern: /\b(?:tibial|medial\s+plantar)\s+nerve\b/i },
  { label: 'Intercostal / thoracoabdominal nerves', pattern: /\bintercostal\s+nerve|\bthoracoabdominal\s+nerve/i },
  { label: 'Long thoracic nerve', pattern: /\blong\s+thoracic\s+nerve\b/i },
  { label: 'Medial & lateral pectoral nerves', pattern: /\bpectoral\s+nerve/i },
  { label: 'Spinal accessory nerve (CN XI)', pattern: /\baccessory\s+nerve\b/i },
  { label: 'Facial nerve (CN VII)', pattern: /\bfacial\s+nerve\b|\bmarginal\s+mandibular\b/i },
  { label: 'Inferior / superior gluteal nerve', pattern: /\bgluteal\s+nerve\b/i },
  { label: 'Ilioinguinal / genitofemoral / pudendal nerve', pattern: /\bilioinguinal\b|\bgenitofemoral\b|\bpudendal\s+nerve\b/i },
  { label: 'Sciatic / posterior femoral cutaneous nerve', pattern: /\bposterior\s+femoral\s+cutaneous\b|\bsciatic\s+nerve\b/i },
  { label: 'Digital / palmar cutaneous nerve', pattern: /\bdigital\s+nerve\b|\bpalmar\s+cutaneous\b/i },
];

export const CONFIRMED_BP3D_FLAP_MUSCLES: string[] = [
  'gracilis',
  'gluteus maximus',
  'gluteus medius',
  'tensor fasciae latae',
  'sartorius',
  'rectus femoris',
  'vastus lateralis',
  'biceps femoris',
  'semitendinosus',
  'semimembranosus',
  'gastrocnemius',
  'soleus',
  'serratus anterior',
  'pectoralis major',
  'pectoralis minor',
  'trapezius',
  'deltoid',
  'teres major',
  'teres minor',
  'platysma',
  'sternocleidomastoid',
  'brachioradialis',
  'palmaris longus',
  'flexor carpi radialis',
  'extensor carpi radialis',
  'external oblique',
  'diaphragm',
];

export const CONFIRMED_BP3D_FLAP_BONES: string[] = [
  'scapula',
  'humerus',
  'radius',
  'ulna',
  'hip bone',
  'femur',
  'tibia',
  'fibula',
  'mandible',
  'ribs',
  'clavicle',
];

export interface SchematicStructureCatalogEntry {
  name: string;
  category: 'Muscle' | 'Nerves' | 'Vessels';
  status: string;
}

export const SCHEMATIC_ONLY_STRUCTURES_CATALOG: SchematicStructureCatalogEntry[] = [
  {
    name: 'Latissimus dorsi',
    category: 'Muscle',
    status: 'Absent in BP3D 4.0 — translucent schematic outline anchored to scapula, iliac crest & humerus',
  },
  {
    name: 'Rectus abdominis',
    category: 'Muscle',
    status: 'Absent in BP3D 4.0 — schematic outline for TRAM, VRAM & DIEP rectus bed',
  },
  {
    name: 'Internal abdominal oblique',
    category: 'Muscle',
    status: 'Absent in BP3D 4.0 — translucent schematic outline anchored to iliac crest & lower ribs',
  },
  {
    name: 'Transversus abdominis & Quadratus lumborum',
    category: 'Muscle',
    status: 'Absent in BP3D 4.0 — schematic outline only',
  },
  {
    name: 'Masseter & Temporalis',
    category: 'Muscle',
    status: 'Absent in BP3D 4.0 — schematic outline anchored to mastoid/cranial region',
  },
  {
    name: 'Erector spinae (composite)',
    category: 'Muscle',
    status: 'Partial in BP3D 4.0 — represented only by iliocostalis, longissimus & spinalis sub-muscles',
  },
  {
    name: 'Peripheral motor & sensory nerves (sural, LFCN, thoracodorsal, obturator, radial, etc.)',
    category: 'Nerves',
    status: 'BP3D nerves.glb includes ~34 orbital/cranial branches only — all peripheral flap nerves are schematic',
  },
  {
    name: 'Selected microvascular perforators (SGAP/IGAP, peroneal/fibula, sural, SCIP/DCIA, PIA, facial)',
    category: 'Vessels',
    status: 'Not in BP3D vessel release — rendered as schematic pedicle trajectory anchored to skeleton',
  },
];

export interface FlapBp3dCoverageAssessment {
  flapId: string;
  missingMuscle: AbsentBp3dStructureInfo | null;
  missingNerves: string[];
  muscleBadge: string | null;
  nerveBadge: string | null;
  hasSchematicDependency: boolean;
}

/**
 * Evaluates whether a flap relies on a muscle or peripheral nerve absent from
 * BodyParts3D 4.0. Never mutates clinical flap measurements.
 */
export function assessFlapBp3dCoverage(
  flap: Pick<FlapRecord, 'id' | 'name' | 'synonyms'> &
    Partial<Pick<FlapRecord, 'tissue_components' | 'flap_type' | 'nerves' | 'technique'>>
): FlapBp3dCoverageAssessment {
  const primaryMuscleText = [
    flap.name,
    ...(flap.synonyms || []),
    ...(flap.tissue_components || []),
    ...(flap.flap_type || []),
  ].join(' | ');

  const extendedMuscleText = [
    primaryMuscleText,
    ...(flap.technique?.landmarks || []),
    flap.technique?.design || '',
  ].join(' | ');

  let missingMuscle: AbsentBp3dStructureInfo | null = null;
  for (const absent of ABSENT_BP3D_MUSCLES) {
    if (absent.matchPatterns.some((re) => re.test(primaryMuscleText))) {
      missingMuscle = absent;
      break;
    }
  }
  // Special case: DIEP relies on rectus abdominis intramuscular dissection bed
  if (
    !missingMuscle &&
    /\bdiep\b/i.test(primaryMuscleText) &&
    /\brectus\s*abdominis\b/i.test(extendedMuscleText)
  ) {
    missingMuscle = ABSENT_BP3D_MUSCLES.find((m) => m.id === 'rectus_abdominis') || null;
  }

  // Evaluate peripheral nerves (all non-orbital/non-cranial nerves are absent in BP3D)
  const rawNerveEntries = [
    ...(flap.nerves?.sensory || []),
    ...(flap.nerves?.motor || []),
  ].filter(
    (s) =>
      typeof s === 'string' &&
      s.trim().length > 0 &&
      !/^(none|n\/a|not\s+applicable|not\s+specified|—|-)$/i.test(s.trim())
  );
  const nerveText = rawNerveEntries.join(' | ');

  const missingNerves: string[] = [];
  if (nerveText.trim().length > 0) {
    for (const item of PERIPHERAL_NERVE_EXTRACTION_PATTERNS) {
      if (item.pattern.test(nerveText)) {
        missingNerves.push(item.label);
      }
    }
    // If innervation text explicitly cites a nerve that isn't one of BP3D's orbital/cranial nerves
    if (
      missingNerves.length === 0 &&
      /\bnerve\b|\bcutaneous\b|\bbranch\b/i.test(nerveText) &&
      !BP3D_PRESENT_CRANIAL_NERVE_PATTERNS.some((re) => re.test(nerveText))
    ) {
      const compact = rawNerveEntries[0].split(/[;.|]/)[0].trim();
      if (compact) missingNerves.push(compact);
    }
  }

  return {
    flapId: flap.id,
    missingMuscle,
    missingNerves,
    muscleBadge: missingMuscle ? SCHEMATIC_MUSCLE_BADGE : null,
    nerveBadge: missingNerves.length > 0 ? SCHEMATIC_NERVE_BADGE : null,
    hasSchematicDependency: Boolean(missingMuscle) || missingNerves.length > 0,
  };
}

export interface SchematicMuscleOutlineSpec {
  muscleId: string;
  label: string;
  /** Center position in world coordinates [x, y, z] */
  center: [number, number, number];
  /** Semi-axes [width, height, depth] in metres */
  size: [number, number, number];
  /** Euler rotation [rx, ry, rz] in radians */
  rotation: [number, number, number];
  /** Anchor points used to derive this outline (for subtle landmark tether lines) */
  anchorPoints: Array<[number, number, number]>;
}

/**
 * Builds a translucent procedural outline spec for an absent BP3D muscle,
 * strictly anchored to calibrated BP3D bony landmarks on the active donor side.
 */
export function buildSchematicMuscleOutline(
  muscleId: string,
  donorSide: 'right' | 'left',
  anchorsById: Record<string, [number, number, number]>
): SchematicMuscleOutlineSpec | null {
  const sideSign = donorSide === 'left' ? 1 : -1;
  const pick = (id: string, fallback: [number, number, number]): [number, number, number] => {
    const p = anchorsById[id];
    if (!p) return [fallback[0] * sideSign, fallback[1], fallback[2]];
    // Anchors stored as right-side (-X) or midline (0); mirror X when donorSide === 'left'
    if (Math.abs(p[0]) < 0.005) return [0, p[1], p[2]];
    const absX = Math.abs(p[0]);
    return [sideSign * absX, p[1], p[2]];
  };

  if (muscleId === 'latissimus_dorsi') {
    const infScap = pick('inferior_angle_scapula', [-0.09, 1.186, 0.008]);
    const iliac = pick('iliac_crest', [-0.143, 0.957, 0.068]);
    const psis = pick('psis', [-0.048, 0.892, 0.004]);
    const acromion = pick('acromion', [-0.165, 1.344, 0.072]);
    const cx = (infScap[0] + iliac[0] + psis[0]) / 3;
    const cy = (infScap[1] + iliac[1] + psis[1]) / 3 + 0.04;
    const cz = Math.min(infScap[2], psis[2]) - 0.012;
    return {
      muscleId,
      label: 'Latissimus dorsi (Schematic)',
      center: [cx, cy, cz],
      size: [0.16, 0.34, 0.032],
      rotation: [0.06, sideSign * -0.22, sideSign * 0.14],
      anchorPoints: [infScap, iliac, psis, [acromion[0] * 0.92, acromion[1] - 0.09, acromion[2] - 0.02]],
    };
  }

  if (muscleId === 'rectus_abdominis') {
    const pubis = pick('pubic_tubercle', [-0.024, 0.812, 0.135]);
    const umb = pick('umbilicus', [0, 0.962, 0.212]);
    const cx = sideSign * 0.038;
    const cy = (pubis[1] + umb[1]) * 0.5 + 0.09;
    const cz = Math.max(pubis[2], umb[2]) - 0.018;
    return {
      muscleId,
      label: 'Rectus abdominis (Schematic)',
      center: [cx, cy, cz],
      size: [0.068, 0.34, 0.024],
      rotation: [0.08, sideSign * 0.08, 0],
      anchorPoints: [pubis, umb, [cx, umb[1] + 0.17, cz - 0.01]],
    };
  }

  if (muscleId === 'internal_oblique' || muscleId === 'transversus_abdominis') {
    const asis = pick('asis', [-0.125, 0.895, 0.138]);
    const iliac = pick('iliac_crest', [-0.143, 0.957, 0.068]);
    const umb = pick('umbilicus', [0, 0.962, 0.212]);
    const cx = (asis[0] + iliac[0]) * 0.5;
    const cy = (asis[1] + iliac[1]) * 0.5 + 0.065;
    const cz = (asis[2] + iliac[2] + umb[2]) / 3;
    return {
      muscleId,
      label:
        muscleId === 'internal_oblique'
          ? 'Internal oblique (Schematic)'
          : 'Transversus abdominis (Schematic)',
      center: [cx, cy, cz],
      size: [0.095, 0.18, 0.08],
      rotation: [0, sideSign * 0.35, sideSign * -0.08],
      anchorPoints: [asis, iliac, umb],
    };
  }

  if (muscleId === 'quadratus_lumborum') {
    const iliac = pick('iliac_crest', [-0.143, 0.957, 0.068]);
    const psis = pick('psis', [-0.048, 0.892, 0.004]);
    return {
      muscleId,
      label: 'Quadratus lumborum (Schematic)',
      center: [sideSign * 0.072, iliac[1] + 0.065, psis[2] + 0.025],
      size: [0.065, 0.14, 0.028],
      rotation: [0, 0, sideSign * -0.06],
      anchorPoints: [iliac, psis],
    };
  }

  if (muscleId === 'temporalis' || muscleId === 'masseter') {
    const mastoid = pick('mastoid', [-0.064, 1.482, 0.066]);
    const isTemp = muscleId === 'temporalis';
    return {
      muscleId,
      label: isTemp ? 'Temporalis (Schematic)' : 'Masseter (Schematic)',
      center: [
        mastoid[0] + sideSign * 0.012,
        mastoid[1] + (isTemp ? 0.065 : -0.028),
        mastoid[2] + (isTemp ? 0.032 : 0.048),
      ],
      size: isTemp ? [0.025, 0.085, 0.085] : [0.022, 0.055, 0.042],
      rotation: [0, 0, 0],
      anchorPoints: [mastoid],
    };
  }

  if (muscleId === 'erector_spinae') {
    const psis = pick('psis', [-0.048, 0.892, 0.004]);
    const infScap = pick('inferior_angle_scapula', [-0.09, 1.186, 0.008]);
    return {
      muscleId,
      label: 'Erector spinae (Schematic)',
      center: [sideSign * 0.042, (psis[1] + infScap[1]) * 0.5, Math.min(psis[2], infScap[2]) - 0.006],
      size: [0.055, Math.abs(infScap[1] - psis[1]) + 0.08, 0.03],
      rotation: [0, 0, 0],
      anchorPoints: [psis, infScap],
    };
  }

  return null;
}
