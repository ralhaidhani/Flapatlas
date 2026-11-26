import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { z } from 'zod';
import type { DatasetAuditReport, FlapRecord } from '../types/schemas';

/**
 * Phase 11e (§6) — Optional, Local-Only Doppler / CTA Perforator Planner.
 *
 * Strict privacy & clinical honesty rules:
 * - Stored strictly locally in IndexedDB (`flapatlas-doppler-planner-markers-v1`).
 * - NO PHI, NO patient identifiers, NO network transmission.
 * - Pure user input for DIEP grid coding fields (Fig. 23.48C, p. 339):
 *   R/L side, distance from midline (mm), distance inferior to umbilicus (mm), perforator size (mm).
 * - The app performs NO automated measurement calculations and emits NO clinical recommendations.
 * - Exportable directly into the existing verification audit CSV.
 */

export const DOPPLER_PLANNER_IDB_KEY = 'flapatlas-doppler-planner-markers-v1';

export const DOPPLER_PLANNER_NOTICE =
  'Local browser storage only (IndexedDB) — no PHI or patient identifiers. Pure user input; no automated calculations or clinical recommendations.';

export const DopplerPlannerModalitySchema = z.enum([
  'CTA',
  'Color Duplex',
  'Handheld Doppler',
  'Other',
]);

export type DopplerPlannerModality = z.infer<typeof DopplerPlannerModalitySchema>;

export const DopplerPlannerMarkerSchema = z.object({
  id: z.string().min(1),
  createdAtIso: z.string().min(1),
  label: z.string().max(48),
  side: z.enum(['R', 'L']),
  /** Pure user input (mm from midline); never auto-computed */
  midlineMm: z.string().max(24),
  /** Pure user input (mm inferior to umbilicus); never auto-computed */
  inferiorUmbilicusMm: z.string().max(24),
  /** Pure user input (perforator caliber in mm); never auto-computed */
  sizeMm: z.string().max(24),
  modality: DopplerPlannerModalitySchema,
  notes: z.string().max(160),
  /** Surface point in BP3D world metres where the user tapped to place the pin */
  worldPos: z.tuple([z.number(), z.number(), z.number()]),
  /** Outward surface normal for orienting the pin */
  worldNormal: z.tuple([z.number(), z.number(), z.number()]),
});

export type DopplerPlannerMarker = z.infer<typeof DopplerPlannerMarkerSchema>;

export interface CreateDopplerMarkerInput {
  worldPos: [number, number, number];
  worldNormal: [number, number, number];
  label?: string;
  side?: 'R' | 'L';
  midlineMm?: string;
  inferiorUmbilicusMm?: string;
  sizeMm?: string;
  modality?: DopplerPlannerModality;
  notes?: string;
}

/**
 * Creates a pure user-input planner marker.
 * Deliberately leaves DIEP grid fields empty unless explicitly supplied by the user —
 * never infers mm distances or caliber from the 3-D reference mesh.
 */
export function createDopplerPlannerMarker(
  input: CreateDopplerMarkerInput,
  existingCount = 0
): DopplerPlannerMarker {
  // Default side radio only to R/L based on BP3D side hint if omitted, never computing any mm measurement
  const defaultSide: 'R' | 'L' = input.side ?? (input.worldPos[0] >= 0 ? 'L' : 'R');

  return DopplerPlannerMarkerSchema.parse({
    id: `dp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAtIso: new Date().toISOString(),
    label: (input.label ?? `Marker #${existingCount + 1}`).slice(0, 48),
    side: defaultSide,
    midlineMm: (input.midlineMm ?? '').trim().slice(0, 24),
    inferiorUmbilicusMm: (input.inferiorUmbilicusMm ?? '').trim().slice(0, 24),
    sizeMm: (input.sizeMm ?? '').trim().slice(0, 24),
    modality: input.modality ?? 'CTA',
    notes: (input.notes ?? '').slice(0, 160),
    worldPos: [
      Number(input.worldPos[0].toFixed(4)),
      Number(input.worldPos[1].toFixed(4)),
      Number(input.worldPos[2].toFixed(4)),
    ],
    worldNormal: [
      Number(input.worldNormal[0].toFixed(4)),
      Number(input.worldNormal[1].toFixed(4)),
      Number(input.worldNormal[2].toFixed(4)),
    ],
  });
}

// Graceful in-memory fallback for non-browser / test environments
let memoryFallbackMarkers: DopplerPlannerMarker[] = [];

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function loadDopplerPlannerMarkers(): Promise<DopplerPlannerMarker[]> {
  if (!hasIndexedDb()) {
    return [...memoryFallbackMarkers];
  }
  try {
    const raw = await idbGet<unknown>(DOPPLER_PLANNER_IDB_KEY);
    if (!Array.isArray(raw)) return [];
    const parsed: DopplerPlannerMarker[] = [];
    for (const item of raw) {
      const res = DopplerPlannerMarkerSchema.safeParse(item);
      if (res.success) parsed.push(res.data);
    }
    return parsed;
  } catch {
    return [];
  }
}

export async function saveDopplerPlannerMarkers(markers: DopplerPlannerMarker[]): Promise<void> {
  const validated = markers.map((m) => DopplerPlannerMarkerSchema.parse(m));
  if (!hasIndexedDb()) {
    memoryFallbackMarkers = [...validated];
    return;
  }
  try {
    await idbSet(DOPPLER_PLANNER_IDB_KEY, validated);
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export async function clearStoredDopplerPlannerMarkers(): Promise<void> {
  if (!hasIndexedDb()) {
    memoryFallbackMarkers = [];
    return;
  }
  try {
    await idbDel(DOPPLER_PLANNER_IDB_KEY);
  } catch {
    // Ignore
  }
}

function escapeCsvCell(value: string): string {
  const safe = String(value ?? '');
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Serializes local Doppler / CTA planner markers into RFC-4180 CSV rows
 * matching Fig. 23.48C DIEP grid coding (pure user input, no PHI).
 */
export function serializeDopplerMarkersCsv(markers: readonly DopplerPlannerMarker[]): string {
  const header = [
    'Marker ID',
    'Label',
    'Side (R/L)',
    'Midline Distance (mm, user input)',
    'Inferior to Umbilicus (mm, user input)',
    'Perforator Size (mm, user input)',
    'Modality',
    'Notes (No PHI)',
    'Created At',
  ];
  const rows = markers.map((m) =>
    [
      escapeCsvCell(m.id),
      escapeCsvCell(m.label),
      escapeCsvCell(m.side),
      escapeCsvCell(m.midlineMm),
      escapeCsvCell(m.inferiorUmbilicusMm),
      escapeCsvCell(m.sizeMm),
      escapeCsvCell(m.modality),
      escapeCsvCell(m.notes),
      escapeCsvCell(m.createdAtIso),
    ].join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

/**
 * Builds the unified verification audit CSV, preserving the existing flap verification table
 * and appending the optional local Doppler / CTA Planner markers section when present.
 */
export function buildCombinedAuditCsv(
  flaps: readonly FlapRecord[],
  audit: DatasetAuditReport,
  plannerMarkers: readonly DopplerPlannerMarker[]
): string {
  const header = ['Flap ID', 'Flap Name', 'Region', 'Status', 'Last Reviewed', 'Fields Marked Verify'];
  const rows = flaps.map((f) => {
    const entry = audit.verifyBreakdownByFlap.find((r) => r.flapId === f.id);
    return [
      f.id,
      `"${f.name.replace(/"/g, '""')}"`,
      `"${f.region_group}"`,
      `"${f.verification_status}"`,
      f.last_reviewed || 'Never',
      `"${(entry?.verifyFields || ['None']).join('; ')}"`,
    ].join(',');
  });

  const baseCsv = [header.join(','), ...rows].join('\n');
  if (plannerMarkers.length === 0) {
    return baseCsv;
  }

  return [
    baseCsv,
    '',
    '"# Doppler / CTA Perforator Planner Markers (Local only · No PHI · Pure user input · Fig 23.48C DIEP grid coding)"',
    serializeDopplerMarkersCsv(plannerMarkers),
  ].join('\n');
}
