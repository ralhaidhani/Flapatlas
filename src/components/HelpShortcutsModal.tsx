import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Keyboard,
  Layers,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import { AppTab, useAtlasStore } from '../store/useAtlasStore';

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: '⌘ / Ctrl + K', description: 'Open Global Fuzzy Search (flaps, vessels, landmarks, indications)' },
  { keys: '?', description: 'Toggle Keyboard Shortcuts & Guided Clinical Tour' },
  { keys: 'H', description: 'Collapse / expand 3D Viewport HUD toolbar' },
  { keys: '1 – 9', description: 'Jump directly to Workspace modules (Atlas → Settings)' },
  { keys: 'Esc', description: 'Close active search palette, AI drawer, or modal' },
  { keys: 'Double-Click 3D', description: 'Focus camera smoothly onto selected flap or vessel' },
  { keys: 'Right-Click 3D', description: 'Open quick flap context menu (Compare, Save, Copy Citation)' },
];

const TOUR_STEPS: Array<{
  title: string;
  subtitle: string;
  body: string;
  actionTab: AppTab;
  actionLabel: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    title: '1. Interactive 3D Anatomical Atlas & Dissection Peel',
    subtitle: '62 Reconstructive Flaps · 15 Toggleable Layers',
    body: 'Browse flaps by region, vascular pedicle, Mathes–Nahai, or study collection. Drag the Peel slider to strip Skin → Fat → Fascia → Muscle → Bone, inspect perforator hotspots relative to bony landmarks, or load external CC-licensed .GLB/.GLTF anatomy meshes.',
    actionTab: 'library',
    actionLabel: 'Open 3D Atlas',
    icon: Layers,
  },
  {
    title: '2. Transparent Rule-Based Flap Advisor',
    subtitle: 'Click-on-Body Defect Placement · 10 Clinical Presets',
    body: 'Select a defect zone on the 3D model, enter dimensions and exposed structures, and review ranked reconstructive options with transparent scoring breakdowns, size/reach checks, and virtual 3D placement previews.',
    actionTab: 'advisor',
    actionLabel: 'Open Flap Advisor',
    icon: Stethoscope,
  },
  {
    title: '3. Simulators, Board Quiz & 1-Page PDF Case Planner',
    subtitle: 'Z-Plasty · Angiosomes · 3D Spotter · Zero-PHI PDF',
    body: 'Model serial Z-plasty, Limberg/Dufourmentel rhomboid, Zitelli bilobed, and Keystone flaps; test recall with 22 board vignettes, 12 blind 3D Spotter specimens, and SM-2 flashcards; or export patient-agnostic 1-page surgical planning PDFs.',
    actionTab: 'simulators',
    actionLabel: 'Open Simulators',
    icon: Compass,
  },
  {
    title: '4. Grounded AI & Clinical Governance (§1 Integrity)',
    subtitle: 'Strict Dataset Grounding · Editor Mode · Offline PWA',
    body: 'Ask FlapAtlas answers strictly from local records with visible verification badges and converts clinical scenarios directly into Flap Advisor inputs. Use Editor Mode to review "verify"-flagged ranges, promote flaps to Verified, and export validated JSON/CSV.',
    actionTab: 'settings',
    actionLabel: 'Open Data Quality Dashboard',
    icon: ShieldCheck,
  },
];

export const HelpShortcutsModal: React.FC = () => {
  const open = useAtlasStore((s) => s.helpModalOpen);
  const setHelpModalOpen = useAtlasStore((s) => s.setHelpModalOpen);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);

  const [tab, setTab] = useState<'tour' | 'shortcuts'>('tour');
  const [stepIdx, setStepIdx] = useState(0);

  if (!open) return null;

  const step = TOUR_STEPS[stepIdx];
  const StepIcon = step.icon;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="FlapAtlas 3D Guided Tour and Keyboard Shortcuts"
      data-testid="help-shortcuts-modal"
      onClick={() => setHelpModalOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              FlapAtlas 3D Guide &amp; Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setHelpModalOpen(false)}
            aria-label="Close help and shortcuts"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div
          className="px-5 pt-3 flex items-center gap-2 border-b border-[var(--border-subtle)] text-xs"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tour'}
            onClick={() => setTab('tour')}
            data-testid="help-tab-tour"
            className={`pb-2.5 px-2 font-medium border-b-2 inline-flex items-center gap-1.5 transition-colors ${
              tab === 'tour'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Quick Clinical Tour (4 steps)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'shortcuts'}
            onClick={() => setTab('shortcuts')}
            data-testid="help-tab-shortcuts"
            className={`pb-2.5 px-2 font-medium border-b-2 inline-flex items-center gap-1.5 transition-colors ${
              tab === 'shortcuts'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Keyboard Shortcuts</span>
          </button>
        </div>

        {/* Body */}
        {tab === 'tour' ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span className="font-mono">
                Step {stepIdx + 1} of {TOUR_STEPS.length}
              </span>
              <div className="flex items-center gap-1">
                {TOUR_STEPS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStepIdx(i)}
                    aria-label={`Go to tour step ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === stepIdx ? 'w-6 bg-[var(--accent-primary)]' : 'w-2 bg-[var(--border-subtle)]'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                <StepIcon className="w-4 h-4 shrink-0" />
                <span className="text-[11px] font-medium">{step.subtitle}</span>
              </div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{step.title}</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{step.body}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab(step.actionTab);
                  setHelpModalOpen(false);
                }}
                className="text-[var(--accent-primary)] font-medium hover:underline"
              >
                {step.actionLabel} →
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={stepIdx === 0}
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                {stepIdx < TOUR_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStepIdx((i) => Math.min(TOUR_STEPS.length - 1, i + 1))}
                    data-testid="tour-next-btn"
                    className="h-8 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white font-medium inline-flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setHelpModalOpen(false)}
                    data-testid="tour-finish-btn"
                    className="h-8 px-3.5 rounded-lg bg-[var(--accent-primary)] text-white font-medium"
                  >
                    Finish Tour
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-2 text-xs">
            {SHORTCUTS.map((sc) => (
              <div
                key={sc.keys}
                className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border-subtle)] last:border-b-0"
              >
                <span className="text-[var(--text-secondary)]">{sc.description}</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[11px] font-medium text-[var(--text-primary)] shrink-0">
                  {sc.keys}
                </kbd>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
