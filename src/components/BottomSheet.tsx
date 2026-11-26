import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react';
import { AppTab, SheetSnap, useAtlasStore } from '../store/useAtlasStore';
import { AnatomyExplorerPanel } from './AnatomyExplorerPanel';
import { FlapDetailPanel } from './FlapDetailPanel';
import { FlapLibraryPanel } from './FlapLibraryPanel';
import { LayersSheetPanel } from './LayersSheetPanel';
import { SchematicMuscleDetailCard } from './SchematicMuscleDetailCard';
import { SelectedStructureCard } from './SelectedStructureCard';
import { TerritoryDetailCard } from './TerritoryDetailCard';
import { MUSCLE_REFERENCE_BY_ID } from '../data/muscleReference';

const FlapAdvisorView = lazy(() =>
  import('./FlapAdvisorView').then((m) => ({ default: m.FlapAdvisorView }))
);
const CompareView = lazy(() =>
  import('./CompareView').then((m) => ({ default: m.CompareView }))
);
const SimulatorsView = lazy(() =>
  import('./SimulatorsView').then((m) => ({ default: m.SimulatorsView }))
);
const QuizView = lazy(() => import('./QuizView').then((m) => ({ default: m.QuizView })));
const CasePlannerView = lazy(() =>
  import('./CasePlannerView').then((m) => ({ default: m.CasePlannerView }))
);
const GlossaryView = lazy(() =>
  import('./GlossaryView').then((m) => ({ default: m.GlossaryView }))
);
const SettingsDataQualityView = lazy(() =>
  import('./SettingsDataQualityView').then((m) => ({ default: m.SettingsDataQualityView }))
);
const AnchorCalibrationView = lazy(() =>
  import('./AnchorCalibrationView').then((m) => ({ default: m.AnchorCalibrationView }))
);
const AboutCreditsView = lazy(() =>
  import('./AboutCreditsView').then((m) => ({ default: m.AboutCreditsView }))
);

export const SHEET_TABS: Array<{ id: AppTab; label: string }> = [
  { id: 'library', label: 'Flaps' },
  { id: 'layers', label: 'Layers' },
  { id: 'anatomy', label: 'Anatomy' },
  { id: 'advisor', label: 'Advisor' },
  { id: 'compare', label: 'Compare' },
  { id: 'tools', label: 'Tools' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'settings', label: 'Settings' },
];

const COLLAPSED_HEIGHT_PX = 84;
const FULL_RATIO = 0.92;
const HALF_RATIO = 0.45;

const SheetFallback: React.FC = () => (
  <div className="p-4 space-y-3 animate-pulse">
    <div className="h-6 w-48 rounded bg-[var(--bg-subtle)]" />
    <div className="h-28 rounded-xl bg-[var(--bg-subtle)]" />
    <div className="h-28 rounded-xl bg-[var(--bg-subtle)]" />
  </div>
);

function useViewportMetrics() {
  const [metrics, setMetrics] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 390,
    height: typeof window !== 'undefined' ? window.innerHeight : 844,
  }));

  useEffect(() => {
    const update = () => {
      setMetrics({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const isLandscape = metrics.width > metrics.height && metrics.width >= 640;
  return { ...metrics, isLandscape };
}

export const BottomSheet: React.FC = () => {
  const activeTab = useAtlasStore((s) => s.activeTab);
  const sheetSnap = useAtlasStore((s) => s.sheetSnap);
  const flaps = useAtlasStore((s) => s.flaps);
  const selectedFlapId = useAtlasStore((s) => s.selectedFlapId);
  const hasSelectedFlap = useAtlasStore((s) => s.hasSelectedFlap);
  const flapsSheetMode = useAtlasStore((s) => s.flapsSheetMode);
  const selectedAnatomyInfo = useAtlasStore((s) => s.selectedAnatomyInfo);
  const selectedMuscleRefId = useAtlasStore((s) => s.selectedMuscleRefId);
  const focusedTerritoryId = useAtlasStore((s) => s.focusedTerritoryId);
  const selectedSchematicMuscleId = useAtlasStore((s) => s.selectedSchematicMuscleId);
  const territoryMode = useAtlasStore((s) => s.territoryMode);
  const toolsSubTab = useAtlasStore((s) => s.toolsSubTab);
  const editorMode = useAtlasStore((s) => s.editorMode);

  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const setSheetSnap = useAtlasStore((s) => s.setSheetSnap);
  const setFlapsSheetMode = useAtlasStore((s) => s.setFlapsSheetMode);
  const setToolsSubTab = useAtlasStore((s) => s.setToolsSubTab);
  const setIsolateTerritoryArtery = useAtlasStore((s) => s.setIsolateTerritoryArtery);
  const setCameraPreset = useAtlasStore((s) => s.setCameraPreset);

  const { height: vh, isLandscape } = useViewportMetrics();

  const fullPx = Math.max(320, Math.round(vh * FULL_RATIO));
  const halfPx = Math.max(220, Math.round(vh * HALF_RATIO));

  // Transform offsets relative to the full-height (92dvh) portrait sheet anchored at bottom:0
  const snapOffsets = useMemo(
    () => ({
      full: 0,
      half: Math.max(0, fullPx - halfPx),
      collapsed: Math.max(0, fullPx - COLLAPSED_HEIGHT_PX),
    }),
    [fullPx, halfPx]
  );

  const [dragTranslateY, setDragTranslateY] = useState<number | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startY: number;
    startTranslateY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    moved: boolean;
  } | null>(null);

  const selectedFlap = useMemo(
    () => flaps.find((f) => f.id === selectedFlapId) || flaps[0],
    [flaps, selectedFlapId]
  );

  // One-line contextual title for the collapsed header bar
  const sheetTitle = useMemo(() => {
    if (selectedMuscleRefId) {
      const m = MUSCLE_REFERENCE_BY_ID.get(selectedMuscleRefId);
      if (m) return m.name;
    }
    if (selectedAnatomyInfo) return selectedAnatomyInfo.label;
    if (hasSelectedFlap && selectedFlap && activeTab === 'library') return selectedFlap.name;
    if (activeTab === 'about') return 'About & Credits';
    const found = SHEET_TABS.find((t) => t.id === activeTab);
    return found ? `FlapAtlas 3D · ${found.label}` : 'FlapAtlas 3D';
  }, [selectedMuscleRefId, selectedAnatomyInfo, hasSelectedFlap, selectedFlap, activeTab]);

  // Portrait drag-handle pointer gesture (velocity-based snapping, transform-only)
  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isLandscape) return;
      // Don't hijack clicks on buttons inside the header
      if ((e.target as HTMLElement).closest('button')) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const startTranslateY = snapOffsets[sheetSnap];
      dragStateRef.current = {
        active: true,
        pointerId: e.pointerId,
        startY: e.clientY,
        startTranslateY,
        lastY: e.clientY,
        lastTime: performance.now(),
        velocityY: 0,
        moved: false,
      };
      setDragTranslateY(startTranslateY);
    },
    [isLandscape, snapOffsets, sheetSnap]
  );

  const onHandlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragStateRef.current;
      if (!ds || !ds.active || ds.pointerId !== e.pointerId) return;
      e.stopPropagation();
      const now = performance.now();
      const dt = Math.max(1, now - ds.lastTime);
      const dy = e.clientY - ds.lastY;
      ds.velocityY = dy / dt; // px per ms (positive = downward)
      ds.lastY = e.clientY;
      ds.lastTime = now;
      if (Math.abs(e.clientY - ds.startY) > 6) {
        ds.moved = true;
      }
      const nextY = Math.max(
        snapOffsets.full,
        Math.min(snapOffsets.collapsed, ds.startTranslateY + (e.clientY - ds.startY))
      );
      setDragTranslateY(nextY);
    },
    [snapOffsets]
  );

  const finishDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragStateRef.current;
      if (!ds || !ds.active || ds.pointerId !== e.pointerId) return;
      e.stopPropagation();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }

      const currentY = Math.max(
        snapOffsets.full,
        Math.min(snapOffsets.collapsed, ds.startTranslateY + (e.clientY - ds.startY))
      );
      const v = ds.velocityY;
      const moved = ds.moved;
      dragStateRef.current = null;
      setDragTranslateY(null);

      // Tap on handle cycles collapsed -> half -> full -> collapsed
      if (!moved) {
        const next: SheetSnap =
          sheetSnap === 'collapsed' ? 'half' : sheetSnap === 'half' ? 'full' : 'collapsed';
        setSheetSnap(next);
        return;
      }

      // Velocity-based snap decision
      let target: SheetSnap;
      if (v < -0.45) {
        // Fast flick upward
        target = currentY > snapOffsets.half + 20 ? 'half' : 'full';
      } else if (v > 0.45) {
        // Fast flick downward
        target = currentY < snapOffsets.half - 20 ? 'half' : 'collapsed';
      } else {
        // Nearest snap point
        const candidates: Array<{ snap: SheetSnap; dist: number }> = [
          { snap: 'full', dist: Math.abs(currentY - snapOffsets.full) },
          { snap: 'half', dist: Math.abs(currentY - snapOffsets.half) },
          { snap: 'collapsed', dist: Math.abs(currentY - snapOffsets.collapsed) },
        ];
        candidates.sort((a, b) => a.dist - b.dist);
        target = candidates[0].snap;
      }
      setSheetSnap(target);
    },
    [snapOffsets, sheetSnap, setSheetSnap]
  );

  const handleChipClick = (tabId: AppTab) => {
    const sameTab = activeTab === tabId;
    setActiveTab(tabId);
    if (sheetSnap === 'collapsed') {
      setSheetSnap('half');
    } else if (sameTab && !isLandscape && sheetSnap === 'full') {
      setSheetSnap('half');
    }
  };

  // Stop wheel/touch/pointer bubbling to canvas behind the sheet so scrolling never rotates 3D
  const stopCanvasLeak = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const renderTabContent = () => {
    if (activeTab === 'library') {
      return (
        <div className="flex flex-col min-h-full">
          {/* Show selected 3D structure/muscle/territory detail at top if active */}
          {(selectedAnatomyInfo || selectedMuscleRefId) && (
            <div className="p-3 pb-0">
              <SelectedStructureCard />
            </div>
          )}
          {territoryMode !== 'off' && focusedTerritoryId && (
            <div className="p-3 pb-0">
              <TerritoryDetailCard
                embedded
                field={null}
                onShowSourceArtery={() => setIsolateTerritoryArtery(true)}
                onFocusTerritoryRegion={() => setCameraPreset('anterior-full')}
              />
            </div>
          )}
          {territoryMode !== 'off' && selectedSchematicMuscleId && (
            <div className="p-3 pb-0">
              <SchematicMuscleDetailCard
                embedded
                onFrameSchematicMuscle={() => setCameraPreset('lower-limb-ant')}
              />
            </div>
          )}

          {/* Switch between Flap Library list and selected Flap Reference */}
          <div className="px-3 pt-3 pb-1 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setFlapsSheetMode('list')}
              data-testid="flaps-submode-list"
              className={`min-h-[44px] flex-1 rounded-lg text-sm font-medium border transition-colors ${
                flapsSheetMode === 'list'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              Flap List ({flaps.length})
            </button>
            <button
              type="button"
              onClick={() => setFlapsSheetMode('detail')}
              data-testid="flaps-submode-detail"
              className={`min-h-[44px] flex-1 rounded-lg text-sm font-medium border transition-colors truncate px-2 ${
                flapsSheetMode === 'detail'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              {selectedFlap ? selectedFlap.name : 'Flap Details'}
            </button>
          </div>

          <div className="flex-1 min-h-0">
            {flapsSheetMode === 'list' ? (
              <FlapLibraryPanel onSelectDone={() => setFlapsSheetMode('detail')} />
            ) : (
              <FlapDetailPanel />
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'layers') {
      return <LayersSheetPanel />;
    }

    if (activeTab === 'anatomy') {
      return (
        <div className="flex flex-col min-h-full">
          {(selectedAnatomyInfo || selectedMuscleRefId) && (
            <div className="p-3 pb-0">
              <SelectedStructureCard />
            </div>
          )}
          <div className="flex-1 min-h-0">
            <AnatomyExplorerPanel />
          </div>
        </div>
      );
    }

    if (activeTab === 'tools') {
      return (
        <div className="flex flex-col min-h-full">
          <div className="px-3 pt-3 pb-2 flex items-center gap-1.5 border-b border-[var(--border-subtle)] shrink-0">
            <button
              type="button"
              onClick={() => setToolsSubTab('simulators')}
              className={`min-h-[44px] px-3.5 rounded-lg text-sm font-medium border ${
                toolsSubTab === 'simulators'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              Simulators &amp; Calc
            </button>
            <button
              type="button"
              onClick={() => setToolsSubTab('planner')}
              className={`min-h-[44px] px-3.5 rounded-lg text-sm font-medium border ${
                toolsSubTab === 'planner'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              Case Planner
            </button>
            {editorMode && (
              <button
                type="button"
                onClick={() => setToolsSubTab('calibration')}
                className={`min-h-[44px] px-3.5 rounded-lg text-sm font-medium border ${
                  toolsSubTab === 'calibration'
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                }`}
              >
                Calibrate
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <Suspense fallback={<SheetFallback />}>
              {toolsSubTab === 'simulators' && <SimulatorsView />}
              {toolsSubTab === 'planner' && <CasePlannerView />}
              {toolsSubTab === 'calibration' && <AnchorCalibrationView />}
            </Suspense>
          </div>
        </div>
      );
    }

    return (
      <Suspense fallback={<SheetFallback />}>
        {activeTab === 'advisor' && <FlapAdvisorView />}
        {activeTab === 'compare' && <CompareView />}
        {activeTab === 'quiz' && <QuizView />}
        {activeTab === 'glossary' && <GlossaryView />}
        {activeTab === 'settings' && <SettingsDataQualityView />}
        {activeTab === 'about' && <AboutCreditsView />}
      </Suspense>
    );
  };

  const footerDisclaimer = (
    <footer
      data-testid="medical-disclaimer-footer"
      className="shrink-0 px-3 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-muted)] flex items-center justify-between gap-2 safe-bottom"
    >
      <span className="truncate">
        Educational reference only — verify anatomy with preoperative imaging.
      </span>
      <button
        type="button"
        onClick={() => {
          setActiveTab('about');
          if (sheetSnap === 'collapsed') setSheetSnap('full');
        }}
        data-testid="footer-about-credits-link"
        className="shrink-0 text-xs font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap py-1"
      >
        BodyParts3D (CC BY 4.0) · Credits
      </button>
    </footer>
  );

  // LANDSCAPE LAYOUT: Right-hand panel (~38% width) when open; compact collapsed bar on launch
  if (isLandscape) {
    const expanded = sheetSnap !== 'collapsed';
    return (
      <>
        {/* Collapsed compact launcher bar in landscape so 3D body fills whole screen on launch */}
        {!expanded && (
          <aside
            aria-label="Atlas bottom bar"
            data-testid="bottom-sheet"
            data-snap="collapsed"
            data-orientation="landscape"
            onPointerDown={stopCanvasLeak}
            onWheel={stopCanvasLeak}
            className="fixed bottom-3 right-3 z-30 w-[min(440px,calc(100vw-24px))] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
          >
            <div className="px-3 pt-2 pb-1 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSheetSnap('half')}
                data-testid="sheet-handle-btn"
                className="min-h-[44px] flex items-center gap-2 min-w-0 text-left flex-1"
              >
                <ChevronLeft className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {sheetTitle}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSheetSnap('half')}
                aria-label="Open side panel"
                className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-subtle)] text-sm font-medium text-[var(--accent-primary)] shrink-0"
              >
                Open
              </button>
            </div>
            <div className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {SHEET_TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleChipClick(tab.id)}
                    data-testid={`sheet-tab-${tab.id}`}
                    className={`min-h-[44px] px-3 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 border transition-colors ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/50'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* Right-hand panel (~38% width) */}
        <aside
          aria-label="Atlas workspace panel"
          data-testid={expanded ? 'bottom-sheet' : 'bottom-sheet-landscape-panel'}
          data-snap={sheetSnap}
          data-orientation="landscape"
          onPointerDown={stopCanvasLeak}
          onTouchStart={stopCanvasLeak}
          onWheel={stopCanvasLeak}
          style={{
            transform: expanded ? 'translate3d(0, 0, 0)' : 'translate3d(105%, 0, 0)',
          }}
          className="fixed top-0 right-0 bottom-0 z-30 w-[38vw] min-w-[320px] max-w-[540px] bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col transition-transform duration-200 ease-out will-change-transform safe-top safe-right"
        >
          {/* Panel Header + Scrollable Chips */}
          <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {activeTab === 'about' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    aria-label="Back to settings"
                    className="min-w-[44px] min-h-[44px] -ml-1.5 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {sheetTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSheetSnap('collapsed')}
                data-testid="sheet-collapse-btn"
                aria-label="Collapse panel"
                className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              >
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            </div>
            <div
              role="tablist"
              aria-label="Atlas sections"
              className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar"
            >
              {SHEET_TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleChipClick(tab.id)}
                    data-testid={`sheet-tab-${tab.id}`}
                    className={`min-h-[44px] px-3.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 border transition-colors ${
                      active
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Body */}
          <div
            data-testid="bottom-sheet-scroll-body"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y"
          >
            {expanded && renderTabContent()}
          </div>

          {footerDisclaimer}
        </aside>
      </>
    );
  }

  // PORTRAIT LAYOUT: Unified draggable 3-snap Bottom Sheet (transform-only animation)
  const isDragging = dragTranslateY !== null;
  const activeTranslateY = isDragging ? dragTranslateY : snapOffsets[sheetSnap];
  const isScrollable = sheetSnap !== 'collapsed';

  return (
    <aside
      aria-label="Atlas bottom sheet"
      data-testid="bottom-sheet"
      data-snap={sheetSnap}
      data-orientation="portrait"
      onPointerDown={stopCanvasLeak}
      onTouchStart={stopCanvasLeak}
      onWheel={stopCanvasLeak}
      style={{
        height: `${fullPx}px`,
        transform: `translate3d(0, ${activeTranslateY}px, 0)`,
        transition: isDragging ? 'none' : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="fixed inset-x-0 bottom-0 z-30 rounded-t-2xl bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] shadow-2xl flex flex-col will-change-transform"
    >
      {/* Drag Handle & One-Line Header (touch-none so vertical dragging moves sheet, not browser scroll) */}
      <div
        data-testid="sheet-drag-handle"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className="shrink-0 touch-none select-none cursor-grab active:cursor-grabbing px-3 pt-1 pb-1 border-b border-[var(--border-subtle)]"
      >
        {/* Drag pill bar */}
        <div className="flex justify-center pb-0.5">
          <span className="w-10 h-1 rounded-full bg-[var(--border-subtle)]" aria-hidden="true" />
        </div>

        {/* One-line title + quick snap button */}
        <div className="flex items-center justify-between gap-2 h-[22px]">
          <span
            data-testid="sheet-header-title"
            className="text-sm font-semibold text-[var(--text-primary)] truncate leading-none"
          >
            {sheetTitle}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSheetSnap(
                sheetSnap === 'collapsed' ? 'half' : sheetSnap === 'half' ? 'full' : 'collapsed'
              );
            }}
            data-testid="sheet-snap-cycle-btn"
            aria-label={sheetSnap === 'full' ? 'Collapse sheet' : 'Expand sheet'}
            className="min-w-[44px] min-h-[44px] -my-2 -mr-2 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {sheetSnap === 'full' ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Scrollable tab chips (3-4 visible at collapsed, 44px touch target) */}
        <div
          role="tablist"
          aria-label="Atlas sections"
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-0.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x"
        >
          {SHEET_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleChipClick(tab.id)}
                data-testid={`sheet-tab-${tab.id}`}
                className={`min-h-[44px] px-3.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 border transition-colors ${
                  active && sheetSnap !== 'collapsed'
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/50'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visible Content + Footer Region: matches exact visible height in half snap so scrolling reaches the bottom & footer stays visible */}
      <div
        className="flex flex-col min-h-0"
        style={
          !isDragging && sheetSnap === 'half'
            ? { height: `${Math.max(120, halfPx - COLLAPSED_HEIGHT_PX)}px` }
            : { flex: '1 1 0%' }
        }
      >
        <div
          data-testid="bottom-sheet-scroll-body"
          className={`flex-1 min-h-0 ${
            isScrollable
              ? 'overflow-y-auto overscroll-contain touch-pan-y'
              : 'overflow-hidden pointer-events-none'
          }`}
        >
          {isScrollable && renderTabContent()}
        </div>

        {isScrollable && footerDisclaimer}
      </div>
    </aside>
  );
};
