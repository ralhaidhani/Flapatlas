import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Info,
  Lightbulb,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  loadOperativeGuide,
  OPERATIVE_GUIDE_BANNER,
  OPERATIVE_PHASE_ORDER,
  type OperativeAdjacentItem,
  type OperativeAvoidNecrosisItem,
  type OperativeGuide,
  type OperativeSeverity,
} from '../data/operative';
import {
  auditOperativeGuideUnresolvedNames,
  mapOperativeLayerName,
  resolveOperativeStepView,
  resolveOperativeStructureName,
  type OperativeLayerKey,
} from '../data/operative/structureResolver';
import { useAtlasStore } from '../store/useAtlasStore';
import { SchematicIconBadge } from './SchematicIconBadge';

interface OperativeGuideTabProps {
  flapId: string;
  flapName: string;
}

const CHECKLIST_SESSION_PREFIX = 'flapatlas_opguide_checklist_v1:';

function loadSessionChecklist(flapId: string): Record<string, boolean> {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(`${CHECKLIST_SESSION_PREFIX}${flapId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, boolean>;
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return {};
}

function saveSessionChecklist(flapId: string, state: Record<string, boolean>): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(`${CHECKLIST_SESSION_PREFIX}${flapId}`, JSON.stringify(state));
    }
  } catch {
    // Ignore storage write errors
  }
}

function severityCalloutClasses(severity: OperativeSeverity): string {
  if (severity === 'critical') {
    return 'bg-red-500/12 border-red-500/45 text-red-100';
  }
  if (severity === 'major') {
    return 'bg-amber-500/12 border-amber-500/45 text-amber-100';
  }
  return 'bg-sky-500/10 border-sky-500/35 text-sky-100';
}

function severityBadgeClasses(severity: OperativeSeverity): string {
  if (severity === 'critical') {
    return 'bg-red-500/20 text-red-300 border-red-500/45';
  }
  if (severity === 'major') {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/45';
  }
  return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
}

const OperativeGuideTab: React.FC<OperativeGuideTabProps> = ({ flapId, flapName }) => {
  const donorSide = useAtlasStore((s) => s.donorSide);
  const loadedStructuresCatalog = useAtlasStore((s) => s.loadedStructuresCatalog);
  const customAnatomyOverrides = useAtlasStore((s) => s.customAnatomyOverrides);
  const operativeViewState = useAtlasStore((s) => s.operativeViewState);
  const applyOperativeStepView = useAtlasStore((s) => s.applyOperativeStepView);
  const highlightOperativeStructures = useAtlasStore((s) => s.highlightOperativeStructures);
  const clearOperativeView = useAtlasStore((s) => s.clearOperativeView);
  const setOperativeUnresolvedReport = useAtlasStore((s) => s.setOperativeUnresolvedReport);

  const [guide, setGuide] = useState<OperativeGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [preopOpen, setPreopOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [numbersOpen, setNumbersOpen] = useState(false);
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() =>
    loadSessionChecklist(flapId)
  );
  const [activeAdjacentKey, setActiveAdjacentKey] = useState<string | null>(null);

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Lazy-load the flap's operative guide whenever flapId changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStepIdx(0);
    setActiveAdjacentKey(null);
    setCheckedMap(loadSessionChecklist(flapId));
    clearOperativeView();

    loadOperativeGuide(flapId)
      .then((loaded) => {
        if (cancelled) return;
        setGuide(loaded);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setGuide(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [flapId, clearOperativeView]);

  // Restore previous layer state when leaving the Operative guide tab (unmount)
  useEffect(() => {
    return () => {
      useAtlasStore.getState().clearOperativeView();
    };
  }, []);

  // Audit unresolved structure names silently and report them to the Editor report
  useEffect(() => {
    if (!guide || loadedStructuresCatalog.length === 0) return;
    const unresolved = auditOperativeGuideUnresolvedNames(
      guide,
      flapId,
      loadedStructuresCatalog,
      donorSide,
      customAnatomyOverrides
    );
    setOperativeUnresolvedReport(unresolved);
  }, [
    guide,
    flapId,
    loadedStructuresCatalog,
    donorSide,
    customAnatomyOverrides,
    setOperativeUnresolvedReport,
  ]);

  const steps = guide?.steps ?? [];
  const currentStep = steps[stepIdx] ?? null;

  const phaseIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    steps.forEach((st, idx) => {
      if (!map.has(st.phase)) {
        map.set(st.phase, idx);
      }
    });
    return map;
  }, [steps]);

  const adjacentResolutions = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveOperativeStructureName>>();
    if (!guide) return map;
    const allNames = new Set<string>();
    for (const item of guide.adjacent.perforator) allNames.add(item.structure);
    for (const item of guide.adjacent.flap) allNames.add(item.structure);
    for (const st of guide.steps) {
      for (const s of st.structuresAtRisk) allNames.add(s);
    }
    allNames.forEach((name) => {
      map.set(
        name,
        resolveOperativeStructureName(
          name,
          loadedStructuresCatalog,
          donorSide,
          customAnatomyOverrides
        )
      );
    });
    return map;
  }, [guide, loadedStructuresCatalog, donorSide, customAnatomyOverrides]);

  const groupedAvoidNecrosis = useMemo(() => {
    const groups: Array<{ stage: string; items: Array<{ key: string; item: OperativeAvoidNecrosisItem }> }> = [];
    if (!guide) return groups;
    const byStage = new Map<string, Array<{ key: string; item: OperativeAvoidNecrosisItem }>>();
    guide.avoidNecrosis.forEach((item, idx) => {
      const list = byStage.get(item.stage) ?? [];
      list.push({ key: `${item.stage}:${idx}`, item });
      byStage.set(item.stage, list);
    });
    byStage.forEach((items, stage) => groups.push({ stage, items }));
    return groups;
  }, [guide]);

  const totalChecklistCount = guide?.avoidNecrosis.length ?? 0;
  const checkedCount = useMemo(() => {
    if (!guide) return 0;
    return guide.avoidNecrosis.reduce((acc, item, idx) => {
      const key = `${item.stage}:${idx}`;
      return acc + (checkedMap[key] ? 1 : 0);
    }, 0);
  }, [guide, checkedMap]);

  const handleToggleChecklist = (key: string) => {
    setCheckedMap((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSessionChecklist(flapId, next);
      return next;
    });
  };

  const handleResetChecklist = () => {
    setCheckedMap({});
    saveSessionChecklist(flapId, {});
  };

  const handleShowStepIn3D = (targetIdx: number) => {
    const step = steps[targetIdx];
    if (!step) return;
    const resolved = resolveOperativeStepView(
      step.view,
      loadedStructuresCatalog,
      donorSide,
      customAnatomyOverrides
    );
    setActiveAdjacentKey(null);
    applyOperativeStepView({
      flapId,
      stepN: step.n,
      layerVisibilityPatch: resolved.layerVisibilityPatch,
      highlightMeshKeys: resolved.highlightMeshKeys,
      hideMeshKeys: resolved.hideMeshKeys,
      cameraPreset: resolved.cameraPreset,
    });
  };

  const handleHighlightStructureChip = (structureName: string) => {
    const res = adjacentResolutions.get(structureName);
    if (!res || !res.resolved || res.matchedMeshKeys.length === 0) return;
    const ensureLayers = new Set<OperativeLayerKey>();
    for (const item of loadedStructuresCatalog) {
      if (!res.matchedMeshKeys.includes(item.meshKey)) continue;
      const lk = mapOperativeLayerName(item.system);
      if (lk) ensureLayers.add(lk);
    }
    setActiveAdjacentKey(structureName);
    highlightOperativeStructures({
      flapId,
      meshKeys: res.matchedMeshKeys,
      ensureLayers: Array.from(ensureLayers),
    });
  };

  const goToStep = (nextIdx: number) => {
    if (steps.length === 0) return;
    const clamped = Math.max(0, Math.min(steps.length - 1, nextIdx));
    setStepIdx(clamped);
    // If 3D operative view is already active, keep 3D synced as the user steps through
    if (operativeViewState.active && operativeViewState.flapId === flapId) {
      handleShowStepIn3D(clamped);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.changedTouches[0];
    if (!t) return;
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0 && stepIdx < steps.length - 1) {
        goToStep(stepIdx + 1);
      } else if (dx > 0 && stepIdx > 0) {
        goToStep(stepIdx - 1);
      }
    }
  };

  const renderAdjacentList = (
    title: string,
    items: OperativeAdjacentItem[],
    testId: string
  ) => (
    <div
      className="rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] overflow-hidden"
      data-testid={testId}
    >
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        {title} ({items.length})
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {items.map((item, idx) => {
          const res = adjacentResolutions.get(item.structure);
          const inModel = Boolean(res && res.resolved && res.matchedMeshKeys.length > 0);
          const isSelectedChip = activeAdjacentKey === item.structure && operativeViewState.active;

          return (
            <div key={`${item.structure}-${idx}`} className="p-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {inModel ? (
                  <button
                    type="button"
                    onClick={() => handleHighlightStructureChip(item.structure)}
                    data-testid={`adjacent-chip-${item.structure.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className={`min-h-[44px] px-3 py-1.5 rounded-lg border text-sm font-semibold inline-flex items-center gap-1.5 transition-colors text-left ${
                      isSelectedChip
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--accent-primary)]/50 hover:border-[var(--accent-primary)]'
                    }`}
                  >
                    <Eye className="w-4 h-4 shrink-0" />
                    <span>{item.structure}</span>
                  </button>
                ) : (
                  <div
                    className="min-h-[44px] px-3 py-1.5 rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 text-[var(--text-muted)] text-sm font-medium inline-flex items-center gap-2 opacity-75"
                    data-testid={`adjacent-chip-schematic-${item.structure.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  >
                    <span>{item.structure}</span>
                    <SchematicIconBadge compact />
                  </div>
                )}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-muted)]">Relation: </span>
                {item.relation}
              </div>
              <div className="text-sm text-amber-200/90">
                <span className="font-semibold text-amber-300">Risk: </span>
                {item.risk}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 text-sm leading-relaxed" data-testid="operative-guide-tab">
      {/* Permanent one-line educational honesty banner */}
      <div
        className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/35 text-xs text-amber-200 flex items-center gap-2"
        role="note"
        data-testid="operative-guide-banner"
      >
        <Info className="w-4 h-4 shrink-0 text-amber-400" />
        <span>{OPERATIVE_GUIDE_BANNER}</span>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
          Loading operative guide…
        </div>
      ) : !guide || steps.length === 0 ? (
        <div
          className="p-6 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-center space-y-2"
          data-testid="operative-guide-empty"
        >
          <BookOpen className="w-7 h-7 mx-auto text-[var(--text-muted)]" />
          <div className="text-base font-semibold text-[var(--text-primary)]">
            Operative guide not available yet
          </div>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            A structured operative guide has not been added for {flapName} yet. Standard vascular
            anatomy, dimensions, and technique notes remain available in the other tabs.
          </p>
        </div>
      ) : (
        <>
          {/* Overview + Status */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-[var(--text-primary)] text-sm">
                {guide.flapId}
              </div>
              <span className="px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/12 text-amber-300 text-xs font-medium">
                {guide.verificationStatus === 'needs_review'
                  ? 'Needs review'
                  : guide.verificationStatus === 'partially_verified'
                    ? 'Partially verified'
                    : 'Verified'}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{guide.overview}</p>

            {/* Collapsible Pre-op & References toggles */}
            <div className="flex flex-wrap gap-2 pt-1">
              {guide.preop.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPreopOpen((v) => !v)}
                  className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5"
                >
                  {preopOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span>Pre-op planning ({guide.preop.length})</span>
                </button>
              )}
              {guide.refs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRefsOpen((v) => !v)}
                  className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5"
                >
                  {refsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span>References ({guide.refs.length})</span>
                </button>
              )}
            </div>

            {preopOpen && guide.preop.length > 0 && (
              <ul className="list-disc pl-5 space-y-1.5 pt-2 border-t border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
                {guide.preop.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}

            {refsOpen && guide.refs.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                {guide.refs.map((ref, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm space-y-0.5"
                  >
                    <div className="font-medium text-[var(--text-primary)]">{ref.book}</div>
                    <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-2">
                      <span>{ref.locator}</span>
                      {!ref.pageVerified && (
                        <span className="text-amber-300 font-medium">Page unverified</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* (1) Operative Stepper */}
          <section className="space-y-3" aria-label="Operative steps" data-testid="operative-stepper">
            {/* Phase chips */}
            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
              role="tablist"
              aria-label="Operative phases"
            >
              {OPERATIVE_PHASE_ORDER.map((phase) => {
                const targetIdx = phaseIndexMap.get(phase);
                const hasPhase = targetIdx !== undefined;
                const isCurrent = currentStep?.phase === phase;
                return (
                  <button
                    key={phase}
                    type="button"
                    disabled={!hasPhase}
                    onClick={() => {
                      if (targetIdx !== undefined) goToStep(targetIdx);
                    }}
                    data-testid={`operative-phase-${phase.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                      isCurrent
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : hasPhase
                          ? 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                          : 'bg-[var(--bg-subtle)]/40 text-[var(--text-muted)] border-[var(--border-subtle)]/50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {phase}
                  </button>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  Step {stepIdx + 1} of {steps.length}
                </span>
                <span>{currentStep?.phase}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden border border-[var(--border-subtle)]">
                <div
                  className="h-full bg-[var(--accent-primary)] transition-all duration-200"
                  style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Single step card (swipeable horizontally) */}
            {currentStep && (
              <div
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-4"
                data-testid={`operative-step-card-${currentStep.n}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                      Step {currentStep.n} · {currentStep.phase}
                    </div>
                    <h3 className="text-base font-bold text-[var(--text-primary)] leading-snug">
                      {currentStep.title}
                    </h3>
                  </div>

                  {/* (2) Show in 3D + Restore layers */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleShowStepIn3D(stepIdx)}
                      data-testid="operative-show-in-3d-btn"
                      className={`min-h-[44px] px-3.5 rounded-lg border text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${
                        operativeViewState.active && operativeViewState.stepN === currentStep.n
                          ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-surface)] text-[var(--accent-primary)] border-[var(--accent-primary)]/60 hover:bg-[var(--accent-primary)]/10'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>Show in 3D</span>
                    </button>
                    {operativeViewState.active && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAdjacentKey(null);
                          clearOperativeView();
                        }}
                        title="Restore previous 3D layers"
                        aria-label="Restore previous 3D layers"
                        data-testid="operative-restore-3d-btn"
                        className="min-h-[44px] px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions (numbered) */}
                {currentStep.actions.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Actions
                    </div>
                    <ol className="space-y-2">
                      {currentStep.actions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-sm text-[var(--text-primary)]">
                          <span className="w-6 h-6 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-primary)] flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="flex-1">{action}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Structures at risk (chips) */}
                {currentStep.structuresAtRisk.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Structures at risk
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentStep.structuresAtRisk.map((struct, idx) => {
                        const res = adjacentResolutions.get(struct);
                        const inModel = Boolean(res && res.resolved && res.matchedMeshKeys.length > 0);
                        return inModel ? (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleHighlightStructureChip(struct)}
                            className="min-h-[44px] px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-sm text-amber-200 hover:bg-amber-500/20 inline-flex items-center gap-1.5"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{struct}</span>
                          </button>
                        ) : (
                          <span
                            key={idx}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] inline-flex items-center gap-1.5"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{struct}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pearls */}
                {currentStep.pearls.length > 0 && (
                  <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/30 space-y-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Pearls</span>
                    </div>
                    <ul className="space-y-1 text-sm text-teal-100">
                      {currentStep.pearls.map((p, idx) => (
                        <li key={idx}>• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings — colour-coded callouts, NEVER collapsed */}
                {currentStep.warnings.length > 0 && (
                  <div className="space-y-2" data-testid="operative-step-warnings">
                    {currentStep.warnings.map((w, idx) => (
                      <div
                        key={idx}
                        role="alert"
                        className={`p-3 rounded-lg border space-y-1 ${severityCalloutClasses(w.severity)}`}
                      >
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                          {w.severity === 'critical' ? (
                            <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          )}
                          <span>{w.severity} warning</span>
                        </div>
                        <div className="text-sm font-semibold">{w.text}</div>
                        <div className="text-sm opacity-90">{w.why}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Big Previous / Next navigation buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    disabled={stepIdx === 0}
                    onClick={() => goToStep(stepIdx - 1)}
                    data-testid="operative-prev-step-btn"
                    className="min-h-[48px] px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--accent-primary)]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    disabled={stepIdx >= steps.length - 1}
                    onClick={() => goToStep(stepIdx + 1)}
                    data-testid="operative-next-step-btn"
                    className="min-h-[48px] px-4 rounded-xl bg-[var(--accent-primary)] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* (3) Adjacent structures: around perforator & around flap */}
          <section className="space-y-3" aria-label="Adjacent structures" data-testid="operative-adjacent-section">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Adjacent structures
            </h4>
            {renderAdjacentList(
              'Around the perforator',
              guide.adjacent.perforator,
              'operative-adjacent-perforator'
            )}
            {renderAdjacentList(
              'Around the flap',
              guide.adjacent.flap,
              'operative-adjacent-flap'
            )}
          </section>

          {/* (4) Avoiding flap loss — grouped by stage, session-tickable checklist */}
          <section className="space-y-3" aria-label="Avoiding flap loss" data-testid="operative-avoid-necrosis">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Avoiding flap loss ({checkedCount}/{totalChecklistCount})
                </h4>
              </div>
              {checkedCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetChecklist}
                  className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                >
                  Reset ticks
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {groupedAvoidNecrosis.map((group) => (
                <div
                  key={group.stage}
                  className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-[var(--border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {group.stage}
                  </div>
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {group.items.map(({ key, item }) => {
                      const isChecked = Boolean(checkedMap[key]);
                      return (
                        <label
                          key={key}
                          className="flex items-start gap-3 p-3 cursor-pointer hover:bg-[var(--bg-surface)]/50 transition-colors"
                          data-testid={`avoid-necrosis-item-${key}`}
                        >
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            onClick={(e) => {
                              e.preventDefault();
                              handleToggleChecklist(key);
                            }}
                            className={`mt-0.5 w-6 h-6 min-w-[24px] rounded-md border flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-transparent'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  isChecked
                                    ? 'line-through text-[var(--text-muted)]'
                                    : 'text-[var(--text-primary)]'
                                }`}
                              >
                                {item.rule}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded border text-[11px] font-semibold uppercase ${severityBadgeClasses(
                                  item.severity
                                )}`}
                              >
                                {item.severity}
                              </span>
                            </div>
                            <div className="text-sm text-[var(--text-secondary)]">
                              {item.rationale}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* (5) Monitoring, Salvage & Collapsed "Numbers to verify" */}
          <section className="space-y-3" aria-label="Monitoring, salvage and reference numbers">
            {guide.monitoring.length > 0 && (
              <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Monitoring</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                  {guide.monitoring.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {guide.salvage.length > 0 && (
              <div className="p-3.5 rounded-xl bg-red-500/8 border border-red-500/35 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-red-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>Salvage</span>
                </div>
                <ul className="space-y-1.5 text-sm text-red-100">
                  {guide.salvage.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {guide.numbers.length > 0 && (
              <div
                className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] overflow-hidden"
                data-testid="operative-numbers-to-verify"
              >
                <button
                  type="button"
                  onClick={() => setNumbersOpen((v) => !v)}
                  aria-expanded={numbersOpen}
                  className="w-full min-h-[48px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/50"
                >
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Numbers to verify ({guide.numbers.length})</span>
                  </span>
                  {numbersOpen ? (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </button>
                {numbersOpen && (
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
                    {guide.numbers.map((num, idx) => (
                      <div key={idx} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-[var(--text-primary)]">{num.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-secondary)]">{num.value}</span>
                          {num.verify && (
                            <span className="px-1.5 py-0.5 rounded border border-amber-500/45 bg-amber-500/15 text-amber-300 text-[11px] font-semibold uppercase">
                              Verify
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default OperativeGuideTab;
