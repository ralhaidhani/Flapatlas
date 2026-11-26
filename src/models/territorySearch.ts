import {
  BODY_ANGIOSOME_BY_ID,
  BODY_ANGIOSOMES,
  FIG_23_51_PERFORATOR_CODES,
  HEAD_NECK_ANGIOSOME_BY_ID,
  HEAD_NECK_ANGIOSOMES,
  HEAD_NECK_CLINICAL_NOTES,
  headNeckMuscleTerritories,
  LEG_AND_FOREARM_TERRITORY_NOTES,
  MUSCLE_TERRITORIES,
  type AngiosomeBp3dArtery,
  type BodyAngiosomeRecord,
  type Bp3dCoverage,
  type HeadNeckAngiosomeRecord,
  type NeurovascularType,
  type TerritoryRegionFamily,
  type TerritorySourceRef,
} from '../data/territories/index';
import type { FlapRecord } from '../types/schemas';
import {
  FIELD_FLAG_INSIDE,
  FIELD_FLAG_SIDE_LEFT,
  FIELD_FLAG_SIDE_RIGHT,
  type TerritoryFieldData,
} from './territoryFieldCore';
import { TERRITORY_SLOT_BY_ID, TERRITORY_SLOT_BY_INDEX } from './territoryPalette';

export type TerritoryMode = 'off' | 'angiosomes' | 'perforators' | 'venosomes' | 'choke_delay';
export type TerritorySideFilter = 'both' | 'right' | 'left';
export type TerritoryCoverageLabel = 'Real mesh' | 'Partial mesh' | 'Schematic only';

export interface TerritorySearchItem {
  key: string;
  kind: 'body_angiosome' | 'head_neck_angiosome' | 'perforator_code';
  /** Canonical territoryId in TERRITORY_SLOT_BY_ID (e.g. 'angio-34' or 'hn-11') */
  territoryId: string;
  title: string;
  code: string;
  subtitle: string;
  regionFamily: TerritoryRegionFamily;
  coverageLabel: TerritoryCoverageLabel;
  isSchematic: boolean;
  sourceRef: TerritorySourceRef;
}

export interface TerritoryNeighborSummary {
  slotId: number;
  territoryId: string;
  label: string;
  shortLabel: string;
  hexStandard: string;
  hexColorblind: string;
  isSchematic: boolean;
}

export interface TerritoryMuscleSummary {
  id: string;
  name: string;
  territoryCountLabel: string;
  neurovascularType?: NeurovascularType;
  presentInBp3d: boolean;
  sourcePage: string;
}

export interface TerritoryDetailModel {
  territoryId: string;
  slotId: number;
  displayNumber: string;
  headNeckNumber?: number;
  name: string;
  abbr: string;
  regionFamily: TerritoryRegionFamily;
  bp3dCoverage: Bp3dCoverage;
  coverageLabel: TerritoryCoverageLabel;
  isSchematic: boolean;
  isDeepOnly: boolean;
  reachesSkin: boolean;
  crossesMidline: boolean;
  sharedMeshNote?: string;
  bp3dArteries: AngiosomeBp3dArtery[];
  schematicHint?: string;
  note: string;
  tissuesSpanned: string[];
  muscles: TerritoryMuscleSummary[];
  neighbors: TerritoryNeighborSummary[];
  neighborClinicalNote: string;
  linkedFlaps: Array<{ id: string; name: string; region: string }>;
  clinicalNotes: Array<{ id: string; title: string; summary: string; page: string }>;
  sourceRef: TerritorySourceRef;
  hexStandard: string;
  hexColorblind: string;
}

export interface TerritoryFocusBounds {
  center: [number, number, number];
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  voxelCount: number;
}

export const CHOKES_AND_TRUE_ANASTOMOSES_STATEMENT =
  'Adjacent territories are linked by reduced-caliber choke vessels or true anastomoses (true anastomoses occur variably, most commonly along cutaneous nerves or where skin is mobile; Morris & Taylor, Neligan Vol. 1, Ch. 23, p. 331).';

export const TERRITORY_EDUCATIONAL_DISCLAIMER =
  'Territories are schematic approximations on a reference male body. Individual perforator anatomy varies; confirm with Doppler/CTA before surgery.';

export function formatCoverageBadgeLabel(coverage: Bp3dCoverage): TerritoryCoverageLabel {
  if (coverage === 'full') return 'Real mesh';
  if (coverage === 'partial') return 'Partial mesh';
  return 'Schematic only';
}

/**
 * Curated flap-to-angiosome seed map aligned with Neligan Ch. 23 & Phase 11 §8.
 * Strictly read-only cross-reference — never modifies any flap measurement.
 */
const ANGIOSOME_TO_FLAP_IDS: Record<string, string[]> = {
  'angio-1': ['scm-flap'],
  'angio-2': [
    'famm-flap',
    'nasolabial-flap',
    'abbe-estlander-flap',
    'submental-island-flap',
    'cervicofacial-flap',
  ],
  'angio-3': ['temporalis-muscle-flap'],
  'angio-4': ['paramedian-forehead-flap'],
  'angio-5': ['tpff-flap'],
  'angio-6': ['scm-flap'],
  'angio-8': ['trapezius-flap', 'cervicofacial-flap'],
  'angio-9': ['pec-major-flap'],
  'angio-12': ['scapular-flap'],
  'angio-13': ['lateral-arm-flap'],
  'angio-15': ['ulnar-forearm-flap'],
  'angio-16': ['rfff-flap'],
  'angio-17': ['external-oblique-flap', 'paraspinous-flap'],
  'angio-18': ['lap-flap', 'paraspinous-flap'],
  'angio-19': ['sgap-flap', 'gluteal-rotation-flap'],
  'angio-20': ['igap-flap', 'gluteal-rotation-flap'],
  'angio-21': ['pap-flap', 'gracilis-flap', 'tug-flap'],
  'angio-22a': ['mfc-flap'],
  'angio-23': ['gastrocnemius-flap', 'msap-flap', 'reverse-sural-flap'],
  'angio-24': ['fibula-flap', 'peroneal-perforator-flap', 'peroneus-brevis-flap', 'soleus-flap'],
  'angio-26': ['toe-to-hand-flap'],
  'angio-27': ['alt-flap', 'tfl-flap', 'rectus-femoris-flap', 'amt-flap'],
  'angio-29': ['medial-plantar-flap'],
  'angio-30': ['ptap-flap', 'soleus-flap'],
  'angio-31': ['amt-flap'],
  'angio-32': ['siea-flap', 'groin-flap'],
  'angio-33': ['dcia-flap', 'groin-flap', 'external-oblique-flap'],
  'angio-34': ['diep-flap', 'tram-flap', 'vram-flap', 'siea-flap'],
  'angio-35': ['deltopectoral-flap', 'tram-flap', 'vram-flap'],
  'angio-36': ['pec-major-flap'],
  'angio-37': ['ld-flap', 'tdap-flap', 'serratus-anterior-flap'],
  'angio-38': ['pia-flap'],
  'angio-40': ['pudendal-thigh-flap', 'martius-flap'],
  'hn-1': ['temporalis-muscle-flap'],
  'hn-2': ['famm-flap', 'nasolabial-flap', 'abbe-estlander-flap', 'submental-island-flap'],
  'hn-3': ['paramedian-forehead-flap'],
  'hn-4': ['tpff-flap'],
  'hn-6': ['scm-flap'],
  'hn-7': ['trapezius-flap'],
  'hn-10': ['scm-flap'],
};

export function findFlapsForTerritory(
  territoryId: string,
  flaps: readonly FlapRecord[]
): Array<{ id: string; name: string; region: string }> {
  const flapById = new Map(flaps.map((f) => [f.id, f]));
  const ids = new Set<string>(ANGIOSOME_TO_FLAP_IDS[territoryId] || []);

  // Also link via bodyAngiosomeId if this is a Head & Neck territory
  const hn = HEAD_NECK_ANGIOSOME_BY_ID.get(territoryId);
  if (hn?.bodyAngiosomeId) {
    for (const id of ANGIOSOME_TO_FLAP_IDS[hn.bodyAngiosomeId] || []) {
      ids.add(id);
    }
  }

  const out: Array<{ id: string; name: string; region: string }> = [];
  for (const id of ids) {
    const f = flapById.get(id);
    if (f) {
      out.push({ id: f.id, name: f.name, region: f.region });
    }
  }
  return out;
}

/**
 * Returns the exact BP3D `extras.fj` code set for a territory's source arteries,
 * respecting the active Left / Right / Both side filter (never inferring side from string names).
 */
export function getTerritorySourceArteryFjs(
  territoryId: string,
  sideFilter: TerritorySideFilter = 'both'
): Set<string> {
  const body = BODY_ANGIOSOME_BY_ID.get(territoryId);
  const hn = HEAD_NECK_ANGIOSOME_BY_ID.get(territoryId);
  const arteries: AngiosomeBp3dArtery[] = body?.bp3dArteries ?? hn?.bp3dArteries ?? [];

  const result = new Set<string>();
  for (const art of arteries) {
    if (sideFilter === 'both' || sideFilter === 'left') {
      for (const fj of art.left) result.add(fj);
    }
    if (sideFilter === 'both' || sideFilter === 'right') {
      for (const fj of art.right) result.add(fj);
    }
    for (const fj of art.midline) result.add(fj);
  }
  return result;
}

/**
 * Computes world-space bounding box & centroid for a territory slot in the baked 3D field.
 * Uses stride-2 scanning (~250k ops, < 1.5 ms) for instant camera framing.
 */
export function computeTerritoryFocusBounds(
  field: TerritoryFieldData | null,
  slotId: number,
  sideFilter: TerritorySideFilter = 'both'
): TerritoryFocusBounds | null {
  if (!field || slotId < 1) return null;
  const [nx, ny, nz] = field.dims;
  const vs = field.voxelSizeMeters;
  const [minX, minY, minZ] = field.boundsMin;

  let bMinX = Infinity;
  let bMinY = Infinity;
  let bMinZ = Infinity;
  let bMaxX = -Infinity;
  let bMaxY = -Infinity;
  let bMaxZ = -Infinity;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let count = 0;

  const scan = (stride: number) => {
    for (let iz = 0; iz < nz; iz += stride) {
      const wz = minZ + (iz + 0.5) * vs;
      const zOff = iz * ny * nx;
      for (let iy = 0; iy < ny; iy += stride) {
        const wy = minY + (iy + 0.5) * vs;
        const yOff = zOff + iy * nx;
        for (let ix = 0; ix < nx; ix += stride) {
          const base = (yOff + ix) * 4;
          const slot = field.voxels[base];
          if (slot !== slotId) continue;
          const flags = field.voxels[base + 3];
          if ((flags & FIELD_FLAG_INSIDE) === 0) continue;
          if (sideFilter === 'right' && (flags & FIELD_FLAG_SIDE_RIGHT) === 0) continue;
          if (sideFilter === 'left' && (flags & FIELD_FLAG_SIDE_LEFT) === 0) continue;

          const wx = minX + (ix + 0.5) * vs;
          if (wx < bMinX) bMinX = wx;
          if (wy < bMinY) bMinY = wy;
          if (wz < bMinZ) bMinZ = wz;
          if (wx > bMaxX) bMaxX = wx;
          if (wy > bMaxY) bMaxY = wy;
          if (wz > bMaxZ) bMaxZ = wz;
          sumX += wx;
          sumY += wy;
          sumZ += wz;
          count++;
        }
      }
    }
  };

  scan(2);
  if (count === 0) {
    scan(1);
  }
  if (count === 0) return null;

  return {
    center: [sumX / count, sumY / count, sumZ / count],
    boundsMin: [bMinX, bMinY, bMinZ],
    boundsMax: [bMaxX, bMaxY, bMaxZ],
    voxelCount: count,
  };
}

/**
 * Pure helper mapping Tissue Depth slider (0 = Skin, 50 = Deep Muscle, 100 = Bone)
 * into clean, deterministic anatomical layer visibilities & opacities for Territory Mode.
 */
export function computeTerritoryDepthLayerPatch(
  depth: number,
  mode: Exclude<TerritoryMode, 'off'>,
  hasFocusedTerritory: boolean
): {
  skin: { visible: boolean; opacity: number };
  muscle: { visible: boolean; opacity: number };
  skeleton: { visible: boolean; opacity: number };
  organs: { visible: boolean; opacity: number };
  arteries: { visible: boolean; opacity: number };
  veins: { visible: boolean; opacity: number };
  nerves: { visible: boolean; opacity: number };
  perforators: { visible: boolean; opacity: number };
  perforasomes: { visible: boolean; opacity: number };
  angiosomes: { visible: boolean; opacity: number };
  landmarks: { visible: boolean; opacity: number };
  cuttingGuides: { visible: boolean; opacity: number };
} {
  const d = Math.max(0, Math.min(100, depth));

  // Skin dominates 0..38, fades smoothly 38..56, hidden beyond 56
  let skinVisible = d < 56;
  let skinOpacity = 0.86;
  if (d <= 30) {
    skinOpacity = 0.86 - (d / 30) * 0.16; // 0.86 -> 0.70
  } else if (d < 56) {
    skinOpacity = Math.max(0.12, 0.7 - ((d - 30) / 26) * 0.58);
  } else {
    skinOpacity = 0.08;
    skinVisible = false;
  }

  // Muscle: ghosted in Skin view (unless territory focused), full in Deep Muscle (35..75), peels away 75..94
  let muscleVisible = d < 94;
  let muscleOpacity = hasFocusedTerritory ? 0.34 : 0.18;
  if (d <= 28) {
    const base = hasFocusedTerritory ? 0.34 : 0.18;
    muscleOpacity = base + (d / 28) * (0.68 - base);
  } else if (d <= 72) {
    muscleOpacity = 0.92;
  } else if (d < 94) {
    muscleOpacity = Math.max(0.14, 0.92 - ((d - 72) / 22) * 0.78);
  } else {
    muscleOpacity = 0.1;
    muscleVisible = false;
  }

  // Skeleton: subtle reference in Skin view, ramps up to crisp solid in Bone view (70..100)
  let skeletonOpacity = hasFocusedTerritory ? 0.38 : 0.22;
  if (d <= 50) {
    const base = hasFocusedTerritory ? 0.38 : 0.22;
    skeletonOpacity = base + (d / 50) * (0.62 - base);
  } else {
    skeletonOpacity = Math.min(1.0, 0.62 + ((d - 50) / 50) * 0.38);
  }

  return {
    skin: { visible: skinVisible, opacity: Number(skinOpacity.toFixed(2)) },
    muscle: { visible: muscleVisible, opacity: Number(muscleOpacity.toFixed(2)) },
    skeleton: { visible: true, opacity: Number(skeletonOpacity.toFixed(2)) },
    organs: { visible: false, opacity: 0.92 },
    arteries: { visible: true, opacity: 1.0 },
    veins: { visible: mode === 'venosomes', opacity: 1.0 },
    nerves: { visible: false, opacity: 0.95 },
    perforators: { visible: false, opacity: 1.0 },
    perforasomes: { visible: false, opacity: 0.45 },
    angiosomes: { visible: false, opacity: 0.35 },
    landmarks: { visible: false, opacity: 1.0 },
    cuttingGuides: { visible: false, opacity: 1.0 },
  };
}

/**
 * Builds the complete clinical Territory Detail Card model for any Body or Head & Neck angiosome.
 */
export function getTerritoryDetailModel(
  territoryId: string,
  field: TerritoryFieldData | null,
  flaps: readonly FlapRecord[]
): TerritoryDetailModel | null {
  const slotEntry = TERRITORY_SLOT_BY_ID.get(territoryId);
  if (!slotEntry) return null;

  const body: BodyAngiosomeRecord | undefined = BODY_ANGIOSOME_BY_ID.get(territoryId);
  const hnDirect: HeadNeckAngiosomeRecord | undefined = HEAD_NECK_ANGIOSOME_BY_ID.get(territoryId);
  const hnLinked: HeadNeckAngiosomeRecord | undefined =
    hnDirect ?? HEAD_NECK_ANGIOSOMES.find((h) => h.bodyAngiosomeId === territoryId);

  if (!body && !hnDirect) return null;

  const bp3dCoverage: Bp3dCoverage = body ? body.bp3dCoverage : hnDirect!.bp3dCoverage;
  const reachesSkin = body ? body.reachesSkin : hnDirect!.reachesSkin;
  const isDeepOnly = !reachesSkin;

  // Tissues spanned (Ch. 23 p. 321 composite block vs Fig 23.37 deep-only 11-13)
  const tissuesSpanned = isDeepOnly
    ? ['Deep fascia', 'Muscle', 'Bone / periosteum (no cutaneous territory)']
    : ['Skin', 'Fascia', 'Muscle', 'Bone / periosteum'];

  // Muscles supplied by this territory (from §2.3 & §2.2)
  const muscles: TerritoryMuscleSummary[] = [];
  const seenMuscleNames = new Set<string>();

  for (const m of MUSCLE_TERRITORIES) {
    if (m.supplyingAngiosomeIds.includes(territoryId)) {
      seenMuscleNames.add(m.name.toLowerCase());
      muscles.push({
        id: m.id,
        name: m.name,
        territoryCountLabel:
          m.angiosomeCount === 1
            ? '1 territory'
            : m.angiosomeCount
              ? `${m.angiosomeCount} territories`
              : 'Multi-territory',
        neurovascularType: m.neurovascularType,
        presentInBp3d: m.bp3dPresent,
        sourcePage: m.sourceRef.page,
      });
    }
  }

  // Add relevant head & neck muscle groups when inspecting a head & neck angiosome
  if (slotEntry.regionFamily === 'head_neck') {
    const num = hnLinked?.fig23_37Number;
    for (const hnm of headNeckMuscleTerritories) {
      const key = hnm.name.toLowerCase();
      if (seenMuscleNames.has(key)) continue;
      // Match specific clinically cited muscle-artery pairs from Ch. 23 §2.2
      const matchMastication =
        hnm.group === 'mastication' && (num === 1 || num === 2 || num === 4);
      const matchScm =
        key.includes('sternocleidomastoid') && (num === 6 || num === 10 || num === 5 || num === 7);
      const matchTrap =
        key.includes('trapezius') && (num === 7 || num === 6 || num === 8);
      const matchTongue =
        (key.includes('tongue') || key.includes('glossus') || key.includes('mylohyoid')) &&
        (num === 13 || num === 2);
      if (matchMastication || matchScm || matchTrap || matchTongue) {
        seenMuscleNames.add(key);
        const countStr = hnm.territoryCountVariant
          ? `${hnm.territoryCount}–${hnm.territoryCountVariant} territories`
          : `${hnm.territoryCount} ${hnm.territoryCount === 1 ? 'territory' : 'territories'}`;
        muscles.push({
          id: hnm.id,
          name: hnm.name,
          territoryCountLabel: countStr,
          presentInBp3d: hnm.bp3dPresent,
          sourcePage: hnm.sourceRef.page,
        });
      }
    }
  }

  // Computed adjacent territories from the 3D field neighbor graph
  const rawNeighborSlots = field?.neighborsBySlot[slotEntry.slotId] ?? [];
  const neighbors: TerritoryNeighborSummary[] = [];
  for (const nSlot of rawNeighborSlots) {
    const nEntry = TERRITORY_SLOT_BY_INDEX.get(nSlot);
    if (!nEntry || nEntry.slotId === slotEntry.slotId) continue;
    neighbors.push({
      slotId: nEntry.slotId,
      territoryId: nEntry.territoryId,
      label: nEntry.label,
      shortLabel: nEntry.shortLabel,
      hexStandard: nEntry.hexStandard,
      hexColorblind: nEntry.hexColorblind,
      isSchematic: nEntry.isSchematic,
    });
  }

  // Relevant paraphrased clinical notes from Ch. 23
  const clinicalNotes: Array<{ id: string; title: string; summary: string; page: string }> = [];
  for (const n of [...HEAD_NECK_CLINICAL_NOTES, ...LEG_AND_FOREARM_TERRITORY_NOTES]) {
    const matchBody = n.relatedAngiosomeIds.includes(territoryId);
    const matchHn = hnLinked ? n.relatedHeadNeckIds.includes(hnLinked.id) : false;
    if (matchBody || matchHn) {
      clinicalNotes.push({
        id: n.id,
        title: n.name,
        summary: n.summary,
        page: n.sourceRef.page,
      });
    }
  }

  const sharedMeshNote =
    body?.sharedMeshGroup === 'femoral_31_32'
      ? 'BodyParts3D uses a single femoral artery mesh (territories 31 + 32 share this vessel).'
      : undefined;

  return {
    territoryId,
    slotId: slotEntry.slotId,
    displayNumber: body ? String(body.fig23_23Number) : `HN-${hnDirect!.fig23_37Number}`,
    headNeckNumber: hnLinked?.fig23_37Number,
    name: body ? body.name : hnDirect!.name,
    abbr: body?.abbr || '',
    regionFamily: slotEntry.regionFamily,
    bp3dCoverage,
    coverageLabel: formatCoverageBadgeLabel(bp3dCoverage),
    isSchematic: bp3dCoverage === 'none',
    isDeepOnly,
    reachesSkin,
    crossesMidline: body ? body.crossesMidline : hnDirect!.crossesMidline,
    sharedMeshNote,
    bp3dArteries: body ? body.bp3dArteries : hnDirect!.bp3dArteries,
    schematicHint: body ? body.schematicHint : hnDirect!.schematicHint,
    note: body?.note || '',
    tissuesSpanned,
    muscles,
    neighbors,
    neighborClinicalNote: CHOKES_AND_TRUE_ANASTOMOSES_STATEMENT,
    linkedFlaps: findFlapsForTerritory(territoryId, flaps),
    clinicalNotes,
    sourceRef: body ? body.sourceRef : hnDirect!.sourceRef,
    hexStandard: slotEntry.hexStandard,
    hexColorblind: slotEntry.hexColorblind,
  };
}

/**
 * Searches Body Angiosomes (Fig. 23.23), Head & Neck Angiosomes (Fig. 23.37),
 * and authorised Perforator Territory Codes (Fig. 23.51) for the Global Search Palette.
 */
export function searchTerritoriesAndCodes(query: string, limit = 10): TerritorySearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: Array<{ score: number; item: TerritorySearchItem }> = [];
  const seenKeys = new Set<string>();

  const scoreText = (
    primaryName: string,
    code: string,
    numStr: string,
    extraTerms: string[]
  ): number => {
    const nLow = primaryName.toLowerCase();
    const cLow = code.toLowerCase();
    const numLow = numStr.toLowerCase();

    if (cLow && cLow === q) return 120;
    if (numLow && (numLow === q || `angiosome ${numLow}` === q || `#${numLow}` === q)) return 115;
    if (nLow === q) return 110;
    if (cLow && cLow.startsWith(q)) return 95;
    if (nLow.startsWith(q)) return 90;
    if (nLow.includes(q)) return 75;
    if (cLow && cLow.includes(q)) return 70;
    for (const term of extraTerms) {
      const tLow = term.toLowerCase();
      if (tLow === q) return 85;
      if (tLow.includes(q)) return 60;
    }
    return 0;
  };

  for (const a of BODY_ANGIOSOMES) {
    const numStr = String(a.fig23_23Number);
    const arteryNames = a.bp3dArteries.map((ar) => ar.name);
    const score = scoreText(a.name, a.abbr, numStr, [
      ...arteryNames,
      a.schematicHint || '',
      `angiosome ${numStr}`,
    ]);
    if (score > 0) {
      const key = `body:${a.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        scored.push({
          score,
          item: {
            key,
            kind: 'body_angiosome',
            territoryId: a.id,
            title: `${numStr}. ${a.name}`,
            code: a.abbr || `#${numStr}`,
            subtitle:
              a.bp3dArteries.length > 0
                ? a.bp3dArteries.map((ar) => ar.name).slice(0, 2).join(', ')
                : a.schematicHint || 'Fig. 23.23 Angiosome',
            regionFamily: a.regionFamily,
            coverageLabel: formatCoverageBadgeLabel(a.bp3dCoverage),
            isSchematic: a.bp3dCoverage === 'none',
            sourceRef: a.sourceRef,
          },
        });
      }
    }
  }

  for (const hn of HEAD_NECK_ANGIOSOMES) {
    // Only add distinct HN-only entries or HN-numbered aliases when user searches HN/head-neck names
    const canonicalId = hn.bodyAngiosomeId ?? hn.id;
    const numStr = `hn-${hn.fig23_37Number}`;
    const score = scoreText(hn.name, `HN-${hn.fig23_37Number}`, String(hn.fig23_37Number), [
      numStr,
      ...hn.bp3dArteries.map((ar) => ar.name),
      hn.schematicHint || '',
    ]);
    if (score > 0 && !hn.bodyAngiosomeId) {
      const key = `hn:${hn.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        scored.push({
          score: score - 1,
          item: {
            key,
            kind: 'head_neck_angiosome',
            territoryId: canonicalId,
            title: `HN-${hn.fig23_37Number}. ${hn.name}`,
            code: `HN-${hn.fig23_37Number}`,
            subtitle: hn.reachesSkin
              ? 'Head & Neck angiosome (Fig. 23.37)'
              : 'Deep tissue only — does not reach skin (Fig. 23.37)',
            regionFamily: 'head_neck',
            coverageLabel: formatCoverageBadgeLabel(hn.bp3dCoverage),
            isSchematic: hn.bp3dCoverage === 'none',
            sourceRef: hn.sourceRef,
          },
        });
      }
    }
  }

  for (const p of FIG_23_51_PERFORATOR_CODES) {
    const score = scoreText(p.name, p.perforasomeCode, '', [p.perforasomeCode]);
    if (score > 0) {
      const targetTerritoryId = p.bodyAngiosomeId ?? p.headNeckAngiosomeId ?? null;
      if (!targetTerritoryId || !TERRITORY_SLOT_BY_ID.has(targetTerritoryId)) continue;
      // Avoid duplicate if the exact same body angiosome already matched with the same abbr
      const bodyRec = BODY_ANGIOSOME_BY_ID.get(targetTerritoryId);
      if (
        bodyRec &&
        bodyRec.abbr.toLowerCase() === p.perforasomeCode.toLowerCase() &&
        seenKeys.has(`body:${targetTerritoryId}`)
      ) {
        continue;
      }
      const key = `perf:${p.perforasomeCode}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const slot = TERRITORY_SLOT_BY_ID.get(targetTerritoryId)!;
        const cov: Bp3dCoverage = bodyRec?.bp3dCoverage ?? 'none';
        scored.push({
          score: score - 2,
          item: {
            key,
            kind: 'perforator_code',
            territoryId: targetTerritoryId,
            title: `${p.perforasomeCode} — ${p.name}`,
            code: p.perforasomeCode,
            subtitle: `Fig. 23.51 perforator territory → ${slot.label}`,
            regionFamily: slot.regionFamily,
            coverageLabel: formatCoverageBadgeLabel(cov),
            isSchematic: cov === 'none',
            sourceRef: p.sourceRef,
          },
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return scored.slice(0, limit).map((s) => s.item);
}
