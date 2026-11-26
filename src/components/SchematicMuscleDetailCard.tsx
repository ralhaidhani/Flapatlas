import React, { useMemo } from 'react';
import { Crosshair, Layers, X } from 'lucide-react';
import { DEFAULT_ANCHORS } from '../models/anchorSystem';
import { resolveMuscleDeepTissueInfo } from '../models/deepTissueTerritories';
import { useAtlasStore } from '../store/useAtlasStore';
import { SchematicIconBadge } from './SchematicIconBadge';

interface SchematicMuscleDetailCardProps {
  embedded?: boolean;
  onFrameSchematicMuscle: (outlineId: string) => void;
}

export const SchematicMuscleDetailCard: React.FC<SchematicMuscleDetailCardProps> = ({
  embedded = false,
  onFrameSchematicMuscle,
}) => {
  const territoryMode = useAtlasStore((s) => s.territoryMode);
  const selectedSchematicMuscleId = useAtlasStore((s) => s.selectedSchematicMuscleId);
  const territoryCalibrationReport = useAtlasStore((s) => s.territoryCalibrationReport);
  const colorblindMode = useAtlasStore((s) => s.colorblindMode);
  const territorySideFilter = useAtlasStore((s) => s.territorySideFilter);

  const setSelectedSchematicMuscleId = useAtlasStore((s) => s.setSelectedSchematicMuscleId);
  const setTerritorySheetOpen = useAtlasStore((s) => s.setTerritorySheetOpen);
  const focusTerritory = useAtlasStore((s) => s.focusTerritory);

  const entry = useMemo(() => {
    if (!selectedSchematicMuscleId) return null;
    return resolveMuscleDeepTissueInfo(selectedSchematicMuscleId, territoryCalibrationReport);
  }, [selectedSchematicMuscleId, territoryCalibrationReport]);

  if (territoryMode === 'off' || !entry || !entry.schematicOutlineId) return null;

  const anchorLabels = entry.anchorLandmarkIds.map((id) => {
    const found = DEFAULT_ANCHORS.find((a) => a.id === id);
    return found ? found.name : id.replace(/_/g, ' ');
  });

  return (
    <aside
      aria-label={`Schematic muscle details: ${entry.name}`}
      data-testid="schematic-muscle-detail-card"
      className={
        embedded
          ? 'w-full bg-[var(--bg-subtle)] border border-amber-500/45 rounded-xl overflow-hidden flex flex-col'
          : 'pointer-events-auto fixed inset-x-2 bottom-2 z-50 max-h-[62dvh] sm:static sm:inset-auto sm:z-auto sm:w-[310px] sm:max-h-[58vh] bg-[var(--bg-surface)] border border-amber-500/60 rounded-xl shadow-xl sm:shadow-lg overflow-hidden flex flex-col'
      }
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0 space-y-1">
          <SchematicIconBadge compact />
          <h3
            data-testid="schematic-muscle-name"
            className="text-sm font-semibold text-[var(--text-primary)] leading-snug"
          >
            {entry.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setSelectedSchematicMuscleId(null)}
          data-testid="schematic-muscle-close-btn"
          aria-label="Close schematic muscle card"
          className="min-w-[32px] min-h-[32px] rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-2.5 overflow-y-auto text-xs">
        {/* Book Table Badges (never derived from schematic geometry) */}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Neligan Ch. 23 Table Badges
          </div>
          <div className="flex flex-wrap gap-1.5">
            {entry.territoryCountBadge && (
              <span
                data-testid="schematic-muscle-count-badge"
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30"
              >
                {entry.territoryCountBadge}
              </span>
            )}
            {entry.neurovascularType && (
              <span
                data-testid="schematic-muscle-nv-badge"
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
              >
                NV {entry.neurovascularType}
              </span>
            )}
            {entry.venousType && (
              <span
                data-testid="schematic-muscle-venous-badge"
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-500/12 text-sky-700 dark:text-sky-300 border border-sky-500/30"
              >
                Venous {entry.venousType}
              </span>
            )}
            {!entry.territoryCountBadge && !entry.neurovascularType && !entry.venousType && (
              <span className="text-[11px] text-[var(--text-muted)]">
                Not individually tabulated in Tables 23.1–23.3
              </span>
            )}
          </div>
          {entry.neurovascularLabel && (
            <p className="text-[11px] text-[var(--text-secondary)] leading-snug pt-0.5">
              <span className="font-medium text-[var(--text-primary)]">
                {entry.neurovascularLabel}:
              </span>{' '}
              {entry.neurovascularMeaning}
            </p>
          )}
          {entry.venousSummary && (
            <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
              <span className="font-medium text-[var(--text-primary)]">{entry.venousLabel}:</span>{' '}
              {entry.venousSummary}
            </p>
          )}
        </div>

        {/* Frame & Deep Tissue list actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onFrameSchematicMuscle(entry.schematicOutlineId!)}
            data-testid="schematic-muscle-frame-btn"
            className="min-h-[36px] sm:min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium border bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center gap-1.5"
          >
            <Crosshair className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Frame Outline</span>
          </button>
          <button
            type="button"
            onClick={() => setTerritorySheetOpen(true)}
            data-testid="schematic-muscle-back-btn"
            className="min-h-[36px] sm:min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium border bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Deep Tissue</span>
          </button>
        </div>

        {/* Bony Landmark Anchors */}
        {anchorLabels.length > 0 && (
          <div className="space-y-0.5 border-t border-[var(--border-subtle)] pt-2">
            <div className="text-[11px] font-semibold text-[var(--text-primary)]">
              Bony-landmark anchors
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
              {anchorLabels.join(' · ')}
            </p>
          </div>
        )}

        {/* Supplying Angiosomes */}
        {entry.supplyingAngiosomes.length > 0 && (
          <div className="space-y-1 border-t border-[var(--border-subtle)] pt-2">
            <div className="text-[11px] font-semibold text-[var(--text-primary)]">
              Associated vascular territories
            </div>
            <div className="flex flex-wrap gap-1">
              {entry.supplyingAngiosomes.map((chip) => (
                <button
                  key={chip.territoryId}
                  type="button"
                  onClick={() => focusTerritory(chip.territoryId, territorySideFilter, true)}
                  className="min-h-[28px] px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[11px] text-[var(--text-primary)] flex items-center gap-1.5"
                >
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{
                      backgroundColor: colorblindMode ? chip.hexColorblind : chip.hexStandard,
                    }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {entry.clinicalNote && (
          <p className="text-[11px] text-[var(--text-secondary)] leading-snug border-t border-[var(--border-subtle)] pt-2">
            {entry.clinicalNote}
          </p>
        )}

        <div className="border-t border-[var(--border-subtle)] pt-2 text-xs text-[var(--text-muted)]">
          Source: Morris &amp; Taylor, Neligan Vol. 1, Ch. {entry.sourceRef.chapter}, p.{' '}
          {entry.sourceRef.page} ({entry.sourceRef.figureOrTable})
        </div>
      </div>
    </aside>
  );
};
