import vesselPresetsRaw from '../data/vesselPresets.json';
import { Laterality } from './anatomyMap';

export type VesselPresetId =
  | 'surgical'
  | 'upper_limb'
  | 'lower_limb'
  | 'trunk_shoulder'
  | 'all';

export type VesselSideFilter = 'both' | 'left' | 'right';

export type VesselPresetMode = 'exclude' | 'include' | 'all';

export interface VesselPresetDefinition {
  id: VesselPresetId;
  label: string;
  shortLabel: string;
  mode: VesselPresetMode;
  description: string;
  pattern: string;
}

export interface VesselFilterStats {
  presetId: VesselPresetId;
  sideFilter: VesselSideFilter;
  totalArteries: number;
  visibleArteries: number;
  totalVeins: number;
  visibleVeins: number;
  totalVessels: number;
  visibleVessels: number;
  hiddenVessels: number;
}

interface RawVesselPresetsFile {
  defaultPresetId?: string;
  presets: VesselPresetDefinition[];
}

const rawFile = vesselPresetsRaw as RawVesselPresetsFile;

export const VESSEL_PRESETS: VesselPresetDefinition[] = rawFile.presets;

export const DEFAULT_VESSEL_PRESET_ID: VesselPresetId =
  (rawFile.defaultPresetId as VesselPresetId) || 'surgical';

export const DEFAULT_VESSEL_SIDE_FILTER: VesselSideFilter = 'both';

const compiledRegexCache = new Map<string, RegExp | null>();

export function isValidVesselPresetId(value: unknown): value is VesselPresetId {
  return (
    typeof value === 'string' && VESSEL_PRESETS.some((preset) => preset.id === value)
  );
}

export function isValidVesselSideFilter(value: unknown): value is VesselSideFilter {
  return value === 'both' || value === 'left' || value === 'right';
}

export function getVesselPreset(
  presetId: VesselPresetId,
  presets: VesselPresetDefinition[] = VESSEL_PRESETS
): VesselPresetDefinition {
  return (
    presets.find((p) => p.id === presetId) ??
    presets.find((p) => p.id === DEFAULT_VESSEL_PRESET_ID) ??
    presets[0]
  );
}

export function compilePresetRegex(preset: VesselPresetDefinition): RegExp | null {
  if (preset.mode === 'all' || !preset.pattern || !preset.pattern.trim()) {
    return null;
  }
  const cacheKey = `${preset.id}::${preset.pattern}`;
  if (compiledRegexCache.has(cacheKey)) {
    return compiledRegexCache.get(cacheKey) ?? null;
  }
  try {
    const regex = new RegExp(preset.pattern, 'i');
    compiledRegexCache.set(cacheKey, regex);
    return regex;
  } catch {
    compiledRegexCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Normalizes a vessel name (`extras.name` or raw fallback mesh name) before testing
 * against the preset regex list from `src/data/vesselPresets.json`.
 */
export function normalizeVesselNameForFilter(name: string): string {
  return name
    .replace(/\s*\[FJ[A-Za-z0-9_-]+\]\s*$/i, '')
    .replace(/^\s*FJ[A-Za-z0-9]+[\s_-]+/i, '')
    .replace(/\.(l|r|el|er|ol|or)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesVesselPreset(
  vesselName: string,
  presetId: VesselPresetId,
  presets: VesselPresetDefinition[] = VESSEL_PRESETS
): boolean {
  const preset = getVesselPreset(presetId, presets);
  if (!preset || preset.mode === 'all') {
    return true;
  }
  const regex = compilePresetRegex(preset);
  if (!regex) {
    return true;
  }
  const cleaned = normalizeVesselNameForFilter(vesselName);
  const hit = regex.test(cleaned) || regex.test(vesselName);
  return preset.mode === 'exclude' ? !hit : hit;
}

/**
 * Infers side from explicit BodyParts3D `extras.side` / `laterality`, falling back
 * to textual cues (`.l`/`.r`, `left`/`right`) or anatomical world-X coordinate (+X = left).
 */
export function resolveVesselLaterality(
  laterality?: Laterality | string,
  vesselName?: string,
  centerXMeters?: number
): 'left' | 'right' | 'midline' {
  const lat = (laterality || '').toLowerCase().trim();
  if (lat === 'left' || lat === 'l') return 'left';
  if (lat === 'right' || lat === 'r') return 'right';
  if (lat === 'midline' || lat === 'bilateral') return 'midline';

  if (vesselName) {
    const lower = vesselName.toLowerCase();
    if (/\.(l|el|ol)$/.test(lower) || /\bleft\b|\bsinist/.test(lower)) return 'left';
    if (/\.(r|er|or)$/.test(lower) || /\bright\b|\bdext/.test(lower)) return 'right';
  }

  if (typeof centerXMeters === 'number' && Number.isFinite(centerXMeters)) {
    if (centerXMeters > 0.015) return 'left';
    if (centerXMeters < -0.015) return 'right';
  }

  return 'midline';
}

/**
 * Evaluates the side filter (`Left` / `Right` / `Both`).
 * Midline trunks (e.g. aorta, IVC, SVC) remain visible on both Left and Right so
 * unilateral vascular trees stay anatomically connected.
 */
export function matchesVesselSide(
  laterality: Laterality | string | undefined,
  sideFilter: VesselSideFilter,
  vesselName?: string,
  centerXMeters?: number
): boolean {
  if (sideFilter === 'both') return true;
  const resolved = resolveVesselLaterality(laterality, vesselName, centerXMeters);
  if (resolved === 'midline') return true;
  return resolved === sideFilter;
}

export interface FilterableVesselItem {
  name: string;
  meshName?: string;
  laterality?: Laterality | string;
  centerXMeters?: number;
}

export function shouldShowVessel(
  vessel: FilterableVesselItem,
  presetId: VesselPresetId,
  sideFilter: VesselSideFilter,
  presets: VesselPresetDefinition[] = VESSEL_PRESETS
): boolean {
  const effectiveName = vessel.name || vessel.meshName || '';
  if (!matchesVesselPreset(effectiveName, presetId, presets)) {
    return false;
  }
  return matchesVesselSide(
    vessel.laterality,
    sideFilter,
    vessel.meshName || vessel.name,
    vessel.centerXMeters
  );
}

export function summarizeVesselFilterStats(
  vessels: Array<FilterableVesselItem & { system: 'arteries' | 'veins' }>,
  presetId: VesselPresetId,
  sideFilter: VesselSideFilter,
  presets: VesselPresetDefinition[] = VESSEL_PRESETS
): VesselFilterStats {
  let totalArteries = 0;
  let visibleArteries = 0;
  let totalVeins = 0;
  let visibleVeins = 0;

  for (const v of vessels) {
    const visible = shouldShowVessel(v, presetId, sideFilter, presets);
    if (v.system === 'arteries') {
      totalArteries += 1;
      if (visible) visibleArteries += 1;
    } else {
      totalVeins += 1;
      if (visible) visibleVeins += 1;
    }
  }

  const totalVessels = totalArteries + totalVeins;
  const visibleVessels = visibleArteries + visibleVeins;

  return {
    presetId,
    sideFilter,
    totalArteries,
    visibleArteries,
    totalVeins,
    visibleVeins,
    totalVessels,
    visibleVessels,
    hiddenVessels: Math.max(0, totalVessels - visibleVessels),
  };
}
