import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  GitCompare,
  Layers,
  ListChecks,
  MessageSquare,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { DEFECT_LOCATIONS, DEFECT_PRESETS } from '../data/index';
import {
  AdvisorInput,
  cameraPresetForDefect,
  findNearestDefectLocation,
  runFlapAdvisor,
} from '../engine/advisorEngine';
import { useAtlasStore } from '../store/useAtlasStore';
import { Viewer3D } from './Viewer3D';

const MISSING_TISSUE_OPTIONS = [
  'Skin',
  'Subcutaneous fat',
  'Fascia',
  'Muscle',
  'Bone',
  'Tendon',
  'Nerve',
  'Mucosa / lining',
  'Composite (through-and-through)',
];

const WOUND_CHAR_OPTIONS = [
  'Exposed bone',
  'Exposed tendon',
  'Exposed hardware',
  'Exposed vessels / dura / implant',
  'Radiated field',
  'Infection / osteomyelitis',
  'Dead space',
  'Contaminated / chronic wound',
  'Active malignancy',
];

const GOAL_OPTIONS = [
  'Thin / pliable coverage',
  'Bulk / volume',
  'Sensation',
  'Motor function',
  'Color / texture match',
  'Durability',
  'Weight-bearing surface',
  'Contour',
];

const PATIENT_FACTOR_OPTIONS = [
  'High BMI',
  'Smoker',
  'Diabetes',
  'Peripheral vascular disease',
  'Prior abdominal surgery',
  'Prior surgery at donor site',
  'Anticoagulation',
  'Age > 70 / frail',
  'Scar concealment priority',
];

const WIZARD_STEPS = [
  { step: 1, label: 'Location & Size' },
  { step: 2, label: 'Tissues & Wound' },
  { step: 3, label: 'Goals & Vessels' },
  { step: 4, label: 'Patient & Prefs' },
];

export const FlapAdvisorView: React.FC = () => {
  const flaps = useAtlasStore((s) => s.flaps);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const setCompareIds = useAtlasStore((s) => s.setCompareIds);
  const setAdvisorPreviewDefectId = useAtlasStore((s) => s.setAdvisorPreviewDefectId);
  const setAdvisorDefectSizeCm = useAtlasStore((s) => s.setAdvisorDefectSizeCm);
  const setAnimationMode = useAtlasStore((s) => s.setAnimationMode);
  const animationMode = useAtlasStore((s) => s.animationMode);
  const setCameraPreset = useAtlasStore((s) => s.setCameraPreset);
  const openAssistant = useAtlasStore((s) => s.openAssistant);
  const unitSystem = useAtlasStore((s) => s.unitSystem);
  const advisorDraftOverride = useAtlasStore((s) => s.advisorDraftOverride);
  const clearAdvisorDraftOverride = useAtlasStore((s) => s.clearAdvisorDraftOverride);

  const [activePresetId, setActivePresetId] = useState<string>(DEFECT_PRESETS[0].id);
  const [input, setInput] = useState<AdvisorInput>(DEFECT_PRESETS[0].input);
  const [inputMode, setInputMode] = useState<'quick' | 'wizard'>('quick');
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [showAllPresets, setShowAllPresets] = useState<boolean>(false);
  const [previewRankIndex, setPreviewRankIndex] = useState<number>(0);
  const [pickOnBody, setPickOnBody] = useState<boolean>(false);
  const [pickFeedback, setPickFeedback] = useState<string | null>(null);
  const [expandedBreakdownId, setExpandedBreakdownId] = useState<string | null>(null);

  // Adopt structured defect inputs sent from Ask FlapAtlas scenario parser
  useEffect(() => {
    if (!advisorDraftOverride) return;
    setInput(advisorDraftOverride);
    setActivePresetId('custom-ai-scenario');
    setPreviewRankIndex(0);
    setPickFeedback('Loaded structured clinical scenario from Ask FlapAtlas into rule-based Flap Advisor.');
    clearAdvisorDraftOverride();
  }, [advisorDraftOverride, clearAdvisorDraftOverride]);

  const result = useMemo(
    () => runFlapAdvisor(input, flaps, DEFECT_LOCATIONS),
    [input, flaps]
  );

  const activeLocation = useMemo(
    () => DEFECT_LOCATIONS.find((l) => l.id === input.locationId) || DEFECT_LOCATIONS[0],
    [input.locationId]
  );

  const activePreviewRec =
    result.recommendations[previewRankIndex] || result.recommendations[0] || null;

  // Keep live 3D virtual placement preview synchronized with defect + selected ranked flap
  useEffect(() => {
    setAdvisorPreviewDefectId(input.locationId);
    setAdvisorDefectSizeCm([input.lengthCm, input.widthCm]);
  }, [input.locationId, input.lengthCm, input.widthCm, setAdvisorPreviewDefectId, setAdvisorDefectSizeCm]);

  useEffect(() => {
    if (!activePreviewRec) return;
    selectFlap(activePreviewRec.flap.id, false);
    const defaultAnim =
      activePreviewRec.suggestedMode === 'Pedicled / Local' ? 'arc' : 'transfer';
    setAnimationMode(defaultAnim);
  }, [activePreviewRec?.flap.id, activePreviewRec?.suggestedMode, selectFlap, setAnimationMode]);

  useEffect(() => {
    // Frame 3D preview on anterior-full for free transfer clarity or defect region for posterior/local
    if (input.locationId === 'sacrum-ischium') {
      setCameraPreset('posterior-full');
    } else if (activePreviewRec?.suggestedMode === 'Pedicled / Local') {
      setCameraPreset(cameraPresetForDefect(input.locationId));
    } else {
      setCameraPreset('anterior-full');
    }
  }, [input.locationId, activePreviewRec?.suggestedMode, setCameraPreset]);

  const toggleItem = (
    field: 'missingTissues' | 'woundCharacteristics' | 'functionalGoals' | 'patientFactors',
    val: string
  ) => {
    setActivePresetId('');
    setInput((prev) => {
      const list = prev[field];
      return {
        ...prev,
        [field]: list.includes(val) ? list.filter((x) => x !== val) : [...list, val],
      };
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = DEFECT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePresetId(presetId);
    setInput(preset.input);
    setPreviewRankIndex(0);
    setPickFeedback(null);
  };

  const handlePickBodyPoint = useCallback((pt: [number, number, number]) => {
    const nearest = findNearestDefectLocation(pt, DEFECT_LOCATIONS);
    if (!nearest) return;
    setActivePresetId('');
    setInput((prev) => ({ ...prev, locationId: nearest.id }));
    setPreviewRankIndex(0);
    setPickOnBody(false);
    setPickFeedback(`Selected on 3D body: ${nearest.label}`);
  }, []);

  const handleOpenFull3D = (flapId: string, suggestedMode: string) => {
    setAdvisorPreviewDefectId(input.locationId);
    setAdvisorDefectSizeCm([input.lengthCm, input.widthCm]);
    selectFlap(flapId, false);
    setAnimationMode(suggestedMode === 'Pedicled / Local' ? 'arc' : 'transfer');
    setCameraPreset(
      input.locationId === 'sacrum-ischium' ? 'posterior-full' : 'anterior-full'
    );
    setActiveTab('library');
  };

  const handleCompareTop = () => {
    const ids = result.recommendations.slice(0, 4).map((r) => r.flap.id);
    setCompareIds(ids);
    setActiveTab('compare');
  };

  const handleExplainWithAI = () => {
    const topSummary = result.recommendations
      .slice(0, 3)
      .map(
        (r, i) =>
          `#${i + 1} ${r.flap.name} (${r.score}%, ${r.suggestedMode}, size: ${r.sizeStatus})`
      )
      .join('; ');
    openAssistant(
      `Explain the deterministic Flap Advisor ranking for a ${input.lengthCm}x${input.widthCm} cm ${input.depth} defect at ${activeLocation?.label} (missing: ${input.missingTissues.join(', ') || 'soft tissue'}; wound: ${input.woundCharacteristics.join(', ') || 'clean'}). Top ranked options: ${topSummary}. Compare pros, cons, and key operative considerations using only the dataset.`
    );
  };

  const visiblePresets = showAllPresets ? DEFECT_PRESETS : DEFECT_PRESETS.slice(0, 6);
  const needsBone = input.missingTissues.includes('Bone');

  const formatAreaDisplay = () => {
    if (unitSystem === 'imperial') {
      const sqIn = (result.defectAreaEllipseCm2 / 6.4516).toFixed(1);
      return `~${sqIn} in² (${result.defectAreaEllipseCm2} cm²)`;
    }
    return `~${result.defectAreaEllipseCm2} cm² elliptical (${result.defectAreaRectCm2} cm² rect)`;
  };

  const renderLocationAndSizeSection = () => (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="advisor-location"
            className="text-[11px] font-medium text-[var(--text-secondary)]"
          >
            Anatomical Defect Location
          </label>
          <button
            type="button"
            onClick={() => {
              setPickOnBody((p) => !p);
              setCameraPreset('anterior-full');
            }}
            className={`text-[11px] font-medium flex items-center gap-1 transition-colors ${
              pickOnBody
                ? 'text-[var(--accent-primary)] underline'
                : 'text-[var(--text-muted)] hover:text-[var(--accent-primary)]'
            }`}
          >
            <Crosshair className="w-3 h-3" />
            <span>{pickOnBody ? 'Click 3D model →' : 'Pick on 3D'}</span>
          </button>
        </div>
        <select
          id="advisor-location"
          value={input.locationId}
          onChange={(e) => {
            setActivePresetId('');
            setPickFeedback(null);
            setInput((p) => ({ ...p, locationId: e.target.value }));
            setPreviewRankIndex(0);
          }}
          className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
        >
          {DEFECT_LOCATIONS.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.group} — {loc.label}
            </option>
          ))}
        </select>
        {pickFeedback && (
          <div className="text-[11px] text-[var(--accent-primary)] font-medium">
            {pickFeedback}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Length (cm)
          </span>
          <input
            type="number"
            min={1}
            max={45}
            value={input.lengthCm}
            onChange={(e) => {
              setActivePresetId('');
              setInput((p) => ({
                ...p,
                lengthCm: Math.max(1, Number(e.target.value) || 1),
              }));
            }}
            className="w-full h-8 px-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono tabular-nums"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Width (cm)
          </span>
          <input
            type="number"
            min={1}
            max={35}
            value={input.widthCm}
            onChange={(e) => {
              setActivePresetId('');
              setInput((p) => ({
                ...p,
                widthCm: Math.max(1, Number(e.target.value) || 1),
              }));
            }}
            className="w-full h-8 px-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono tabular-nums"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">Depth</span>
          <select
            value={input.depth}
            onChange={(e) => {
              setActivePresetId('');
              setInput((p) => ({ ...p, depth: e.target.value as AdvisorInput['depth'] }));
            }}
            className="w-full h-8 px-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            <option value="Superficial">Superficial</option>
            <option value="Full-thickness">Full-thickness</option>
            <option value="Deep / cavitary">Deep / cavitary</option>
          </select>
        </label>
      </div>

      {/* Auto-calculated Defect Area Bar */}
      <div
        className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[11px]"
        data-testid="advisor-area-readout"
      >
        <span className="text-[var(--text-muted)] flex items-center gap-1">
          <Calculator className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>Auto-Calculated Defect Area</span>
        </span>
        <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
          {formatAreaDisplay()}
        </span>
      </div>
    </div>
  );

  const renderTissuesAndWoundSection = () => (
    <div className="space-y-3.5">
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Missing Tissues
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MISSING_TISSUE_OPTIONS.map((opt) => {
            const selected = input.missingTissues.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleItem('missingTissues', opt)}
                className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                  selected
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {needsBone && (
          <div
            className="mt-2 p-2.5 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-primary)]/40 flex items-center justify-between gap-3"
            data-testid="advisor-bone-length-box"
          >
            <div>
              <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                Osseous Segment Length (cm)
              </div>
              <div className="text-[10px] text-[var(--text-secondary)]">
                Defects &gt;12 cm strongly favor Free Fibula (up to 25 cm bone stock)
              </div>
            </div>
            <input
              type="number"
              min={2}
              max={25}
              value={input.boneLengthCm ?? 8}
              onChange={(e) => {
                setActivePresetId('');
                setInput((p) => ({
                  ...p,
                  boneLengthCm: Math.max(2, Math.min(25, Number(e.target.value) || 8)),
                }));
              }}
              aria-label="Bone segment length in cm"
              className="w-16 h-8 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono tabular-nums text-right"
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Wound Characteristics & Exposed Structures
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WOUND_CHAR_OPTIONS.map((opt) => {
            const selected = input.woundCharacteristics.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleItem('woundCharacteristics', opt)}
                className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                  selected
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderGoalsAndVesselsSection = () => (
    <div className="space-y-3.5">
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Functional & Aesthetic Goals
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_OPTIONS.map((opt) => {
            const selected = input.functionalGoals.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleItem('functionalGoals', opt)}
                className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                  selected
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <label className="space-y-1 block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
            Recipient Vessel Status
          </span>
          <select
            value={input.recipientVesselStatus}
            onChange={(e) => {
              setActivePresetId('');
              setInput((p) => ({
                ...p,
                recipientVesselStatus: e.target.value as AdvisorInput['recipientVesselStatus'],
              }));
            }}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            <option value="Available">Available & healthy</option>
            <option value="Zone of injury">Zone of injury (long pedicle preferred)</option>
            <option value="Previous radiation">Previous radiation</option>
            <option value="Vein graft likely">Vein graft likely</option>
          </select>
        </label>
      </div>
    </div>
  );

  const renderPatientAndPrefsSection = () => (
    <div className="space-y-3.5">
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Patient Factors & Comorbidities
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PATIENT_FACTOR_OPTIONS.map((opt) => {
            const selected = input.patientFactors.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleItem('patientFactors', opt)}
                className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                  selected
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <label className="space-y-1 block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
            Surgical / Reconstructive Ladder Preference
          </span>
          <select
            value={input.mobilizationPreference}
            onChange={(e) => {
              setActivePresetId('');
              setInput((p) => ({
                ...p,
                mobilizationPreference: e.target.value as AdvisorInput['mobilizationPreference'],
              }));
            }}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            <option value="Any">Any (Reconstructive Elevator approach)</option>
            <option value="Local / Regional preferred">Local / Regional pedicled preferred</option>
            <option value="Free flap acceptable">Free microvascular flap acceptable</option>
            <option value="Short OR time">Short OR time / lower complexity</option>
          </select>
        </label>
      </div>
    </div>
  );

  return (
    <div
      className="h-full overflow-y-auto p-4 sm:p-6 space-y-5 bg-[var(--bg-app)]"
      data-testid="flap-advisor-view"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--accent-primary)] flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Deterministic Reconstructive Decision Support</span>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
            Flap Advisor — Defect-Based Selection Engine
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl">
            Transparent rule-based scoring across regional reach, vascularized bone/tissue match, defect dimensions, pedicle reach, and patient risk factors — synced with live 3D virtual placement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Quick Mode vs Guided Wizard Toggle */}
          <div
            className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5 text-xs"
            role="group"
            aria-label="Flap Advisor input mode"
          >
            <button
              type="button"
              onClick={() => setInputMode('quick')}
              data-testid="advisor-mode-quick"
              className={`px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors ${
                inputMode === 'quick'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Quick Mode</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMode('wizard');
                setWizardStep(1);
              }}
              data-testid="advisor-mode-wizard"
              className={`px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors ${
                inputMode === 'wizard'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Guided Wizard</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExplainWithAI}
            className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 hover:border-[var(--accent-primary)]"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Explain Ranking</span>
          </button>

          <button
            type="button"
            onClick={handleCompareTop}
            data-testid="advisor-compare-top-btn"
            className="h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium flex items-center gap-1.5 hover:opacity-95"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Top 4</span>
          </button>
        </div>
      </div>

      {/* Classic Algorithm Presets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Classic Reconstructive Algorithm Presets ({DEFECT_PRESETS.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowAllPresets((v) => !v)}
            data-testid="advisor-toggle-presets-btn"
            className="text-xs font-medium text-[var(--accent-primary)] hover:underline flex items-center gap-1"
          >
            <span>
              {showAllPresets
                ? 'Show compact 6 presets'
                : `Show all ${DEFECT_PRESETS.length} presets`}
            </span>
            {showAllPresets ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {visiblePresets.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                data-testid={`advisor-preset-${preset.id}`}
                className={`text-left p-2.5 rounded-lg border transition-colors ${
                  active
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                }`}
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] leading-snug">
                  {preset.title}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                  {preset.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Split Workspace: Inputs Left, Live 3D Placement + Ranked Results Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Structured Defect Form (Quick Mode or 4-Step Guided Wizard) */}
        <div className="xl:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {inputMode === 'wizard'
                ? `Step ${wizardStep} of 4 · ${WIZARD_STEPS[wizardStep - 1].label}`
                : 'Defect & Patient Parameters'}
            </h3>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              {input.lengthCm}×{input.widthCm} cm
            </span>
          </div>

          {inputMode === 'wizard' ? (
            <div className="space-y-4" data-testid="advisor-wizard-panel">
              {/* Wizard Stepper */}
              <div className="grid grid-cols-4 gap-1.5">
                {WIZARD_STEPS.map((ws) => (
                  <button
                    key={ws.step}
                    type="button"
                    onClick={() => setWizardStep(ws.step)}
                    data-testid={`advisor-wizard-step-${ws.step}`}
                    className={`px-2 py-1.5 rounded-md text-[11px] font-medium border text-center transition-colors ${
                      wizardStep === ws.step
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : wizardStep > ws.step
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {ws.step}. {ws.label.split(' ')[0]}
                  </button>
                ))}
              </div>

              {wizardStep === 1 && renderLocationAndSizeSection()}
              {wizardStep === 2 && renderTissuesAndWoundSection()}
              {wizardStep === 3 && renderGoalsAndVesselsSection()}
              {wizardStep === 4 && renderPatientAndPrefsSection()}

              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  disabled={wizardStep <= 1}
                  onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
                  className="h-8 px-3 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] disabled:opacity-40 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep((s) => Math.min(4, s + 1))}
                    data-testid="advisor-wizard-next"
                    className="h-8 px-3.5 rounded-md bg-[var(--accent-primary)] text-white font-medium flex items-center gap-1 hover:opacity-95"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setInputMode('quick')}
                    className="h-8 px-3.5 rounded-md bg-[var(--accent-primary)] text-white font-medium flex items-center gap-1 hover:opacity-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Review All Inputs</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {renderLocationAndSizeSection()}
              <div className="pt-2 border-t border-[var(--border-subtle)]">
                {renderTissuesAndWoundSection()}
              </div>
              <div className="pt-2 border-t border-[var(--border-subtle)]">
                {renderGoalsAndVesselsSection()}
              </div>
              <div className="pt-2 border-t border-[var(--border-subtle)]">
                {renderPatientAndPrefsSection()}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live 3D Virtual Placement Preview + Ladder + Ranked Recommendations */}
        <div className="xl:col-span-7 space-y-4">
          {/* Embedded Live 3D Virtual Placement Preview */}
          <div
            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden"
            data-testid="advisor-3d-preview"
          >
            <div className="px-3.5 py-2.5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Live 3D Virtual Placement Preview</span>
                </div>
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {activePreviewRec
                    ? `#${previewRankIndex + 1} ${activePreviewRec.flap.name} → ${activeLocation?.label}`
                    : activeLocation?.label}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPickOnBody((p) => !p);
                    if (!pickOnBody) setCameraPreset('anterior-full');
                  }}
                  data-testid="advisor-pick-3d-btn"
                  className={`h-7 px-2 rounded-md text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                    pickOnBody
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                  }`}
                >
                  <Crosshair className="w-3 h-3" />
                  <span>{pickOnBody ? 'Click Body to Set Defect' : 'Pick Defect on 3D'}</span>
                </button>

                {activePreviewRec && (
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenFull3D(
                        activePreviewRec.flap.id,
                        activePreviewRec.suggestedMode
                      )
                    }
                    className="h-7 px-2 rounded-md text-[11px] font-medium bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Full 3D Atlas</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Ranked Flap Switcher + Mode Controls */}
            <div className="px-3.5 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-1">
                {result.recommendations.map((rec, i) => (
                  <button
                    key={rec.flap.id}
                    type="button"
                    onClick={() => setPreviewRankIndex(i)}
                    data-testid={`advisor-preview-select-${i + 1}`}
                    className={`px-2 py-0.5 rounded font-medium border transition-colors ${
                      previewRankIndex === i
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    #{i + 1} {rec.flap.synonyms[0] || rec.flap.name.split(' ')[0]}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-1">
                {[
                  { id: 'transfer' as const, label: 'Free Transfer' },
                  { id: 'arc' as const, label: 'Arc of Rotation' },
                  { id: 'none' as const, label: 'Donor Only' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAnimationMode(m.id)}
                    className={`px-2 py-0.5 rounded border text-[10px] font-medium ${
                      animationMode === m.id
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Compact 3D Viewport */}
            <div className="h-[310px] sm:h-[350px] relative">
              <Viewer3D
                compact
                defectPickMode={pickOnBody}
                onPickDefectPoint={handlePickBodyPoint}
              />
              {pickOnBody && (
                <div className="pointer-events-none absolute top-3 left-3 z-20 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium shadow">
                  Click any region on the 3D body to place the defect target
                </div>
              )}
            </div>

            <div className="px-3.5 py-2 bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
              <span>
                Crimson zone = scaled defect ({input.lengthCm}×{input.widthCm} cm) · Dashed teal = virtual inset preview
              </span>
              <span className="font-mono text-[var(--text-muted)]">
                Recipient: {result.recipientVessels[0]}
              </span>
            </div>
          </div>

          {/* Reconstructive Elevator & Recipient Vessel Context */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-[var(--text-primary)]">
                Reconstructive Elevator & Recipient Vessel Context
              </div>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                {activeLocation?.label} · ~{result.defectAreaEllipseCm2} cm²
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Regional Ladder
                </div>
                <ol className="space-y-1 text-[var(--text-secondary)] list-decimal pl-4">
                  {result.reconstructiveLadder.map((step, i) => (
                    <li key={i}>{step.replace(/^\d+\.\s*/, '')}</li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Primary Recipient Vessels
                </div>
                <ul className="space-y-1 text-[var(--text-primary)] list-disc pl-4">
                  {result.recipientVessels.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            </div>

            {result.generalWarnings.length > 0 && (
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1">
                {result.generalWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[var(--warning-text)]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top 5 Ranked Flaps */}
          <div className="space-y-3" data-testid="advisor-results-list">
            {result.recommendations.map((rec, idx) => {
              const isSelectedPreview = previewRankIndex === idx;
              const isBreakdownOpen = expandedBreakdownId === rec.flap.id;

              return (
                <div
                  key={rec.flap.id}
                  data-testid={`advisor-rank-${idx + 1}`}
                  className={`bg-[var(--bg-surface)] border rounded-xl p-4 space-y-2.5 transition-colors ${
                    isSelectedPreview
                      ? 'border-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <span className="font-mono font-bold text-[var(--accent-primary)]">
                          #{idx + 1}
                        </span>
                        <span>·</span>
                        <span>{rec.suggestedMode}</span>
                        <span>·</span>
                        <span className="truncate">
                          {rec.flap.vascular_anatomy.dominant_pedicle.artery}
                        </span>
                        <span>·</span>
                        <span className="text-[var(--warning-text)] font-medium">
                          {rec.flap.verification_status}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                        {rec.flap.name}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-mono font-bold tabular-nums text-[var(--accent-primary)] leading-none">
                        {rec.score}%
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-0.5">
                        Suitability
                      </div>
                    </div>
                  </div>

                  {/* Size, Reach & Donor Morbidity Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-[var(--bg-subtle)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                        Size Check ·{' '}
                        <span
                          className={
                            rec.sizeStatus === 'green'
                              ? 'text-[var(--success-text)]'
                              : rec.sizeStatus === 'yellow'
                                ? 'text-[var(--warning-text)]'
                                : 'text-[var(--danger-text)]'
                          }
                        >
                          {rec.sizeStatus === 'green'
                            ? 'Fits'
                            : rec.sizeStatus === 'yellow'
                              ? 'Borderline'
                              : 'Undersized'}
                        </span>
                      </span>
                      <p className="text-[var(--text-secondary)] mt-0.5 text-[11px] leading-snug">
                        {rec.sizeNote}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                        Pedicle Reach ·{' '}
                        <span
                          className={
                            rec.reachStatus === 'optimal'
                              ? 'text-[var(--success-text)]'
                              : rec.reachStatus === 'caution'
                                ? 'text-[var(--warning-text)]'
                                : 'text-[var(--danger-text)]'
                          }
                        >
                          {rec.reachStatus === 'optimal'
                            ? 'Optimal'
                            : rec.reachStatus === 'caution'
                              ? 'Caution'
                              : 'Limited'}
                        </span>
                      </span>
                      <p className="text-[var(--text-secondary)] mt-0.5 text-[11px] leading-snug">
                        {rec.reachNote}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                        Donor-Site Morbidity
                      </span>
                      <p className="text-[var(--text-secondary)] mt-0.5 text-[11px] leading-snug">
                        {rec.donorMorbiditySummary}
                      </p>
                    </div>
                  </div>

                  {/* Rationale & Warnings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      {rec.reasons.map((r, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[var(--text-primary)]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success-text)] shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                    {rec.warnings.length > 0 && (
                      <div className="space-y-1">
                        {rec.warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[var(--warning-text)]">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expandable Rule-Based Score Breakdown */}
                  {isBreakdownOpen && (
                    <div
                      className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1 text-[11px]"
                      data-testid={`advisor-breakdown-panel-${idx + 1}`}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                        Transparent Deterministic Rule Ledger
                      </div>
                      {rec.scoreBreakdown.map((item, bi) => (
                        <div
                          key={bi}
                          className="flex items-center justify-between gap-2 py-0.5 border-b border-[var(--border-subtle)] last:border-b-0"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-[var(--text-primary)]">
                              {item.category}:{' '}
                            </span>
                            <span className="text-[var(--text-secondary)]">{item.detail}</span>
                          </div>
                          <span
                            className={`font-mono font-semibold shrink-0 tabular-nums ${
                              item.delta > 0
                                ? 'text-[var(--success-text)]'
                                : 'text-[var(--danger-text)]'
                            }`}
                          >
                            {item.delta > 0 ? `+${item.delta}` : item.delta}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewRankIndex(idx)}
                        className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 border ${
                          isSelectedPreview
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>{isSelectedPreview ? 'In 3D Preview' : 'Preview 3D'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          selectFlap(rec.flap.id, true);
                          setActiveTab('library');
                        }}
                        className="px-2.5 py-1 rounded-md bg-[var(--accent-primary)] text-white font-medium flex items-center gap-1 hover:opacity-95"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Open Reference</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBreakdownId(isBreakdownOpen ? null : rec.flap.id)
                        }
                        data-testid={`advisor-breakdown-toggle-${idx + 1}`}
                        className="px-2 py-1 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                      >
                        <span>Score Rules</span>
                        {isBreakdownOpen ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {rec.backupIds.length > 0 && (
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                        <span>Backup:</span>
                        {rec.backupIds.map((bid) => {
                          const bf = flaps.find((x) => x.id === bid);
                          return bf ? (
                            <button
                              key={bid}
                              type="button"
                              onClick={() => {
                                selectFlap(bid, true);
                                setActiveTab('library');
                              }}
                              className="text-[var(--accent-primary)] hover:underline flex items-center"
                            >
                              {bf.synonyms[0] || bf.name.split(' ')[0]}
                              <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                            </button>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
