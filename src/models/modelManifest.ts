/**
 * Phase 10 (Revised) — Unified BodyParts3D 4.0 Anatomical Model Manifest
 *
 * All 7 active anatomical systems (`skeleton`, `muscles`, `skin`, `arteries`,
 * `veins`, `nerves`, `organs`) are re-exported from BodyParts3D Release 4.0 into
 * one unified coordinate system (metres, Y-up, +Z anterior, +X subject's left)
 * and fetched directly from `https://github.com/ralhaidhani/flapatlas-models`
 * via jsDelivr CDN with automatic fallback to GitHub Raw.
 */

export type AnatomicalSystemId =
  | 'skeleton'
  | 'muscles'
  | 'skin'
  | 'arteries'
  | 'veins'
  | 'nerves'
  | 'organs'
  | 'fascia'
  | 'other';

export type ModelSourceMode = 'auto' | 'cdn' | 'local' | 'uploaded' | 'procedural';
export type ModelLoadStage = 1 | 2 | 3;
export type LoadedFileSourceOrigin = 'GitHub' | 'Cache' | 'Local';

export interface ModelManifestEntry {
  id: string;
  system: AnatomicalSystemId;
  label: string;
  fileName: string;
  url: string;
  /** Automatic fallback URLs (e.g., GitHub Raw) if primary CDN fails or serves stale cache */
  fallbackUrls: string[];
  stage: ModelLoadStage;
  enabledByDefault: boolean;
  optional?: boolean;
  hiddenByDefault?: boolean;
  approxSizeMB: number;
  expectedNodes: number;
  sourceName: string;
  license: 'CC BY 4.0' | 'CC BY-SA 4.0';
  sourceUrl: string;
  attribution: string;
}

export interface AnatomicalSourceCredit {
  id: string;
  name: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  systemsCovered: string;
  requiredAttribution: string;
  modificationsNote: string;
  legacyOnly?: boolean;
}

export const GITHUB_MODELS_REPO_URL = 'https://github.com/ralhaidhani/flapatlas-models';

/**
 * Commit `83dc7045` on `main` holds the re-exported unified BodyParts3D 4.0 GLB files.
 * Pinning primary jsDelivr delivery to `@83dc7045` avoids stale `@main` CDN cache hits
 * while keeping `raw.githubusercontent.com/ralhaidhani/flapatlas-models/main/` as automatic fallback.
 */
export const BP3D_UNIFIED_COMMIT = '83dc7045';

export const DEFAULT_CDN_MODEL_BASE_URL = `https://cdn.jsdelivr.net/gh/ralhaidhani/flapatlas-models@${BP3D_UNIFIED_COMMIT}`;
export const DEFAULT_CDN_MAIN_MODEL_BASE_URL =
  'https://cdn.jsdelivr.net/gh/ralhaidhani/flapatlas-models@main';
export const DEFAULT_RAW_MODEL_BASE_URL =
  'https://raw.githubusercontent.com/ralhaidhani/flapatlas-models/main';
export const DEFAULT_LOCAL_MODEL_BASE_URL = '/models';
export const DEFAULT_DRACO_DECODER_PATH = '/draco/';

/**
 * Exact verbatim Phase 10 attribution required in About/Credits & footer.
 */
export const BODYPARTS3D_PHASE10_ATTRIBUTION =
  'Anatomical geometry: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International. Modified: converted from OBJ to glTF, axes and units transformed, split by body system, Draco-compressed, names normalised.';

/** Backward-compatible export alias */
export const BODYPARTS3D_CC_BY_4_ATTRIBUTION = BODYPARTS3D_PHASE10_ATTRIBUTION;

/**
 * Legacy Z-Anatomy attribution — displayed ONLY if a legacy Z-Anatomy file is actually loaded.
 */
export const Z_ANATOMY_REQUIRED_ATTRIBUTION =
  'Legacy Z-Anatomy override loaded: anatomical meshes derived from Z-Anatomy / BodyParts3D (© The Database Center for Life Science, CC BY-SA 4.0).';

export const SYSTEM_LOAD_ORDER: AnatomicalSystemId[] = [
  'skeleton',
  'muscles',
  'skin',
  'arteries',
  'veins',
  'nerves',
  'organs',
  'fascia',
  'other',
];

export const SYSTEM_DISPLAY_META: Record<
  AnatomicalSystemId,
  { label: string; shortLabel: string; description: string; defaultColorHex: string }
> = {
  skeleton: {
    label: 'Skeleton',
    shortLabel: 'Skeleton',
    description: 'Unified BodyParts3D 4.0 axial & appendicular bones (ivory PBR)',
    defaultColorHex: '#ede5d4',
  },
  muscles: {
    label: 'Muscles & Tendons',
    shortLabel: 'Muscles',
    description: 'Unified BodyParts3D 4.0 skeletal muscles (deep red) & tendons/aponeuroses (pearl)',
    defaultColorHex: '#942426',
  },
  skin: {
    label: 'Skin Envelope',
    shortLabel: 'Skin',
    description: 'Unified BodyParts3D 4.0 whole-body skin surface (translucent 15%)',
    defaultColorHex: '#ebd0be',
  },
  arteries: {
    label: 'Arteries',
    shortLabel: 'Arteries',
    description: 'Unified BodyParts3D 4.0 systemic & flap pedicle arteries (FMA/FJ indexed)',
    defaultColorHex: '#d62424',
  },
  veins: {
    label: 'Veins',
    shortLabel: 'Veins',
    description: 'Unified BodyParts3D 4.0 deep & superficial venous networks (FMA/FJ indexed)',
    defaultColorHex: '#1b4fb8',
  },
  nerves: {
    label: 'Nerves',
    shortLabel: 'Nerves',
    description: 'BodyParts3D 4.0 orbital & cranial branches (~34 meshes; peripheral nerves schematic)',
    defaultColorHex: '#e8c32a',
  },
  organs: {
    label: 'Organs & Viscera',
    shortLabel: 'Organs',
    description: 'Unified BodyParts3D 4.0 thoracic/abdominal viscera & hepatovenous segments (hidden by default)',
    defaultColorHex: '#d87986',
  },
  fascia: {
    label: 'Deep Fascia',
    shortLabel: 'Fascia',
    description: 'Investing fascia & intermuscular septa',
    defaultColorHex: '#e5e0d8',
  },
  other: {
    label: 'Auxiliary / Other',
    shortLabel: 'Other',
    description: 'Optional auxiliary archive (never loaded by default)',
    defaultColorHex: '#94a3b8',
  },
};

export const ANATOMICAL_MODEL_SOURCES: AnatomicalSourceCredit[] = [
  {
    id: 'bodyparts3d-4.0',
    name: 'BodyParts3D (Release 4.0)',
    author: 'The Database Center for Life Science (DBCLS)',
    license: 'CC Attribution 4.0 International (CC BY 4.0)',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://lifesciencedb.jp/bp3d/',
    systemsCovered:
      'Unified skeleton.glb, muscles.glb, skin.glb, arteries.glb, veins.glb, nerves.glb, organs.glb (all in shared 1:1 metre coordinates)',
    requiredAttribution: BODYPARTS3D_PHASE10_ATTRIBUTION,
    modificationsNote:
      'Converted from OBJ to glTF, axes and units transformed (Y-up, +Z anterior, +X subject left), split by body system, Draco-compressed, names normalised.',
  },
  {
    id: 'z-anatomy-legacy',
    name: 'Z-Anatomy (Legacy Override)',
    author: 'Gauthier Kervyn & BodyParts3D (DBCLS)',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://www.z-anatomy.com/',
    systemsCovered: 'Only active if a user explicitly loads a legacy Z-Anatomy .glb override',
    requiredAttribution: Z_ANATOMY_REQUIRED_ATTRIBUTION,
    modificationsNote: 'Not loaded by default in FlapAtlas Phase 10.',
    legacyOnly: true,
  },
];

interface BaseSystemSpec {
  id: string;
  system: AnatomicalSystemId;
  label: string;
  fileName: string;
  stage: ModelLoadStage;
  enabledByDefault: boolean;
  optional?: boolean;
  hiddenByDefault?: boolean;
  approxSizeMB: number;
  expectedNodes: number;
  license: 'CC BY 4.0' | 'CC BY-SA 4.0';
  sourceName: string;
  attribution: string;
}

const BASE_SYSTEM_SPECS: BaseSystemSpec[] = [
  {
    id: 'bp3d-skeleton',
    system: 'skeleton',
    label: 'Skeleton',
    fileName: 'skeleton.glb',
    stage: 1,
    enabledByDefault: true,
    approxSizeMB: 1.47,
    expectedNodes: 275,
    license: 'CC BY 4.0',
    sourceName: 'BodyParts3D 4.0',
    attribution: BODYPARTS3D_PHASE10_ATTRIBUTION,
  },
  {
    id: 'bp3d-muscles',
    system: 'muscles',
    label: 'Muscles',
    fileName: 'muscles.glb',
    stage: 1,
    enabledByDefault: true,
    approxSizeMB: 4.82,
    expectedNodes: 433,
    license: 'CC BY 4.0',
    sourceName: 'BodyParts3D 4.0',
    attribution: BODYPARTS3D_PHASE10_ATTRIBUTION,
  },
  {
    id: 'bp3d-skin',
    system: 'skin',
    label: 'Skin Envelope',
    fileName: 'skin.glb',
    stage: 2,
    enabledByDefault: true,
    approxSizeMB: 0.29,
    expectedNodes: 1,
    license: 'CC BY 4.0',
    sourceName: 'BodyParts3D 4.0',
    attribution: BODYPARTS3D_PHASE10_ATTRIBUTION,
  },
  {
    id: 'bp3d-arteries',
    system: 'arteries',
    label: 'Arteries',
    fileName: 'arteries.glb',
    stage: 2,
    enabledByDefault: true,
    approxSizeMB: 2.2,
    expectedNodes: 635,
    license: 'CC BY 4.0',
    sourceName: 'BodyParts3D 4.0',
    attribution: BODYPARTS3D_PHASE10_ATTRIBUTION,
  },
  {
    id: 'bp3d-veins',
    system: 'veins',
    label: 'Veins',
    fileName: 'veins.glb',
    stage: 2,
    enabledByDefault: true,
    approxSizeMB: 1.84,
    expectedNodes: 395,
    license: 'CC BY 4.0',
    sourceName: 'BodyParts3D 4.0',
    attribution: BODYPARTS3D_PHASE10_ATTRIBUTION,
  },
  {
    id: 'bp3d-nerves',
    system: 'nerves',
    label: 'Nerves',
    fileName: 'nerves.glb',
    stage: 2,
    enabledByDefault: true,
    approxSizeMB: 0.11,
    expectedNodes: 34,
    license: 'CC BY 4.0',
    sourceName: 'BodyParts3D 4.0',
    attribution: BODYPARTS3D_PHASE10_ATTRIBUTION,
  },
  {
    id: 'bp3d-organs',
    system: 'organs',
    label: 'Organs & Viscera',
    fileName: 'organs.glb',
    stage: 3,
    enabledByDefault: true,
    hiddenByDefault: true,
    approxSizeMB: 2.65,
    expectedNodes: 426,
    license: 'CC BY 4.0',
    sourceName: 'BodyParts3D 4.0',
    attribution: BODYPARTS3D_PHASE10_ATTRIBUTION,
  },
  {
    id: 'bp3d-other',
    system: 'other',
    label: 'Other / Auxiliary',
    fileName: 'other.glb',
    stage: 3,
    enabledByDefault: false,
    optional: true,
    approxSizeMB: 0.29,
    expectedNodes: 309,
    license: 'CC BY-SA 4.0',
    sourceName: 'Legacy Auxiliary',
    attribution: Z_ANATOMY_REQUIRED_ATTRIBUTION,
  },
];

/**
 * Builds the progressive manifest for a given base URL, always attaching GitHub Raw
 * (`raw.githubusercontent.com/ralhaidhani/flapatlas-models/main/<file>`) as automatic fallback.
 */
export function buildManifestForBaseUrl(
  baseUrl: string = DEFAULT_CDN_MODEL_BASE_URL,
  options?: { includeOptional?: boolean }
): ModelManifestEntry[] {
  const cleanBase = (baseUrl || DEFAULT_CDN_MODEL_BASE_URL).trim().replace(/\/+$/, '');
  const includeOptional = Boolean(options?.includeOptional);

  return BASE_SYSTEM_SPECS.filter((s) => s.enabledByDefault || includeOptional).map((spec) => {
    const primaryUrl = `${cleanBase}/${spec.fileName}`;
    const rawFallback = `${DEFAULT_RAW_MODEL_BASE_URL}/${spec.fileName}`;
    const cdnFallback = `${DEFAULT_CDN_MODEL_BASE_URL}/${spec.fileName}`;
    const fallbackUrls = [cdnFallback, rawFallback].filter(
      (u, idx, arr) => u !== primaryUrl && arr.indexOf(u) === idx
    );

    return {
      ...spec,
      url: primaryUrl,
      fallbackUrls,
      sourceUrl: GITHUB_MODELS_REPO_URL,
    };
  });
}

export const DEFAULT_MODEL_MANIFEST: ModelManifestEntry[] = buildManifestForBaseUrl(
  DEFAULT_CDN_MODEL_BASE_URL,
  { includeOptional: true }
);

/**
 * Returns the runtime Vite `BASE_URL` normalized with a trailing slash (e.g. `./` or `/`).
 * Safe in both browser and Node/tsx test runtimes.
 */
export function getBundledBaseUrl(): string {
  const envBase =
    typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL;
  const raw = typeof envBase === 'string' && envBase.trim().length > 0 ? envBase.trim() : './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * Returns the self-hosted Draco decoder directory derived from `import.meta.env.BASE_URL`.
 */
export function getBundledDracoPath(baseUrl: string = getBundledBaseUrl()): string {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalized}draco/`;
}

/**
 * Builds the offline-first local bundled model manifest served from `/public/models/`
 * (relative to `import.meta.env.BASE_URL`) with ZERO external CDN fallback URLs.
 * Stage 1 loads `skeleton.glb`, `muscles.glb`, and `skin.glb` so the body is immediately
 * usable while Stage 2 (`arteries`, `veins`, `nerves`) and Stage 3 (`organs`) finish.
 */
export function buildLocalBundledManifest(
  baseUrl: string = getBundledBaseUrl()
): ModelManifestEntry[] {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const modelsBase = `${normalized}models`;
  return BASE_SYSTEM_SPECS.filter((s) => s.enabledByDefault).map((spec) => ({
    ...spec,
    stage: spec.system === 'skin' ? 1 : spec.stage,
    url: `${modelsBase}/${spec.fileName}`,
    fallbackUrls: [],
    sourceName: 'Bundled BodyParts3D 4.0 (Offline)',
    sourceUrl: `${modelsBase}/${spec.fileName}`,
  }));
}

export interface OfflinePackFileSpec {
  id: string;
  relativePath: string;
  label: string;
  tier: 'core' | 'extended';
  kind: 'glb' | 'json' | 'draco';
  system?: AnatomicalSystemId;
  approxBytes: number;
}

/**
 * Complete static offline pack required for 100% zero-network operation after one online launch.
 * "Offline ready ✓" is only shown when every single entry below is cached.
 */
export const OFFLINE_PACK_REQUIRED_FILES: OfflinePackFileSpec[] = [
  // Core tier: app becomes usable as soon as skeleton + muscles + skin + Draco are cached
  {
    id: 'draco-wasm',
    relativePath: 'draco/draco_decoder.wasm',
    label: 'Draco WASM Decoder',
    tier: 'core',
    kind: 'draco',
    approxBytes: 192_000,
  },
  {
    id: 'draco-wrapper',
    relativePath: 'draco/draco_wasm_wrapper.js',
    label: 'Draco WASM Wrapper',
    tier: 'core',
    kind: 'draco',
    approxBytes: 59_000,
  },
  {
    id: 'draco-js',
    relativePath: 'draco/draco_decoder.js',
    label: 'Draco JS Fallback',
    tier: 'core',
    kind: 'draco',
    approxBytes: 513_000,
  },
  {
    id: 'model-skeleton',
    relativePath: 'models/skeleton.glb',
    label: 'Skeleton 3D Mesh',
    tier: 'core',
    kind: 'glb',
    system: 'skeleton',
    approxBytes: 1_540_000,
  },
  {
    id: 'model-muscles',
    relativePath: 'models/muscles.glb',
    label: 'Muscles 3D Mesh',
    tier: 'core',
    kind: 'glb',
    system: 'muscles',
    approxBytes: 5_060_000,
  },
  {
    id: 'model-skin',
    relativePath: 'models/skin.glb',
    label: 'Skin Envelope 3D Mesh',
    tier: 'core',
    kind: 'glb',
    system: 'skin',
    approxBytes: 304_000,
  },
  // Extended tier: finishes in background while app is already interactive
  {
    id: 'model-arteries',
    relativePath: 'models/arteries.glb',
    label: 'Arteries 3D Mesh',
    tier: 'extended',
    kind: 'glb',
    system: 'arteries',
    approxBytes: 2_310_000,
  },
  {
    id: 'model-veins',
    relativePath: 'models/veins.glb',
    label: 'Veins 3D Mesh',
    tier: 'extended',
    kind: 'glb',
    system: 'veins',
    approxBytes: 1_930_000,
  },
  {
    id: 'model-nerves',
    relativePath: 'models/nerves.glb',
    label: 'Nerves 3D Mesh',
    tier: 'extended',
    kind: 'glb',
    system: 'nerves',
    approxBytes: 112_000,
  },
  {
    id: 'model-organs',
    relativePath: 'models/organs.glb',
    label: 'Organs & Viscera 3D Mesh',
    tier: 'extended',
    kind: 'glb',
    system: 'organs',
    approxBytes: 2_780_000,
  },
  {
    id: 'data-vessel-index',
    relativePath: 'models/vessel_index.json',
    label: 'Vessel Index',
    tier: 'extended',
    kind: 'json',
    approxBytes: 924_000,
  },
  {
    id: 'data-flap-pedicle-map',
    relativePath: 'models/flap_pedicle_map.json',
    label: 'Flap Pedicle Map',
    tier: 'extended',
    kind: 'json',
    approxBytes: 6_200,
  },
  {
    id: 'data-angiosome-map',
    relativePath: 'models/angiosome_bp3d_map.json',
    label: 'Angiosome Map',
    tier: 'extended',
    kind: 'json',
    approxBytes: 19_500,
  },
  {
    id: 'data-muscle-reference',
    relativePath: 'models/muscle_reference.json',
    label: 'Muscle Reference Atlas',
    tier: 'extended',
    kind: 'json',
    approxBytes: 28_000,
  },
];

export const STAGE_LABELS: Record<ModelLoadStage, string> = {
  1: 'Stage 1: Skeleton, Muscles & Skin (BodyParts3D 4.0)',
  2: 'Stage 2: Arteries, Veins & Nerves',
  3: 'Stage 3: Viscera & Organs (hidden by default)',
};

export interface ManifestStageGroup {
  stage: ModelLoadStage;
  label: string;
  entries: ModelManifestEntry[];
}

export function groupManifestByStage(entries: ModelManifestEntry[]): ManifestStageGroup[] {
  const stages: ModelLoadStage[] = [1, 2, 3];
  const groups: ManifestStageGroup[] = [];
  for (const stage of stages) {
    const stageEntries = entries.filter((e) => e.stage === stage);
    if (stageEntries.length > 0) {
      groups.push({
        stage,
        label: STAGE_LABELS[stage],
        entries: stageEntries,
      });
    }
  }
  return groups;
}

/**
 * Infers which AnatomicalSystemId a user-uploaded GLB filename corresponds to.
 */
export function inferSystemFromFilename(fileName: string): AnatomicalSystemId {
  const lower = fileName.toLowerCase();
  if (/artery|arteries|arterial|aorta/.test(lower)) return 'arteries';
  if (/vein|veins|venous|vena/.test(lower)) return 'veins';
  if (/skin|integument|surface|body_shell/.test(lower)) return 'skin';
  if (/skel|bone|osteo/.test(lower)) return 'skeleton';
  if (/musc|myo|tendon/.test(lower)) return 'muscles';
  if (/fascia/.test(lower)) return 'fascia';
  if (/nerv|neuro|plexus/.test(lower)) return 'nerves';
  if (/organ|viscer|cardio|heart|lung|liver|kidney|digest|resp/.test(lower)) return 'organs';
  return 'other';
}
