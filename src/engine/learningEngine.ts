import type { FlapRecord, QuizQuestion, VesselRecord } from '../types/schemas';

export type SrsRating = 'again' | 'hard' | 'good' | 'easy';

export interface FlashcardProgress {
  flapId: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  dueDateIso: string; // YYYY-MM-DD
  lastReviewedIso: string;
}

export interface QuizQuestionHistory {
  attempts: number;
  correct: number;
  lastCorrect: boolean;
  lastAnsweredIso: string;
}

export interface TopicAnalyticsRow {
  topic: string;
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
  accuracyPct: number | null;
  status: 'unstarted' | 'weak' | 'developing' | 'strong';
}

export interface AnatomySpotterChallenge {
  id: string;
  targetType: 'flap' | 'vessel';
  targetFlapId: string;
  targetVesselId?: string;
  cameraPreset: string;
  prompt: string;
  clue: string;
  options: Array<{ id: string; label: string; subtitle: string }>;
  correctId: string;
  explanation: string;
}

export interface PhiWarning {
  category: string;
  matchHint: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addDaysIso(baseIsoDate: string, days: number): string {
  const base = new Date(`${baseIsoDate.slice(0, 10)}T00:00:00Z`);
  const next = new Date(base.getTime() + Math.max(0, Math.round(days)) * MS_PER_DAY);
  return next.toISOString().slice(0, 10);
}

/**
 * SM-2 adapted spaced repetition scheduler for surgical flap flashcards.
 * Deterministic and pure for unit testing.
 */
export function scheduleFlashcardReview(
  flapId: string,
  prev: FlashcardProgress | undefined,
  rating: SrsRating,
  todayIso: string
): FlashcardProgress {
  const today = todayIso.slice(0, 10);
  const prevEase = prev?.easeFactor ?? 2.5;
  const prevReps = prev?.repetitions ?? 0;
  const prevInterval = prev?.intervalDays ?? 0;
  const prevLapses = prev?.lapses ?? 0;

  let nextEase = prevEase;
  let nextReps = prevReps;
  let nextInterval = prevInterval;
  let nextLapses = prevLapses;

  if (rating === 'again') {
    nextReps = 0;
    nextInterval = 0; // Due immediately / same day re-queue
    nextEase = Math.max(1.3, Number((prevEase - 0.2).toFixed(2)));
    nextLapses = prevLapses + 1;
  } else if (rating === 'hard') {
    nextReps = Math.max(1, prevReps + 1);
    nextInterval = prevInterval === 0 ? 1 : Math.max(1, Math.round(prevInterval * 1.2));
    nextEase = Math.max(1.3, Number((prevEase - 0.15).toFixed(2)));
  } else if (rating === 'good') {
    nextReps = prevReps + 1;
    if (prevReps === 0) {
      nextInterval = 1;
    } else if (prevReps === 1) {
      nextInterval = 4;
    } else {
      nextInterval = Math.max(2, Math.round(prevInterval * prevEase));
    }
    nextEase = Number(Math.min(2.8, prevEase).toFixed(2));
  } else {
    // easy
    nextReps = prevReps + 1;
    if (prevReps === 0) {
      nextInterval = 4;
    } else if (prevReps === 1) {
      nextInterval = 7;
    } else {
      nextInterval = Math.max(4, Math.round(prevInterval * prevEase * 1.3));
    }
    nextEase = Number(Math.min(2.8, prevEase + 0.15).toFixed(2));
  }

  return {
    flapId,
    intervalDays: nextInterval,
    easeFactor: nextEase,
    repetitions: nextReps,
    lapses: nextLapses,
    dueDateIso: addDaysIso(today, nextInterval),
    lastReviewedIso: today,
  };
}

export function summarizeSrsQueue(
  flapIds: string[],
  progressById: Record<string, FlashcardProgress>,
  todayIso: string
): {
  dueIds: string[];
  unseenCount: number;
  learningCount: number;
  masteredCount: number;
  dueNowCount: number;
} {
  const today = todayIso.slice(0, 10);
  const overdueOrDue: string[] = [];
  const unseen: string[] = [];
  let learningCount = 0;
  let masteredCount = 0;

  for (const id of flapIds) {
    const p = progressById[id];
    if (!p) {
      unseen.push(id);
      continue;
    }
    if (p.intervalDays >= 7 && p.repetitions >= 2) {
      masteredCount++;
    } else {
      learningCount++;
    }
    if (p.dueDateIso <= today) {
      overdueOrDue.push(id);
    }
  }

  // Sort overdue oldest-first
  overdueOrDue.sort((a, b) => {
    const da = progressById[a]?.dueDateIso || today;
    const db = progressById[b]?.dueDateIso || today;
    return da.localeCompare(db);
  });

  return {
    dueIds: [...overdueOrDue, ...unseen],
    unseenCount: unseen.length,
    learningCount,
    masteredCount,
    dueNowCount: overdueOrDue.length + unseen.length,
  };
}

export function computeTopicAnalytics(
  questions: QuizQuestion[],
  historyById: Record<string, QuizQuestionHistory>
): TopicAnalyticsRow[] {
  const byTopic = new Map<
    string,
    { total: number; attempted: number; correct: number }
  >();

  for (const q of questions) {
    const cur = byTopic.get(q.topic) || { total: 0, attempted: 0, correct: 0 };
    cur.total += 1;
    const hist = historyById[q.id];
    if (hist && hist.attempts > 0) {
      cur.attempted += 1;
      if (hist.lastCorrect) {
        cur.correct += 1;
      }
    }
    byTopic.set(q.topic, cur);
  }

  const rows: TopicAnalyticsRow[] = [];
  for (const [topic, stats] of byTopic.entries()) {
    const accuracyPct =
      stats.attempted === 0
        ? null
        : Math.round((stats.correct / stats.attempted) * 100);
    let status: TopicAnalyticsRow['status'] = 'unstarted';
    if (accuracyPct !== null) {
      if (accuracyPct < 60) status = 'weak';
      else if (accuracyPct < 85) status = 'developing';
      else status = 'strong';
    }
    rows.push({
      topic,
      totalQuestions: stats.total,
      attemptedCount: stats.attempted,
      correctCount: stats.correct,
      accuracyPct,
      status,
    });
  }

  // Sort weakest attempted topics first, then unstarted, then strongest
  const rank = { weak: 0, developing: 1, unstarted: 2, strong: 3 };
  return rows.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return a.topic.localeCompare(b.topic);
  });
}

/**
 * Deterministic 3D anatomical spotter challenge generator from the live dataset.
 */
export function buildAnatomyChallengePool(
  flaps: FlapRecord[],
  vessels: VesselRecord[]
): AnatomySpotterChallenge[] {
  const spotterIds = [
    'alt-flap',
    'diep-flap',
    'fibula-flap',
    'ld-flap',
    'rfff-flap',
    'gastrocnemius-flap',
    'pap-flap',
    'paramedian-forehead-flap',
    'pec-major-flap',
    'gracilis-flap',
    'sgap-flap',
    'tdap-flap',
  ];

  const available = spotterIds
    .map((id) => flaps.find((f) => f.id === id))
    .filter((f): f is FlapRecord => Boolean(f));

  const challenges: AnatomySpotterChallenge[] = [];

  available.forEach((target, idx) => {
    const askVessel = idx % 2 === 1;
    // Pick 3 deterministic distractors preferring same or nearby region
    const sameRegion = flaps.filter(
      (f) => f.id !== target.id && f.region_group === target.region_group
    );
    const otherRegion = flaps.filter(
      (f) => f.id !== target.id && f.region_group !== target.region_group
    );
    const pool = [...sameRegion, ...otherRegion];
    const distractors: FlapRecord[] = [];
    for (const candidate of pool) {
      if (distractors.length >= 3) break;
      if (
        askVessel &&
        candidate.vascular_anatomy.dominant_pedicle.artery.toLowerCase() ===
          target.vascular_anatomy.dominant_pedicle.artery.toLowerCase()
      ) {
        continue;
      }
      if (
        askVessel &&
        distractors.some(
          (d) =>
            d.vascular_anatomy.dominant_pedicle.artery.toLowerCase() ===
            candidate.vascular_anatomy.dominant_pedicle.artery.toLowerCase()
        )
      ) {
        continue;
      }
      distractors.push(candidate);
    }

    const rawOptions = [target, ...distractors].map((f) => ({
      id: f.id,
      label: askVessel ? f.vascular_anatomy.dominant_pedicle.artery : f.name,
      subtitle: askVessel
        ? `Origin: ${f.vascular_anatomy.dominant_pedicle.artery_origin}`
        : `${f.region_group} · ${f.flap_type[0] || 'Flap'}`,
    }));

    // Deterministic rotation based on idx so correct answer isn't always option A
    const shift = (idx * 3 + 1) % rawOptions.length;
    const rotated = [
      ...rawOptions.slice(shift),
      ...rawOptions.slice(0, shift),
    ];

    const linkedVessel = vessels.find((v) => v.supplied_flap_ids.includes(target.id));

    challenges.push({
      id: `spotter-${target.id}`,
      targetType: askVessel ? 'vessel' : 'flap',
      targetFlapId: target.id,
      targetVesselId: linkedVessel?.id,
      cameraPreset: target.spec3d.regionId,
      prompt: askVessel
        ? `Inspect the highlighted vascular pedicle and donor territory in the 3D viewport (${target.region}). Which dominant artery supplies this flap?`
        : `Inspect the highlighted skin paddle, perforators, and pedicle trajectory in the 3D viewport (${target.region_group}). Which reconstructive flap is shown?`,
      clue: `Classification: ${target.classification.mathes_nahai || target.classification.cormack_lamberty || target.flap_type[0]} · Key landmark: ${target.technique.landmarks[0] || target.region}`,
      options: rotated,
      correctId: target.id,
      explanation: `${target.name} is supplied by the ${target.vascular_anatomy.dominant_pedicle.artery} (origin: ${target.vascular_anatomy.dominant_pedicle.artery_origin}). ${target.technique.pearls[0] || ''}`,
    });
  });

  return challenges;
}

/**
 * Lightweight client-side zero-PHI guardrail for Case Planner inputs.
 * Flags common identifier patterns (MRN-like numbers, SSNs, DOBs, emails, phone numbers).
 */
export function detectPotentialPhi(text: string): PhiWarning[] {
  const warnings: PhiWarning[] = [];
  const trimmed = text.trim();
  if (!trimmed) return warnings;

  if (/\b\d{3}-\d{2}-\d{4}\b/.test(trimmed)) {
    warnings.push({ category: 'SSN pattern', matchHint: 'XXX-XX-XXXX sequence detected' });
  }
  if (/\b(?:MRN|FIN|Chart|Patient\s*ID|DOB)\s*[:#-]?\s*[A-Z0-9/-]{3,}/i.test(trimmed)) {
    warnings.push({ category: 'Medical record / DOB label', matchHint: 'MRN, Patient ID, or DOB label detected' });
  }
  if (/\b(?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\d|3[01])[/.-](?:19|20)\d{2}\b/.test(trimmed)) {
    warnings.push({ category: 'Calendar date (possible DOB)', matchHint: 'MM/DD/YYYY date format detected' });
  }
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(trimmed)) {
    warnings.push({ category: 'Email address', matchHint: 'Email identifier detected' });
  }
  if (/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(trimmed)) {
    warnings.push({ category: 'Phone number', matchHint: '10-digit telephone pattern detected' });
  }
  if (/\b\d{7,10}\b/.test(trimmed) && !warnings.some((w) => w.category === 'Phone number')) {
    warnings.push({ category: 'Long numeric ID', matchHint: '7–10 digit number (possible MRN) detected' });
  }

  return warnings;
}
