import type { FlapRecord } from '../types/schemas';
import { formatRange } from '../types/schemas';

export interface SurgicalTechniqueStage {
  stepNumber: number; // 1..7
  shortLabel: string;
  title: string;
  description: string;
  anatomicalWarning: string;
  recommendedPeel: number; // 0..100 for 3D viewer sync
  recommendedAnimation: 'none' | 'arc' | 'transfer';
  highlightTarget:
    | 'markings'
    | 'dissection'
    | 'perforators'
    | 'pedicle'
    | 'inset'
    | 'anastomosis'
    | 'closure';
}

/**
 * Maps any FlapRecord into the canonical 7-stage operative sequence synced with the 3D viewport:
 * 1. Markings & Incision
 * 2. Plane Dissection
 * 3. Perforator Identification
 * 4. Pedicle Dissection
 * 5. Flap Mobilization & Inset
 * 6. Vascular Anastomosis / Revascularization
 * 7. Donor-Site Closure
 */
export function buildTechniqueStages(
  flap: FlapRecord,
  unitSystem: 'metric' | 'imperial' = 'metric'
): SurgicalTechniqueStage[] {
  const steps = flap.technique.harvest_steps;
  const pitfalls = flap.technique.pitfalls;
  const landmarks = flap.technique.landmarks;
  const ped = flap.vascular_anatomy.dominant_pedicle;
  const artDiam = formatRange(ped.artery_diameter_mm, unitSystem).text;
  const pedLen = formatRange(ped.pedicle_length_cm, unitSystem).text;
  const primClose = formatRange(flap.dimensions.primary_closure_max_width_cm, unitSystem).text;
  const isFree = flap.advisor_tags.free_capable && !flap.advisor_tags.pedicled_capable;
  const hasPerforators = flap.vascular_anatomy.perforators.length > 0;

  const getStepText = (idx: number, fallback: string): string =>
    steps[idx] ? steps[idx].replace(/^\d+\.\s*/, '') : fallback;

  const getPitfall = (idx: number, fallback: string): string =>
    pitfalls[idx] || pitfalls[0] || fallback;

  return [
    {
      stepNumber: 1,
      shortLabel: '1. Incision',
      title: 'Preoperative Markings & Skin Incision',
      description: `${flap.technique.design} Key landmarks: ${landmarks.slice(0, 3).join('; ') || 'standard regional bony landmarks'}.`,
      anatomicalWarning: getPitfall(
        0,
        'Confirm flap orientation and skin-paddle axis with handheld Doppler / CTA before committing to both margins.'
      ),
      recommendedPeel: 12,
      recommendedAnimation: 'none',
      highlightTarget: 'markings',
    },
    {
      stepNumber: 2,
      shortLabel: '2. Dissection',
      title: 'Exploratory Edge & Fascial Plane Dissection',
      description: getStepText(
        0,
        `Incise exploratory border down to the designated fascial plane (${flap.tissue_components.slice(0, 3).join(', ')}) under loupe magnification.`
      ),
      anatomicalWarning: getPitfall(
        1,
        'Preserve superficial venous drainage and adjacent cutaneous nerves during initial elevation.'
      ),
      recommendedPeel: 36,
      recommendedAnimation: 'none',
      highlightTarget: 'dissection',
    },
    {
      stepNumber: 3,
      shortLabel: '3. Perforators',
      title: hasPerforators
        ? 'Perforator Identification & Selection'
        : 'Axial / Muscular Vascular Entry Identification',
      description: hasPerforators
        ? `Identify ${flap.vascular_anatomy.perforators
            .map((p) => `${p.label} (${p.type})`)
            .join(', ')}. ${getStepText(1, 'Confirm dominant pulsatile perforator before completing opposite incision.')}`
        : getStepText(
            1,
            `Identify entry of the dominant vascular supply (${ped.artery}) and verify perfusion across the flap territory.`
          ),
      anatomicalWarning:
        flap.vascular_anatomy.vascular_variants[0] ||
        'Expect anatomical variation in perforator course (musculocutaneous vs septocutaneous) and caliber.',
      recommendedPeel: 44,
      recommendedAnimation: 'none',
      highlightTarget: 'perforators',
    },
    {
      stepNumber: 4,
      shortLabel: '4. Pedicle',
      title: 'Retrograde Pedicle Skeletonization',
      description: getStepText(
        2,
        `Dissect ${ped.artery} (origin: ${ped.artery_origin}) with paired ${ped.veins} proximally to achieve target pedicle length (${pedLen}).`
      ),
      anatomicalWarning:
        flap.nerves.motor.length > 0
          ? `Protect motor innervation (${flap.nerves.motor.join(', ')}) unless intentionally harvesting a functioning muscle flap.`
          : getPitfall(
              2,
              'Avoid thermal or traction injury to venae comitantes and pedicle side branches.'
            ),
      recommendedPeel: 64,
      recommendedAnimation: 'none',
      highlightTarget: 'pedicle',
    },
    {
      stepNumber: 5,
      shortLabel: '5. Inset',
      title: isFree ? 'Flap Division & Recipient Inset' : 'Mobilization, Arc of Rotation & Inset',
      description: isFree
        ? getStepText(
            3,
            `Verify brisk perfusion prior to pedicle division, transfer to recipient bed, and inset without tension or pedicle kinking.`
          )
        : `Transpose around pivot point (${flap.arc_of_rotation.pivot_point}). Reach: ${flap.arc_of_rotation.reach_description}.`,
      anatomicalWarning:
        'Check pedicle geometry through full joint/limb range of motion to eliminate kinking, twisting, or tunnel compression.',
      recommendedPeel: 32,
      recommendedAnimation: isFree ? 'transfer' : 'arc',
      highlightTarget: 'inset',
    },
    {
      stepNumber: 6,
      shortLabel: '6. Vascular',
      title: isFree ? 'Microvascular Anastomosis' : 'Perfusion Check & Venous Outflow Verification',
      description: isFree
        ? `Anastomose ${ped.artery} (Ø ${artDiam}) and ${ped.veins} to recipient vessels (${flap.recipient_vessels_options.slice(0, 3).join(', ') || 'regional recipient vessels'}). ${flap.vascular_anatomy.venous_drainage_notes}`
        : `Confirm capillary refill, dermal bleeding, and unobstructed venous drainage (${flap.vascular_anatomy.venous_drainage_notes}).`,
      anatomicalWarning:
        flap.vascular_anatomy.venous_drainage_notes ||
        'Venous congestion is the leading cause of early compromise; preserve a secondary superficial vein when feasible.',
      recommendedPeel: 38,
      recommendedAnimation: isFree ? 'transfer' : 'none',
      highlightTarget: 'anastomosis',
    },
    {
      stepNumber: 7,
      shortLabel: '7. Closure',
      title: 'Donor-Site Closure & Post-Op Surveillance',
      description: `${flap.donor_site.closure} Primary closure typically feasible up to ${primClose}. Functional impact: ${flap.donor_site.functional_loss}`,
      anatomicalWarning: `Monitor for donor morbidity: ${flap.donor_site.morbidity.slice(0, 2).join('; ') || 'seroma, dehiscence, or contour deformity'}. ${flap.nerves.donor_numbness_note}`,
      recommendedPeel: 24,
      recommendedAnimation: 'none',
      highlightTarget: 'closure',
    },
  ];
}
