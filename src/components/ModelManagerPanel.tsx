import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  Cloud,
  Crosshair,
  Database,
  Download,
  FolderUp,
  Globe,
  HardDrive,
  Link2,
  RefreshCw,
  RotateCcw,
  Search,
  Target,
  Trash2,
  Wrench,
} from 'lucide-react';
import { VESSELS } from '../data/index';
import { listAvailableMappingTargets } from '../models/anatomyMap';
import {
  CachedGlbMetadata,
  clearCachedGlbs,
  listCachedGlbs,
  putCachedGlb,
} from '../models/modelCache';
import {
  AnatomicalSystemId,
  buildLocalBundledManifest,
  DEFAULT_MODEL_MANIFEST,
  inferSystemFromFilename,
  SYSTEM_DISPLAY_META,
} from '../models/modelManifest';
import { describeSourceUnits } from '../models/modelNormalization';
import { useAtlasStore } from '../store/useAtlasStore';

interface LocalModelStatus {
  availableFiles: string[];
  totalMB: number;
}

export const ModelManagerPanel: React.FC = () => {
  const flaps = useAtlasStore((s) => s.flaps);
  const modelSourceMode = useAtlasStore((s) => s.modelSourceMode);
  const remoteModelBaseUrl = useAtlasStore((s) => s.remoteModelBaseUrl);
  const activeModelStats = useAtlasStore((s) => s.activeModelStats);
  const modelLoadProgress = useAtlasStore((s) => s.modelLoadProgress);
  const meshMappingReport = useAtlasStore((s) => s.meshMappingReport);
  const customAnatomyOverrides = useAtlasStore((s) => s.customAnatomyOverrides);
  const editorMode = useAtlasStore((s) => s.editorMode);
  const editorUnmappedSearchSeed = useAtlasStore((s) => s.editorUnmappedSearchSeed);
  const anchors = useAtlasStore((s) => s.anchors);
  const unmappedMusclesReport = useAtlasStore((s) => s.unmappedMusclesReport);
  const operativeUnresolvedReport = useAtlasStore((s) => s.operativeUnresolvedReport);

  const setModelSourceMode = useAtlasStore((s) => s.setModelSourceMode);
  const setRemoteModelBaseUrl = useAtlasStore((s) => s.setRemoteModelBaseUrl);
  const triggerModelReload = useAtlasStore((s) => s.triggerModelReload);
  const setCustomGlb = useAtlasStore((s) => s.setCustomGlb);
  const setEditorMode = useAtlasStore((s) => s.setEditorMode);
  const saveAnatomyOverride = useAtlasStore((s) => s.saveAnatomyOverride);
  const removeAnatomyOverride = useAtlasStore((s) => s.removeAnatomyOverride);
  const clearAnatomyOverrides = useAtlasStore((s) => s.clearAnatomyOverrides);
  const clearEditorUnmappedSearchSeed = useAtlasStore((s) => s.clearEditorUnmappedSearchSeed);
  const focusStructureIn3D = useAtlasStore((s) => s.focusStructureIn3D);
  const openCalibrationPage = useAtlasStore((s) => s.openCalibrationPage);

  const [remoteDraft, setRemoteDraft] = useState(remoteModelBaseUrl);
  const [cachedMeta, setCachedMeta] = useState<CachedGlbMetadata[]>([]);
  const [localStatus, setLocalStatus] = useState<LocalModelStatus>({ availableFiles: [], totalMB: 0 });
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [unmappedQuery, setUnmappedQuery] = useState('');
  const [unmappedMusclesQuery, setUnmappedMusclesQuery] = useState('');
  const [unmappedSystemFilter, setUnmappedSystemFilter] = useState<'all' | AnatomicalSystemId>('all');
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
  const [manualMeshName, setManualMeshName] = useState('');
  const [manualTargetId, setManualTargetId] = useState('vastus_lateralis');

  const unmappedReportRef = useRef<HTMLDivElement | null>(null);

  const multiFileInputRef = useRef<HTMLInputElement | null>(null);

  const availableTargets = useMemo(() => listAvailableMappingTargets(VESSELS, flaps), [flaps]);

  const refreshDiagnostics = useCallback(async () => {
    const cached = await listCachedGlbs();
    setCachedMeta(cached);
    const bundled = buildLocalBundledManifest();
    setLocalStatus({
      availableFiles: bundled.map((e) => e.fileName),
      totalMB: Number(bundled.reduce((sum, e) => sum + e.approxSizeMB, 0).toFixed(2)),
    });
  }, []);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics, activeModelStats]);

  useEffect(() => {
    setRemoteDraft(remoteModelBaseUrl);
  }, [remoteModelBaseUrl]);

  useEffect(() => {
    if (editorUnmappedSearchSeed) {
      setUnmappedQuery(editorUnmappedSearchSeed);
      setManualMeshName(editorUnmappedSearchSeed);
      setUnmappedSystemFilter('all');
      clearEditorUnmappedSearchSeed();
      window.setTimeout(() => {
        unmappedReportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [editorUnmappedSearchSeed, clearEditorUnmappedSearchSeed]);

  const activeCachedFiles = useMemo(
    () => (activeModelStats?.loadedFiles ?? []).filter((f) => f.source === 'Cache'),
    [activeModelStats]
  );

  const effectiveCachedCount =
    cachedMeta.length > 0 ? cachedMeta.length : activeCachedFiles.length;

  const totalCachedSizeLabel = useMemo(() => {
    const totalBytes =
      cachedMeta.length > 0
        ? cachedMeta.reduce((acc, item) => acc + item.byteLength, 0)
        : activeCachedFiles.reduce((acc, item) => acc + item.byteLength, 0);
    if (totalBytes === 0) return '0 MB';
    if (totalBytes < 1024 * 100) {
      return `${Math.max(1, Math.round(totalBytes / 1024))} KB`;
    }
    return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
  }, [cachedMeta, activeCachedFiles]);

  const handleMultiSystemUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    try {
      let cachedCount = 0;
      const detectedSystems: AnatomicalSystemId[] = [];
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const sys = inferSystemFromFilename(file.name);
        detectedSystems.push(sys);
        await putCachedGlb({
          key: `uploaded:${sys}`,
          system: sys,
          fileName: file.name,
          sourceUrl: `uploaded://${file.name}`,
          sourceKind: 'uploaded',
          byteLength: buffer.byteLength,
          cachedAtIso: new Date().toISOString(),
          buffer,
        });
        cachedCount += 1;
      }

      setCustomGlb(null, null);
      setModelSourceMode('uploaded');
      triggerModelReload();
      await refreshDiagnostics();
      setStatusNotice(
        `Cached ${cachedCount} local override GLB file${cachedCount === 1 ? '' : 's'} (${Array.from(new Set(detectedSystems)).join(', ')}) in IndexedDB at real 1:1 metre scale (no rescaling). Unoverridden systems continue streaming from BodyParts3D 4.0 GitHub.`
      );
    } catch (err) {
      setStatusNotice(
        `Upload error: ${err instanceof Error ? err.message : 'Could not store GLB files.'}`
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleApplyRemoteUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = remoteDraft.trim();
    if (!trimmed) {
      setStatusNotice('Enter a valid HTTPS CORS-enabled base URL serving skin.glb, skeleton.glb, etc.');
      return;
    }
    try {
      // Validate URL syntax
      new URL(trimmed);
    } catch {
      setStatusNotice('Invalid URL format. Example: https://cdn.example.com/flapatlas-models');
      return;
    }
    setCustomGlb(null, null);
    setRemoteModelBaseUrl(trimmed);
    setStatusNotice(
      `Configured remote model host (${trimmed}). Progressive loading & IndexedDB caching started.`
    );
  };

  const handleClearCache = async () => {
    await clearCachedGlbs();
    setCustomGlb(null, null);
    if (modelSourceMode === 'uploaded') {
      setModelSourceMode('auto');
    } else {
      triggerModelReload();
    }
    await refreshDiagnostics();
    setStatusNotice('Cleared all cached GLB binary models from IndexedDB.');
  };

  const handleAssignMapping = (meshName: string, targetId: string) => {
    const target = availableTargets.find((t) => t.targetId === targetId);
    if (!target || !meshName.trim()) return;
    saveAnatomyOverride({
      meshName: meshName.trim(),
      targetId: target.targetId,
      label: target.label.replace(/\s*\([^)]*\)$/, ''),
      kind: target.kind,
      linkedFlapIds: target.linkedFlapIds,
    });
    setStatusNotice(`Mapped "${meshName.trim()}" → ${target.label}.`);
  };

  const handleExportOverridesJson = () => {
    const payload = {
      exportedAtIso: new Date().toISOString(),
      overrides: customAnatomyOverrides,
      unmappedCount: meshMappingReport?.unmappedCount ?? 0,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlapAtlas3D_anatomy_map_overrides_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusNotice('Exported custom Terminologia Anatomica mesh overrides JSON.');
  };

  const effectiveReport = useMemo(() => {
    if (!meshMappingReport) return null;
    const overrideKeys = new Set(
      Object.keys(customAnatomyOverrides).map((k) => k.trim().toLowerCase())
    );
    const remainingUnmapped = meshMappingReport.unmappedEntries.filter(
      (item) => !overrideKeys.has(item.meshName.trim().toLowerCase())
    );
    const resolvedByOverride = meshMappingReport.unmappedEntries.length - remainingUnmapped.length;
    const mappedCount = Math.min(
      meshMappingReport.totalMeshes,
      meshMappingReport.mappedCount + resolvedByOverride
    );
    const unmappedCount = remainingUnmapped.length;
    const coveragePct =
      meshMappingReport.totalMeshes > 0
        ? Math.round((mappedCount / meshMappingReport.totalMeshes) * 100)
        : 100;
    return {
      ...meshMappingReport,
      mappedCount,
      unmappedCount,
      coveragePct,
      unmappedEntries: remainingUnmapped,
    };
  }, [meshMappingReport, customAnatomyOverrides]);

  const unmappedBySystem = useMemo(() => {
    const counts: Partial<Record<AnatomicalSystemId, number>> = {};
    if (!effectiveReport) return counts;
    for (const item of effectiveReport.unmappedEntries) {
      counts[item.system] = (counts[item.system] || 0) + 1;
    }
    return counts;
  }, [effectiveReport]);

  const filteredUnmapped = useMemo(() => {
    if (!effectiveReport) return [];
    const q = unmappedQuery.trim().toLowerCase();
    return effectiveReport.unmappedEntries.filter((item) => {
      if (unmappedSystemFilter !== 'all' && item.system !== unmappedSystemFilter) return false;
      return (
        !q ||
        item.meshName.toLowerCase().includes(q) ||
        (item.normalizedName || '').toLowerCase().includes(q) ||
        (item.fj || '').toLowerCase().includes(q) ||
        (item.fma || '').toLowerCase().includes(q) ||
        item.system.toLowerCase().includes(q) ||
        item.laterality.toLowerCase().includes(q)
      );
    });
  }, [effectiveReport, unmappedQuery, unmappedSystemFilter]);

  const filteredUnmappedMuscles = useMemo(() => {
    const q = unmappedMusclesQuery.trim().toLowerCase();
    if (!q) return unmappedMusclesReport;
    return unmappedMusclesReport.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.meshName.toLowerCase().includes(q) ||
        (m.groupLabel || '').toLowerCase().includes(q) ||
        m.side.toLowerCase().includes(q)
    );
  }, [unmappedMusclesReport, unmappedMusclesQuery]);

  const overrideList = useMemo(
    () => Object.values(customAnatomyOverrides),
    [customAnatomyOverrides]
  );

  return (
    <div
      className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-5 text-xs"
      data-testid="real-anatomy-model-manager"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-primary)] flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5" />
            <span>Unified BodyParts3D 4.0 Models (GitHub · Draco GLB · Real 1:1 Metre Scale)</span>
          </div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
            Progressive GitHub CDN Loader, Merged Per-System Geometry &amp; FMA/TA Mapper
          </h2>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Streams unified BodyParts3D 4.0 (CC BY 4.0) Draco GLBs directly from{' '}
            <code className="font-mono text-[10px]">ralhaidhani/flapatlas-models</code> via jsDelivr
            CDN with automatic GitHub Raw fallback and IndexedDB (<code className="font-mono text-[10px]">flapatlas-bp3d-v4</code>)
            caching. Progressive stages load skeleton &amp; muscles first, then skin, arteries,
            veins &amp; nerves, then organs (hidden by default).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            data-testid="model-manager-active-mode"
            className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-medium border ${
              activeModelStats?.mode === 'real-glb'
                ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            {activeModelStats?.mode === 'real-glb'
              ? `BodyParts3D 4.0 Active (${activeModelStats.loadedSystems.length} sys · ${Math.round(activeModelStats.normalizedHeightCm)} cm)`
              : 'Procedural Fallback Active (175 cm)'}
          </span>
        </div>
      </div>

      {/* Mode Switcher + Calibration Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2">
          <div className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Model Source Priority</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCustomGlb(null, null);
                setModelSourceMode('auto');
              }}
              data-testid="model-mode-auto-btn"
              className={`py-1.5 px-2 rounded-md border font-medium text-[11px] ${
                modelSourceMode === 'auto'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              Auto (Bundled Offline)
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomGlb(null, null);
                setModelSourceMode('procedural');
              }}
              data-testid="model-mode-procedural-btn"
              className={`py-1.5 px-2 rounded-md border font-medium text-[11px] ${
                modelSourceMode === 'procedural'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              Procedural Fallback
            </button>
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            Primary: <span className="font-mono text-[var(--text-primary)]">Bundled /models/ (Offline)</span>{' '}
            · Bundled files: <span className="font-mono">{localStatus.availableFiles.length}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2">
          <div className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <FolderUp className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Optional Local .GLB Override (Secondary)</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">
            Primary models stream automatically from GitHub. Use this optional secondary override
            only if testing custom local <code className="font-mono">.glb</code> exports in IndexedDB
            at real 1:1 m scale.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => multiFileInputRef.current?.click()}
              data-testid="upload-system-glbs-btn"
              className="h-8 px-2.5 rounded-md bg-[var(--accent-primary)] text-white font-medium text-[11px] inline-flex items-center gap-1.5 hover:opacity-95"
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>Select System .GLB Files</span>
            </button>
            <input
              ref={multiFileInputRef}
              type="file"
              multiple
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              onChange={handleMultiSystemUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2">
          <div className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Remote CORS Host &amp; Offline Cache</span>
          </div>
          <form onSubmit={handleApplyRemoteUrl} className="flex items-center gap-1.5">
            <input
              type="url"
              value={remoteDraft}
              onChange={(e) => setRemoteDraft(e.target.value)}
              placeholder="https://cdn.example.com/models"
              data-testid="remote-model-url-input"
              className="flex-1 min-w-0 h-8 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] font-mono"
            />
            <button
              type="submit"
              data-testid="load-remote-models-btn"
              className="h-8 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] font-medium text-[11px] inline-flex items-center gap-1 shrink-0"
            >
              <Globe className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>Load</span>
            </button>
          </form>
          <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
            <span data-testid="glb-cache-summary" className="font-mono tabular-nums">
              IndexedDB Cache: {effectiveCachedCount} file(s) · {totalCachedSizeLabel}
            </span>
            {effectiveCachedCount > 0 && (
              <button
                type="button"
                onClick={handleClearCache}
                data-testid="clear-model-cache-btn"
                className="text-[var(--danger-text)] hover:underline inline-flex items-center gap-0.5 font-medium"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Real-Scale & Draw-Call Telemetry */}
      {activeModelStats && (
        <div
          className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[11px]"
          data-testid="model-normalization-summary"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--text-secondary)]">
            <span>
              <strong className="text-[var(--text-primary)]">Measured Height:</strong>{' '}
              <span className="font-mono tabular-nums">
                {activeModelStats.normalizedHeightCm} cm
              </span>{' '}
              (real 1:1 m scale)
            </span>
            <span>
              <strong className="text-[var(--text-primary)]">Structures:</strong>{' '}
              <span className="font-mono tabular-nums">{activeModelStats.totalMeshes}</span>
            </span>
            {activeModelStats.drawCallCount ? (
              <span>
                <strong className="text-[var(--text-primary)]">WebGL Draw Calls:</strong>{' '}
                <span className="font-mono tabular-nums text-[var(--accent-primary)] font-semibold">
                  {activeModelStats.drawCallCount}
                </span>
              </span>
            ) : null}
            <span>
              <strong className="text-[var(--text-primary)]">Scale:</strong>{' '}
              <span className="font-mono tabular-nums">{activeModelStats.scaleFactor}×</span>{' '}
              ({describeSourceUnits(activeModelStats.sourceHeightUnits)})
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerModelReload();
              void refreshDiagnostics();
            }}
            className="h-7 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[11px] inline-flex items-center gap-1 text-[var(--text-secondary)]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reload</span>
          </button>
        </div>
      )}

      {/* Per-System Manifest Status Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Manifest Systems (Unified BodyParts3D 4.0 · CC BY 4.0 · GitHub)
          </div>
          {modelLoadProgress.active && (
            <span className="text-[11px] font-mono text-[var(--accent-primary)]">
              {modelLoadProgress.stageLabel} ({modelLoadProgress.pct}%)
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="manifest-systems-grid">
          {DEFAULT_MODEL_MANIFEST.map((entry) => {
            const loadedRecord = activeModelStats?.loadedFiles?.find(
              (f) => f.system === entry.system
            );
            const isLoaded =
              activeModelStats?.mode === 'real-glb' &&
              activeModelStats.loadedSystems.includes(entry.system);
            const isCached = cachedMeta.some((c) => c.system === entry.system);
            const isLocalPresent = localStatus.availableFiles.some(
              (f) => f.toLowerCase() === entry.fileName.toLowerCase()
            );

            return (
              <div
                key={entry.id}
                className={`p-2.5 rounded-lg border space-y-1 ${
                  isLoaded
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/50'
                    : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {SYSTEM_DISPLAY_META[entry.system].label}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] shrink-0">
                    {entry.enabledByDefault ? `S${entry.stage}` : 'Off'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                  {entry.fileName} ·{' '}
                  {loadedRecord
                    ? `${loadedRecord.sizeMB.toFixed(2)} MB`
                    : entry.approxSizeMB >= 0.05
                      ? `~${entry.approxSizeMB} MB`
                      : `~${Math.max(1, Math.round(entry.approxSizeMB * 1024))} KB`}
                </div>
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  {isLoaded ? (
                    <span className="text-[var(--accent-primary)] font-semibold inline-flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" />{' '}
                      {loadedRecord ? loadedRecord.source : 'Loaded'}
                    </span>
                  ) : !entry.enabledByDefault ? (
                    <span className="text-[var(--text-muted)]">Not loaded by default</span>
                  ) : isCached ? (
                    <span className="text-[var(--success-text)] font-medium inline-flex items-center gap-0.5">
                      <Database className="w-3 h-3" /> Cached
                    </span>
                  ) : isLocalPresent ? (
                    <span className="text-[var(--accent-primary)] font-medium">Local Ready</span>
                  ) : (
                    <span className="text-[var(--text-muted)]">Pending</span>
                  )}
                  <span className="text-[var(--text-muted)]">
                    {loadedRecord ? `${loadedRecord.meshCount} meshes` : entry.license}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Loaded Files Telemetry Table */}
      {activeModelStats?.loadedFiles && activeModelStats.loadedFiles.length > 0 && (
        <div className="space-y-1.5" data-testid="model-manager-loaded-files-table">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Loaded Files Breakdown ({activeModelStats.loadedFiles.length} active systems)
          </div>
          <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-lg">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  <th className="py-1.5 px-2.5 font-semibold">System</th>
                  <th className="py-1.5 px-2.5 font-semibold">Source</th>
                  <th className="py-1.5 px-2.5 font-semibold text-right">Meshes</th>
                  <th className="py-1.5 px-2.5 font-semibold text-right">Triangles</th>
                  <th className="py-1.5 px-2.5 font-semibold text-right">Size (MB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {activeModelStats.loadedFiles.map((file) => (
                  <tr key={`mm-${file.system}-${file.fileName}`}>
                    <td className="py-1.5 px-2.5 font-medium text-[var(--text-primary)]">
                      {SYSTEM_DISPLAY_META[file.system]?.label ?? file.system}
                    </td>
                    <td className="py-1.5 px-2.5 font-mono text-[10px] text-[var(--text-secondary)]">
                      {file.source}
                    </td>
                    <td className="py-1.5 px-2.5 font-mono tabular-nums text-right text-[var(--text-primary)]">
                      {file.meshCount.toLocaleString()}
                    </td>
                    <td className="py-1.5 px-2.5 font-mono tabular-nums text-right text-[var(--text-secondary)]">
                      {file.triangleCount.toLocaleString()}
                    </td>
                    <td className="py-1.5 px-2.5 font-mono tabular-nums text-right text-[var(--text-secondary)]">
                      {file.sizeMB.toFixed(2)} MB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {statusNotice && (
        <div
          className="p-2.5 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] font-medium text-[11px]"
          data-testid="model-manager-notice"
        >
          {statusNotice}
        </div>
      )}

      {/* Phase 8c: Landmark Anchor Calibration Launcher */}
      <div
        className="pt-4 border-t border-[var(--border-subtle)]"
        data-testid="anchor-calibration-launcher"
      >
        <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 max-w-2xl">
            <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Editor Mode · Landmark Anchor Calibration ({anchors.length} BP3D 4.0 Landmarks)</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent-primary)]">
                {anchors.filter((a) => a.source === 'calibrated').length}/{anchors.length} calibrated
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Auto-propose or click directly on the unified BodyParts3D 4.0 skeleton to calibrate
              ASIS, PSIS, pubic tubercle, iliac crest, greater trochanter, umbilicus, superolateral
              patella, fibular head, lateral malleolus, medial epicondyle, acromion, inferior angle
              of scapula, and mastoid (stored with <code className="font-mono text-[10px]">modelVersion: &quot;bp3d-4.0&quot;</code>).
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCalibrationPage()}
            data-testid="open-anchor-calibration-btn"
            className="h-8 px-3 rounded-md bg-[var(--accent-primary)] text-white text-[11px] font-medium inline-flex items-center gap-1.5 hover:opacity-95 shrink-0"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Open Calibration Page</span>
          </button>
        </div>
      </div>

      {/* Editor Mode: Unmapped Muscles Report (Phase 12-2) */}
      <div
        className="pt-4 border-t border-[var(--border-subtle)] space-y-2.5"
        data-testid="editor-unmapped-muscles-report"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Unmapped muscles ({unmappedMusclesReport.length})</span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Loaded 3D muscles without a reference entry in muscleReference.json.
            </div>
          </div>
        </div>

        {unmappedMusclesReport.length > 0 ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={unmappedMusclesQuery}
                onChange={(e) => setUnmappedMusclesQuery(e.target.value)}
                placeholder="Filter unmapped muscles..."
                data-testid="unmapped-muscles-search-input"
                className="w-full h-8 pl-8 pr-3 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px]"
              />
            </div>
            <div className="max-h-48 overflow-y-auto border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
              {filteredUnmappedMuscles.slice(0, 80).map((item) => (
                <div
                  key={item.meshKey}
                  className="p-2 flex items-center justify-between gap-2 bg-[var(--bg-surface)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[11px] text-[var(--text-primary)] truncate">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">
                      Side: {item.side}
                      {item.groupLabel ? ` · Group: ${item.groupLabel}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => focusStructureIn3D(item.meshName)}
                    className="h-7 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] text-[11px] font-medium inline-flex items-center gap-1 shrink-0"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>3D</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
            No unmapped muscles detected in the currently loaded model.
          </div>
        )}
      </div>

      {/* Editor Mode: Operative Guide Unresolved Structure Names Report (Phase 12-3) */}
      <div
        className="pt-4 border-t border-[var(--border-subtle)] space-y-2.5"
        data-testid="editor-operative-unresolved-report"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Operative guide unresolved structure names ({operativeUnresolvedReport.length})
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Names referenced in operative guide 3D views or adjacent structure lists that have no
              matching mesh in the active 3D model (skipped silently in normal mode).
            </div>
          </div>
        </div>
        {operativeUnresolvedReport.length > 0 ? (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] bg-[var(--bg-subtle)]">
            {operativeUnresolvedReport.map((item, idx) => (
              <div
                key={`${item.flapId}-${item.source}-${item.stepN ?? 'adj'}-${idx}`}
                className="px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[var(--text-primary)]">{item.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    Flap: {item.flapId} · {item.source}
                    {typeof item.stepN === 'number' ? ` (Step ${item.stepN})` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
            Open an operative guide tab with the 3D model loaded to audit unresolved names.
          </div>
        )}
      </div>

      {/* Editor Mode: Unmapped Meshes Report (Phase 10b) */}
      <div
        ref={unmappedReportRef}
        className="pt-4 border-t border-[var(--border-subtle)] space-y-3"
        data-testid="unmapped-meshes-report"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Editor Mode · FMA / Terminologia Anatomica Unmapped Meshes Report</span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Normalizes BodyParts3D FMA names (e.g. &quot;right vastus lateralis [FJxxxx]&quot;) and
              lists any unmapped mesh with its FJ ID, raw name, normalized name, and system.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-primary)] cursor-pointer bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-md">
              <input
                type="checkbox"
                checked={editorMode}
                onChange={(e) => setEditorMode(e.target.checked)}
                data-testid="toggle-editor-mode-checkbox"
                className="w-3.5 h-3.5 accent-[var(--accent-primary)]"
              />
              <span>Clinical Editor Mode</span>
            </label>
            {overrideList.length > 0 && (
              <button
                type="button"
                onClick={handleExportOverridesJson}
                className="h-7 px-2.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[11px] font-medium inline-flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Export Overrides ({overrideList.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Coverage Summary Bar */}
        {effectiveReport ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[10px] text-[var(--text-muted)]">Total GLB Meshes</div>
                <div className="text-base font-bold font-mono text-[var(--text-primary)]">
                  {effectiveReport.totalMeshes}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[10px] text-[var(--text-muted)]">Auto-Mapped (TA)</div>
                <div className="text-base font-bold font-mono text-[var(--accent-primary)]">
                  {effectiveReport.mappedCount} ({effectiveReport.coveragePct}%)
                </div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[10px] text-[var(--text-muted)]">Unmapped Meshes</div>
                <div className="text-base font-bold font-mono text-[var(--warning-text)]">
                  {effectiveReport.unmappedCount}
                </div>
              </div>
            </div>

            {effectiveReport.unmappedCount > 0 ? (
              <div className="space-y-2">
                {/* Per-System Unmapped Breakdown & Filter */}
                <div className="flex flex-wrap items-center gap-1.5" data-testid="unmapped-system-filters">
                  <button
                    type="button"
                    onClick={() => setUnmappedSystemFilter('all')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                      unmappedSystemFilter === 'all'
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    All ({effectiveReport.unmappedCount})
                  </button>
                  {(Object.entries(unmappedBySystem) as Array<[AnatomicalSystemId, number]>).map(
                    ([sys, count]) => (
                      <button
                        key={sys}
                        type="button"
                        onClick={() => setUnmappedSystemFilter(sys)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium border capitalize ${
                          unmappedSystemFilter === sys
                            ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        {SYSTEM_DISPLAY_META[sys]?.label || sys}: {count}
                      </button>
                    )
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={unmappedQuery}
                    onChange={(e) => setUnmappedQuery(e.target.value)}
                    placeholder="Filter unmapped Terminologia Anatomica meshes..."
                    data-testid="unmapped-mesh-search-input"
                    className="w-full h-8 pl-8 pr-3 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px]"
                  />
                </div>
                <div className="text-[10px] text-[var(--text-muted)] flex items-center justify-between">
                  <span>
                    Showing {Math.min(60, filteredUnmapped.length)} of {filteredUnmapped.length}{' '}
                    unmapped structures
                  </span>
                  {unmappedQuery && (
                    <button
                      type="button"
                      onClick={() => setUnmappedQuery('')}
                      className="text-[var(--accent-primary)] hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
                  {filteredUnmapped.slice(0, 60).map((item) => {
                    const chosenTarget =
                      selectedTargets[item.meshName] ||
                      item.suggestedTargetId ||
                      availableTargets[0]?.targetId ||
                      '';
                    return (
                      <div
                        key={`${item.system}-${item.meshName}`}
                        className="p-2 flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-surface)]"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.fj && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--accent-primary)]">
                                {item.fj}
                              </span>
                            )}
                            <span className="font-mono text-[11px] font-medium text-[var(--text-primary)] truncate">
                              {item.meshName}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] flex flex-wrap items-center gap-x-2">
                            <span>Normalized: <code className="font-mono text-[var(--text-secondary)]">{item.normalizedName}</code></span>
                            <span>· System: {item.system}</span>
                            <span>· Side: {item.laterality}</span>
                            {item.fma && <span>· {item.fma}</span>}
                            {item.suggestedLabel ? ` · Suggested: ${item.suggestedLabel}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => focusStructureIn3D(item.meshName)}
                            title={`Locate ${item.meshName} in 3D`}
                            aria-label={`Locate ${item.meshName} in 3D`}
                            className="h-7 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] text-[11px] font-medium inline-flex items-center gap-1"
                          >
                            <Crosshair className="w-3 h-3" />
                            <span>3D</span>
                          </button>
                          <select
                            value={chosenTarget}
                            onChange={(e) =>
                              setSelectedTargets((prev) => ({
                                ...prev,
                                [item.meshName]: e.target.value,
                              }))
                            }
                            aria-label={`Map ${item.meshName}`}
                            className="h-7 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] max-w-[190px]"
                          >
                            {availableTargets.map((t) => (
                              <option key={t.targetId} value={t.targetId}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAssignMapping(item.meshName, chosenTarget)}
                            className="h-7 px-2 rounded bg-[var(--accent-primary)] text-white text-[11px] font-medium inline-flex items-center gap-1"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>Link</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>All {effectiveReport.totalMeshes} loaded GLB meshes are mapped!</span>
              </div>
            )}

            {overrideList.length > 0 && !editorMode && (
              <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                  <span>Active Clinician Overrides ({overrideList.length})</span>
                  <button
                    type="button"
                    onClick={clearAnatomyOverrides}
                    className="text-[var(--danger-text)] hover:underline inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Overrides</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {overrideList.map((ov) => (
                    <span
                      key={ov.meshName}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px]"
                    >
                      <span className="font-mono text-[var(--text-primary)]">{ov.meshName}</span>
                      <span className="text-[var(--text-muted)]">→</span>
                      <span className="text-[var(--accent-primary)] font-medium">{ov.label}</span>
                      <button
                        type="button"
                        onClick={() => removeAnatomyOverride(ov.meshName)}
                        aria-label={`Remove mapping for ${ov.meshName}`}
                        className="text-[var(--text-muted)] hover:text-[var(--danger-text)]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-start gap-2.5 text-[11px] text-[var(--text-secondary)]">
            <AlertCircle className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[var(--text-primary)]">
                Built-in Procedural Body Active (100% pre-mapped).
              </strong>{' '}
              Switch to <strong>Auto (GitHub BP3D 4.0)</strong> above (or return to the 3D Atlas) to
              stream real BodyParts3D 4.0 GLB files from{' '}
              <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-[var(--bg-surface)]">
                ralhaidhani/flapatlas-models
              </code>{' '}
              and inspect any unmapped FMA/FJ structures here.
            </div>
          </div>
        )}

        {/* Manual Clinician Override Tool (always available in Editor Mode) */}
        {editorMode && (
          <div
            className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2.5"
            data-testid="manual-ta-override-editor"
          >
            <div className="text-[11px] font-semibold text-[var(--text-primary)]">
              Add / Pre-Register Custom Terminologia Anatomica Mesh Mapping
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={manualMeshName}
                onChange={(e) => setManualMeshName(e.target.value)}
                placeholder='e.g. "Vastus lateralis muscle.r"'
                data-testid="manual-mesh-name-input"
                className="flex-1 min-w-[180px] h-8 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-[11px]"
              />
              <select
                value={manualTargetId}
                onChange={(e) => setManualTargetId(e.target.value)}
                aria-label="Target FlapAtlas anatomy record"
                data-testid="manual-target-select"
                className="h-8 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] max-w-[230px]"
              >
                {availableTargets.map((t) => (
                  <option key={t.targetId} value={t.targetId}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!manualMeshName.trim()) return;
                  handleAssignMapping(manualMeshName, manualTargetId);
                  setManualMeshName('');
                }}
                data-testid="save-manual-override-btn"
                className="h-8 px-3 rounded-md bg-[var(--accent-primary)] text-white font-medium text-[11px]"
              >
                Save Mapping
              </button>
            </div>

            {overrideList.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                  <span>Saved Clinician Overrides ({overrideList.length})</span>
                  <button
                    type="button"
                    onClick={clearAnatomyOverrides}
                    className="text-[var(--danger-text)] hover:underline inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Overrides</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {overrideList.map((ov) => (
                    <span
                      key={ov.meshName}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px]"
                    >
                      <span className="font-mono text-[var(--text-primary)]">{ov.meshName}</span>
                      <span className="text-[var(--text-muted)]">→</span>
                      <span className="text-[var(--accent-primary)] font-medium">{ov.label}</span>
                      <button
                        type="button"
                        onClick={() => removeAnatomyOverride(ov.meshName)}
                        aria-label={`Remove mapping for ${ov.meshName}`}
                        className="text-[var(--text-muted)] hover:text-[var(--danger-text)]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
