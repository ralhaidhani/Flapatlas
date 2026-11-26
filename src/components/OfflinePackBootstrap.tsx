import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, HardDrive, RefreshCw, X } from 'lucide-react';
import { formatBytes, offlineManager, useOfflineManager } from '../models/offlineManager';

/**
 * 1) One-time first-launch offline pack progress screen:
 *    "Downloading offline pack — keep the app open"
 *    Unlocks immediately once skeleton + muscles + skin + Draco are cached while the
 *    remaining anatomical systems & reference JSONs finish quietly in the background.
 * 2) Non-intrusive "New version available — Reload" prompt when Workbox detects an update.
 */
export const OfflinePackBootstrap: React.FC = () => {
  const snap = useOfflineManager();
  const [allowEarlySkip, setAllowEarlySkip] = useState(false);
  const [hideBgPill, setHideBgPill] = useState(false);

  const showFullScreenProgress =
    snap.initialized &&
    !snap.bootstrapDismissed &&
    !snap.coreReady &&
    snap.downloading;

  const showBackgroundPill =
    !showFullScreenProgress &&
    snap.downloading &&
    snap.coreReady &&
    !snap.offlineReady &&
    !hideBgPill;

  useEffect(() => {
    if (!showFullScreenProgress) {
      setAllowEarlySkip(false);
      return;
    }
    const timer = window.setTimeout(() => setAllowEarlySkip(true), 7000);
    return () => window.clearTimeout(timer);
  }, [showFullScreenProgress]);

  return (
    <>
      {showFullScreenProgress && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Downloading offline pack"
          data-testid="offline-bootstrap-screen"
          className="no-print fixed inset-0 z-[70] bg-slate-950/95 text-slate-100 flex items-center justify-center p-5"
          style={{
            paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/40 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-[var(--accent-primary)] animate-pulse" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[var(--text-primary)] leading-tight">
                  Downloading offline pack — keep the app open
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  One-time setup for zero-network use in the OR or airplane mode.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] truncate pr-2">
                  {snap.currentFileLabel
                    ? `Caching ${snap.currentFileLabel}…`
                    : 'Preparing skeleton, muscles & skin…'}
                </span>
                <span className="font-mono font-semibold tabular-nums text-[var(--accent-primary)] shrink-0">
                  {snap.coreCachedFiles}/{snap.coreTotalFiles} core
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
                  style={{ width: `${Math.max(6, snap.corePct)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                <span>
                  {snap.cachedFiles} / {snap.totalFiles} files total
                </span>
                <span>
                  {formatBytes(snap.cachedBytes)} / ~{formatBytes(snap.totalPackBytes)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
              <HardDrive className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              <span>
                FlapAtlas becomes interactive as soon as <strong>skeleton, muscles &amp; skin</strong>{' '}
                finish caching; vessels, nerves, organs and reference indices finish in the background.
              </span>
            </div>

            {(allowEarlySkip || snap.error) && (
              <div className="flex items-center justify-between gap-2 pt-1">
                {snap.error && (
                  <span className="text-xs text-amber-400 truncate">{snap.error}</span>
                )}
                <button
                  type="button"
                  onClick={() => offlineManager.dismissBootstrapOverlay()}
                  data-testid="offline-bootstrap-continue-btn"
                  className="ml-auto min-h-[44px] px-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                >
                  Continue while downloading
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showBackgroundPill && (
        <div
          role="status"
          aria-live="polite"
          data-testid="offline-background-progress-pill"
          className="no-print fixed top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-slate-900/90 border border-slate-700/80 px-3.5 py-1.5 text-xs text-slate-100 shadow-lg backdrop-blur-md"
          style={{
            marginTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          <Download className="w-3.5 h-3.5 text-teal-400 animate-pulse shrink-0" />
          <span className="font-medium whitespace-nowrap">
            Finishing offline pack ({snap.cachedFiles}/{snap.totalFiles})
          </span>
          <button
            type="button"
            onClick={() => setHideBgPill(true)}
            aria-label="Hide offline progress indicator"
            className="p-0.5 rounded text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {snap.needRefresh && (
        <div
          role="alert"
          data-testid="pwa-update-prompt"
          className="no-print fixed bottom-20 left-1/2 -translate-x-1/2 z-[65] w-[min(92vw,380px)] rounded-xl bg-slate-900 border border-teal-500/60 px-4 py-3 text-slate-100 shadow-2xl flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="text-sm font-medium truncate">
              New version available — Reload
            </span>
          </div>
          <button
            type="button"
            onClick={() => void offlineManager.applyAppUpdate()}
            data-testid="pwa-update-reload-btn"
            className="min-h-[44px] px-3.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold inline-flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
        </div>
      )}
    </>
  );
};
