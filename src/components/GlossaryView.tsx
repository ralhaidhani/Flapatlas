import React, { useMemo, useState } from 'react';
import { BookOpen, Layers, Search } from 'lucide-react';
import { CLASSIFICATIONS, GLOSSARY_TERMS } from '../data/index';
import { useAtlasStore } from '../store/useAtlasStore';

type GlossaryTab = 'terms' | 'classifications';

export const GlossaryView: React.FC = () => {
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);

  const [section, setSection] = useState<GlossaryTab>('terms');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    GLOSSARY_TERMS.forEach((t) => set.add(t.category));
    return Array.from(set);
  }, []);

  const filteredTerms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GLOSSARY_TERMS.filter((t) => {
      if (category !== 'All' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.term.toLowerCase().includes(q) ||
        (t.abbreviation || '').toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.clinicalExample || '').toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  const jumpToFlap = (flapId: string) => {
    selectFlap(flapId, true);
    setActiveTab('library');
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-5 bg-[var(--bg-app)]" data-testid="glossary-view">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="text-xs font-medium text-[var(--accent-primary)] flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Canonical Plastic & Reconstructive Surgery Reference</span>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
            Surgical Glossary & Classical Flap Classifications
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {GLOSSARY_TERMS.length} clinical definitions (also surfaced via inline tooltips in Flap Detail) plus 5 foundational classification systems.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setSection('terms')}
              data-testid="glossary-tab-terms"
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                section === 'terms'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Terms & Abbreviations ({GLOSSARY_TERMS.length})
            </button>
            <button
              type="button"
              onClick={() => setSection('classifications')}
              data-testid="glossary-tab-classifications"
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                section === 'classifications'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Classification Tables (5)
            </button>
          </div>
        </div>
      </div>

      {section === 'terms' && (
        <div className="space-y-4">
          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap border transition-colors ${
                    category === cat
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search glossary terms"
                placeholder="Search angiosome, Gent, LME, Allen..."
                data-testid="glossary-search-input"
                className="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          </div>

          {/* Glossary Cards Grid */}
          {filteredTerms.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] space-y-2">
              <p>No glossary terms match "{query}".</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('All');
                }}
                className="text-[var(--accent-primary)] font-medium hover:underline"
              >
                Reset search & category filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredTerms.map((term) => (
                <article
                  key={term.id}
                  className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5 text-xs flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                        {term.term}
                        {term.abbreviation ? (
                          <span className="font-mono text-xs text-[var(--accent-primary)] ml-1.5">
                            ({term.abbreviation})
                          </span>
                        ) : null}
                      </h2>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">{term.category}</div>
                    <p className="text-[var(--text-secondary)] leading-relaxed pt-0.5">
                      {term.definition}
                    </p>
                  </div>
                  {term.clinicalExample && (
                    <p className="text-[11px] text-[var(--accent-primary)] pt-2 border-t border-[var(--border-subtle)] mt-2">
                      Clinical example: {term.clinicalExample}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'classifications' && (
        <div className="space-y-5" data-testid="classifications-section">
          {/* Row 1: Mathes-Nahai & Cormack-Lamberty */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Mathes & Nahai Muscle Vascular Classification (1981)
                </h2>
                <button
                  type="button"
                  onClick={() => jumpToFlap('ld-flap')}
                  className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Layers className="w-3 h-3" /> LD (Type V)
                </button>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                  <tr>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Vascular Pattern</th>
                    <th className="p-2.5">Classic Examples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {CLASSIFICATIONS.mathes_nahai.map((row) => (
                    <tr key={row.type} className="hover:bg-[var(--bg-subtle)]/40">
                      <td className="p-2.5 font-mono font-semibold text-[var(--accent-primary)] whitespace-nowrap">
                        {row.type}
                      </td>
                      <td className="p-2.5 text-[var(--text-primary)]">{row.pattern}</td>
                      <td className="p-2.5 text-[var(--text-secondary)]">{row.examples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Cormack & Lamberty Fasciocutaneous Classification (1984)
                </h2>
                <button
                  type="button"
                  onClick={() => jumpToFlap('rfff-flap')}
                  className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Layers className="w-3 h-3" /> RFFF (Type C)
                </button>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                  <tr>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Pattern</th>
                    <th className="p-2.5">Examples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {CLASSIFICATIONS.cormack_lamberty.map((row) => (
                    <tr key={row.type} className="hover:bg-[var(--bg-subtle)]/40">
                      <td className="p-2.5 font-mono font-semibold text-[var(--accent-primary)] whitespace-nowrap">
                        {row.type}
                      </td>
                      <td className="p-2.5 text-[var(--text-primary)]">{row.pattern}</td>
                      <td className="p-2.5 text-[var(--text-secondary)]">{row.examples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row 2: Nakajima & Gent Consensus / Hallock */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Nakajima Fasciocutaneous Deep-Fascial Classification (1986)
                </h2>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                  <tr>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Perforator Pathway</th>
                    <th className="p-2.5">Examples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {CLASSIFICATIONS.nakajima.map((row) => (
                    <tr key={row.type} className="hover:bg-[var(--bg-subtle)]/40">
                      <td className="p-2.5 font-mono font-semibold text-[var(--accent-primary)] whitespace-nowrap">
                        {row.type}
                      </td>
                      <td className="p-2.5 text-[var(--text-primary)]">{row.pattern}</td>
                      <td className="p-2.5 text-[var(--text-secondary)]">{row.examples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-5">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-2.5">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Gent Consensus (2002) & Hallock / Tokyo Perforator Nomenclature
                </h2>
                <ul className="space-y-2 text-xs">
                  {CLASSIFICATIONS.gent_consensus.map((g, i) => (
                    <li key={i} className="text-[var(--text-secondary)] leading-relaxed">
                      <span className="font-semibold text-[var(--text-primary)]">{g.rule}: </span>
                      {g.detail}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Reconstructive Ladder & Modern Elevator
                  </h2>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <tr>
                      <th className="p-2.5">Rung</th>
                      <th className="p-2.5">Indication</th>
                      <th className="p-2.5">Examples</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {CLASSIFICATIONS.reconstructive_ladder.map((row) => (
                      <tr key={row.rung} className="hover:bg-[var(--bg-subtle)]/40">
                        <td className="p-2.5 font-semibold text-[var(--accent-primary)] whitespace-nowrap">
                          {row.rung}
                        </td>
                        <td className="p-2.5 text-[var(--text-primary)]">{row.indication}</td>
                        <td className="p-2.5 text-[var(--text-secondary)]">{row.examples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
