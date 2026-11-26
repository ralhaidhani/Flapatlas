import React from 'react';
import {
  CheckCircle2,
  CloudDownload,
  Download,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWA';
import { formatBytes, offlineManager, useOfflineManager } from '../models/offlineManager';
import { PWAInstallButton } from './PWAInstallControls';

export const OfflineSettingsSection: React.FC = () => {
  const snap = useOfflineManager();
  const { isInstalled } = usePWAInstall();

  const storageSummary =
    snap.storageUsageBytes != null && snap.storageQuotaBytes != null
      ? `${formatBytes(snap.storageUsageBytes)} used of ${formatBytes(snap.storageQuotaBytes)}`
      : snap.storageUsageBytes != null
        ? `${formatBytes(snap.storageUsageBytes)} used`
        : 'Storage estimate unavailable';

  return (
    <div className="space-y-5">
      {/* Settings -> Offline manager */}
      <section
        className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4 text-sm"
        data-testid="settings-offline-manager"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Offline Manager</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Bundled BodyParts3D 4.0 meshes, Draco WASM decoder, and anatomical indices stored locally for zero-network operation.
            </p>
          </div>

          {snap.offlineReady ? (
            <span
              data-testid="offline-ready-badge"
              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Offline ready ✓</span>
            </span>
          ) : (
            <span
              data-testid="offline-incomplete-badge"
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>
                {snap.downloading
                  ? `Caching (${snap.cachedFiles}/${snap.totalFiles})…`
                  : `Incomplete (${snap.cachedFiles}/${snap.totalFiles})`}
              </span>
            </span>
          )}
        </div>

        {/* Pack KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[11px] text-[var(--text-muted)]">Offline Pack Size</div>
            <div
              className="text-base font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5"
              data-testid="offline-pack-size"
            >
              {formatBytes(snap.cachedBytes > 0 ? snap.cachedBytes : snap.totalPackBytes)}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Cache {snap.cacheVersion}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[11px] text-[var(--text-muted)]">Cached / Total Files</div>
            <div
              className="text-base font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5"
              data-testid="offline-cached-count"
            >
              {snap.cachedFiles} / {snap.totalFiles}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {snap.coreReady ? 'Core 3D body ready' : 'Core 3D body pending'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[11px] text-[var(--text-muted)]">Browser Storage</div>
            <div
              className="text-xs font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-1 leading-snug"
              data-testid="offline-storage-estimate"
            >
              {storageSummary}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>
                {snap.storagePersisted === true
                  ? 'Persistent storage granted'
                  : snap.storagePersisted === false
                    ? 'Standard browser quota'
                    : 'Checking persistence…'}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                snap.offlineReady ? 'bg-emerald-500' : 'bg-[var(--accent-primary)]'
              }`}
              style={{ width: `${snap.pct}%` }}
            />
          </div>
          {snap.currentFileLabel && (
            <div className="text-xs text-[var(--text-muted)]">
              Caching {snap.currentFileLabel}…
            </div>
          )}
          {snap.error && (
            <div className="text-xs text-[var(--warning-text)]">{snap.error}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={snap.downloading}
            onClick={() => void offlineManager.ensureOfflinePackCached({ forceRedownload: true })}
            data-testid="offline-redownload-btn"
            className="min-h-[44px] px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium inline-flex items-center gap-1.5 hover:opacity-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{snap.redownloading ? 'Re-downloading…' : 'Re-download pack'}</span>
          </button>

          <button
            type="button"
            disabled={snap.checkingAppUpdate}
            onClick={() => void offlineManager.checkForAppUpdate()}
            data-testid="offline-check-updates-btn"
            className="min-h-[44px] px-3.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-medium inline-flex items-center gap-1.5 hover:border-[var(--accent-primary)] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${snap.checkingAppUpdate ? 'animate-spin' : ''}`} />
            <span>Check for updates</span>
          </button>

          <button
            type="button"
            disabled={snap.checkingModelUpdates}
            onClick={() => void offlineManager.checkForRemoteModelUpdates()}
            data-testid="offline-check-model-updates-btn"
            className="min-h-[44px] px-3.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm font-medium inline-flex items-center gap-1.5 hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <CloudDownload className="w-4 h-4 shrink-0" />
            <span>Check for model updates</span>
          </button>
        </div>

        {/* Update prompt / status messages */}
        {snap.needRefresh && (
          <div
            data-testid="settings-update-available-banner"
            className="p-3 rounded-lg bg-teal-500/15 border border-teal-500/40 flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-sm font-medium text-teal-300">
              New version available — Reload
            </span>
            <button
              type="button"
              onClick={() => void offlineManager.applyAppUpdate()}
              className="min-h-[44px] px-3.5 rounded-lg bg-teal-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload</span>
            </button>
          </div>
        )}

        {!snap.needRefresh && snap.appUpdateMessage && (
          <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
            {snap.appUpdateMessage}
          </div>
        )}

        {snap.modelUpdateMessage && (
          <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
            {snap.modelUpdateMessage}
          </div>
        )}
      </section>

      {/* Settings -> Install */}
      <section
        className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3.5 text-sm"
        data-testid="settings-install-page"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Install FlapAtlas 3D on Your Phone</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {isInstalled
                ? 'Running in standalone installed mode for offline clinical reference.'
                : 'Publish once via GitHub Pages (HTTPS) and install to your home screen for zero-network use.'}
            </p>
          </div>
          <PWAInstallButton />
        </div>

        <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl p-3.5">
          <li>
            <strong className="text-[var(--text-primary)]">Export or commit</strong> this project to a GitHub repository on the <code className="font-mono text-xs">main</code> branch.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Enable GitHub Pages</strong>: in your repository go to <strong className="text-[var(--text-primary)]">Settings → Pages</strong>, choose <strong className="text-[var(--text-primary)]">GitHub Actions</strong> as the source, and let the included <code className="font-mono text-xs">pages.yml</code> workflow build and deploy.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Open the HTTPS URL in Chrome</strong> on your Android phone (or Safari on iPhone/iPad).
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Install the app</strong>: tap <strong className="text-[var(--text-primary)]">Install app</strong> (or Chrome menu <strong className="text-[var(--text-primary)]">⋮ → Add to Home screen / Install app</strong>; on iPhone tap <strong className="text-[var(--text-primary)]">Share → Add to Home Screen</strong>).
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Open once online</strong> and keep FlapAtlas open until <strong className="text-[var(--text-primary)]">Settings → Offline Manager</strong> displays <strong className="text-emerald-400">Offline ready ✓</strong>.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Test in Airplane mode</strong>: enable Airplane mode, close the app, and relaunch from your home screen to confirm full 3D anatomy works with zero network requests.
          </li>
        </ol>
      </section>
    </div>
  );
};
