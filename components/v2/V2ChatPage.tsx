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
 *        a teal check + elapsed ms once results return.
 *      - Streaming text into the assistant bubble as tokens arrive.
 *      - Final summary footer (tool_rounds, total_tokens, elapsed) on
 *        the 'done' event.
 *   * On error: shows a red banner with the code + message and stops
 *     the stream.
 *
 * Visual language: DancingElephant (2026-08 rebrand) — Inter UI on the
 * #FCFBF9 app canvas, violet #7C5CFC primary, teal verified / amber
 * privileged / red error accents, lucide line icons, light mode only.
 * Design source of truth: docs/design-handoff/README.md + artboards 02/03.
 *
 * INPUT FILES: none. OUTPUT FILES: none.
 * (network: /api/agent/* SSE, /api/agent/session, /api/matter-context)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  FileText,
  Info,
  Package,
  Paperclip,
  Printer,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Square,
  TriangleAlert,
  X,
} from 'lucide-react';
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
import { extractTextFromFile } from '../draftingMagic/fileTextExtraction';
import {
  boxStatus as fetchBoxStatus,
  connectBox,
  openBoxPopup,
  downloadBoxFile,
  type BoxItem,
  type BoxStatus,
} from '../../services/boxClient.ts';
import { BoxBrowserModal } from './BoxBrowserModal.tsx';

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
    <div className="mb-3 flex gap-2.5 rounded-[10px] border border-deamber-line bg-deamber-bg2 px-3 py-2.5 text-[12.5px] text-deamber-text">
      <TriangleAlert size={15} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0" />
      <div>
        <div className="mb-0.5 font-semibold">
          Model referenced {unknown.length} token{unknown.length !== 1 ? 's' : ''} not in your local map
        </div>
        <div>
          {shown}
          {more}. These were not assigned from your prompt — treat as potentially invented. Verify
          the specific identifier before relying on it.
        </div>
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
 * Time-of-day greeting for the empty state (artboard 02). Purely cosmetic.
 */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning, Counselor.';
  if (h < 18) return 'Good afternoon, Counselor.';
  return 'Good evening, Counselor.';
}

/** The example question the "Research a question" card prefills. */
const SUGGESTED_RESEARCH_QUESTION =
  "What's the statute of limitations on breach of a written contract in California?";

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
  // The fresh id lives in state (not a memo) so the "New chat" button can
  // re-mint it even when the URL doesn't change — clicking New chat while
  // already on /v2 was previously a silent no-op.
  const [freshSessionId, setFreshSessionId] = useState<string>(() => newSessionId());
  const sessionId = urlSessionId ?? freshSessionId;
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
  const { state, send, reset, cancel } = useV2AgentStream();
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

  // "New chat" support. The sidebar navigates to /v2 with a fresh nonce in
  // location.state. When the user is ALREADY on /v2 (no URL session id),
  // that navigation changes nothing react-router-visible — so we watch the
  // nonce and hard-reset the surface: new session id, cleared messages,
  // cleared draft, cleared stream state. The mount-time nonce is remembered
  // and ignored so a browser refresh (which replays history state) doesn't
  // wipe a restored draft.
  const location = useLocation();
  const initialNewChatNonce = useRef<number | null>(
    (location.state as { newChat?: number } | null)?.newChat ?? null,
  );
  useEffect(() => {
    const nonce = (location.state as { newChat?: number } | null)?.newChat ?? null;
    if (nonce === null || nonce === initialNewChatNonce.current) return;
    initialNewChatNonce.current = nonce;
    if (urlSessionId) return; // URL change handles the reset on its own
    setFreshSessionId(newSessionId());
    setMessages([]);
    setDraft('');
    setMobileGateNotice(null);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, urlSessionId]);

  // Which session the in-flight stream belongs to. Set by onSubmit,
  // checked by the done-fold effect (cross-session guard, review fix C5),
  // cleared on session switches.
  const streamingSessionRef = useRef<string | null>(null);

  // Session switch (param-only /v2/abc → /v2/def navigation reuses this
  // component instance — no remount). Abort any in-flight stream so
  // session A's answer can't stream into session B's view, and restore
  // the destination session's saved draft (previously the half-typed
  // draft bled from one session into the next and then saved under the
  // wrong key).
  const prevUrlSessionRef = useRef<string | null>(urlSessionId);
  useEffect(() => {
    if (prevUrlSessionRef.current === urlSessionId) return;
    prevUrlSessionRef.current = urlSessionId;
    reset();
    streamingSessionRef.current = null;
    setMobileGateNotice(null);
    try {
      // Named session → restore its saved draft. Bare /v2 → clear (the
      // New-chat flow wants an empty box; initial-mount restore is
      // handled by the useState initializer, which this effect skips
      // because the ref starts equal to the mount-time urlSessionId).
      setDraft(
        urlSessionId
          ? window.localStorage.getItem(LOCAL_DRAFT_KEY(urlSessionId)) ?? ''
          : '',
      );
    } catch {
      setDraft('');
    }
  }, [urlSessionId, reset]);

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

  // ----- Attachments (local file or Box) -----
  // The attached document's TEXT is composed into user_text on send, so it
  // flows through the exact same on-device PII tokenization as typed text.
  const [attachedDoc, setAttachedDoc] = useState<{ name: string; text: string } | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachOcrStatus, setAttachOcrStatus] = useState<string | null>(null);
  const [chatBoxState, setChatBoxState] = useState<BoxStatus>({ configured: false, connected: false });
  const [chatBoxBrowse, setChatBoxBrowse] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const MAX_ATTACH_CHARS = 400_000;
  const attachPreviewText = attachedDoc ? attachedDoc.text.slice(0, 60_000) : '';
  const { preview: attachPreview, hasDetections: attachHasDetections } =
    useV2SanitizationPreview(attachPreviewText);

  useEffect(() => {
    void fetchBoxStatus(getToken).then(setChatBoxState);
  }, [getToken]);

  const attachFile = useCallback(async (file: File) => {
    setAttachBusy(true);
    setAttachError(null);
    setAttachOcrStatus(null);
    try {
      const extracted = await extractTextFromFile(file, {
        onOcrProgress: (done, total) =>
          setAttachOcrStatus(`Reading scanned page ${done} of ${total}… (OCR runs on this device)`),
      });
      const text = extracted.text.trim();
      if (!text) {
        setAttachError(extracted.warning ?? 'No readable text found in that file.');
      } else if (text.length > MAX_ATTACH_CHARS) {
        setAttachError(`That document is too large to attach (${Math.round(text.length / 1000)}k characters; limit ${MAX_ATTACH_CHARS / 1000}k). Use the Draft page for long documents.`);
      } else {
        setAttachedDoc({ name: file.name, text });
        if (extracted.warning) setAttachError(extracted.warning);
      }
    } catch (err) {
      setAttachError(`Could not read file: ${(err as Error).message}`);
    } finally {
      setAttachBusy(false);
      setAttachOcrStatus(null);
      if (attachInputRef.current) attachInputRef.current.value = '';
    }
  }, []);

  const onAttachBoxClick = useCallback(async () => {
    setAttachError(null);
    if (!chatBoxState.connected) {
      const popup = openBoxPopup();
      setAttachBusy(true);
      const ok = await connectBox(getToken, popup);
      setAttachBusy(false);
      if (!ok) {
        setAttachError('Box sign-in did not complete. Try again.');
        return;
      }
      setChatBoxState(await fetchBoxStatus(getToken));
    }
    setChatBoxBrowse(true);
  }, [chatBoxState.connected, getToken]);

  const onAttachBoxPicked = useCallback(
    async (item: BoxItem) => {
      setChatBoxBrowse(false);
      setAttachBusy(true);
      setAttachError(null);
      try {
        const file = await downloadBoxFile(getToken, item);
        await attachFile(file);
      } catch (err) {
        setAttachError(`Could not load from Box: ${(err as Error).message}`);
      } finally {
        setAttachBusy(false);
      }
    },
    [getToken, attachFile],
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if ((!text && !attachedDoc) || state.isStreaming) return;
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
      // Compose the wire text: attached document first (labeled), then the
      // user's message. Both are tokenized on-device by send().
      const question = text || 'Please review the attached document.';
      const wireText = attachedDoc
        ? `ATTACHED DOCUMENT: ${attachedDoc.name}\n"""\n${attachedDoc.text}\n"""\n\n${question}`
        : text;
      // Add the user message to the visible list immediately (attachment
      // shown as a chip line, not the full document body).
      const visibleText = attachedDoc ? `Attached: ${attachedDoc.name}\n\n${question}` : text;
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text: visibleText },
      ]);
      setAttachedDoc(null);
      setDraft('');
      // Clear the persisted draft — message has flown.
      try {
        const sid = urlSessionId ?? 'new';
        window.localStorage.removeItem(LOCAL_DRAFT_KEY(sid));
      } catch {}
      // Record which session this stream belongs to, so the done-fold
      // below can refuse to graft the answer onto a DIFFERENT session's
      // transcript if the user navigates mid-stream (review fix C5).
      streamingSessionRef.current = sessionId;
      void send({
        session_id: sessionId,
        user_text: wireText,
        user_id: userId,
        workflow,
      });
    },
    // `workflow` and `urlSessionId` were missing here (2026-07-04 review
    // fix): toggling Quick↔Research without retyping sent the PREVIOUS
    // workflow from the stale closure.
    [draft, attachedDoc, state.isStreaming, send, sessionId, userId, matterMode, workflow, urlSessionId],
  );

  // When `done` fires, fold the streamed tokens into a permanent assistant
  // message so subsequent turns start with a clean slate.
  useEffect(() => {
    // final_text can arrive without token events (structured-output /
    // no-stream flows) — fold whenever either is present.
    if (state.done && (state.done.final_text || state.tokens)) {
      // Cross-session guard (review fix C5): navigating /v2/abc → /v2/def
      // is a param-only change (no remount), so a stream started in
      // session A can complete while session B's transcript is on
      // screen. Fold ONLY when the stream's session is still active;
      // either way, invalidate the STREAM's session cache (the turn
      // landed there), not the currently-viewed one.
      const streamSession = streamingSessionRef.current;
      invalidateSession(streamSession ?? sessionId);
      (window as unknown as { __v2RefreshSidebar?: () => void }).__v2RefreshSidebar?.();
      if (streamSession !== null && streamSession !== sessionId) {
        reset();
        return;
      }
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
      // Reset stream state so the next turn's privileged chip + tool events
      // don't carry over from the previous turn.
      // Use a short timeout so the user can see the final summary briefly
      // before it clears.
      const t = window.setTimeout(() => reset(), 1500);
      return () => window.clearTimeout(t);
    }
  }, [state.done, state.tokens, reset, sessionId, workflow, state.sources]);

  const privilegedBadge = useMemo(() => {
    if (!state.sanitization) return null;
    const { privileged, compound_risk_buckets, redactions_count } = state.sanitization;
    // TWO meters, both shown (2026-08-17 fix — showing only the server's
    // scan read as "nothing was detected" right after the attachment chip
    // said 34 items would be protected; both were true):
    //   1. on-device tokenization count (state.wireRedactions — what the
    //      browser replaced with CLIENT_xxx placeholders BEFORE sending)
    //   2. the server backstop's scan of the already-tokenized wire text.
    // Informational only — the privileged flag no longer gates web_search.
    const clientCount = state.wireRedactions ?? 0;
    const clientChip =
      clientCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-deamber-line bg-deamber-bg px-3 py-1 text-xs font-semibold text-deamber-text">
          <Shield size={12} strokeWidth={1.8} aria-hidden />
          {clientCount} private item{clientCount === 1 ? '' : 's'} tokenized on this device before sending
        </span>
      ) : null;
    if (privileged) {
      const reasons: string[] = [];
      if (compound_risk_buckets > 0) reasons.push(`compound risk ×${compound_risk_buckets}`);
      if (redactions_count > 0) reasons.push(`${redactions_count} redaction${redactions_count > 1 ? 's' : ''}`);
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {clientChip}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-deamber-line bg-deamber-bg px-3 py-1 text-xs font-semibold text-deamber-text">
            <TriangleAlert size={12} strokeWidth={1.8} aria-hidden />
            Server backstop flagged privileged content
            {reasons.length > 0 && <span className="font-medium opacity-80">({reasons.join(' · ')})</span>}
          </span>
        </span>
      );
    }
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {clientChip}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-deteal-line bg-deteal-bg px-3 py-1 text-xs font-semibold text-deteal-text">
          {clientCount > 0 ? (
            <Check size={12} strokeWidth={2.2} aria-hidden />
          ) : (
            <ShieldCheck size={12} strokeWidth={1.8} aria-hidden />
          )}
          {clientCount > 0
            ? 'Server backstop clean — no raw private data reached the server'
            : 'Nothing needed protection — no private items found on-device; server backstop clean'}
        </span>
      </span>
    );
  }, [state.sanitization, state.wireRedactions]);

  // Header title — the first user message, truncated. Display only; no
  // server-side session title exists yet.
  const sessionTitle = useMemo(() => {
    const first = displayedMessages.find((m) => m.role === 'user');
    if (!first) return 'New chat';
    const line = first.text.replace(/\s+/g, ' ').trim();
    return line.length > 64 ? `${line.slice(0, 64)}…` : line || 'New chat';
  }, [displayedMessages]);

  return (
    <div className="flex h-screen flex-col bg-surface-app font-sans text-ink">
      {/* P2.4 — informed-consent attestation. Self-gates via useAttestation
          per Clerk user ID. Soft gate by default (dismissable). */}
      <ConfidentialityAttestation softGate />

      {/* Signature gradient accent bar (artboard 02/03). */}
      <div className="h-[3px] shrink-0 bg-de-gradient" aria-hidden />

      <header className="shrink-0 border-b border-surface-line2 bg-white px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-semibold text-ink">{sessionTitle}</div>
            <div className="truncate text-[11px] text-ink-faint">
              session <span className="font-mono">{sessionId.slice(0, 16)}…</span>
            </div>
          </div>
          <MatterModeSelector sessionId={sessionId} getToken={getToken} onModeChange={setMatterMode} />
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto flex h-full max-w-[820px] flex-col">
          <WorkflowToggle
            workflow={workflow}
            onSelectWorkflow={setWorkflow}
            disabled={state.isStreaming}
          />

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-5">
            {displayedMessages.length === 0 && !state.isStreaming && !hydrating && (
              <div className="flex flex-col items-center px-2 py-6 text-center sm:py-10">
                <img
                  src="/dancingelephant.png"
                  alt=""
                  className="mb-6 h-[72px] w-[72px] rounded-[20px]"
                />
                <div className="mb-2 font-display text-[26px] font-semibold leading-tight text-ink sm:text-[34px]">
                  {greeting()}
                </div>
                <div className="mb-8 text-[15px] text-ink-muted">What are we working on today?</div>
                <div className="grid w-full max-w-[620px] grid-cols-1 gap-3.5 text-left sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkflow('research');
                      setDraft(SUGGESTED_RESEARCH_QUESTION);
                    }}
                    className="rounded-xl border border-surface-line bg-white p-[18px] text-left transition hover:border-brand-hover"
                  >
                    <Search size={18} strokeWidth={1.5} className="text-brand" aria-hidden />
                    <div className="mb-1 mt-2.5 text-sm font-semibold text-ink">Research a question</div>
                    <div className="text-[12.5px] leading-relaxed text-ink-muted">
                      “{SUGGESTED_RESEARCH_QUESTION}”
                    </div>
                  </button>
                  <Link
                    to="/v2/draft"
                    className="rounded-xl border border-surface-line bg-white p-[18px] text-left transition hover:border-brand-hover"
                  >
                    <FileText size={18} strokeWidth={1.5} className="text-brand" aria-hidden />
                    <div className="mb-1 mt-2.5 text-sm font-semibold text-ink">Draft a motion</div>
                    <div className="text-[12.5px] leading-relaxed text-ink-muted">
                      Start a motion to compel, demurrer, or discovery response from a template.
                    </div>
                  </Link>
                  <Link
                    to="/v2/verify"
                    className="rounded-xl border border-surface-line bg-white p-[18px] text-left transition hover:border-brand-hover"
                  >
                    <CircleCheck size={18} strokeWidth={1.5} className="text-brand" aria-hidden />
                    <div className="mb-1 mt-2.5 text-sm font-semibold text-ink">Verify citations</div>
                    <div className="text-[12.5px] leading-relaxed text-ink-muted">
                      Paste a brief — every cite is checked against the official record.
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => attachInputRef.current?.click()}
                    className="rounded-xl border border-surface-line bg-white p-[18px] text-left transition hover:border-brand-hover"
                  >
                    <BookOpen size={18} strokeWidth={1.5} className="text-brand" aria-hidden />
                    <div className="mb-1 mt-2.5 text-sm font-semibold text-ink">Summarize a document</div>
                    <div className="text-[12.5px] leading-relaxed text-ink-muted">
                      Upload a contract or opinion and get the key points in plain language.
                    </div>
                  </button>
                </div>
                <div className="mt-9 flex items-center gap-2 text-[12.5px] text-ink-muted">
                  <ShieldCheck size={14} strokeWidth={1.5} className="text-deteal-icon shrink-0" aria-hidden />
                  Your clients' information is protected on your device before anything is sent.
                </div>
              </div>
            )}
            {hydrating && (
              <div className="py-6 text-center text-sm italic text-ink-faint">Loading prior session…</div>
            )}

            {displayedMessages.map((m) => (
              <MessageBubble key={m.id} role={m.role} text={m.text} sources={m.sources} workflow={m.workflow} />
            ))}

            {state.isStreaming && (
              <div className="space-y-2.5">
                {privilegedBadge && <div className="flex justify-start">{privilegedBadge}</div>}
                {state.tokens ? (
                  <MessageBubble
                    role="assistant"
                    text={state.tokens}
                    streaming
                    toolEvents={state.toolEvents}
                  />
                ) : (
                  <div>
                    <AssistantHeader toolEvents={state.toolEvents} />
                    {state.round > 0 && (
                      <div className="flex items-center gap-2.5">
                        <div className="de-thinkline" style={{ width: 200 }} aria-hidden />
                        <span className="text-xs text-ink-faint">
                          {state.round === 1 ? 'Thinking…' : `Working on round ${state.round}…`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {state.refusal && (
              <div className="flex gap-2.5 rounded-[10px] border border-deamber-line bg-deamber-bg2 px-3 py-2.5 text-[12.5px] text-deamber-text">
                <TriangleAlert size={15} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0" />
                <div>
                  <strong className="font-semibold">
                    DancingElephant declined this request
                    {state.refusal.category ? ` (${state.refusal.category})` : ''}
                  </strong>{' '}
                  and explained why.
                  {state.refusal.explanation && (
                    <div className="mt-1">{state.refusal.explanation}</div>
                  )}
                  <div className="mt-1 opacity-80">
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
                    className="mt-2 rounded-lg border border-deamber-line bg-white px-3 py-1.5 text-xs font-semibold text-deamber-text transition hover:bg-deamber-bg"
                  >
                    Edit &amp; resend
                  </button>
                </div>
              </div>
            )}

            {state.modelFailover && (
              <div className="flex gap-2.5 rounded-[10px] border border-brand-line bg-[#F8F6FE] px-3 py-2.5 text-[12.5px] text-[#4A3E91]">
                <Info size={15} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0 text-brand-deep" />
                <span>
                  <strong className="font-semibold">Switched to backup model.</strong> The primary
                  model was unavailable; quality is unaffected.{' '}
                  <span className="font-mono text-[11px] opacity-80">
                    {state.modelFailover.from} → {state.modelFailover.to}
                  </span>{' '}
                  — same provider (Anthropic), same privacy posture. Set{' '}
                  <code className="rounded bg-brand-tint px-1">V2_PRIMARY_MODEL</code> to change
                  the default engine.
                </span>
              </div>
            )}

            {state.error && (
              <div className="flex gap-2.5 rounded-[10px] border border-dered-line bg-dered-bg2 px-3 py-2.5 text-[12.5px] text-dered-text">
                <CircleAlert size={15} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0 text-dered" />
                <span>
                  <strong className="font-semibold">Couldn't reach the research service.</strong>{' '}
                  Your message wasn't sent — try again.
                  <div className="mt-1 font-mono text-[11px] opacity-80">
                    {state.error.proxy ? 'gate' : 'stream'} · {state.error.code}
                  </div>
                  <div className="mt-0.5">{state.error.message}</div>
                </span>
              </div>
            )}

            {state.done && (
              <div className="text-right text-[11px] text-ink-faint">
                {state.done.tool_rounds} tool round{state.done.tool_rounds === 1 ? '' : 's'} ·{' '}
                {state.done.total_tokens.toLocaleString()} tokens ·{' '}
                {Math.round(state.done.elapsed_ms / 100) / 10}s ·{' '}
                stop={state.done.stop_reason}
              </div>
            )}
          </div>

          {chatBoxBrowse && (
            <BoxBrowserModal
              mode="file"
              getToken={getToken}
              onPickFile={(item) => void onAttachBoxPicked(item)}
              onPickFolder={() => setChatBoxBrowse(false)}
              onClose={() => setChatBoxBrowse(false)}
            />
          )}
          <form onSubmit={onSubmit} className="shrink-0 px-4 pb-5 pt-1 sm:px-6">
            {mobileGateNotice && (
              <div className="mb-2.5 flex gap-2.5 rounded-[10px] border border-deamber-line bg-deamber-bg2 px-3 py-2.5 text-[12.5px] text-deamber-text">
                <TriangleAlert size={15} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0" />
                <span>
                  <strong className="font-semibold">Not sent. </strong>
                  {mobileGateNotice}
                </span>
              </div>
            )}
            {(attachedDoc || attachError || attachOcrStatus) && (
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                {attachedDoc && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-line3 bg-white px-3 py-1 text-ink-secondary">
                    <Paperclip size={12} strokeWidth={1.8} aria-hidden />
                    <span className="max-w-[280px] truncate font-medium">{attachedDoc.name}</span>
                    <span className="text-ink-faint">({Math.max(1, Math.round(attachedDoc.text.length / 1000))}k chars)</span>
                    {attachHasDetections ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-deamber-bg px-2 py-0.5 text-[10px] font-semibold text-deamber-text">
                        <Shield size={10} strokeWidth={1.8} aria-hidden />
                        {attachPreview.tokens.length} item{attachPreview.tokens.length === 1 ? '' : 's'} will be protected
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-pill px-2 py-0.5 text-[10px] text-ink-faint">
                        no private items detected — mark any missed name via select → redact
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachedDoc(null)}
                      className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-ink-faint hover:bg-surface-pill hover:text-ink-secondary"
                      aria-label="Remove attachment"
                    >
                      <X size={11} strokeWidth={2.2} aria-hidden />
                    </button>
                  </span>
                )}
                {attachOcrStatus && <span className="text-brand-deep">{attachOcrStatus}</span>}
                {attachError && <span className="text-deamber-text">{attachError}</span>}
              </div>
            )}
            <div className="rounded-[14px] border border-surface-line3 bg-white px-4 py-3.5 shadow-card">
              <input
                ref={attachInputRef}
                type="file"
                accept=".txt,.md,.doc,.docx,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void attachFile(f);
                }}
              />
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
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => attachInputRef.current?.click()}
                      disabled={state.isStreaming || attachBusy}
                      title="Attach a document from this Mac (.txt, .doc, .docx, .pdf — scanned PDFs are OCR'd on-device)"
                      aria-label="Attach a document"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-ctl bg-white text-ink-muted transition hover:bg-surface-pill disabled:opacity-50"
                    >
                      {attachBusy ? (
                        <span className="de-spinner" aria-hidden />
                      ) : (
                        <Paperclip size={15} strokeWidth={1.5} aria-hidden />
                      )}
                    </button>
                    {chatBoxState.configured && (
                      <button
                        type="button"
                        onClick={() => void onAttachBoxClick()}
                        disabled={state.isStreaming || attachBusy}
                        title="Attach a document from Box"
                        aria-label="Attach a document from Box"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-ctl bg-white text-ink-muted transition hover:bg-surface-pill disabled:opacity-50"
                      >
                        <Package size={15} strokeWidth={1.5} aria-hidden />
                      </button>
                    )}
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
                    <button
                      type="button"
                      // preventDefault on mousedown: without it, pressing the
                      // button blurs the textarea first, the blur handler
                      // collapses the selection, selectedText empties, and this
                      // button unmounts before its own click can fire.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        addToUserDenylist(selectedText);
                        setSelectedText('');
                      }}
                      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-deamber-line bg-deamber-bg px-2.5 py-1 text-[11px] font-semibold text-deamber-text transition hover:bg-deamber-bg2"
                      title="Always redact this text before sending (this device)"
                    >
                      <Shield size={11} strokeWidth={1.8} aria-hidden />
                      Always treat “{selectedText.trim().slice(0, 40)}
                      {selectedText.trim().length > 40 ? '…' : ''}” as privileged
                    </button>
                  )}
                </div>

                {state.isStreaming ? (
                  <button
                    type="button"
                    onClick={() => cancel()}
                    title="Stop this turn — partial output is kept"
                    aria-label="Stop"
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-surface-ctl bg-white text-ink-secondary transition hover:bg-surface-pill"
                  >
                    <Square size={13} strokeWidth={2} fill="currentColor" aria-hidden />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!draft.trim() && !attachedDoc}
                    aria-label="Send"
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-brand text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-surface-disabled disabled:text-ink-faint"
                  >
                    <Send size={15} strokeWidth={2} aria-hidden />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 text-center text-[11px] text-ink-faint">
              Names, addresses, and case numbers are replaced with tokens on this device — only
              tokens are sent.{' '}
              <button
                type="button"
                onClick={() => setShowPrivacyLists(true)}
                className="font-semibold text-brand underline decoration-dotted underline-offset-2 transition hover:text-brand-deep"
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
  const segment = 'px-3 py-[7px] transition whitespace-nowrap';
  return (
    <div className="shrink-0 px-4 pb-1 pt-3 sm:px-6">
      <div className="flex w-fit max-w-full overflow-x-auto rounded-[9px] border border-surface-line3 bg-white text-xs font-semibold">
        <button
          type="button"
          onClick={() => onSelectWorkflow('quick')}
          disabled={disabled}
          title="Quick Answer — Sonnet, no tools, ~5s"
          className={`${segment} ${
            workflow === 'quick' ? 'bg-brand text-white' : 'text-ink-muted hover:bg-surface-pill'
          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          Quick answer
        </button>
        <button
          type="button"
          onClick={() => onSelectWorkflow('research')}
          disabled={disabled}
          title="Research Memo — full tools, ~30s"
          className={`${segment} ${
            workflow === 'research' ? 'bg-brand text-white' : 'text-ink-muted hover:bg-surface-pill'
          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          Research memo
        </button>
        <Link
          to="/v2/draft"
          role="button"
          aria-label="Draft a document"
          title="Draft a document — templates + section streaming"
          className={`${segment} text-ink-muted hover:bg-surface-pill ${
            disabled ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          Draft a document
        </Link>
        <Link
          to="/v2/verify"
          role="button"
          aria-label="Verify citations"
          title="Verify citations — adversarial citation check"
          className={`${segment} text-ink-muted hover:bg-surface-pill ${
            disabled ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          Verify citations
        </Link>
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
    <div className="relative w-full">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onSelect={reportSelection}
        onBlur={reportSelection}
        placeholder="Ask a question about California law…"
        rows={2}
        className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-[1.6] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0"
        disabled={disabled}
        onKeyDown={onKeyDown}
      />
      {inSync && (
        <div
          ref={overlayRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border-0 p-0 text-sm leading-[1.6] text-transparent"
        >
          {preview.segments.map((seg, i) =>
            seg.token ? (
              // The mark body stays pointer-events-none so clicking a
              // highlighted word still places the caret in the textarea
              // underneath (2026-07-04 review fix — a full-mark click
              // target meant "click to edit a name" silently
              // un-protected it). The dismiss action lives on a small ×
              // badge floated above the word's end instead.
              <mark
                key={i}
                className="relative bg-deamber-hl text-transparent"
                // padding + equal negative margin: the highlight reads 3px
                // wider than the word (artboard 03) WITHOUT shifting any
                // character position, so the overlay still mirrors the
                // textarea underneath exactly.
                style={{
                  padding: '0 3px',
                  margin: '0 -3px',
                  borderBottom: '1.5px solid #E8A05C',
                  borderRadius: 3,
                }}
              >
                {seg.text}
                <button
                  type="button"
                  tabIndex={-1}
                  // preventDefault on mousedown keeps the textarea focused
                  // (no blur, no selection collapse) so the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    // Newest instruction wins: un-protect if it was on the
                    // "always privileged" list, then allow.
                    removeFromUserDenylist(seg.token!.raw);
                    addToUserAllowlist(seg.token!.raw);
                  }}
                  title={`${seg.token.value} — mark "${seg.token.raw}" as NOT privileged (always send as-is on this device)`}
                  aria-label={`Mark "${seg.token.raw}" as not privileged`}
                  className="pointer-events-auto absolute -right-2 -top-2.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-deamber-line bg-deamber-bg leading-none text-deamber-text shadow-card hover:bg-deamber-hl"
                >
                  <X size={9} strokeWidth={2.6} aria-hidden />
                </button>
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
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-surface-pillline bg-surface-pill px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
        <span className="de-spinner" aria-hidden />
        <span>Checking for privileged content…</span>
      </div>
    );
  }
  if (!hasDetections) {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-deteal-line bg-deteal-bg px-2.5 py-1 text-[11px] font-semibold text-deteal-text">
        <ShieldCheck size={12} strokeWidth={1.8} aria-hidden />
        Nothing to protect in this message
      </span>
    );
  }
  // Detections — list categories with counts; show the first ~8 raw matches.
  const counts = preview.categoryCounts;
  const parts = Object.entries(counts)
    .filter(([, n]) => (n as number) > 0)
    .map(([cat, n]) => `${n} ${cat.replace(/_/g, ' ')}${(n as number) > 1 ? 's' : ''}`);
  const count = preview.tokens.length;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-deamber-line bg-deamber-bg px-2.5 py-1 text-[11px] font-semibold text-deamber-text"
          title={`Detected: ${parts.join(' · ')}`}
        >
          <Shield size={12} strokeWidth={1.8} aria-hidden />
          {count} item{count === 1 ? '' : 's'} protected on this device
        </span>
        <span className="text-[10px] text-ink-faint">{parts.join(' · ')}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {preview.tokens.slice(0, 8).map((t) => (
          <span
            key={t.value}
            className="inline-flex items-center gap-1.5 rounded-[7px] border border-surface-line bg-surface-app px-2 py-0.5 text-[11px] text-ink-secondary"
            title={`Will tokenize as ${t.value}`}
          >
            <code className="font-mono text-deamber-text">{t.value}</code>
            <span className="text-[#C6BED2]">←</span>
            <span className="max-w-[180px] truncate">{t.raw.slice(0, 24)}{t.raw.length > 24 ? '…' : ''}</span>
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
              className="ml-0.5 -mr-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[#C6BED2] hover:bg-deamber-line hover:text-deamber-text"
            >
              <X size={10} strokeWidth={2.4} aria-hidden />
            </button>
          </span>
        ))}
        {preview.tokens.length > 8 && (
          <span className="text-[10px] text-ink-faint">+{preview.tokens.length - 8} more</span>
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
    <li className="flex items-center justify-between gap-2 rounded-lg border border-surface-line bg-surface-app px-2.5 py-1.5">
      <span className="truncate text-xs text-ink-secondary">{term}</span>
      <button
        type="button"
        onClick={onRemove}
        title={removeTitle}
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint hover:bg-dered-bg hover:text-dered"
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
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-[22px] font-semibold text-ink">Privacy lists</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-surface-pill hover:text-ink-secondary"
          >
            <X size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <p className="mb-4 text-xs text-ink-muted">
          Stored on this device only. These lists teach the privacy filter your
          preferences: allowed terms are always sent as-is; protected terms are
          always redacted (tokenized) before anything leaves this computer.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Allowed (not privileged) */}
          <section>
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-deteal-text">
              <ShieldCheck size={14} strokeWidth={1.8} aria-hidden />
              Allowed terms <span className="font-normal text-ink-faint">({allowed.length})</span>
            </h3>
            <p className="mb-2 text-[11px] text-ink-muted">
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
                className="min-w-0 flex-1 rounded-lg border border-surface-ctl px-2 py-1 text-xs text-ink focus:border-deteal-icon focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newAllowed.trim()}
                className="shrink-0 rounded-lg bg-deteal-icon px-2.5 py-1 text-xs font-semibold text-white hover:bg-deteal-icon2 disabled:bg-surface-disabled disabled:text-ink-faint"
              >
                Add
              </button>
            </form>
            {allowed.length === 0 ? (
              <div className="rounded-lg border border-dashed border-surface-line px-3 py-4 text-center text-[11px] text-ink-faint">
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
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-deamber-text">
              <Shield size={14} strokeWidth={1.8} aria-hidden />
              Protected terms <span className="font-normal text-ink-faint">({protectedTerms.length})</span>
            </h3>
            <p className="mb-2 text-[11px] text-ink-muted">
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
                className="min-w-0 flex-1 rounded-lg border border-surface-ctl px-2 py-1 text-xs text-ink focus:border-deamber-icon focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newProtected.trim()}
                className="shrink-0 rounded-lg bg-deamber-lock px-2.5 py-1 text-xs font-semibold text-white hover:bg-deamber-icon disabled:bg-surface-disabled disabled:text-ink-faint"
              >
                Add
              </button>
            </form>
            {protectedTerms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-surface-line px-3 py-4 text-center text-[11px] text-ink-faint">
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

/** Tool-activity event shape as emitted by useV2AgentStream. */
type ToolEventLike = { id?: string; name: string; status: string; elapsed_ms?: number };

/**
 * Assistant message header — logo tile + wordmark + the turn's tool pills
 * (artboard 03, lines 197-208).
 */
const AssistantHeader: React.FC<{ toolEvents?: ToolEventLike[] }> = ({ toolEvents }) => (
  <div className="mb-2.5 flex flex-wrap items-center gap-2">
    <img src="/dancingelephant.png" alt="" className="h-[22px] w-[22px] rounded-[6px]" />
    <span className="text-xs font-semibold text-ink-muted">DancingElephant</span>
    {toolEvents && toolEvents.length > 0 && (
      <div className="ml-1 flex flex-wrap gap-1.5">
        {toolEvents.map((t, i) => (
          <ToolPill key={t.id ?? `${t.name}_${i}`} tool={t} />
        ))}
      </div>
    )}
  </div>
);

const MessageBubble: React.FC<{
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  sources?: V2SourceSummary[];
  workflow?: 'quick' | 'research';
  /** Tool-activity pills shown inline in the assistant header. */
  toolEvents?: ToolEventLike[];
}> = ({
  role,
  text,
  streaming,
  sources,
  workflow,
  toolEvents,
}) => {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  const { getMap, tokenCount } = useSanitizer();

  // Highlight protected (tokenized-and-sent) spans in the user's own
  // bubble. The bubble shows rehydrated REAL names for the attorney, but
  // every value in the token map is something that was swapped for a
  // TOKEN before the request left this laptop. Wrapping those values in a
  // <mark> gives the attorney live visual proof of exactly what was
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
          className="bg-deamber-hl text-ink"
          style={{
            padding: '0 3px',
            borderBottom: '1.5px solid #E8A05C',
            borderRadius: 3,
          }}
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
    // whole chat surface. Header for context. Georgia here is deliberate:
    // this is a rendered legal document, the one place the serif is kept.
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>DancingElephant message</title>
      <style>body{font-family:Georgia,"Times New Roman",serif;padding:2rem;max-width:7in;margin:0 auto;color:#2A2233;line-height:1.9}pre{white-space:pre-wrap;font:inherit}</style>
      </head><body><pre>${text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</pre>
      <script>window.onload = () => window.print();</script></body></html>`);
    w.document.close();
  }, [text]);

  // ----- User bubble: right-aligned violet-tint card -----
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[540px] whitespace-pre-wrap bg-brand-tint px-4 py-3 text-sm leading-[1.6] text-ink"
          style={{ borderRadius: '14px 14px 4px 14px' }}
        >
          {highlighted ?? text}
        </div>
      </div>
    );
  }

  // ----- Assistant message: full-width inside the 760px column -----
  return (
    <div className="w-full">
      <AssistantHeader toolEvents={toolEvents} />
      <div className="v2-md text-[14.5px] leading-[1.7] text-ink">
        <InventedTokenWarning text={text} />
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, ...props }) => (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline hover:text-brand-deep"
              />
            ),
          }}
        >
          {text}
        </ReactMarkdown>
        {streaming && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="de-thinkline" style={{ width: 200 }} aria-hidden />
            <span className="text-xs text-ink-faint">Writing…</span>
          </div>
        )}
      </div>

      {/* Guardrail warning (P4.2) — flags case names cited in the
          answer but not present in the sources panel. */}
      {!streaming && (() => {
        const result = checkAnswer(text, sources ?? []);
        if (result.warnings.length === 0) return null;
        return (
          <div className="mt-3 flex gap-2.5 rounded-[10px] border border-deamber-line bg-deamber-bg2 px-3 py-2.5 text-[12.5px] text-deamber-text">
            <TriangleAlert size={15} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0" />
            <span>{result.warnings[0]}</span>
          </div>
        );
      })()}

      {/* Sources panel (P2.3) — appears on completed assistant
          messages that had tool calls. Shows what the agent used. */}
      {!streaming && sources && sources.length > 0 && <SourcesPanel sources={sources} />}

      {/* Per-message actions: only on completed assistant messages.
          Hidden on user bubbles and while the assistant is still
          streaming. */}
      {!streaming && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 transition hover:text-ink-secondary"
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            aria-label="Copy message"
          >
            {copied ? (
              <Check size={12} strokeWidth={2.2} className="text-deteal-icon" aria-hidden />
            ) : (
              <Copy size={12} strokeWidth={1.5} aria-hidden />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span className="text-surface-line3">·</span>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 transition hover:text-ink-secondary"
            title="Print message"
            aria-label="Print message"
          >
            <Printer size={12} strokeWidth={1.5} aria-hidden />
            Print
          </button>
          {workflow && (
            <>
              <span className="text-surface-line3">·</span>
              <span
                className="inline-flex items-center rounded-full border border-surface-pillline bg-surface-pill px-2 py-0.5 text-[10px] font-semibold text-ink-muted"
                title={workflow === 'quick' ? 'Generated with Quick Answer (no tools)' : 'Generated with Research Memo (full tools)'}
              >
                {workflow === 'quick' ? 'Quick' : 'Research'}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Sources panel — rendered below an assistant message that had tool calls.
 * Lists per-tool what was retrieved. Click-throughs go to the actual
 * source URL. A tool-agnostic listing that covers CourtListener / LegiScan /
 * OpenStates / citation_verify. Artboard 03, lines 219-240.
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
  // Header summary — counted, never fabricated: statuses the verifier
  // actually reported. Sources with no status at all aren't counted.
  const verified = pruned.filter((s) => s.status === 'verified').length;
  const notFound = pruned.filter((s) => s.status === 'not_found').length;
  const abstained = pruned.filter((s) => s.status && s.status !== 'verified' && s.status !== 'not_found').length;
  const summaryParts = [
    verified > 0 ? `${verified} verified` : null,
    notFound > 0 ? `${notFound} not found` : null,
    abstained > 0 ? `${abstained} to verify` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-surface-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#F1EEF6] px-3.5 py-2.5">
        <span className="text-xs font-semibold text-ink-secondary">
          Sources · {pruned.length} citation{pruned.length === 1 ? '' : 's'}
        </span>
        {summaryParts.length > 0 && (
          <span className="text-[11.5px] text-ink-faint">{summaryParts.join(' · ')}</span>
        )}
      </div>
      <div className="flex flex-col gap-2 px-3.5 py-2.5">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="flex flex-col gap-2">
            <div className="text-[10.5px] font-bold uppercase tracking-[.05em] text-ink-faint">
              {labelFor(type)} ({items.length})
            </div>
            {items.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="min-w-0 flex-1 font-mono text-[12.5px] leading-snug text-ink-secondary">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand underline decoration-brand-line underline-offset-2 hover:text-brand-deep"
                    >
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                  {s.detail && (
                    <span className="font-sans text-[11.5px] text-ink-faint"> — {s.detail}</span>
                  )}
                </span>
                {s.status && <SourceStatusChip status={s.status} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const SourceStatusChip: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'verified') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-deteal-bg px-2 py-0.5 text-[11px] font-semibold text-deteal-text">
        <Check size={10} strokeWidth={2.4} aria-hidden />
        Verified
      </span>
    );
  }
  if (status === 'not_found') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-dered-bg px-2 py-0.5 text-[11px] font-semibold text-dered">
        <X size={10} strokeWidth={2.4} aria-hidden />
        Not found
      </span>
    );
  }
  // unconfirmed / unverified / unavailable: the verifier abstained —
  // never let an abstention blend into neutral gray.
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-deamber-bg px-2 py-0.5 text-[11px] font-semibold text-deamber-text"
      title={`${status} — verify manually`}
    >
      <TriangleAlert size={10} strokeWidth={2.2} aria-hidden />
      Verify manually
    </span>
  );
};

/**
 * Tool-activity pill (artboard 03 / component sheet). running = spinner,
 * done = teal check + elapsed, error = red variant.
 */
const ToolPill: React.FC<{ tool: ToolEventLike }> = ({ tool }) => {
  const name = toolHumanName(tool.name);
  if (tool.status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-pillline bg-surface-pill px-2.5 py-[3px] text-[11px] font-semibold text-ink-muted">
        <span className="de-spinner" aria-hidden />
        {name} · running
      </span>
    );
  }
  if (tool.status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dered-line bg-dered-bg px-2.5 py-[3px] text-[11px] font-semibold text-dered">
        <X size={11} strokeWidth={2.2} aria-hidden />
        {name} · failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-pillline bg-surface-pill px-2.5 py-[3px] text-[11px] font-semibold text-ink-muted">
      <Check size={11} strokeWidth={2.2} className="text-deteal-icon" aria-hidden />
      {name}
      {typeof tool.elapsed_ms === 'number' && ` · ${Math.round(tool.elapsed_ms)} ms`}
    </span>
  );
};

export default V2ChatPage;
