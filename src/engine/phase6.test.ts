import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIFICATIONS,
  GLOSSARY_TERMS,
  INITIAL_FLAPS,
  QUIZ_QUESTIONS,
  VESSELS,
} from '../data/index';
import {
  buildAnatomyChallengePool,
  computeTopicAnalytics,
  detectPotentialPhi,
  scheduleFlashcardReview,
  summarizeSrsQueue,
} from './learningEngine';

test('Phase 6: quiz bank has >= 20 validated board questions with valid related flaps', () => {
  assert.ok(QUIZ_QUESTIONS.length >= 20, `Expected >=20 quiz questions, got ${QUIZ_QUESTIONS.length}`);
  const flapIds = new Set(INITIAL_FLAPS.map((f) => f.id));
  for (const q of QUIZ_QUESTIONS) {
    assert.ok(q.options.length === 4, `Question ${q.id} must have 4 options`);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4, `Question ${q.id} valid correctIndex`);
    if (q.relatedFlapId) {
      assert.ok(flapIds.has(q.relatedFlapId), `Question ${q.id} references unknown flap ${q.relatedFlapId}`);
    }
  }
});

test('Phase 6: glossary has >= 25 canonical terms and 5 classification tables', () => {
  assert.ok(GLOSSARY_TERMS.length >= 25, `Expected >=25 glossary terms, got ${GLOSSARY_TERMS.length}`);
  assert.equal(CLASSIFICATIONS.mathes_nahai.length, 5);
  assert.equal(CLASSIFICATIONS.cormack_lamberty.length, 4);
  assert.equal(CLASSIFICATIONS.nakajima.length, 6);
  assert.ok(CLASSIFICATIONS.gent_consensus.length >= 3);
  assert.equal(CLASSIFICATIONS.reconstructive_ladder.length, 6);
});

test('Phase 6: SM-2 spaced repetition scheduler advances intervals and handles lapses', () => {
  const firstGood = scheduleFlashcardReview('alt-flap', undefined, 'good', '2026-11-19');
  assert.equal(firstGood.intervalDays, 1);
  assert.equal(firstGood.repetitions, 1);
  assert.equal(firstGood.dueDateIso, '2026-11-20');

  const secondGood = scheduleFlashcardReview('alt-flap', firstGood, 'good', '2026-11-20');
  assert.equal(secondGood.intervalDays, 4);
  assert.equal(secondGood.repetitions, 2);
  assert.equal(secondGood.dueDateIso, '2026-11-24');

  const thirdEasy = scheduleFlashcardReview('alt-flap', secondGood, 'easy', '2026-11-24');
  assert.ok(thirdEasy.intervalDays >= 10, `Expected interval >=10, got ${thirdEasy.intervalDays}`);
  assert.ok(thirdEasy.easeFactor > secondGood.easeFactor);

  const lapsed = scheduleFlashcardReview('alt-flap', thirdEasy, 'again', '2026-12-05');
  assert.equal(lapsed.repetitions, 0);
  assert.equal(lapsed.intervalDays, 0);
  assert.equal(lapsed.lapses, 1);
  assert.equal(lapsed.dueDateIso, '2026-12-05');
});

test('Phase 6: SRS queue summary orders due/overdue before unseen and counts mastery', () => {
  const progress = {
    'alt-flap': {
      flapId: 'alt-flap',
      intervalDays: 10,
      easeFactor: 2.5,
      repetitions: 3,
      lapses: 0,
      dueDateIso: '2026-11-29',
      lastReviewedIso: '2026-11-19',
    },
    'diep-flap': {
      flapId: 'diep-flap',
      intervalDays: 1,
      easeFactor: 2.3,
      repetitions: 1,
      lapses: 0,
      dueDateIso: '2026-11-18',
      lastReviewedIso: '2026-11-17',
    },
  };
  const summary = summarizeSrsQueue(['alt-flap', 'diep-flap', 'fibula-flap'], progress, '2026-11-19');
  assert.equal(summary.masteredCount, 1);
  assert.equal(summary.learningCount, 1);
  assert.equal(summary.unseenCount, 1);
  assert.deepEqual(summary.dueIds, ['diep-flap', 'fibula-flap']);
});

test('Phase 6: weak-topic analytics ranks weak attempted topics first', () => {
  const history = {
    'q-1': { attempts: 1, correct: 0, lastCorrect: false, lastAnsweredIso: '2026-11-19T12:00:00Z' },
    'q-2': { attempts: 1, correct: 1, lastCorrect: true, lastAnsweredIso: '2026-11-19T12:00:00Z' },
    'q-13': { attempts: 1, correct: 1, lastCorrect: true, lastAnsweredIso: '2026-11-19T12:00:00Z' },
  };
  const analytics = computeTopicAnalytics(QUIZ_QUESTIONS, history);
  const weakRow = analytics.find((r) => r.topic === 'Lower Extremity Reconstruction');
  const strongRow = analytics.find((r) => r.topic === 'Classifications');
  assert.ok(weakRow && weakRow.status === 'weak' && weakRow.accuracyPct === 0);
  assert.ok(strongRow && strongRow.status === 'strong' && strongRow.accuracyPct === 100);
  assert.equal(analytics[0].status, 'weak');
});

test('Phase 6: 3D anatomy spotter pool generates valid challenges with 4 unique options', () => {
  const pool = buildAnatomyChallengePool(INITIAL_FLAPS, VESSELS);
  assert.ok(pool.length >= 10, `Expected >=10 3D spotter challenges, got ${pool.length}`);
  for (const ch of pool) {
    assert.equal(ch.options.length, 4);
    const ids = new Set(ch.options.map((o) => o.id));
    assert.equal(ids.size, 4, `Challenge ${ch.id} should have 4 distinct options`);
    assert.ok(ids.has(ch.correctId), `Challenge ${ch.id} options must include correctId`);
  }
});

test('Phase 6: Zero-PHI guardrail flags MRN, DOB, SSN, email, and passes clean surgical notes', () => {
  assert.equal(
    detectPotentialPhi('Two-team ALT harvest, 12x7 cm distal tibial defect, end-to-side to posterior tibial artery.').length,
    0
  );
  assert.ok(detectPotentialPhi('MRN: 84920143 two-team harvest').length > 0);
  assert.ok(detectPotentialPhi('DOB 04/12/1972 anterior thigh defect').length > 0);
  assert.ok(detectPotentialPhi('Contact surgeon@hospital.org for graft').length > 0);
  assert.ok(detectPotentialPhi('SSN 123-45-6789').length > 0);
});
