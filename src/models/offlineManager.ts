import { useEffect, useState } from 'react';
import {
  clearCachedGlbs,
  listCachedGlbs,
  OFFLINE_PACK_CACHE_NAME,
  OFFLINE_PACK_CACHE_VERSION,
  purgeLegacyModelCaches,
  putCachedGlb,
} from './modelCache';
import {
  BP3D_UNIFIED_COMMIT,
  DEFAULT_CDN_MAIN_MODEL_BASE_URL,
  getBundledBaseUrl,
  OFFLINE_PACK_REQUIRED_FILES,
  OfflinePackFileSpec,
} from './modelManifest';

const BOOTSTRAP_SEEN_STORAGE_KEY = `flapatlas_offline_bootstrap_seen_${OFFLINE_PACK_CACHE_VERSION}`;

export interface OfflinePackReadiness {
  totalFiles: number;
  cachedFiles: number;
  coreTotalFiles: number;
  coreCachedFiles: number;
  coreReady: boolean;
  offlineReady: boolean;
  pct: number;
  corePct: number;
}

export interface OfflineManagerSnapshot extends OfflinePackReadiness {
  initialized: boolean;
  cacheVersion: string;
  cachedBytes: number;
  totalPackBytes: number;
  storageUsageBytes: number | null;
  storageQuotaBytes: number | null;
  storagePersisted: boolean | null;
  downloading: boolean;
  redownloading: boolean;
  currentFileLabel: string | null;
  error: string | null;
  bootstrapSeen: boolean;
  bootstrapDismissed: boolean;
  needRefresh: boolean;
  checkingAppUpdate: boolean;
  appUpdateMessage: string | null;
  checkingModelUpdates: boolean;
  modelUpdateMessage: string | null;
  cachedFileIds: string[];
}

export function evaluateOfflinePackReadiness(
  cachedIds: ReadonlySet<string>,
  files: readonly OfflinePackFileSpec[] = OFFLINE_PACK_REQUIRED_FILES
): OfflinePackReadiness {
  const totalFiles = files.length;
  let cachedFiles = 0;
  let coreTotalFiles = 0;
  let coreCachedFiles = 0;

  for (const file of files) {
    const isCached = cachedIds.has(file.id);
    if (isCached) cachedFiles += 1;
    if (file.tier === 'core') {
      coreTotalFiles += 1;
      if (isCached) coreCachedFiles += 1;
    }
  }

  const coreReady = coreTotalFiles > 0 && coreCachedFiles === coreTotalFiles;
  const offlineReady = totalFiles > 0 && cachedFiles === totalFiles;
  const pct = totalFiles > 0 ? Math.round((cachedFiles / totalFiles) * 100) : 0;
  const corePct = coreTotalFiles > 0 ? Math.round((coreCachedFiles / coreTotalFiles) * 100) : 0;

  return {
    totalFiles,
    cachedFiles,
    coreTotalFiles,
    coreCachedFiles,
    coreReady,
    offlineReady,
    pct,
    corePct,
  };
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const TOTAL_PACK_BYTES_APPROX = OFFLINE_PACK_REQUIRED_FILES.reduce(
  (sum, item) => sum + item.approxBytes,
  0
);

function readBootstrapSeen(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(BOOTSTRAP_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeBootstrapSeen(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BOOTSTRAP_SEEN_STORAGE_KEY, '1');
    }
  } catch {
    // ignore storage errors
  }
}

function resolveFileUrl(relativePath: string): string {
  const base = getBundledBaseUrl();
  return `${base}${relativePath.replace(/^\/+/, '')}`;
}

function resolveAbsoluteUrl(relativeUrl: string): string {
  if (typeof window === 'undefined') return relativeUrl;
  try {
    return new URL(relativeUrl, window.location.href).href;
  } catch {
    return relativeUrl;
  }
}

class OfflineManagerController {
  private state: OfflineManagerSnapshot;
  private listeners = new Set<() => void>();
  private initialized = false;
  private activeDownloadPromise: Promise<void> | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private updateSwFn: ((reloadPage?: boolean) => Promise<void>) | null = null;

  constructor() {
    const seen = readBootstrapSeen();
    const initial = evaluateOfflinePackReadiness(new Set<string>());
    this.state = {
      ...initial,
      initialized: false,
      cacheVersion: OFFLINE_PACK_CACHE_VERSION,
      cachedBytes: 0,
      totalPackBytes: TOTAL_PACK_BYTES_APPROX,
      storageUsageBytes: null,
      storageQuotaBytes: null,
      storagePersisted: null,
      downloading: false,
      redownloading: false,
      currentFileLabel: null,
      error: null,
      bootstrapSeen: seen,
      bootstrapDismissed: seen,
      needRefresh: false,
      checkingAppUpdate: false,
      appUpdateMessage: null,
      checkingModelUpdates: false,
      modelUpdateMessage: null,
      cachedFileIds: [],
    };
  }

  getSnapshot = (): OfflineManagerSnapshot => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(patch: Partial<OfflineManagerSnapshot>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  attachServiceWorkerController(params: {
    updateSW?: (reloadPage?: boolean) => Promise<void>;
    registration?: ServiceWorkerRegistration | null;
  }): void {
    if (params.updateSW) {
      this.updateSwFn = params.updateSW;
    }
    if (params.registration) {
      this.swRegistration = params.registration;
    }
  }

  notifyNeedRefresh(): void {
    this.setState({
      needRefresh: true,
      appUpdateMessage: 'New version available — Reload',
    });
  }

  notifySwOfflineReady(): void {
    void this.inspectOfflinePackStatus();
  }

  dismissBootstrapOverlay(): void {
    writeBootstrapSeen();
    this.setState({
      bootstrapSeen: true,
      bootstrapDismissed: true,
    });
  }

  async refreshStorageEstimate(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage) return;
    try {
      const [estimate, persisted] = await Promise.all([
        typeof navigator.storage.estimate === 'function'
          ? navigator.storage.estimate()
          : Promise.resolve(null),
        typeof navigator.storage.persisted === 'function'
          ? navigator.storage.persisted()
          : Promise.resolve(null),
      ]);
      this.setState({
        storageUsageBytes: typeof estimate?.usage === 'number' ? estimate.usage : null,
        storageQuotaBytes: typeof estimate?.quota === 'number' ? estimate.quota : null,
        storagePersisted: typeof persisted === 'boolean' ? persisted : this.state.storagePersisted,
      });
    } catch {
      // ignore in restricted environments
    }
  }

  async requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage) return false;
    try {
      let persisted = false;
      if (typeof navigator.storage.persisted === 'function') {
        persisted = await navigator.storage.persisted();
      }
      if (!persisted && typeof navigator.storage.persist === 'function') {
        persisted = await navigator.storage.persist();
      }
      this.setState({ storagePersisted: persisted });
      return persisted;
    } catch {
      return false;
    }
  }

  async inspectOfflinePackStatus(): Promise<OfflinePackReadiness> {
    const cachedIds = new Set<string>();
    let cachedBytes = 0;

    const idbRecords = await listCachedGlbs().catch(() => []);
    const idbBySystem = new Map(
      idbRecords.filter((r) => r.sourceKind === 'local').map((r) => [r.system, r])
    );

    const hasCacheApi = typeof caches !== 'undefined' && typeof caches.open === 'function';
    let packCache: Cache | null = null;
    if (hasCacheApi) {
      try {
        packCache = await caches.open(OFFLINE_PACK_CACHE_NAME);
      } catch {
        packCache = null;
      }
    }

    for (const file of OFFLINE_PACK_REQUIRED_FILES) {
      const relUrl = resolveFileUrl(file.relativePath);
      const absUrl = resolveAbsoluteUrl(relUrl);

      let matchedResp: Response | undefined;
      if (packCache) {
        matchedResp = (await packCache.match(absUrl)) ?? (await packCache.match(relUrl));
      }
      if (!matchedResp && hasCacheApi && typeof caches.match === 'function') {
        try {
          matchedResp = (await caches.match(absUrl)) ?? (await caches.match(relUrl));
        } catch {
          matchedResp = undefined;
        }
      }

      if (matchedResp) {
        cachedIds.add(file.id);
        const lenHeader = Number(matchedResp.headers.get('content-length') || 0);
        const idbEntry = file.system ? idbBySystem.get(file.system) : undefined;
        cachedBytes +=
          Number.isFinite(lenHeader) && lenHeader > 0
            ? lenHeader
            : idbEntry?.byteLength ?? file.approxBytes;
        continue;
      }

      if (file.kind === 'glb' && file.system && idbBySystem.has(file.system)) {
        cachedIds.add(file.id);
        cachedBytes += idbBySystem.get(file.system)!.byteLength;
      }
    }

    const readiness = evaluateOfflinePackReadiness(cachedIds);
    if (readiness.coreReady) {
      writeBootstrapSeen();
    }

    this.setState({
      ...readiness,
      initialized: true,
      cachedBytes,
      cachedFileIds: Array.from(cachedIds),
      bootstrapSeen: this.state.bootstrapSeen || readiness.coreReady,
      bootstrapDismissed: this.state.bootstrapDismissed || readiness.coreReady,
    });

    await this.refreshStorageEstimate();
    return readiness;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await purgeLegacyModelCaches();
    await this.requestPersistentStorage();
    const readiness = await this.inspectOfflinePackStatus();

    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    if (!readiness.offlineReady && isOnline) {
      void this.ensureOfflinePackCached({ forceRedownload: false });
    }
  }

  async ensureOfflinePackCached(options?: { forceRedownload?: boolean }): Promise<void> {
    if (this.activeDownloadPromise) {
      return this.activeDownloadPromise;
    }

    const forceRedownload = Boolean(options?.forceRedownload);

    this.activeDownloadPromise = (async () => {
      const hasCacheApi = typeof caches !== 'undefined' && typeof caches.open === 'function';

      if (forceRedownload) {
        this.setState({
          downloading: true,
          redownloading: true,
          error: null,
          currentFileLabel: 'Clearing previous pack…',
        });
        if (hasCacheApi && typeof caches.delete === 'function') {
          try {
            await caches.delete(OFFLINE_PACK_CACHE_NAME);
          } catch {
            // ignore
          }
        }
        await clearCachedGlbs('local');
        this.setState({
          ...evaluateOfflinePackReadiness(new Set<string>()),
          cachedBytes: 0,
          cachedFileIds: [],
        });
      } else {
        this.setState({
          downloading: true,
          redownloading: false,
          error: null,
        });
      }

      let packCache: Cache | null = null;
      if (hasCacheApi) {
        try {
          packCache = await caches.open(OFFLINE_PACK_CACHE_NAME);
        } catch {
          packCache = null;
        }
      }

      const cachedIds = new Set<string>(forceRedownload ? [] : this.state.cachedFileIds);
      const byteLengths = new Map<string, number>();

      // Core files first so skeleton + muscles + skin + Draco finish first and unlock the app
      const orderedFiles = [
        ...OFFLINE_PACK_REQUIRED_FILES.filter((f) => f.tier === 'core'),
        ...OFFLINE_PACK_REQUIRED_FILES.filter((f) => f.tier === 'extended'),
      ];

      let lastError: string | null = null;

      for (const file of orderedFiles) {
        const relUrl = resolveFileUrl(file.relativePath);
        const absUrl = resolveAbsoluteUrl(relUrl);

        this.setState({ currentFileLabel: file.label });

        try {
          let response: Response | undefined;

          if (!forceRedownload) {
            if (packCache) {
              response = (await packCache.match(absUrl)) ?? (await packCache.match(relUrl));
            }
            if (!response && hasCacheApi && typeof caches.match === 'function') {
              response = (await caches.match(absUrl)) ?? (await caches.match(relUrl));
              if (response && packCache) {
                await packCache.put(absUrl, response.clone());
              }
            }
          }

          if (!response) {
            const fetched = await fetch(absUrl, {
              mode: 'same-origin',
              cache: forceRedownload ? 'reload' : 'default',
            });
            if (!fetched.ok) {
              throw new Error(`HTTP ${fetched.status} for ${file.relativePath}`);
            }
            const contentType = fetched.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
              throw new Error(`Unexpected HTML response for ${file.relativePath}`);
            }
            response = fetched;
            if (packCache) {
              await packCache.put(absUrl, response.clone());
            }
          }

          // For GLB files, also seed IndexedDB so Viewer3D loads instantaneously
          if (file.kind === 'glb' && file.system) {
            const buf = await response.clone().arrayBuffer();
            if (buf.byteLength >= 12) {
              const magic = new DataView(buf).getUint32(0, true);
              if (magic === 0x46546c67) {
                const fileName = file.relativePath.split('/').pop() || `${file.system}.glb`;
                await putCachedGlb({
                  key: `bp3d4:local:${file.system}:${relUrl}`,
                  system: file.system,
                  fileName,
                  sourceUrl: relUrl,
                  sourceKind: 'local',
                  byteLength: buf.byteLength,
                  cachedAtIso: new Date().toISOString(),
                  buffer: buf,
                });
                byteLengths.set(file.id, buf.byteLength);
              }
            }
          } else {
            const lenHeader = Number(response.headers.get('content-length') || 0);
            if (Number.isFinite(lenHeader) && lenHeader > 0) {
              byteLengths.set(file.id, lenHeader);
            } else {
              const buf = await response.clone().arrayBuffer();
              byteLengths.set(file.id, buf.byteLength);
            }
          }

          cachedIds.add(file.id);
          const readiness = evaluateOfflinePackReadiness(cachedIds);
          let totalBytesNow = 0;
          for (const item of OFFLINE_PACK_REQUIRED_FILES) {
            if (cachedIds.has(item.id)) {
              totalBytesNow += byteLengths.get(item.id) ?? item.approxBytes;
            }
          }

          if (readiness.coreReady) {
            writeBootstrapSeen();
          }

          this.setState({
            ...readiness,
            cachedBytes: totalBytesNow,
            cachedFileIds: Array.from(cachedIds),
            bootstrapSeen: this.state.bootstrapSeen || readiness.coreReady,
            bootstrapDismissed: this.state.bootstrapDismissed || readiness.coreReady,
          });
        } catch (err) {
          lastError = err instanceof Error ? err.message : `Failed to cache ${file.label}`;
        }
      }

      await this.inspectOfflinePackStatus();
      this.setState({
        downloading: false,
        redownloading: false,
        currentFileLabel: null,
        error: lastError,
      });
    })().finally(() => {
      this.activeDownloadPromise = null;
    });

    return this.activeDownloadPromise;
  }

  async checkForAppUpdate(): Promise<void> {
    if (this.state.checkingAppUpdate) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setState({ appUpdateMessage: 'Offline — connect to Wi-Fi to check for updates.' });
      return;
    }
    this.setState({ checkingAppUpdate: true, appUpdateMessage: 'Checking for app updates…' });
    try {
      if (this.swRegistration) {
        await this.swRegistration.update();
        // Give the browser a moment to detect an installing/waiting worker
        await new Promise((r) => setTimeout(r, 600));
        if (this.swRegistration.waiting || this.state.needRefresh) {
          this.setState({
            needRefresh: true,
            appUpdateMessage: 'New version available — Reload',
          });
        } else {
          this.setState({
            appUpdateMessage: `App is up to date (${OFFLINE_PACK_CACHE_VERSION}).`,
          });
        }
      } else {
        this.setState({
          appUpdateMessage: `Offline cache active (${OFFLINE_PACK_CACHE_VERSION}); no service worker update pending.`,
        });
      }
    } catch (err) {
      this.setState({
        appUpdateMessage:
          err instanceof Error
            ? `Update check failed: ${err.message}`
            : 'Could not check for updates right now.',
      });
    } finally {
      this.setState({ checkingAppUpdate: false });
    }
  }

  async applyAppUpdate(): Promise<void> {
    if (this.updateSwFn) {
      await this.updateSwFn(true);
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  /**
   * Optional manual action in Settings ONLY (never called automatically on launch).
   * Queries GitHub / jsDelivr to check if a newer BodyParts3D model pack commit exists
   * beyond the bundled commit.
   */
  async checkForRemoteModelUpdates(): Promise<void> {
    if (this.state.checkingModelUpdates) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setState({
        modelUpdateMessage: 'Offline — connect to the internet to check GitHub for model updates.',
      });
      return;
    }

    this.setState({
      checkingModelUpdates: true,
      modelUpdateMessage: 'Checking GitHub model repository…',
    });

    try {
      const resp = await fetch(
        'https://api.github.com/repos/ralhaidhani/flapatlas-models/commits/main',
        { headers: { Accept: 'application/vnd.github+json' } }
      );
      if (resp.ok) {
        const data = (await resp.json()) as { sha?: string; commit?: { committer?: { date?: string } } };
        const latestSha = (data.sha || '').slice(0, 8);
        if (latestSha && latestSha.toLowerCase() === BP3D_UNIFIED_COMMIT.toLowerCase()) {
          this.setState({
            modelUpdateMessage: `Bundled BodyParts3D 4.0 pack matches latest GitHub commit (${BP3D_UNIFIED_COMMIT}).`,
          });
        } else if (latestSha) {
          const dateLabel = data.commit?.committer?.date?.slice(0, 10) || 'recent';
          this.setState({
            modelUpdateMessage: `Newer upstream model commit available on GitHub (${latestSha}, ${dateLabel}; bundled: ${BP3D_UNIFIED_COMMIT}).`,
          });
        } else {
          this.setState({
            modelUpdateMessage: `Bundled model pack commit ${BP3D_UNIFIED_COMMIT} verified.`,
          });
        }
        return;
      }

      // Fallback lightweight check against jsDelivr if GitHub API is rate-limited
      const cdnResp = await fetch(`${DEFAULT_CDN_MAIN_MODEL_BASE_URL}/vessel_index.json`, {
        method: 'HEAD',
      });
      if (cdnResp.ok) {
        this.setState({
          modelUpdateMessage: `Remote model mirror reachable; bundled pack (${BP3D_UNIFIED_COMMIT}) is active offline.`,
        });
      } else {
        this.setState({
          modelUpdateMessage: `Could not reach remote model repository (HTTP ${cdnResp.status}).`,
        });
      }
    } catch (err) {
      this.setState({
        modelUpdateMessage:
          err instanceof Error
            ? `Model update check unavailable: ${err.message}`
            : 'Could not reach GitHub model repository.',
      });
    } finally {
      this.setState({ checkingModelUpdates: false });
    }
  }
}

export const offlineManager = new OfflineManagerController();

export function initOfflineRuntime(): Promise<void> {
  return offlineManager.init();
}

export function useOfflineManager(): OfflineManagerSnapshot {
  const [snap, setSnap] = useState<OfflineManagerSnapshot>(() => offlineManager.getSnapshot());
  useEffect(() => {
    return offlineManager.subscribe(() => {
      setSnap(offlineManager.getSnapshot());
    });
  }, []);
  return snap;
}
