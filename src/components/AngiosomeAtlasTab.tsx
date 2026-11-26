import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Layers, Search, ShieldAlert } from 'lucide-react';
import { ANGIOSOME_PERFORASOME_ATLAS, AngiosomePerforasomeEntry } from '../engine/localFlapCalc';
import { useAtlasStore } from '../store/useAtlasStore';

type CaptureLevel = 'primary' | 'choke1' | 'choke2';

const CAPTURE_INFO: Record<
  CaptureLevel,
  {
    title: string;
    verdict: string;
    verdictTone: string;
    detail: string;
  }
> = {
  primary: {
    title: 'Primary Perforasome (Zone I)',
    verdict: '100% Direct Axial Perfusion',
    verdictTone: 'text-[var(--success-text)]',
    detail:
      'Skin overlying the entering source perforator receives direct high-pressure arterial inflow and reliable paired venous outflow.',
  },
  choke1: {
    title: 'Adjacent Territory (+1 Choke Zone)',
    verdict: 'Reliably Captured (Taylor Rule)',
    verdictTone: 'text-[var(--accent-primary)]',
    detail:
      'A single dominant perforator safely captures its own perforasome plus ONE adjacent angiosome/perforasome across linking choke vessels or true anastomoses (Saint-Cyr / Taylor).',
  },
  choke2: {
    title: 'Remote Territory (+2 Choke Zones)',
    verdict: 'High Necrosis Risk — Delay / Supercharge',
    verdictTone: 'text-[var(--danger-text)]',
    detail:
      'Crossing two consecutive choke-vessel boundaries leads to unreliable distal tip perfusion and fat necrosis (e.g., DIEP Zone IV, undelayed lateral deltopectoral tip). Requires surgical delay (10–21 d) or vascular supercharging.',
  },
};

export const AngiosomeAtlasTab: React.FC = () => {
  const flaps = useAtlasStore((s) => s.flaps);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const selectVessel = useAtlasStore((s) => s.selectVessel);
  const setLayer = useAtlasStore((s) => s.setLayer);
  const setCameraPreset = useAtlasStore((s) => s.setCameraPreset);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);

  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [selectedId, setSelectedId] = useState<string>(ANGIOSOME_PERFORASOME_ATLAS[0].id);
  const [captureLevel, setCaptureLevel] = useState<CaptureLevel>('choke1');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ANGIOSOME_PERFORASOME_ATLAS.filter((entry) => {
      if (regionFilter !== 'All' && entry.regionGroup !== regionFilter) return false;
      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.sourceArtery.toLowerCase().includes(q) ||
        entry.adjacentAngiosomes.some((a) => a.toLowerCase().includes(q)) ||
        entry.linkedFlapIds.some((id) => id.toLowerCase().includes(q))
      );
    });
  }, [query, regionFilter]);

  const activeEntry: AngiosomePerforasomeEntry =
    filtered.find((e) => e.id === selectedId) ||
    ANGIOSOME_PERFORASOME_ATLAS.find((e) => e.id === selectedId) ||
    ANGIOSOME_PERFORASOME_ATLAS[0];

  const flapNameById = useMemo(
    () => new Map(flaps.map((f) => [f.id, f.name])),
    [flaps]
  );

  const inspectIn3D = (entry: AngiosomePerforasomeEntry, specificFlapId?: string) => {
    const targetFlap = specificFlapId || entry.linkedFlapIds[0];
    setLayer('angiosomes', { visible: true, opacity: 0.42 });
    setLayer('perforasomes', { visible: true, opacity: 0.58 });
    setLayer('perforators', { visible: true, opacity: 1 });
    if (targetFlap) {
      selectFlap(targetFlap, false);
    }
    if (entry.linkedVesselId && !specificFlapId) {
      selectVessel(entry.linkedVesselId, false);
    }
    setCameraPreset(entry.cameraPreset);
    setActiveTab('library');
  };

  const captureMeta = CAPTURE_INFO[captureLevel];

  return (
    <div className="space-y-5" data-testid="angiosomes-atlas-tab">
      {/* Interactive Perforasome / Choke-Vessel Cascade Diagram */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-5 space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
              Taylor Angiosome & Saint-Cyr Perforasome Physiology
            </div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] mt-0.5">
              Choke-Zone Capture & Vascular Delay Simulator
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Perforasome capture depth">
            {(
              [
                { id: 'primary', label: 'Primary Zone' },
                { id: 'choke1', label: '+1 Choke (Safe)' },
                { id: 'choke2', label: '+2 Chokes (Risk)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCaptureLevel(opt.id)}
                data-testid={`choke-btn-${opt.id}`}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                  captureLevel === opt.id
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[var(--text-primary)]">{captureMeta.title}</span>
              <span className={`font-semibold text-[11px] ${captureMeta.verdictTone}`}>
                {captureMeta.verdict}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {captureMeta.detail}
            </p>
          </div>
        </div>

        <div className="lg:col-span-7">
          <svg
            viewBox="0 0 540 170"
            className="w-full h-44 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
            data-testid="perforasome-cascade-svg"
            role="img"
            aria-label="Perforasome linking vessels and choke zone capture diagram"
          >
            {/* Skin & Deep Fascia Layers */}
            <rect x="16" y="24" width="508" height="78" rx="8" fill="rgba(148,163,184,0.1)" stroke="currentColor" strokeOpacity="0.18" />
            <line x1="16" y1="104" x2="524" y2="104" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="5 3" />
            <text x="520" y="117" textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.62">
              Deep Fascia Plane
            </text>

            {/* Primary Perforasome Zone */}
            <ellipse cx="110" cy="62" rx="76" ry="30" fill="rgba(15,118,110,0.28)" stroke="#0f766e" strokeWidth="2" />
            <text x="110" y="54" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f766e">Zone I: Primary</text>
            <text x="110" y="69" textAnchor="middle" fontSize="9.5" fill="currentColor" fillOpacity="0.8">Direct Perforator</text>

            {/* +1 Choke Territory */}
            <ellipse
              cx="275"
              cy="62"
              rx="74"
              ry="30"
              fill={captureLevel === 'primary' ? 'rgba(148,163,184,0.12)' : 'rgba(2,132,199,0.24)'}
              stroke={captureLevel === 'primary' ? '#94a3b8' : '#0284c7'}
              strokeWidth="2"
              strokeDasharray={captureLevel === 'primary' ? '4 3' : undefined}
            />
            <text x="275" y="54" textAnchor="middle" fontSize="11" fontWeight="700" fill={captureLevel === 'primary' ? '#64748b' : '#0284c7'}>
              +1 Choke Zone
            </text>
            <text x="275" y="69" textAnchor="middle" fontSize="9.5" fill="currentColor" fillOpacity="0.8">
              {captureLevel === 'primary' ? 'Adjacent Territory' : 'Safely Captured'}
            </text>

            {/* +2 Choke Territory */}
            <ellipse
              cx="438"
              cy="62"
              rx="72"
              ry="30"
              fill={captureLevel === 'choke2' ? 'rgba(220,38,38,0.22)' : 'rgba(148,163,184,0.1)'}
              stroke={captureLevel === 'choke2' ? '#dc2626' : '#94a3b8'}
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <text x="438" y="54" textAnchor="middle" fontSize="11" fontWeight="700" fill={captureLevel === 'choke2' ? '#dc2626' : '#64748b'}>
              +2 Choke Zone
            </text>
            <text x="438" y="69" textAnchor="middle" fontSize="9.5" fill="currentColor" fillOpacity="0.8">
              {captureLevel === 'choke2' ? 'Necrosis Risk / Delay' : 'Unreliable Distal Tip'}
            </text>

            {/* Linking / Choke Vessels */}
            <path
              d="M 178 62 Q 192 50 206 62"
              fill="none"
              stroke={captureLevel === 'primary' ? '#94a3b8' : '#0284c7'}
              strokeWidth={captureLevel === 'primary' ? '1.8' : '3'}
            />
            <text x="192" y="42" textAnchor="middle" fontSize="8.5" fill="currentColor" fillOpacity="0.7">Choke 1</text>

            <path
              d="M 342 62 Q 356 50 370 62"
              fill="none"
              stroke={captureLevel === 'choke2' ? '#dc2626' : '#94a3b8'}
              strokeWidth={captureLevel === 'choke2' ? '2.2' : '1.4'}
              strokeDasharray="3 2"
            />
            <text x="356" y="42" textAnchor="middle" fontSize="8.5" fill="currentColor" fillOpacity="0.7">Choke 2</text>

            {/* Source Artery & Rising Perforator */}
            <line x1="28" y1="142" x2="210" y2="142" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
            <path d="M 110 142 L 110 86" stroke="#dc2626" strokeWidth="3.5" />
            <circle cx="110" cy="92" r="4" fill="#dc2626" />
            <text x="120" y="135" fontSize="9.5" fontWeight="600" fill="#dc2626">
              Dominant Pedicle Perforator (Active Inflow)
            </text>

            {/* Divided adjacent perforators */}
            <line x1="275" y1="142" x2="275" y2="112" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />
            <text x="275" y="155" textAnchor="middle" fontSize="8.5" fill="currentColor" fillOpacity="0.6">
              Divided Perforator 2
            </text>
            <line x1="438" y1="142" x2="438" y2="112" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />
            <text x="438" y="155" textAnchor="middle" fontSize="8.5" fill="currentColor" fillOpacity="0.6">
              Divided Perforator 3
            </text>
          </svg>
        </div>
      </div>

      {/* Territory Explorer + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Major Angiosomes ({filtered.length} / {ANGIOSOME_PERFORASOME_ATLAS.length})
            </h3>
            <select
              aria-label="Filter angiosomes by anatomical region"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="h-8 px-2 rounded-lg text-xs bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              <option value="All">All Regions</option>
              <option value="Head & Neck">Head & Neck</option>
              <option value="Trunk">Trunk</option>
              <option value="Upper Extremity">Upper Extremity</option>
              <option value="Lower Extremity">Lower Extremity</option>
              <option value="Perineum & Pelvis">Perineum & Pelvis</option>
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search angiosome, source artery, or flap..."
              className="w-full h-8 pl-8 pr-3 rounded-lg text-xs bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>

          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {filtered.map((entry) => {
              const selected = entry.id === activeEntry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  data-testid={`angiosome-item-${entry.id}`}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                    selected
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: entry.accentColor }}
                      />
                      <span>{entry.name}</span>
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                      {entry.linkedFlapIds.length} flaps
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">
                    {entry.sourceArtery}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Territory Reference Card */}
        <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
            <div>
              <div className="text-[11px] font-medium text-[var(--text-muted)]">
                {activeEntry.regionGroup} · {activeEntry.linkingVesselType}
              </div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] mt-0.5">
                {activeEntry.name}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Source Artery: <span className="font-medium text-[var(--text-primary)]">{activeEntry.sourceArtery}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => inspectIn3D(activeEntry)}
              data-testid="inspect-angiosome-3d-btn"
              className="shrink-0 px-3 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-95"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Inspect Angiosome & Perforasomes in 3D</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                Linking Vessel Anatomy
              </div>
              <div className="font-semibold text-[var(--text-primary)]">
                {activeEntry.linkingVesselType}
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {activeEntry.perforasomePattern}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                Adjacent Angiosome Borders
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[var(--text-secondary)]">
                {activeEntry.adjacentAngiosomes.map((adj) => (
                  <li key={adj}>{adj}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30">
              <div className="text-[11px] font-semibold text-[var(--accent-primary)]">
                Safe Perforasome Capture Guideline
              </div>
              <p className="text-[var(--text-primary)] mt-0.5 leading-relaxed">
                {activeEntry.safeCaptureNote}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[var(--warning-text)] shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                  Vascular Delay & Clinical Pitfall Note
                </div>
                <p className="text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                  {activeEntry.delayNote}
                </p>
              </div>
            </div>
          </div>

          {/* Linked Flaps */}
          <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Supplied Flaps in This Territory (Click to Inspect in 3D)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeEntry.linkedFlapIds.map((fid) => (
                <button
                  key={fid}
                  type="button"
                  onClick={() => inspectIn3D(activeEntry, fid)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1 transition-colors"
                >
                  <span>{flapNameById.get(fid) || fid}</span>
                  <ArrowUpRight className="w-3 h-3 text-[var(--accent-primary)]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
