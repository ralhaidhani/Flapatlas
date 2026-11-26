import React, { useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { GLOSSARY_TERMS } from '../data/index';
import { useAtlasStore } from '../store/useAtlasStore';
import type { GlossaryTerm } from '../types/schemas';

const TERM_MATCHERS: Array<{ pattern: RegExp; termId: string }> = [
  { pattern: /\b(angiosomes?)\b/i, termId: 'g-angiosome' },
  { pattern: /\b(perforasomes?)\b/i, termId: 'g-perforasome' },
  { pattern: /\b(choke vessels?)\b/i, termId: 'g-choke-vessels' },
  { pattern: /\b(venae comitantes)\b/i, termId: 'g-venae-comitantes' },
  { pattern: /\b(chimeric(?:\s+flaps?)?)\b/i, termId: 'g-chimeric' },
  { pattern: /\b(propeller(?:\s+flaps?)?)\b/i, termId: 'g-propeller' },
  { pattern: /\b(surgical delay)\b/i, termId: 'g-delay' },
  { pattern: /\b(modified allen test|allen test)\b/i, termId: 'g-allen-test' },
  { pattern: /\b(peronea arteria magna)\b/i, termId: 'g-peronea-magna' },
  { pattern: /\b(supercharging|turbocharging)\b/i, termId: 'g-supercharging' },
  { pattern: /\b(zone of injury)\b/i, termId: 'g-zone-of-injury' },
  { pattern: /\b(burow'?s? triangle|standing cone)\b/i, termId: 'g-burow-cone' },
  { pattern: /\b(venous coupler)\b/i, termId: 'g-coupler' },
];

const TERMS_BY_ID = new Map<string, GlossaryTerm>(GLOSSARY_TERMS.map((t) => [t.id, t]));

const COMBINED_REGEX = new RegExp(
  `(${TERM_MATCHERS.map((m) => m.pattern.source).join('|')})`,
  'gi'
);

interface MedicalTermTextProps {
  text: string;
  className?: string;
}

/**
 * Renders clinical prose with inline, keyboard-accessible glossary tooltips
 * for canonical reconstructive surgery terminology.
 */
export const MedicalTermText: React.FC<MedicalTermTextProps> = ({ text, className }) => {
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const segments = useMemo(() => {
    if (!text) return [];
    const parts = text.split(COMBINED_REGEX);
    const seenTermIds = new Set<string>();
    const result: Array<{ kind: 'text'; value: string } | { kind: 'term'; value: string; term: GlossaryTerm; key: string }> = [];

    parts.forEach((part, idx) => {
      if (!part) return;
      const matcher = TERM_MATCHERS.find((m) => {
        const rx = new RegExp(`^${m.pattern.source}$`, 'i');
        return rx.test(part);
      });
      if (matcher) {
        const term = TERMS_BY_ID.get(matcher.termId);
        // Highlight first occurrence of each term per block to keep dense clinical text clean
        if (term && !seenTermIds.has(term.id)) {
          seenTermIds.add(term.id);
          result.push({ kind: 'term', value: part, term, key: `${term.id}-${idx}` });
          return;
        }
      }
      result.push({ kind: 'text', value: part });
    });

    return result;
  }, [text]);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return <React.Fragment key={i}>{seg.value}</React.Fragment>;
        }
        const isOpen = openKey === seg.key;
        return (
          <span
            key={seg.key}
            className="relative inline-block"
            onMouseEnter={() => setOpenKey(seg.key)}
            onMouseLeave={() => setOpenKey((cur) => (cur === seg.key ? null : cur))}
          >
            <button
              type="button"
              onClick={() => setOpenKey((cur) => (cur === seg.key ? null : seg.key))}
              aria-expanded={isOpen}
              data-testid={`glossary-tooltip-trigger-${seg.term.id}`}
              className="inline underline decoration-dotted decoration-[var(--accent-primary)] underline-offset-2 font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] rounded-xs cursor-help"
            >
              {seg.value}
            </button>
            {isOpen && (
              <span
                role="tooltip"
                data-testid={`glossary-tooltip-popover-${seg.term.id}`}
                className="absolute left-0 bottom-full mb-1.5 z-50 w-64 p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-lg text-left text-[11px] leading-relaxed block"
              >
                <span className="font-semibold text-[var(--text-primary)] block">
                  {seg.term.term}
                  {seg.term.abbreviation ? ` (${seg.term.abbreviation})` : ''}
                </span>
                <span className="text-[var(--text-secondary)] block mt-1">
                  {seg.term.definition}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpenKey(null);
                    setActiveTab('glossary');
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  <BookOpen className="w-3 h-3" /> Open Glossary & Tables
                </button>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
};
