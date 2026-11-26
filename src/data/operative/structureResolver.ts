import {
  CANONICAL_TA_MAPPINGS,
  type CustomAnatomyOverride,
  type Laterality,
} from '../../models/anatomyMap';
import type { AnatomicalSystemId } from '../../models/modelManifest';
import type { DonorSide } from '../../models/flapVesselLinker';
import type {
  OperativeGuide,
  OperativeStepView,
  OperativeUnresolvedNameRecord,
} from './schema';

export interface LoadedStructureCatalogItem {
  meshKey: string;
  meshName: string;
  normalizedName?: string;
  anatomyId: string;
  label: string;
  system: AnatomicalSystemId;
  laterality: Laterality;
  groupId?: string;
  groupLabel?: string;
}

export type OperativeLayerKey =
  | 'skin'
  | 'muscle'
  | 'skeleton'
  | 'arteries'
  | 'veins'
  | 'nerves'
  | 'fascia'
  | 'organs';

const OPERATIVE_LAYER_ALIASES: Record<string, OperativeLayerKey> = {
  skin: 'skin',
  muscle: 'muscle',
  muscles: 'muscle',
  skeleton: 'skeleton',
  bone: 'skeleton',
  bones: 'skeleton',
  artery: 'arteries',
  arteries: 'arteries',
  vein: 'veins',
  veins: 'veins',
  nerve: 'nerves',
  nerves: 'nerves',
  fascia: 'fascia',
  organ: 'organs',
  organs: 'organs',
};

const OPERATIVE_CAMERA_ALIASES: Record<string, string | null> = {
  'anterolateral-thigh': 'lower-limb-ant',
  'anterior-thigh': 'lower-limb-ant',
  'lower-limb-ant': 'lower-limb-ant',
  'lower-limb-post': 'lower-limb-post',
  'upper-limb-ant': 'upper-limb-ant',
  'upper-limb-post': 'upper-limb-post',
  abdomen: 'abdomen',
  'chest-breast': 'chest-breast',
  back: 'back',
  'head-neck': 'head-neck',
  hand: 'hand',
  foot: 'foot',
  perineum: 'perineum',
  recipient: null,
};

export function mapOperativeLayerName(raw: string): OperativeLayerKey | null {
  const key = raw.trim().toLowerCase();
  return OPERATIVE_LAYER_ALIASES[key] ?? null;
}

export function mapOperativeCameraName(raw?: string): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(OPERATIVE_CAMERA_ALIASES, key)) {
    return OPERATIVE_CAMERA_ALIASES[key];
  }
  return null;
}

/**
 * Normalize an anatomical label from operative prose/views for matching against
 * BodyParts3D / Terminologia Anatomica catalog entries.
 */
export function normalizeOperativeStructureQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\blcfa\b/g, 'lateral circumflex femoral artery')
    .replace(/\bperoneus\b/g, 'fibularis')
    .replace(/\bfascia\s+lata\b/g, 'fasciae latae')
    .replace(/\b(the|of|to|in|and|or)\b/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCandidateText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^group:/, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b(left|right|bilateral|midline|muscles?)\b/g, ' ')
    .replace(/\b(the|of|to|in|and|or)\b/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lookup canonical TA targetId via the existing CANONICAL_TA_MAPPINGS table.
 */
function findCanonicalTargetId(queryNorm: string): string | null {
  if (!queryNorm) return null;
  for (const entry of CANONICAL_TA_MAPPINGS) {
    if (normalizeCandidateText(entry.label) === queryNorm) return entry.targetId;
    for (const alias of entry.aliases) {
      if (normalizeCandidateText(alias) === queryNorm) return entry.targetId;
    }
  }
  return null;
}

export interface OperativeStructureResolution {
  query: string;
  resolved: boolean;
  isLayerAlias: OperativeLayerKey | null;
  matchedMeshKeys: string[];
  matchedLabels: string[];
}

/**
 * Resolve an operative guide structure name (from step view highlight/hide or adjacent lists)
 * to concrete loaded 3D sub-meshes using the existing name mapper & loaded catalog.
 * Prefers the active donor side when bilateral structures exist.
 */
export function resolveOperativeStructureName(
  rawName: string,
  catalog: readonly LoadedStructureCatalogItem[],
  donorSide: DonorSide,
  customOverrides?: Record<string, CustomAnatomyOverride>
): OperativeStructureResolution {
  const layerAlias = mapOperativeLayerName(rawName);
  if (layerAlias) {
    return {
      query: rawName,
      resolved: true,
      isLayerAlias: layerAlias,
      matchedMeshKeys: [],
      matchedLabels: [layerAlias],
    };
  }

  const queryNorm = normalizeOperativeStructureQuery(rawName);
  if (!queryNorm || catalog.length === 0) {
    return {
      query: rawName,
      resolved: false,
      isLayerAlias: null,
      matchedMeshKeys: [],
      matchedLabels: [],
    };
  }

  const queryTokens = queryNorm.split(' ').filter((t) => t.length >= 2);
  // Skip purely generic non-mesh clinical words
  if (
    queryNorm === 'perforators' ||
    queryNorm === 'perforator' ||
    queryNorm === 'pedicle' ||
    queryNorm === 'recipient vessels' ||
    queryNorm === 'venae comitantes'
  ) {
    return {
      query: rawName,
      resolved: false,
      isLayerAlias: null,
      matchedMeshKeys: [],
      matchedLabels: [],
    };
  }

  const canonicalTargetId = findCanonicalTargetId(queryNorm);

  // Check custom overrides first
  const overrideTargets = new Set<string>();
  if (customOverrides) {
    for (const ov of Object.values(customOverrides)) {
      if (normalizeCandidateText(ov.label) === queryNorm) {
        overrideTargets.add(ov.targetId);
      }
    }
  }

  // Tier 1: exact normalized match against label / meshName / normalizedName / groupLabel
  let matches = catalog.filter((item) => {
    const candidates = [
      item.label,
      item.meshName,
      item.normalizedName || '',
      item.groupLabel || '',
      item.groupId || '',
    ]
      .filter(Boolean)
      .map(normalizeCandidateText);
    return candidates.some((c) => c === queryNorm);
  });

  // Tier 2: canonical TA anatomyId match ONLY when exact name isn't narrower than the shared targetId
  // (e.g., avoid matching "descending branch of LCFA" and "LCFA" ambiguously if exact match exists above)
  if (matches.length === 0 && (canonicalTargetId || overrideTargets.size > 0)) {
    const targetMatches = catalog.filter((item) => {
      if (overrideTargets.has(item.anatomyId)) return true;
      if (!canonicalTargetId || item.anatomyId !== canonicalTargetId) return false;
      // Ensure token compatibility if the query asks for a specific branch (e.g. "descending")
      const itemText = normalizeCandidateText(
        `${item.label} ${item.meshName} ${item.normalizedName || ''} ${item.groupLabel || ''}`
      );
      if (queryTokens.includes('descending') && !itemText.includes('descending')) {
        return false;
      }
      return true;
    });
    if (targetMatches.length > 0) {
      matches = targetMatches;
    }
  }

  // Tier 3: strict phrase containment on multi-token anatomical names (e.g. "lateral circumflex femoral artery")
  if (matches.length === 0 && queryTokens.length >= 2) {
    matches = catalog.filter((item) => {
      const hay = normalizeCandidateText(
        `${item.label} ${item.meshName} ${item.normalizedName || ''} ${item.groupLabel || ''}`
      );
      if (!hay) return false;
      // Require every query token to appear as a whole word in the structure name
      const hayWords = new Set(hay.split(' '));
      return queryTokens.every((t) => hayWords.has(t));
    });
  }

  if (matches.length === 0) {
    return {
      query: rawName,
      resolved: false,
      isLayerAlias: null,
      matchedMeshKeys: [],
      matchedLabels: [],
    };
  }

  // Prefer active donor side (plus midline structures); fall back to all matches if side absent
  const sidePreferred = matches.filter(
    (m) => m.laterality === donorSide || m.laterality === 'midline'
  );
  const finalMatches = sidePreferred.length > 0 ? sidePreferred : matches;

  const uniqueKeys = Array.from(new Set(finalMatches.map((m) => m.meshKey)));
  const uniqueLabels = Array.from(new Set(finalMatches.map((m) => m.label)));

  return {
    query: rawName,
    resolved: uniqueKeys.length > 0,
    isLayerAlias: null,
    matchedMeshKeys: uniqueKeys,
    matchedLabels: uniqueLabels,
  };
}

export interface ResolvedOperativeStepView {
  layerVisibilityPatch: Partial<Record<OperativeLayerKey, { visible: boolean; opacity?: number }>>;
  highlightMeshKeys: string[];
  hideMeshKeys: string[];
  cameraPreset: string | null;
  unresolvedNames: Array<{ source: 'step-highlight' | 'step-hide'; name: string }>;
}

const ANATOMY_TOGGLE_LAYERS: OperativeLayerKey[] = [
  'skin',
  'muscle',
  'arteries',
  'veins',
  'nerves',
  'fascia',
];

/**
 * Resolve a step's `view` block into concrete layer visibility settings,
 * sub-mesh highlight keys, sub-mesh hide keys, camera preset, and unresolved-name audit.
 */
export function resolveOperativeStepView(
  view: OperativeStepView,
  catalog: readonly LoadedStructureCatalogItem[],
  donorSide: DonorSide,
  customOverrides?: Record<string, CustomAnatomyOverride>
): ResolvedOperativeStepView {
  const requestedLayers = new Set<OperativeLayerKey>();
  for (const rawLayer of view.layers) {
    const mapped = mapOperativeLayerName(rawLayer);
    if (mapped) requestedLayers.add(mapped);
  }

  const hiddenLayers = new Set<OperativeLayerKey>();
  const hideMeshKeys = new Set<string>();
  const highlightMeshKeys = new Set<string>();
  const unresolvedNames: Array<{ source: 'step-highlight' | 'step-hide'; name: string }> = [];

  for (const rawHide of view.hide) {
    const res = resolveOperativeStructureName(rawHide, catalog, donorSide, customOverrides);
    if (res.isLayerAlias) {
      hiddenLayers.add(res.isLayerAlias);
    } else if (res.resolved) {
      for (const k of res.matchedMeshKeys) hideMeshKeys.add(k);
    } else {
      unresolvedNames.push({ source: 'step-hide', name: rawHide });
    }
  }

  for (const rawHi of view.highlight) {
    const res = resolveOperativeStructureName(rawHi, catalog, donorSide, customOverrides);
    if (res.isLayerAlias) {
      requestedLayers.add(res.isLayerAlias);
    } else if (res.resolved) {
      for (const k of res.matchedMeshKeys) highlightMeshKeys.add(k);
      // Automatically ensure the layer containing a highlighted structure is visible (unless explicitly hidden)
      for (const item of catalog) {
        if (!res.matchedMeshKeys.includes(item.meshKey)) continue;
        const sysLayer = mapOperativeLayerName(item.system);
        if (sysLayer && !hiddenLayers.has(sysLayer)) {
          requestedLayers.add(sysLayer);
        }
      }
    } else {
      unresolvedNames.push({ source: 'step-highlight', name: rawHi });
    }
  }

  const layerVisibilityPatch: Partial<
    Record<OperativeLayerKey, { visible: boolean; opacity?: number }>
  > = {};

  for (const lKey of ANATOMY_TOGGLE_LAYERS) {
    if (hiddenLayers.has(lKey)) {
      layerVisibilityPatch[lKey] = { visible: false };
    } else if (requestedLayers.has(lKey)) {
      // Keep skin translucent so underlying highlighted landmarks/muscles remain readable
      layerVisibilityPatch[lKey] =
        lKey === 'skin'
          ? { visible: true, opacity: requestedLayers.size > 1 || highlightMeshKeys.size > 0 ? 0.22 : 0.35 }
          : { visible: true };
    } else {
      layerVisibilityPatch[lKey] = { visible: false };
    }
  }

  // Keep skeleton visible as subtle anatomical reference unless explicitly hidden
  if (hiddenLayers.has('skeleton')) {
    layerVisibilityPatch.skeleton = { visible: false };
  } else {
    layerVisibilityPatch.skeleton = { visible: true };
  }

  return {
    layerVisibilityPatch,
    highlightMeshKeys: Array.from(highlightMeshKeys),
    hideMeshKeys: Array.from(hideMeshKeys),
    cameraPreset: mapOperativeCameraName(view.camera),
    unresolvedNames,
  };
}

/**
 * Audit every structure name referenced in an operative guide (steps + adjacent lists)
 * and return unresolved names for the Editor report.
 */
export function auditOperativeGuideUnresolvedNames(
  guide: OperativeGuide,
  flapId: string,
  catalog: readonly LoadedStructureCatalogItem[],
  donorSide: DonorSide,
  customOverrides?: Record<string, CustomAnatomyOverride>
): OperativeUnresolvedNameRecord[] {
  const results: OperativeUnresolvedNameRecord[] = [];
  const seen = new Set<string>();

  const pushUnique = (rec: OperativeUnresolvedNameRecord) => {
    const key = `${rec.flapId}|${rec.source}|${rec.stepN ?? ''}|${rec.name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(rec);
  };

  for (const step of guide.steps) {
    for (const name of step.view.highlight) {
      const res = resolveOperativeStructureName(name, catalog, donorSide, customOverrides);
      if (!res.resolved) {
        pushUnique({ flapId, source: 'step-highlight', stepN: step.n, name });
      }
    }
    for (const name of step.view.hide) {
      const res = resolveOperativeStructureName(name, catalog, donorSide, customOverrides);
      if (!res.resolved) {
        pushUnique({ flapId, source: 'step-hide', stepN: step.n, name });
      }
    }
  }

  for (const adj of guide.adjacent.perforator) {
    const res = resolveOperativeStructureName(adj.structure, catalog, donorSide, customOverrides);
    if (!res.resolved) {
      pushUnique({ flapId, source: 'adjacent-perforator', name: adj.structure });
    }
  }

  for (const adj of guide.adjacent.flap) {
    const res = resolveOperativeStructureName(adj.structure, catalog, donorSide, customOverrides);
    if (!res.resolved) {
      pushUnique({ flapId, source: 'adjacent-flap', name: adj.structure });
    }
  }

  return results;
}
