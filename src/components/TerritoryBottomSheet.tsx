import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bone,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Download,
  Layers,
  MapPin,
  Scissors,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  BODY_ANGIOSOMES,
  HEAD_NECK_ANGIOSOMES,
  PERFORATOR_FACTS,
  PERFORATOR_NOMENCLATURE_EXAMPLES,
  PERFORATOR_NOMENCLATURE_RULE,
  type TerritoryRegionFamily,
} from '../data/territories/index';
import { auditFlapDataset } from '../types/schemas';
import {
  BONE_GENERAL_SUPPLY_NOTE,
  BONE_NO_INVENTED_BORDERS_NOTE,
  getBoneEducationalCards,
  getDeepTissueMuscleCatalog,
  getNeurovascularEducationalData,
  type DeepTissueMuscleEntry,
} from '../models/deepTissueTerritories';
import {
  buildCombinedAuditCsv,
  DOPPLER_PLANNER_NOTICE,
  type DopplerPlannerMarker,
  type DopplerPlannerModality,
} from '../models/dopplerPlanner';
import {
  CORRIDOR_SCHEMATIC_TAG,
  getRealSourceArteryCorridorSpecs,
  PERFORASOME_SCHEMATIC_TAG,
  type CorridorZoomTier,
} from '../models/perforatorCorridors';
import {
  REGION_FAMILY_META,
  TERRITORY_SLOT_BY_ID,
} from '../models/territoryPalette';
import {
  formatCoverageBadgeLabel,
  TERRITORY_EDUCATIONAL_DISCLAIMER,
  type TerritoryMode,
  type TerritorySideFilter,
} from '../models/territorySearch';
import { useAtlasStore } from '../store/useAtlasStore';
import { SchematicIconBadge } from './SchematicIconBadge';

interface TerritoryBottomSheetProps {
  embedded?: boolean;
  onOpenClipping: () => void;
  onFocusHeadNeck: () => void;
  onInspectDeepMuscle: (entry: DeepTissueMuscleEntry) => void;
  onFrameBoneRegion: (region: 'forearm' | 'lower_leg') => void;
  onFramePlannerMarker?: (marker: DopplerPlannerMarker) => void;
  corridorZoomTier?: CorridorZoomTier;
  realCorridorTerritoryCount?: number;
}

const MODE_OPTIONS: Array<{ id: TerritoryMode; label: string; shortLabel: string }> = [
  { id: 'off', label: 'Off', shortLabel: 'Off' },
  { id: 'angiosomes', label: 'Angiosomes', shortLabel: 'Angiosomes' },
  { id: 'perforators', label: 'Perforator corridors', shortLabel: 'Corridors' },
  { id: 'venosomes', label: 'Venosomes', shortLabel: 'Venosomes' },
  { id: 'choke_delay', label: 'Choke & delay', shortLabel: 'Choke & delay' },
];

const REGION_ORDER: TerritoryRegionFamily[] = ['head_neck', 'trunk', 'upper_limb', 'lower_limb'];

export const TerritoryBottomSheet: React.FC<TerritoryBottomSheetProps> = ({
  embedded = false,
  onOpenClipping,
  onFocusHeadNeck,
  onInspectDeepMuscle,
  onFrameBoneRegion,
  onFramePlannerMarker,
  corridorZoomTier = 'medium',
}) => {
  const territoryMode = useAtlasStore((s) => s.territoryMode);
  const territorySheetOpen = useAtlasStore((s) => s.territorySheetOpen);
  const territoryOpacity = useAtlasStore((s) => s.territoryOpacity);
  const territorySideFilter = useAtlasStore((s) => s.territorySideFilter);
  const territoryDepth = useAtlasStore((s) => s.territoryDepth);
  const territoryFieldStatus = useAtlasStore((s) => s.territoryFieldStatus);
  const territoryFieldProgress = useAtlasStore((s) => s.territoryFieldProgress);
  const territoryCalibrationReport = useAtlasStore((s) => s.territoryCalibrationReport);
  const focusedTerritoryId = useAtlasStore((s) => s.focusedTerritoryId);
  const selectedSchematicMuscleId = useAtlasStore((s) => s.selectedSchematicMuscleId);
  const selectedAnatomyInfo = useAtlasStore((s) => s.selectedAnatomyInfo);
  const colorblindMode = useAtlasStore((s) => s.colorblindMode);
  const clippingPlanes = useAtlasStore((s) => s.clippingPlanes);
  const flaps = useAtlasStore((s) => s.flaps);
  const selectedFlapId = useAtlasStore((s) => s.selectedFlapId);
  const showPerforatorCorridors = useAtlasStore((s) => s.showPerforatorCorridors);
  const showFlapPerforasomes = useAtlasStore((s) => s.showFlapPerforasomes);
  const plannerDropMode = useAtlasStore((s) => s.plannerDropMode);
  const dopplerPlannerMarkers = useAtlasStore((s) => s.dopplerPlannerMarkers);
  const selectedPlannerMarkerId = useAtlasStore((s) => s.selectedPlannerMarkerId);

  const setTerritoryMode = useAtlasStore((s) => s.setTerritoryMode);
  const setTerritorySheetOpen = useAtlasStore((s) => s.setTerritorySheetOpen);
  const setTerritoryOpacity = useAtlasStore((s) => s.setTerritoryOpacity);
  const setTerritorySideFilter = useAtlasStore((s) => s.setTerritorySideFilter);
  const setTerritoryDepth = useAtlasStore((s) => s.setTerritoryDepth);
  const focusTerritory = useAtlasStore((s) => s.focusTerritory);
  const setClippingAxis = useAtlasStore((s) => s.setClippingAxis);
  const setShowPerforatorCorridors = useAtlasStore((s) => s.setShowPerforatorCorridors);
  const setShowFlapPerforasomes = useAtlasStore((s) => s.setShowFlapPerforasomes);
  const setPlannerDropMode = useAtlasStore((s) => s.setPlannerDropMode);
  const updateDopplerPlannerMarker = useAtlasStore((s) => s.updateDopplerPlannerMarker);
  const deleteDopplerPlannerMarker = useAtlasStore((s) => s.deleteDopplerPlannerMarker);
  const clearDopplerPlannerMarkers = useAtlasStore((s) => s.clearDopplerPlannerMarkers);
  const setSelectedPlannerMarkerId = useAtlasStore((s) => s.setSelectedPlannerMarkerId);

  const [legendOpen, setLegendOpen] = useState(false);
  const [expandedFamily, setExpandedFamily] = useState<TerritoryRegionFamily>('trunk');
  const [deepTissueOpen, setDeepTissueOpen] = useState(false);
  const [deepTissueTab, setDeepTissueTab] = useState<'muscles' | 'bone' | 'nerves'>('muscles');
  const [muscleGroupTab, setMuscleGroupTab] = useState<
    'leg' | 'absent' | 'forearm' | 'head_neck' | 'nv'
  >('leg');
  const [calibrationWarningsOpen, setCalibrationWarningsOpen] = useState(false);
  const [perfSubTab, setPerfSubTab] = useState<'corridors' | 'planner'>('corridors');
  const [perfRulesOpen, setPerfRulesOpen] = useState(false);

  useEffect(() => {
    if (selectedPlannerMarkerId) {
      setPerfSubTab('planner');
    }
  }, [selectedPlannerMarkerId]);

  const selectedFlap = useMemo(
    () => flaps.find((f) => f.id === selectedFlapId) || flaps[0],
    [flaps, selectedFlapId]
  );

  const realCorridorSpecs = useMemo(() => {
    const specs = getRealSourceArteryCorridorSpecs();
    const priorityOrder = [
      'angio-16', // Radial row
      'angio-15', // Ulnar row
      'angio-26', // Anterior tibial septal line
      'angio-30', // Posterior tibial septal line
      'angio-34', // DIEA
      'angio-27', // LCFA
      'angio-37', // Thoracodorsal
      'angio-13', // Profunda brachii
    ];
    return [...specs].sort((a, b) => {
      const ia = priorityOrder.indexOf(a.territoryId);
      const ib = priorityOrder.indexOf(b.territoryId);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return Number(a.fig23_23Number) - Number(b.fig23_23Number);
    });
  }, []);

  const handleExportPlannerAuditCsv = () => {
    const audit = auditFlapDataset(flaps);
    const csv = buildCombinedAuditCsv(flaps, audit, dopplerPlannerMarkers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flapatlas-verification-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const muscleCatalog = useMemo(
    () => getDeepTissueMuscleCatalog(territoryCalibrationReport),
    [territoryCalibrationReport]
  );
  const boneCards = useMemo(() => getBoneEducationalCards(), []);
  const neurovascularData = useMemo(() => getNeurovascularEducationalData(), []);

  const legendByFamily = useMemo(() => {
    const groups: Record<
      TerritoryRegionFamily,
      Array<{
        territoryId: string;
        numberLabel: string;
        name: string;
        abbr: string;
        coverageLabel: string;
        isSchematic: boolean;
        isDeepOnly: boolean;
        swatch: string;
      }>
    > = {
      head_neck: [],
      trunk: [],
      upper_limb: [],
      lower_limb: [],
    };

    for (const a of BODY_ANGIOSOMES) {
      const slot = TERRITORY_SLOT_BY_ID.get(a.id);
      if (!slot) continue;
      groups[a.regionFamily].push({
        territoryId: a.id,
        numberLabel: String(a.fig23_23Number),
        name: a.name,
        abbr: a.abbr,
        coverageLabel: formatCoverageBadgeLabel(a.bp3dCoverage),
        isSchematic: a.bp3dCoverage === 'none',
        isDeepOnly: !a.reachesSkin,
        swatch: colorblindMode ? slot.hexColorblind : slot.hexStandard,
      });
    }

    // Include distinct Fig 23.37 Head & Neck territories (HN-5, HN-11..13)
    for (const hn of HEAD_NECK_ANGIOSOMES) {
      if (hn.bodyAngiosomeId) continue;
      const slot = TERRITORY_SLOT_BY_ID.get(hn.id);
      if (!slot) continue;
      groups.head_neck.push({
        territoryId: hn.id,
        numberLabel: `HN-${hn.fig23_37Number}`,
        name: hn.name,
        abbr: '',
        coverageLabel: formatCoverageBadgeLabel(hn.bp3dCoverage),
        isSchematic: hn.bp3dCoverage === 'none',
        isDeepOnly: !hn.reachesSkin,
        swatch: colorblindMode ? slot.hexColorblind : slot.hexStandard,
      });
    }

    return groups;
  }, [colorblindMode]);

  if (!embedded && !territorySheetOpen) return null;

  const isFieldReady = territoryFieldStatus === 'ready';
  const depthLabel =
    territoryDepth < 34 ? 'Skin' : territoryDepth < 72 ? 'Deep Muscle' : 'Bone';
  const anyClipEnabled =
    clippingPlanes.axial.enabled ||
    clippingPlanes.sagittal.enabled ||
    clippingPlanes.coronal.enabled;

  return (
    <section
      aria-label="Vascular Territories Controls"
      data-testid="territory-bottom-sheet"
      className={
        embedded
          ? 'w-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-hidden flex flex-col'
          : 'pointer-events-auto fixed inset-x-2 bottom-2 z-[55] max-h-[60dvh] sm:static sm:inset-auto sm:z-auto sm:w-[460px] sm:max-h-[370px] max-w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-xl overflow-hidden flex flex-col'
      }
    >
      {/* Header Row */}
      <div className="px-3.5 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
            Vascular Territories
          </div>
          <div className="text-xs text-[var(--text-muted)] truncate">
            {isFieldReady
              ? 'Morris & Taylor · Neligan Vol. 1, Ch. 23 · Tap body to inspect'
              : territoryFieldStatus === 'building'
                ? `${territoryFieldProgress.label || 'Preparing territory map…'} (${territoryFieldProgress.pct}%)`
                : 'Preparing 3D anatomy…'}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {territoryMode !== 'off' && (
            <button
              type="button"
              onClick={() => setTerritoryMode('off')}
              data-testid="territory-exit-mode-btn"
              className="min-h-[44px] px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] whitespace-nowrap"
            >
              Exit Mode
            </button>
          )}
          {!embedded && (
            <button
              type="button"
              onClick={() => setTerritorySheetOpen(false)}
              data-testid="territory-sheet-close-btn"
              aria-label="Close Vascular Territories sheet"
              className="min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 px-3.5 py-3 space-y-3 overflow-y-auto">
        {/* 1. Single-Select Mode Switcher (One Mode at a Time) */}
        <div className="space-y-1.5">
          <div
            role="radiogroup"
            aria-label="Vascular Territory Mode"
            className="flex flex-wrap items-center gap-1"
          >
            {MODE_OPTIONS.map((opt) => {
              const active = territoryMode === opt.id;
              const disabled = opt.id !== 'off' && !isFieldReady;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => setTerritoryMode(opt.id)}
                  data-testid={`territory-mode-${opt.id}`}
                  className={`min-h-[44px] sm:min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 border transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                    active
                      ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                  }`}
                >
                  <span className="sm:hidden">{opt.shortLabel}</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {territoryMode === 'perforators' && (
            <div
              data-testid="perforator-corridors-panel"
              className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Perforator Emergence Corridors
                </span>
                <SchematicIconBadge compact />
              </div>

              {/* Layer toggles: Corridors + Selected Flap Perforasomes */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={showPerforatorCorridors}
                  onClick={() => setShowPerforatorCorridors(!showPerforatorCorridors)}
                  data-testid="toggle-perforator-corridors"
                  className={`min-h-[44px] px-3 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                    showPerforatorCorridors
                      ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Artery Corridors
                </button>
                <button
                  type="button"
                  aria-pressed={showFlapPerforasomes}
                  onClick={() => setShowFlapPerforasomes(!showFlapPerforasomes)}
                  data-testid="toggle-flap-perforasomes"
                  className={`min-h-[44px] px-3 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                    showFlapPerforasomes
                      ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Flap Perforasomes (Fig. 23.25)
                </button>
              </div>

              {showFlapPerforasomes && selectedFlap && (
                <div
                  data-testid="perforasome-schematic-notice"
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs text-[var(--text-secondary)] flex items-center justify-between gap-2"
                >
                  <span className="font-medium text-[var(--text-primary)] truncate">
                    {selectedFlap.name} perforasomes (Fig. 23.25)
                  </span>
                  <SchematicIconBadge compact />
                </div>
              )}

              {/* Zoom clustering status hint */}
              {showPerforatorCorridors &&
                (corridorZoomTier === 'clustered_far' || corridorZoomTier === 'hidden_far') && (
                  <div
                    data-testid="corridor-zoom-hint"
                    className="text-[10px] text-[var(--text-muted)] leading-snug"
                  >
                    {corridorZoomTier === 'hidden_far'
                      ? 'Corridors hidden at far zoom to avoid clutter — zoom in or select a source artery below.'
                      : 'Far zoom: distal corridors clustered — zoom in for full radial, ulnar, and leg septal lines.'}
                  </div>
                )}

              {/* Sub-tabs: Corridors & Rules | Doppler / CTA Planner */}
              <div
                role="tablist"
                aria-label="Perforator mode sections"
                className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={perfSubTab === 'corridors'}
                  data-testid="perf-tab-corridors"
                  onClick={() => setPerfSubTab('corridors')}
                  className={`min-h-[40px] sm:min-h-[28px] px-2 rounded-md text-xs font-medium transition-colors ${
                    perfSubTab === 'corridors'
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Corridors &amp; Rules
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={perfSubTab === 'planner'}
                  data-testid="perf-tab-planner"
                  onClick={() => setPerfSubTab('planner')}
                  className={`min-h-[40px] sm:min-h-[28px] px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    perfSubTab === 'planner'
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>Doppler / CTA Planner</span>
                  {dopplerPlannerMarkers.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[var(--accent-primary)] text-white font-mono text-[10px]">
                      {dopplerPlannerMarkers.length}
                    </span>
                  )}
                </button>
              </div>

              {/* SUB-TAB A: Real-Artery Corridors & Printed Regional Rules */}
              {perfSubTab === 'corridors' && (
                <div className="space-y-2" data-testid="perf-corridors-tab-view">
                  <div className="max-h-44 overflow-y-auto divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)]">
                    {realCorridorSpecs.map((spec) => {
                      const slot = TERRITORY_SLOT_BY_ID.get(spec.territoryId);
                      const swatch = slot
                        ? colorblindMode
                          ? slot.hexColorblind
                          : slot.hexStandard
                        : '#0d9488';
                      const isFocused = focusedTerritoryId === spec.territoryId;
                      return (
                        <button
                          key={spec.territoryId}
                          type="button"
                          onClick={() => {
                            if (!showPerforatorCorridors) setShowPerforatorCorridors(true);
                            focusTerritory(spec.territoryId, territorySideFilter, true);
                            setTerritorySheetOpen(false);
                          }}
                          data-testid={`corridor-item-${spec.territoryId}`}
                          className={`w-full min-h-[44px] sm:min-h-[34px] px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition-colors ${
                            isFocused
                              ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                              : 'hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 mt-1 border border-black/20"
                              style={{ backgroundColor: swatch }}
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">
                                <span className="font-mono text-[11px] mr-1">
                                  {spec.fig23_23Number}.
                                </span>
                                {spec.name}
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] truncate">
                                {spec.emphasisLabel}
                              </div>
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] whitespace-nowrap shrink-0 capitalize">
                            {spec.densityTier}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-xs text-[var(--text-muted)] leading-snug">
                    Leg septal lines (p. 332.e4): anterior tibial and medial-posterior tibial lines
                    shown; confirm individual perforator locations with Doppler or CTA.
                  </p>

                  {/* Collapsible Ch. 23 Perforator Rules & Fig. 23.52 Nomenclature */}
                  <div className="border-t border-[var(--border-subtle)] pt-1.5">
                    <button
                      type="button"
                      onClick={() => setPerfRulesOpen((v) => !v)}
                      aria-expanded={perfRulesOpen}
                      data-testid="perf-rules-toggle"
                      className="w-full min-h-[36px] sm:min-h-[26px] flex items-center justify-between text-[11px] font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                    >
                      <span>Ch. 23 Perforator Rules &amp; Fig. 23.52 Nomenclature</span>
                      {perfRulesOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      )}
                    </button>
                    {perfRulesOpen && (
                      <div
                        data-testid="perf-rules-content"
                        className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto text-[10px] text-[var(--text-secondary)]"
                      >
                        {PERFORATOR_FACTS.slice(0, 7).map((fact) => (
                          <div
                            key={fact.id}
                            className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5"
                          >
                            <div className="font-semibold text-[var(--text-primary)]">
                              {fact.name}{' '}
                              <span className="font-normal text-[var(--text-muted)]">
                                (p. {fact.sourceRef.page})
                              </span>
                            </div>
                            <p className="leading-snug mt-0.5">{fact.summary}</p>
                          </div>
                        ))}
                        <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 space-y-1">
                          <div className="font-semibold text-[var(--text-primary)]">
                            {PERFORATOR_NOMENCLATURE_RULE.name} (Fig. 23.52)
                          </div>
                          <div className="font-mono text-[10px] text-[var(--accent-primary)]">
                            {PERFORATOR_NOMENCLATURE_RULE.formula}
                          </div>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {PERFORATOR_NOMENCLATURE_EXAMPLES.map((ex) => (
                              <span
                                key={ex.id}
                                title={ex.meaning}
                                className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-primary)]"
                              >
                                {ex.code}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-TAB B: Optional Local-Only Doppler / CTA Planner (Fig. 23.48C) */}
              {perfSubTab === 'planner' && (
                <div className="space-y-2.5" data-testid="perf-planner-tab-view">
                  <div
                    data-testid="doppler-planner-notice"
                    className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-900 dark:text-amber-200 leading-snug"
                  >
                    {DOPPLER_PLANNER_NOTICE}
                  </div>

                  {/* Primary Action: Drop Marker on 3-D Skin */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !plannerDropMode;
                        setPlannerDropMode(next);
                        if (next) {
                          setTerritorySheetOpen(false);
                        }
                      }}
                      data-testid="planner-drop-marker-btn"
                      aria-pressed={plannerDropMode}
                      className={`flex-1 min-h-[44px] sm:min-h-[32px] px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-colors ${
                        plannerDropMode
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] hover:opacity-95'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>
                        {plannerDropMode ? 'Tap Skin to Place (Active)' : 'Drop Marker on Skin'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportPlannerAuditCsv}
                      data-testid="planner-export-csv-btn"
                      className="min-h-[44px] sm:min-h-[32px] px-2.5 rounded-lg text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1.5 whitespace-nowrap"
                      title="Export verification audit CSV including local planner markers"
                    >
                      <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Audit CSV</span>
                    </button>
                  </div>

                  {/* Saved Planner Markers (Pure User-Input DIEP Grid Coding, Fig. 23.48C) */}
                  {dopplerPlannerMarkers.length === 0 ? (
                    <div
                      data-testid="planner-empty-state"
                      className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-3 text-center text-[11px] text-[var(--text-muted)] leading-snug"
                    >
                      No local markers yet. Tap <strong>Drop Marker on Skin</strong>, then tap any
                      point on the 3-D skin surface to record pure user-input DIEP grid fields
                      (Fig. 23.48C: R/L, mm from midline, mm inferior to umbilicus, perforator mm).
                    </div>
                  ) : (
                    <div
                      data-testid="planner-marker-list"
                      className="space-y-2 max-h-56 overflow-y-auto pr-0.5"
                    >
                      {dopplerPlannerMarkers.map((m) => {
                        const isSelected = selectedPlannerMarkerId === m.id;
                        return (
                          <div
                            key={m.id}
                            data-testid={`planner-marker-item-${m.id}`}
                            onClick={() => setSelectedPlannerMarkerId(m.id)}
                            className={`rounded-lg border p-2 space-y-2 bg-[var(--bg-surface)] transition-colors ${
                              isSelected
                                ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                                : 'border-[var(--border-subtle)]'
                            }`}
                          >
                            {/* Marker Header: Label + Side + Frame + Delete */}
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={m.label}
                                aria-label="Marker label"
                                data-testid={`planner-label-${m.id}`}
                                onChange={(e) =>
                                  updateDopplerPlannerMarker(m.id, { label: e.target.value })
                                }
                                className="flex-1 min-w-0 h-8 sm:h-7 px-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-primary)]"
                              />
                              <div className="inline-flex rounded border border-[var(--border-subtle)] overflow-hidden shrink-0">
                                {(['R', 'L'] as const).map((sd) => (
                                  <button
                                    key={sd}
                                    type="button"
                                    data-testid={`planner-side-${sd}-${m.id}`}
                                    aria-pressed={m.side === sd}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateDopplerPlannerMarker(m.id, { side: sd });
                                    }}
                                    className={`w-7 h-8 sm:h-7 text-[11px] font-mono font-semibold ${
                                      m.side === sd
                                        ? 'bg-[var(--accent-primary)] text-white'
                                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                                    }`}
                                  >
                                    {sd}
                                  </button>
                                ))}
                              </div>
                              {onFramePlannerMarker && (
                                <button
                                  type="button"
                                  aria-label={`Frame ${m.label}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onFramePlannerMarker(m);
                                  }}
                                  className="w-8 h-8 sm:w-7 sm:h-7 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:border-[var(--accent-primary)] flex items-center justify-center text-[var(--text-primary)] shrink-0"
                                >
                                  <Crosshair className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                aria-label={`Delete ${m.label}`}
                                data-testid={`planner-delete-marker-${m.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteDopplerPlannerMarker(m.id);
                                }}
                                className="w-8 h-8 sm:w-7 sm:h-7 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:border-rose-500 hover:text-rose-600 flex items-center justify-center text-[var(--text-muted)] shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Fig. 23.48C Pure User-Input DIEP Grid Fields */}
                            <div className="grid grid-cols-3 gap-1.5">
                              <label className="space-y-0.5 text-[10px] text-[var(--text-muted)]">
                                <span className="block truncate">Midline (mm)</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={m.midlineMm}
                                  placeholder="user mm"
                                  data-testid={`planner-midline-${m.id}`}
                                  onChange={(e) =>
                                    updateDopplerPlannerMarker(m.id, { midlineMm: e.target.value })
                                  }
                                  className="w-full h-8 sm:h-7 px-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[11px] font-mono text-[var(--text-primary)]"
                                />
                              </label>
                              <label className="space-y-0.5 text-[10px] text-[var(--text-muted)]">
                                <span className="block truncate">Inf. umb. (mm)</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={m.inferiorUmbilicusMm}
                                  placeholder="user mm"
                                  data-testid={`planner-umbilicus-${m.id}`}
                                  onChange={(e) =>
                                    updateDopplerPlannerMarker(m.id, {
                                      inferiorUmbilicusMm: e.target.value,
                                    })
                                  }
                                  className="w-full h-8 sm:h-7 px-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[11px] font-mono text-[var(--text-primary)]"
                                />
                              </label>
                              <label className="space-y-0.5 text-[10px] text-[var(--text-muted)]">
                                <span className="block truncate">Size (mm)</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={m.sizeMm}
                                  placeholder="user mm"
                                  data-testid={`planner-size-${m.id}`}
                                  onChange={(e) =>
                                    updateDopplerPlannerMarker(m.id, { sizeMm: e.target.value })
                                  }
                                  className="w-full h-8 sm:h-7 px-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[11px] font-mono text-[var(--text-primary)]"
                                />
                              </label>
                            </div>

                            {/* Modality + Notes (No PHI) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              <select
                                aria-label="Imaging modality"
                                value={m.modality}
                                data-testid={`planner-modality-${m.id}`}
                                onChange={(e) =>
                                  updateDopplerPlannerMarker(m.id, {
                                    modality: e.target.value as DopplerPlannerModality,
                                  })
                                }
                                className="h-8 sm:h-7 px-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[11px] text-[var(--text-primary)]"
                              >
                                <option value="CTA">CTA (Fig. 23.48C)</option>
                                <option value="Color Duplex">Color Duplex</option>
                                <option value="Handheld Doppler">Handheld Doppler</option>
                                <option value="Other">Other</option>
                              </select>
                              <input
                                type="text"
                                value={m.notes}
                                placeholder="Notes (no PHI)"
                                aria-label="Marker notes without PHI"
                                data-testid={`planner-notes-${m.id}`}
                                onChange={(e) =>
                                  updateDopplerPlannerMarker(m.id, { notes: e.target.value })
                                }
                                className="h-8 sm:h-7 px-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[11px] text-[var(--text-primary)]"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {dopplerPlannerMarkers.length > 0 && (
                    <div className="flex items-center justify-between pt-0.5 text-[10px] text-[var(--text-muted)]">
                      <span>Fig. 23.48C DIEP grid coding · Stored locally only</span>
                      <button
                        type="button"
                        onClick={clearDopplerPlannerMarkers}
                        data-testid="planner-clear-all-btn"
                        className="text-rose-600 dark:text-rose-400 hover:underline font-medium"
                      >
                        Clear all markers
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Depth (Skin <-> Deep <-> Bone), Opacity & Side Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Tissue Depth Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <label htmlFor="territory-depth-slider" className="font-medium text-[var(--text-primary)]">
                Tissue Depth
              </label>
              <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                {depthLabel} · {territoryDepth}%
              </span>
            </div>
            <input
              id="territory-depth-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={territoryDepth}
              disabled={territoryMode === 'off'}
              onChange={(e) => setTerritoryDepth(Number(e.target.value))}
              data-testid="territory-depth-slider"
              className="w-full h-2 accent-[var(--accent-primary)] cursor-pointer disabled:opacity-40"
            />
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <button
                type="button"
                disabled={territoryMode === 'off'}
                onClick={() => setTerritoryDepth(0)}
                data-testid="territory-depth-preset-skin"
                className="min-h-[28px] px-1 hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                Skin
              </button>
              <button
                type="button"
                disabled={territoryMode === 'off'}
                onClick={() => setTerritoryDepth(55)}
                data-testid="territory-depth-preset-muscle"
                className="min-h-[28px] px-1 hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                Deep Muscle
              </button>
              <button
                type="button"
                disabled={territoryMode === 'off'}
                onClick={() => setTerritoryDepth(96)}
                data-testid="territory-depth-preset-bone"
                className="min-h-[28px] px-1 hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                Bone
              </button>
            </div>
          </div>

          {/* Opacity Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <label htmlFor="territory-opacity-slider" className="font-medium text-[var(--text-primary)]">
                Overlay Opacity
              </label>
              <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                {Math.round(territoryOpacity * 100)}%
              </span>
            </div>
            <input
              id="territory-opacity-slider"
              type="range"
              min={15}
              max={95}
              step={1}
              value={Math.round(territoryOpacity * 100)}
              disabled={territoryMode === 'off'}
              onChange={(e) => setTerritoryOpacity(Number(e.target.value) / 100)}
              data-testid="territory-opacity-slider"
              className="w-full h-2 accent-[var(--accent-primary)] cursor-pointer disabled:opacity-40"
            />
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <span>Subtle</span>
              <span>Vivid</span>
            </div>
          </div>
        </div>

        {/* 3. Side Selector + Cross-Section & Head-Neck Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div
            role="group"
            aria-label="Territory side filter"
            className="inline-flex items-center p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
          >
            {(
              [
                { id: 'left', label: 'Left' },
                { id: 'right', label: 'Right' },
                { id: 'both', label: 'Both' },
              ] as Array<{ id: TerritorySideFilter; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={territorySideFilter === opt.id}
                disabled={territoryMode === 'off'}
                onClick={() => setTerritorySideFilter(opt.id)}
                data-testid={`territory-side-${opt.id}`}
                className={`min-h-[40px] sm:min-h-[28px] px-3 rounded-md text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40 ${
                  territorySideFilter === opt.id
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={territoryMode === 'off'}
              onClick={() => {
                if (!anyClipEnabled) {
                  setClippingAxis('axial', { enabled: true, position: 42 });
                }
                onOpenClipping();
              }}
              data-testid="territory-cross-section-btn"
              className={`min-h-[40px] sm:min-h-[30px] px-2.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-40 ${
                anyClipEnabled
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
              }`}
              title="Slice with clipping planes to inspect skin -> muscle -> bone territory layers"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Cross-Section</span>
            </button>

            <button
              type="button"
              disabled={territoryMode === 'off'}
              onClick={() => {
                setExpandedFamily('head_neck');
                setLegendOpen(true);
                onFocusHeadNeck();
              }}
              data-testid="territory-head-neck-btn"
              className="min-h-[40px] sm:min-h-[30px] px-2.5 rounded-lg text-xs font-medium border bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
              title="Frame Head & Neck (Fig. 23.37 — 13 territories)"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Head &amp; Neck</span>
            </button>
          </div>
        </div>

        {/* 4. Collapsible Region-Family Legend */}
        <div className="border-t border-[var(--border-subtle)] pt-2">
          <button
            type="button"
            onClick={() =>
              setLegendOpen((v) => {
                const next = !v;
                if (next) setDeepTissueOpen(false);
                return next;
              })
            }
            aria-expanded={legendOpen}
            data-testid="territory-legend-toggle"
            className="w-full min-h-[40px] sm:min-h-[30px] flex items-center justify-between text-xs font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            <span>
              Region-Family Legend{' '}
              <span className="font-normal text-[var(--text-muted)]">
                · 41 body (Fig. 23.23) + 4 H&amp;N (Fig. 23.37)
              </span>
            </span>
            {legendOpen ? (
              <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </button>

          {legendOpen && (
            <div className="mt-2 space-y-2" data-testid="territory-legend-list">
              {/* Family tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {REGION_ORDER.map((fam) => {
                  const meta = REGION_FAMILY_META[fam];
                  const active = expandedFamily === fam;
                  const swatch = colorblindMode ? meta.colorblindSwatch : meta.standardSwatch;
                  return (
                    <button
                      key={fam}
                      type="button"
                      onClick={() => setExpandedFamily(fam)}
                      data-testid={`territory-legend-family-${fam}`}
                      className={`min-h-[36px] sm:min-h-[28px] px-2.5 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 border transition-colors ${
                        active
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: swatch }}
                        aria-hidden="true"
                      />
                      <span>{meta.label}</span>
                      <span className="font-mono tabular-nums text-[10px] opacity-75">
                        {legendByFamily[fam].length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active family list */}
              <div className="max-h-44 overflow-y-auto divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-lg">
                {legendByFamily[expandedFamily].map((item) => {
                  const isFocused = focusedTerritoryId === item.territoryId;
                  return (
                    <button
                      key={item.territoryId}
                      type="button"
                      onClick={() => {
                        if (territoryMode === 'off' && isFieldReady) {
                          setTerritoryMode('angiosomes');
                        }
                        focusTerritory(item.territoryId, territorySideFilter, true);
                      }}
                      data-testid={`territory-legend-item-${item.territoryId}`}
                      className={`w-full min-h-[44px] sm:min-h-[34px] px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition-colors ${
                        isFocused
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                          : 'hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-xs shrink-0 border border-black/15"
                          style={{
                            backgroundColor: item.swatch,
                            backgroundImage: item.isSchematic
                              ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.45) 2px, rgba(255,255,255,0.45) 4px)'
                              : undefined,
                          }}
                          aria-hidden="true"
                        />
                        <span className="font-mono tabular-nums text-[11px] font-semibold shrink-0 w-9">
                          {item.numberLabel}
                        </span>
                        <span className="text-xs font-medium truncate">
                          {item.name}
                          {item.abbr ? ` (${item.abbr})` : ''}
                        </span>
                      </div>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {item.isDeepOnly && (
                          <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                            Deep only
                          </span>
                        )}
                        {item.isSchematic && <SchematicIconBadge compact />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4b. Phase 11d — Collapsible Deep Tissue: Muscle · Bone · Nerve */}
        <div className="border-t border-[var(--border-subtle)] pt-2">
          <button
            type="button"
            onClick={() =>
              setDeepTissueOpen((v) => {
                const next = !v;
                if (next) setLegendOpen(false);
                return next;
              })
            }
            aria-expanded={deepTissueOpen}
            data-testid="territory-deep-tissue-toggle"
            className="w-full min-h-[44px] sm:min-h-[32px] flex items-center justify-between text-xs font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
              <span className="truncate">
                Deep Tissue: Muscle · Bone · Nerve
              </span>
            </span>
            {deepTissueOpen ? (
              <ChevronUp className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            )}
          </button>

          {deepTissueOpen && (
            <div className="mt-2 space-y-2.5" data-testid="territory-deep-tissue-panel">
              {/* Sub-tab bar: Muscles | Bone | Nerves */}
              <div
                role="tablist"
                aria-label="Deep tissue category"
                className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={deepTissueTab === 'muscles'}
                  data-testid="deep-tissue-tab-muscles"
                  onClick={() => {
                    setDeepTissueTab('muscles');
                    if (territoryMode === 'off' && isFieldReady) {
                      setTerritoryMode('angiosomes');
                    }
                    if (territoryDepth < 40 || territoryDepth > 80) {
                      setTerritoryDepth(55);
                    }
                  }}
                  className={`min-h-[40px] sm:min-h-[30px] px-2 rounded-md text-xs font-medium transition-colors ${
                    deepTissueTab === 'muscles'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Muscles
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={deepTissueTab === 'bone'}
                  data-testid="deep-tissue-tab-bone"
                  onClick={() => {
                    setDeepTissueTab('bone');
                    if (territoryMode === 'off' && isFieldReady) {
                      setTerritoryMode('angiosomes');
                    }
                    setTerritoryDepth(96);
                  }}
                  className={`min-h-[40px] sm:min-h-[30px] px-2 rounded-md text-xs font-medium transition-colors ${
                    deepTissueTab === 'bone'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Bone
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={deepTissueTab === 'nerves'}
                  data-testid="deep-tissue-tab-nerves"
                  onClick={() => setDeepTissueTab('nerves')}
                  className={`min-h-[40px] sm:min-h-[30px] px-2 rounded-md text-xs font-medium transition-colors ${
                    deepTissueTab === 'nerves'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Nerves
                </button>
              </div>

              {/* TAB 1: MUSCLES */}
              {deepTissueTab === 'muscles' && (
                <div className="space-y-2" data-testid="deep-tissue-muscles-view">
                  <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                    Angiosome junctions lie inside muscle bellies (Ch. 23, p. 332.e5). Select a
                    muscle to inspect its intramuscular territory boundaries, book territory count,
                    and Table 23.1 neurovascular type.
                  </p>

                  {/* Calibration Audit Transparency Strip */}
                  {territoryCalibrationReport && (
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1.5 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-[var(--text-secondary)]">
                          Field vs. book audit:{' '}
                          <strong className="text-[var(--text-primary)]">
                            {territoryCalibrationReport.matchedCount}/
                            {territoryCalibrationReport.checkedInBp3dCount}
                          </strong>{' '}
                          matched ·{' '}
                          <span
                            className={
                              territoryCalibrationReport.warningCount > 0
                                ? 'font-semibold text-amber-700 dark:text-amber-300'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }
                          >
                            {territoryCalibrationReport.warningCount} warnings
                          </span>
                        </span>
                        {territoryCalibrationReport.warningCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setCalibrationWarningsOpen((v) => !v)}
                            data-testid="calibration-warnings-toggle"
                            className="text-[10px] font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap"
                          >
                            {calibrationWarningsOpen ? 'Hide warnings' : 'View warnings'}
                          </button>
                        )}
                      </div>
                      {calibrationWarningsOpen && territoryCalibrationReport.warnings.length > 0 && (
                        <ul
                          data-testid="calibration-warnings-list"
                          className="max-h-28 overflow-y-auto space-y-1 pt-1 border-t border-[var(--border-subtle)] text-[10px] text-amber-800 dark:text-amber-300"
                        >
                          {territoryCalibrationReport.warnings.map((w) => (
                            <li key={w.muscleId} className="leading-snug flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>{w.warningMessage}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Muscle group sub-filter */}
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: 'leg', label: `Leg (${muscleCatalog.leg.length})` },
                        {
                          id: 'absent',
                          label: `Illustrative (${muscleCatalog.absentBp3d.length})`,
                        },
                        { id: 'forearm', label: `Forearm (${muscleCatalog.forearm.length})` },
                        {
                          id: 'head_neck',
                          label: `Head & Neck (${muscleCatalog.headNeck.length})`,
                        },
                        {
                          id: 'nv',
                          label: `Trunk/Limb NV (${muscleCatalog.trunkLimbNv.length})`,
                        },
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setMuscleGroupTab(g.id)}
                        data-testid={`deep-muscle-group-${g.id}`}
                        className={`min-h-[36px] sm:min-h-[26px] px-2.5 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 border transition-colors ${
                          muscleGroupTab === g.id
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>

                  {/* Muscle rows */}
                  <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-lg">
                    {(muscleGroupTab === 'leg'
                      ? muscleCatalog.leg
                      : muscleGroupTab === 'absent'
                        ? muscleCatalog.absentBp3d
                        : muscleGroupTab === 'forearm'
                          ? muscleCatalog.forearm
                          : muscleGroupTab === 'head_neck'
                            ? muscleCatalog.headNeck
                            : muscleCatalog.trunkLimbNv
                    ).map((entry) => {
                      const isActive =
                        (!entry.bp3dPresent &&
                          selectedSchematicMuscleId === entry.schematicOutlineId) ||
                        (entry.bp3dPresent &&
                          Boolean(
                            selectedAnatomyInfo?.label
                              ?.toLowerCase()
                              .includes(entry.normalizedName)
                          ));
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            onInspectDeepMuscle(entry);
                            setTerritorySheetOpen(false);
                          }}
                          data-testid={`deep-muscle-row-${entry.id}`}
                          className={`w-full min-h-[44px] sm:min-h-[36px] px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition-colors ${
                            isActive
                              ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                              : 'hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate flex items-center gap-1.5">
                              <span className="truncate">{entry.name}</span>
                              {!entry.bp3dPresent && <SchematicIconBadge compact />}
                              {entry.calibrationEntry?.status === 'warning' && (
                                <span
                                  title={entry.calibrationEntry.warningMessage}
                                  className="inline-flex items-center text-amber-600 dark:text-amber-400 shrink-0"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] truncate">
                              {entry.sourceRef.figureOrTable} · p. {entry.sourceRef.page}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {entry.territoryCountBadge && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] whitespace-nowrap">
                                {entry.territoryCountBadge}
                              </span>
                            )}
                            {entry.neurovascularType && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                                {entry.neurovascularType}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: BONE */}
              {deepTissueTab === 'bone' && (
                <div className="space-y-2.5" data-testid="deep-tissue-bone-view">
                  <div className="rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-2.5 space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                      <Bone className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Skeleton Angiosome Colouring (3-D Field)</span>
                    </div>
                    <p className="text-[var(--text-secondary)] leading-snug">
                      {BONE_GENERAL_SUPPLY_NOTE}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] leading-snug">
                      {BONE_NO_INVENTED_BORDERS_NOTE}
                    </p>
                  </div>

                  {boneCards.map((card) => (
                    <div
                      key={card.id}
                      data-testid={`bone-card-${card.id}`}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-[var(--text-primary)] leading-snug">
                          {card.title}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            onFrameBoneRegion(card.focusRegion);
                            setTerritorySheetOpen(false);
                          }}
                          data-testid={`bone-frame-${card.focusRegion}-btn`}
                          className="min-h-[32px] sm:min-h-[26px] px-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:border-[var(--accent-primary)] text-[10px] font-medium text-[var(--text-primary)] flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Crosshair className="w-3 h-3 text-[var(--accent-primary)]" />
                          <span>{card.focusButtonLabel}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                        {card.summary}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {card.relatedAngiosomes.map((chip) => (
                          <button
                            key={chip.territoryId}
                            type="button"
                            onClick={() => {
                              if (territoryMode === 'off' && isFieldReady) {
                                setTerritoryMode('angiosomes');
                              }
                              focusTerritory(chip.territoryId, territorySideFilter, true);
                              setTerritorySheetOpen(false);
                            }}
                            className="min-h-[26px] px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[10px] text-[var(--text-primary)] flex items-center gap-1"
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
                      <div className="text-[10px] text-[var(--text-muted)]">
                        Morris &amp; Taylor, Ch. {card.sourceRef.chapter}, p. {card.sourceRef.page}{' '}
                        ({card.sourceRef.figureOrTable})
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: NERVES (Educational Cards Only — Zero 3D Nerve Geometry) */}
              {deepTissueTab === 'nerves' && (
                <div className="space-y-2.5" data-testid="deep-tissue-nerves-view">
                  <div
                    data-testid="nerves-educational-only-notice"
                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-900 dark:text-amber-200 leading-snug flex items-start gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>{neurovascularData.noGeometryNotice}</span>
                  </div>

                  {/* Patterns A–E (Figs. 23.15–23.16) */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                      Neurovascular Relationship Patterns A–E (Figs. 23.15–23.16)
                    </div>
                    <div className="space-y-1.5">
                      {neurovascularData.patterns.map((pat) => (
                        <div
                          key={pat.id}
                          data-testid={`nv-pattern-card-${pat.patternCode?.toLowerCase()}`}
                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-2 space-y-0.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                              {pat.patternCode}
                            </span>
                            <span className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight">
                              {pat.name.replace(/^Neurovascular Pattern [A-E]\s*—\s*/, '')}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)] leading-snug pl-6">
                            {pat.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Venous pairing & named neurovascular examples */}
                  {neurovascularData.clinicalExamples && (
                    <div
                      data-testid="nv-clinical-examples-card"
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 space-y-1"
                    >
                      <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                        {neurovascularData.clinicalExamples.name}
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                        {neurovascularData.clinicalExamples.summary}
                      </p>
                    </div>
                  )}

                  {/* Fig. 23.46 Upper-Limb Cutaneous Nerves */}
                  <div
                    data-testid="nv-upper-limb-nerves-list"
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 space-y-1"
                  >
                    <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                      Upper-Limb Cutaneous Nerves (Fig. 23.46, p. 335)
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-[var(--text-secondary)]">
                      {neurovascularData.upperLimbCutaneousNerves.map((nerve) => (
                        <li key={nerve} className="truncate">
                          · {nerve}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-[10px] text-[var(--text-muted)]">
                    Source: Morris &amp; Taylor, Neligan Vol. 1, Ch.{' '}
                    {neurovascularData.sourceRef.chapter}, pp. {neurovascularData.sourceRef.page} (
                    {neurovascularData.sourceRef.figureOrTable})
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Mandatory Honest Educational Disclaimer (§9.3) */}
        <p className="text-[10px] leading-snug text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-2">
          {TERRITORY_EDUCATIONAL_DISCLAIMER}
        </p>
      </div>
    </section>
  );
};
