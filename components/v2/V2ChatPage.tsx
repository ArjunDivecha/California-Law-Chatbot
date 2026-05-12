/**
 * V2 chat surface — minimal page that exercises the new agent-loop SSE
 * endpoint. Standalone (does NOT touch the V1 useChat / Message
 * pipeline) so V1 keeps running while V2 is under development.
 *
 * Reachable at /v2 (gated by Clerk SignedIn, same posture as /c/:chatId).
 *
 * What it does:
 *   * Generates a session_id on mount (held in component state — Phase 4
 *     follow-up will move this to URL / local-storage so a refresh
 *     doesn't lose the session).
 *   * Renders the user's question immediately on submit.
 *   * Opens an SSE stream via useV2AgentStream.
 *   * Paints:
 *      - Privilege indicator chip the moment the sanitization event
 *        arrives (typically < 2s).
 *      - Tool affordance row that flips per tool from spinning →
 *        ✓ {ms} once results return.
 *      - Streaming text into the assistant bubble as tokens arrive.
 *      - Final summary footer (tool_rounds, total_tokens, elapsed) on
 *        the 'done' event.
 *   * On error: shows a red banner with the code + message and stops
 *     the stream.
 *
 * Visual language matches the existing app (Georgia serif, FAFAF8
 * background, pink accent on user, gray-on-white on assistant).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useV2AgentStream } from '../../hooks/useV2AgentStream.ts';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

function newSessionId(): string {
  return `v2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toolHumanName(name: string): string {
  switch (name) {
    case 'ceb_search':
      return 'CEB practice guides';
    case 'courtlistener_search':
      return 'CourtListener case law';
    case 'web_search':
      return 'Web search';
    default:
      return name;
  }
}

export const V2ChatPage: React.FC = () => {
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [sessionId] = useState(() => newSessionId());
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const { state, send, reset } = useV2AgentStream();

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new tokens / new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, state.tokens, state.toolEvents.length]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || state.isStreaming) return;
      // Add the user message to the visible list immediately.
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text },
      ]);
      setDraft('');
      void send({
        session_id: sessionId,
        user_text: text,
        user_id: userId,
      });
    },
    [draft, state.isStreaming, send, sessionId, userId],
  );

  // When `done` fires, fold the streamed tokens into a permanent assistant
  // message so subsequent turns start with a clean slate.
  useEffect(() => {
    if (state.done && state.tokens) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: state.done?.final_text || state.tokens,
        },
      ]);
      // Reset stream state so the next turn's privileged chip + tool events
      // don't carry over from the previous turn.
      // Use a short timeout so the user can see the final summary briefly
      // before it clears.
      const t = window.setTimeout(() => reset(), 1500);
      return () => window.clearTimeout(t);
    }
  }, [state.done, state.tokens, reset]);

  const privilegedBadge = useMemo(() => {
    if (!state.sanitization) return null;
    const { privileged, compound_risk_buckets, redactions_count } = state.sanitization;
    if (privileged) {
      const reasons: string[] = [];
      if (compound_risk_buckets > 0) reasons.push(`compound risk ×${compound_risk_buckets}`);
      if (redactions_count > 0) reasons.push(`${redactions_count} redaction${redactions_count > 1 ? 's' : ''}`);
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold text-pink-700">
          🔒 Privileged — web search disabled
          {reasons.length > 0 && <span className="text-pink-600/80">({reasons.join(' · ')})</span>}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        🌐 Public research — web search enabled
      </span>
    );
  }, [state.sanitization]);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: '#FAFAF8', fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm">
              <img src="/Heart Favicon.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">California Law Chatbot</h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pink-500">
                V2 Preview · Anthropic Agent Loop
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            session: <span className="font-mono">{sessionId.slice(0, 16)}…</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-3xl flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {messages.length === 0 && !state.isStreaming && (
              <div className="text-center text-gray-400 text-sm py-12">
                Ask a California legal-research question to begin. Try “What does CRC 2.550 require for a motion to seal?” or a client-context query.
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} text={m.text} />
            ))}

            {state.isStreaming && (
              <div className="space-y-2">
                {privilegedBadge && <div className="flex justify-start">{privilegedBadge}</div>}
                {state.toolEvents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {state.toolEvents.map((t) => (
                      <ToolPill key={t.id} tool={t} />
                    ))}
                  </div>
                )}
                {state.tokens && (
                  <MessageBubble role="assistant" text={state.tokens} streaming />
                )}
                {!state.tokens && state.round > 0 && (
                  <MessageBubble
                    role="assistant"
                    text={state.round === 1 ? 'Thinking…' : `Working on round ${state.round}…`}
                    streaming
                  />
                )}
              </div>
            )}

            {state.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <strong className="font-semibold">
                  {state.error.proxy ? 'Gate error' : 'Stream error'} —{' '}
                </strong>
                <span className="font-mono text-xs">{state.error.code}</span>
                <div className="mt-1">{state.error.message}</div>
              </div>
            )}

            {state.done && (
              <div className="text-xs text-gray-400 text-right">
                {state.done.tool_rounds} tool round{state.done.tool_rounds === 1 ? '' : 's'} ·{' '}
                {state.done.total_tokens.toLocaleString()} tokens ·{' '}
                {Math.round(state.done.elapsed_ms / 100) / 10}s ·{' '}
                stop={state.done.stop_reason}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-gray-100 bg-white px-6 py-4">
            <div className="flex items-end gap-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask a California legal-research question…"
                rows={2}
                className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
                disabled={state.isStreaming}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e as unknown as React.FormEvent);
                  }
                }}
              />
              <button
                type="submit"
                disabled={state.isStreaming || !draft.trim()}
                className="rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {state.isStreaming ? 'Working…' : 'Send'}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-gray-400">
              V2 preview: Anthropic agent loop with sanitization gating. Conversation persists to Upstash KV under{' '}
              <span className="font-mono">{sessionId}</span>.
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tiny message-bubble + tool-pill subcomponents (kept local to this file)
// ---------------------------------------------------------------------------

const MessageBubble: React.FC<{ role: 'user' | 'assistant'; text: string; streaming?: boolean }> = ({
  role,
  text,
  streaming,
}) => {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-pink-500 text-white'
            : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
        }`}
      >
        {text}
        {streaming && !isUser && <span className="ml-1 inline-block animate-pulse">▍</span>}
      </div>
    </div>
  );
};

const ToolPill: React.FC<{ tool: ReturnType<typeof toolPillData> | { name: string; status: string; elapsed_ms?: number } }> = ({
  tool,
}) => {
  const name = toolHumanName(tool.name);
  if (tool.status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 border border-blue-200">
        <span className="animate-spin">⟳</span> Searching {name}…
      </span>
    );
  }
  if (tool.status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs text-red-700 border border-red-200">
        ✗ {name} failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-700 border border-gray-200">
      ✓ {name}
      {typeof tool.elapsed_ms === 'number' && ` · ${Math.round(tool.elapsed_ms)}ms`}
    </span>
  );
};

// (Unused type helper kept for parity with ToolPill prop shape.)
function toolPillData() {
  return { name: '', status: 'done', elapsed_ms: 0 } as const;
}

export default V2ChatPage;
