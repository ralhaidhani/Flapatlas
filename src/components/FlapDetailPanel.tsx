import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Crosshair,
  Download,
  Edit3,
  FolderPlus,
  GitCompare,
  Highlighter,
  Link2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Star,
  Tag,
  X,
} from 'lucide-react';
import { getCalibratedPaddleSummary } from '../engine/flapMetrics';
import { buildTechniqueStages } from '../engine/techniqueStages';
import { assessFlapBp3dCoverage } from '../models/bp3dCoverage';
import {
  REAL_VESSEL_TAG_TEXT,
  resolveFlapRealVessels,
  SCHEMATIC_OVERLAY_TAG_TEXT,
} from '../models/flapVesselLinker';
import { useAtlasStore } from '../store/useAtlasStore';
import { FlapRecord, formatRange, NumericRange, VerificationStatus } from '../types/schemas';
import { FlapEditorModal } from './FlapEditorModal';
import { SchematicIconBadge } from './SchematicIconBadge';
import { MedicalTermText } from './MedicalTermText';
import {
  findMuscleReferenceForSelection,
  findMuscleReferencesForFlap,
} from '../data/muscleReference';

const OperativeGuideTab = React.lazy(() => import('./OperativeGuideTab'));

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'operative', label: 'Operative guide' },
  { id: 'vascular', label: 'Vascular' },
  { id: 'nerves', label: 'Nerves' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'technique', label: 'Technique' },
  { id: 'pearls', label: 'Pearls & Pitfalls' },
  { id: 'indications', label: 'Indications' },
  { id: 'donor', label: 'Donor Site' },
  { id: 'complications', label: 'Complications' },
  { id: 'alternatives', label: 'Alternatives' },
  { id: 'references', label: 'References' },
] as const;

type DetailTabId = (typeof DETAIL_TABS)[number]['id'];

const RangeValue: React.FC<{
  range: NumericRange | null | undefined;
  unitSystem: 'metric' | 'imperial';
}> = ({ range, unitSystem }) => {
  const f = formatRange(range, unitSystem);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs">
      <span className={f.isUnspecified ? 'text-[var(--warning-text)] italic font-sans' : 'text-[var(--text-primary)] font-medium'}>
        {f.text}
      </span>
      {f.isVerify && !f.isUnspecified && (
        <span className="text-[10px] font-sans uppercase tracking-wider text-[var(--warning-text)] font-semibold">
          [Verify]
        </span>
      )}
    </span>
  );
};

export const FlapDetailPanel: React.FC = () => {
  const flaps = useAtlasStore((s) => s.flaps);
  const selectedFlapId = useAtlasStore((s) => s.selectedFlapId);
  const unitSystem = useAtlasStore((s) => s.unitSystem);
  const compareIds = useAtlasStore((s) => s.compareIds);
  const favoriteIds = useAtlasStore((s) => s.favoriteIds);
  const collections = useAtlasStore((s) => s.collections);
  const notesByFlapId = useAtlasStore((s) => s.notesByFlapId);
  const tagsByFlapId = useAtlasStore((s) => s.tagsByFlapId);
  const highlightsByFlapId = useAtlasStore((s) => s.highlightsByFlapId);
  const editorMode = useAtlasStore((s) => s.editorMode);
  const techniqueStep = useAtlasStore((s) => s.techniqueStep);
  const flapHistory = useAtlasStore((s) => s.flapHistory);
  const flapHistoryIndex = useAtlasStore((s) => s.flapHistoryIndex);
  const donorSide = useAtlasStore((s) => s.donorSide);
  const resolvedFlapVesselsStore = useAtlasStore((s) => s.resolvedFlapVessels);

  const toggleCompare = useAtlasStore((s) => s.toggleCompare);
  const toggleFavorite = useAtlasStore((s) => s.toggleFavorite);
  const saveNote = useAtlasStore((s) => s.saveNote);
  const addTagToFlap = useAtlasStore((s) => s.addTagToFlap);
  const removeTagFromFlap = useAtlasStore((s) => s.removeTagFromFlap);
  const addHighlightToFlap = useAtlasStore((s) => s.addHighlightToFlap);
  const removeHighlightFromFlap = useAtlasStore((s) => s.removeHighlightFromFlap);
  const toggleFlapInCollection = useAtlasStore((s) => s.toggleFlapInCollection);
  const createCollection = useAtlasStore((s) => s.createCollection);
  const setEditorMode = useAtlasStore((s) => s.setEditorMode);
  const setTechniqueStep = useAtlasStore((s) => s.setTechniqueStep);
  const setDissectionPeel = useAtlasStore((s) => s.setDissectionPeel);
  const setAnimationMode = useAtlasStore((s) => s.setAnimationMode);
  const setLayer = useAtlasStore((s) => s.setLayer);
  const setCameraPreset = useAtlasStore((s) => s.setCameraPreset);
  const setDonorSide = useAtlasStore((s) => s.setDonorSide);
  const updateFlap = useAtlasStore((s) => s.updateFlap);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const goBackFlap = useAtlasStore((s) => s.goBackFlap);
  const goForwardFlap = useAtlasStore((s) => s.goForwardFlap);
  const openAssistant = useAtlasStore((s) => s.openAssistant);
  const selectMuscleRef = useAtlasStore((s) => s.selectMuscleRef);
  const setActiveTabStore = useAtlasStore((s) => s.setActiveTab);

  const flap = flaps.find((f) => f.id === selectedFlapId) || flaps[0];
  const [activeTab, setActiveTab] = useState<DetailTabId>('overview');
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [newHighlightInput, setNewHighlightInput] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [fullEditorOpen, setFullEditorOpen] = useState(false);
  const [walkthroughPlaying, setWalkthroughPlaying] = useState(false);

  const techniqueStages = useMemo(
    () => (flap ? buildTechniqueStages(flap, unitSystem) : []),
    [flap, unitSystem]
  );

  const paddleSummary = useMemo(
    () => (flap ? getCalibratedPaddleSummary(flap, unitSystem) : null),
    [flap, unitSystem]
  );

  // Sub-Phase 9d: Resolved BodyParts3D vessel link state for the current flap & donor side
  const linkedVesselInfo = useMemo(() => {
    if (!flap) return null;
    if (
      resolvedFlapVesselsStore &&
      resolvedFlapVesselsStore.flapId === flap.id &&
      resolvedFlapVesselsStore.donorSide === donorSide
    ) {
      return resolvedFlapVesselsStore;
    }
    return resolveFlapRealVessels(flap, donorSide, []);
  }, [flap, donorSide, resolvedFlapVesselsStore]);

  // Phase 10c: Honest BodyParts3D coverage assessment for absent muscles & peripheral nerves
  const bp3dCoverage = useMemo(
    () => (flap ? assessFlapBp3dCoverage(flap) : null),
    [flap]
  );

  // Phase 12-2: Associated muscle reference entries for this flap (e.g. Latissimus dorsi on LD / TDAP)
  const associatedMuscleRefs = useMemo(
    () => (flap ? findMuscleReferencesForFlap(flap.id, flaps) : []),
    [flap, flaps]
  );

  // Inline Editor state
  const [draftStatus, setDraftStatus] = useState<VerificationStatus>('Needs review');
  const [draftArtery, setDraftArtery] = useState('');
  const [draftPedMin, setDraftPedMin] = useState('');
  const [draftPedMax, setDraftPedMax] = useState('');
  const [draftArtMin, setDraftArtMin] = useState('');
  const [draftArtMax, setDraftArtMax] = useState('');
  const [draftRefBook, setDraftRefBook] = useState('');
  const [draftRefEdition, setDraftRefEdition] = useState('');
  const [draftRefSection, setDraftRefSection] = useState('');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!flap) return;
    setNoteText(notesByFlapId[flap.id] || '');
    setDraftStatus(flap.verification_status);
    setDraftArtery(flap.vascular_anatomy.dominant_pedicle.artery);
    setDraftPedMin(flap.vascular_anatomy.dominant_pedicle.pedicle_length_cm?.min?.toString() || '');
    setDraftPedMax(flap.vascular_anatomy.dominant_pedicle.pedicle_length_cm?.max?.toString() || '');
    setDraftArtMin(flap.vascular_anatomy.dominant_pedicle.artery_diameter_mm?.min?.toString() || '');
    setDraftArtMax(flap.vascular_anatomy.dominant_pedicle.artery_diameter_mm?.max?.toString() || '');
    setSaveFeedback(null);
    setWalkthroughPlaying(false);
  }, [flap, notesByFlapId]);

  const activateStage = (stepNum: number) => {
    setTechniqueStep(stepNum);
    if (stepNum === 0) {
      setDissectionPeel(28);
      setAnimationMode('none');
      return;
    }
    const stage = techniqueStages.find((s) => s.stepNumber === stepNum);
    if (!stage) return;
    setDissectionPeel(stage.recommendedPeel);
    setAnimationMode(stage.recommendedAnimation);
    if (stage.highlightTarget === 'perforators') {
      setLayer('perforators', { visible: true, opacity: 1 });
      setLayer('perforasomes', { visible: true, opacity: 0.55 });
    }
  };

  useEffect(() => {
    if (!walkthroughPlaying || activeTab !== 'technique') return;
    const timer = window.setInterval(() => {
      const current = useAtlasStore.getState().techniqueStep;
      const next = current >= 7 ? 1 : current + 1;
      activateStage(next);
    }, 3400);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkthroughPlaying, activeTab, techniqueStages]);

  if (!flap) return null;

  const isFav = favoriteIds.includes(flap.id);
  const isCompared = compareIds.includes(flap.id);
  const canGoBack = flapHistoryIndex > 0;
  const canGoForward = flapHistoryIndex < flapHistory.length - 1;

  const flashCopy = (msg: string) => {
    setCopiedMsg(msg);
    setTimeout(() => setCopiedMsg(null), 2000);
  };

  const handleCopyCitation = () => {
    const primary = flap.references[0];
    const cite = `${flap.name}. Pedicle: ${flap.vascular_anatomy.dominant_pedicle.artery}. Primary reference: ${primary.book} (${primary.edition}), ${primary.chapter_or_section}.`;
    navigator.clipboard?.writeText(cite).catch(() => {});
    flashCopy('Citation copied');
  };

  const handleCopyDeepLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?flap=${encodeURIComponent(flap.id)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    flashCopy('Deep link copied');
  };

  const handleExportSummary = () => {
    const ped = flap.vascular_anatomy.dominant_pedicle;
    const lines = [
      `# ${flap.name}`,
      `Region: ${flap.region_group} (${flap.region}) | Ladder: ${flap.reconstructive_ladder_level} | Status: ${flap.verification_status}`,
      '',
      `## Vascular Pedicle`,
      `- Dominant Artery: ${ped.artery} (Origin: ${ped.artery_origin})`,
      `- Artery Caliber: ${formatRange(ped.artery_diameter_mm, unitSystem).text}`,
      `- Veins: ${ped.veins} (${formatRange(ped.vein_diameter_mm, unitSystem).text})`,
      `- Pedicle Length: ${formatRange(ped.pedicle_length_cm, unitSystem).text}`,
      `- Angiosome: ${flap.vascular_anatomy.angiosome}`,
      '',
      `## Dimensions`,
      `- Skin Paddle: ${paddleSummary?.dimensionsText || 'Not specified'} (${paddleSummary?.areaText || ''})`,
      `- Primary Closure Max Width: ${formatRange(flap.dimensions.primary_closure_max_width_cm, unitSystem).text}`,
      '',
      `## Key Landmarks`,
      ...flap.technique.landmarks.map((l) => `- ${l}`),
      '',
      `## Harvest Sequence`,
      ...flap.technique.harvest_steps.map((s, idx) => `${idx + 1}. ${s}`),
      '',
      `## References`,
      ...flap.references.map((r) => `- ${r.book} (${r.edition}) — ${r.chapter_or_section}${r.verify ? ' [Verify]' : ''}`),
      '',
      'Disclaimer: For education and reference only. Confirm anatomy with preoperative imaging.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlapAtlas3D_${flap.id}_summary.md`;
    a.click();
    URL.revokeObjectURL(url);
    flashCopy('Summary exported');
  };

  const handleSaveEditor = async () => {
    try {
      const pedMin = draftPedMin.trim() === '' ? null : Number(draftPedMin);
      const pedMax = draftPedMax.trim() === '' ? null : Number(draftPedMax);
      const artMin = draftArtMin.trim() === '' ? null : Number(draftArtMin);
      const artMax = draftArtMax.trim() === '' ? null : Number(draftArtMax);

      const nextRefs = [...flap.references];
      if (draftRefBook.trim() && draftRefSection.trim()) {
        nextRefs.push({
          book: draftRefBook.trim(),
          edition: draftRefEdition.trim() || 'Current ed.',
          chapter_or_section: draftRefSection.trim(),
          verify: false,
        });
      }

      const updated: FlapRecord = {
        ...flap,
        verification_status: draftStatus,
        last_reviewed: new Date().toISOString().slice(0, 10),
        vascular_anatomy: {
          ...flap.vascular_anatomy,
          dominant_pedicle: {
            ...flap.vascular_anatomy.dominant_pedicle,
            artery: draftArtery.trim() || flap.vascular_anatomy.dominant_pedicle.artery,
            pedicle_length_cm:
              pedMin !== null || pedMax !== null
                ? {
                    min: Number.isFinite(pedMin) ? pedMin : null,
                    max: Number.isFinite(pedMax) ? pedMax : null,
                    unit: 'cm',
                    confidence: draftStatus === 'Verified' ? 'high' : 'moderate',
                  }
                : null,
            artery_diameter_mm:
              artMin !== null || artMax !== null
                ? {
                    min: Number.isFinite(artMin) ? artMin : null,
                    max: Number.isFinite(artMax) ? artMax : null,
                    unit: 'mm',
                    confidence: draftStatus === 'Verified' ? 'high' : 'moderate',
                  }
                : null,
          },
        },
        references: nextRefs,
      };

      await updateFlap(updated);
      setDraftRefBook('');
      setDraftRefEdition('');
      setDraftRefSection('');
      setSaveFeedback('Saved locally to IndexedDB');
      setTimeout(() => setSaveFeedback(null), 2600);
    } catch (err) {
      setSaveFeedback(err instanceof Error ? err.message : 'Validation failed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]" data-testid="flap-detail-panel">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-[var(--border-subtle)] space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 flex-wrap">
              <div className="inline-flex items-center gap-0.5 mr-1">
                <button
                  type="button"
                  onClick={goBackFlap}
                  disabled={!canGoBack}
                  title="Previous viewed flap"
                  aria-label="Previous viewed flap"
                  data-testid="flap-history-back"
                  className="p-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] disabled:opacity-35 hover:border-[var(--accent-primary)]"
                >
                  <ArrowLeft className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={goForwardFlap}
                  disabled={!canGoForward}
                  title="Next viewed flap"
                  aria-label="Next viewed flap"
                  data-testid="flap-history-forward"
                  className="p-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] disabled:opacity-35 hover:border-[var(--accent-primary)]"
                >
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <span>{flap.region_group}</span>
              <span>·</span>
              <span>{flap.reconstructive_ladder_level}</span>
              <span>·</span>
              <span
                data-testid="detail-verification-status"
                className={
                  flap.verification_status === 'Verified'
                    ? 'text-[var(--success-text)] font-semibold'
                    : flap.verification_status === 'Partially verified'
                      ? 'text-[var(--accent-primary)] font-semibold'
                      : 'text-[var(--warning-text)] font-semibold'
                }
              >
                {flap.verification_status}
              </span>
            </div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] leading-snug mt-0.5">
              {flap.name}
            </h2>
            {flap.synonyms.length > 0 && (
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {flap.synonyms.join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleFavorite(flap.id)}
            className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border ${
              isFav
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Star className={`w-3 h-3 ${isFav ? 'fill-current' : ''}`} />
            <span>{isFav ? 'Saved' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={() => toggleCompare(flap.id)}
            className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border ${
              isCompared
                ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <GitCompare className="w-3 h-3" />
            <span>{isCompared ? 'In Compare' : 'Compare'}</span>
          </button>

          <button
            type="button"
            onClick={() => setEditorMode(!editorMode)}
            data-testid="toggle-editor-mode-btn"
            className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border ${
              editorMode
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>{editorMode ? 'Close Editor' : 'Edit & Verify'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              openAssistant(`Summarize the key vascular anatomy, landmarks, and primary surgical pitfalls of the ${flap.name}.`)
            }
            className="h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--accent-primary)]"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Ask AI</span>
          </button>

          <button
            type="button"
            onClick={handleCopyCitation}
            title="Copy structured citation"
            className="h-7 px-2 rounded-md text-xs bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
          >
            <Copy className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={handleCopyDeepLink}
            title="Copy shareable link to this flap"
            className="h-7 px-2 rounded-md text-xs bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
          >
            <Link2 className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={handleExportSummary}
            title="Download Markdown clinical reference sheet"
            aria-label="Export flap summary sheet"
            className="h-7 px-2 rounded-md text-xs bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
          >
            <Download className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            title="Print flap reference summary"
            className="h-7 px-2 rounded-md text-xs bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
          >
            <Printer className="w-3 h-3" />
          </button>

          {copiedMsg && (
            <span className="text-[11px] font-medium text-[var(--success-text)] flex items-center gap-1 ml-1">
              <Check className="w-3 h-3" /> {copiedMsg}
            </span>
          )}
        </div>
      </div>

      {/* Inline Editor Drawer (when Editor Mode is toggled ON) */}
      {editorMode && (
        <div
          className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] space-y-2.5 text-xs"
          data-testid="inline-flap-editor"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-primary)]">
              Clinical Editor & Verification Review
            </span>
            {flap.last_reviewed && (
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                Reviewed {flap.last_reviewed}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Verification Status</span>
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value as VerificationStatus)}
                data-testid="editor-status-select"
                className="w-full h-8 px-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="Needs review">Needs review</option>
                <option value="Partially verified">Partially verified</option>
                <option value="Verified">Verified</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Dominant Artery</span>
              <input
                type="text"
                value={draftArtery}
                onChange={(e) => setDraftArtery(e.target.value)}
                className="w-full h-8 px-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Pedicle Min (cm)</span>
              <input
                type="number"
                step="0.5"
                value={draftPedMin}
                onChange={(e) => setDraftPedMin(e.target.value)}
                className="w-full h-8 px-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Pedicle Max (cm)</span>
              <input
                type="number"
                step="0.5"
                value={draftPedMax}
                onChange={(e) => setDraftPedMax(e.target.value)}
                className="w-full h-8 px-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Artery Min (mm)</span>
              <input
                type="number"
                step="0.1"
                value={draftArtMin}
                onChange={(e) => setDraftArtMin(e.target.value)}
                className="w-full h-8 px-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Artery Max (mm)</span>
              <input
                type="number"
                step="0.1"
                value={draftArtMax}
                onChange={(e) => setDraftArtMax(e.target.value)}
                className="w-full h-8 px-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <input
              type="text"
              placeholder="Add reference book / journal..."
              value={draftRefBook}
              onChange={(e) => setDraftRefBook(e.target.value)}
              className="h-8 px-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
            <input
              type="text"
              placeholder="Edition / Year..."
              value={draftRefEdition}
              onChange={(e) => setDraftRefEdition(e.target.value)}
              className="h-8 px-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
            <input
              type="text"
              placeholder="Chapter / Pages..."
              value={draftRefSection}
              onChange={(e) => setDraftRefSection(e.target.value)}
              className="h-8 px-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveEditor}
                data-testid="editor-save-btn"
                className="h-8 px-3 rounded-md bg-[var(--accent-primary)] text-white font-medium flex items-center gap-1.5 hover:opacity-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Quick Save</span>
              </button>
              <button
                type="button"
                onClick={() => setFullEditorOpen(true)}
                data-testid="open-full-editor-btn"
                className="h-8 px-3 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium hover:border-[var(--accent-primary)]"
              >
                Full Field Editor…
              </button>
            </div>
            {saveFeedback && (
              <span className="text-[11px] font-medium text-[var(--success-text)]">
                {saveFeedback}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Horizontal Tab Strip */}
      <div className="px-3 border-b border-[var(--border-subtle)] overflow-x-auto flex items-center gap-1 shrink-0">
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            data-testid={`detail-tab-${tab.id}`}
            className={`px-2.5 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable Clinical Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-relaxed">
        {activeTab === 'operative' && (
          <Suspense
            fallback={
              <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
                Loading operative guide…
              </div>
            }
          >
            <OperativeGuideTab flapId={flap.id} flapName={flap.name} />
          </Suspense>
        )}

        {activeTab === 'overview' && (
          <>
            {/* Key Surgical Specs Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[11px] text-[var(--text-muted)]">Dominant Artery</div>
                <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                  {flap.vascular_anatomy.dominant_pedicle.artery}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Origin: {flap.vascular_anatomy.dominant_pedicle.artery_origin}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[11px] text-[var(--text-muted)]">Pedicle Length & Caliber</div>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  <div>
                    <span className="text-[var(--text-muted)]">Length: </span>
                    <RangeValue range={flap.vascular_anatomy.dominant_pedicle.pedicle_length_cm} unitSystem={unitSystem} />
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Artery Ø: </span>
                    <RangeValue range={flap.vascular_anatomy.dominant_pedicle.artery_diameter_mm} unitSystem={unitSystem} />
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Phase 9d: 3D Reference Vessel Link & Donor Side Switch */}
            {linkedVesselInfo && linkedVesselInfo.status !== 'unmapped' && (
              <div
                className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2.5"
                data-testid="detail-real-vessel-section"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      3D Pedicle Vessels
                    </div>
                    {(linkedVesselInfo.status === 'not_in_dataset' ||
                      linkedVesselInfo.resolvedVessels.length === 0) && (
                      <SchematicIconBadge compact />
                    )}
                  </div>
                  <div
                    className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5 text-xs font-semibold shrink-0"
                    role="group"
                    aria-label="Donor side"
                    data-testid="detail-donor-side-switch"
                  >
                    <button
                      type="button"
                      onClick={() => setDonorSide('right')}
                      data-testid="detail-donor-side-right"
                      aria-pressed={donorSide === 'right'}
                      className={`min-h-[36px] px-2.5 rounded-md transition-colors ${
                        donorSide === 'right'
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Right
                    </button>
                    <button
                      type="button"
                      onClick={() => setDonorSide('left')}
                      data-testid="detail-donor-side-left"
                      aria-pressed={donorSide === 'left'}
                      className={`min-h-[36px] px-2.5 rounded-md transition-colors ${
                        donorSide === 'left'
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Left
                    </button>
                  </div>
                </div>

                {linkedVesselInfo.resolvedVessels.length > 0 && (
                  <>
                    <ul className="space-y-1.5" data-testid="detail-resolved-vessel-list">
                      {linkedVesselInfo.resolvedVessels.map((v) => (
                        <li
                          key={`${v.role}-${v.fjCode}`}
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                v.role === 'pedicle'
                                  ? 'bg-red-500'
                                  : v.role === 'vein'
                                    ? 'bg-blue-600'
                                    : 'bg-red-800'
                              }`}
                            />
                            <span className="font-semibold uppercase text-[10px] tracking-wider text-[var(--text-muted)] shrink-0">
                              {v.pedicleTier === 'primary'
                                ? 'Primary'
                                : v.pedicleTier === 'secondary'
                                  ? 'Parent'
                                  : v.role}
                            </span>
                            <span className="text-[var(--text-primary)] truncate" title={v.displayName}>
                              {v.displayName}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-[var(--text-muted)] shrink-0">
                            {v.side === 'midline' ? 'Mid' : v.side === 'left' ? 'L' : 'R'}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                      <span>Perforators &amp; skin paddle overlay</span>
                      <SchematicIconBadge compact />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Schematic representation indicator when muscle/nerve uses illustrative outline */}
            {bp3dCoverage && bp3dCoverage.hasSchematicDependency && (() => {
              const missingMuscleRef = bp3dCoverage.missingMuscle
                ? findMuscleReferenceForSelection({ label: bp3dCoverage.missingMuscle.name })
                : null;
              return missingMuscleRef ? (
                <button
                  type="button"
                  onClick={() => {
                    selectMuscleRef(missingMuscleRef.id, { openSheet: true, frameIn3D: true });
                    setActiveTabStore('anatomy', 'half');
                  }}
                  data-testid="detail-bp3d-schematic-coverage-card"
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center justify-between gap-2 text-left transition-colors"
                >
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {missingMuscleRef.name} — Muscle reference
                  </span>
                  <SchematicIconBadge compact />
                </button>
              ) : (
                <div
                  className="px-3 py-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-between gap-2"
                  data-testid="detail-bp3d-schematic-coverage-card"
                >
                  <span className="text-xs text-[var(--text-secondary)] truncate">
                    {bp3dCoverage.missingMuscle
                      ? `${bp3dCoverage.missingMuscle.name} outline`
                      : 'Peripheral nerve landmarks'}
                  </span>
                  <SchematicIconBadge compact />
                </div>
              );
            })()}

            {/* Associated Muscle Reference Chips (Phase 12-2) */}
            {associatedMuscleRefs.length > 0 && (
              <div
                className="space-y-1.5"
                data-testid="flap-associated-muscle-chips"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Associated Muscle Reference
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {associatedMuscleRefs.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        selectMuscleRef(m.id, { openSheet: true, frameIn3D: true });
                        setActiveTabStore('anatomy', 'half');
                      }}
                      data-testid={`flap-muscle-chip-${m.id}`}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors"
                    >
                      <span>{m.name}</span>
                      {!m.inBodyParts3D && <SchematicIconBadge compact />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Classifications & Tissue */}
            <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Classification & Tissue Composition
              </h3>
              <dl className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                <dt className="text-[var(--text-secondary)]">Flap Type</dt>
                <dd className="text-[var(--text-primary)] font-medium">{flap.flap_type.join(', ')}</dd>

                <dt className="text-[var(--text-secondary)]">Tissue Components</dt>
                <dd className="text-[var(--text-primary)]">{flap.tissue_components.join(', ')}</dd>

                <dt className="text-[var(--text-secondary)]">Mathes–Nahai</dt>
                <dd className="text-[var(--text-primary)]">{flap.classification.mathes_nahai || 'N/A (non-muscle)'}</dd>

                <dt className="text-[var(--text-secondary)]">Cormack–Lamberty</dt>
                <dd className="text-[var(--text-primary)]">{flap.classification.cormack_lamberty || 'N/A'}</dd>

                <dt className="text-[var(--text-secondary)]">Sensate Capable</dt>
                <dd className="text-[var(--text-primary)]">
                  {flap.nerves.can_be_sensate ? `Yes (${flap.nerves.sensory.join(', ')})` : 'Not routinely sensate'}
                </dd>

                <dt className="text-[var(--text-secondary)]">Transfer Mode</dt>
                <dd className="text-[var(--text-primary)]">
                  {[
                    flap.advisor_tags.free_capable ? 'Free' : null,
                    flap.advisor_tags.pedicled_capable ? 'Pedicled' : null,
                    flap.advisor_tags.chimeric_capable ? 'Chimeric-capable' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </dd>

                <dt className="text-[var(--text-secondary)]">Difficulty / Est. OR</dt>
                <dd className="text-[var(--text-primary)] font-mono">
                  {flap.advisor_tags.technical_difficulty} · {flap.advisor_tags.typical_or_time}
                </dd>
              </dl>
            </div>

            {/* Advantages & Disadvantages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-3">
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--success-text)] mb-1">
                  Key Advantages
                </h4>
                <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                  {flap.advantages.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--warning-text)] mb-1">
                  Limitations
                </h4>
                <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                  {flap.disadvantages.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Study Tools: Collections, Custom Tags, Clinical Highlights & Personal Notes */}
            <div className="border-t border-[var(--border-subtle)] pt-3 space-y-3" data-testid="study-tools-section">
              {/* Collections Membership */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Study Collections</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {collections.map((col) => {
                    const member = col.flapIds.includes(flap.id);
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => toggleFlapInCollection(col.id, flap.id)}
                        data-testid={`collection-toggle-${col.id}`}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                          member
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                            : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {member ? '✓ ' : '+ '}
                        {col.name}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCollectionName.trim()) {
                        e.preventDefault();
                        const newId = createCollection(newCollectionName);
                        if (newId) toggleFlapInCollection(newId, flap.id);
                        setNewCollectionName('');
                      }
                    }}
                    placeholder="New collection name..."
                    data-testid="new-collection-input"
                    className="flex-1 h-7 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCollectionName.trim()) return;
                      const newId = createCollection(newCollectionName);
                      if (newId) toggleFlapInCollection(newId, flap.id);
                      setNewCollectionName('');
                    }}
                    data-testid="create-collection-btn"
                    className="h-7 px-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
                  >
                    Create
                  </button>
                </div>
              </div>

              {/* Custom Tags */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Personal Tags</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(tagsByFlapId[flap.id] || []).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--accent-primary)]"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTagFromFlap(flap.id, tag)}
                        aria-label={`Remove tag ${tag}`}
                        className="text-[var(--text-muted)] hover:text-[var(--danger-text)]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTagInput.trim()) {
                          e.preventDefault();
                          addTagToFlap(flap.id, newTagInput);
                          setNewTagInput('');
                        }
                      }}
                      placeholder="Add tag (e.g. call, thin)..."
                      data-testid="flap-tag-input"
                      className="h-7 w-36 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newTagInput.trim()) return;
                        addTagToFlap(flap.id, newTagInput);
                        setNewTagInput('');
                      }}
                      data-testid="flap-add-tag-btn"
                      className="h-7 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--accent-primary)]"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Pinned Clinical Highlights */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                  <Highlighter className="w-3.5 h-3.5" />
                  <span>Pinned Clinical Highlights ({(highlightsByFlapId[flap.id] || []).length})</span>
                </div>
                {(highlightsByFlapId[flap.id] || []).length > 0 && (
                  <ul className="space-y-1">
                    {(highlightsByFlapId[flap.id] || []).map((hl, i) => (
                      <li
                        key={i}
                        className="px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-[var(--text-primary)] flex items-start justify-between gap-2"
                      >
                        <span>{hl}</span>
                        <button
                          type="button"
                          onClick={() => removeHighlightFromFlap(flap.id, i)}
                          aria-label="Remove highlight"
                          className="text-[var(--text-muted)] hover:text-[var(--danger-text)] shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newHighlightInput}
                    onChange={(e) => setNewHighlightInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newHighlightInput.trim()) {
                        e.preventDefault();
                        addHighlightToFlap(flap.id, newHighlightInput);
                        setNewHighlightInput('');
                      }
                    }}
                    placeholder="Pin a key pearl or institutional tip..."
                    className="flex-1 h-7 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newHighlightInput.trim()) return;
                      addHighlightToFlap(flap.id, newHighlightInput);
                      setNewHighlightInput('');
                    }}
                    className="h-7 px-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--accent-primary)]"
                  >
                    Pin
                  </button>
                </div>
              </div>

              {/* Personal Study Notes */}
              <div className="space-y-1.5">
                <label
                  htmlFor="flap-personal-notes"
                  className="text-[11px] font-semibold text-[var(--text-muted)] block"
                >
                  Personal Clinical Notes (Stored Locally, No PHI)
                </label>
                <textarea
                  id="flap-personal-notes"
                  rows={2}
                  value={noteText}
                  onChange={(e) => {
                    setNoteText(e.target.value);
                    saveNote(flap.id, e.target.value);
                  }}
                  placeholder="Add operative pearls, fellowship notes, or institutional preferences..."
                  className="w-full p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'vascular' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Dominant Vascular Pedicle
              </div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {flap.vascular_anatomy.dominant_pedicle.artery}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[var(--text-muted)] block">Origin</span>
                  <span className="text-[var(--text-primary)]">{flap.vascular_anatomy.dominant_pedicle.artery_origin}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Venous Drainage</span>
                  <span className="text-[var(--text-primary)]">{flap.vascular_anatomy.dominant_pedicle.veins}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Artery Caliber</span>
                  <RangeValue range={flap.vascular_anatomy.dominant_pedicle.artery_diameter_mm} unitSystem={unitSystem} />
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Vein Caliber</span>
                  <RangeValue range={flap.vascular_anatomy.dominant_pedicle.vein_diameter_mm} unitSystem={unitSystem} />
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Pedicle Length</span>
                  <RangeValue range={flap.vascular_anatomy.dominant_pedicle.pedicle_length_cm} unitSystem={unitSystem} />
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Angiosome</span>
                  <span className="text-[var(--text-primary)]">
                    <MedicalTermText text={flap.vascular_anatomy.angiosome} />
                  </span>
                </div>
              </div>
            </div>

            {linkedVesselInfo && linkedVesselInfo.status !== 'unmapped' && (
              <div
                className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2"
                data-testid="vascular-tab-real-vessels"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      3D Pedicle Vessels ({donorSide === 'right' ? 'Right' : 'Left'})
                    </div>
                    {(linkedVesselInfo.status === 'not_in_dataset' ||
                      linkedVesselInfo.resolvedVessels.length === 0) && (
                      <SchematicIconBadge compact />
                    )}
                  </div>
                  <div className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5 text-xs font-semibold shrink-0">
                    <button
                      type="button"
                      onClick={() => setDonorSide('right')}
                      className={`min-h-[36px] px-2.5 rounded-md ${
                        donorSide === 'right'
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Right
                    </button>
                    <button
                      type="button"
                      onClick={() => setDonorSide('left')}
                      className={`min-h-[36px] px-2.5 rounded-md ${
                        donorSide === 'left'
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Left
                    </button>
                  </div>
                </div>

                {linkedVesselInfo.resolvedVessels.length > 0 && (
                  <ul className="space-y-1.5">
                    {linkedVesselInfo.resolvedVessels.map((v) => (
                      <li
                        key={`vasc-${v.role}-${v.fjCode}`}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              v.role === 'pedicle'
                                ? 'bg-red-500'
                                : v.role === 'vein'
                                  ? 'bg-blue-600'
                                  : 'bg-red-800'
                            }`}
                          />
                          <span className="font-semibold uppercase text-[10px] text-[var(--text-muted)] shrink-0">
                            {v.pedicleTier === 'primary'
                              ? 'Primary'
                              : v.pedicleTier === 'secondary'
                                ? 'Parent'
                                : v.role}
                          </span>
                          <span className="text-[var(--text-primary)] truncate">{v.displayName}</span>
                        </div>
                        <span className="font-mono text-xs text-[var(--text-muted)] shrink-0">
                          {v.side === 'midline' ? 'Midline' : v.side === 'left' ? 'Left' : 'Right'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Perforator Anatomy ({flap.vascular_anatomy.perforators.length})
              </h4>
              {flap.vascular_anatomy.perforators.length === 0 ? (
                <p className="text-[var(--text-secondary)]">No discrete cutaneous perforator hotspots cataloged (axial/muscle/random supply).</p>
              ) : (
                <div className="space-y-2">
                  {flap.vascular_anatomy.perforators.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--text-primary)]">{p.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--accent-primary)] font-medium">{p.type}</span>
                          {p.position3d && (
                            <button
                              type="button"
                              onClick={() => {
                                setCameraPreset(flap.spec3d.regionId);
                                setLayer('perforators', { visible: true, opacity: 1 });
                                setLayer('perforasomes', { visible: true, opacity: 0.55 });
                                setTechniqueStep(3);
                              }}
                              className="text-[10px] font-medium text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5"
                            >
                              <Crosshair className="w-3 h-3" /> 3D
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[var(--text-secondary)]">{p.location}</p>
                      <p className="text-[var(--text-muted)]">Landmarks: {p.relation_to_landmarks}</p>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[var(--text-muted)]">Count: {p.typical_count}</span>
                        <span>
                          Caliber: <RangeValue range={p.caliber_mm} unitSystem={unitSystem} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Venous Notes & Anatomical Variants
              </h4>
              <p className="text-[var(--text-secondary)]">
                <MedicalTermText text={flap.vascular_anatomy.venous_drainage_notes} />
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
                {flap.vascular_anatomy.vascular_variants.map((v, i) => (
                  <li key={i}>
                    <MedicalTermText text={v} />
                  </li>
                ))}
              </ul>
              {flap.vascular_anatomy.minor_pedicles.length > 0 && (
                <p className="text-[var(--text-muted)] pt-1">
                  Minor pedicles: {flap.vascular_anatomy.minor_pedicles.join('; ')}
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'nerves' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Sensory Innervation
                </div>
                {flap.nerves.sensory.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1 text-[var(--text-primary)]">
                    {flap.nerves.sensory.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[var(--text-muted)]">No dedicated named sensory nerve for neurotization.</p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Motor Innervation
                </div>
                {flap.nerves.motor.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1 text-[var(--text-primary)]">
                    {flap.nerves.motor.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[var(--text-muted)]">None (cutaneous/fascial flap).</p>
                )}
              </div>
            </div>
            {bp3dCoverage?.nerveBadge && (
              <div
                data-testid="nerves-tab-schematic-badge"
                className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/35 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>{bp3dCoverage.nerveBadge}</strong> — BodyParts3D 4.0 nerves cover ~34
                  orbital/cranial branches; peripheral flap innervation is displayed schematically.
                </span>
              </div>
            )}
            <div className="p-3 rounded-lg border border-[var(--border-subtle)] space-y-1">
              <div className="font-semibold text-[var(--text-primary)]">
                Sensate Capability: {flap.nerves.can_be_sensate ? 'Yes' : 'No'}
              </div>
              <p className="text-[var(--text-secondary)]">
                Donor-site sensory note: {flap.nerves.donor_numbness_note}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'dimensions' && (
          <div className="space-y-3">
            {/* Calibrated Area & Proportion Schematic */}
            {paddleSummary && (
              <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Calibrated Skin Paddle Estimate
                  </div>
                  <div className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                    {paddleSummary.dimensionsText}
                  </div>
                  <div className="text-xs font-mono text-[var(--accent-primary)] font-semibold">
                    Elliptical Area: {paddleSummary.areaText}
                  </div>
                </div>
                <svg
                  viewBox="0 0 110 60"
                  className="w-24 h-14 shrink-0 bg-[var(--bg-surface)] rounded border border-[var(--border-subtle)]"
                  aria-label="Skin paddle design schematic"
                >
                  <ellipse
                    cx="55"
                    cy="30"
                    rx="42"
                    ry="20"
                    fill="#0d9488"
                    fillOpacity="0.18"
                    stroke="#0d9488"
                    strokeWidth="1.4"
                    strokeDasharray="3 2"
                  />
                  <line x1="13" y1="30" x2="97" y2="30" stroke="#64748b" strokeOpacity="0.45" strokeWidth="0.8" />
                  <line x1="55" y1="10" x2="55" y2="50" stroke="#64748b" strokeOpacity="0.45" strokeWidth="0.8" />
                  <circle cx="55" cy="30" r="3" fill="#e11d48" />
                </svg>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[11px] text-[var(--text-muted)]">Max Skin Paddle Length</div>
                <div className="mt-1">
                  <RangeValue range={flap.dimensions.max_skin_paddle_cm.length} unitSystem={unitSystem} />
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[11px] text-[var(--text-muted)]">Max Skin Paddle Width</div>
                <div className="mt-1">
                  <RangeValue range={flap.dimensions.max_skin_paddle_cm.width} unitSystem={unitSystem} />
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[11px] text-[var(--text-muted)]">Primary Closure Max Width</div>
                <div className="mt-1">
                  <RangeValue range={flap.dimensions.primary_closure_max_width_cm} unitSystem={unitSystem} />
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[11px] text-[var(--text-muted)]">Pedicled Arc Reach</div>
                <div className="mt-1">
                  <RangeValue range={flap.arc_of_rotation.reach_cm} unitSystem={unitSystem} />
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
              <div>
                <span className="font-semibold text-[var(--text-primary)]">Thickness & Contour: </span>
                <span className="text-[var(--text-secondary)]">{flap.dimensions.thickness_notes}</span>
              </div>
              <div>
                <span className="font-semibold text-[var(--text-primary)]">Pivot Point: </span>
                <span className="text-[var(--text-secondary)]">{flap.arc_of_rotation.pivot_point}</span>
              </div>
              <div>
                <span className="font-semibold text-[var(--text-primary)]">Reach Description: </span>
                <span className="text-[var(--text-secondary)]">{flap.arc_of_rotation.reach_description}</span>
              </div>
              <div>
                <span className="font-semibold text-[var(--text-primary)]">Design Principles: </span>
                <span className="text-[var(--text-secondary)]">{flap.technique.design}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'technique' && (
          <div className="space-y-3">
            {/* 7-Stage Interactive 3D Surgical Technique Walkthrough */}
            <div
              className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2.5"
              data-testid="technique-stage-viewer"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                    Interactive 3D Surgical Technique Viewer
                  </div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    {techniqueStep > 0
                      ? `Stage ${techniqueStep} of 7 · ${techniqueStages[techniqueStep - 1]?.title}`
                      : 'Select a stage or press Play to sync 3D layers & pedicle'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setWalkthroughPlaying(false);
                      const prev = techniqueStep <= 1 ? 7 : techniqueStep - 1;
                      activateStage(prev);
                    }}
                    className="h-7 w-7 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                    title="Previous operative stage"
                    aria-label="Previous operative stage"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!walkthroughPlaying && techniqueStep === 0) {
                        activateStage(1);
                      }
                      setWalkthroughPlaying((p) => !p);
                    }}
                    data-testid="technique-play-btn"
                    className={`h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 border transition-colors ${
                      walkthroughPlaying
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                    }`}
                  >
                    {walkthroughPlaying ? (
                      <>
                        <Pause className="w-3 h-3" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" /> Play
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWalkthroughPlaying(false);
                      const next = techniqueStep >= 7 ? 1 : techniqueStep + 1;
                      activateStage(next);
                    }}
                    data-testid="technique-next-btn"
                    className="h-7 w-7 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                    title="Next operative stage"
                    aria-label="Next operative stage"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  {techniqueStep > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setWalkthroughPlaying(false);
                        activateStage(0);
                      }}
                      className="h-7 w-7 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      title="Reset to overview"
                      aria-label="Reset technique stage"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* 7-Stage Stepper */}
              <div className="flex flex-wrap gap-1.5">
                {techniqueStages.map((s) => (
                  <button
                    key={s.stepNumber}
                    type="button"
                    onClick={() => {
                      setWalkthroughPlaying(false);
                      activateStage(s.stepNumber);
                    }}
                    data-testid={`technique-stage-${s.stepNumber}`}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap ${
                      techniqueStep === s.stepNumber
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                    title={s.title}
                  >
                    {s.shortLabel}
                  </button>
                ))}
              </div>

              {/* Active Stage Description + Key Anatomical Warning */}
              {techniqueStep > 0 && techniqueStages[techniqueStep - 1] && (
                <div
                  className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2"
                  data-testid="technique-stage-detail"
                >
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                    {techniqueStages[techniqueStep - 1].description}
                  </p>
                  <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-[var(--text-primary)]">
                      <span className="font-semibold text-[var(--warning-text)]">
                        Anatomical Warning:{' '}
                      </span>
                      {techniqueStages[techniqueStep - 1].anatomicalWarning}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Patient Positioning
              </h4>
              <p className="text-[var(--text-primary)] mt-0.5">{flap.technique.patient_positioning}</p>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Preoperative Planning & Imaging
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)] mt-0.5">
                {flap.technique.preoperative_planning.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Surface Landmarks
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)] mt-0.5">
                {flap.technique.landmarks.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Step-by-Step Harvest Sequence
              </h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-[var(--text-primary)] mt-1">
                {flap.technique.harvest_steps.map((step, i) => (
                  <li key={i}>{step.replace(/^\d+\.\s*/, '')}</li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'pearls' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--success-text)]">
                Operative Pearls
              </h4>
              <ul className="list-disc pl-4 space-y-1.5 text-[var(--text-primary)]">
                {flap.technique.pearls.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--danger-text)] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Pitfalls & Hazards</span>
              </h4>
              <ul className="list-disc pl-4 space-y-1.5 text-[var(--text-primary)]">
                {flap.technique.pitfalls.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'indications' && (
          <div className="space-y-3">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Primary Indications
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-[var(--text-primary)]">
                {flap.indications.map((ind, i) => (
                  <li key={i}>{ind}</li>
                ))}
              </ul>
            </div>
            <div className="border-t border-[var(--border-subtle)] pt-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--danger-text)] mb-1">
                Contraindications & Cautions
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
                {flap.contraindications.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="border-t border-[var(--border-subtle)] pt-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Common Recipient Vessels
              </h4>
              <p className="text-[var(--text-primary)]">{flap.recipient_vessels_options.join(' · ')}</p>
            </div>
          </div>
        )}

        {activeTab === 'donor' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Donor-Site Closure
              </div>
              <p className="text-[var(--text-primary)]">{flap.donor_site.closure}</p>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Donor Morbidity
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
                {flap.donor_site.morbidity.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Functional Impact
              </h4>
              <p className="text-[var(--text-primary)]">{flap.donor_site.functional_loss}</p>
            </div>
          </div>
        )}

        {activeTab === 'complications' && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Known Complications
            </h4>
            <ul className="list-disc pl-4 space-y-1.5 text-[var(--text-primary)]">
              {flap.complications.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'alternatives' && (
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Alternative & Backup Reconstructive Options
            </h4>
            <div className="space-y-1.5">
              {flap.alternatives.map((alt, i) => {
                const matched = flaps.find(
                  (f) =>
                    f.name.toLowerCase().includes(alt.toLowerCase().split(' ')[0]) ||
                    f.synonyms.some((s) => s.toLowerCase() === alt.toLowerCase())
                );
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
                  >
                    <span className="text-[var(--text-primary)]">{alt}</span>
                    {matched && matched.id !== flap.id && (
                      <button
                        type="button"
                        onClick={() => selectFlap(matched.id, true)}
                        className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
                      >
                        View in 3D →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'references' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Primary Textbooks & Literature ({flap.references.length})
              </h4>
              <button
                type="button"
                onClick={() => setEditorMode(true)}
                className="text-[11px] text-[var(--accent-primary)] flex items-center gap-0.5 hover:underline"
              >
                <Plus className="w-3 h-3" /> Add Reference
              </button>
            </div>
            <div className="space-y-2">
              {flap.references.map((ref, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-0.5"
                >
                  <div className="font-semibold text-[var(--text-primary)]">
                    {ref.book} <span className="font-normal text-[var(--text-secondary)]">({ref.edition})</span>
                  </div>
                  <div className="text-[var(--text-secondary)]">{ref.chapter_or_section}</div>
                  {ref.note && <div className="text-[var(--text-muted)]">{ref.note}</div>}
                  {ref.verify && (
                    <div className="text-[11px] text-[var(--warning-text)] font-medium pt-0.5">
                      Verify exact chapter/page number in local institutional edition
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {fullEditorOpen && (
        <FlapEditorModal
          mode="edit"
          initialFlap={flap}
          onClose={() => setFullEditorOpen(false)}
        />
      )}
    </div>
  );
};
