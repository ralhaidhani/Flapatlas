import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Calculator, Compass, Crosshair, Layers, Scissors } from 'lucide-react';
import {
  calculateBilobedFlap,
  calculateKeystoneFlap,
  calculateRhomboidFlap,
  calculateSerialZPlasty,
  KeystoneBehanType,
  RhomboidVariant,
} from '../engine/localFlapCalc';
import {
  calculatePedicleReach,
  calculatePerforatorHotspot,
  FLAP_REACH_PRESETS,
  PerforatorZoneInput,
} from '../engine/reachCalculator';
import { Z_PLASTY_REFERENCE_TABLE } from '../engine/zplastyCalc';
import { useAtlasStore } from '../store/useAtlasStore';
import { AngiosomeAtlasTab } from './AngiosomeAtlasTab';
import {
  BilobedFlapDiagram,
  KeystoneFlapDiagram,
  RhomboidFlapDiagram,
  SerialZPlastyDiagram,
} from './LocalFlapDiagrams';

type SimSubTab = 'local' | 'angiosomes' | 'reach' | 'perforator';
type LocalFlapMode = 'zplasty' | 'rhomboid' | 'bilobed' | 'keystone';

export const SimulatorsView: React.FC = () => {
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const setAnimationMode = useAtlasStore((s) => s.setAnimationMode);
  const setLayer = useAtlasStore((s) => s.setLayer);

  const [subTab, setSubTab] = useState<SimSubTab>('local');
  const [localMode, setLocalMode] = useState<LocalFlapMode>('zplasty');

  // Z-Plasty state (Single & Serial)
  const [zAngle, setZAngle] = useState(60);
  const [zScarCm, setZScarCm] = useState(4.0);
  const [zCount, setZCount] = useState(1);
  const [transposed, setTransposed] = useState(false);
  const zResult = useMemo(
    () => calculateSerialZPlasty(zAngle, zScarCm, zCount),
    [zAngle, zScarCm, zCount]
  );

  // Rhomboid state
  const [rhombSide, setRhombSide] = useState(2.5);
  const [rhombVariant, setRhombVariant] = useState<RhomboidVariant>('limberg');
  const rhombResult = useMemo(
    () => calculateRhomboidFlap(rhombSide, rhombVariant),
    [rhombSide, rhombVariant]
  );

  // Bilobed state
  const [bilobedDiam, setBilobedDiam] = useState(1.2);
  const bilobedResult = useMemo(() => calculateBilobedFlap(bilobedDiam), [bilobedDiam]);

  // Keystone state
  const [keystoneW, setKeystoneW] = useState(4.0);
  const [keystoneL, setKeystoneL] = useState(8.0);
  const [keystoneType, setKeystoneType] = useState<KeystoneBehanType>('IIA');
  const keystoneResult = useMemo(
    () => calculateKeystoneFlap(keystoneW, keystoneL, keystoneType),
    [keystoneW, keystoneL, keystoneType]
  );

  // Pedicle Reach state
  const [activePresetId, setActivePresetId] = useState<string>(FLAP_REACH_PRESETS[0].id);
  const [pivotToDefect, setPivotToDefect] = useState(FLAP_REACH_PRESETS[0].pivotToDefectEdgeCm);
  const [defectLen, setDefectLen] = useState(FLAP_REACH_PRESETS[0].defectLengthCm);
  const [pedicleLen, setPedicleLen] = useState(FLAP_REACH_PRESETS[0].pedicleEffectiveLengthCm);
  const [tunnelOverhead, setTunnelOverhead] = useState(FLAP_REACH_PRESETS[0].tunnelingOverheadCm);
  const reachResult = useMemo(
    () =>
      calculatePedicleReach({
        pivotToDefectEdgeCm: pivotToDefect,
        defectLengthCm: defectLen,
        pedicleEffectiveLengthCm: pedicleLen,
        tunnelingOverheadCm: tunnelOverhead,
      }),
    [pivotToDefect, defectLen, pedicleLen, tunnelOverhead]
  );

  const applyReachPreset = (presetId: string) => {
    const p = FLAP_REACH_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setActivePresetId(p.id);
    setPivotToDefect(p.pivotToDefectEdgeCm);
    setDefectLen(p.defectLengthCm);
    setPedicleLen(p.pedicleEffectiveLengthCm);
    setTunnelOverhead(p.tunnelingOverheadCm);
  };

  // Perforator Landmark Mapping state
  const [perfFlap, setPerfFlap] = useState<PerforatorZoneInput['flapType']>('ALT');
  const [landmarkSpan, setLandmarkSpan] = useState(44);
  const perfResult = useMemo(
    () => calculatePerforatorHotspot({ flapType: perfFlap, landmarkSpanCm: landmarkSpan }),
    [perfFlap, landmarkSpan]
  );

  const openFlapIn3D = (flapId: string, options?: { showArc?: boolean; showPerforators?: boolean }) => {
    selectFlap(flapId, true);
    if (options?.showArc) {
      setAnimationMode('arc');
    }
    if (options?.showPerforators) {
      setLayer('perforators', { visible: true, opacity: 1 });
      setLayer('perforasomes', { visible: true, opacity: 0.52 });
      setLayer('landmarks', { visible: true, opacity: 1 });
    }
    setActiveTab('library');
  };

  // Reach SVG scaling (leaves dedicated top header band y=0..38 free of arc overlap)
  const reachMaxCm = Math.max(reachResult.totalRequiredReachCm, reachResult.availableReachCm, 12) + 4;
  const pxPerCm = 270 / reachMaxCm;
  const pivotX = 52;
  const pivotY = 142;
  const nearX = pivotX + pivotToDefect * pxPerCm;
  const farX = pivotX + (pivotToDefect + defectLen) * pxPerCm;
  const reqX = pivotX + reachResult.totalRequiredReachCm * pxPerCm;
  const availR = Math.min(280, reachResult.availableReachCm * pxPerCm);
  const arcTopY = Math.max(40, pivotY - Math.min(98, availR * 0.56));
  const reachColor =
    reachResult.verdict === 'Comfortable'
      ? '#0f766e'
      : reachResult.verdict === 'Borderline'
        ? '#d97706'
        : '#dc2626';

  const activePreset = FLAP_REACH_PRESETS.find((p) => p.id === activePresetId);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-5 bg-[var(--bg-app)]" data-testid="simulators-view">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--accent-primary)] flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5" />
            <span>Interactive Geometric, Angiosome & Surgical Planning Tools</span>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
            Flap Simulators, Angiosomes & Calculators
          </h1>
        </div>

        <div className="flex flex-wrap rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-1 gap-1">
          {[
            { id: 'local', label: 'Local Flaps & Z-Plasty', icon: Scissors },
            { id: 'angiosomes', label: 'Angiosomes & Perforasomes', icon: Layers },
            { id: 'reach', label: 'Pedicle Reach', icon: Compass },
            { id: 'perforator', label: 'Perforator Mapping', icon: Crosshair },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`sim-tab-${t.id}`}
                onClick={() => setSubTab(t.id as SimSubTab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  subTab === t.id
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: LOCAL FLAPS & Z-PLASTY SIMULATOR */}
      {subTab === 'local' && (
        <div className="space-y-4">
          {/* Sub-mode switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Local flap geometry selector">
              {(
                [
                  { id: 'zplasty', label: 'Z-Plasty (Single & Serial)' },
                  { id: 'rhomboid', label: 'Rhomboid (Limberg / Dufourmentel)' },
                  { id: 'bilobed', label: 'Bilobed (Zitelli 90°)' },
                  { id: 'keystone', label: 'Keystone (Behan I–IV)' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`local-mode-${m.id}`}
                  onClick={() => {
                    setLocalMode(m.id);
                    setTransposed(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    localMode === m.id
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                openFlapIn3D(
                  localMode === 'zplasty'
                    ? 'z-plasty-flap'
                    : localMode === 'keystone'
                      ? 'keystone-flap'
                      : 'bilobed-rhomboid-flap'
                )
              }
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1"
            >
              <span>Open Reference Record in 3D Atlas</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            </button>
          </div>

          {/* MODE A: Z-PLASTY */}
          {localMode === 'zplasty' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <label htmlFor="z-angle-slider" className="font-medium text-[var(--text-primary)]">
                      Limb Angle (θ)
                    </label>
                    <span className="font-mono font-semibold text-[var(--accent-primary)]" data-testid="zplasty-angle-value">
                      {zAngle}°
                    </span>
                  </div>
                  <input
                    id="z-angle-slider"
                    type="range"
                    min={30}
                    max={90}
                    step={5}
                    value={zAngle}
                    onChange={(e) => setZAngle(Number(e.target.value))}
                    className="w-full accent-[var(--accent-primary)]"
                  />
                  <div className="flex justify-between gap-1">
                    {[30, 45, 60, 75, 90].map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setZAngle(a)}
                        className={`flex-1 py-1 text-[11px] font-mono rounded border ${
                          zAngle === a
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                            : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {a}°
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label htmlFor="z-limb-slider" className="font-medium text-[var(--text-primary)]">
                      Total Contracture Scar Length
                    </label>
                    <span className="font-mono font-semibold text-[var(--text-primary)]">
                      {zScarCm.toFixed(1)} cm
                    </span>
                  </div>
                  <input
                    id="z-limb-slider"
                    type="range"
                    min={1}
                    max={14}
                    step={0.5}
                    value={zScarCm}
                    onChange={(e) => setZScarCm(Number(e.target.value))}
                    className="w-full accent-[var(--accent-primary)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[var(--text-primary)]">Serial Z-Plasty Units</span>
                    <span className="font-mono font-semibold text-[var(--text-primary)]">
                      {zCount} {zCount === 1 ? 'single Z' : 'serial Zs'} ({zResult.unitLimbLengthCm} cm/limb)
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((c) => (
                      <button
                        key={c}
                        type="button"
                        data-testid={`z-count-${c}`}
                        onClick={() => setZCount(c)}
                        className={`py-1.5 rounded-lg text-xs font-mono border ${
                          zCount === c
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                            : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {c}×
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Length Gain</div>
                    <div className="text-lg font-mono font-bold tabular-nums text-[var(--accent-primary)]" data-testid="zplasty-gain-pct">
                      +{zResult.theoreticalGainPercent}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">New Length</div>
                    <div className="text-lg font-mono font-bold tabular-nums text-[var(--text-primary)]">
                      {zResult.newTotalLengthCm} cm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Scar Rotation</div>
                    <div className="text-lg font-mono font-bold tabular-nums text-[var(--text-primary)]">
                      {zResult.scarRotationDeg}°
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-subtle)] p-2.5 rounded-lg border border-[var(--border-subtle)] leading-relaxed">
                  {zResult.clinicalNote}
                </p>
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {transposed ? 'Post-Transposition Geometry (Lengthened Axis)' : 'Pre-Transposition Marking (Contracture Axis)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTransposed((t) => !t)}
                      data-testid="zplasty-transpose-btn"
                      className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium hover:opacity-95"
                    >
                      {transposed ? 'Reset to Pre-Op Design' : 'Transpose Triangular Flaps'}
                    </button>
                  </div>
                  <SerialZPlastyDiagram result={zResult} transposed={transposed} />
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                      <tr>
                        <th className="p-2.5">Angle</th>
                        <th className="p-2.5">Theoretical Gain</th>
                        <th className="p-2.5">Scar Rotation</th>
                        <th className="p-2.5">Clinical Pearl</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {Z_PLASTY_REFERENCE_TABLE.map((row) => (
                        <tr key={row.angle} className={zAngle === row.angle ? 'bg-[var(--accent-soft)]' : ''}>
                          <td className="p-2.5 font-mono font-semibold text-[var(--text-primary)]">{row.angle}°</td>
                          <td className="p-2.5 font-mono text-[var(--accent-primary)] font-semibold">+{row.gainPercent}%</td>
                          <td className="p-2.5 font-mono text-[var(--text-primary)]">{row.rotationDeg}°</td>
                          <td className="p-2.5 text-[var(--text-secondary)]">{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODE B: RHOMBOID (LIMBERG / DUFOURMENTEL) */}
          {localMode === 'rhomboid' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-[var(--text-primary)] block">Rhomboid Design Variant</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'limberg', label: 'Limberg (60°/120°)' },
                        { id: 'dufourmentel', label: 'Dufourmentel' },
                      ] as const
                    ).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        data-testid={`rhomboid-variant-${v.id}`}
                        onClick={() => setRhombVariant(v.id)}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border ${
                          rhombVariant === v.id
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                            : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label htmlFor="rhomb-side-slider" className="font-medium text-[var(--text-primary)]">
                      Rhomboid Side Length (s)
                    </label>
                    <span className="font-mono font-semibold text-[var(--accent-primary)]">
                      {rhombSide.toFixed(1)} cm
                    </span>
                  </div>
                  <input
                    id="rhomb-side-slider"
                    type="range"
                    min={1}
                    max={8}
                    step={0.5}
                    value={rhombSide}
                    onChange={(e) => setRhombSide(Number(e.target.value))}
                    className="w-full accent-[var(--accent-primary)]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Short Diag</div>
                    <div className="text-base font-mono font-bold text-[var(--text-primary)]">
                      {rhombResult.shortDiagonalCm} cm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Long Diag</div>
                    <div className="text-base font-mono font-bold text-[var(--text-primary)]">
                      {rhombResult.longDiagonalCm} cm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Defect Area</div>
                    <div className="text-base font-mono font-bold text-[var(--accent-primary)]">
                      {rhombResult.defectAreaCm2} cm²
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-[var(--text-primary)] bg-[var(--accent-soft)] p-2.5 rounded-lg border border-[var(--accent-primary)]/30 leading-relaxed">
                    {rhombResult.closingVectorNote}
                  </p>
                  <p className="text-[var(--text-secondary)] bg-[var(--bg-subtle)] p-2.5 rounded-lg border border-[var(--border-subtle)] leading-relaxed">
                    {rhombResult.clinicalNote}
                  </p>
                </div>
              </div>

              <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {transposed ? 'Transposed Rhomboid & Primary Donor Seam' : 'Pre-Op Rhomboid Marking (4 Options Off 120° Corners)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTransposed((t) => !t)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium hover:opacity-95"
                  >
                    {transposed ? 'Reset Marking' : 'Transpose Rhomboid Flap'}
                  </button>
                </div>
                <RhomboidFlapDiagram result={rhombResult} transposed={transposed} />
              </div>
            </div>
          )}

          {/* MODE C: BILOBED (ZITELLI 90°) */}
          {localMode === 'bilobed' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label htmlFor="bilobed-diam-slider" className="font-medium text-[var(--text-primary)]">
                      Circular Defect Diameter
                    </label>
                    <span className="font-mono font-semibold text-[var(--accent-primary)]">
                      {bilobedDiam.toFixed(1)} cm
                    </span>
                  </div>
                  <input
                    id="bilobed-diam-slider"
                    type="range"
                    min={0.6}
                    max={2.6}
                    step={0.1}
                    value={bilobedDiam}
                    onChange={(e) => setBilobedDiam(Number(e.target.value))}
                    className="w-full accent-[var(--accent-primary)]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Lobe 1 (45°)</div>
                    <div className="text-base font-mono font-bold text-[var(--accent-primary)]">
                      {bilobedResult.primaryLobeDiameterCm} cm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Lobe 2 (90°)</div>
                    <div className="text-base font-mono font-bold text-[var(--text-primary)]">
                      {bilobedResult.secondaryLobeDiameterCm} cm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Burow Cone</div>
                    <div className="text-base font-mono font-bold text-[var(--text-primary)]">
                      {bilobedResult.burowConeLengthCm} cm
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Distal Nasal Suitability</span>
                  <span
                    className={`font-semibold ${
                      bilobedDiam <= 1.5
                        ? 'text-[var(--success-text)]'
                        : bilobedDiam <= 2.0
                          ? 'text-[var(--warning-text)]'
                          : 'text-[var(--danger-text)]'
                    }`}
                  >
                    {bilobedResult.nasalSuitability}
                  </span>
                </div>

                <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-subtle)] p-2.5 rounded-lg border border-[var(--border-subtle)] leading-relaxed">
                  {bilobedResult.clinicalNote}
                </p>
              </div>

              <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {transposed ? 'Transposed Bilobed Flap (90° Total Arc)' : 'Zitelli 90° Pre-Op Design (Deep Sub-Nasalis Plane)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTransposed((t) => !t)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium hover:opacity-95"
                  >
                    {transposed ? 'Reset Marking' : 'Transpose Bilobed Flap'}
                  </button>
                </div>
                <BilobedFlapDiagram result={bilobedResult} transposed={transposed} />
              </div>
            </div>
          )}

          {/* MODE D: KEYSTONE (BEHAN TYPES I-IV) */}
          {localMode === 'keystone' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-[var(--text-primary)] block">Behan Keystone Classification</span>
                  <div className="grid grid-cols-5 gap-1">
                    {(['I', 'IIA', 'IIB', 'III', 'IV'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        data-testid={`keystone-type-${t}`}
                        onClick={() => setKeystoneType(t)}
                        className={`py-1.5 rounded-lg text-xs font-mono border ${
                          keystoneType === t
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                            : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label htmlFor="ks-width-slider" className="text-[var(--text-secondary)]">Defect Width</label>
                      <span className="font-mono font-semibold text-[var(--text-primary)]">{keystoneW} cm</span>
                    </div>
                    <input
                      id="ks-width-slider"
                      type="range"
                      min={1.5}
                      max={10}
                      step={0.5}
                      value={keystoneW}
                      onChange={(e) => setKeystoneW(Number(e.target.value))}
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label htmlFor="ks-length-slider" className="text-[var(--text-secondary)]">Defect Length</label>
                      <span className="font-mono font-semibold text-[var(--text-primary)]">{keystoneL} cm</span>
                    </div>
                    <input
                      id="ks-length-slider"
                      type="range"
                      min={3}
                      max={20}
                      step={0.5}
                      value={keystoneL}
                      onChange={(e) => setKeystoneL(Number(e.target.value))}
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Flap Width (1:1)</div>
                    <div className="text-base font-mono font-bold text-[var(--accent-primary)]">
                      {keystoneResult.flapWidthCm} cm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Outer Arc</div>
                    <div className="text-base font-mono font-bold text-[var(--text-primary)]">
                      {keystoneResult.outerArcLengthCm} cm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Lateral Angle</div>
                    <div className="text-base font-mono font-bold text-[var(--text-primary)]">
                      {keystoneResult.lateralLimbAngleDeg}°
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">{keystoneResult.subtypeSummary}</div>
                  <p className="text-[var(--text-secondary)] bg-[var(--bg-subtle)] p-2.5 rounded-lg border border-[var(--border-subtle)] leading-relaxed">
                    {keystoneResult.clinicalNote}
                  </p>
                </div>
              </div>

              <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {transposed ? 'Advanced Keystone + Dual V-Y Closures' : 'Keystone Perforator Island Marking (1:1 Ratio)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTransposed((t) => !t)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium hover:opacity-95"
                  >
                    {transposed ? 'Reset Marking' : 'Advance Keystone Island'}
                  </button>
                </div>
                <KeystoneFlapDiagram result={keystoneResult} transposed={transposed} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANGIOSOMES & PERFORASOMES ATLAS */}
      {subTab === 'angiosomes' && <AngiosomeAtlasTab />}

      {/* TAB 3: PEDICLE REACH CALCULATOR */}
      {subTab === 'reach' && (
        <div className="space-y-4">
          {/* 1-Click Classic Pedicled Flap Presets */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-2.5">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              Classic Pedicled Flap Reach Presets
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FLAP_REACH_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`reach-preset-${preset.id}`}
                  onClick={() => applyReachPreset(preset.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                    activePresetId === preset.id
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-medium'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {activePreset && (
              <div className="text-[11px] text-[var(--text-muted)]">
                Scenario: {activePreset.scenario}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Pedicled Flap Reach & Arc Parameters
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Measure from the true vascular pivot point to the FARTHEST defect edge using umbilical tape or surgical sponge, adding 1.5–3 cm for kink-free tunneling.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">Pivot to Near Edge (cm)</span>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={0.5}
                    value={pivotToDefect}
                    onChange={(e) => setPivotToDefect(Number(e.target.value) || 0)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[var(--text-primary)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">Defect Span Along Axis (cm)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={defectLen}
                    onChange={(e) => setDefectLen(Number(e.target.value) || 0)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[var(--text-primary)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">Available Effective Reach (cm)</span>
                  <input
                    type="number"
                    min={1}
                    max={45}
                    step={0.5}
                    value={pedicleLen}
                    onChange={(e) => setPedicleLen(Number(e.target.value) || 0)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[var(--text-primary)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">Tunneling / Contour Slack (cm)</span>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    step={0.5}
                    value={tunnelOverhead}
                    onChange={(e) => setTunnelOverhead(Number(e.target.value) || 0)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[var(--text-primary)]"
                  />
                </label>
              </div>

              {activePreset && (
                <button
                  type="button"
                  onClick={() => openFlapIn3D(activePreset.flapId, { showArc: true })}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-95"
                >
                  <span>Inspect {activePreset.label.split(' → ')[0]} Arc in 3D</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Arc-of-Rotation Feasibility Visualizer
                </span>
                <span
                  data-testid="reach-verdict-label"
                  className={`text-sm font-semibold ${
                    reachResult.verdict === 'Comfortable'
                      ? 'text-[var(--success-text)]'
                      : reachResult.verdict === 'Borderline'
                        ? 'text-[var(--warning-text)]'
                        : 'text-[var(--danger-text)]'
                  }`}
                >
                  {reachResult.verdict}
                </span>
              </div>

              {/* Interactive SVG Arc-of-Rotation Visualizer */}
              <svg
                viewBox="0 0 380 190"
                className="w-full h-48 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
                data-testid="reach-arc-svg"
                role="img"
                aria-label="Pedicle arc of rotation versus defect span diagram"
              >
                {/* Dedicated Top Status Line */}
                <text x="20" y="20" fontSize="10" fontWeight="600" fill={reachColor}>
                  Effective Reach Arc: {reachResult.availableReachCm} cm (Margin: {reachResult.marginCm >= 0 ? `+${reachResult.marginCm}` : reachResult.marginCm} cm)
                </text>

                {/* Baseline axis */}
                <line x1="24" y1={pivotY} x2="356" y2={pivotY} stroke="currentColor" strokeOpacity="0.22" />

                {/* Available Reach Arc (capped below y=40 header band) */}
                <path
                  d={`M ${pivotX} ${pivotY} L ${Math.min(350, pivotX + availR)} ${pivotY} A ${availR} ${pivotY - arcTopY} 0 0 0 ${pivotX} ${arcTopY} Z`}
                  fill={reachColor}
                  fillOpacity="0.14"
                  stroke={reachColor}
                  strokeWidth="2"
                  strokeDasharray="5 3"
                />

                {/* Defect Zone Bar */}
                <rect
                  x={Math.min(340, nearX)}
                  y={pivotY - 14}
                  width={Math.max(10, Math.min(346, farX) - Math.min(340, nearX))}
                  height="28"
                  rx="4"
                  fill="rgba(220,38,38,0.24)"
                  stroke="#dc2626"
                  strokeWidth="2"
                />
                <text
                  x={(Math.min(340, nearX) + Math.min(346, farX)) / 2}
                  y={pivotY + 4}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#dc2626"
                >
                  Defect ({defectLen} cm)
                </text>

                {/* Tunneling Slack Extension */}
                <line
                  x1={Math.min(346, farX)}
                  y1={pivotY}
                  x2={Math.min(352, reqX)}
                  y2={pivotY}
                  stroke="#d97706"
                  strokeWidth="4"
                />
                <line
                  x1={Math.min(352, reqX)}
                  y1={pivotY + 4}
                  x2={Math.min(352, reqX)}
                  y2={pivotY + 18}
                  stroke="#d97706"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <text x={Math.min(356, reqX)} y={pivotY + 30} textAnchor="end" fontSize="9.5" fontWeight="600" fill="#d97706">
                  Required (+slack): {reachResult.totalRequiredReachCm} cm
                </text>

                {/* Vascular Pivot Point */}
                <circle cx={pivotX} cy={pivotY} r="6" fill="#0f766e" stroke="#ffffff" strokeWidth="2" />
                <text x={pivotX} y={pivotY + 26} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0f766e">
                  Pivot
                </text>
              </svg>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                  <div className="text-[10px] uppercase text-[var(--text-muted)]">Required Reach</div>
                  <div className="text-lg font-mono font-bold text-[var(--text-primary)]">
                    {reachResult.totalRequiredReachCm} cm
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                  <div className="text-[10px] uppercase text-[var(--text-muted)]">Available</div>
                  <div className="text-lg font-mono font-bold text-[var(--text-primary)]">
                    {reachResult.availableReachCm} cm
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                  <div className="text-[10px] uppercase text-[var(--text-muted)]">Margin</div>
                  <div className="text-lg font-mono font-bold text-[var(--accent-primary)]">
                    {reachResult.marginCm >= 0 ? `+${reachResult.marginCm}` : reachResult.marginCm} cm
                  </div>
                </div>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {reachResult.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PERFORATOR LANDMARK MAPPING */}
      {subTab === 'perforator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Preoperative Bony Landmark Perforator Mapper
            </h2>
            <div className="space-y-1">
              <label htmlFor="perf-flap-select" className="text-[11px] text-[var(--text-secondary)] block">
                Perforator Flap System
              </label>
              <select
                id="perf-flap-select"
                data-testid="perf-flap-select"
                value={perfFlap}
                onChange={(e) => setPerfFlap(e.target.value as PerforatorZoneInput['flapType'])}
                className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="ALT">ALT (ASIS → Superolateral Patella)</option>
                <option value="DIEP">DIEP (Umbilicus → Rectus Sheath Grid)</option>
                <option value="TDAP">TDAP (Posterior Axillary Crease → LD Anterior Border)</option>
                <option value="FIBULA">Free Fibula (Fibular Head → Lateral Malleolus)</option>
                <option value="MSAP">MSAP (Popliteal Crease → Medial Malleolus)</option>
                <option value="SGAP">SGAP (PSIS → Greater Trochanter)</option>
                <option value="PAP">PAP (Gluteal Fold & Gracilis Border)</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <label htmlFor="perf-span-slider" className="text-[11px] text-[var(--text-secondary)]">
                  Patient Landmark Span
                </label>
                <span className="font-mono font-semibold text-[var(--text-primary)]">{landmarkSpan} cm</span>
              </div>
              <input
                id="perf-span-slider"
                type="range"
                min={18}
                max={58}
                value={landmarkSpan}
                onChange={(e) => setLandmarkSpan(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>

            <button
              type="button"
              onClick={() => openFlapIn3D(perfResult.flapId, { showPerforators: true })}
              data-testid="perf-open-3d-btn"
              className="w-full mt-2 py-2 px-3 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-95"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>View Perforator Hotspots in 3D Atlas</span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-3 text-xs">
            <div className="text-sm font-semibold text-[var(--text-primary)]">{perfResult.flapType}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Surface Reference Line
                </div>
                <div className="font-medium text-[var(--text-primary)] mt-1">{perfResult.referenceLine}</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Search Radius
                </div>
                <div className="font-mono font-semibold text-[var(--accent-primary)] mt-1">
                  {perfResult.searchRadiusCm} cm radius circle
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30">
              <div className="text-[11px] font-semibold text-[var(--accent-primary)]">
                Predicted Perforator Hotspot
              </div>
              <p className="text-[var(--text-primary)] mt-0.5 font-medium" data-testid="perf-hotspot-text">
                {perfResult.primaryHotspotCm}
              </p>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">{perfResult.dopplerTip}</p>
          </div>
        </div>
      )}
    </div>
  );
};
