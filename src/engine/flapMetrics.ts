import { VESSELS } from '../data/index';
import type { FlapRecord, VesselRecord } from '../types/schemas';
import { formatRange } from '../types/schemas';

export interface CalibratedPaddleSummary {
  dimensionsText: string;
  areaText: string;
  isVerify: boolean;
}

/**
 * Computes calibrated skin-paddle length × width and approximate elliptical area
 * (π/4 × L × W) from a flap's validated range metadata without fabricating null fields.
 */
export function getCalibratedPaddleSummary(
  flap: FlapRecord,
  unitSystem: 'metric' | 'imperial' = 'metric'
): CalibratedPaddleSummary {
  const lenRange = flap.dimensions.max_skin_paddle_cm.length;
  const widRange = flap.dimensions.max_skin_paddle_cm.width;

  const lenFmt = formatRange(lenRange, unitSystem);
  const widFmt = formatRange(widRange, unitSystem);

  if (lenFmt.isUnspecified || widFmt.isUnspecified) {
    return {
      dimensionsText: 'Not specified — verify in source',
      areaText: 'Area: Not specified',
      isVerify: true,
    };
  }

  const lMin = lenRange?.min ?? lenRange?.max ?? null;
  const lMax = lenRange?.max ?? lenRange?.min ?? null;
  const wMin = widRange?.min ?? widRange?.max ?? null;
  const wMax = widRange?.max ?? widRange?.min ?? null;

  let areaText = 'Area: Not specified';
  if (lMin !== null && lMax !== null && wMin !== null && wMax !== null) {
    // Elliptical paddle area = (π / 4) * L * W
    const factor = unitSystem === 'imperial' ? 0.155 : 1;
    const areaMin = Math.round((Math.PI / 4) * lMin * wMin * factor);
    const areaMax = Math.round((Math.PI / 4) * lMax * wMax * factor);
    const unit = unitSystem === 'imperial' ? 'in²' : 'cm²';
    areaText =
      areaMin === areaMax
        ? `~${areaMax} ${unit}`
        : `~${areaMin}–${areaMax} ${unit}`;
  }

  return {
    dimensionsText: `${lenFmt.text} × ${widFmt.text}`,
    areaText,
    isVerify: lenFmt.isVerify || widFmt.isVerify,
  };
}

export interface AnatomyDetailCardData {
  id: string;
  name: string;
  category: string;
  regionGroup: string;
  origin: string;
  course: string;
  branches: string[];
  relations: string;
  dimensions: string;
  variants: string[];
  clinicalRelevance: string;
  suppliedFlapIds: string[];
  referenceText: string;
}

const MUSCLE_CLINICAL_DB: Record<
  string,
  Omit<AnatomyDetailCardData, 'id' | 'name' | 'category'>
> = {
  pec_major: {
    regionGroup: 'Trunk',
    origin: 'Clavicular head (medial clavicle) & sternocostal head (sternum, ribs 1–6)',
    course: 'Converges laterally to insert onto the lateral lip of the bicipital groove of the humerus',
    branches: ['Pectoral branch of thoracoacromial artery (dominant)', 'Internal mammary perforators (secondary segmental)'],
    relations: 'Deep to breast parenchyma; overlies pectoralis minor and clavipectoral fascia',
    dimensions: 'Broad fan-shaped chest wall muscle (~18–24 cm span; verify in source)',
    variants: ['Poland syndrome (congenital absence of sternocostal head)', 'Variable lateral pectoral nerve branching'],
    clinicalRelevance: 'Mathes–Nahai Type V workhorse for sternal dehiscence/mediastinitis and salvage head & neck coverage.',
    suppliedFlapIds: ['pec-major-flap'],
    referenceText: 'Mathes & Nahai, Reconstructive Surgery; Grabb’s Encyclopedia of Flaps (verify section)',
  },
  rectus_abdominis: {
    regionGroup: 'Trunk',
    origin: 'Pubic crest and pubic symphysis',
    course: 'Ascends vertically inside rectus sheath with 3–4 tendinous intersections to xiphoid and 5th–7th costal cartilages',
    branches: ['Deep inferior epigastric artery (DIEA)', 'Superior epigastric artery (SEA)'],
    relations: 'Enclosed by anterior/posterior rectus sheath above arcuate line; DIEA ascends on posterior surface',
    dimensions: 'Typical muscle width 6–8 cm per side (verify in source)',
    variants: ['Type I, II, or III Moon–Taylor DIEA intramuscular branching patterns'],
    clinicalRelevance: 'Mathes–Nahai Type III dual-dominant muscle; basis of DIEP (muscle-sparing), TRAM, and VRAM flaps.',
    suppliedFlapIds: ['diep-flap', 'tram-flap', 'vram-flap'],
    referenceText: 'Blondeel et al., Perforator Flaps, 3rd ed. (verify section)',
  },
  latissimus_dorsi: {
    regionGroup: 'Trunk',
    origin: 'Spinous processes T7–L5, thoracolumbar fascia, posterior iliac crest, lower 3–4 ribs',
    course: 'Broad fan converging superolaterally around teres major to intertubercular sulcus of humerus',
    branches: ['Thoracodorsal artery (dominant)', 'Posterior intercostal & lumbar perforators (secondary segmental)'],
    relations: 'Thoracodorsal neurovascular bundle enters deep surface ~8–10 cm inferior to axillary crease',
    dimensions: 'Largest expendable trunk muscle (~25–35 cm × 15–20 cm; verify in source)',
    variants: ['Serratus branch arises reliably from thoracodorsal trunk enabling chimeric harvest'],
    clinicalRelevance: 'Mathes–Nahai Type V workhorse for chest wall, breast salvage, scalp, and massive extremity coverage; source of TDAP.',
    suppliedFlapIds: ['ld-flap', 'tdap-flap'],
    referenceText: 'Zenn & Jones, Reconstructive Surgery (verify section)',
  },
  vastus_lateralis: {
    regionGroup: 'Lower Extremity',
    origin: 'Greater trochanter and lateral lip of linea aspera of femur',
    course: 'Descends along anterolateral thigh to quadriceps tendon and superolateral patella',
    branches: ['Descending branch of lateral circumflex femoral artery (LCFA) & motor nerve to vastus lateralis'],
    relations: 'Lateral intermuscular septum separates vastus lateralis from rectus femoris anteriorly',
    dimensions: 'Longitudinal thigh muscle (~30–40 cm; verify in source)',
    variants: ['~80% of ALT perforators traverse vastus lateralis (musculocutaneous) rather than septum'],
    clinicalRelevance: 'Key intramuscular dissection plane for ALT perforators and chimeric vastus lateralis muscle harvest for dead space.',
    suppliedFlapIds: ['alt-flap'],
    referenceText: 'Blondeel et al., Perforator Flaps, 3rd ed. (verify section)',
  },
  gracilis: {
    regionGroup: 'Lower Extremity',
    origin: 'Inferior pubic ramus and body of pubis',
    course: 'Descends superficially along medial thigh to pes anserinus on proximal medial tibia',
    branches: ['Ascending branch of medial circumflex femoral artery (MCFA)', 'Anterior branch of obturator nerve'],
    relations: 'Lies posterior to adductor longus; dominant pedicle enters deep surface ~8–10 cm below pubic tubercle',
    dimensions: 'Strap muscle ~25–30 cm × 5–6 cm (verify in source)',
    variants: ['Minor distal pedicles from superficial femoral artery (1–2)'],
    clinicalRelevance: 'Mathes–Nahai Type II workhorse for facial reanimation (functioning free muscle), distal tibia, perineum, and TUG breast reconstruction.',
    suppliedFlapIds: ['gracilis-flap', 'tug-flap'],
    referenceText: 'Zenn & Jones, Reconstructive Surgery (verify section)',
  },
  gastrocnemius: {
    regionGroup: 'Lower Extremity',
    origin: 'Medial and lateral femoral condyles',
    course: 'Descends posterior leg to join soleus into Achilles tendon (calcaneal tuberosity)',
    branches: ['Medial sural artery (medial head)', 'Lateral sural artery (lateral head)'],
    relations: 'Overlies soleus and plantaris; common peroneal nerve crosses lateral head near fibular neck',
    dimensions: 'Medial head is larger and reaches further across proximal anterior tibia/knee (verify in source)',
    variants: ['1–3 musculocutaneous perforators from medial sural artery supply MSAP flap'],
    clinicalRelevance: 'Mathes–Nahai Type I gold standard for proximal third tibia and exposed knee prosthesis; source of MSAP.',
    suppliedFlapIds: ['gastrocnemius-flap', 'msap-flap'],
    referenceText: 'Mathes & Nahai, Reconstructive Surgery (verify section)',
  },
  soleus: {
    regionGroup: 'Lower Extremity',
    origin: 'Posterior fibular head/neck and soleal line of tibia',
    course: 'Deep to gastrocnemius in superficial posterior compartment to Achilles tendon',
    branches: ['Proximal muscular branches of posterior tibial & peroneal arteries (dominant)', 'Distal segmental PT branches'],
    relations: 'Bipennate architecture enables medial or lateral hemisoleus split preserving plantarflexion',
    dimensions: 'Covers middle third of tibia (verify in source)',
    variants: ['Variable distal vascularization makes distally based soleus less reliable'],
    clinicalRelevance: 'Mathes–Nahai Type II workhorse for middle-third tibial shaft coverage.',
    suppliedFlapIds: ['soleus-flap'],
    referenceText: 'Grabb’s Encyclopedia of Flaps, 4th ed. (verify section)',
  },
  gluteus_maximus: {
    regionGroup: 'Trunk',
    origin: 'Posterior gluteal line of ilium, posterior sacrum/coccyx, sacrotuberous ligament',
    course: 'Obliquely inferolaterally to iliotibial tract and gluteal tuberosity of femur',
    branches: ['Superior gluteal artery (superior half)', 'Inferior gluteal artery (inferior half)'],
    relations: 'Sciatic nerve exits inferior to piriformis deep to inferior gluteus maximus',
    dimensions: 'Thick pelvic extensor muscle (verify in source)',
    variants: ['Rich septocutaneous/musculocutaneous perforators enable SGAP/IGAP muscle-sparing harvest'],
    clinicalRelevance: 'Mathes–Nahai Type III flap for sacral/ischial pressure injuries and autologous SGAP/IGAP breast reconstruction.',
    suppliedFlapIds: ['sgap-flap', 'gluteal-rotation-flap'],
    referenceText: 'Blondeel et al., Perforator Flaps, 3rd ed. (verify section)',
  },
};

export function resolveAnatomyDetailCard(
  anatomyId: string,
  fallbackLabel: string,
  fallbackCategory: string,
  unitSystem: 'metric' | 'imperial' = 'metric',
  vessels: VesselRecord[] = VESSELS
): AnatomyDetailCardData {
  // 1. Direct Vessel/Nerve match from VESSELS JSON
  const cleanVesselId = anatomyId.replace(/_vein$/, '');
  const vessel = vessels.find((v) => v.id === cleanVesselId || v.id === anatomyId);
  if (vessel) {
    const isCompanionVein = anatomyId.endsWith('_vein');
    return {
      id: anatomyId,
      name: isCompanionVein ? `${vessel.name} — Venae Comitantes` : vessel.name,
      category: isCompanionVein ? 'Vein' : vessel.category,
      regionGroup: vessel.regionId.includes('lower') || vessel.regionId.includes('foot')
        ? 'Lower Extremity'
        : vessel.regionId.includes('upper') || vessel.regionId.includes('hand')
          ? 'Upper Extremity'
          : vessel.regionId.includes('head')
            ? 'Head & Neck'
            : 'Trunk',
      origin: vessel.origin,
      course: vessel.course,
      branches: vessel.branches,
      relations: vessel.relations,
      dimensions: formatRange(vessel.diameter_mm, unitSystem).text,
      variants: vessel.variants,
      clinicalRelevance: vessel.clinical_relevance,
      suppliedFlapIds: vessel.supplied_flap_ids,
      referenceText: vessel.references[0]
        ? `${vessel.references[0].book} (${vessel.references[0].edition}) — ${vessel.references[0].chapter_or_section}`
        : 'Verify in primary surgical reference',
    };
  }

  // 2. Named Surgical Muscle match
  for (const [key, data] of Object.entries(MUSCLE_CLINICAL_DB)) {
    if (anatomyId.includes(key)) {
      return {
        id: anatomyId,
        name: fallbackLabel,
        category: 'Muscle',
        ...data,
      };
    }
  }

  // 3. Lymphatic / Skeletal / Landmark / Generic anatomical structure
  const regionGuess =
    anatomyId.includes('femur') || anatomyId.includes('tibia') || anatomyId.includes('fibula') || anatomyId.includes('patella') || anatomyId.includes('thigh') || anatomyId.includes('leg')
      ? 'Lower Extremity'
      : anatomyId.includes('humerus') || anatomyId.includes('radius') || anatomyId.includes('ulna') || anatomyId.includes('arm') || anatomyId.includes('hand')
        ? 'Upper Extremity'
        : anatomyId.includes('mandible') || anatomyId.includes('cranium') || anatomyId.includes('head') || anatomyId.includes('nose')
          ? 'Head & Neck'
          : 'Trunk';

  return {
    id: anatomyId,
    name: fallbackLabel,
    category: fallbackCategory,
    regionGroup: regionGuess,
    origin: fallbackCategory === 'Landmark' ? 'Surface bony/soft-tissue surgical reference' : 'Segmental anatomical structure',
    course:
      fallbackCategory === 'Lymphatics'
        ? 'Superficial lymphatic collectors draining toward regional nodal basins (axillary, inguinal, cervical).'
        : fallbackCategory === 'Skeleton'
          ? 'Osseous structural landmark and/or vascularized bone donor/recipient target.'
          : 'Used for preoperative flap design, perforator mapping, and anatomical orientation.',
    branches: [],
    relations: 'Always correlate surface landmarks with intraoperative palpation and preoperative CTA/Doppler.',
    dimensions: 'Patient-dependent — measure preoperatively',
    variants: ['Anatomical variation is common across body habitus and prior surgery.'],
    clinicalRelevance:
      anatomyId.includes('fibula')
        ? 'Primary osseous donor for segmental mandibular and long-bone defects (preserve 6–7 cm proximal & distal for joint stability).'
        : anatomyId.includes('mandible')
          ? 'Primary target for Free Fibula or DCIA osteocutaneous reconstruction.'
          : fallbackCategory === 'Lymphatics'
            ? 'Critical for vascularized lymph node transfer (VLNT) and lymphovenous anastomosis (LVA) planning.'
            : 'Key regional reference structure in FlapAtlas 3D.',
    suppliedFlapIds: anatomyId.includes('fibula') ? ['fibula-flap'] : anatomyId.includes('mandible') ? ['fibula-flap', 'dcia-flap'] : [],
    referenceText: 'Zenn & Jones, Reconstructive Surgery; Grabb’s Encyclopedia of Flaps (verify section)',
  };
}
