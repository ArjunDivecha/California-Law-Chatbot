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
import { Link, useParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { MatterModeSelector } from './MatterModeSelector';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useV2AgentStream, type V2SourceSummary } from '../../hooks/useV2AgentStream.ts';
import { useV2SanitizationPreview } from '../../hooks/useV2SanitizationPreview.ts';
import {
  addToUserAllowlist,
  removeFromUserAllowlist,
  getUserAllowlist,
  subscribeToUserAllowlist,
} from '../../services/sanitization/userAllowlist.ts';
import {
  addToUserDenylist,
  removeFromUserDenylist,
  getUserDenylist,
  subscribeToUserDenylist,
} from '../../services/sanitization/userDenylist.ts';
import { ConfidentialityAttestation } from '../ConfidentialityAttestation.tsx';
import { checkAnswer } from '../../services/guardrailsServiceV2.ts';
import { prune as pruneSources } from '../../services/retrievalPrunerV2.ts';
import { fetchSessionWithCache, invalidateSession } from '../../utils/chatStoreV2.ts';
import { getChatSanitizer, findInventedTokensInText } from '../../services/sanitization/chatAdapter';
import { DETECTOR_UNSUPPORTED_ON_DEVICE } from '../../services/sanitization/opfClient';
import { useSanitizer } from '../../hooks/useSanitizer';

// Warn when a model response references sanitization tokens that do NOT
// exist in the local token map — a potential hallucination of an entity not
// present in the original prompt. Renders nothing when the active sanitizer
// is the pass-through (no map). Ported from the V1 Message.tsx at the
// 2026-07-02 V1 purge (Phase 6 Day 9 feature).
const InventedTokenWarning: React.FC<{ text: string }> = ({ text }) => {
  const unknown = React.useMemo(() => findInventedTokensInText(text), [text]);
  if (unknown.length === 0) return null;
  const shown = unknown.slice(0, 5).join(', ');
  const more = unknown.length > 5 ? ` and ${unknown.length - 5} more` : '';
  return (
    <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <div className="mb-0.5 font-semibold">
        ⚠️ Model referenced {unknown.length} token{unknown.length !== 1 ? 's' : ''} not in your local map
      </div>
      <div>
        {shown}
        {more}. These were not assigned from your prompt — treat as potentially invented. Verify
        the specific identifier before relying on it.
      </div>
    </div>
  );
};

type Workflow = 'quick' | 'research';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Source summaries (assistant messages only) — what tools surfaced. */
  sources?: V2SourceSummary[];
  /** Workflow that produced this turn — surfaced as a badge on the
   *  assistant message ("Quick" / "Research"). Carries the value from
   *  the originating user-message's `workflow` field. */
  workflow?: 'quick' | 'research';
}

function newSessionId(): string {
  return `v2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Per-session localStorage key for the in-progress textarea. Debounced
 * save (1500ms after typing stops) so a refresh / accidental nav doesn't
 * lose a half-typed query. Matches V1's LOCAL_DRAFT_PREFIX semantics.
 */
const LOCAL_DRAFT_KEY = (sessionId: string): string =>
  `cal-law-chat-draft:v2:${sessionId}`;
const LOCAL_DRAFT_DEBOUNCE_MS = 1500;

/**
 * Welcome message displayed when a session has no messages yet AND no
 * stream is in flight. Mirrors V1's WELCOME_MESSAGE.
 */
const WELCOME_MESSAGE =
  'Welcome — I\'m V2 of the California Law Chatbot. Ask a legal-research question, or use the workflow toggle above to pick Draft Document or Verify Citation. I have access to CourtListener case law, LegiScan + OpenStates legislation, California statute lookup, a citation verifier, and web search.';

/**
 * Convert an Anthropic-shape message content (string | content-block
 * array) to a displayable text string. Tool-use / tool-result blocks
 * are summarized rather than rendered — those aren't user-visible in
 * the chat bubble layout.
 */
function renderContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === 'object') {
      const b = block as { type?: string; text?: string };
      if (b.type === 'text' && typeof b.text === 'string') {
        parts.push(b.text);
      }
      // tool_use / tool_result intentionally skipped — they're rendered
      // as pills during the active turn, not as historical bubbles.
    }
  }
  return parts.join('\n');
}

function toolHumanName(name: string): string {
  switch (name) {
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
  const { getToken } = useAuth();
  const userId = user?.id ?? null;
  const params = useParams<{ sessionId?: string }>();
  const urlSessionId = params.sessionId ?? null;

  // sessionId is URL-driven when present; otherwise mint a fresh one.
  // useMemo (not useState) so navigating between sessions actually
  // switches the active session, not just the URL.
  const sessionId = useMemo(
    () => urlSessionId ?? newSessionId(),
    [urlSessionId],
  );
  // Restore in-progress textarea from localStorage on mount (per-session).
  const [draft, setDraft] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const sid = urlSessionId ?? 'new';
      return window.localStorage.getItem(LOCAL_DRAFT_KEY(sid)) ?? '';
    } catch {
      return '';
    }
  });
  const [workflow, setWorkflow] = useState<Workflow>('research');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [hydrating, setHydrating] = useState(false);
  const { state, send, reset } = useV2AgentStream();
  // tokenCount re-renders when the IndexedDB token map loads or grows,
  // so derived (rehydrated) messages refresh once the map is available.
  // Bug fix 2026-05-18: prior code set tokenized text directly into
  // bubbles on session reload, so attorneys saw CLIENT_001/ADDRESS_001
  // instead of "John Smith" / real addresses.
  const { tokenCount, unlocked } = useSanitizer();
  const displayedMessages = useMemo(() => {
    if (!unlocked || tokenCount === 0) return messages;
    const sanitizer = getChatSanitizer();
    return messages.map((m) => ({ ...m, text: sanitizer.rehydrateMessage(m.text) }));
    // tokenCount in deps so a fresh map-load triggers a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, tokenCount, unlocked]);
  const { preview: livePreview, isComputing: previewComputing, hasDetections } =
    useV2SanitizationPreview(draft);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Matter mode as reported by the MatterModeSelector — used to fail closed
  // on devices without the on-device privacy filter (mobile): confidential /
  // protected sends are refused there.
  const [matterMode, setMatterMode] = useState<string>('public_research');
  const [mobileGateNotice, setMobileGateNotice] = useState<string | null>(null);

  // Text currently selected inside the draft textarea — enables the
  // "always treat as privileged" action (adds to the user denylist).
  const [selectedText, setSelectedText] = useState('');
  // Privacy-lists management modal (allowed + protected terms).
  const [showPrivacyLists, setShowPrivacyLists] = useState(false);

  // Auto-scroll on new tokens / new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, state.tokens, state.toolEvents.length]);

  // Debounced save of the in-progress textarea — survives refresh.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sid = urlSessionId ?? 'new';
    const key = LOCAL_DRAFT_KEY(sid);
    if (!draft) {
      // Cleared input — clear stored draft too. No debounce needed.
      try {
        window.localStorage.removeItem(key);
      } catch {}
      return;
    }
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, draft);
      } catch {}
    }, LOCAL_DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [draft, urlSessionId]);

  // Hydrate from KV when landing on /v2/:sessionId. Pulls full message
  // history via GET /api/agent/session?id= and converts the Anthropic-
  // shape messages to the DisplayMessage[] the UI renders.
  useEffect(() => {
    if (!urlSessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setHydrating(true);
      try {
        // P4.5 — read through local cache (5min TTL); falls back to
        // /api/agent/session and writes the result back to localStorage.
        const payload = await fetchSessionWithCache(urlSessionId, getToken);
        if (cancelled || !payload) return;
        const messagesData = payload.messages as Array<{
          role: 'user' | 'assistant';
          content: unknown;
          workflow?: 'quick' | 'research';
        }>;
        const display: DisplayMessage[] = [];
        let idx = 0;
        let lastUserWorkflow: 'quick' | 'research' | undefined;
        for (const m of messagesData) {
          const text = renderContent(m.content);
          if (!text) continue;
          if (m.role === 'user') lastUserWorkflow = m.workflow;
          display.push({
            id: `${m.role}_${idx++}`,
            role: m.role,
            text,
            workflow: m.role === 'assistant' ? lastUserWorkflow : m.workflow,
          });
        }
        setMessages(display);
      } catch {
        // hydration failures show as empty conversation; UI doesn't break
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlSessionId, getToken]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || state.isStreaming) return;
      // Fail-closed on devices without the on-device privacy filter (PRD
      // §5.6a — detection recall is safety-critical for client matters):
      // public research is fine (server regex backstop still guards), but
      // confidential/protected sends require the desktop app.
      if (DETECTOR_UNSUPPORTED_ON_DEVICE && matterMode !== 'public_research') {
        setMobileGateNotice(
          'Client-matter (confidential/protected) messages can’t be sent from this device — the on-device privacy filter that tokenizes client identities isn’t available here. Switch the matter mode to "Public research", or use the desktop app for this matter.',
        );
        return;
      }
      setMobileGateNotice(null);
      // Add the user message to the visible list immediately.
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text },
      ]);
      setDraft('');
      // Clear the persisted draft — message has flown.
      try {
        const sid = urlSessionId ?? 'new';
        window.localStorage.removeItem(LOCAL_DRAFT_KEY(sid));
      } catch {}
      void send({
        session_id: sessionId,
        user_text: text,
        user_id: userId,
        workflow,
      });
    },
    [draft, state.isStreaming, send, sessionId, userId, matterMode],
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
          sources: state.sources.slice(),
          workflow,
        },
      ]);
      // Tell the V2Sidebar to refresh — the new turn just landed in
      // KV's per-user index and we want it visible immediately rather
      // than waiting for the next sidebar mount.
      (window as unknown as { __v2RefreshSidebar?: () => void }).__v2RefreshSidebar?.();
      // P4.5 — invalidate the cache for this session so the next
      // visit to /v2/<sessionId> re-fetches with the new turn included.
      invalidateSession(sessionId);
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
    // Informational only — sanitization still detects spans + compound
    // risk, but as of the 7th addendum the privileged flag no longer
    // gates web_search. The chip surfaces what was detected so the
    // attorney can SEE the assessment, but the model has access to all
    // tools either way.
    if (privileged) {
      const reasons: string[] = [];
      if (compound_risk_buckets > 0) reasons.push(`compound risk ×${compound_risk_buckets}`);
      if (redactions_count > 0) reasons.push(`${redactions_count} redaction${redactions_count > 1 ? 's' : ''}`);
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          ⚠️ Privileged content detected
          {reasons.length > 0 && <span className="text-amber-700/80">({reasons.join(' · ')})</span>}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        🌐 No privileged content detected
      </span>
    );
  }, [state.sanitization]);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: '#FAFAF8', fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      {/* P2.4 — informed-consent attestation. Self-gates via useAttestation
          per Clerk user ID. Soft gate by default (dismissable). */}
      <ConfidentialityAttestation softGate />

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
          <div className="flex items-center gap-3 text-xs">
            <MatterModeSelector sessionId={sessionId} getToken={getToken} onModeChange={setMatterMode} />
            <Link
              to="/v2/draft"
              className="rounded-full bg-pink-50 px-3 py-1.5 text-pink-700 font-semibold hover:bg-pink-100"
            >
              Draft a document →
            </Link>
            <span className="text-gray-400">
              session: <span className="font-mono">{sessionId.slice(0, 16)}…</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-3xl flex flex-col">
          <WorkflowToggle
            workflow={workflow}
            onSelectWorkflow={setWorkflow}
            disabled={state.isStreaming}
          />

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {displayedMessages.length === 0 && !state.isStreaming && !hydrating && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 max-w-2xl mx-auto shadow-sm">
                <div className="text-[13px] font-semibold text-pink-600 uppercase tracking-wider mb-2">
                  V2 Welcome
                </div>
                <p className="text-[14px] text-gray-700 leading-relaxed">{WELCOME_MESSAGE}</p>
                <div className="mt-3 text-[12px] text-gray-500">
                  <strong className="text-gray-700">Try:</strong> "What does CRC 2.550 require for a motion to seal?" — "Draft a holographic codicil for Estate of Smith" — paste a memo into Verify Citation to check every cite.
                </div>
              </div>
            )}
            {hydrating && (
              <div className="text-center text-gray-400 text-sm py-6 italic">Loading prior session…</div>
            )}

            {displayedMessages.map((m) => (
              <MessageBubble key={m.id} role={m.role} text={m.text} sources={m.sources} workflow={m.workflow} />
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

            {state.refusal && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <strong className="font-semibold">
                  ⚠️ Fable declined this request
                  {state.refusal.category ? ` (${state.refusal.category})` : ''}.
                </strong>
                {state.refusal.explanation && (
                  <div className="mt-1">{state.refusal.explanation}</div>
                )}
                <div className="mt-1 text-amber-800/80">
                  Your message was <span className="font-semibold">not</span> sent to any
                  other model. You can revise it and try again.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                    if (lastUser) setDraft(lastUser.text);
                    reset();
                  }}
                  className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                >
                  Edit &amp; resend
                </button>
              </div>
            )}

            {state.modelFailover && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-800">
                <span className="font-semibold">{state.modelFailover.from}</span> is not
                available on this account, so this answer was generated with{' '}
                <span className="font-semibold">{state.modelFailover.to}</span> — same
                provider (Anthropic), same privacy posture. Set{' '}
                <code className="rounded bg-sky-100 px-1">V2_PRIMARY_MODEL</code> to change
                the default engine.
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
            {mobileGateNotice && (
              <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <span className="font-semibold">⚠️ Not sent. </span>
                {mobileGateNotice}
              </div>
            )}
            <div className="flex items-end gap-3">
              <HighlightedDraftInput
                value={draft}
                onChange={setDraft}
                preview={livePreview}
                disabled={state.isStreaming}
                onSelectionChange={setSelectedText}
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

            {/* Live sanitization preview (P1.1) — debounced 300ms after you stop
                typing. Informational only per the 7th addendum — no submission
                blocking. Shows the detector's verdict on your in-progress text. */}
            <LiveSanitizationPanel
              draft={draft}
              preview={livePreview}
              hasDetections={hasDetections}
              isComputing={previewComputing}
            />

            {/* Selection → force-redact. Appears when text is selected in
                the draft box; adds the selection to the "always privileged"
                denylist so it tokenizes on every future mention. */}
            {selectedText.trim() && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    addToUserDenylist(selectedText);
                    setSelectedText('');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                  title="Always redact this text before sending (this device)"
                >
                  🔒 Always treat “{selectedText.trim().slice(0, 40)}
                  {selectedText.trim().length > 40 ? '…' : ''}” as privileged
                </button>
              </div>
            )}

            <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
              <span>
                V2 preview: Anthropic agent loop with live sanitization preview. Conversation persists to Upstash KV under{' '}
                <span className="font-mono">{sessionId}</span>.
              </span>
              <button
                type="button"
                onClick={() => setShowPrivacyLists(true)}
                className="shrink-0 font-semibold text-pink-500 underline decoration-dotted underline-offset-2 hover:text-pink-700"
              >
                Privacy lists
              </button>
            </div>
          </form>

          {showPrivacyLists && (
            <PrivacyListsModal onClose={() => setShowPrivacyLists(false)} />
          )}
        </div>
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tiny message-bubble + tool-pill subcomponents (kept local to this file)
// ---------------------------------------------------------------------------

/**
 * Workflow toggle — 4 buttons at the top of the chat surface. Replaces
 * V1's source-mode toggle per the Phase 4 plan. The two "on-page"
 * workflows (Quick, Research) change request behavior; the two "go-to"
 * workflows (Draft, Verify) navigate to dedicated routes via <Link>
 * for reliable react-router transitions.
 */
const WorkflowToggle: React.FC<{
  workflow: 'quick' | 'research';
  onSelectWorkflow: (w: 'quick' | 'research') => void;
  disabled?: boolean;
}> = ({ workflow, onSelectWorkflow, disabled }) => {
  const ToggleBtn: React.FC<{
    label: string;
    sub: string;
    active?: boolean;
    onClick: () => void;
    disabled?: boolean;
  }> = ({ label, sub, active, onClick, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg border px-3 py-2 text-left transition ${
        active
          ? 'border-pink-300 bg-pink-50'
          : 'border-gray-200 bg-white hover:border-pink-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className={`text-[12px] font-semibold ${active ? 'text-pink-700' : 'text-gray-800'}`}>
        {label}
      </div>
      <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{sub}</div>
    </button>
  );
  const NavLink: React.FC<{ to: string; label: string; sub: string; disabled?: boolean }> = ({
    to,
    label,
    sub,
    disabled,
  }) => (
    <Link
      to={to}
      role="button"
      aria-label={label}
      className={`flex-1 rounded-lg border border-gray-200 bg-white hover:border-pink-200 px-3 py-2 text-left transition ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="text-[12px] font-semibold text-gray-800">{label}</div>
      <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{sub}</div>
    </Link>
  );
  return (
    <div className="px-6 pt-4 pb-2">
      <div className="flex gap-2">
        <ToggleBtn
          label="Quick Answer"
          sub="Sonnet · no tools · ~5s"
          active={workflow === 'quick'}
          onClick={() => onSelectWorkflow('quick')}
          disabled={disabled}
        />
        <ToggleBtn
          label="Research Memo"
          sub="Fable 5 · full tools · ~30s"
          active={workflow === 'research'}
          onClick={() => onSelectWorkflow('research')}
          disabled={disabled}
        />
        <NavLink to="/v2/draft" label="Draft Document" sub="Templates + section streaming" disabled={disabled} />
        <NavLink to="/v2/verify" label="Verify Citation" sub="Adversarial citation check" disabled={disabled} />
      </div>
    </div>
  );
};

/**
 * Draft textarea with an in-place highlight overlay. Detected spans from
 * the live sanitization preview are marked amber directly over the words
 * in the input, and each mark is clickable — clicking it declares the
 * term NOT privileged (adds it to the per-device user allowlist), which
 * immediately removes the highlight and lets the term go over the wire
 * as plain text.
 *
 * Mechanics: the overlay is an absolutely-positioned div stacked ON TOP
 * of the textarea with identical typography/padding, transparent text,
 * and pointer-events disabled — except on the <mark> elements, which
 * accept clicks. The overlay only renders when the (300ms-debounced)
 * preview matches the current draft exactly, so highlights never sit on
 * stale offsets while the user is mid-keystroke.
 */
const HighlightedDraftInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  preview: import('../../hooks/useV2SanitizationPreview.ts').PreviewData;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Reports the currently-selected text (empty string when none). */
  onSelectionChange?: (selected: string) => void;
}> = ({ value, onChange, preview, disabled, onKeyDown, onSelectionChange }) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const reportSelection = () => {
    if (!onSelectionChange) return;
    const ta = taRef.current;
    if (!ta) return;
    const sel =
      ta.selectionStart != null && ta.selectionEnd != null && ta.selectionEnd > ta.selectionStart
        ? ta.value.slice(ta.selectionStart, ta.selectionEnd)
        : '';
    onSelectionChange(sel);
  };

  // The preview is debounced, so it can lag the draft by a keystroke or
  // two. Only overlay highlights when the segments reconstruct the
  // current value exactly — otherwise offsets would be wrong.
  const previewText = preview.segments.map((s) => s.text).join('');
  const inSync = previewText === value && preview.tokens.length > 0;

  const syncScroll = () => {
    if (overlayRef.current && taRef.current) {
      overlayRef.current.scrollTop = taRef.current.scrollTop;
      overlayRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  return (
    <div className="relative flex-1">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onSelect={reportSelection}
        onBlur={reportSelection}
        placeholder="Ask a California legal-research question…"
        rows={2}
        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
        disabled={disabled}
        onKeyDown={onKeyDown}
      />
      {inSync && (
        <div
          ref={overlayRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent px-3 py-2 text-sm text-transparent"
        >
          {preview.segments.map((seg, i) =>
            seg.token ? (
              <mark
                key={i}
                onClick={() => {
                  // Newest instruction wins: un-protect if it was on the
                  // "always privileged" list, then allow.
                  removeFromUserDenylist(seg.token!.raw);
                  addToUserAllowlist(seg.token!.raw);
                }}
                title={`${seg.token.value} — click to mark "${seg.token.raw}" as NOT privileged (always send as-is on this device)`}
                className="pointer-events-auto cursor-pointer rounded-sm bg-amber-200/70 text-transparent underline decoration-amber-600 decoration-dotted underline-offset-4 hover:bg-amber-300"
              >
                {seg.text}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            )
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Live sanitization preview panel — appears below the textarea. Shows
 * the detector's verdict on the in-progress text after a 300ms debounce.
 * Informational; never blocks submission (per the 7th addendum).
 */
const LiveSanitizationPanel: React.FC<{
  draft: string;
  preview: import('../../hooks/useV2SanitizationPreview.ts').PreviewData;
  hasDetections: boolean;
  isComputing: boolean;
}> = ({ draft, preview, hasDetections, isComputing }) => {
  if (!draft.trim()) return null;
  if (isComputing && !hasDetections) {
    // Brief pre-debounce state — show a faint placeholder so the user
    // knows the system is looking, not just silent.
    return (
      <div className="mt-2 text-[11px] text-gray-400 italic">Analyzing…</div>
    );
  }
  if (!hasDetections) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          🌐 No privileged content detected
        </span>
      </div>
    );
  }
  // Detections — list categories with counts; show the first ~3 raw matches.
  const counts = preview.categoryCounts;
  const parts = Object.entries(counts)
    .filter(([, n]) => (n as number) > 0)
    .map(([cat, n]) => `${n} ${cat.replace(/_/g, ' ')}${(n as number) > 1 ? 's' : ''}`);
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
          ⚠️ Detected: {parts.join(' · ')}
        </span>
        <span className="text-[10px] text-gray-400">Web search remains available — your call.</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {preview.tokens.slice(0, 8).map((t) => (
          <span
            key={t.value}
            className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] text-amber-900"
            title={`Will tokenize as ${t.value}`}
          >
            <span className="font-mono">{t.value}</span>
            <span className="text-amber-700/70">= {t.raw.slice(0, 24)}{t.raw.length > 24 ? '…' : ''}</span>
            <button
              type="button"
              // Mark this term "not private" — adds it to the per-device
              // user allowlist. detectPii (send path) and the preview both
              // then skip it, so it goes over the wire as plain text. The
              // preview recomputes via the allowlist-changed subscription.
              onClick={() => {
                removeFromUserDenylist(t.raw);
                addToUserAllowlist(t.raw);
              }}
              title={`Not private — always send "${t.raw.slice(0, 40)}" as-is (this device). Manage under “Privacy lists” below.`}
              aria-label={`Mark "${t.raw}" as not private`}
              className="ml-0.5 -mr-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-amber-700/60 hover:bg-amber-200 hover:text-amber-900"
            >
              ×
            </button>
          </span>
        ))}
        {preview.tokens.length > 8 && (
          <span className="text-[10px] text-gray-400">+{preview.tokens.length - 8} more</span>
        )}
      </div>
    </div>
  );
};

/**
 * Privacy-lists management modal. Two per-device lists (localStorage):
 *   - Allowed terms (user allowlist)  — "not privileged, always send raw"
 *   - Protected terms (user denylist) — "always privileged, always redact"
 * Entries can be removed (un-dismiss / un-protect) and new protected
 * terms can be typed in directly. Live-updates via the same-tab /
 * cross-tab subscriptions, so edits made elsewhere (chip ×, highlight
 * click, selection button) appear immediately.
 */
const PrivacyListsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeToUserAllowlist(() => setVersion((v) => v + 1)), []);
  useEffect(() => subscribeToUserDenylist(() => setVersion((v) => v + 1)), []);
  // Re-read on every version bump.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allowed = useMemo(() => getUserAllowlist(), [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const protectedTerms = useMemo(() => getUserDenylist(), [version]);
  const [newProtected, setNewProtected] = useState('');
  const [newAllowed, setNewAllowed] = useState('');

  const TermRow: React.FC<{ term: string; onRemove: () => void; removeTitle: string }> = ({
    term,
    onRemove,
    removeTitle,
  }) => (
    <li className="flex items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-2.5 py-1.5">
      <span className="truncate text-xs text-gray-800">{term}</span>
      <button
        type="button"
        onClick={onRemove}
        title={removeTitle}
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 hover:bg-red-50 hover:text-red-600"
      >
        Remove
      </button>
    </li>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Privacy lists</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Stored on this device only. These lists teach the privacy filter your
          preferences: allowed terms are always sent as-is; protected terms are
          always redacted (tokenized) before anything leaves this computer.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Allowed (not privileged) */}
          <section>
            <h3 className="mb-1 text-sm font-semibold text-emerald-700">
              🌐 Allowed terms <span className="font-normal text-gray-400">({allowed.length})</span>
            </h3>
            <p className="mb-2 text-[11px] text-gray-500">
              Marked “not privileged” — never flagged, sent as plain text.
            </p>
            <form
              className="mb-2 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const t = newAllowed.trim();
                if (!t) return;
                removeFromUserDenylist(t);
                addToUserAllowlist(t);
                setNewAllowed('');
              }}
            >
              <input
                value={newAllowed}
                onChange={(e) => setNewAllowed(e.target.value)}
                placeholder="Add a term…"
                className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-emerald-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newAllowed.trim()}
                className="shrink-0 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-300"
              >
                Add
              </button>
            </form>
            {allowed.length === 0 ? (
              <div className="rounded border border-dashed border-gray-200 px-3 py-4 text-center text-[11px] text-gray-400">
                Nothing here yet. Click a highlighted word in the input (or the ×
                on a detection chip) to mark it not privileged.
              </div>
            ) : (
              <ul className="space-y-1">
                {allowed.map((t) => (
                  <TermRow
                    key={t}
                    term={t}
                    onRemove={() => removeFromUserAllowlist(t)}
                    removeTitle="Remove — the detector may flag this term again"
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Protected (always privileged) */}
          <section>
            <h3 className="mb-1 text-sm font-semibold text-rose-700">
              🔒 Protected terms <span className="font-normal text-gray-400">({protectedTerms.length})</span>
            </h3>
            <p className="mb-2 text-[11px] text-gray-500">
              Marked “always privileged” — always redacted before sending, even
              if the detector misses them.
            </p>
            <form
              className="mb-2 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const t = newProtected.trim();
                if (!t) return;
                addToUserDenylist(t);
                setNewProtected('');
              }}
            >
              <input
                value={newProtected}
                onChange={(e) => setNewProtected(e.target.value)}
                placeholder="Add a term (e.g. a client name)…"
                className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-rose-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newProtected.trim()}
                className="shrink-0 rounded bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:bg-gray-300"
              >
                Add
              </button>
            </form>
            {protectedTerms.length === 0 ? (
              <div className="rounded border border-dashed border-gray-200 px-3 py-4 text-center text-[11px] text-gray-400">
                Nothing here yet. Select text in the input and click “Always
                treat as privileged”, or add a term above.
              </div>
            ) : (
              <ul className="space-y-1">
                {protectedTerms.map((t) => (
                  <TermRow
                    key={t}
                    term={t}
                    onRemove={() => removeFromUserDenylist(t)}
                    removeTitle="Remove — this term will no longer be force-redacted"
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  sources?: V2SourceSummary[];
  workflow?: 'quick' | 'research';
}> = ({
  role,
  text,
  streaming,
  sources,
  workflow,
}) => {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  const { getMap, tokenCount } = useSanitizer();

  // Highlight protected (tokenized-and-sent) spans in the user's own
  // bubble. The bubble shows rehydrated REAL names for the attorney, but
  // every value in the token map is something that was swapped for a
  // TOKEN before the request left this laptop. Wrapping those values in a
  // yellow <mark> gives the attorney live visual proof of exactly what was
  // protected. Display-only: does not touch what is stored or sent.
  const highlighted = useMemo(() => {
    if (!isUser) return null;
    // tokenCount referenced so this recomputes when the IDB map loads.
    void tokenCount;
    const values = Array.from(getMap().values())
      .filter((v) => v && v.trim().length > 1)
      // Longest first so "John Smith" wins over "John" and we don't make
      // overlapping/partial matches.
      .sort((a, b) => b.length - a.length);
    if (values.length === 0) return null;
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${values.map(esc).join('|')})`, 'g');
    const parts = text.split(re);
    if (parts.length === 1) return null; // nothing matched
    const valueSet = new Set(values);
    return parts.map((part, i) =>
      valueSet.has(part) ? (
        <mark
          key={i}
          title="Protected — sent as a token, never as the real value"
          className="rounded px-0.5 bg-yellow-300 text-gray-900"
        >
          {part}
        </mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );
  }, [isUser, text, getMap, tokenCount]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers (and Playwright headless without permission) block
      // clipboard writes — fall back to a temporary textarea + execCommand.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {}
    }
  }, [text]);

  const handlePrint = useCallback(() => {
    // Open the message text in a print-only window so we don't print the
    // whole chat surface. Header for context.
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>V2 Message</title>
      <style>body{font-family:Georgia,serif;padding:2rem;max-width:7in;margin:0 auto;color:#1a1a1a}pre{white-space:pre-wrap;font:inherit}</style>
      </head><body><pre>${text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</pre>
      <script>window.onload = () => window.print();</script></body></html>`);
    w.document.close();
  }, [text]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] flex flex-col gap-1">
        <div
          className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
            isUser
              ? 'bg-pink-500 text-white whitespace-pre-wrap'
              : 'bg-white border border-gray-200 text-gray-900 shadow-sm v2-md'
          }`}
        >
          {!isUser && <InventedTokenWarning text={text} />}
          {isUser ? (
            highlighted ?? text
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-600 underline hover:text-pink-700"
                  />
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          )}
          {streaming && !isUser && <span className="ml-1 inline-block animate-pulse">▍</span>}
        </div>

        {/* Guardrail warning (P4.2) — flags case names cited in the
            answer but not present in the sources panel. */}
        {!isUser && !streaming && (() => {
          const result = checkAnswer(text, sources ?? []);
          if (result.warnings.length === 0) return null;
          return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900">
              ⚠ {result.warnings[0]}
            </div>
          );
        })()}

        {/* Sources panel (P2.3) — appears on completed assistant
            messages that had tool calls. Shows what the agent used. */}
        {!isUser && !streaming && sources && sources.length > 0 && (
          <SourcesPanel sources={sources} />
        )}

        {/* Per-message actions: only on completed assistant messages.
            Hidden on user bubbles and while the assistant is still
            streaming. */}
        {!isUser && !streaming && (
          <div className="flex items-center gap-2 text-[11px] text-gray-400 px-1 flex-wrap">
            <button
              type="button"
              onClick={handleCopy}
              className="hover:text-pink-600 inline-flex items-center gap-1"
              title={copied ? 'Copied!' : 'Copy to clipboard'}
              aria-label="Copy message"
            >
              {copied ? '✓ Copied' : '⧉ Copy'}
            </button>
            <span className="text-gray-300">·</span>
            <button
              type="button"
              onClick={handlePrint}
              className="hover:text-pink-600 inline-flex items-center gap-1"
              title="Print message"
              aria-label="Print message"
            >
              ⎙ Print
            </button>
            {workflow && (
              <>
                <span className="text-gray-300">·</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    workflow === 'quick'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-purple-50 text-purple-700 border border-purple-200'
                  }`}
                  title={workflow === 'quick' ? 'Generated with Quick Answer (Sonnet, no tools)' : 'Generated with Research Memo (Fable 5 + full tools)'}
                >
                  {workflow === 'quick' ? 'Quick' : 'Research'}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Sources panel — rendered below an assistant bubble that had tool calls.
 * Lists per-tool what was retrieved. Click-throughs go to the actual
 * source URL. A tool-agnostic listing that covers CourtListener / LegiScan /
 * OpenStates / citation_verify.
 */
const SourcesPanel: React.FC<{ sources: V2SourceSummary[] }> = ({ sources }) => {
  // P4.3 — dedupe near-duplicates (CourtListener + citation_verify can
  // both surface the same case) and cap to 12.
  const pruned = pruneSources(sources, 12);
  // Group by source_type so the user sees "CourtListener (2), LegiScan (1)" sections
  const grouped = pruned.reduce<Record<string, V2SourceSummary[]>>((acc, s) => {
    (acc[s.source_type] = acc[s.source_type] ?? []).push(s);
    return acc;
  }, {});
  const labelFor = (t: string): string => {
    switch (t) {
      case 'courtlistener': return 'CourtListener Cases';
      case 'legiscan': return 'LegiScan Bills';
      case 'openstates': return 'OpenStates Bills';
      case 'citation_verify': return 'Verified Citations';
      case 'ca_code': return 'California Code Sections';
      case 'web': return 'Web Results';
      default: return t;
    }
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] space-y-1.5">
      <div className="font-semibold text-gray-700 uppercase tracking-wider text-[10px]">Sources</div>
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <div className="text-[10px] font-semibold text-pink-700 mb-0.5">
            {labelFor(type)} <span className="text-gray-400">({items.length})</span>
          </div>
          <ul className="space-y-0.5 ml-2 list-disc list-inside">
            {items.map((s, i) => (
              <li key={i} className="text-gray-700">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-600 underline hover:text-pink-700"
                  >
                    {s.title}
                  </a>
                ) : (
                  <span>{s.title}</span>
                )}
                {s.status && (
                  <span className={`ml-2 inline-block rounded px-1 text-[9px] ${s.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : s.status === 'not_found' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'}`}>
                    {s.status}
                  </span>
                )}
                {s.detail && <span className="text-gray-500"> — {s.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
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
