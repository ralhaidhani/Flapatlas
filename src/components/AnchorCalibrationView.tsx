import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Download,
  Info,
  MapPin,
  RotateCcw,
  Sliders,
  Sparkles,
  Target,
  Upload,
  X,
} from 'lucide-react';
import {
  ANCHOR_MODEL_VERSION,
  computeAnchorDeltaCm,
  LandmarkAnchor,
  SCHEMATIC_TAG_TEXT,
} from '../models/anchorSystem';
import { useAtlasStore } from '../store/useAtlasStore';
import { VesselAlignmentPanel } from './VesselAlignmentPanel';
import { Viewer3D } from './Viewer3D';

export const AnchorCalibrationView: React.FC = () => {
  const anchors = useAtlasStore((s) => s.anchors);
  const calibratingAnchorId = useAtlasStore((s) => s.calibratingAnchorId);
  const flaps = useAtlasStore((s) => s.flaps);
  const selectedFlapId = useAtlasStore((s) => s.selectedFlapId);
  const activeModelStats = useAtlasStore((s) => s.activeModelStats);
  const anchorsNeedRecalibration = useAtlasStore((s) => s.anchorsNeedRecalibration);

  const setCalibratingAnchorId = useAtlasStore((s) => s.setCalibratingAnchorId);
  const resetAnchor = useAtlasStore((s) => s.resetAnchor);
  const resetAllAnchors = useAtlasStore((s) => s.resetAllAnchors);
  const importAnchorsJson = useAtlasStore((s) => s.importAnchorsJson);
  const requestAutoProposeAnchors = useAtlasStore((s) => s.requestAutoProposeAnchors);
  const dismissAnchorRecalibrationBanner = useAtlasStore((s) => s.dismissAnchorRecalibrationBanner);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const setCameraPreset = useAtlasStore((s) => s.setCameraPreset);
  const flyToCameraGoal = useAtlasStore((s) => s.flyToCameraGoal);
  const setLayer = useAtlasStore((s) => s.setLayer);

  const [sidebarTab, setSidebarTab] = useState<'anchors' | 'alignment'>('anchors');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevCalibratingIdRef = useRef<string | null>(null);

  const calibratedCount = useMemo(
    () => anchors.filter((a) => a.source === 'calibrated').length,
    [anchors]
  );

  const activeCalibrationAnchor = useMemo(
    () => anchors.find((a) => a.id === calibratingAnchorId) || null,
    [anchors, calibratingAnchorId]
  );

  useEffect(() => {
    if (calibratingAnchorId) {
      setSidebarTab('anchors');
    }
  }, [calibratingAnchorId]);

  useEffect(() => {
    const prevId = prevCalibratingIdRef.current;
    if (prevId && !calibratingAnchorId) {
      const updated = anchors.find((a) => a.id === prevId);
      if (updated?.source === 'calibrated') {
        const boneSuffix = updated.snappedSkeletonMesh
          ? ` on ${updated.snappedSkeletonMesh}`
          : '';
        setStatusMsg(`Saved ${updated.shortLabel}${boneSuffix} to IndexedDB.`);
      } else {
        setStatusMsg(null);
      }
    }
    prevCalibratingIdRef.current = calibratingAnchorId;
  }, [calibratingAnchorId, anchors]);

  const handleFocusAnchor = (anchor: LandmarkAnchor) => {
    const [x, y, z] = anchor.position;
    const isPosterior =
      z < -0.04 || anchor.id === 'psis' || anchor.id === 'inferior_angle_scapula';
    const camZ = isPosterior ? z - 0.65 : z + 0.65;
    const camX = x * 0.6;
    flyToCameraGoal([camX, Math.max(0.22, y + 0.06), camZ], [x, y, z]);
  };

  const handleStartSkeletonPick = (anchor: LandmarkAnchor) => {
    if (calibratingAnchorId === anchor.id) {
      setCalibratingAnchorId(null);
      setStatusMsg(null);
      return;
    }
    setLayer('skeleton', { visible: true, opacity: 1.0 });
    setLayer('landmarks', { visible: true, opacity: 1.0 });
    setCalibratingAnchorId(anchor.id);
    if (anchor.cameraPreset) {
      setCameraPreset(anchor.cameraPreset);
    }
    handleFocusAnchor(anchor);
    setStatusMsg(null);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(anchors, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anchors_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg(`Exported ${anchors.length} landmark anchors to anchors.json.`);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = await importAnchorsJson(text);
    setStatusMsg(res.message);
    e.target.value = '';
  };

  return (
    <div
      className="h-full w-full flex flex-col lg:flex-row overflow-hidden bg-[var(--bg-app)]"
      data-testid="anchor-calibration-page"
    >
      {/* Left Calibration Control Column */}
      <aside className="w-full lg:w-[400px] xl:w-[430px] shrink-0 h-[46%] lg:h-full border-b lg:border-b-0 lg:border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col overflow-hidden">
        {/* Mode Switcher: Vessel/Skin Alignment vs Landmark Anchors */}
        <div className="p-2.5 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--bg-subtle)]/50">
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setSidebarTab('alignment')}
              data-testid="calibration-tab-alignment"
              className={`h-7 px-2 rounded-md text-[11px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                sidebarTab === 'alignment'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Vessel Alignment</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('anchors')}
              data-testid="calibration-tab-anchors"
              className={`h-7 px-2 rounded-md text-[11px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                sidebarTab === 'anchors'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Anchors ({calibratedCount}/{anchors.length})</span>
            </button>
          </div>
        </div>

        {sidebarTab === 'alignment' ? (
          <div className="flex-1 overflow-y-auto">
            <VesselAlignmentPanel />
          </div>
        ) : (
        <>
        {/* Header */}
        <div className="p-3.5 border-b border-[var(--border-subtle)] space-y-2.5 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)] flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                <span>Landmark Calibration · {ANCHOR_MODEL_VERSION}</span>
              </div>
              <h1 className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                Anatomical Landmark Anchors ({anchors.length})
              </h1>
            </div>
            <span
              data-testid="calibration-progress-badge"
              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[var(--accent-soft)] border border-[var(--accent-primary)]/40 text-[var(--accent-primary)] shrink-0"
            >
              {calibratedCount}/{anchors.length} set
            </span>
          </div>

          {anchorsNeedRecalibration && (
            <div
              data-testid="calibration-stale-anchors-banner"
              className="p-2 rounded-lg bg-amber-500/12 border border-amber-500/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start justify-between gap-2"
            >
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Stale pre-{ANCHOR_MODEL_VERSION} anchors detected and ignored.{' '}
                  <strong>Please recalibrate</strong> or click Auto-Propose below.
                </span>
              </div>
              <button
                type="button"
                onClick={dismissAnchorRecalibrationBanner}
                aria-label="Dismiss recalibration banner"
                className="p-0.5 rounded hover:bg-amber-500/20 shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
            Tagged <code className="font-mono text-[10px]">modelVersion: &quot;{ANCHOR_MODEL_VERSION}&quot;</code>{' '}
            in <code className="font-mono text-[10px]">anchors.json</code> &amp; IndexedDB.
            Auto-propose from BP3D skeleton &amp; skin geometry or click bones directly to fine-tune.
          </p>

          <button
            type="button"
            onClick={() => {
              setLayer('skeleton', { visible: true, opacity: 1.0 });
              setLayer('landmarks', { visible: true, opacity: 1.0 });
              requestAutoProposeAnchors();
              setStatusMsg(
                `Auto-proposed ${anchors.length} landmark coordinates directly from loaded BodyParts3D 4.0 skeleton & skin bounds.`
              );
            }}
            data-testid="auto-propose-bp3d-anchors-btn"
            className="w-full h-8 px-3 rounded-md bg-[var(--accent-primary)] text-white text-[11px] font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Propose All {anchors.length} Landmarks from BP3D Geometry</span>
          </button>

          {/* Active Flap Preview Selector + Schematic Provenance Notice */}
          <div className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="calibration-flap-preview-select"
                className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
              >
                Live Overlay Preview Flap
              </label>
              <span
                data-testid="calibration-schematic-tag"
                className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/12 border border-amber-500/35 text-amber-700 dark:text-amber-300"
              >
                {SCHEMATIC_TAG_TEXT}
              </span>
            </div>
            <select
              id="calibration-flap-preview-select"
              value={selectedFlapId}
              onChange={(e) => selectFlap(e.target.value, true)}
              className="w-full h-7 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
            >
              {flaps.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.region_group})
                </option>
              ))}
            </select>
          </div>

          {/* Toolbar Actions */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportJson}
              data-testid="export-anchors-btn"
              className="h-7 px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[11px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1"
            >
              <Download className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="import-anchors-btn"
              className="h-7 px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[11px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1"
            >
              <Upload className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>Import JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => {
                resetAllAnchors();
                setStatusMsg(`Restored all ${anchors.length} landmark anchors to default bp3d-4.0 coordinates.`);
              }}
              data-testid="reset-all-anchors-btn"
              disabled={calibratedCount === 0}
              className="h-7 px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-red-500/60 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--danger-text)] inline-flex items-center gap-1 ml-auto disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          </div>

          {activeCalibrationAnchor && (
            <div
              data-testid="active-skeleton-pick-banner"
              className="p-2 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-primary)] flex items-center justify-between gap-2 text-[11px]"
            >
              <div className="min-w-0">
                <div className="font-semibold text-[var(--accent-primary)] truncate">
                  Picking: {activeCalibrationAnchor.name}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  Click directly on the 3D skeleton mesh to set this anchor.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalibratingAnchorId(null)}
                className="p-1 rounded text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] shrink-0"
                aria-label="Cancel anchor picking"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {statusMsg && !activeCalibrationAnchor && (
            <div
              data-testid="calibration-status-notice"
              className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5"
            >
              <Info className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
              <span className="flex-1">{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Scrollable 11 Landmark Anchor Rows */}
        <div
          className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]"
          data-testid="anchor-calibration-list"
        >
          {anchors.map((anchor) => {
            const isPicking = calibratingAnchorId === anchor.id;
            const isCalibrated = anchor.source === 'calibrated';
            const deltaCm = computeAnchorDeltaCm(anchor);
            const [x, y, z] = anchor.position;

            return (
              <div
                key={anchor.id}
                data-testid={`anchor-row-${anchor.id}`}
                className={`p-3 space-y-2 transition-colors ${
                  isPicking
                    ? 'bg-[var(--accent-soft)]'
                    : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <MapPin
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isCalibrated ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--accent-primary)]'
                        }`}
                      />
                      <span className="text-xs font-semibold text-[var(--text-primary)] leading-tight">
                        {anchor.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-[var(--text-muted)]">
                      <span className="capitalize">{anchor.side}</span>
                      <span>·</span>
                      <span>{anchor.region}</span>
                      {isCalibrated ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Calibrated{deltaCm > 0 ? ` (Δ${deltaCm} cm)` : ''}
                        </span>
                      ) : (
                        <span>Default</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleFocusAnchor(anchor)}
                      title={`Focus camera on ${anchor.name}`}
                      aria-label={`Focus camera on ${anchor.name}`}
                      className="h-6 px-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Focus</span>
                    </button>
                    {isCalibrated && (
                      <button
                        type="button"
                        onClick={() => {
                          resetAnchor(anchor.id);
                          setStatusMsg(`Reset ${anchor.shortLabel} to default baseline.`);
                        }}
                        title={`Reset ${anchor.name}`}
                        aria-label={`Reset ${anchor.name}`}
                        data-testid={`reset-anchor-btn-${anchor.id}`}
                        className="h-6 px-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-red-500/50 text-[10px] text-[var(--text-muted)] hover:text-[var(--danger-text)]"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Real 1:1 Meter / CM Coordinate Readout */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono tabular-nums bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-md px-2 py-1 text-[var(--text-secondary)]">
                  <span data-testid={`anchor-coords-${anchor.id}`}>
                    X {(x * 100).toFixed(1)} · Y {(y * 100).toFixed(1)} · Z {(z * 100).toFixed(1)} cm
                  </span>
                  {anchor.snappedSkeletonMesh && (
                    <span
                      className="text-[var(--accent-primary)] truncate max-w-[145px]"
                      title={anchor.snappedSkeletonMesh}
                    >
                      Bone: {anchor.snappedSkeletonMesh}
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-[var(--text-muted)] leading-snug">
                  {anchor.clinicalNote}
                </p>

                <button
                  type="button"
                  onClick={() => handleStartSkeletonPick(anchor)}
                  data-testid={`pick-anchor-btn-${anchor.id}`}
                  className={`w-full h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                    isPicking
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] hover:opacity-95'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>
                    {isPicking
                      ? 'Cancel — Click skeleton in 3D view'
                      : 'Click on the skeleton to set this anchor'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        </>
        )}

        {/* Footer Model Status */}
        <div className="px-3.5 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[10px] text-[var(--text-muted)] flex items-center justify-between gap-2 shrink-0">
          <span>
            Active Model:{' '}
            <strong className="text-[var(--text-primary)]">
              {activeModelStats?.mode === 'real-glb'
                ? `${
                    activeModelStats.hasLegacyZAnatomy
                      ? 'Legacy Override + BP3D'
                      : 'BodyParts3D 4.0'
                  } (${Math.round(activeModelStats.normalizedHeightCm)} cm)`
                : 'Procedural Fallback (175 cm)'}
            </strong>
          </span>
          <span className="font-mono">IndexedDB Saved</span>
        </div>
      </aside>

      {/* Right Live 3D Skeleton Viewport */}
      <section
        aria-label="3D Skeleton Landmark Calibration Viewport"
        className="flex-1 min-w-0 min-h-0 relative"
      >
        <Viewer3D hideAlignmentDockButton />
      </section>
    </div>
  );
};
