import type { AnatomicalSystemId } from './modelManifest';
import type { Laterality } from './anatomyMap';

export type ClippingAxis = 'axial' | 'sagittal' | 'coronal';

export interface ClippingAxisState {
  enabled: boolean;
  /** Normalized 0..100 slider position along the anatomical axis */
  position: number;
  /** Flip which half of the anatomy is clipped away */
  inverted: boolean;
}

export type ClippingPlanesConfig = Record<ClippingAxis, ClippingAxisState>;

export const DEFAULT_CLIPPING_PLANES: ClippingPlanesConfig = {
  axial: { enabled: false, position: 55, inverted: false },
  sagittal: { enabled: false, position: 50, inverted: false },
  coronal: { enabled: false, position: 50, inverted: false },
};

export interface AnatomicalBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_BODY_BOUNDS: AnatomicalBounds = {
  minX: -0.44,
  maxX: 0.44,
  minY: 0.0,
  maxY: 1.76,
  minZ: -0.22,
  maxZ: 0.22,
};

export interface ClippingPlaneSpec {
  axis: ClippingAxis;
  normal: [number, number, number];
  /** Three.js Plane constant `d` where kept points satisfy dot(normal, p) + constant >= 0 */
  constant: number;
  /** World-space coordinate along the axis in meters */
  worldCoordMeters: number;
  /** Human-readable clinical slice position */
  readoutLabel: string;
}

/**
 * Computes the Three.js clipping plane `(normal, constant)` for an anatomical axis
 * given a 0..100 slider position, inversion flag, and body bounding box in meters.
 *
 * Conventions (Y-up, Anterior = +Z, Patient Left = +X):
 * - Axial (Y):    default clips superior tissue above `y`, keeping inferior tissue (`normal = [0, -1, 0]`).
 * - Sagittal (X): default clips patient-left (`x > xCut`), keeping patient-right (`normal = [-1, 0, 0]`).
 * - Coronal (Z):  default clips anterior tissue (`z > zCut`), revealing deep posterior anatomy (`normal = [0, 0, -1]`).
 */
export function computeClippingPlaneParams(
  axis: ClippingAxis,
  state: ClippingAxisState,
  bounds: AnatomicalBounds = DEFAULT_BODY_BOUNDS
): ClippingPlaneSpec {
  const t = Math.max(0, Math.min(100, state.position)) / 100;
  const sign = state.inverted ? 1 : -1;

  if (axis === 'axial') {
    const y = bounds.minY + t * (bounds.maxY - bounds.minY);
    const cm = Math.round(y * 100);
    return {
      axis,
      normal: [0, sign, 0],
      constant: -sign * y,
      worldCoordMeters: Number(y.toFixed(4)),
      readoutLabel: `${cm} cm`,
    };
  }

  if (axis === 'sagittal') {
    const x = bounds.minX + t * (bounds.maxX - bounds.minX);
    const cm = Math.round(x * 100);
    const dirTag = cm > 0 ? `+${cm} cm (L)` : cm < 0 ? `${cm} cm (R)` : 'Midline';
    return {
      axis,
      normal: [sign, 0, 0],
      constant: -sign * x,
      worldCoordMeters: Number(x.toFixed(4)),
      readoutLabel: dirTag,
    };
  }

  const z = bounds.minZ + t * (bounds.maxZ - bounds.minZ);
  const cm = Math.round(z * 100);
  const dirTag = cm > 0 ? `+${cm} cm (Ant)` : cm < 0 ? `${cm} cm (Post)` : 'Mid-coronal';
  return {
    axis,
    normal: [0, 0, sign],
    constant: -sign * z,
    worldCoordMeters: Number(z.toFixed(4)),
    readoutLabel: dirTag,
  };
}

export interface SearchableAnatomyStructure {
  key: string;
  anatomyId: string;
  meshName: string;
  label: string;
  category: string;
  system: AnatomicalSystemId;
  laterality: Laterality;
  mapped: boolean;
  linkedFlapIds: string[];
  center: [number, number, number];
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  subMeshIndex?: number;
  materialBucket?: string;
  sourceModel?: 'z-anatomy' | 'bodyparts3d';
  fjCode?: string;
  fmaCode?: string;
  groupId?: string;
  groupLabel?: string;
  partLabel?: string;
}

const SEARCH_ALIAS_PAIRS: Array<[string, string]> = [
  ['fibularis', 'peroneus'],
  ['fibular', 'peroneal'],
  ['internal thoracic', 'internal mammary'],
  ['iliotibial tract', 'tensor fasciae latae'],
  ['pec major', 'pectoralis major'],
  ['pec minor', 'pectoralis minor'],
  ['quadriceps', 'vastus lateralis rectus femoris vastus medialis vastus intermedius'],
  ['lcfa', 'lateral circumflex femoral artery'],
  ['diea', 'inferior epigastric artery'],
  ['siea', 'superficial epigastric artery'],
];

function expandSearchHaystackWithAliases(base: string): string {
  let out = base;
  for (const [a, b] of SEARCH_ALIAS_PAIRS) {
    if (out.includes(a) && !out.includes(b)) out += ` ${b}`;
    else if (out.includes(b) && !out.includes(a)) out += ` ${a}`;
  }
  return out;
}

/**
 * Ranks searchable 3D anatomical structures against a clinical query (supports FMA/TA
 * names, bidirectional aliases, logical muscle groups, FMA IDs, FJ IDs, and laterality).
 */
export function searchAnatomyStructures(
  structures: SearchableAnatomyStructure[],
  rawQuery: string,
  limit = 12
): SearchableAnatomyStructure[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return structures.filter((s) => s.mapped).slice(0, limit);
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: Array<{ item: SearchableAnatomyStructure; score: number }> = [];

  for (let i = 0; i < structures.length; i++) {
    const item = structures[i];
    const labelLower = item.label.toLowerCase();
    const meshLower = item.meshName.toLowerCase();
    const groupLower = (item.groupLabel || '').toLowerCase();
    const fjLower = (item.fjCode || '').toLowerCase();
    const fmaLower = (item.fmaCode || '').toLowerCase();
    const sideWord =
      item.laterality === 'left' ? 'left l' : item.laterality === 'right' ? 'right r' : 'midline';
    const haystack = expandSearchHaystackWithAliases(
      `${labelLower} ${meshLower} ${groupLower} ${fjLower} ${fmaLower} ${item.system} ${item.category.toLowerCase()} ${sideWord}`
    );

    let allMatch = true;
    for (let t = 0; t < tokens.length; t++) {
      if (!haystack.includes(tokens[t])) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) continue;

    let score = 0;
    if (fjLower && fjLower === q) {
      score += 200;
    } else if (fmaLower && fmaLower === q) {
      score += 190;
    } else if (groupLower && (groupLower === q || groupLower === `${q} muscle`)) {
      score += 145;
    } else if (labelLower === q || meshLower === q) {
      score += 130;
    } else if (groupLower && groupLower.startsWith(q)) {
      score += 95;
    } else if (labelLower.startsWith(q)) {
      score += 85;
    } else if (meshLower.startsWith(q)) {
      score += 75;
    } else if (labelLower.includes(q) || groupLower.includes(q)) {
      score += 50;
    } else {
      score += 22;
    }

    if (/\.(o|e)\d*(r|l)?$/i.test(item.meshName)) {
      score -= 18;
    }
    if (item.mapped) {
      score += 12;
    }
    score -= Math.min(15, item.label.length * 0.15);

    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
  return scored.slice(0, limit).map((s) => s.item);
}

export interface CameraFocusGoal {
  pos: [number, number, number];
  target: [number, number, number];
}

/**
 * Computes a clean surgical camera fly-to target and position framing a 3D structure's
 * world bounding box. Automatically orbits to the posterior (-Z) view when the structure
 * lies posteriorly (e.g., latissimus dorsi, scapula, gastrocnemius, gluteus maximus)
 * or anterior (+Z) view for anterior structures.
 */
export function computeStructureFocusCamera(
  boundsMin: [number, number, number],
  boundsMax: [number, number, number],
  centerHint?: [number, number, number]
): CameraFocusGoal {
  const cx = centerHint ? centerHint[0] : (boundsMin[0] + boundsMax[0]) * 0.5;
  const cy = centerHint ? centerHint[1] : (boundsMin[1] + boundsMax[1]) * 0.5;
  const cz = centerHint ? centerHint[2] : (boundsMin[2] + boundsMax[2]) * 0.5;

  const dx = Math.max(0.02, boundsMax[0] - boundsMin[0]);
  const dy = Math.max(0.02, boundsMax[1] - boundsMin[1]);
  const dz = Math.max(0.02, boundsMax[2] - boundsMin[2]);
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.5;

  // Frame comfortably inside 38° FOV camera (clamped to crisp surgical zoom range)
  const distance = Math.max(0.46, Math.min(1.55, radius * 2.85 + 0.32));

  // Automatically pick Anterior (+Z) vs Posterior (-Z) vantage so structure isn't occluded by torso
  const viewZSign = cz < -0.025 ? -1 : 1;
  // Slight lateral offset matching structure's X side for natural 3/4 surgical angle
  const lateralBias = Math.abs(cx) > 0.06 ? Math.sign(cx) * 0.28 : 0.12;
  const dirLen = Math.hypot(lateralBias, 0.14, viewZSign);

  const px = cx + (lateralBias / dirLen) * distance;
  const py = Math.max(0.18, cy + (0.14 / dirLen) * distance);
  const pz = cz + (viewZSign / dirLen) * distance;

  return {
    pos: [Number(px.toFixed(4)), Number(py.toFixed(4)), Number(pz.toFixed(4))],
    target: [Number(cx.toFixed(4)), Number(cy.toFixed(4)), Number(cz.toFixed(4))],
  };
}
