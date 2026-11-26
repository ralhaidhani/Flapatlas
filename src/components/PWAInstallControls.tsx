import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWA';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        data-testid="pwa-install-btn"
        className={
          compact
            ? 'h-8 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] text-xs font-medium inline-flex items-center gap-1.5 transition-colors'
            : 'h-8 px-3 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-95 shrink-0'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          data-testid="pwa-ios-install-btn"
          className="h-8 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Install FlapAtlas 3D on iOS"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 shadow-2xl space-y-3 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Install FlapAtlas 3D on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close iOS install instructions"
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                <li>
                  Tap the <strong className="text-[var(--text-primary)] inline-flex items-center gap-0.5"><Share className="w-3 h-3" /> Share</strong> icon in the Safari toolbar.
                </li>
                <li>
                  Scroll down and tap <strong className="text-[var(--text-primary)]">Add to Home Screen</strong>.
                </li>
                <li>
                  Launch FlapAtlas 3D offline anytime — including operating room Wi-Fi dead zones.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full h-8 rounded-lg bg-[var(--accent-primary)] text-white font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-indicator"
      className="no-print fixed bottom-9 left-3 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Core 3D Atlas, Advisor &amp; Calculators active from cache.</span>
    </div>
  );
};
