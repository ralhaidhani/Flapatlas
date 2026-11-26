import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Compass, Crosshair, HeartPulse, Layers, Search, X } from 'lucide-react';
import { GLOSSARY_TERMS, VESSELS } from '../data/index';
import { filterAndSearchFlaps } from '../engine/searchEngine';
import { searchTerritoriesAndCodes } from '../models/territorySearch';
import { findFlapsUsingVessel, searchLoadedVessels } from '../models/vesselSearch';
import { useAtlasStore } from '../store/useAtlasStore';

function formatSideLabel(side: string): { label: string; cls: string } {
  if (side === 'left') {
    return {
      label: 'Left',
      cls: 'bg-sky-500/12 border-sky-500/35 text-sky-700 dark:text-sky-300',
    };
  }
  if (side === 'right') {
    return {
      label: 'Right',
      cls: 'bg-rose-500/12 border-rose-500/35 text-rose-700 dark:text-rose-300',
    };
  }
  return {
    label: 'Midline',
    cls: 'bg-slate-500/12 border-slate-500/35 text-slate-700 dark:text-slate-300',
  };
}

export const SearchPalette: React.FC = () => {
  const open = useAtlasStore((s) => s.searchPaletteOpen);
  const setOpen = useAtlasStore((s) => s.setSearchPaletteOpen);
  const flaps = useAtlasStore((s) => s.flaps);
  const loadedVessels = useAtlasStore((s) => s.loadedVessels);
  const recentSearches = useAtlasStore((s) => s.recentSearches);
  const addRecentSearch = useAtlasStore((s) => s.addRecentSearch);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const selectVessel = useAtlasStore((s) => s.selectVessel);
  const focusLoadedVessel = useAtlasStore((s) => s.focusLoadedVessel);
  const openTerritoryFromSearch = useAtlasStore((s) => s.openTerritoryFromSearch);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQuery('');
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return {
        flaps: flaps.slice(0, 6),
        territories: [],
        loadedVessels: loadedVessels.slice(0, 4),
        vessels: VESSELS.slice(0, 4),
        glossary: [],
      };
    }
    const matchedFlaps = filterAndSearchFlaps(flaps, { query: q }).slice(0, 8);
    const matchedTerritories = searchTerritoriesAndCodes(q, 8);
    const matchedLoadedVessels = searchLoadedVessels(loadedVessels, q, 12);
    const ql = q.toLowerCase();
    const matchedVessels = VESSELS.filter(
      (v) =>
        v.name.toLowerCase().includes(ql) ||
        v.origin.toLowerCase().includes(ql) ||
        v.branches.some((b) => b.toLowerCase().includes(ql))
    ).slice(0, 5);
    const matchedGlossary = GLOSSARY_TERMS.filter(
      (g) =>
        g.term.toLowerCase().includes(ql) ||
        (g.abbreviation || '').toLowerCase().includes(ql) ||
        g.definition.toLowerCase().includes(ql)
    ).slice(0, 4);

    return {
      flaps: matchedFlaps,
      territories: matchedTerritories,
      loadedVessels: matchedLoadedVessels,
      vessels: matchedVessels,
      glossary: matchedGlossary,
    };
  }, [query, flaps, loadedVessels]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;
  const loadedVesselsSection =
    results.loadedVessels.length > 0 ? (
      <div className="p-2" data-testid="global-search-loaded-vessels">
        <div className="px-2 py-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <span>3D Vessels</span>
          <span className="font-normal normal-case text-xs">Tap to focus in 3D</span>
        </div>
        {results.loadedVessels.map((v) => {
          const sideBadge = formatSideLabel(v.side);
          const linkedFlaps = findFlapsUsingVessel(
            { fjCode: v.fjCode, name: v.name },
            flaps
          );
          const metaParts = [
            v.category,
            linkedFlaps.length > 0
              ? `${linkedFlaps.length} flap${linkedFlaps.length === 1 ? '' : 's'}`
              : null,
          ].filter(Boolean);

          return (
            <button
              key={v.key}
              type="button"
              data-testid={`global-search-vessel-${v.fjCode || v.key}`}
              onClick={() => {
                if (query.trim()) addRecentSearch(query.trim());
                focusLoadedVessel(v, 'anatomy');
                setOpen(false);
              }}
              className="w-full min-h-[44px] text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-subtle)] flex items-center justify-between gap-3 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {v.name}
                  </span>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-mono font-semibold border ${sideBadge.cls}`}
                  >
                    {sideBadge.label}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                  {metaParts.join(' · ')}
                </div>
              </div>
              <Crosshair
                className={`w-3.5 h-3.5 shrink-0 ${
                  v.system === 'arteries'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-sky-600 dark:text-sky-400'
                }`}
              />
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-slate-950/50"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Global FlapAtlas Search"
      data-testid="search-palette"
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Row */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)]">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search flaps, territories (DIEA, LCFA), vessels, muscles..."
            className="flex-1 min-h-[40px] bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            data-testid="global-search-input"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="min-h-[44px] px-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-w-[44px] min-h-[44px] -mr-2 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recent searches */}
        {!query && recentSearches.length > 0 && (
          <div className="px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">Recent:</span>
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setQuery(term)}
                className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
              >
                {term}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {/* Phase 11c: Matching Vascular Territories & Fig. 23.51 Perforator Codes */}
          {hasQuery && results.territories.length > 0 && (
            <div className="p-2" data-testid="global-search-territories">
              <div className="px-2 py-1 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <span>Vascular Territories &amp; Codes ({results.territories.length})</span>
                <span className="font-normal normal-case text-[10px]">
                  Opens Angiosome mode
                </span>
              </div>
              {results.territories.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  data-testid={`global-search-territory-${t.territoryId}`}
                  onClick={() => {
                    if (query.trim()) addRecentSearch(query.trim());
                    openTerritoryFromSearch(t.territoryId);
                    setOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--bg-subtle)] flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {t.title}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                      {t.subtitle}
                    </div>
                  </div>
                  <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* When actively searching, promote matching Loaded 3D Vessels immediately at the top */}
          {hasQuery && loadedVesselsSection}

          {/* Flaps */}
          <div className="p-2">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Reconstructive Flaps ({results.flaps.length})
            </div>
            {results.flaps.length === 0 ? (
              <p className="px-2 py-2 text-xs text-[var(--text-muted)]">No matching flaps.</p>
            ) : (
              results.flaps.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    if (query.trim()) addRecentSearch(query.trim());
                    selectFlap(f.id, true);
                    setActiveTab('library');
                    setOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--bg-subtle)] flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {f.name}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] truncate">
                      {f.region_group} · {f.vascular_anatomy.dominant_pedicle.artery}
                    </div>
                  </div>
                  <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                </button>
              ))
            )}
          </div>

          {/* When query is empty, show preview of Loaded 3D Vessels below Flaps */}
          {!hasQuery && loadedVesselsSection}

          {/* Curated Vessels & Nerves Reference */}
          {results.vessels.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Reference Vessels &amp; Nerves ({results.vessels.length})
              </div>
              {results.vessels.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    if (query.trim()) addRecentSearch(query.trim());
                    selectVessel(v.id, true);
                    setActiveTab('anatomy');
                    setOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--bg-subtle)] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {v.name}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] truncate">
                      {v.category} · Origin: {v.origin}
                    </div>
                  </div>
                  <HeartPulse className="w-3.5 h-3.5 text-[var(--danger-text)] shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Glossary */}
          {results.glossary.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Glossary ({results.glossary.length})
              </div>
              {results.glossary.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setActiveTab('glossary');
                    setOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--bg-subtle)] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {g.term} {g.abbreviation ? `(${g.abbreviation})` : ''}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] truncate">
                      {g.definition}
                    </div>
                  </div>
                  <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
