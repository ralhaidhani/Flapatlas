import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Info,
  RotateCcw,
  Save,
  Sliders,
  Terminal,
  X,
} from 'lucide-react';
import {
  areVesselAlignmentsEqual,
  CALIBRATION_VIEW_HINTS,
  CenterDeltaCm,
  formatAlignmentDiagnosticsForConsole,
  isDefaultVesselAlignment,
  SystemBoundsMetrics,
  VESSEL_ALIGNMENT_LIMITS,
} from '../models/vesselAlignment';
import { useAtlasStore } from '../store/useAtlasStore';

interface VesselAlignmentPanelProps {
  compact?: boolean;
  onClose?: () => void;
}

function formatCmSigned(val: number): string {
  const fixed = val.toFixed(1);
  return val > 0 ? `+${fixed}` : fixed;
}

function formatBboxRange(m: SystemBoundsMetrics): string {
  if (!m.present) return '—';
  const minCm = m.minMeters.map((v) => (v * 100).toFixed(0));
  const maxCm = m.maxMeters.map((v) => (v * 100).toFixed(0));
  return `X[${minCm[0]}..${maxCm[0]}] Y[${minCm[1]}..${maxCm[1]}] Z[${minCm[2]}..${maxCm[2]}]`;
}

function formatCenterCm(m: SystemBoundsMetrics): string {
  if (!m.present) return '—';
  return `(${(m.centerMeters[0] * 100).toFixed(1)}, ${(m.centerMeters[1] * 100).toFixed(1)}, ${(
    m.centerMeters[2] * 100
  ).toFixed(1)})`;
}

function formatDeltaSummary(delta: CenterDeltaCm | null): string {
  if (!delta) return '—';
  return `Δ(${formatCmSigned(delta.dxCm)}, ${formatCmSigned(delta.dyCm)}, ${formatCmSigned(
    delta.dzCm
  )}) · |Δ| ${delta.distanceCm.toFixed(1)} cm`;
}

export const VesselAlignmentPanel: React.FC<VesselAlignmentPanelProps> = ({
  compact = false,
  onClose,
}) => {
  const vesselAlignment = useAtlasStore((s) => s.vesselAlignment);
  const savedVesselAlignment = useAtlasStore((s) => s.savedVesselAlignment);
  const vesselAlignmentSavedAtIso = useAtlasStore((s) => s.vesselAlignmentSavedAtIso);
  const alignmentDiagnostics = useAtlasStore((s) => s.alignmentDiagnostics);
  const calibrationViewActive = useAtlasStore((s) => s.calibrationViewActive);
  const activeModelStats = useAtlasStore((s) => s.activeModelStats);

  const setVesselAlignment = useAtlasStore((s) => s.setVesselAlignment);
  const saveVesselAlignment = useAtlasStore((s) => s.saveVesselAlignment);
  const resetVesselAlignment = useAtlasStore((s) => s.resetVesselAlignment);
  const toggleCalibrationView = useAtlasStore((s) => s.toggleCalibrationView);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [compactHintsExpanded, setCompactHintsExpanded] = useState<boolean>(false);
  const showHints = !compact || calibrationViewActive || compactHintsExpanded;

  const hasUnsavedChanges = !areVesselAlignmentsEqual(vesselAlignment, savedVesselAlignment);
  const isAtDefault = isDefaultVesselAlignment(vesselAlignment);
  const scalePct = Number((vesselAlignment.scale * 100).toFixed(1));

  const hasRealBp3dGroup = Boolean(
    activeModelStats?.mode === 'real-glb' &&
      activeModelStats.loadedSystems.some(
        (sys) => sys === 'arteries' || sys === 'veins' || sys === 'skin'
      )
  );

  const handleSave = async () => {
    await saveVesselAlignment();
    if (alignmentDiagnostics) {
      console.info(formatAlignmentDiagnosticsForConsole(alignmentDiagnostics, vesselAlignment));
    }
    setStatusMessage('Alignment saved to IndexedDB (auto-restored on load).');
  };

  const handleReset = async () => {
    await resetVesselAlignment();
    setStatusMessage('Reset offsets to 0.0 cm and scale to 100%.');
  };

  const handleLogConsole = () => {
    if (!alignmentDiagnostics) {
      setStatusMessage('Diagnostics are not available yet.');
      return;
    }
    console.info(formatAlignmentDiagnosticsForConsole(alignmentDiagnostics, vesselAlignment));
    setStatusMessage('Printed bounding boxes, heights & centre deltas to console.');
  };

  const axisControls: Array<{
    key: 'offsetXCm' | 'offsetYCm' | 'offsetZCm';
    label: string;
    axisHint: string;
    value: number;
    testIdPrefix: string;
  }> = [
    {
      key: 'offsetXCm',
      label: 'X Offset (cm)',
      axisHint: 'Right (−) ↔ Left (+)',
      value: vesselAlignment.offsetXCm,
      testIdPrefix: 'align-x',
    },
    {
      key: 'offsetYCm',
      label: 'Y Offset (cm)',
      axisHint: 'Inferior (−) ↔ Superior (+)',
      value: vesselAlignment.offsetYCm,
      testIdPrefix: 'align-y',
    },
    {
      key: 'offsetZCm',
      label: 'Z Offset (cm)',
      axisHint: 'Posterior (−) ↔ Anterior (+)',
      value: vesselAlignment.offsetZCm,
      testIdPrefix: 'align-z',
    },
  ];

  const diagRows: Array<{
    key: string;
    label: string;
    metrics: SystemBoundsMetrics;
    delta: CenterDeltaCm | null;
  }> = alignmentDiagnostics
    ? [
        {
          key: 'skeleton',
          label: 'Skeleton',
          metrics: alignmentDiagnostics.skeleton,
          delta: null,
        },
        {
          key: 'muscles',
          label: 'Muscles',
          metrics: alignmentDiagnostics.muscles,
          delta: alignmentDiagnostics.musclesVsSkeletonCm,
        },
        {
          key: 'vessels',
          label: 'Vessels (A+V)',
          metrics: alignmentDiagnostics.vessels,
          delta: alignmentDiagnostics.vesselsVsSkeletonCm,
        },
        {
          key: 'skin',
          label: 'Skin',
          metrics: alignmentDiagnostics.skin,
          delta: alignmentDiagnostics.skinVsSkeletonCm,
        },
      ]
    : [];

  return (
    <div
      data-testid="vessel-alignment-panel"
      className={`flex flex-col text-xs ${
        compact ? 'space-y-2' : 'p-3 space-y-2.5'
      }`}
    >
      {/* Header + Live Alignment Status Badge */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)] flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>Editor Mode · Alignment</span>
          </div>
          <h2 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] mt-0.5 leading-tight">
            BodyParts3D Group (Arteries + Veins + Skin)
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {alignmentDiagnostics?.vessels.present ? (
            alignmentDiagnostics.isVesselAligned ? (
              <span
                data-testid="alignment-status-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/45 text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Aligned</span>
              </span>
            ) : (
              <span
                data-testid="alignment-status-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-500/15 border border-amber-500/45 text-amber-700 dark:text-amber-300"
              >
                <span>
                  Δ {alignmentDiagnostics.vesselsVsSkeletonCm?.distanceCm.toFixed(1) ?? '—'} cm
                </span>
              </span>
            )
          ) : (
            <span
              data-testid="alignment-status-badge"
              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
            >
              No vessels
            </span>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close alignment panel"
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!hasRealBp3dGroup && (
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/35 text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
          Unified BodyParts3D 4.0 systems stream in one shared coordinate frame (zero alignment
          offset required). Use this panel only for fine-tuning custom local overrides in{' '}
          <strong>Settings &amp; Data</strong>.
        </div>
      )}

      {/* Calibration View Preset + Verification Hints */}
      <div className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[var(--text-primary)]">
              Calibration View Preset
            </div>
            <div className="text-[10px] text-[var(--text-muted)] leading-tight">
              Skeleton + abdominal aorta + femoral + internal thoracic arteries + skin 15% (front)
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleCalibrationView()}
            data-testid="calibration-view-toggle-btn"
            aria-pressed={calibrationViewActive}
            className={`h-7 px-2.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1.5 border shrink-0 transition-colors ${
              calibrationViewActive
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{calibrationViewActive ? 'Exit Calibration View' : 'Calibration View'}</span>
          </button>
        </div>

        {calibrationViewActive && alignmentDiagnostics && (
          <div
            data-testid="calibration-view-active-pill"
            className="text-[10px] font-mono text-[var(--accent-primary)] bg-[var(--accent-soft)] border border-[var(--accent-primary)]/35 rounded px-2 py-1"
          >
            Front view active · Skin 15% ·{' '}
            {alignmentDiagnostics.calibrationArteryCount > 0
              ? `${alignmentDiagnostics.calibrationArteryCount} reference arteries isolated`
              : 'Showing reference skeleton & skin (upload arteries.glb to isolate vessels)'}
          </div>
        )}

        {/* Required 4 Anatomical Alignment Verification Hints */}
        <div className="pt-1 border-t border-[var(--border-subtle)] space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Visual Alignment Checkpoints
            </span>
            {compact && !calibrationViewActive && (
              <button
                type="button"
                onClick={() => setCompactHintsExpanded((v) => !v)}
                className="text-[10px] font-medium text-[var(--accent-primary)] hover:underline"
              >
                {compactHintsExpanded ? 'Hide (4)' : 'Show (4)'}
              </button>
            )}
          </div>
          {showHints && (
            <ul
              data-testid="calibration-view-hints"
              className="space-y-0.5 text-[10px] text-[var(--text-secondary)] leading-snug"
            >
              {CALIBRATION_VIEW_HINTS.map((hint) => (
                <li key={hint.id} className="flex items-start gap-1.5">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shrink-0"
                  />
                  <span>{hint.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Transform Controls: X / Y / Z Offsets (±15 cm, 1 mm step) + Uniform Scale (90–110%) */}
      <div className="space-y-1.5">
        {axisControls.map((ctrl) => (
          <div key={ctrl.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={`${ctrl.testIdPrefix}-number`}
                className="text-[11px] font-medium text-[var(--text-primary)]"
              >
                {ctrl.label}{' '}
                <span className="text-[10px] font-normal text-[var(--text-muted)]">
                  · {ctrl.axisHint}
                </span>
              </label>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  id={`${ctrl.testIdPrefix}-number`}
                  type="number"
                  min={VESSEL_ALIGNMENT_LIMITS.minOffsetCm}
                  max={VESSEL_ALIGNMENT_LIMITS.maxOffsetCm}
                  step={VESSEL_ALIGNMENT_LIMITS.stepOffsetCm}
                  value={ctrl.value}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (Number.isFinite(parsed)) {
                      setVesselAlignment({ [ctrl.key]: parsed });
                    }
                  }}
                  data-testid={`${ctrl.testIdPrefix}-number`}
                  aria-label={`${ctrl.label} numeric input`}
                  className="w-16 h-6 px-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] text-right font-mono tabular-nums text-[11px] text-[var(--text-primary)] focus:outline-none"
                />
                <span className="text-[10px] font-mono text-[var(--text-muted)]">cm</span>
              </div>
            </div>
            <input
              type="range"
              min={VESSEL_ALIGNMENT_LIMITS.minOffsetCm}
              max={VESSEL_ALIGNMENT_LIMITS.maxOffsetCm}
              step={VESSEL_ALIGNMENT_LIMITS.stepOffsetCm}
              value={ctrl.value}
              onChange={(e) => setVesselAlignment({ [ctrl.key]: Number(e.target.value) })}
              data-testid={`${ctrl.testIdPrefix}-slider`}
              aria-label={`${ctrl.label} slider`}
              className="w-full h-1.5 accent-[var(--accent-primary)] cursor-pointer"
            />
          </div>
        ))}

        {/* Uniform Scale 90–110% */}
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="align-scale-number"
              className="text-[11px] font-medium text-[var(--text-primary)]"
            >
              Uniform Scale (%){' '}
              <span className="text-[10px] font-normal text-[var(--text-muted)]">
                · 90%–110%
              </span>
            </label>
            <div className="flex items-center gap-1 shrink-0">
              <input
                id="align-scale-number"
                type="number"
                min={90}
                max={110}
                step={0.1}
                value={scalePct}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  if (Number.isFinite(pct)) {
                    setVesselAlignment({ scale: pct / 100 });
                  }
                }}
                data-testid="align-scale-number"
                aria-label="Uniform scale percentage numeric input"
                className="w-16 h-6 px-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] text-right font-mono tabular-nums text-[11px] text-[var(--text-primary)] focus:outline-none"
              />
              <span className="text-[10px] font-mono text-[var(--text-muted)]">%</span>
            </div>
          </div>
          <input
            type="range"
            min={90}
            max={110}
            step={0.5}
            value={scalePct}
            onChange={(e) => setVesselAlignment({ scale: Number(e.target.value) / 100 })}
            data-testid="align-scale-slider"
            aria-label="Uniform scale slider"
            className="w-full h-1.5 accent-[var(--accent-primary)] cursor-pointer"
          />
        </div>
      </div>

      {/* Reset / Save / Console Diagnostics Actions */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={handleSave}
          data-testid="align-save-btn"
          className="h-7 px-2.5 rounded-md bg-[var(--accent-primary)] text-white text-[11px] font-medium inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{hasUnsavedChanges ? 'Save Alignment' : 'Save (IndexedDB)'}</span>
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={isAtDefault && !vesselAlignmentSavedAtIso}
          data-testid="align-reset-btn"
          className="h-7 px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-red-500/60 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--danger-text)] inline-flex items-center gap-1 disabled:opacity-40"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>

        <button
          type="button"
          onClick={handleLogConsole}
          data-testid="align-log-console-btn"
          title="Print bounding boxes, heights, and centre differences to browser console"
          className="h-7 px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 ml-auto"
        >
          <Terminal className="w-3 h-3" />
          <span>Log</span>
        </button>
      </div>

      {statusMessage && (
        <div
          data-testid="align-status-msg"
          className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[10.5px] text-[var(--text-secondary)] flex items-center gap-1.5"
        >
          <Info className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Bounding Box, Height & Centre Difference Diagnostics */}
      <div
        data-testid="alignment-diagnostics-panel"
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 overflow-hidden"
      >
        <div className="px-2.5 py-1.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Bounds &amp; Centre Diagnostics (cm)
          </span>
          {alignmentDiagnostics?.vesselsVsSkeletonCm && (
            <span className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)]">
              Vessels Δ: {alignmentDiagnostics.vesselsVsSkeletonCm.distanceCm.toFixed(1)} cm
            </span>
          )}
        </div>

        {diagRows.length === 0 ? (
          <div className="p-2.5 text-[10.5px] text-[var(--text-muted)]">
            Waiting for 3D anatomical meshes to compute bounding-box diagnostics…
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {diagRows.map((row) => (
              <div
                key={row.key}
                data-testid={`diag-row-${row.key}`}
                className="px-2.5 py-1 space-y-0.5 text-[10px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--text-primary)]">{row.label}</span>
                  <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                    {row.metrics.present ? `H ${row.metrics.heightCm.toFixed(1)} cm` : 'Not loaded'}
                  </span>
                </div>
                {row.metrics.present && (
                  <>
                    <div className="font-mono tabular-nums text-[9.5px] text-[var(--text-muted)] truncate">
                      Ctr {formatCenterCm(row.metrics)} · {formatBboxRange(row.metrics)}
                    </div>
                    {row.delta && (
                      <div
                        className={`font-mono tabular-nums text-[9.5px] ${
                          row.key === 'vessels' && alignmentDiagnostics?.isVesselAligned
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        vs Skeleton: {formatDeltaSummary(row.delta)}
                        {row.key === 'vessels' && alignmentDiagnostics?.isVesselAligned
                          ? ' · Aligned'
                          : ''}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
