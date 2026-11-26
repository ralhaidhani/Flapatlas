import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  Copy,
  FileDown,
  ImagePlus,
  Plus,
  Printer,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { DEFECT_LOCATIONS } from '../data/index';
import { exportCasePlanPdf } from '../engine/casePdfExport';
import { detectPotentialPhi } from '../engine/learningEngine';
import { SavedSurgicalCase, useAtlasStore } from '../store/useAtlasStore';
import { formatRange } from '../types/schemas';

const DEFAULT_CHECKLIST = [
  'Confirm defect geometry after complete oncologic/trauma debridement',
  'Verify vascular anatomy with preoperative imaging (CTA / MRA / handheld Doppler)',
  'Mark surface bony landmarks and perforator hotspots preoperatively in standing/supine position',
  'Confirm healthy recipient vessels outside zone of injury / radiation (prepare vein graft backup)',
  'Prepare backup reconstructive flap option and confirm patient positioning',
  'Verify microsurgical instrument tray, coupler sizes, heparinized saline, and postoperative flap monitoring protocol',
];

function createFreshCase(primaryFlapId: string): SavedSurgicalCase {
  const defaultDefect =
    DEFECT_LOCATIONS.find((d) => d.id === 'leg-distal-ankle') || DEFECT_LOCATIONS[0];
  return {
    id: `case-${Date.now().toString(36)}`,
    title: 'Distal Third Tibia — Free ALT Planning Sheet',
    updatedAtIso: new Date().toISOString().slice(0, 10),
    defectLocId: defaultDefect.id,
    defectDimensions: '12 × 7 cm (84 cm²)',
    primaryFlapId,
    backupFlapId: 'ld-flap',
    recipientVessel: defaultDefect.defaultRecipientVessels[0] || 'Posterior tibial vessels (end-to-side)',
    positioningOverride: '',
    operativeNotes: '',
    checklistItems: DEFAULT_CHECKLIST.map((text, i) => ({ text, checked: i < 2 })),
    photoDataUrl: null,
  };
}

export const CasePlannerView: React.FC = () => {
  const flaps = useAtlasStore((s) => s.flaps);
  const selectedFlapId = useAtlasStore((s) => s.selectedFlapId);
  const unitSystem = useAtlasStore((s) => s.unitSystem);
  const savedCases = useAtlasStore((s) => s.savedCases);
  const saveSurgicalCase = useAtlasStore((s) => s.saveSurgicalCase);
  const deleteSurgicalCase = useAtlasStore((s) => s.deleteSurgicalCase);

  const [draft, setDraft] = useState<SavedSurgicalCase>(() =>
    savedCases[0] ? { ...savedCases[0] } : createFreshCase(selectedFlapId || flaps[0]?.id || 'alt-flap')
  );
  const [newChecklistText, setNewChecklistText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const primaryFlap = flaps.find((f) => f.id === draft.primaryFlapId) || flaps[0];
  const backupFlap = flaps.find((f) => f.id === draft.backupFlapId);
  const defectLoc = DEFECT_LOCATIONS.find((d) => d.id === draft.defectLocId);

  const phiWarnings = useMemo(() => {
    const combined = `${draft.title}\n${draft.operativeNotes}\n${draft.recipientVessel}`;
    return detectPotentialPhi(combined);
  }, [draft.title, draft.operativeNotes, draft.recipientVessel]);

  const flashMsg = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3200);
  };

  const handleSaveCase = () => {
    const stamped: SavedSurgicalCase = {
      ...draft,
      title: draft.title.trim() || `${primaryFlap?.name || 'Flap'} Plan`,
      updatedAtIso: new Date().toISOString().slice(0, 10),
    };
    setDraft(stamped);
    saveSurgicalCase(stamped);
    flashMsg('Case plan saved locally to IndexedDB (Zero-PHI).');
  };

  const handleDuplicateCase = () => {
    const copy: SavedSurgicalCase = {
      ...draft,
      id: `case-${Date.now().toString(36)}`,
      title: `${draft.title} (Copy)`,
      updatedAtIso: new Date().toISOString().slice(0, 10),
    };
    setDraft(copy);
    saveSurgicalCase(copy);
    flashMsg('Duplicated into a new case plan.');
  };

  const handleNewCase = () => {
    setDraft(createFreshCase(selectedFlapId || flaps[0]?.id || 'alt-flap'));
    flashMsg('Started new blank planning sheet.');
  };

  const handleDownloadPdf = () => {
    if (!primaryFlap) return;
    const filename = exportCasePlanPdf({
      title: draft.title,
      defectLocation: defectLoc,
      defectDimensions: draft.defectDimensions,
      primaryFlap,
      backupFlap,
      recipientVessel: draft.recipientVessel,
      positioningOverride: draft.positioningOverride,
      operativeNotes: draft.operativeNotes,
      checklistItems: draft.checklistItems,
      unitSystem,
      photoDataUrl: draft.photoDataUrl,
    });
    flashMsg(`Downloaded 1-page PDF: ${filename}`);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraft((prev) => ({ ...prev, photoDataUrl: reader.result as string }));
        flashMsg('Attached de-identified reference schematic.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddChecklistItem = () => {
    const clean = newChecklistText.trim();
    if (!clean) return;
    setDraft((prev) => ({
      ...prev,
      checklistItems: [...prev.checklistItems, { text: clean, checked: false }],
    }));
    setNewChecklistText('');
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-5 bg-[var(--bg-app)]" data-testid="case-planner-view">
      {/* Non-print header */}
      <div className="no-print flex flex-col lg:flex-row lg:items-end justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="text-xs font-medium text-[var(--accent-primary)] flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Patient-Agnostic Preoperative Reference Worksheet</span>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
            Surgical Case Planner & 1-Page PDF Export
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleNewCase}
            className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 hover:border-[var(--accent-primary)]"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
          <button
            type="button"
            onClick={handleSaveCase}
            data-testid="case-save-btn"
            className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 hover:border-[var(--accent-primary)]"
          >
            <Save className="w-3.5 h-3.5" /> Save Case
          </button>
          <button
            type="button"
            onClick={handleDuplicateCase}
            className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-medium flex items-center gap-1.5 hover:text-[var(--text-primary)]"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            data-testid="case-download-pdf-btn"
            className="h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium flex items-center gap-1.5 hover:opacity-95"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Download 1-Page PDF</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 hover:border-[var(--accent-primary)]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Prominent Privacy / Zero-PHI Notice */}
      <div className="no-print p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[var(--text-primary)]">
            Zero Patient-Identifiable Information (Zero PHI):{' '}
          </span>
          <span className="text-[var(--text-secondary)]">
            This planning sheet is strictly educational and patient-agnostic. Never enter patient names, medical record numbers, dates of birth, contact details, or identifiable photos. All saved plans stay strictly on your local device.
          </span>
        </div>
      </div>

      {/* Live PHI Pattern Warning (triggered if MRN / DOB / Email / SSN detected) */}
      {phiWarnings.length > 0 && (
        <div
          role="alert"
          data-testid="phi-warning-banner"
          className="no-print p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 flex items-start gap-2.5 text-xs"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-[var(--danger-text)]">
              Potential Patient Identifier Detected — Remove Before Saving or Exporting
            </div>
            <div className="text-[var(--text-secondary)]">
              {phiWarnings.map((w) => `${w.category} (${w.matchHint})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          data-testid="case-planner-feedback"
          className="no-print px-3.5 py-2 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-medium"
        >
          {feedback}
        </div>
      )}

      {/* Saved Cases Shelf */}
      {savedCases.length > 0 && (
        <div className="no-print bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2" data-testid="saved-cases-shelf">
          <div className="text-[11px] font-semibold text-[var(--text-muted)]">
            Saved Local Case Plans ({savedCases.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {savedCases.map((c) => {
              const active = c.id === draft.id;
              return (
                <div
                  key={c.id}
                  className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                    active
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setDraft({ ...c })}
                    className="font-medium text-left hover:underline"
                  >
                    {c.title}
                  </button>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">{c.updatedAtIso}</span>
                  <button
                    type="button"
                    onClick={() => deleteSurgicalCase(c.id)}
                    aria-label={`Delete case ${c.title}`}
                    className="text-[var(--text-muted)] hover:text-[var(--danger-text)]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Configuration Form (no-print) */}
      <div className="no-print grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 text-xs">
        <label className="space-y-1 md:col-span-2 lg:col-span-2">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Case Plan Title (Patient-Agnostic)
          </span>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            data-testid="case-title-input"
            placeholder="e.g., Distal Tibia Open Fracture — Free ALT Plan"
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Estimated Defect Dimensions
          </span>
          <input
            type="text"
            value={draft.defectDimensions}
            onChange={(e) => setDraft((p) => ({ ...p, defectDimensions: e.target.value }))}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Anatomical Defect Zone
          </span>
          <select
            value={draft.defectLocId}
            onChange={(e) => {
              const nextLoc = DEFECT_LOCATIONS.find((d) => d.id === e.target.value);
              setDraft((p) => ({
                ...p,
                defectLocId: e.target.value,
                recipientVessel: nextLoc?.defaultRecipientVessels[0] || p.recipientVessel,
              }));
            }}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            {DEFECT_LOCATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.group} — {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Primary Reconstructive Flap
          </span>
          <select
            value={draft.primaryFlapId}
            onChange={(e) => setDraft((p) => ({ ...p, primaryFlapId: e.target.value }))}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            {flaps.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Backup / Bailout Flap
          </span>
          <select
            value={draft.backupFlapId}
            onChange={(e) => setDraft((p) => ({ ...p, backupFlapId: e.target.value }))}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            <option value="">None selected</option>
            {flaps.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Planned Recipient Vessels & Anastomosis Strategy
          </span>
          <input
            type="text"
            value={draft.recipientVessel}
            onChange={(e) => setDraft((p) => ({ ...p, recipientVessel: e.target.value }))}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Positioning Override (Optional)
          </span>
          <input
            type="text"
            value={draft.positioningOverride}
            onChange={(e) => setDraft((p) => ({ ...p, positioningOverride: e.target.value }))}
            placeholder={primaryFlap?.technique.patient_positioning || 'Supine'}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </label>

        <label className="space-y-1 md:col-span-2 lg:col-span-2">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Operative Plan & Microsurgical Notes (No PHI)
          </span>
          <textarea
            rows={2}
            value={draft.operativeNotes}
            onChange={(e) => setDraft((p) => ({ ...p, operativeNotes: e.target.value }))}
            data-testid="case-notes-input"
            placeholder="Two-team harvest setup, tourniquet plan, venous coupler size, postoperative Doppler protocol..."
            className="w-full p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </label>

        <div className="space-y-1.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            De-Identified Schematic / Diagram (Optional)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="h-9 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium flex items-center gap-1.5 hover:border-[var(--accent-primary)]"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>{draft.photoDataUrl ? 'Replace Image' : 'Attach Diagram'}</span>
            </button>
            {draft.photoDataUrl && (
              <button
                type="button"
                onClick={() => setDraft((p) => ({ ...p, photoDataUrl: null }))}
                aria-label="Remove attached diagram"
                className="h-9 px-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--danger-text)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Printable 1-Page Sheet Preview */}
      {primaryFlap && (
        <div className="print-sheet bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6 space-y-4 text-xs">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-3">
            <div>
              <div className="text-[11px] font-mono text-[var(--accent-primary)]">
                FlapAtlas 3D · Patient-Agnostic Reconstructive Plan
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] mt-0.5">
                {draft.title || primaryFlap.name}
              </h2>
              <div className="text-[var(--text-secondary)]">
                Primary: {primaryFlap.name} · Defect: {defectLoc?.label} ({draft.defectDimensions}) · Backup: {backupFlap?.name || 'None'}
              </div>
            </div>
            <div className="text-right text-[11px] text-[var(--text-muted)] shrink-0">
              <div>Status: {primaryFlap.verification_status}</div>
              <div>Recipient: {draft.recipientVessel}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-[11px] text-[var(--text-muted)]">
                Vascular & Dimensional Summary
              </h3>
              <dl className="grid grid-cols-2 gap-y-1 gap-x-2">
                <dt className="text-[var(--text-secondary)]">Dominant Artery</dt>
                <dd className="font-medium text-[var(--text-primary)]">{primaryFlap.vascular_anatomy.dominant_pedicle.artery}</dd>
                <dt className="text-[var(--text-secondary)]">Pedicle Length</dt>
                <dd className="font-mono tabular-nums text-[var(--text-primary)]">
                  {formatRange(primaryFlap.vascular_anatomy.dominant_pedicle.pedicle_length_cm, unitSystem).text}
                </dd>
                <dt className="text-[var(--text-secondary)]">Artery / Vein Ø</dt>
                <dd className="font-mono tabular-nums text-[var(--text-primary)]">
                  {formatRange(primaryFlap.vascular_anatomy.dominant_pedicle.artery_diameter_mm, unitSystem).text} /{' '}
                  {formatRange(primaryFlap.vascular_anatomy.dominant_pedicle.vein_diameter_mm, unitSystem).text}
                </dd>
                <dt className="text-[var(--text-secondary)]">Positioning</dt>
                <dd className="text-[var(--text-primary)]">
                  {draft.positioningOverride || primaryFlap.technique.patient_positioning}
                </dd>
                <dt className="text-[var(--text-secondary)]">Donor Closure</dt>
                <dd className="text-[var(--text-primary)]">{primaryFlap.donor_site.closure}</dd>
              </dl>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-[11px] text-[var(--text-muted)]">
                Key Landmarks & Critical Pitfalls
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-[var(--text-primary)]">
                {primaryFlap.technique.landmarks.slice(0, 3).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
                {primaryFlap.technique.pitfalls.slice(0, 2).map((p, i) => (
                  <li key={`pit-${i}`} className="text-[var(--danger-text)]">
                    Pitfall: {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {(draft.operativeNotes.trim() || draft.photoDataUrl) && (
            <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  Operative Plan Notes
                </div>
                <p className="text-[var(--text-primary)] whitespace-pre-wrap">
                  {draft.operativeNotes.trim() || 'Reference schematic attached.'}
                </p>
              </div>
              {draft.photoDataUrl && (
                <img
                  src={draft.photoDataUrl}
                  alt="De-identified surgical planning schematic"
                  className="w-36 h-24 object-contain rounded border border-[var(--border-subtle)] bg-white shrink-0"
                />
              )}
            </div>
          )}

          <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-[11px] text-[var(--text-muted)]">
                Preoperative Readiness Checklist ({draft.checklistItems.filter((c) => c.checked).length}/{draft.checklistItems.length})
              </h3>
              <div className="no-print flex items-center gap-1.5">
                <input
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  placeholder="Add custom checklist item..."
                  className="h-7 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] w-52"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="h-7 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--accent-primary)] font-medium hover:border-[var(--accent-primary)]"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {draft.checklistItems.map((item, i) => (
                <label key={i} className="flex items-start gap-2 cursor-pointer text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() =>
                      setDraft((prev) => ({
                        ...prev,
                        checklistItems: prev.checklistItems.map((c, idx) =>
                          idx === i ? { ...c, checked: !c.checked } : c
                        ),
                      }))
                    }
                    className="mt-0.5 accent-[var(--accent-primary)]"
                  />
                  <span className={item.checked ? 'line-through text-[var(--text-muted)]' : ''}>
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-2">
            Primary Reference: {primaryFlap.references[0]?.book} ({primaryFlap.references[0]?.edition}),{' '}
            {primaryFlap.references[0]?.chapter_or_section}. For education and reference only. Always verify against primary references and confirm with preoperative imaging (CTA / Doppler / MRA) before surgery.
          </div>
        </div>
      )}
    </div>
  );
};
