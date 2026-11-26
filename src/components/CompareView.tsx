import React, { useMemo, useState } from 'react';
import { Box, Eye, GitCompare, Layers, Plus, Sparkles, X } from 'lucide-react';
import {
  buildRelativeMetricBars,
  COMPARE_PRESETS,
  computeSharedScalePaddles,
  rowHasDifferences,
} from '../engine/compareMetrics';
import { getCalibratedPaddleSummary } from '../engine/flapMetrics';
import { useAtlasStore } from '../store/useAtlasStore';
import { formatRange } from '../types/schemas';
import { Viewer3D } from './Viewer3D';

export const CompareView: React.FC = () => {
  const flaps = useAtlasStore((s) => s.flaps);
  const compareIds = useAtlasStore((s) => s.compareIds);
  const selectedFlapId = useAtlasStore((s) => s.selectedFlapId);
  const unitSystem = useAtlasStore((s) => s.unitSystem);
  const toggleCompare = useAtlasStore((s) => s.toggleCompare);
  const setCompareIds = useAtlasStore((s) => s.setCompareIds);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);

  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [show3DPreview, setShow3DPreview] = useState(true);

  const selectedFlaps = useMemo(
    () =>
      compareIds
        .map((id) => flaps.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => Boolean(f)),
    [compareIds, flaps]
  );

  const availableToAdd = flaps.filter((f) => !compareIds.includes(f.id));

  const scaledPaddles = useMemo(
    () => computeSharedScalePaddles(selectedFlaps),
    [selectedFlaps]
  );

  const pedicleLengthBars = useMemo(
    () =>
      buildRelativeMetricBars(
        selectedFlaps,
        (f) => f.vascular_anatomy.dominant_pedicle.pedicle_length_cm
      ),
    [selectedFlaps]
  );

  const arteryCaliberBars = useMemo(
    () =>
      buildRelativeMetricBars(
        selectedFlaps,
        (f) => f.vascular_anatomy.dominant_pedicle.artery_diameter_mm
      ),
    [selectedFlaps]
  );

  const rows = useMemo(
    () => [
      {
        label: 'Flap Type & Tissue',
        render: (f: (typeof selectedFlaps)[number]) =>
          `${f.flap_type.join(', ')} (${f.tissue_components.join(', ')})`,
      },
      {
        label: 'Dominant Pedicle',
        render: (f: (typeof selectedFlaps)[number]) =>
          `${f.vascular_anatomy.dominant_pedicle.artery} (from ${f.vascular_anatomy.dominant_pedicle.artery_origin})`,
      },
      {
        label: 'Pedicle Length',
        mono: true,
        render: (f: (typeof selectedFlaps)[number]) =>
          formatRange(f.vascular_anatomy.dominant_pedicle.pedicle_length_cm, unitSystem).text,
      },
      {
        label: 'Artery Caliber',
        mono: true,
        render: (f: (typeof selectedFlaps)[number]) =>
          formatRange(f.vascular_anatomy.dominant_pedicle.artery_diameter_mm, unitSystem).text,
      },
      {
        label: 'Vein Caliber',
        mono: true,
        render: (f: (typeof selectedFlaps)[number]) =>
          formatRange(f.vascular_anatomy.dominant_pedicle.vein_diameter_mm, unitSystem).text,
      },
      {
        label: 'Max Skin Paddle & Area',
        mono: true,
        render: (f: (typeof selectedFlaps)[number]) => {
          const sum = getCalibratedPaddleSummary(f, unitSystem);
          return `${sum.dimensionsText} (${sum.areaText})`;
        },
      },
      {
        label: 'Primary Closure Width',
        mono: true,
        render: (f: (typeof selectedFlaps)[number]) =>
          formatRange(f.dimensions.primary_closure_max_width_cm, unitSystem).text,
      },
      {
        label: 'Mathes–Nahai',
        render: (f: (typeof selectedFlaps)[number]) => f.classification.mathes_nahai || 'N/A',
      },
      {
        label: 'Sensate / Motor / Bone',
        render: (f: (typeof selectedFlaps)[number]) =>
          [
            f.nerves.can_be_sensate ? 'Sensate' : 'Non-sensate',
            f.advisor_tags.provides_motor ? 'Motor capable' : null,
            f.advisor_tags.provides_bone ? 'Vascularized Bone' : null,
          ]
            .filter(Boolean)
            .join(' · '),
      },
      {
        label: 'Transfer Mode',
        render: (f: (typeof selectedFlaps)[number]) =>
          [
            f.advisor_tags.free_capable ? 'Free' : null,
            f.advisor_tags.pedicled_capable ? 'Pedicled' : null,
            f.advisor_tags.chimeric_capable ? 'Chimeric' : null,
          ]
            .filter(Boolean)
            .join(' · '),
      },
      {
        label: 'Donor Closure & Morbidity',
        render: (f: (typeof selectedFlaps)[number]) =>
          `${f.donor_site.closure} — ${f.donor_site.morbidity.slice(0, 2).join('; ')}`,
      },
      {
        label: 'Difficulty & Est. OR Time',
        mono: true,
        render: (f: (typeof selectedFlaps)[number]) =>
          `${f.advisor_tags.technical_difficulty} · ${f.advisor_tags.typical_or_time}`,
      },
      {
        label: 'Recipient Vessel Options',
        render: (f: (typeof selectedFlaps)[number]) => f.recipient_vessels_options.join(', '),
      },
      {
        label: 'Primary Reference',
        render: (f: (typeof selectedFlaps)[number]) =>
          `${f.references[0]?.book} (${f.references[0]?.edition})`,
      },
    ],
    [unitSystem]
  );

  const visibleRows = useMemo(() => {
    if (!differencesOnly || selectedFlaps.length <= 1) return rows;
    return rows.filter((r) => rowHasDifferences(selectedFlaps.map((f) => r.render(f))));
  }, [rows, differencesOnly, selectedFlaps]);

  return (
    <div
      className="h-full overflow-y-auto p-4 sm:p-6 space-y-5 bg-[var(--bg-app)]"
      data-testid="compare-view"
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--accent-primary)] flex items-center gap-1.5">
            <GitCompare className="w-3.5 h-3.5" />
            <span>Side-by-Side 3D & Surgical Matrix</span>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
            Compare Reconstructive Flaps ({selectedFlaps.length} / 4)
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Compare live 3D anatomy, uniform-scale skin paddle proportions, pedicle reach/caliber bars, donor morbidity, and operative complexity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShow3DPreview((v) => !v)}
            data-testid="compare-toggle-3d-btn"
            className={`h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
              show3DPreview
                ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>{show3DPreview ? 'Hide 3D Preview' : 'Show 3D Preview'}</span>
          </button>

          <label className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={differencesOnly}
              onChange={(e) => setDifferencesOnly(e.target.checked)}
              data-testid="compare-differences-toggle"
              className="accent-[var(--accent-primary)]"
            />
            <span>Differences only</span>
          </label>

          {selectedFlaps.length < 4 && (
            <div className="flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[var(--text-muted)]" />
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    toggleCompare(e.target.value);
                    e.target.value = '';
                  }
                }}
                aria-label="Add flap to comparison"
                className="h-9 px-3 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="" disabled>
                  Add flap to compare...
                </option>
                {availableToAdd.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.region_group})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Classic Board Comparison Presets */}
      <div className="flex flex-wrap items-center gap-2" data-testid="compare-presets-bar">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1 mr-1">
          <Sparkles className="w-3 h-3 text-[var(--accent-primary)]" />
          Quick Sets:
        </span>
        {COMPARE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              setCompareIds(preset.flapIds);
              selectFlap(preset.flapIds[0], true);
            }}
            data-testid={`compare-preset-${preset.id}`}
            className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-left transition-colors"
          >
            <div className="text-xs font-medium text-[var(--text-primary)]">{preset.label}</div>
            <div className="text-[10px] text-[var(--text-muted)]">{preset.subtitle}</div>
          </button>
        ))}
      </div>

      {selectedFlaps.length === 0 ? (
        <div className="p-10 text-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-secondary)]">
          Select 2 to 4 flaps from the Flap Library, Quick Sets, or dropdown above to compare them side by side.
        </div>
      ) : (
        <>
          {/* Side-by-Side Visual Geometry & Live 3D Deck */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4" data-testid="compare-visual-deck">
            {show3DPreview && (
              <div className="xl:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden flex flex-col">
                <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-subtle)]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Live 3D Sync Inspector
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedFlaps.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => selectFlap(f.id, true)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                          selectedFlapId === f.id
                            ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {f.synonyms[0] || f.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-[290px] sm:h-[320px] relative">
                  <Viewer3D compact />
                </div>
              </div>
            )}

            {/* Uniform-Scale Skin Paddle Comparison + Pedicle Metric Bars */}
            <div
              className={`${
                show3DPreview ? 'xl:col-span-7' : 'xl:col-span-12'
              } bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Uniform-Scale Skin Paddle & Vascular Comparison
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Ellipses are drawn to a single shared centimeter scale across all selected flaps.
                  </p>
                </div>
              </div>

              {/* Scaled Paddle Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {selectedFlaps.map((f, idx) => {
                  const geom = scaledPaddles[idx];
                  const sum = getCalibratedPaddleSummary(f, unitSystem);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => selectFlap(f.id, true)}
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        selectedFlapId === f.id
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {f.synonyms[0] || f.name}
                      </div>
                      <svg
                        viewBox="0 0 100 64"
                        className="w-full h-16 my-1.5 bg-[var(--bg-surface)] rounded border border-[var(--border-subtle)]"
                        aria-label={`${f.name} relative paddle size`}
                      >
                        {geom.hasDimensions ? (
                          <>
                            <ellipse
                              cx="50"
                              cy="32"
                              rx={geom.rx}
                              ry={geom.ry}
                              fill="#0d9488"
                              fillOpacity="0.24"
                              stroke="#0d9488"
                              strokeWidth="1.5"
                              strokeDasharray="3 2"
                            />
                            <circle cx="50" cy="32" r="2.2" fill="#e11d48" />
                          </>
                        ) : (
                          <text
                            x="50"
                            y="35"
                            textAnchor="middle"
                            fontSize="7"
                            fill="currentColor"
                            opacity="0.5"
                          >
                            Not specified
                          </text>
                        )}
                      </svg>
                      <div className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)] truncate">
                        {sum.dimensionsText}
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-[var(--accent-primary)]">
                        {sum.areaText}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Relative Pedicle Length & Artery Caliber Bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-subtle)] text-xs">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                    Pedicle Length (Relative)
                  </div>
                  {selectedFlaps.map((f, i) => {
                    const bar = pedicleLengthBars[i];
                    const lbl = formatRange(
                      f.vascular_anatomy.dominant_pedicle.pedicle_length_cm,
                      unitSystem
                    );
                    return (
                      <div key={f.id} className="space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--text-primary)] truncate pr-2">
                            {f.synonyms[0] || f.name}
                          </span>
                          <span className="font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
                            {lbl.text}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--accent-primary)]"
                            style={{ width: `${bar.percentOfMax}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                    Dominant Artery Caliber (Relative)
                  </div>
                  {selectedFlaps.map((f, i) => {
                    const bar = arteryCaliberBars[i];
                    const lbl = formatRange(
                      f.vascular_anatomy.dominant_pedicle.artery_diameter_mm,
                      unitSystem
                    );
                    return (
                      <div key={f.id} className="space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--text-primary)] truncate pr-2">
                            {f.synonyms[0] || f.name}
                          </span>
                          <span className="font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
                            {lbl.text}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-rose-500"
                            style={{ width: `${bar.percentOfMax}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Structured Data Comparison Matrix */}
          <div className="overflow-x-auto bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                  <th className="p-3 w-44 font-semibold text-[var(--text-muted)] uppercase tracking-wider align-top">
                    Parameter ({visibleRows.length}/{rows.length})
                  </th>
                  {selectedFlaps.map((f) => (
                    <th
                      key={f.id}
                      className="p-3 min-w-[220px] align-top border-l border-[var(--border-subtle)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {f.name}
                          </div>
                          <div className="text-[11px] font-normal text-[var(--text-secondary)] mt-0.5">
                            {f.region_group} · {f.verification_status}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCompare(f.id)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--danger-text)]"
                          aria-label={`Remove ${f.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          selectFlap(f.id, true);
                          setActiveTab('library');
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
                      >
                        <Layers className="w-3 h-3" /> Open in 3D Atlas
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {visibleRows.map((row) => (
                  <tr key={row.label} className="hover:bg-[var(--bg-subtle)]/50">
                    <td className="p-3 font-medium text-[var(--text-secondary)] align-top bg-[var(--bg-subtle)]/30">
                      {row.label}
                    </td>
                    {selectedFlaps.map((f) => (
                      <td
                        key={f.id}
                        className={`p-3 align-top border-l border-[var(--border-subtle)] text-[var(--text-primary)] ${
                          row.mono ? 'font-mono tabular-nums' : ''
                        }`}
                      >
                        {row.render(f)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
