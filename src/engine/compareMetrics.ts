import type { FlapRecord, NumericRange } from '../types/schemas';

export interface ComparePreset {
  id: string;
  label: string;
  subtitle: string;
  flapIds: string[];
}

export const COMPARE_PRESETS: ComparePreset[] = [
  {
    id: 'breast-autologous',
    label: 'Autologous Breast',
    subtitle: 'DIEP vs SIEA vs PAP vs LD',
    flapIds: ['diep-flap', 'siea-flap', 'pap-flap', 'ld-flap'],
  },
  {
    id: 'lower-extremity',
    label: 'Lower Extremity',
    subtitle: 'ALT vs Gracilis vs MSAP vs Gastrocnemius',
    flapIds: ['alt-flap', 'gracilis-flap', 'msap-flap', 'gastrocnemius-flap'],
  },
  {
    id: 'head-neck-free',
    label: 'Head & Neck Free',
    subtitle: 'RFFF vs ALT vs Fibula vs Scapular',
    flapIds: ['rfff-flap', 'alt-flap', 'fibula-flap', 'scapular-flap'],
  },
  {
    id: 'perineal-pelvic',
    label: 'Pelvis & Perineum',
    subtitle: 'VRAM vs Gracilis vs SGAP vs Gluteal',
    flapIds: ['vram-flap', 'gracilis-flap', 'sgap-flap', 'gluteal-rotation-flap'],
  },
];

export interface NumericBarDatum {
  flapId: string;
  min: number | null;
  max: number | null;
  midpoint: number | null;
  percentOfMax: number; // 0..100 relative bar fill
  isVerify: boolean;
}

export function extractRangeMidpoint(range: NumericRange | null | undefined): number | null {
  if (!range) return null;
  if (range.min !== null && range.max !== null) return (range.min + range.max) / 2;
  if (range.max !== null) return range.max;
  if (range.min !== null) return range.min;
  return null;
}

export function buildRelativeMetricBars(
  flaps: FlapRecord[],
  accessor: (f: FlapRecord) => NumericRange | null | undefined
): NumericBarDatum[] {
  const raw = flaps.map((f) => {
    const r = accessor(f);
    const mid = extractRangeMidpoint(r);
    return {
      flapId: f.id,
      min: r?.min ?? null,
      max: r?.max ?? null,
      midpoint: mid,
      isVerify: !r || r.confidence === 'verify' || mid === null,
    };
  });

  const maxPeak = Math.max(
    1,
    ...raw.map((d) => d.max ?? d.midpoint ?? 0)
  );

  return raw.map((d) => ({
    ...d,
    percentOfMax:
      d.midpoint !== null ? Math.max(8, Math.min(100, Math.round((d.midpoint / maxPeak) * 100))) : 0,
  }));
}

export interface ScaledPaddleGeometry {
  flapId: string;
  lengthCm: number | null;
  widthCm: number | null;
  /** Normalized SVG ellipse rx/ry within a 100x64 box using a shared cm scale across all compared flaps */
  rx: number;
  ry: number;
  hasDimensions: boolean;
  isVerify: boolean;
}

export function computeSharedScalePaddles(flaps: FlapRecord[]): ScaledPaddleGeometry[] {
  const entries = flaps.map((f) => {
    const lRange = f.dimensions.max_skin_paddle_cm.length;
    const wRange = f.dimensions.max_skin_paddle_cm.width;
    const l = lRange?.max ?? lRange?.min ?? null;
    const w = wRange?.max ?? wRange?.min ?? null;
    return {
      flapId: f.id,
      lengthCm: l,
      widthCm: w,
      hasDimensions: l !== null && w !== null,
      isVerify: !lRange || !wRange || lRange.confidence === 'verify' || wRange.confidence === 'verify',
    };
  });

  const maxLen = Math.max(10, ...entries.map((e) => e.lengthCm ?? 0));
  const maxWid = Math.max(6, ...entries.map((e) => e.widthCm ?? 0));
  // Shared uniform scale factor (pixels per cm) so relative areas are visually faithful
  const pxPerCm = Math.min(44 / (maxLen / 2), 26 / (maxWid / 2));

  return entries.map((e) => {
    if (!e.hasDimensions || e.lengthCm === null || e.widthCm === null) {
      return { ...e, rx: 0, ry: 0 };
    }
    return {
      ...e,
      rx: Math.max(6, Math.min(44, Number(((e.lengthCm / 2) * pxPerCm).toFixed(1)))),
      ry: Math.max(4, Math.min(26, Number(((e.widthCm / 2) * pxPerCm).toFixed(1)))),
    };
  });
}

export function rowHasDifferences(values: string[]): boolean {
  if (values.length <= 1) return true;
  const normalized = values.map((v) => v.trim().toLowerCase());
  return new Set(normalized).size > 1;
}
