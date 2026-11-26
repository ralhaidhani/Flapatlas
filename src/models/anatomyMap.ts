import type { FlapRecord, VesselRecord } from '../types/schemas';
import type { AnatomicalSystemId } from './modelManifest';

export type AnatomyTargetKind =
  | 'vessel'
  | 'muscle'
  | 'nerve'
  | 'bone'
  | 'flap'
  | 'organ'
  | 'skin'
  | 'other';
export type Laterality = 'right' | 'left' | 'midline';

export interface AnatomyMappingEntry {
  targetId: string;
  label: string;
  kind: AnatomyTargetKind;
  category: string;
  linkedFlapIds: string[];
  /** Normalized FMA / English / Latin Terminologia Anatomica aliases */
  aliases: string[];
}

export interface CustomAnatomyOverride {
  meshName: string;
  targetId: string;
  label: string;
  kind: AnatomyTargetKind;
  linkedFlapIds: string[];
}

export interface LogicalAnatomyGroup {
  groupId: string;
  groupLabel: string;
  partLabel: string;
}

export interface MappedMeshResult {
  rawMeshName: string;
  normalizedName: string;
  laterality: Laterality;
  system: AnatomicalSystemId;
  mapped: boolean;
  matchSource: 'override' | 'exact-ta' | 'group-parent' | 'vessel-record' | 'flap-pedicle' | 'unmapped';
  anatomyId: string;
  label: string;
  category: string;
  kind: AnatomyTargetKind;
  linkedFlapIds: string[];
  fjCode?: string;
  fmaCode?: string;
  groupId?: string;
  groupLabel?: string;
  partLabel?: string;
}

export interface UnmappedMeshItem {
  meshName: string;
  normalizedName: string;
  system: AnatomicalSystemId;
  laterality: Laterality;
  fj?: string;
  fma?: string;
  suggestedTargetId?: string;
  suggestedLabel?: string;
}

export interface MeshMappingReport {
  generatedAtIso: string;
  sourceLabel: string;
  totalMeshes: number;
  mappedCount: number;
  unmappedCount: number;
  coveragePct: number;
  mappedBySystem: Record<string, { total: number; mapped: number; unmapped: number }>;
  mappedEntries: MappedMeshResult[];
  unmappedEntries: UnmappedMeshItem[];
}

/**
 * Canonical FMA ↔ Terminologia Anatomica (English + Latin) dictionary bridging
 * BodyParts3D 4.0 FMA mesh names (e.g., "right vastus lateralis [FJ1442]",
 * "clavicular part of right deltoid [FJ1468]", "right fibularis longus [FJ1410]")
 * and legacy TA names directly to FlapAtlas anatomy IDs, vessels, muscles,
 * nerves, bones, and flaps.
 */
export const CANONICAL_TA_MAPPINGS: AnatomyMappingEntry[] = [
  // --- ARTERIES (mapped to vessels.json IDs) ---
  {
    targetId: 'v-lcfa-desc',
    label: 'Descending Branch of Lateral Circumflex Femoral Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['alt-flap', 'rectus-femoris-flap', 'amt-flap'],
    aliases: [
      'descending branch of lateral circumflex femoral artery',
      'lateral circumflex femoral artery',
      'arteria circumflexa femoris lateralis',
      'ramus descendens arteriae circumflexae femoris lateralis',
      'lcfa',
    ],
  },
  {
    targetId: 'v-diea',
    label: 'Deep Inferior Epigastric Artery (DIEA)',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['diep-flap', 'tram-flap', 'vram-flap'],
    aliases: [
      'deep inferior epigastric artery',
      'inferior epigastric artery',
      'arteria epigastrica inferior',
      'diea',
    ],
  },
  {
    targetId: 'v-siea',
    label: 'Superficial Inferior Epigastric Artery (SIEA)',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['siea-flap'],
    aliases: [
      'superficial inferior epigastric artery',
      'superficial epigastric artery',
      'arteria epigastrica superficialis',
      'siea',
    ],
  },
  {
    targetId: 'v-thoracodorsal',
    label: 'Thoracodorsal Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['ld-flap', 'tdap-flap', 'serratus-anterior-flap'],
    aliases: [
      'thoracodorsal artery',
      'arteria thoracodorsalis',
      'subscapular artery',
      'arteria subscapularis',
      'circumflex scapular artery',
    ],
  },
  {
    targetId: 'v-radial',
    label: 'Radial Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['rfff-flap'],
    aliases: ['radial artery', 'arteria radialis'],
  },
  {
    targetId: 'v-peroneal',
    label: 'Peroneal (Fibular) Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['fibula-flap', 'peroneal-perforator-flap'],
    aliases: ['peroneal artery', 'fibular artery', 'arteria fibularis', 'arteria peronea'],
  },
  {
    targetId: 'v-mcfa',
    label: 'Medial Circumflex Femoral Artery (MCFA)',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['gracilis-flap', 'tug-flap'],
    aliases: [
      'medial circumflex femoral artery',
      'arteria circumflexa femoris medialis',
      'mcfa',
    ],
  },
  {
    targetId: 'v-profunda-perf',
    label: 'Profunda Femoris Artery & Perforators',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['pap-flap'],
    aliases: [
      'profunda femoris artery',
      'deep femoral artery',
      'deep artery of thigh',
      'arteria profunda femoris',
      'first perforating artery',
      'second perforating artery',
      'third perforating artery',
    ],
  },
  {
    targetId: 'v-sga',
    label: 'Superior Gluteal Artery (SGA)',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['sgap-flap', 'gluteal-rotation-flap'],
    aliases: ['superior gluteal artery', 'arteria glutea superior', 'sga'],
  },
  {
    targetId: 'v-thoracoacromial',
    label: 'Thoracoacromial Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['pec-major-flap'],
    aliases: [
      'thoracoacromial artery',
      'thoraco acromial artery',
      'trunk of thoraco acromial artery',
      'pectoral branch of thoracoacromial artery',
      'pectoral branch of thoraco acromial artery',
      'arteria thoracoacromialis',
    ],
  },
  {
    targetId: 'v-sural-medial',
    label: 'Medial Sural Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['gastrocnemius-flap', 'msap-flap'],
    aliases: ['medial sural artery', 'sural artery', 'arteria suralis', 'arteriae surales'],
  },
  {
    targetId: 'v-scia',
    label: 'Superficial Circumflex Iliac Artery (SCIA)',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['groin-flap'],
    aliases: [
      'superficial circumflex iliac artery',
      'arteria circumflexa ilium superficialis',
      'scia',
    ],
  },
  {
    targetId: 'v-supratrochlear',
    label: 'Supratrochlear Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['paramedian-forehead-flap'],
    aliases: ['supratrochlear artery', 'arteria supratrochlearis'],
  },
  {
    targetId: 'v-femoral',
    label: 'Femoral Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['alt-flap', 'gracilis-flap', 'groin-flap', 'pap-flap'],
    aliases: ['femoral artery', 'common femoral artery', 'arteria femoralis'],
  },
  {
    targetId: 'v-posterior-tibial',
    label: 'Posterior Tibial Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['soleus-flap', 'ptap-flap', 'medial-plantar-flap'],
    aliases: ['posterior tibial artery', 'arteria tibialis posterior'],
  },
  {
    targetId: 'v-anterior-tibial',
    label: 'Anterior Tibial Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['toe-to-hand-flap'],
    aliases: ['anterior tibial artery', 'arteria tibialis anterior', 'dorsalis pedis artery'],
  },
  {
    targetId: 'v-internal-thoracic',
    label: 'Internal Thoracic (Mammary) Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['diep-flap', 'tram-flap', 'deltopectoral-flap'],
    aliases: ['internal thoracic artery', 'internal mammary artery', 'arteria thoracica interna'],
  },
  {
    targetId: 'v-facial',
    label: 'Facial Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['famm-flap', 'submental-island-flap', 'nasolabial-flap'],
    aliases: ['facial artery', 'arteria facialis'],
  },
  {
    targetId: 'v-superficial-temporal',
    label: 'Superficial Temporal Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['tpff-flap', 'temporalis-muscle-flap'],
    aliases: ['superficial temporal artery', 'arteria temporalis superficialis'],
  },
  {
    targetId: 'v-ulnar',
    label: 'Ulnar Artery',
    kind: 'vessel',
    category: 'Artery',
    linkedFlapIds: ['ulnar-forearm-flap'],
    aliases: ['ulnar artery', 'arteria ulnaris'],
  },

  // --- NERVES ---
  {
    targetId: 'n-thoracodorsal',
    label: 'Thoracodorsal Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['ld-flap', 'tdap-flap'],
    aliases: ['thoracodorsal nerve', 'nervus thoracodorsalis'],
  },
  {
    targetId: 'n-lfcn',
    label: 'Lateral Femoral Cutaneous Nerve (LFCN)',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['alt-flap'],
    aliases: [
      'lateral femoral cutaneous nerve',
      'lateral cutaneous nerve of thigh',
      'nervus cutaneus femoris lateralis',
      'lfcn',
    ],
  },
  {
    targetId: 'n-obturator',
    label: 'Obturator Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['gracilis-flap', 'tug-flap'],
    aliases: ['obturator nerve', 'anterior branch of obturator nerve', 'nervus obturatorius'],
  },
  {
    targetId: 'n-sural',
    label: 'Sural Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['reverse-sural-flap'],
    aliases: ['sural nerve', 'medial sural cutaneous nerve', 'nervus suralis'],
  },
  {
    targetId: 'n-common-fibular',
    label: 'Common Fibular (Peroneal) Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['fibula-flap', 'gastrocnemius-flap'],
    aliases: [
      'common fibular nerve',
      'common peroneal nerve',
      'nervus fibularis communis',
      'nervus peroneus communis',
    ],
  },
  {
    targetId: 'n-radial',
    label: 'Radial Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['rfff-flap', 'lateral-arm-flap', 'pia-flap'],
    aliases: [
      'radial nerve',
      'superficial branch of radial nerve',
      'posterior interosseous nerve',
      'nervus radialis',
    ],
  },
  {
    targetId: 'n-sciatic',
    label: 'Sciatic Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['gluteal-rotation-flap', 'sgap-flap', 'igap-flap', 'pap-flap'],
    aliases: ['sciatic nerve', 'nervus ischiadicus'],
  },
  {
    targetId: 'n-femoral',
    label: 'Femoral Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['alt-flap', 'rectus-femoris-flap', 'amt-flap'],
    aliases: ['femoral nerve', 'nervus femoralis'],
  },
  {
    targetId: 'n-saphenous',
    label: 'Saphenous Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['mfc-flap', 'ptap-flap'],
    aliases: ['saphenous nerve', 'nervus saphenus'],
  },
  {
    targetId: 'n-tibial',
    label: 'Tibial Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['gastrocnemius-flap', 'soleus-flap', 'medial-plantar-flap'],
    aliases: ['tibial nerve', 'nervus tibialis', 'medial plantar nerve'],
  },
  {
    targetId: 'n-median',
    label: 'Median Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['rfff-flap', 'moberg-flap', 'atasoy-vy-flap'],
    aliases: ['median nerve', 'nervus medianus'],
  },
  {
    targetId: 'n-ulnar',
    label: 'Ulnar Nerve',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['ulnar-forearm-flap', 'littler-island-flap'],
    aliases: ['ulnar nerve', 'nervus ulnaris'],
  },
  {
    targetId: 'n-facial',
    label: 'Facial Nerve (CN VII)',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['tpff-flap', 'temporalis-muscle-flap', 'gracilis-flap', 'submental-island-flap'],
    aliases: ['facial nerve', 'nervus facialis', 'marginal mandibular', 'temporal branch of facial'],
  },
  {
    targetId: 'n-trigeminal',
    label: 'Trigeminal / Ophthalmic Nerve (CN V)',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['paramedian-forehead-flap', 'famm-flap', 'nasolabial-flap'],
    aliases: [
      'trigeminal nerve',
      'nervus trigeminus',
      'ophthalmic nerve',
      'frontal nerve',
      'supratrochlear nerve',
      'infratrochlear nerve',
      'supraorbital nerve',
      'infraorbital nerve',
      'nasociliary nerve',
      'lacrimal nerve',
    ],
  },
  {
    targetId: 'n-accessory',
    label: 'Spinal Accessory Nerve (CN XI)',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['trapezius-flap', 'scm-flap'],
    aliases: ['accessory nerve', 'spinal accessory nerve', 'nervus accessorius'],
  },
  {
    targetId: 'n-brachial-plexus',
    label: 'Brachial Plexus',
    kind: 'nerve',
    category: 'Nerve',
    linkedFlapIds: ['ld-flap', 'pec-major-flap', 'serratus-anterior-flap'],
    aliases: ['brachial plexus', 'plexus brachialis', 'long thoracic nerve'],
  },

  // --- MUSCLES (FMA + TA aliases + logical parent muscles) ---
  {
    targetId: 'quadriceps_femoris',
    label: 'Quadriceps Femoris Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['alt-flap', 'rectus-femoris-flap', 'amt-flap', 'mfc-flap'],
    aliases: ['quadriceps femoris', 'quadriceps femoris muscle', 'musculus quadriceps femoris'],
  },
  {
    targetId: 'vastus_lateralis',
    label: 'Vastus Lateralis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['alt-flap'],
    aliases: ['vastus lateralis', 'vastus lateralis muscle', 'musculus vastus lateralis'],
  },
  {
    targetId: 'vastus_medialis',
    label: 'Vastus Medialis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['mfc-flap', 'amt-flap'],
    aliases: ['vastus medialis', 'vastus medialis muscle', 'musculus vastus medialis'],
  },
  {
    targetId: 'vastus_intermedius',
    label: 'Vastus Intermedius Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['alt-flap', 'rectus-femoris-flap'],
    aliases: ['vastus intermedius', 'vastus intermedius muscle', 'musculus vastus intermedius'],
  },
  {
    targetId: 'rectus_femoris',
    label: 'Rectus Femoris Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['rectus-femoris-flap', 'alt-flap', 'amt-flap'],
    aliases: ['rectus femoris', 'rectus femoris muscle', 'musculus rectus femoris'],
  },
  {
    targetId: 'gracilis',
    label: 'Gracilis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['gracilis-flap', 'tug-flap'],
    aliases: ['gracilis', 'gracilis muscle', 'musculus gracilis'],
  },
  {
    targetId: 'adductor_longus',
    label: 'Adductor Longus Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['gracilis-flap', 'tug-flap'],
    aliases: ['adductor longus', 'adductor longus muscle', 'musculus adductor longus'],
  },
  {
    targetId: 'adductor_magnus',
    label: 'Adductor Magnus Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['pap-flap', 'gracilis-flap', 'mfc-flap'],
    aliases: ['adductor magnus', 'adductor magnus muscle', 'musculus adductor magnus'],
  },
  {
    targetId: 'biceps_femoris',
    label: 'Biceps Femoris Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['pap-flap'],
    aliases: [
      'biceps femoris',
      'biceps femoris muscle',
      'musculus biceps femoris',
      'long head of biceps femoris',
      'short head of biceps femoris',
    ],
  },
  {
    targetId: 'semitendinosus',
    label: 'Semitendinosus Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['pap-flap'],
    aliases: ['semitendinosus', 'semitendinosus muscle', 'musculus semitendinosus'],
  },
  {
    targetId: 'semimembranosus',
    label: 'Semimembranosus Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['pap-flap'],
    aliases: ['semimembranosus', 'semimembranosus muscle', 'musculus semimembranosus'],
  },
  {
    targetId: 'pec_major',
    label: 'Pectoralis Major Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['pec-major-flap', 'deltopectoral-flap'],
    aliases: [
      'pectoralis major',
      'pectoralis major muscle',
      'musculus pectoralis major',
      'clavicular part of pectoralis major',
      'sternocostal part of pectoralis major',
      'abdominal part of pectoralis major',
      'clavicular head of pectoralis major',
      'sternocostal head of pectoralis major',
    ],
  },
  {
    targetId: 'pec_minor',
    label: 'Pectoralis Minor Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['pec-major-flap'],
    aliases: ['pectoralis minor', 'pectoralis minor muscle', 'musculus pectoralis minor'],
  },
  {
    targetId: 'rectus_abdominis',
    label: 'Rectus Abdominis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['diep-flap', 'tram-flap', 'vram-flap'],
    aliases: ['rectus abdominis', 'rectus abdominis muscle', 'musculus rectus abdominis'],
  },
  {
    targetId: 'external_oblique',
    label: 'External Abdominal Oblique Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['external-oblique-flap', 'diep-flap'],
    aliases: [
      'external abdominal oblique',
      'external oblique',
      'external abdominal oblique muscle',
      'musculus obliquus externus abdominis',
    ],
  },
  {
    targetId: 'internal_oblique',
    label: 'Internal Abdominal Oblique Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['dcia-flap', 'external-oblique-flap'],
    aliases: [
      'internal abdominal oblique',
      'internal oblique',
      'internal abdominal oblique muscle',
      'musculus obliquus internus abdominis',
    ],
  },
  {
    targetId: 'transversus_abdominis',
    label: 'Transversus Abdominis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['dcia-flap', 'diep-flap'],
    aliases: [
      'transversus abdominis',
      'transverse abdominal muscle',
      'musculus transversus abdominis',
    ],
  },
  {
    targetId: 'diaphragm',
    label: 'Diaphragm',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['omental-flap', 'ld-flap'],
    aliases: ['diaphragm', 'thoracic diaphragm', 'diaphragma'],
  },
  {
    targetId: 'latissimus_dorsi',
    label: 'Latissimus Dorsi Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['ld-flap', 'tdap-flap'],
    aliases: ['latissimus dorsi', 'latissimus dorsi muscle', 'musculus latissimus dorsi'],
  },
  {
    targetId: 'erector_spinae',
    label: 'Erector Spinae / Paraspinous Muscles',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['paraspinous-flap', 'lap-flap'],
    aliases: [
      'erector spinae',
      'iliocostalis',
      'longissimus',
      'spinalis',
      'multifidus',
      'musculus erector spinae',
    ],
  },
  {
    targetId: 'gastrocnemius',
    label: 'Gastrocnemius Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['gastrocnemius-flap', 'msap-flap', 'reverse-sural-flap'],
    aliases: [
      'gastrocnemius',
      'gastrocnemius muscle',
      'medial head of gastrocnemius',
      'lateral head of gastrocnemius',
      'musculus gastrocnemius',
    ],
  },
  {
    targetId: 'soleus',
    label: 'Soleus Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['soleus-flap', 'fibula-flap'],
    aliases: ['soleus', 'soleus muscle', 'musculus soleus'],
  },
  {
    targetId: 'tibialis_anterior',
    label: 'Tibialis Anterior Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['soleus-flap', 'ptap-flap'],
    aliases: ['tibialis anterior', 'tibialis anterior muscle', 'musculus tibialis anterior'],
  },
  {
    targetId: 'flexor_hallucis_longus',
    label: 'Flexor Hallucis Longus Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['fibula-flap'],
    aliases: ['flexor hallucis longus', 'musculus flexor hallucis longus'],
  },
  {
    targetId: 'abductor_hallucis',
    label: 'Abductor Hallucis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['medial-plantar-flap'],
    aliases: ['abductor hallucis', 'musculus abductor hallucis'],
  },
  {
    targetId: 'gluteus_maximus',
    label: 'Gluteus Maximus Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['sgap-flap', 'igap-flap', 'gluteal-rotation-flap'],
    aliases: ['gluteus maximus', 'gluteus maximus muscle', 'musculus gluteus maximus'],
  },
  {
    targetId: 'gluteus_medius',
    label: 'Gluteus Medius Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['sgap-flap', 'tfl-flap'],
    aliases: ['gluteus medius', 'gluteus medius muscle', 'musculus gluteus medius'],
  },
  {
    targetId: 'tensor_fasciae_latae',
    label: 'Tensor Fasciae Latae Muscle & Iliotibial Tract',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['tfl-flap', 'alt-flap'],
    aliases: [
      'tensor fasciae latae',
      'tensor fascia lata',
      'tensor fasciae latae muscle',
      'musculus tensor fasciae latae',
      'iliotibial tract',
      'iliotibial band',
      'tractus iliotibialis',
    ],
  },
  {
    targetId: 'serratus_anterior',
    label: 'Serratus Anterior Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['serratus-anterior-flap', 'ld-flap'],
    aliases: ['serratus anterior', 'serratus anterior muscle', 'musculus serratus anterior'],
  },
  {
    targetId: 'trapezius',
    label: 'Trapezius Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['trapezius-flap'],
    aliases: [
      'trapezius',
      'trapezius muscle',
      'musculus trapezius',
      'descending part of trapezius',
      'transverse part of trapezius',
      'ascending part of trapezius',
    ],
  },
  {
    targetId: 'sternocleidomastoid',
    label: 'Sternocleidomastoid (SCM) Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['scm-flap'],
    aliases: ['sternocleidomastoid', 'sternocleidomastoid muscle', 'musculus sternocleidomastoideus'],
  },
  {
    targetId: 'temporalis',
    label: 'Temporalis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['temporalis-muscle-flap', 'tpff-flap'],
    aliases: ['temporalis', 'temporalis muscle', 'temporal muscle', 'musculus temporalis'],
  },
  {
    targetId: 'frontalis',
    label: 'Occipitofrontalis (Frontalis) Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['paramedian-forehead-flap'],
    aliases: ['occipitofrontalis', 'frontal belly', 'frontalis'],
  },
  {
    targetId: 'orbicularis_oris',
    label: 'Orbicularis Oris Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['abbe-estlander-flap', 'famm-flap'],
    aliases: ['orbicularis oris', 'musculus orbicularis oris'],
  },
  {
    targetId: 'buccinator',
    label: 'Buccinator Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['famm-flap'],
    aliases: ['buccinator', 'buccinator muscle', 'musculus buccinator'],
  },
  {
    targetId: 'platysma',
    label: 'Platysma Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['submental-island-flap', 'cervicofacial-flap'],
    aliases: ['platysma', 'platysma muscle'],
  },
  {
    targetId: 'deltoid',
    label: 'Deltoid Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['deltopectoral-flap', 'lateral-arm-flap'],
    aliases: [
      'deltoid',
      'deltoid muscle',
      'musculus deltoideus',
      'clavicular part of deltoid',
      'acromial part of deltoid',
      'spinal part of deltoid',
    ],
  },
  {
    targetId: 'teres_major',
    label: 'Teres Major Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['scapular-flap', 'ld-flap'],
    aliases: ['teres major', 'teres major muscle', 'musculus teres major'],
  },
  {
    targetId: 'teres_minor',
    label: 'Teres Minor Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['scapular-flap'],
    aliases: ['teres minor', 'teres minor muscle', 'musculus teres minor'],
  },
  {
    targetId: 'triceps_brachii',
    label: 'Triceps Brachii Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['lateral-arm-flap', 'scapular-flap'],
    aliases: [
      'triceps brachii',
      'musculus triceps brachii',
      'long head of triceps brachii',
      'lateral head of triceps brachii',
      'medial head of triceps brachii',
    ],
  },
  {
    targetId: 'biceps_brachii',
    label: 'Biceps Brachii Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['rfff-flap', 'lateral-arm-flap'],
    aliases: [
      'biceps brachii',
      'musculus biceps brachii',
      'long head of biceps brachii',
      'short head of biceps brachii',
    ],
  },
  {
    targetId: 'brachioradialis',
    label: 'Brachioradialis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['rfff-flap', 'lateral-arm-flap'],
    aliases: ['brachioradialis', 'brachioradialis muscle', 'musculus brachioradialis'],
  },
  {
    targetId: 'palmaris_longus',
    label: 'Palmaris Longus Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['rfff-flap'],
    aliases: ['palmaris longus', 'palmaris longus muscle', 'musculus palmaris longus'],
  },
  {
    targetId: 'flexor_carpi_radialis',
    label: 'Flexor Carpi Radialis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['rfff-flap'],
    aliases: ['flexor carpi radialis', 'musculus flexor carpi radialis'],
  },
  {
    targetId: 'extensor_carpi_radialis',
    label: 'Extensor Carpi Radialis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['rfff-flap', 'lateral-arm-flap'],
    aliases: [
      'extensor carpi radialis',
      'extensor carpi radialis longus',
      'extensor carpi radialis brevis',
      'musculus extensor carpi radialis longus',
      'musculus extensor carpi radialis brevis',
    ],
  },
  {
    targetId: 'flexor_carpi_ulnaris',
    label: 'Flexor Carpi Ulnaris Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['ulnar-forearm-flap'],
    aliases: ['flexor carpi ulnaris', 'musculus flexor carpi ulnaris'],
  },
  {
    targetId: 'extensor_carpi_ulnaris',
    label: 'Extensor Carpi Ulnaris Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['pia-flap'],
    aliases: ['extensor carpi ulnaris', 'musculus extensor carpi ulnaris'],
  },
  {
    targetId: 'peroneus_brevis',
    label: 'Fibularis (Peroneus) Brevis Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['peroneus-brevis-flap', 'fibula-flap'],
    aliases: [
      'fibularis brevis',
      'fibularis brevis muscle',
      'peroneus brevis',
      'peroneus brevis muscle',
      'musculus fibularis brevis',
    ],
  },
  {
    targetId: 'peroneus_longus',
    label: 'Fibularis (Peroneus) Longus Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['fibula-flap', 'peroneal-perforator-flap'],
    aliases: [
      'fibularis longus',
      'fibularis longus muscle',
      'peroneus longus',
      'peroneus longus muscle',
      'musculus fibularis longus',
    ],
  },
  {
    targetId: 'sartorius',
    label: 'Sartorius Muscle',
    kind: 'muscle',
    category: 'Muscle',
    linkedFlapIds: ['groin-flap', 'alt-flap'],
    aliases: ['sartorius', 'sartorius muscle', 'musculus sartorius'],
  },

  // --- KEY SKELETAL BONES ---
  {
    targetId: 'bone_femur',
    label: 'Femur',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['alt-flap', 'mfc-flap'],
    aliases: ['femur', 'os femoris'],
  },
  {
    targetId: 'bone_fibula',
    label: 'Fibula',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['fibula-flap', 'peroneal-perforator-flap', 'peroneus-brevis-flap'],
    aliases: ['fibula'],
  },
  {
    targetId: 'bone_tibia',
    label: 'Tibia',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['gastrocnemius-flap', 'soleus-flap', 'ptap-flap'],
    aliases: ['tibia'],
  },
  {
    targetId: 'bone_calcaneus',
    label: 'Calcaneus',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['reverse-sural-flap', 'medial-plantar-flap', 'peroneus-brevis-flap'],
    aliases: ['calcaneus'],
  },
  {
    targetId: 'bone_scapula',
    label: 'Scapula',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['scapular-flap', 'ld-flap', 'trapezius-flap'],
    aliases: ['scapula'],
  },
  {
    targetId: 'bone_clavicle',
    label: 'Clavicle',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['pec-major-flap', 'deltopectoral-flap', 'scm-flap'],
    aliases: ['clavicle', 'clavicula'],
  },
  {
    targetId: 'bone_humerus',
    label: 'Humerus',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['lateral-arm-flap', 'ld-flap', 'pec-major-flap'],
    aliases: ['humerus'],
  },
  {
    targetId: 'bone_radius',
    label: 'Radius',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['rfff-flap'],
    aliases: ['radius'],
  },
  {
    targetId: 'bone_ulna',
    label: 'Ulna',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['ulnar-forearm-flap', 'pia-flap'],
    aliases: ['ulna'],
  },
  {
    targetId: 'bone_mandible',
    label: 'Mandible',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['fibula-flap', 'dcia-flap', 'scapular-flap'],
    aliases: ['mandible', 'mandibula'],
  },
  {
    targetId: 'bone_maxilla',
    label: 'Maxilla',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['fibula-flap', 'scapular-flap', 'famm-flap'],
    aliases: ['maxilla'],
  },
  {
    targetId: 'bone_temporal',
    label: 'Temporal Bone',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['tpff-flap', 'temporalis-muscle-flap'],
    aliases: ['temporal bone', 'os temporale'],
  },
  {
    targetId: 'bone_frontal',
    label: 'Frontal Bone',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['paramedian-forehead-flap'],
    aliases: ['frontal bone', 'os frontale'],
  },
  {
    targetId: 'bone_nasal',
    label: 'Nasal Bone',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['paramedian-forehead-flap', 'bilobed-rhomboid-flap', 'nasolabial-flap'],
    aliases: ['nasal bone', 'os nasale'],
  },
  {
    targetId: 'bone_ilium',
    label: 'Hip Bone / Iliac Crest (Ilium)',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['dcia-flap', 'groin-flap', 'alt-flap'],
    aliases: ['hip bone', 'ilium', 'os coxae', 'pelvic bone', 'iliac bone'],
  },
  {
    targetId: 'bone_sacrum',
    label: 'Sacrum',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['sgap-flap', 'igap-flap', 'gluteal-rotation-flap'],
    aliases: ['sacrum', 'os sacrum'],
  },
  {
    targetId: 'bone_patella',
    label: 'Patella',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['alt-flap', 'gastrocnemius-flap', 'mfc-flap'],
    aliases: ['patella'],
  },
  {
    targetId: 'bone_sternum',
    label: 'Sternum',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['pec-major-flap', 'vram-flap', 'omental-flap'],
    aliases: ['sternum', 'manubrium of sternum', 'body of sternum', 'xiphoid process'],
  },
  {
    targetId: 'bone_rib',
    label: 'Rib (Costal Arch)',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['serratus-anterior-flap', 'pec-major-flap', 'ld-flap'],
    aliases: [
      'first rib',
      'second rib',
      'third rib',
      'fourth rib',
      'fifth rib',
      'sixth rib',
      'seventh rib',
      'eighth rib',
      'ninth rib',
      'tenth rib',
      'eleventh rib',
      'twelfth rib',
    ],
  },
  {
    targetId: 'bone_metacarpal',
    label: 'Metacarpal Bone',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['kite-fdma-flap', 'cross-finger-flap', 'moberg-flap'],
    aliases: [
      'first metacarpal',
      'second metacarpal',
      'third metacarpal',
      'fourth metacarpal',
      'fifth metacarpal',
    ],
  },
  {
    targetId: 'bone_metatarsal',
    label: 'Metatarsal Bone',
    kind: 'bone',
    category: 'Skeleton',
    linkedFlapIds: ['toe-to-hand-flap', 'medial-plantar-flap'],
    aliases: [
      'first metatarsal',
      'second metatarsal',
      'third metatarsal',
      'fourth metatarsal',
      'fifth metatarsal',
    ],
  },

  // --- VISCERAL ORGANS ---
  {
    targetId: 'organ_jejunum',
    label: 'Jejunum',
    kind: 'organ',
    category: 'Organ',
    linkedFlapIds: ['jejunal-free-flap'],
    aliases: ['jejunum'],
  },
  {
    targetId: 'organ_omentum',
    label: 'Greater Omentum',
    kind: 'organ',
    category: 'Organ',
    linkedFlapIds: ['omental-flap'],
    aliases: ['greater omentum', 'omentum majus'],
  },
  {
    targetId: 'organ_stomach',
    label: 'Stomach',
    kind: 'organ',
    category: 'Organ',
    linkedFlapIds: ['omental-flap'],
    aliases: ['stomach', 'gaster'],
  },
  {
    targetId: 'organ_heart',
    label: 'Heart',
    kind: 'organ',
    category: 'Organ',
    linkedFlapIds: ['pec-major-flap', 'omental-flap', 'vram-flap'],
    aliases: [
      'heart',
      'pericardium',
      'left ventricle',
      'right ventricle',
      'right atrium',
      'left atrium',
    ],
  },
  {
    targetId: 'organ_lung',
    label: 'Lung',
    kind: 'organ',
    category: 'Organ',
    linkedFlapIds: ['ld-flap', 'serratus-anterior-flap', 'pec-major-flap'],
    aliases: [
      'right lung',
      'left lung',
      'superior lobe of',
      'inferior lobe of',
      'middle lobe of',
    ],
  },
  {
    targetId: 'organ_liver',
    label: 'Liver & Hepatovenous Segments',
    kind: 'organ',
    category: 'Organ',
    linkedFlapIds: ['omental-flap'],
    aliases: ['liver', 'hepatovenous segment', 'right lobe of liver', 'left lobe of liver'],
  },
];

/**
 * Bidirectional FMA ↔ TA term aliases applied during search & lookup normalization.
 */
export const FMA_TA_TERM_ALIASES: Record<string, string[]> = {
  'fibularis longus': ['peroneus longus'],
  'peroneus longus': ['fibularis longus'],
  'fibularis brevis': ['peroneus brevis'],
  'peroneus brevis': ['fibularis brevis'],
  'fibular artery': ['peroneal artery'],
  'peroneal artery': ['fibular artery'],
  'internal thoracic artery': ['internal mammary artery'],
  'internal mammary artery': ['internal thoracic artery'],
  'iliotibial tract': ['tensor fasciae latae', 'iliotibial band'],
  'tensor fasciae latae': ['tensor fascia lata', 'iliotibial tract'],
  'pectoralis minor': ['pec minor'],
  'pectoralis major': ['pec major'],
  'quadriceps femoris': ['rectus femoris', 'vastus lateralis', 'vastus medialis', 'vastus intermedius'],
};

interface LogicalGroupDefinition {
  groupId: string;
  groupLabel: string;
  parentNormalized: string;
  explicitMembers?: string[];
}

const EXPLICIT_LOGICAL_GROUPS: LogicalGroupDefinition[] = [
  {
    groupId: 'group:deltoid',
    groupLabel: 'Deltoid Muscle',
    parentNormalized: 'deltoid',
  },
  {
    groupId: 'group:pectoralis_major',
    groupLabel: 'Pectoralis Major Muscle',
    parentNormalized: 'pectoralis major',
  },
  {
    groupId: 'group:trapezius',
    groupLabel: 'Trapezius Muscle',
    parentNormalized: 'trapezius',
  },
  {
    groupId: 'group:biceps_brachii',
    groupLabel: 'Biceps Brachii Muscle',
    parentNormalized: 'biceps brachii',
  },
  {
    groupId: 'group:triceps_brachii',
    groupLabel: 'Triceps Brachii Muscle',
    parentNormalized: 'triceps brachii',
  },
  {
    groupId: 'group:biceps_femoris',
    groupLabel: 'Biceps Femoris Muscle',
    parentNormalized: 'biceps femoris',
  },
  {
    groupId: 'group:gastrocnemius',
    groupLabel: 'Gastrocnemius Muscle',
    parentNormalized: 'gastrocnemius',
  },
  {
    groupId: 'group:quadriceps_femoris',
    groupLabel: 'Quadriceps Femoris',
    parentNormalized: 'quadriceps femoris',
    explicitMembers: [
      'rectus femoris',
      'vastus lateralis',
      'vastus medialis',
      'vastus intermedius',
    ],
  },
];

function toTitleCase(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Resolves a normalized BP3D FMA name into its logical parent anatomy group
 * (e.g. "clavicular part of deltoid" -> Deltoid Muscle, "long head of biceps brachii" ->
 * Biceps Brachii Muscle, "vastus lateralis" -> Quadriceps Femoris).
 */
export function resolveLogicalAnatomyGroup(
  normalizedName: string,
  system?: AnatomicalSystemId
): LogicalAnatomyGroup | null {
  const clean = normalizedName
    .replace(/\s*\[(?:FJ|FMA)[A-Z0-9_-]*\]\s*/gi, ' ')
    .replace(/\.(?:er|el|or|ol|o\d+[rl]|e\d+[rl]|r|l|m|g|s|t)$/i, '')
    .replace(/\.\d+$/i, '')
    .trim()
    .toLowerCase()
    .replace(/^(?:left|right|bilateral|lt\.?|rt\.?)\s+/i, '')
    .replace(/\s+(?:left|right|bilateral)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;

  // Avoid grouping vascular/organ branches with "part of" unless they are muscles
  if (system && system !== 'muscles') {
    return null;
  }

  // 1. Explicit multi-muscle group members (e.g. Quadriceps femoris = RF + VL + VM + VI)
  for (const def of EXPLICIT_LOGICAL_GROUPS) {
    if (def.explicitMembers?.some((m) => clean === m || clean === `${m} muscle`)) {
      return {
        groupId: def.groupId,
        groupLabel: def.groupLabel,
        partLabel: toTitleCase(clean),
      };
    }
  }

  // 2. Pattern: "<modifier> part of <parent>" / "<modifier> head of <parent>" / "part of <parent>"
  const partMatch = clean.match(
    /^(?:([a-z0-9\s-]+?)\s+)?(?:part|head|belly)\s+of\s+(.+)$/i
  );
  if (partMatch) {
    const rawParent = partMatch[2]
      .replace(/^(?:the|a|an)\s+/i, '')
      .replace(/\s+muscle$/i, '')
      .trim();
    if (rawParent.length >= 4) {
      const explicit = EXPLICIT_LOGICAL_GROUPS.find((g) => g.parentNormalized === rawParent);
      if (explicit) {
        return {
          groupId: explicit.groupId,
          groupLabel: explicit.groupLabel,
          partLabel: toTitleCase(clean),
        };
      }
      // Generic logical muscle group for any other BP3D "X part/head of Y" muscle
      return {
        groupId: `group:${rawParent.replace(/[^a-z0-9]+/g, '_')}`,
        groupLabel: toTitleCase(rawParent),
        partLabel: toTitleCase(clean),
      };
    }
  }

  // 3. Direct match on an explicit parent name itself (e.g. "deltoid", "pectoralis major")
  for (const def of EXPLICIT_LOGICAL_GROUPS) {
    if (clean === def.parentNormalized || clean === `${def.parentNormalized} muscle`) {
      return {
        groupId: def.groupId,
        groupLabel: def.groupLabel,
        partLabel: def.groupLabel,
      };
    }
  }

  return null;
}

/**
 * Extracts laterality (`left`/`right`/`midline`, respecting `extras.side` when provided),
 * strips `[FJxxxx]` tags, strips `left`/`right`/`bilateral` modifiers anywhere in FMA names
 * (e.g., `"clavicular part of right deltoid [FJ1468]"` -> `"clavicular part of deltoid"`),
 * and strips legacy Blender/Z-Anatomy suffixes (`.r`, `.l`, `.001`).
 */
export function parseTerminologiaMeshName(
  rawName: string,
  explicitSide?: Laterality
): {
  normalizedName: string;
  laterality: Laterality;
  displayLabel: string;
  fjCode?: string;
} {
  let working = rawName.trim();

  // Extract and strip BodyParts3D [FJxxxx] suffix
  let fjCode: string | undefined;
  const fjMatch = working.match(/\s*\[(FJ[A-Za-z0-9_-]+)\]\s*$/i);
  if (fjMatch) {
    fjCode = fjMatch[1].toUpperCase();
    working = working.slice(0, fjMatch.index).trim();
  }

  // Strip Blender numeric duplicate suffix e.g. ".001"
  working = working.replace(/\.\d{3}$/, '');

  let laterality: Laterality = explicitSide || 'midline';
  const hasExplicitSide = explicitSide === 'left' || explicitSide === 'right' || explicitSide === 'midline';

  // Legacy Z-Anatomy muscle origin/insertion suffixes with laterality: e.g. ".er", ".el"
  const zaAttachLat = working.match(/\.(o|e)\d*(r|l)$/i);
  if (zaAttachLat) {
    if (!hasExplicitSide) {
      laterality = zaAttachLat[2].toLowerCase() === 'r' ? 'right' : 'left';
    }
    working = working.replace(/\.(o|e)\d*(r|l)$/i, '');
  } else if (
    /(^|[\s._-])(r|right|rt|dexter|dextra)$/i.test(working) ||
    /^(right|rt)[\s._-]/i.test(working)
  ) {
    if (!hasExplicitSide) laterality = 'right';
    working = working
      .replace(/([\s._-])(r|right|rt|dexter|dextra)$/i, '')
      .replace(/^(right|rt)[\s._-]+/i, '');
  } else if (
    /(^|[\s._-])(l|left|lt|sinister|sinistra)$/i.test(working) ||
    /^(left|lt)[\s._-]/i.test(working)
  ) {
    if (!hasExplicitSide) laterality = 'left';
    working = working
      .replace(/([\s._-])(l|left|lt|sinister|sinistra)$/i, '')
      .replace(/^(left|lt)[\s._-]+/i, '');
  }

  // Handle FMA medial modifiers inside phrases, e.g., "clavicular part of right deltoid",
  // "long head of left biceps brachii", "bilateral ..."
  if (!hasExplicitSide && laterality === 'midline') {
    if (/\bof\s+right\b/i.test(working)) laterality = 'right';
    else if (/\bof\s+left\b/i.test(working)) laterality = 'left';
  }

  // Strip embedded left/right/bilateral modifiers cleanly for normalized lookup
  const cleanForDisplay = working
    .replace(/\.(o|e)\d*$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedName = cleanForDisplay
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(left|right|bilateral)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const sideTag = laterality === 'right' ? ' (R)' : laterality === 'left' ? ' (L)' : '';
  const strippedDisplay = cleanForDisplay
    .replace(/\b(left|right|bilateral)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const displayLabel = strippedDisplay ? `${strippedDisplay}${sideTag}` : rawName;

  return { normalizedName, laterality, displayLabel, fjCode };
}

function defaultCategoryForSystem(system: AnatomicalSystemId): {
  category: string;
  kind: AnatomyTargetKind;
} {
  switch (system) {
    case 'arteries':
      return { category: 'Artery', kind: 'vessel' };
    case 'veins':
      return { category: 'Vein', kind: 'vessel' };
    case 'nerves':
      return { category: 'Nerve', kind: 'nerve' };
    case 'muscles':
      return { category: 'Muscle', kind: 'muscle' };
    case 'skeleton':
      return { category: 'Skeleton', kind: 'bone' };
    case 'skin':
      return { category: 'Skin', kind: 'skin' };
    case 'organs':
      return { category: 'Organ', kind: 'organ' };
    default:
      return { category: 'Structure', kind: 'other' };
  }
}

export interface AnatomyMapperContext {
  vessels: VesselRecord[];
  flaps: FlapRecord[];
  customOverrides?: Record<string, CustomAnatomyOverride>;
}

export interface MapMeshExtras {
  fj?: string;
  fma?: string;
  side?: Laterality;
}

/**
 * Resolves a single GLB mesh's FMA / Terminologia Anatomica name to a FlapAtlas
 * anatomy ID (`vessels.json`, muscles, nerves, bones, or flaps) and logical muscle group.
 */
export function mapMeshNameToAnatomy(
  rawMeshName: string,
  system: AnatomicalSystemId,
  ctx: AnatomyMapperContext,
  extras?: MapMeshExtras
): MappedMeshResult {
  const parsed = parseTerminologiaMeshName(rawMeshName, extras?.side);
  const { normalizedName, laterality, displayLabel } = parsed;
  const fjCode = extras?.fj?.trim().toUpperCase() || parsed.fjCode;
  const fmaCode = extras?.fma?.trim().toUpperCase();
  const fallbackMeta = defaultCategoryForSystem(system);
  const sideTag = laterality === 'right' ? ' (R)' : laterality === 'left' ? ' (L)' : '';
  const logicalGroup = resolveLogicalAnatomyGroup(normalizedName, system);

  // 1. User custom override (exact raw name, normalized name, or FJ code)
  const override =
    ctx.customOverrides?.[rawMeshName] ||
    ctx.customOverrides?.[normalizedName] ||
    (fjCode ? ctx.customOverrides?.[fjCode] : undefined);
  if (override) {
    return {
      rawMeshName,
      normalizedName,
      laterality,
      system,
      mapped: true,
      matchSource: 'override',
      anatomyId: override.targetId,
      label: `${override.label}${sideTag}`,
      category:
        override.kind === 'vessel'
          ? system === 'veins'
            ? 'Vein'
            : 'Artery'
          : override.kind === 'muscle'
            ? 'Muscle'
            : override.kind === 'nerve'
              ? 'Nerve'
              : override.kind === 'bone'
                ? 'Skeleton'
                : 'Anatomy',
      kind: override.kind,
      linkedFlapIds: override.linkedFlapIds,
      fjCode,
      fmaCode,
      groupId: logicalGroup?.groupId,
      groupLabel: logicalGroup?.groupLabel,
      partLabel: logicalGroup?.partLabel,
    };
  }

  // Build candidate names including FMA ↔ TA alias expansions
  const expandedNames = new Set<string>([normalizedName]);
  const directAliases = FMA_TA_TERM_ALIASES[normalizedName];
  if (directAliases) {
    for (const a of directAliases) expandedNames.add(a);
  }

  // 2. Canonical FMA / Terminologia Anatomica exact/phrase match
  for (const entry of CANONICAL_TA_MAPPINGS) {
    let hit = false;
    for (const candName of expandedNames) {
      if (
        entry.aliases.some(
          (alias) =>
            candName === alias || (alias.length >= 6 && candName.includes(alias))
        )
      ) {
        hit = true;
        break;
      }
    }
    if (hit) {
      return {
        rawMeshName,
        normalizedName,
        laterality,
        system,
        mapped: true,
        matchSource: 'exact-ta',
        anatomyId: entry.targetId,
        label: `${entry.label}${sideTag}`,
        category: entry.category,
        kind: entry.kind,
        linkedFlapIds: entry.linkedFlapIds,
        fjCode,
        fmaCode,
        groupId: logicalGroup?.groupId,
        groupLabel: logicalGroup?.groupLabel,
        partLabel: logicalGroup?.partLabel,
      };
    }
  }

  // 2b. If part of a logical group whose parent matches CANONICAL_TA_MAPPINGS (e.g., "spinal part of deltoid")
  if (logicalGroup) {
    const parentNorm = logicalGroup.groupLabel
      .toLowerCase()
      .replace(/\s+muscle$/i, '')
      .trim();
    const parentEntry = CANONICAL_TA_MAPPINGS.find((e) =>
      e.aliases.some((a) => a === parentNorm || parentNorm.includes(a))
    );
    if (parentEntry) {
      return {
        rawMeshName,
        normalizedName,
        laterality,
        system,
        mapped: true,
        matchSource: 'group-parent',
        anatomyId: parentEntry.targetId,
        label: `${parentEntry.label}${sideTag}`,
        category: parentEntry.category,
        kind: parentEntry.kind,
        linkedFlapIds: parentEntry.linkedFlapIds,
        fjCode,
        fmaCode,
        groupId: logicalGroup.groupId,
        groupLabel: logicalGroup.groupLabel,
        partLabel: logicalGroup.partLabel,
      };
    }
  }

  // 3. Dynamic lookup in vessels.json
  for (const v of ctx.vessels) {
    const vClean = parseTerminologiaMeshName(v.name).normalizedName;
    if (
      normalizedName &&
      vClean &&
      (normalizedName === vClean ||
        (vClean.length >= 8 && normalizedName.includes(vClean)) ||
        (normalizedName.length >= 8 && vClean.includes(normalizedName)))
    ) {
      return {
        rawMeshName,
        normalizedName,
        laterality,
        system,
        mapped: true,
        matchSource: 'vessel-record',
        anatomyId: v.id,
        label: `${v.name}${sideTag}`,
        category: v.category,
        kind: v.category === 'Nerve' ? 'nerve' : 'vessel',
        linkedFlapIds: v.supplied_flap_ids,
        fjCode,
        fmaCode,
        groupId: logicalGroup?.groupId,
        groupLabel: logicalGroup?.groupLabel,
        partLabel: logicalGroup?.partLabel,
      };
    }
  }

  // 4. Match against flap dominant pedicles
  if (
    normalizedName.length >= 8 &&
    (system === 'arteries' || system === 'veins' || system === 'nerves')
  ) {
    for (const f of ctx.flaps) {
      const pedicleNorm = parseTerminologiaMeshName(
        f.vascular_anatomy.dominant_pedicle.artery
      ).normalizedName;
      if (
        pedicleNorm.length >= 8 &&
        (pedicleNorm.includes(normalizedName) || normalizedName.includes(pedicleNorm))
      ) {
        return {
          rawMeshName,
          normalizedName,
          laterality,
          system,
          mapped: true,
          matchSource: 'flap-pedicle',
          anatomyId: f.id,
          label: `${displayLabel} → ${f.name}`,
          category: fallbackMeta.category,
          kind: 'flap',
          linkedFlapIds: [f.id],
          fjCode,
          fmaCode,
          groupId: logicalGroup?.groupId,
          groupLabel: logicalGroup?.groupLabel,
          partLabel: logicalGroup?.partLabel,
        };
      }
    }
  }

  // 5. Unmapped — preserve clean normalized name, FJ & FMA IDs for the Unmapped Meshes Report
  return {
    rawMeshName,
    normalizedName,
    laterality,
    system,
    mapped: false,
    matchSource: 'unmapped',
    anatomyId: fjCode || rawMeshName,
    label: displayLabel,
    category: fallbackMeta.category,
    kind: fallbackMeta.kind,
    linkedFlapIds: [],
    fjCode,
    fmaCode,
    groupId: logicalGroup?.groupId,
    groupLabel: logicalGroup?.groupLabel,
    partLabel: logicalGroup?.partLabel,
  };
}

/**
 * Generates a structured Unmapped Meshes & Coverage report across all loaded meshes
 * listing `fj`, raw `name`, normalized name, and `system`.
 */
export function buildMeshMappingReport(
  meshes: Array<{
    meshName: string;
    system: AnatomicalSystemId;
    fj?: string;
    fma?: string;
    side?: Laterality;
  }>,
  sourceLabel: string,
  ctx: AnatomyMapperContext
): MeshMappingReport {
  const mappedEntries: MappedMeshResult[] = [];
  const unmappedEntries: UnmappedMeshItem[] = [];
  const mappedBySystem: Record<string, { total: number; mapped: number; unmapped: number }> = {};

  for (const item of meshes) {
    const res = mapMeshNameToAnatomy(item.meshName, item.system, ctx, {
      fj: item.fj,
      fma: item.fma,
      side: item.side,
    });
    if (!mappedBySystem[item.system]) {
      mappedBySystem[item.system] = { total: 0, mapped: 0, unmapped: 0 };
    }
    mappedBySystem[item.system].total += 1;

    if (res.mapped) {
      mappedBySystem[item.system].mapped += 1;
      mappedEntries.push(res);
    } else {
      mappedBySystem[item.system].unmapped += 1;
      const tokens = res.normalizedName.split(' ').filter((t) => t.length >= 4);
      let suggestedTargetId: string | undefined;
      let suggestedLabel: string | undefined;
      if (tokens.length > 0) {
        for (const cand of CANONICAL_TA_MAPPINGS) {
          const candText = cand.aliases.join(' ');
          if (tokens.some((t) => candText.includes(t))) {
            suggestedTargetId = cand.targetId;
            suggestedLabel = cand.label;
            break;
          }
        }
      }
      unmappedEntries.push({
        meshName: item.meshName,
        normalizedName: res.normalizedName,
        system: item.system,
        laterality: res.laterality,
        fj: res.fjCode,
        fma: res.fmaCode,
        suggestedTargetId,
        suggestedLabel,
      });
    }
  }

  const totalMeshes = meshes.length;
  const mappedCount = mappedEntries.length;
  const unmappedCount = unmappedEntries.length;
  const coveragePct = totalMeshes > 0 ? Math.round((mappedCount / totalMeshes) * 100) : 0;

  return {
    generatedAtIso: new Date().toISOString(),
    sourceLabel,
    totalMeshes,
    mappedCount,
    unmappedCount,
    coveragePct,
    mappedBySystem,
    mappedEntries,
    unmappedEntries,
  };
}

/**
 * Returns all selectable target records (vessels, muscles, nerves, bones, flaps)
 * for the Unmapped Meshes Editor dropdown.
 */
export function listAvailableMappingTargets(
  vessels: VesselRecord[],
  flaps: FlapRecord[]
): Array<{ targetId: string; label: string; kind: AnatomyTargetKind; linkedFlapIds: string[] }> {
  const seen = new Set<string>();
  const out: Array<{
    targetId: string;
    label: string;
    kind: AnatomyTargetKind;
    linkedFlapIds: string[];
  }> = [];

  for (const v of vessels) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    out.push({
      targetId: v.id,
      label: `${v.name} (${v.category})`,
      kind: v.category === 'Nerve' ? 'nerve' : 'vessel',
      linkedFlapIds: v.supplied_flap_ids,
    });
  }

  for (const c of CANONICAL_TA_MAPPINGS) {
    if (seen.has(c.targetId)) continue;
    seen.add(c.targetId);
    out.push({
      targetId: c.targetId,
      label: `${c.label} (${c.category})`,
      kind: c.kind,
      linkedFlapIds: c.linkedFlapIds,
    });
  }

  for (const f of flaps) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push({
      targetId: f.id,
      label: `${f.name} (Flap)`,
      kind: 'flap',
      linkedFlapIds: [f.id],
    });
  }

  return out;
}
