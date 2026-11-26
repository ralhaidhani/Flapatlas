import type { FlapRecord } from '../types/schemas';
import type { Laterality } from './anatomyMap';
import type { SearchableAnatomyStructure } from './clippingAndSearch';
import {
  FLAP_PEDICLE_MAP,
  FlapVesselRole,
  inferRealVesselMapKey,
} from './flapVesselLinker';

export interface IndexedLoadedVessel {
  key: string;
  anatomyId: string;
  /** Clean BodyParts3D `extras.name` (never the raw `[FJxxxx]` node name) */
  name: string;
  meshName: string;
  system: 'arteries' | 'veins';
  category: 'Artery' | 'Vein';
  side: Laterality;
  fjCode?: string;
  fmaCode?: string;
  sourceModel?: 'z-anatomy' | 'bodyparts3d';
  mapped: boolean;
  linkedFlapIds: string[];
  center: [number, number, number];
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
}

export interface FlapUsingVesselMatch {
  flapId: string;
  flapName: string;
  regionGroup: string;
  mapKey: string;
  role: FlapVesselRole;
  matchedVesselName: string;
  matchedSide: 'left' | 'right' | 'midline' | 'any';
}

const ROLE_PRIORITY: Record<FlapVesselRole, number> = {
  pedicle: 0,
  vein: 1,
  source: 2,
};

const SIDE_ORDER: Record<Laterality, number> = {
  left: 0,
  right: 1,
  midline: 2,
};

/**
 * Extracts every loaded artery and vein structure into a clean searchable index
 * preserving BodyParts3D `extras.name`, `side`, `fjCode`, `fmaCode`, and aligned world bounds.
 */
export function extractLoadedVesselsIndex(
  structures: SearchableAnatomyStructure[]
): IndexedLoadedVessel[] {
  const out: IndexedLoadedVessel[] = [];
  for (let i = 0; i < structures.length; i++) {
    const s = structures[i];
    if (s.system !== 'arteries' && s.system !== 'veins') continue;
    out.push({
      key: s.key,
      anatomyId: s.anatomyId,
      name: s.label,
      meshName: s.meshName,
      system: s.system,
      category: s.system === 'arteries' ? 'Artery' : 'Vein',
      side: s.laterality,
      fjCode: s.fjCode,
      fmaCode: s.fmaCode,
      sourceModel: s.sourceModel,
      mapped: s.mapped,
      linkedFlapIds: s.linkedFlapIds,
      center: s.center,
      boundsMin: s.boundsMin,
      boundsMax: s.boundsMax,
    });
  }
  return out;
}

/**
 * Searches loaded 3D vessels across `extras.name`, `side`, `FJ` code, `FMA` code,
 * and vessel type (`artery` / `vein`). Supports multi-token queries such as
 * `"inferior epigastric"`, `"inferior epigastric left"`, `"FJ3511"`, or `"FMA20740"`.
 */
export function searchLoadedVessels(
  vessels: IndexedLoadedVessel[],
  rawQuery: string,
  limit = 16
): IndexedLoadedVessel[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return vessels.slice(0, limit);
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: Array<{ item: IndexedLoadedVessel; score: number }> = [];

  for (let i = 0; i < vessels.length; i++) {
    const v = vessels[i];
    const nameLower = v.name.toLowerCase();
    const fjLower = (v.fjCode || '').toLowerCase();
    const fmaLower = (v.fmaCode || '').toLowerCase();
    const sideTokens =
      v.side === 'left'
        ? 'left l'
        : v.side === 'right'
          ? 'right r'
          : v.side === 'midline'
            ? 'midline median'
            : '';
    const sysTokens = v.system === 'arteries' ? 'artery arteries arterial' : 'vein veins venous';
    const haystack = `${nameLower} ${fjLower} ${fmaLower} ${sideTokens} ${sysTokens}`;

    let allMatch = true;
    for (let t = 0; t < tokens.length; t++) {
      if (!haystack.includes(tokens[t])) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) continue;

    let score = 0;
    if (fjLower && (fjLower === q || fjLower === `fj${q}`)) {
      score += 200;
    } else if (fmaLower && (fmaLower === q || fmaLower === `fma${q}`)) {
      score += 190;
    } else if (nameLower === q) {
      score += 140;
    } else if (nameLower.startsWith(q)) {
      score += 100;
    } else if (nameLower.includes(q)) {
      score += 75;
    } else {
      score += 40;
    }

    // Prefer BodyParts3D reference vessels and arteries slightly ahead of veins on exact ties
    if (v.sourceModel === 'bodyparts3d') score += 10;
    if (v.system === 'arteries') score += 4;
    // Shorter canonical vessel names rank cleanly above distant minor branches
    score -= Math.min(20, v.name.length * 0.15);

    scored.push({ item: v, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.item.name.localeCompare(b.item.name) ||
      SIDE_ORDER[a.item.side] - SIDE_ORDER[b.item.side]
  );

  return scored.slice(0, limit).map((s) => s.item);
}

/**
 * Normalizes a vessel name for matching against `flapPedicleMap.json` entries
 * (strips laterality prefixes, parenthetical abbreviations, and harmonizes common
 * clinical synonyms like "deep inferior epigastric" -> "inferior epigastric").
 */
export function normalizeVesselNameForMapLookup(rawName: string): string {
  let clean = rawName
    .toLowerCase()
    .replace(/\[fj[a-z0-9_-]+\]/gi, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(left|right|bilateral|midline)\b/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Clinical synonym harmonizations strictly matching BodyParts3D names in flapPedicleMap.json
  clean = clean
    .replace(/\bdeep inferior epigastric\b/g, 'inferior epigastric')
    .replace(/\bsuperficial inferior epigastric\b/g, 'superficial epigastric')
    .replace(/\binternal mammary\b/g, 'internal thoracic')
    .replace(/\bthoracoacromial\b/g, 'thoraco acromial')
    .replace(/\bgastroepiploic\b/g, 'gastro epiploic')
    .replace(/\bposterior radial collateral\b/g, 'radial collateral branch of deep brachial')
    .replace(/\bprofunda brachii\b/g, 'deep brachial');

  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Reverse lookup using Sub-Phase 9d's `flapPedicleMap.json`:
 * Given a vessel (by BodyParts3D `fjCode` and/or `name`), returns every flap record
 * that uses this vessel along with its anatomical role (`pedicle`, `vein`, `source`).
 */
export function findFlapsUsingVessel(
  vessel: { fjCode?: string | null; name?: string | null },
  flaps: FlapRecord[]
): FlapUsingVesselMatch[] {
  const targetFj = vessel.fjCode ? vessel.fjCode.trim().toUpperCase() : null;
  const targetNormName = vessel.name ? normalizeVesselNameForMapLookup(vessel.name) : '';

  const matchedMapEntries: Array<{
    mapKey: string;
    role: FlapVesselRole;
    matchedVesselName: string;
    matchedSide: 'left' | 'right' | 'midline' | 'any';
  }> = [];

  for (const [mapKey, entries] of Object.entries(FLAP_PEDICLE_MAP.flaps)) {
    for (const entry of entries) {
      let matchedSide: 'left' | 'right' | 'midline' | 'any' | null = null;

      // 1. Exact FJ match (highest fidelity for BodyParts3D loaded meshes)
      if (targetFj) {
        if (entry.left?.some((c) => c.toUpperCase() === targetFj)) {
          matchedSide = 'left';
        } else if (entry.right?.some((c) => c.toUpperCase() === targetFj)) {
          matchedSide = 'right';
        } else if (entry.midline?.some((c) => c.toUpperCase() === targetFj)) {
          matchedSide = 'midline';
        }
      }

      // 2. Name match fallback (when no FJ code is available, e.g., curated vessels list)
      if (!matchedSide && !targetFj && targetNormName) {
        const entryNorm = normalizeVesselNameForMapLookup(entry.name);
        if (
          entryNorm === targetNormName ||
          (entryNorm.length >= 10 &&
            (targetNormName.includes(entryNorm) || entryNorm.includes(targetNormName)))
        ) {
          matchedSide = 'any';
        }
      }

      if (matchedSide) {
        matchedMapEntries.push({
          mapKey,
          role: entry.role,
          matchedVesselName: entry.name,
          matchedSide,
        });
      }
    }
  }

  if (matchedMapEntries.length === 0) return [];

  // Map each matched mapKey to concrete FlapRecord entries (deduplicated by flapId, keeping highest-priority role)
  const byFlapId = new Map<string, FlapUsingVesselMatch>();

  for (const match of matchedMapEntries) {
    for (const flap of flaps) {
      const flapKey = flap.real_vessel_map_key || inferRealVesselMapKey(flap);
      if (flapKey !== match.mapKey) continue;

      const existing = byFlapId.get(flap.id);
      if (!existing || ROLE_PRIORITY[match.role] < ROLE_PRIORITY[existing.role]) {
        byFlapId.set(flap.id, {
          flapId: flap.id,
          flapName: flap.name,
          regionGroup: flap.region_group,
          mapKey: match.mapKey,
          role: match.role,
          matchedVesselName: match.matchedVesselName,
          matchedSide: match.matchedSide,
        });
      }
    }
  }

  return Array.from(byFlapId.values()).sort(
    (a, b) => ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role] || a.flapName.localeCompare(b.flapName)
  );
}
