import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Compass,
  Crosshair,
  Filter,
  HeartPulse,
  Layers,
  Search,
  X,
  Zap,
} from 'lucide-react';
import { REGIONS, VESSELS } from '../data/index';
import { MUSCLE_REFERENCES } from '../data/muscleReference';
import { computeStructureFocusCamera } from '../models/clippingAndSearch';
import {
  findFlapsUsingVessel,
  FlapUsingVesselMatch,
  searchLoadedVessels,
} from '../models/vesselSearch';
import { useAtlasStore } from '../store/useAtlasStore';
import { formatRange } from '../types/schemas';
import { SchematicIconBadge } from './SchematicIconBadge';

const ROLE_BADGE_META: Record<
  FlapUsingVesselMatch['role'],
  { label: string; cls: string }
> = {
  pedicle: {
    label: 'Pedicle',
    cls: 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300',
  },
  vein: {
    label: 'Vein',
    cls: 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300',
  },
  source: {
    label: 'Source',
    cls: 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300',
  },
};

function formatVesselSideBadge(side?: string): { label: string; short: string; cls: string } {
  if (side === 'left') {
    return {
      label: 'Left',
      short: 'L',
      cls: 'bg-sky-500/12 border-sky-500/35 text-sky-700 dark:text-sky-300',
    };
  }
  if (side === 'right') {
    return {
      label: 'Right',
      short: 'R',
      cls: 'bg-rose-500/12 border-rose-500/35 text-rose-700 dark:text-rose-300',
    };
  }
  return {
    label: 'Midline',
    short: 'Mid',
    cls: 'bg-slate-500/12 border-slate-500/35 text-slate-700 dark:text-slate-300',
  };
}


interface FascialPlaneEntry {
  id: string;
  name: string;
  regionId: string;
  peelDepth: number;
  surgicalSignificance: string;
  keyFlaps: string[];
}

const FASCIAL_PLANES: FascialPlaneEntry[] = [
  {
    id: 'plane-scarpa',
    name: 'Scarpa Fascia (Superficial Abdominal)',
    regionId: 'abdomen',
    peelDepth: 18,
    surgicalSignificance:
      'Divides superficial (Camper) and deep abdominal fat; SIEA/SIEV course within this plane, and preserving Scarpa layer reduces donor seroma.',
    keyFlaps: ['diep-flap', 'siea-flap'],
  },
  {
    id: 'plane-fascia-lata',
    name: 'Fascia Lata & Lateral Intermuscular Septum',
    regionId: 'lower-limb-ant',
    peelDepth: 36,
    surgicalSignificance:
      'Key dissection plane for ALT elevation (subfascial vs suprafascial) and septal entry to the descending branch of LCFA between rectus femoris and vastus lateralis.',
    keyFlaps: ['alt-flap'],
  },
  {
    id: 'plane-posterior-crural',
    name: 'Posterior Crural Intermuscular Septum',
    regionId: 'lower-limb-ant',
    peelDepth: 48,
    surgicalSignificance:
      'Houses septocutaneous perforators of the peroneal artery supplying the free fibula skin paddle and peroneal perforator propeller flaps.',
    keyFlaps: ['fibula-flap', 'peroneal-perforator-flap'],
  },
  {
    id: 'plane-tpff',
    name: 'Temporoparietal Fascia (Superficial Temporal)',
    regionId: 'head-neck',
    peelDepth: 22,
    surgicalSignificance:
      'Thin, highly vascular axial fascial sheet continuous with SMAS/galea, supplied by superficial temporal artery; frontal branch of CN VII runs deep/anterior.',
    keyFlaps: ['tpff-flap'],
  },
  {
    id: 'plane-clavipectoral',
    name: 'Pectoral & Clavipectoral Fascia',
    regionId: 'chest-breast',
    peelDepth: 40,
    surgicalSignificance:
      'Deep to pectoralis major; thoracoacromial pedicle pierces clavipectoral fascia medial to pectoralis minor to enter the deep surface of pec major.',
    keyFlaps: ['pec-major-flap'],
  },
];

export const AnatomyExplorerPanel: React.FC = () => {
  const flaps = useAtlasStore((s) => s.flaps);
  const selectedVesselId = useAtlasStore((s) => s.selectedVesselId);
  const selectedAnatomyInfo = useAtlasStore((s) => s.selectedAnatomyInfo);
  const selectedMuscleRefId = useAtlasStore((s) => s.selectedMuscleRefId);
  const loadedVessels = useAtlasStore((s) => s.loadedVessels);
  const unitSystem = useAtlasStore((s) => s.unitSystem);
  const layers = useAtlasStore((s) => s.layers);

  const selectVessel = useAtlasStore((s) => s.selectVessel);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const selectMuscleRef = useAtlasStore((s) => s.selectMuscleRef);
  const focusLoadedVessel = useAtlasStore((s) => s.focusLoadedVessel);
  const flyToCameraGoal = useAtlasStore((s) => s.flyToCameraGoal);
  const setDonorSide = useAtlasStore((s) => s.setDonorSide);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const setCameraPreset = useAtlasStore((s) => s.setCameraPreset);
  const setLayer = useAtlasStore((s) => s.setLayer);
  const setDissectionPeel = useAtlasStore((s) => s.setDissectionPeel);
  const setSelectedAnatomyInfo = useAtlasStore((s) => s.setSelectedAnatomyInfo);
  const setLibraryVesselFilter = useAtlasStore((s) => s.setLibraryVesselFilter);

  const [subMode, setSubMode] = useState<'vessels' | 'muscles' | 'nerves' | 'planes'>('muscles');
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();

  const arteries = useMemo(
    () =>
      VESSELS.filter(
        (v) =>
          (v.category === 'Artery' || v.category === 'Vein') &&
          (!q || v.name.toLowerCase().includes(q) || v.origin.toLowerCase().includes(q))
      ),
    [q]
  );

  const nerves = useMemo(
    () =>
      VESSELS.filter(
        (v) =>
          v.category === 'Nerve' &&
          (!q || v.name.toLowerCase().includes(q) || v.origin.toLowerCase().includes(q))
      ),
    [q]
  );

  const filteredMuscles = useMemo(
    () =>
      MUSCLE_REFERENCES.filter((m) => {
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          m.bp3dGroup.toLowerCase().includes(q) ||
          m.region.toLowerCase().includes(q) ||
          m.origin.toLowerCase().includes(q) ||
          m.insertion.toLowerCase().includes(q) ||
          m.action.toLowerCase().includes(q) ||
          m.nerveSupply.toLowerCase().includes(q) ||
          m.bloodSupply.dominant.some((v) => v.toLowerCase().includes(q)) ||
          m.bloodSupply.minor.some((v) => v.toLowerCase().includes(q)) ||
          m.relatedFlaps.some((f) => f.toLowerCase().includes(q))
        );
      }),
    [q]
  );

  const filteredLoadedVessels = useMemo(
    () => searchLoadedVessels(loadedVessels, search, 24),
    [loadedVessels, search]
  );

  const selected3DVesselInfo = useMemo(() => {
    if (!selectedAnatomyInfo) return null;
    if (selectedAnatomyInfo.system !== 'arteries' && selectedAnatomyInfo.system !== 'veins') {
      return null;
    }
    if (!selectedAnatomyInfo.subMeshKey && !selectedAnatomyInfo.fjCode) return null;
    return selectedAnatomyInfo;
  }, [selectedAnatomyInfo]);

  useEffect(() => {
    if (selected3DVesselInfo) {
      setSubMode('vessels');
    }
  }, [selected3DVesselInfo]);

  const selected3DVesselFlapMatches = useMemo(() => {
    if (!selected3DVesselInfo) return [];
    return findFlapsUsingVessel(
      { fjCode: selected3DVesselInfo.fjCode, name: selected3DVesselInfo.label },
      flaps
    );
  }, [selected3DVesselInfo, flaps]);

  const selectedVessel =
    VESSELS.find((v) => v.id === selectedVesselId) ||
    (subMode === 'nerves' ? nerves[0] : arteries[0]);

  const curatedVesselMapMatches = useMemo(() => {
    if (!selectedVessel || selectedVessel.category === 'Nerve') return [];
    return findFlapsUsingVessel({ name: selectedVessel.name }, flaps);
  }, [selectedVessel, flaps]);

  const suppliedFlapEntries = useMemo(() => {
    if (!selectedVessel) return [];
    const byId = new Map<
      string,
      { flap: (typeof flaps)[number]; role?: FlapUsingVesselMatch['role'] }
    >();
    for (const m of curatedVesselMapMatches) {
      const fl = flaps.find((f) => f.id === m.flapId);
      if (fl) byId.set(fl.id, { flap: fl, role: m.role });
    }
    for (const fl of flaps) {
      if (selectedVessel.supplied_flap_ids.includes(fl.id) && !byId.has(fl.id)) {
        byId.set(fl.id, { flap: fl });
      }
    }
    return Array.from(byId.values());
  }, [selectedVessel, curatedVesselMapMatches, flaps]);

  const handleOpenFlapFromVessel = (flapId: string, side?: string) => {
    if (side === 'left' || side === 'right') {
      setDonorSide(side);
    }
    setSelectedAnatomyInfo(null);
    selectFlap(flapId, true);
    setActiveTab('library');
  };

  const toggleAngiosomes = () => {
    setLayer('angiosomes', {
      visible: !layers.angiosomes.visible,
      opacity: layers.angiosomes.visible ? layers.angiosomes.opacity : 0.35,
    });
  };

  return (
    <div
      className="flex flex-col h-full bg-[var(--bg-surface)]"
      data-testid="anatomy-explorer-panel"
    >
      <div className="p-3 border-b border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Anatomy Explorer
          </h2>
          <button
            type="button"
            onClick={toggleAngiosomes}
            data-testid="toggle-angiosomes-btn"
            className={`text-[11px] font-medium px-2 py-0.5 rounded border transition-colors ${
              layers.angiosomes.visible
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                : 'text-[var(--accent-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
            }`}
          >
            {layers.angiosomes.visible ? 'Angiosomes ON' : 'Angiosomes'}
          </button>
        </div>

        {/* Search Anatomy Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter vessels, muscles, nerves..."
            data-testid="anatomy-explorer-search-input"
            className="w-full min-h-[44px] pl-9 pr-3 text-sm rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>

        {/* 4-System Tab Switcher */}
        <div className="grid grid-cols-4 gap-1 bg-[var(--bg-subtle)] p-1 rounded-lg border border-[var(--border-subtle)]">
          {[
            { id: 'vessels', label: 'Vessels' },
            { id: 'muscles', label: 'Muscles' },
            { id: 'nerves', label: 'Nerves' },
            { id: 'planes', label: 'Planes' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubMode(tab.id as typeof subMode)}
              data-testid={`anatomy-subtab-${tab.id}`}
              className={`py-1 text-[11px] font-medium rounded-md transition-colors ${
                subMode === tab.id
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {(subMode === 'vessels' || subMode === 'nerves') && (
          <>
            {/* Sub-Phase 9e: Selected Loaded 3D Vessel Card + Flaps That Use This Vessel (9d map) */}
            {subMode === 'vessels' && selected3DVesselInfo && (() => {
              const sideBadge = formatVesselSideBadge(selected3DVesselInfo.laterality);
              return (
                <div
                  className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--accent-primary)] space-y-2 text-sm"
                  data-testid="anatomy-selected-3d-vessel-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                          Selected {selected3DVesselInfo.category}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold border ${sideBadge.cls}`}
                        >
                          {sideBadge.label}
                        </span>
                        {selected3DVesselInfo.isSchematic && <SchematicIconBadge compact />}
                      </div>
                      <div className="text-base font-semibold text-[var(--text-primary)] leading-snug">
                        {selected3DVesselInfo.label}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAnatomyInfo(null)}
                      aria-label="Clear selected 3D vessel"
                      className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {selected3DVesselInfo.boundsMin && selected3DVesselInfo.boundsMax && (
                    <button
                      type="button"
                      onClick={() => {
                        const goal = computeStructureFocusCamera(
                          selected3DVesselInfo.boundsMin!,
                          selected3DVesselInfo.boundsMax!,
                          selected3DVesselInfo.center
                        );
                        flyToCameraGoal(goal.pos, goal.target);
                      }}
                      data-testid="anatomy-3d-vessel-flyto-btn"
                      className="h-7 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[11px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Fly Camera to Vessel</span>
                    </button>
                  )}

                  <div
                    className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5"
                    data-testid="anatomy-flaps-using-vessel"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Flaps That Use This Vessel ({selected3DVesselFlapMatches.length})
                    </div>
                    {selected3DVesselFlapMatches.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Not directly linked to a reconstructive flap pedicle in the atlas map.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {selected3DVesselFlapMatches.map((m) => {
                          const roleMeta = ROLE_BADGE_META[m.role];
                          return (
                            <button
                              key={m.flapId}
                              type="button"
                              data-testid={`anatomy-vessel-flap-link-${m.flapId}`}
                              onClick={() =>
                                handleOpenFlapFromVessel(
                                  m.flapId,
                                  selected3DVesselInfo.laterality
                                )
                              }
                              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-left"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-[var(--text-primary)] truncate">
                                  {m.flapName}
                                </div>
                                <div className="text-[10px] text-[var(--text-muted)] truncate">
                                  {m.regionGroup}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase border ${roleMeta.cls}`}
                                >
                                  {roleMeta.label}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Searchable 3D Vessels */}
            {subMode === 'vessels' && loadedVessels.length > 0 && (
              <div className="space-y-1.5" data-testid="anatomy-loaded-vessels-list">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>3D Vessels</span>
                </div>
                {filteredLoadedVessels.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] px-1">
                    No vessels match &ldquo;{search}&rdquo;.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                    {filteredLoadedVessels.map((v) => {
                      const active = selected3DVesselInfo?.subMeshKey === v.key;
                      const sideBadge = formatVesselSideBadge(v.side);
                      const linkedCount = findFlapsUsingVessel(
                        { fjCode: v.fjCode, name: v.name },
                        flaps
                      ).length;
                      return (
                        <button
                          key={v.key}
                          type="button"
                          data-testid={`anatomy-loaded-vessel-${v.fjCode || v.key}`}
                          onClick={() => focusLoadedVessel(v)}
                          className={`w-full min-h-[44px] text-left px-3 py-2 rounded-lg border transition-colors ${
                            active
                              ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                              {v.name}
                            </span>
                            <span
                              className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-mono font-semibold border ${sideBadge.cls}`}
                            >
                              {sideBadge.short}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                            <span className="truncate">{v.category}</span>
                            {linkedCount > 0 && (
                              <span className="text-[var(--accent-primary)] font-semibold shrink-0">
                                {linkedCount} flap{linkedCount === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              {subMode === 'vessels' && loadedVessels.length > 0 && (
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] pt-1">
                  Clinical Vessel Reference
                </div>
              )}
              {(subMode === 'vessels' ? arteries : nerves).map((v) => {
                const active = selectedVessel?.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      selectVessel(v.id, true);
                      setSelectedAnatomyInfo({
                        id: v.id,
                        label: v.name,
                        category: v.category,
                      });
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors ${
                      active
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {v.name}
                      </span>
                      {v.category === 'Nerve' ? (
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <HeartPulse className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">
                      Origin: {v.origin}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedVessel && (
              <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    {selectedVessel.name}
                  </div>
                  {selectedVessel.category === 'Artery' && (
                    <button
                      type="button"
                      onClick={() => {
                        setLibraryVesselFilter(selectedVessel.id);
                        setActiveTab('library');
                      }}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
                    >
                      <Filter className="w-3 h-3" /> Filter Library
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] block">Origin</span>
                    <span className="text-[var(--text-primary)]">{selectedVessel.origin}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] block">Typical Caliber</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {formatRange(selectedVessel.diameter_mm, unitSystem).text}
                    </span>
                  </div>
                </div>

                {selectedVessel.angiosome && (
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] block">
                      Taylor Angiosome Territory
                    </span>
                    <span className="text-[var(--text-primary)]">{selectedVessel.angiosome}</span>
                  </div>
                )}

                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Course & Relations</span>
                  <p className="text-[var(--text-secondary)]">
                    {selectedVessel.course} {selectedVessel.relations}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Key Branches</span>
                  <p className="text-[var(--text-primary)]">{selectedVessel.branches.join(' · ')}</p>
                </div>

                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Variants</span>
                  <ul className="list-disc pl-4 text-[var(--text-secondary)]">
                    {selectedVessel.variants.map((vr, i) => (
                      <li key={i}>{vr}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-1 border-t border-[var(--border-subtle)]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    {subMode === 'vessels'
                      ? `Flaps That Use This Vessel (${suppliedFlapEntries.length})`
                      : `Flaps Supplied by This Structure (${suppliedFlapEntries.length})`}
                  </div>
                  {suppliedFlapEntries.length === 0 ? (
                    <p className="text-[var(--text-muted)]">No flaps linked in current subset.</p>
                  ) : (
                    <div className="space-y-1">
                      {suppliedFlapEntries.map(({ flap: f, role }) => {
                        const roleMeta = role ? ROLE_BADGE_META[role] : null;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleOpenFlapFromVessel(f.id)}
                            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-left"
                          >
                            <span className="font-medium text-[var(--text-primary)] truncate">
                              {f.name}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {roleMeta && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase border ${roleMeta.cls}`}
                                >
                                  {roleMeta.label}
                                </span>
                              )}
                              <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {subMode === 'muscles' && (
          <div className="space-y-2" data-testid="muscle-library-list">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-0.5">
              <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Muscle Library ({filteredMuscles.length} / {MUSCLE_REFERENCES.length})</span>
              </span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-[var(--accent-primary)] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {filteredMuscles.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] px-1 py-4 text-center">
                No muscles match &ldquo;{search}&rdquo;.
              </p>
            ) : (
              <div className="space-y-1.5">
                {filteredMuscles.map((m) => {
                  const active = selectedMuscleRefId === m.id;
                  const dominantSummary = m.bloodSupply.dominant[0] ?? '';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        selectMuscleRef(m.id, { openSheet: true, frameIn3D: m.inBodyParts3D });
                      }}
                      data-testid={`muscle-library-item-${m.id}`}
                      className={`w-full min-h-[48px] text-left px-3 py-2.5 rounded-xl border transition-colors ${
                        active
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {m.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!m.inBodyParts3D && <SchematicIconBadge compact />}
                          {m.bloodSupply.mathesNahai && (
                            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--accent-primary)] font-semibold">
                              MN {m.bloodSupply.mathesNahai}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                        {m.region}
                        {dominantSummary ? ` · ${dominantSummary}` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {subMode === 'planes' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Surgical Fascial Planes & Septa</span>
              </div>
              {FASCIAL_PLANES.map((pl) => (
                <div
                  key={pl.id}
                  className="p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] space-y-1.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">{pl.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraPreset(pl.regionId);
                        setDissectionPeel(pl.peelDepth);
                        setLayer('fascia', { visible: true, opacity: 0.48 });
                      }}
                      className="shrink-0 text-[11px] text-[var(--accent-primary)] flex items-center gap-1 hover:underline"
                    >
                      <Compass className="w-3 h-3" /> Sync Plane
                    </button>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {pl.surgicalSignificance}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Regional Bony Landmarks & Angiosomes
              </div>
              {REGIONS.filter((r) => r.landmarks.length > 0).map((reg) => (
                <div
                  key={reg.id}
                  className="p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {reg.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCameraPreset(reg.id)}
                      className="text-[11px] text-[var(--accent-primary)] flex items-center gap-1 hover:underline"
                    >
                      <Compass className="w-3 h-3" /> Focus 3D
                    </button>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Angiosome: {reg.angiosomeTerritory}
                  </div>
                  <div className="space-y-1 pt-1">
                    {reg.landmarks.map((lm) => (
                      <div
                        key={lm.id}
                        className="text-xs bg-[var(--bg-surface)] px-2 py-1.5 rounded border border-[var(--border-subtle)]"
                      >
                        <div className="font-medium text-[var(--text-primary)]">{lm.name}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {lm.clinicalNote}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
