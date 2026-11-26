import flapPedicleMapRaw from '../data/flapPedicleMap.json';
import type { FlapRecord } from '../types/schemas';
import type { Laterality } from './anatomyMap';
import { CameraFocusGoal, computeStructureFocusCamera } from './clippingAndSearch';
import type { MergedSubMeshRecord } from './glbLoader';
import type { AnatomicalSystemId } from './modelManifest';
import {
  DEFAULT_VESSEL_ALIGNMENT,
  transformSubMeshBoundsWithAlignment,
  VesselAlignmentTransform,
} from './vesselAlignment';

export type FlapVesselRole = 'pedicle' | 'vein' | 'source';
export type DonorSide = 'right' | 'left';

export const DEFAULT_DONOR_SIDE: DonorSide = 'right';
export const REAL_VESSEL_TAG_TEXT = 'Real mesh — BodyParts3D reference model';
export const SCHEMATIC_OVERLAY_TAG_TEXT = 'Schematic — not from source model';

export interface FlapPedicleMapEntry {
  role: FlapVesselRole;
  name: string;
  left?: string[];
  right?: string[];
  midline?: string[];
}

export interface FlapPedicleMapFile {
  flaps: Record<string, FlapPedicleMapEntry[]>;
  not_in_dataset: Record<string, string[]>;
}

export const FLAP_PEDICLE_MAP: FlapPedicleMapFile = flapPedicleMapRaw as FlapPedicleMapFile;

export interface ExpectedFlapVesselSpec {
  role: FlapVesselRole;
  name: string;
  fjCode: string;
  side: 'left' | 'right' | 'midline';
}

export interface ResolvedFlapVesselMatch {
  role: FlapVesselRole;
  /** Distinguishes primary pedicle (e.g. ALT descending branch FJ2057/FJ2063) from parent secondary pedicle (LCFA) */
  pedicleTier?: 'primary' | 'secondary';
  mapName: string;
  displayName: string;
  fjCode: string;
  fmaCode?: string;
  side: Laterality;
  system: AnatomicalSystemId;
  meshKey: string;
  meshName: string;
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  center: [number, number, number];
}

export interface UnionBounds3D {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
}

export type FlapVesselLinkStatus =
  | 'resolved'
  | 'partial'
  | 'not_in_dataset'
  | 'no_bp3d_loaded'
  | 'unmapped';

export interface ResolvedFlapVesselsResult {
  flapId: string;
  mapKey: string | null;
  donorSide: DonorSide;
  status: FlapVesselLinkStatus;
  resolvedVessels: ResolvedFlapVesselMatch[];
  unresolvedExpected: ExpectedFlapVesselSpec[];
  notInDatasetVessels: string[];
  notInDatasetNotice: string | null;
  hasResolvedPedicleArtery: boolean;
  hasResolvedVein: boolean;
  hasResolvedSource: boolean;
  unionBounds: UnionBounds3D | null;
}

export interface ResolveFlapVesselsOptions {
  vesselAlignment?: VesselAlignmentTransform;
  alignmentPivot?: [number, number, number];
  orientationRotatedY?: boolean;
}

export function isValidDonorSide(val: unknown): val is DonorSide {
  return val === 'right' || val === 'left';
}

/**
 * Deterministic flap name/synonym matcher against `src/data/flapPedicleMap.json`
 * (`flaps` and `not_in_dataset` keys). Honors an explicit `flap.real_vessel_map_key`
 * if already present and valid; otherwise matches strictly by flap name/synonyms
 * without mutating any clinical measurement or verification field.
 */
interface MapKeyRule {
  mapKey: string;
  patterns: RegExp[];
}

const MAPPED_FLAP_RULES: MapKeyRule[] = [
  {
    mapKey: 'ALT (anterolateral thigh)',
    patterns: [/\banterolateral thigh\b/i, /\balt\b/i],
  },
  {
    mapKey: 'DIEP / free TRAM',
    patterns: [/\bdiep\b/i, /\bdeep inferior epigastric perforator\b/i],
  },
  {
    mapKey: 'Pedicled TRAM / VRAM',
    patterns: [
      /\bpedicled tram\b/i,
      /\btransverse rectus abdominis\b/i,
      /\bvertical rectus abdominis\b/i,
      /\bvram\b/i,
    ],
  },
  {
    mapKey: 'SIEA',
    patterns: [/\bsiea\b/i, /\bsuperficial inferior epigastric\b/i],
  },
  {
    mapKey: 'Latissimus dorsi / TDAP',
    patterns: [/\blatissimus dorsi\b/i, /\btdap\b/i, /\bthoracodorsal artery perforator\b/i],
  },
  {
    mapKey: 'Scapular / parascapular',
    patterns: [/\bscapular\b/i, /\bparascapular\b/i, /\bcircumflex scapular\b/i],
  },
  {
    mapKey: 'Pectoralis major',
    patterns: [/\bpectoralis major\b/i, /\bpmmc\b/i, /\bpec major\b/i],
  },
  {
    mapKey: 'Internal mammary perforator (IMAP)',
    patterns: [
      /\binternal mammary perforator\b/i,
      /\bimap\b/i,
      /\bdeltopectoral\b/i,
      /\bbakamjian\b/i,
    ],
  },
  {
    mapKey: 'Radial forearm (RFFF)',
    patterns: [/\bradial forearm\b/i, /\brfff\b/i],
  },
  {
    mapKey: 'Ulnar artery flap',
    patterns: [/\bulnar artery\b/i, /\bulnar forearm\b/i, /\buaff\b/i],
  },
  {
    mapKey: 'Lateral arm',
    patterns: [/\blateral arm\b/i, /\bprca\b/i],
  },
  {
    mapKey: 'Posterior tibial / soleus region',
    patterns: [/\bposterior tibial\b/i, /\bptap\b/i, /\bsoleus\b/i, /\bhemisoleus\b/i],
  },
  {
    mapKey: 'Dorsalis pedis flap',
    patterns: [/\bdorsalis pedis\b/i],
  },
  {
    mapKey: 'Medial plantar (instep)',
    patterns: [/\bmedial plantar\b/i, /\binstep flap\b/i],
  },
  {
    mapKey: 'Trapezius (transverse cervical)',
    patterns: [/\btrapezius\b/i, /\btransverse cervical\b/i],
  },
  {
    mapKey: 'Omentum (gastro-epiploic)',
    patterns: [/\boment(?:al|um)\b/i, /\bgastro-?epiploic\b/i],
  },
  {
    mapKey: 'Great saphenous / venous grafts',
    patterns: [/\bgreat saphenous\b/i, /\bvenous graft/i, /\bsaphenous vein\b/i],
  },
  {
    mapKey: 'Genicular / popliteal region',
    patterns: [
      /\bgenicular\b/i,
      /\bmedial femoral condyle\b/i,
      /\bmfc\b/i,
      /\bpopliteal\b/i,
    ],
  },
];

const NOT_IN_DATASET_RULES: MapKeyRule[] = [
  {
    mapKey: 'SGAP / IGAP',
    patterns: [
      /\bsgap\b/i,
      /\bigap\b/i,
      /\bsuperior gluteal\b/i,
      /\binferior gluteal\b/i,
      /\bgluteus maximus\b/i,
      /\bgluteal rotation\b/i,
    ],
  },
  {
    mapKey: 'Pudendal thigh / Martius / TUG',
    patterns: [
      /\bpudendal thigh\b/i,
      /\bsingapore flap\b/i,
      /\bmartius\b/i,
      /\btug\b/i,
      /\btransverse upper gracilis\b/i,
    ],
  },
  {
    mapKey: 'Gracilis / medial femoral circumflex',
    patterns: [/\bgracilis\b/i, /\bprofunda artery perforator\b/i, /\bpap flap\b/i],
  },
  {
    mapKey: 'Fibula free flap / peroneal perforator',
    patterns: [/\bfibula\b/i, /\bperoneal\b/i, /\bperoneus brevis\b/i],
  },
  {
    mapKey: 'Gastrocnemius / sural flaps',
    patterns: [/\bgastrocnemius\b/i, /\bmsap\b/i, /\bmedial sural\b/i, /\breverse sural\b/i, /\bsural\b/i],
  },
  {
    mapKey: 'Groin flap / DCIA',
    patterns: [/\bgroin flap\b/i, /\bscia\b/i, /\bscip\b/i, /\bdcia\b/i, /\bdeep circumflex iliac\b/i],
  },
  {
    mapKey: 'Posterior interosseous artery flap',
    patterns: [/\bposterior interosseous\b/i, /\bpia flap\b/i],
  },
  {
    mapKey: 'Head & neck flaps (facial, submental, temporoparietal, paramedian forehead, FAMM)',
    patterns: [
      /\bfamm\b/i,
      /\bfacial artery\b/i,
      /\bsubmental\b/i,
      /\btemporoparietal\b/i,
      /\btpff\b/i,
      /\bparamedian forehead\b/i,
      /\bnasolabial\b/i,
      /\bmelolabial\b/i,
      /\babb[eé][–-]estlander\b/i,
      /\bkarapandzic\b/i,
      /\bcervicofacial\b/i,
      /\bsternocleidomastoid\b/i,
      /\bscm flap\b/i,
    ],
  },
  {
    mapKey: 'Jejunal flap',
    patterns: [/\bjejunal\b/i, /\bjejunum\b/i],
  },
];

export function isValidRealVesselMapKey(key: string | null | undefined): key is string {
  if (!key) return false;
  return (
    Object.prototype.hasOwnProperty.call(FLAP_PEDICLE_MAP.flaps, key) ||
    Object.prototype.hasOwnProperty.call(FLAP_PEDICLE_MAP.not_in_dataset, key)
  );
}

export function inferRealVesselMapKey(
  flap: Pick<FlapRecord, 'name' | 'synonyms' | 'real_vessel_map_key'>
): string | null {
  if (isValidRealVesselMapKey(flap.real_vessel_map_key)) {
    return flap.real_vessel_map_key;
  }

  const haystack = [flap.name, ...(flap.synonyms || [])].join(' | ');

  // Check exact map-key inclusion first
  for (const key of Object.keys(FLAP_PEDICLE_MAP.flaps)) {
    if (haystack.toLowerCase().includes(key.toLowerCase())) {
      return key;
    }
  }
  for (const key of Object.keys(FLAP_PEDICLE_MAP.not_in_dataset)) {
    if (haystack.toLowerCase().includes(key.toLowerCase())) {
      return key;
    }
  }

  // Check not_in_dataset rules that are more specific (e.g., TUG before generic Gracilis)
  // and mapped flap rules
  for (const rule of MAPPED_FLAP_RULES) {
    if (rule.patterns.some((re) => re.test(haystack))) {
      return rule.mapKey;
    }
  }
  for (const rule of NOT_IN_DATASET_RULES) {
    if (rule.patterns.some((re) => re.test(haystack))) {
      return rule.mapKey;
    }
  }

  return null;
}

export function formatNotInDatasetNotice(vessels: string[]): string {
  return `No reference mesh for: ${vessels.join(', ')} — schematic only`;
}

/**
 * Expands a `flapPedicleMap.json` flap entry for the requested donor side (`right` | `left`),
 * always including `midline` entries on BOTH sides.
 */
export function getExpectedFjSpecsForMapKey(
  mapKey: string,
  donorSide: DonorSide
): ExpectedFlapVesselSpec[] {
  const entries = FLAP_PEDICLE_MAP.flaps[mapKey];
  if (!entries) return [];

  const specs: ExpectedFlapVesselSpec[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const sideCodes = entry[donorSide] || [];
    for (const rawCode of sideCodes) {
      const code = rawCode.trim().toUpperCase();
      if (!code) continue;
      const dedup = `${entry.role}:${code}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      specs.push({
        role: entry.role,
        name: entry.name,
        fjCode: code,
        side: donorSide,
      });
    }

    const midlineCodes = entry.midline || [];
    for (const rawCode of midlineCodes) {
      const code = rawCode.trim().toUpperCase();
      if (!code) continue;
      const dedup = `${entry.role}:${code}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      specs.push({
        role: entry.role,
        name: entry.name,
        fjCode: code,
        side: 'midline',
      });
    }
  }

  return specs;
}

function extractFjCodeFromSubMesh(sub: MergedSubMeshRecord): string | null {
  if (sub.fjCode && sub.fjCode.trim()) {
    return sub.fjCode.trim().toUpperCase();
  }
  const match = sub.meshName.match(/\[(FJ[A-Za-z0-9_-]+)\]/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Resolves a flap record against loaded BodyParts3D vessel sub-meshes strictly by
 * `extras.fj` (`sub.fjCode`) for the selected donor side (`right` | `left`).
 */
export function resolveFlapRealVessels(
  flap: Pick<FlapRecord, 'id' | 'name' | 'synonyms' | 'real_vessel_map_key'>,
  donorSide: DonorSide,
  loadedSubMeshes: MergedSubMeshRecord[],
  options?: ResolveFlapVesselsOptions
): ResolvedFlapVesselsResult {
  const mapKey = inferRealVesselMapKey(flap);

  if (!mapKey) {
    return {
      flapId: flap.id,
      mapKey: null,
      donorSide,
      status: 'unmapped',
      resolvedVessels: [],
      unresolvedExpected: [],
      notInDatasetVessels: [],
      notInDatasetNotice: null,
      hasResolvedPedicleArtery: false,
      hasResolvedVein: false,
      hasResolvedSource: false,
      unionBounds: null,
    };
  }

  // Case 1: Explicitly in not_in_dataset
  if (Object.prototype.hasOwnProperty.call(FLAP_PEDICLE_MAP.not_in_dataset, mapKey)) {
    const missing = FLAP_PEDICLE_MAP.not_in_dataset[mapKey] || [];
    return {
      flapId: flap.id,
      mapKey,
      donorSide,
      status: 'not_in_dataset',
      resolvedVessels: [],
      unresolvedExpected: [],
      notInDatasetVessels: missing,
      notInDatasetNotice: formatNotInDatasetNotice(missing),
      hasResolvedPedicleArtery: false,
      hasResolvedVein: false,
      hasResolvedSource: false,
      unionBounds: null,
    };
  }

  // Case 2: Mapped in FLAP_PEDICLE_MAP.flaps
  const expected = getExpectedFjSpecsForMapKey(mapKey, donorSide);

  // Build index of loaded BodyParts3D vessel sub-meshes keyed by uppercase FJ code
  const byFj = new Map<string, MergedSubMeshRecord>();
  let bp3dVesselCount = 0;
  for (const sub of loadedSubMeshes) {
    if (sub.system !== 'arteries' && sub.system !== 'veins') continue;
    const fj = extractFjCodeFromSubMesh(sub);
    if (!fj) continue;
    bp3dVesselCount += 1;
    if (!byFj.has(fj)) {
      byFj.set(fj, sub);
    }
  }

  if (bp3dVesselCount === 0) {
    return {
      flapId: flap.id,
      mapKey,
      donorSide,
      status: 'no_bp3d_loaded',
      resolvedVessels: [],
      unresolvedExpected: expected,
      notInDatasetVessels: [],
      notInDatasetNotice: null,
      hasResolvedPedicleArtery: false,
      hasResolvedVein: false,
      hasResolvedSource: false,
      unionBounds: null,
    };
  }

  const alignment = options?.vesselAlignment || DEFAULT_VESSEL_ALIGNMENT;
  const pivot = options?.alignmentPivot || ([0, 0.85, 0] as [number, number, number]);
  const rotatedY = Boolean(options?.orientationRotatedY);

  const resolvedVessels: ResolvedFlapVesselMatch[] = [];
  const unresolvedExpected: ExpectedFlapVesselSpec[] = [];

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const spec of expected) {
    const matchedSub = byFj.get(spec.fjCode);
    if (!matchedSub) {
      unresolvedExpected.push(spec);
      continue;
    }

    const wb = transformSubMeshBoundsWithAlignment(matchedSub, alignment, pivot, rotatedY);
    minX = Math.min(minX, wb.boundsMin[0]);
    minY = Math.min(minY, wb.boundsMin[1]);
    minZ = Math.min(minZ, wb.boundsMin[2]);
    maxX = Math.max(maxX, wb.boundsMax[0]);
    maxY = Math.max(maxY, wb.boundsMax[1]);
    maxZ = Math.max(maxZ, wb.boundsMax[2]);

    let pedicleTier: 'primary' | 'secondary' | undefined;
    if (spec.role === 'pedicle') {
      if (mapKey === 'ALT (anterolateral thigh)') {
        pedicleTier =
          spec.fjCode === 'FJ2057' || spec.fjCode === 'FJ2063' ? 'primary' : 'secondary';
      } else {
        const alreadyHasPrimary = resolvedVessels.some(
          (rv) => rv.role === 'pedicle' && rv.pedicleTier === 'primary'
        );
        pedicleTier = alreadyHasPrimary ? 'secondary' : 'primary';
      }
    }

    resolvedVessels.push({
      role: spec.role,
      pedicleTier,
      mapName: spec.name,
      displayName: matchedSub.label || spec.name,
      fjCode: spec.fjCode,
      fmaCode: matchedSub.fmaCode,
      side: matchedSub.laterality,
      system: matchedSub.system,
      meshKey: matchedSub.meshKey,
      meshName: matchedSub.meshName,
      boundsMin: wb.boundsMin,
      boundsMax: wb.boundsMax,
      center: wb.center,
    });
  }

  const unionBounds: UnionBounds3D | null =
    resolvedVessels.length > 0 && Number.isFinite(minX)
      ? {
          min: [Number(minX.toFixed(4)), Number(minY.toFixed(4)), Number(minZ.toFixed(4))],
          max: [Number(maxX.toFixed(4)), Number(maxY.toFixed(4)), Number(maxZ.toFixed(4))],
          center: [
            Number(((minX + maxX) * 0.5).toFixed(4)),
            Number(((minY + maxY) * 0.5).toFixed(4)),
            Number(((minZ + maxZ) * 0.5).toFixed(4)),
          ],
        }
      : null;

  const hasResolvedPedicleArtery = resolvedVessels.some((v) => v.role === 'pedicle');
  const hasResolvedVein = resolvedVessels.some((v) => v.role === 'vein');
  const hasResolvedSource = resolvedVessels.some((v) => v.role === 'source');

  const status: FlapVesselLinkStatus =
    resolvedVessels.length === 0
      ? 'no_bp3d_loaded'
      : unresolvedExpected.length === 0
        ? 'resolved'
        : 'partial';

  return {
    flapId: flap.id,
    mapKey,
    donorSide,
    status,
    resolvedVessels,
    unresolvedExpected,
    notInDatasetVessels: [],
    notInDatasetNotice: null,
    hasResolvedPedicleArtery,
    hasResolvedVein,
    hasResolvedSource,
    unionBounds,
  };
}

/**
 * Computes a clean surgical camera focus framing the union bounding box of a flap's
 * resolved real BodyParts3D vessel meshes.
 */
export function computeFlapVesselUnionCamera(
  unionBounds: UnionBounds3D,
  donorSide: DonorSide
): CameraFocusGoal {
  const base = computeStructureFocusCamera(unionBounds.min, unionBounds.max, unionBounds.center);
  // Nudge slight 3/4 lateral perspective toward the selected donor side when vessels sit near midline
  if (Math.abs(unionBounds.center[0]) < 0.05) {
    const sideSign = donorSide === 'left' ? 1 : -1;
    const dx = base.pos[0] - base.target[0];
    const dz = base.pos[2] - base.target[2];
    const horizDist = Math.hypot(dx, dz);
    const shiftedX = base.target[0] + sideSign * horizDist * 0.22;
    return {
      pos: [Number(shiftedX.toFixed(4)), base.pos[1], base.pos[2]],
      target: base.target,
    };
  }
  return base;
}

/**
 * Visual color & emphasis specs per Sub-Phase 9d:
 * - role "pedicle": bright red (artery) with outline and pulse
 * - role "vein":    bright blue
 * - role "source":  medium red
 */
export interface FlapVesselRoleStyle {
  colorHex: number;
  emissiveHex: number;
  baseEmissiveIntensity: number;
  outlineColorHex: number | null;
  pulse: boolean;
  label: string;
}

export function getFlapVesselRoleStyle(
  role: FlapVesselRole,
  colorblindMode = false
): FlapVesselRoleStyle {
  if (role === 'pedicle') {
    return colorblindMode
      ? {
          colorHex: 0xff5a1f,
          emissiveHex: 0xff3b00,
          baseEmissiveIntensity: 0.58,
          outlineColorHex: 0xfde047,
          pulse: true,
          label: 'Pedicle',
        }
      : {
          colorHex: 0xff1e32,
          emissiveHex: 0xef1028,
          baseEmissiveIntensity: 0.55,
          outlineColorHex: 0xff8088,
          pulse: true,
          label: 'Pedicle',
        };
  }
  if (role === 'vein') {
    return colorblindMode
      ? {
          colorHex: 0x0ea5e9,
          emissiveHex: 0x0284c7,
          baseEmissiveIntensity: 0.42,
          outlineColorHex: 0x7dd3fc,
          pulse: false,
          label: 'Vein',
        }
      : {
          colorHex: 0x2563eb,
          emissiveHex: 0x1d4ed8,
          baseEmissiveIntensity: 0.42,
          outlineColorHex: 0x93c5fd,
          pulse: false,
          label: 'Vein',
        };
  }
  // role === 'source'
  return colorblindMode
    ? {
        colorHex: 0xd97706,
        emissiveHex: 0xb45309,
        baseEmissiveIntensity: 0.28,
        outlineColorHex: null,
        pulse: false,
        label: 'Source',
      }
    : {
        colorHex: 0xc8323c,
        emissiveHex: 0x991b1b,
        baseEmissiveIntensity: 0.28,
        outlineColorHex: null,
        pulse: false,
        label: 'Source',
      };
}
