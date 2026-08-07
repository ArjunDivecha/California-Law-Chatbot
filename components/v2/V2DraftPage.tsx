/**
 * =============================================================================
 * V2DraftPage — "Draft a document" surface (reachable at /v2/draft).
 * =============================================================================
 *
 * WHAT THIS DOES (plain English):
 * The attorney loads an EXISTING document — by pasting text or uploading a
 * file (.txt/.md/.doc/.docx/.pdf) — and then tells the assistant, in plain
 * language, what to change OR asks it what should change. The assistant does
 * NOT silently rewrite the document. Instead it PROPOSES a list of discrete
 * changes in the chat panel; the attorney approves or rejects each one, and
 * only approved edits are applied to the document on the left. The result can
 * be exported to Word / PDF / HTML.
 *
 * SANITIZATION: every send runs through useV2AgentStream.send(), which calls
 * tokenizeForWire() on the ENTIRE payload (document + instruction) BEFORE it
 * leaves the browser. Client names, addresses, dollar amounts, etc. are
 * replaced with CLIENT_001 / ADDRESS_002 placeholders on the wire; the
 * model's reply is rehydrated to real values for display only.
 *
 * ENGINE: 'research' workflow, no model override → primary engine
 * (Claude Fable 5 via V2_PRIMARY_MODEL).
 *
 * INPUT FILES:  none read from disk here. Uploaded files are read in-browser
 *               via extractTextFromFile().
 * OUTPUT FILES: DOCX / PDF / HTML exports are generated ENTIRELY IN THE BROWSER
 *               (docx + jspdf packages) and downloaded directly. The raw
 *               rehydrated document text never leaves the device — there is no
 *               server POST for export (parity with the Drafting Magic export).
 * =============================================================================
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useV2AgentStream } from '../../hooks/useV2AgentStream.ts';
import { useSanitizer } from '../../hooks/useSanitizer';
import { addToUserAllowlist } from '../../services/sanitization/userAllowlist.ts';
import { useV2SanitizationPreview } from '../../hooks/useV2SanitizationPreview.ts';
import { extractTextFromFile } from '../draftingMagic/fileTextExtraction';
import { hasCitationLikeText } from '../../utils/citationHeuristic.ts';
import { parseChangesJson, salvageChanges } from '../../utils/draftProposals.ts';
import {
  saveDraftSession,
  loadDraftSession,
  listDraftSessions,
  deleteDraftSession,
  latestDraftSessionId,
  draftTitle,
  type DraftSessionIndexEntry,
} from '../../utils/draftSessionStore.ts';
import {
  appendVersion,
  listVersions,
  loadVersion,
  deleteVersionsForSession,
  type DraftVersionMeta,
  type VersionAttribution,
} from '../../utils/draftVersionStore.ts';

function newSessionId(): string {
  return `v2d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const ACCEPTED_FILE_TYPES = '.txt,.md,.doc,.docx,.pdf';

// System prompt: the model PROPOSES changes as structured JSON. It must not
// return a rewritten document — only a list of discrete, reviewable edits.
const PROPOSAL_SYSTEM_PROMPT = `You are a meticulous legal document editor at a California law firm.
The user gives you a CURRENT DOCUMENT and either an instruction or a question about what to change.

Do NOT rewrite the whole document. Instead, propose a list of DISCRETE, individually-reviewable changes.

Output ONLY a single JSON object, no preamble or commentary, in exactly this shape:
{"changes":[
  {"section":"<short location label, e.g. 'Section 3 — Term'>",
   "description":"<one short sentence: what to change>",
   "rationale":"<one short sentence: why>",
   "find":"<the EXACT text from the current document to replace — copy it verbatim, long enough to be unique>",
   "replace":"<the new text to put in its place>"}
]}

RULES:
- "find" MUST be an exact verbatim substring of the current document so the change can be applied automatically. If a change is an INSERTION, set "find" to the existing sentence it should follow and include that sentence at the start of "replace".
- Keep each change small and atomic — one idea per change. Prefer several small changes over one large one.
- Placeholder tokens like CLIENT_001, ADDRESS_002, AMOUNT_003 stand in for redacted private info. Preserve them EXACTLY in both "find" and "replace"; never expand, rename, or invent values.
- If the user asked a question ("what would you change?"), still answer as a list of proposed changes.
- Propose AT MOST 10 changes per reply, most important first — the user can always ask for more. A reply that gets cut off mid-JSON helps no one.
- If nothing should change, return {"changes":[]}.`;

function buildEditRequest(documentText: string, instruction: string): string {
  return `CURRENT DOCUMENT:
"""
${documentText}
"""

INSTRUCTION:
${instruction}`;
}

interface Proposal {
  id: string;
  section: string;
  description: string;
  rationale: string;
  find: string;
  replace: string;
  status: 'pending' | 'applied' | 'rejected' | 'unmatched';
}

interface ChatTurn {
  instruction: string;
  proposals: Proposal[];
  /** Set when the model returned something we could not parse as changes. */
  rawNote?: string;
}

// Structured-output schema for the propose flow (output_config.format on the
// server). Forces the model's final message to be a valid {changes:[…]}
// object — parseChangesJson below stays as a defensive fallback. Schema-dialect
// limits: additionalProperties:false + required on every object; no array
// length / string length constraints.
const DRAFT_PROPOSALS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          section: { type: 'string' },
          description: { type: 'string' },
          rationale: { type: 'string' },
          find: { type: 'string' },
          replace: { type: 'string' },
        },
        required: ['section', 'description', 'rationale', 'find', 'replace'],
      },
    },
  },
  required: ['changes'],
};

// Apply find→replace to the document. Tries exact match first, then a
// whitespace-tolerant regex match. Returns the new document, or null if the
// "find" text could not be located.
function applyChange(doc: string, find: string, replace: string): string | null {
  if (!find) return null;
  if (doc.includes(find)) return doc.replace(find, replace);
  // Whitespace-tolerant fallback.
  const esc = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  try {
    const re = new RegExp(esc);
    if (re.test(doc)) return doc.replace(re, replace.replace(/\$/g, '$$$$'));
  } catch {
    /* ignore bad regex */
  }
  return null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const V2DraftPage: React.FC = () => {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const [sessionId, setSessionId] = useState(() => newSessionId());
  const { state, send, reset } = useV2AgentStream();

  // Source-loading state (before any document is loaded).
  const [pasteText, setPasteText] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editing state (after a document is loaded).
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [history, setHistory] = useState<ChatTurn[]>([]);

  // ----- Session persistence (device-local, encrypted at rest) -----
  // Navigating away used to destroy the document and every proposal.
  // Sessions now auto-save to localStorage (AES-GCM via workspaceCrypto,
  // same precedent as Drafting Magic — documents never go to cloud KV)
  // and the most recent one auto-restores on return.
  const [restoreReady, setRestoreReady] = useState(false);
  const [recentDrafts, setRecentDrafts] = useState<DraftSessionIndexEntry[]>([]);

  const restoreSession = useCallback(async (id: string) => {
    const snap = await loadDraftSession(id);
    if (!snap) return false;
    setSessionId(snap.id);
    setDocumentText(snap.documentText);
    setHistory(snap.history as ChatTurn[]);
    setUploadedName(snap.uploadedName);
    setInstruction('');
    void listVersions(id).then(setVersions);
    return true;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setRecentDrafts(listDraftSessions());
      const latest = latestDraftSessionId();
      if (latest && !cancelled) await restoreSession(latest);
      if (!cancelled) setRestoreReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [restoreSession]);

  // ----- Version history (phase 1: chain + panel + restore) -----
  // Proposals applied since the last version cut, drained into the next
  // auto version's attribution list.
  const pendingAttributionRef = useRef<VersionAttribution[]>([]);
  const [versions, setVersions] = useState<DraftVersionMeta[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<{ meta: DraftVersionMeta; text: string } | null>(null);

  const refreshVersions = useCallback(async (id: string) => {
    setVersions(await listVersions(id));
  }, []);

  // Debounced auto-version: cut a version 2s after the document settles
  // following applied proposals. appendVersion dedupes identical text, so
  // session restores and no-op saves never create empty versions.
  React.useEffect(() => {
    if (!restoreReady || documentText === null) return;
    const t = window.setTimeout(() => {
      const attribution = pendingAttributionRef.current;
      if (attribution.length === 0) return; // only proposal applies cut auto versions
      pendingAttributionRef.current = [];
      void appendVersion({
        session_id: sessionId,
        kind: 'auto',
        documentText,
        proposals: attribution,
      }).then(() => refreshVersions(sessionId));
    }, 2000);
    return () => window.clearTimeout(t);
  }, [restoreReady, sessionId, documentText, refreshVersions]);

  const onSaveVersion = useCallback(() => {
    if (documentText === null) return;
    const label = window.prompt('Label this version (optional):') ?? undefined;
    const attribution = pendingAttributionRef.current;
    pendingAttributionRef.current = [];
    void appendVersion({
      session_id: sessionId,
      kind: 'manual',
      documentText,
      proposals: attribution,
      label: label && label.trim() ? label.trim() : undefined,
    }).then(() => refreshVersions(sessionId));
  }, [documentText, sessionId, refreshVersions]);

  const onViewVersion = useCallback(
    async (meta: DraftVersionMeta) => {
      const full = await loadVersion(sessionId, meta.version);
      if (full) setViewingVersion({ meta, text: full.documentText });
    },
    [sessionId],
  );

  // Restore = copy the old version forward as a NEW version. Never destroys.
  const onRestoreVersion = useCallback(
    async (meta: DraftVersionMeta) => {
      const full = await loadVersion(sessionId, meta.version);
      if (!full) return;
      pendingAttributionRef.current = [];
      await appendVersion({
        session_id: sessionId,
        kind: 'restore',
        documentText: full.documentText,
        restoredFrom: meta.version,
      });
      setDocumentText(full.documentText);
      setViewingVersion(null);
      void refreshVersions(sessionId);
    },
    [sessionId, refreshVersions],
  );

  // Debounced auto-save on every meaningful change (post-restore only, so
  // the initial empty state can't clobber a saved session).
  React.useEffect(() => {
    if (!restoreReady || documentText === null) return;
    const t = window.setTimeout(() => {
      void saveDraftSession({
        version: 1,
        id: sessionId,
        savedAt: new Date().toISOString(),
        title: draftTitle(documentText, uploadedName),
        documentText,
        history,
        uploadedName,
      }).then(() => setRecentDrafts(listDraftSessions()));
    }, 800);
    return () => window.clearTimeout(t);
  }, [restoreReady, sessionId, documentText, history, uploadedName]);

  // ----- Source loading -----
  const onUploadClick = useCallback(() => fileInputRef.current?.click(), []);

  // Shared by the file-picker AND the drag-and-drop path. Drag-and-drop
  // support added 2026-07-04: dropping a file on the page previously fell
  // through to the browser default (navigate to file:///…, replacing the
  // whole app). A window-level guard in App.tsx now blocks that; this
  // handler makes the drop actually useful.
  const handleFile = useCallback(async (file: File) => {
    setUploadBusy(true);
    setUploadError(null);
    try {
      const extracted = await extractTextFromFile(file);
      const text = extracted.text.trim();
      if (!text) {
        setUploadError('No readable text found in that file.');
      } else {
        setPasteText(text);
        setUploadedName(file.name);
        if (extracted.warning) setUploadError(extracted.warning);
      }
    } catch (err) {
      setUploadError(`Could not read file: ${(err as Error).message}`);
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const onFileChosen = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await handleFile(file);
    },
    [handleFile],
  );

  const onFileDropped = useCallback(
    async (file: File) => {
      await handleFile(file);
    },
    [handleFile],
  );

  const onLoadDocument = useCallback(() => {
    const text = pasteText.trim();
    if (text.length < 10) return;
    setDocumentText(text);
    // First version in the chain: the document as loaded.
    void appendVersion({ session_id: sessionId, kind: 'initial', documentText: text }).then(() =>
      refreshVersions(sessionId),
    );
  }, [pasteText, sessionId, refreshVersions]);

  // ----- Instruction → proposals -----
  const onSubmitInstruction = useCallback(() => {
    const instr = instruction.trim();
    if (!instr || !documentText || state.isStreaming) return;
    setHistory((h) => [...h, { instruction: instr, proposals: [] }]);
    setInstruction('');
    send({
      session_id: sessionId,
      user_id: userId,
      user_text: buildEditRequest(documentText, instr),
      system_prompt: PROPOSAL_SYSTEM_PROMPT,
      // 'research' (no model override) → primary engine = Claude Fable 5.
      workflow: 'research',
      // Schema-constrain the reply to {changes:[…]} (output_config.format).
      output_format: { type: 'json_schema', schema: DRAFT_PROPOSALS_SCHEMA },
    });
  }, [instruction, documentText, state.isStreaming, send, sessionId, userId]);

  // When a turn completes, parse the model's reply into proposals and attach
  // them to the latest chat turn. The document is NOT changed yet — the user
  // approves each proposal individually.
  const lastDoneRef = useRef<unknown>(null);
  React.useEffect(() => {
    if (state.done && state.done !== lastDoneRef.current) {
      lastDoneRef.current = state.done;
      const reply = (state.done.final_text || state.tokens || '').trim();
      const wasTruncated = state.done.stop_reason === 'max_tokens';
      let parsed = parseChangesJson(reply);
      // Truncated reply → strict parse fails; recover every complete proposal
      // instead of dumping raw JSON at the attorney.
      if (!parsed && reply) {
        const salvaged = salvageChanges(reply);
        if (salvaged.length > 0) parsed = salvaged;
      }
      setHistory((h) => {
        if (h.length === 0) return h;
        const next = [...h];
        const turn = { ...next[next.length - 1] };
        if (parsed && parsed.length > 0) {
          turn.proposals = parsed.map((p, i) => ({
            ...p,
            id: `${Date.now()}_${i}`,
            status: 'pending' as const,
          }));
          if (wasTruncated) {
            turn.rawNote = `The reply hit the length limit, so this list is incomplete — showing the ${parsed.length} complete proposal${parsed.length === 1 ? '' : 's'} that came through. Apply or reject these, then ask again for further changes.`;
          }
        } else if (parsed && parsed.length === 0) {
          turn.rawNote = 'No changes suggested.';
        } else if (wasTruncated) {
          turn.rawNote =
            'The reply was cut off by the length limit before any complete proposal came through. Try again with a narrower instruction (e.g. one section at a time, or "propose your 5 most important changes").';
        } else {
          turn.rawNote =
            'The reply could not be read as a list of changes. Try rephrasing the instruction, or ask for fewer changes at once.';
        }
        next[next.length - 1] = turn;
        return next;
      });
      reset();
    }
  }, [state.done, state.tokens, reset]);

  // ----- Approve / reject a proposal -----
  const setProposalStatus = useCallback(
    (turnIdx: number, propId: string, status: Proposal['status'], newDoc?: string) => {
      setHistory((h) => {
        const next = [...h];
        const turn = { ...next[turnIdx] };
        turn.proposals = turn.proposals.map((p) => (p.id === propId ? { ...p, status } : p));
        next[turnIdx] = turn;
        return next;
      });
      if (newDoc !== undefined) setDocumentText(newDoc);
    },
    [],
  );

  const onApprove = useCallback(
    (turnIdx: number, prop: Proposal, overrideReplace?: string) => {
      if (!documentText) return;
      const replacement = overrideReplace !== undefined ? overrideReplace : prop.replace;
      const updated = applyChange(documentText, prop.find, replacement);
      if (updated === null) {
        setProposalStatus(turnIdx, prop.id, 'unmatched');
      } else {
        // Persist the edited replacement on the proposal so the
        // before/after view reflects what was actually applied.
        setHistory((h) => {
          const next = [...h];
          const turn = { ...next[turnIdx] };
          turn.proposals = turn.proposals.map((p) =>
            p.id === prop.id ? { ...p, replace: replacement, status: 'applied' as const } : p,
          );
          next[turnIdx] = turn;
          return next;
        });
        setDocumentText(updated);
        // Attribution for the next auto version cut.
        pendingAttributionRef.current = [
          ...pendingAttributionRef.current,
          { section: prop.section, description: prop.description },
        ];
      }
    },
    [documentText, setProposalStatus],
  );

  const onReject = useCallback(
    (turnIdx: number, prop: Proposal) => setProposalStatus(turnIdx, prop.id, 'rejected'),
    [setProposalStatus],
  );

  const onApproveAll = useCallback(
    (turnIdx: number) => {
      setHistory((h) => {
        const next = [...h];
        const turn = { ...next[turnIdx] };
        let doc = documentText ?? '';
        turn.proposals = turn.proposals.map((p) => {
          if (p.status !== 'pending') return p;
          const updated = applyChange(doc, p.find, p.replace);
          if (updated === null) return { ...p, status: 'unmatched' as const };
          doc = updated;
          pendingAttributionRef.current = [
            ...pendingAttributionRef.current,
            { section: p.section, description: p.description },
          ];
          return { ...p, status: 'applied' as const };
        });
        next[turnIdx] = turn;
        setDocumentText(doc);
        return next;
      });
    },
    [documentText],
  );

  // Start a NEW draft session. The previous session stays saved and
  // reachable from the "Recent drafts" list — this must never delete work.
  const onStartOver = useCallback(() => {
    setSessionId(newSessionId());
    setDocumentText(null);
    setPasteText('');
    setUploadedName(null);
    setUploadError(null);
    setHistory([]);
    setInstruction('');
    setRecentDrafts(listDraftSessions());
    reset();
  }, [reset]);

  const onOpenRecent = useCallback(
    (id: string) => {
      void restoreSession(id);
    },
    [restoreSession],
  );

  const onDeleteRecent = useCallback((id: string) => {
    deleteDraftSession(id);
    void deleteVersionsForSession(id);
    setRecentDrafts(listDraftSessions());
  }, []);

  // -------------------------------------------------------------------------
  // Render — load screen vs editor
  // -------------------------------------------------------------------------
  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: '#FAFAF8', fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">AskPauli</h1>
          <p className="text-xs font-semibold uppercase tracking-wide text-pink-500">
            V2 Draft · edit a document
          </p>
        </div>
        <Link to="/v2" className="text-xs rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-gray-700">
          ← Chat
        </Link>
      </header>

      {!documentText ? (
        <LoadScreen
          pasteText={pasteText}
          setPasteText={setPasteText}
          uploadBusy={uploadBusy}
          uploadError={uploadError}
          uploadedName={uploadedName}
          fileInputRef={fileInputRef}
          onUploadClick={onUploadClick}
          onFileChosen={onFileChosen}
          onFileDropped={onFileDropped}
          onLoadDocument={onLoadDocument}
          recentDrafts={recentDrafts}
          onOpenRecent={onOpenRecent}
          onDeleteRecent={onDeleteRecent}
        />
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* Left: the document (only changes when a proposal is approved) */}
          <div className="flex-1 min-w-0 flex flex-col border-r border-gray-200">
            <div className="flex items-center justify-between px-6 py-2 border-b border-gray-100 bg-white">
              <h2 className="text-sm font-semibold text-gray-900">Document</h2>
              <div className="flex items-center gap-2">
                <ExportButtons documentText={documentText} disabled={state.isStreaming} />
                <button
                  type="button"
                  onClick={onSaveVersion}
                  className="text-xs rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-gray-600"
                  title="Save a named checkpoint of the current document"
                >
                  Save version
                </button>
                <button
                  type="button"
                  onClick={() => setShowVersions((s) => !s)}
                  className={`text-xs rounded-full px-3 py-1.5 ${
                    showVersions ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  Versions{versions.length > 0 ? ` (${versions.length})` : ''}
                </button>
                <button
                  type="button"
                  onClick={onStartOver}
                  className="text-xs rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-gray-600"
                >
                  New document
                </button>
              </div>
            </div>
            {showVersions && (
              <VersionsPanel
                versions={versions}
                viewing={viewingVersion}
                onView={onViewVersion}
                onCloseView={() => setViewingVersion(null)}
                onRestore={onRestoreVersion}
              />
            )}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {hasCitationLikeText(documentText) && (
                <div className="max-w-3xl mx-auto mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
                  <span className="font-semibold">Citations in this document are not verified.</span>{' '}
                  This editor runs no citation check — confirm every authority against Westlaw/Lexis, or
                  paste the passage into{' '}
                  <Link to="/v2/verify" className="font-semibold underline hover:text-amber-700">
                    Verify
                  </Link>{' '}
                  before filing.
                </div>
              )}
              <article className="v2-md max-w-3xl mx-auto text-[15px] leading-relaxed text-gray-900">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{documentText}</ReactMarkdown>
              </article>
            </div>
          </div>

          {/* Right: instruction chat + proposal cards */}
          <div className="w-[420px] shrink-0 flex flex-col bg-white">
            <div className="px-4 py-2 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Tell it what to change</h2>
              <p className="text-[11px] text-gray-500">It proposes changes — you approve each one.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {history.length === 0 && (
                <p className="text-xs text-gray-500">
                  Type an instruction or a question — e.g.{' '}
                  <em>"What would you change to protect the tenant?"</em> or{' '}
                  <em>"Make the tone more formal."</em> Nothing changes until you approve it.
                </p>
              )}
              {history.map((turn, turnIdx) => (
                <div key={turnIdx} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[90%] rounded-2xl bg-pink-500 text-white px-3 py-2 text-[13px] whitespace-pre-wrap">
                      <InstructionWithHighlight text={turn.instruction} />
                    </div>
                  </div>

                  {turn.rawNote && (
                    <div className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
                      {turn.rawNote}
                    </div>
                  )}

                  {turn.proposals.length > 0 && (
                    <ProposalList
                      proposals={turn.proposals}
                      onApprove={(p, override) => onApprove(turnIdx, p, override)}
                      onReject={(p) => onReject(turnIdx, p)}
                      onApproveAll={() => onApproveAll(turnIdx)}
                    />
                  )}
                </div>
              ))}
              {state.isStreaming && (
                <div className="text-[11px] text-gray-400 pl-1">Reviewing the document and drafting proposed changes…</div>
              )}
              {state.error && (
                <div className="text-[11px] text-red-600 pl-1">Error: {state.error.message}</div>
              )}
            </div>

            <div className="border-t border-gray-100 p-3">
              <div className="mb-2">
                <InstructionSanitizationChips combinedText={`${documentText}\n${instruction}`} />
              </div>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSubmitInstruction();
                  }
                }}
                rows={3}
                placeholder="Describe a change, or ask what should change…"
                disabled={state.isStreaming}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onSubmitInstruction}
                  disabled={!instruction.trim() || state.isStreaming}
                  className="rounded-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-1.5"
                >
                  {state.isStreaming ? 'Working…' : 'Propose changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Proposal list — approve/reject each change
// ---------------------------------------------------------------------------
const ProposalList: React.FC<{
  proposals: Proposal[];
  onApprove: (p: Proposal, overrideReplace?: string) => void;
  onReject: (p: Proposal) => void;
  onApproveAll: () => void;
}> = ({ proposals, onApprove, onReject, onApproveAll }) => {
  const pending = proposals.filter((p) => p.status === 'pending').length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-700">
          {proposals.length} proposed change{proposals.length > 1 ? 's' : ''}
          {pending > 0 ? ` · ${pending} to review` : ' · all reviewed'}
        </span>
        {pending > 0 && (
          <button
            type="button"
            onClick={onApproveAll}
            className="text-[11px] font-semibold text-pink-600 hover:text-pink-700"
          >
            Approve all
          </button>
        )}
      </div>
      {proposals.map((p) => (
        <ProposalCard
          key={p.id}
          proposal={p}
          onApprove={(override) => onApprove(p, override)}
          onReject={() => onReject(p)}
        />
      ))}
    </div>
  );
};

const ProposalCard: React.FC<{
  proposal: Proposal;
  onApprove: (overrideReplace?: string) => void;
  onReject: () => void;
}> = ({ proposal, onApprove, onReject }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(proposal.replace);
  const statusBadge = {
    pending: null,
    applied: <span className="text-[10px] font-semibold text-emerald-700">✓ Applied</span>,
    rejected: <span className="text-[10px] font-semibold text-gray-400">Skipped</span>,
    unmatched: <span className="text-[10px] font-semibold text-amber-700">⚠ Couldn’t locate text — apply manually</span>,
  }[proposal.status];

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-[12px] ${
        proposal.status === 'applied'
          ? 'border-emerald-200 bg-emerald-50/50'
          : proposal.status === 'rejected'
          ? 'border-gray-200 bg-gray-50 opacity-70'
          : proposal.status === 'unmatched'
          ? 'border-amber-200 bg-amber-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-gray-800">{proposal.section}</div>
          <div className="text-gray-700">{proposal.description}</div>
          {proposal.rationale && <div className="text-[11px] text-gray-500 mt-0.5">{proposal.rationale}</div>}
        </div>
        {statusBadge}
      </div>

      {(proposal.find || proposal.replace) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-[10px] text-gray-400 hover:text-gray-600"
        >
          {open ? 'Hide before/after' : 'Show before/after'}
        </button>
      )}
      {open && (
        <div className="mt-1 space-y-1">
          <div className="rounded bg-red-50 border border-red-100 px-2 py-1 text-[11px] text-red-900 line-through whitespace-pre-wrap">
            {proposal.find.slice(0, 400)}
          </div>
          <div className="rounded bg-emerald-50 border border-emerald-100 px-2 py-1 text-[11px] text-emerald-900 whitespace-pre-wrap">
            {proposal.replace.slice(0, 400)}
          </div>
        </div>
      )}

      {/* Modify mode — edit the replacement text before applying. */}
      {proposal.status === 'pending' && editing && (
        <div className="mt-2 space-y-1">
          <label className="text-[10px] text-gray-500">Edit the new text, then Apply:</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(8, Math.max(3, Math.ceil(draft.length / 60)))}
            className="w-full resize-y rounded border border-gray-300 px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
        </div>
      )}

      {proposal.status === 'pending' && (
        <div className="mt-2 flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => onApprove(draft)}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-3 py-1"
              >
                ✓ Apply edited
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setDraft(proposal.replace); }}
                className="rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-semibold px-3 py-1"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onApprove()}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-3 py-1"
              >
                ✓ Approve
              </button>
              <button
                type="button"
                onClick={() => { setDraft(proposal.replace); setEditing(true); setOpen(true); }}
                className="rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[11px] font-semibold px-3 py-1"
              >
                ✎ Modify
              </button>
              <button
                type="button"
                onClick={onReject}
                className="rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-semibold px-3 py-1"
              >
                ✗ Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Load screen
// ---------------------------------------------------------------------------
const LoadScreen: React.FC<{
  pasteText: string;
  setPasteText: (s: string) => void;
  uploadBusy: boolean;
  uploadError: string | null;
  uploadedName: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUploadClick: () => void;
  onFileChosen: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDropped: (file: File) => void;
  onLoadDocument: () => void;
  recentDrafts: DraftSessionIndexEntry[];
  onOpenRecent: (id: string) => void;
  onDeleteRecent: (id: string) => void;
}> = ({
  pasteText, setPasteText, uploadBusy, uploadError, uploadedName,
  fileInputRef, onUploadClick, onFileChosen, onFileDropped, onLoadDocument,
  recentDrafts, onOpenRecent, onDeleteRecent,
}) => {
  const { preview } = useV2SanitizationPreview(pasteText);
  const detectionCount = preview.tokens.length;
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className="flex-1 overflow-y-auto"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        // Only clear when actually leaving the container (not entering a child).
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFileDropped(file);
      }}
    >
      <div
        className={`max-w-3xl mx-auto px-6 py-10 rounded-xl transition ${
          dragOver ? 'ring-2 ring-pink-400 ring-offset-2 bg-pink-50/40' : ''
        }`}
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Start with your document</h2>
        <p className="text-sm text-gray-600 mb-5">
          Paste your document below, drag a file anywhere onto this page, or upload one
          (.txt, .doc, .docx, .pdf). Then you'll tell the assistant what to change — it
          proposes edits and you approve each one. Private details are replaced with
          placeholders before anything is sent.
        </p>

        {recentDrafts.length > 0 && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Recent drafts</h3>
            <ul className="space-y-1">
              {recentDrafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenRecent(d.id)}
                    className="flex-1 min-w-0 truncate text-left text-sm text-pink-600 hover:text-pink-700 hover:underline"
                    title={d.title}
                  >
                    {d.title}
                  </button>
                  <span className="shrink-0 text-[11px] text-gray-500">
                    {new Date(d.savedAt).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteRecent(d.id)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                    aria-label={`Delete draft ${d.title}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-gray-500">
              Saved on this device only, encrypted at rest. Your latest draft reopens
              automatically.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={onUploadClick}
            disabled={uploadBusy}
            className="rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-gray-800 text-sm font-semibold px-4 py-2"
          >
            {uploadBusy ? 'Reading file…' : '⬆ Upload a file'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={onFileChosen}
            className="hidden"
          />
          {uploadedName && (
            <span className="text-xs text-gray-500">Loaded from <strong>{uploadedName}</strong></span>
          )}
        </div>

        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={16}
          placeholder="Paste your document text here…"
          className="w-full resize-y rounded-lg border border-gray-200 px-4 py-3 text-[14px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-pink-300"
          style={{ fontFamily: 'Georgia, serif' }}
        />

        {uploadError && <p className="mt-2 text-xs text-amber-700">{uploadError}</p>}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {pasteText.trim().length > 0
              ? `${pasteText.trim().split(/\s+/).length} words${detectionCount > 0 ? ` · ${detectionCount} private item${detectionCount > 1 ? 's' : ''} will be protected` : ''}`
              : 'Nothing loaded yet.'}
          </span>
          <button
            type="button"
            onClick={onLoadDocument}
            disabled={pasteText.trim().length < 10}
            className="rounded-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white text-sm font-semibold px-6 py-2"
          >
            Load document →
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Instruction sanitization chips (with "not private" dismiss). Scrollable so
// every detection in a long document is reviewable.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Versions panel (phase 1 of draft versioning): list / view / restore.
// Restore copies the old version forward as a new version — never destroys.
// ---------------------------------------------------------------------------
const VERSION_KIND_LABEL: Record<string, string> = {
  initial: 'Document loaded',
  auto: 'Changes applied',
  manual: 'Saved checkpoint',
  restore: 'Restored',
};

const VersionsPanel: React.FC<{
  versions: DraftVersionMeta[];
  viewing: { meta: DraftVersionMeta; text: string } | null;
  onView: (meta: DraftVersionMeta) => void;
  onCloseView: () => void;
  onRestore: (meta: DraftVersionMeta) => void;
}> = ({ versions, viewing, onView, onCloseView, onRestore }) => {
  return (
    <div className="w-[300px] shrink-0 border-b border-gray-100 bg-gray-50/70 flex flex-col border-r border-gray-200">
      <div className="px-4 py-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Version history</h3>
        <p className="text-[11px] text-gray-500">Saved on this device. Restoring never deletes a version.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {versions.length === 0 && (
          <p className="text-xs text-gray-500 px-1 py-2">
            No versions yet. One is saved automatically when you load a document and each time
            you apply proposals — or use “Save version” for a named checkpoint.
          </p>
        )}
        {versions.map((v) => (
          <div key={v.version} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-gray-900">
                v{v.version} · {VERSION_KIND_LABEL[v.kind] ?? v.kind}
                {v.kind === 'restore' && v.restoredFrom ? ` v${v.restoredFrom}` : ''}
              </span>
              <span className="shrink-0 text-[10px] text-gray-500">
                {new Date(v.savedAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </div>
            {v.label && <div className="mt-0.5 text-xs text-pink-700 font-medium truncate" title={v.label}>“{v.label}”</div>}
            {v.proposals.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {v.proposals.slice(0, 3).map((p, i) => (
                  <li key={i} className="text-[11px] text-gray-600 truncate" title={`${p.section}: ${p.description}`}>
                    • {p.description || p.section}
                  </li>
                ))}
                {v.proposals.length > 3 && (
                  <li className="text-[11px] text-gray-400">…and {v.proposals.length - 3} more</li>
                )}
              </ul>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`text-[10px] ${v.wordDelta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {v.wordDelta >= 0 ? `+${v.wordDelta}` : v.wordDelta} words
              </span>
              <button
                type="button"
                onClick={() => onView(v)}
                className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 hover:underline"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => onRestore(v)}
                className="text-[11px] font-semibold text-pink-600 hover:text-pink-700 hover:underline"
              >
                Restore
              </button>
            </div>
          </div>
        ))}
      </div>
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-8" onClick={onCloseView}>
          <div
            className="max-h-full w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">
                  Version {viewing.meta.version} · {VERSION_KIND_LABEL[viewing.meta.kind] ?? viewing.meta.kind}
                  {viewing.meta.label ? ` — “${viewing.meta.label}”` : ''}
                </h4>
                <p className="text-[11px] text-gray-500">{new Date(viewing.meta.savedAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRestore(viewing.meta)}
                  className="rounded-full bg-pink-500 hover:bg-pink-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Restore this version
                </button>
                <button
                  type="button"
                  onClick={onCloseView}
                  className="rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-xs text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <article className="v2-md text-[14px] leading-relaxed text-gray-900">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewing.text}</ReactMarkdown>
              </article>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InstructionSanitizationChips: React.FC<{ combinedText: string }> = ({ combinedText }) => {
  const { preview, hasDetections } = useV2SanitizationPreview(combinedText);
  if (!hasDetections) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        🔒 Nothing private detected — safe to send
      </span>
    );
  }
  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
        🔒 {preview.tokens.length} item{preview.tokens.length > 1 ? 's' : ''} protected before sending
        {preview.tokens.length > 8 && (
          <span className="font-normal text-amber-700/70">· scroll to review all</span>
        )}
      </span>
      <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
        {preview.tokens.map((t) => (
          <span
            key={t.value}
            className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] text-amber-900"
            title={`Will be sent as ${t.value}`}
          >
            <span className="font-mono">{t.value}</span>
            <span className="text-amber-700/70">= {t.raw.slice(0, 20)}{t.raw.length > 20 ? '…' : ''}</span>
            <button
              type="button"
              onClick={() => addToUserAllowlist(t.raw)}
              title={`Not private — always send "${t.raw.slice(0, 40)}" as-is (this device).`}
              aria-label={`Mark "${t.raw}" as not private`}
              className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-amber-700/60 hover:bg-amber-200 hover:text-amber-900"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

// Highlight protected values inside the attorney's instruction bubble.
const InstructionWithHighlight: React.FC<{ text: string }> = ({ text }) => {
  const { getMap, tokenCount } = useSanitizer();
  const nodes = useMemo(() => {
    void tokenCount;
    const values = Array.from(getMap().values())
      .filter((v) => v && v.trim().length > 1)
      .sort((a, b) => b.length - a.length);
    if (values.length === 0) return null;
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${values.map(esc).join('|')})`, 'g');
    const parts = text.split(re);
    if (parts.length === 1) return null;
    const set = new Set(values);
    return parts.map((p, i) =>
      set.has(p) ? (
        <mark key={i} className="rounded px-0.5 bg-yellow-300 text-gray-900" title="Protected — sent as a token">{p}</mark>
      ) : (
        <React.Fragment key={i}>{p}</React.Fragment>
      )
    );
  }, [text, getMap, tokenCount]);
  return <>{nodes ?? text}</>;
};

// ---------------------------------------------------------------------------
// Export — generate the file ENTIRELY IN THE BROWSER and download it. The raw
// (rehydrated) document text NEVER leaves the device: DOCX is built with the
// `docx` package, PDF with `jspdf`, HTML as a self-contained string. This
// preserves the same "raw client text never leaves the device" invariant that
// the Drafting Magic export (downloadDraftPackageDocx) holds — no server POST.
// Any failure surfaces to the attorney via onError instead of failing silently.
// ---------------------------------------------------------------------------

/** Escape a string for safe inclusion in HTML text content. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Split markdown-ish text into blocks: headings (leading #) and paragraphs. */
function parseBlocks(text: string): Array<{ kind: 'heading' | 'paragraph'; level: number; text: string }> {
  return text
    .split(/\n{2,}/)
    .map((raw) => raw.replace(/\s+$/g, ''))
    .filter((b) => b.trim().length > 0)
    .map((block) => {
      const h = block.match(/^(#{1,6})\s+(.*)$/s);
      if (h) return { kind: 'heading' as const, level: h[1].length, text: h[2].trim() };
      return { kind: 'paragraph' as const, level: 0, text: block };
    });
}

async function exportDocx(documentText: string): Promise<void> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
  const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];
  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      text: 'Document',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  ];
  for (const b of parseBlocks(documentText)) {
    if (b.kind === 'heading') {
      children.push(
        new Paragraph({ text: b.text, heading: HEADINGS[Math.min(b.level, 6) - 1], spacing: { before: 220, after: 100 } }),
      );
    } else {
      // Preserve single line breaks inside a paragraph.
      const lines = b.text.split(/\n/);
      const runs: InstanceType<typeof TextRun>[] = [];
      lines.forEach((line, i) => {
        runs.push(new TextRun({ text: line, size: 24, break: i > 0 ? 1 : 0 }));
      });
      children.push(new Paragraph({ spacing: { after: 160 }, children: runs }));
    }
  }
  const doc = new Document({
    title: 'Document',
    description: 'Browser-side export of the edited document. Generated locally; not sent to any server.',
    sections: [{ properties: {}, children }],
  });
  const blob = await Packer.toBlob(doc);
  downloadClientBlob(blob, `document-${Date.now()}.docx`);
}

async function exportPdf(documentText: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 72; // 1 inch
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (lineHeight: number) => {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  ensureSpace(22);
  doc.text('Document', pageWidth / 2, y, { align: 'center' });
  y += 28;

  for (const b of parseBlocks(documentText)) {
    if (b.kind === 'heading') {
      doc.setFont('times', 'bold');
      doc.setFontSize(b.level <= 1 ? 14 : 12);
      const lines = doc.splitTextToSize(b.text, maxWidth) as string[];
      y += 8;
      for (const line of lines) {
        ensureSpace(18);
        doc.text(line, margin, y);
        y += 18;
      }
      y += 2;
    } else {
      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      const lines = doc.splitTextToSize(b.text.replace(/\n/g, ' \n'), maxWidth) as string[];
      for (const line of lines) {
        ensureSpace(16);
        doc.text(line, margin, y);
        y += 16;
      }
      y += 8;
    }
  }
  const blob = doc.output('blob');
  downloadClientBlob(blob, `document-${Date.now()}.pdf`);
}

function exportHtml(documentText: string): void {
  const body = parseBlocks(documentText)
    .map((b) =>
      b.kind === 'heading'
        ? `<h${Math.min(b.level, 6)}>${escapeHtml(b.text)}</h${Math.min(b.level, 6)}>`
        : `<p>${escapeHtml(b.text).replace(/\n/g, '<br>')}</p>`,
    )
    .join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Document</title>
<style>
  body { font-family: "Times New Roman", Georgia, serif; max-width: 8.5in; margin: 1in auto; color: #111; line-height: 1.5; }
  h1 { text-align: center; }
</style>
</head>
<body>
<h1>Document</h1>
${body}
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadClientBlob(blob, `document-${Date.now()}.html`);
}

function downloadClientBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ExportButtons: React.FC<{ documentText: string; disabled?: boolean }> = ({ documentText, disabled }) => {
  const [busy, setBusy] = useState<null | 'docx' | 'pdf' | 'html'>(null);
  const [error, setError] = useState<string | null>(null);
  const onExport = useCallback(
    async (format: 'docx' | 'pdf' | 'html') => {
      setBusy(format);
      setError(null);
      try {
        if (format === 'docx') await exportDocx(documentText);
        else if (format === 'pdf') await exportPdf(documentText);
        else exportHtml(documentText);
      } catch (err) {
        // FAIL IS FAIL — surface the real error, never a silent no-op.
        setError(`${format.toUpperCase()} export failed: ${(err as Error).message}`);
      } finally {
        setBusy(null);
      }
    },
    [documentText],
  );
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {(['docx', 'pdf', 'html'] as const).map((fmt) => (
          <button
            key={fmt}
            type="button"
            onClick={() => onExport(fmt)}
            disabled={disabled || busy !== null}
            className="rounded-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white text-[11px] font-semibold px-2.5 py-1"
          >
            {busy === fmt ? '…' : fmt.toUpperCase()}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-[10px] text-red-600 max-w-[240px] text-right">
          {error}
        </span>
      )}
    </div>
  );
};

export default V2DraftPage;
