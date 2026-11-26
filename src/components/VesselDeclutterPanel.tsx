import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import {
  DEFAULT_VESSEL_PRESET_ID,
  DEFAULT_VESSEL_SIDE_FILTER,
  getVesselPreset,
  VESSEL_PRESETS,
  VesselSideFilter,
} from '../models/vesselDeclutter';
import { useAtlasStore } from '../store/useAtlasStore';

const SIDE_OPTIONS: Array<{ id: VesselSideFilter; label: string }> = [
  { id: 'both', label: 'Both' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];

export const VesselDeclutterPanel: React.FC = () => {
  const vesselPreset = useAtlasStore((s) => s.vesselPreset);
  const vesselSideFilter = useAtlasStore((s) => s.vesselSideFilter);
  const calibrationViewActive = useAtlasStore((s) => s.calibrationViewActive);
  const setVesselPreset = useAtlasStore((s) => s.setVesselPreset);
  const setVesselSideFilter = useAtlasStore((s) => s.setVesselSideFilter);

  const activePreset = getVesselPreset(vesselPreset);
  const isDefault =
    vesselPreset === DEFAULT_VESSEL_PRESET_ID &&
    vesselSideFilter === DEFAULT_VESSEL_SIDE_FILTER;

  return (
    <div data-testid="vessel-declutter-panel" className="space-y-3 text-sm">
      {calibrationViewActive && (
        <div
          data-testid="vessel-declutter-cal-notice"
          className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/35 text-xs text-amber-800 dark:text-amber-300 leading-snug"
        >
          Calibration View is currently isolating the alignment reference arteries. Exit Calibration
          View to see your selected Vessel View filter.
        </div>
      )}

      {/* Vessel View Preset Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Vessel View</span>
          </span>
          {!isDefault && (
            <button
              type="button"
              onClick={() => {
                setVesselPreset(DEFAULT_VESSEL_PRESET_ID);
                setVesselSideFilter(DEFAULT_VESSEL_SIDE_FILTER);
              }}
              data-testid="vessel-filter-reset-btn"
              className="min-h-[44px] px-2.5 text-sm font-medium text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label="Vessel view preset"
          className="space-y-1.5"
        >
          {VESSEL_PRESETS.map((preset) => {
            const active = vesselPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`vessel-preset-${preset.id}`}
                onClick={() => setVesselPreset(preset.id)}
                className={`w-full min-h-[44px] text-left px-3 py-2 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                  active
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                    : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60'
                }`}
              >
                <span className="text-sm truncate">{preset.label}</span>
                <span className="text-xs font-mono uppercase tracking-wider opacity-75 shrink-0">
                  {preset.mode === 'exclude'
                    ? 'Declutter'
                    : preset.mode === 'include'
                      ? 'Region'
                      : 'Full'}
                </span>
              </button>
            );
          })}
        </div>

        <p
          data-testid="vessel-preset-description"
          className="text-xs text-[var(--text-muted)] leading-snug px-0.5"
        >
          {activePreset.description}
        </p>
      </div>

      {/* Side Filter: Left / Right / Both */}
      <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Side Filter
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            Midline trunks kept on L/R
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Vessel side filter"
          className="grid grid-cols-3 gap-1 bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border-subtle)]"
        >
          {SIDE_OPTIONS.map((opt) => {
            const active = vesselSideFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`vessel-side-${opt.id}`}
                onClick={() => setVesselSideFilter(opt.id)}
                className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
