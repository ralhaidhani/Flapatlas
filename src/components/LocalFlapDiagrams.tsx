import React from 'react';
import {
  BilobedFlapResult,
  KeystoneFlapResult,
  RhomboidFlapResult,
  SerialZPlastyResult,
} from '../engine/localFlapCalc';

interface ZPlastyDiagramProps {
  result: SerialZPlastyResult;
  transposed: boolean;
}

export const SerialZPlastyDiagram: React.FC<ZPlastyDiagramProps> = ({ result, transposed }) => {
  const { angleDeg, unitCount, totalScarCm, theoreticalGainPercent, newTotalLengthCm, scarRotationDeg } = result;
  const rad = (angleDeg * Math.PI) / 180;
  const cx = 180;
  const topY = 38;
  const totalPx = 150;
  const unitPx = totalPx / unitCount;

  return (
    <svg
      viewBox="0 0 360 240"
      className="w-full h-60 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
      data-testid="local-flap-svg"
      role="img"
      aria-label="Z-plasty geometric incision and transposition diagram"
    >
      {/* Reference lengthening axis */}
      <line x1={cx} y1={14} x2={cx} y2={226} stroke="currentColor" strokeOpacity="0.16" strokeDasharray="4 4" />

      {!transposed ? (
        <>
          {Array.from({ length: unitCount }).map((_, idx) => {
            const y0 = topY + idx * unitPx;
            const y1 = y0 + unitPx;
            const lx = cx - Math.sin(rad) * unitPx;
            const ly = y0 + Math.cos(rad) * unitPx;
            const rx = cx + Math.sin(rad) * unitPx;
            const ry = y1 - Math.cos(rad) * unitPx;
            return (
              <g key={idx}>
                <polygon points={`${cx},${y0} ${cx},${y1} ${lx},${ly}`} fill="rgba(15, 118, 110, 0.22)" />
                <polygon points={`${cx},${y0} ${cx},${y1} ${rx},${ry}`} fill="rgba(2, 132, 199, 0.22)" />
                <line x1={cx} y1={y0} x2={cx} y2={y1} stroke="#dc2626" strokeWidth="3" />
                <line x1={cx} y1={y0} x2={lx} y2={ly} stroke="#0f766e" strokeWidth="2.4" strokeDasharray="5 3" />
                <line x1={cx} y1={y1} x2={rx} y2={ry} stroke="#0284c7" strokeWidth="2.4" strokeDasharray="5 3" />
              </g>
            );
          })}
          <text x={18} y={24} fontSize="10.5" fontWeight="600" fill="#dc2626">
            Contracture Scar ({totalScarCm} cm) · {unitCount}× {angleDeg}° Z-Plasty
          </text>
          <text x={18} y={224} fontSize="10" fill="currentColor" fillOpacity="0.72">
            Dashed lines = lateral limbs ({result.unitLimbLengthCm} cm each)
          </text>
        </>
      ) : (
        <>
          {Array.from({ length: unitCount }).map((_, idx) => {
            const gainScale = Math.min(1.45, 1 + theoreticalGainPercent / 200);
            const scaledTotal = Math.min(190, totalPx * gainScale);
            const startY = 120 - scaledTotal / 2;
            const segH = scaledTotal / unitCount;
            const y0 = startY + idx * segH;
            const ym = y0 + segH / 2;
            const y1 = y0 + segH;
            const dx = Math.max(18, Math.min(54, Math.sin(rad) * segH * 0.55));
            return (
              <g key={idx}>
                <polygon points={`${cx},${y0} ${cx - dx},${ym} ${cx + dx},${ym}`} fill="rgba(2, 132, 199, 0.24)" />
                <polygon points={`${cx},${y1} ${cx - dx},${ym} ${cx + dx},${ym}`} fill="rgba(15, 118, 110, 0.24)" />
                <polyline
                  points={`${cx},${y0} ${cx - dx},${ym} ${cx + dx},${ym} ${cx},${y1}`}
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="2.6"
                />
              </g>
            );
          })}
          <text x={18} y={22} fontSize="10.5" fontWeight="600" fill="#0f766e">
            Lengthened Axis: {newTotalLengthCm} cm (+{theoreticalGainPercent}%)
          </text>
          <text x={18} y={226} fontSize="10" fill="currentColor" fillOpacity="0.72">
            Central limbs reoriented {scarRotationDeg}° · Transverse tension {Math.round(result.transverseTensionReductionFactor * 100)}% of single Z
          </text>
        </>
      )}
    </svg>
  );
};

interface RhomboidDiagramProps {
  result: RhomboidFlapResult;
  transposed: boolean;
}

export const RhomboidFlapDiagram: React.FC<RhomboidDiagramProps> = ({ result, transposed }) => {
  const isLimberg = result.variant === 'limberg';
  const cx = 135;
  const cy = 122;
  const s = 62;
  const h = s * Math.sin((60 * Math.PI) / 180);
  // 60/120 rhombus centered at (cx, cy): top/bottom 60 deg, left/right 120 deg
  const top = { x: cx, y: cy - h };
  const bot = { x: cx, y: cy + h };
  const left = { x: cx - s / 2, y: cy };
  const right = { x: cx + s / 2, y: cy };

  // Limberg flap off right 120° corner vs Dufourmentel bisected limb
  const extX = isLimberg ? right.x + s : right.x + s * 0.88;
  const extY = isLimberg ? right.y : right.y - s * 0.28;
  const backX = isLimberg ? extX - s / 2 : extX - s * 0.22;
  const backY = isLimberg ? extY + h : extY + s * 0.94;

  return (
    <svg
      viewBox="0 0 360 240"
      className="w-full h-60 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
      data-testid="local-flap-svg"
      role="img"
      aria-label="Rhomboid Limberg or Dufourmentel transposition diagram"
    >
      {/* LME / RSTL guide */}
      <line x1="25" y1="32" x2="105" y2="32" stroke="#0284c7" strokeWidth="1.8" strokeDasharray="3 3" />
      <text x="112" y="36" fontSize="9.5" fill="#0284c7" fontWeight="600">
        LME (Secondary Closure Vector)
      </text>

      {!transposed ? (
        <>
          {/* Rhomboid Defect */}
          <polygon
            points={`${top.x},${top.y} ${right.x},${right.y} ${bot.x},${bot.y} ${left.x},${left.y}`}
            fill="rgba(220,38,38,0.2)"
            stroke="#dc2626"
            strokeWidth="2.5"
          />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#dc2626">
            Defect
          </text>
          <text x={cx} y={cy + 18} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.75">
            {result.sideLengthCm} cm sides
          </text>

          {/* Short diagonal */}
          <line x1={left.x} y1={left.y} x2={right.x} y2={right.y} stroke="#dc2626" strokeOpacity="0.45" strokeDasharray="3 3" />

          {/* Flap territory */}
          <polygon
            points={`${right.x},${right.y} ${extX},${extY} ${backX},${backY} ${bot.x},${bot.y}`}
            fill="rgba(15,118,110,0.24)"
          />
          <polyline
            points={`${right.x},${right.y} ${extX},${extY} ${backX},${backY}`}
            fill="none"
            stroke="#0f766e"
            strokeWidth="2.6"
            strokeDasharray="6 3"
          />
          <text x={(right.x + extX) / 2 + 4} y={cy + 16} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0f766e">
            {isLimberg ? 'Limberg Flap' : 'Dufourmentel'}
          </text>
          <text x="20" y="222" fontSize="9.5" fill="currentColor" fillOpacity="0.72">
            60° / 120° rhombus · Short diagonal = {result.shortDiagonalCm} cm · Area ≈ {result.defectAreaCm2} cm²
          </text>
        </>
      ) : (
        <>
          {/* Transposed flap covering defect + closed secondary scar */}
          <polygon
            points={`${top.x},${top.y} ${right.x},${right.y} ${bot.x},${bot.y} ${left.x},${left.y}`}
            fill="rgba(15,118,110,0.28)"
            stroke="#0f766e"
            strokeWidth="2.4"
          />
          {/* Closed secondary donor seam */}
          <line x1={right.x} y1={right.y} x2={backX} y2={backY} stroke="#0284c7" strokeWidth="3.2" />
          <line x1={right.x + 28} y1={cy + 26} x2={right.x + 76} y2={cy + 26} stroke="#0284c7" strokeWidth="2" markerEnd="url(#arrow)" />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0f766e">
            Transposed
          </text>
          <text x={backX + 12} y={backY - 12} fontSize="10" fontWeight="600" fill="#0284c7">
            Primary donor seam
          </text>
          <text x={backX + 12} y={backY + 2} fontSize="9" fill="currentColor" fillOpacity="0.75">
            (Max tension line aligned to LME)
          </text>
          <text x="20" y="222" fontSize="9.5" fill="#0f766e" fontWeight="600">
            Inset complete — geometric broken-line scar minimizes free-margin distortion
          </text>
        </>
      )}
    </svg>
  );
};

interface BilobedDiagramProps {
  result: BilobedFlapResult;
  transposed: boolean;
}

export const BilobedFlapDiagram: React.FC<BilobedDiagramProps> = ({ result, transposed }) => {
  const pivot = { x: 112, y: 158 };
  const rDefect = 28;
  const r1 = 28; // 100% diameter
  const r2 = 22.5; // 80% diameter
  const dCenter = { x: 174, y: 158 };
  const l1Center = { x: 156, y: 108 };
  const l2Center = { x: 112, y: 84 };

  return (
    <svg
      viewBox="0 0 360 240"
      className="w-full h-60 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
      data-testid="local-flap-svg"
      role="img"
      aria-label="Zitelli 90 degree bilobed flap geometric diagram"
    >
      {/* 90-degree arc guide */}
      <path
        d={`M ${dCenter.x} ${dCenter.y} A 62 62 0 0 0 ${l2Center.x} ${l2Center.y - 12}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeDasharray="4 4"
      />
      <circle cx={pivot.x} cy={pivot.y} r="3.5" fill="#0f766e" />
      <text x={pivot.x - 42} y={pivot.y + 18} fontSize="9.5" fill="currentColor" fillOpacity="0.75">
        Pivot (90° arc)
      </text>

      {!transposed ? (
        <>
          {/* Burow cone */}
          <polygon
            points={`${pivot.x},${pivot.y} ${dCenter.x - rDefect + 2},${dCenter.y - 12} ${dCenter.x - rDefect + 2},${dCenter.y + 12}`}
            fill="rgba(245,158,11,0.25)"
            stroke="#d97706"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          {/* Primary Defect */}
          <circle cx={dCenter.x} cy={dCenter.y} r={rDefect} fill="rgba(220,38,38,0.22)" stroke="#dc2626" strokeWidth="2.5" />
          <text x={dCenter.x} y={dCenter.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#dc2626">
            Defect
          </text>

          {/* Primary Lobe (45 deg, 100% diameter) */}
          <circle cx={l1Center.x} cy={l1Center.y} r={r1} fill="rgba(15,118,110,0.24)" stroke="#0f766e" strokeWidth="2.2" strokeDasharray="5 3" />
          <text x={l1Center.x} y={l1Center.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f766e">
            Lobe 1 (45°)
          </text>

          {/* Secondary Lobe (90 deg, 80% diameter) */}
          <circle cx={l2Center.x} cy={l2Center.y} r={r2} fill="rgba(2,132,199,0.24)" stroke="#0284c7" strokeWidth="2.2" strokeDasharray="5 3" />
          <text x={l2Center.x} y={l2Center.y + 3} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0284c7">
            Lobe 2
          </text>

          <text x="220" y="64" fontSize="10" fontWeight="600" fill="#0f766e">
            Lobe 1 = {result.primaryLobeDiameterCm} cm (100%)
          </text>
          <text x="220" y="82" fontSize="10" fontWeight="600" fill="#0284c7">
            Lobe 2 = {result.secondaryLobeDiameterCm} cm (80%)
          </text>
          <text x="220" y="100" fontSize="9.5" fill="#d97706">
            Burow cone ≈ {result.burowConeLengthCm} cm
          </text>
          <text x="18" y="224" fontSize="9.5" fill="currentColor" fillOpacity="0.72">
            Zitelli 90° total arc prevents nasal alar retraction & standing-cone dog-ears
          </text>
        </>
      ) : (
        <>
          {/* Transposed Lobe 1 in defect, Lobe 2 in Lobe 1 bed, Linear closure at Lobe 2 */}
          <circle cx={dCenter.x} cy={dCenter.y} r={rDefect} fill="rgba(15,118,110,0.3)" stroke="#0f766e" strokeWidth="2.4" />
          <text x={dCenter.x} y={dCenter.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f766e">
            Lobe 1 Inset
          </text>

          <circle cx={l1Center.x} cy={l1Center.y} r={r2 + 2} fill="rgba(2,132,199,0.28)" stroke="#0284c7" strokeWidth="2.2" />
          <text x={l1Center.x} y={l1Center.y + 4} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0284c7">
            Lobe 2 Inset
          </text>

          <line x1={l2Center.x - 16} y1={l2Center.y - 16} x2={l2Center.x + 16} y2={l2Center.y + 14} stroke="#0284c7" strokeWidth="3" />
          <text x={l2Center.x + 22} y={l2Center.y - 8} fontSize="9.5" fontWeight="600" fill="#0284c7">
            Primary linear closure
          </text>
          <text x="18" y="224" fontSize="9.5" fontWeight="600" fill="#0f766e">
            Secondary bed closed first; Lobe 1 fills distal defect tension-free
          </text>
        </>
      )}
    </svg>
  );
};

interface KeystoneDiagramProps {
  result: KeystoneFlapResult;
  transposed: boolean;
}

export const KeystoneFlapDiagram: React.FC<KeystoneDiagramProps> = ({ result, transposed }) => {
  const isDouble = result.behanType === 'III';
  const showStsg = result.behanType === 'IIB';

  return (
    <svg
      viewBox="0 0 360 240"
      className="w-full h-60 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
      data-testid="local-flap-svg"
      role="img"
      aria-label="Keystone Design Perforator Island Flap geometric diagram"
    >
      {!transposed ? (
        <>
          {/* Elliptical Defect */}
          <ellipse cx="180" cy={isDouble ? 120 : 88} rx="78" ry="24" fill="rgba(220,38,38,0.22)" stroke="#dc2626" strokeWidth="2.4" />
          <text x="180" y={isDouble ? 124 : 92} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#dc2626">
            Defect ({result.defectLengthCm} × {result.defectWidthCm} cm)
          </text>

          {/* Primary Keystone Island (inferior) */}
          <path
            d={
              isDouble
                ? 'M 102 120 L 76 178 Q 180 202 284 178 L 258 120 Q 180 146 102 120 Z'
                : 'M 102 88 L 72 158 Q 180 190 288 158 L 258 88 Q 180 114 102 88 Z'
            }
            fill="rgba(15,118,110,0.22)"
            stroke="#0f766e"
            strokeWidth="2.4"
            strokeDasharray="6 3"
          />

          {/* Central Perforator Hotspots (preserved) */}
          <circle cx="156" cy={isDouble ? 156 : 138} r="4.2" fill="#dc2626" />
          <circle cx="180" cy={isDouble ? 160 : 143} r="4.2" fill="#dc2626" />
          <circle cx="204" cy={isDouble ? 156 : 138} r="4.2" fill="#dc2626" />
          <text x="180" y={isDouble ? 208 : 196} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#0f766e">
            1:1 Keystone Island (Width {result.flapWidthCm} cm) · Intact Perforators
          </text>

          {/* Optional Double Opposing Keystone (Behan Type III) */}
          {isDouble && (
            <path
              d="M 102 120 L 76 62 Q 180 38 284 62 L 258 120 Q 180 94 102 120 Z"
              fill="rgba(2,132,199,0.22)"
              stroke="#0284c7"
              strokeWidth="2.4"
              strokeDasharray="6 3"
            />
          )}

          <text x="18" y="22" fontSize="10" fontWeight="600" fill="currentColor">
            Behan Type {result.behanType} · 90° lateral limbs → dual V-Y end closure
          </text>
          <text x="18" y="228" fontSize="9.5" fill="currentColor" fillOpacity="0.72">
            {result.fascialDivisionRequired ? 'Outer deep fascia divided for extra mobility' : 'Deep fascia left intact'}
            {showStsg ? ' · STSG planned on outer secondary bed' : ''}
          </text>
        </>
      ) : (
        <>
          {/* Advanced Keystone closing defect with Dual V-Y stems */}
          <path
            d="M 96 112 Q 180 80 264 112 Q 180 154 96 112 Z"
            fill="rgba(15,118,110,0.28)"
            stroke="#0f766e"
            strokeWidth="2.5"
          />
          {/* Dual V-Y stems at left and right ends */}
          <line x1="56" y1="112" x2="96" y2="112" stroke="#0284c7" strokeWidth="3" />
          <line x1="264" y1="112" x2="304" y2="112" stroke="#0284c7" strokeWidth="3" />
          <text x="76" y="102" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0284c7">V-Y</text>
          <text x="284" y="102" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0284c7">V-Y</text>

          <text x="180" y="116" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0f766e">
            Keystone Advanced
          </text>

          {showStsg && (
            <>
              <path
                d="M 122 152 Q 180 176 238 152 Q 180 162 122 152 Z"
                fill="rgba(245,158,11,0.32)"
                stroke="#d97706"
                strokeWidth="1.8"
              />
              <text x="180" y="184" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#d97706">
                Secondary Bed Covered with STSG (Type IIB)
              </text>
            </>
          )}

          <text x="18" y="224" fontSize="9.5" fontWeight="600" fill="#0f766e">
            Dual V-Y closures at ends convert longitudinal laxity into transverse advancement
          </text>
        </>
      )}
    </svg>
  );
};
