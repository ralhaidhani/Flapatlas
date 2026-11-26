import React, { useMemo, useState } from 'react';
import { ArrowRight, Crosshair, EyeOff, Ghost, RotateCcw, X } from 'lucide-react';
import { VESSELS } from '../data/index';
import { resolveAnatomyDetailCard } from '../engine/flapMetrics';
import { computeStructureFocusCamera } from '../models/clippingAndSearch';
import { findFlapsUsingVessel } from '../models/vesselSearch';
import { useAtlasStore } from '../store/useAtlasStore';
import { MuscleReferenceCard } from './MuscleReferenceCard';
import { SchematicIconBadge } from './SchematicIconBadge';

/**
 * Clean normal-mode selected 3D structure detail card rendered inside the unified BottomSheet.
 * Delegates muscles to MuscleReferenceCard and provides Hide / Isolate / Ghost / Restore
 * for vessels, nerves, and bones.
 */
export const SelectedStructureCard: React.FC = () => {
  const selectedAnatomyInfo = useAtlasStore((s) => s.selectedAnatomyInfo);
  const selectedMuscleRefId = useAtlasStore((s) => s.selectedMuscleRefId);
  const flaps = useAtlasStore((s) => s.flaps);
  const unitSystem = useAtlasStore((s) => s.unitSystem);
  const visibilityState = useAtlasStore((s) => s.visibilityState);

  const setSelectedAnatomyInfo = useAtlasStore((s) => s.setSelectedAnatomyInfo);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const setDonorSide = useAtlasStore((s) => s.setDonorSide);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const flyToCameraGoal = useAtlasStore((s) => s.flyToCameraGoal);
  const hideSubMeshes = useAtlasStore((s) => s.hideSubMeshes);
  const isolateSubMeshes = useAtlasStore((s) => s.isolateSubMeshes);
  const setIsolateKeepSkeleton = useAtlasStore((s) => s.setIsolateKeepSkeleton);
  const ghostOthersForSubMeshes = useAtlasStore((s) => s.ghostOthersForSubMeshes);
  const restoreIsolationAndGhost = useAtlasStore((s) => s.restoreIsolationAndGhost);

  const [hidePartOnly, setHidePartOnly] = useState(false);

  const isMuscleSelection =
    Boolean(selectedMuscleRefId) ||
    Boolean(
      selectedAnatomyInfo &&
        (selectedAnatomyInfo.system === 'muscles' || selectedAnatomyInfo.category === 'Muscle')
    );

  const clinicalCard = useMemo(() => {
    if (!selectedAnatomyInfo || isMuscleSelection) return null;
    return resolveAnatomyDetailCard(
      selectedAnatomyInfo.id,
      selectedAnatomyInfo.label,
      selectedAnatomyInfo.category,
      unitSystem,
      VESSELS
    );
  }, [selectedAnatomyInfo, isMuscleSelection, unitSystem]);

  const linkedFlaps = useMemo(() => {
    if (!selectedAnatomyInfo || isMuscleSelection) return [];
    const byId = new Map<string, { id: string; name: string; region: string; role?: string }>();

    if (selectedAnatomyInfo.system === 'arteries' || selectedAnatomyInfo.system === 'veins') {
      const matches = findFlapsUsingVessel(
        { fjCode: selectedAnatomyInfo.fjCode, name: selectedAnatomyInfo.label },
        flaps
      );
      for (const m of matches) {
        byId.set(m.flapId, {
          id: m.flapId,
          name: m.flapName,
          region: m.regionGroup,
          role: m.role,
        });
      }
    }

    for (const fid of selectedAnatomyInfo.linkedFlapIds ?? []) {
      if (byId.has(fid)) continue;
      const f = flaps.find((item) => item.id === fid);
      if (f) {
        byId.set(f.id, { id: f.id, name: f.name, region: f.region_group });
      }
    }

    return Array.from(byId.values());
  }, [selectedAnatomyInfo, isMuscleSelection, flaps]);

  if (isMuscleSelection) {
    return <MuscleReferenceCard />;
  }

  if (!selectedAnatomyInfo) return null;

  const sideLabel =
    selectedAnatomyInfo.laterality === 'left'
      ? 'Left'
      : selectedAnatomyInfo.laterality === 'right'
        ? 'Right'
        : selectedAnatomyInfo.laterality === 'midline'
          ? 'Midline'
          : null;

  const groupMeshKeys =
    selectedAnatomyInfo.constituentParts && selectedAnatomyInfo.constituentParts.length > 0
      ? selectedAnatomyInfo.constituentParts
          .map((p) => p.meshKey)
          .filter((k): k is string => Boolean(k))
      : selectedAnatomyInfo.subMeshKey
        ? [selectedAnatomyInfo.subMeshKey]
        : selectedAnatomyInfo.meshName
          ? [selectedAnatomyInfo.meshName]
          : [selectedAnatomyInfo.id];

  const isMultiPart =
    Boolean(selectedAnatomyInfo.constituentParts) &&
    (selectedAnatomyInfo.constituentParts?.length ?? 0) > 1 &&
    Boolean(selectedAnatomyInfo.subMeshKey);

  const supportsVisibilityActions =
    groupMeshKeys.length > 0 &&
    selectedAnatomyInfo.system !== 'skin' &&
    !selectedAnatomyInfo.isSchematic;

  const isCurrentlyIsolated =
    supportsVisibilityActions &&
    visibilityState.isolatedMeshKeys.length > 0 &&
    groupMeshKeys.some((k) => visibilityState.isolatedMeshKeys.includes(k));
  const isCurrentlyGhosted =
    supportsVisibilityActions &&
    visibilityState.ghostOthersKeys.length > 0 &&
    groupMeshKeys.some((k) => visibilityState.ghostOthersKeys.includes(k));

  const handleHide = () => {
    if (!supportsVisibilityActions) return;
    if (hidePartOnly && isMultiPart && selectedAnatomyInfo.subMeshKey) {
      const partRec = selectedAnatomyInfo.constituentParts?.find(
        (p) => p.meshKey === selectedAnatomyInfo.subMeshKey
      );
      hideSubMeshes({
        id: selectedAnatomyInfo.subMeshKey,
        label: partRec?.label || selectedAnatomyInfo.label,
        side: selectedAnatomyInfo.laterality || 'midline',
        system: selectedAnatomyInfo.system || 'other',
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
      label: selectedAnatomyInfo.label,
      side: selectedAnatomyInfo.laterality || 'midline',
      system: selectedAnatomyInfo.system || 'other',
      meshKeys: groupMeshKeys,
      partOnly: false,
    });
  };

  return (
    <div
      data-testid="selected-structure-sheet-card"
      className="rounded-xl border border-[var(--accent-primary)]/45 bg-[var(--bg-subtle)] p-3.5 space-y-3 text-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
              {selectedAnatomyInfo.category}
            </span>
            {sideLabel && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)]">
                {sideLabel}
              </span>
            )}
            {selectedAnatomyInfo.isSchematic && <SchematicIconBadge compact />}
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] leading-snug">
            {selectedAnatomyInfo.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setSelectedAnatomyInfo(null)}
          aria-label="Clear selected structure"
          className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons: Focus · Hide · Isolate · Ghost others · Restore */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedAnatomyInfo.boundsMin && selectedAnatomyInfo.boundsMax && (
            <button
              type="button"
              onClick={() => {
                const goal = computeStructureFocusCamera(
                  selectedAnatomyInfo.boundsMin!,
                  selectedAnatomyInfo.boundsMax!,
                  selectedAnatomyInfo.center
                );
                flyToCameraGoal(goal.pos, goal.target);
              }}
              className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors"
            >
              <Crosshair className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Focus</span>
            </button>
          )}

          {supportsVisibilityActions && (
            <>
              <button
                type="button"
                onClick={handleHide}
                data-testid="structure-action-hide"
                className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5"
              >
                <EyeOff className="w-4 h-4 text-[var(--text-secondary)]" />
                <span>Hide</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  isCurrentlyIsolated
                    ? restoreIsolationAndGhost()
                    : isolateSubMeshes(
                        groupMeshKeys,
                        selectedAnatomyInfo.label,
                        visibilityState.isolateKeepSkeleton
                      )
                }
                aria-pressed={isCurrentlyIsolated}
                data-testid="structure-action-isolate"
                className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                  isCurrentlyIsolated
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                }`}
              >
                <Crosshair className="w-4 h-4" />
                <span>{isCurrentlyIsolated ? 'Isolated' : 'Isolate'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  isCurrentlyGhosted
                    ? restoreIsolationAndGhost()
                    : ghostOthersForSubMeshes(groupMeshKeys, selectedAnatomyInfo.label)
                }
                aria-pressed={isCurrentlyGhosted}
                data-testid="structure-action-ghost"
                className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                  isCurrentlyGhosted
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                }`}
              >
                <Ghost className="w-4 h-4" />
                <span>Ghost others</span>
              </button>
            </>
          )}

          {(isCurrentlyIsolated || isCurrentlyGhosted) && (
            <button
              type="button"
              onClick={restoreIsolationAndGhost}
              data-testid="structure-action-restore"
              className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--accent-primary)] inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restore</span>
            </button>
          )}
        </div>

        {(isMultiPart || isCurrentlyIsolated) && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
            {isMultiPart && (
              <label className="inline-flex items-center gap-2 min-h-[36px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={hidePartOnly}
                  onChange={(e) => setHidePartOnly(e.target.checked)}
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
                  className="w-4 h-4 accent-[var(--accent-primary)]"
                />
                <span>Keep faint skeleton</span>
              </label>
            )}
          </div>
        )}
      </div>

      {clinicalCard && (
        <div className="space-y-2 text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border-subtle)] pt-2.5">
          {clinicalCard.origin && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                Origin / Region
              </span>
              <span className="text-[var(--text-primary)]">{clinicalCard.origin}</span>
            </div>
          )}
          {clinicalCard.dimensions && clinicalCard.dimensions !== 'N/A' && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                Caliber / Dimensions
              </span>
              <span className="font-mono text-[var(--text-primary)]">{clinicalCard.dimensions}</span>
            </div>
          )}
          {clinicalCard.course && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                Course &amp; Relations
              </span>
              <p>{clinicalCard.course}</p>
            </div>
          )}
          {clinicalCard.clinicalRelevance && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                Clinical Relevance
              </span>
              <p>{clinicalCard.clinicalRelevance}</p>
            </div>
          )}
        </div>
      )}

      {linkedFlaps.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] pt-2.5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Related Reconstructive Flaps ({linkedFlaps.length})
          </div>
          <div className="space-y-1.5">
            {linkedFlaps.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  if (
                    selectedAnatomyInfo.laterality === 'left' ||
                    selectedAnatomyInfo.laterality === 'right'
                  ) {
                    setDonorSide(selectedAnatomyInfo.laterality);
                  }
                  setSelectedAnatomyInfo(null);
                  selectFlap(f.id, true);
                  setActiveTab('library');
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center justify-between gap-2 text-left transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {f.name}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] truncate">{f.region}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
