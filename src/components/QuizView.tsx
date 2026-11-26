import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Box,
  CheckCircle2,
  Layers,
  RotateCcw,
  Target,
  XCircle,
} from 'lucide-react';
import { QUIZ_QUESTIONS, VESSELS } from '../data/index';
import {
  buildAnatomyChallengePool,
  computeTopicAnalytics,
  SrsRating,
  summarizeSrsQueue,
} from '../engine/learningEngine';
import { useAtlasStore } from '../store/useAtlasStore';
import { Viewer3D } from './Viewer3D';

type QuizMode = 'quiz' | 'spotter3d' | 'flashcards' | 'analytics';

export const QuizView: React.FC = () => {
  const flaps = useAtlasStore((s) => s.flaps);
  const quizHistory = useAtlasStore((s) => s.quizHistory);
  const flashcardProgress = useAtlasStore((s) => s.flashcardProgress);
  const recordQuizAnswer = useAtlasStore((s) => s.recordQuizAnswer);
  const resetQuizHistory = useAtlasStore((s) => s.resetQuizHistory);
  const reviewFlashcard = useAtlasStore((s) => s.reviewFlashcard);
  const resetFlashcardProgress = useAtlasStore((s) => s.resetFlashcardProgress);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const setShow3DLabels = useAtlasStore((s) => s.setShow3DLabels);
  const setDissectionPeel = useAtlasStore((s) => s.setDissectionPeel);

  const [mode, setMode] = useState<QuizMode>('quiz');
  const [topicFilter, setTopicFilter] = useState<string>('All');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Resident' | 'Fellow' | 'Board'>('All');
  const [idx, setIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);

  // 3D Spotter state
  const [spotterIdx, setSpotterIdx] = useState(0);
  const [spotterSelectedId, setSpotterSelectedId] = useState<string | null>(null);
  const [spotterScore, setSpotterScore] = useState({ correct: 0, total: 0 });

  // Spaced-Repetition Flashcard state
  const [cardRegion, setCardRegion] = useState<string>('All');
  const [cardOffset, setCardOffset] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const topics = useMemo(() => {
    const unique = Array.from(new Set(QUIZ_QUESTIONS.map((q) => q.topic))).sort();
    return ['All', 'Weak / Missed', ...unique];
  }, []);

  const topicAnalytics = useMemo(
    () => computeTopicAnalytics(QUIZ_QUESTIONS, quizHistory),
    [quizHistory]
  );

  const filteredQuestions = useMemo(() => {
    return QUIZ_QUESTIONS.filter((q) => {
      if (difficultyFilter !== 'All' && q.difficulty !== difficultyFilter) return false;
      if (topicFilter === 'Weak / Missed') {
        const h = quizHistory[q.id];
        return Boolean(h && !h.lastCorrect);
      }
      if (topicFilter !== 'All' && q.topic !== topicFilter) return false;
      return true;
    });
  }, [topicFilter, difficultyFilter, quizHistory]);

  const currentQ = filteredQuestions[idx % Math.max(1, filteredQuestions.length)];

  const totalAttempted = useMemo(
    () => Object.values(quizHistory).filter((h) => h.attempts > 0).length,
    [quizHistory]
  );
  const totalCorrect = useMemo(
    () => Object.values(quizHistory).filter((h) => h.lastCorrect).length,
    [quizHistory]
  );

  // 3D Spotter Pool
  const spotterPool = useMemo(() => buildAnatomyChallengePool(flaps, VESSELS), [flaps]);
  const currentSpotter = spotterPool[spotterIdx % Math.max(1, spotterPool.length)];

  // Sync 3D viewport when entering/stepping through 3D Spotter mode
  useEffect(() => {
    if (mode !== 'spotter3d' || !currentSpotter) return;
    selectFlap(currentSpotter.targetFlapId, true);
    setDissectionPeel(34);
    // Hide 3D labels until user answers so it functions as an authentic anatomy spotter
    setShow3DLabels(spotterSelectedId !== null);
  }, [mode, currentSpotter, spotterSelectedId, selectFlap, setDissectionPeel, setShow3DLabels]);

  // Restore labels when leaving 3D Spotter mode
  useEffect(() => {
    return () => {
      setShow3DLabels(true);
    };
  }, [setShow3DLabels]);

  // Flashcards SRS Queue
  const regionFlaps = useMemo(
    () => (cardRegion === 'All' ? flaps : flaps.filter((f) => f.region_group === cardRegion)),
    [flaps, cardRegion]
  );
  const srsSummary = useMemo(
    () => summarizeSrsQueue(regionFlaps.map((f) => f.id), flashcardProgress, todayIso),
    [regionFlaps, flashcardProgress, todayIso]
  );

  const activeFlashcardId =
    srsSummary.dueIds.length > 0
      ? srsSummary.dueIds[cardOffset % srsSummary.dueIds.length]
      : regionFlaps[cardOffset % Math.max(1, regionFlaps.length)]?.id;
  const flashcardFlap = flaps.find((f) => f.id === activeFlashcardId) || flaps[0];
  const flashcardStats = flashcardFlap ? flashcardProgress[flashcardFlap.id] : undefined;

  const handleSelectOption = (optIndex: number) => {
    if (selectedOpt !== null || !currentQ) return;
    setSelectedOpt(optIndex);
    recordQuizAnswer(currentQ.id, optIndex === currentQ.correctIndex);
  };

  const handleNextQuestion = () => {
    setSelectedOpt(null);
    setIdx((i) => (i + 1) % Math.max(1, filteredQuestions.length));
  };

  const handleSpotterAnswer = (choiceId: string) => {
    if (spotterSelectedId !== null || !currentSpotter) return;
    setSpotterSelectedId(choiceId);
    setShow3DLabels(true);
    setSpotterScore((prev) => ({
      correct: prev.correct + (choiceId === currentSpotter.correctId ? 1 : 0),
      total: prev.total + 1,
    }));
  };

  const handleNextSpotter = () => {
    setSpotterSelectedId(null);
    setSpotterIdx((i) => (i + 1) % Math.max(1, spotterPool.length));
  };

  const handleRateFlashcard = (rating: SrsRating) => {
    if (!flashcardFlap) return;
    reviewFlashcard(flashcardFlap.id, rating);
    setFlipped(false);
    setCardOffset(0);
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-5 bg-[var(--bg-app)]" data-testid="quiz-view">
      {/* Header & Mode Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[var(--accent-primary)] flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 shrink-0" />
            <span>Plastic Surgery Board &amp; Fellowship Learning Center</span>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
            Board Quiz, 3D Spotter &amp; Flashcards
          </h1>
        </div>

        <div className="inline-flex flex-nowrap overflow-x-auto max-w-full shrink-0 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-1 text-xs gap-0.5">
          {(
            [
              { id: 'quiz', label: `Board Cases (${QUIZ_QUESTIONS.length})`, icon: Award },
              { id: 'spotter3d', label: '3D Spotter', icon: Box },
              { id: 'flashcards', label: `Flashcards (${srsSummary.dueNowCount})`, icon: Target },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                data-testid={`quiz-mode-${tab.id}`}
                className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors ${
                  mode === tab.id
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MODE 1: BOARD QUESTIONS & CASE VIGNETTES */}
      {mode === 'quiz' && (
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Filters + Persistent Score Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={topicFilter}
                onChange={(e) => {
                  setTopicFilter(e.target.value);
                  setIdx(0);
                  setSelectedOpt(null);
                }}
                aria-label="Filter quiz by topic"
                className="h-7 px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t === 'All' ? 'All Topics' : t}
                  </option>
                ))}
              </select>

              <select
                value={difficultyFilter}
                onChange={(e) => {
                  setDifficultyFilter(e.target.value as typeof difficultyFilter);
                  setIdx(0);
                  setSelectedOpt(null);
                }}
                aria-label="Filter quiz by difficulty"
                className="h-7 px-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                <option value="All">All Levels</option>
                <option value="Resident">Resident</option>
                <option value="Fellow">Fellow</option>
                <option value="Board">Board</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono tabular-nums font-semibold text-[var(--accent-primary)]" data-testid="quiz-score-readout">
                Mastery: {totalCorrect} / {totalAttempted} ({totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0}%)
              </span>
              {totalAttempted > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    resetQuizHistory();
                    setSelectedOpt(null);
                    setIdx(0);
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
          </div>

          {!currentQ ? (
            <div className="p-8 text-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-2">
              <p>No missed or matching questions in this filter.</p>
              <button
                type="button"
                onClick={() => {
                  setTopicFilter('All');
                  setDifficultyFilter('All');
                  setIdx(0);
                }}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white font-medium"
              >
                Show All {QUIZ_QUESTIONS.length} Questions
              </button>
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>
                  {currentQ.topic} · {currentQ.difficulty} · {currentQ.type === 'case' ? 'Board Case Vignette' : currentQ.type === 'landmark' ? 'Surface Landmark' : 'Core Knowledge'}
                </span>
                <span className="font-mono tabular-nums">
                  {(idx % filteredQuestions.length) + 1} / {filteredQuestions.length}
                </span>
              </div>

              <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
                {currentQ.prompt}
              </p>

              <div className="space-y-2">
                {currentQ.options.map((opt, i) => {
                  const isChosen = selectedOpt === i;
                  const isRight = i === currentQ.correctIndex;
                  let borderCls =
                    'border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:border-[var(--accent-primary)]';
                  if (selectedOpt !== null) {
                    if (isRight) {
                      borderCls = 'border-emerald-600 bg-emerald-500/10 text-[var(--text-primary)]';
                    } else if (isChosen) {
                      borderCls = 'border-rose-600 bg-rose-500/10 text-[var(--text-primary)]';
                    }
                  }
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectOption(i)}
                      disabled={selectedOpt !== null}
                      data-testid={`quiz-option-${i}`}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-colors ${borderCls}`}
                    >
                      <span className="text-[var(--text-primary)]">
                        <span className="font-mono font-semibold mr-2">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {opt}
                      </span>
                      {selectedOpt !== null && isRight && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      {selectedOpt !== null && isChosen && !isRight && (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedOpt !== null && (
                <div className="p-3.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2 text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {selectedOpt === currentQ.correctIndex ? 'Correct · Clinical Rationale' : 'Review · Clinical Rationale'}
                  </div>
                  <p className="text-[var(--text-secondary)] leading-relaxed">{currentQ.explanation}</p>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Reference: {currentQ.referenceNote}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    {currentQ.relatedFlapId ? (
                      <button
                        type="button"
                        onClick={() => {
                          selectFlap(currentQ.relatedFlapId!, true);
                          setActiveTab('library');
                        }}
                        className="text-[var(--accent-primary)] font-medium flex items-center gap-1 hover:underline"
                      >
                        <Layers className="w-3.5 h-3.5" /> Inspect Flap in 3D
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      data-testid="quiz-next-btn"
                      className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white font-medium hover:opacity-95"
                    >
                      Next Question →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: INTERACTIVE 3D MODEL SPOTTER */}
      {mode === 'spotter3d' && currentSpotter && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch" data-testid="spotter-3d-panel">
          <div className="lg:col-span-7 h-[360px] lg:h-[520px] rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-canvas)] relative">
            <Viewer3D spotterBlindMode={spotterSelectedId === null} />
          </div>

          <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>
                  3D {currentSpotter.targetType === 'vessel' ? 'Vessel Identification' : 'Flap Territory Spotter'}
                </span>
                <span className="font-mono tabular-nums">
                  {spotterIdx + 1} / {spotterPool.length} · Score {spotterScore.correct}/{spotterScore.total}
                </span>
              </div>

              <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                {currentSpotter.prompt}
              </p>

              <p className="text-xs text-[var(--text-secondary)] p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                Anatomical Clue: {currentSpotter.clue}
              </p>

              <div className="space-y-2 pt-1">
                {currentSpotter.options.map((opt, i) => {
                  const chosen = spotterSelectedId === opt.id;
                  const right = opt.id === currentSpotter.correctId;
                  let cls =
                    'border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:border-[var(--accent-primary)]';
                  if (spotterSelectedId !== null) {
                    if (right) cls = 'border-emerald-600 bg-emerald-500/10';
                    else if (chosen) cls = 'border-rose-600 bg-rose-500/10';
                  }
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={spotterSelectedId !== null}
                      onClick={() => handleSpotterAnswer(opt.id)}
                      data-testid={`spotter-option-${i}`}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-colors ${cls}`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--text-primary)]">
                          <span className="font-mono mr-1.5">{String.fromCharCode(65 + i)}.</span>
                          {opt.label}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] truncate">
                          {opt.subtitle}
                        </div>
                      </div>
                      {spotterSelectedId !== null && right && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      {spotterSelectedId !== null && chosen && !right && (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {spotterSelectedId !== null && (
                <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
                  {currentSpotter.explanation}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-xs">
              <button
                type="button"
                onClick={() => {
                  selectFlap(currentSpotter.targetFlapId, true);
                  setShow3DLabels(true);
                  setActiveTab('library');
                }}
                className="text-[var(--accent-primary)] font-medium hover:underline"
              >
                Open Full Flap Record
              </button>
              <button
                type="button"
                onClick={handleNextSpotter}
                data-testid="spotter-next-btn"
                className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white font-medium hover:opacity-95"
              >
                Next 3D Specimen →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: SPACED-REPETITION FLASHCARDS (SM-2) */}
      {mode === 'flashcards' && flashcardFlap && (
        <div className="max-w-2xl mx-auto space-y-4" data-testid="srs-flashcards-panel">
          {/* SRS Status Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-[11px] text-[var(--text-muted)]">Due Today</div>
              <div className="text-lg font-mono font-bold tabular-nums text-[var(--accent-primary)]" data-testid="srs-due-count">
                {srsSummary.dueNowCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-[11px] text-[var(--text-muted)]">Learning</div>
              <div className="text-lg font-mono font-bold tabular-nums text-[var(--warning-text)]">
                {srsSummary.learningCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-[11px] text-[var(--text-muted)]">Mastered (≥7d)</div>
              <div className="text-lg font-mono font-bold tabular-nums text-[var(--success-text)]">
                {srsSummary.masteredCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <label className="text-[11px] text-[var(--text-muted)]" htmlFor="srs-region-filter">
                Deck Filter
              </label>
              <select
                id="srs-region-filter"
                value={cardRegion}
                onChange={(e) => {
                  setCardRegion(e.target.value);
                  setCardOffset(0);
                  setFlipped(false);
                }}
                className="h-7 px-1.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs mt-1"
              >
                <option value="All">All 62 Flaps</option>
                <option value="Head & Neck">Head & Neck</option>
                <option value="Trunk">Trunk</option>
                <option value="Upper Extremity">Upper Extremity</option>
                <option value="Lower Extremity">Lower Extremity</option>
                <option value="Perineum & Pelvis">Perineum & Pelvis</option>
                <option value="Local / Random Pattern">Local / Random</option>
              </select>
            </div>
          </div>

          {/* Flashcard Surface */}
          <div
            onClick={() => setFlipped((f) => !f)}
            role="button"
            tabIndex={0}
            data-testid="srs-card-surface"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setFlipped((f) => !f);
              }
            }}
            className="min-h-[280px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6 flex flex-col justify-between cursor-pointer hover:border-[var(--accent-primary)] transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>
                {flipped
                  ? 'Recall Answer · Pedicle, Classification & Key Pearl'
                  : 'Prompt · Recall Dominant Pedicle, Origin & Primary Landmark'}
              </span>
              <span className="font-mono tabular-nums">
                {flashcardStats
                  ? `Int: ${flashcardStats.intervalDays}d · Ease ${flashcardStats.easeFactor}`
                  : 'New Card'}
              </span>
            </div>

            {!flipped ? (
              <div className="py-8 text-center space-y-2">
                <div className="text-xs text-[var(--accent-primary)] font-medium">
                  {flashcardFlap.region_group} · {flashcardFlap.region}
                </div>
                <div className="text-xl font-semibold text-[var(--text-primary)]">
                  {flashcardFlap.name}
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Click card or press Space to reveal dominant artery, origin, classification, and landmark
                </p>
              </div>
            ) : (
              <div className="py-4 space-y-2.5 text-xs">
                <div>
                  <span className="text-[var(--text-muted)]">Dominant Pedicle: </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {flashcardFlap.vascular_anatomy.dominant_pedicle.artery}
                  </span>{' '}
                  <span className="text-[var(--text-secondary)]">
                    (Origin: {flashcardFlap.vascular_anatomy.dominant_pedicle.artery_origin})
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Classification: </span>
                  <span className="text-[var(--text-primary)]">
                    {flashcardFlap.classification.mathes_nahai ||
                      flashcardFlap.classification.cormack_lamberty ||
                      flashcardFlap.flap_type.join(', ')}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Key Landmark: </span>
                  <span className="text-[var(--text-primary)]">
                    {flashcardFlap.technique.landmarks[0]}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Surgical Pearl: </span>
                  <span className="text-[var(--text-primary)]">
                    {flashcardFlap.technique.pearls[0]}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Primary Pitfall: </span>
                  <span className="text-[var(--danger-text)]">
                    {flashcardFlap.technique.pitfalls[0]}
                  </span>
                </div>
              </div>
            )}

            <div className="text-[11px] text-center text-[var(--text-muted)]">
              {flipped ? 'Rate your recall below to schedule the next review' : 'Tap card to flip'}
            </div>
          </div>

          {/* SM-2 Rating Controls */}
          {flipped ? (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleRateFlashcard('again')}
                data-testid="srs-rate-again"
                className="py-2.5 px-2 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold hover:bg-rose-500/20 transition-colors"
              >
                Again
                <span className="block text-[10px] font-normal opacity-80">Re-queue today</span>
              </button>
              <button
                type="button"
                onClick={() => handleRateFlashcard('hard')}
                data-testid="srs-rate-hard"
                className="py-2.5 px-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-500/20 transition-colors"
              >
                Hard
                <span className="block text-[10px] font-normal opacity-80">1 day</span>
              </button>
              <button
                type="button"
                onClick={() => handleRateFlashcard('good')}
                data-testid="srs-rate-good"
                className="py-2.5 px-2 rounded-lg border border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold hover:opacity-90 transition-colors"
              >
                Good
                <span className="block text-[10px] font-normal opacity-80">
                  {flashcardStats?.repetitions ? `${Math.max(4, Math.round(flashcardStats.intervalDays * flashcardStats.easeFactor))}d` : '1 day'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleRateFlashcard('easy')}
                data-testid="srs-rate-easy"
                className="py-2.5 px-2 rounded-lg border border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-500/20 transition-colors"
              >
                Easy
                <span className="block text-[10px] font-normal opacity-80">4+ days</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setFlipped(false);
                  setCardOffset((o) => o + 1);
                }}
                className="px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Skip for Now
              </button>
              <button
                type="button"
                onClick={() => {
                  selectFlap(flashcardFlap.id, true);
                  setActiveTab('library');
                }}
                className="text-[var(--accent-primary)] font-medium hover:underline"
              >
                Inspect in 3D Atlas
              </button>
              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white font-medium"
              >
                Reveal Answer
              </button>
            </div>
          )}

          {Object.keys(flashcardProgress).length > 0 && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  resetFlashcardProgress();
                  setCardOffset(0);
                  setFlipped(false);
                }}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--danger-text)] inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset SRS Scheduling
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODE 4: WEAK-TOPIC ANALYTICS */}
      {mode === 'analytics' && (
        <div className="max-w-4xl mx-auto space-y-4" data-testid="weak-topic-analytics">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-[11px] text-[var(--text-muted)]">Questions Attempted</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-[var(--text-primary)] mt-1">
                {totalAttempted} / {QUIZ_QUESTIONS.length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-[11px] text-[var(--text-muted)]">Overall Accuracy</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-[var(--accent-primary)] mt-1">
                {totalAttempted > 0 ? `${Math.round((totalCorrect / totalAttempted) * 100)}%` : '—'}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-[11px] text-[var(--text-muted)]">Flashcards Mastered</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-[var(--success-text)] mt-1">
                {srsSummary.masteredCount} / {flaps.length}
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Performance by Reconstructive Topic (Weakest First)
              </h2>
              <button
                type="button"
                onClick={() => {
                  setTopicFilter('Weak / Missed');
                  setMode('quiz');
                  setIdx(0);
                  setSelectedOpt(null);
                }}
                className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
              >
                Drill All Missed Questions →
              </button>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {topicAnalytics.map((row) => (
                <div
                  key={row.topic}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">{row.topic}</span>
                      <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                        {row.correctCount}/{row.attemptedCount} answered ({row.totalQuestions} total)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          row.status === 'weak'
                            ? 'bg-rose-500'
                            : row.status === 'developing'
                              ? 'bg-amber-500'
                              : row.status === 'strong'
                                ? 'bg-emerald-500'
                                : 'bg-slate-400/40'
                        }`}
                        style={{ width: `${row.accuracyPct ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 sm:ml-4">
                    <span
                      className={`font-mono tabular-nums font-semibold w-12 text-right ${
                        row.status === 'weak'
                          ? 'text-[var(--danger-text)]'
                          : row.status === 'strong'
                            ? 'text-[var(--success-text)]'
                            : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {row.accuracyPct !== null ? `${row.accuracyPct}%` : 'New'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTopicFilter(row.topic);
                        setMode('quiz');
                        setIdx(0);
                        setSelectedOpt(null);
                      }}
                      className="px-2.5 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] font-medium whitespace-nowrap"
                    >
                      Practice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
