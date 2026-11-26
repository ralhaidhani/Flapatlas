import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  Droplets,
  Eye,
  EyeOff,
  Ghost,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  findMatchingLoadedVesselsForText,
  findMuscleReferenceForSelection,
  findRelatedFlapIdsForText,
  MUSCLE_REFERENCE_BY_ID,
  MUSCLE_REFERENCE_FOOTER,
  type MuscleReferenceEntry,
} from '../data/muscleReference';
import type { Laterality } from '../models/anatomyMap';
import { useAtlasStore } from '../store/useAtlasStore';
import { SchematicIconBadge } from './SchematicIconBadge';

type AccordionKey =
  | 'origin'
  | 'insertion'
  | 'action'
  | 'bloodSupply'
  | 'nerveSupply'
  | 'relatedFlaps'
  | 'pearl';

const DEFAULT_OPEN_SECTIONS: Record<AccordionKey, boolean> = {
  origin: true,
  insertion: true,
  action: true,
  bloodSupply: false,
  nerveSupply: false,
  relatedFlaps: false,
  pearl: false,
};

function formatSideLabel(side?: Laterality): string | null {
  if (!side) return null;
  if (side === 'left') return 'Left';
  if (side === 'right') return 'Right';
  return 'Midline';
}

export const MuscleReferenceCard: React.FC = () => {
  const selectedAnatomyInfo = useAtlasStore((s) => s.selectedAnatomyInfo);
  const selectedMuscleRefId = useAtlasStore((s) => s.selectedMuscleRefId);
  const flaps = useAtlasStore((s) => s.flaps);
  const loadedVessels = useAtlasStore((s) => s.loadedVessels);
  const donorSide = useAtlasStore((s) => s.donorSide);
  const visibilityState = useAtlasStore((s) => s.visibilityState);
  const highlightedMuscleVesselKeys = useAtlasStore((s) => s.highlightedMuscleVesselKeys);

  const setSelectedAnatomyInfo = useAtlasStore((s) => s.setSelectedAnatomyInfo);
  const selectMuscleRef = useAtlasStore((s) => s.selectMuscleRef);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const setFlapsSheetMode = useAtlasStore((s) => s.setFlapsSheetMode);
  const setHighlightedMuscleVesselKeys = useAtlasStore((s) => s.setHighlightedMuscleVesselKeys);
  const focusLoadedVessel = useAtlasStore((s) => s.focusLoadedVessel);
  const hideSubMeshes = useAtlasStore((s) => s.hideSubMeshes);
  const isolateSubMeshes = useAtlasStore((s) => s.isolateSubMeshes);
  const setIsolateKeepSkeleton = useAtlasStore((s) => s.setIsolateKeepSkeleton);
  const ghostOthersForSubMeshes = useAtlasStore((s) => s.ghostOthersForSubMeshes);
  const restoreIsolationAndGhost = useAtlasStore((s) => s.restoreIsolationAndGhost);

  const [openSections, setOpenSections] = useState<Record<AccordionKey, boolean>>(
    DEFAULT_OPEN_SECTIONS
  );
  const [hidePartOnly, setHidePartOnly] = useState(false);
  const [vesselNotice, setVesselNotice] = useState<string | null>(null);

  useEffect(() => {
    setHidePartOnly(false);
    setVesselNotice(null);
  }, [selectedAnatomyInfo?.subMeshKey, selectedMuscleRefId]);

  const entry: MuscleReferenceEntry | null = useMemo(() => {
    if (selectedMuscleRefId) {
      return MUSCLE_REFERENCE_BY_ID.get(selectedMuscleRefId) ?? null;
    }
    if (
      selectedAnatomyInfo &&
      (selectedAnatomyInfo.system === 'muscles' || selectedAnatomyInfo.category === 'Muscle')
    ) {
      return findMuscleReferenceForSelection({
        id: selectedAnatomyInfo.id,
        label: selectedAnatomyInfo.label,
        meshName: selectedAnatomyInfo.meshName,
        groupId: selectedAnatomyInfo.groupId,
        groupLabel: selectedAnatomyInfo.groupLabel,
      });
    }
    return null;
  }, [selectedMuscleRefId, selectedAnatomyInfo]);

  const isVisibleCard =
    Boolean(selectedMuscleRefId && entry) ||
    Boolean(
      selectedAnatomyInfo &&
        (selectedAnatomyInfo.system === 'muscles' || selectedAnatomyInfo.category === 'Muscle')
    );

  // Target sub-mesh keys for Hide / Isolate / Ghost actions
  const groupMeshKeys = useMemo(() => {
    if (!selectedAnatomyInfo) return [];
    if (selectedAnatomyInfo.constituentParts && selectedAnatomyInfo.constituentParts.length > 0) {
      return selectedAnatomyInfo.constituentParts
        .map((p) => p.meshKey)
        .filter((k): k is string => Boolean(k));
    }
    if (selectedAnatomyInfo.subMeshKey) return [selectedAnatomyInfo.subMeshKey];
    if (selectedAnatomyInfo.meshName) return [selectedAnatomyInfo.meshName];
    return [selectedAnatomyInfo.id];
  }, [selectedAnatomyInfo]);

  const isMultiPart =
    Boolean(selectedAnatomyInfo?.constituentParts) &&
    (selectedAnatomyInfo?.constituentParts?.length ?? 0) > 1 &&
    Boolean(selectedAnatomyInfo?.subMeshKey);

  const activeSide: Laterality | undefined =
    selectedAnatomyInfo?.laterality ?? (selectedMuscleRefId ? donorSide : undefined);

  const matchedVesselsByChip = useMemo(() => {
    if (!entry) return new Map<string, ReturnType<typeof findMatchingLoadedVesselsForText>>();
    const map = new Map<string, ReturnType<typeof findMatchingLoadedVesselsForText>>();
    const allTexts = [...entry.bloodSupply.dominant, ...entry.bloodSupply.minor];
    for (const txt of allTexts) {
      map.set(txt, findMatchingLoadedVesselsForText(txt, loadedVessels, activeSide));
    }
    return map;
  }, [entry, loadedVessels, activeSide]);

  const allMatchedVesselKeys = useMemo(() => {
    const keys = new Set<string>();
    matchedVesselsByChip.forEach((list) => {
      for (const v of list) keys.add(v.key);
    });
    return Array.from(keys);
  }, [matchedVesselsByChip]);

  if (!isVisibleCard) return null;

  const displayName = entry?.name ?? selectedAnatomyInfo?.label ?? 'Muscle';
  const sideText = formatSideLabel(selectedAnatomyInfo?.laterality);
  const groupText =
    selectedAnatomyInfo?.groupLabel ||
    (selectedAnatomyInfo?.groupId
      ? selectedAnatomyInfo.groupId.replace(/^group:/, '').replace(/_/g, ' ')
      : null);
  const isSchematic = entry ? !entry.inBodyParts3D : Boolean(selectedAnatomyInfo?.isSchematic);
  const hasRealMeshSelection = groupMeshKeys.length > 0 && !isSchematic;

  const isCurrentlyIsolated =
    hasRealMeshSelection &&
    visibilityState.isolatedMeshKeys.length > 0 &&
    groupMeshKeys.some((k) => visibilityState.isolatedMeshKeys.includes(k));
  const isCurrentlyGhosted =
    hasRealMeshSelection &&
    visibilityState.ghostOthersKeys.length > 0 &&
    groupMeshKeys.some((k) => visibilityState.ghostOthersKeys.includes(k));
  const vesselsHighlighted =
    allMatchedVesselKeys.length > 0 &&
    allMatchedVesselKeys.some((k) => highlightedMuscleVesselKeys.includes(k));

  const toggleSection = (key: AccordionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClose = () => {
    setSelectedAnatomyInfo(null);
    selectMuscleRef(null);
  };

  const handleHide = () => {
    if (!selectedAnatomyInfo || !hasRealMeshSelection) return;
    if (hidePartOnly && isMultiPart && selectedAnatomyInfo.subMeshKey) {
      const partRec = selectedAnatomyInfo.constituentParts?.find(
        (p) => p.meshKey === selectedAnatomyInfo.subMeshKey
      );
      hideSubMeshes({
        id: selectedAnatomyInfo.subMeshKey,
        label: partRec?.label || displayName,
        side: selectedAnatomyInfo.laterality || 'midline',
        system: 'muscles',
        meshKeys: [selectedAnatomyInfo.subMeshKey],
        partOnly: true,
      });
      return;
    }
    const groupKey = selectedAnatomyInfo.groupId
      ? `${selectedAnatomyInfo.groupId}:${selectedAnatomyInfo.laterality || 'midline'}`
      : groupMeshKeys[0];
    hideSubMeshes({
      id: groupKey,
      label: displayName,
      side: selectedAnatomyInfo.laterality || 'midline',
      system: 'muscles',
      meshKeys: groupMeshKeys,
      partOnly: false,
    });
  };

  const handleIsolate = () => {
    if (!hasRealMeshSelection) return;
    if (isCurrentlyIsolated) {
      restoreIsolationAndGhost();
    } else {
      isolateSubMeshes(groupMeshKeys, displayName, visibilityState.isolateKeepSkeleton);
    }
  };

  const handleGhostOthers = () => {
    if (!hasRealMeshSelection) return;
    if (isCurrentlyGhosted) {
      restoreIsolationAndGhost();
    } else {
      ghostOthersForSubMeshes(groupMeshKeys, displayName);
    }
  };

  const handleShowVessels = () => {
    if (allMatchedVesselKeys.length === 0) {
      setVesselNotice('Supplying vessels not yet loaded in 3D model');
      window.setTimeout(() => setVesselNotice(null), 2600);
      return;
    }
    if (vesselsHighlighted) {
      setHighlightedMuscleVesselKeys([]);
    } else {
      setHighlightedMuscleVesselKeys(allMatchedVesselKeys);
      setVesselNotice(
        `Highlighting ${allMatchedVesselKeys.length} supplying vessel${
          allMatchedVesselKeys.length === 1 ? '' : 's'
        } in 3D`
      );
      window.setTimeout(() => setVesselNotice(null), 2600);
    }
  };

  const handleVesselChipTap = (vesselText: string) => {
    const matches = matchedVesselsByChip.get(vesselText) ?? [];
    if (matches.length === 0) return;
    const keys = matches.map((m) => m.key);
    setHighlightedMuscleVesselKeys(keys);
    // Also frame the first matched vessel subtly without dismissing muscle context unless desired
    const first = matches[0];
    if (first && (!selectedAnatomyInfo || isSchematic)) {
      focusLoadedVessel(first);
    }
  };

  const handleOpenRelatedFlap = (flapId: string) => {
    selectMuscleRef(null);
    setSelectedAnatomyInfo(null);
    selectFlap(flapId, true);
    setFlapsSheetMode('detail');
    setActiveTab('library', 'half');
  };

  const renderAccordion = (
    key: AccordionKey,
    title: string,
    content: React.ReactNode,
    badge?: string
  ) => {
    const isOpen = openSections[key];
    return (
      <div
        key={key}
        className="border-t border-[var(--border-subtle)] first:border-t-0"
        data-testid={`muscle-accordion-${key}`}
      >
        <button
          type="button"
          onClick={() => toggleSection(key)}
          aria-expanded={isOpen}
          className="w-full min-h-[44px] py-2 flex items-center justify-between gap-2 text-left text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            )}
            <span className="truncate">{title}</span>
          </span>
          {badge && (
            <span className="text-xs font-mono text-[var(--text-muted)] shrink-0">{badge}</span>
          )}
        </button>
        {isOpen && (
          <div className="pb-3 pl-6 text-sm text-[var(--text-secondary)] leading-relaxed">
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      aria-label={`Muscle reference: ${displayName}`}
      data-testid="muscle-reference-card"
      className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3.5 space-y-3 text-sm"
    >
      {/* Header: Clean Standard Name, Side, Mathes-Nahai & Schematic Badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {sideText && (
              <span
                data-testid="muscle-ref-side"
                className="px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]"
              >
                {sideText}
              </span>
            )}
            {entry?.region && (
              <span className="text-xs text-[var(--text-muted)]">{entry.region}</span>
            )}
            {entry?.bloodSupply.mathesNahai && (
              <span
                data-testid="muscle-ref-mathes-nahai"
                className="px-2 py-0.5 rounded-md bg-[var(--accent-soft)] border border-[var(--accent-primary)]/40 text-xs font-semibold text-[var(--accent-primary)]"
              >
                Mathes–Nahai {entry.bloodSupply.mathesNahai}
              </span>
            )}
            {isSchematic && <SchematicIconBadge compact />}
          </div>

          <h3
            data-testid="muscle-ref-title"
            className="text-base font-semibold text-[var(--text-primary)] leading-snug"
          >
            {displayName}
          </h3>
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Close muscle reference"
          data-testid="muscle-ref-close-btn"
          className="min-w-[44px] min-h-[44px] -mt-1.5 -mr-1.5 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons: Hide · Isolate · Show vessels · Ghost others (+ Restore) */}
      <div className="space-y-2" data-testid="muscle-ref-actions">
        <div className="flex flex-wrap items-center gap-1.5">
          {hasRealMeshSelection && (
            <>
              <button
                type="button"
                onClick={handleHide}
                data-testid="muscle-action-hide"
                className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5"
              >
                <EyeOff className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                <span>Hide</span>
              </button>

              <button
                type="button"
                onClick={handleIsolate}
                aria-pressed={isCurrentlyIsolated}
                data-testid="muscle-action-isolate"
                className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                  isCurrentlyIsolated
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                }`}
              >
                <Crosshair className="w-4 h-4 shrink-0" />
                <span>{isCurrentlyIsolated ? 'Isolated' : 'Isolate'}</span>
              </button>

              <button
                type="button"
                onClick={handleGhostOthers}
                aria-pressed={isCurrentlyGhosted}
                data-testid="muscle-action-ghost"
                className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                  isCurrentlyGhosted
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                }`}
              >
                <Ghost className="w-4 h-4 shrink-0" />
                <span>Ghost others</span>
              </button>
            </>
          )}

          {entry && (
            <button
              type="button"
              onClick={handleShowVessels}
              aria-pressed={vesselsHighlighted}
              data-testid="muscle-action-show-vessels"
              className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                vesselsHighlighted
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-rose-500'
              }`}
            >
              <Droplets className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{vesselsHighlighted ? 'Vessels On' : 'Show vessels'}</span>
            </button>
          )}

          {(isCurrentlyIsolated || isCurrentlyGhosted) && (
            <button
              type="button"
              onClick={restoreIsolationAndGhost}
              data-testid="muscle-action-restore"
              className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--accent-primary)] inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Restore</span>
            </button>
          )}
        </div>

        {/* Multi-part "this part only" toggle + Isolate "keep faint skeleton" toggle */}
        {(isMultiPart || isCurrentlyIsolated) && (
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-[var(--text-secondary)]">
            {isMultiPart && (
              <label className="inline-flex items-center gap-2 min-h-[36px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={hidePartOnly}
                  onChange={(e) => setHidePartOnly(e.target.checked)}
                  data-testid="muscle-hide-part-only-toggle"
                  className="w-4 h-4 accent-[var(--accent-primary)]"
                />
                <span>Hide this part only</span>
              </label>
            )}
            {isCurrentlyIsolated && (
              <label className="inline-flex items-center gap-2 min-h-[36px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibilityState.isolateKeepSkeleton}
                  onChange={(e) => setIsolateKeepSkeleton(e.target.checked)}
                  data-testid="muscle-isolate-keep-skeleton-toggle"
                  className="w-4 h-4 accent-[var(--accent-primary)]"
                />
                <span>Keep faint skeleton</span>
              </label>
            )}
          </div>
        )}

        {vesselNotice && (
          <div className="text-xs font-medium text-[var(--accent-primary)]" role="status">
            {vesselNotice}
          </div>
        )}
      </div>

      {/* Unmapped Muscle Fallback */}
      {!entry ? (
        <div
          data-testid="muscle-ref-unmapped-fallback"
          className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 space-y-1.5 text-sm"
        >
          {groupText && (
            <div className="text-xs text-[var(--text-muted)]">
              Group: <span className="text-[var(--text-primary)] font-medium">{groupText}</span>
            </div>
          )}
          <p className="text-[var(--text-secondary)]">Reference details not added yet</p>
        </div>
      ) : (
        <>
          {/* Compact Accordions (first 3 open: Origin, Insertion, Action) */}
          <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3">
            {renderAccordion('origin', 'Origin', <p>{entry.origin}</p>)}
            {renderAccordion('insertion', 'Insertion', <p>{entry.insertion}</p>)}
            {renderAccordion('action', 'Action', <p>{entry.action}</p>)}

            {renderAccordion(
              'bloodSupply',
              'Blood supply',
              <div className="space-y-2.5">
                {entry.bloodSupply.dominant.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Dominant
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.bloodSupply.dominant.map((vesselTxt) => {
                        const matches = matchedVesselsByChip.get(vesselTxt) ?? [];
                        const in3D = matches.length > 0;
                        const active =
                          in3D &&
                          matches.some((m) => highlightedMuscleVesselKeys.includes(m.key));
                        return in3D ? (
                          <button
                            key={vesselTxt}
                            type="button"
                            onClick={() => handleVesselChipTap(vesselTxt)}
                            data-testid="muscle-vessel-chip-3d"
                            className={`min-h-[38px] px-2.5 py-1 rounded-lg border text-xs font-medium text-left inline-flex items-center gap-1.5 transition-colors ${
                              active
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-rose-500/45 hover:border-rose-500'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                            <span>{vesselTxt}</span>
                          </button>
                        ) : (
                          <span
                            key={vesselTxt}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]"
                          >
                            {vesselTxt}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {entry.bloodSupply.minor.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Minor
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.bloodSupply.minor.map((vesselTxt) => {
                        const matches = matchedVesselsByChip.get(vesselTxt) ?? [];
                        const in3D = matches.length > 0;
                        const active =
                          in3D &&
                          matches.some((m) => highlightedMuscleVesselKeys.includes(m.key));
                        return in3D ? (
                          <button
                            key={vesselTxt}
                            type="button"
                            onClick={() => handleVesselChipTap(vesselTxt)}
                            data-testid="muscle-vessel-chip-3d"
                            className={`min-h-[38px] px-2.5 py-1 rounded-lg border text-xs font-medium text-left inline-flex items-center gap-1.5 transition-colors ${
                              active
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-rose-500/45 hover:border-rose-500'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                            <span>{vesselTxt}</span>
                          </button>
                        ) : (
                          <span
                            key={vesselTxt}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]"
                          >
                            {vesselTxt}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>,
              entry.bloodSupply.mathesNahai ? `Type ${entry.bloodSupply.mathesNahai}` : undefined
            )}

            {renderAccordion('nerveSupply', 'Nerve supply', <p>{entry.nerveSupply}</p>)}

            {entry.relatedFlaps.length > 0 &&
              renderAccordion(
                'relatedFlaps',
                'Related flaps',
                <div className="flex flex-wrap gap-1.5">
                  {entry.relatedFlaps.map((flapTxt) => {
                    const matchedIds = findRelatedFlapIdsForText(flapTxt, flaps);
                    const primaryFlapId = matchedIds[0];
                    return primaryFlapId ? (
                      <button
                        key={flapTxt}
                        type="button"
                        onClick={() => handleOpenRelatedFlap(primaryFlapId)}
                        data-testid={`muscle-related-flap-chip-${primaryFlapId}`}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-primary)]/40 hover:border-[var(--accent-primary)] text-xs font-medium text-[var(--accent-primary)] text-left transition-colors"
                      >
                        {flapTxt}
                      </button>
                    ) : (
                      <span
                        key={flapTxt}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]"
                      >
                        {flapTxt}
                      </span>
                    );
                  })}
                </div>,
                String(entry.relatedFlaps.length)
              )}

            {entry.pearl.trim().length > 0 &&
              renderAccordion(
                'pearl',
                'Pearl',
                <p className="flex items-start gap-1.5">
                  <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                  <span>{entry.pearl}</span>
                </p>
              )}
          </div>

          {/* Required Reference Disclaimer Footer */}
          <p
            data-testid="muscle-ref-footer"
            className="text-xs text-[var(--text-muted)] leading-snug pt-0.5"
          >
            {MUSCLE_REFERENCE_FOOTER}
          </p>
        </>
      )}
    </section>
  );
};
