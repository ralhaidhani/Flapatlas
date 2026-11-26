import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  ExternalLink,
  Scale,
  Settings,
} from 'lucide-react';
import {
  ANATOMICAL_MODEL_SOURCES,
  BODYPARTS3D_PHASE10_ATTRIBUTION,
  DEFAULT_MODEL_MANIFEST,
  GITHUB_MODELS_REPO_URL,
  SYSTEM_DISPLAY_META,
  Z_ANATOMY_REQUIRED_ATTRIBUTION,
} from '../models/modelManifest';
import { SCHEMATIC_ONLY_STRUCTURES_CATALOG } from '../models/bp3dCoverage';
import { SCHEMATIC_TAG_TEXT } from '../models/anchorSystem';
import { useAtlasStore } from '../store/useAtlasStore';

export const AboutCreditsView: React.FC = () => {
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const flaps = useAtlasStore((s) => s.flaps);
  const activeModelStats = useAtlasStore((s) => s.activeModelStats);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [techDetailsOpen, setTechDetailsOpen] = useState(false);

  const hasLegacyOverride = Boolean(activeModelStats?.hasLegacyZAnatomy);

  const visibleSources = ANATOMICAL_MODEL_SOURCES.filter(
    (s) => !s.legacyOnly || hasLegacyOverride
  );

  const attributionToCopy = hasLegacyOverride
    ? `${BODYPARTS3D_PHASE10_ATTRIBUTION}\n\n${Z_ANATOMY_REQUIRED_ATTRIBUTION}`
    : BODYPARTS3D_PHASE10_ATTRIBUTION;

  const handleCopyAttribution = async () => {
    try {
      await navigator.clipboard.writeText(attributionToCopy);
      setCopiedNotice(true);
      window.setTimeout(() => setCopiedNotice(false), 2200);
    } catch {
      const el = document.createElement('textarea');
      el.value = attributionToCopy;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        setCopiedNotice(true);
        window.setTimeout(() => setCopiedNotice(false), 2200);
      } finally {
        document.body.removeChild(el);
      }
    }
  };

  const defaultLoadedSizeMB = DEFAULT_MODEL_MANIFEST.filter((m) => m.enabledByDefault)
    .reduce((sum, m) => sum + m.approxSizeMB, 0)
    .toFixed(1);

  const loadedFiles = activeModelStats?.loadedFiles ?? [];

  return (
    <div
      className="h-full w-full overflow-y-auto bg-[var(--bg-app)]"
      data-testid="about-credits-page"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-8">
        {/* Page Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>FlapAtlas 3D</span>
              <span aria-hidden="true">·</span>
              <span>Unified BodyParts3D 4.0 Attribution</span>
              <span aria-hidden="true">·</span>
              <span>CC Attribution 4.0 International</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] [text-wrap:balance]">
              About &amp; Credits
            </h1>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Source attribution, CC BY 4.0 open-license notice, live loaded file telemetry, and
              explicit boundaries between real BodyParts3D 4.0 meshes and schematic structures.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="h-9 px-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Model Manager</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              data-testid="credits-back-to-atlas-btn"
              className="h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to 3D Atlas</span>
            </button>
          </div>
        </header>

        {/* Required License & Verbatim Attribution Statement */}
        <section
          aria-labelledby="credits-attribution-heading"
          className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <h2
                id="credits-attribution-heading"
                className="text-base font-semibold text-[var(--text-primary)]"
              >
                3D Anatomical Geometry Attribution (CC BY 4.0)
              </h2>
            </div>

            <button
              type="button"
              onClick={handleCopyAttribution}
              data-testid="copy-attribution-btn"
              className="h-8 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              {copiedNotice ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <span>Copy Citation</span>
                </>
              )}
            </button>
          </div>

          <blockquote
            data-testid="bp3d-attribution-notice"
            className="p-4 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] leading-relaxed font-normal"
          >
            {BODYPARTS3D_PHASE10_ATTRIBUTION}
          </blockquote>

          {hasLegacyOverride && (
            <blockquote
              data-testid="legacy-override-attribution-notice"
              className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/35 text-xs text-amber-800 dark:text-amber-200 leading-relaxed"
            >
              {Z_ANATOMY_REQUIRED_ATTRIBUTION}
            </blockquote>
          )}

          {/* Upstream Source References */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {visibleSources.map((source) => (
              <div
                key={source.id}
                className="pt-3 border-t border-[var(--border-subtle)] space-y-1.5"
              >
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {source.name}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {source.author}
                  <span className="mx-1.5 text-[var(--text-muted)]" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono">{source.license}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-snug">
                  {source.systemsCovered}
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                  <a
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>Project Source</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={source.licenseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline inline-flex items-center gap-1"
                  >
                    <span>License Deed ({source.license})</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Collapsible Developer / Technical Model Details (collapsed by default) */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setTechDetailsOpen((v) => !v)}
            aria-expanded={techDetailsOpen}
            data-testid="credits-technical-details-toggle"
            className="w-full min-h-[52px] px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Database className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  Developer / Technical Model Details
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Loaded files, repository manifest, mesh counts &amp; schematic catalog
                </div>
              </div>
            </div>
            {techDetailsOpen ? (
              <ChevronUp className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            )}
          </button>

          {techDetailsOpen && (
            <div className="p-5 border-t border-[var(--border-subtle)] space-y-6">
        {/* Live Loaded Files Table (Phase 10e) */}
        <section aria-labelledby="credits-loaded-files-heading" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2
                  id="credits-loaded-files-heading"
                  className="text-base font-semibold text-[var(--text-primary)]"
                >
                  Loaded Files Table (Active Session)
                </h2>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Real 1:1 metre scale (Y-up, +Z anterior, +X subject left) · Active runtime:{' '}
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {activeModelStats?.mode === 'real-glb'
                    ? `BodyParts3D 4.0 (${activeModelStats.loadedSystems.length} systems, ${activeModelStats.totalMeshes.toLocaleString()} structures, ${loadedFiles.reduce((acc, f) => acc + f.triangleCount, 0).toLocaleString()} triangles)`
                    : 'Procedural fallback (175 cm)'}
                </span>
              </p>
            </div>
            <a
              href={GITHUB_MODELS_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1"
            >
              <span>ralhaidhani/flapatlas-models (GitHub)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div
            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden"
            data-testid="credits-loaded-files-table"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                    <th className="py-2.5 px-4 font-semibold">System</th>
                    <th className="py-2.5 px-4 font-semibold">File</th>
                    <th className="py-2.5 px-4 font-semibold">Source</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Meshes</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Triangles</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Size (MB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {loadedFiles.length > 0 ? (
                    loadedFiles.map((file) => (
                      <tr
                        key={`${file.system}-${file.fileName}`}
                        className="hover:bg-[var(--bg-subtle)]/50 transition-colors"
                      >
                        <td className="py-2.5 px-4 font-medium text-[var(--text-primary)] whitespace-nowrap">
                          {SYSTEM_DISPLAY_META[file.system]?.label ?? file.system}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                          {file.fileName}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] border ${
                              file.source === 'Cache'
                                ? 'bg-emerald-500/12 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                                : file.source === 'Local'
                                  ? 'bg-amber-500/12 border-amber-500/35 text-amber-700 dark:text-amber-300'
                                  : 'bg-sky-500/12 border-sky-500/35 text-sky-700 dark:text-sky-300'
                            }`}
                          >
                            {file.source}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-right text-[var(--text-primary)]">
                          {file.meshCount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-right text-[var(--text-secondary)]">
                          {file.triangleCount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-right text-[var(--text-secondary)] whitespace-nowrap">
                          {file.sizeMB.toFixed(2)} MB
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-4 px-4 text-center text-[var(--text-muted)]"
                      >
                        Return to the 3D Atlas to stream unified BodyParts3D 4.0 GLB files from
                        GitHub (`ralhaidhani/flapatlas-models`) and populate live mesh &amp;
                        triangle counts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Derived GLB Manifest Reference */}
        <section aria-labelledby="credits-manifest-heading" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2
                id="credits-manifest-heading"
                className="text-base font-semibold text-[var(--text-primary)]"
              >
                Unified BodyParts3D 4.0 Repository Manifest
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Default progressive download across 7 systems:{' '}
                <span className="font-mono tabular-nums">~{defaultLoadedSizeMB} MB</span> · Cached
                offline in IndexedDB (<code className="font-mono text-[11px]">flapatlas-bp3d-v4</code>)
              </p>
            </div>
          </div>

          <div
            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden"
            data-testid="credits-model-manifest-table"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                    <th className="py-2.5 px-4 font-semibold">File</th>
                    <th className="py-2.5 px-4 font-semibold">Body System</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Expected Nodes</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Approx Size</th>
                    <th className="py-2.5 px-4 font-semibold">Load Stage</th>
                    <th className="py-2.5 px-4 font-semibold">License</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {DEFAULT_MODEL_MANIFEST.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[var(--bg-subtle)]/50 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-[var(--text-primary)] whitespace-nowrap">
                        {entry.fileName}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--text-primary)] whitespace-nowrap">
                        {SYSTEM_DISPLAY_META[entry.system]?.label ?? entry.system}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-right text-[var(--text-secondary)]">
                        {entry.expectedNodes ? `~${entry.expectedNodes}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-right text-[var(--text-secondary)] whitespace-nowrap">
                        {entry.approxSizeMB >= 0.05
                          ? `${entry.approxSizeMB.toFixed(1)} MB`
                          : `${Math.max(1, Math.round(entry.approxSizeMB * 1024))} KB`}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--text-secondary)] whitespace-nowrap">
                        {!entry.enabledByDefault
                          ? 'Off by default'
                          : entry.hiddenByDefault
                            ? `Stage ${entry.stage} (hidden by default)`
                            : `Stage ${entry.stage}`}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                        {entry.license}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Schematic-Only Structures Catalog (Phase 10c & 10e) */}
        <section aria-labelledby="credits-schematic-heading" className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <h2
                id="credits-schematic-heading"
                className="text-base font-semibold text-[var(--text-primary)]"
              >
                Schematic-Only Structures (Absent in BodyParts3D 4.0)
              </h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              FlapAtlas 3D never disguises missing anatomical meshes as real BodyParts3D geometry.
              The muscles, peripheral nerves, and surgical overlays below are rendered with explicit
              schematic badges and bony-landmark-anchored outlines.
            </p>
          </div>

          <div
            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden"
            data-testid="credits-schematic-structures-table"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                    <th className="py-2.5 px-4 font-semibold">Structure</th>
                    <th className="py-2.5 px-4 font-semibold">Category</th>
                    <th className="py-2.5 px-4 font-semibold">BodyParts3D 4.0 Status &amp; Representation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {SCHEMATIC_ONLY_STRUCTURES_CATALOG.map((item) => (
                    <tr
                      key={item.name}
                      className="hover:bg-[var(--bg-subtle)]/50 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-medium text-[var(--text-primary)] whitespace-nowrap">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/12 border border-amber-500/35 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[var(--text-secondary)]">
                        {item.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
            </div>
          )}
        </section>

        {/* Clinical Safety & About Summary */}
        <section className="grid grid-cols-1 gap-6 pt-2">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Geometry Pipeline &amp; Provenance Boundaries
            </h2>
            <ul className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed list-disc pl-4">
              <li>
                <strong className="text-[var(--text-primary)]">Unified coordinate system:</strong>{' '}
                All 7 BodyParts3D 4.0 systems (skeleton, muscles, skin, arteries, veins, nerves,
                organs) share identical 1:1 metre coordinates (Y-up, +Z anterior, +X subject left)
                with zero per-system rescaling or re-centering.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Runtime shading &amp; batching:</strong>{' '}
                PBR tissue materials (ivory bone, deep-red muscle, pearl tendon/fascia, pink viscera,
                red arteries, blue veins, yellow nerves, translucent 15% skin) and smooth vertex
                normals are computed client-side, with static geometry merged per system and per-vertex{' '}
                <code className="font-mono text-[11px]">aMeshIndex</code> raycast pick resolution.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Surgical overlays:</strong>{' '}
                Cutaneous perforators, venae comitantes, cutting guides, and skin paddles projected
                onto <code className="font-mono text-[11px]">skin.glb</code> carry an explicit{' '}
                <span className="font-medium text-[var(--text-primary)]">
                  “{SCHEMATIC_TAG_TEXT}”
                </span>{' '}
                label and never overwrite textbook clinical measurements.
              </li>
            </ul>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              About FlapAtlas 3D &amp; Clinical Disclaimer
            </h2>
            <ul className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed list-disc pl-4">
              <li>
                <strong className="text-[var(--text-primary)]">Curated flap library:</strong>{' '}
                Includes{' '}
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {flaps.length}
                </span>{' '}
                reconstructive flaps across Head &amp; Neck, Trunk, Upper Extremity, Lower
                Extremity, Perineum &amp; Pelvis, and Local/Random-Pattern categories, with 13
                BodyParts3D 4.0 skeletal landmark anchors stored locally in IndexedDB.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Privacy &amp; offline support:</strong>{' '}
                All notes, bookmarks, quiz progress, FMA/TA mapping overrides, and calibrated
                landmark anchors remain strictly local to your browser with zero protected health
                information (PHI) transmission.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Educational use only:</strong>{' '}
                Anatomical variation is common. Always verify against primary surgical literature
                and confirm vascular anatomy with preoperative imaging (CT angiography, Doppler, or
                MRA) before operative planning.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};
