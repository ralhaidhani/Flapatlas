import * as THREE from 'three';
import { BODY_ANGIOSOMES, HEAD_NECK_ANGIOSOMES } from '../data/territories/index';
import type { TerritoryRegionFamily } from '../data/territories/schemas';

/**
 * Phase 11b/11c — Territory color system (Anti-clutter rule #3):
 * Color is never the only code: region-family hues + lightness steps +
 * computed boundary outlines + on-demand labels, with full Okabe-Ito
 * colorblind-safe palette support and a Venosome blue-family palette.
 */

export interface TerritorySlotEntry {
  /** Compact 1-based slot id stored in RGBA8 Data3DTexture R/G channels (1..63) */
  slotId: number;
  territoryId: string;
  label: string;
  shortLabel: string;
  regionFamily: TerritoryRegionFamily;
  isDeepOnly: boolean;
  isSchematic: boolean;
  crossesMidline: boolean;
  /** Standard RGB [0..1] */
  rgbStandard: [number, number, number];
  /** Okabe-Ito colorblind-safe RGB [0..1] */
  rgbColorblind: [number, number, number];
  /** Venosome blue/cyan family RGB [0..1] */
  rgbVenosome: [number, number, number];
  hexStandard: string;
  hexColorblind: string;
}

function hslToRgb01(hDeg: number, sPct: number, lPct: number): [number, number, number] {
  const h = ((hDeg % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, sPct)) / 100;
  const l = Math.max(0, Math.min(100, lPct)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

function rgb01ToHex([r, g, b]: [number, number, number]): string {
  const toByte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (
    '#' +
    [toByte(r), toByte(g), toByte(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Region-family base hues (distinct perceptual bands):
 * - head_neck: warm amber-ochre (32°..52°)
 * - trunk: teal-emerald (155°..185°)
 * - upper_limb: cobalt-indigo (212°..242°)
 * - lower_limb: coral-terracotta-rose (342°..16°)
 */
const STANDARD_FAMILY_HUE: Record<TerritoryRegionFamily, [number, number]> = {
  head_neck: [32, 54],
  trunk: [152, 184],
  upper_limb: [212, 244],
  lower_limb: [344, 18],
};

/**
 * Okabe-Ito colorblind-safe base hues per region family:
 * - head_neck: orange (#E69F00 ~ 41°)
 * - trunk: bluish-green (#009E73 ~ 164°)
 * - upper_limb: sky blue / blue (#56B4E9 / #0072B2 ~ 202°..210°)
 * - lower_limb: vermilion / reddish-purple (#D55E00 / #CC79A7 ~ 18°..330°)
 */
const OKABE_ITO_FAMILY_HUE: Record<TerritoryRegionFamily, [number, number]> = {
  head_neck: [38, 52],
  trunk: [160, 174],
  upper_limb: [198, 214],
  lower_limb: [326, 344],
};

const LIGHTNESS_STEPS = [46, 62, 54, 70, 42, 66, 50, 74];
const SATURATION_STEPS = [64, 56, 70, 52, 62, 58];

function interpolateHue(range: [number, number], t: number): number {
  let [h0, h1] = range;
  if (h1 < h0) h1 += 360;
  return (h0 + (h1 - h0) * t) % 360;
}

/**
 * Deterministic canonical slot table covering:
 * - Slots 1..41: the 41 Fig 23.23 body angiosomes (including 22a)
 * - Slots 42..44: deep-only Head & Neck angiosomes 11 (Vertebral), 12 (Ascending pharyngeal), 13 (Lingual)
 * - Slot 45: Head & Neck #5 (Posterior auricular, distinct in Fig 23.37)
 */
export function buildTerritorySlotRegistry(): TerritorySlotEntry[] {
  const familyCounters: Record<TerritoryRegionFamily, number> = {
    head_neck: 0,
    trunk: 0,
    upper_limb: 0,
    lower_limb: 0,
  };

  const entries: TerritorySlotEntry[] = [];
  let nextSlot = 1;

  for (const angio of BODY_ANGIOSOMES) {
    const idxInFamily = familyCounters[angio.regionFamily]++;
    const t = ((idxInFamily * 0.37) % 1 + 1) % 1;
    const l = LIGHTNESS_STEPS[idxInFamily % LIGHTNESS_STEPS.length];
    const s = SATURATION_STEPS[idxInFamily % SATURATION_STEPS.length];

    const hStd = interpolateHue(STANDARD_FAMILY_HUE[angio.regionFamily], t);
    const hCb = interpolateHue(OKABE_ITO_FAMILY_HUE[angio.regionFamily], t);
    const hVen = 198 + ((idxInFamily * 11) % 34); // crisp blue-cyan venosome band

    const rgbStandard = hslToRgb01(hStd, s, l);
    const rgbColorblind = hslToRgb01(hCb, Math.min(78, s + 8), l);
    const rgbVenosome = hslToRgb01(hVen, 58 + (idxInFamily % 3) * 8, 44 + (idxInFamily % 5) * 7);

    entries.push({
      slotId: nextSlot++,
      territoryId: angio.id,
      label: `${String(angio.fig23_23Number)}. ${angio.name}`,
      shortLabel: angio.abbr || angio.name,
      regionFamily: angio.regionFamily,
      isDeepOnly: false,
      isSchematic: angio.bp3dCoverage === 'none',
      crossesMidline: angio.crossesMidline,
      rgbStandard,
      rgbColorblind,
      rgbVenosome,
      hexStandard: rgb01ToHex(rgbStandard),
      hexColorblind: rgb01ToHex(rgbColorblind),
    });
  }

  // Deep-only Head & Neck territories (11, 12, 13) + Posterior auricular (5)
  const extraHnNums = [11, 12, 13, 5];
  for (const num of extraHnNums) {
    const hn = HEAD_NECK_ANGIOSOMES.find((h) => h.fig23_37Number === num);
    if (!hn) continue;
    const idxInFamily = familyCounters.head_neck++;
    const t = ((idxInFamily * 0.37) % 1 + 1) % 1;
    const l = LIGHTNESS_STEPS[idxInFamily % LIGHTNESS_STEPS.length];
    const s = SATURATION_STEPS[idxInFamily % SATURATION_STEPS.length];
    const hStd = interpolateHue(STANDARD_FAMILY_HUE.head_neck, t);
    const hCb = interpolateHue(OKABE_ITO_FAMILY_HUE.head_neck, t);
    const hVen = 205 + ((idxInFamily * 9) % 28);

    const rgbStandard = hslToRgb01(hStd, s, l);
    const rgbColorblind = hslToRgb01(hCb, Math.min(78, s + 8), l);
    const rgbVenosome = hslToRgb01(hVen, 58, 48 + (idxInFamily % 4) * 6);

    entries.push({
      slotId: nextSlot++,
      territoryId: hn.id,
      label: `HN-${hn.fig23_37Number}. ${hn.name}`,
      shortLabel: hn.name,
      regionFamily: 'head_neck',
      isDeepOnly: !hn.reachesSkin,
      isSchematic: hn.bp3dCoverage === 'none',
      crossesMidline: hn.crossesMidline,
      rgbStandard,
      rgbColorblind,
      rgbVenosome,
      hexStandard: rgb01ToHex(rgbStandard),
      hexColorblind: rgb01ToHex(rgbColorblind),
    });
  }

  return entries;
}

export const TERRITORY_SLOTS: readonly TerritorySlotEntry[] = buildTerritorySlotRegistry();

export const TERRITORY_SLOT_BY_ID: ReadonlyMap<string, TerritorySlotEntry> = new Map(
  TERRITORY_SLOTS.map((e) => [e.territoryId, e])
);

export const TERRITORY_SLOT_BY_INDEX: ReadonlyMap<number, TerritorySlotEntry> = new Map(
  TERRITORY_SLOTS.map((e) => [e.slotId, e])
);

export const LUT_WIDTH = 64;
export const LUT_HEIGHT = 2;

/**
 * Builds a 64×2 RGBA8 DataTexture LUT for fragment-shader palette lookup:
 * - Row 0 (v = 0.25): Angiosome colors (Standard or Okabe-Ito colorblind-safe)
 * - Row 1 (v = 0.75): Venosome blue-family colors
 */
export function createTerritoryPaletteLutTexture(colorblindMode: boolean): THREE.DataTexture {
  const data = new Uint8Array(LUT_WIDTH * LUT_HEIGHT * 4);

  // Slot 0 = neutral grey fallback
  for (let row = 0; row < LUT_HEIGHT; row++) {
    const base = row * LUT_WIDTH * 4;
    data[base] = 176;
    data[base + 1] = 182;
    data[base + 2] = 190;
    data[base + 3] = 255;
  }

  for (const entry of TERRITORY_SLOTS) {
    if (entry.slotId >= LUT_WIDTH) continue;
    const angioRgb = colorblindMode ? entry.rgbColorblind : entry.rgbStandard;
    const venRgb = entry.rgbVenosome;

    const idx0 = entry.slotId * 4;
    data[idx0] = Math.round(angioRgb[0] * 255);
    data[idx0 + 1] = Math.round(angioRgb[1] * 255);
    data[idx0 + 2] = Math.round(angioRgb[2] * 255);
    data[idx0 + 3] = 255;

    const idx1 = (LUT_WIDTH + entry.slotId) * 4;
    data[idx1] = Math.round(venRgb[0] * 255);
    data[idx1 + 1] = Math.round(venRgb[1] * 255);
    data[idx1 + 2] = Math.round(venRgb[2] * 255);
    data[idx1 + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, LUT_WIDTH, LUT_HEIGHT, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function updateTerritoryPaletteLutTexture(
  tex: THREE.DataTexture,
  colorblindMode: boolean
): void {
  const data = tex.image.data as Uint8Array;
  for (const entry of TERRITORY_SLOTS) {
    if (entry.slotId >= LUT_WIDTH) continue;
    const angioRgb = colorblindMode ? entry.rgbColorblind : entry.rgbStandard;
    const idx0 = entry.slotId * 4;
    data[idx0] = Math.round(angioRgb[0] * 255);
    data[idx0 + 1] = Math.round(angioRgb[1] * 255);
    data[idx0 + 2] = Math.round(angioRgb[2] * 255);
    data[idx0 + 3] = 255;
  }
  tex.needsUpdate = true;
}

export const REGION_FAMILY_META: Readonly<
  Record<
    TerritoryRegionFamily,
    { label: string; standardSwatch: string; colorblindSwatch: string }
  >
> = {
  head_neck: {
    label: 'Head & Neck',
    standardSwatch: '#d99126',
    colorblindSwatch: '#e69f00',
  },
  trunk: {
    label: 'Trunk & Pelvis',
    standardSwatch: '#1f9d84',
    colorblindSwatch: '#009e73',
  },
  upper_limb: {
    label: 'Upper Limb',
    standardSwatch: '#3b73d9',
    colorblindSwatch: '#0072b2',
  },
  lower_limb: {
    label: 'Lower Limb',
    standardSwatch: '#d9534f',
    colorblindSwatch: '#cc79a7',
  },
};
