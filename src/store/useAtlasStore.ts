import { create } from 'zustand';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { INITIAL_FLAPS, REGIONS, VESSELS } from '../data/index';
import type { AdvisorInput } from '../engine/advisorEngine';
import type { FlashcardProgress, QuizQuestionHistory, SrsRating } from '../engine/learningEngine';
import { scheduleFlashcardReview } from '../engine/learningEngine';
import type { CustomAnatomyOverride, Laterality, MeshMappingReport } from '../models/anatomyMap';
import {
  ClippingAxis,
  ClippingAxisState,
  ClippingPlanesConfig,
  computeStructureFocusCamera,
  DEFAULT_CLIPPING_PLANES,
} from '../models/clippingAndSearch';
import {
  ANCHOR_MODEL_VERSION,
  AnchorCalibrationMap,
  DEFAULT_ANCHORS,
  detectStaleAnchorCalibration,
  LandmarkAnchor,
  mergeAnchorsWithCalibration,
  parseAnchorsImportJson,
} from '../models/anchorSystem';
import type { LoadedSystemFileStats } from '../models/glbLoader';
import type { AnatomicalSystemId } from '../models/modelManifest';
import {
  AlignmentDiagnosticsSummary,
  clampVesselAlignment,
  DEFAULT_VESSEL_ALIGNMENT,
  VesselAlignmentTransform,
} from '../models/vesselAlignment';
import {
  DEFAULT_VESSEL_PRESET_ID,
  DEFAULT_VESSEL_SIDE_FILTER,
  isValidVesselPresetId,
  isValidVesselSideFilter,
  VesselFilterStats,
  VesselPresetId,
  VesselSideFilter,
} from '../models/vesselDeclutter';
import {
  DEFAULT_DONOR_SIDE,
  DonorSide,
  isValidDonorSide,
  ResolvedFlapVesselsResult,
} from '../models/flapVesselLinker';
import {
  findFlapsUsingVessel,
  IndexedLoadedVessel,
} from '../models/vesselSearch';
import type { TerritoryCalibrationReport } from '../models/territoryCalibration';
import {
  computeTerritoryDepthLayerPatch,
  type TerritoryMode,
  type TerritorySideFilter,
} from '../models/territorySearch';
import {
  clearStoredDopplerPlannerMarkers,
  createDopplerPlannerMarker,
  loadDopplerPlannerMarkers,
  saveDopplerPlannerMarkers,
  type CreateDopplerMarkerInput,
  type DopplerPlannerMarker,
} from '../models/dopplerPlanner';
import { FlapRecord, FlapRecordSchema } from '../types/schemas';
import type { UnmappedMuscleReportItem } from '../data/muscleReference';
import type { OperativeUnresolvedNameRecord } from '../data/operative/schema';
import type {
  LoadedStructureCatalogItem,
  OperativeLayerKey,
} from '../data/operative/structureResolver';

export type AppTab =
  | 'library'
  | 'layers'
  | 'anatomy'
  | 'advisor'
  | 'compare'
  | 'tools'
  | 'simulators'
  | 'quiz'
  | 'planner'
  | 'glossary'
  | 'calibration'
  | 'settings'
  | 'about';

export type ThemeMode = 'light' | 'dark' | 'or-dim';
export type UnitSystem = 'metric' | 'imperial';
export type BodySex = 'female' | 'male';
export type AnimationMode = 'none' | 'arc' | 'transfer';
export type ModelSourceMode = 'auto' | 'procedural' | 'remote' | 'uploaded';
export type SheetSnap = 'collapsed' | 'half' | 'full';
export type RenderQuality = 'quality' | 'balanced' | 'fast';
export type LayersSubTab = 'layers' | 'vessels' | 'clipping' | 'territories' | 'view';
export type ToolsSubTab = 'simulators' | 'planner' | 'calibration';

export interface ViewerContextMenuTarget {
  x: number;
  y: number;
  label: string;
  anatomyInfo?: SelectedAnatomyInfo | null;
  territoryId?: string | null;
  territorySide?: TerritorySideFilter;
  schematicMuscleId?: string | null;
  flapId?: string | null;
  meshKeys?: string[];
  partMeshKey?: string;
  partLabel?: string;
  system?: AnatomicalSystemId;
  laterality?: Laterality;
  isMultiPart?: boolean;
}

export interface HiddenItemRecord {
  id: string;
  label: string;
  side: Laterality;
  system: AnatomicalSystemId;
  meshKeys: string[];
  partOnly?: boolean;
}

export interface VisibilitySnapshot {
  hiddenItems: HiddenItemRecord[];
  isolatedMeshKeys: string[];
  isolatedLabel: string | null;
  isolateKeepSkeleton: boolean;
  ghostOthersKeys: string[];
  ghostOthersLabel: string | null;
}

export const EMPTY_VISIBILITY_SNAPSHOT: VisibilitySnapshot = {
  hiddenItems: [],
  isolatedMeshKeys: [],
  isolatedLabel: null,
  isolateKeepSkeleton: true,
  ghostOthersKeys: [],
  ghostOthersLabel: null,
};

export interface OperativeViewState {
  active: boolean;
  flapId: string | null;
  stepN: number | null;
  highlightMeshKeys: string[];
  hideMeshKeys: string[];
  cameraPreset: string | null;
  frameNonce: number;
}

export const EMPTY_OPERATIVE_VIEW_STATE: OperativeViewState = {
  active: false,
  flapId: null,
  stepN: null,
  highlightMeshKeys: [],
  hideMeshKeys: [],
  cameraPreset: null,
  frameNonce: 0,
};

const MAX_VISIBILITY_HISTORY = 20;
const VISIBILITY_SESSION_KEY = 'flapatlas_visibility_session_v1';

function cloneVisibilitySnapshot(snap: VisibilitySnapshot): VisibilitySnapshot {
  return {
    hiddenItems: snap.hiddenItems.map((h) => ({ ...h, meshKeys: [...h.meshKeys] })),
    isolatedMeshKeys: [...snap.isolatedMeshKeys],
    isolatedLabel: snap.isolatedLabel,
    isolateKeepSkeleton: snap.isolateKeepSkeleton,
    ghostOthersKeys: [...snap.ghostOthersKeys],
    ghostOthersLabel: snap.ghostOthersLabel,
  };
}

function loadSessionVisibilityState(): {
  visibilityState: VisibilitySnapshot;
  visibilityUndoStack: VisibilitySnapshot[];
  visibilityRedoStack: VisibilitySnapshot[];
} {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(VISIBILITY_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<{
          visibilityState: VisibilitySnapshot;
          visibilityUndoStack: VisibilitySnapshot[];
          visibilityRedoStack: VisibilitySnapshot[];
        }>;
        if (parsed.visibilityState && Array.isArray(parsed.visibilityState.hiddenItems)) {
          return {
            visibilityState: {
              ...EMPTY_VISIBILITY_SNAPSHOT,
              ...parsed.visibilityState,
            },
            visibilityUndoStack: Array.isArray(parsed.visibilityUndoStack)
              ? parsed.visibilityUndoStack.slice(-MAX_VISIBILITY_HISTORY)
              : [],
            visibilityRedoStack: Array.isArray(parsed.visibilityRedoStack)
              ? parsed.visibilityRedoStack.slice(-MAX_VISIBILITY_HISTORY)
              : [],
          };
        }
      }
    }
  } catch {
    // Ignore malformed sessionStorage
  }
  return {
    visibilityState: cloneVisibilitySnapshot(EMPTY_VISIBILITY_SNAPSHOT),
    visibilityUndoStack: [],
    visibilityRedoStack: [],
  };
}

function saveSessionVisibilityState(payload: {
  visibilityState: VisibilitySnapshot;
  visibilityUndoStack: VisibilitySnapshot[];
  visibilityRedoStack: VisibilitySnapshot[];
}): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(VISIBILITY_SESSION_KEY, JSON.stringify(payload));
    }
  } catch {
    // Ignore storage errors
  }
}

const INITIAL_SESSION_VISIBILITY = loadSessionVisibilityState();

export interface ActiveModelStats {
  mode: 'procedural' | 'real-glb';
  sourceLabel: string;
  loadedSystems: AnatomicalSystemId[];
  loadedFiles?: LoadedSystemFileStats[];
  hasLegacyZAnatomy?: boolean;
  totalMeshes: number;
  drawCallCount?: number;
  orientationRotatedY?: boolean;
  mappedMeshes: number;
  normalizedHeightCm: number;
  scaleFactor: number;
  sourceHeightUnits: number;
}

export interface ModelLoadProgressState {
  active: boolean;
  stageLabel: string;
  loadedCount: number;
  totalCount: number;
  pct: number;
  currentFile?: string;
  currentSourceUrl?: string;
  fromCache?: boolean;
  loadedBytes?: number;
  totalBytes?: number;
  failedSystems: Array<{ system: string; error: string }>;
  error: string | null;
}

export type TerritoryFieldStatus = 'idle' | 'building' | 'ready' | 'error';

export interface TerritoryFieldMeta {
  fromCache: boolean;
  cacheKey: string;
  dims: [number, number, number];
  voxelSizeMm: number;
  buildMs: number;
  realSeedTerritoryCount: number;
  schematicSeedTerritoryCount: number;
  clusterCount: number;
  isWebGL2: boolean;
}

export type { TerritoryMode, TerritorySideFilter };

export interface TerritoryLayerSnapshot {
  layers: LayersConfig;
  dissectionPeel: number;
  show3DLabels: boolean;
  vesselPreset: VesselPresetId;
  vesselSideFilter: VesselSideFilter;
  ghostUnselected: boolean;
}

export interface PinnedTerritoryLabel {
  territoryId: string;
  side: 'left' | 'right' | 'midline';
  worldPos: [number, number, number];
}

export type LayerKey =
  | 'skin'
  | 'fat'
  | 'fascia'
  | 'muscle'
  | 'organs'
  | 'skeleton'
  | 'arteries'
  | 'veins'
  | 'nerves'
  | 'lymphatics'
  | 'perforators'
  | 'angiosomes'
  | 'perforasomes'
  | 'landmarks'
  | 'paddle'
  | 'cuttingGuides';

export interface SelectedAnatomyPartSummary {
  meshKey: string;
  label: string;
  meshName: string;
  fjCode?: string;
  fmaCode?: string;
}

export interface SelectedAnatomyInfo {
  id: string;
  label: string;
  category: string;
  laterality?: Laterality;
  meshName?: string;
  system?: AnatomicalSystemId;
  mapped?: boolean;
  linkedFlapIds?: string[];
  subMeshKey?: string;
  isSchematic?: boolean;
  sourceModel?: 'z-anatomy' | 'bodyparts3d';
  fjCode?: string;
  fmaCode?: string;
  groupId?: string;
  groupLabel?: string;
  constituentParts?: SelectedAnatomyPartSummary[];
  center?: [number, number, number];
  boundsMin?: [number, number, number];
  boundsMax?: [number, number, number];
}

export interface LayerState {
  visible: boolean;
  opacity: number; // 0 to 1
}

export type LayersConfig = Record<LayerKey, LayerState>;

export interface FlapCollection {
  id: string;
  name: string;
  flapIds: string[];
}

export interface SavedSurgicalCase {
  id: string;
  title: string;
  updatedAtIso: string;
  defectLocId: string;
  defectDimensions: string;
  primaryFlapId: string;
  backupFlapId: string;
  recipientVessel: string;
  positioningOverride: string;
  operativeNotes: string;
  checklistItems: Array<{ text: string; checked: boolean }>;
  photoDataUrl: string | null;
}

export const DEFAULT_COLLECTIONS: FlapCollection[] = [
  {
    id: 'col-workhorses',
    name: 'Microsurgery Workhorses',
    flapIds: ['alt-flap', 'diep-flap', 'rfff-flap', 'fibula-flap', 'ld-flap', 'gracilis-flap'],
  },
  {
    id: 'col-board-high-yield',
    name: 'Board High-Yield',
    flapIds: ['gastrocnemius-flap', 'pec-major-flap', 'paramedian-forehead-flap', 'famm-flap', 'pap-flap', 'sgap-flap'],
  },
  {
    id: 'col-limb-salvage',
    name: 'Lower Extremity Salvage',
    flapIds: ['gastrocnemius-flap', 'soleus-flap', 'reverse-sural-flap', 'alt-flap', 'ptap-flap', 'peroneal-perforator-flap'],
  },
];

export const DEFAULT_LAYERS: LayersConfig = {
  skin: { visible: true, opacity: 0.15 },
  fat: { visible: false, opacity: 0.25 },
  fascia: { visible: false, opacity: 0.35 },
  muscle: { visible: true, opacity: 0.82 },
  organs: { visible: false, opacity: 0.92 },
  skeleton: { visible: true, opacity: 0.92 },
  arteries: { visible: true, opacity: 1.0 },
  veins: { visible: true, opacity: 1.0 },
  nerves: { visible: true, opacity: 0.95 },
  lymphatics: { visible: false, opacity: 0.85 },
  perforators: { visible: true, opacity: 1.0 },
  angiosomes: { visible: false, opacity: 0.35 },
  perforasomes: { visible: true, opacity: 0.45 },
  landmarks: { visible: true, opacity: 1.0 },
  paddle: { visible: true, opacity: 0.92 },
  cuttingGuides: { visible: true, opacity: 1.0 },
};

const STORAGE_KEYS = {
  flaps: 'flapatlas_custom_flaps_v1',
  prefs: 'flapatlas_prefs_v1',
  notes: 'flapatlas_notes_v1',
  favorites: 'flapatlas_favorites_v1',
  collections: 'flapatlas_collections_v1',
  tags: 'flapatlas_tags_v1',
  highlights: 'flapatlas_highlights_v1',
  quizHistory: 'flapatlas_quiz_history_v1',
  flashcards: 'flapatlas_flashcards_v1',
  cases: 'flapatlas_saved_cases_v1',
  anatomyOverrides: 'flapatlas_anatomy_overrides_v1',
  modelConfig: 'flapatlas_model_config_v1',
  anchors: 'flapatlas_anchors_v1',
  vesselAlignment: 'flapatlas_vessel_alignment_v1',
  territoryVisualWeights: 'flapatlas_territory_visual_weights_v1',
};

async function safeStorageGet<T>(key: string): Promise<T | null> {
  try {
    const val = await idbGet<T>(key);
    if (val !== undefined) return val;
  } catch {
    // Fallback to localStorage
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function safeStorageSet(key: string, value: unknown): Promise<void> {
  try {
    await idbSet(key, value);
  } catch {
    // Fallback to localStorage
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

async function safeStorageDel(key: string): Promise<void> {
  try {
    await idbDel(key);
  } catch {
    // Ignore
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

function applyThemeClass(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('dark', 'or-dim');
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'or-dim') {
    root.classList.add('dark', 'or-dim');
  }
}

export interface AtlasStore {
  // Data
  flaps: FlapRecord[];
  hydrated: boolean;

  // Navigation & Selection
  activeTab: AppTab;
  selectedFlapId: string;
  hasSelectedFlap: boolean;
  flapsSheetMode: 'list' | 'detail';
  sheetSnap: SheetSnap;
  menuOpen: boolean;
  layersSubTab: LayersSubTab;
  toolsSubTab: ToolsSubTab;
  viewerContextMenu: ViewerContextMenuTarget | null;
  selectedVesselId: string | null;
  selectedAnatomyInfo: SelectedAnatomyInfo | null;
  advisorPreviewDefectId: string | null;
  advisorDefectSizeCm: [number, number] | null;
  advisorDraftOverride: AdvisorInput | null;
  searchPaletteOpen: boolean;
  helpModalOpen: boolean;
  assistantOpen: boolean;
  assistantInitialPrompt: string | null;

  // User study tools (Phase 6 expanded)
  compareIds: string[];
  favoriteIds: string[];
  collections: FlapCollection[];
  notesByFlapId: Record<string, string>;
  tagsByFlapId: Record<string, string[]>;
  highlightsByFlapId: Record<string, string[]>;
  quizHistory: Record<string, QuizQuestionHistory>;
  flashcardProgress: Record<string, FlashcardProgress>;
  savedCases: SavedSurgicalCase[];
  recentSearches: string[];

  // Preferences
  theme: ThemeMode;
  renderQuality: RenderQuality;
  unitSystem: UnitSystem;
  colorblindMode: boolean;
  teachingMode: boolean;
  editorMode: boolean;
  bodySex: BodySex;

  // 3D Viewport controls
  activeCameraPreset: string;
  cameraRequestNonce: number;
  cameraFocusRequest: {
    pos: [number, number, number];
    target: [number, number, number];
    nonce: number;
  } | null;
  layers: LayersConfig;
  dissectionPeel: number; // 0 (full skin) to 100 (deep bone/vessels)
  clippingPlanes: ClippingPlanesConfig;
  ghostUnselected: boolean;
  editorUnmappedSearchSeed: string;
  pendingStructureFocusMeshName: string | null;
  animationMode: AnimationMode;
  techniqueStep: number; // 0 = overview, 1..N = step highlights
  measureMode: boolean;
  hudCollapsed: boolean;
  show3DLabels: boolean;
  showPipView: boolean;
  customGlbUrl: string | null;
  customGlbName: string | null;
  modelSourceMode: ModelSourceMode;
  remoteModelBaseUrl: string;
  modelReloadNonce: number;
  customAnatomyOverrides: Record<string, CustomAnatomyOverride>;
  meshMappingReport: MeshMappingReport | null;
  activeModelStats: ActiveModelStats | null;
  modelLoadProgress: ModelLoadProgressState;
  anchors: LandmarkAnchor[];
  calibratingAnchorId: string | null;
  anchorsNeedRecalibration: boolean;
  autoProposeAnchorsNonce: number;
  vesselAlignment: VesselAlignmentTransform;
  savedVesselAlignment: VesselAlignmentTransform;
  vesselAlignmentSavedAtIso: string | null;
  alignmentDiagnostics: AlignmentDiagnosticsSummary | null;
  calibrationViewActive: boolean;
  calibrationViewSavedLayers: LayersConfig | null;
  alignmentPanelOpen: boolean;
  vesselPreset: VesselPresetId;
  vesselSideFilter: VesselSideFilter;
  vesselFilterStats: VesselFilterStats | null;
  donorSide: DonorSide;
  resolvedFlapVessels: ResolvedFlapVesselsResult | null;
  loadedVessels: IndexedLoadedVessel[];
  libraryRegionFilter: string;
  libraryVesselFilter: string;
  flapHistory: string[];
  flapHistoryIndex: number;

  // Phase 11b — Vascular Territory Field Engine (background voxel field + calibration audit)
  territoryFieldStatus: TerritoryFieldStatus;
  territoryFieldProgress: { pct: number; label: string };
  territoryFieldMeta: TerritoryFieldMeta | null;
  territoryFieldError: string | null;
  /** Editor-only visual tuning constants for Voronoi borders (NOT clinical measurements) */
  territoryVisualWeights: Record<string, number>;
  territoryFieldRebuildNonce: number;
  territoryCalibrationReport: TerritoryCalibrationReport | null;
  territoryUnresolvedFjs: Array<{ territoryId: string; missingFjs: string[] }>;

  // Phase 11c — Vascular Territories interactive mode & UI state
  territoryMode: TerritoryMode;
  territorySheetOpen: boolean;
  territoryOpacity: number;
  territorySideFilter: TerritorySideFilter;
  territoryDepth: number; // 0 = Skin, 50 = Deep Muscle, 100 = Bone
  focusedTerritoryId: string | null;
  focusedTerritorySide: TerritorySideFilter;
  showTerritoryNeighbors: boolean;
  isolateTerritoryArtery: boolean;
  pinnedTerritoryLabel: PinnedTerritoryLabel | null;
  territoryLayerSnapshot: TerritoryLayerSnapshot | null;
  territoryFocusNonce: number;
  territoryDelayHours: number;
  // Phase 11d — Selected schematic outline ID for muscles absent from BP3D 4.0
  selectedSchematicMuscleId: string | null;
  // Phase 11e — Perforator corridors, flap perforasome jigsaw glow & local-only Doppler/CTA planner
  showPerforatorCorridors: boolean;
  showFlapPerforasomes: boolean;
  plannerDropMode: boolean;
  dopplerPlannerMarkers: DopplerPlannerMarker[];
  selectedPlannerMarkerId: string | null;

  // Phase 12-2 — Muscle reference popup, Hide/Isolate/Ghost + 20-step Undo/Redo & Editor unmapped muscles
  selectedMuscleRefId: string | null;
  muscleRefFrameNonce: number;
  highlightedMuscleVesselKeys: string[];
  unmappedMusclesReport: UnmappedMuscleReportItem[];
  visibilityState: VisibilitySnapshot;
  visibilityUndoStack: VisibilitySnapshot[];
  visibilityRedoStack: VisibilitySnapshot[];

  // Phase 12-3 — Operative guide 3D view sync, layer snapshot/restore & Editor unresolved report
  loadedStructuresCatalog: LoadedStructureCatalogItem[];
  operativeViewState: OperativeViewState;
  operativeSavedLayers: LayersConfig | null;
  operativeUnresolvedReport: OperativeUnresolvedNameRecord[];

  // Actions
  hydrateFromStorage: () => Promise<void>;
  setActiveTab: (tab: AppTab, targetSnap?: SheetSnap) => void;
  setSheetSnap: (snap: SheetSnap) => void;
  setMenuOpen: (open: boolean) => void;
  setFlapsSheetMode: (mode: 'list' | 'detail') => void;
  setLayersSubTab: (sub: LayersSubTab) => void;
  setToolsSubTab: (sub: ToolsSubTab) => void;
  setViewerContextMenu: (target: ViewerContextMenuTarget | null) => void;
  selectFlap: (flapId: string, focusCamera?: boolean) => void;
  goBackFlap: () => void;
  goForwardFlap: () => void;
  selectVessel: (vesselId: string | null, focusCamera?: boolean) => void;
  setSelectedAnatomyInfo: (info: SelectedAnatomyInfo | null) => void;
  setAdvisorPreviewDefectId: (defectId: string | null) => void;
  setAdvisorDefectSizeCm: (sizeCm: [number, number] | null) => void;
  applyAdvisorDraft: (input: AdvisorInput) => void;
  clearAdvisorDraftOverride: () => void;
  setSearchPaletteOpen: (open: boolean) => void;
  setHelpModalOpen: (open: boolean) => void;
  openAssistant: (prompt?: string) => void;
  closeAssistant: () => void;

  toggleCompare: (flapId: string) => void;
  setCompareIds: (ids: string[]) => void;
  toggleFavorite: (flapId: string) => void;
  saveNote: (flapId: string, note: string) => void;
  addTagToFlap: (flapId: string, tag: string) => void;
  removeTagFromFlap: (flapId: string, tag: string) => void;
  addHighlightToFlap: (flapId: string, text: string) => void;
  removeHighlightFromFlap: (flapId: string, index: number) => void;
  createCollection: (name: string) => string;
  deleteCollection: (collectionId: string) => void;
  toggleFlapInCollection: (collectionId: string, flapId: string) => void;
  recordQuizAnswer: (questionId: string, isCorrect: boolean) => void;
  resetQuizHistory: () => void;
  reviewFlashcard: (flapId: string, rating: SrsRating) => void;
  resetFlashcardProgress: () => void;
  saveSurgicalCase: (caseItem: SavedSurgicalCase) => void;
  deleteSurgicalCase: (caseId: string) => void;
  addRecentSearch: (term: string) => void;

  setTheme: (theme: ThemeMode) => void;
  setRenderQuality: (quality: RenderQuality) => void;
  setUnitSystem: (unit: UnitSystem) => void;
  setColorblindMode: (enabled: boolean) => void;
  setTeachingMode: (enabled: boolean) => void;
  setEditorMode: (enabled: boolean) => void;
  setBodySex: (sex: BodySex) => void;

  setCameraPreset: (presetId: string) => void;
  flyToCameraGoal: (pos: [number, number, number], target: [number, number, number]) => void;
  setLayer: (key: LayerKey, patch: Partial<LayerState>) => void;
  setDissectionPeel: (value: number) => void;
  setClippingAxis: (axis: ClippingAxis, patch: Partial<ClippingAxisState>) => void;
  resetClippingPlanes: () => void;
  setGhostUnselected: (enabled: boolean) => void;
  openEditorForUnmappedMesh: (meshName: string) => void;
  clearEditorUnmappedSearchSeed: () => void;
  focusStructureIn3D: (meshName: string) => void;
  clearPendingStructureFocus: () => void;
  setAnimationMode: (mode: AnimationMode) => void;
  setTechniqueStep: (step: number) => void;
  setMeasureMode: (enabled: boolean) => void;
  setHudCollapsed: (collapsed: boolean) => void;
  setShow3DLabels: (show: boolean) => void;
  setShowPipView: (show: boolean) => void;
  setCustomGlb: (url: string | null, name?: string | null) => void;
  setModelSourceMode: (mode: ModelSourceMode) => void;
  setRemoteModelBaseUrl: (url: string) => void;
  triggerModelReload: () => void;
  saveAnatomyOverride: (override: CustomAnatomyOverride) => void;
  removeAnatomyOverride: (meshName: string) => void;
  clearAnatomyOverrides: () => void;
  setMeshMappingReport: (report: MeshMappingReport | null) => void;
  setActiveModelStats: (stats: ActiveModelStats | null) => void;
  setModelLoadProgress: (progress: ModelLoadProgressState) => void;
  setCalibratingAnchorId: (anchorId: string | null) => void;
  setAnchorPosition: (
    anchorId: string,
    position: [number, number, number],
    snappedSkeletonMesh?: string
  ) => void;
  resetAnchor: (anchorId: string) => void;
  resetAllAnchors: () => void;
  applyAnchorOverrides: (overrides: AnchorCalibrationMap) => void;
  requestAutoProposeAnchors: () => void;
  dismissAnchorRecalibrationBanner: () => void;
  importAnchorsJson: (rawJson: string) => Promise<{ ok: boolean; message: string; count?: number }>;
  openCalibrationPage: () => void;
  setVesselAlignment: (patch: Partial<VesselAlignmentTransform>) => void;
  saveVesselAlignment: () => Promise<void>;
  resetVesselAlignment: () => Promise<void>;
  setAlignmentDiagnostics: (diag: AlignmentDiagnosticsSummary | null) => void;
  setAlignmentPanelOpen: (open: boolean) => void;
  toggleCalibrationView: (forceState?: boolean) => void;
  setVesselPreset: (preset: VesselPresetId) => void;
  setVesselSideFilter: (side: VesselSideFilter) => void;
  setVesselFilterStats: (stats: VesselFilterStats | null) => void;
  setDonorSide: (side: DonorSide) => void;
  setResolvedFlapVessels: (res: ResolvedFlapVesselsResult | null) => void;
  setLoadedVessels: (vessels: IndexedLoadedVessel[]) => void;
  focusLoadedVessel: (vessel: IndexedLoadedVessel, targetTab?: 'anatomy' | 'library') => void;
  setLibraryRegionFilter: (regionGroup: string) => void;
  setLibraryVesselFilter: (vesselId: string) => void;
  reset3DView: () => void;

  // Phase 11b — Territory field actions
  setTerritoryFieldBuildState: (patch: {
    status?: TerritoryFieldStatus;
    progress?: { pct: number; label: string };
    meta?: TerritoryFieldMeta | null;
    error?: string | null;
    calibrationReport?: TerritoryCalibrationReport | null;
    unresolvedFjs?: Array<{ territoryId: string; missingFjs: string[] }>;
  }) => void;
  setTerritoryVisualWeight: (territoryId: string, weight: number) => void;
  resetTerritoryVisualWeights: () => void;
  requestTerritoryFieldRebuild: () => void;

  // Phase 11c — Vascular Territories mode actions
  setTerritoryMode: (mode: TerritoryMode) => void;
  setTerritorySheetOpen: (open: boolean) => void;
  setTerritoryOpacity: (opacity: number) => void;
  setTerritorySideFilter: (side: TerritorySideFilter) => void;
  setTerritoryDepth: (depth: number) => void;
  focusTerritory: (
    territoryId: string | null,
    side?: TerritorySideFilter,
    flyCamera?: boolean
  ) => void;
  setShowTerritoryNeighbors: (show: boolean) => void;
  setIsolateTerritoryArtery: (isolate: boolean) => void;
  setPinnedTerritoryLabel: (pinned: PinnedTerritoryLabel | null) => void;
  setTerritoryDelayHours: (hours: number) => void;
  openTerritoryFromSearch: (territoryId: string) => void;
  setSelectedSchematicMuscleId: (outlineId: string | null) => void;

  // Phase 11e — Perforator corridors & local-only Doppler / CTA planner actions
  setShowPerforatorCorridors: (show: boolean) => void;
  setShowFlapPerforasomes: (show: boolean) => void;
  setPlannerDropMode: (enabled: boolean) => void;
  addDopplerPlannerMarker: (input: CreateDopplerMarkerInput) => DopplerPlannerMarker;
  updateDopplerPlannerMarker: (
    id: string,
    patch: Partial<
      Pick<
        DopplerPlannerMarker,
        'label' | 'side' | 'midlineMm' | 'inferiorUmbilicusMm' | 'sizeMm' | 'modality' | 'notes'
      >
    >
  ) => void;
  deleteDopplerPlannerMarker: (id: string) => void;
  clearDopplerPlannerMarkers: () => void;
  setSelectedPlannerMarkerId: (id: string | null) => void;

  // Phase 12-2 — Muscle reference & Hide/Isolate/Ghost actions
  selectMuscleRef: (
    muscleId: string | null,
    opts?: { openSheet?: boolean; frameIn3D?: boolean }
  ) => void;
  setHighlightedMuscleVesselKeys: (keys: string[]) => void;
  setUnmappedMusclesReport: (items: UnmappedMuscleReportItem[]) => void;
  hideSubMeshes: (input: {
    id: string;
    label: string;
    side: Laterality;
    system: AnatomicalSystemId;
    meshKeys: string[];
    partOnly?: boolean;
  }) => void;
  isolateSubMeshes: (keys: string[], label: string, keepSkeleton?: boolean) => void;
  setIsolateKeepSkeleton: (keep: boolean) => void;
  ghostOthersForSubMeshes: (keys: string[], label: string) => void;
  restoreHiddenItem: (itemId: string) => void;
  restoreIsolationAndGhost: () => void;
  restoreAllVisibility: () => void;
  undoVisibility: () => void;
  redoVisibility: () => void;

  // Phase 12-3 — Operative guide actions
  setLoadedStructuresCatalog: (items: LoadedStructureCatalogItem[]) => void;
  applyOperativeStepView: (input: {
    flapId: string;
    stepN: number;
    layerVisibilityPatch: Partial<Record<OperativeLayerKey, { visible: boolean; opacity?: number }>>;
    highlightMeshKeys: string[];
    hideMeshKeys: string[];
    cameraPreset: string | null;
  }) => void;
  highlightOperativeStructures: (input: {
    flapId: string;
    meshKeys: string[];
    ensureLayers?: OperativeLayerKey[];
  }) => void;
  clearOperativeView: () => void;
  setOperativeUnresolvedReport: (items: OperativeUnresolvedNameRecord[]) => void;

  // Data CRUD & persistence
  updateFlap: (updated: FlapRecord) => Promise<void>;
  createFlap: (created: FlapRecord) => Promise<void>;
  importFlapsJson: (rawJson: string) => Promise<{ ok: boolean; message: string; count?: number }>;
  resetDataset: () => Promise<void>;
}

export const useAtlasStore = create<AtlasStore>((set, get) => ({
  flaps: INITIAL_FLAPS,
  hydrated: false,

  activeTab: 'library',
  selectedFlapId: 'alt-flap',
  hasSelectedFlap: false,
  flapsSheetMode: 'list',
  sheetSnap: 'collapsed',
  menuOpen: false,
  layersSubTab: 'layers',
  toolsSubTab: 'simulators',
  viewerContextMenu: null,
  selectedVesselId: null,
  selectedAnatomyInfo: null,
  advisorPreviewDefectId: null,
  advisorDefectSizeCm: null,
  advisorDraftOverride: null,
  searchPaletteOpen: false,
  helpModalOpen: false,
  assistantOpen: false,
  assistantInitialPrompt: null,

  compareIds: ['alt-flap', 'diep-flap'],
  favoriteIds: [],
  collections: DEFAULT_COLLECTIONS,
  notesByFlapId: {},
  tagsByFlapId: {},
  highlightsByFlapId: {},
  quizHistory: {},
  flashcardProgress: {},
  savedCases: [],
  recentSearches: ['DIEP', 'ALT', 'Fibula', 'Gastrocnemius'],

  theme: 'dark',
  renderQuality: 'balanced',
  unitSystem: 'metric',
  colorblindMode: false,
  teachingMode: false,
  editorMode: false,
  bodySex: 'female',

  activeCameraPreset: 'anterior-full',
  cameraRequestNonce: 0,
  cameraFocusRequest: null,
  layers: DEFAULT_LAYERS,
  dissectionPeel: 28,
  clippingPlanes: DEFAULT_CLIPPING_PLANES,
  ghostUnselected: true,
  editorUnmappedSearchSeed: '',
  pendingStructureFocusMeshName: null,
  animationMode: 'none',
  techniqueStep: 0,
  measureMode: false,
  hudCollapsed: false,
  show3DLabels: true,
  showPipView: false,
  customGlbUrl: null,
  customGlbName: null,
  modelSourceMode: 'auto',
  remoteModelBaseUrl: '',
  modelReloadNonce: 0,
  customAnatomyOverrides: {},
  meshMappingReport: null,
  activeModelStats: null,
  modelLoadProgress: {
    active: false,
    stageLabel: '',
    loadedCount: 0,
    totalCount: 0,
    pct: 0,
    failedSystems: [],
    error: null,
  },
  anchors: DEFAULT_ANCHORS,
  calibratingAnchorId: null,
  anchorsNeedRecalibration: false,
  autoProposeAnchorsNonce: 0,
  vesselAlignment: DEFAULT_VESSEL_ALIGNMENT,
  savedVesselAlignment: DEFAULT_VESSEL_ALIGNMENT,
  vesselAlignmentSavedAtIso: null,
  alignmentDiagnostics: null,
  calibrationViewActive: false,
  calibrationViewSavedLayers: null,
  alignmentPanelOpen: false,
  vesselPreset: DEFAULT_VESSEL_PRESET_ID,
  vesselSideFilter: DEFAULT_VESSEL_SIDE_FILTER,
  vesselFilterStats: null,
  donorSide: DEFAULT_DONOR_SIDE,
  resolvedFlapVessels: null,
  loadedVessels: [],
  libraryRegionFilter: 'All',
  libraryVesselFilter: 'All',
  flapHistory: ['alt-flap'],
  flapHistoryIndex: 0,

  territoryFieldStatus: 'idle',
  territoryFieldProgress: { pct: 0, label: '' },
  territoryFieldMeta: null,
  territoryFieldError: null,
  territoryVisualWeights: {},
  territoryFieldRebuildNonce: 0,
  territoryCalibrationReport: null,
  territoryUnresolvedFjs: [],

  territoryMode: 'off',
  territorySheetOpen: false,
  territoryOpacity: 0.78,
  territorySideFilter: 'both',
  territoryDepth: 0,
  focusedTerritoryId: null,
  focusedTerritorySide: 'both',
  showTerritoryNeighbors: false,
  isolateTerritoryArtery: false,
  pinnedTerritoryLabel: null,
  territoryLayerSnapshot: null,
  territoryFocusNonce: 0,
  territoryDelayHours: 0,
  selectedSchematicMuscleId: null,
  showPerforatorCorridors: true,
  showFlapPerforasomes: true,
  plannerDropMode: false,
  dopplerPlannerMarkers: [],
  selectedPlannerMarkerId: null,

  selectedMuscleRefId: null,
  muscleRefFrameNonce: 0,
  highlightedMuscleVesselKeys: [],
  unmappedMusclesReport: [],
  visibilityState: INITIAL_SESSION_VISIBILITY.visibilityState,
  visibilityUndoStack: INITIAL_SESSION_VISIBILITY.visibilityUndoStack,
  visibilityRedoStack: INITIAL_SESSION_VISIBILITY.visibilityRedoStack,

  loadedStructuresCatalog: [],
  operativeViewState: { ...EMPTY_OPERATIVE_VIEW_STATE },
  operativeSavedLayers: null,
  operativeUnresolvedReport: [],

  hydrateFromStorage: async () => {
    const [
      storedFlaps,
      storedPrefs,
      storedNotes,
      storedFavorites,
      storedCollections,
      storedTags,
      storedHighlights,
      storedQuizHistory,
      storedFlashcards,
      storedCases,
      storedAnatomyOverrides,
      storedModelConfig,
      storedAnchors,
      storedVesselAlignment,
      storedTerritoryWeights,
      storedDopplerMarkers,
    ] = await Promise.all([
      safeStorageGet<Record<string, FlapRecord>>(STORAGE_KEYS.flaps),
      safeStorageGet<{
        theme?: ThemeMode;
        renderQuality?: RenderQuality;
        unitSystem?: UnitSystem;
        colorblindMode?: boolean;
        bodySex?: BodySex;
        vesselPreset?: VesselPresetId;
        vesselSideFilter?: VesselSideFilter;
        donorSide?: DonorSide;
      }>(STORAGE_KEYS.prefs),
      safeStorageGet<Record<string, string>>(STORAGE_KEYS.notes),
      safeStorageGet<string[]>(STORAGE_KEYS.favorites),
      safeStorageGet<FlapCollection[]>(STORAGE_KEYS.collections),
      safeStorageGet<Record<string, string[]>>(STORAGE_KEYS.tags),
      safeStorageGet<Record<string, string[]>>(STORAGE_KEYS.highlights),
      safeStorageGet<Record<string, QuizQuestionHistory>>(STORAGE_KEYS.quizHistory),
      safeStorageGet<Record<string, FlashcardProgress>>(STORAGE_KEYS.flashcards),
      safeStorageGet<SavedSurgicalCase[]>(STORAGE_KEYS.cases),
      safeStorageGet<Record<string, CustomAnatomyOverride>>(STORAGE_KEYS.anatomyOverrides),
      safeStorageGet<{ modelSourceMode?: ModelSourceMode; remoteModelBaseUrl?: string }>(
        STORAGE_KEYS.modelConfig
      ),
      safeStorageGet<AnchorCalibrationMap>(STORAGE_KEYS.anchors),
      safeStorageGet<{
        transform?: Partial<VesselAlignmentTransform>;
        savedAtIso?: string;
      }>(STORAGE_KEYS.vesselAlignment),
      safeStorageGet<Record<string, number>>(STORAGE_KEYS.territoryVisualWeights),
      loadDopplerPlannerMarkers(),
    ]);

    let mergedFlaps = INITIAL_FLAPS;
    if (storedFlaps && typeof storedFlaps === 'object') {
      const overrides = new Map<string, FlapRecord>();
      for (const [id, rec] of Object.entries(storedFlaps)) {
        const parsed = FlapRecordSchema.safeParse(rec);
        if (parsed.success) {
          overrides.set(id, parsed.data);
        }
      }
      mergedFlaps = INITIAL_FLAPS.map((f) => {
        const ov = overrides.get(f.id);
        if (!ov) return f;
        return !ov.real_vessel_map_key && f.real_vessel_map_key
          ? { ...ov, real_vessel_map_key: f.real_vessel_map_key }
          : ov;
      });
      for (const [id, rec] of overrides.entries()) {
        if (!INITIAL_FLAPS.some((f) => f.id === id)) {
          mergedFlaps.push(rec);
        }
      }
    }

    const theme: ThemeMode = storedPrefs?.theme || 'dark';
    applyThemeClass(theme);
    const renderQuality: RenderQuality =
      storedPrefs?.renderQuality === 'quality' ||
      storedPrefs?.renderQuality === 'balanced' ||
      storedPrefs?.renderQuality === 'fast'
        ? storedPrefs.renderQuality
        : 'balanced';

    let initialFlapId = get().selectedFlapId;
    let initialHasSelectedFlap = get().hasSelectedFlap;
    let initialCamera = get().activeCameraPreset;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qFlap = params.get('flap');
      if (qFlap && mergedFlaps.some((f) => f.id === qFlap)) {
        initialFlapId = qFlap;
        initialHasSelectedFlap = true;
        const found = mergedFlaps.find((f) => f.id === qFlap);
        if (found && REGIONS.some((r) => r.id === found.spec3d.regionId)) {
          initialCamera = found.spec3d.regionId;
        }
      }
    }

    set({
      flaps: mergedFlaps,
      hydrated: true,
      selectedFlapId: initialFlapId,
      hasSelectedFlap: initialHasSelectedFlap,
      activeCameraPreset: initialCamera,
      theme,
      renderQuality,
      unitSystem: storedPrefs?.unitSystem || 'metric',
      colorblindMode: storedPrefs?.colorblindMode || false,
      bodySex: storedPrefs?.bodySex || 'female',
      vesselPreset: isValidVesselPresetId(storedPrefs?.vesselPreset)
        ? storedPrefs.vesselPreset
        : DEFAULT_VESSEL_PRESET_ID,
      vesselSideFilter: isValidVesselSideFilter(storedPrefs?.vesselSideFilter)
        ? storedPrefs.vesselSideFilter
        : DEFAULT_VESSEL_SIDE_FILTER,
      donorSide: isValidDonorSide(storedPrefs?.donorSide)
        ? storedPrefs.donorSide
        : DEFAULT_DONOR_SIDE,
      notesByFlapId: storedNotes || {},
      favoriteIds: storedFavorites || [],
      collections:
        Array.isArray(storedCollections) && storedCollections.length > 0
          ? storedCollections
          : DEFAULT_COLLECTIONS,
      tagsByFlapId: storedTags || {},
      highlightsByFlapId: storedHighlights || {},
      quizHistory: storedQuizHistory || {},
      flashcardProgress: storedFlashcards || {},
      savedCases: Array.isArray(storedCases) ? storedCases : [],
      customAnatomyOverrides: storedAnatomyOverrides || {},
      modelSourceMode: storedModelConfig?.modelSourceMode || 'auto',
      remoteModelBaseUrl: storedModelConfig?.remoteModelBaseUrl || '',
      anchors: mergeAnchorsWithCalibration(DEFAULT_ANCHORS, storedAnchors),
      anchorsNeedRecalibration: detectStaleAnchorCalibration(storedAnchors).hasStaleEntries,
      vesselAlignment: storedVesselAlignment?.transform
        ? clampVesselAlignment(storedVesselAlignment.transform)
        : DEFAULT_VESSEL_ALIGNMENT,
      savedVesselAlignment: storedVesselAlignment?.transform
        ? clampVesselAlignment(storedVesselAlignment.transform)
        : DEFAULT_VESSEL_ALIGNMENT,
      vesselAlignmentSavedAtIso: storedVesselAlignment?.savedAtIso || null,
      territoryVisualWeights:
        storedTerritoryWeights && typeof storedTerritoryWeights === 'object'
          ? storedTerritoryWeights
          : {},
      dopplerPlannerMarkers: Array.isArray(storedDopplerMarkers) ? storedDopplerMarkers : [],
    });
  },

  setActiveTab: (tab, targetSnap) =>
    set((s) => {
      if (tab === 'simulators' || tab === 'planner' || tab === 'calibration') {
        return {
          activeTab: 'tools',
          toolsSubTab: tab,
          ...(targetSnap ? { sheetSnap: targetSnap } : {}),
        };
      }
      return {
        activeTab: tab,
        ...(targetSnap ? { sheetSnap: targetSnap } : {}),
      };
    }),

  setSheetSnap: (sheetSnap) => set({ sheetSnap }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setFlapsSheetMode: (flapsSheetMode) => set({ flapsSheetMode }),
  setLayersSubTab: (layersSubTab) => set({ layersSubTab }),
  setToolsSubTab: (toolsSubTab) => set({ toolsSubTab }),
  setViewerContextMenu: (viewerContextMenu) => set({ viewerContextMenu }),

  selectFlap: (flapId, focusCamera = true) => {
    const flap = get().flaps.find((f) => f.id === flapId);
    if (!flap) return;
    const regionExists = REGIONS.some((r) => r.id === flap.spec3d.regionId);
    set((s) => {
      const currentAtIdx = s.flapHistory[s.flapHistoryIndex];
      const shouldPush = currentAtIdx !== flapId;
      const nextHistory = shouldPush
        ? [...s.flapHistory.slice(0, s.flapHistoryIndex + 1), flapId].slice(-20)
        : s.flapHistory;
      const nextIndex = shouldPush ? nextHistory.length - 1 : s.flapHistoryIndex;
      return {
        selectedFlapId: flapId,
        hasSelectedFlap: true,
        flapsSheetMode: 'detail',
        sheetSnap: s.sheetSnap === 'collapsed' ? 'half' : s.sheetSnap,
        selectedVesselId: null,
        selectedAnatomyInfo: null,
        selectedMuscleRefId: null,
        highlightedMuscleVesselKeys: [],
        techniqueStep: 0,
        animationMode: 'none',
        flapHistory: nextHistory,
        flapHistoryIndex: nextIndex,
        activeCameraPreset:
          focusCamera && regionExists ? flap.spec3d.regionId : s.activeCameraPreset,
        cameraRequestNonce: focusCamera ? s.cameraRequestNonce + 1 : s.cameraRequestNonce,
      };
    });
  },

  goBackFlap: () => {
    const s = get();
    if (s.flapHistoryIndex <= 0) return;
    const nextIdx = s.flapHistoryIndex - 1;
    const targetId = s.flapHistory[nextIdx];
    const flap = s.flaps.find((f) => f.id === targetId);
    if (!flap) return;
    const regionExists = REGIONS.some((r) => r.id === flap.spec3d.regionId);
    set({
      selectedFlapId: targetId,
      hasSelectedFlap: true,
      flapsSheetMode: 'detail',
      flapHistoryIndex: nextIdx,
      techniqueStep: 0,
      animationMode: 'none',
      activeCameraPreset: regionExists ? flap.spec3d.regionId : s.activeCameraPreset,
      cameraRequestNonce: s.cameraRequestNonce + 1,
    });
  },

  goForwardFlap: () => {
    const s = get();
    if (s.flapHistoryIndex >= s.flapHistory.length - 1) return;
    const nextIdx = s.flapHistoryIndex + 1;
    const targetId = s.flapHistory[nextIdx];
    const flap = s.flaps.find((f) => f.id === targetId);
    if (!flap) return;
    const regionExists = REGIONS.some((r) => r.id === flap.spec3d.regionId);
    set({
      selectedFlapId: targetId,
      hasSelectedFlap: true,
      flapsSheetMode: 'detail',
      flapHistoryIndex: nextIdx,
      techniqueStep: 0,
      animationMode: 'none',
      activeCameraPreset: regionExists ? flap.spec3d.regionId : s.activeCameraPreset,
      cameraRequestNonce: s.cameraRequestNonce + 1,
    });
  },

  selectVessel: (vesselId, focusCamera = true) => {
    if (!vesselId) {
      set({ selectedVesselId: null });
      return;
    }
    const vessel = VESSELS.find((v) => v.id === vesselId);
    const regionExists = vessel && REGIONS.some((r) => r.id === vessel.regionId);
    set((s) => ({
      selectedVesselId: vesselId,
      sheetSnap: s.sheetSnap === 'collapsed' ? 'half' : s.sheetSnap,
      activeCameraPreset: focusCamera && regionExists ? vessel!.regionId : s.activeCameraPreset,
      cameraRequestNonce: focusCamera ? s.cameraRequestNonce + 1 : s.cameraRequestNonce,
    }));
  },

  setSelectedAnatomyInfo: (info) =>
    set((s) => ({
      selectedAnatomyInfo: info,
      ...(info
        ? {
            selectedSchematicMuscleId: null,
            selectedMuscleRefId: null,
            highlightedMuscleVesselKeys: [],
            sheetSnap: s.sheetSnap === 'collapsed' ? 'half' : s.sheetSnap,
          }
        : {
            highlightedMuscleVesselKeys: [],
          }),
      ...(info && s.territoryMode !== 'off' ? { focusedTerritoryId: null } : {}),
    })),
  setAdvisorPreviewDefectId: (defectId) => set({ advisorPreviewDefectId: defectId }),
  setAdvisorDefectSizeCm: (sizeCm) => set({ advisorDefectSizeCm: sizeCm }),
  applyAdvisorDraft: (input) =>
    set((s) => ({
      advisorDraftOverride: input,
      activeTab: 'advisor',
      sheetSnap: s.sheetSnap === 'collapsed' ? 'half' : s.sheetSnap,
      assistantOpen: false,
    })),
  clearAdvisorDraftOverride: () => set({ advisorDraftOverride: null }),
  setSearchPaletteOpen: (open) => set({ searchPaletteOpen: open }),
  setHelpModalOpen: (open) => set({ helpModalOpen: open }),
  openAssistant: (prompt) =>
    set({ assistantOpen: true, assistantInitialPrompt: prompt ?? null }),
  closeAssistant: () => set({ assistantOpen: false, assistantInitialPrompt: null }),

  toggleCompare: (flapId) =>
    set((s) => {
      if (s.compareIds.includes(flapId)) {
        return { compareIds: s.compareIds.filter((id) => id !== flapId) };
      }
      if (s.compareIds.length >= 4) {
        return { compareIds: [...s.compareIds.slice(1), flapId] };
      }
      return { compareIds: [...s.compareIds, flapId] };
    }),

  setCompareIds: (ids) => set({ compareIds: ids.slice(0, 4) }),

  toggleFavorite: (flapId) => {
    const next = get().favoriteIds.includes(flapId)
      ? get().favoriteIds.filter((id) => id !== flapId)
      : [...get().favoriteIds, flapId];
    set({ favoriteIds: next });
    void safeStorageSet(STORAGE_KEYS.favorites, next);
  },

  saveNote: (flapId, note) => {
    const next = { ...get().notesByFlapId, [flapId]: note };
    set({ notesByFlapId: next });
    void safeStorageSet(STORAGE_KEYS.notes, next);
  },

  addTagToFlap: (flapId, rawTag) => {
    const clean = rawTag.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 28);
    if (!clean) return;
    const existing = get().tagsByFlapId[flapId] || [];
    if (existing.includes(clean)) return;
    const next = { ...get().tagsByFlapId, [flapId]: [...existing, clean] };
    set({ tagsByFlapId: next });
    void safeStorageSet(STORAGE_KEYS.tags, next);
  },

  removeTagFromFlap: (flapId, tag) => {
    const existing = get().tagsByFlapId[flapId] || [];
    const next = {
      ...get().tagsByFlapId,
      [flapId]: existing.filter((t) => t !== tag),
    };
    set({ tagsByFlapId: next });
    void safeStorageSet(STORAGE_KEYS.tags, next);
  },

  addHighlightToFlap: (flapId, text) => {
    const clean = text.trim();
    if (!clean) return;
    const existing = get().highlightsByFlapId[flapId] || [];
    if (existing.includes(clean)) return;
    const next = { ...get().highlightsByFlapId, [flapId]: [clean, ...existing].slice(0, 12) };
    set({ highlightsByFlapId: next });
    void safeStorageSet(STORAGE_KEYS.highlights, next);
  },

  removeHighlightFromFlap: (flapId, index) => {
    const existing = get().highlightsByFlapId[flapId] || [];
    const next = {
      ...get().highlightsByFlapId,
      [flapId]: existing.filter((_, idx) => idx !== index),
    };
    set({ highlightsByFlapId: next });
    void safeStorageSet(STORAGE_KEYS.highlights, next);
  },

  createCollection: (name) => {
    const clean = name.trim().slice(0, 40);
    if (!clean) return '';
    const id = `col-${Date.now().toString(36)}`;
    const next = [...get().collections, { id, name: clean, flapIds: [] }];
    set({ collections: next });
    void safeStorageSet(STORAGE_KEYS.collections, next);
    return id;
  },

  deleteCollection: (collectionId) => {
    const next = get().collections.filter((c) => c.id !== collectionId);
    set({ collections: next });
    void safeStorageSet(STORAGE_KEYS.collections, next);
  },

  toggleFlapInCollection: (collectionId, flapId) => {
    const next = get().collections.map((c) => {
      if (c.id !== collectionId) return c;
      const has = c.flapIds.includes(flapId);
      return {
        ...c,
        flapIds: has ? c.flapIds.filter((id) => id !== flapId) : [...c.flapIds, flapId],
      };
    });
    set({ collections: next });
    void safeStorageSet(STORAGE_KEYS.collections, next);
  },

  recordQuizAnswer: (questionId, isCorrect) => {
    const cur = get().quizHistory[questionId];
    const next: Record<string, QuizQuestionHistory> = {
      ...get().quizHistory,
      [questionId]: {
        attempts: (cur?.attempts || 0) + 1,
        correct: (cur?.correct || 0) + (isCorrect ? 1 : 0),
        lastCorrect: isCorrect,
        lastAnsweredIso: new Date().toISOString(),
      },
    };
    set({ quizHistory: next });
    void safeStorageSet(STORAGE_KEYS.quizHistory, next);
  },

  resetQuizHistory: () => {
    set({ quizHistory: {} });
    void safeStorageDel(STORAGE_KEYS.quizHistory);
  },

  reviewFlashcard: (flapId, rating) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const updated = scheduleFlashcardReview(
      flapId,
      get().flashcardProgress[flapId],
      rating,
      todayIso
    );
    const next = { ...get().flashcardProgress, [flapId]: updated };
    set({ flashcardProgress: next });
    void safeStorageSet(STORAGE_KEYS.flashcards, next);
  },

  resetFlashcardProgress: () => {
    set({ flashcardProgress: {} });
    void safeStorageDel(STORAGE_KEYS.flashcards);
  },

  saveSurgicalCase: (caseItem) => {
    const existing = get().savedCases;
    const idx = existing.findIndex((c) => c.id === caseItem.id);
    const next =
      idx >= 0
        ? existing.map((c, i) => (i === idx ? caseItem : c))
        : [caseItem, ...existing];
    set({ savedCases: next });
    void safeStorageSet(STORAGE_KEYS.cases, next);
  },

  deleteSurgicalCase: (caseId) => {
    const next = get().savedCases.filter((c) => c.id !== caseId);
    set({ savedCases: next });
    void safeStorageSet(STORAGE_KEYS.cases, next);
  },

  addRecentSearch: (term) => {
    const clean = term.trim();
    if (!clean) return;
    set((s) => ({
      recentSearches: [clean, ...s.recentSearches.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 6),
    }));
  },

  setTheme: (theme) => {
    applyThemeClass(theme);
    set({ theme });
    const s = get();
    void safeStorageSet(STORAGE_KEYS.prefs, {
      theme,
      renderQuality: s.renderQuality,
      unitSystem: s.unitSystem,
      colorblindMode: s.colorblindMode,
      bodySex: s.bodySex,
      vesselPreset: s.vesselPreset,
      vesselSideFilter: s.vesselSideFilter,
      donorSide: s.donorSide,
    });
  },

  setRenderQuality: (renderQuality) => {
    set({ renderQuality });
    const s = get();
    void safeStorageSet(STORAGE_KEYS.prefs, {
      theme: s.theme,
      renderQuality,
      unitSystem: s.unitSystem,
      colorblindMode: s.colorblindMode,
      bodySex: s.bodySex,
      vesselPreset: s.vesselPreset,
      vesselSideFilter: s.vesselSideFilter,
      donorSide: s.donorSide,
    });
  },

  setUnitSystem: (unitSystem) => {
    set({ unitSystem });
    const s = get();
    void safeStorageSet(STORAGE_KEYS.prefs, {
      theme: s.theme,
      renderQuality: s.renderQuality,
      unitSystem,
      colorblindMode: s.colorblindMode,
      bodySex: s.bodySex,
      vesselPreset: s.vesselPreset,
      vesselSideFilter: s.vesselSideFilter,
      donorSide: s.donorSide,
    });
  },

  setColorblindMode: (colorblindMode) => {
    set({ colorblindMode });
    const s = get();
    void safeStorageSet(STORAGE_KEYS.prefs, {
      theme: s.theme,
      renderQuality: s.renderQuality,
      unitSystem: s.unitSystem,
      colorblindMode,
      bodySex: s.bodySex,
      vesselPreset: s.vesselPreset,
      vesselSideFilter: s.vesselSideFilter,
      donorSide: s.donorSide,
    });
  },

  setTeachingMode: (teachingMode) => set({ teachingMode }),
  setEditorMode: (editorMode) => set({ editorMode }),

  setBodySex: (bodySex) => {
    set({ bodySex });
    const s = get();
    void safeStorageSet(STORAGE_KEYS.prefs, {
      theme: s.theme,
      renderQuality: s.renderQuality,
      unitSystem: s.unitSystem,
      colorblindMode: s.colorblindMode,
      bodySex,
      vesselPreset: s.vesselPreset,
      vesselSideFilter: s.vesselSideFilter,
      donorSide: s.donorSide,
    });
  },

  setCameraPreset: (presetId) =>
    set((s) => ({
      activeCameraPreset: presetId,
      cameraRequestNonce: s.cameraRequestNonce + 1,
    })),

  flyToCameraGoal: (pos, target) =>
    set((s) => ({
      cameraFocusRequest: {
        pos,
        target,
        nonce: (s.cameraFocusRequest?.nonce ?? 0) + 1,
      },
    })),

  setLayer: (key, patch) =>
    set((s) => ({
      layers: {
        ...s.layers,
        [key]: { ...s.layers[key], ...patch },
      },
    })),

  setDissectionPeel: (value) => {
    const v = Math.max(0, Math.min(100, value));
    const skinOpacity = Math.max(0.05, 0.85 * (1 - v / 55));
    const muscleOpacity = v < 42 ? 0.85 : Math.max(0.1, 0.85 * (1 - (v - 42) / 52));
    const organsOpacity = v < 68 ? 0.92 : Math.max(0.15, 0.92 * (1 - (v - 68) / 36));
    set((s) => ({
      dissectionPeel: v,
      layers: {
        ...s.layers,
        skin: { visible: v < 72, opacity: Number(skinOpacity.toFixed(2)) },
        muscle: { visible: v < 90, opacity: Number(muscleOpacity.toFixed(2)) },
        organs: { visible: v < 98, opacity: Number(organsOpacity.toFixed(2)) },
      },
    }));
  },

  setClippingAxis: (axis, patch) =>
    set((s) => ({
      clippingPlanes: {
        ...s.clippingPlanes,
        [axis]: { ...s.clippingPlanes[axis], ...patch },
      },
    })),

  resetClippingPlanes: () => set({ clippingPlanes: DEFAULT_CLIPPING_PLANES }),
  setGhostUnselected: (ghostUnselected) => set({ ghostUnselected }),

  openEditorForUnmappedMesh: (meshName) =>
    set({
      editorMode: true,
      editorUnmappedSearchSeed: meshName,
      activeTab: 'settings',
    }),

  clearEditorUnmappedSearchSeed: () => set({ editorUnmappedSearchSeed: '' }),

  focusStructureIn3D: (meshName) =>
    set({
      activeTab: 'library',
      pendingStructureFocusMeshName: meshName,
    }),

  clearPendingStructureFocus: () => set({ pendingStructureFocusMeshName: null }),

  setAnimationMode: (animationMode) => set({ animationMode }),
  setTechniqueStep: (techniqueStep) => set({ techniqueStep }),
  setMeasureMode: (measureMode) => set({ measureMode }),
  setHudCollapsed: (hudCollapsed) => set({ hudCollapsed }),
  setShow3DLabels: (show3DLabels) => set({ show3DLabels }),
  setShowPipView: (showPipView) => set({ showPipView }),
  setCustomGlb: (customGlbUrl, customGlbName = null) => set({ customGlbUrl, customGlbName }),
  setModelSourceMode: (modelSourceMode) => {
    set((s) => ({ modelSourceMode, modelReloadNonce: s.modelReloadNonce + 1 }));
    void safeStorageSet(STORAGE_KEYS.modelConfig, {
      modelSourceMode,
      remoteModelBaseUrl: get().remoteModelBaseUrl,
    });
  },
  setRemoteModelBaseUrl: (remoteModelBaseUrl) => {
    const cleaned = remoteModelBaseUrl.trim();
    set((s) => ({
      remoteModelBaseUrl: cleaned,
      modelSourceMode: cleaned ? 'remote' : s.modelSourceMode,
      modelReloadNonce: s.modelReloadNonce + 1,
    }));
    void safeStorageSet(STORAGE_KEYS.modelConfig, {
      modelSourceMode: cleaned ? 'remote' : get().modelSourceMode,
      remoteModelBaseUrl: cleaned,
    });
  },
  triggerModelReload: () => set((s) => ({ modelReloadNonce: s.modelReloadNonce + 1 })),
  saveAnatomyOverride: (override) => {
    const next = { ...get().customAnatomyOverrides, [override.meshName]: override };
    set((s) => ({
      customAnatomyOverrides: next,
      modelReloadNonce: s.modelReloadNonce + 1,
    }));
    void safeStorageSet(STORAGE_KEYS.anatomyOverrides, next);
  },
  removeAnatomyOverride: (meshName) => {
    const next = { ...get().customAnatomyOverrides };
    delete next[meshName];
    set((s) => ({
      customAnatomyOverrides: next,
      modelReloadNonce: s.modelReloadNonce + 1,
    }));
    void safeStorageSet(STORAGE_KEYS.anatomyOverrides, next);
  },
  clearAnatomyOverrides: () => {
    set((s) => ({ customAnatomyOverrides: {}, modelReloadNonce: s.modelReloadNonce + 1 }));
    void safeStorageDel(STORAGE_KEYS.anatomyOverrides);
  },
  setMeshMappingReport: (meshMappingReport) => set({ meshMappingReport }),
  setActiveModelStats: (activeModelStats) => set({ activeModelStats }),
  setModelLoadProgress: (modelLoadProgress) => set({ modelLoadProgress }),

  setCalibratingAnchorId: (calibratingAnchorId) => set({ calibratingAnchorId }),

  setAnchorPosition: (anchorId, position, snappedSkeletonMesh) => {
    const cleanPos: [number, number, number] = [
      Number(position[0].toFixed(4)),
      Number(position[1].toFixed(4)),
      Number(position[2].toFixed(4)),
    ];
    const updatedAtIso = new Date().toISOString();
    const nextAnchors = get().anchors.map((a) =>
      a.id === anchorId
        ? {
            ...a,
            modelVersion: ANCHOR_MODEL_VERSION,
            position: cleanPos,
            source: 'calibrated' as const,
            snappedSkeletonMesh: snappedSkeletonMesh || a.snappedSkeletonMesh,
            updatedAtIso,
          }
        : a
    );
    set({
      anchors: nextAnchors,
      calibratingAnchorId: null,
      anchorsNeedRecalibration: false,
    });

    const persistMap: AnchorCalibrationMap = {};
    for (const a of nextAnchors) {
      if (a.source === 'calibrated') {
        persistMap[a.id] = {
          position: a.position,
          modelVersion: ANCHOR_MODEL_VERSION,
          snappedSkeletonMesh: a.snappedSkeletonMesh,
          updatedAtIso: a.updatedAtIso || updatedAtIso,
        };
      }
    }
    void safeStorageSet(STORAGE_KEYS.anchors, persistMap);
  },

  applyAnchorOverrides: (overrides) => {
    const tagged: AnchorCalibrationMap = {};
    const nowIso = new Date().toISOString();
    for (const [id, ov] of Object.entries(overrides)) {
      tagged[id] = {
        ...ov,
        modelVersion: ANCHOR_MODEL_VERSION,
        updatedAtIso: ov.updatedAtIso || nowIso,
      };
    }
    const nextAnchors = mergeAnchorsWithCalibration(DEFAULT_ANCHORS, tagged);
    set({
      anchors: nextAnchors,
      calibratingAnchorId: null,
      anchorsNeedRecalibration: false,
    });
    void safeStorageSet(STORAGE_KEYS.anchors, tagged);
  },

  requestAutoProposeAnchors: () =>
    set((s) => ({
      autoProposeAnchorsNonce: s.autoProposeAnchorsNonce + 1,
      anchorsNeedRecalibration: false,
    })),

  dismissAnchorRecalibrationBanner: () => set({ anchorsNeedRecalibration: false }),

  resetAnchor: (anchorId) => {
    const baseline = DEFAULT_ANCHORS.find((d) => d.id === anchorId);
    if (!baseline) return;
    const nextAnchors = get().anchors.map((a) =>
      a.id === anchorId
        ? {
            ...baseline,
            defaultProceduralPos: [...baseline.defaultProceduralPos] as [number, number, number],
            position: [...baseline.position] as [number, number, number],
          }
        : a
    );
    set({ anchors: nextAnchors });
    const persistMap: AnchorCalibrationMap = {};
    for (const a of nextAnchors) {
      if (a.source === 'calibrated') {
        persistMap[a.id] = {
          position: a.position,
          modelVersion: ANCHOR_MODEL_VERSION,
          snappedSkeletonMesh: a.snappedSkeletonMesh,
          updatedAtIso: a.updatedAtIso || new Date().toISOString(),
        };
      }
    }
    void safeStorageSet(STORAGE_KEYS.anchors, persistMap);
  },

  resetAllAnchors: () => {
    set({
      anchors: DEFAULT_ANCHORS.map((a) => ({
        ...a,
        defaultProceduralPos: [...a.defaultProceduralPos] as [number, number, number],
        position: [...a.position] as [number, number, number],
      })),
      calibratingAnchorId: null,
      anchorsNeedRecalibration: false,
    });
    void safeStorageDel(STORAGE_KEYS.anchors);
  },

  importAnchorsJson: async (rawJson) => {
    const parsed = parseAnchorsImportJson(rawJson);
    if (!parsed.ok || !parsed.overrides) {
      return { ok: false, message: parsed.message };
    }
    const existingMap: AnchorCalibrationMap = {};
    for (const a of get().anchors) {
      if (a.source === 'calibrated') {
        existingMap[a.id] = {
          position: a.position,
          modelVersion: ANCHOR_MODEL_VERSION,
          snappedSkeletonMesh: a.snappedSkeletonMesh,
          updatedAtIso: a.updatedAtIso || new Date().toISOString(),
        };
      }
    }
    const mergedMap: AnchorCalibrationMap = { ...existingMap, ...parsed.overrides };
    const nextAnchors = mergeAnchorsWithCalibration(DEFAULT_ANCHORS, mergedMap);
    set({
      anchors: nextAnchors,
      calibratingAnchorId: null,
      anchorsNeedRecalibration: false,
    });
    await safeStorageSet(STORAGE_KEYS.anchors, mergedMap);
    return { ok: true, count: parsed.count, message: parsed.message };
  },

  openCalibrationPage: () =>
    set({
      editorMode: true,
      activeTab: 'calibration',
    }),

  setVesselAlignment: (patch) =>
    set((s) => ({
      vesselAlignment: clampVesselAlignment({ ...s.vesselAlignment, ...patch }),
    })),

  saveVesselAlignment: async () => {
    const clean = clampVesselAlignment(get().vesselAlignment);
    const savedAtIso = new Date().toISOString();
    set({
      vesselAlignment: clean,
      savedVesselAlignment: clean,
      vesselAlignmentSavedAtIso: savedAtIso,
    });
    await safeStorageSet(STORAGE_KEYS.vesselAlignment, {
      transform: clean,
      savedAtIso,
    });
  },

  resetVesselAlignment: async () => {
    set({
      vesselAlignment: DEFAULT_VESSEL_ALIGNMENT,
      savedVesselAlignment: DEFAULT_VESSEL_ALIGNMENT,
      vesselAlignmentSavedAtIso: null,
    });
    await safeStorageDel(STORAGE_KEYS.vesselAlignment);
  },

  setAlignmentDiagnostics: (alignmentDiagnostics) => set({ alignmentDiagnostics }),

  setAlignmentPanelOpen: (alignmentPanelOpen) => set({ alignmentPanelOpen }),

  toggleCalibrationView: (forceState) =>
    set((s) => {
      const nextActive = typeof forceState === 'boolean' ? forceState : !s.calibrationViewActive;
      if (nextActive === s.calibrationViewActive) return {};

      if (nextActive) {
        const snapshot: LayersConfig = { ...s.layers };
        const calibrationLayers: LayersConfig = {
          skin: { visible: true, opacity: 0.15 },
          fat: { visible: false, opacity: s.layers.fat.opacity },
          fascia: { visible: false, opacity: s.layers.fascia.opacity },
          muscle: { visible: false, opacity: s.layers.muscle.opacity },
          organs: { visible: false, opacity: s.layers.organs.opacity },
          skeleton: { visible: true, opacity: 1.0 },
          arteries: { visible: true, opacity: 1.0 },
          veins: { visible: false, opacity: s.layers.veins.opacity },
          nerves: { visible: false, opacity: s.layers.nerves.opacity },
          lymphatics: { visible: false, opacity: s.layers.lymphatics.opacity },
          perforators: { visible: false, opacity: s.layers.perforators.opacity },
          angiosomes: { visible: false, opacity: s.layers.angiosomes.opacity },
          perforasomes: { visible: false, opacity: s.layers.perforasomes.opacity },
          landmarks: { visible: false, opacity: s.layers.landmarks.opacity },
          paddle: { visible: false, opacity: s.layers.paddle.opacity },
          cuttingGuides: { visible: false, opacity: s.layers.cuttingGuides.opacity },
        };
        return {
          calibrationViewActive: true,
          calibrationViewSavedLayers: snapshot,
          layers: calibrationLayers,
          selectedAnatomyInfo: null,
          activeCameraPreset: 'anterior-full',
          cameraRequestNonce: s.cameraRequestNonce + 1,
          cameraFocusRequest: {
            pos: [0, 1.02, 2.35],
            target: [0, 0.96, 0],
            nonce: (s.cameraFocusRequest?.nonce ?? 0) + 1,
          },
        };
      }

      return {
        calibrationViewActive: false,
        layers: s.calibrationViewSavedLayers || DEFAULT_LAYERS,
        calibrationViewSavedLayers: null,
      };
    }),

  setVesselPreset: (vesselPreset) => {
    set({ vesselPreset });
    const s = get();
    void safeStorageSet(STORAGE_KEYS.prefs, {
      theme: s.theme,
      unitSystem: s.unitSystem,
      colorblindMode: s.colorblindMode,
      bodySex: s.bodySex,
      vesselPreset,
      vesselSideFilter: s.vesselSideFilter,
    });
  },

  setVesselSideFilter: (vesselSideFilter) => {
    set({ vesselSideFilter });
    const s = get();
    void safeStorageSet(STORAGE_KEYS.prefs, {
      theme: s.theme,
      unitSystem: s.unitSystem,
      colorblindMode: s.colorblindMode,
      bodySex: s.bodySex,
      vesselPreset: s.vesselPreset,
      vesselSideFilter,
    });
  },

  setVesselFilterStats: (vesselFilterStats) => set({ vesselFilterStats }),

  setDonorSide: (donorSide) => {
    set({ donorSide });
    const s = get();
    void safeStorageSet(STORAGE_KEYS.prefs, {
      theme: s.theme,
      unitSystem: s.unitSystem,
      colorblindMode: s.colorblindMode,
      bodySex: s.bodySex,
      vesselPreset: s.vesselPreset,
      vesselSideFilter: s.vesselSideFilter,
      donorSide,
    });
  },

  setResolvedFlapVessels: (resolvedFlapVessels) => set({ resolvedFlapVessels }),

  setLoadedVessels: (loadedVessels) => set({ loadedVessels }),

  focusLoadedVessel: (vessel, targetTab) => {
    const s = get();
    const reverseFlaps = findFlapsUsingVessel(
      { fjCode: vessel.fjCode, name: vessel.name },
      s.flaps
    );
    const mergedFlapIds = Array.from(
      new Set([...vessel.linkedFlapIds, ...reverseFlaps.map((m) => m.flapId)])
    );
    const goal = computeStructureFocusCamera(vessel.boundsMin, vessel.boundsMax, vessel.center);
    const nextLayers = s.calibrationViewActive
      ? {
          ...(s.calibrationViewSavedLayers || DEFAULT_LAYERS),
          [vessel.system]: {
            ...(s.calibrationViewSavedLayers?.[vessel.system] || DEFAULT_LAYERS[vessel.system]),
            visible: true,
          },
        }
      : {
          ...s.layers,
          [vessel.system]: {
            ...s.layers[vessel.system],
            visible: true,
          },
        };

    set({
      ...(targetTab ? { activeTab: targetTab } : {}),
      sheetSnap: s.sheetSnap === 'collapsed' ? 'half' : s.sheetSnap,
      calibrationViewActive: false,
      calibrationViewSavedLayers: null,
      layers: nextLayers,
      selectedAnatomyInfo: {
        id: vessel.anatomyId,
        label: vessel.name,
        category: vessel.category,
        laterality: vessel.side,
        meshName: vessel.meshName,
        system: vessel.system,
        mapped: vessel.mapped || reverseFlaps.length > 0,
        linkedFlapIds: mergedFlapIds,
        subMeshKey: vessel.key,
        isSchematic: vessel.sourceModel !== 'bodyparts3d',
        sourceModel: vessel.sourceModel,
        fjCode: vessel.fjCode,
        fmaCode: vessel.fmaCode,
        center: vessel.center,
        boundsMin: vessel.boundsMin,
        boundsMax: vessel.boundsMax,
      },
      cameraFocusRequest: {
        pos: goal.pos,
        target: goal.target,
        nonce: (s.cameraFocusRequest?.nonce ?? 0) + 1,
      },
    });
  },

  setLibraryRegionFilter: (libraryRegionFilter) => set({ libraryRegionFilter }),
  setLibraryVesselFilter: (libraryVesselFilter) => set({ libraryVesselFilter }),

  reset3DView: () =>
    set((s) => ({
      activeCameraPreset: 'anterior-full',
      cameraRequestNonce: s.cameraRequestNonce + 1,
      hasSelectedFlap: false,
      flapsSheetMode: 'list',
      layers: DEFAULT_LAYERS,
      dissectionPeel: 28,
      clippingPlanes: DEFAULT_CLIPPING_PLANES,
      selectedAnatomyInfo: null,
      selectedVesselId: null,
      viewerContextMenu: null,
      ghostUnselected: true,
      animationMode: 'none',
      measureMode: false,
      advisorPreviewDefectId: null,
      advisorDefectSizeCm: null,
      calibrationViewActive: false,
      calibrationViewSavedLayers: null,
      vesselPreset: DEFAULT_VESSEL_PRESET_ID,
      vesselSideFilter: DEFAULT_VESSEL_SIDE_FILTER,
      territoryMode: 'off',
      territorySheetOpen: false,
      focusedTerritoryId: null,
      showTerritoryNeighbors: false,
      isolateTerritoryArtery: false,
      pinnedTerritoryLabel: null,
      territoryLayerSnapshot: null,
      selectedSchematicMuscleId: null,
      selectedMuscleRefId: null,
      highlightedMuscleVesselKeys: [],
      plannerDropMode: false,
      selectedPlannerMarkerId: null,
    })),

  setTerritoryFieldBuildState: (patch) =>
    set((s) => ({
      territoryFieldStatus: patch.status ?? s.territoryFieldStatus,
      territoryFieldProgress: patch.progress ?? s.territoryFieldProgress,
      territoryFieldMeta: patch.meta !== undefined ? patch.meta : s.territoryFieldMeta,
      territoryFieldError: patch.error !== undefined ? patch.error : s.territoryFieldError,
      territoryCalibrationReport:
        patch.calibrationReport !== undefined
          ? patch.calibrationReport
          : s.territoryCalibrationReport,
      territoryUnresolvedFjs:
        patch.unresolvedFjs !== undefined ? patch.unresolvedFjs : s.territoryUnresolvedFjs,
    })),

  setTerritoryVisualWeight: (territoryId, weight) => {
    const clamped = Number(Math.max(0.3, Math.min(3.0, weight)).toFixed(2));
    const next = { ...get().territoryVisualWeights, [territoryId]: clamped };
    set((s) => ({
      territoryVisualWeights: next,
      territoryFieldRebuildNonce: s.territoryFieldRebuildNonce + 1,
    }));
    void safeStorageSet(STORAGE_KEYS.territoryVisualWeights, next);
  },

  resetTerritoryVisualWeights: () => {
    set((s) => ({
      territoryVisualWeights: {},
      territoryFieldRebuildNonce: s.territoryFieldRebuildNonce + 1,
    }));
    void safeStorageDel(STORAGE_KEYS.territoryVisualWeights);
  },

  requestTerritoryFieldRebuild: () =>
    set((s) => ({
      territoryFieldRebuildNonce: s.territoryFieldRebuildNonce + 1,
    })),

  setTerritoryMode: (nextMode) => {
    const s = get();
    if (nextMode === s.territoryMode) return;

    // Leaving territory mode -> restore pre-entry layer snapshot verbatim
    if (nextMode === 'off') {
      const snap = s.territoryLayerSnapshot;
      set({
        territoryMode: 'off',
        focusedTerritoryId: null,
        focusedTerritorySide: 'both',
        showTerritoryNeighbors: false,
        isolateTerritoryArtery: false,
        pinnedTerritoryLabel: null,
        territoryLayerSnapshot: null,
        selectedSchematicMuscleId: null,
        plannerDropMode: false,
        selectedPlannerMarkerId: null,
        ...(snap
          ? {
              layers: snap.layers,
              dissectionPeel: snap.dissectionPeel,
              show3DLabels: snap.show3DLabels,
              vesselPreset: snap.vesselPreset,
              vesselSideFilter: snap.vesselSideFilter,
              ghostUnselected: snap.ghostUnselected,
            }
          : {}),
      });
      return;
    }

    // Entering territory mode from Off -> snapshot exact layer state first
    const snapshot: TerritoryLayerSnapshot = s.territoryLayerSnapshot ?? {
      layers: Object.fromEntries(
        (Object.keys(s.layers) as LayerKey[]).map((k) => [k, { ...s.layers[k] }])
      ) as LayersConfig,
      dissectionPeel: s.dissectionPeel,
      show3DLabels: s.show3DLabels,
      vesselPreset: s.vesselPreset,
      vesselSideFilter: s.vesselSideFilter,
      ghostUnselected: s.ghostUnselected,
    };

    const enteringFromOff = s.territoryMode === 'off';
    const nextDepth = enteringFromOff ? 0 : s.territoryDepth;
    const depthPatch = computeTerritoryDepthLayerPatch(
      nextDepth,
      nextMode,
      Boolean(s.focusedTerritoryId)
    );

    set({
      territoryMode: nextMode,
      territorySheetOpen: true,
      territoryLayerSnapshot: snapshot,
      territoryDepth: nextDepth,
      selectedAnatomyInfo: null,
      show3DLabels: false,
      isolateTerritoryArtery: false,
      plannerDropMode: nextMode === 'perforators' ? s.plannerDropMode : false,
      ...(enteringFromOff && !s.focusedTerritoryId
        ? {
            activeCameraPreset: 'anterior-full',
            cameraRequestNonce: s.cameraRequestNonce + 1,
          }
        : {}),
      layers: {
        ...s.layers,
        ...depthPatch,
      },
    });
  },

  setTerritorySheetOpen: (territorySheetOpen) => set({ territorySheetOpen }),

  setTerritoryOpacity: (opacity) =>
    set({ territoryOpacity: Math.max(0.1, Math.min(1.0, Number(opacity.toFixed(2)))) }),

  setTerritorySideFilter: (territorySideFilter) => set({ territorySideFilter }),

  setTerritoryDepth: (depth) => {
    const clamped = Math.max(0, Math.min(100, Math.round(depth)));
    const s = get();
    if (s.territoryMode === 'off') {
      set({ territoryDepth: clamped });
      return;
    }
    const patch = computeTerritoryDepthLayerPatch(
      clamped,
      s.territoryMode,
      Boolean(s.focusedTerritoryId)
    );
    set({
      territoryDepth: clamped,
      dissectionPeel: clamped,
      layers: {
        ...s.layers,
        ...patch,
      },
    });
  },

  focusTerritory: (territoryId, side, flyCamera = false) => {
    const s = get();
    const nextSide = side ?? (territoryId ? s.territorySideFilter : 'both');
    const depthPatch =
      s.territoryMode !== 'off'
        ? computeTerritoryDepthLayerPatch(s.territoryDepth, s.territoryMode, Boolean(territoryId))
        : null;

    set({
      focusedTerritoryId: territoryId,
      focusedTerritorySide: nextSide,
      isolateTerritoryArtery: false,
      selectedAnatomyInfo: null,
      ...(territoryId !== null
        ? {
            selectedSchematicMuscleId: null,
            sheetSnap: s.sheetSnap === 'collapsed' ? 'half' : s.sheetSnap,
          }
        : {}),
      ...(territoryId === null ? { showTerritoryNeighbors: false } : {}),
      ...(depthPatch ? { layers: { ...s.layers, ...depthPatch } } : {}),
      ...(flyCamera && territoryId ? { territoryFocusNonce: s.territoryFocusNonce + 1 } : {}),
    });
  },

  setShowTerritoryNeighbors: (showTerritoryNeighbors) => set({ showTerritoryNeighbors }),

  setIsolateTerritoryArtery: (isolateTerritoryArtery) => set({ isolateTerritoryArtery }),

  setPinnedTerritoryLabel: (pinnedTerritoryLabel) => set({ pinnedTerritoryLabel }),

  setTerritoryDelayHours: (hours) =>
    set({ territoryDelayHours: Math.max(0, Math.min(168, Math.round(hours))) }),

  openTerritoryFromSearch: (territoryId) => {
    const s = get();
    if (s.activeTab !== 'library' && s.activeTab !== 'anatomy' && s.activeTab !== 'layers') {
      set({ activeTab: 'layers', layersSubTab: 'territories' });
    }
    if (get().territoryMode === 'off') {
      get().setTerritoryMode('angiosomes');
    }
    get().focusTerritory(territoryId, 'both', true);
  },

  setSelectedSchematicMuscleId: (outlineId) => {
    const s = get();
    if (!outlineId) {
      set({ selectedSchematicMuscleId: null });
      return;
    }
    const needMuscleDepth = s.territoryMode !== 'off' && s.territoryDepth < 45;
    const nextDepth = needMuscleDepth ? 55 : s.territoryDepth;
    const patch =
      needMuscleDepth && s.territoryMode !== 'off'
        ? computeTerritoryDepthLayerPatch(nextDepth, s.territoryMode, false)
        : null;
    set({
      selectedSchematicMuscleId: outlineId,
      focusedTerritoryId: null,
      selectedAnatomyInfo: null,
      sheetSnap: s.sheetSnap === 'collapsed' ? 'half' : s.sheetSnap,
      ...(needMuscleDepth ? { territoryDepth: nextDepth, dissectionPeel: nextDepth } : {}),
      ...(patch ? { layers: { ...s.layers, ...patch } } : {}),
    });
  },

  setShowPerforatorCorridors: (showPerforatorCorridors) => set({ showPerforatorCorridors }),

  setShowFlapPerforasomes: (showFlapPerforasomes) => set({ showFlapPerforasomes }),

  setPlannerDropMode: (plannerDropMode) =>
    set(() => ({
      plannerDropMode,
      ...(plannerDropMode
        ? {
            focusedTerritoryId: null,
            selectedAnatomyInfo: null,
            territorySheetOpen: false,
          }
        : {}),
    })),

  addDopplerPlannerMarker: (input) => {
    const existing = get().dopplerPlannerMarkers;
    const created = createDopplerPlannerMarker(input, existing.length);
    const next = [...existing, created];
    set({
      dopplerPlannerMarkers: next,
      selectedPlannerMarkerId: created.id,
      plannerDropMode: false,
    });
    void saveDopplerPlannerMarkers(next);
    return created;
  },

  updateDopplerPlannerMarker: (id, patch) => {
    const next = get().dopplerPlannerMarkers.map((m) =>
      m.id === id
        ? {
            ...m,
            ...(patch.label !== undefined ? { label: patch.label.slice(0, 48) } : {}),
            ...(patch.side !== undefined ? { side: patch.side } : {}),
            ...(patch.midlineMm !== undefined ? { midlineMm: patch.midlineMm.slice(0, 24) } : {}),
            ...(patch.inferiorUmbilicusMm !== undefined
              ? { inferiorUmbilicusMm: patch.inferiorUmbilicusMm.slice(0, 24) }
              : {}),
            ...(patch.sizeMm !== undefined ? { sizeMm: patch.sizeMm.slice(0, 24) } : {}),
            ...(patch.modality !== undefined ? { modality: patch.modality } : {}),
            ...(patch.notes !== undefined ? { notes: patch.notes.slice(0, 160) } : {}),
          }
        : m
    );
    set({ dopplerPlannerMarkers: next });
    void saveDopplerPlannerMarkers(next);
  },

  deleteDopplerPlannerMarker: (id) => {
    const next = get().dopplerPlannerMarkers.filter((m) => m.id !== id);
    set((s) => ({
      dopplerPlannerMarkers: next,
      selectedPlannerMarkerId: s.selectedPlannerMarkerId === id ? null : s.selectedPlannerMarkerId,
    }));
    void saveDopplerPlannerMarkers(next);
  },

  clearDopplerPlannerMarkers: () => {
    set({ dopplerPlannerMarkers: [], selectedPlannerMarkerId: null, plannerDropMode: false });
    void clearStoredDopplerPlannerMarkers();
  },

  setSelectedPlannerMarkerId: (selectedPlannerMarkerId) => set({ selectedPlannerMarkerId }),

  selectMuscleRef: (muscleId, opts) =>
    set((s) => ({
      selectedMuscleRefId: muscleId,
      ...(muscleId
        ? {
            selectedAnatomyInfo: null,
            selectedSchematicMuscleId: null,
            highlightedMuscleVesselKeys: [],
            sheetSnap:
              opts?.openSheet !== false && s.sheetSnap === 'collapsed' ? 'half' : s.sheetSnap,
            muscleRefFrameNonce:
              opts?.frameIn3D !== false ? s.muscleRefFrameNonce + 1 : s.muscleRefFrameNonce,
          }
        : {
            highlightedMuscleVesselKeys: [],
          }),
    })),

  setHighlightedMuscleVesselKeys: (highlightedMuscleVesselKeys) =>
    set({ highlightedMuscleVesselKeys }),

  setUnmappedMusclesReport: (unmappedMusclesReport) => set({ unmappedMusclesReport }),

  hideSubMeshes: (input) => {
    const cleanKeys = Array.from(new Set(input.meshKeys.filter(Boolean)));
    if (cleanKeys.length === 0) return;
    const s = get();
    const prevSnap = cloneVisibilitySnapshot(s.visibilityState);
    const existingIdx = prevSnap.hiddenItems.findIndex((h) => h.id === input.id);
    const nextHidden =
      existingIdx >= 0
        ? prevSnap.hiddenItems.map((h, i) =>
            i === existingIdx
              ? {
                  ...h,
                  meshKeys: Array.from(new Set([...h.meshKeys, ...cleanKeys])),
                }
              : h
          )
        : [
            ...prevSnap.hiddenItems,
            {
              id: input.id,
              label: input.label,
              side: input.side,
              system: input.system,
              meshKeys: cleanKeys,
              partOnly: input.partOnly,
            },
          ];

    const hiddenSet = new Set(cleanKeys);
    const nextSnap: VisibilitySnapshot = {
      ...prevSnap,
      hiddenItems: nextHidden,
      isolatedMeshKeys: prevSnap.isolatedMeshKeys.filter((k) => !hiddenSet.has(k)),
      ghostOthersKeys: prevSnap.ghostOthersKeys.filter((k) => !hiddenSet.has(k)),
    };
    const nextUndo = [...s.visibilityUndoStack, prevSnap].slice(-MAX_VISIBILITY_HISTORY);
    const nextRedo: VisibilitySnapshot[] = [];
    saveSessionVisibilityState({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });

    // Clear selectedAnatomyInfo if all its parts are now hidden
    let nextSelected = s.selectedAnatomyInfo;
    if (nextSelected) {
      const selKeys =
        nextSelected.constituentParts && nextSelected.constituentParts.length > 0
          ? nextSelected.constituentParts.map((p) => p.meshKey)
          : nextSelected.subMeshKey
            ? [nextSelected.subMeshKey]
            : [];
      if (selKeys.length > 0 && selKeys.every((k) => hiddenSet.has(k))) {
        nextSelected = null;
      }
    }

    set({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
      selectedAnatomyInfo: nextSelected,
      viewerContextMenu: null,
    });
  },

  isolateSubMeshes: (keys, label, keepSkeleton) => {
    const cleanKeys = Array.from(new Set(keys.filter(Boolean)));
    if (cleanKeys.length === 0) return;
    const s = get();
    const prevSnap = cloneVisibilitySnapshot(s.visibilityState);
    const keySet = new Set(cleanKeys);
    const nextSnap: VisibilitySnapshot = {
      ...prevSnap,
      // Ensure isolated structures aren't hidden
      hiddenItems: prevSnap.hiddenItems
        .map((h) => ({
          ...h,
          meshKeys: h.meshKeys.filter((k) => !keySet.has(k)),
        }))
        .filter((h) => h.meshKeys.length > 0),
      isolatedMeshKeys: cleanKeys,
      isolatedLabel: label,
      isolateKeepSkeleton: keepSkeleton ?? prevSnap.isolateKeepSkeleton,
      ghostOthersKeys: [],
      ghostOthersLabel: null,
    };
    const nextUndo = [...s.visibilityUndoStack, prevSnap].slice(-MAX_VISIBILITY_HISTORY);
    const nextRedo: VisibilitySnapshot[] = [];
    saveSessionVisibilityState({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
    set({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
      viewerContextMenu: null,
    });
  },

  setIsolateKeepSkeleton: (keep) => {
    const s = get();
    if (s.visibilityState.isolateKeepSkeleton === keep) return;
    const prevSnap = cloneVisibilitySnapshot(s.visibilityState);
    const nextSnap: VisibilitySnapshot = {
      ...prevSnap,
      isolateKeepSkeleton: keep,
    };
    const nextUndo = [...s.visibilityUndoStack, prevSnap].slice(-MAX_VISIBILITY_HISTORY);
    const nextRedo: VisibilitySnapshot[] = [];
    saveSessionVisibilityState({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
    set({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
  },

  ghostOthersForSubMeshes: (keys, label) => {
    const cleanKeys = Array.from(new Set(keys.filter(Boolean)));
    if (cleanKeys.length === 0) return;
    const s = get();
    const prevSnap = cloneVisibilitySnapshot(s.visibilityState);
    const keySet = new Set(cleanKeys);
    const nextSnap: VisibilitySnapshot = {
      ...prevSnap,
      hiddenItems: prevSnap.hiddenItems
        .map((h) => ({
          ...h,
          meshKeys: h.meshKeys.filter((k) => !keySet.has(k)),
        }))
        .filter((h) => h.meshKeys.length > 0),
      isolatedMeshKeys: [],
      isolatedLabel: null,
      ghostOthersKeys: cleanKeys,
      ghostOthersLabel: label,
    };
    const nextUndo = [...s.visibilityUndoStack, prevSnap].slice(-MAX_VISIBILITY_HISTORY);
    const nextRedo: VisibilitySnapshot[] = [];
    saveSessionVisibilityState({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
    set({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
      viewerContextMenu: null,
    });
  },

  restoreHiddenItem: (itemId) => {
    const s = get();
    if (!s.visibilityState.hiddenItems.some((h) => h.id === itemId)) return;
    const prevSnap = cloneVisibilitySnapshot(s.visibilityState);
    const nextSnap: VisibilitySnapshot = {
      ...prevSnap,
      hiddenItems: prevSnap.hiddenItems.filter((h) => h.id !== itemId),
    };
    const nextUndo = [...s.visibilityUndoStack, prevSnap].slice(-MAX_VISIBILITY_HISTORY);
    const nextRedo: VisibilitySnapshot[] = [];
    saveSessionVisibilityState({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
    set({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
  },

  restoreIsolationAndGhost: () => {
    const s = get();
    if (
      s.visibilityState.isolatedMeshKeys.length === 0 &&
      s.visibilityState.ghostOthersKeys.length === 0
    ) {
      return;
    }
    const prevSnap = cloneVisibilitySnapshot(s.visibilityState);
    const nextSnap: VisibilitySnapshot = {
      ...prevSnap,
      isolatedMeshKeys: [],
      isolatedLabel: null,
      ghostOthersKeys: [],
      ghostOthersLabel: null,
    };
    const nextUndo = [...s.visibilityUndoStack, prevSnap].slice(-MAX_VISIBILITY_HISTORY);
    const nextRedo: VisibilitySnapshot[] = [];
    saveSessionVisibilityState({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
    set({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
  },

  restoreAllVisibility: () => {
    const s = get();
    const cur = s.visibilityState;
    if (
      cur.hiddenItems.length === 0 &&
      cur.isolatedMeshKeys.length === 0 &&
      cur.ghostOthersKeys.length === 0
    ) {
      return;
    }
    const prevSnap = cloneVisibilitySnapshot(cur);
    const nextSnap: VisibilitySnapshot = {
      ...cloneVisibilitySnapshot(EMPTY_VISIBILITY_SNAPSHOT),
      isolateKeepSkeleton: cur.isolateKeepSkeleton,
    };
    const nextUndo = [...s.visibilityUndoStack, prevSnap].slice(-MAX_VISIBILITY_HISTORY);
    const nextRedo: VisibilitySnapshot[] = [];
    saveSessionVisibilityState({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
    set({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
      viewerContextMenu: null,
    });
  },

  undoVisibility: () => {
    const s = get();
    if (s.visibilityUndoStack.length === 0) return;
    const prevSnap = cloneVisibilitySnapshot(
      s.visibilityUndoStack[s.visibilityUndoStack.length - 1]
    );
    const nextUndo = s.visibilityUndoStack.slice(0, -1);
    const nextRedo = [...s.visibilityRedoStack, cloneVisibilitySnapshot(s.visibilityState)].slice(
      -MAX_VISIBILITY_HISTORY
    );
    saveSessionVisibilityState({
      visibilityState: prevSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
    set({
      visibilityState: prevSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
  },

  redoVisibility: () => {
    const s = get();
    if (s.visibilityRedoStack.length === 0) return;
    const nextSnap = cloneVisibilitySnapshot(
      s.visibilityRedoStack[s.visibilityRedoStack.length - 1]
    );
    const nextRedo = s.visibilityRedoStack.slice(0, -1);
    const nextUndo = [...s.visibilityUndoStack, cloneVisibilitySnapshot(s.visibilityState)].slice(
      -MAX_VISIBILITY_HISTORY
    );
    saveSessionVisibilityState({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
    set({
      visibilityState: nextSnap,
      visibilityUndoStack: nextUndo,
      visibilityRedoStack: nextRedo,
    });
  },

  // Phase 12-3 — Operative guide 3D actions
  setLoadedStructuresCatalog: (loadedStructuresCatalog) => set({ loadedStructuresCatalog }),

  applyOperativeStepView: ({
    flapId,
    stepN,
    layerVisibilityPatch,
    highlightMeshKeys,
    hideMeshKeys,
    cameraPreset,
  }) =>
    set((s) => {
      const savedLayers: LayersConfig =
        s.operativeSavedLayers ??
        (Object.fromEntries(
          Object.entries(s.layers).map(([k, v]) => [k, { ...v }])
        ) as LayersConfig);

      const nextLayers: LayersConfig = Object.fromEntries(
        Object.entries(s.layers).map(([k, v]) => [k, { ...v }])
      ) as LayersConfig;

      for (const [k, patch] of Object.entries(layerVisibilityPatch)) {
        const key = k as LayerKey;
        if (nextLayers[key] && patch) {
          nextLayers[key] = {
            ...nextLayers[key],
            visible: patch.visible,
            ...(typeof patch.opacity === 'number' ? { opacity: patch.opacity } : {}),
          };
        }
      }

      const validCamera =
        cameraPreset && REGIONS.some((r) => r.id === cameraPreset) ? cameraPreset : null;

      return {
        operativeSavedLayers: savedLayers,
        layers: nextLayers,
        operativeViewState: {
          active: true,
          flapId,
          stepN,
          highlightMeshKeys: [...highlightMeshKeys],
          hideMeshKeys: [...hideMeshKeys],
          cameraPreset: validCamera,
          frameNonce: s.operativeViewState.frameNonce + 1,
        },
        ...(validCamera && highlightMeshKeys.length === 0
          ? {
              activeCameraPreset: validCamera,
              cameraRequestNonce: s.cameraRequestNonce + 1,
            }
          : {}),
      };
    }),

  highlightOperativeStructures: ({ flapId, meshKeys, ensureLayers }) =>
    set((s) => {
      const savedLayers: LayersConfig =
        s.operativeSavedLayers ??
        (Object.fromEntries(
          Object.entries(s.layers).map(([k, v]) => [k, { ...v }])
        ) as LayersConfig);

      const nextLayers: LayersConfig = Object.fromEntries(
        Object.entries(s.layers).map(([k, v]) => [k, { ...v }])
      ) as LayersConfig;

      if (ensureLayers && ensureLayers.length > 0) {
        for (const lKey of ensureLayers) {
          if (nextLayers[lKey]) {
            nextLayers[lKey] = { ...nextLayers[lKey], visible: true };
          }
        }
      }

      return {
        operativeSavedLayers: savedLayers,
        layers: nextLayers,
        operativeViewState: {
          active: true,
          flapId,
          stepN: s.operativeViewState.stepN,
          highlightMeshKeys: [...meshKeys],
          hideMeshKeys: s.operativeViewState.hideMeshKeys,
          cameraPreset: null,
          frameNonce: s.operativeViewState.frameNonce + 1,
        },
      };
    }),

  clearOperativeView: () =>
    set((s) => {
      if (!s.operativeViewState.active && !s.operativeSavedLayers) return s;
      const restoredLayers = s.operativeSavedLayers
        ? (Object.fromEntries(
            Object.entries(s.operativeSavedLayers).map(([k, v]) => [k, { ...v }])
          ) as LayersConfig)
        : s.layers;
      return {
        layers: restoredLayers,
        operativeSavedLayers: null,
        operativeViewState: {
          ...EMPTY_OPERATIVE_VIEW_STATE,
          frameNonce: s.operativeViewState.frameNonce,
        },
      };
    }),

  setOperativeUnresolvedReport: (operativeUnresolvedReport) => set({ operativeUnresolvedReport }),

  updateFlap: async (updated) => {
    const parsed = FlapRecordSchema.safeParse(updated);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const nextFlaps = get().flaps.map((f) => (f.id === parsed.data.id ? parsed.data : f));
    set({ flaps: nextFlaps });

    const existingOverrides = (await safeStorageGet<Record<string, FlapRecord>>(STORAGE_KEYS.flaps)) || {};
    existingOverrides[parsed.data.id] = parsed.data;
    await safeStorageSet(STORAGE_KEYS.flaps, existingOverrides);
  },

  createFlap: async (created) => {
    const parsed = FlapRecordSchema.safeParse(created);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
    }
    if (get().flaps.some((f) => f.id === parsed.data.id)) {
      throw new Error(`A flap with ID "${parsed.data.id}" already exists.`);
    }
    const nextFlaps = [parsed.data, ...get().flaps];
    set({ flaps: nextFlaps, selectedFlapId: parsed.data.id });

    const existingOverrides = (await safeStorageGet<Record<string, FlapRecord>>(STORAGE_KEYS.flaps)) || {};
    existingOverrides[parsed.data.id] = parsed.data;
    await safeStorageSet(STORAGE_KEYS.flaps, existingOverrides);
  },

  importFlapsJson: async (rawJson) => {
    try {
      const parsedJson = JSON.parse(rawJson);
      const arr = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
      const valid: FlapRecord[] = [];
      const errors: string[] = [];

      for (let i = 0; i < arr.length; i++) {
        const res = FlapRecordSchema.safeParse(arr[i]);
        if (res.success) {
          valid.push(res.data);
        } else {
          errors.push(`Item ${i}: ${res.error.issues[0]?.message || 'Invalid schema'}`);
        }
      }

      if (valid.length === 0) {
        return { ok: false, message: `Validation failed: ${errors.slice(0, 3).join('; ')}` };
      }

      const existingOverrides = (await safeStorageGet<Record<string, FlapRecord>>(STORAGE_KEYS.flaps)) || {};
      const byId = new Map<string, FlapRecord>(get().flaps.map((f) => [f.id, f]));
      for (const rec of valid) {
        byId.set(rec.id, rec);
        existingOverrides[rec.id] = rec;
      }

      set({ flaps: Array.from(byId.values()) });
      await safeStorageSet(STORAGE_KEYS.flaps, existingOverrides);
      return {
        ok: true,
        count: valid.length,
        message: `Imported ${valid.length} validated flap record${valid.length === 1 ? '' : 's'}${errors.length > 0 ? ` (${errors.length} skipped due to schema errors)` : ''}.`,
      };
    } catch (err) {
      return { ok: false, message: `Invalid JSON: ${err instanceof Error ? err.message : 'parse error'}` };
    }
  },

  resetDataset: async () => {
    await safeStorageDel(STORAGE_KEYS.flaps);
    set({ flaps: INITIAL_FLAPS });
  },
}));
