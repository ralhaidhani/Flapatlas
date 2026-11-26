import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Gauge,
  Info,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react';
import {
  DEFECT_LOCATIONS,
  GLOSSARY_TERMS,
  QUIZ_QUESTIONS,
  REGIONS,
  VESSELS,
} from '../data/index';
import { runSection1SelfReview } from '../engine/dataIntegrityQa';
import { usePWAInstall } from '../hooks/usePWA';
import { RenderQuality, ThemeMode, useAtlasStore } from '../store/useAtlasStore';
import { auditFlapDataset, VerificationStatus } from '../types/schemas';
import { buildCombinedAuditCsv } from '../models/dopplerPlanner';
import { BODYPARTS3D_PHASE10_ATTRIBUTION } from '../models/modelManifest';
import { FlapEditorModal } from './FlapEditorModal';
import { ModelManagerPanel } from './ModelManagerPanel';
import { OfflineSettingsSection } from './OfflineSettingsSection';
import { PWAInstallButton } from './PWAInstallControls';

export const SettingsDataQualityView: React.FC = () => {
  const flaps = useAtlasStore((s) => s.flaps);
  const theme = useAtlasStore((s) => s.theme);
  const renderQuality = useAtlasStore((s) => s.renderQuality);
  const unitSystem = useAtlasStore((s) => s.unitSystem);
  const colorblindMode = useAtlasStore((s) => s.colorblindMode);
  const teachingMode = useAtlasStore((s) => s.teachingMode);
  const bodySex = useAtlasStore((s) => s.bodySex);
  const customGlbUrl = useAtlasStore((s) => s.customGlbUrl);
  const customGlbName = useAtlasStore((s) => s.customGlbName);

  const setTheme = useAtlasStore((s) => s.setTheme);
  const setRenderQuality = useAtlasStore((s) => s.setRenderQuality);
  const setUnitSystem = useAtlasStore((s) => s.setUnitSystem);
  const setColorblindMode = useAtlasStore((s) => s.setColorblindMode);
  const setTeachingMode = useAtlasStore((s) => s.setTeachingMode);
  const setBodySex = useAtlasStore((s) => s.setBodySex);
  const setCustomGlb = useAtlasStore((s) => s.setCustomGlb);
  const importFlapsJson = useAtlasStore((s) => s.importFlapsJson);
  const resetDataset = useAtlasStore((s) => s.resetDataset);
  const dopplerPlannerMarkers = useAtlasStore((s) => s.dopplerPlannerMarkers);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const setEditorMode = useAtlasStore((s) => s.setEditorMode);
  const setHelpModalOpen = useAtlasStore((s) => s.setHelpModalOpen);
  const activeModelStats = useAtlasStore((s) => s.activeModelStats);

  const { isInstalled } = usePWAInstall();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [auditFilterStatus, setAuditFilterStatus] = useState<'All' | VerificationStatus>('All');
  const [auditSearch, setAuditSearch] = useState('');
  const [createFlapOpen, setCreateFlapOpen] = useState(false);
  const [devAboutOpen, setDevAboutOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const glbInputRef = useRef<HTMLInputElement | null>(null);

  const audit = useMemo(() => auditFlapDataset(flaps), [flaps]);
  const selfReview = useMemo(
    () =>
      runSection1SelfReview({
        flaps,
        vessels: VESSELS,
        regions: REGIONS,
        defectLocations: DEFECT_LOCATIONS,
        quizQuestions: QUIZ_QUESTIONS,
        glossaryTerms: GLOSSARY_TERMS,
      }),
    [flaps]
  );

  const filteredAuditRows = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return flaps
      .map((f) => {
        const entry = audit.verifyBreakdownByFlap.find((r) => r.flapId === f.id);
        return {
          flap: f,
          verifyFields: entry?.verifyFields || [],
        };
      })
      .filter(({ flap }) => {
        if (auditFilterStatus !== 'All' && flap.verification_status !== auditFilterStatus) {
          return false;
        }
        if (q && !flap.name.toLowerCase().includes(q) && !flap.region_group.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      });
  }, [flaps, audit.verifyBreakdownByFlap, auditFilterStatus, auditSearch]);

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(flaps, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlapAtlas3D_dataset_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg(`Exported ${flaps.length} flap records as validated JSON.`);
  };

  const handleExportAuditCsv = () => {
    const csv = buildCombinedAuditCsv(flaps, audit, dopplerPlannerMarkers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlapAtlas3D_verification_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg(
      dopplerPlannerMarkers.length > 0
        ? `Exported verification audit CSV for ${flaps.length} flaps + ${dopplerPlannerMarkers.length} Doppler/CTA planner markers.`
        : `Exported verification audit CSV for ${flaps.length} flaps.`
    );
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = await importFlapsJson(text);
    setStatusMsg(res.message);
    e.target.value = '';
  };

  const handleReset = async () => {
    await resetDataset();
    setStatusMsg('Dataset restored to bundled FlapAtlas 3D baseline.');
  };

  const handleGlbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customGlbUrl && customGlbUrl.startsWith('blob:')) {
      URL.revokeObjectURL(customGlbUrl);
    }
    const objUrl = URL.createObjectURL(file);
    setCustomGlb(objUrl, file.name);
    setStatusMsg(`Loaded external 3D anatomy mesh: ${file.name} (real 1:1 meter scale).`);
    e.target.value = '';
  };

  const handleClearGlb = () => {
    if (customGlbUrl && customGlbUrl.startsWith('blob:')) {
      URL.revokeObjectURL(customGlbUrl);
    }
    setCustomGlb(null, null);
    setStatusMsg('Restored built-in procedural 3D anatomical body model.');
  };

  return (
    <div
      className="h-full overflow-y-auto p-4 sm:p-6 space-y-6 bg-[var(--bg-app)]"
      data-testid="settings-data-quality-view"
    >
      <div className="border-b border-[var(--border-subtle)] pb-4">
        <div className="text-xs font-medium uppercase tracking-wider text-[var(--accent-primary)] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Clinical Governance, Preferences &amp; Offline Data</span>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
          Settings &amp; Data Quality Dashboard
        </h1>
      </div>

      {/* Offline Manager & Install Guide */}
      <OfflineSettingsSection />

      {/* Display, Performance & Accessibility Preferences */}
      <div className="grid grid-cols-1 gap-5">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4 text-sm">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Display, Performance &amp; Accessibility
          </h2>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              Clinical Theme Mode
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'dark', label: 'Dark' },
                  { id: 'or-dim', label: 'OR-Dim' },
                  { id: 'light', label: 'Light' },
                ] as Array<{ id: ThemeMode; label: string }>
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  data-testid={`theme-btn-${t.id}`}
                  className={`min-h-[44px] px-2 rounded-lg border text-sm font-medium transition-colors ${
                    theme === t.id
                      ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5" data-testid="render-quality-setting">
            <div className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>3D Rendering Performance</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'quality', label: 'Quality', hint: 'Sharpest (up to 2x)' },
                  { id: 'balanced', label: 'Balanced', hint: 'Auto DPR (1.5x)' },
                  { id: 'fast', label: 'Fast', hint: 'Battery / 1x' },
                ] as Array<{ id: RenderQuality; label: string; hint: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRenderQuality(opt.id)}
                  data-testid={`quality-btn-${opt.id}`}
                  aria-pressed={renderQuality === opt.id}
                  className={`min-h-[44px] px-2 py-1.5 rounded-lg border text-center transition-colors ${
                    renderQuality === opt.id
                      ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                  }`}
                >
                  <span className="block text-sm font-semibold leading-tight">{opt.label}</span>
                  <span
                    className={`block text-[11px] leading-tight mt-0.5 ${
                      renderQuality === opt.id ? 'text-white/85' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-[var(--text-secondary)]">Units</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setUnitSystem('metric')}
                  className={`min-h-[44px] rounded-lg border text-sm font-medium ${
                    unitSystem === 'metric'
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  Metric
                </button>
                <button
                  type="button"
                  onClick={() => setUnitSystem('imperial')}
                  className={`min-h-[44px] rounded-lg border text-sm font-medium ${
                    unitSystem === 'imperial'
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  Imperial
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-[var(--text-secondary)]">3D Body Model</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setBodySex('female')}
                  className={`min-h-[44px] rounded-lg border text-sm font-medium ${
                    bodySex === 'female'
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  Female
                </button>
                <button
                  type="button"
                  onClick={() => setBodySex('male')}
                  className={`min-h-[44px] rounded-lg border text-sm font-medium ${
                    bodySex === 'male'
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  Male
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <div className="font-medium text-[var(--text-primary)]">
                  Colorblind-Safe Vascular Palette (Okabe-Ito)
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  High-contrast vermilion/blue/yellow arteries, veins, and nerves in 3D.
                </div>
              </div>
              <input
                type="checkbox"
                checked={colorblindMode}
                onChange={(e) => setColorblindMode(e.target.checked)}
                className="w-4 h-4 accent-[var(--accent-primary)]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <div className="font-medium text-[var(--text-primary)]">
                  Teaching / Conference Presentation Mode
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Enlarges key labels and simplifies chrome for Morbidity & Mortality or rounds projection.
                </div>
              </div>
              <input
                type="checkbox"
                checked={teachingMode}
                onChange={(e) => setTeachingMode(e.target.checked)}
                className="w-4 h-4 accent-[var(--accent-primary)]"
              />
            </label>

            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
              <div className="text-[11px] text-[var(--text-muted)]">
                Need a quick orientation or keyboard shortcut list?
              </div>
              <button
                type="button"
                onClick={() => setHelpModalOpen(true)}
                data-testid="settings-open-tour-btn"
                className="h-8 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium inline-flex items-center gap-1.5 hover:border-[var(--accent-primary)] shrink-0"
              >
                <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Quick Tour &amp; Shortcuts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Offline PWA & JSON Import/Export */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4 text-xs">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Dataset Portability & Offline App Install
          </h2>
          <p className="text-[var(--text-secondary)]">
            All clinical edits and verification status promotions are persisted locally via IndexedDB. Export JSON to share a verified institutional dataset with colleagues or import reviewed updates.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              data-testid="export-json-btn"
              className="h-9 px-3 rounded-lg bg-[var(--accent-primary)] text-white font-medium flex items-center gap-1.5 hover:opacity-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Dataset JSON</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium flex items-center gap-1.5 hover:border-[var(--accent-primary)]"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Validated JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleExportAuditCsv}
              className="h-9 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium flex items-center gap-1.5 hover:border-[var(--accent-primary)]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Audit CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setCreateFlapOpen(true)}
              data-testid="settings-create-flap-btn"
              className="h-9 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--accent-primary)] font-medium flex items-center gap-1.5 hover:border-[var(--accent-primary)]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Flap</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="h-9 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--danger-text)] flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Baseline</span>
            </button>
          </div>

          {statusMsg && (
            <div className="p-2.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] font-medium">
              {statusMsg}
            </div>
          )}

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Offline Progressive Web App (PWA)</span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {isInstalled
                  ? 'Installed in standalone mode for offline operating-room reference.'
                  : 'Core 3D atlas, Flap Advisor, calculators, and datasets work offline.'}
              </div>
            </div>
            <PWAInstallButton />
          </div>
        </div>
      </div>

      {/* Collapsible Developer / About Section (Collapsed by default) */}
      <section
        className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden"
        data-testid="settings-developer-about-section"
      >
        <button
          type="button"
          onClick={() => setDevAboutOpen((v) => !v)}
          aria-expanded={devAboutOpen}
          data-testid="settings-developer-about-toggle"
          className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                Developer / About
              </div>
              <div className="text-xs text-[var(--text-muted)] truncate">
                Model sources, loaded files, license credits, custom GLB &amp; QA audit
              </div>
            </div>
          </div>
          {devAboutOpen ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          )}
        </button>

        {devAboutOpen && (
          <div
            data-testid="settings-developer-about-content"
            className="p-4 border-t border-[var(--border-subtle)] space-y-5"
          >
            {/* Attribution & Full About/Credits link */}
            <div className="p-3.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-sm text-[var(--text-primary)]">
                  3D Anatomy License &amp; Credits
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('about')}
                  data-testid="settings-open-about-credits-btn"
                  className="min-h-[40px] px-3 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium"
                >
                  Open About &amp; Credits
                </button>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {BODYPARTS3D_PHASE10_ATTRIBUTION}
              </p>
            </div>

            {/* External GLB Loader */}
            <div
              className="p-3.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2.5 text-xs"
              data-testid="external-glb-loader-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>External 3D Anatomical Mesh (GLB / GLTF)</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Quick-preview any single combined GLB/GLTF mesh (1:1 meter scale).
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[var(--accent-primary)] shrink-0">
                  {customGlbName
                    ? customGlbName
                    : activeModelStats?.mode === 'real-glb'
                      ? 'BodyParts3D 4.0'
                      : 'Procedural'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => glbInputRef.current?.click()}
                  className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium flex items-center gap-1.5 hover:border-[var(--accent-primary)]"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Load .GLB / .GLTF</span>
                </button>
                <input
                  ref={glbInputRef}
                  type="file"
                  accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                  onChange={handleGlbUpload}
                  className="hidden"
                />
                {customGlbUrl && (
                  <button
                    type="button"
                    onClick={handleClearGlb}
                    className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Default</span>
                  </button>
                )}
              </div>
            </div>

            {/* Multi-System Real 3D Anatomical Model Manager & Unmapped Meshes Report */}
            <ModelManagerPanel />

            {/* §1 CLINICAL DATA-INTEGRITY SELF-REVIEW QA CHECKLIST */}
            <div
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3"
              data-testid="section1-self-review-card"
            >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>§1 Clinical Data-Integrity Self-Review QA</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Automated rule-by-rule audit verifying every flap record, numeric range, textbook citation, and cross-file reference.
            </p>
          </div>
          <span
            data-testid="section1-qa-verdict"
            className={`text-xs font-mono font-semibold inline-flex items-center gap-1 ${
              selfReview.allPassed ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]'
            }`}
          >
            {selfReview.allPassed ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>ALL {selfReview.checks.length} CHECKS PASSED</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span>ATTENTION REQUIRED</span>
              </>
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          {selfReview.checks.map((chk) => (
            <div
              key={chk.ruleId}
              className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-[var(--accent-primary)]">
                  {chk.ruleId}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    chk.passed ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]'
                  }`}
                >
                  {chk.passed ? 'PASS' : `${chk.issues.length} ISSUE(S)`}
                </span>
              </div>
              <div className="font-semibold text-[var(--text-primary)] leading-snug">
                {chk.title}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {chk.summary}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DATA QUALITY DASHBOARD */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Clinical Data Quality & Verification Dashboard</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Live Zod schema validation and audit of every measurement or citation marked for clinical advisor review.
            </p>
          </div>
          <span className="text-xs font-mono flex items-center gap-1 text-[var(--success-text)] font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            {audit.schemaErrors.length === 0
              ? `Zod Valid (${audit.validFlaps}/${audit.totalFlaps})`
              : `${audit.schemaErrors.length} Schema Errors`}
          </span>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Total Flaps</div>
            <div className="text-xl font-mono font-bold tabular-nums text-[var(--text-primary)] mt-0.5">
              {audit.totalFlaps}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Verified</div>
            <div className="text-xl font-mono font-bold tabular-nums text-[var(--success-text)] mt-0.5">
              {audit.byVerificationStatus.Verified}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Partially Verified</div>
            <div className="text-xl font-mono font-bold tabular-nums text-[var(--accent-primary)] mt-0.5">
              {audit.byVerificationStatus['Partially verified']}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Needs Review</div>
            <div className="text-xl font-mono font-bold tabular-nums text-[var(--warning-text)] mt-0.5">
              {audit.byVerificationStatus['Needs review']}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Fields Marked Verify</div>
            <div className="text-xl font-mono font-bold tabular-nums text-[var(--warning-text)] mt-0.5">
              {audit.fieldsMarkedVerifyCount}
            </div>
          </div>
        </div>

        {/* Audit Filter & Search Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="inline-flex flex-wrap gap-1">
            {(['All', 'Needs review', 'Partially verified', 'Verified'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setAuditFilterStatus(st)}
                className={`px-2.5 py-1 rounded-md border font-medium transition-colors ${
                  auditFilterStatus === st
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Filter flaps in audit table..."
              aria-label="Filter flaps in audit table"
              className="w-full h-8 pl-8 pr-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>
        </div>

        {/* Detailed Verify Fields Table */}
        <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
              <tr>
                <th className="p-2.5">Flap Record ({filteredAuditRows.length})</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Fields Requiring Clinical Verification</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredAuditRows.map(({ flap, verifyFields }) => (
                <tr key={flap.id} className="hover:bg-[var(--bg-subtle)]/50">
                  <td className="p-2.5">
                    <div className="font-medium text-[var(--text-primary)]">{flap.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {flap.region_group}
                      {flap.last_reviewed ? ` · Reviewed ${flap.last_reviewed}` : ''}
                    </div>
                  </td>
                  <td
                    className={`p-2.5 whitespace-nowrap font-medium ${
                      flap.verification_status === 'Verified'
                        ? 'text-[var(--success-text)]'
                        : flap.verification_status === 'Partially verified'
                          ? 'text-[var(--accent-primary)]'
                          : 'text-[var(--warning-text)]'
                    }`}
                  >
                    {flap.verification_status}
                  </td>
                  <td className="p-2.5 text-[var(--text-secondary)]">
                    {verifyFields.length > 0 ? verifyFields.join(' · ') : 'All numeric ranges & citations reviewed'}
                  </td>
                  <td className="p-2.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        selectFlap(flap.id, true);
                        setEditorMode(true);
                        setActiveTab('library');
                      }}
                      className="inline-flex items-center gap-1 text-[var(--accent-primary)] font-medium hover:underline"
                    >
                      <Eye className="w-3.5 h-3.5" /> Review & Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
          </div>
        )}
      </section>

      {createFlapOpen && (
        <FlapEditorModal mode="create" onClose={() => setCreateFlapOpen(false)} />
      )}
    </div>
  );
};
