import React, { useMemo, useState } from 'react';
import { Filter, GitCompare, Plus, Search, Star } from 'lucide-react';
import { VESSELS } from '../data/index';
import { filterAndSearchFlaps } from '../engine/searchEngine';
import { useAtlasStore } from '../store/useAtlasStore';
import type { VerificationStatus } from '../types/schemas';
import { FlapEditorModal } from './FlapEditorModal';

const REGION_GROUPS = [
  'All',
  'Head & Neck',
  'Trunk',
  'Upper Extremity',
  'Lower Extremity',
  'Perineum & Pelvis',
  'Local / Random Pattern',
];

const FLAP_TYPES = [
  'All',
  'Perforator',
  'Fasciocutaneous',
  'Muscle',
  'Musculocutaneous',
  'Osteocutaneous',
  'Fascial',
  'Local',
];

export const FlapLibraryPanel: React.FC<{ onSelectDone?: () => void }> = ({ onSelectDone }) => {
  const flaps = useAtlasStore((s) => s.flaps);
  const selectedFlapId = useAtlasStore((s) => s.selectedFlapId);
  const compareIds = useAtlasStore((s) => s.compareIds);
  const favoriteIds = useAtlasStore((s) => s.favoriteIds);
  const collections = useAtlasStore((s) => s.collections);
  const tagsByFlapId = useAtlasStore((s) => s.tagsByFlapId);
  const editorMode = useAtlasStore((s) => s.editorMode);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const toggleCompare = useAtlasStore((s) => s.toggleCompare);
  const toggleFavorite = useAtlasStore((s) => s.toggleFavorite);

  const regionGroup = useAtlasStore((s) => s.libraryRegionFilter);
  const setRegionGroup = useAtlasStore((s) => s.setLibraryRegionFilter);
  const vesselId = useAtlasStore((s) => s.libraryVesselFilter);
  const setVesselId = useAtlasStore((s) => s.setLibraryVesselFilter);

  const [query, setQuery] = useState('');
  const [flapType, setFlapType] = useState('All');
  const [collectionId, setCollectionId] = useState<string>('All');
  const [mobilization, setMobilization] = useState<'All' | 'Pedicled' | 'Free' | 'Local / Random'>('All');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | 'All'>('All');
  const [sensateOnly, setSensateOnly] = useState(false);
  const [boneOnly, setBoneOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const base = filterAndSearchFlaps(
      flaps,
      {
        query,
        regionGroup,
        flapType,
        mobilization,
        vesselId,
        verificationStatus,
        sensateOnly,
        boneOnly,
        favoritesOnly,
        favoriteIds,
      },
      VESSELS
    );
    if (collectionId === 'All') return base;
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return base;
    const allowed = new Set(col.flapIds);
    return base.filter((f) => allowed.has(f.id));
  }, [
    flaps,
    query,
    regionGroup,
    flapType,
    mobilization,
    vesselId,
    verificationStatus,
    sensateOnly,
    boneOnly,
    favoritesOnly,
    favoriteIds,
    collectionId,
    collections,
  ]);

  const activeFilterCount =
    (regionGroup !== 'All' ? 1 : 0) +
    (collectionId !== 'All' ? 1 : 0) +
    (flapType !== 'All' ? 1 : 0) +
    (mobilization !== 'All' ? 1 : 0) +
    (vesselId !== 'All' ? 1 : 0) +
    (verificationStatus !== 'All' ? 1 : 0) +
    (sensateOnly ? 1 : 0) +
    (boneOnly ? 1 : 0) +
    (favoritesOnly ? 1 : 0);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]" data-testid="flap-library-panel">
      {/* Header & Search */}
      <div className="p-3 border-b border-[var(--border-subtle)] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Flap Library
          </h2>
          <div className="flex items-center gap-2">
            {editorMode && (
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                data-testid="library-new-flap-btn"
                className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> New Flap
              </button>
            )}
            <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
              {filtered.length} / {flaps.length}
            </span>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by flap, pedicle, region..."
            className="w-full h-8 pl-8 pr-2.5 text-xs rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            data-testid="library-search-input"
          />
        </div>

        {/* Region Quick Selector + Filter Toggle */}
        <div className="flex items-center gap-1.5">
          <select
            value={regionGroup}
            onChange={(e) => setRegionGroup(e.target.value)}
            aria-label="Filter by anatomical region"
            className="flex-1 min-w-0 h-7 px-2 text-xs rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            {REGION_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g === 'All' ? 'All Regions' : g}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setFiltersExpanded((v) => !v)}
            className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 border shrink-0 transition-colors ${
              filtersExpanded || activeFilterCount > 0
                ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          </button>
        </div>

        {/* Collection Quick Filter */}
        <select
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
          aria-label="Filter by study collection"
          data-testid="library-collection-select"
          className="w-full h-7 px-2 text-xs rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
        >
          <option value="All">All Collections</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.flapIds.length})
            </option>
          ))}
        </select>

        {/* Expanded Faceted Filters */}
        {filtersExpanded && (
          <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={flapType}
                onChange={(e) => setFlapType(e.target.value)}
                aria-label="Filter by flap type"
                className="h-7 px-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                {FLAP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'All' ? 'Any Tissue Type' : t}
                  </option>
                ))}
              </select>

              <select
                value={mobilization}
                onChange={(e) => setMobilization(e.target.value as typeof mobilization)}
                aria-label="Filter by transfer mode"
                className="h-7 px-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="All">Any Transfer</option>
                <option value="Free">Free Capable</option>
                <option value="Pedicled">Pedicled Capable</option>
                <option value="Local / Random">Local / Random</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={vesselId}
                onChange={(e) => setVesselId(e.target.value)}
                aria-label="Filter by source vessel"
                className="h-7 px-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="All">Any Source Vessel</option>
                {VESSELS.filter((v) => v.category === 'Artery').map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>

              <select
                value={verificationStatus}
                onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus | 'All')}
                aria-label="Filter by verification status"
                className="h-7 px-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="All">Any Verification</option>
                <option value="Verified">Verified</option>
                <option value="Partially verified">Partially verified</option>
                <option value="Needs review">Needs review</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              <label className="flex items-center gap-1 cursor-pointer text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={boneOnly}
                  onChange={(e) => setBoneOnly(e.target.checked)}
                  className="accent-[var(--accent-primary)]"
                />
                <span>Bone</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={sensateOnly}
                  onChange={(e) => setSensateOnly(e.target.checked)}
                  className="accent-[var(--accent-primary)]"
                />
                <span>Sensate</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={favoritesOnly}
                  onChange={(e) => setFavoritesOnly(e.target.checked)}
                  className="accent-[var(--accent-primary)]"
                />
                <span>Favorites</span>
              </label>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRegionGroup('All');
                    setCollectionId('All');
                    setFlapType('All');
                    setMobilization('All');
                    setVesselId('All');
                    setVerificationStatus('All');
                    setSensateOnly(false);
                    setBoneOnly(false);
                    setFavoritesOnly(false);
                  }}
                  className="ml-auto text-[11px] text-[var(--accent-primary)] hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Flap List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-muted)]">
            No flaps match your current filters.
          </div>
        ) : (
          filtered.map((flap) => {
            const isSelected = flap.id === selectedFlapId;
            const isCompared = compareIds.includes(flap.id);
            const isFav = favoriteIds.includes(flap.id);

            return (
              <div
                key={flap.id}
                onClick={() => {
                  selectFlap(flap.id, true);
                  onSelectDone?.();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectFlap(flap.id, true);
                    onSelectDone?.();
                  }
                }}
                data-testid={`flap-item-${flap.id}`}
                className={`px-3 py-2.5 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[var(--accent-soft)]'
                    : 'hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div
                      className={`text-xs font-semibold leading-snug truncate ${
                        isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {flap.name}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                      {flap.vascular_anatomy.dominant_pedicle.artery}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{flap.region_group}</span>
                      <span>·</span>
                      <span>{flap.flap_type[0]}</span>
                      <span>·</span>
                      <span
                        className={
                          flap.verification_status === 'Verified'
                            ? 'text-[var(--success-text)] font-medium'
                            : flap.verification_status === 'Partially verified'
                              ? 'text-[var(--accent-primary)] font-medium'
                              : 'text-[var(--warning-text)]'
                        }
                      >
                        {flap.verification_status}
                      </span>
                      {(tagsByFlapId[flap.id] || []).slice(0, 2).map((t) => (
                        <React.Fragment key={t}>
                          <span>·</span>
                          <span className="font-mono text-[10px] text-[var(--accent-primary)]">#{t}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(flap.id)}
                      title={isFav ? 'Remove bookmark' : 'Bookmark flap'}
                      aria-label={`Bookmark ${flap.name}`}
                      className={`p-1 rounded transition-colors ${
                        isFav
                          ? 'text-amber-500'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCompare(flap.id)}
                      title={isCompared ? 'Remove from Compare' : 'Add to Compare'}
                      aria-label={`Compare ${flap.name}`}
                      className={`p-1 rounded transition-colors ${
                        isCompared
                          ? 'text-[var(--accent-primary)] bg-[var(--bg-surface)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {createModalOpen && (
        <FlapEditorModal mode="create" onClose={() => setCreateModalOpen(false)} />
      )}
    </div>
  );
};
