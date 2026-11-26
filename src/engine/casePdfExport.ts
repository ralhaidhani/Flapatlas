import { jsPDF } from 'jspdf';
import type { DefectLocation, FlapRecord } from '../types/schemas';
import { formatRange } from '../types/schemas';

export interface CasePlanExportPayload {
  title: string;
  defectLocation: DefectLocation | undefined;
  defectDimensions: string;
  primaryFlap: FlapRecord;
  backupFlap: FlapRecord | undefined;
  recipientVessel: string;
  positioningOverride: string;
  operativeNotes: string;
  checklistItems: Array<{ text: string; checked: boolean }>;
  unitSystem: 'metric' | 'imperial';
  photoDataUrl?: string | null;
}

/**
 * Generates a crisp, single-page clinical surgical planning sheet PDF (A4 portrait)
 * strictly patient-agnostic with Zero-PHI footer disclaimer.
 */
export function exportCasePlanPdf(payload: CasePlanExportPayload): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 14;

  // Header bar
  doc.setFillColor(15, 118, 110); // Clinical teal
  doc.rect(margin, y, contentW, 1.2, 'F');
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('FLAPATLAS 3D  ·  PATIENT-AGNOSTIC RECONSTRUCTIVE PLANNING SHEET (ZERO PHI)', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated ${new Date().toISOString().slice(0, 10)}`, pageW - margin, y, { align: 'right' });
  y += 6;

  // Title & Flap Headline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(payload.title || `${payload.primaryFlap.name} Plan`, margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const subLine = `Primary Flap: ${payload.primaryFlap.name}   |   Backup: ${payload.backupFlap?.name || 'None'}   |   Status: ${payload.primaryFlap.verification_status}`;
  const splitSub = doc.splitTextToSize(subLine, contentW);
  doc.text(splitSub, margin, y);
  y += splitSub.length * 4.5 + 2;

  // Defect & Recipient Summary Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('DEFECT ZONE', margin + 4, y + 5.5);
  doc.text('DIMENSIONS', margin + 66, y + 5.5);
  doc.text('RECIPIENT VESSELS', margin + 106, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    doc.splitTextToSize(payload.defectLocation ? `${payload.defectLocation.group} — ${payload.defectLocation.label}` : 'Unspecified', 58),
    margin + 4,
    y + 11
  );
  doc.text(payload.defectDimensions || 'Not specified', margin + 66, y + 11);
  doc.text(
    doc.splitTextToSize(payload.recipientVessel || 'Not specified', 72),
    margin + 106,
    y + 11
  );
  y += 25;

  // Two-column Anatomical & Technical Summary
  const colW = (contentW - 6) / 2;
  const leftX = margin;
  const rightX = margin + colW + 6;
  const colStartY = y;

  const ped = payload.primaryFlap.vascular_anatomy.dominant_pedicle;
  const pedLen = formatRange(ped.pedicle_length_cm, payload.unitSystem).text;
  const artDia = formatRange(ped.artery_diameter_mm, payload.unitSystem).text;
  const veinDia = formatRange(ped.vein_diameter_mm, payload.unitSystem).text;
  const maxL = formatRange(payload.primaryFlap.dimensions.max_skin_paddle_cm.length, payload.unitSystem).text;
  const maxW = formatRange(payload.primaryFlap.dimensions.max_skin_paddle_cm.width, payload.unitSystem).text;
  const primW = formatRange(payload.primaryFlap.dimensions.primary_closure_max_width_cm, payload.unitSystem).text;

  // Left Column: Vascular & Dimensions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('VASCULAR & DIMENSIONAL SPECS', leftX, y);
  y += 4.5;

  const specRows: Array<[string, string]> = [
    ['Dominant Artery', `${ped.artery} (${ped.artery_origin})`],
    ['Venous Outflow', ped.veins],
    ['Pedicle Length', pedLen],
    ['Vessel Calibers', `Artery ${artDia}  /  Vein ${veinDia}`],
    ['Max Paddle Size', `${maxL} × ${maxW}`],
    ['Primary Closure', primW],
    ['Positioning', payload.positioningOverride || payload.primaryFlap.technique.patient_positioning],
    ['Donor Closure', payload.primaryFlap.donor_site.closure],
  ];

  let leftY = y;
  specRows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`${k}:`, leftX, leftY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const wrapped = doc.splitTextToSize(v, colW - 28);
    doc.text(wrapped, leftX + 28, leftY);
    leftY += Math.max(4.5, wrapped.length * 3.9 + 1.2);
  });

  // Right Column: Key Landmarks & Pitfalls
  let rightY = colStartY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('LANDMARKS & CRITICAL PITFALLS', rightX, rightY);
  rightY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  payload.primaryFlap.technique.landmarks.slice(0, 4).forEach((lm) => {
    const lines = doc.splitTextToSize(`• ${lm}`, colW);
    doc.text(lines, rightX, rightY);
    rightY += lines.length * 3.8 + 1.1;
  });

  rightY += 1.5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 18, 60);
  payload.primaryFlap.technique.pitfalls.slice(0, 3).forEach((pit) => {
    const lines = doc.splitTextToSize(`! Pitfall: ${pit}`, colW);
    doc.text(lines, rightX, rightY);
    rightY += lines.length * 3.8 + 1.1;
  });

  y = Math.max(leftY, rightY) + 4;

  // Harvest Steps (condensed)
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('HARVEST SEQUENCE SUMMARY', margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  payload.primaryFlap.technique.harvest_steps.slice(0, 6).forEach((step, idx) => {
    const lines = doc.splitTextToSize(`${idx + 1}. ${step}`, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 3.7 + 0.9;
  });

  // Operative Notes & Optional Reference Schematic Thumbnail
  if (payload.operativeNotes.trim() || payload.photoDataUrl) {
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 118, 110);
    doc.text('OPERATIVE PLAN NOTES (NON-IDENTIFIABLE)', margin, y);
    y += 4.5;

    const noteW = payload.photoDataUrl ? contentW - 44 : contentW;
    const noteStartY = y;
    if (payload.operativeNotes.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(payload.operativeNotes.trim(), noteW);
      doc.text(lines.slice(0, 7), margin, y);
      y += Math.min(lines.length, 7) * 4 + 2;
    }

    if (payload.photoDataUrl) {
      try {
        const format = payload.photoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(payload.photoDataUrl, format, pageW - margin - 40, noteStartY - 2, 40, 28);
        y = Math.max(y, noteStartY + 28);
      } catch {
        // Skip unsupported image encoding gracefully
      }
    }
  }

  // Preoperative Readiness Checklist
  y = Math.min(y + 2, 224);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('PREOPERATIVE READINESS CHECKLIST', margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  payload.checklistItems.slice(0, 8).forEach((item) => {
    const box = item.checked ? '[X]' : '[  ]';
    const lines = doc.splitTextToSize(`${box}  ${item.text}`, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 3.8 + 0.9;
  });

  // Footer Disclaimer & Reference
  const primaryRef = payload.primaryFlap.references[0];
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, 276, pageW - margin, 276);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  const refLine = primaryRef
    ? `Reference: ${primaryRef.book} (${primaryRef.edition}) — ${primaryRef.chapter_or_section}${primaryRef.verify ? ' [Verify]' : ''}.`
    : 'Verify against primary reconstructive surgery references.';
  doc.text(doc.splitTextToSize(refLine, contentW), margin, 280);
  doc.text(
    doc.splitTextToSize(
      'Disclaimer: For education and reference only. Anatomical variation is common. Always verify against primary references and confirm with preoperative imaging (CTA / Doppler / MRA) before surgery. Contains zero patient-identifiable information.',
      contentW
    ),
    margin,
    284.5
  );

  const safeSlug = (payload.title || payload.primaryFlap.id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const filename = `FlapAtlas3D_Plan_${safeSlug || 'case'}.pdf`;
  doc.save(filename);
  return filename;
}
