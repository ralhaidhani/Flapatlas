export interface ReachCalcInput {
  pivotToDefectEdgeCm: number;
  defectLengthCm: number;
  pedicleEffectiveLengthCm: number;
  tunnelingOverheadCm: number; // typically 1.5–3 cm for kink-free routing
}

export interface ReachCalcResult {
  totalRequiredReachCm: number;
  availableReachCm: number;
  marginCm: number;
  verdict: 'Comfortable' | 'Borderline' | 'Insufficient';
  recommendation: string;
}

export function calculatePedicleReach(input: ReachCalcInput): ReachCalcResult {
  const totalRequiredReachCm = Number(
    (Math.max(0, input.pivotToDefectEdgeCm) + Math.max(0, input.defectLengthCm) + Math.max(0, input.tunnelingOverheadCm)).toFixed(1)
  );
  const availableReachCm = Number(Math.max(0, input.pedicleEffectiveLengthCm).toFixed(1));
  const marginCm = Number((availableReachCm - totalRequiredReachCm).toFixed(1));

  if (marginCm >= 2.0) {
    return {
      totalRequiredReachCm,
      availableReachCm,
      marginCm,
      verdict: 'Comfortable',
      recommendation: `Pedicle reaches with +${marginCm} cm slack. Verify kink-free subcutaneous tunnel or exteriorized skin bridge.`,
    };
  }
  if (marginCm >= 0) {
    return {
      totalRequiredReachCm,
      availableReachCm,
      marginCm,
      verdict: 'Borderline',
      recommendation: `Tight margin (+${marginCm} cm). Consider proximal pedicle skeletonization, scoring fascia, dividing minor branches, or having a free-flap/vein-graft backup ready.`,
    };
  }
  return {
    totalRequiredReachCm,
    availableReachCm,
    marginCm,
    verdict: 'Insufficient',
    recommendation: `Short by ${Math.abs(marginCm)} cm. Pedicled transfer risks pedicle avulsion or tip necrosis — escalate to free tissue transfer or alternative regional flap.`,
  };
}

export interface FlapReachPreset {
  id: string;
  label: string;
  flapId: string;
  scenario: string;
  pivotToDefectEdgeCm: number;
  defectLengthCm: number;
  pedicleEffectiveLengthCm: number;
  tunnelingOverheadCm: number;
}

export const FLAP_REACH_PRESETS: ReadonlyArray<FlapReachPreset> = [
  {
    id: 'preset-gastroc-knee',
    label: 'Medial Gastrocnemius → Knee / Proximal Tibia',
    flapId: 'gastrocnemius-flap',
    scenario: 'Exposed total knee arthroplasty / proximal 1/3 tibia defect',
    pivotToDefectEdgeCm: 7,
    defectLengthCm: 6,
    pedicleEffectiveLengthCm: 16,
    tunnelingOverheadCm: 1.5,
  },
  {
    id: 'preset-soleus-mid',
    label: 'Medial Hemisoleus → Middle 1/3 Tibia',
    flapId: 'soleus-flap',
    scenario: 'Gustilo IIIB middle-third tibial shaft exposure',
    pivotToDefectEdgeCm: 6,
    defectLengthCm: 7,
    pedicleEffectiveLengthCm: 15,
    tunnelingOverheadCm: 1.5,
  },
  {
    id: 'preset-alt-groin',
    label: 'Pedicled ALT → Groin / Lower Abdomen',
    flapId: 'alt-flap',
    scenario: 'Exposed femoral graft / lower abdominal wall defect',
    pivotToDefectEdgeCm: 11,
    defectLengthCm: 8,
    pedicleEffectiveLengthCm: 23,
    tunnelingOverheadCm: 2.5,
  },
  {
    id: 'preset-pec-hn',
    label: 'Pectoralis Major → Lateral Neck / Pharynx',
    flapId: 'pec-major-flap',
    scenario: 'Salvage pharyngocutaneous fistula / carotid coverage',
    pivotToDefectEdgeCm: 14,
    defectLengthCm: 6,
    pedicleEffectiveLengthCm: 24,
    tunnelingOverheadCm: 2.5,
  },
  {
    id: 'preset-ld-chest',
    label: 'Latissimus Dorsi → Anterior Chest / Breast',
    flapId: 'ld-flap',
    scenario: 'Post-mastectomy irradiated chest wall salvage',
    pivotToDefectEdgeCm: 15,
    defectLengthCm: 9,
    pedicleEffectiveLengthCm: 28,
    tunnelingOverheadCm: 2.0,
  },
  {
    id: 'preset-forehead-nose',
    label: 'Paramedian Forehead → Nasal Tip / Columella',
    flapId: 'paramedian-forehead-flap',
    scenario: 'Full-thickness distal nasal tip & alar subunit defect',
    pivotToDefectEdgeCm: 5.5,
    defectLengthCm: 2.5,
    pedicleEffectiveLengthCm: 9.5,
    tunnelingOverheadCm: 1.0,
  },
  {
    id: 'preset-sural-heel',
    label: 'Reverse Sural → Posterior Heel / Distal Ankle',
    flapId: 'reverse-sural-flap',
    scenario: 'Exposed Achilles / posterior calcaneal defect (pivot 5 cm above lateral malleolus)',
    pivotToDefectEdgeCm: 9,
    defectLengthCm: 6,
    pedicleEffectiveLengthCm: 16,
    tunnelingOverheadCm: 2.0,
  },
];

export interface PerforatorZoneInput {
  flapType: 'ALT' | 'MSAP' | 'SGAP' | 'PAP' | 'DIEP' | 'TDAP' | 'FIBULA';
  landmarkSpanCm: number; // e.g., ASIS-to-superolateral patella for ALT, PSIS-to-greater trochanter for SGAP
}

export interface PerforatorZoneResult {
  flapType: string;
  flapId: string;
  referenceLine: string;
  primaryHotspotCm: string;
  searchRadiusCm: number;
  dopplerTip: string;
}

export function calculatePerforatorHotspot(input: PerforatorZoneInput): PerforatorZoneResult {
  const span = Math.max(10, Math.min(70, input.landmarkSpanCm));

  switch (input.flapType) {
    case 'ALT': {
      const mid = Number((span * 0.5).toFixed(1));
      const proxA = Number((mid - 5).toFixed(1));
      const distC = Number((mid + 5).toFixed(1));
      return {
        flapType: 'ALT (Anterolateral Thigh)',
        flapId: 'alt-flap',
        referenceLine: 'Line from ASIS to superolateral border of patella',
        primaryHotspotCm: `Perforator B at ${mid} cm from ASIS (inferolateral 3 cm circle); A ≈ ${proxA} cm, C ≈ ${distC} cm`,
        searchRadiusCm: 3.0,
        dopplerTip: 'Most dominant perforators lie in the inferolateral quadrant of a 3 cm radius circle centered at the midpoint (verify with handheld Doppler / CTA).',
      };
    }
    case 'MSAP': {
      const prox = Math.min(span * 0.35, 8);
      const dist = Math.min(span * 0.55, 14);
      return {
        flapType: 'MSAP (Medial Sural Artery Perforator)',
        flapId: 'msap-flap',
        referenceLine: 'Line from midpoint of popliteal crease to medial malleolus',
        primaryHotspotCm: `${prox.toFixed(1)}–${dist.toFixed(1)} cm distal to popliteal crease, 1–3 cm medial to posterior midline`,
        searchRadiusCm: 2.5,
        dopplerTip: 'Perforators typically emerge from the medial head of gastrocnemius ~8–12 cm below the popliteal crease.',
      };
    }
    case 'SGAP': {
      const oneThird = Number((span / 3).toFixed(1));
      return {
        flapType: 'SGAP (Superior Gluteal Artery Perforator)',
        flapId: 'sgap-flap',
        referenceLine: 'Line from PSIS to apex of greater trochanter',
        primaryHotspotCm: `SGA exit at ${oneThird} cm lateral to PSIS (junction of medial 1/3 and lateral 2/3); perforators cluster 1–4 cm lateral to exit`,
        searchRadiusCm: 3.0,
        dopplerTip: 'Doppler just lateral and slightly inferior to the medial-third junction; avoid piriformis sciatic territory inferiorly.',
      };
    }
    case 'PAP': {
      return {
        flapType: 'PAP (Profunda Artery Perforator)',
        flapId: 'pap-flap',
        referenceLine: 'Inferior gluteal crease & posterior border of gracilis',
        primaryHotspotCm: `3–6 cm inferior to gluteal crease, 2–5 cm posterior to gracilis posterior border (span ref: ${span} cm)`,
        searchRadiusCm: 2.5,
        dopplerTip: 'Preoperative MRA/CTA markedly improves identification of dominant profunda femoris perforators traversing adductor magnus.',
      };
    }
    case 'DIEP': {
      return {
        flapType: 'DIEP (Deep Inferior Epigastric Perforator)',
        flapId: 'diep-flap',
        referenceLine: 'Umbilicus (origin) and linea alba / lateral rectus border',
        primaryHotspotCm: `Periumbilical hotspot: 0–4 cm lateral and 0–6 cm inferior to umbilicus (medial row often preferred for Zone IV perfusion)`,
        searchRadiusCm: 3.0,
        dopplerTip: 'Preoperative CTA is standard of care to map intramuscular course length, medial vs lateral row dominance, and SIEV caliber.',
      };
    }
    case 'TDAP': {
      return {
        flapType: 'TDAP (Thoracodorsal Artery Perforator)',
        flapId: 'tdap-flap',
        referenceLine: 'Anterior border of latissimus dorsi from posterior axillary crease toward iliac crest',
        primaryHotspotCm: `Dominant proximal perforator 8–10 cm inferior to posterior axillary crease and 2–3 cm posterior to anterior LD border (span ref: ${span} cm)`,
        searchRadiusCm: 2.5,
        dopplerTip: 'Mark with shoulder abducted 90°; direct septocutaneous branch wrapping around anterior LD edge is present in ~20–30% of cases.',
      };
    }
    case 'FIBULA': {
      const junction = Number((span * 0.6).toFixed(1));
      const proxZone = Number((span * 0.5).toFixed(1));
      const distZone = Number((span * 0.72).toFixed(1));
      return {
        flapType: 'Free Fibula / Peroneal Septocutaneous Perforator',
        flapId: 'fibula-flap',
        referenceLine: 'Posterior border of fibula from fibular head to lateral malleolus',
        primaryHotspotCm: `Primary perforator cluster around ${junction} cm distal to fibular head (middle–distal 1/3 junction: ${proxZone}–${distZone} cm)`,
        searchRadiusCm: 2.5,
        dopplerTip: 'Always preserve ≥6–7 cm of proximal fibula (common peroneal nerve) and ≥6–7 cm of distal fibula (ankle mortise stability); verify 3-vessel runoff on CTA.',
      };
    }
  }
}

