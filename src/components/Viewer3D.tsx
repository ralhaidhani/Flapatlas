import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Filter,
  FlipHorizontal2,
  Ghost,
  GitCompare,
  Info,
  Layers,
  Menu,
  Move,
  PictureInPicture2,
  Redo2,
  RotateCcw,
  Ruler,
  Scissors,
  Search,
  Sliders,
  Sparkles,
  Star,
  Tag,
  Target,
  Undo2,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { DEFECT_LOCATIONS, REGIONS, VESSELS } from '../data/index';
import {
  findMuscleReferenceForSelection,
  findUnmappedMuscleMeshes,
  MUSCLE_REFERENCE_BY_ID,
} from '../data/muscleReference';
import {
  getCalibratedPaddleSummary,
  resolveAnatomyDetailCard,
} from '../engine/flapMetrics';
import {
  isLayerSchematic,
  proposeBp3dAnchorsFromSubMeshes,
  resolveFlapOverlayRelativeToAnchors,
  SCHEMATIC_TAG_TEXT,
  SourceVesselCandidate,
} from '../models/anchorSystem';
import { BODY_MODEL_CONFIG, getAnatomyPalette } from '../models/bodyModelConfig';
import {
  assessFlapBp3dCoverage,
  buildSchematicMuscleOutline,
} from '../models/bp3dCoverage';
import {
  AnatomicalBounds,
  ClippingAxis,
  computeClippingPlaneParams,
  computeStructureFocusCamera,
  DEFAULT_BODY_BOUNDS,
  SearchableAnatomyStructure,
  searchAnatomyStructures,
} from '../models/clippingAndSearch';
import {
  applySubMeshVisibilityFilter,
  createFlapVesselHighlightGroup,
  createHoverHighlightGroup,
  createSelectionHighlightGroup,
  createSkeletonLoadingPlaceholder,
  disposeSelectionHighlightGroup,
  extractSubMeshGeometry,
  findMergedMeshForSubMesh,
  FlapVesselPulseHandle,
  getBucketColorHex,
  loadAnatomicalModelPack,
  loadExternalBodyGlb,
  LoadedGlbBody,
  MergedSubMeshRecord,
  ProgressiveLoadProgress,
  resolveMergedPick,
  TissueMaterialBucket,
} from '../models/glbLoader';
import { listCachedUploadedGlbs } from '../models/modelCache';
import {
  AnatomicalSystemId,
  BODYPARTS3D_PHASE10_ATTRIBUTION,
  buildLocalBundledManifest,
  buildManifestForBaseUrl,
  DEFAULT_MODEL_MANIFEST,
  GITHUB_MODELS_REPO_URL,
  inferSystemFromFilename,
  ModelManifestEntry,
  SYSTEM_DISPLAY_META,
} from '../models/modelManifest';
import { mergeBoundingBoxes } from '../models/modelNormalization';
import {
  buildProceduralBody,
  createContactShadowDisc,
  ProceduralBodyRig,
} from '../models/proceduralBody';
import {
  applyVesselAlignmentToGroup,
  computeAlignmentDiagnostics,
  DEFAULT_VESSEL_ALIGNMENT,
  formatAlignmentDiagnosticsForConsole,
  isCalibrationReferenceArtery,
  measureObjectWorldBounds,
  transformSubMeshBoundsWithAlignment,
  VesselAlignmentTransform,
} from '../models/vesselAlignment';
import {
  sampleTerritoryFieldAtWorldPos,
  type TerritoryFieldData,
} from '../models/territoryFieldCore';
import {
  attachTerritoryResourcesToBody,
  buildOrLoadTerritoryField,
  detachAndDisposeTerritoryResources,
} from '../models/territoryFieldEngine';
import {
  TERRITORY_SLOT_BY_ID,
  TERRITORY_SLOT_BY_INDEX,
} from '../models/territoryPalette';
import {
  computeTerritoryFocusBounds,
  getTerritorySourceArteryFjs,
} from '../models/territorySearch';
import {
  setNeighborBitmaskUniforms,
  syncTerritoryPaletteColorblind,
  type TerritoryGpuResources,
} from '../models/territoryShader';
import {
  resolveBoneDeepTissueInfo,
  resolveMuscleDeepTissueInfo,
  type DeepTissueMuscleEntry,
} from '../models/deepTissueTerritories';
import type { DopplerPlannerMarker } from '../models/dopplerPlanner';
import {
  buildAllRealArteryCorridors,
  buildPerforasomeJigsawTiles,
  buildSkinSurfaceGridFromLoadedBody,
  classifyCorridorZoomTier,
  filterCorridorDotsForView,
  isRealCorridorTerritory,
  PERFORASOME_DECORATIVE_RADIUS_M,
  type CorridorDotInstance,
  type CorridorZoomTier,
  type SkinSurfaceSpatialGrid,
} from '../models/perforatorCorridors';
import { SchematicMuscleDetailCard } from './SchematicMuscleDetailCard';
import { TerritoryBottomSheet } from './TerritoryBottomSheet';
import { TerritoryDetailCard } from './TerritoryDetailCard';
import {
  DEFAULT_VESSEL_PRESET_ID,
  DEFAULT_VESSEL_SIDE_FILTER,
  getVesselPreset,
  shouldShowVessel,
  summarizeVesselFilterStats,
} from '../models/vesselDeclutter';
import {
  computeFlapVesselUnionCamera,
  getFlapVesselRoleStyle,
  REAL_VESSEL_TAG_TEXT,
  resolveFlapRealVessels,
} from '../models/flapVesselLinker';
import {
  extractLoadedVesselsIndex,
  findFlapsUsingVessel,
} from '../models/vesselSearch';
import {
  attachSubMeshVisibilityShader,
  disposeSubMeshVisibilityController,
  type SubMeshVisibilityController,
  type SubMeshVisibilityMode,
  updateSubMeshVisibilityBuffer,
} from '../models/subMeshVisibilityShader';
import { LayerKey, SelectedAnatomyInfo, useAtlasStore } from '../store/useAtlasStore';
import { formatRange } from '../types/schemas';
import { VesselAlignmentPanel } from './VesselAlignmentPanel';
import { VesselDeclutterPanel } from './VesselDeclutterPanel';

const LAYER_LABELS: Array<{ key: LayerKey; label: string }> = [
  { key: 'skin', label: 'Skin' },
  { key: 'fat', label: 'Subcut. Fat' },
  { key: 'fascia', label: 'Deep Fascia' },
  { key: 'muscle', label: 'Muscles' },
  { key: 'organs', label: 'Organs' },
  { key: 'skeleton', label: 'Skeleton' },
  { key: 'arteries', label: 'Arteries' },
  { key: 'veins', label: 'Veins' },
  { key: 'nerves', label: 'Nerves' },
  { key: 'lymphatics', label: 'Lymphatics' },
  { key: 'perforators', label: 'Perforators' },
  { key: 'perforasomes', label: 'Perforasomes' },
  { key: 'angiosomes', label: 'Angiosomes' },
  { key: 'landmarks', label: 'Landmarks' },
  { key: 'paddle', label: 'Flap Paddle' },
  { key: 'cuttingGuides', label: 'Cutting Guides' },
];

const CLIPPING_AXIS_META: Array<{
  axis: ClippingAxis;
  label: string;
  subtitle: string;
  colorHex: number;
  badgeClass: string;
}> = [
  {
    axis: 'axial',
    label: 'Axial (Horizontal)',
    subtitle: 'Inferior ↔ Superior (Y)',
    colorHex: 0x14b8a6,
    badgeClass: 'text-teal-600 dark:text-teal-400',
  },
  {
    axis: 'sagittal',
    label: 'Sagittal (Left–Right)',
    subtitle: 'Right ↔ Left (X)',
    colorHex: 0xf59e0b,
    badgeClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    axis: 'coronal',
    label: 'Coronal (Front–Back)',
    subtitle: 'Posterior ↔ Anterior (Z)',
    colorHex: 0x8b5cf6,
    badgeClass: 'text-violet-600 dark:text-violet-400',
  },
];

function systemToLayerKey(sys: AnatomicalSystemId | undefined): LayerKey | null {
  switch (sys) {
    case 'skin':
      return 'skin';
    case 'skeleton':
      return 'skeleton';
    case 'muscles':
      return 'muscle';
    case 'organs':
      return 'organs';
    case 'nerves':
      return 'nerves';
    case 'arteries':
      return 'arteries';
    case 'veins':
      return 'veins';
    case 'fascia':
    case 'other':
      return 'fascia';
    default:
      return null;
  }
}

function formatLateralityBadge(lat?: string): { text: string; short: string; style: string } {
  if (lat === 'right') {
    return {
      text: 'Right (.r)',
      short: 'R',
      style: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/40',
    };
  }
  if (lat === 'left') {
    return {
      text: 'Left (.l)',
      short: 'L',
      style: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40',
    };
  }
  return {
    text: 'Midline',
    short: 'Mid',
    style: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
  };
}


function buildClippingGuideVisual(
  axis: ClippingAxis,
  worldCoord: number,
  bounds: AnatomicalBounds,
  colorHex: number
): THREE.Group {
  const grp = new THREE.Group();
  const pad = 0.06;
  const widthX = Math.max(0.42, bounds.maxX - bounds.minX + pad * 2);
  const heightY = Math.max(1.2, bounds.maxY - bounds.minY + pad * 2);
  const depthZ = Math.max(0.32, bounds.maxZ - bounds.minZ + pad * 2);
  const midX = (bounds.minX + bounds.maxX) * 0.5;
  const midY = (bounds.minY + bounds.maxY) * 0.5;
  const midZ = (bounds.minZ + bounds.maxZ) * 0.5;

  let w = widthX;
  let h = depthZ;
  if (axis === 'sagittal') {
    w = depthZ;
    h = heightY;
  } else if (axis === 'coronal') {
    w = widthX;
    h = heightY;
  }

  const planeGeo = new THREE.PlaneGeometry(w, h);
  const planeMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const sheet = new THREE.Mesh(planeGeo, planeMat);

  const borderGeo = new THREE.EdgesGeometry(planeGeo);
  const borderMat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.72,
  });
  const border = new THREE.LineSegments(borderGeo, borderMat);

  grp.add(sheet, border);
  if (axis === 'axial') {
    grp.rotation.x = -Math.PI / 2;
    grp.position.set(midX, worldCoord, midZ);
  } else if (axis === 'sagittal') {
    grp.rotation.y = Math.PI / 2;
    grp.position.set(worldCoord, midY, midZ);
  } else {
    grp.position.set(midX, midY, worldCoord);
  }
  return grp;
}

interface CalloutAnchor {
  key: string;
  kind: 'perforator' | 'pedicle' | 'nerve';
  position: [number, number, number];
  title: string;
  subtitle: string;
}

function detectSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    return /SwiftShader|llvmpipe|Software|ANGLE.*SwiftShader/i.test(raw);
  } catch {
    return false;
  }
}

function worldToPipSvg(pt: [number, number, number]): { x: number; y: number } {
  // Map 3D body space x in [-0.45, 0.45], y in [0, 1.82] -> SVG 120 x 156
  const x = Math.max(12, Math.min(108, 60 + pt[0] * 105));
  const y = Math.max(10, Math.min(148, 148 - (pt[1] / 1.82) * 136));
  return { x, y };
}

function shortenLabel(text: string, maxLen = 28): string {
  const cleaned = text.replace(/\s*\([^)]*\)/g, '').trim();
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned;
}

function disposeGroupChildren(group: THREE.Group | null): void {
  if (!group) return;
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material?.dispose();
    }
  });
  group.clear();
}

function getEffectiveAlignmentForBody(
  loaded: LoadedGlbBody | null,
  storedAlignment: VesselAlignmentTransform
): VesselAlignmentTransform {
  // Unified BodyParts3D 4.0 shares one exact coordinate frame across all 7 systems:
  // never apply a legacy Z-Anatomy vessel alignment offset unless a legacy Z-Anatomy file is loaded.
  if (loaded && !loaded.hasLegacyZAnatomy) {
    return DEFAULT_VESSEL_ALIGNMENT;
  }
  return storedAlignment;
}

function buildSelectedInfoForSubMesh(
  sub: MergedSubMeshRecord,
  ext: LoadedGlbBody | null,
  alignment: VesselAlignmentTransform
): SelectedAnatomyInfo {
  const rotatedY = Boolean(ext?.orientationRotatedY);
  const pivot = ext?.bp3dAlignmentPivot || ([0, 0.85, 0] as [number, number, number]);

  // Phase 10b: If this sub-mesh belongs to a logical multi-part group (e.g. Deltoid, Pectoralis Major,
  // Trapezius, Biceps, Triceps, Gastrocnemius, Quadriceps), aggregate all sibling parts on the same side.
  const siblings =
    ext && sub.groupId
      ? ext.allSubMeshes.filter(
          (other) =>
            other.groupId === sub.groupId &&
            other.laterality === sub.laterality &&
            other.system === sub.system
        )
      : [sub];

  const targets = siblings.length > 0 ? siblings : [sub];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  const mergedFlaps = new Set<string>(sub.linkedFlapIds);
  for (const s of targets) {
    const wb = transformSubMeshBoundsWithAlignment(s, alignment, pivot, rotatedY);
    if (wb.boundsMin[0] < minX) minX = wb.boundsMin[0];
    if (wb.boundsMin[1] < minY) minY = wb.boundsMin[1];
    if (wb.boundsMin[2] < minZ) minZ = wb.boundsMin[2];
    if (wb.boundsMax[0] > maxX) maxX = wb.boundsMax[0];
    if (wb.boundsMax[1] > maxY) maxY = wb.boundsMax[1];
    if (wb.boundsMax[2] > maxZ) maxZ = wb.boundsMax[2];
    for (const fid of s.linkedFlapIds) mergedFlaps.add(fid);
  }

  const center: [number, number, number] = [
    Number(((minX + maxX) * 0.5).toFixed(4)),
    Number(((minY + maxY) * 0.5).toFixed(4)),
    Number(((minZ + maxZ) * 0.5).toFixed(4)),
  ];

  const constituentParts =
    targets.length > 1
      ? targets.map((s) => ({
          label: s.partLabel || s.label,
          meshName: s.meshName,
          fjCode: s.fjCode,
          fmaCode: s.fmaCode,
          meshKey: s.meshKey,
        }))
      : undefined;

  return {
    id: sub.groupId || sub.anatomyId,
    label: sub.groupLabel && targets.length > 1 ? sub.groupLabel : sub.label,
    category: sub.category,
    meshName: sub.meshName,
    laterality: sub.laterality,
    system: sub.system,
    mapped: sub.mapped,
    linkedFlapIds: Array.from(mergedFlaps),
    subMeshKey: sub.meshKey,
    isSchematic: false,
    sourceModel: sub.sourceModel,
    fjCode: sub.fjCode,
    fmaCode: sub.fmaCode,
    groupId: sub.groupId,
    groupLabel: sub.groupLabel,
    constituentParts,
    center,
    boundsMin: [minX, minY, minZ],
    boundsMax: [maxX, maxY, maxZ],
  };
}

export const Viewer3D: React.FC<{
  compact?: boolean;
  immersive?: boolean;
  defectPickMode?: boolean;
  spotterBlindMode?: boolean;
  hideAlignmentDockButton?: boolean;
  onPickDefectPoint?: (pt: [number, number, number]) => void;
}> = ({
  compact = false,
  immersive = false,
  defectPickMode = false,
  spotterBlindMode = false,
  hideAlignmentDockButton = false,
  onPickDefectPoint,
}) => {
  const defectPickModeRef = useRef(defectPickMode);
  const onPickDefectPointRef = useRef(onPickDefectPoint);
  const immersiveRef = useRef(immersive);
  const effectiveDprCapRef = useRef<number>(1.5);
  defectPickModeRef.current = defectPickMode;
  onPickDefectPointRef.current = onPickDefectPoint;
  immersiveRef.current = immersive;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const bodyRigRef = useRef<ProceduralBodyRig | null>(null);
  const externalGlbRef = useRef<LoadedGlbBody | null>(null);
  const territoryGpuRef = useRef<TerritoryGpuResources | null>(null);
  const territoryFieldDataRef = useRef<TerritoryFieldData | null>(null);
  const skeletonPlaceholderRef = useRef<THREE.Group | null>(null);
  const activeFlapGroupRef = useRef<THREE.Group | null>(null);
  const territorySchematicMuscleGroupRef = useRef<THREE.Group | null>(null);
  const territoryCorridorGroupRef = useRef<THREE.Group | null>(null);
  const territoryPerforasomeGroupRef = useRef<THREE.Group | null>(null);
  const dopplerPlannerPinsGroupRef = useRef<THREE.Group | null>(null);
  const skinSurfaceGridRef = useRef<SkinSurfaceSpatialGrid | null>(null);
  const realCorridorCacheRef = useRef<{
    dots: CorridorDotInstance[];
    realTerritoryIds: string[];
    bodyRev: number;
  } | null>(null);
  const visibleCorridorDotsRef = useRef<CorridorDotInstance[]>([]);
  const corridorZoomTierRef = useRef<CorridorZoomTier>('medium');
  const anchorMarkersGroupRef = useRef<THREE.Group | null>(null);
  const selectionHighlightGroupRef = useRef<THREE.Group | null>(null);
  const flapVesselHighlightGroupRef = useRef<THREE.Group | null>(null);
  const muscleVesselHighlightGroupRef = useRef<THREE.Group | null>(null);
  const operativeHighlightGroupRef = useRef<THREE.Group | null>(null);
  const visibilityControllersRef = useRef<SubMeshVisibilityController[]>([]);
  const hiddenMeshKeysRef = useRef<Set<string>>(new Set());
  const flapPediclePulseHandlesRef = useRef<FlapVesselPulseHandle[]>([]);
  const lastFlapVesselCameraKeyRef = useRef<string>('');
  const hoverHighlightGroupRef = useRef<THREE.Group | null>(null);
  const hoveredSubMeshKeyRef = useRef<string | null>(null);
  const activeClippingPlanesRef = useRef<THREE.Plane[]>([]);
  const clippingGuideGroupRef = useRef<THREE.Group | null>(null);
  const modelBoundsRef = useRef<AnatomicalBounds>(DEFAULT_BODY_BOUNDS);
  const animGhostRef = useRef<THREE.Mesh | null>(null);
  const animPathRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const arcPivotRef = useRef<THREE.Vector3 | null>(null);
  const arcRadiusRef = useRef<number>(0.15);
  const measureGroupRef = useRef<THREE.Group | null>(null);
  const measurePointsRef = useRef<THREE.Vector3[]>([]);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const floorRingRef = useRef<THREE.Mesh | null>(null);
  const contactShadowRef = useRef<THREE.Mesh | null>(null);
  const isSoftwareGlRef = useRef<boolean>(false);
  const requestRenderRef = useRef<() => void>(() => {});
  const cameraGoalRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const structureSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const lastLoggedDiagKeyRef = useRef<string>('');

  // Floating 3D-to-2D projected callouts refs (direct DOM transform updates: 0 React renders/frame)
  const calloutAnchorsRef = useRef<CalloutAnchor[]>([]);
  const labelElRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [hoveredInfo, setHoveredInfo] = useState<{
    label: string;
    category: string;
    laterality?: string;
    system?: string;
    sourceModel?: 'z-anatomy' | 'bodyparts3d';
  } | null>(null);
  const [measureCm, setMeasureCm] = useState<number | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [layersPopoverTab, setLayersPopoverTab] = useState<'layers' | 'vessels' | 'clipping'>('layers');
  const [anatomyCardDetailsOpen, setAnatomyCardDetailsOpen] = useState(false);
  const [structureSearchQuery, setStructureSearchQuery] = useState('');
  const [structureSearchOpen, setStructureSearchOpen] = useState(false);
  const [searchableStructures, setSearchableStructures] = useState<SearchableAnatomyStructure[]>(
    []
  );
  const [modelBoundsState, setModelBoundsState] = useState<AnatomicalBounds>(DEFAULT_BODY_BOUNDS);
  const [orientationLabel, setOrientationLabel] = useState('Anterior');
  const [webglError, setWebglError] = useState<string | null>(null);
  const [glbStatus, setGlbStatus] = useState<{
    loading: boolean;
    error: string | null;
    meshCount?: number;
  }>({ loading: false, error: null });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [territoryHoverLabel, setTerritoryHoverLabel] = useState<{
    territoryId: string;
    label: string;
    side: 'left' | 'right' | 'midline';
    isSchematic: boolean;
    x: number;
    y: number;
  } | null>(null);
  const [territoryFieldRev, setTerritoryFieldRev] = useState(0);
  const [corridorZoomTier, setCorridorZoomTier] = useState<CorridorZoomTier>('medium');
  const [realCorridorTerritoryCount, setRealCorridorTerritoryCount] = useState(0);
  const [hiddenPopoverOpen, setHiddenPopoverOpen] = useState(false);

  const flaps = useAtlasStore((s) => s.flaps);
  const selectedFlapId = useAtlasStore((s) => s.selectedFlapId);
  const selectedVesselId = useAtlasStore((s) => s.selectedVesselId);
  const selectedAnatomyInfo = useAtlasStore((s) => s.selectedAnatomyInfo);
  const advisorPreviewDefectId = useAtlasStore((s) => s.advisorPreviewDefectId);
  const advisorDefectSizeCm = useAtlasStore((s) => s.advisorDefectSizeCm);
  const activeCameraPreset = useAtlasStore((s) => s.activeCameraPreset);
  const cameraRequestNonce = useAtlasStore((s) => s.cameraRequestNonce);
  const cameraFocusRequest = useAtlasStore((s) => s.cameraFocusRequest);
  const layers = useAtlasStore((s) => s.layers);
  const dissectionPeel = useAtlasStore((s) => s.dissectionPeel);
  const clippingPlanes = useAtlasStore((s) => s.clippingPlanes);
  const ghostUnselected = useAtlasStore((s) => s.ghostUnselected);
  const pendingStructureFocusMeshName = useAtlasStore((s) => s.pendingStructureFocusMeshName);
  const animationMode = useAtlasStore((s) => s.animationMode);
  const techniqueStep = useAtlasStore((s) => s.techniqueStep);
  const measureMode = useAtlasStore((s) => s.measureMode);
  const hudCollapsed = useAtlasStore((s) => s.hudCollapsed);
  const show3DLabels = useAtlasStore((s) => s.show3DLabels);
  const showPipView = useAtlasStore((s) => s.showPipView);
  const teachingMode = useAtlasStore((s) => s.teachingMode);
  const customGlbUrl = useAtlasStore((s) => s.customGlbUrl);
  const customGlbName = useAtlasStore((s) => s.customGlbName);
  const modelSourceMode = useAtlasStore((s) => s.modelSourceMode);
  const remoteModelBaseUrl = useAtlasStore((s) => s.remoteModelBaseUrl);
  const modelReloadNonce = useAtlasStore((s) => s.modelReloadNonce);
  const customAnatomyOverrides = useAtlasStore((s) => s.customAnatomyOverrides);
  const activeModelStats = useAtlasStore((s) => s.activeModelStats);
  const modelLoadProgress = useAtlasStore((s) => s.modelLoadProgress);
  const anchors = useAtlasStore((s) => s.anchors);
  const anchorsNeedRecalibration = useAtlasStore((s) => s.anchorsNeedRecalibration);
  const autoProposeAnchorsNonce = useAtlasStore((s) => s.autoProposeAnchorsNonce);
  const calibratingAnchorId = useAtlasStore((s) => s.calibratingAnchorId);
  const vesselAlignment = useAtlasStore((s) => s.vesselAlignment);
  const calibrationViewActive = useAtlasStore((s) => s.calibrationViewActive);
  const alignmentPanelOpen = useAtlasStore((s) => s.alignmentPanelOpen);
  const vesselPreset = useAtlasStore((s) => s.vesselPreset);
  const vesselSideFilter = useAtlasStore((s) => s.vesselSideFilter);
  const donorSide = useAtlasStore((s) => s.donorSide);
  const resolvedFlapVessels = useAtlasStore((s) => s.resolvedFlapVessels);
  const editorMode = useAtlasStore((s) => s.editorMode);
  const hydrated = useAtlasStore((s) => s.hydrated);
  const bodySex = useAtlasStore((s) => s.bodySex);
  const theme = useAtlasStore((s) => s.theme);
  const colorblindMode = useAtlasStore((s) => s.colorblindMode);
  const unitSystem = useAtlasStore((s) => s.unitSystem);
  const compareIds = useAtlasStore((s) => s.compareIds);
  const favoriteIds = useAtlasStore((s) => s.favoriteIds);
  const hasSelectedFlap = useAtlasStore((s) => s.hasSelectedFlap);
  const renderQuality = useAtlasStore((s) => s.renderQuality);
  const viewerContextMenu = useAtlasStore((s) => s.viewerContextMenu);
  const setViewerContextMenu = useAtlasStore((s) => s.setViewerContextMenu);
  const setMenuOpen = useAtlasStore((s) => s.setMenuOpen);
  const setSearchPaletteOpen = useAtlasStore((s) => s.setSearchPaletteOpen);
  const setLayersSubTab = useAtlasStore((s) => s.setLayersSubTab);
  const setSheetSnap = useAtlasStore((s) => s.setSheetSnap);
  const setFlapsSheetMode = useAtlasStore((s) => s.setFlapsSheetMode);
  const activeTab = useAtlasStore((s) => s.activeTab);
  const sheetSnap = useAtlasStore((s) => s.sheetSnap);
  const visibilityState = useAtlasStore((s) => s.visibilityState);
  const visibilityUndoStack = useAtlasStore((s) => s.visibilityUndoStack);
  const visibilityRedoStack = useAtlasStore((s) => s.visibilityRedoStack);
  const selectedMuscleRefId = useAtlasStore((s) => s.selectedMuscleRefId);
  const muscleRefFrameNonce = useAtlasStore((s) => s.muscleRefFrameNonce);
  const highlightedMuscleVesselKeys = useAtlasStore((s) => s.highlightedMuscleVesselKeys);
  const operativeViewState = useAtlasStore((s) => s.operativeViewState);

  const hideSubMeshes = useAtlasStore((s) => s.hideSubMeshes);
  const isolateSubMeshes = useAtlasStore((s) => s.isolateSubMeshes);
  const ghostOthersForSubMeshes = useAtlasStore((s) => s.ghostOthersForSubMeshes);
  const restoreHiddenItem = useAtlasStore((s) => s.restoreHiddenItem);
  const restoreAllVisibility = useAtlasStore((s) => s.restoreAllVisibility);
  const undoVisibility = useAtlasStore((s) => s.undoVisibility);
  const redoVisibility = useAtlasStore((s) => s.redoVisibility);
  const setUnmappedMusclesReport = useAtlasStore((s) => s.setUnmappedMusclesReport);
  const setLoadedStructuresCatalog = useAtlasStore((s) => s.setLoadedStructuresCatalog);

  const setCameraPreset = useAtlasStore((s) => s.setCameraPreset);
  const flyToCameraGoal = useAtlasStore((s) => s.flyToCameraGoal);
  const setLayer = useAtlasStore((s) => s.setLayer);
  const setDissectionPeel = useAtlasStore((s) => s.setDissectionPeel);
  const setClippingAxis = useAtlasStore((s) => s.setClippingAxis);
  const resetClippingPlanes = useAtlasStore((s) => s.resetClippingPlanes);
  const setGhostUnselected = useAtlasStore((s) => s.setGhostUnselected);
  const openEditorForUnmappedMesh = useAtlasStore((s) => s.openEditorForUnmappedMesh);
  const clearPendingStructureFocus = useAtlasStore((s) => s.clearPendingStructureFocus);
  const setCalibratingAnchorId = useAtlasStore((s) => s.setCalibratingAnchorId);
  const openCalibrationPage = useAtlasStore((s) => s.openCalibrationPage);
  const applyAnchorOverrides = useAtlasStore((s) => s.applyAnchorOverrides);
  const requestAutoProposeAnchors = useAtlasStore((s) => s.requestAutoProposeAnchors);
  const dismissAnchorRecalibrationBanner = useAtlasStore((s) => s.dismissAnchorRecalibrationBanner);
  const setAlignmentDiagnostics = useAtlasStore((s) => s.setAlignmentDiagnostics);
  const setAlignmentPanelOpen = useAtlasStore((s) => s.setAlignmentPanelOpen);
  const toggleCalibrationView = useAtlasStore((s) => s.toggleCalibrationView);
  const setVesselFilterStats = useAtlasStore((s) => s.setVesselFilterStats);
  const setDonorSide = useAtlasStore((s) => s.setDonorSide);
  const setResolvedFlapVessels = useAtlasStore((s) => s.setResolvedFlapVessels);
  const setLoadedVessels = useAtlasStore((s) => s.setLoadedVessels);
  const setAnimationMode = useAtlasStore((s) => s.setAnimationMode);
  const setMeasureMode = useAtlasStore((s) => s.setMeasureMode);
  const setHudCollapsed = useAtlasStore((s) => s.setHudCollapsed);
  const setShow3DLabels = useAtlasStore((s) => s.setShow3DLabels);
  const setShowPipView = useAtlasStore((s) => s.setShowPipView);
  const setBodySex = useAtlasStore((s) => s.setBodySex);
  const reset3DView = useAtlasStore((s) => s.reset3DView);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const selectVessel = useAtlasStore((s) => s.selectVessel);
  const setSelectedAnatomyInfo = useAtlasStore((s) => s.setSelectedAnatomyInfo);
  const setLibraryRegionFilter = useAtlasStore((s) => s.setLibraryRegionFilter);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const toggleCompare = useAtlasStore((s) => s.toggleCompare);
  const toggleFavorite = useAtlasStore((s) => s.toggleFavorite);
  const setMeshMappingReport = useAtlasStore((s) => s.setMeshMappingReport);
  const setActiveModelStats = useAtlasStore((s) => s.setActiveModelStats);
  const setModelLoadProgress = useAtlasStore((s) => s.setModelLoadProgress);
  const territoryFieldStatus = useAtlasStore((s) => s.territoryFieldStatus);
  const territoryFieldProgress = useAtlasStore((s) => s.territoryFieldProgress);
  const territoryVisualWeights = useAtlasStore((s) => s.territoryVisualWeights);
  const territoryFieldRebuildNonce = useAtlasStore((s) => s.territoryFieldRebuildNonce);
  const setTerritoryFieldBuildState = useAtlasStore((s) => s.setTerritoryFieldBuildState);
  const territoryMode = useAtlasStore((s) => s.territoryMode);
  const territorySheetOpen = useAtlasStore((s) => s.territorySheetOpen);
  const territoryOpacity = useAtlasStore((s) => s.territoryOpacity);
  const territorySideFilter = useAtlasStore((s) => s.territorySideFilter);
  const territoryDepth = useAtlasStore((s) => s.territoryDepth);
  const territoryCalibrationReport = useAtlasStore((s) => s.territoryCalibrationReport);
  const focusedTerritoryId = useAtlasStore((s) => s.focusedTerritoryId);
  const focusedTerritorySide = useAtlasStore((s) => s.focusedTerritorySide);
  const showTerritoryNeighbors = useAtlasStore((s) => s.showTerritoryNeighbors);
  const isolateTerritoryArtery = useAtlasStore((s) => s.isolateTerritoryArtery);
  const pinnedTerritoryLabel = useAtlasStore((s) => s.pinnedTerritoryLabel);
  const territoryFocusNonce = useAtlasStore((s) => s.territoryFocusNonce);
  const territoryDelayHours = useAtlasStore((s) => s.territoryDelayHours);
  const selectedSchematicMuscleId = useAtlasStore((s) => s.selectedSchematicMuscleId);
  const setTerritorySheetOpen = useAtlasStore((s) => s.setTerritorySheetOpen);
  const setTerritoryMode = useAtlasStore((s) => s.setTerritoryMode);
  const setTerritoryDepth = useAtlasStore((s) => s.setTerritoryDepth);
  const focusTerritory = useAtlasStore((s) => s.focusTerritory);
  const setIsolateTerritoryArtery = useAtlasStore((s) => s.setIsolateTerritoryArtery);
  const setPinnedTerritoryLabel = useAtlasStore((s) => s.setPinnedTerritoryLabel);
  const setSelectedSchematicMuscleId = useAtlasStore((s) => s.setSelectedSchematicMuscleId);
  const showPerforatorCorridors = useAtlasStore((s) => s.showPerforatorCorridors);
  const showFlapPerforasomes = useAtlasStore((s) => s.showFlapPerforasomes);
  const plannerDropMode = useAtlasStore((s) => s.plannerDropMode);
  const dopplerPlannerMarkers = useAtlasStore((s) => s.dopplerPlannerMarkers);
  const selectedPlannerMarkerId = useAtlasStore((s) => s.selectedPlannerMarkerId);
  const setPlannerDropMode = useAtlasStore((s) => s.setPlannerDropMode);
  const setSelectedPlannerMarkerId = useAtlasStore((s) => s.setSelectedPlannerMarkerId);

  const selectedFlap = flaps.find((f) => f.id === selectedFlapId) || flaps[0];
  const flapBp3dCoverage = useMemo(
    () => (selectedFlap ? assessFlapBp3dCoverage(selectedFlap) : null),
    [selectedFlap]
  );
  const activeCalibratingAnchor = useMemo(
    () => (calibratingAnchorId ? anchors.find((a) => a.id === calibratingAnchorId) || null : null),
    [anchors, calibratingAnchorId]
  );

  // Source vessel candidates from loaded real GLB model (for real-vessel snapping when available)
  const sourceVesselCandidates = useMemo<SourceVesselCandidate[]>(() => {
    if (activeModelStats?.mode !== 'real-glb') return [];
    return searchableStructures
      .filter((s) => s.system === 'arteries' || s.system === 'veins')
      .map((s) => ({
        meshName: s.sourceModel === 'bodyparts3d' ? s.label : s.meshName,
        system: s.system,
        anatomyId: s.anatomyId,
        label: s.label,
        center: s.center,
        boundsMin: s.boundsMin,
        boundsMax: s.boundsMax,
      }));
  }, [activeModelStats?.mode, searchableStructures]);

  // Sub-Phase 9e & Phase 12-3: Publish loaded vessels & full anatomy catalog for global search, Anatomy Explorer & Operative Guide
  useEffect(() => {
    setLoadedVessels(extractLoadedVesselsIndex(searchableStructures));
    const ext = externalGlbRef.current;
    if (ext && ext.allSubMeshes.length > 0) {
      setLoadedStructuresCatalog(
        ext.allSubMeshes.map((sub) => ({
          meshKey: sub.meshKey,
          meshName: sub.meshName,
          normalizedName: sub.normalizedName,
          anatomyId: sub.anatomyId,
          label: sub.label,
          system: sub.system,
          laterality: sub.laterality,
          groupId: sub.groupId,
          groupLabel: sub.groupLabel,
        }))
      );
    } else {
      setLoadedStructuresCatalog(
        searchableStructures.map((s) => ({
          meshKey: s.key,
          meshName: s.meshName,
          normalizedName: s.label.toLowerCase(),
          anatomyId: s.anatomyId,
          label: s.label,
          system: s.system,
          laterality: s.laterality,
        }))
      );
    }
  }, [searchableStructures, setLoadedVessels, setLoadedStructuresCatalog]);

  // Anchor-relative resolved 3D coordinates for the active flap (never alters clinical measurements)
  const resolvedFlapOverlay = useMemo(() => {
    if (!selectedFlap) return null;
    return resolveFlapOverlayRelativeToAnchors(selectedFlap, anchors, {
      useRealModelFrame: activeModelStats?.mode === 'real-glb',
      sourceVesselCandidates,
    });
  }, [selectedFlap, anchors, activeModelStats?.mode, sourceVesselCandidates]);

  // Active clipping planes computed deterministically from model bounds
  const activeClippingEntries = useMemo(() => {
    const out: Array<{
      axis: ClippingAxis;
      colorHex: number;
      spec: ReturnType<typeof computeClippingPlaneParams>;
      plane: THREE.Plane;
    }> = [];
    for (const meta of CLIPPING_AXIS_META) {
      const cfg = clippingPlanes[meta.axis];
      if (!cfg.enabled) continue;
      const spec = computeClippingPlaneParams(meta.axis, cfg, modelBoundsState);
      out.push({
        axis: meta.axis,
        colorHex: meta.colorHex,
        spec,
        plane: new THREE.Plane(
          new THREE.Vector3(spec.normal[0], spec.normal[1], spec.normal[2]),
          spec.constant
        ),
      });
    }
    return out;
  }, [clippingPlanes, modelBoundsState]);

  const activeThreeClippingPlanes = useMemo(
    () => activeClippingEntries.map((e) => e.plane),
    [activeClippingEntries]
  );
  activeClippingPlanesRef.current = activeThreeClippingPlanes;

  const structureSearchResults = useMemo(
    () => searchAnatomyStructures(searchableStructures, structureSearchQuery, 12),
    [searchableStructures, structureSearchQuery]
  );

  const handleSelectSearchStructure = (item: SearchableAnatomyStructure) => {
    const targetLayer = systemToLayerKey(item.system);
    if (targetLayer && !layers[targetLayer]?.visible) {
      setLayer(targetLayer, { visible: true });
    }
    const reverseFlaps =
      item.system === 'arteries' || item.system === 'veins'
        ? findFlapsUsingVessel({ fjCode: item.fjCode, name: item.label }, flaps)
        : [];
    const mergedFlapIds = Array.from(
      new Set([...item.linkedFlapIds, ...reverseFlaps.map((m) => m.flapId)])
    );

    const ext = externalGlbRef.current;
    const matchedSub = ext?.allSubMeshes.find((s) => s.meshKey === item.key);
    let info: SelectedAnatomyInfo;
    if (matchedSub && ext) {
      const effAlign = getEffectiveAlignmentForBody(ext, vesselAlignment);
      info = buildSelectedInfoForSubMesh(matchedSub, ext, effAlign);
      info.linkedFlapIds = Array.from(new Set([...(info.linkedFlapIds || []), ...mergedFlapIds]));
      info.mapped = Boolean(info.mapped || reverseFlaps.length > 0);
    } else {
      info = {
        id: item.groupId || item.anatomyId,
        label: item.groupLabel || item.label,
        category: item.category,
        laterality: item.laterality,
        meshName: item.meshName,
        system: item.system,
        mapped: item.mapped || reverseFlaps.length > 0,
        linkedFlapIds: mergedFlapIds,
        subMeshKey: item.key,
        sourceModel: item.sourceModel,
        fjCode: item.fjCode,
        fmaCode: item.fmaCode,
        groupId: item.groupId,
        groupLabel: item.groupLabel,
        center: item.center,
        boundsMin: item.boundsMin,
        boundsMax: item.boundsMax,
      };
    }

    setSelectedAnatomyInfo(info);
    const goal = computeStructureFocusCamera(
      info.boundsMin || item.boundsMin,
      info.boundsMax || item.boundsMax,
      info.center || item.center
    );
    flyToCameraGoal(goal.pos, goal.target);
    setStructureSearchOpen(false);
  };

  const paddleSummary = useMemo(
    () => (selectedFlap ? getCalibratedPaddleSummary(selectedFlap, unitSystem) : null),
    [selectedFlap, unitSystem]
  );

  const anatomyCard = useMemo(
    () =>
      selectedAnatomyInfo
        ? resolveAnatomyDetailCard(
            selectedAnatomyInfo.id,
            selectedAnatomyInfo.label,
            selectedAnatomyInfo.category,
            unitSystem,
            VESSELS
          )
        : null,
    [selectedAnatomyInfo, unitSystem]
  );

  const calloutAnchors = useMemo<CalloutAnchor[]>(() => {
    if (!selectedFlap || !resolvedFlapOverlay) return [];
    const anchorsOut: CalloutAnchor[] = [];
    const mirrorX =
      selectedFlap.spec3d.side !== 'midline' && donorSide !== selectedFlap.spec3d.side ? -1 : 1;
    const mapPt = (p: [number, number, number]): [number, number, number] => [
      p[0] * mirrorX,
      p[1],
      p[2],
    ];

    if (layers.perforators.visible) {
      let perfPosIdx = 0;
      selectedFlap.vascular_anatomy.perforators.forEach((perf, idx) => {
        if (!perf.position3d) return;
        const pos = mapPt(resolvedFlapOverlay.perforatorPositions[perfPosIdx] || perf.position3d);
        perfPosIdx += 1;
        const typeShort = /musculocutaneous/i.test(perf.type)
          ? 'MC'
          : /septocutaneous/i.test(perf.type)
            ? 'SC'
            : 'Perf';
        anchorsOut.push({
          key: `perf-${idx}`,
          kind: 'perforator',
          position: pos,
          title: `P${idx + 1}`,
          subtitle: typeShort,
        });
      });
    }

    const primaryRealPedicle = resolvedFlapVessels?.resolvedVessels.find(
      (v) => v.role === 'pedicle'
    );
    if (layers.arteries.visible && (primaryRealPedicle || resolvedFlapOverlay.pediclePath.length >= 2)) {
      const midIdx = Math.floor(resolvedFlapOverlay.pediclePath.length / 2);
      const midPt = primaryRealPedicle
        ? primaryRealPedicle.center
        : mapPt(resolvedFlapOverlay.pediclePath[midIdx]);
      const diam = formatRange(
        selectedFlap.vascular_anatomy.dominant_pedicle.artery_diameter_mm,
        unitSystem
      );
      const len = formatRange(
        selectedFlap.vascular_anatomy.dominant_pedicle.pedicle_length_cm,
        unitSystem
      );
      const mnShort = selectedFlap.classification.mathes_nahai
        ? selectedFlap.classification.mathes_nahai.replace(/\s*\([^)]*\)/g, '').trim()
        : '';
      const mn = mnShort ? ` · MN ${shortenLabel(mnShort, 14)}` : '';
      anchorsOut.push({
        key: 'pedicle',
        kind: 'pedicle',
        position: midPt,
        title: shortenLabel(
          primaryRealPedicle
            ? primaryRealPedicle.displayName
            : selectedFlap.vascular_anatomy.dominant_pedicle.artery,
          26
        ),
        subtitle: `${diam.isUnspecified ? 'Ø n/s' : `Ø ${diam.text}`} · ${len.isUnspecified ? 'L n/s' : len.text}${mn}`,
      });
    }

    if (
      layers.nerves.visible &&
      resolvedFlapOverlay.nervePath &&
      resolvedFlapOverlay.nervePath.length >= 2
    ) {
      const midIdx = Math.floor(resolvedFlapOverlay.nervePath.length / 2);
      const nerveName =
        selectedFlap.nerves.sensory[0] ||
        selectedFlap.nerves.motor[0] ||
        'Regional Nerve';
      anchorsOut.push({
        key: 'nerve',
        kind: 'nerve',
        position: mapPt(resolvedFlapOverlay.nervePath[midIdx]),
        title: shortenLabel(nerveName, 22),
        subtitle: selectedFlap.nerves.can_be_sensate ? 'Sensate' : 'Motor',
      });
    }

    return anchorsOut;
  }, [
    selectedFlap,
    resolvedFlapOverlay,
    resolvedFlapVessels,
    donorSide,
    layers.perforators.visible,
    layers.arteries.visible,
    layers.nerves.visible,
    unitSystem,
  ]);

  useEffect(() => {
    calloutAnchorsRef.current = calloutAnchors;
    requestRenderRef.current();
  }, [calloutAnchors, show3DLabels, teachingMode, compact, selectedAnatomyInfo]);

  useEffect(() => {
    setAnatomyCardDetailsOpen(false);
  }, [selectedAnatomyInfo?.id, selectedAnatomyInfo?.meshName]);

  // Brief toast auto-clear
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 2200);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  // Escape closes context menu, search dropdown & clears anatomy selection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setStructureSearchOpen(false);
        setSelectedAnatomyInfo(null);
        setCalibratingAnchorId(null);
      }
    };
    const onPointerDownOutside = (e: MouseEvent) => {
      if (
        structureSearchContainerRef.current &&
        !structureSearchContainerRef.current.contains(e.target as Node)
      ) {
        setStructureSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDownOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDownOutside);
    };
  }, [setSelectedAnatomyInfo, setCalibratingAnchorId]);

  // =========================================================================
  // 1. Mount Three.js WebGLRenderer, Lighting, Studio Floor & Event Loop ONCE
  // =========================================================================
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'WebGL context could not be initialized.');
      return;
    }

    const gl = renderer.getContext();
    const isSoft = detectSoftwareGl(gl);
    isSoftwareGlRef.current = isSoft;

    const initQuality = useAtlasStore.getState().renderQuality;
    const initDprCap = isSoft
      ? 1.0
      : initQuality === 'quality'
        ? 2.0
        : initQuality === 'fast'
          ? 1.0
          : 1.5;
    effectiveDprCapRef.current = initDprCap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, initDprCap));
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 520);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = false;
    renderer.localClippingEnabled = true;
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const initTheme = useAtlasStore.getState().theme;
    const initBgHex =
      initTheme === 'or-dim' ? 0x050911 : initTheme === 'dark' ? 0x0f172a : 0xeef2f7;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initBgHex);
    scene.fog = new THREE.Fog(initBgHex, 4.8, 12.5);
    sceneRef.current = scene;

    // Neutral studio IBL via RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // 3-point clinical illumination
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0xcbd5e1, 0.92);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    keyLight.position.set(2.4, 3.6, 2.8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.65);
    rimLight.position.set(-2.5, 2.4, -2.6);
    scene.add(rimLight);

    // Subtle clinical studio floor disc & metric ring (repositioned dynamically to worldBox.min.y)
    const floorGeo = new THREE.CircleGeometry(2.6, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: initTheme === 'or-dim' ? 0x0b1322 : initTheme === 'dark' ? 0x1e293b : 0xe2e8f0,
      roughness: 0.92,
      metalness: 0.0,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.name = 'studio_floor';
    scene.add(floorMesh);
    floorMeshRef.current = floorMesh;

    const ringGeo = new THREE.RingGeometry(0.46, 0.47, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const floorRing = new THREE.Mesh(ringGeo, ringMat);
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = 0.002;
    scene.add(floorRing);
    floorRingRef.current = floorRing;

    const contactShadow = createContactShadowDisc();
    scene.add(contactShadow);
    contactShadowRef.current = contactShadow;

    const activeFlapGroup = new THREE.Group();
    activeFlapGroup.name = 'ActiveFlapOverlay';
    scene.add(activeFlapGroup);
    activeFlapGroupRef.current = activeFlapGroup;

    const territorySchematicMuscleGroup = new THREE.Group();
    territorySchematicMuscleGroup.name = 'TerritorySchematicMuscleOverlay';
    scene.add(territorySchematicMuscleGroup);
    territorySchematicMuscleGroupRef.current = territorySchematicMuscleGroup;

    const territoryCorridorGroup = new THREE.Group();
    territoryCorridorGroup.name = 'TerritoryPerforatorCorridors';
    scene.add(territoryCorridorGroup);
    territoryCorridorGroupRef.current = territoryCorridorGroup;

    const territoryPerforasomeGroup = new THREE.Group();
    territoryPerforasomeGroup.name = 'TerritoryFlapPerforasomes';
    scene.add(territoryPerforasomeGroup);
    territoryPerforasomeGroupRef.current = territoryPerforasomeGroup;

    const dopplerPlannerPinsGroup = new THREE.Group();
    dopplerPlannerPinsGroup.name = 'DopplerPlannerPins';
    scene.add(dopplerPlannerPinsGroup);
    dopplerPlannerPinsGroupRef.current = dopplerPlannerPinsGroup;

    const anchorMarkersGroup = new THREE.Group();
    anchorMarkersGroup.name = 'CalibratedLandmarkAnchors';
    scene.add(anchorMarkersGroup);
    anchorMarkersGroupRef.current = anchorMarkersGroup;

    const selectionHighlightGroup = new THREE.Group();
    selectionHighlightGroup.name = 'SelectionHighlightRoot';
    scene.add(selectionHighlightGroup);
    selectionHighlightGroupRef.current = selectionHighlightGroup;

    const flapVesselHighlightGroup = new THREE.Group();
    flapVesselHighlightGroup.name = 'FlapVesselHighlightRoot';
    scene.add(flapVesselHighlightGroup);
    flapVesselHighlightGroupRef.current = flapVesselHighlightGroup;

    const muscleVesselHighlightGroup = new THREE.Group();
    muscleVesselHighlightGroup.name = 'MuscleVesselHighlightRoot';
    scene.add(muscleVesselHighlightGroup);
    muscleVesselHighlightGroupRef.current = muscleVesselHighlightGroup;

    const operativeHighlightGroup = new THREE.Group();
    operativeHighlightGroup.name = 'OperativeHighlightRoot';
    scene.add(operativeHighlightGroup);
    operativeHighlightGroupRef.current = operativeHighlightGroup;

    const hoverHighlightGroup = new THREE.Group();
    hoverHighlightGroup.name = 'HoverHighlightRoot';
    scene.add(hoverHighlightGroup);
    hoverHighlightGroupRef.current = hoverHighlightGroup;

    const clippingGuideGroup = new THREE.Group();
    clippingGuideGroup.name = 'ClippingGuideRoot';
    scene.add(clippingGuideGroup);
    clippingGuideGroupRef.current = clippingGuideGroup;

    const measureGroup = new THREE.Group();
    measureGroup.name = 'MeasureOverlay';
    scene.add(measureGroup);
    measureGroupRef.current = measureGroup;

    // Camera & OrbitControls
    const w = container.clientWidth || 640;
    const h = container.clientHeight || 520;
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.05, 30);
    camera.position.set(0, 1.05, 2.65);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.94, 0);
    controls.enableDamping = !isSoft;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.42;
    controls.maxDistance = 4.6;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.minPolarAngle = 0.15;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.update();
    controlsRef.current = controls;

    // Reusable math objects (zero allocations in frame loop)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const viewDir = new THREE.Vector3();
    const projVec = new THREE.Vector3();
    const focusOffset = new THREE.Vector3();

    let rafId = 0;
    let disposed = false;
    let lastOrientation = 'Anterior';
    let lastHudUpdateMs = 0;
    let animPhase = 0;

    // Adaptive DPR governor: if active-frame FPS stays < 30 for >= 2000ms, step down pixelRatio
    let lastFrameTimestamp = 0;
    let lowFpsAccumMs = 0;
    let emaFrameMs = 16.7;

    const updateOrientationText = (nowMs: number) => {
      if (immersiveRef.current) return;
      if (nowMs - lastHudUpdateMs < 120) return;
      lastHudUpdateMs = nowMs;
      camera.getWorldDirection(viewDir);
      const ax = Math.abs(viewDir.x);
      const ay = Math.abs(viewDir.y);
      const az = Math.abs(viewDir.z);
      let next = 'Anterior';
      if (ay > ax && ay > az) {
        next = viewDir.y < 0 ? 'Superior' : 'Inferior';
      } else if (az >= ax) {
        next = viewDir.z < 0 ? 'Anterior' : 'Posterior';
      } else {
        next = viewDir.x < 0 ? 'Left Lateral' : 'Right Lateral';
      }
      if (next !== lastOrientation) {
        lastOrientation = next;
        setOrientationLabel(next);
      }
    };

    const updateProjectedCallouts = () => {
      const state = useAtlasStore.getState();
      if (!state.show3DLabels || state.teachingMode || state.selectedAnatomyInfo) return;
      const cw = renderer.domElement.clientWidth;
      const ch = renderer.domElement.clientHeight;
      if (!cw || !ch) return;

      const anchors = calloutAnchorsRef.current;
      const placed: Array<{ x: number; y: number }> = [];

      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i];
        const el = labelElRefs.current[a.key];
        if (!el) continue;

        projVec.set(a.position[0], a.position[1], a.position[2]);
        projVec.project(camera);

        if (projVec.z > 1 || projVec.z < -1) {
          el.style.opacity = '0';
          continue;
        }

        const rawX = (projVec.x * 0.5 + 0.5) * cw;
        const rawY = (-projVec.y * 0.5 + 0.5) * ch;

        // Hide if anchor itself is far outside the viewport
        if (rawX < -20 || rawX > cw + 20 || rawY < 18 || rawY > ch - 70) {
          el.style.opacity = '0';
          continue;
        }

        const halfW = Math.min((el.offsetWidth || 110) * 0.5, cw * 0.44);
        const clampedX = Math.max(halfW + 8, Math.min(cw - halfW - 8, rawX));
        let clampedY = Math.max(88, Math.min(ch - 92, rawY));

        // Lightweight vertical stagger so neighboring perforator/nerve tags never pile up
        for (let k = 0; k < placed.length; k++) {
          if (Math.abs(clampedX - placed[k].x) < 95 && Math.abs(clampedY - placed[k].y) < 22) {
            clampedY = Math.max(88, Math.min(ch - 92, placed[k].y + 24));
          }
        }
        placed.push({ x: clampedX, y: clampedY });

        el.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0) translate(-50%, -125%)`;
        el.style.opacity = '1';
      }
    };

    const renderFrame = () => {
      rafId = 0;
      if (disposed) return;

      const nowMs = performance.now();
      if (lastFrameTimestamp > 0) {
        const dt = nowMs - lastFrameTimestamp;
        if (dt > 4 && dt < 260) {
          emaFrameMs = emaFrameMs * 0.8 + dt * 0.2;
          if (!isSoft && emaFrameMs > 33.4) {
            lowFpsAccumMs += dt;
            if (lowFpsAccumMs >= 2000 && effectiveDprCapRef.current > 0.75) {
              const cur = effectiveDprCapRef.current;
              const nextCap = cur > 1.5 ? 1.5 : cur > 1.15 ? 1.15 : cur > 0.9 ? 0.9 : 0.75;
              effectiveDprCapRef.current = nextCap;
              renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, nextCap));
              lowFpsAccumMs = 0;
            }
          } else {
            lowFpsAccumMs = Math.max(0, lowFpsAccumMs - dt * 0.5);
          }
        }
      }
      lastFrameTimestamp = nowMs;

      let keepRunning = false;

      // Smooth camera preset / double-click focus transition
      if (cameraGoalRef.current) {
        const { pos, target } = cameraGoalRef.current;
        if (isSoft) {
          camera.position.copy(pos);
          controls.target.copy(target);
          cameraGoalRef.current = null;
        } else {
          camera.position.lerp(pos, 0.14);
          controls.target.lerp(target, 0.14);
          if (
            camera.position.distanceTo(pos) < 0.008 &&
            controls.target.distanceTo(target) < 0.008
          ) {
            camera.position.copy(pos);
            controls.target.copy(target);
            cameraGoalRef.current = null;
          } else {
            keepRunning = true;
          }
        }
      }

      // Active arc/transfer animation
      const storeState = useAtlasStore.getState();
      const mode = storeState.animationMode;
      if (mode !== 'none' && animGhostRef.current) {
        animPhase = (animPhase + (isSoft ? 0.035 : 0.012)) % 1;
        const smoothT = 0.5 - 0.5 * Math.cos(animPhase * Math.PI * 2);
        if (mode === 'transfer' && animPathRef.current) {
          animPathRef.current.getPointAt(smoothT, animGhostRef.current.position);
        } else if (mode === 'arc' && arcPivotRef.current) {
          const angle = -0.65 + smoothT * 1.3;
          const r = arcRadiusRef.current * 0.72;
          animGhostRef.current.position.set(
            arcPivotRef.current.x + Math.sin(angle) * r,
            arcPivotRef.current.y + Math.cos(angle) * r * 0.65,
            arcPivotRef.current.z + 0.045
          );
        }
        keepRunning = true;
      }

      // Sub-Phase 9d: Smooth arterial pulse for highlighted real "pedicle" meshes
      const pulseHandles = flapPediclePulseHandlesRef.current;
      if (
        pulseHandles.length > 0 &&
        !storeState.calibrationViewActive &&
        !storeState.selectedAnatomyInfo
      ) {
        if (isSoft || storeState.renderQuality === 'fast') {
          for (let i = 0; i < pulseHandles.length; i++) {
            pulseHandles[i].coreMat.emissiveIntensity = pulseHandles[i].baseEmissiveIntensity + 0.16;
            if (pulseHandles[i].outlineMat) {
              pulseHandles[i].outlineMat!.opacity = 0.94;
            }
          }
        } else {
          const wave = 0.5 + 0.5 * Math.sin(nowMs * 0.0042);
          for (let i = 0; i < pulseHandles.length; i++) {
            pulseHandles[i].coreMat.emissiveIntensity =
              pulseHandles[i].baseEmissiveIntensity * 0.72 + wave * 0.48;
            if (pulseHandles[i].outlineMat) {
              pulseHandles[i].outlineMat!.opacity = 0.7 + wave * 0.28;
            }
          }
          keepRunning = true;
        }
      }

      controls.update();
      updateOrientationText(nowMs);
      renderer.render(scene, camera);
      updateProjectedCallouts();

      if (isSoft && gl instanceof WebGL2RenderingContext) {
        gl.flush();
      }

      if (keepRunning) {
        scheduleRender();
      }
    };

    const scheduleRender = () => {
      if (!rafId && !disposed) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };
    requestRenderRef.current = scheduleRender;

    let lastCorridorHudCheckMs = 0;
    const onControlsChange = () => {
      const now = performance.now();
      if (now - lastCorridorHudCheckMs >= 120) {
        lastCorridorHudCheckMs = now;
        const dist = camera.position.distanceTo(controls.target);
        const nextTier = classifyCorridorZoomTier(dist);
        if (nextTier !== corridorZoomTierRef.current) {
          corridorZoomTierRef.current = nextTier;
          if (useAtlasStore.getState().territoryMode === 'perforators') {
            setCorridorZoomTier(nextTier);
          }
        }
      }
      scheduleRender();
    };
    controls.addEventListener('change', onControlsChange);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = Math.max(100, Math.floor(entry.contentRect.width));
        const ch = Math.max(100, Math.floor(entry.contentRect.height));
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
        renderer.setSize(cw, ch, false);
        scheduleRender();
      }
    });
    ro.observe(container);

    // Raycasting & multi-touch gesture helpers
    let pointerDownPos = { x: 0, y: 0 };
    let longPressTimer: number | null = null;
    let longPressTriggered = false;
    const activePointers = new Set<number>();
    let multiTouchActive = false;
    let lastTapTime = 0;
    let lastTapPos = { x: 0, y: 0 };

    const clearLongPressTimer = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    const getInteractiveTargets = (): THREE.Object3D[] => {
      const targets: THREE.Object3D[] = [];
      if (anchorMarkersGroupRef.current && anchorMarkersGroupRef.current.visible) {
        anchorMarkersGroupRef.current.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.userData?.anchorId) {
            targets.push(obj);
          }
        });
      }
      if (externalGlbRef.current) {
        targets.push(...externalGlbRef.current.interactiveMeshes);
      }
      if (bodyRigRef.current) {
        targets.push(...bodyRigRef.current.interactiveMeshes);
      }
      return targets;
    };

    const isHitHiddenByVisibility = (hit: THREE.Intersection): boolean => {
      const vis = useAtlasStore.getState().visibilityState;
      const hiddenKeys = hiddenMeshKeysRef.current;
      const isolatedKeys = vis.isolatedMeshKeys;
      const hasIsolation = isolatedKeys.length > 0;
      if (hiddenKeys.size === 0 && !hasIsolation) return false;

      if (hit.object.userData?.isMergedSystemMesh) {
        const sub = resolveMergedPick(hit);
        if (!sub) return false;
        if (hiddenKeys.has(sub.meshKey)) return true;
        if (hasIsolation) {
          if (isolatedKeys.includes(sub.meshKey)) return false;
          if (vis.isolateKeepSkeleton && sub.system === 'skeleton') return false;
          return true;
        }
        return false;
      }

      const key = String(
        hit.object.userData?.anatomy_id || hit.object.name || ''
      );
      if (key && hiddenKeys.has(key)) return true;
      if (hasIsolation && key) {
        if (isolatedKeys.includes(key)) return false;
        if (vis.isolateKeepSkeleton && hit.object.userData?.anatomy_system === 'skeleton') {
          return false;
        }
        return true;
      }
      return false;
    };

    const getHit = (e: PointerEvent | MouseEvent, includeSkinInTerritory = false) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const visibleTargets = getInteractiveTargets().filter((obj) => {
        let cur: THREE.Object3D | null = obj;
        while (cur) {
          if (!cur.visible) return false;
          cur = cur.parent;
        }
        return true;
      });
      const rawHits = raycaster.intersectObjects(visibleTargets, false);
      if (rawHits.length === 0) return null;

      // Phase 12-2 Requirement E: raycasting MUST skip hidden sub-meshes
      const hits = rawHits.filter((h) => !isHitHiddenByVisibility(h));
      if (hits.length === 0) return null;

      // In Territory Mode, allow picking the outermost visible tissue layer (skin -> muscle -> bone)
      if (includeSkinInTerritory) {
        const tissueHit = hits.find((h) => {
          const sys = h.object.userData?.anatomy_system;
          return sys === 'skin' || sys === 'muscles' || sys === 'skeleton';
        });
        return tissueHit || hits[0] || null;
      }

      // When translucent whole-body skin is ON (default 15%), allow picking vessels/muscles/bones inside
      const skinOpacity = useAtlasStore.getState().layers.skin?.opacity ?? 0.15;
      if (skinOpacity < 0.85) {
        const innerHit = hits.find((h) => h.object.userData?.anatomy_system !== 'skin');
        if (innerHit) return innerHit;
      }
      return hits[0] || null;
    };

    const extractPickMeta = (hit: THREE.Intersection | null): SelectedAnatomyInfo | null => {
      if (!hit) return null;
      if (hit.object.userData?.isMergedSystemMesh) {
        const sub = resolveMergedPick(hit);
        if (sub) {
          const ext = externalGlbRef.current;
          const effAlign = getEffectiveAlignmentForBody(
            ext,
            useAtlasStore.getState().vesselAlignment
          );
          return buildSelectedInfoForSubMesh(sub, ext, effAlign);
        }
      }
      if (hit.object.userData?.anatomy_id || hit.object.userData?.anatomy_label) {
        const box = new THREE.Box3().setFromObject(hit.object);
        const ctr = new THREE.Vector3();
        if (!box.isEmpty()) box.getCenter(ctr);
        const isAnchor = Boolean(hit.object.userData?.anchorId);
        const isRealActive = Boolean(externalGlbRef.current);
        return {
          id: hit.object.userData.anatomy_id || hit.object.name || 'structure',
          label: hit.object.userData.anatomy_label || hit.object.name || 'Structure',
          category: hit.object.userData.anatomy_category || 'Structure',
          meshName: hit.object.userData.anatomy_mesh_name || hit.object.name || '',
          laterality: hit.object.userData.anatomy_laterality || 'midline',
          system: hit.object.userData.anatomy_system,
          mapped: hit.object.userData.anatomy_mapped ?? true,
          linkedFlapIds: hit.object.userData.linked_flap_ids ?? [],
          isSchematic: isAnchor ? false : isRealActive,
          center: [ctr.x, ctr.y, ctr.z],
          boundsMin: box.isEmpty() ? undefined : [box.min.x, box.min.y, box.min.z],
          boundsMax: box.isEmpty() ? undefined : [box.max.x, box.max.y, box.max.z],
        };
      }
      return null;
    };

    const clearHoverHighlight = () => {
      if (hoveredSubMeshKeyRef.current !== null && hoverHighlightGroupRef.current) {
        disposeSelectionHighlightGroup(hoverHighlightGroupRef.current);
        hoveredSubMeshKeyRef.current = null;
        scheduleRender();
      }
    };

    const updateHoverHighlight = (hit: THREE.Intersection | null, meta: SelectedAnatomyInfo | null) => {
      const hoverRoot = hoverHighlightGroupRef.current;
      if (!hoverRoot) return;
      const nextKey = meta ? meta.subMeshKey || `${meta.id}:${meta.meshName || ''}` : null;
      const selectedKey = useAtlasStore.getState().selectedAnatomyInfo?.subMeshKey || null;
      // Avoid double-outlining the currently selected structure or translucent whole-body skin
      if (!nextKey || !hit || !meta || meta.system === 'skin' || (selectedKey && nextKey === selectedKey)) {
        clearHoverHighlight();
        return;
      }
      if (hoveredSubMeshKeyRef.current === nextKey) return;

      disposeSelectionHighlightGroup(hoverRoot);
      hoveredSubMeshKeyRef.current = nextKey;

      let geom: THREE.BufferGeometry | null = null;
      const ext = externalGlbRef.current;
      if (ext && meta.subMeshKey) {
        const match = findMergedMeshForSubMesh(ext, meta.subMeshKey);
        if (match) {
          geom = extractSubMeshGeometry(match.mesh, match.record);
        }
      } else if (hit.object instanceof THREE.Mesh) {
        geom = extractSubMeshGeometry(hit.object, null);
      }

      if (geom) {
        const colorHex =
          meta.system === 'arteries'
            ? 0xfef08a
            : meta.system === 'veins'
              ? 0x7dd3fc
              : 0x38bdf8;
        const hoverGrp = createHoverHighlightGroup(
          geom,
          activeClippingPlanesRef.current,
          colorHex
        );
        hoverRoot.add(hoverGrp);
      }
      scheduleRender();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons !== 0 || e.pointerType === 'touch') {
        const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (moveDist > 8) clearLongPressTimer();
        return;
      }
      const st = useAtlasStore.getState();
      if (st.calibratingAnchorId) {
        renderer.domElement.style.cursor = 'crosshair';
        setHoveredInfo(null);
        setTerritoryHoverLabel(null);
        clearHoverHighlight();
        return;
      }

      // Phase 11c: On-demand single territory hover label (no permanent clutter)
      if (st.territoryMode !== 'off' && territoryFieldDataRef.current) {
        const tHit = getHit(e, true);
        if (tHit) {
          const sample = sampleTerritoryFieldAtWorldPos(territoryFieldDataRef.current, [
            tHit.point.x,
            tHit.point.y,
            tHit.point.z,
          ]);
          const sideMatch =
            st.territorySideFilter === 'both' ||
            (st.territorySideFilter === 'right' && sample.side === 'right') ||
            (st.territorySideFilter === 'left' && sample.side === 'left') ||
            sample.side === 'midline';
          const slotEntry =
            sample.inside && sideMatch
              ? TERRITORY_SLOT_BY_INDEX.get(sample.primarySlot)
              : undefined;
          if (slotEntry) {
            const rect = container.getBoundingClientRect();
            const relX = Math.max(12, Math.min(rect.width - 210, e.clientX - rect.left + 14));
            const relY = Math.max(12, Math.min(rect.height - 54, e.clientY - rect.top - 12));
            setTerritoryHoverLabel({
              territoryId: slotEntry.territoryId,
              label: slotEntry.label,
              side: sample.side,
              isSchematic: slotEntry.isSchematic,
              x: relX,
              y: relY,
            });
            setHoveredInfo(null);
            clearHoverHighlight();
            renderer.domElement.style.cursor = 'pointer';
            return;
          }
        }
        setTerritoryHoverLabel(null);
        setHoveredInfo(null);
        clearHoverHighlight();
        renderer.domElement.style.cursor = 'grab';
        return;
      }

      setTerritoryHoverLabel(null);
      const hit = getHit(e);
      const meta = extractPickMeta(hit);
      if (meta) {
        setHoveredInfo({
          label: meta.label,
          category: meta.category,
          laterality: meta.laterality,
          system: meta.system,
          sourceModel: meta.sourceModel,
        });
        updateHoverHighlight(hit, meta);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredInfo(null);
        clearHoverHighlight();
        renderer.domElement.style.cursor = st.measureMode
          ? 'crosshair'
          : 'grab';
      }
    };

    const onPointerLeave = () => {
      clearLongPressTimer();
      setHoveredInfo(null);
      setTerritoryHoverLabel(null);
      clearHoverHighlight();
    };

    const openImmersiveContextMenuAt = (clientX: number, clientY: number, eventLike: PointerEvent | MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const relX = Math.max(12, Math.min(rect.width - 176, clientX - rect.left));
      const relY = Math.max(12, Math.min(rect.height - 96, clientY - rect.top));
      const st = useAtlasStore.getState();

      if (st.territoryMode !== 'off' && territoryFieldDataRef.current) {
        const tHit = getHit(eventLike as PointerEvent, true);
        if (tHit) {
          const sample = sampleTerritoryFieldAtWorldPos(territoryFieldDataRef.current, [
            tHit.point.x,
            tHit.point.y,
            tHit.point.z,
          ]);
          const slotEntry = sample.inside
            ? TERRITORY_SLOT_BY_INDEX.get(sample.primarySlot)
            : undefined;
          if (slotEntry) {
            const sideChoice =
              sample.side === 'left' || sample.side === 'right'
                ? sample.side
                : st.territorySideFilter;
            st.setViewerContextMenu({
              x: relX,
              y: relY,
              label: slotEntry.label,
              territoryId: slotEntry.territoryId,
              territorySide: sideChoice,
            });
            return;
          }
        }
      }

      const hit = getHit(eventLike as PointerEvent);
      const meta = extractPickMeta(hit);
      if (meta) {
        const groupKeys =
          meta.constituentParts && meta.constituentParts.length > 0
            ? meta.constituentParts.map((p) => p.meshKey).filter(Boolean)
            : meta.subMeshKey
              ? [meta.subMeshKey]
              : [meta.id];
        const partRec = meta.subMeshKey
          ? meta.constituentParts?.find((p) => p.meshKey === meta.subMeshKey)
          : undefined;
        st.setViewerContextMenu({
          x: Math.max(12, Math.min(rect.width - 208, clientX - rect.left)),
          y: Math.max(12, Math.min(rect.height - 240, clientY - rect.top)),
          label: meta.label,
          anatomyInfo: meta,
          meshKeys: groupKeys,
          partMeshKey: meta.subMeshKey,
          partLabel: partRec?.label,
          system: meta.system,
          laterality: meta.laterality,
          isMultiPart:
            Boolean(meta.constituentParts && meta.constituentParts.length > 1 && meta.subMeshKey),
        });
      } else {
        const activeFlap = st.flaps.find((f) => f.id === st.selectedFlapId);
        st.setViewerContextMenu({
          x: relX,
          y: relY,
          label: st.hasSelectedFlap && activeFlap ? activeFlap.name : 'Anatomy Overview',
          flapId: st.hasSelectedFlap && activeFlap ? activeFlap.id : undefined,
        });
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      clearLongPressTimer();
      if (activePointers.size === 0) {
        multiTouchActive = false;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      activePointers.add(e.pointerId);
      if (activePointers.size > 1) {
        multiTouchActive = true;
        clearLongPressTimer();
        return;
      }
      multiTouchActive = false;
      if (e.button === 0) {
        setContextMenu(null);
        if (useAtlasStore.getState().viewerContextMenu) {
          useAtlasStore.getState().setViewerContextMenu(null);
        }
      }
      pointerDownPos = { x: e.clientX, y: e.clientY };
      longPressTriggered = false;
      clearLongPressTimer();

      const st = useAtlasStore.getState();
      if (e.button === 0 && immersiveRef.current) {
        const downEvent = e;
        const downX = e.clientX;
        const downY = e.clientY;
        longPressTimer = window.setTimeout(() => {
          if (multiTouchActive || activePointers.size !== 1) return;
          longPressTriggered = true;
          openImmersiveContextMenuAt(downX, downY, downEvent);
        }, 480);
      } else if (e.button === 0 && st.territoryMode !== 'off' && territoryFieldDataRef.current) {
        const downEvent = e;
        longPressTimer = window.setTimeout(() => {
          const field = territoryFieldDataRef.current;
          if (!field) return;
          const tHit = getHit(downEvent, true);
          if (!tHit) return;
          const sample = sampleTerritoryFieldAtWorldPos(field, [
            tHit.point.x,
            tHit.point.y,
            tHit.point.z,
          ]);
          const slotEntry = sample.inside
            ? TERRITORY_SLOT_BY_INDEX.get(sample.primarySlot)
            : undefined;
          if (slotEntry) {
            longPressTriggered = true;
            useAtlasStore.getState().setPinnedTerritoryLabel({
              territoryId: slotEntry.territoryId,
              side: sample.side,
              worldPos: [tHit.point.x, tHit.point.y, tHit.point.z],
            });
            setToastMsg(`Pinned territory label: ${slotEntry.label}`);
          }
        }, 450);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      clearLongPressTimer();
      if (multiTouchActive) {
        if (activePointers.size === 0) {
          multiTouchActive = false;
        }
        return;
      }
      if (e.button !== 0) return;
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 8) return;

      const state = useAtlasStore.getState();

      // Unified double-tap in immersive mode: focus tapped structure, or reset view on empty space
      if (immersiveRef.current && !state.calibratingAnchorId && !state.measureMode && !state.plannerDropMode) {
        const now = performance.now();
        const tapDist = Math.hypot(e.clientX - lastTapPos.x, e.clientY - lastTapPos.y);
        if (now - lastTapTime < 320 && tapDist < 28) {
          lastTapTime = 0;
          const hit = getHit(e);
          const meta = extractPickMeta(hit);
          if (hit && meta) {
            if (meta.boundsMin && meta.boundsMax) {
              const goal = computeStructureFocusCamera(
                meta.boundsMin,
                meta.boundsMax,
                meta.center
              );
              cameraGoalRef.current = {
                pos: new THREE.Vector3(...goal.pos),
                target: new THREE.Vector3(...goal.target),
              };
            } else {
              const pt = hit.point.clone();
              focusOffset.copy(camera.position).sub(controls.target).normalize().multiplyScalar(0.85);
              cameraGoalRef.current = {
                pos: pt.clone().add(focusOffset),
                target: pt,
              };
            }
            const isKnownVessel = VESSELS.some((v) => v.id === meta.id);
            if (isKnownVessel) {
              selectVessel(meta.id, false);
            }
            setSelectedAnatomyInfo(meta);
            scheduleRender();
          } else {
            // Double-tap on empty space resets view smoothly
            state.setCameraPreset('anterior-full');
          }
          return;
        }
        lastTapTime = now;
        lastTapPos = { x: e.clientX, y: e.clientY };
      }

      // Phase 8c: Editor Mode "Click on the skeleton to set this anchor" tool
      if (state.calibratingAnchorId) {
        const skelTargets: THREE.Object3D[] = [];
        const extSkel = externalGlbRef.current?.systemGroups.skeleton;
        if (extSkel) {
          extSkel.traverse((obj) => {
            if (obj instanceof THREE.Mesh) skelTargets.push(obj);
          });
        } else if (bodyRigRef.current?.layerGroups.skeleton) {
          bodyRigRef.current.layerGroups.skeleton.traverse((obj) => {
            if (obj instanceof THREE.Mesh) skelTargets.push(obj);
          });
        }

        if (skelTargets.length > 0) {
          const rect = renderer.domElement.getBoundingClientRect();
          pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointerNdc, camera);
          const skelHits = raycaster.intersectObjects(skelTargets, false);
          if (skelHits.length > 0) {
            const hit = skelHits[0];
            const pt: [number, number, number] = [
              Number(hit.point.x.toFixed(4)),
              Number(hit.point.y.toFixed(4)),
              Number(hit.point.z.toFixed(4)),
            ];
            let boneName: string | undefined;
            if (hit.object.userData?.isMergedSystemMesh) {
              boneName = resolveMergedPick(hit)?.meshName;
            } else {
              boneName = hit.object.userData?.anatomy_label || hit.object.name || undefined;
            }
            const targetAnchor = state.anchors.find((a) => a.id === state.calibratingAnchorId);
            state.setAnchorPosition(state.calibratingAnchorId, pt, boneName);
            setToastMsg(
              `Calibrated ${targetAnchor?.shortLabel || 'Anchor'} on ${boneName || 'skeleton'} (${(pt[0] * 100).toFixed(1)}, ${(pt[1] * 100).toFixed(1)}, ${(pt[2] * 100).toFixed(1)} cm)`
            );
            scheduleRender();
            return;
          }
        }
        setToastMsg('Click directly on a bone of the skeleton to place this anchor');
        return;
      }

      // Advisor 3D Defect Picker Mode (click directly on body to select nearest defect zone)
      const activeRoot = externalGlbRef.current?.root || bodyRigRef.current?.root;
      if (defectPickModeRef.current && onPickDefectPointRef.current && activeRoot) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);
        const allHits = raycaster.intersectObject(activeRoot, true);
        if (allHits.length > 0) {
          const p = allHits[0].point;
          onPickDefectPointRef.current([
            Number(p.x.toFixed(3)),
            Number(p.y.toFixed(3)),
            Number(p.z.toFixed(3)),
          ]);
          return;
        }
      }

      // Surface Measuring Mode
      if (state.measureMode && activeRoot) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);
        const allHits = raycaster.intersectObject(activeRoot, true);
        if (allHits.length > 0 && measureGroupRef.current) {
          const pt = allHits[0].point.clone();
          const pts = measurePointsRef.current;
          if (pts.length >= 2) {
            pts.length = 0;
            disposeGroupChildren(measureGroupRef.current);
          }
          pts.push(pt);
          const pin = new THREE.Mesh(
            new THREE.SphereGeometry(0.0085, 12, 10),
            new THREE.MeshBasicMaterial({ color: 0x0d9488 })
          );
          pin.position.copy(pt);
          measureGroupRef.current.add(pin);

          if (pts.length === 2) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
            const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x0d9488 }));
            measureGroupRef.current.add(line);
            const cm = Number((pts[0].distanceTo(pts[1]) * 100).toFixed(1));
            setMeasureCm(cm);
          } else {
            setMeasureCm(null);
          }
          scheduleRender();
        }
        return;
      }

      // Phase 11c/11d/11e: Tap/click picking & Doppler/CTA skin-tap placement in Vascular Territories mode
      if (state.territoryMode !== 'off' && territoryFieldDataRef.current) {
        // Phase 11e: Doppler / CTA Planner skin-tap drop mode (local only, no PHI, no auto-calculated mm)
        if (state.territoryMode === 'perforators' && state.plannerDropMode) {
          const skinTargets: THREE.Object3D[] = [];
          const extSkin = externalGlbRef.current?.systemGroups.skin;
          if (extSkin) {
            extSkin.traverse((obj) => {
              if (obj instanceof THREE.Mesh) skinTargets.push(obj);
            });
          } else if (activeRoot) {
            skinTargets.push(activeRoot);
          }

          if (skinTargets.length > 0) {
            const rect = renderer.domElement.getBoundingClientRect();
            pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointerNdc, camera);
            const skinHits = raycaster.intersectObjects(skinTargets, true);
            if (skinHits.length > 0) {
              const hit = skinHits[0];
              const hitNormal = new THREE.Vector3(0, 0, 1);
              if (hit.face) {
                hitNormal
                  .copy(hit.face.normal)
                  .transformDirection(hit.object.matrixWorld)
                  .normalize();
              }
              const toCam = camera.position.clone().sub(hit.point).normalize();
              if (hitNormal.dot(toCam) < 0) hitNormal.negate();

              const created = state.addDopplerPlannerMarker({
                worldPos: [hit.point.x, hit.point.y, hit.point.z],
                worldNormal: [hitNormal.x, hitNormal.y, hitNormal.z],
              });
              state.setTerritorySheetOpen(true);
              setToastMsg(`Placed local marker: ${created.label} (IndexedDB only · No PHI)`);
              scheduleRender();
              return;
            }
          }
          setToastMsg('Tap directly on the 3-D skin surface to drop a Doppler / CTA marker');
          return;
        }

        // Phase 11e: Tap on a saved Doppler/CTA planner pin or instanced real-artery corridor dot
        if (state.territoryMode === 'perforators') {
          const rect = renderer.domElement.getBoundingClientRect();
          pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointerNdc, camera);

          if (
            dopplerPlannerPinsGroupRef.current &&
            dopplerPlannerPinsGroupRef.current.visible &&
            dopplerPlannerPinsGroupRef.current.children.length > 0
          ) {
            const pinHits = raycaster.intersectObjects(
              dopplerPlannerPinsGroupRef.current.children,
              false
            );
            const hitWithIdx = pinHits.find((h) => typeof h.instanceId === 'number');
            if (hitWithIdx && typeof hitWithIdx.instanceId === 'number') {
              const marker = state.dopplerPlannerMarkers[hitWithIdx.instanceId];
              if (marker) {
                state.setSelectedPlannerMarkerId(marker.id);
                state.setTerritorySheetOpen(true);
                return;
              }
            }
          }

          if (
            territoryCorridorGroupRef.current &&
            territoryCorridorGroupRef.current.visible &&
            territoryCorridorGroupRef.current.children.length > 0
          ) {
            const corrHits = raycaster.intersectObjects(
              territoryCorridorGroupRef.current.children,
              false
            );
            const hitWithIdx = corrHits.find((h) => typeof h.instanceId === 'number');
            if (hitWithIdx && typeof hitWithIdx.instanceId === 'number') {
              const dot = visibleCorridorDotsRef.current[hitWithIdx.instanceId];
              if (dot) {
                const sideChoice =
                  dot.side === 'left' || dot.side === 'right'
                    ? dot.side
                    : state.territorySideFilter;
                state.focusTerritory(dot.territoryId, sideChoice, false);
                return;
              }
            }
          }
        }

        const tHit = getHit(e, true);
        if (tHit) {
          // Phase 11d: In Deep Muscle / Bone depth views (>= 40%), allow clicking a real BP3D
          // muscle or bone mesh directly to inspect its Ch. 23 territory count / NV type / bone card.
          if (state.territoryDepth >= 40) {
            const deepMeta = extractPickMeta(tHit);
            if (deepMeta && (deepMeta.system === 'muscles' || deepMeta.system === 'skeleton')) {
              setSelectedAnatomyInfo(deepMeta);
              return;
            }
          }
          const sample = sampleTerritoryFieldAtWorldPos(territoryFieldDataRef.current, [
            tHit.point.x,
            tHit.point.y,
            tHit.point.z,
          ]);
          const slotEntry = sample.inside
            ? TERRITORY_SLOT_BY_INDEX.get(sample.primarySlot)
            : undefined;
          if (slotEntry) {
            const sideChoice =
              sample.side === 'left' || sample.side === 'right'
                ? sample.side
                : state.territorySideFilter;
            state.focusTerritory(slotEntry.territoryId, sideChoice, false);
            return;
          }
        }
        if (state.focusedTerritoryId) {
          state.focusTerritory(null);
        }
        if (state.selectedAnatomyInfo) {
          setSelectedAnatomyInfo(null);
        }
        if (state.selectedSchematicMuscleId) {
          state.setSelectedSchematicMuscleId(null);
        }
        if (immersiveRef.current && state.sheetSnap === 'half') {
          state.setSheetSnap('collapsed');
        }
        return;
      }

      // Anatomy / Vessel selection -> opens Muscle Reference / Anatomy Detail Card at half height
      const hit = getHit(e);
      const meta = extractPickMeta(hit);
      if (meta) {
        const isKnownVessel = VESSELS.some((v) => v.id === meta.id);
        if (isKnownVessel) {
          selectVessel(meta.id, false);
        }
        if (immersiveRef.current && state.activeTab !== 'library' && state.activeTab !== 'anatomy') {
          setActiveTab('anatomy');
        }
        setSelectedAnatomyInfo(meta);
      } else {
        if (state.selectedAnatomyInfo) {
          // Clicking empty studio background clears selection and restores full opacity
          setSelectedAnatomyInfo(null);
        }
        if (immersiveRef.current && state.sheetSnap === 'half') {
          state.setSheetSnap('collapsed');
        }
      }
    };

    // Double-click to smoothly focus camera on any clicked 3D anatomical point
    const onDblClick = (e: MouseEvent) => {
      if (immersiveRef.current) return;
      const activeRoot = externalGlbRef.current?.root || bodyRigRef.current?.root;
      if (!activeRoot) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(
        [activeRoot, ...(activeFlapGroupRef.current ? [activeFlapGroupRef.current] : [])],
        true
      );
      if (hits.length > 0) {
        const pt = hits[0].point.clone();
        focusOffset.copy(camera.position).sub(controls.target).normalize().multiplyScalar(0.85);
        cameraGoalRef.current = {
          pos: pt.clone().add(focusOffset),
          target: pt,
        };
        scheduleRender();
      }
    };

    // Right-click clinical context menu
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (immersiveRef.current) {
        openImmersiveContextMenuAt(e.clientX, e.clientY, e);
        return;
      }
      const rect = container.getBoundingClientRect();
      const relX = Math.max(8, Math.min(rect.width - 205, e.clientX - rect.left));
      const relY = Math.max(8, Math.min(rect.height - 235, e.clientY - rect.top));
      setContextMenu({ x: relX, y: relY });
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);
    renderer.domElement.addEventListener('dblclick', onDblClick);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    scheduleRender();

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.removeEventListener('change', onControlsChange);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      if (anchorMarkersGroupRef.current) {
        disposeSelectionHighlightGroup(anchorMarkersGroupRef.current);
        anchorMarkersGroupRef.current = null;
      }
      if (selectionHighlightGroupRef.current) {
        disposeSelectionHighlightGroup(selectionHighlightGroupRef.current);
        selectionHighlightGroupRef.current = null;
      }
      if (flapVesselHighlightGroupRef.current) {
        disposeSelectionHighlightGroup(flapVesselHighlightGroupRef.current);
        flapVesselHighlightGroupRef.current = null;
      }
      if (muscleVesselHighlightGroupRef.current) {
        disposeSelectionHighlightGroup(muscleVesselHighlightGroupRef.current);
        muscleVesselHighlightGroupRef.current = null;
      }
      if (operativeHighlightGroupRef.current) {
        disposeSelectionHighlightGroup(operativeHighlightGroupRef.current);
        operativeHighlightGroupRef.current = null;
      }
      for (const ctrl of visibilityControllersRef.current) {
        disposeSubMeshVisibilityController(ctrl);
      }
      visibilityControllersRef.current = [];
      flapPediclePulseHandlesRef.current = [];
      if (hoverHighlightGroupRef.current) {
        disposeSelectionHighlightGroup(hoverHighlightGroupRef.current);
        hoverHighlightGroupRef.current = null;
      }
      if (clippingGuideGroupRef.current) {
        disposeSelectionHighlightGroup(clippingGuideGroupRef.current);
        clippingGuideGroupRef.current = null;
      }
      if (measureGroupRef.current) {
        disposeGroupChildren(measureGroupRef.current);
        measureGroupRef.current = null;
      }
      if (territorySchematicMuscleGroupRef.current) {
        disposeGroupChildren(territorySchematicMuscleGroupRef.current);
        territorySchematicMuscleGroupRef.current = null;
      }
      if (territoryCorridorGroupRef.current) {
        disposeGroupChildren(territoryCorridorGroupRef.current);
        territoryCorridorGroupRef.current = null;
      }
      if (territoryPerforasomeGroupRef.current) {
        disposeGroupChildren(territoryPerforasomeGroupRef.current);
        territoryPerforasomeGroupRef.current = null;
      }
      if (dopplerPlannerPinsGroupRef.current) {
        disposeGroupChildren(dopplerPlannerPinsGroupRef.current);
        dopplerPlannerPinsGroupRef.current = null;
      }
      skinSurfaceGridRef.current = null;
      realCorridorCacheRef.current = null;
      visibleCorridorDotsRef.current = [];
      if (territoryGpuRef.current) {
        detachAndDisposeTerritoryResources(externalGlbRef.current, territoryGpuRef.current);
        territoryGpuRef.current = null;
      }
      territoryFieldDataRef.current = null;
      floorMeshRef.current = null;
      floorRingRef.current = null;
      contactShadowRef.current = null;
      controls.dispose();
      envRT.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [selectVessel, setSelectedAnatomyInfo]);

  // =========================================================================
  // 2. Build / Rebuild Procedural Body Rig when `bodySex` changes
  // =========================================================================
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (bodyRigRef.current) {
      scene.remove(bodyRigRef.current.root);
      bodyRigRef.current.dispose();
    }

    const rig = buildProceduralBody(bodySex, colorblindMode);
    rig.root.visible = !externalGlbRef.current;
    scene.add(rig.root);
    bodyRigRef.current = rig;
    requestRenderRef.current();

    return () => {
      if (bodyRigRef.current === rig) {
        scene.remove(rig.root);
        rig.dispose();
        bodyRigRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodySex]);

  // =========================================================================
  // 2b. Phase 8a: Progressive Multi-System Real GLB Loader + Procedural Fallback
  // =========================================================================
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !hydrated) return;

    const abortController = new AbortController();
    let cancelled = false;

    const removePlaceholder = () => {
      if (skeletonPlaceholderRef.current) {
        scene.remove(skeletonPlaceholderRef.current);
        skeletonPlaceholderRef.current.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material?.dispose();
          }
        });
        skeletonPlaceholderRef.current = null;
      }
    };

    const syncHybridProceduralRig = (loaded: LoadedGlbBody | null) => {
      const rig = bodyRigRef.current;
      if (!rig) return;
      if (!loaded) {
        rig.root.visible = true;
        rig.root.scale.set(1, 1, 1);
        return;
      }
      // Real Z-Anatomy model lacks skin and complete vessels; keep procedural translucent skin
      // silhouette and schematic vascular layers scaled proportionally to the real model height.
      rig.root.visible = true;
      const heightRatio =
        loaded.detectedHeightMeters > 0.5
          ? loaded.detectedHeightMeters / BODY_MODEL_CONFIG.bodyHeightMeters
          : 1;
      rig.root.scale.set(heightRatio, heightRatio, heightRatio);

      const hasRealSkeleton = loaded.loadedSystems.includes('skeleton');
      const hasRealMuscles = loaded.loadedSystems.includes('muscles');
      const hasRealSkin = loaded.loadedSystems.includes('skin');
      const hasRealArteries = loaded.loadedSystems.includes('arteries');
      const hasRealVeins = loaded.loadedSystems.includes('veins');

      const currentLayers = useAtlasStore.getState().layers;
      if (rig.layerGroups.skeleton) {
        rig.layerGroups.skeleton.visible = hasRealSkeleton ? false : currentLayers.skeleton.visible;
      }
      if (rig.layerGroups.muscle) {
        rig.layerGroups.muscle.visible = hasRealMuscles ? false : currentLayers.muscle.visible;
      }
      if (rig.layerGroups.fat) {
        rig.layerGroups.fat.visible = hasRealMuscles ? false : currentLayers.fat.visible;
      }
      if (rig.layerGroups.fascia) {
        rig.layerGroups.fascia.visible = hasRealMuscles ? false : currentLayers.fascia.visible;
      }
      if (rig.layerGroups.skin) {
        rig.layerGroups.skin.visible = hasRealSkin ? false : currentLayers.skin.visible;
        if (!hasRealSkin) {
          rig.layerGroups.skin.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              const mat = obj.material as THREE.MeshStandardMaterial;
              if (mat && typeof mat.opacity === 'number') {
                mat.opacity = Math.min(currentLayers.skin.opacity, 0.12);
                mat.transparent = true;
                mat.depthWrite = false;
              }
            }
          });
        }
      }
      if (rig.layerGroups.arteries) {
        rig.layerGroups.arteries.visible = hasRealArteries ? false : currentLayers.arteries.visible;
      }
      if (rig.layerGroups.veins) {
        rig.layerGroups.veins.visible = hasRealVeins ? false : currentLayers.veins.visible;
      }
    };

    const clearExternal = () => {
      removePlaceholder();
      if (territoryGpuRef.current) {
        detachAndDisposeTerritoryResources(externalGlbRef.current, territoryGpuRef.current);
        territoryGpuRef.current = null;
      }
      territoryFieldDataRef.current = null;
      if (externalGlbRef.current) {
        scene.remove(externalGlbRef.current.root);
        externalGlbRef.current.dispose();
        externalGlbRef.current = null;
      }
      syncHybridProceduralRig(null);
    };

    const repositionStudioFloor = (minY: number) => {
      const y = Number.isFinite(minY) ? minY : 0;
      if (floorMeshRef.current) floorMeshRef.current.position.y = y;
      if (floorRingRef.current) floorRingRef.current.position.y = y + 0.002;
      if (contactShadowRef.current) contactShadowRef.current.position.y = y + 0.004;
    };

    const activateProceduralFallback = (errorMsg: string | null = null) => {
      clearExternal();
      repositionStudioFloor(0);
      setGlbStatus({ loading: false, error: errorMsg });
      setModelLoadProgress({
        active: false,
        stageLabel: '',
        loadedCount: 0,
        totalCount: 0,
        pct: 0,
        failedSystems: [],
        error: errorMsg,
      });
      setActiveModelStats({
        mode: 'procedural',
        sourceLabel: 'Built-in Procedural Body (Fallback)',
        loadedSystems: ['skin', 'skeleton', 'muscles', 'arteries', 'veins', 'nerves'],
        totalMeshes: bodyRigRef.current?.interactiveMeshes.length ?? 0,
        drawCallCount: bodyRigRef.current?.interactiveMeshes.length ?? 0,
        orientationRotatedY: false,
        mappedMeshes: bodyRigRef.current?.interactiveMeshes.length ?? 0,
        normalizedHeightCm: BODY_MODEL_CONFIG.bodyHeightCm,
        scaleFactor: 1,
        sourceHeightUnits: BODY_MODEL_CONFIG.bodyHeightMeters,
        loadedFiles: [],
        hasLegacyZAnatomy: false,
      });
      setMeshMappingReport(null);
      modelBoundsRef.current = DEFAULT_BODY_BOUNDS;
      setModelBoundsState(DEFAULT_BODY_BOUNDS);
      if (bodyRigRef.current) {
        const procBox = new THREE.Box3();
        const procCenter = new THREE.Vector3();
        const procItems: SearchableAnatomyStructure[] = bodyRigRef.current.interactiveMeshes.map(
          (obj, idx) => {
            procBox.setFromObject(obj);
            if (!procBox.isEmpty()) procBox.getCenter(procCenter);
            else procCenter.set(0, 1, 0);
            const cat = String(obj.userData?.anatomy_category || 'Structure');
            const sys: AnatomicalSystemId = /artery|pedicle/i.test(cat)
              ? 'arteries'
              : /vein/i.test(cat)
                ? 'veins'
                : /nerve/i.test(cat)
                  ? 'nerves'
                  : /bone|skeleton|landmark/i.test(cat)
                    ? 'skeleton'
                    : 'muscles';
            return {
              key: `proc:${idx}:${obj.userData?.anatomy_id || obj.name || idx}`,
              anatomyId: String(obj.userData?.anatomy_id || obj.name || `proc_${idx}`),
              label: String(obj.userData?.anatomy_label || obj.name || `Structure ${idx + 1}`),
              meshName: String(obj.name || obj.userData?.anatomy_label || `proc_${idx}`),
              system: sys,
              category: cat,
              laterality: (obj.userData?.anatomy_laterality as 'left' | 'right' | 'midline') || 'midline',
              mapped: true,
              linkedFlapIds: Array.isArray(obj.userData?.linked_flap_ids)
                ? obj.userData.linked_flap_ids
                : [],
              center: [procCenter.x, procCenter.y, procCenter.z],
              boundsMin: procBox.isEmpty()
                ? [procCenter.x - 0.05, procCenter.y - 0.05, procCenter.z - 0.05]
                : [procBox.min.x, procBox.min.y, procBox.min.z],
              boundsMax: procBox.isEmpty()
                ? [procCenter.x + 0.05, procCenter.y + 0.05, procCenter.z + 0.05]
                : [procBox.max.x, procBox.max.y, procBox.max.z],
            };
          }
        );
        setSearchableStructures(procItems);
      }
      requestRenderRef.current();
    };

    const applyLoadedBody = (loaded: LoadedGlbBody, sourceLabel: string, isFinal: boolean) => {
      if (cancelled) {
        if (isFinal) loaded.dispose();
        return;
      }
      removePlaceholder();
      if (externalGlbRef.current !== loaded) {
        if (externalGlbRef.current && externalGlbRef.current.root !== loaded.root) {
          if (territoryGpuRef.current) {
            detachAndDisposeTerritoryResources(externalGlbRef.current, territoryGpuRef.current);
            territoryGpuRef.current = null;
          }
          territoryFieldDataRef.current = null;
          scene.remove(externalGlbRef.current.root);
          externalGlbRef.current.dispose();
        }
        externalGlbRef.current = loaded;
        if (!scene.children.includes(loaded.root)) {
          scene.add(loaded.root);
        }
      }
      syncHybridProceduralRig(loaded);
      const effAlign = getEffectiveAlignmentForBody(loaded, useAtlasStore.getState().vesselAlignment);
      applyVesselAlignmentToGroup(
        loaded.bp3dAlignmentGroup,
        effAlign,
        loaded.bp3dAlignmentPivot,
        loaded.orientationRotatedY
      );
      loaded.root.updateMatrixWorld(true);
      const worldBox = new THREE.Box3().setFromObject(loaded.root);
      if (!worldBox.isEmpty()) {
        repositionStudioFloor(worldBox.min.y);
        const nextBounds: AnatomicalBounds = {
          minX: Number(worldBox.min.x.toFixed(3)),
          maxX: Number(worldBox.max.x.toFixed(3)),
          minY: Number(worldBox.min.y.toFixed(3)),
          maxY: Number(worldBox.max.y.toFixed(3)),
          minZ: Number(worldBox.min.z.toFixed(3)),
          maxZ: Number(worldBox.max.z.toFixed(3)),
        };
        modelBoundsRef.current = nextBounds;
        setModelBoundsState(nextBounds);
      }
      const rotatedY = loaded.orientationRotatedY;
      setSearchableStructures(
        loaded.allSubMeshes.map((sub) => {
          const wb = transformSubMeshBoundsWithAlignment(
            sub,
            effAlign,
            loaded.bp3dAlignmentPivot,
            rotatedY
          );
          return {
            key: sub.meshKey,
            anatomyId: sub.anatomyId,
            label: sub.label,
            meshName: sub.meshName,
            system: sub.system,
            category: sub.category,
            laterality: sub.laterality,
            mapped: sub.mapped,
            linkedFlapIds: sub.linkedFlapIds,
            sourceModel: sub.sourceModel,
            fjCode: sub.fjCode,
            fmaCode: sub.fmaCode,
            groupId: sub.groupId,
            groupLabel: sub.groupLabel,
            partLabel: sub.partLabel,
            center: wb.center,
            boundsMin: wb.boundsMin,
            boundsMax: wb.boundsMax,
          };
        })
      );
      // Attach O(1) DataTexture visibility/ghost shader to every merged system mesh
      const nextControllers: SubMeshVisibilityController[] = [];
      for (const obj of loaded.interactiveMeshes) {
        if (obj instanceof THREE.Mesh && obj.userData?.isMergedSystemMesh) {
          const ctrl = attachSubMeshVisibilityShader(obj);
          if (ctrl) nextControllers.push(ctrl);
        }
      }
      for (const oldCtrl of visibilityControllersRef.current) {
        if (!nextControllers.includes(oldCtrl)) {
          disposeSubMeshVisibilityController(oldCtrl);
        }
      }
      visibilityControllersRef.current = nextControllers;

      // Compute Editor "Unmapped muscles" report against muscleReference.json
      setUnmappedMusclesReport(findUnmappedMuscleMeshes(loaded.allSubMeshes));

      setActiveModelStats({
        mode: 'real-glb',
        sourceLabel,
        loadedSystems: loaded.loadedSystems,
        totalMeshes: loaded.meshCount,
        drawCallCount: loaded.drawCallCount,
        orientationRotatedY: loaded.orientationRotatedY,
        mappedMeshes: loaded.mappingReport.mappedCount,
        normalizedHeightCm: loaded.normalization.targetHeightCm,
        scaleFactor: 1,
        sourceHeightUnits: loaded.detectedHeightMeters,
        loadedFiles: loaded.loadedFiles,
        hasLegacyZAnatomy: loaded.hasLegacyZAnatomy,
      });
      setMeshMappingReport(loaded.mappingReport);
      requestRenderRef.current();
    };

    const showLoadingPlaceholder = () => {
      removePlaceholder();
      const placeholder = createSkeletonLoadingPlaceholder();
      skeletonPlaceholderRef.current = placeholder;
      scene.add(placeholder);
      if (bodyRigRef.current) {
        bodyRigRef.current.root.visible = false;
      }
      requestRenderRef.current();
    };

    const mapperContext = {
      vessels: VESSELS,
      flaps,
      customOverrides: customAnatomyOverrides,
    };

    const forwardLoadProgress = (p: ProgressiveLoadProgress) => {
      if (cancelled) return;
      setModelLoadProgress({
        active: p.pct < 100,
        stageLabel: p.stageLabel,
        loadedCount: p.loadedCount,
        totalCount: p.totalCount,
        pct: p.pct,
        failedSystems: p.failedSystems,
        error: null,
        currentFile: p.currentFile,
        currentSourceUrl: p.currentSourceUrl,
        fromCache: p.fromCache,
        loadedBytes: p.loadedBytes,
        totalBytes: p.totalBytes,
      });
    };

    const runLoader = async () => {
      // Explicit procedural mode
      if (modelSourceMode === 'procedural' && !customGlbUrl) {
        activateProceduralFallback(null);
        return;
      }

      // 1. Secondary override: single-file custom GLB upload (blob URL)
      if (customGlbUrl) {
        setGlbStatus({ loading: true, error: null });
        showLoadingPlaceholder();
        setModelLoadProgress({
          active: true,
          stageLabel: `Loading ${customGlbName || 'External GLB'}…`,
          loadedCount: 0,
          totalCount: 1,
          pct: 25,
          failedSystems: [],
          error: null,
          currentFile: customGlbName || 'external.glb',
        });
        try {
          const loaded = await loadExternalBodyGlb(customGlbUrl, mapperContext, colorblindMode);
          applyLoadedBody(loaded, customGlbName || 'Uploaded GLB', true);
          setGlbStatus({ loading: false, error: null, meshCount: loaded.meshCount });
          setModelLoadProgress({
            active: false,
            stageLabel: 'Complete',
            loadedCount: 1,
            totalCount: 1,
            pct: 100,
            failedSystems: [],
            error: null,
          });
        } catch (err) {
          if (!cancelled) {
            activateProceduralFallback(
              err instanceof Error ? err.message : 'Failed to parse external GLB.'
            );
          }
        }
        return;
      }

      // 2. Remote custom CORS-hosted multi-system manifest pack
      if (modelSourceMode === 'remote' && remoteModelBaseUrl.trim()) {
        const entries = buildManifestForBaseUrl(remoteModelBaseUrl);
        setGlbStatus({ loading: true, error: null });
        showLoadingPlaceholder();
        try {
          const loaded = await loadAnatomicalModelPack({
            entries,
            sourceKind: 'remote',
            sourceLabel: `Remote Pack (${new URL(remoteModelBaseUrl).hostname})`,
            mapperContext,
            colorblindMode,
            signal: abortController.signal,
            onProgress: forwardLoadProgress,
            onStageReady: (partial) => applyLoadedBody(partial, 'Remote GLB Pack', false),
          });
          applyLoadedBody(loaded, `Remote Pack (${new URL(remoteModelBaseUrl).hostname})`, true);
          setGlbStatus({ loading: false, error: null, meshCount: loaded.meshCount });
          setModelLoadProgress({
            active: false,
            stageLabel: 'All stages loaded',
            loadedCount: entries.length,
            totalCount: entries.length,
            pct: 100,
            failedSystems: [],
            error: null,
          });
        } catch (err) {
          if (!cancelled) {
            activateProceduralFallback(
              err instanceof Error ? err.message : 'Failed to load remote GLB pack.'
            );
          }
        }
        return;
      }

      // 3. Secondary override: user-uploaded per-system GLBs in IndexedDB, merged over unified BP3D 4.0 GitHub CDN
      if (modelSourceMode === 'uploaded' || modelSourceMode === 'auto') {
        const cachedUploads = await listCachedUploadedGlbs();
        if (cancelled) return;
        if (cachedUploads.length > 0) {
          const preloadedBuffers: Record<string, ArrayBuffer> = {};
          const uploadedSystemsSet = new Set<AnatomicalSystemId>();
          const uploadEntries: ModelManifestEntry[] = cachedUploads.map((rec) => {
            const sys = rec.system || inferSystemFromFilename(rec.fileName);
            uploadedSystemsSet.add(sys);
            const baseDef = DEFAULT_MODEL_MANIFEST.find((d) => d.system === sys);
            const id = baseDef?.id || `upload-${sys}-${rec.fileName}`;
            preloadedBuffers[id] = rec.buffer;
            return {
              id,
              label: baseDef?.label || SYSTEM_DISPLAY_META[sys]?.label || rec.fileName,
              fileName: rec.fileName,
              url: rec.sourceUrl,
              fallbackUrls: baseDef?.fallbackUrls || [],
              system: sys,
              stage: baseDef?.stage ?? (sys === 'organs' ? 3 : 2),
              hiddenByDefault: baseDef?.hiddenByDefault,
              license: baseDef?.license || 'CC BY 4.0',
              attribution: baseDef?.attribution || BODYPARTS3D_PHASE10_ATTRIBUTION,
              sourceName: baseDef?.sourceName || 'Local Override GLB',
              sourceUrl: baseDef?.sourceUrl || GITHUB_MODELS_REPO_URL,
              approxSizeMB: Number((rec.byteLength / (1024 * 1024)).toFixed(2)),
              expectedNodes: baseDef?.expectedNodes ?? 1,
              enabledByDefault: true,
            };
          });

          // Merge bundled offline BodyParts3D 4.0 base systems for any systems not overridden locally
          const bundledBaseEntries = buildLocalBundledManifest().filter(
            (e) => !uploadedSystemsSet.has(e.system)
          );
          const combinedEntries: ModelManifestEntry[] = [...bundledBaseEntries, ...uploadEntries];
          const combinedLabel =
            bundledBaseEntries.length > 0
              ? `BodyParts3D 4.0 Offline + Local Override (${combinedEntries.length} systems)`
              : `Local Override Pack (${uploadEntries.length} systems)`;

          setGlbStatus({ loading: true, error: null });
          showLoadingPlaceholder();
          try {
            const loaded = await loadAnatomicalModelPack({
              entries: combinedEntries,
              sourceKind: 'local',
              sourceLabel: combinedLabel,
              mapperContext,
              colorblindMode,
              preloadedBuffers,
              signal: abortController.signal,
              onProgress: forwardLoadProgress,
              onStageReady: (partial) => applyLoadedBody(partial, combinedLabel, false),
            });
            applyLoadedBody(
              loaded,
              loaded.hasLegacyZAnatomy
                ? `Legacy Override + BodyParts3D (${loaded.loadedSystems.length} systems)`
                : `BodyParts3D 4.0 Offline + Local Override (${loaded.loadedSystems.length} systems)`,
              true
            );
            setGlbStatus({ loading: false, error: null, meshCount: loaded.meshCount });
            setModelLoadProgress({
              active: false,
              stageLabel: 'Loaded from Bundled Pack & Local Override',
              loadedCount: combinedEntries.length,
              totalCount: combinedEntries.length,
              pct: 100,
              failedSystems: [],
              error: null,
            });
          } catch (err) {
            if (!cancelled) {
              activateProceduralFallback(
                err instanceof Error ? err.message : 'Failed to parse local override GLB pack.'
              );
            }
          }
          return;
        }
      }

      // 4. Primary Offline-First Source: Static bundled BodyParts3D 4.0 pack in /public/models/
      //    Zero external network requests on launch; Stage 1 loads skeleton + muscles + skin first,
      //    followed by Stage 2 (arteries + veins + nerves) and Stage 3 (organs, hidden by default).
      if (!cancelled) {
        const localEntries = buildLocalBundledManifest();
        setGlbStatus({ loading: true, error: null });
        showLoadingPlaceholder();
        try {
          const loaded = await loadAnatomicalModelPack({
            entries: localEntries,
            sourceKind: 'local',
            sourceLabel: 'BodyParts3D 4.0 (Bundled Offline Pack)',
            mapperContext,
            colorblindMode,
            signal: abortController.signal,
            onProgress: forwardLoadProgress,
            onStageReady: (partial) =>
              applyLoadedBody(partial, 'BodyParts3D 4.0 (Offline Progressive)', false),
          });
          applyLoadedBody(loaded, 'BodyParts3D 4.0 (Bundled Offline Pack)', true);
          setGlbStatus({ loading: false, error: null, meshCount: loaded.meshCount });
          setModelLoadProgress({
            active: false,
            stageLabel: 'BodyParts3D 4.0 ready (offline)',
            loadedCount: localEntries.length,
            totalCount: localEntries.length,
            pct: 100,
            failedSystems: [],
            error: null,
          });
          return;
        } catch (err) {
          if (!cancelled) {
            activateProceduralFallback(
              err instanceof Error
                ? `Bundled model pack unavailable (${err.message}); using procedural fallback.`
                : 'Bundled model pack unavailable; using procedural fallback.'
            );
          }
          return;
        }
      }

      if (!cancelled) {
        activateProceduralFallback(null);
      }
    };

    void runLoader();

    return () => {
      cancelled = true;
      abortController.abort();
      removePlaceholder();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customGlbUrl, modelSourceMode, remoteModelBaseUrl, modelReloadNonce, hydrated]);

  // =========================================================================
  // 3. Sync Theme Studio Backdrop & Colorblind Palette
  // =========================================================================
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const bgHex = theme === 'or-dim' ? 0x050911 : theme === 'dark' ? 0x0f172a : 0xeef2f7;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.Fog(bgHex, 4.8, 12.5);
    const floor = scene.getObjectByName('studio_floor') as THREE.Mesh | undefined;
    if (floor && floor.material instanceof THREE.MeshStandardMaterial) {
      floor.material.color.setHex(
        theme === 'or-dim' ? 0x0b1322 : theme === 'dark' ? 0x1e293b : 0xe2e8f0
      );
    }
    bodyRigRef.current?.updatePalette(colorblindMode);
    externalGlbRef.current?.updatePalette(colorblindMode);
    if (territoryGpuRef.current) {
      syncTerritoryPaletteColorblind(territoryGpuRef.current, colorblindMode);
    }
    requestRenderRef.current();
  }, [theme, colorblindMode]);

  // Sync devicePixelRatio cap when user changes Quality / Balanced / Fast in Settings
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const targetCap = isSoftwareGlRef.current
      ? 1.0
      : renderQuality === 'quality'
        ? 2.0
        : renderQuality === 'fast'
          ? 1.0
          : 1.5;
    effectiveDprCapRef.current = targetCap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, targetCap));
    requestRenderRef.current();
  }, [renderQuality]);

  // =========================================================================
  // 3b. Phase 11b — Non-Blocking Background Vascular Territory Field Engine
  //     Builds (or loads from IndexedDB `territoryField-bp3d-4.0-v1`) ONLY
  //     after BodyParts3D 4.0 systems finish loading. Never blocks first paint,
  //     and keeps `uTerritoryEnabled = 0` so Mode Off is 100% unchanged.
  // =========================================================================
  useEffect(() => {
    const body = externalGlbRef.current;
    const renderer = rendererRef.current;
    if (!body || !renderer || activeModelStats?.mode !== 'real-glb') return;
    if (glbStatus.loading || modelLoadProgress.active) return;

    const requiredLoaded =
      activeModelStats.loadedSystems.includes('skeleton') &&
      activeModelStats.loadedSystems.includes('muscles') &&
      activeModelStats.loadedSystems.includes('skin') &&
      activeModelStats.loadedSystems.includes('arteries');
    if (!requiredLoaded) return;

    const controller = new AbortController();
    let cancelled = false;

    const timerId = window.setTimeout(() => {
      if (cancelled || controller.signal.aborted) return;

      setTerritoryFieldBuildState({
        status: 'building',
        progress: { pct: 5, label: 'Building vascular territory field…' },
        error: null,
      });

      void buildOrLoadTerritoryField({
        body,
        anchors,
        visualWeights: territoryVisualWeights,
        forceRebuild: territoryFieldRebuildNonce > 0,
        signal: controller.signal,
        onProgress: (upd) => {
          if (cancelled || controller.signal.aborted) return;
          setTerritoryFieldBuildState({
            progress: upd,
          });
        },
      })
        .then((res) => {
          if (cancelled || controller.signal.aborted || externalGlbRef.current !== body) return;

          if (territoryGpuRef.current) {
            detachAndDisposeTerritoryResources(body, territoryGpuRef.current);
            territoryGpuRef.current = null;
          }

          const isWebGL2 = Boolean(renderer.capabilities.isWebGL2);
          const gpu = attachTerritoryResourcesToBody({
            body,
            field: res.field,
            isWebGL2,
            colorblindMode: useAtlasStore.getState().colorblindMode,
          });
          territoryGpuRef.current = gpu;
          territoryFieldDataRef.current = res.field;
          setTerritoryFieldRev((r) => r + 1);

          const meta = {
            fromCache: res.fromCache,
            cacheKey: res.cacheKey,
            dims: res.field.dims,
            voxelSizeMm: Math.round(res.field.voxelSizeMeters * 1000),
            buildMs: res.field.buildMs,
            realSeedTerritoryCount: res.realSeedTerritoryCount,
            schematicSeedTerritoryCount: res.schematicSeedTerritoryCount,
            clusterCount: res.clusterCount,
            isWebGL2,
          };

          setTerritoryFieldBuildState({
            status: 'ready',
            progress: { pct: 100, label: 'Vascular territory field ready' },
            meta,
            error: null,
            calibrationReport: res.calibrationReport,
            unresolvedFjs: res.unresolvedFjs,
          });

          if (typeof window !== 'undefined') {
            (window as unknown as Record<string, unknown>).__FLAPATLAS_TERRITORY_FIELD__ = {
              meta,
              calibrationSummary: {
                totalTableMuscles: res.calibrationReport.totalTableMuscles,
                checkedInBp3dCount: res.calibrationReport.checkedInBp3dCount,
                matchedCount: res.calibrationReport.matchedCount,
                warningCount: res.calibrationReport.warningCount,
              },
              unresolvedFjCount: res.unresolvedFjs.length,
              neighborSlotsCount: Object.keys(res.field.neighborsBySlot).length,
            };
          }

          console.info(
            `[FlapAtlas Territory Field] ${res.fromCache ? 'CACHE HIT' : 'BAKED'} (${res.field.dims.join('×')} @ ${meta.voxelSizeMm}mm, ${res.field.buildMs}ms) · Real=${res.realSeedTerritoryCount} / Schematic=${res.schematicSeedTerritoryCount} · Muscle audit: ${res.calibrationReport.matchedCount}/${res.calibrationReport.checkedInBp3dCount} matched, ${res.calibrationReport.warningCount} calibration warnings`
          );

          requestRenderRef.current();
        })
        .catch((err: unknown) => {
          if (cancelled || controller.signal.aborted) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          const msg = err instanceof Error ? err.message : String(err);
          console.warn('[FlapAtlas Territory Field] build error:', msg);
          setTerritoryFieldBuildState({
            status: 'error',
            error: msg,
          });
        });
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [
    activeModelStats?.mode,
    activeModelStats?.loadedSystems.length,
    glbStatus.loading,
    modelLoadProgress.active,
    anchors,
    territoryVisualWeights,
    territoryFieldRebuildNonce,
    setTerritoryFieldBuildState,
  ]);

  // =========================================================================
  // 3c. Phase 11c — Live Territory Shader Uniforms, Focus & Camera Framing
  // =========================================================================
  useEffect(() => {
    const gpu = territoryGpuRef.current;
    const field = territoryFieldDataRef.current;
    const enabled = territoryMode !== 'off' ? 1 : 0;
    const focusedEntry = focusedTerritoryId
      ? TERRITORY_SLOT_BY_ID.get(focusedTerritoryId)
      : undefined;
    const focusedSlot = focusedEntry?.slotId ?? 0;

    if (gpu) {
      gpu.uniforms.uTerritoryEnabled.value = enabled;
      gpu.uniforms.uTerritoryMode.value =
        territoryMode === 'venosomes' ? 1 : territoryMode === 'choke_delay' ? 2 : 0;
      gpu.uniforms.uTerritoryOpacity.value = isolateTerritoryArtery
        ? Math.min(territoryOpacity, 0.25)
        : territoryMode === 'perforators' && focusedSlot === 0
          ? Math.min(territoryOpacity * 0.42, 0.34)
          : territoryOpacity;
      gpu.uniforms.uSideFilter.value =
        territorySideFilter === 'right' ? 1 : territorySideFilter === 'left' ? 2 : 0;
      gpu.uniforms.uFocusedSlot.value = focusedSlot;
      gpu.uniforms.uShowNeighbors.value =
        showTerritoryNeighbors && focusedSlot > 0 ? 1 : 0;
      const neighbors =
        field && focusedSlot > 0 ? field.neighborsBySlot[focusedSlot] ?? [] : [];
      setNeighborBitmaskUniforms(gpu.uniforms, showTerritoryNeighbors ? neighbors : []);
      gpu.uniforms.uDelayScale.value = 1.0 + (territoryDelayHours / 72) * 1.4;
      gpu.uniforms.uOutlineStrength.value = isolateTerritoryArtery ? 0.35 : 0.85;

      if (gpu.fallbackMesh) {
        gpu.fallbackMesh.visible = enabled > 0;
        const fMat = gpu.fallbackMesh.material as THREE.MeshStandardMaterial;
        fMat.opacity = isolateTerritoryArtery ? 0.16 : territoryOpacity;
        fMat.needsUpdate = true;
      }
      requestRenderRef.current();
    }

    // Publish lightweight diagnostic state for automated verification (zero visible UI)
    if (typeof window !== 'undefined') {
      const st = useAtlasStore.getState();
      const snapPresent = Boolean(st.territoryLayerSnapshot);
      const prevDiag = (window as unknown as Record<string, Record<string, unknown>>)
        .__FLAPATLAS_TERRITORY_STATE__;
      (window as unknown as Record<string, unknown>).__FLAPATLAS_TERRITORY_STATE__ = {
        ...(prevDiag || {}),
        mode: territoryMode,
        territoryDepth,
        focusedTerritoryId,
        focusedSlot,
        showNeighbors: showTerritoryNeighbors,
        isolateArtery: isolateTerritoryArtery,
        selectedSchematicMuscleId,
        schematicOutlineVisible: Boolean(
          territorySchematicMuscleGroupRef.current &&
            territorySchematicMuscleGroupRef.current.children.length > 0
        ),
        uTerritoryEnabled: gpu ? gpu.uniforms.uTerritoryEnabled.value : 0,
        uFocusedSlot: gpu ? gpu.uniforms.uFocusedSlot.value : 0,
        uShowNeighbors: gpu ? gpu.uniforms.uShowNeighbors.value : 0,
        uSideFilter: gpu ? gpu.uniforms.uSideFilter.value : 0,
        layerSnapshotPresent: snapPresent,
        skinOpacity: layers.skin.opacity,
        muscleVisible: layers.muscle.visible,
        skeletonVisible: layers.skeleton.visible,
        nervesLayerVisible: layers.nerves.visible,
        organsVisible: layers.organs.visible,
        muscleCalibrationWarningCount: territoryCalibrationReport?.warningCount ?? null,
        plannerDropMode,
        plannerMarkerCount: dopplerPlannerMarkers.length,
      };
    }
  }, [
    territoryMode,
    territoryDepth,
    territoryOpacity,
    territorySideFilter,
    focusedTerritoryId,
    showTerritoryNeighbors,
    isolateTerritoryArtery,
    territoryDelayHours,
    territoryFieldRev,
    selectedSchematicMuscleId,
    territoryCalibrationReport,
    plannerDropMode,
    dopplerPlannerMarkers.length,
    layers.skin.opacity,
    layers.muscle.visible,
    layers.skeleton.visible,
    layers.nerves.visible,
    layers.organs.visible,
  ]);

  // =========================================================================
  // 3d. Phase 11d — Standalone Schematic Muscle Outlines for Absent BP3D Muscles
  //     Renders bony-landmark-anchored translucent amber outline + wireframe +
  //     tether lines when inspecting any of the 7 absent BP3D muscles in Deep Tissue.
  // =========================================================================
  useEffect(() => {
    const group = territorySchematicMuscleGroupRef.current;
    if (!group) return;
    disposeGroupChildren(group);

    if (territoryMode === 'off' || !selectedSchematicMuscleId) {
      group.visible = false;
      requestRenderRef.current();
      return;
    }

    const anchorPosMap: Record<string, [number, number, number]> = {};
    for (const a of anchors) {
      anchorPosMap[a.id] = a.position;
    }

    const sides: Array<'right' | 'left'> =
      territorySideFilter === 'right'
        ? ['right']
        : territorySideFilter === 'left'
          ? ['left']
          : ['right', 'left'];

    const activeClips = activeClippingPlanesRef.current;

    for (const side of sides) {
      const outlineSpec = buildSchematicMuscleOutline(
        selectedSchematicMuscleId,
        side,
        anchorPosMap
      );
      if (!outlineSpec) continue;

      const bodyGeo = new THREE.SphereGeometry(0.5, 22, 16);
      bodyGeo.scale(outlineSpec.size[0], outlineSpec.size[1], outlineSpec.size[2]);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.28,
        roughness: 0.62,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        clippingPlanes: activeClips,
      });
      const schematicMesh = new THREE.Mesh(bodyGeo, bodyMat);
      schematicMesh.position.set(...outlineSpec.center);
      schematicMesh.rotation.set(...outlineSpec.rotation);
      schematicMesh.name = `TerritorySchematicMuscle_${outlineSpec.muscleId}_${side}`;
      group.add(schematicMesh);

      const wireGeo = new THREE.EdgesGeometry(bodyGeo, 24);
      const wireMat = new THREE.LineBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.82,
        clippingPlanes: activeClips,
      });
      const wireSeg = new THREE.LineSegments(wireGeo, wireMat);
      wireSeg.position.copy(schematicMesh.position);
      wireSeg.rotation.copy(schematicMesh.rotation);
      group.add(wireSeg);

      const centerVec = new THREE.Vector3(...outlineSpec.center);
      for (const ap of outlineSpec.anchorPoints) {
        const tetherGeo = new THREE.BufferGeometry().setFromPoints([
          centerVec,
          new THREE.Vector3(...ap),
        ]);
        const tetherMat = new THREE.LineDashedMaterial({
          color: 0xf59e0b,
          dashSize: 0.012,
          gapSize: 0.009,
          transparent: true,
          opacity: 0.72,
          clippingPlanes: activeClips,
        });
        const tether = new THREE.Line(tetherGeo, tetherMat);
        tether.computeLineDistances();
        group.add(tether);
      }
    }

    group.visible = group.children.length > 0;
    if (typeof window !== 'undefined') {
      const diag = (window as unknown as Record<string, Record<string, unknown>>)
        .__FLAPATLAS_TERRITORY_STATE__;
      if (diag) {
        diag.schematicOutlineVisible = group.visible;
      }
    }
    requestRenderRef.current();
  }, [territoryMode, selectedSchematicMuscleId, territorySideFilter, anchors, clippingPlanes]);

  // =========================================================================
  // 3e. Phase 11e — Real-Artery Perforator Emergence Corridors (InstancedMesh ONLY)
  //     Projected strictly from real BodyParts3D source arteries onto nearest skin.
  //     Zero corridors for the 12 absent/schematic-only territories; clustered/hidden at far zoom.
  // =========================================================================
  useEffect(() => {
    const group = territoryCorridorGroupRef.current;
    if (!group) return;
    disposeGroupChildren(group);
    visibleCorridorDotsRef.current = [];

    const updateDiag = (
      instanceCount: number,
      realTerrCount: number,
      hasSchematic: boolean,
      zTier: CorridorZoomTier
    ) => {
      if (typeof window !== 'undefined') {
        const diag = (window as unknown as Record<string, Record<string, unknown>>)
          .__FLAPATLAS_TERRITORY_STATE__;
        if (diag) {
          diag.corridorInstanceCount = instanceCount;
          diag.corridorRealTerritoryCount = realTerrCount;
          diag.corridorHasSchematicArtery = hasSchematic;
          diag.corridorZoomTier = zTier;
        }
      }
    };

    if (territoryMode !== 'perforators' || !showPerforatorCorridors) {
      group.visible = false;
      updateDiag(0, realCorridorCacheRef.current?.realTerritoryIds.length ?? 0, false, corridorZoomTier);
      requestRenderRef.current();
      return;
    }

    const body = externalGlbRef.current;
    if (!body) {
      group.visible = false;
      updateDiag(0, 0, false, corridorZoomTier);
      requestRenderRef.current();
      return;
    }

    // Lazily build & cache skin surface spatial grid + real artery corridors once per loaded body
    if (!realCorridorCacheRef.current || realCorridorCacheRef.current.bodyRev !== territoryFieldRev) {
      const skinGrid = buildSkinSurfaceGridFromLoadedBody(body);
      skinSurfaceGridRef.current = skinGrid;
      if (skinGrid) {
        const built = buildAllRealArteryCorridors(body, skinGrid);
        realCorridorCacheRef.current = {
          dots: built.dots,
          realTerritoryIds: built.realTerritoryIds,
          bodyRev: territoryFieldRev,
        };
        setRealCorridorTerritoryCount(built.realTerritoryIds.length);
      } else {
        realCorridorCacheRef.current = { dots: [], realTerritoryIds: [], bodyRev: territoryFieldRev };
        setRealCorridorTerritoryCount(0);
      }
    }

    const cache = realCorridorCacheRef.current;
    const camDist =
      cameraRef.current && controlsRef.current
        ? cameraRef.current.position.distanceTo(controlsRef.current.target)
        : 2.1;

    const { visibleDots, zoomTier: resolvedTier } = filterCorridorDotsForView(cache.dots, {
      sideFilter: territorySideFilter,
      focusedTerritoryId,
      cameraDistanceMeters: camDist,
    });
    corridorZoomTierRef.current = resolvedTier;
    if (resolvedTier !== corridorZoomTier) {
      setCorridorZoomTier(resolvedTier);
    }

    if (visibleDots.length === 0) {
      group.visible = false;
      updateDiag(0, cache.realTerritoryIds.length, false, resolvedTier);
      requestRenderRef.current();
      return;
    }

    const activeClips = activeClippingPlanesRef.current;
    const count = visibleDots.length;

    // Two InstancedMeshes ONLY (zero per-dot draw calls): vivid core disc + high-contrast slate halo ring
    const coreGeo = new THREE.CircleGeometry(1, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      depthWrite: false,
      clippingPlanes: activeClips,
    });
    const coreInst = new THREE.InstancedMesh(coreGeo, coreMat, count);
    coreInst.name = 'PerforatorCorridorCoreInstances';
    coreInst.renderOrder = 16;

    const ringGeo = new THREE.RingGeometry(0.92, 1.52, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
      depthWrite: false,
      clippingPlanes: activeClips,
    });
    const ringInst = new THREE.InstancedMesh(ringGeo, ringMat, count);
    ringInst.name = 'PerforatorCorridorRingInstances';
    ringInst.renderOrder = 15;

    const zAxis = new THREE.Vector3(0, 0, 1);
    const tmpPos = new THREE.Vector3();
    const tmpNorm = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();
    const tmpMat = new THREE.Matrix4();
    const tmpColor = new THREE.Color();

    let hasSchematicArtery = false;
    for (let i = 0; i < count; i++) {
      const dot = visibleDots[i];
      if (!isRealCorridorTerritory(dot.territoryId)) {
        hasSchematicArtery = true;
      }
      tmpPos.set(dot.position[0], dot.position[1], dot.position[2]);
      tmpNorm.set(dot.normal[0], dot.normal[1], dot.normal[2]).normalize();
      tmpQuat.setFromUnitVectors(zAxis, tmpNorm);
      const r = focusedTerritoryId ? dot.radiusMeters * 1.2 : dot.radiusMeters;
      tmpScale.set(r, r, 1);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);

      coreInst.setMatrixAt(i, tmpMat);
      ringInst.setMatrixAt(i, tmpMat);

      const slot = TERRITORY_SLOT_BY_INDEX.get(dot.slotId);
      const hex = slot ? (colorblindMode ? slot.hexColorblind : slot.hexStandard) : '#0d9488';
      tmpColor.set(hex);
      coreInst.setColorAt(i, tmpColor);
    }

    coreInst.instanceMatrix.needsUpdate = true;
    ringInst.instanceMatrix.needsUpdate = true;
    if (coreInst.instanceColor) coreInst.instanceColor.needsUpdate = true;

    group.add(coreInst);
    group.add(ringInst);
    group.visible = true;
    visibleCorridorDotsRef.current = visibleDots;

    updateDiag(count, cache.realTerritoryIds.length, hasSchematicArtery, resolvedTier);
    requestRenderRef.current();
  }, [
    territoryMode,
    showPerforatorCorridors,
    territorySideFilter,
    focusedTerritoryId,
    corridorZoomTier,
    colorblindMode,
    territoryFieldRev,
    clippingPlanes,
  ]);

  // =========================================================================
  // 3f. Phase 11e — Selected Flap Perforasome Concept (Fig. 23.25, p. 333)
  //     Voronoi jigsaw-tiled soft territory glows around the selected flap's own perforators.
  //     Fixed decorative constant radius — NEVER derived from clinical flap dimensions.
  // =========================================================================
  useEffect(() => {
    const group = territoryPerforasomeGroupRef.current;
    if (!group) return;
    disposeGroupChildren(group);

    const setTileDiag = (count: number) => {
      if (typeof window !== 'undefined') {
        const diag = (window as unknown as Record<string, Record<string, unknown>>)
          .__FLAPATLAS_TERRITORY_STATE__;
        if (diag) {
          diag.perforasomeTileCount = count;
        }
      }
    };

    if (
      territoryMode !== 'perforators' ||
      !showFlapPerforasomes ||
      !selectedFlap ||
      !resolvedFlapOverlay ||
      resolvedFlapOverlay.perforatorPositions.length === 0
    ) {
      group.visible = false;
      setTileDiag(0);
      requestRenderRef.current();
      return;
    }

    const spec = selectedFlap.spec3d;
    const mirrorX = spec.side !== 'midline' && donorSide !== spec.side ? -1 : 1;
    const fallbackNormal: [number, number, number] = [
      spec.paddleNormal[0] * mirrorX,
      spec.paddleNormal[1],
      spec.paddleNormal[2],
    ];

    const perfInputs = resolvedFlapOverlay.perforatorPositions.map((raw, idx) => ({
      id: `${selectedFlap.id}-perf-${idx}`,
      label: selectedFlap.vascular_anatomy.perforators[idx]?.label || `P${idx + 1}`,
      position: [raw[0] * mirrorX, raw[1], raw[2]] as [number, number, number],
    }));

    const skinGrid =
      skinSurfaceGridRef.current ||
      (externalGlbRef.current ? buildSkinSurfaceGridFromLoadedBody(externalGlbRef.current) : null);
    if (skinGrid && !skinSurfaceGridRef.current) {
      skinSurfaceGridRef.current = skinGrid;
    }

    const tiles = buildPerforasomeJigsawTiles(
      perfInputs,
      fallbackNormal,
      skinGrid,
      PERFORASOME_DECORATIVE_RADIUS_M
    );

    if (tiles.length === 0) {
      group.visible = false;
      setTileDiag(0);
      requestRenderRef.current();
      return;
    }

    const activeClips = activeClippingPlanesRef.current;

    // Render soft translucent Voronoi jigsaw fill + crisp border outline per perforator
    for (const tile of tiles) {
      const hex = colorblindMode ? tile.colorHexColorblind : tile.colorHex;

      const fillGeo = new THREE.BufferGeometry();
      fillGeo.setAttribute('position', new THREE.BufferAttribute(tile.trianglePositions, 3));
      const fillMat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
        depthWrite: false,
        clippingPlanes: activeClips,
      });
      const fillMesh = new THREE.Mesh(fillGeo, fillMat);
      fillMesh.name = `PerforasomeJigsawFill_${tile.id}`;
      fillMesh.renderOrder = 14;
      group.add(fillMesh);

      const borderPts = tile.outlinePoints.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
      const borderMat = new THREE.LineBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.82,
        clippingPlanes: activeClips,
      });
      const borderLoop = new THREE.LineLoop(borderGeo, borderMat);
      borderLoop.name = `PerforasomeJigsawBorder_${tile.id}`;
      borderLoop.renderOrder = 15;
      group.add(borderLoop);
    }

    // Center perforator hotspot dots as one InstancedMesh
    const dotGeo = new THREE.SphereGeometry(0.0072, 12, 10);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      clippingPlanes: activeClips,
    });
    const dotInst = new THREE.InstancedMesh(dotGeo, dotMat, tiles.length);
    dotInst.renderOrder = 17;
    const m4 = new THREE.Matrix4();
    const cTmp = new THREE.Color();
    tiles.forEach((tile, i) => {
      m4.makeTranslation(tile.center[0], tile.center[1], tile.center[2]);
      dotInst.setMatrixAt(i, m4);
      cTmp.set(colorblindMode ? tile.colorHexColorblind : tile.colorHex);
      dotInst.setColorAt(i, cTmp);
    });
    dotInst.instanceMatrix.needsUpdate = true;
    if (dotInst.instanceColor) dotInst.instanceColor.needsUpdate = true;
    group.add(dotInst);

    group.visible = true;
    setTileDiag(tiles.length);
    requestRenderRef.current();
  }, [
    territoryMode,
    showFlapPerforasomes,
    selectedFlap,
    resolvedFlapOverlay,
    donorSide,
    colorblindMode,
    territoryFieldRev,
    clippingPlanes,
  ]);

  // =========================================================================
  // 3g. Phase 11e — Local-Only Doppler / CTA Planner Pins (InstancedMesh)
  //     Keyed strictly on marker geometry (id + worldPos + worldNormal) so typing
  //     into Fig. 23.48C text fields never triggers redundant WebGL rebuilds/renders.
  // =========================================================================
  const plannerPinsGeometryKey = useMemo(
    () =>
      dopplerPlannerMarkers
        .map((m) => `${m.id}:${m.worldPos.join(',')}:${m.worldNormal.join(',')}`)
        .join('|'),
    [dopplerPlannerMarkers]
  );

  useEffect(() => {
    const group = dopplerPlannerPinsGroupRef.current;
    if (!group) return;
    disposeGroupChildren(group);

    const markers = useAtlasStore.getState().dopplerPlannerMarkers;
    if (territoryMode !== 'perforators' || markers.length === 0) {
      group.visible = false;
      requestRenderRef.current();
      return;
    }

    const activeClips = activeClippingPlanesRef.current;
    const count = markers.length;

    const pinGeo = new THREE.SphereGeometry(0.0085, 12, 10);
    const pinMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      clippingPlanes: activeClips,
    });
    const pinInst = new THREE.InstancedMesh(pinGeo, pinMat, count);
    pinInst.name = 'DopplerPlannerPinHeads';
    pinInst.renderOrder = 18;

    const ringGeo = new THREE.RingGeometry(0.0095, 0.0145, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthWrite: false,
      clippingPlanes: activeClips,
    });
    const ringInst = new THREE.InstancedMesh(ringGeo, ringMat, count);
    ringInst.name = 'DopplerPlannerPinRings';
    ringInst.renderOrder = 17;

    const zAxis = new THREE.Vector3(0, 0, 1);
    const tmpPos = new THREE.Vector3();
    const tmpNorm = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const oneScale = new THREE.Vector3(1, 1, 1);
    const tmpMat = new THREE.Matrix4();
    const colSelected = new THREE.Color('#f59e0b');
    const colNormal = new THREE.Color('#10b981');

    for (let i = 0; i < count; i++) {
      const m = markers[i];
      tmpNorm.set(m.worldNormal[0], m.worldNormal[1], m.worldNormal[2]).normalize();
      tmpPos.set(
        m.worldPos[0] + tmpNorm.x * 0.006,
        m.worldPos[1] + tmpNorm.y * 0.006,
        m.worldPos[2] + tmpNorm.z * 0.006
      );
      tmpQuat.setFromUnitVectors(zAxis, tmpNorm);
      const isSelected = m.id === selectedPlannerMarkerId;
      const sc = isSelected ? 1.28 : 1.0;

      tmpMat.compose(tmpPos, tmpQuat, oneScale.set(sc, sc, sc));
      pinInst.setMatrixAt(i, tmpMat);
      pinInst.setColorAt(i, isSelected ? colSelected : colNormal);

      tmpPos.set(
        m.worldPos[0] + tmpNorm.x * 0.0035,
        m.worldPos[1] + tmpNorm.y * 0.0035,
        m.worldPos[2] + tmpNorm.z * 0.0035
      );
      tmpMat.compose(tmpPos, tmpQuat, oneScale.set(sc, sc, 1));
      ringInst.setMatrixAt(i, tmpMat);
      ringInst.setColorAt(i, isSelected ? colSelected : colNormal);
    }

    pinInst.instanceMatrix.needsUpdate = true;
    ringInst.instanceMatrix.needsUpdate = true;
    if (pinInst.instanceColor) pinInst.instanceColor.needsUpdate = true;
    if (ringInst.instanceColor) ringInst.instanceColor.needsUpdate = true;

    group.add(pinInst);
    group.add(ringInst);
    group.visible = true;
    requestRenderRef.current();
  }, [territoryMode, plannerPinsGeometryKey, selectedPlannerMarkerId, clippingPlanes]);

  const handleFramePlannerMarker = (marker: DopplerPlannerMarker) => {
    const target = new THREE.Vector3(...marker.worldPos);
    const norm = new THREE.Vector3(...marker.worldNormal).normalize();
    const camPos = target.clone().addScaledVector(norm, 0.52);
    camPos.y += 0.06;
    flyToCameraGoal([camPos.x, camPos.y, camPos.z], [target.x, target.y, target.z]);
  };

  const handleFocusTerritoryRegion = (territoryId: string) => {
    const field = territoryFieldDataRef.current;
    const slot = TERRITORY_SLOT_BY_ID.get(territoryId);
    if (!field || !slot) return;

    // In Perforator Corridors mode, frame the unilateral real-artery corridor dots closely
    // so bilateral limb corridors (e.g. Radial / Ulnar / Anterior Tibial) zoom cleanly onto one limb.
    const st = useAtlasStore.getState();
    if (st.territoryMode === 'perforators' && realCorridorCacheRef.current) {
      const effectiveId = territoryId === 'angio-32' ? 'angio-31' : territoryId;
      const preferredSide: 'left' | 'right' =
        st.territorySideFilter === 'left' ? 'left' : 'right';
      const allMatching = realCorridorCacheRef.current.dots.filter(
        (d) => d.territoryId === effectiveId
      );
      const sideMatching = allMatching.filter(
        (d) => d.side === preferredSide || d.side === 'midline'
      );
      const targetDots = sideMatching.length > 0 ? sideMatching : allMatching;
      if (targetDots.length > 0) {
        const min: [number, number, number] = [Infinity, Infinity, Infinity];
        const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
        for (const d of targetDots) {
          for (let i = 0; i < 3; i++) {
            if (d.position[i] < min[i]) min[i] = d.position[i];
            if (d.position[i] > max[i]) max[i] = d.position[i];
          }
        }
        const pad = 0.06;
        const center: [number, number, number] = [
          (min[0] + max[0]) * 0.5,
          (min[1] + max[1]) * 0.5,
          (min[2] + max[2]) * 0.5,
        ];
        const goal = computeStructureFocusCamera(
          [min[0] - pad, min[1] - pad, min[2] - pad],
          [max[0] + pad, max[1] + pad, max[2] + pad],
          center
        );
        flyToCameraGoal(goal.pos, goal.target);
        return;
      }
    }

    const bounds = computeTerritoryFocusBounds(field, slot.slotId, territorySideFilter);
    if (!bounds) return;
    const goal = computeStructureFocusCamera(bounds.boundsMin, bounds.boundsMax, bounds.center);
    flyToCameraGoal(goal.pos, goal.target);
  };

  const handleShowSourceArtery = (territoryId: string) => {
    const ext = externalGlbRef.current;
    const effSide =
      focusedTerritorySide !== 'both' ? focusedTerritorySide : territorySideFilter;
    const fjSet = getTerritorySourceArteryFjs(territoryId, effSide);
    setIsolateTerritoryArtery(true);

    if (ext && fjSet.size > 0) {
      const effAlign = getEffectiveAlignmentForBody(ext, vesselAlignment);
      const matchingSubs = ext.allSubMeshes.filter(
        (sub) => sub.system === 'arteries' && sub.fjCode && fjSet.has(sub.fjCode)
      );
      if (matchingSubs.length > 0) {
        const min: [number, number, number] = [Infinity, Infinity, Infinity];
        const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
        for (const sub of matchingSubs) {
          const wb = transformSubMeshBoundsWithAlignment(
            sub,
            effAlign,
            ext.bp3dAlignmentPivot,
            ext.orientationRotatedY
          );
          for (let i = 0; i < 3; i++) {
            if (wb.boundsMin[i] < min[i]) min[i] = wb.boundsMin[i];
            if (wb.boundsMax[i] > max[i]) max[i] = wb.boundsMax[i];
          }
        }
        const center: [number, number, number] = [
          (min[0] + max[0]) * 0.5,
          (min[1] + max[1]) * 0.5,
          (min[2] + max[2]) * 0.5,
        ];
        const goal = computeStructureFocusCamera(min, max, center);
        flyToCameraGoal(goal.pos, goal.target);
        return;
      }
    }
    handleFocusTerritoryRegion(territoryId);
  };

  const handleFocusHeadNeck = () => {
    const b = modelBoundsState;
    const h = b.maxY - b.minY;
    const minY = b.minY + h * 0.78;
    const maxY = b.maxY;
    const cx = (b.minX + b.maxX) * 0.5;
    const cz = (b.minZ + b.maxZ) * 0.5;
    const goal = computeStructureFocusCamera(
      [cx - 0.12, minY, cz - 0.12],
      [cx + 0.12, maxY, cz + 0.12],
      [cx, (minY + maxY) * 0.5, cz]
    );
    flyToCameraGoal(goal.pos, goal.target);
  };

  const handleFrameSchematicMuscle = (outlineId: string) => {
    const anchorPosMap: Record<string, [number, number, number]> = {};
    for (const a of anchors) {
      anchorPosMap[a.id] = a.position;
    }
    const side: 'right' | 'left' = territorySideFilter === 'left' ? 'left' : 'right';
    const spec = buildSchematicMuscleOutline(outlineId, side, anchorPosMap);
    if (!spec) return;
    const [cx, cy, cz] = spec.center;
    const [sx, sy, sz] = spec.size;
    const padX = Math.max(sx * 0.75, 0.08);
    const padY = Math.max(sy * 0.75, 0.1);
    const padZ = Math.max(sz * 0.9, 0.08);
    const goal = computeStructureFocusCamera(
      [cx - padX, cy - padY, cz - padZ],
      [cx + padX, cy + padY, cz + padZ],
      [cx, cy, cz]
    );
    flyToCameraGoal(goal.pos, goal.target);
  };

  const handleInspectDeepMuscle = (entry: DeepTissueMuscleEntry) => {
    const st = useAtlasStore.getState();
    if (st.territoryMode === 'off' && st.territoryFieldStatus === 'ready') {
      setTerritoryMode('angiosomes');
    }
    setTerritoryDepth(55);

    if (!entry.bp3dPresent && entry.schematicOutlineId) {
      setSelectedSchematicMuscleId(entry.schematicOutlineId);
      handleFrameSchematicMuscle(entry.schematicOutlineId);
      return;
    }

    // Locate the real BodyParts3D muscle sub-mesh(es)
    const ext = externalGlbRef.current;
    if (ext) {
      const targetKey = entry.normalizedName.toLowerCase();
      const matches = ext.allSubMeshes.filter((sub) => {
        if (sub.system !== 'muscles') return false;
        const norm = (sub.normalizedName || sub.label || sub.meshName).toLowerCase();
        const grp = (sub.groupLabel || '').toLowerCase();
        return norm === targetKey || grp === targetKey || norm.includes(targetKey);
      });
      const preferredSide = territorySideFilter === 'left' ? 'left' : 'right';
      const sideMatches = matches.filter((m) => m.laterality === preferredSide);
      const chosen = sideMatches[0] ?? matches[0];
      if (chosen) {
        const info = buildSelectedInfoForSubMesh(
          chosen,
          ext,
          getEffectiveAlignmentForBody(ext, vesselAlignment)
        );
        setSelectedAnatomyInfo(info);
        if (info.boundsMin && info.boundsMax) {
          const goal = computeStructureFocusCamera(info.boundsMin, info.boundsMax, info.center);
          flyToCameraGoal(goal.pos, goal.target);
        }
        return;
      }
    }

    // Fallback: focus the muscle's primary supplying territory
    const firstChip = entry.supplyingAngiosomes[0];
    if (firstChip) {
      focusTerritory(firstChip.territoryId, territorySideFilter, true);
    }
  };

  const handleFrameBoneRegion = (region: 'forearm' | 'lower_leg') => {
    const st = useAtlasStore.getState();
    if (st.territoryMode === 'off' && st.territoryFieldStatus === 'ready') {
      setTerritoryMode('angiosomes');
    }
    setSelectedSchematicMuscleId(null);
    setSelectedAnatomyInfo(null);
    focusTerritory(null);
    setTerritoryDepth(96);

    const ext = externalGlbRef.current;
    if (ext) {
      const bonePatterns =
        region === 'forearm' ? /\b(radius|ulna)\b/i : /\b(tibia|fibula)\b/i;
      const preferredSide = territorySideFilter === 'left' ? 'left' : 'right';
      const allMatches = ext.allSubMeshes.filter(
        (sub) => sub.system === 'skeleton' && bonePatterns.test(sub.label || sub.meshName)
      );
      const sideMatches = allMatches.filter((m) => m.laterality === preferredSide);
      const targets = sideMatches.length > 0 ? sideMatches : allMatches;
      if (targets.length > 0) {
        const min: [number, number, number] = [Infinity, Infinity, Infinity];
        const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
        for (const sub of targets) {
          for (let i = 0; i < 3; i++) {
            if (sub.boundsMin[i] < min[i]) min[i] = sub.boundsMin[i];
            if (sub.boundsMax[i] > max[i]) max[i] = sub.boundsMax[i];
          }
        }
        const center: [number, number, number] = [
          (min[0] + max[0]) * 0.5,
          (min[1] + max[1]) * 0.5,
          (min[2] + max[2]) * 0.5,
        ];
        const goal = computeStructureFocusCamera(min, max, center);
        flyToCameraGoal(goal.pos, goal.target);
        return;
      }
    }

    setCameraPreset(region === 'forearm' ? 'forearm' : 'lower-leg');
  };

  useEffect(() => {
    if (territoryFocusNonce === 0 || !focusedTerritoryId) return;
    handleFocusTerritoryRegion(focusedTerritoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territoryFocusNonce]);

  // =========================================================================
  // 4. Sync Layer Visibility, Opacity, Ghosting & Clipping Planes
  // =========================================================================
  useEffect(() => {
    const rig = bodyRigRef.current;
    if (!rig) return;

    const isTerritoryActive = territoryMode !== 'off';
    const isFlapVesselDimming = Boolean(
      !isTerritoryActive &&
        !calibrationViewActive &&
        !selectedAnatomyInfo &&
        resolvedFlapVessels &&
        resolvedFlapVessels.resolvedVessels.length > 0
    );
    const isGhosting = Boolean(
      (!isTerritoryActive && selectedAnatomyInfo && ghostUnselected) || isFlapVesselDimming
    );
    const isCalibratingSkeleton = Boolean(calibratingAnchorId);
    const hasClipping = activeThreeClippingPlanes.length > 0;

    if (flapVesselHighlightGroupRef.current) {
      flapVesselHighlightGroupRef.current.visible = isFlapVesselDimming;
    }

    (Object.keys(layers) as LayerKey[]).forEach((key) => {
      const grp = rig.layerGroups[key];
      const cfg = layers[key];
      if (!grp) return;
      // Calibrated 11 landmark anchors are rendered by anchorMarkersGroupRef; hide duplicate procedural pins
      if (key === 'landmarks') {
        grp.visible = false;
        return;
      }
      grp.visible = isCalibratingSkeleton && key !== 'skeleton' ? key === 'skin' && cfg.visible : cfg.visible;
      grp.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mat = obj.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
          if (mat && typeof mat.opacity === 'number') {
            const effOpacity = isCalibratingSkeleton
              ? key === 'skeleton'
                ? 1.0
                : 0.06
              : isGhosting
                ? Math.min(cfg.opacity, 0.12)
                : cfg.opacity;
            mat.opacity = effOpacity;
            mat.transparent =
              isGhosting ||
              (isCalibratingSkeleton && key !== 'skeleton') ||
              effOpacity < 0.99 ||
              key === 'skin' ||
              key === 'fat' ||
              key === 'fascia' ||
              key === 'angiosomes' ||
              key === 'perforasomes';
            mat.depthWrite =
              !isGhosting &&
              !(isCalibratingSkeleton && key !== 'skeleton') &&
              key !== 'skin' &&
              key !== 'fat' &&
              key !== 'fascia' &&
              key !== 'angiosomes' &&
              key !== 'perforasomes' &&
              effOpacity > 0.7;
            mat.clippingPlanes = activeThreeClippingPlanes;
            if (hasClipping && key !== 'skin') {
              mat.side = THREE.DoubleSide;
            }
            mat.needsUpdate = true;
          }
        }
      });
    });

    // Sync real multi-system GLB groups with layer visibility, opacity, ghosting & clipping
    const ext = externalGlbRef.current;
    if (ext) {
      if (ext.loadedSystems.includes('skeleton') && rig.layerGroups.skeleton) {
        rig.layerGroups.skeleton.visible = false;
      }
      if (ext.loadedSystems.includes('muscles')) {
        if (rig.layerGroups.muscle) rig.layerGroups.muscle.visible = false;
        if (rig.layerGroups.fat) rig.layerGroups.fat.visible = false;
        if (rig.layerGroups.fascia) rig.layerGroups.fascia.visible = false;
      }
      if (ext.loadedSystems.includes('skin') && rig.layerGroups.skin) {
        rig.layerGroups.skin.visible = false;
      } else if (rig.layerGroups.skin) {
        // Keep translucent schematic procedural skin silhouette sheer over real Z-Anatomy musculature
        rig.layerGroups.skin.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            const mat = obj.material as THREE.MeshStandardMaterial;
            if (mat && typeof mat.opacity === 'number') {
              mat.opacity =
                isGhosting || isCalibratingSkeleton
                  ? 0.04
                  : calibrationViewActive
                    ? 0.15
                    : Math.min(layers.skin.opacity, 0.14);
              mat.transparent = true;
              mat.depthWrite = false;
              mat.clippingPlanes = activeThreeClippingPlanes;
              mat.needsUpdate = true;
            }
          }
        });
      }
      if (ext.loadedSystems.includes('arteries') && rig.layerGroups.arteries) {
        rig.layerGroups.arteries.visible = false;
      }
      if (ext.loadedSystems.includes('veins') && rig.layerGroups.veins) {
        rig.layerGroups.veins.visible = false;
      }

      const sysToLayer: Array<[AnatomicalSystemId, LayerKey]> = [
        ['skin', 'skin'],
        ['skeleton', 'skeleton'],
        ['muscles', 'muscle'],
        ['organs', 'organs'],
        ['fascia', 'fascia'],
        ['arteries', 'arteries'],
        ['veins', 'veins'],
        ['nerves', 'nerves'],
        ['other', 'fascia'],
      ];
      for (const [sysId, layerKey] of sysToLayer) {
        const sysGrp = ext.systemGroups[sysId];
        const cfg = layers[layerKey];
        if (!sysGrp || !cfg) continue;
        const hideForArteryIsolation =
          isTerritoryActive &&
          isolateTerritoryArtery &&
          (sysId === 'muscles' || sysId === 'veins' || sysId === 'fascia' || sysId === 'organs');
        sysGrp.visible = hideForArteryIsolation
          ? false
          : isCalibratingSkeleton && sysId === 'skeleton'
            ? true
            : cfg.visible;
        sysGrp.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
            const isSheerLayer = sysId === 'skin' || sysId === 'fascia';
            const prevClipCount = obj.material.clippingPlanes?.length ?? 0;
            if (isCalibratingSkeleton) {
              if (sysId === 'skeleton') {
                obj.material.opacity = 1.0;
                obj.material.transparent = false;
                obj.material.depthWrite = true;
              } else {
                obj.material.opacity = 0.09;
                obj.material.transparent = true;
                obj.material.depthWrite = false;
              }
            } else if (isTerritoryActive) {
              // Phase 11c Anti-Clutter Contract:
              // - Skin carries territory shader cleanly (opaque depthWrite when >= 0.55 so back faces never muddy front)
              // - Unfocused arteries dimmed to 8% unless a territory is focused
              // - Isolate Source Artery highlights real BP3D source artery via selectionHighlightGroupRef and dims all else
              if (isolateTerritoryArtery) {
                if (sysId === 'arteries') {
                  obj.material.opacity = 0.18;
                  obj.material.transparent = true;
                  obj.material.depthWrite = false;
                } else {
                  obj.material.opacity = sysId === 'skin' ? 0.08 : 0.14;
                  obj.material.transparent = true;
                  obj.material.depthWrite = false;
                }
              } else if (sysId === 'skin') {
                const skinSolidEnough = cfg.opacity >= 0.55;
                obj.material.opacity = cfg.opacity;
                obj.material.transparent = true;
                obj.material.depthWrite = skinSolidEnough;
              } else if (sysId === 'arteries') {
                const showCrisp = Boolean(focusedTerritoryId);
                obj.material.opacity = showCrisp ? 1.0 : 0.08;
                obj.material.transparent = !showCrisp;
                obj.material.depthWrite = showCrisp;
              } else if (sysId === 'veins') {
                const showVeins = territoryMode === 'venosomes';
                obj.material.opacity = showVeins ? 0.9 : 0.08;
                obj.material.transparent = true;
                obj.material.depthWrite = showVeins;
              } else {
                const isOpaqueSolid = !isSheerLayer && cfg.opacity >= 0.8;
                obj.material.opacity = isOpaqueSolid ? 1.0 : cfg.opacity;
                obj.material.transparent = !isOpaqueSolid;
                obj.material.depthWrite = isOpaqueSolid || (!isSheerLayer && cfg.opacity > 0.7);
              }
            } else if (isGhosting) {
              obj.material.opacity = isSheerLayer ? 0.06 : 0.14;
              obj.material.transparent = true;
              obj.material.depthWrite = false;
            } else {
              // Keep solid bones/muscles/organs crisp & opaque unless user dials opacity below 0.8
              const isOpaqueSolid = !isSheerLayer && cfg.opacity >= 0.8;
              obj.material.opacity = isOpaqueSolid ? 1.0 : cfg.opacity;
              obj.material.transparent = !isOpaqueSolid;
              obj.material.depthWrite = isOpaqueSolid || (!isSheerLayer && cfg.opacity > 0.7);
            }
            obj.material.clippingPlanes = activeThreeClippingPlanes;
            const nextSide =
              hasClipping || (isSheerLayer && !(isTerritoryActive && sysId === 'skin'))
                ? THREE.DoubleSide
                : THREE.FrontSide;
            obj.material.side = nextSide;
            if ((prevClipCount > 0) !== (activeThreeClippingPlanes.length > 0)) {
              obj.material.needsUpdate = true;
            }
          }
        });
      }
    }

    // Apply active clipping planes to flap overlays too (auto-declutter in Territory Mode or pre-selection launch)
    if (activeFlapGroupRef.current) {
      activeFlapGroupRef.current.visible =
        !calibrationViewActive && !isTerritoryActive && (!immersive || hasSelectedFlap);
      activeFlapGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          const mat = obj.material as THREE.Material;
          if (mat && 'clippingPlanes' in mat) {
            const prevClips = (mat.clippingPlanes as THREE.Plane[] | null)?.length ?? 0;
            mat.clippingPlanes = activeThreeClippingPlanes;
            if ((prevClips > 0) !== (activeThreeClippingPlanes.length > 0)) {
              mat.needsUpdate = true;
            }
          }
        }
      });
    }

    // Highlight selected vessel in main vascular tree
    const pal = getAnatomyPalette(colorblindMode);
    rig.vesselMeshMap.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (id === selectedVesselId) {
        mat.color.setHex(0x38bdf8);
        mat.emissive?.setHex(0x0284c7);
        mat.emissiveIntensity = 0.65;
        mesh.scale.setScalar(1.35);
      } else {
        const isNerve = mesh.userData.anatomy_category === 'Nerve';
        mat.color.setHex(isNerve ? pal.nerve : pal.artery);
        mat.emissive?.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mesh.scale.setScalar(1.0);
      }
    });

    requestRenderRef.current();
  }, [
    layers,
    selectedVesselId,
    selectedAnatomyInfo,
    ghostUnselected,
    calibratingAnchorId,
    activeThreeClippingPlanes,
    activeModelStats,
    calibrationViewActive,
    resolvedFlapVessels,
    colorblindMode,
    bodySex,
    territoryMode,
    focusedTerritoryId,
    isolateTerritoryArtery,
  ]);

  // =========================================================================
  // 4b. Selection Outline Highlight & Visual Clipping Plane Guide Frames
  // =========================================================================
  useEffect(() => {
    const highlightRoot = selectionHighlightGroupRef.current;
    if (!highlightRoot) return;
    disposeSelectionHighlightGroup(highlightRoot);
    if (hoverHighlightGroupRef.current) {
      disposeSelectionHighlightGroup(hoverHighlightGroupRef.current);
      hoveredSubMeshKeyRef.current = null;
    }

    if (selectedAnatomyInfo) {
      const ext = externalGlbRef.current;
      const outlineColor = colorblindMode ? 0xf59e0b : 0x14b8a6;
      let highlightedAny = false;

      const hiddenKeys = hiddenMeshKeysRef.current;
      const isolatedKeys = visibilityState.isolatedMeshKeys;
      const hasIsolation = isolatedKeys.length > 0;

      // Phase 10b / 12-2: Highlight ALL visible (non-hidden) constituent parts when a logical muscle group is selected
      const rawPartKeys =
        selectedAnatomyInfo.constituentParts && selectedAnatomyInfo.constituentParts.length > 0
          ? selectedAnatomyInfo.constituentParts
              .map((p) => p.meshKey)
              .filter((k): k is string => Boolean(k))
          : selectedAnatomyInfo.subMeshKey
            ? [selectedAnatomyInfo.subMeshKey]
            : [];
      const partKeys = rawPartKeys.filter(
        (k) =>
          !hiddenKeys.has(k) &&
          (!hasIsolation ||
            isolatedKeys.includes(k) ||
            (visibilityState.isolateKeepSkeleton && selectedAnatomyInfo.system === 'skeleton'))
      );

      if (ext && partKeys.length > 0) {
        for (const key of partKeys) {
          const match = findMergedMeshForSubMesh(ext, key);
          if (!match) continue;
          const extracted = extractSubMeshGeometry(match.mesh, match.record);
          if (!extracted) continue;
          const baseColor = getBucketColorHex(match.record.materialBucket, colorblindMode);
          const highlight = createSelectionHighlightGroup(
            extracted,
            baseColor,
            activeThreeClippingPlanes,
            outlineColor
          );
          highlightRoot.add(highlight);
          highlightedAny = true;
        }
      }

      if (!highlightedAny && bodyRigRef.current) {
        const procMatch = bodyRigRef.current.interactiveMeshes.find(
          (obj) =>
            obj instanceof THREE.Mesh &&
            (obj.userData?.anatomy_id === selectedAnatomyInfo.id ||
              (selectedAnatomyInfo.meshName && obj.name === selectedAnatomyInfo.meshName))
        ) as THREE.Mesh | undefined;
        if (procMatch) {
          const extracted = extractSubMeshGeometry(procMatch, null);
          const bucket: TissueMaterialBucket =
            selectedAnatomyInfo.system === 'skeleton'
              ? 'bone'
              : selectedAnatomyInfo.system === 'nerves'
                ? 'nerve'
                : selectedAnatomyInfo.system === 'arteries'
                  ? 'artery'
                  : selectedAnatomyInfo.system === 'veins'
                    ? 'vein'
                    : 'muscle';
          const baseColor = getBucketColorHex(bucket, colorblindMode);
          if (extracted) {
            const highlight = createSelectionHighlightGroup(
              extracted,
              baseColor,
              activeThreeClippingPlanes,
              outlineColor
            );
            highlightRoot.add(highlight);
          }
        }
      }
    } else if (territoryMode !== 'off' && focusedTerritoryId && externalGlbRef.current) {
      // Phase 11c: Brightly highlight real BP3D source arteries of the focused territory
      const ext = externalGlbRef.current;
      const effSide =
        focusedTerritorySide !== 'both' ? focusedTerritorySide : territorySideFilter;
      const fjSet = getTerritorySourceArteryFjs(focusedTerritoryId, effSide);
      if (fjSet.size > 0) {
        const outlineColor = isolateTerritoryArtery ? 0xfef08a : 0xf43f5e;
        const baseColor = 0xdc2626;
        for (const sub of ext.allSubMeshes) {
          if (sub.system !== 'arteries' || !sub.fjCode || !fjSet.has(sub.fjCode)) continue;
          const match = findMergedMeshForSubMesh(ext, sub.meshKey);
          if (!match) continue;
          const extracted = extractSubMeshGeometry(match.mesh, match.record);
          if (!extracted) continue;
          const highlight = createSelectionHighlightGroup(
            extracted,
            baseColor,
            activeThreeClippingPlanes,
            outlineColor
          );
          highlightRoot.add(highlight);
        }
      }
    }

    requestRenderRef.current();
  }, [
    selectedAnatomyInfo,
    activeThreeClippingPlanes,
    activeModelStats,
    vesselAlignment,
    colorblindMode,
    territoryMode,
    focusedTerritoryId,
    focusedTerritorySide,
    territorySideFilter,
    isolateTerritoryArtery,
    visibilityState,
  ]);

  // =========================================================================
  // 4b-i. Phase 12-2: O(1) DataTexture Sub-Mesh Visibility / Isolate / Ghost Sync
  // =========================================================================
  useEffect(() => {
    const hiddenKeys = new Set<string>();
    for (const item of visibilityState.hiddenItems) {
      for (const k of item.meshKeys) hiddenKeys.add(k);
    }
    if (operativeViewState.active && operativeViewState.hideMeshKeys.length > 0) {
      for (const k of operativeViewState.hideMeshKeys) hiddenKeys.add(k);
    }
    hiddenMeshKeysRef.current = hiddenKeys;

    const isolatedSet = new Set(visibilityState.isolatedMeshKeys);
    const hasIsolation = isolatedSet.size > 0;
    const ghostOthersSet = new Set(visibilityState.ghostOthersKeys);
    const hasGhostOthers = ghostOthersSet.size > 0;
    const keepSkeleton = visibilityState.isolateKeepSkeleton;

    for (const ctrl of visibilityControllersRef.current) {
      const summary = updateSubMeshVisibilityBuffer(ctrl, (rec): SubMeshVisibilityMode => {
        if (hiddenKeys.has(rec.meshKey)) return 'hidden';
        if (hasIsolation) {
          if (isolatedSet.has(rec.meshKey)) return 'visible';
          if (keepSkeleton && rec.system === 'skeleton') return 'faint-skeleton';
          return 'hidden';
        }
        if (hasGhostOthers) {
          if (ghostOthersSet.has(rec.meshKey)) return 'visible';
          return 'ghost';
        }
        return 'visible';
      });

      if (ctrl.mesh.material instanceof THREE.MeshStandardMaterial) {
        if (summary.allVisibleGhosted) {
          if (!ctrl.mesh.userData.__visGhostOverride) {
            ctrl.mesh.userData.__preVisTransparent = ctrl.mesh.material.transparent;
            ctrl.mesh.userData.__preVisDepthWrite = ctrl.mesh.material.depthWrite;
            ctrl.mesh.userData.__visGhostOverride = true;
          }
          ctrl.mesh.material.transparent = true;
          ctrl.mesh.material.depthWrite = false;
        } else if (ctrl.mesh.userData.__visGhostOverride) {
          const isOpaqueNow = ctrl.mesh.material.opacity >= 0.985;
          ctrl.mesh.material.transparent =
            typeof ctrl.mesh.userData.__preVisTransparent === 'boolean'
              ? ctrl.mesh.userData.__preVisTransparent && !isOpaqueNow
              : !isOpaqueNow;
          ctrl.mesh.material.depthWrite =
            typeof ctrl.mesh.userData.__preVisDepthWrite === 'boolean'
              ? ctrl.mesh.userData.__preVisDepthWrite || isOpaqueNow
              : isOpaqueNow;
          ctrl.mesh.userData.__visGhostOverride = false;
        }
      }
    }

    // Mirror onto procedural fallback meshes when no external GLB covers that system
    const rig = bodyRigRef.current;
    if (rig) {
      for (const obj of rig.interactiveMeshes) {
        if (!(obj instanceof THREE.Mesh)) continue;
        const key = String(obj.userData?.anatomy_id || obj.name || '');
        const sys = obj.userData?.anatomy_system as AnatomicalSystemId | undefined;
        let hidden = hiddenKeys.has(key);
        let ghostAlpha: number | null = null;
        if (!hidden && hasIsolation) {
          if (isolatedSet.has(key)) {
            ghostAlpha = null;
          } else if (keepSkeleton && sys === 'skeleton') {
            ghostAlpha = 0.18;
          } else {
            hidden = true;
          }
        } else if (!hidden && hasGhostOthers && !ghostOthersSet.has(key)) {
          ghostAlpha = 0.1;
        }
        obj.visible = !hidden;
        if (obj.material instanceof THREE.MeshStandardMaterial) {
          if (ghostAlpha !== null) {
            if (!obj.userData.__visGhostOverride) {
              obj.userData.__preVisOpacity = obj.material.opacity;
              obj.userData.__preVisTransparent = obj.material.transparent;
              obj.userData.__preVisDepthWrite = obj.material.depthWrite;
              obj.userData.__visGhostOverride = true;
            }
            obj.material.transparent = true;
            obj.material.depthWrite = false;
            obj.material.opacity = ghostAlpha;
          } else if (obj.userData.__visGhostOverride) {
            if (typeof obj.userData.__preVisOpacity === 'number') {
              obj.material.opacity = obj.userData.__preVisOpacity;
            }
            if (typeof obj.userData.__preVisTransparent === 'boolean') {
              obj.material.transparent = obj.userData.__preVisTransparent;
            }
            if (typeof obj.userData.__preVisDepthWrite === 'boolean') {
              obj.material.depthWrite = obj.userData.__preVisDepthWrite;
            }
            obj.userData.__visGhostOverride = false;
          }
        }
      }
    }

    if (visibilityState.hiddenItems.length === 0) {
      setHiddenPopoverOpen(false);
    }

    requestRenderRef.current();
  }, [
    visibilityState,
    operativeViewState.active,
    operativeViewState.hideMeshKeys,
    activeModelStats,
    layers,
    territoryMode,
    calibrationViewActive,
    ghostUnselected,
    selectedAnatomyInfo,
    selectedVesselId,
    isolateTerritoryArtery,
    focusedTerritoryId,
    calibratingAnchorId,
  ]);

  // =========================================================================
  // 4b-i-b. Phase 12-2: Muscle Reference "Show vessels" & Vessel Chip Highlighting
  // =========================================================================
  useEffect(() => {
    const root = muscleVesselHighlightGroupRef.current;
    if (!root) return;
    disposeSelectionHighlightGroup(root);

    const ext = externalGlbRef.current;
    if (ext && highlightedMuscleVesselKeys.length > 0) {
      const hiddenKeys = hiddenMeshKeysRef.current;
      for (const key of highlightedMuscleVesselKeys) {
        if (hiddenKeys.has(key)) continue;
        const match = findMergedMeshForSubMesh(ext, key);
        if (!match) continue;
        const extracted = extractSubMeshGeometry(match.mesh, match.record);
        if (!extracted) continue;
        const role = match.record.system === 'veins' ? 'vein' : 'pedicle';
        const style = getFlapVesselRoleStyle(role, colorblindMode);
        const { group: vesselGroup } = createFlapVesselHighlightGroup(
          extracted,
          style,
          role,
          activeThreeClippingPlanes
        );
        root.add(vesselGroup);
      }
    }

    requestRenderRef.current();
  }, [highlightedMuscleVesselKeys, activeModelStats, activeThreeClippingPlanes, colorblindMode, visibilityState]);

  // =========================================================================
  // 4b-i-d. Phase 12-3: Operative Guide "Show in 3D" & Adjacent Structure Highlights + Framing
  // =========================================================================
  useEffect(() => {
    const root = operativeHighlightGroupRef.current;
    if (!root) return;
    disposeSelectionHighlightGroup(root);

    if (!operativeViewState.active || operativeViewState.highlightMeshKeys.length === 0) {
      requestRenderRef.current();
      return;
    }

    const ext = externalGlbRef.current;
    const rig = bodyRigRef.current;
    const effAlign = ext ? getEffectiveAlignmentForBody(ext, vesselAlignment) : null;
    const hiddenKeys = hiddenMeshKeysRef.current;
    const unionMin: [number, number, number] = [Infinity, Infinity, Infinity];
    const unionMax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    let hasBounds = false;

    const expandBounds = (bMin: [number, number, number], bMax: [number, number, number]) => {
      hasBounds = true;
      for (let i = 0; i < 3; i++) {
        if (bMin[i] < unionMin[i]) unionMin[i] = bMin[i];
        if (bMax[i] > unionMax[i]) unionMax[i] = bMax[i];
      }
    };

    if (ext && effAlign) {
      for (const key of operativeViewState.highlightMeshKeys) {
        if (hiddenKeys.has(key)) continue;
        const match = findMergedMeshForSubMesh(ext, key);
        if (!match) continue;
        const extracted = extractSubMeshGeometry(match.mesh, match.record);
        if (!extracted) continue;

        if (match.record.system === 'arteries' || match.record.system === 'veins') {
          const role = match.record.system === 'veins' ? 'vein' : 'pedicle';
          const style = getFlapVesselRoleStyle(role, colorblindMode);
          const { group: vesselGroup } = createFlapVesselHighlightGroup(
            extracted,
            style,
            role,
            activeThreeClippingPlanes
          );
          root.add(vesselGroup);
        } else {
          const baseColor = getBucketColorHex(match.record.materialBucket, colorblindMode);
          const outlineColor = colorblindMode ? 0xfacc15 : 0x38bdf8;
          const highlight = createSelectionHighlightGroup(
            extracted,
            baseColor,
            activeThreeClippingPlanes,
            outlineColor
          );
          root.add(highlight);
        }

        const wb = transformSubMeshBoundsWithAlignment(
          match.record,
          effAlign,
          ext.bp3dAlignmentPivot,
          ext.orientationRotatedY
        );
        expandBounds(wb.boundsMin, wb.boundsMax);
      }
    } else if (rig) {
      for (const key of operativeViewState.highlightMeshKeys) {
        if (hiddenKeys.has(key)) continue;
        const procMatch = rig.interactiveMeshes.find(
          (m) => m instanceof THREE.Mesh && (m.userData?.anatomy_id === key || m.name === key)
        ) as THREE.Mesh | undefined;
        if (!procMatch) continue;
        const extracted = extractSubMeshGeometry(procMatch, null);
        if (!extracted) continue;
        const highlight = createSelectionHighlightGroup(
          extracted,
          0x38bdf8,
          activeThreeClippingPlanes,
          0xfacc15
        );
        root.add(highlight);
        const box = new THREE.Box3().setFromObject(procMatch);
        if (!box.isEmpty()) {
          expandBounds(
            [box.min.x, box.min.y, box.min.z],
            [box.max.x, box.max.y, box.max.z]
          );
        }
      }
    }

    if (hasBounds) {
      const center: [number, number, number] = [
        (unionMin[0] + unionMax[0]) * 0.5,
        (unionMin[1] + unionMax[1]) * 0.5,
        (unionMin[2] + unionMax[2]) * 0.5,
      ];
      const goal = computeStructureFocusCamera(unionMin, unionMax, center);
      cameraGoalRef.current = {
        pos: new THREE.Vector3(...goal.pos),
        target: new THREE.Vector3(...goal.target),
      };
    }

    requestRenderRef.current();
  }, [
    operativeViewState,
    activeModelStats,
    vesselAlignment,
    activeThreeClippingPlanes,
    colorblindMode,
    visibilityState,
  ]);

  // =========================================================================
  // 4b-i-c. Phase 12-2: Frame 3D Muscle when selected from Muscle Library
  // =========================================================================
  useEffect(() => {
    if (!selectedMuscleRefId || muscleRefFrameNonce === 0) return;
    const refEntry = MUSCLE_REFERENCE_BY_ID.get(selectedMuscleRefId);
    if (!refEntry || !refEntry.inBodyParts3D) return;
    const ext = externalGlbRef.current;
    if (!ext) return;

    const effAlign = getEffectiveAlignmentForBody(ext, vesselAlignment);
    const matching = ext.allSubMeshes.filter((sub) => {
      if (sub.system !== 'muscles') return false;
      const resolved = findMuscleReferenceForSelection({
        label: sub.label,
        meshName: sub.meshName,
        normalizedName: sub.normalizedName,
        groupId: sub.groupId,
        groupLabel: sub.groupLabel,
        partLabel: sub.partLabel,
      });
      return resolved?.id === refEntry.id;
    });

    if (matching.length === 0) return;
    const preferred = matching.filter((s) => s.laterality === donorSide);
    const chosen = preferred.length > 0 ? preferred : matching;
    const first = chosen[0];
    const info = buildSelectedInfoForSubMesh(first, ext, effAlign);

    if (!layers.muscle.visible) {
      setLayer('muscle', { visible: true });
    }
    if (info.boundsMin && info.boundsMax) {
      const goal = computeStructureFocusCamera(info.boundsMin, info.boundsMax, info.center);
      cameraGoalRef.current = {
        pos: new THREE.Vector3(...goal.pos),
        target: new THREE.Vector3(...goal.target),
      };
    }
    setSelectedAnatomyInfo(info);
    requestRenderRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMuscleRefId, muscleRefFrameNonce, activeModelStats]);

  // =========================================================================
  // 4b-ii. Phase 9b / 10a: BodyParts3D Alignment Transform, Diagnostics & Calibration View Filter
  // =========================================================================
  useEffect(() => {
    const ext = externalGlbRef.current;
    const rig = bodyRigRef.current;
    const effAlign = getEffectiveAlignmentForBody(ext, vesselAlignment);

    // 1. Apply shared alignment transform to arteries + veins + skin group
    //    (Identity for unified BP3D 4.0; user alignment only when legacy Z-Anatomy is loaded)
    if (ext) {
      applyVesselAlignmentToGroup(
        ext.bp3dAlignmentGroup,
        effAlign,
        ext.bp3dAlignmentPivot,
        ext.orientationRotatedY
      );
      ext.root.updateMatrixWorld(true);

      // Keep searchable structure bounds synced with aligned vessel/skin positions
      const rotatedY = ext.orientationRotatedY;
      setSearchableStructures(
        ext.allSubMeshes.map((sub) => {
          const wb = transformSubMeshBoundsWithAlignment(
            sub,
            effAlign,
            ext.bp3dAlignmentPivot,
            rotatedY
          );
          return {
            key: sub.meshKey,
            anatomyId: sub.anatomyId,
            label: sub.label,
            meshName: sub.meshName,
            system: sub.system,
            category: sub.category,
            laterality: sub.laterality,
            mapped: sub.mapped,
            linkedFlapIds: sub.linkedFlapIds,
            sourceModel: sub.sourceModel,
            fjCode: sub.fjCode,
            fmaCode: sub.fmaCode,
            groupId: sub.groupId,
            groupLabel: sub.groupLabel,
            partLabel: sub.partLabel,
            center: wb.center,
            boundsMin: wb.boundsMin,
            boundsMax: wb.boundsMax,
          };
        })
      );
    }

    // 2. Apply Calibration View arterial isolation OR Sub-Phase 9c Vessel View declutter + side filter
    let calibrationArteryCount = 0;
    const filterableVessels: Array<{
      name: string;
      meshName?: string;
      laterality?: string;
      centerXMeters?: number;
      system: 'arteries' | 'veins';
    }> = [];

    const matchesDeclutterSub = (rec: MergedSubMeshRecord) =>
      shouldShowVessel(
        {
          name: rec.label,
          meshName: rec.meshName,
          laterality: rec.laterality,
          centerXMeters: rec.center[0],
        },
        vesselPreset,
        vesselSideFilter
      );

    const useExtArteries = Boolean(
      ext && ext.loadedSystems.includes('arteries') && ext.systemGroups.arteries
    );
    const useExtVeins = Boolean(
      ext && ext.loadedSystems.includes('veins') && ext.systemGroups.veins
    );

    const territorySourceFjs =
      territoryMode !== 'off' && focusedTerritoryId
        ? getTerritorySourceArteryFjs(
            focusedTerritoryId,
            focusedTerritorySide !== 'both' ? focusedTerritorySide : territorySideFilter
          )
        : null;

    if (useExtArteries && ext?.systemGroups.arteries) {
      ext.systemGroups.arteries.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData?.isMergedSystemMesh) {
          const subs = (obj.userData.subMeshes as MergedSubMeshRecord[] | undefined) || [];
          for (const rec of subs) {
            if (isCalibrationReferenceArtery(rec.label, rec.fjCode, rec.meshName)) {
              calibrationArteryCount += 1;
            }
            filterableVessels.push({
              name: rec.label,
              meshName: rec.meshName,
              laterality: rec.laterality,
              centerXMeters: rec.center[0],
              system: 'arteries',
            });
          }
          applySubMeshVisibilityFilter(
            obj,
            calibrationViewActive
              ? (rec) => isCalibrationReferenceArtery(rec.label, rec.fjCode, rec.meshName)
              : territorySourceFjs !== null
                ? (rec) => Boolean(rec.fjCode && territorySourceFjs.has(rec.fjCode))
                : matchesDeclutterSub
          );
        }
      });
    } else if (rig?.layerGroups.arteries) {
      const tmpBox = new THREE.Box3();
      const tmpCenter = new THREE.Vector3();
      rig.layerGroups.arteries.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const label = String(obj.userData?.anatomy_label || obj.name || '');
          const laterality = obj.userData?.anatomy_laterality as string | undefined;
          tmpBox.setFromObject(obj);
          const cx = tmpBox.isEmpty() ? 0 : tmpBox.getCenter(tmpCenter).x;
          const matchedCal = isCalibrationReferenceArtery(label);
          if (matchedCal) calibrationArteryCount += 1;
          filterableVessels.push({
            name: label,
            meshName: obj.name,
            laterality,
            centerXMeters: cx,
            system: 'arteries',
          });
          obj.visible = calibrationViewActive
            ? matchedCal
            : shouldShowVessel(
                { name: label, meshName: obj.name, laterality, centerXMeters: cx },
                vesselPreset,
                vesselSideFilter
              );
        }
      });
    }

    if (useExtVeins && ext?.systemGroups.veins) {
      ext.systemGroups.veins.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData?.isMergedSystemMesh) {
          const subs = (obj.userData.subMeshes as MergedSubMeshRecord[] | undefined) || [];
          for (const rec of subs) {
            filterableVessels.push({
              name: rec.label,
              meshName: rec.meshName,
              laterality: rec.laterality,
              centerXMeters: rec.center[0],
              system: 'veins',
            });
          }
          applySubMeshVisibilityFilter(
            obj,
            calibrationViewActive ? null : matchesDeclutterSub
          );
        }
      });
    } else if (rig?.layerGroups.veins) {
      const tmpBox = new THREE.Box3();
      const tmpCenter = new THREE.Vector3();
      rig.layerGroups.veins.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const label = String(obj.userData?.anatomy_label || obj.name || '');
          const laterality = obj.userData?.anatomy_laterality as string | undefined;
          tmpBox.setFromObject(obj);
          const cx = tmpBox.isEmpty() ? 0 : tmpBox.getCenter(tmpCenter).x;
          filterableVessels.push({
            name: label,
            meshName: obj.name,
            laterality,
            centerXMeters: cx,
            system: 'veins',
          });
          obj.visible = calibrationViewActive
            ? true
            : shouldShowVessel(
                { name: label, meshName: obj.name, laterality, centerXMeters: cx },
                vesselPreset,
                vesselSideFilter
              );
        }
      });
    }

    setVesselFilterStats(
      summarizeVesselFilterStats(filterableVessels, vesselPreset, vesselSideFilter)
    );

    // Hide schematic flap paddles/pedicles during Calibration View, Territory Mode, or clean full-body launch
    if (activeFlapGroupRef.current) {
      activeFlapGroupRef.current.visible =
        !calibrationViewActive && territoryMode === 'off' && (!immersive || hasSelectedFlap);
    }

    // 3. Compute live world-space bounding boxes, heights & centre deltas for skeleton, muscles, vessels, skin
    const skelBounds = measureObjectWorldBounds(
      ext ? ext.systemGroups.skeleton : rig?.layerGroups.skeleton
    );
    const muscBounds = measureObjectWorldBounds(
      ext ? ext.systemGroups.muscles : rig?.layerGroups.muscle
    );
    const artBounds = measureObjectWorldBounds(
      ext ? ext.systemGroups.arteries : rig?.layerGroups.arteries
    );
    const veinBounds = measureObjectWorldBounds(
      ext ? ext.systemGroups.veins : rig?.layerGroups.veins
    );
    const vesselsBounds = mergeBoundingBoxes(
      [artBounds, veinBounds].filter((b): b is NonNullable<typeof b> => Boolean(b))
    );
    const skinBounds = measureObjectWorldBounds(
      ext ? ext.systemGroups.skin : rig?.layerGroups.skin
    );

    const diag = computeAlignmentDiagnostics(
      {
        skeleton: skelBounds,
        muscles: muscBounds,
        vessels: vesselsBounds,
        skin: skinBounds,
      },
      calibrationArteryCount
    );
    setAlignmentDiagnostics(diag);

    // Log diagnostics to console once per loaded model configuration
    if (activeModelStats) {
      const logKey = `${activeModelStats.mode}:${activeModelStats.loadedSystems.join(',')}:${activeModelStats.totalMeshes}`;
      if (lastLoggedDiagKeyRef.current !== logKey) {
        lastLoggedDiagKeyRef.current = logKey;
        console.info(formatAlignmentDiagnosticsForConsole(diag, vesselAlignment));
      }
    }

    requestRenderRef.current();
  }, [
    vesselAlignment,
    calibrationViewActive,
    vesselPreset,
    vesselSideFilter,
    activeModelStats,
    bodySex,
    territoryMode,
    focusedTerritoryId,
    focusedTerritorySide,
    territorySideFilter,
    setAlignmentDiagnostics,
    setVesselFilterStats,
  ]);

  useEffect(() => {
    const guideRoot = clippingGuideGroupRef.current;
    if (!guideRoot) return;
    disposeSelectionHighlightGroup(guideRoot);

    for (const entry of activeClippingEntries) {
      const guide = buildClippingGuideVisual(
        entry.axis,
        entry.spec.worldCoordMeters,
        modelBoundsState,
        entry.colorHex
      );
      guideRoot.add(guide);
    }

    requestRenderRef.current();
  }, [activeClippingEntries, modelBoundsState]);

  // =========================================================================
  // 4c. Phase 8c: Render 11 Calibrated Landmark Anchor 3D Pins
  // =========================================================================
  useEffect(() => {
    const anchorRoot = anchorMarkersGroupRef.current;
    if (!anchorRoot) return;
    disposeSelectionHighlightGroup(anchorRoot);

    const visible = layers.landmarks.visible || Boolean(calibratingAnchorId);
    anchorRoot.visible = visible;
    if (!visible) {
      requestRenderRef.current();
      return;
    }

    const pal = getAnatomyPalette(colorblindMode);
    const isRealModel = activeModelStats?.mode === 'real-glb';

    for (const anchor of anchors) {
      const isPicking = calibratingAnchorId === anchor.id;
      const isCalibrated = anchor.source === 'calibrated';
      const pos = isRealModel || isCalibrated ? anchor.position : anchor.defaultProceduralPos;
      const pinColor = isPicking ? 0xf59e0b : isCalibrated ? 0x10b981 : pal.landmark;

      const pinGeo = new THREE.OctahedronGeometry(isPicking ? 0.014 : 0.0095, 0);
      const pinMat = new THREE.MeshStandardMaterial({
        color: pinColor,
        emissive: pinColor,
        emissiveIntensity: isPicking ? 0.72 : isCalibrated ? 0.42 : 0.25,
        roughness: 0.25,
        metalness: 0.15,
        transparent: layers.landmarks.opacity < 0.99 && !isPicking,
        opacity: isPicking ? 1.0 : layers.landmarks.opacity,
        clippingPlanes: activeThreeClippingPlanes,
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(pos[0], pos[1], pos[2]);
      pinMesh.name = `anchor_${anchor.id}`;
      pinMesh.userData = {
        anchorId: anchor.id,
        anatomy_id: `landmark_${anchor.id}`,
        anatomy_label: `${anchor.name}${isCalibrated ? ' (Calibrated)' : ''}`,
        anatomy_category: 'Landmark Anchor',
        anatomy_laterality: anchor.side,
        anatomy_system: 'skeleton',
        anatomy_mapped: true,
        linked_flap_ids: [],
      };
      anchorRoot.add(pinMesh);

      const ringGeo = new THREE.RingGeometry(
        isPicking ? 0.017 : 0.012,
        isPicking ? 0.022 : 0.0155,
        20
      );
      const ringMat = new THREE.MeshBasicMaterial({
        color: pinColor,
        transparent: true,
        opacity: isPicking ? 0.92 : 0.62 * layers.landmarks.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        clippingPlanes: activeThreeClippingPlanes,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(pos[0], pos[1], pos[2]);
      ring.rotation.x = Math.PI * 0.5;
      anchorRoot.add(ring);
    }

    requestRenderRef.current();
  }, [
    anchors,
    layers.landmarks,
    calibratingAnchorId,
    activeModelStats?.mode,
    activeThreeClippingPlanes,
    colorblindMode,
  ]);

  // =========================================================================
  // 4d. Phase 10d: Auto-Propose 13 Landmark Anchors directly from BP3D Geometry
  // =========================================================================
  useEffect(() => {
    if (!autoProposeAnchorsNonce) return;
    const ext = externalGlbRef.current;
    if (!ext || ext.allSubMeshes.length === 0) {
      setToastMsg('Wait for BodyParts3D skeleton & skin to finish loading before auto-proposing.');
      return;
    }
    const proposed = proposeBp3dAnchorsFromSubMeshes(ext.allSubMeshes);
    const count = Object.keys(proposed).length;
    if (count > 0) {
      applyAnchorOverrides(proposed);
      setToastMsg(`Auto-proposed ${count} BP3D 4.0 landmark anchors from skeleton & skin geometry.`);
    } else {
      setToastMsg('Could not derive landmarks — ensure skeleton.glb is loaded.');
    }
  }, [autoProposeAnchorsNonce, applyAnchorOverrides]);

  // =========================================================================
  // 5. Render Active Flap Overlay (Paddle projected onto BP3D skin.glb,
  //    Cutting Guide, Pedicle, Perforators, Schematic Muscle Outline for absent BP3D muscles)
  // =========================================================================
  useEffect(() => {
    const group = activeFlapGroupRef.current;
    if (!group) return;

    disposeGroupChildren(group);
    animGhostRef.current = null;
    animPathRef.current = null;

    if (!selectedFlap || !resolvedFlapOverlay) return;
    const spec = selectedFlap.spec3d;
    const pal = getAnatomyPalette(colorblindMode);
    const mirrorX = spec.side !== 'midline' && donorSide !== spec.side ? -1 : 1;
    const mapPt = (p: [number, number, number]): [number, number, number] => [
      p[0] * mirrorX,
      p[1],
      p[2],
    ];

    const center = new THREE.Vector3(...mapPt(resolvedFlapOverlay.paddleCenter));
    const normal = new THREE.Vector3(
      spec.paddleNormal[0] * mirrorX,
      spec.paddleNormal[1],
      spec.paddleNormal[2]
    ).normalize();
    const [lenM, widM] = spec.paddleSize;

    // Phase 10d: Project flap skin paddle onto real BP3D skin.glb surface when loaded
    const skinGroup = externalGlbRef.current?.systemGroups.skin;
    if (skinGroup) {
      const skinMeshes: THREE.Mesh[] = [];
      skinGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) skinMeshes.push(obj);
      });
      if (skinMeshes.length > 0) {
        const projRay = new THREE.Raycaster();
        // Cast inward from outside along -normal through anchor-derived paddle center
        const probeOrigin = center.clone().addScaledVector(normal, 0.28);
        const probeDir = normal.clone().negate();
        projRay.set(probeOrigin, probeDir);
        const skinHits = projRay.intersectObjects(skinMeshes, false);
        const bestHit = skinHits.find((h) => h.point.distanceTo(center) < 0.24) || null;
        if (bestHit) {
          center.copy(bestHit.point);
          if (bestHit.face) {
            const hitNormal = bestHit.face.normal
              .clone()
              .transformDirection(bestHit.object.matrixWorld)
              .normalize();
            if (hitNormal.dot(normal) < 0) hitNormal.negate();
            normal.copy(hitNormal);
          }
        }
      }
    }

    const isTransversePaddle = [
      'diep-flap',
      'siea-flap',
      'tram-flap',
      'groin-flap',
      'pap-flap',
      'sgap-flap',
      'tug-flap',
      'gluteal-rotation-flap',
    ].includes(selectedFlap.id);
    const scaleX = isTransversePaddle ? lenM : widM;
    const scaleY = isTransversePaddle ? widM : lenM;

    // 5a. Skin Paddle Mesh (Projected onto BP3D skin.glb when loaded — schematic flap design)
    if (layers.paddle.visible) {
      const paddleGeo = new THREE.CircleGeometry(0.5, 32);
      paddleGeo.scale(scaleX, scaleY, 1);
      const paddleOpacity =
        techniqueStep === 4
          ? 0.22
          : techniqueStep === 2 || techniqueStep === 3
            ? 0.42
            : Math.min(0.88, layers.paddle.opacity);
      const paddleMat = new THREE.MeshStandardMaterial({
        color: pal.paddle,
        roughness: 0.45,
        metalness: 0.05,
        transparent: true,
        opacity: paddleOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        clippingPlanes: activeThreeClippingPlanes,
      });
      const paddleMesh = new THREE.Mesh(paddleGeo, paddleMat);
      paddleMesh.position.copy(center).addScaledVector(normal, 0.008);
      paddleMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      group.add(paddleMesh);
    }

    // 5a-ii. Phase 10c: Translucent bony-landmark-anchored schematic outline for muscles absent from BodyParts3D
    if (flapBp3dCoverage?.missingMuscle && layers.muscle.visible) {
      const anchorPosMap: Record<string, [number, number, number]> = {};
      for (const a of anchors) {
        anchorPosMap[a.id] = a.position;
      }
      const outlineSpec = buildSchematicMuscleOutline(
        flapBp3dCoverage.missingMuscle.id,
        donorSide,
        anchorPosMap
      );
      if (outlineSpec) {
        const bodyGeo = new THREE.SphereGeometry(0.5, 22, 16);
        bodyGeo.scale(outlineSpec.size[0], outlineSpec.size[1], outlineSpec.size[2]);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xd97706,
          emissiveIntensity: 0.25,
          roughness: 0.65,
          transparent: true,
          opacity: 0.24,
          side: THREE.DoubleSide,
          depthWrite: false,
          clippingPlanes: activeThreeClippingPlanes,
        });
        const schematicMesh = new THREE.Mesh(bodyGeo, bodyMat);
        schematicMesh.position.set(...outlineSpec.center);
        schematicMesh.rotation.set(...outlineSpec.rotation);
        schematicMesh.name = `SchematicMuscleOutline_${outlineSpec.muscleId}`;
        group.add(schematicMesh);

        const wireGeo = new THREE.EdgesGeometry(bodyGeo, 24);
        const wireMat = new THREE.LineBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.72,
          clippingPlanes: activeThreeClippingPlanes,
        });
        const wireSeg = new THREE.LineSegments(wireGeo, wireMat);
        wireSeg.position.copy(schematicMesh.position);
        wireSeg.rotation.copy(schematicMesh.rotation);
        group.add(wireSeg);

        // Subtle tethers to anchoring bony landmarks
        const centerVec = new THREE.Vector3(...outlineSpec.center);
        for (const ap of outlineSpec.anchorPoints) {
          const tetherGeo = new THREE.BufferGeometry().setFromPoints([
            centerVec,
            new THREE.Vector3(...ap),
          ]);
          const tetherMat = new THREE.LineDashedMaterial({
            color: 0xf59e0b,
            dashSize: 0.012,
            gapSize: 0.009,
            transparent: true,
            opacity: 0.65,
            clippingPlanes: activeThreeClippingPlanes,
          });
          const tether = new THREE.Line(tetherGeo, tetherMat);
          tether.computeLineDistances();
          group.add(tether);
        }
      }
    }

    // 5b. Cutting Guide Dashed Outline (Schematic design line — ALWAYS kept)
    if (layers.cuttingGuides.visible) {
      const pts: THREE.Vector3[] = [];
      const segs = 40;
      for (let i = 0; i <= segs; i++) {
        const theta = (i / segs) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(
            Math.cos(theta) * scaleX * 0.54,
            Math.sin(theta) * scaleY * 0.54,
            0
          )
        );
      }
      const guideGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const guideColor =
        techniqueStep === 1
          ? 0xfbbf24
          : techniqueStep === 7
            ? 0x10b981
            : pal.cuttingGuide;
      const guideMat = new THREE.LineDashedMaterial({
        color: guideColor,
        dashSize: 0.014,
        gapSize: 0.008,
        clippingPlanes: activeThreeClippingPlanes,
      });
      const guideLine = new THREE.Line(guideGeo, guideMat);
      guideLine.computeLineDistances();
      guideLine.position.copy(center).addScaledVector(normal, 0.012);
      guideLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      group.add(guideLine);
    }

    // 5c. Dominant Flap Pedicle Tube (Sub-Phase 9d: hide ONLY when a real "pedicle" artery mesh resolved)
    const hideProceduralPedicleTube = Boolean(resolvedFlapVessels?.hasResolvedPedicleArtery);
    if (
      !hideProceduralPedicleTube &&
      layers.arteries.visible &&
      resolvedFlapOverlay.pediclePath.length >= 2
    ) {
      const curve = new THREE.CatmullRomCurve3(
        resolvedFlapOverlay.pediclePath.map((p) => new THREE.Vector3(...mapPt(p)))
      );
      const pedRadius =
        techniqueStep === 4 ? 0.0086 : techniqueStep === 6 ? 0.0078 : 0.0064;
      const pedGeo = new THREE.TubeGeometry(curve, 24, pedRadius, 10, false);
      const pedMat = new THREE.MeshStandardMaterial({
        color: pal.arteryHighlight,
        emissive: pal.artery,
        emissiveIntensity:
          techniqueStep === 4 ? 0.65 : techniqueStep === 6 ? 0.52 : 0.25,
        roughness: 0.28,
        clippingPlanes: activeThreeClippingPlanes,
      });
      const pedMesh = new THREE.Mesh(pedGeo, pedMat);
      pedMesh.name = 'ProceduralPedicleTube';
      group.add(pedMesh);
    }

    // 5d. Minor Pedicle (if any — schematic procedural segment kept)
    if (
      layers.arteries.visible &&
      resolvedFlapOverlay.minorPediclePath &&
      resolvedFlapOverlay.minorPediclePath.length >= 2
    ) {
      const curve = new THREE.CatmullRomCurve3(
        resolvedFlapOverlay.minorPediclePath.map((p) => new THREE.Vector3(...mapPt(p)))
      );
      const minGeo = new THREE.TubeGeometry(curve, 16, 0.0038, 8, false);
      const minMat = new THREE.MeshStandardMaterial({
        color: 0xfb7185,
        roughness: 0.4,
        clippingPlanes: activeThreeClippingPlanes,
      });
      group.add(new THREE.Mesh(minGeo, minMat));
    }

    // 5e. Sensory / Motor Nerve (Schematic — kept)
    if (
      layers.nerves.visible &&
      resolvedFlapOverlay.nervePath &&
      resolvedFlapOverlay.nervePath.length >= 2
    ) {
      const curve = new THREE.CatmullRomCurve3(
        resolvedFlapOverlay.nervePath.map((p) => new THREE.Vector3(...mapPt(p)))
      );
      const nGeo = new THREE.TubeGeometry(curve, 18, 0.004, 8, false);
      const nMat = new THREE.MeshStandardMaterial({
        color: pal.nerve,
        emissive: pal.nerve,
        emissiveIntensity: 0.2,
        roughness: 0.35,
        clippingPlanes: activeThreeClippingPlanes,
      });
      group.add(new THREE.Mesh(nGeo, nMat));
    }

    // 5f. Perforator Hotspot Pins & Saint-Cyr Perforasomes + Linking Vessels (Schematic — ALWAYS kept)
    const perfPositions: THREE.Vector3[] = [];
    for (const rawPerfPos of resolvedFlapOverlay.perforatorPositions) {
      const pos = new THREE.Vector3(...mapPt(rawPerfPos));
      perfPositions.push(pos);

      if (layers.perforators.visible) {
        const pinScale = techniqueStep === 3 ? 1.55 : 1.0;
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.01 * pinScale, 14, 12),
          new THREE.MeshStandardMaterial({
            color: pal.perforator,
            emissive: pal.perforator,
            emissiveIntensity: techniqueStep === 3 ? 0.65 : 0.4,
            roughness: 0.25,
            clippingPlanes: activeThreeClippingPlanes,
          })
        );
        head.position.copy(pos).addScaledVector(normal, 0.015);
        group.add(head);

        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.016, 0.022, 24),
          new THREE.MeshBasicMaterial({
            color: pal.perforator,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
            clippingPlanes: activeThreeClippingPlanes,
          })
        );
        halo.position.copy(pos).addScaledVector(normal, 0.013);
        halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        group.add(halo);
      }

      if (layers.perforasomes.visible) {
        const zoneRadius = Math.max(0.036, Math.min(0.068, Math.min(lenM, widM) * 0.45));
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(zoneRadius, 28),
          new THREE.MeshBasicMaterial({
            color: pal.perforasome,
            transparent: true,
            opacity: layers.perforasomes.opacity * 0.36,
            side: THREE.DoubleSide,
            depthWrite: false,
            clippingPlanes: activeThreeClippingPlanes,
          })
        );
        disc.position.copy(pos).addScaledVector(normal, 0.0105);
        disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        group.add(disc);

        const border = new THREE.Mesh(
          new THREE.RingGeometry(zoneRadius - 0.0022, zoneRadius, 28),
          new THREE.MeshBasicMaterial({
            color: pal.perforasome,
            transparent: true,
            opacity: Math.min(0.85, layers.perforasomes.opacity * 1.15),
            side: THREE.DoubleSide,
            depthWrite: false,
            clippingPlanes: activeThreeClippingPlanes,
          })
        );
        border.position.copy(pos).addScaledVector(normal, 0.0115);
        border.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        group.add(border);
      }
    }

    // Linking / choke vessels between adjacent perforators
    if (layers.perforasomes.visible && perfPositions.length >= 2) {
      for (let i = 0; i < perfPositions.length - 1; i++) {
        const a = perfPositions[i].clone().addScaledVector(normal, 0.013);
        const b = perfPositions[i + 1].clone().addScaledVector(normal, 0.013);
        const mid = a.clone().lerp(b, 0.5).addScaledVector(normal, 0.012);
        const linkCurve = new THREE.CatmullRomCurve3([a, mid, b]);
        const linkGeo = new THREE.TubeGeometry(linkCurve, 14, 0.0022, 6, false);
        const linkMat = new THREE.MeshBasicMaterial({
          color: pal.perforasome,
          transparent: true,
          opacity: Math.min(0.9, layers.perforasomes.opacity * 1.3),
          clippingPlanes: activeThreeClippingPlanes,
        });
        group.add(new THREE.Mesh(linkGeo, linkMat));
      }
    }

    // 5g. Arc of Rotation / Free Transfer Visualization
    const pivot = new THREE.Vector3(...resolvedFlapOverlay.pivotPoint);
    arcPivotRef.current = pivot;
    arcRadiusRef.current = Math.max(0.08, spec.arcRadius);

    if (animationMode === 'arc') {
      const arcGeo = new THREE.CircleGeometry(spec.arcRadius, 36, -Math.PI * 0.45, Math.PI * 0.9);
      const arcMat = new THREE.MeshBasicMaterial({
        color: pal.arc,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const arcDisc = new THREE.Mesh(arcGeo, arcMat);
      arcDisc.position.copy(pivot).addScaledVector(normal, 0.02);
      arcDisc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      group.add(arcDisc);

      const pivotPin = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 12, 10),
        new THREE.MeshBasicMaterial({ color: pal.arc })
      );
      pivotPin.position.copy(pivot);
      group.add(pivotPin);

      const ghost = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(widM, lenM) * 0.42, 24),
        new THREE.MeshBasicMaterial({
          color: pal.paddle,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        })
      );
      ghost.position.copy(center);
      ghost.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      group.add(ghost);
      animGhostRef.current = ghost;
    }

    if (animationMode === 'transfer') {
      const defectTarget = advisorPreviewDefectId
        ? DEFECT_LOCATIONS.find((d) => d.id === advisorPreviewDefectId)
        : null;
      const dest = defectTarget
        ? new THREE.Vector3(...defectTarget.position3d)
        : new THREE.Vector3(...spec.typicalRecipientPoint);
      const mid = center.clone().lerp(dest, 0.5);
      mid.z += 0.22;
      mid.y += 0.08;
      const curve = new THREE.CatmullRomCurve3([center.clone(), mid, dest.clone()]);
      animPathRef.current = curve;

      const trajGeo = new THREE.TubeGeometry(curve, 32, 0.0035, 8, false);
      const trajMat = new THREE.MeshBasicMaterial({
        color: pal.arc,
        transparent: true,
        opacity: 0.72,
      });
      group.add(new THREE.Mesh(trajGeo, trajMat));

      const destPin = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 14, 12),
        new THREE.MeshBasicMaterial({ color: pal.defect })
      );
      destPin.position.copy(dest);
      group.add(destPin);

      const ghost = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 14, 12),
        new THREE.MeshStandardMaterial({
          color: pal.paddle,
          emissive: pal.paddle,
          emissiveIntensity: 0.35,
          transparent: true,
          opacity: 0.85,
        })
      );
      ghost.position.copy(center);
      group.add(ghost);
      animGhostRef.current = ghost;
    }

    // 5h. Virtual Advisor Defect Target & Virtual Flap Placement Preview
    if (advisorPreviewDefectId) {
      const defLoc = DEFECT_LOCATIONS.find((d) => d.id === advisorPreviewDefectId);
      if (defLoc) {
        const dPos = new THREE.Vector3(...defLoc.position3d);
        const isPosteriorDefect = defLoc.position3d[2] < -0.05;
        const defNormal = new THREE.Vector3(0, 0, isPosteriorDefect ? -1 : 1);

        // Scaled defect size in meters (clamped to realistic anatomical proportions)
        const defLenM = advisorDefectSizeCm
          ? Math.max(0.032, Math.min(0.22, advisorDefectSizeCm[0] / 100))
          : 0.075;
        const defWidM = advisorDefectSizeCm
          ? Math.max(0.026, Math.min(0.16, advisorDefectSizeCm[1] / 100))
          : 0.055;

        // 1) Crimson defect wound-bed ellipse
        const defectBedGeo = new THREE.CircleGeometry(0.5, 32);
        defectBedGeo.scale(defWidM, defLenM, 1);
        const defectBed = new THREE.Mesh(
          defectBedGeo,
          new THREE.MeshBasicMaterial({
            color: pal.defect,
            transparent: true,
            opacity: 0.58,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        defectBed.position.copy(dPos).addScaledVector(defNormal, 0.008);
        defectBed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), defNormal);
        group.add(defectBed);

        // 2) Virtual inset flap contour placed over the defect when transfer/arc active
        if (animationMode === 'transfer' || animationMode === 'arc') {
          const insetGeo = new THREE.CircleGeometry(0.5, 32);
          insetGeo.scale(defWidM * 1.18, defLenM * 1.18, 1);
          const insetPatch = new THREE.Mesh(
            insetGeo,
            new THREE.MeshStandardMaterial({
              color: pal.paddle,
              emissive: pal.paddle,
              emissiveIntensity: 0.25,
              transparent: true,
              opacity: 0.42,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          );
          insetPatch.position.copy(dPos).addScaledVector(defNormal, 0.014);
          insetPatch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), defNormal);
          group.add(insetPatch);

          // Dashed surgical inset margin outline
          const marginPts: THREE.Vector3[] = [];
          for (let i = 0; i <= 36; i++) {
            const theta = (i / 36) * Math.PI * 2;
            marginPts.push(
              new THREE.Vector3(
                Math.cos(theta) * defWidM * 0.62,
                Math.sin(theta) * defLenM * 0.62,
                0
              )
            );
          }
          const marginLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(marginPts),
            new THREE.LineDashedMaterial({
              color: 0xfbbf24,
              dashSize: 0.01,
              gapSize: 0.006,
            })
          );
          marginLine.computeLineDistances();
          marginLine.position.copy(dPos).addScaledVector(defNormal, 0.017);
          marginLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), defNormal);
          group.add(marginLine);
        }

        // 3) Center target beacon pin
        const defPin = new THREE.Mesh(
          new THREE.SphereGeometry(0.015, 16, 12),
          new THREE.MeshStandardMaterial({
            color: pal.defect,
            emissive: pal.defect,
            emissiveIntensity: 0.45,
          })
        );
        defPin.position.copy(dPos).addScaledVector(defNormal, 0.012);
        group.add(defPin);
      }
    }

    requestRenderRef.current();
  }, [
    selectedFlap,
    resolvedFlapOverlay,
    flapBp3dCoverage,
    anchors,
    activeModelStats?.loadedSystems,
    layers.paddle,
    layers.muscle.visible,
    layers.cuttingGuides,
    layers.arteries,
    layers.nerves,
    layers.perforators,
    layers.perforasomes,
    animationMode,
    techniqueStep,
    advisorPreviewDefectId,
    advisorDefectSizeCm,
    activeThreeClippingPlanes,
    colorblindMode,
    donorSide,
    resolvedFlapVessels?.hasResolvedPedicleArtery,
  ]);

  // =========================================================================
  // 6. Camera Preset & Structure Fly-To Transitions
  // =========================================================================
  useEffect(() => {
    const preset = REGIONS.find((r) => r.id === activeCameraPreset);
    if (!preset) return;
    cameraGoalRef.current = {
      pos: new THREE.Vector3(...preset.cameraPosition),
      target: new THREE.Vector3(...preset.cameraTarget),
    };
    requestRenderRef.current();
  }, [activeCameraPreset, cameraRequestNonce]);

  useEffect(() => {
    if (!cameraFocusRequest) return;
    cameraGoalRef.current = {
      pos: new THREE.Vector3(...cameraFocusRequest.pos),
      target: new THREE.Vector3(...cameraFocusRequest.target),
    };
    requestRenderRef.current();
  }, [cameraFocusRequest]);

  // =========================================================================
  // 6b. Phase 9d: Flap-to-BodyParts3D Vessel Linking, Highlighting & Union Focus
  // =========================================================================
  useEffect(() => {
    const highlightRoot = flapVesselHighlightGroupRef.current;
    if (highlightRoot) {
      disposeSelectionHighlightGroup(highlightRoot);
    }
    flapPediclePulseHandlesRef.current = [];

    if (!selectedFlap) {
      setResolvedFlapVessels(null);
      lastFlapVesselCameraKeyRef.current = '';
      requestRenderRef.current();
      return;
    }

    const ext = externalGlbRef.current;
    const effAlign = getEffectiveAlignmentForBody(ext, vesselAlignment);
    if (ext) {
      applyVesselAlignmentToGroup(
        ext.bp3dAlignmentGroup,
        effAlign,
        ext.bp3dAlignmentPivot,
        ext.orientationRotatedY
      );
      ext.root.updateMatrixWorld(true);
    }

    const resolved = resolveFlapRealVessels(
      selectedFlap,
      donorSide,
      ext ? ext.allSubMeshes : [],
      ext
        ? {
            vesselAlignment: effAlign,
            alignmentPivot: ext.bp3dAlignmentPivot,
            orientationRotatedY: ext.orientationRotatedY,
          }
        : undefined
    );
    setResolvedFlapVessels(resolved);

    if (
      ext &&
      highlightRoot &&
      !calibrationViewActive &&
      resolved.resolvedVessels.length > 0
    ) {
      const pulseHandles: FlapVesselPulseHandle[] = [];
      for (const vessel of resolved.resolvedVessels) {
        const match = findMergedMeshForSubMesh(ext, vessel.meshKey);
        if (!match) continue;
        const extracted = extractSubMeshGeometry(match.mesh, match.record);
        if (!extracted) continue;

        const style = getFlapVesselRoleStyle(vessel.role, colorblindMode);
        const { group: vesselGroup, pulseHandle } = createFlapVesselHighlightGroup(
          extracted,
          style,
          vessel.role,
          activeThreeClippingPlanes
        );
        highlightRoot.add(vesselGroup);
        if (pulseHandle) {
          pulseHandles.push(pulseHandle);
        }
      }
      flapPediclePulseHandlesRef.current = pulseHandles;
      highlightRoot.visible = !selectedAnatomyInfo && (!immersive || hasSelectedFlap);

      // Fly camera cleanly to the union bounding box on flap selection, donor-side toggle, or BP3D load
      // (Never override initial full-body launch view before a flap is selected, or individual structure focus)
      const focusKey = `${selectedFlap.id}:${donorSide}:${resolved.resolvedVessels
        .map((v) => v.fjCode)
        .join(',')}`;
      if (
        (!immersive || hasSelectedFlap) &&
        !selectedAnatomyInfo &&
        resolved.unionBounds &&
        lastFlapVesselCameraKeyRef.current !== focusKey
      ) {
        lastFlapVesselCameraKeyRef.current = focusKey;
        const goal = computeFlapVesselUnionCamera(resolved.unionBounds, donorSide);
        cameraGoalRef.current = {
          pos: new THREE.Vector3(...goal.pos),
          target: new THREE.Vector3(...goal.target),
        };
      }
    } else {
      lastFlapVesselCameraKeyRef.current = '';
    }

    requestRenderRef.current();
  }, [
    selectedFlap,
    donorSide,
    activeModelStats,
    vesselAlignment,
    calibrationViewActive,
    activeThreeClippingPlanes,
    colorblindMode,
    selectedAnatomyInfo,
    setResolvedFlapVessels,
    immersive,
    hasSelectedFlap,
  ]);

  // Honor pending 3D structure focus requests (e.g., from Editor Mode Unmapped Meshes Report)
  useEffect(() => {
    if (!pendingStructureFocusMeshName || searchableStructures.length === 0) return;
    const targetLower = pendingStructureFocusMeshName.trim().toLowerCase();
    const match =
      searchableStructures.find((s) => s.meshName.toLowerCase() === targetLower) ||
      searchableStructures.find((s) => s.meshName.toLowerCase().includes(targetLower));
    clearPendingStructureFocus();
    if (match) {
      handleSelectSearchStructure(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStructureFocusMeshName, searchableStructures]);

  useEffect(() => {
    if (!measureMode && measureGroupRef.current) {
      measurePointsRef.current = [];
      disposeGroupChildren(measureGroupRef.current);
      setMeasureCm(null);
      requestRenderRef.current();
    }
  }, [measureMode]);

  const handleScreenshot = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    requestRenderRef.current();
    const url = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlapAtlas3D_${selectedFlap?.id || 'anatomy'}.png`;
    a.click();
  };

  const handleCopyCitation = () => {
    if (!selectedFlap) return;
    const ref = selectedFlap.references[0];
    const cite = ref
      ? `${selectedFlap.name} — ${ref.book} (${ref.edition}), ${ref.chapter_or_section}.`
      : `${selectedFlap.name} — FlapAtlas 3D Clinical Reference.`;
    navigator.clipboard?.writeText(cite).catch(() => {});
    setToastMsg('Citation copied to clipboard');
    setContextMenu(null);
  };

  // Donor vs Recipient PiP geometry
  const pipData = useMemo(() => {
    if (!selectedFlap) return null;
    const defectTarget = advisorPreviewDefectId
      ? DEFECT_LOCATIONS.find((d) => d.id === advisorPreviewDefectId)
      : null;
    const donorSvg = worldToPipSvg(selectedFlap.spec3d.paddleCenter);
    const recipWorld = defectTarget
      ? defectTarget.position3d
      : selectedFlap.spec3d.typicalRecipientPoint;
    const recipSvg = worldToPipSvg(recipWorld);
    const ctrlX = (donorSvg.x + recipSvg.x) / 2 + (donorSvg.x >= 60 ? 18 : -18);
    const ctrlY = Math.min(donorSvg.y, recipSvg.y) - 16;

    return {
      donorSvg,
      recipSvg,
      pathD: `M ${donorSvg.x.toFixed(1)} ${donorSvg.y.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${recipSvg.x.toFixed(1)} ${recipSvg.y.toFixed(1)}`,
      recipientLabel:
        defectTarget?.label ||
        selectedFlap.indications[0] ||
        'Target Reconstructive Site',
      recipientVessel:
        selectedFlap.recipient_vessels_options[0] ||
        'Regional recipient vessels',
    };
  }, [selectedFlap, advisorPreviewDefectId]);

  const isCompared = selectedFlap ? compareIds.includes(selectedFlap.id) : false;
  const isFav = selectedFlap ? favoriteIds.includes(selectedFlap.id) : false;

  // Keep active flap overlay hidden on clean full-body launch until user selects a flap
  useEffect(() => {
    if (activeFlapGroupRef.current) {
      activeFlapGroupRef.current.visible =
        !calibrationViewActive && territoryMode === 'off' && (!immersive || hasSelectedFlap);
      requestRenderRef.current();
    }
  }, [immersive, hasSelectedFlap, calibrationViewActive, territoryMode]);

  const handleOpenContextDetails = () => {
    if (!viewerContextMenu) return;
    if (viewerContextMenu.anatomyInfo) {
      const info = viewerContextMenu.anatomyInfo;
      const isKnownVessel = VESSELS.some((v) => v.id === info.id);
      if (isKnownVessel) {
        selectVessel(info.id, false);
      }
      setSelectedAnatomyInfo(info);
      setActiveTab('anatomy');
      setSheetSnap('half');
    } else if (viewerContextMenu.territoryId) {
      focusTerritory(
        viewerContextMenu.territoryId,
        viewerContextMenu.territorySide || 'both',
        false
      );
      setLayersSubTab('territories');
      setActiveTab('layers');
      setSheetSnap('half');
    } else if (viewerContextMenu.flapId) {
      selectFlap(viewerContextMenu.flapId, false);
      setFlapsSheetMode('detail');
      setActiveTab('library');
      setSheetSnap('half');
    } else {
      setActiveTab('anatomy');
      setSheetSnap('half');
    }
    setViewerContextMenu(null);
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none touch-none overscroll-none bg-[var(--bg-canvas)]"
      data-testid="viewer-3d-container"
    >
      {/* Dedicated WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full h-full touch-none" />

      {/* Floating 3D-to-2D Projected Anatomical Callout Labels (Hidden in Teaching / Spotter Blind / Structure Isolation / Calibration / Territory Mode / Pre-Selection Launch) */}
      {show3DLabels &&
        territoryMode === 'off' &&
        !teachingMode &&
        !compact &&
        !spotterBlindMode &&
        !selectedAnatomyInfo &&
        !calibrationViewActive &&
        (!immersive || hasSelectedFlap) && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden z-[5]"
          data-testid="projected-3d-labels"
        >
          {calloutAnchors.map((a) => (
            <div
              key={a.key}
              ref={(el) => {
                labelElRefs.current[a.key] = el;
              }}
              style={{ opacity: 0, willChange: 'transform' }}
              className={`absolute top-0 left-0 px-1.5 py-0.5 rounded border shadow-xs text-[10px] leading-tight whitespace-nowrap max-w-[260px] truncate ${
                a.kind === 'perforator'
                  ? 'bg-[var(--bg-surface)] border-amber-500 text-[var(--text-primary)]'
                  : a.kind === 'pedicle'
                    ? 'bg-[var(--bg-surface)] border-rose-500 text-[var(--text-primary)]'
                    : 'bg-[var(--bg-surface)] border-yellow-500 text-[var(--text-primary)]'
              }`}
              data-testid={`callout-${a.key}`}
            >
              <span className="font-semibold font-mono">{a.title}</span>
              <span className="text-[var(--text-muted)] ml-1">{a.subtitle}</span>
            </div>
          ))}
        </div>
      )}

      {/* Phase 11c: Single On-Demand Territory Hover Label (max 1, no permanent clutter) */}
      {territoryMode !== 'off' && territoryHoverLabel && !compact && (
        <div
          style={{ left: territoryHoverLabel.x, top: territoryHoverLabel.y }}
          className="absolute z-25 pointer-events-none px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--accent-primary)] shadow-md text-[11px] leading-tight whitespace-nowrap"
          data-testid="territory-hover-label"
        >
          <span className="font-semibold text-[var(--text-primary)]">
            {territoryHoverLabel.label}
          </span>
          <span className="text-[var(--text-muted)] ml-1.5">
            {territoryHoverLabel.side !== 'midline' ? territoryHoverLabel.side : 'midline'}
            {territoryHoverLabel.isSchematic ? ' · Schematic' : ''}
          </span>
        </div>
      )}

      {/* Phase 11c: Long-Press Pinned Territory Label (optional, max 1) */}
      {territoryMode !== 'off' && pinnedTerritoryLabel && !compact && (() => {
        const slot = TERRITORY_SLOT_BY_ID.get(pinnedTerritoryLabel.territoryId);
        if (!slot) return null;
        return (
          <div
            className="absolute top-16 right-3 z-20 pointer-events-auto flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--accent-primary)] shadow-md text-xs"
            data-testid="territory-pinned-label"
          >
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{
                backgroundColor: colorblindMode ? slot.hexColorblind : slot.hexStandard,
              }}
              aria-hidden="true"
            />
            <span className="font-medium text-[var(--text-primary)]">{slot.label}</span>
            <span className="text-[10px] text-[var(--text-muted)] capitalize">
              {pinnedTerritoryLabel.side}
            </span>
            <button
              type="button"
              onClick={() => setPinnedTerritoryLabel(null)}
              aria-label="Unpin territory label"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })()}

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-[var(--bg-surface)] text-center z-30">
          <div className="max-w-sm space-y-2">
            <p className="font-semibold text-[var(--text-primary)]">3D Viewport Unavailable</p>
            <p className="text-sm text-[var(--text-secondary)]">{webglError}</p>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* IMMERSIVE 3D-FIRST FLOATING CONTROLS (Prompt 12-1)                    */}
      {/* Only small floating controls overlay the canvas:                      */}
      {/* menu, search, layers, reset-view, and Left/Right donor toggle         */}
      {/* (when a flap is selected). Zero permanent side cards or headers.      */}
      {/* ===================================================================== */}
      {immersive && (
        <>
          {/* Top-left floating Menu + Search */}
          <div
            className="no-print absolute z-20 flex items-center gap-2 pointer-events-none"
            style={{
              top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
              left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
            }}
          >
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              data-testid="floating-menu-btn"
              aria-label="Open navigation menu"
              title="Menu"
              className="pointer-events-auto min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] shadow-md flex items-center justify-center transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setSearchPaletteOpen(true)}
              data-testid="floating-search-btn"
              aria-label="Search flaps and anatomy"
              title="Search (⌘K)"
              className="pointer-events-auto min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] shadow-md flex items-center justify-center transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          {/* Top-center floating Left / Right donor toggle (ONLY when a flap is selected) */}
          {hasSelectedFlap && selectedFlap && (
            <div
              className="no-print absolute left-1/2 -translate-x-1/2 z-20 pointer-events-auto inline-flex items-center rounded-xl bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] p-0.5 shadow-md"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
              role="group"
              aria-label="Donor side toggle"
              data-testid="floating-donor-side-toggle"
            >
              <button
                type="button"
                onClick={() => setDonorSide('left')}
                data-testid="floating-donor-left"
                aria-pressed={donorSide === 'left'}
                className={`min-h-[44px] min-w-[48px] px-3 rounded-lg text-sm font-semibold transition-colors ${
                  donorSide === 'left'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Left
              </button>
              <button
                type="button"
                onClick={() => setDonorSide('right')}
                data-testid="floating-donor-right"
                aria-pressed={donorSide === 'right'}
                className={`min-h-[44px] min-w-[48px] px-3 rounded-lg text-sm font-semibold transition-colors ${
                  donorSide === 'right'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Right
              </button>
            </div>
          )}

          {/* Top-right floating Layers + Reset View */}
          <div
            className="no-print absolute z-20 flex items-center gap-2 pointer-events-none"
            style={{
              top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
              right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'layers' && sheetSnap !== 'collapsed') {
                  setSheetSnap('collapsed');
                } else {
                  setActiveTab('layers');
                  setSheetSnap('half');
                }
              }}
              data-testid="floating-layers-btn"
              aria-label="Toggle anatomical layers"
              title="Layers"
              className={`pointer-events-auto min-w-[44px] min-h-[44px] rounded-xl border shadow-md flex items-center justify-center transition-colors ${
                activeTab === 'layers' && sheetSnap !== 'collapsed'
                  ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface)]/95 border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
              }`}
            >
              <Layers className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => reset3DView()}
              data-testid="floating-reset-btn"
              aria-label="Reset 3D view"
              title="Reset view"
              className="pointer-events-auto min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] shadow-md flex items-center justify-center transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {/* Minimal loading indicator (no mesh source URLs, file names, or mesh counts) */}
          {(glbStatus.loading || modelLoadProgress.active) && (
            <div
              className="no-print absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3.5 py-2 rounded-xl bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] shadow-md min-w-[200px] space-y-1.5"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 66px)' }}
              data-testid="model-loading-progress"
              role="status"
            >
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-[var(--text-primary)]">
                <span>Loading 3D anatomy…</span>
                <span className="font-mono tabular-nums text-[var(--accent-primary)]">
                  {modelLoadProgress.pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-primary)] transition-all duration-200"
                  style={{ width: `${Math.max(8, modelLoadProgress.pct)}%` }}
                />
              </div>
            </div>
          )}

          {/* Active interactive tool banners (only shown while explicitly active) */}
          {territoryMode === 'perforators' && plannerDropMode && (
            <div
              data-testid="planner-drop-banner"
              className="no-print absolute left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-emerald-600 text-white border border-emerald-500 rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-3 max-w-[92vw]"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 66px)' }}
            >
              <span className="text-sm font-medium leading-tight">
                Tap skin to place Doppler / CTA marker
              </span>
              <button
                type="button"
                onClick={() => setPlannerDropMode(false)}
                data-testid="planner-drop-cancel-btn"
                className="min-h-[36px] px-3 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium shrink-0"
              >
                Cancel
              </button>
            </div>
          )}

          {measureMode && (
            <div
              className="no-print absolute left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-[var(--bg-surface)]/95 border border-[var(--accent-primary)] rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-3"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 66px)' }}
              data-testid="immersive-measure-banner"
            >
              <Ruler className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <span className="text-sm font-medium text-[var(--text-primary)] font-mono tabular-nums">
                {measureCm !== null
                  ? unitSystem === 'imperial'
                    ? `${(measureCm * 0.3937).toFixed(2)} in (${measureCm} cm)`
                    : `${measureCm} cm`
                  : 'Tap 2 points to measure'}
              </span>
              <button
                type="button"
                onClick={() => setMeasureMode(false)}
                aria-label="Close surface ruler"
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeCalibratingAnchor && (
            <div
              className="no-print absolute left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-[var(--bg-surface)]/95 border-2 border-amber-500 rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-2.5 max-w-[92vw]"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 66px)' }}
              data-testid="viewer-calibration-banner"
            >
              <Target className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Tap skeleton to set {activeCalibratingAnchor.shortLabel}
              </span>
              <button
                type="button"
                onClick={() => setCalibratingAnchorId(null)}
                className="min-h-[36px] px-2.5 rounded-lg bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-secondary)]"
              >
                Cancel
              </button>
            </div>
          )}

          {toastMsg && !activeCalibratingAnchor && !plannerDropMode && (
            <div
              className="no-print absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-[var(--bg-surface)]/95 border border-[var(--accent-primary)] text-[var(--accent-primary)] px-3.5 py-1.5 rounded-xl shadow-md text-sm font-medium max-w-[90vw] truncate"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 66px)' }}
            >
              {toastMsg}
            </div>
          )}

          {/* Floating "Hidden (n)" chip on the canvas (Prompt 12-2 Requirement D) */}
          {visibilityState.hiddenItems.length > 0 && (
            <div
              className="no-print absolute z-20 pointer-events-auto"
              style={{
                top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
                left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
              }}
              data-testid="floating-hidden-chip-container"
            >
              <button
                type="button"
                onClick={() => setHiddenPopoverOpen((v) => !v)}
                data-testid="floating-hidden-chip"
                aria-expanded={hiddenPopoverOpen}
                className="min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-surface)]/95 border border-[var(--accent-primary)]/50 text-sm font-semibold text-[var(--text-primary)] shadow-md inline-flex items-center gap-2 hover:border-[var(--accent-primary)] transition-colors"
              >
                <EyeOff className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span>Hidden ({visibilityState.hiddenItems.length})</span>
              </button>

              {hiddenPopoverOpen && (
                <div
                  data-testid="floating-hidden-popover"
                  className="mt-2 w-[min(290px,calc(100vw-24px))] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--border-subtle)]">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Hidden structures ({visibilityState.hiddenItems.length})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={undoVisibility}
                        disabled={visibilityUndoStack.length === 0}
                        aria-label="Undo visibility action"
                        className="min-w-[36px] min-h-[36px] rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] disabled:opacity-40"
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={redoVisibility}
                        disabled={visibilityRedoStack.length === 0}
                        aria-label="Redo visibility action"
                        className="min-w-[36px] min-h-[36px] rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] disabled:opacity-40"
                      >
                        <Redo2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setHiddenPopoverOpen(false)}
                        aria-label="Close hidden items list"
                        className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {visibilityState.hiddenItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs"
                      >
                        <span className="text-[var(--text-primary)] font-medium truncate">
                          {item.label}
                          {item.side !== 'midline'
                            ? ` (${item.side === 'left' ? 'L' : 'R'})`
                            : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreHiddenItem(item.id)}
                          data-testid={`hidden-popover-restore-${item.id}`}
                          className="min-h-[36px] px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent-primary)] font-semibold shrink-0"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      restoreAllVisibility();
                      setHiddenPopoverOpen(false);
                    }}
                    data-testid="hidden-popover-restore-all"
                    className="w-full min-h-[44px] rounded-lg bg-[var(--accent-primary)] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Restore all</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Long-press / Right-click Context Menu (Prompt 12-2: Details, Hide, Hide part, Isolate, Ghost others, Restore) */}
          {viewerContextMenu && (() => {
            const hasMeshTarget =
              Boolean(viewerContextMenu.meshKeys && viewerContextMenu.meshKeys.length > 0) &&
              viewerContextMenu.system !== 'skin';
            const hasAnyVisOverride =
              visibilityState.hiddenItems.length > 0 ||
              visibilityState.isolatedMeshKeys.length > 0 ||
              visibilityState.ghostOthersKeys.length > 0;
            const ctxGroupId = viewerContextMenu.anatomyInfo?.groupId
              ? `${viewerContextMenu.anatomyInfo.groupId}:${viewerContextMenu.laterality || 'midline'}`
              : viewerContextMenu.meshKeys?.[0] || viewerContextMenu.label;

            return (
              <div
                style={{ left: viewerContextMenu.x, top: viewerContextMenu.y }}
                className="no-print absolute z-30 min-w-[188px] max-w-[250px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-1.5 space-y-0.5"
                data-testid="viewer-context-menu"
                role="menu"
                aria-label="Structure actions"
              >
                <div className="px-2.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] border-b border-[var(--border-subtle)] truncate">
                  {viewerContextMenu.label}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleOpenContextDetails}
                  data-testid="context-menu-details-btn"
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] flex items-center gap-2.5 transition-colors"
                >
                  <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span>Details</span>
                </button>

                {hasMeshTarget && viewerContextMenu.meshKeys && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        hideSubMeshes({
                          id: ctxGroupId,
                          label: viewerContextMenu.label,
                          side: viewerContextMenu.laterality || 'midline',
                          system: viewerContextMenu.system || 'other',
                          meshKeys: viewerContextMenu.meshKeys!,
                          partOnly: false,
                        })
                      }
                      data-testid="context-menu-hide-btn"
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] flex items-center gap-2.5 transition-colors"
                    >
                      <EyeOff className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                      <span>Hide</span>
                    </button>

                    {viewerContextMenu.isMultiPart && viewerContextMenu.partMeshKey && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          hideSubMeshes({
                            id: viewerContextMenu.partMeshKey!,
                            label: viewerContextMenu.partLabel || viewerContextMenu.label,
                            side: viewerContextMenu.laterality || 'midline',
                            system: viewerContextMenu.system || 'other',
                            meshKeys: [viewerContextMenu.partMeshKey!],
                            partOnly: true,
                          })
                        }
                        data-testid="context-menu-hide-part-btn"
                        className="w-full min-h-[44px] px-3 py-2 rounded-lg text-left text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] flex items-center gap-2.5 transition-colors"
                      >
                        <EyeOff className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                        <span>Hide this part only</span>
                      </button>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        isolateSubMeshes(
                          viewerContextMenu.meshKeys!,
                          viewerContextMenu.label,
                          visibilityState.isolateKeepSkeleton
                        )
                      }
                      data-testid="context-menu-isolate-btn"
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] flex items-center gap-2.5 transition-colors"
                    >
                      <Crosshair className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                      <span>Isolate</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        ghostOthersForSubMeshes(
                          viewerContextMenu.meshKeys!,
                          viewerContextMenu.label
                        )
                      }
                      data-testid="context-menu-ghost-btn"
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] flex items-center gap-2.5 transition-colors"
                    >
                      <Ghost className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                      <span>Ghost others</span>
                    </button>
                  </>
                )}

                {hasAnyVisOverride && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={restoreAllVisibility}
                    data-testid="context-menu-restore-all-btn"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg text-left text-sm font-medium text-[var(--accent-primary)] hover:bg-[var(--bg-subtle)] flex items-center gap-2.5 border-t border-[var(--border-subtle)] mt-1 pt-2 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>Restore all</span>
                  </button>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Legacy Non-Immersive Workspace Overlays (Compare / Quiz / Advisor / Calibration) */}
      {!immersive && (
        <>
      {/* Top-left Structure Search + Active Flap + Rich Anatomy Detail Card */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 pointer-events-none w-[225px] sm:w-[258px]">
        {/* Phase 8b: 3D Viewer Structure Search Box (fly camera to any structure) */}
        {!compact && !spotterBlindMode && (
          <div
            ref={structureSearchContainerRef}
            className="pointer-events-auto relative"
          >
            <div className="flex items-center h-8 px-2.5 gap-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--accent-primary)] shadow-sm">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <input
                type="text"
                value={structureSearchQuery}
                onFocus={() => setStructureSearchOpen(true)}
                onChange={(e) => {
                  setStructureSearchQuery(e.target.value);
                  setStructureSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && structureSearchResults.length > 0) {
                    e.preventDefault();
                    handleSelectSearchStructure(structureSearchResults[0]);
                  } else if (e.key === 'Escape') {
                    setStructureSearchOpen(false);
                  }
                }}
                placeholder={
                  searchableStructures.length > 0
                    ? `Search ${searchableStructures.length.toLocaleString()} structures…`
                    : 'Search 3D structures…'
                }
                aria-label="Search 3D anatomical structures"
                data-testid="viewer-structure-search-input"
                className="w-full min-w-0 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              {structureSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setStructureSearchQuery('');
                    setStructureSearchOpen(false);
                  }}
                  aria-label="Clear structure search"
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {structureSearchOpen && structureSearchQuery.trim().length > 0 && (
              <div
                className="absolute top-9 left-0 right-0 z-40 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-[var(--border-subtle)]"
                data-testid="viewer-structure-search-results"
              >
                {structureSearchResults.length === 0 ? (
                  <div className="px-3 py-2.5 text-[11px] text-[var(--text-muted)]">
                    No matching 3D structures for &ldquo;{structureSearchQuery}&rdquo;
                  </div>
                ) : (
                  structureSearchResults.map((item) => {
                    const lat = formatLateralityBadge(item.laterality);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleSelectSearchStructure(item)}
                        data-testid="structure-search-result-item"
                        className="w-full px-2.5 py-2 text-left hover:bg-[var(--bg-subtle)] transition-colors flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                            {item.label}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                            {item.sourceModel === 'bodyparts3d'
                              ? [item.fjCode, item.fmaCode, 'BodyParts3D']
                                  .filter(Boolean)
                                  .join(' · ')
                              : item.meshName}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${lat.style}`}
                          >
                            {lat.short}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] capitalize">
                            {item.system}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {spotterBlindMode && (
          <div
            className="bg-[var(--bg-surface)] border border-[var(--accent-primary)] rounded-lg px-2.5 py-1.5 shadow-sm"
            data-testid="spotter-blind-badge"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
              3D Spotter Self-Test
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] leading-tight mt-0.5">
              Labels &amp; identity hidden · Orbit freely
            </div>
          </div>
        )}

        {territoryMode === 'perforators' && plannerDropMode && !compact && (
          <div
            data-testid="planner-drop-banner"
            className="bg-emerald-600 text-white border border-emerald-500 rounded-lg px-3 py-2 shadow-md flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold leading-tight">
                Tap body skin to place Doppler / CTA marker
              </div>
              <div className="text-[10px] text-emerald-100 leading-tight mt-0.5">
                Stored locally only (IndexedDB) · No PHI · Pure user input
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPlannerDropMode(false);
                setTerritorySheetOpen(true);
              }}
              data-testid="planner-drop-cancel-btn"
              className="min-h-[32px] px-2.5 rounded-md bg-white/15 hover:bg-white/25 text-xs font-medium whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Phase 11c: Territory Detail Card when inspecting a focused angiosome */}
        {!compact && !spotterBlindMode && territoryMode !== 'off' && focusedTerritoryId && (
          <TerritoryDetailCard
            field={territoryFieldDataRef.current}
            onShowSourceArtery={handleShowSourceArtery}
            onFocusTerritoryRegion={handleFocusTerritoryRegion}
          />
        )}

        {/* Phase 11d: Schematic Muscle Detail Card for muscles absent from BodyParts3D 4.0 */}
        {!compact &&
          !spotterBlindMode &&
          territoryMode !== 'off' &&
          !focusedTerritoryId &&
          selectedSchematicMuscleId && (
            <SchematicMuscleDetailCard
              onFrameSchematicMuscle={handleFrameSchematicMuscle}
            />
          )}

        {!compact &&
          !spotterBlindMode &&
          selectedFlap &&
          !anatomyCard &&
          territoryMode === 'off' && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Active 3D Model
              </span>
              <div
                className="pointer-events-auto inline-flex items-center rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-0.5 text-[9px] font-semibold"
                role="group"
                aria-label="Donor side"
                data-testid="viewer-donor-side-switch"
              >
                <button
                  type="button"
                  onClick={() => setDonorSide('right')}
                  data-testid="viewer-donor-side-right"
                  aria-pressed={donorSide === 'right'}
                  className={`px-1.5 py-0.5 rounded-xs transition-colors ${
                    donorSide === 'right'
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Right
                </button>
                <button
                  type="button"
                  onClick={() => setDonorSide('left')}
                  data-testid="viewer-donor-side-left"
                  aria-pressed={donorSide === 'left'}
                  className={`px-1.5 py-0.5 rounded-xs transition-colors ${
                    donorSide === 'left'
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Left
                </button>
              </div>
            </div>
            <div className="text-xs font-semibold text-[var(--text-primary)] truncate mt-0.5">
              {selectedFlap.name}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] truncate">
              {selectedFlap.vascular_anatomy.dominant_pedicle.artery}
            </div>
            {paddleSummary && (
              <div
                className="mt-1 pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums"
                data-testid="calibrated-paddle-readout"
              >
                <span
                  className={`truncate ${
                    paddleSummary.isVerify
                      ? 'text-[var(--warning-text)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                  title={paddleSummary.dimensionsText}
                >
                  {paddleSummary.dimensionsText}
                </span>
                <span className="text-[var(--accent-primary)] font-semibold shrink-0">
                  {paddleSummary.areaText}
                </span>
              </div>
            )}

            {/* Sub-Phase 9d: Real BodyParts3D vessel resolution or Not-in-dataset notice */}
            {resolvedFlapVessels && resolvedFlapVessels.resolvedVessels.length > 0 && (
              <div
                className="mt-1 pt-1 border-t border-[var(--border-subtle)] space-y-0.5"
                data-testid="viewer-real-vessel-link-badge"
              >
                <div className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 leading-tight flex items-center justify-between gap-1">
                  <span>{REAL_VESSEL_TAG_TEXT}</span>
                  <span className="font-mono shrink-0">
                    {resolvedFlapVessels.resolvedVessels.length} mesh
                    {resolvedFlapVessels.resolvedVessels.length === 1 ? '' : 'es'} ({donorSide === 'right' ? 'R' : 'L'})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-[var(--text-secondary)]">
                  {resolvedFlapVessels.hasResolvedPedicleArtery && (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Pedicle
                    </span>
                  )}
                  {resolvedFlapVessels.hasResolvedVein && (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      Vein
                    </span>
                  )}
                  {resolvedFlapVessels.hasResolvedSource && (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-800" />
                      Source
                    </span>
                  )}
                </div>
              </div>
            )}

            {resolvedFlapVessels &&
              resolvedFlapVessels.status === 'not_in_dataset' &&
              resolvedFlapVessels.notInDatasetNotice && (
                <div
                  className="mt-1 pt-1 border-t border-[var(--border-subtle)] text-[9px] font-medium text-amber-700 dark:text-amber-300 leading-tight"
                  data-testid="viewer-not-in-dataset-notice"
                >
                  {resolvedFlapVessels.notInDatasetNotice}
                </div>
              )}

            {/* Phase 10c: Explicit schematic badges for muscles/nerves absent in BodyParts3D 4.0 */}
            {flapBp3dCoverage?.muscleBadge && (
              <div
                className="mt-1 pt-1 border-t border-[var(--border-subtle)] text-[9.5px] font-semibold text-amber-700 dark:text-amber-300 leading-tight flex items-start gap-1"
                data-testid="viewer-schematic-muscle-badge"
              >
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>{flapBp3dCoverage.muscleBadge}</span>
              </div>
            )}
            {flapBp3dCoverage?.nerveBadge && (
              <div
                className="mt-1 pt-1 border-t border-[var(--border-subtle)] text-[9px] font-medium text-amber-700 dark:text-amber-300 leading-tight"
                data-testid="viewer-schematic-nerve-badge"
              >
                {flapBp3dCoverage.nerveBadge}
              </div>
            )}

            {resolvedFlapOverlay && (
              <div
                className="mt-1 pt-1 border-t border-[var(--border-subtle)] space-y-0.5"
                data-testid="active-flap-schematic-tag"
              >
                <div className="text-[9px] font-medium text-amber-700 dark:text-amber-300 leading-tight">
                  {resolvedFlapVessels?.hasResolvedPedicleArtery
                    ? `Paddle, perforators & design lines: ${SCHEMATIC_TAG_TEXT}`
                    : resolvedFlapOverlay.pedicleProvenance === 'source-vessel'
                      ? `Pedicle snapped: ${resolvedFlapOverlay.snappedVesselMeshName} · Paddle/Perf: ${SCHEMATIC_TAG_TEXT}`
                      : `Paddle, perforators & vessels: ${SCHEMATIC_TAG_TEXT}`}
                </div>
                {resolvedFlapOverlay.drivingAnchorLabels.length > 0 && (
                  <div className="text-[9px] text-[var(--text-muted)] leading-tight flex items-center justify-between gap-1">
                    <span className="truncate">
                      Anchors: {resolvedFlapOverlay.drivingAnchorLabels.join(' · ')}
                    </span>
                    {editorMode && (
                      <button
                        type="button"
                        onClick={openCalibrationPage}
                        className="pointer-events-auto text-[var(--accent-primary)] hover:underline shrink-0 font-medium"
                      >
                        Calibrate
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phase 10d: Stale non-BP3D anchor calibration prompt */}
        {anchorsNeedRecalibration && !compact && !spotterBlindMode && (
          <div
            className="pointer-events-auto bg-[var(--bg-surface)] border border-amber-500 rounded-lg px-2.5 py-1.5 shadow-sm text-[10px] space-y-1"
            data-testid="stale-anchors-recalibrate-banner"
          >
            <div className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Please recalibrate landmarks for BodyParts3D 4.0</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => requestAutoProposeAnchors()}
                className="px-1.5 py-0.5 rounded bg-[var(--accent-primary)] text-white font-medium text-[9.5px]"
              >
                Auto-Propose BP3D
              </button>
              <button
                type="button"
                onClick={() => openCalibrationPage()}
                className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium text-[9.5px]"
              >
                Calibrate
              </button>
              <button
                type="button"
                onClick={() => dismissAnchorRecalibrationBanner()}
                className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Dismiss recalibration banner"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {teachingMode && !spotterBlindMode && (
          <div
            className="bg-[var(--bg-surface)] border border-[var(--accent-primary)] rounded-md px-2 py-1 text-[10px] font-medium text-[var(--accent-primary)] shadow-xs"
            data-testid="teaching-mode-badge"
          >
            Teaching Mode · 3D Labels Hidden
          </div>
        )}

        {(glbStatus.loading || modelLoadProgress.active) && (
          <div
            className="bg-[var(--bg-surface)] border border-[var(--accent-primary)] rounded-lg px-3 py-2 text-[11px] shadow-md w-[248px] space-y-1.5"
            data-testid="model-loading-progress"
          >
            <div className="flex items-center justify-between gap-2 text-[var(--accent-primary)] font-medium">
              <span className="truncate">{modelLoadProgress.stageLabel || 'Loading BodyParts3D 4.0…'}</span>
              <span className="font-mono tabular-nums shrink-0">{modelLoadProgress.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent-primary)] transition-all duration-200"
                style={{ width: `${Math.max(8, modelLoadProgress.pct)}%` }}
              />
            </div>
            <div className="text-[10px] text-[var(--text-muted)] font-mono tabular-nums space-y-0.5">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate">
                  {modelLoadProgress.currentFile
                    ? modelLoadProgress.currentFile
                    : `${modelLoadProgress.loadedCount}/${Math.max(1, modelLoadProgress.totalCount)} systems`}
                </span>
                <span className="shrink-0">
                  {modelLoadProgress.loadedBytes
                    ? modelLoadProgress.totalBytes
                      ? `${(modelLoadProgress.loadedBytes / (1024 * 1024)).toFixed(1)}/${(modelLoadProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB`
                      : `${(modelLoadProgress.loadedBytes / (1024 * 1024)).toFixed(1)} MB`
                    : `${modelLoadProgress.loadedCount}/${Math.max(1, modelLoadProgress.totalCount)}`}
                </span>
              </div>
              <div className="truncate text-[9px] text-[var(--text-muted)]">
                {modelLoadProgress.fromCache
                  ? 'Source: IndexedDB Cache hit'
                  : modelLoadProgress.currentSourceUrl?.includes('raw.githubusercontent.com')
                    ? 'Source: GitHub Raw fallback'
                    : modelLoadProgress.currentSourceUrl?.includes('jsdelivr.net')
                      ? 'Source: jsDelivr CDN (GitHub)'
                      : 'BodyParts3D 4.0 · Real 1:1 m (Draco)'}
              </div>
            </div>
          </div>
        )}

        {!glbStatus.loading && !modelLoadProgress.active && territoryFieldStatus === 'building' && (
          <div
            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-[10px] shadow-sm w-[236px] space-y-1"
            data-testid="territory-field-building-indicator"
          >
            <div className="flex items-center justify-between gap-2 text-[var(--text-secondary)] font-medium">
              <span className="truncate">
                {territoryFieldProgress.label || 'Building vascular territory field…'}
              </span>
              <span className="font-mono tabular-nums shrink-0">{territoryFieldProgress.pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent-primary)] transition-all duration-150"
                style={{ width: `${Math.max(8, territoryFieldProgress.pct)}%` }}
              />
            </div>
          </div>
        )}

        {!glbStatus.loading &&
          !modelLoadProgress.active &&
          !spotterBlindMode &&
          activeModelStats &&
          !anatomyCard &&
          territoryMode === 'off' && (
          <div
            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md px-2 py-0.5 text-[10px] text-[var(--text-secondary)] font-mono tabular-nums shadow-xs inline-flex items-center gap-1 whitespace-nowrap w-fit"
            data-testid="active-model-source-badge"
            title={`${activeModelStats.sourceLabel} · ${activeModelStats.totalMeshes} structures · ${activeModelStats.normalizedHeightCm} cm real scale`}
          >
            <span className="font-semibold text-[var(--accent-primary)]">
              {activeModelStats.mode === 'real-glb'
                ? `${
                    activeModelStats.hasLegacyZAnatomy ? 'Legacy + BP3D' : 'BodyParts3D 4.0'
                  } · ${activeModelStats.loadedSystems.length} sys`
                : 'Procedural Fallback'}
            </span>
            <span>·</span>
            <span>{Math.round(activeModelStats.normalizedHeightCm)} cm</span>
            {activeModelStats.mode === 'real-glb' && activeModelStats.drawCallCount ? (
              <>
                <span>·</span>
                <span>{activeModelStats.drawCallCount} calls</span>
              </>
            ) : null}
          </div>
        )}

        {glbStatus.error && (
          <div
            className="bg-[var(--bg-surface)] border border-red-500 rounded-md px-2.5 py-1 text-[11px] text-[var(--danger-text)] shadow-xs"
            data-testid="glb-fallback-notice"
          >
            Procedural fallback active: {glbStatus.error}
          </div>
        )}

        {!spotterBlindMode && hoveredInfo && !anatomyCard && (
          <div
            className="bg-[var(--bg-surface)] border border-[var(--accent-primary)] rounded-lg px-2.5 py-1 shadow-sm"
            data-testid="hover-anatomy-tooltip"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                {hoveredInfo.category}
              </span>
              {hoveredInfo.laterality && hoveredInfo.laterality !== 'midline' && (
                <span className="text-[9px] font-mono uppercase text-[var(--text-muted)]">
                  · {hoveredInfo.laterality}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-primary)] leading-tight">{hoveredInfo.label}</p>
          </div>
        )}

        {/* Rich Clickable Anatomy Detail Card (Phase 8b + Phase 9a BodyParts3D Vessel/Skin Metadata) */}
        {!compact && !spotterBlindMode && anatomyCard && selectedAnatomyInfo && (() => {
          const latBadge = formatLateralityBadge(selectedAnatomyInfo.laterality);
          const isBodyParts3D = selectedAnatomyInfo.sourceModel === 'bodyparts3d';
          const displayTitle = isBodyParts3D ? selectedAnatomyInfo.label : anatomyCard.name;
          const reverseFlapMatches =
            selectedAnatomyInfo.system === 'arteries' || selectedAnatomyInfo.system === 'veins'
              ? findFlapsUsingVessel(
                  { fjCode: selectedAnatomyInfo.fjCode, name: selectedAnatomyInfo.label },
                  flaps
                )
              : [];
          const mergedLinkedFlapIds = Array.from(
            new Set([
              ...reverseFlapMatches.map((m) => m.flapId),
              ...(selectedAnatomyInfo.linkedFlapIds || []),
              ...(anatomyCard.suppliedFlapIds || []),
            ])
          );
          const muscleTerritoryInfo =
            selectedAnatomyInfo.system === 'muscles'
              ? resolveMuscleDeepTissueInfo(
                  selectedAnatomyInfo.groupLabel || selectedAnatomyInfo.label,
                  territoryCalibrationReport
                )
              : null;
          const boneTerritoryInfo =
            selectedAnatomyInfo.system === 'skeleton'
              ? resolveBoneDeepTissueInfo(selectedAnatomyInfo.label)
              : null;
          return (
            <div
              className={`pointer-events-auto bg-[var(--bg-surface)] border border-[var(--accent-primary)] rounded-xl p-2.5 shadow-lg overflow-y-auto space-y-2 text-xs ${
                territoryMode !== 'off'
                  ? 'fixed inset-x-2 bottom-2 z-50 max-h-[62dvh] sm:static sm:inset-auto sm:z-20 sm:w-[290px] sm:max-h-[54vh]'
                  : 'w-[226px] sm:w-[264px] max-h-[50vh] z-20'
              }`}
              data-testid="anatomy-detail-card"
            >
              <div className="flex items-start justify-between gap-1.5 pb-1.5 border-b border-[var(--border-subtle)]">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                      {anatomyCard.category}
                    </span>
                    <span
                      data-testid="anatomy-card-side"
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${latBadge.style}`}
                    >
                      {isBodyParts3D
                        ? selectedAnatomyInfo.laterality === 'left'
                          ? 'Left'
                          : selectedAnatomyInfo.laterality === 'right'
                            ? 'Right'
                            : 'Midline'
                        : latBadge.text}
                    </span>
                    {selectedAnatomyInfo.system && (
                      <span
                        data-testid="anatomy-card-system"
                        className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] capitalize"
                      >
                        {selectedAnatomyInfo.system}
                      </span>
                    )}
                  </div>
                  {isBodyParts3D && (
                    <div
                      data-testid="anatomy-card-bp3d-tag"
                      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/12 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300"
                    >
                      BodyParts3D reference mesh
                    </div>
                  )}
                  {selectedAnatomyInfo.isSchematic && (
                    <div
                      data-testid="anatomy-card-schematic-tag"
                      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/12 border border-amber-500/35 text-amber-700 dark:text-amber-300"
                    >
                      {SCHEMATIC_TAG_TEXT}
                    </div>
                  )}
                  <div
                    className="text-xs font-semibold text-[var(--text-primary)] leading-snug"
                    data-testid="anatomy-card-name"
                  >
                    {displayTitle}
                  </div>
                  {isBodyParts3D && selectedAnatomyInfo.fjCode ? (
                    <div
                      data-testid="anatomy-card-source-mesh"
                      className="text-[10px] font-mono text-[var(--text-muted)]"
                    >
                      Source mesh: {selectedAnatomyInfo.fjCode} (BodyParts3D)
                      {selectedAnatomyInfo.fmaCode ? ` · ${selectedAnatomyInfo.fmaCode}` : ''}
                    </div>
                  ) : (
                    selectedAnatomyInfo.meshName && (
                      <div
                        className="text-[10px] font-mono text-[var(--text-muted)] truncate"
                        title={selectedAnatomyInfo.meshName}
                      >
                        {selectedAnatomyInfo.meshName}
                      </div>
                    )
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAnatomyInfo(null)}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
                  aria-label="Close anatomy detail card"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Phase 11d: Ch. 23 Muscle Territory Count, Neurovascular Type I–IV & Calibration Audit */}
              {muscleTerritoryInfo && (
                <div
                  className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5"
                  data-testid="anatomy-card-muscle-territory-profile"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Vascular Territory Profile (Ch. 23)
                    </div>
                    {territoryMode !== 'off' && (
                      <button
                        type="button"
                        onClick={() => setTerritorySheetOpen(true)}
                        data-testid="anatomy-card-open-deep-tissue-btn"
                        className="text-[10px] font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap"
                      >
                        Deep Tissue
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {muscleTerritoryInfo.territoryCountBadge && (
                      <span
                        data-testid="anatomy-card-territory-count-badge"
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30"
                      >
                        {muscleTerritoryInfo.territoryCountBadge}
                      </span>
                    )}
                    {muscleTerritoryInfo.neurovascularType && (
                      <span
                        data-testid="anatomy-card-nv-type-badge"
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                      >
                        NV {muscleTerritoryInfo.neurovascularType}
                      </span>
                    )}
                    {muscleTerritoryInfo.venousType && (
                      <span
                        data-testid="anatomy-card-venous-type-badge"
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/12 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                      >
                        Venous {muscleTerritoryInfo.venousType}
                      </span>
                    )}
                  </div>
                  {muscleTerritoryInfo.neurovascularLabel && (
                    <p className="text-[10px] text-[var(--text-secondary)] leading-snug">
                      <span className="font-medium text-[var(--text-primary)]">
                        {muscleTerritoryInfo.neurovascularLabel}:
                      </span>{' '}
                      {muscleTerritoryInfo.neurovascularMeaning}
                    </p>
                  )}
                  {muscleTerritoryInfo.calibrationEntry && (
                    <div
                      data-testid="anatomy-card-calibration-status"
                      className={`text-[10px] leading-snug rounded px-1.5 py-1 border ${
                        muscleTerritoryInfo.calibrationEntry.status === 'warning'
                          ? 'bg-amber-500/10 border-amber-500/35 text-amber-800 dark:text-amber-300'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                      }`}
                    >
                      {muscleTerritoryInfo.calibrationEntry.status === 'warning'
                        ? muscleTerritoryInfo.calibrationEntry.warningMessage
                        : `3-D field audit: intersects ${muscleTerritoryInfo.calibrationEntry.computedCount} ${
                            muscleTerritoryInfo.calibrationEntry.computedCount === 1
                              ? 'territory'
                              : 'territories'
                          } (matches ${muscleTerritoryInfo.calibrationEntry.sourceTable}).`}
                    </div>
                  )}
                  {muscleTerritoryInfo.supplyingAngiosomes.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {muscleTerritoryInfo.supplyingAngiosomes.map((chip) => (
                        <button
                          key={chip.territoryId}
                          type="button"
                          onClick={() => {
                            if (territoryMode === 'off' && territoryFieldStatus === 'ready') {
                              setTerritoryMode('angiosomes');
                            }
                            focusTerritory(chip.territoryId, territorySideFilter, true);
                          }}
                          className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[10px] text-[var(--text-primary)] inline-flex items-center gap-1"
                        >
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{
                              backgroundColor: colorblindMode
                                ? chip.hexColorblind
                                : chip.hexStandard,
                            }}
                            aria-hidden="true"
                          />
                          <span>{chip.shortLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="text-[9.5px] text-[var(--text-muted)]">
                    Ref: Morris &amp; Taylor, Ch. {muscleTerritoryInfo.sourceRef.chapter}, p.{' '}
                    {muscleTerritoryInfo.sourceRef.page} ({muscleTerritoryInfo.sourceRef.figureOrTable})
                  </div>
                </div>
              )}

              {/* Phase 11d: Ch. 23 Bone Vascular Supply Text Card (No Invented Osseous Borders) */}
              {boneTerritoryInfo && (
                <div
                  className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5"
                  data-testid="anatomy-card-bone-territory-profile"
                >
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Bone Vascular Supply (Ch. 23)
                  </div>
                  <p className="text-[10.5px] text-[var(--text-secondary)] leading-snug">
                    {boneTerritoryInfo.specificCard
                      ? boneTerritoryInfo.specificCard.summary
                      : boneTerritoryInfo.generalSupplyNote}
                  </p>
                  <p className="text-[9.5px] text-[var(--text-muted)] leading-snug">
                    {boneTerritoryInfo.noInventedBordersNote}
                  </p>
                  {boneTerritoryInfo.specificCard && (
                    <div className="text-[9.5px] text-[var(--text-muted)]">
                      Ref: Morris &amp; Taylor, Ch.{' '}
                      {boneTerritoryInfo.specificCard.sourceRef.chapter}, p.{' '}
                      {boneTerritoryInfo.specificCard.sourceRef.page} (
                      {boneTerritoryInfo.specificCard.sourceRef.figureOrTable})
                    </div>
                  )}
                </div>
              )}

              {/* Phase 10b: Logical Muscle Group Constituent Parts with FJ / FMA IDs */}
              {selectedAnatomyInfo.constituentParts &&
                selectedAnatomyInfo.constituentParts.length > 1 && (
                  <div
                    className="p-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1"
                    data-testid="anatomy-card-constituent-parts"
                  >
                    <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Constituent Parts ({selectedAnatomyInfo.constituentParts.length})
                    </div>
                    <ul className="space-y-0.5">
                      {selectedAnatomyInfo.constituentParts.map((part) => (
                        <li
                          key={`${part.meshName}-${part.fjCode || part.label}`}
                          className="flex items-center justify-between gap-1.5 text-[10px]"
                        >
                          <span className="text-[var(--text-primary)] truncate" title={part.meshName}>
                            {part.label}
                          </span>
                          <span className="font-mono text-[9px] text-[var(--text-muted)] shrink-0">
                            {[part.fjCode, part.fmaCode].filter(Boolean).join(' · ') || 'BP3D'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Phase 8b quick focus, ghosting & expandable clinical details */}
              <div className="flex flex-wrap items-center gap-1">
                {selectedAnatomyInfo.boundsMin && selectedAnatomyInfo.boundsMax && (
                  <button
                    type="button"
                    onClick={() => {
                      const goal = computeStructureFocusCamera(
                        selectedAnatomyInfo.boundsMin!,
                        selectedAnatomyInfo.boundsMax!,
                        selectedAnatomyInfo.center
                      );
                      flyToCameraGoal(goal.pos, goal.target);
                    }}
                    data-testid="anatomy-card-flyto-btn"
                    className="h-6 px-1.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[10px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1"
                  >
                    <Crosshair className="w-3 h-3 text-[var(--accent-primary)]" />
                    <span>Fly To</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setGhostUnselected(!ghostUnselected)}
                  data-testid="toggle-ghost-others-btn"
                  className={`h-6 px-1.5 rounded-md border text-[10px] font-medium inline-flex items-center gap-1 ${
                    ghostUnselected
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {ghostUnselected ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>Ghost: {ghostUnselected ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnatomyCardDetailsOpen((v) => !v)}
                  aria-expanded={anatomyCardDetailsOpen}
                  data-testid="toggle-anatomy-card-details-btn"
                  className="h-6 px-1.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-0.5 ml-auto"
                >
                  <span>Details</span>
                  {anatomyCardDetailsOpen ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>

              {anatomyCardDetailsOpen && (
                <div
                  className="space-y-1.5 text-[11px] pt-1.5 border-t border-[var(--border-subtle)]"
                  data-testid="anatomy-card-clinical-details"
                >
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">Origin: </span>
                    <span className="text-[var(--text-secondary)]">{anatomyCard.origin}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">Course: </span>
                    <span className="text-[var(--text-secondary)]">{anatomyCard.course}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">Caliber / Size: </span>
                    <span className="font-mono text-[var(--text-secondary)]">{anatomyCard.dimensions}</span>
                  </div>
                  {anatomyCard.branches.length > 0 && (
                    <div>
                      <span className="font-semibold text-[var(--text-primary)]">Branches: </span>
                      <span className="text-[var(--text-secondary)]">
                        {anatomyCard.branches.slice(0, 3).join('; ')}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">Relations: </span>
                    <span className="text-[var(--text-secondary)]">{anatomyCard.relations}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">Clinical: </span>
                    <span className="text-[var(--text-secondary)]">{anatomyCard.clinicalRelevance}</span>
                  </div>
                  {anatomyCard.variants.length > 0 && (
                    <div>
                      <span className="font-semibold text-[var(--text-primary)]">Variants: </span>
                      <span className="text-[var(--text-secondary)]">
                        {anatomyCard.variants.slice(0, 2).join('; ')}
                      </span>
                    </div>
                  )}
                  <div className="text-[10px] text-[var(--text-muted)] pt-0.5">
                    Ref: {anatomyCard.referenceText}
                  </div>
                </div>
              )}

              <div className="pt-1.5 border-t border-[var(--border-subtle)] flex flex-wrap gap-1">
                {mergedLinkedFlapIds.slice(0, 4).map((fid) => {
                  const fl = flaps.find((f) => f.id === fid);
                  if (!fl) return null;
                  return (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => {
                        if (
                          selectedAnatomyInfo.laterality === 'left' ||
                          selectedAnatomyInfo.laterality === 'right'
                        ) {
                          setDonorSide(selectedAnatomyInfo.laterality);
                        }
                        setSelectedAnatomyInfo(null);
                        selectFlap(fid, true);
                        setActiveTab('library');
                      }}
                      className="px-1.5 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] font-medium text-[10px] hover:opacity-90 flex items-center gap-1"
                    >
                      <span>{fl.synonyms[0] || fl.name}</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  );
                })}

                {selectedAnatomyInfo.mapped === false && selectedAnatomyInfo.meshName && (
                  <button
                    type="button"
                    onClick={() => openEditorForUnmappedMesh(selectedAnatomyInfo.meshName!)}
                    data-testid="map-unmapped-in-editor-btn"
                    className="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 font-medium text-[10px] hover:opacity-90 flex items-center gap-1"
                  >
                    <Wrench className="w-2.5 h-2.5" />
                    <span>Map in Editor</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setLibraryRegionFilter(anatomyCard.regionGroup);
                    setActiveTab('library');
                  }}
                  className="px-1.5 py-0.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium text-[10px] hover:border-[var(--accent-primary)] flex items-center gap-1"
                  data-testid="filter-library-by-region-btn"
                >
                  <Filter className="w-2.5 h-2.5" />
                  <span>{anatomyCard.regionGroup}</span>
                </button>
              </div>
            </div>
          );
        })()}

        {measureMode && (
          <div className="bg-[var(--bg-surface)] border border-[var(--accent-primary)] rounded-lg px-2.5 py-1.5 shadow-sm">
            <div className="text-[11px] font-semibold text-[var(--accent-primary)]">
              Surface Ruler Active
            </div>
            <div className="text-xs text-[var(--text-secondary)] font-mono tabular-nums">
              {measureCm !== null
                ? unitSystem === 'imperial'
                  ? `Distance: ${(measureCm * 0.3937).toFixed(2)} in (${measureCm} cm)`
                  : `Distance: ${measureCm} cm`
                : 'Click 2 points on the body'}
            </div>
          </div>
        )}
      </div>

      {/* Top-right compact Orientation Cube & metric scale bar */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 shadow-sm text-right">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
            {orientationLabel}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {[
              { id: 'anterior-full', lbl: 'A', title: 'Anterior' },
              { id: 'posterior-full', lbl: 'P', title: 'Posterior' },
              { id: 'left-lateral', lbl: 'L', title: 'Left Lateral' },
              { id: 'right-lateral', lbl: 'R', title: 'Right Lateral' },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                title={v.title}
                onClick={() => setCameraPreset(v.id)}
                className={`w-6 h-6 rounded text-[11px] font-mono font-semibold border transition-colors ${
                  orientationLabel === v.title
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {v.lbl}
              </button>
            ))}
          </div>
        </div>

        {!compact && (
          <div className="pointer-events-none hidden sm:flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md px-2 py-1 text-[10px] font-mono text-[var(--text-secondary)] shadow-xs">
            <span className="inline-block w-8 h-0.5 bg-[var(--text-primary)]" />
            <span>{unitSystem === 'imperial' ? '~4 in' : '10 cm'}</span>
          </div>
        )}
      </div>

      {/* Donor vs Recipient Picture-in-Picture (PiP) Inset */}
      {showPipView && !compact && pipData && selectedFlap && (
        <div
          className={`absolute top-[104px] right-3 z-15 w-52 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg p-2.5 space-y-2 ${
            anatomyCard ? 'hidden sm:block' : ''
          }`}
          data-testid="donor-recipient-pip"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
              Donor → Recipient Map
            </span>
            <button
              type="button"
              onClick={() => setShowPipView(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Close Donor/Recipient PiP"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 120 156"
              className="w-20 h-28 shrink-0 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-subtle)]"
              aria-label="Donor to recipient transfer diagram"
            >
              {/* Clean anatomical silhouette outline */}
              <circle cx="60" cy="18" r="9" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.4" />
              <path
                d="M 44 33 C 44 29 76 29 76 33 L 86 68 L 80 70 L 73 45 L 72 82 L 77 146 L 67 146 L 61 95 L 59 95 L 53 146 L 43 146 L 48 82 L 47 45 L 40 70 L 34 68 Z"
                fill="currentColor"
                fillOpacity="0.06"
                stroke="currentColor"
                strokeOpacity="0.28"
                strokeWidth="1.2"
              />
              <line x1="60" y1="28" x2="60" y2="92" stroke="currentColor" strokeOpacity="0.14" strokeDasharray="2 2" />

              {/* Curved transfer vector */}
              <path
                d={pipData.pathD}
                fill="none"
                stroke="#0d9488"
                strokeWidth="1.8"
                strokeDasharray="3 2"
              />

              {/* Donor pin (Teal) */}
              <circle cx={pipData.donorSvg.x} cy={pipData.donorSvg.y} r="4.5" fill="#0d9488" />
              <circle cx={pipData.donorSvg.x} cy={pipData.donorSvg.y} r="7" fill="none" stroke="#0d9488" strokeOpacity="0.45" />

              {/* Recipient pin (Rose) */}
              <circle cx={pipData.recipSvg.x} cy={pipData.recipSvg.y} r="4.5" fill="#e11d48" />
              <circle cx={pipData.recipSvg.x} cy={pipData.recipSvg.y} r="7" fill="none" stroke="#e11d48" strokeOpacity="0.45" />
            </svg>

            <div className="min-w-0 flex-1 space-y-1.5 text-[10px]">
              <div>
                <div className="font-semibold text-[var(--accent-primary)]">Donor Site</div>
                <div className="text-[var(--text-primary)] leading-tight truncate">
                  {selectedFlap.region}
                </div>
              </div>
              <div>
                <div className="font-semibold text-rose-600 dark:text-rose-400">Recipient</div>
                <div className="text-[var(--text-primary)] leading-tight line-clamp-2">
                  {pipData.recipientLabel}
                </div>
              </div>
              <div className="text-[var(--text-muted)] leading-tight truncate">
                {pipData.recipientVessel}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setAnimationMode(animationMode === 'transfer' ? 'none' : 'transfer')
            }
            className={`w-full h-7 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 border transition-colors ${
              animationMode === 'transfer'
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>{animationMode === 'transfer' ? 'Stop Transfer' : 'Animate Transfer'}</span>
          </button>
        </div>
      )}

      {/* Right-Click 3D Context Menu */}
      {contextMenu && selectedFlap && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="absolute z-30 w-48 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-xl py-1 text-xs"
          data-testid="viewer-context-menu"
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] truncate">
            {selectedFlap.name}
          </div>
          <button
            type="button"
            onClick={() => {
              selectFlap(selectedFlap.id, true);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <Crosshair className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Focus Active Flap</span>
          </button>
          <button
            type="button"
            onClick={() => {
              toggleCompare(selectedFlap.id);
              setToastMsg(isCompared ? 'Removed from Compare' : 'Added to Compare');
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <GitCompare className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{isCompared ? 'Remove from Compare' : 'Add to Compare'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              toggleFavorite(selectedFlap.id);
              setToastMsg(isFav ? 'Bookmark removed' : 'Flap bookmarked');
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <Star className={`w-3.5 h-3.5 ${isFav ? 'text-amber-500 fill-current' : 'text-[var(--text-muted)]'}`} />
            <span>{isFav ? 'Remove Bookmark' : 'Bookmark Flap'}</span>
          </button>
          <button
            type="button"
            onClick={handleCopyCitation}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Copy Citation</span>
          </button>
          <div className="my-1 border-t border-[var(--border-subtle)]" />
          <button
            type="button"
            onClick={() => {
              setShow3DLabels(!show3DLabels);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <Tag className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>{show3DLabels ? 'Hide 3D Callout Labels' : 'Show 3D Callout Labels'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowPipView(!showPipView);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <PictureInPicture2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>{showPipView ? 'Hide Donor/Recipient PiP' : 'Show Donor/Recipient PiP'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              reset3DView();
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset 3D View</span>
          </button>
        </div>
      )}

      {/* Bottom Control Stack: Calibration Banner, Toast, Layers/Clipping Popover anchored cleanly ABOVE Bottom Control Dock (zero overlap) */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col items-end gap-2 pointer-events-none">
        {activeCalibratingAnchor && (
          <div
            className="pointer-events-auto self-center bg-[var(--bg-surface)] border-2 border-amber-500 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2 text-xs max-w-[94%]"
            data-testid="viewer-calibration-banner"
          >
            <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-[var(--text-primary)]">
                Click on the skeleton to set {activeCalibratingAnchor.shortLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCalibratingAnchorId(null)}
              className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {calibrationViewActive && (!alignmentPanelOpen || hideAlignmentDockButton) && (
          <div
            className="pointer-events-auto self-center bg-[var(--bg-surface)] border border-[var(--accent-primary)] rounded-xl px-3 py-1.5 shadow-md flex items-center gap-2 text-xs"
            data-testid="calibration-view-banner"
          >
            <Eye className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
            <span className="font-medium text-[var(--text-primary)]">
              Calibration View · Skeleton + Aorta / Femoral / Internal Thoracic + Skin 15%
            </span>
            <button
              type="button"
              onClick={() => toggleCalibrationView(false)}
              className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[10px] font-medium text-[var(--text-primary)] shrink-0"
            >
              Exit
            </button>
          </div>
        )}

        {toastMsg && !activeCalibratingAnchor && !calibrationViewActive && (
          <div className="pointer-events-auto self-center bg-[var(--bg-surface)] border border-[var(--accent-primary)] text-[var(--accent-primary)] px-3 py-1 rounded-lg shadow-md text-xs font-medium">
            {toastMsg}
          </div>
        )}

        {editorMode && alignmentPanelOpen && !hudCollapsed && !hideAlignmentDockButton && (
          <div
            className="pointer-events-auto w-full sm:w-[376px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg p-3 max-h-[min(68vh,460px)] overflow-y-auto"
            data-testid="alignment-popover"
          >
            <VesselAlignmentPanel compact onClose={() => setAlignmentPanelOpen(false)} />
          </div>
        )}

        {layersOpen && !hudCollapsed && (
          <div
            className="pointer-events-auto w-full sm:w-[348px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg p-3 max-h-[min(64vh,430px)] overflow-y-auto"
            data-testid="layers-popover"
          >
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setLayersPopoverTab('layers')}
                data-testid="popover-tab-layers"
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  layersPopoverTab === 'layers'
                    ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Layers ({LAYER_LABELS.length})
              </button>
              <button
                type="button"
                onClick={() => setLayersPopoverTab('vessels')}
                data-testid="popover-tab-vessels"
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  layersPopoverTab === 'vessels'
                    ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Vessels
              </button>
              <button
                type="button"
                onClick={() => setLayersPopoverTab('clipping')}
                data-testid="popover-tab-clipping"
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  layersPopoverTab === 'clipping'
                    ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Clipping{activeClippingEntries.length > 0 ? ` (${activeClippingEntries.length})` : ''}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLayersOpen(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Done
            </button>
          </div>

          {layersPopoverTab === 'layers' ? (
            <div className="space-y-2">
              <div className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[var(--text-primary)]">
                    Dissection Peel (Superficial → Deep)
                  </span>
                  <span className="font-mono tabular-nums text-[var(--accent-primary)] font-semibold">
                    {dissectionPeel}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={dissectionPeel}
                  onChange={(e) => setDissectionPeel(Number(e.target.value))}
                  aria-label="Panel dissection peel slider"
                  className="w-full h-1.5 accent-[var(--accent-primary)] cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => setLayersPopoverTab('vessels')}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center justify-between gap-2 text-[10.5px] transition-colors"
              >
                <span className="text-[var(--text-secondary)] truncate">
                  Vessel view:{' '}
                  <strong className="text-[var(--text-primary)]">
                    {getVesselPreset(vesselPreset).shortLabel}
                  </strong>
                  {vesselSideFilter !== 'both' ? ` · ${vesselSideFilter === 'left' ? 'Left' : 'Right'}` : ' · Both'}
                </span>
                <span className="text-[var(--accent-primary)] font-medium shrink-0">Filter →</span>
              </button>

              {LAYER_LABELS.map(({ key, label }) => {
                const st = layers[key];
                const isRealActive = activeModelStats?.mode === 'real-glb';
                const loadedSys = activeModelStats?.loadedSystems || [];
                const schematic = isLayerSchematic(key, loadedSys, isRealActive);
                return (
                  <div key={key} className="flex items-center gap-1.5 text-xs">
                    <input
                      id={`layer-toggle-${key}`}
                      type="checkbox"
                      checked={st.visible}
                      onChange={(e) => setLayer(key, { visible: e.target.checked })}
                      className="rounded accent-[var(--accent-primary)]"
                    />
                    <label
                      htmlFor={`layer-toggle-${key}`}
                      className="w-[108px] text-[var(--text-primary)] truncate cursor-pointer flex items-center gap-1"
                      title={schematic ? `${label} — ${SCHEMATIC_TAG_TEXT}` : `${label} (Source model)`}
                    >
                      <span className="truncate">{label}</span>
                      {schematic && (
                        <span
                          data-testid={`layer-schematic-tag-${key}`}
                          className="px-1 py-0 rounded text-[8px] font-medium bg-amber-500/12 border border-amber-500/35 text-amber-700 dark:text-amber-300 shrink-0"
                        >
                          Schematic
                        </span>
                      )}
                    </label>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={st.opacity}
                      disabled={!st.visible}
                      onChange={(e) => setLayer(key, { opacity: Number(e.target.value) })}
                      className="flex-1 h-1.5 accent-[var(--accent-primary)] cursor-pointer disabled:opacity-40"
                      aria-label={`${label} opacity`}
                    />
                    <span className="w-8 text-right font-mono tabular-nums text-[10px] text-[var(--text-muted)]">
                      {Math.round(st.opacity * 100)}%
                    </span>
                  </div>
                );
              })}

              <div
                data-testid="layers-schematic-legend"
                className="pt-1.5 mt-1 border-t border-[var(--border-subtle)] text-[9.5px] text-amber-700 dark:text-amber-300 leading-snug"
              >
                <strong>Schematic</strong> = {SCHEMATIC_TAG_TEXT} (translucent skin silhouette,
                procedural vascular tree &amp; flap overlays scaled to model height).
              </div>
            </div>
          ) : layersPopoverTab === 'vessels' ? (
            <VesselDeclutterPanel />
          ) : (
            <div className="space-y-2.5" data-testid="clipping-planes-panel">
              {CLIPPING_AXIS_META.map((meta) => {
                const axisState = clippingPlanes[meta.axis];
                const spec = computeClippingPlaneParams(meta.axis, axisState, modelBoundsState);
                return (
                  <div
                    key={meta.axis}
                    className={`p-2 rounded-lg border space-y-1.5 ${
                      axisState.enabled
                        ? 'bg-[var(--bg-subtle)] border-[var(--accent-primary)]/60'
                        : 'bg-[var(--bg-subtle)]/60 border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={axisState.enabled}
                          onChange={(e) =>
                            setClippingAxis(meta.axis, { enabled: e.target.checked })
                          }
                          data-testid={`clip-toggle-${meta.axis}`}
                          className="rounded accent-[var(--accent-primary)]"
                        />
                        <div className="min-w-0">
                          <div className={`text-[11px] font-semibold leading-tight ${meta.badgeClass}`}>
                            {meta.label}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">{meta.subtitle}</div>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setClippingAxis(meta.axis, {
                            enabled: true,
                            inverted: !axisState.inverted,
                          })
                        }
                        data-testid={`clip-flip-${meta.axis}`}
                        title={`Flip ${meta.label} cut side`}
                        className="h-6 px-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[10px] font-medium text-[var(--text-secondary)] inline-flex items-center gap-1 shrink-0"
                      >
                        <FlipHorizontal2 className="w-3 h-3" />
                        <span>Flip</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={axisState.position}
                        disabled={!axisState.enabled}
                        onChange={(e) =>
                          setClippingAxis(meta.axis, { position: Number(e.target.value) })
                        }
                        data-testid={`clip-slider-${meta.axis}`}
                        aria-label={`${meta.label} clipping position`}
                        className="flex-1 h-1.5 accent-[var(--accent-primary)] cursor-pointer disabled:opacity-40"
                      />
                      <span className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)] whitespace-nowrap min-w-[68px] text-right">
                        {spec.readoutLabel}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-[var(--text-muted)]">
                  Real 1:1 anatomical planes
                </span>
                <button
                  type="button"
                  onClick={resetClippingPlanes}
                  data-testid="clip-reset-btn"
                  disabled={activeClippingEntries.length === 0}
                  className="h-6 px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[10px] font-medium text-[var(--text-primary)] disabled:opacity-40"
                >
                  Reset Planes
                </button>
              </div>
            </div>
          )}
          </div>
        )}

        {/* Phase 11c: Collapsible Phone-First Vascular Territories Bottom Sheet */}
        {!compact && !hudCollapsed && (
          <div className="w-full flex justify-center pointer-events-none">
            <TerritoryBottomSheet
              onOpenClipping={() => {
                setTerritorySheetOpen(false);
                setAlignmentPanelOpen(false);
                setLayersPopoverTab('clipping');
                setLayersOpen(true);
              }}
              onFocusHeadNeck={handleFocusHeadNeck}
              onInspectDeepMuscle={handleInspectDeepMuscle}
              onFrameBoneRegion={handleFrameBoneRegion}
              onFramePlannerMarker={handleFramePlannerMarker}
              corridorZoomTier={corridorZoomTier}
              realCorridorTerritoryCount={realCorridorTerritoryCount}
            />
          </div>
        )}

        {/* Compact Collapsible Bottom Control Dock */}
        <div className="w-full flex justify-center pointer-events-none">
          {hudCollapsed ? (
            <button
              type="button"
              onClick={() => setHudCollapsed(false)}
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
              title="Expand 3D Controls (H)"
            >
              <Sliders className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>3D Controls</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-md max-w-full">
            {/* Regional Camera Preset Selector */}
            <select
              value={activeCameraPreset}
              onChange={(e) => setCameraPreset(e.target.value)}
              aria-label="Camera Region Preset"
              className="h-7 px-2 rounded-md text-xs bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] max-w-[162px]"
            >
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {/* Dissection Peel Slider */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
              <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">Peel</span>
              <input
                type="range"
                min={0}
                max={100}
                value={dissectionPeel}
                onChange={(e) => setDissectionPeel(Number(e.target.value))}
                className="w-14 sm:w-20 h-1.5 accent-[var(--accent-primary)] cursor-pointer"
                aria-label="Dissection peel slider"
              />
              <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)] w-7 text-right">
                {dissectionPeel}%
              </span>
            </div>

            {/* Layers Popover */}
            <button
              type="button"
              onClick={() => {
                if (layersOpen && layersPopoverTab === 'layers') {
                  setLayersOpen(false);
                } else {
                  setAlignmentPanelOpen(false);
                  setTerritorySheetOpen(false);
                  setLayersPopoverTab('layers');
                  setLayersOpen(true);
                }
              }}
              className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors ${
                layersOpen && layersPopoverTab === 'layers'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
              }`}
              title="Toggle anatomical layers & opacity"
              data-testid="layers-toggle-btn"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Layers</span>
            </button>

            {/* Phase 9c: Vessel View Declutter & Side Filter Popover Shortcut */}
            <button
              type="button"
              onClick={() => {
                if (layersOpen && layersPopoverTab === 'vessels') {
                  setLayersOpen(false);
                } else {
                  setAlignmentPanelOpen(false);
                  setTerritorySheetOpen(false);
                  setLayersPopoverTab('vessels');
                  setLayersOpen(true);
                }
              }}
              className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors ${
                (layersOpen && layersPopoverTab === 'vessels') ||
                vesselPreset !== DEFAULT_VESSEL_PRESET_ID ||
                vesselSideFilter !== DEFAULT_VESSEL_SIDE_FILTER
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
              }`}
              title={`Vessel view: ${getVesselPreset(vesselPreset).label} · Side: ${vesselSideFilter}`}
              data-testid="vessels-filter-toggle-btn"
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {vesselPreset === DEFAULT_VESSEL_PRESET_ID &&
                vesselSideFilter === DEFAULT_VESSEL_SIDE_FILTER
                  ? 'Vessels'
                  : `${getVesselPreset(vesselPreset).shortLabel}${
                      vesselSideFilter !== 'both'
                        ? ` · ${vesselSideFilter === 'left' ? 'L' : 'R'}`
                        : ''
                    }`}
              </span>
            </button>

            {/* Clipping Planes Popover Shortcut */}
            <button
              type="button"
              onClick={() => {
                if (layersOpen && layersPopoverTab === 'clipping') {
                  setLayersOpen(false);
                } else {
                  setAlignmentPanelOpen(false);
                  setTerritorySheetOpen(false);
                  setLayersPopoverTab('clipping');
                  setLayersOpen(true);
                }
              }}
              className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors ${
                (layersOpen && layersPopoverTab === 'clipping') || activeClippingEntries.length > 0
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
              }`}
              title="Axial, Sagittal & Coronal clipping planes"
              data-testid="clipping-toggle-btn"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                Clip{activeClippingEntries.length > 0 ? ` (${activeClippingEntries.length})` : ''}
              </span>
            </button>

            {/* Phase 11c: Vascular Territories Bottom Sheet Toggle */}
            {!compact && (
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !territorySheetOpen;
                  if (nextOpen) {
                    setLayersOpen(false);
                    setAlignmentPanelOpen(false);
                  }
                  setTerritorySheetOpen(nextOpen);
                }}
                className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors whitespace-nowrap ${
                  territoryMode !== 'off' || territorySheetOpen
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                }`}
                title={
                  territoryFieldStatus === 'ready'
                    ? 'Vascular Territories (Angiosomes · Venosomes · Choke & delay)'
                    : 'Vascular Territories (building field…)'
                }
                aria-label="Vascular Territories"
                data-testid="territories-toggle-btn"
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {territoryMode === 'off'
                    ? 'Territories'
                    : territoryMode === 'angiosomes'
                      ? 'Angiosomes'
                      : territoryMode === 'venosomes'
                        ? 'Venosomes'
                        : territoryMode === 'choke_delay'
                          ? 'Choke'
                          : 'Corridors'}
                </span>
              </button>
            )}

            {/* Phase 9b: Editor Mode Vessel & Skin Alignment Calibrator Popover */}
            {editorMode && !compact && !hideAlignmentDockButton && (
              <button
                type="button"
                onClick={() => {
                  const next = !alignmentPanelOpen;
                  if (next) setLayersOpen(false);
                  setAlignmentPanelOpen(next);
                }}
                className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors ${
                  alignmentPanelOpen || calibrationViewActive
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                }`}
                title="BodyParts3D Vessel & Skin Alignment Calibrator (Editor Mode)"
                data-testid="alignment-toggle-btn"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Align</span>
              </button>
            )}

            {/* 3D Floating Callout Labels Toggle */}
            {!compact && (
              <button
                type="button"
                onClick={() => setShow3DLabels(!show3DLabels)}
                className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors ${
                  show3DLabels && !teachingMode
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                }`}
                title="Toggle 3D anatomical callout labels (hidden in Teaching Mode)"
                data-testid="labels-toggle-btn"
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Labels</span>
              </button>
            )}

            {/* Donor vs Recipient PiP Toggle */}
            {!compact && (
              <button
                type="button"
                onClick={() => setShowPipView(!showPipView)}
                className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors ${
                  showPipView
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                }`}
                title="Toggle Donor vs Recipient Picture-in-Picture map"
                data-testid="pip-toggle-btn"
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">PiP</span>
              </button>
            )}

            {/* Arc / Transfer Animation */}
            <button
              type="button"
              onClick={() => setAnimationMode(animationMode === 'arc' ? 'none' : 'arc')}
              className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors ${
                animationMode === 'arc'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
              }`}
              title="Visualize pedicled arc of rotation"
            >
              <Move className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Arc</span>
            </button>

            <button
              type="button"
              onClick={() => setAnimationMode(animationMode === 'transfer' ? 'none' : 'transfer')}
              className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors ${
                animationMode === 'transfer'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
              }`}
              title="Animate free-flap transfer to recipient site"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Transfer</span>
            </button>

            {/* Male / Female Toggle */}
            <button
              type="button"
              onClick={() => setBodySex(bodySex === 'female' ? 'male' : 'female')}
              className="h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]"
              title="Switch male / female anatomical proportion"
            >
              <User className="w-3.5 h-3.5" />
              <span className="capitalize hidden sm:inline">{bodySex}</span>
            </button>

            {/* Surface Measure Tool */}
            <button
              type="button"
              onClick={() => setMeasureMode(!measureMode)}
              className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors ${
                measureMode
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
              }`}
              title="Two-point 3D surface ruler"
            >
              <Ruler className="w-3.5 h-3.5" />
            </button>

            {/* Screenshot & Reset */}
            <button
              type="button"
              onClick={handleScreenshot}
              className="h-7 px-2 rounded-md text-xs bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]"
              title="Export 3D PNG Snapshot"
              aria-label="Export 3D snapshot"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={reset3DView}
              className="h-7 px-2 rounded-md text-xs bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]"
              title="Reset 3D view & layers"
              aria-label="Reset 3D view"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setHudCollapsed(true)}
              className="h-7 px-1.5 rounded-md text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              title="Collapse controls (H)"
              aria-label="Collapse 3D controls"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
