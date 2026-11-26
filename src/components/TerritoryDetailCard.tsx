import React, { useMemo } from 'react';
import { Crosshair, Layers, Network, X } from 'lucide-react';
import type { TerritoryFieldData } from '../models/territoryFieldCore';
import {
  CORRIDOR_SCHEMATIC_TAG,
  getCorridorSpecForTerritory,
} from '../models/perforatorCorridors';
import {
  getTerritoryDetailModel,
  type TerritorySideFilter,
} from '../models/territorySearch';
import { useAtlasStore } from '../store/useAtlasStore';
import { SchematicIconBadge } from './SchematicIconBadge';

interface TerritoryDetailCardProps {
  embedded?: boolean;
  field: TerritoryFieldData | null;
  onShowSourceArtery: (territoryId: string) => void;
  onFocusTerritoryRegion: (territoryId: string) => void;
}

export const TerritoryDetailCard: React.FC<TerritoryDetailCardProps> = ({
  embedded = false,
  field,
  onShowSourceArtery,
  onFocusTerritoryRegion,
}) => {
  const territoryMode = useAtlasStore((s) => s.territoryMode);
  const territorySheetOpen = useAtlasStore((s) => s.territorySheetOpen);
  const plannerDropMode = useAtlasStore((s) => s.plannerDropMode);
  const focusedTerritoryId = useAtlasStore((s) => s.focusedTerritoryId);
  const focusedTerritorySide = useAtlasStore((s) => s.focusedTerritorySide);
  const showTerritoryNeighbors = useAtlasStore((s) => s.showTerritoryNeighbors);
  const isolateTerritoryArtery = useAtlasStore((s) => s.isolateTerritoryArtery);
  const colorblindMode = useAtlasStore((s) => s.colorblindMode);
  const flaps = useAtlasStore((s) => s.flaps);

  const focusTerritory = useAtlasStore((s) => s.focusTerritory);
  const setShowTerritoryNeighbors = useAtlasStore((s) => s.setShowTerritoryNeighbors);
  const setIsolateTerritoryArtery = useAtlasStore((s) => s.setIsolateTerritoryArtery);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);

  const detail = useMemo(() => {
    if (!focusedTerritoryId) return null;
    return getTerritoryDetailModel(focusedTerritoryId, field, flaps);
  }, [focusedTerritoryId, field, flaps]);

  const corridorSpec = useMemo(
    () => (detail ? getCorridorSpecForTerritory(detail.territoryId) : null),
    [detail]
  );

  if (territoryMode === 'off' || (!embedded && territorySheetOpen) || plannerDropMode || !detail) {
    return null;
  }

  const swatch = colorblindMode ? detail.hexColorblind : detail.hexStandard;
  const hasRealArteryMesh = detail.bp3dArteries.length > 0;
  const sideLabel = (s: TerritorySideFilter) =>
    s === 'left' ? 'Left' : s === 'right' ? 'Right' : 'Bilateral';

  return (
    <aside
      aria-label={`Territory details: ${detail.name}`}
      data-testid="territory-detail-card"
      className={
        embedded
          ? 'w-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-hidden flex flex-col'
          : 'pointer-events-auto fixed inset-x-2 bottom-2 z-50 max-h-[62dvh] sm:static sm:inset-auto sm:z-auto sm:w-[310px] sm:max-h-[58vh] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-xl sm:shadow-lg overflow-hidden flex flex-col'
      }
    >
      {/* Card Header */}
      <div className="px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0 flex items-start gap-2">
          <span
            className="w-3.5 h-3.5 rounded-xs shrink-0 mt-0.5 border border-black/15"
            style={{
              backgroundColor: swatch,
              backgroundImage: detail.isSchematic
                ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.45) 2px, rgba(255,255,255,0.45) 4px)'
                : undefined,
            }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-[var(--text-primary)] leading-snug">
              <span className="font-mono tabular-nums mr-1">{detail.displayNumber}.</span>
              {detail.name}
              {detail.abbr ? ` (${detail.abbr})` : ''}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <span>{sideLabel(focusedTerritorySide)}</span>
              {detail.isSchematic && <SchematicIconBadge compact />}
              {detail.headNeckNumber && !detail.displayNumber.startsWith('HN-') && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Fig. 23.37 #{detail.headNeckNumber}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => focusTerritory(null)}
          data-testid="territory-detail-close-btn"
          aria-label="Clear focused territory"
          className="min-w-[44px] min-h-[44px] -mr-1.5 -mt-1.5 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Clinical Body */}
      <div className="px-3 py-2.5 space-y-3 overflow-y-auto text-sm">
        <p className="text-xs text-[var(--text-muted)] leading-snug">
          Computed approximation — individual anatomy varies; confirm with Doppler / CTA.
        </p>

        {/* Action Row: Show Source Artery + Show Neighbours */}
        <div className="flex flex-wrap items-center gap-1.5">
          {hasRealArteryMesh ? (
            <button
              type="button"
              onClick={() => {
                if (isolateTerritoryArtery) {
                  setIsolateTerritoryArtery(false);
                } else {
                  onShowSourceArtery(detail.territoryId);
                }
              }}
              data-testid="territory-show-source-artery-btn"
              aria-pressed={isolateTerritoryArtery}
              className={`min-h-[36px] sm:min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                isolateTerritoryArtery
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] hover:opacity-95'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{isolateTerritoryArtery ? 'Showing Source Artery' : 'Show source artery'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onFocusTerritoryRegion(detail.territoryId)}
              data-testid="territory-focus-region-btn"
              className="min-h-[36px] sm:min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium border bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center gap-1.5 whitespace-nowrap"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Frame Schematic Zone</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTerritoryNeighbors(!showTerritoryNeighbors)}
            data-testid="territory-show-neighbors-btn"
            aria-pressed={showTerritoryNeighbors}
            className={`min-h-[36px] sm:min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              showTerritoryNeighbors
                ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Show neighbours ({detail.neighbors.length})</span>
          </button>
        </div>

        {/* Perforator Emergence Corridor context when in Perforator Corridors mode */}
        {territoryMode === 'perforators' && (
          <div
            data-testid="territory-card-corridor-info"
            className="space-y-1.5 border-t border-[var(--border-subtle)] pt-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                Perforator emergence corridor
              </div>
              <SchematicIconBadge compact />
            </div>
            {corridorSpec ? (
              <>
                <p className="text-xs text-[var(--text-secondary)] leading-snug">
                  <span className="font-medium text-[var(--text-primary)]">
                    {corridorSpec.emphasisLabel}.
                  </span>{' '}
                  {corridorSpec.septalLineNote ||
                    'Projected from the source artery centreline onto the nearest skin surface.'}
                </p>
                {corridorSpec.perforasomeCodes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-xs text-[var(--text-muted)] mr-0.5">Fig. 23.51:</span>
                    {corridorSpec.perforasomeCodes.map((code) => (
                      <span
                        key={code}
                        className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-xs font-medium text-[var(--text-primary)]"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-[var(--text-muted)] leading-snug">
                No emergence corridor overlay for this territory.
              </p>
            )}
          </div>
        )}

        {/* Source Artery */}
        <div className="space-y-1 border-t border-[var(--border-subtle)] pt-2">
          <div className="text-xs font-semibold text-[var(--text-primary)]">Source artery</div>
          {detail.bp3dArteries.length > 0 ? (
            <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
              {detail.bp3dArteries.map((art) => (
                <li key={art.name} className="leading-snug">
                  <span className="font-medium text-[var(--text-primary)] capitalize">
                    {art.name}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] leading-snug">
              <SchematicIconBadge compact />
              {detail.schematicHint && <span>{detail.schematicHint}</span>}
            </div>
          )}
          {detail.note && (
            <p className="text-xs text-[var(--text-muted)] leading-snug">{detail.note}</p>
          )}
        </div>

        {/* Tissues Spanned */}
        <div className="space-y-0.5 border-t border-[var(--border-subtle)] pt-2">
          <div className="text-[11px] font-semibold text-[var(--text-primary)]">
            Tissues spanned
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            {detail.tissuesSpanned.join(' · ')}
          </p>
        </div>

        {/* Muscles in Territory (§2.3 / §2.2) */}
        {detail.muscles.length > 0 && (
          <div className="space-y-1 border-t border-[var(--border-subtle)] pt-2">
            <div className="text-[11px] font-semibold text-[var(--text-primary)]">
              Muscles in territory ({detail.muscles.length})
            </div>
            <ul className="space-y-1 text-[11px]">
              {detail.muscles.slice(0, 8).map((m) => (
                <li
                  key={m.id}
                  className="flex items-baseline justify-between gap-2 text-[var(--text-secondary)]"
                >
                  <span className="font-medium text-[var(--text-primary)] truncate">{m.name}</span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap shrink-0">
                    {m.territoryCountLabel}
                    {m.neurovascularType ? ` · ${m.neurovascularType}` : ''}
                    {!m.presentInBp3d ? ' · Schematic' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Computed Neighbours + Printed Choke / True Anastomosis Statement */}
        <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-2">
          <div className="text-[11px] font-semibold text-[var(--text-primary)]">
            Adjacent territories (computed)
          </div>
          {detail.neighbors.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {detail.neighbors.map((n) => (
                <button
                  key={n.territoryId}
                  type="button"
                  onClick={() => focusTerritory(n.territoryId, focusedTerritorySide, true)}
                  className="min-h-[28px] px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[11px] text-[var(--text-primary)] flex items-center gap-1.5 max-w-full"
                >
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{
                      backgroundColor: colorblindMode ? n.hexColorblind : n.hexStandard,
                    }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{n.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)]">
              No adjacent voxels detected in current field.
            </p>
          )}
          <p className="text-[10px] leading-snug text-[var(--text-muted)]">
            {detail.neighborClinicalNote}
          </p>
        </div>

        {/* Flaps Based on This Territory */}
        {detail.linkedFlaps.length > 0 && (
          <div className="space-y-1 border-t border-[var(--border-subtle)] pt-2">
            <div className="text-[11px] font-semibold text-[var(--text-primary)]">
              Flaps based on this territory ({detail.linkedFlaps.length})
            </div>
            <div className="space-y-1">
              {detail.linkedFlaps.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    selectFlap(f.id, false);
                    setActiveTab('library');
                  }}
                  data-testid={`territory-linked-flap-${f.id}`}
                  className="w-full min-h-[32px] px-2 py-1 rounded-md bg-[var(--bg-subtle)] hover:bg-[var(--accent-soft)] text-left flex items-center justify-between gap-2 transition-colors"
                >
                  <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                    {f.name}
                  </span>
                  <Layers className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Paraphrased Clinical Notes (if any) */}
        {detail.clinicalNotes.length > 0 && (
          <div className="space-y-1 border-t border-[var(--border-subtle)] pt-2">
            <div className="text-[11px] font-semibold text-[var(--text-primary)]">
              Clinical notes
            </div>
            {detail.clinicalNotes.slice(0, 2).map((n) => (
              <p key={n.id} className="text-[10px] leading-snug text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-primary)]">{n.title}:</span>{' '}
                {n.summary} (Ch. 23, p. {n.page})
              </p>
            ))}
          </div>
        )}

        {/* Citation Footer */}
        <div className="border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-muted)]">
          Source: Morris &amp; Taylor, Neligan Vol. 1, Ch. {detail.sourceRef.chapter}, p.{' '}
          {detail.sourceRef.page} ({detail.sourceRef.figureOrTable})
        </div>
      </div>
    </aside>
  );
};
