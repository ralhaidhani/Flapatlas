export interface ZPlastyResult {
  angleDeg: number;
  limbLengthCm: number;
  theoreticalGainPercent: number;
  newLengthCm: number;
  absoluteGainCm: number;
  scarRotationDeg: number;
  clinicalNote: string;
}

/**
 * Standard plastic surgery theoretical Z-plasty gain table (Limberg / Furnas / Borges).
 * Interpolates smoothly between canonical textbook angles:
 * 30° -> 25%, 45° -> 50%, 60° -> 75%, 75° -> 100%, 90° -> 120%.
 */
export const Z_PLASTY_REFERENCE_TABLE: ReadonlyArray<{
  angle: number;
  gainPercent: number;
  rotationDeg: number;
  note: string;
}> = [
  { angle: 30, gainPercent: 25, rotationDeg: 45, note: 'Narrow tip — higher tip ischemia risk; modest lengthening.' },
  { angle: 45, gainPercent: 50, rotationDeg: 60, note: 'Good balance when lateral skin laxity is slightly limited.' },
  { angle: 60, gainPercent: 75, rotationDeg: 90, note: 'Classic gold-standard Z-plasty: optimal blood supply & 90° scar reorientation.' },
  { angle: 75, gainPercent: 100, rotationDeg: 105, note: 'High lengthening; requires substantial lateral tension / skin laxity.' },
  { angle: 90, gainPercent: 120, rotationDeg: 120, note: 'Max theoretical gain; very high closing tension & dog-ear risk (rarely used single).' },
];

export function calculateZPlasty(angleDeg: number, limbLengthCm: number): ZPlastyResult {
  const clampedAngle = Math.max(15, Math.min(90, angleDeg));
  const clampedLimb = Math.max(0.5, Math.min(20, limbLengthCm));

  // Piecewise linear interpolation across canonical textbook anchors
  const anchors: Array<[number, number, number]> = [
    [15, 10, 25],
    [30, 25, 45],
    [45, 50, 60],
    [60, 75, 90],
    [75, 100, 105],
    [90, 120, 120],
  ];

  let gainPercent = 75;
  let rotationDeg = 90;

  for (let i = 0; i < anchors.length - 1; i++) {
    const [a0, g0, r0] = anchors[i];
    const [a1, g1, r1] = anchors[i + 1];
    if (clampedAngle >= a0 && clampedAngle <= a1) {
      const t = (clampedAngle - a0) / (a1 - a0);
      gainPercent = Math.round(g0 + t * (g1 - g0));
      rotationDeg = Math.round(r0 + t * (r1 - r0));
      break;
    }
  }

  const absoluteGainCm = Number(((clampedLimb * gainPercent) / 100).toFixed(2));
  const newLengthCm = Number((clampedLimb + absoluteGainCm).toFixed(2));

  let clinicalNote = 'Classic 60° Z-plasty maximizes lengthening-to-tension ratio and reorients scar 90° into RSTLs.';
  if (clampedAngle < 40) {
    clinicalNote = 'Acute tip angle (<40°) increases risk of distal flap tip necrosis despite easy transposition.';
  } else if (clampedAngle > 70) {
    clinicalNote = 'Wide angle (>70°) creates high lateral closing tension and standing cones; consider multiple serial 60° Z-plasties.';
  } else if (clampedAngle < 55) {
    clinicalNote = 'Moderate lengthening with lower lateral tension; useful in tight skin zones (digits, eyelids).';
  }

  return {
    angleDeg: clampedAngle,
    limbLengthCm: clampedLimb,
    theoreticalGainPercent: gainPercent,
    newLengthCm,
    absoluteGainCm,
    scarRotationDeg: rotationDeg,
    clinicalNote,
  };
}
