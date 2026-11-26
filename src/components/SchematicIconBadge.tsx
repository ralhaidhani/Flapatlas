import React, { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';

interface SchematicIconBadgeProps {
  className?: string;
  compact?: boolean;
}

/**
 * Tiny dashed-outline "Schematic" icon whose tap shows one short sentence:
 * "Illustrative, not from the source model".
 */
export const SchematicIconBadge: React.FC<SchematicIconBadgeProps> = ({
  className = '',
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  return (
    <span ref={rootRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        data-testid="schematic-icon-badge"
        aria-expanded={open}
        aria-label="Schematic representation info"
        title="Illustrative, not from the source model"
        className={`inline-flex items-center gap-1 rounded border border-dashed border-amber-500/70 text-amber-400 hover:border-amber-400 hover:bg-amber-500/10 transition-colors select-none ${
          compact ? 'px-1.5 py-0.5 text-[11px] min-h-[28px]' : 'px-2 py-0.5 text-xs min-h-[30px]'
        }`}
      >
        <Layers className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>Schematic</span>
      </button>

      {open && (
        <span
          role="status"
          data-testid="schematic-icon-popover"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-2 text-xs text-[var(--text-primary)] shadow-xl leading-snug"
        >
          Illustrative, not from the source model
        </span>
      )}
    </span>
  );
};
