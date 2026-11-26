import React, { useState } from 'react';
import { Check, Plus, Save, Trash2, X } from 'lucide-react';
import { REGIONS } from '../data/index';
import { useAtlasStore } from '../store/useAtlasStore';
import {
  Confidence,
  FlapRecord,
  NumericRange,
  Reference,
  VerificationStatus,
} from '../types/schemas';

type EditorSection = 'identity' | 'vascular' | 'dimensions' | 'clinical' | 'references';

interface FlapEditorModalProps {
  mode: 'edit' | 'create';
  initialFlap?: FlapRecord;
  onClose: () => void;
}

function buildBlankFlap(): FlapRecord {
  return {
    id: `custom-flap-${Date.now().toString(36)}`,
    name: '',
    synonyms: [],
    region: 'Lower extremity (thigh)',
    region_group: 'Lower Extremity',
    flap_type: ['Perforator', 'Fasciocutaneous'],
    classification: {
      mathes_nahai: null,
      cormack_lamberty: null,
      perforator_type: 'Septocutaneous / musculocutaneous',
    },
    tissue_components: ['Skin', 'Subcutaneous fat', 'Deep fascia'],
    vascular_anatomy: {
      dominant_pedicle: {
        artery: '',
        artery_origin: '',
        artery_diameter_mm: { min: null, max: null, unit: 'mm', confidence: 'verify' },
        veins: 'Paired venae comitantes',
        vein_diameter_mm: { min: null, max: null, unit: 'mm', confidence: 'verify' },
        pedicle_length_cm: { min: null, max: null, unit: 'cm', confidence: 'verify' },
      },
      minor_pedicles: [],
      perforators: [],
      angiosome: 'Verify angiosome territory in source reference.',
      venous_drainage_notes: 'Deep venae comitantes (verify superficial drainage).',
      vascular_variants: ['Confirm anatomical variants on preoperative CTA / Doppler.'],
    },
    nerves: {
      motor: [],
      sensory: [],
      can_be_sensate: false,
      donor_numbness_note: 'Verify cutaneous sensory distribution.',
    },
    dimensions: {
      max_skin_paddle_cm: {
        length: { min: null, max: null, unit: 'cm', confidence: 'verify' },
        width: { min: null, max: null, unit: 'cm', confidence: 'verify' },
      },
      thickness_notes: 'Depends on patient BMI and donor-site adiposity.',
      primary_closure_max_width_cm: { min: null, max: null, unit: 'cm', confidence: 'verify' },
    },
    arc_of_rotation: {
      pivot_point: 'Vascular pedicle origin',
      reach_description: 'Verify local/regional arc or free-transfer indications.',
      reach_cm: null,
    },
    indications: ['Soft-tissue defect reconstruction'],
    contraindications: ['Compromised source vessel perfusion'],
    advantages: ['Customizable skin paddle'],
    disadvantages: ['Anatomical variation requires preoperative Doppler/CTA'],
    donor_site: {
      closure: 'Primary closure or STSG depending on width',
      morbidity: ['Donor scar'],
      functional_loss: 'Minimal when muscle is preserved.',
    },
    technique: {
      patient_positioning: 'Supine',
      preoperative_planning: ['Handheld Doppler', 'CT angiography'],
      landmarks: ['Confirm regional bony landmarks'],
      design: 'Center skin paddle over dominant audible Doppler perforator.',
      harvest_steps: ['Mark bony landmarks and perforators', 'Incise exploratory margin and identify pedicle'],
      pearls: ['Verify perforator pulsatility prior to dividing secondary branches.'],
      pitfalls: ['Avoid pedicle tension or twisting during inset.'],
    },
    recipient_vessels_options: ['Facial / superior thyroid / internal mammary / tibial vessels'],
    complications: ['Partial tip necrosis', 'Venous congestion'],
    alternatives: ['alt-flap'],
    reconstructive_ladder_level: 'Free flap',
    advisor_tags: {
      defect_locations: ['distal-tibia'],
      provides_bone: false,
      provides_muscle: false,
      provides_thin_pliable: true,
      provides_bulk: false,
      provides_motor: false,
      provides_gliding_or_durable: false,
      pedicled_capable: false,
      free_capable: true,
      chimeric_capable: false,
      technical_difficulty: 'Moderate',
      typical_or_time: '4–6 h',
    },
    spec3d: {
      regionId: 'lower-limb-ant',
      side: 'right',
      paddleCenter: [0.16, 0.72, 0.09],
      paddleNormal: [0.5, 0, 0.86],
      paddleSize: [0.14, 0.07],
      pediclePath: [
        [0.12, 0.85, 0.04],
        [0.15, 0.78, 0.07],
        [0.16, 0.72, 0.09],
      ],
      pivotPoint: [0.12, 0.85, 0.04],
      arcRadius: 0.18,
      typicalRecipientPoint: [0.12, 0.35, 0.05],
      angiosomeColor: '#0d9488',
    },
    references: [
      {
        book: 'Zenn MR, Jones G. Reconstructive Surgery',
        edition: 'Thieme/QMP',
        chapter_or_section: 'Regional Flap Reference',
        verify: true,
      },
    ],
    verification_status: 'Needs review',
    last_reviewed: null,
  };
}

function splitLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRange(
  minStr: string,
  maxStr: string,
  unit: 'mm' | 'cm',
  confidence: Confidence
): NumericRange | null {
  const minVal = minStr.trim() === '' ? null : Number(minStr);
  const maxVal = maxStr.trim() === '' ? null : Number(maxStr);
  if (minVal === null && maxVal === null) return null;
  return {
    min: minVal !== null && Number.isFinite(minVal) ? minVal : null,
    max: maxVal !== null && Number.isFinite(maxVal) ? maxVal : null,
    unit,
    confidence,
  };
}

export const FlapEditorModal: React.FC<FlapEditorModalProps> = ({
  mode,
  initialFlap,
  onClose,
}) => {
  const updateFlap = useAtlasStore((s) => s.updateFlap);
  const createFlap = useAtlasStore((s) => s.createFlap);

  const base = initialFlap || buildBlankFlap();
  const [section, setSection] = useState<EditorSection>('identity');

  // Identity & Taxonomy
  const [name, setName] = useState(base.name);
  const [idSlug, setIdSlug] = useState(base.id);
  const [synonymsText, setSynonymsText] = useState(base.synonyms.join(', '));
  const [region, setRegion] = useState(base.region);
  const [regionGroup, setRegionGroup] = useState<FlapRecord['region_group']>(base.region_group);
  const [regionId3d, setRegionId3d] = useState(base.spec3d.regionId);
  const [ladderLevel, setLadderLevel] = useState<FlapRecord['reconstructive_ladder_level']>(
    base.reconstructive_ladder_level
  );
  const [mathesNahai, setMathesNahai] = useState(base.classification.mathes_nahai || '');
  const [cormackLamberty, setCormackLamberty] = useState(base.classification.cormack_lamberty || '');
  const [perforatorType, setPerforatorType] = useState(base.classification.perforator_type || '');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(
    base.verification_status
  );

  // Vascular
  const ped = base.vascular_anatomy.dominant_pedicle;
  const [artery, setArtery] = useState(ped.artery);
  const [arteryOrigin, setArteryOrigin] = useState(ped.artery_origin);
  const [veins, setVeins] = useState(ped.veins);
  const [angiosome, setAngiosome] = useState(base.vascular_anatomy.angiosome);
  const [artMin, setArtMin] = useState(ped.artery_diameter_mm?.min?.toString() ?? '');
  const [artMax, setArtMax] = useState(ped.artery_diameter_mm?.max?.toString() ?? '');
  const [artConf, setArtConf] = useState<Confidence>(ped.artery_diameter_mm?.confidence ?? 'verify');
  const [veinMin, setVeinMin] = useState(ped.vein_diameter_mm?.min?.toString() ?? '');
  const [veinMax, setVeinMax] = useState(ped.vein_diameter_mm?.max?.toString() ?? '');
  const [veinConf, setVeinConf] = useState<Confidence>(ped.vein_diameter_mm?.confidence ?? 'verify');
  const [pedMin, setPedMin] = useState(ped.pedicle_length_cm?.min?.toString() ?? '');
  const [pedMax, setPedMax] = useState(ped.pedicle_length_cm?.max?.toString() ?? '');
  const [pedConf, setPedConf] = useState<Confidence>(ped.pedicle_length_cm?.confidence ?? 'verify');

  // Dimensions & Arc
  const dim = base.dimensions;
  const [padLenMin, setPadLenMin] = useState(dim.max_skin_paddle_cm.length?.min?.toString() ?? '');
  const [padLenMax, setPadLenMax] = useState(dim.max_skin_paddle_cm.length?.max?.toString() ?? '');
  const [padLenConf, setPadLenConf] = useState<Confidence>(
    dim.max_skin_paddle_cm.length?.confidence ?? 'verify'
  );
  const [padWidMin, setPadWidMin] = useState(dim.max_skin_paddle_cm.width?.min?.toString() ?? '');
  const [padWidMax, setPadWidMax] = useState(dim.max_skin_paddle_cm.width?.max?.toString() ?? '');
  const [padWidConf, setPadWidConf] = useState<Confidence>(
    dim.max_skin_paddle_cm.width?.confidence ?? 'verify'
  );
  const [primMin, setPrimMin] = useState(dim.primary_closure_max_width_cm?.min?.toString() ?? '');
  const [primMax, setPrimMax] = useState(dim.primary_closure_max_width_cm?.max?.toString() ?? '');
  const [primConf, setPrimConf] = useState<Confidence>(
    dim.primary_closure_max_width_cm?.confidence ?? 'verify'
  );
  const [pivotPoint, setPivotPoint] = useState(base.arc_of_rotation.pivot_point);
  const [reachDesc, setReachDesc] = useState(base.arc_of_rotation.reach_description);

  // Clinical Lists
  const [indicationsText, setIndicationsText] = useState(base.indications.join('\n'));
  const [contraindicationsText, setContraindicationsText] = useState(
    base.contraindications.join('\n')
  );
  const [landmarksText, setLandmarksText] = useState(base.technique.landmarks.join('\n'));
  const [harvestStepsText, setHarvestStepsText] = useState(base.technique.harvest_steps.join('\n'));
  const [pearlsText, setPearlsText] = useState(base.technique.pearls.join('\n'));
  const [pitfallsText, setPitfallsText] = useState(base.technique.pitfalls.join('\n'));

  // References
  const [references, setReferences] = useState<Reference[]>(base.references);
  const [newRefBook, setNewRefBook] = useState('');
  const [newRefEdition, setNewRefEdition] = useState('');
  const [newRefChapter, setNewRefChapter] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddRef = () => {
    if (!newRefBook.trim() || !newRefChapter.trim()) return;
    setReferences((prev) => [
      ...prev,
      {
        book: newRefBook.trim(),
        edition: newRefEdition.trim() || 'Current ed.',
        chapter_or_section: newRefChapter.trim(),
        verify: false,
      },
    ]);
    setNewRefBook('');
    setNewRefEdition('');
    setNewRefChapter('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg('Flap name is required.');
      setSection('identity');
      return;
    }
    if (!artery.trim()) {
      setErrorMsg('Dominant artery is required.');
      setSection('vascular');
      return;
    }
    if (references.length === 0) {
      setErrorMsg('At least one primary reference is required.');
      setSection('references');
      return;
    }

    const cleanId =
      mode === 'create'
        ? (idSlug.trim() ||
            name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, ''))
        : base.id;

    const record: FlapRecord = {
      ...base,
      id: cleanId,
      name: name.trim(),
      synonyms: synonymsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      region: region.trim() || base.region,
      region_group: regionGroup,
      reconstructive_ladder_level: ladderLevel,
      classification: {
        mathes_nahai: mathesNahai.trim() || null,
        cormack_lamberty: cormackLamberty.trim() || null,
        perforator_type: perforatorType.trim() || null,
      },
      vascular_anatomy: {
        ...base.vascular_anatomy,
        angiosome: angiosome.trim() || base.vascular_anatomy.angiosome,
        dominant_pedicle: {
          ...base.vascular_anatomy.dominant_pedicle,
          artery: artery.trim(),
          artery_origin: arteryOrigin.trim() || 'Verify origin in source',
          veins: veins.trim() || 'Venae comitantes',
          artery_diameter_mm: parseRange(artMin, artMax, 'mm', artConf),
          vein_diameter_mm: parseRange(veinMin, veinMax, 'mm', veinConf),
          pedicle_length_cm: parseRange(pedMin, pedMax, 'cm', pedConf),
        },
      },
      dimensions: {
        ...base.dimensions,
        max_skin_paddle_cm: {
          length: parseRange(padLenMin, padLenMax, 'cm', padLenConf),
          width: parseRange(padWidMin, padWidMax, 'cm', padWidConf),
        },
        primary_closure_max_width_cm: parseRange(primMin, primMax, 'cm', primConf),
      },
      arc_of_rotation: {
        ...base.arc_of_rotation,
        pivot_point: pivotPoint.trim() || base.arc_of_rotation.pivot_point,
        reach_description: reachDesc.trim() || base.arc_of_rotation.reach_description,
      },
      indications: splitLines(indicationsText),
      contraindications: splitLines(contraindicationsText),
      technique: {
        ...base.technique,
        landmarks: splitLines(landmarksText),
        harvest_steps: splitLines(harvestStepsText),
        pearls: splitLines(pearlsText),
        pitfalls: splitLines(pitfallsText),
      },
      spec3d: {
        ...base.spec3d,
        regionId: regionId3d,
      },
      references,
      verification_status: verificationStatus,
      last_reviewed: new Date().toISOString().slice(0, 10),
    };

    try {
      setSaving(true);
      if (mode === 'create') {
        await createFlap(record);
      } else {
        await updateFlap(record);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Schema validation error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'Create New Flap Record' : `Edit ${base.name}`}
      data-testid="flap-editor-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden text-xs"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[var(--bg-subtle)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {mode === 'create' ? 'Create New Flap Record (Zod Validated)' : `Full Clinical Editor — ${base.name}`}
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              All numeric values are stored as min–max ranges with confidence tags and persisted locally in IndexedDB.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="px-4 border-b border-[var(--border-subtle)] flex items-center gap-1 overflow-x-auto shrink-0">
          {(
            [
              { id: 'identity', label: 'Identity & Verification' },
              { id: 'vascular', label: 'Vascular & Pedicle' },
              { id: 'dimensions', label: 'Dimensions & Arc' },
              { id: 'clinical', label: 'Technique & Lists' },
              { id: 'references', label: `References (${references.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`px-3 py-2.5 font-medium whitespace-nowrap border-b-2 transition-colors ${
                section === tab.id
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-[var(--danger-text)] font-medium">
              {errorMsg}
            </div>
          )}

          {section === 'identity' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Flap Name *</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="modal-flap-name-input"
                  placeholder="e.g., Superficial Circumflex Iliac Artery Perforator (SCIP) Flap"
                  className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </label>

              {mode === 'create' && (
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Unique ID Slug</span>
                  <input
                    type="text"
                    value={idSlug}
                    onChange={(e) => setIdSlug(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono"
                  />
                </label>
              )}

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Verification Status</span>
                <select
                  value={verificationStatus}
                  onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus)}
                  data-testid="modal-status-select"
                  className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                >
                  <option value="Needs review">Needs review</option>
                  <option value="Partially verified">Partially verified</option>
                  <option value="Verified">Verified</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Region Group</span>
                <select
                  value={regionGroup}
                  onChange={(e) => setRegionGroup(e.target.value as FlapRecord['region_group'])}
                  className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                >
                  <option value="Head & Neck">Head & Neck</option>
                  <option value="Trunk">Trunk</option>
                  <option value="Upper Extremity">Upper Extremity</option>
                  <option value="Lower Extremity">Lower Extremity</option>
                  <option value="Perineum & Pelvis">Perineum & Pelvis</option>
                  <option value="Local / Random Pattern">Local / Random Pattern</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Specific Anatomical Region</span>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">3D Camera Region Preset</span>
                <select
                  value={regionId3d}
                  onChange={(e) => setRegionId3d(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                >
                  {REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Reconstructive Ladder Level</span>
                <select
                  value={ladderLevel}
                  onChange={(e) =>
                    setLadderLevel(e.target.value as FlapRecord['reconstructive_ladder_level'])
                  }
                  className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                >
                  <option value="Local flap">Local flap</option>
                  <option value="Regional flap">Regional flap</option>
                  <option value="Free flap">Free flap</option>
                </select>
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Synonyms (comma-separated)</span>
                <input
                  type="text"
                  value={synonymsText}
                  onChange={(e) => setSynonymsText(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Mathes–Nahai Type</span>
                <input
                  type="text"
                  value={mathesNahai}
                  onChange={(e) => setMathesNahai(e.target.value)}
                  placeholder="e.g., Type V (or leave blank)"
                  className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Cormack–Lamberty Type</span>
                <input
                  type="text"
                  value={cormackLamberty}
                  onChange={(e) => setCormackLamberty(e.target.value)}
                  placeholder="e.g., Type C (or leave blank)"
                  className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Perforator Pattern</span>
                <input
                  type="text"
                  value={perforatorType}
                  onChange={(e) => setPerforatorType(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </label>
            </div>
          )}

          {section === 'vascular' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Dominant Artery *</span>
                  <input
                    type="text"
                    required
                    value={artery}
                    onChange={(e) => setArtery(e.target.value)}
                    data-testid="modal-artery-input"
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Artery Origin</span>
                  <input
                    type="text"
                    value={arteryOrigin}
                    onChange={(e) => setArteryOrigin(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Venous Drainage</span>
                  <input
                    type="text"
                    value={veins}
                    onChange={(e) => setVeins(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Angiosome Territory</span>
                  <input
                    type="text"
                    value={angiosome}
                    onChange={(e) => setAngiosome(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </label>
              </div>

              {/* Ranges with Confidence */}
              <div className="grid grid-cols-1 gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                {[
                  {
                    label: 'Pedicle Length (cm)',
                    min: pedMin,
                    max: pedMax,
                    conf: pedConf,
                    setMin: setPedMin,
                    setMax: setPedMax,
                    setConf: setPedConf,
                  },
                  {
                    label: 'Artery Diameter (mm)',
                    min: artMin,
                    max: artMax,
                    conf: artConf,
                    setMin: setArtMin,
                    setMax: setArtMax,
                    setConf: setArtConf,
                  },
                  {
                    label: 'Vein Diameter (mm)',
                    min: veinMin,
                    max: veinMax,
                    conf: veinConf,
                    setMin: setVeinMin,
                    setMax: setVeinMax,
                    setConf: setVeinConf,
                  },
                ].map((row) => (
                  <div key={row.label} className="grid grid-cols-4 gap-2 items-end">
                    <div className="text-[11px] font-medium text-[var(--text-primary)] pb-2">
                      {row.label}
                    </div>
                    <label className="space-y-1">
                      <span className="text-[10px] text-[var(--text-muted)]">Min</span>
                      <input
                        type="number"
                        step="0.1"
                        value={row.min}
                        onChange={(e) => row.setMin(e.target.value)}
                        className="w-full h-8 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[var(--text-primary)]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-[var(--text-muted)]">Max</span>
                      <input
                        type="number"
                        step="0.1"
                        value={row.max}
                        onChange={(e) => row.setMax(e.target.value)}
                        className="w-full h-8 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[var(--text-primary)]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-[var(--text-muted)]">Confidence</span>
                      <select
                        value={row.conf}
                        onChange={(e) => row.setConf(e.target.value as Confidence)}
                        className="w-full h-8 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      >
                        <option value="high">high</option>
                        <option value="moderate">moderate</option>
                        <option value="verify">verify</option>
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'dimensions' && (
            <div className="space-y-3">
              {[
                {
                  label: 'Max Skin Paddle Length (cm)',
                  min: padLenMin,
                  max: padLenMax,
                  conf: padLenConf,
                  setMin: setPadLenMin,
                  setMax: setPadLenMax,
                  setConf: setPadLenConf,
                },
                {
                  label: 'Max Skin Paddle Width (cm)',
                  min: padWidMin,
                  max: padWidMax,
                  conf: padWidConf,
                  setMin: setPadWidMin,
                  setMax: setPadWidMax,
                  setConf: setPadWidConf,
                },
                {
                  label: 'Primary Closure Max Width (cm)',
                  min: primMin,
                  max: primMax,
                  conf: primConf,
                  setMin: setPrimMin,
                  setMax: setPrimMax,
                  setConf: setPrimConf,
                },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-4 gap-2 items-end">
                  <div className="text-[11px] font-medium text-[var(--text-primary)] pb-2">
                    {row.label}
                  </div>
                  <label className="space-y-1">
                    <span className="text-[10px] text-[var(--text-muted)]">Min</span>
                    <input
                      type="number"
                      step="0.5"
                      value={row.min}
                      onChange={(e) => row.setMin(e.target.value)}
                      className="w-full h-8 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-[var(--text-muted)]">Max</span>
                    <input
                      type="number"
                      step="0.5"
                      value={row.max}
                      onChange={(e) => row.setMax(e.target.value)}
                      className="w-full h-8 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-[var(--text-muted)]">Confidence</span>
                    <select
                      value={row.conf}
                      onChange={(e) => row.setConf(e.target.value as Confidence)}
                      className="w-full h-8 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    >
                      <option value="high">high</option>
                      <option value="moderate">moderate</option>
                      <option value="verify">verify</option>
                    </select>
                  </label>
                </div>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle)]">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Arc Pivot Point</span>
                  <input
                    type="text"
                    value={pivotPoint}
                    onChange={(e) => setPivotPoint(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Arc Reach Description</span>
                  <input
                    type="text"
                    value={reachDesc}
                    onChange={(e) => setReachDesc(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </label>
              </div>
            </div>
          )}

          {section === 'clinical' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Indications (1 per line)', val: indicationsText, set: setIndicationsText },
                { label: 'Contraindications (1 per line)', val: contraindicationsText, set: setContraindicationsText },
                { label: 'Surface Landmarks (1 per line)', val: landmarksText, set: setLandmarksText },
                { label: 'Harvest Steps (1 per line)', val: harvestStepsText, set: setHarvestStepsText },
                { label: 'Surgical Pearls (1 per line)', val: pearlsText, set: setPearlsText },
                { label: 'Pitfalls & Warnings (1 per line)', val: pitfallsText, set: setPitfallsText },
              ].map((field) => (
                <label key={field.label} className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">{field.label}</span>
                  <textarea
                    rows={4}
                    value={field.val}
                    onChange={(e) => field.set(e.target.value)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] leading-relaxed"
                  />
                </label>
              ))}
            </div>
          )}

          {section === 'references' && (
            <div className="space-y-3">
              <div className="space-y-2">
                {references.map((ref, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--text-primary)]">
                        {ref.book} ({ref.edition})
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {ref.chapter_or_section}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={!ref.verify}
                          onChange={(e) =>
                            setReferences((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, verify: !e.target.checked } : r))
                            )
                          }
                          className="accent-[var(--accent-primary)]"
                        />
                        <span>Citation Verified</span>
                      </label>
                      {references.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setReferences((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label="Remove reference"
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--danger-text)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg border border-[var(--border-subtle)] space-y-2">
                <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                  Add Verified Textbook or Journal Citation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Book / Journal..."
                    value={newRefBook}
                    onChange={(e) => setNewRefBook(e.target.value)}
                    className="h-8 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                  <input
                    type="text"
                    placeholder="Edition / Year..."
                    value={newRefEdition}
                    onChange={(e) => setNewRefEdition(e.target.value)}
                    className="h-8 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                  <input
                    type="text"
                    placeholder="Chapter / Section / Pages..."
                    value={newRefChapter}
                    onChange={(e) => setNewRefChapter(e.target.value)}
                    className="h-8 px-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddRef}
                  className="h-8 px-3 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--accent-primary)] font-medium inline-flex items-center gap-1 hover:border-[var(--accent-primary)]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Reference
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between gap-3">
          <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            Validated via Zod schema before saving
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="modal-save-flap-btn"
              className="h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white font-medium flex items-center gap-1.5 hover:opacity-95 disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{mode === 'create' ? 'Create Flap Record' : 'Save Validated Changes'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
