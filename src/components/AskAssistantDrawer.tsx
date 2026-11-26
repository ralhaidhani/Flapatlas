import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  HeartPulse,
  Layers,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  WifiOff,
  X,
} from 'lucide-react';
import { DEFECT_LOCATIONS, VESSELS } from '../data/index';
import {
  AssistantCapabilityMode,
  GroundedContextSource,
  ParsedAdvisorScenario,
  parseAdvisorScenarioPayload,
  retrieveGroundedContext,
} from '../engine/assistantGrounding';
import { useOnlineStatus } from '../hooks/usePWA';
import { useAtlasStore } from '../store/useAtlasStore';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: GroundedContextSource[];
  advisorScenario?: ParsedAdvisorScenario | null;
  isError?: boolean;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Ask FlapAtlas answers questions strictly grounded in the loaded 62-flap and vascular dataset. Every response lists the exact flap & vessel records used with their clinical verification status. If a figure is absent, I will tell you rather than guess.',
};

function renderInlineSpans(line: string, keyPrefix: string): React.ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${idx}`} className="font-semibold text-[var(--text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={`${keyPrefix}-i-${idx}`} className="italic text-[var(--text-secondary)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{part}</React.Fragment>;
  });
}

const FormattedAssistantText: React.FC<{ text: string }> = ({ text }) => {
  const normalized = text.replace(/<br\s*\/?>/gi, '\n');
  const lines = normalized.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={`sp-${idx}`} className="h-1" />;
        if (/^[-*_]{3,}$/.test(line)) {
          return <hr key={`hr-${idx}`} className="border-[var(--border-subtle)] my-1.5" />;
        }
        const headingMatch = line.match(/^#{1,4}\s+(.*)$/);
        if (headingMatch) {
          return (
            <div
              key={`hd-${idx}`}
              className="text-xs font-semibold text-[var(--text-primary)] pt-1"
            >
              {renderInlineSpans(headingMatch[1], `hd-${idx}`)}
            </div>
          );
        }
        const bulletMatch = line.match(/^([-*•])\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={`li-${idx}`} className="flex items-start gap-1.5 pl-1">
              <span className="text-[var(--accent-primary)] font-bold leading-relaxed select-none">
                •
              </span>
              <span className="flex-1">{renderInlineSpans(bulletMatch[2], `li-${idx}`)}</span>
            </div>
          );
        }
        return <p key={`p-${idx}`}>{renderInlineSpans(line, `p-${idx}`)}</p>;
      })}
    </div>
  );
};

export const AskAssistantDrawer: React.FC = () => {
  const open = useAtlasStore((s) => s.assistantOpen);
  const initialPrompt = useAtlasStore((s) => s.assistantInitialPrompt);
  const closeAssistant = useAtlasStore((s) => s.closeAssistant);
  const flaps = useAtlasStore((s) => s.flaps);
  const selectedFlapId = useAtlasStore((s) => s.selectedFlapId);
  const selectFlap = useAtlasStore((s) => s.selectFlap);
  const selectVessel = useAtlasStore((s) => s.selectVessel);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const applyAdvisorDraft = useAtlasStore((s) => s.applyAdvisorDraft);

  const isOnline = useOnlineStatus();
  const [input, setInput] = useState('');
  const [activeMode, setActiveMode] = useState<AssistantCapabilityMode>('qa');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedFlap = useMemo(
    () => flaps.find((f) => f.id === selectedFlapId) || flaps[0],
    [flaps, selectedFlapId]
  );

  useEffect(() => {
    if (open) {
      if (initialPrompt) {
        setInput(initialPrompt);
      }
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, initialPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuestion = async (
    questionText: string,
    modeOverride?: AssistantCapabilityMode
  ) => {
    const q = questionText.trim();
    if (!q || loading) return;

    const modeToUse = modeOverride ?? activeMode;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: q };
    const nextHistory = [...messages, userMsg]
      .filter((m) => m.id !== 'welcome' && !m.isError)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    if (!isOnline) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          isError: true,
          text: 'Offline mode detected. Ask FlapAtlas requires an internet connection, while the 3D Atlas, Flap Library, Flap Advisor, Simulators, and Case Planner remain fully available offline.',
        },
      ]);
      return;
    }

    setLoading(true);
    try {
      const bundle = retrieveGroundedContext(q, flaps, VESSELS, selectedFlap?.id);

      const resp = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          mode: modeToUse,
          contextRecords: bundle.flapRecords,
          vesselRecords: bundle.vesselRecords,
          history: nextHistory,
          allowedDefectLocations:
            modeToUse === 'advisor-parse'
              ? DEFECT_LOCATIONS.map((d) => ({ id: d.id, label: `${d.group} — ${d.label}` }))
              : undefined,
        }),
      });

      const data = (await resp.json()) as {
        answer?: string;
        advisorScenario?: unknown;
        error?: string;
      };

      if (!resp.ok || !data.answer) {
        throw new Error(data.error || 'Assistant service unavailable.');
      }

      const parsedScenario =
        modeToUse === 'advisor-parse' && data.advisorScenario
          ? parseAdvisorScenarioPayload(data.advisorScenario, DEFECT_LOCATIONS)
          : null;

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.answer!,
          sources: bundle.sources,
          advisorScenario: parsedScenario,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          isError: true,
          text:
            err instanceof Error
              ? err.message
              : 'Could not reach the FlapAtlas AI endpoint. Core offline tools remain available.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const activeShort = selectedFlap?.synonyms[0] || selectedFlap?.name || 'ALT';

  const quickActions: Array<{
    label: string;
    prompt: string;
    mode: AssistantCapabilityMode;
  }> = [
    {
      label: `Explain ${activeShort}`,
      prompt: `Explain the ${selectedFlap?.name || 'ALT flap'} vascular pedicle, perforators, and key surgical pitfalls in clear terms.`,
      mode: 'qa',
    },
    {
      label: 'Compare DIEP vs SIEA vs TRAM',
      prompt: 'Compare DIEP, SIEA, and TRAM flaps for breast reconstruction across pedicle, caliber, and donor morbidity.',
      mode: 'compare',
    },
    {
      label: 'Summarize Technique',
      prompt: `Summarize the positioning, landmarks, harvest steps, and pitfalls for the ${selectedFlap?.name || 'ALT flap'}.`,
      mode: 'technique',
    },
    {
      label: 'Suggest Alternatives',
      prompt: `What are the contraindications to ${selectedFlap?.name || 'ALT flap'} and which grounded alternative flaps should be considered?`,
      mode: 'alternatives',
    },
    {
      label: 'Quiz Me',
      prompt: `Quiz me with a board-style question on ${selectedFlap?.name || 'Free Fibula'} anatomy and landmarks.`,
      mode: 'quiz',
    },
    {
      label: 'Scenario → Flap Advisor',
      prompt:
        '62-year-old smoker with a 12 x 7 cm Gustilo IIIB distal third tibia defect, exposed bone and hardware, needing durable thin pliable coverage.',
      mode: 'advisor-parse',
    },
  ];

  const statusTone = (status?: string) =>
    status === 'Verified'
      ? 'text-[var(--success-text)]'
      : status === 'Partially verified'
        ? 'text-[var(--accent-primary)]'
        : 'text-[var(--warning-text)]';

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col"
      role="dialog"
      aria-modal="false"
      aria-label="Ask FlapAtlas AI Assistant"
      data-testid="ask-assistant-drawer"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>Ask FlapAtlas</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] truncate">
            Strictly grounded in local flap &amp; vessel records · No clinical fabrication
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 1 && (
            <button
              type="button"
              onClick={() => setMessages([WELCOME_MESSAGE])}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              aria-label="Reset conversation"
              title="Clear chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={closeAssistant}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            aria-label="Close Ask FlapAtlas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Capability Mode Selector + Quick Prompts */}
      <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-[var(--text-secondary)]">Assistant Mode:</span>
          <select
            value={activeMode}
            onChange={(e) => setActiveMode(e.target.value as AssistantCapabilityMode)}
            aria-label="Ask FlapAtlas capability mode"
            data-testid="assistant-mode-select"
            className="h-7 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[11px]"
          >
            <option value="qa">Grounded Q&amp;A / Explain</option>
            <option value="compare">Compare Flaps</option>
            <option value="technique">Summarize Technique</option>
            <option value="alternatives">Alternatives &amp; Contraindications</option>
            <option value="quiz">Board Quiz Me</option>
            <option value="advisor-parse">Convert Scenario → Flap Advisor</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              type="button"
              disabled={loading}
              onClick={() => {
                setActiveMode(qa.mode);
                void sendQuestion(qa.prompt, qa.mode);
              }}
              data-testid={`assistant-quick-${qa.mode}`}
              className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                qa.mode === 'advisor-parse'
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/40 text-[var(--accent-primary)] font-medium hover:border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 text-xs"
        aria-live="polite"
      >
        {!isOnline && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Offline — AI chat paused; local 3D atlas, Advisor &amp; Calculators remain active.</span>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            data-testid={`assistant-msg-${m.role}`}
            className={`p-3 rounded-xl space-y-2 leading-relaxed ${
              m.role === 'user'
                ? 'ml-8 bg-[var(--accent-primary)] text-white'
                : m.isError
                  ? 'mr-3 bg-rose-500/10 border border-rose-500/30 text-[var(--text-primary)]'
                  : 'mr-3 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]'
            }`}
          >
            {m.role === 'assistant' && !m.isError ? (
              <FormattedAssistantText text={m.text} />
            ) : (
              <div className="whitespace-pre-wrap">{m.text}</div>
            )}

            {/* Structured Advisor Scenario Apply Action */}
            {m.advisorScenario && (
              <div
                className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--accent-primary)]/40 space-y-2"
                data-testid="assistant-advisor-bridge-card"
              >
                <div className="text-[11px] font-semibold text-[var(--accent-primary)] flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Structured Flap Advisor Inputs Ready</span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-mono tabular-nums">
                  Zone: {m.advisorScenario.input.locationId} · {m.advisorScenario.input.lengthCm} ×{' '}
                  {m.advisorScenario.input.widthCm} cm · {m.advisorScenario.input.depth}
                </div>
                <button
                  type="button"
                  onClick={() => applyAdvisorDraft(m.advisorScenario!.input)}
                  data-testid="apply-advisor-scenario-btn"
                  className="w-full h-8 px-3 rounded-lg bg-[var(--accent-primary)] text-white font-medium text-xs inline-flex items-center justify-center gap-1.5 hover:opacity-95"
                >
                  <span>Apply to Rule-Based Flap Advisor</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Grounded Source Chips with Live Verification Status (§9) */}
            {m.sources && m.sources.length > 0 && (
              <div
                className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5"
                data-testid="assistant-grounded-sources"
              >
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
                  Grounded Records Used ({m.sources.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.sources.map((src) => {
                    if (src.kind === 'flap') {
                      const liveFlap = flaps.find((f) => f.id === src.id);
                      const status = liveFlap?.verification_status ?? src.verificationStatus ?? 'Needs review';
                      return (
                        <button
                          key={`flap-${src.id}`}
                          type="button"
                          onClick={() => {
                            selectFlap(src.id, true);
                            setActiveTab('library');
                            closeAssistant();
                          }}
                          data-testid={`assistant-source-flap-${src.id}`}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] inline-flex items-center gap-1.5 text-left transition-colors"
                        >
                          <Layers className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                          <span className="font-medium text-[var(--text-primary)]">{src.shortLabel}</span>
                          <span className={`text-[10px] font-medium ${statusTone(status)}`}>
                            · {status}
                          </span>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={`vessel-${src.id}`}
                        type="button"
                        title={src.name}
                        onClick={() => {
                          selectVessel(src.id, true);
                          setActiveTab('anatomy');
                          closeAssistant();
                        }}
                        data-testid={`assistant-source-vessel-${src.id}`}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] inline-flex items-center gap-1 text-left transition-colors max-w-[205px]"
                      >
                        <HeartPulse className="w-3 h-3 text-rose-500 shrink-0" />
                        <span className="text-[var(--text-secondary)] truncate">{src.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="mr-3 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] animate-pulse">
            Consulting grounded FlapAtlas records…
          </div>
        )}
      </div>

      {/* Educational Safety Disclaimer */}
      <div className="px-4 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-[var(--warning-text)]" />
        <span>Educational reference only — never a substitute for clinical judgment or preoperative imaging.</span>
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendQuestion(input);
        }}
        className="p-3 border-t border-[var(--border-subtle)] flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          data-testid="assistant-input"
          placeholder={
            activeMode === 'advisor-parse'
              ? 'Describe a defect scenario (location, size, exposed structures)...'
              : 'Ask about vascular anatomy, landmarks, or comparisons...'
          }
          className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          data-testid="assistant-send-btn"
          className="h-9 px-3 rounded-lg bg-[var(--accent-primary)] text-white disabled:opacity-40 flex items-center justify-center"
          aria-label="Send question"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
