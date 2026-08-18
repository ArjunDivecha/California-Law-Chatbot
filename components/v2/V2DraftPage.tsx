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
import { useUser, useAuth } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  FolderOpen,
  History,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useV2AgentStream } from '../../hooks/useV2AgentStream.ts';
import { useSanitizer } from '../../hooks/useSanitizer';
import { addToUserAllowlist } from '../../services/sanitization/userAllowlist.ts';
import { useV2SanitizationPreview } from '../../hooks/useV2SanitizationPreview.ts';
import { extractTextFromFile } from '../draftingMagic/fileTextExtraction';
import { hasCitationLikeText } from '../../utils/citationHeuristic.ts';
import { editDocxInPlace } from '../../utils/docxSurgery.ts';
import { saveOriginalDoc, loadOriginalDoc, deleteOriginalDoc } from '../../utils/originalDocStore.ts';
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
import { computeRedline, type RedlineOp, type RedlineStats } from '../../utils/draftRedline.ts';
import { BoxBrowserModal } from './BoxBrowserModal.tsx';
import {
  boxStatus as fetchBoxStatus,
  connectBox,
  openBoxPopup,
  listBoxFolder,
  downloadBoxFile,
  uploadToBox,
  type BoxItem,
  type BoxListing,
  type BoxStatus,
} from '../../services/boxClient.ts';

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
- TWO different things look like placeholders; treat them differently.
  (a) PRIVACY TOKENS have the exact shape WORD_123 — an uppercase word, an underscore, then digits: CLIENT_001, ADDRESS_002, AMOUNT_003. They stand in for private information that was redacted before the text reached you. Copy them through verbatim wherever they appear in text you are not changing, and never guess what one means or invent a new one.
  (b) TEMPLATE BLANKS are ordinary document text meant to be filled in: "CLIENT 1", "CLIENT 2", "[CLIENT NAMES]", "[DATE]", "____", "TBD". They contain spaces, brackets, or underscores-as-blanks and are NOT privacy tokens. Filling them in is a completely normal edit — do it whenever asked.
- ALWAYS carry out a replacement the user explicitly asks for, whatever the target text is. "Change client 1 to Jane Smith" means put "Jane Smith" there — whether the current text is a template blank, a privacy token, or an existing name. It is the user's own document; a supplied name is not a privacy violation, and refusing is never the right answer. Never respond by asking the user to supply a placeholder instead.
- Informal references resolve to whatever they plainly mean in this document: "client 1" / "the first client" / "party 1" means the first-named client, whether that appears as CLIENT_001, "CLIENT 1", "[CLIENT NAMES]", or a real name. Apply the change everywhere that party appears, including address blocks, signature blocks, and defined-term definitions.
- Make each "find" as SHORT and local as possible: target only the words that actually change, never a whole sentence or block when a phrase will do. NEVER span multiple lines in one change — a form line like "By: ____ Date: ____" followed by "[CLIENT]" is TWO separate lines; propose a change that targets "[CLIENT]" alone and leaves the signature scaffolding (underscores, tabs, "By:", "Date:") completely untouched. One line per change; several small changes are always better than one big one.
- Only return {"changes":[]} when the document genuinely already satisfies the request. If an instruction is ambiguous, make your best reasonable interpretation and explain it in the rationale — never return nothing, and never substitute a lecture for an edit.
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
  /** Raw model reply + the tokenized wire text, kept when a turn yields no
   *  usable proposals so failures can be diagnosed from real data instead
   *  of guesswork (2026-08-17). Tokenized — contains no raw client text. */
  diagnostic?: { wire: string; reply: string };
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
  const { getToken } = useAuth();
  const userId = user?.id ?? null;
  const [sessionId, setSessionId] = useState(() => newSessionId());
  const { state, send, reset } = useV2AgentStream();

  // Source-loading state (before any document is loaded).
  const [pasteText, setPasteText] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editing state (after a document is loaded).
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [history, setHistory] = useState<ChatTurn[]>([]);

  // ----- Box integration (load from / save to the firm's Box) -----
  const [boxState, setBoxState] = useState<BoxStatus>({ configured: false, connected: false });
  const [boxBusy, setBoxBusy] = useState(false);
  const [boxError, setBoxError] = useState<string | null>(null);
  /** null = closed; 'file' = pick a document to load; 'folder' = pick a save destination. */
  const [boxBrowseMode, setBoxBrowseMode] = useState<'file' | 'folder' | null>(null);
  /** Box file this draft came from (enables save-as-new-version). */
  const [boxFileId, setBoxFileId] = useState<string | null>(null);
  const [boxFileName, setBoxFileName] = useState<string | null>(null);
  const [boxSavedNote, setBoxSavedNote] = useState<string | null>(null);

  React.useEffect(() => {
    void fetchBoxStatus(getToken).then(setBoxState);
  }, [getToken]);

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
    setBoxFileId(snap.boxFileId ?? null);
    setBoxFileName(snap.boxFileName ?? null);
    setInstruction('');
    setOriginalDocx(null);
    void loadOriginalDoc(snap.id)
      .then((doc) => {
        if (doc) setOriginalDocx(doc);
      })
      .catch(() => {});
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

  // Redline compare: selected version → current document.
  const [comparing, setComparing] = useState<{
    meta: DraftVersionMeta;
    ops: RedlineOp[];
    stats: RedlineStats;
  } | null>(null);

  const onCompareVersion = useCallback(
    async (meta: DraftVersionMeta) => {
      if (documentText === null) return;
      const full = await loadVersion(sessionId, meta.version);
      if (!full) return;
      const { ops, stats } = computeRedline(full.documentText, documentText);
      setComparing({ meta, ops, stats });
    },
    [sessionId, documentText],
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
        boxFileId,
        boxFileName,
      }).then(() => setRecentDrafts(listDraftSessions()));
    }, 800);
    return () => window.clearTimeout(t);
  }, [restoreReady, sessionId, documentText, history, uploadedName, boxFileId, boxFileName]);

  // ----- Source loading -----
  const onUploadClick = useCallback(() => fileInputRef.current?.click(), []);

  // Shared by the file-picker AND the drag-and-drop path. Drag-and-drop
  // support added 2026-07-04: dropping a file on the page previously fell
  // through to the browser default (navigate to file:///…, replacing the
  // whole app). A window-level guard in App.tsx now blocks that; this
  // handler makes the drop actually useful.
  // Original file bytes for in-place editing (.docx only), so a save can
  // rewrite the ORIGINAL document instead of regenerating one from plain
  // text (which destroys styles/numbering/letterhead). The ref alone was
  // not enough: quitting the app and restoring the session lost the bytes
  // and silently degraded saves (2026-08-17) — so they are also persisted
  // to device-local IndexedDB keyed by session and reloaded on restore.
  const [originalDocx, setOriginalDocx] = useState<{ name: string; bytes: ArrayBuffer } | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploadBusy(true);
    setUploadError(null);
    setOcrStatus(null);
    try {
      if (/\.docx$/i.test(file.name)) {
        const bytes = await file.arrayBuffer();
        setOriginalDocx({ name: file.name, bytes });
        void saveOriginalDoc(sessionId, { name: file.name, bytes }).catch(() => {});
      } else {
        setOriginalDocx(null);
        void deleteOriginalDoc(sessionId).catch(() => {});
      }
      const extracted = await extractTextFromFile(file, {
        onOcrProgress: (done, total) =>
          setOcrStatus(`Reading scanned page ${done} of ${total}… (OCR runs on this device)`),
      });
      const text = extracted.text.trim();
      if (!text) {
        // Prefer the extractor's diagnosis (e.g. scanned PDF, unsupported
        // type) over a generic message.
        setUploadError(extracted.warning ?? 'No readable text found in that file.');
      } else {
        setPasteText(text);
        setUploadedName(file.name);
        if (extracted.warning) setUploadError(extracted.warning);
      }
    } catch (err) {
      setUploadError(`Could not read file: ${(err as Error).message}`);
    } finally {
      setUploadBusy(false);
      setOcrStatus(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [sessionId]);

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

  // ----- Box actions -----

  const onBoxLoadClick = useCallback(async () => {
    setBoxError(null);
    if (!boxState.connected) {
      // Popup MUST open synchronously inside the click gesture (popup
      // blockers; the desktop webview can't open one at all — connectBox
      // falls back to same-window navigation there).
      const popup = openBoxPopup();
      setBoxBusy(true);
      const ok = await connectBox(getToken, popup);
      setBoxBusy(false);
      if (!ok) {
        setBoxError('Box sign-in did not complete. Try again.');
        return;
      }
      setBoxState(await fetchBoxStatus(getToken));
    }
    setBoxBrowseMode('file');
  }, [boxState.connected, getToken]);

  const onBoxFilePicked = useCallback(
    async (item: BoxItem) => {
      setBoxBrowseMode(null);
      setBoxBusy(true);
      setBoxError(null);
      try {
        // Bytes land in the browser and enter the SAME funnel as an upload:
        // extractTextFromFile → on-device PII tokenization → only then wire.
        const file = await downloadBoxFile(getToken, item);
        await handleFile(file);
        setBoxFileId(item.id);
        setBoxFileName(item.name);
      } catch (err) {
        setBoxError(`Could not load from Box: ${(err as Error).message}`);
      } finally {
        setBoxBusy(false);
      }
    },
    [getToken, handleFile],
  );

  /** Every proposal the attorney approved, in order — the edit list applied
   *  to the ORIGINAL .docx when one is available. */
  const appliedEdits = useMemo(
    () =>
      history.flatMap((t) =>
        t.proposals
          .filter((pr) => pr.status === 'applied')
          .map((pr) => ({ find: pr.find, replace: pr.replace })),
      ),
    [history],
  );

  const doBoxSave = useCallback(
    async (folderId?: string) => {
      if (documentText === null) return;
      setBoxBusy(true);
      setBoxError(null);
      try {
        // Preferred path: rewrite the original .docx in place so the firm's
        // formatting survives. Falls back to a generated document when the
        // source wasn't .docx or an edit can't be located in the original.
        let blob: Blob;
        let fidelityNote: string | null = null;
        const original = originalDocx;
        if (original && appliedEdits.length > 0) {
          try {
            const result = editDocxInPlace(original.bytes, appliedEdits);
            if (result.unmatched.length > 0) {
              const misses = result.unmatched
                .map((u) => `"${u.find.length > 60 ? u.find.slice(0, 60) + '…' : u.find}"`)
                .join('; ');
              fidelityNote = `${result.unmatched.length} of ${appliedEdits.length} change${
                appliedEdits.length === 1 ? '' : 's'
              } could not be located in the original file, so a reformatted copy was saved instead. Could not locate: ${misses}`;
              blob = await buildDocxBlob(documentText);
            } else {
              blob = new Blob([new Uint8Array(result.bytes)], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              });
            }
          } catch {
            fidelityNote = 'The original file could not be edited in place, so a reformatted copy was saved.';
            blob = await buildDocxBlob(documentText);
          }
        } else if (original && appliedEdits.length === 0) {
          // Nothing approved yet — save the original untouched.
          blob = new Blob([new Uint8Array(new Uint8Array(original.bytes))], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
        } else {
          blob = await buildDocxBlob(documentText);
          if (documentText.length > 0) {
            fidelityNote =
              'Saved as a new Word document — the source was not a .docx, so original page formatting could not be preserved.';
          }
        }
        const name = boxFileName
          ? boxFileName.replace(/\.(docx|doc|pdf|txt|md)$/i, '') + '.docx'
          : `${draftTitle(documentText, uploadedName).replace(/[^\w\- ]+/g, '').slice(0, 60) || 'DancingElephant draft'}.docx`;
        const result = boxFileId
          ? await uploadToBox(getToken, blob, name, { fileId: boxFileId })
          : await uploadToBox(getToken, blob, name, { folderId: folderId ?? '0' });
        setBoxFileId(result.id);
        setBoxFileName(result.name);
        const base = boxFileId
          ? `Saved to Box as a new version of ${result.name}`
          : `Saved to Box as ${result.name}`;
        setBoxSavedNote(fidelityNote ? `${base} — ${fidelityNote}` : `${base} (original formatting preserved)`);
        window.setTimeout(() => setBoxSavedNote(null), fidelityNote ? 12000 : 6000);
      } catch (err) {
        setBoxError(`Could not save to Box: ${(err as Error).message}`);
      } finally {
        setBoxBusy(false);
      }
    },
    [documentText, boxFileId, boxFileName, uploadedName, getToken, appliedEdits, originalDocx],
  );

  const onBoxSaveClick = useCallback(async () => {
    setBoxError(null);
    if (!boxState.connected) {
      const popup = openBoxPopup();
      setBoxBusy(true);
      const ok = await connectBox(getToken, popup);
      setBoxBusy(false);
      if (!ok) {
        setBoxError('Box sign-in did not complete. Try again.');
        return;
      }
      setBoxState(await fetchBoxStatus(getToken));
    }
    if (boxFileId) {
      await doBoxSave();
    } else {
      setBoxBrowseMode('folder'); // pick destination folder first
    }
  }, [boxState.connected, boxFileId, doBoxSave, getToken]);

  const onBoxFolderPicked = useCallback(
    async (folderId: string) => {
      setBoxBrowseMode(null);
      await doBoxSave(folderId);
    },
    [doBoxSave],
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
          turn.rawNote =
            'No changes suggested. If you expected changes, use "Copy diagnostic" below and send it to Arjun — it captures exactly what the assistant saw.';
          turn.diagnostic = { wire: state.lastWireText ?? '', reply };
        } else if (wasTruncated) {
          turn.rawNote =
            'The reply was cut off by the length limit before any complete proposal came through. Try again with a narrower instruction (e.g. one section at a time, or "propose your 5 most important changes").';
        } else {
          turn.rawNote =
            'The reply could not be read as a list of changes. Try rephrasing the instruction, or ask for fewer changes at once.';
          turn.diagnostic = { wire: state.lastWireText ?? '', reply };
        }
        next[next.length - 1] = turn;
        return next;
      });
      reset();
    }
  }, [state.done, state.tokens, state.lastWireText, reset]);

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

  // Undo a SKIP only — returns the proposal to the pending queue. Skipping
  // never touched the document, so this is a pure status reversal.
  const onUndoReject = useCallback(
    (turnIdx: number, prop: Proposal) => setProposalStatus(turnIdx, prop.id, 'pending'),
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
    setBoxFileId(null);
    setBoxFileName(null);
    setBoxError(null);
    setOriginalDocx(null);
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
    void deleteOriginalDoc(id).catch(() => {});
    setRecentDrafts(listDraftSessions());
  }, []);

  // ----- Derived review counters (artboard 06 header line) -----
  const allProposals = useMemo(() => history.flatMap((t) => t.proposals), [history]);
  const editCounts = useMemo(() => {
    let pending = 0;
    let applied = 0;
    let skipped = 0;
    let unmatched = 0;
    for (const p of allProposals) {
      if (p.status === 'pending') pending += 1;
      else if (p.status === 'applied') applied += 1;
      else if (p.status === 'rejected') skipped += 1;
      else unmatched += 1;
    }
    return { total: allProposals.length, pending, applied, skipped, unmatched };
  }, [allProposals]);

  const headerTitle = documentText ? draftTitle(documentText, uploadedName) : 'Draft a document';

  // -------------------------------------------------------------------------
  // Render — load screen vs editor
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-screen bg-surface-app font-sans text-ink">
      <header className="bg-white border-b border-surface-line2 px-7 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/dancingelephant.png"
            alt=""
            className="h-[30px] w-[30px] shrink-0 rounded-lg"
          />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-ink">{headerTitle}</div>
            <div className="text-[12px] text-ink-muted">
              You approve every change individually. Nothing is applied without you.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {documentText !== null && (
            <>
              <ExportButtons
                documentText={documentText}
                disabled={state.isStreaming}
                originalDocx={originalDocx}
                appliedEdits={appliedEdits}
                onFidelityNote={(note) => {
                  setBoxSavedNote(note);
                  if (note) window.setTimeout(() => setBoxSavedNote(null), 12000);
                }}
              />
              {boxState.configured && (
                <button
                  type="button"
                  onClick={() => void onBoxSaveClick()}
                  disabled={state.isStreaming || boxBusy}
                  className="whitespace-nowrap rounded-[9px] border border-surface-ctl bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-secondary transition hover:border-brand-hover disabled:opacity-60"
                  title={boxFileId ? `Save as a new version of ${boxFileName ?? 'the Box file'}` : 'Save this document to a Box folder'}
                >
                  {boxBusy ? 'Saving…' : boxFileId ? 'Save new version to Box' : 'Save to Box'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowVersions((s) => !s)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-[9px] border px-3.5 py-2 text-[12.5px] font-semibold transition ${
                  showVersions
                    ? 'border-brand-line bg-brand-tint text-brand-deep'
                    : 'border-surface-ctl bg-white text-ink-secondary hover:border-brand-hover'
                }`}
              >
                <History size={14} strokeWidth={1.8} />
                Versions{versions.length > 0 ? ` (${versions.length})` : ''}
              </button>
              <button
                type="button"
                onClick={onStartOver}
                className="whitespace-nowrap rounded-[9px] border border-surface-ctl bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-secondary transition hover:border-brand-hover"
              >
                New document
              </button>
            </>
          )}
          <Link
            to="/v2"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-surface-ctl bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-secondary transition hover:border-brand-hover"
          >
            <ArrowLeft size={14} strokeWidth={1.8} />
            Chat
          </Link>
        </div>
      </header>

      {boxBrowseMode && (
        <BoxBrowserModal
          mode={boxBrowseMode}
          getToken={getToken}
          onPickFile={(item) => void onBoxFilePicked(item)}
          onPickFolder={(id) => void onBoxFolderPicked(id)}
          onClose={() => setBoxBrowseMode(null)}
        />
      )}
      {boxSavedNote && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex max-w-xl items-start gap-2.5 rounded-[10px] border border-deteal-line bg-deteal-bg2 px-3.5 py-2.5 text-[12.5px] text-deteal-deep shadow-card">
          <Check size={15} strokeWidth={1.8} className="mt-px shrink-0 text-deteal-icon2" />
          <span>{boxSavedNote}</span>
        </div>
      )}
      {boxError && documentText !== null && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex max-w-xl items-start gap-2.5 rounded-[10px] border border-dered-line bg-dered-bg2 px-3.5 py-2.5 text-[12.5px] text-dered-text shadow-card">
          <AlertTriangle size={15} strokeWidth={1.8} className="mt-px shrink-0 text-dered" />
          <span>{boxError}</span>
        </div>
      )}
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
          boxConfigured={boxState.configured}
          boxConnectedLogin={boxState.login ?? null}
          boxBusy={boxBusy}
          boxError={boxError}
          onBoxLoad={() => void onBoxLoadClick()}
          ocrStatus={ocrStatus}
        />
      ) : (
        <div className="flex-1 min-h-0 flex gap-6 px-7 py-6">
          {/* Left: the document (only changes when a proposal is approved) */}
          {/* Merge note: main's inline document toolbar (export/Box/Versions/New)
              lives in the page header in the DE-Rebrand layout — same handlers,
              including main's originalDocx/appliedEdits/onFidelityNote export path. */}
          <div className="flex-[1.2] min-w-0 flex flex-col gap-3 min-h-0">
            {showVersions && (
              <VersionsPanel
                versions={versions}
                viewing={viewingVersion}
                onView={onViewVersion}
                onCloseView={() => setViewingVersion(null)}
                onRestore={onRestoreVersion}
                onCompare={onCompareVersion}
                onSaveVersion={onSaveVersion}
              />
            )}
            {comparing && (
              <RedlineModal
                meta={comparing.meta}
                ops={comparing.ops}
                stats={comparing.stats}
                onClose={() => setComparing(null)}
              />
            )}
            <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-surface-line bg-white px-10 py-8">
              <div className="font-display text-[11px] uppercase tracking-wider text-ink-faint mb-4">
                Document{uploadedName ? ` · ${uploadedName}` : ''}
              </div>
              {hasCitationLikeText(documentText) && (
                <div className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-deamber-line bg-deamber-bg2 px-3.5 py-2.5 text-[12.5px] text-deamber-text">
                  <AlertTriangle size={15} strokeWidth={1.8} className="mt-px shrink-0 text-deamber-icon" />
                  <span>
                    <strong className="font-semibold">Citations here are not verified.</strong>{' '}
                    This editor runs no citation check — confirm every authority against Westlaw or Lexis,
                    or run the passage through{' '}
                    <Link to="/v2/verify" className="font-semibold text-brand-deep underline-offset-2 hover:underline">
                      Verify citations
                    </Link>{' '}
                    before filing.
                  </span>
                </div>
              )}
              <article className="v2-md font-doc text-[13.5px] leading-[1.9] text-ink">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{documentText}</ReactMarkdown>
              </article>
            </div>
          </div>

          {/* Right: instruction chat + proposal cards */}
          <div className="w-[420px] shrink-0 flex flex-col min-h-0 gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold text-ink">
                {editCounts.total === 0
                  ? 'Proposed edits'
                  : `Proposed edits · ${editCounts.pending} of ${editCounts.total} remaining`}
              </h2>
              {editCounts.total > 0 && (
                <span className="text-[12px] text-ink-faint">
                  {editCounts.applied} applied · {editCounts.skipped} skipped
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
              {history.length === 0 && (
                <div className="rounded-xl border border-surface-line bg-white p-4 text-[12.5px] leading-relaxed text-ink-muted">
                  Describe a change, or ask what should change — for example{' '}
                  <em>“What would you change to protect the tenant?”</em> or{' '}
                  <em>“Make the tone more formal.”</em> Nothing is applied until you approve it.
                </div>
              )}
              {history.map((turn, turnIdx) => (
                <div key={turnIdx} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[90%] whitespace-pre-wrap rounded-xl bg-brand px-3.5 py-2 text-[13px] text-white">
                      <InstructionWithHighlight text={turn.instruction} />
                    </div>
                  </div>

                  {turn.rawNote && (
                    <div className="whitespace-pre-wrap rounded-xl border border-surface-line bg-surface-app px-3.5 py-2.5 text-[12px] text-ink-muted">
                      {turn.rawNote}
                      {turn.diagnostic && (
                        <button
                          type="button"
                          onClick={() => {
                            const d = turn.diagnostic!;
                            void navigator.clipboard.writeText(
                              `--- INSTRUCTION ---\n${turn.instruction}\n\n--- WIRE TEXT SENT (tokenized) ---\n${d.wire}\n\n--- RAW MODEL REPLY ---\n${d.reply}`,
                            );
                          }}
                          className="mt-2 block rounded-lg border border-surface-ctl bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition hover:border-brand-hover"
                          title="Copies the tokenized text that was sent plus the raw reply — no raw client names — so this can be diagnosed"
                        >
                          Copy diagnostic
                        </button>
                      )}
                    </div>
                  )}

                  {turn.proposals.length > 0 && (
                    <ProposalList
                      proposals={turn.proposals}
                      startIndex={history
                        .slice(0, turnIdx)
                        .reduce((n, t) => n + t.proposals.length, 0)}
                      documentText={documentText}
                      onApprove={(p, override) => onApprove(turnIdx, p, override)}
                      onReject={(p) => onReject(turnIdx, p)}
                      onUndoReject={(p) => onUndoReject(turnIdx, p)}
                      onApproveAll={() => onApproveAll(turnIdx)}
                    />
                  )}
                </div>
              ))}
              {state.isStreaming && (
                <div className="flex items-center gap-2.5 px-1 text-[12px] text-ink-faint">
                  <span className="de-spinner" aria-hidden="true" />
                  Reviewing the document and drafting proposed changes…
                </div>
              )}
              {state.error && (
                <div className="flex items-start gap-2.5 rounded-[10px] border border-dered-line bg-dered-bg2 px-3.5 py-2.5 text-[12.5px] text-dered-text">
                  <AlertTriangle size={15} strokeWidth={1.8} className="mt-px shrink-0 text-dered" />
                  <span>
                    <strong className="font-semibold">Couldn't propose changes.</strong>{' '}
                    {state.error.message}
                  </span>
                </div>
              )}
            </div>

            <div className="shrink-0 rounded-xl border border-surface-line bg-white p-3">
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
                className="w-full resize-none rounded-[10px] border border-surface-ctl px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-line disabled:bg-surface-app"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onSubmitInstruction}
                  disabled={!instruction.trim() || state.isStreaming}
                  className="rounded-[10px] bg-brand px-[18px] py-2 text-[13px] font-semibold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-surface-disabled disabled:text-ink-faint"
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
/** Paragraph the "find" text sits in, 1-based — derived from the live document,
 *  never invented. Returns null when the text can't be located. */
function paragraphNumber(doc: string | null, find: string): number | null {
  if (!doc || !find) return null;
  const idx = doc.indexOf(find);
  if (idx < 0) return null;
  return doc.slice(0, idx).split(/\n{2,}/).length;
}

const ProposalList: React.FC<{
  proposals: Proposal[];
  /** Number of proposals in earlier turns — keeps "Edit N" continuous. */
  startIndex: number;
  documentText: string | null;
  onApprove: (p: Proposal, overrideReplace?: string) => void;
  onReject: (p: Proposal) => void;
  onUndoReject?: (p: Proposal) => void;
  onApproveAll: () => void;
}> = ({ proposals, startIndex, documentText, onApprove, onReject, onUndoReject, onApproveAll }) => {
  const pending = proposals.filter((p) => p.status === 'pending').length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11.5px] font-semibold text-ink-secondary">
          {proposals.length} proposed change{proposals.length > 1 ? 's' : ''}
          {pending > 0 ? ` · ${pending} to review` : ' · all reviewed'}
        </span>
        {pending > 0 && (
          <button
            type="button"
            onClick={onApproveAll}
            className="text-[11.5px] font-semibold text-brand-deep underline-offset-2 hover:underline"
          >
            Approve all
          </button>
        )}
      </div>
      {proposals.map((p, i) => (
        <ProposalCard
          key={p.id}
          proposal={p}
          editNumber={startIndex + i + 1}
          documentText={documentText}
          onApprove={(override) => onApprove(p, override)}
          onReject={() => onReject(p)}
          onUndoReject={onUndoReject ? () => onUndoReject(p) : undefined}
        />
      ))}
    </div>
  );
};

/** Old → new diff block (artboard 06): red strikethrough over teal replacement. */
const DiffBlock: React.FC<{ find: string; replace: string }> = ({ find, replace }) => (
  <div className="overflow-hidden rounded-lg font-mono text-[12px] leading-[1.6]">
    <div className="whitespace-pre-wrap bg-dered-bg px-2.5 py-[7px] text-dered-text line-through">
      {find.slice(0, 400)}
    </div>
    <div className="whitespace-pre-wrap bg-deteal-bg px-2.5 py-[7px] text-deteal-deep">
      {replace.slice(0, 400)}
    </div>
  </div>
);

const ProposalCard: React.FC<{
  proposal: Proposal;
  editNumber: number;
  documentText: string | null;
  onApprove: (overrideReplace?: string) => void;
  onReject: () => void;
  onUndoReject?: () => void;
}> = ({ proposal, editNumber, documentText, onApprove, onReject, onUndoReject }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(proposal.replace);
  const para = useMemo(
    () => paragraphNumber(documentText, proposal.find),
    [documentText, proposal.find],
  );
  const label = proposal.section || proposal.description;
  const hasDiff = Boolean(proposal.find || proposal.replace);

  // ----- Collapsed rows: applied / skipped / couldn't locate -----
  if (proposal.status !== 'pending') {
    const row = {
      applied: {
        wrap: 'border-deteal-line bg-deteal-bg2',
        text: 'text-deteal-deep',
        icon: <Check size={15} strokeWidth={2} className="mt-px shrink-0 text-deteal-icon2" />,
        body: (
          <>
            <strong className="font-semibold">Edit {editNumber} applied</strong> — {label}
            {para !== null ? ` (¶ ${para})` : ''}
          </>
        ),
      },
      rejected: {
        wrap: 'border-surface-line bg-surface-app',
        text: 'text-ink-muted',
        icon: <X size={15} strokeWidth={2} className="mt-px shrink-0 text-ink-faint" />,
        body: (
          <>
            <strong className="font-semibold">Edit {editNumber} skipped</strong> — {label}
            {onUndoReject && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={onUndoReject}
                  className="font-semibold text-brand-deep underline-offset-2 hover:underline"
                >
                  Undo
                </button>
              </>
            )}
          </>
        ),
      },
      unmatched: {
        wrap: 'border-deamber-line bg-deamber-bg',
        text: 'text-deamber-text',
        icon: <AlertTriangle size={15} strokeWidth={2} className="mt-px shrink-0 text-deamber-icon" />,
        body: (
          <>
            <strong className="font-semibold">Couldn't locate</strong> — {label}. The wording changed
            since this edit was proposed, so apply it by hand from the before/after below.
          </>
        ),
      },
    }[proposal.status];

    return (
      <div className={`rounded-xl border px-4 py-3 ${row.wrap}`}>
        <div className={`flex items-start gap-2.5 text-[12.5px] ${row.text}`}>
          {row.icon}
          <span className="min-w-0 flex-1">{row.body}</span>
          {hasDiff && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="shrink-0 text-[11px] font-semibold text-ink-faint underline-offset-2 hover:underline"
            >
              {open ? 'Hide' : 'View'}
            </button>
          )}
        </div>
        {open && hasDiff && (
          <div className="mt-2.5">
            <DiffBlock find={proposal.find} replace={proposal.replace} />
          </div>
        )}
      </div>
    );
  }

  // ----- Pending card -----
  return (
    <div className="rounded-xl border border-brand-line bg-white p-4 shadow-card">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <span className="min-w-0 text-[12px] font-semibold text-brand-deep">
          Edit {editNumber} · {label}
        </span>
        {para !== null && <span className="shrink-0 text-[11px] text-ink-faint">¶ {para}</span>}
      </div>

      {proposal.description && proposal.description !== label && (
        <p className="mb-2 text-[12.5px] text-ink-secondary">{proposal.description}</p>
      )}
      {proposal.rationale && (
        <p className="mb-2.5 text-[11.5px] text-ink-muted">{proposal.rationale}</p>
      )}

      {hasDiff && <DiffBlock find={proposal.find} replace={proposal.replace} />}

      {/* Modify mode — edit the replacement text before applying. */}
      {editing && (
        <div className="mt-2.5 space-y-1">
          <label className="block text-[11px] text-ink-muted">
            Edit the new text, then apply it:
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(8, Math.max(3, Math.ceil(draft.length / 60)))}
            className="w-full resize-y rounded-lg border border-surface-ctl px-2.5 py-1.5 text-[12px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-line"
          />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => onApprove(draft)}
              className="flex-1 rounded-lg bg-brand px-3 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-deep"
            >
              Apply edited text
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setDraft(proposal.replace); }}
              className="rounded-lg border border-surface-ctl bg-white px-4 py-2.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-brand-hover"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onApprove()}
              className="flex-1 rounded-lg bg-brand px-3 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-deep"
            >
              Approve change
            </button>
            <button
              type="button"
              onClick={() => { setDraft(proposal.replace); setEditing(true); setOpen(true); }}
              title="Edit the replacement text before applying it"
              className="flex items-center gap-1.5 rounded-lg border border-surface-ctl bg-white px-3 py-2.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-brand-hover"
            >
              <Pencil size={13} strokeWidth={1.8} />
              Edit
            </button>
            <button
              type="button"
              onClick={onReject}
              className="rounded-lg border border-surface-ctl bg-white px-4 py-2.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-brand-hover"
            >
              Skip
            </button>
          </>
        )}
      </div>
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
  boxConfigured: boolean;
  boxConnectedLogin: string | null;
  boxBusy: boolean;
  boxError: string | null;
  onBoxLoad: () => void;
  ocrStatus: string | null;
}> = ({
  pasteText, setPasteText, uploadBusy, uploadError, uploadedName,
  fileInputRef, onUploadClick, onFileChosen, onFileDropped, onLoadDocument,
  recentDrafts, onOpenRecent, onDeleteRecent,
  boxConfigured, boxConnectedLogin, boxBusy, boxError, onBoxLoad, ocrStatus,
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
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="mb-1.5 font-display text-[26px] font-semibold text-ink">
          Start with your document
        </h2>
        <p className="mb-6 text-[13.5px] leading-relaxed text-ink-muted">
          Paste your document below, drag a file anywhere onto this page, or upload one
          (.txt, .doc, .docx, .pdf). Then tell the assistant what to change — it proposes
          edits and you approve each one. Your clients' information is protected on your
          device before anything is sent.
        </p>

        {recentDrafts.length > 0 && (
          <div className="mb-6 rounded-xl border border-surface-line bg-white p-4 shadow-card">
            <h3 className="mb-2.5 text-[13px] font-semibold text-ink">Recent drafts</h3>
            <ul className="space-y-1">
              {recentDrafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenRecent(d.id)}
                    className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-brand-deep underline-offset-2 hover:underline"
                    title={d.title}
                  >
                    {d.title}
                  </button>
                  <span className="shrink-0 text-[11px] text-ink-faint">
                    {new Date(d.savedAt).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteRecent(d.id)}
                    className="shrink-0 rounded-md p-1 text-ink-faint transition hover:bg-surface-pill hover:text-dered"
                    aria-label={`Delete draft ${d.title}`}
                    title={`Delete draft ${d.title}`}
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[11px] text-ink-faint">
              Saved on this device only, encrypted at rest. Your latest draft reopens
              automatically.
            </p>
          </div>
        )}

        <div
          className={`rounded-xl border bg-white p-5 shadow-card transition ${
            dragOver ? 'border-2 border-dashed border-brand-hover bg-brand-tint/50' : 'border-surface-line'
          }`}
        >
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onUploadClick}
              disabled={uploadBusy}
              className="flex items-center gap-2 rounded-[10px] border border-surface-ctl bg-white px-4 py-2 text-[13px] font-semibold text-ink-secondary transition hover:border-brand-hover disabled:opacity-60"
            >
              <Upload size={14} strokeWidth={1.8} />
              {uploadBusy ? 'Reading file…' : 'Upload a file'}
            </button>
            {boxConfigured && (
              <button
                type="button"
                onClick={onBoxLoad}
                disabled={uploadBusy || boxBusy}
                className="flex items-center gap-2 rounded-[10px] border border-surface-ctl bg-white px-4 py-2 text-[13px] font-semibold text-ink-secondary transition hover:border-brand-hover disabled:opacity-60"
                title={boxConnectedLogin ? `Box: ${boxConnectedLogin}` : 'Sign in with Box, then browse your folders'}
              >
                <FolderOpen size={14} strokeWidth={1.8} />
                {boxBusy ? 'Opening Box…' : 'Load from Box'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={onFileChosen}
              className="hidden"
            />
            {uploadedName && (
              <span className="text-[12px] text-ink-muted">
                Loaded from <strong className="font-semibold text-ink-secondary">{uploadedName}</strong>
              </span>
            )}
          </div>

          {boxError && (
            <p className="mb-3 flex items-start gap-2 rounded-[10px] border border-dered-line bg-dered-bg2 px-3 py-2 text-[12.5px] text-dered-text">
              <AlertTriangle size={14} strokeWidth={1.8} className="mt-px shrink-0 text-dered" />
              {boxError}
            </p>
          )}
          {ocrStatus && (
            <p className="mb-3 flex items-center gap-2 text-[12.5px] text-ink-muted">
              <span className="de-spinner" aria-hidden="true" />
              {ocrStatus}
            </p>
          )}

          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={16}
            placeholder="Paste your document text here…"
            className="w-full resize-y rounded-[10px] border border-surface-ctl px-4 py-3 font-doc text-[13.5px] leading-[1.9] text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-line"
          />

          {uploadError && (
            <p className="mt-2.5 flex items-start gap-2 rounded-[10px] border border-deamber-line bg-deamber-bg2 px-3 py-2 text-[12.5px] text-deamber-text">
              <AlertTriangle size={14} strokeWidth={1.8} className="mt-px shrink-0 text-deamber-icon" />
              {uploadError}
            </p>
          )}

          <div className="mt-3.5 flex items-center justify-between gap-3">
            <span className="text-[12px] text-ink-faint">
              {pasteText.trim().length > 0
                ? `${pasteText.trim().split(/\s+/).length} words${detectionCount > 0 ? ` · ${detectionCount} private item${detectionCount > 1 ? 's' : ''} protected on this device` : ''}`
                : 'Nothing loaded yet.'}
            </span>
            <button
              type="button"
              onClick={onLoadDocument}
              disabled={pasteText.trim().length < 10}
              className="rounded-[10px] bg-brand px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-surface-disabled disabled:text-ink-faint"
            >
              Load document
            </button>
          </div>
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
  onCompare: (meta: DraftVersionMeta) => void;
  onSaveVersion: () => void;
}> = ({ versions, viewing, onView, onCloseView, onRestore, onCompare, onSaveVersion }) => {
  return (
    <div className="shrink-0 overflow-hidden rounded-xl border border-surface-line bg-white shadow-card">
      <div className="flex items-center gap-3 border-b border-surface-line2 px-5 py-2.5">
        <h3 className="text-[13px] font-semibold text-ink">Version history</h3>
        <p className="flex-1 text-[11px] text-ink-faint">
          Saved on this device. Restoring never deletes a version.
        </p>
        <button
          type="button"
          onClick={onSaveVersion}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-surface-ctl bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-secondary transition hover:border-brand-hover"
          title="Save a named checkpoint of the current document"
        >
          <Plus size={13} strokeWidth={1.8} />
          Save checkpoint
        </button>
      </div>
      <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto bg-surface-app px-5 py-3 sm:grid-cols-2 xl:grid-cols-3">
        {versions.length === 0 && (
          <p className="col-span-full px-1 py-2 text-[12px] text-ink-muted">
            No versions yet. One is saved automatically when you load a document and each time
            you apply proposals — or use “Save checkpoint” for a named one.
          </p>
        )}
        {versions.map((v) => (
          <div key={v.version} className="rounded-[10px] border border-surface-line bg-white px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-semibold text-ink">
                v{v.version} · {VERSION_KIND_LABEL[v.kind] ?? v.kind}
                {v.kind === 'restore' && v.restoredFrom ? ` v${v.restoredFrom}` : ''}
              </span>
              <span className="shrink-0 text-[10.5px] text-ink-faint">
                {new Date(v.savedAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </div>
            {v.label && (
              <div className="mt-0.5 truncate text-[12px] font-medium text-brand-deep" title={v.label}>
                “{v.label}”
              </div>
            )}
            {v.proposals.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {v.proposals.slice(0, 3).map((p, i) => (
                  <li key={i} className="truncate text-[11px] text-ink-muted" title={`${p.section}: ${p.description}`}>
                    • {p.description || p.section}
                  </li>
                ))}
                {v.proposals.length > 3 && (
                  <li className="text-[11px] text-ink-faint">…and {v.proposals.length - 3} more</li>
                )}
              </ul>
            )}
            <div className="mt-2 flex items-center gap-2.5">
              <span className={`text-[10.5px] font-semibold ${v.wordDelta >= 0 ? 'text-deteal-text' : 'text-dered-text'}`}>
                {v.wordDelta >= 0 ? `+${v.wordDelta}` : v.wordDelta} words
              </span>
              <button
                type="button"
                onClick={() => onView(v)}
                className="text-[11px] font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => onCompare(v)}
                className="text-[11px] font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                title="Redline: this version vs the current document"
              >
                Compare
              </button>
              <button
                type="button"
                onClick={() => onRestore(v)}
                className="text-[11px] font-semibold text-brand-deep underline-offset-2 hover:underline"
              >
                Restore
              </button>
            </div>
          </div>
        ))}
      </div>
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-plum/30 p-8" onClick={onCloseView}>
          <div
            className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-surface-line2 px-5 py-3">
              <div className="min-w-0">
                <h4 className="truncate text-[13.5px] font-semibold text-ink">
                  Version {viewing.meta.version} · {VERSION_KIND_LABEL[viewing.meta.kind] ?? viewing.meta.kind}
                  {viewing.meta.label ? ` — “${viewing.meta.label}”` : ''}
                </h4>
                <p className="text-[11px] text-ink-faint">{new Date(viewing.meta.savedAt).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRestore(viewing.meta)}
                  className="rounded-[10px] bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-deep"
                >
                  Restore this version
                </button>
                <button
                  type="button"
                  onClick={onCloseView}
                  className="rounded-[10px] border border-surface-ctl bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-secondary transition hover:border-brand-hover"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <article className="v2-md font-doc text-[13.5px] leading-[1.9] text-ink">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewing.text}</ReactMarkdown>
              </article>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Redline modal (phase 2): word-level compare of a version vs the current
// document. Insertions blue underline, deletions red strikethrough — light
// mode, print-friendly.
// ---------------------------------------------------------------------------
const RedlineModal: React.FC<{
  meta: DraftVersionMeta;
  ops: RedlineOp[];
  stats: RedlineStats;
  onClose: () => void;
}> = ({ meta, ops, stats, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-plum/30 p-8" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-surface-line2 px-5 py-3">
          <div className="min-w-0">
            <h4 className="text-[13.5px] font-semibold text-ink">
              Redline: v{meta.version} → current document
            </h4>
            <p className="text-[11px] text-ink-faint">
              {stats.identical ? (
                'No differences — the current document is identical to this version.'
              ) : (
                <>
                  <span className="font-semibold text-deteal-text">{stats.insertedWords} inserted</span>
                  {' · '}
                  <span className="font-semibold text-dered-text">{stats.deletedWords} deleted</span>
                  {' words vs '}
                  {new Date(meta.savedAt).toLocaleString()}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-[10px] border border-surface-ctl bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-secondary transition hover:border-brand-hover"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="whitespace-pre-wrap font-doc text-[13.5px] leading-[1.9] text-ink">
            {ops.map((op, i) =>
              op.type === 'equal' ? (
                <span key={i}>{op.text}</span>
              ) : op.type === 'ins' ? (
                <ins key={i} className="bg-deteal-bg text-deteal-deep no-underline">
                  {op.text}
                </ins>
              ) : (
                <del key={i} className="bg-dered-bg text-dered-text line-through decoration-dered">
                  {op.text}
                </del>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const InstructionSanitizationChips: React.FC<{ combinedText: string }> = ({ combinedText }) => {
  const { preview, hasDetections } = useV2SanitizationPreview(combinedText);
  if (!hasDetections) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-deteal-line bg-deteal-bg px-3 py-1.5 text-[12px] font-semibold text-deteal-text">
        <ShieldCheck size={13} strokeWidth={1.8} />
        Nothing to protect in this message
      </span>
    );
  }
  return (
    <div className="space-y-1.5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-deamber-line bg-deamber-bg px-3 py-1.5 text-[12px] font-semibold text-deamber-text">
        <ShieldCheck size={13} strokeWidth={1.8} />
        {preview.tokens.length} item{preview.tokens.length > 1 ? 's' : ''} protected on this device
        {preview.tokens.length > 8 && (
          <span className="font-normal text-ink-faint">· scroll to review all</span>
        )}
      </span>
      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {preview.tokens.map((t) => (
          <span
            key={t.value}
            className="inline-flex items-center gap-1.5 rounded-[7px] border border-surface-line bg-surface-app px-2 py-0.5 text-[11px] text-ink-secondary"
            title={`Will be sent as ${t.value}`}
          >
            <code className="font-mono text-deamber-text">{t.value}</code>
            <span className="text-ink-faint">←</span>
            {t.raw.slice(0, 20)}{t.raw.length > 20 ? '…' : ''}
            <button
              type="button"
              onClick={() => addToUserAllowlist(t.raw)}
              title={`Not privileged — always send "${t.raw.slice(0, 40)}" as-is (this device).`}
              aria-label={`Mark "${t.raw}" as not privileged`}
              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-ink-faint transition hover:bg-surface-pill hover:text-ink"
            >
              <X size={10} strokeWidth={2.2} />
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
        <mark
          key={i}
          className="rounded-[3px] border-b-[1.5px] border-deamber bg-deamber-hl px-0.5 text-ink"
          title="Protected on this device — sent as a token"
        >
          {p}
        </mark>
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

/** Build the DOCX blob (shared by download-export and Save-to-Box). */
async function buildDocxBlob(documentText: string): Promise<Blob> {
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
  return Packer.toBlob(doc);
}

async function exportDocx(documentText: string): Promise<void> {
  const blob = await buildDocxBlob(documentText);
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

const ExportButtons: React.FC<{
  documentText: string;
  disabled?: boolean;
  /** When present, DOCX export rewrites the ORIGINAL file in place so the
   *  firm's formatting survives (same engine as Save to Box). */
  originalDocx?: { name: string; bytes: ArrayBuffer } | null;
  appliedEdits?: Array<{ find: string; replace: string }>;
  /** Called when DOCX export could NOT preserve the original formatting —
   *  the fallback must be loud, never silent (2026-08-17). */
  onFidelityNote?: (note: string | null) => void;
}> = ({ documentText, disabled, originalDocx, appliedEdits, onFidelityNote }) => {
  const [busy, setBusy] = useState<null | 'docx' | 'pdf' | 'html'>(null);
  const [error, setError] = useState<string | null>(null);
  const onExport = useCallback(
    async (format: 'docx' | 'pdf' | 'html') => {
      setBusy(format);
      setError(null);
      try {
        if (format === 'docx') {
          const edits = appliedEdits ?? [];
          let done = false;
          let note: string | null = null;
          if (originalDocx) {
            try {
              const result = editDocxInPlace(originalDocx.bytes, edits);
              if (result.unmatched.length === 0) {
                downloadClientBlob(
                  new Blob([new Uint8Array(result.bytes)], {
                    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  }),
                  originalDocx.name.replace(/\.docx$/i, '') + '-edited.docx',
                );
                done = true;
                note = `Exported ${originalDocx.name.replace(/\.docx$/i, '')}-edited.docx with the original formatting preserved.`;
              } else {
                const misses = result.unmatched
                  .map((u) => `"${u.find.length > 60 ? u.find.slice(0, 60) + '…' : u.find}"`)
                  .join('; ');
                note = `${result.unmatched.length} change${result.unmatched.length === 1 ? '' : 's'} could not be located in the original file — exported a reformatted copy instead. Could not locate: ${misses}`;
              }
            } catch {
              note = 'The original file could not be edited in place — exported a reformatted copy instead.';
            }
          } else {
            note = 'No original Word file is attached to this draft — exported a reformatted copy (original page formatting not preserved).';
          }
          if (!done) await exportDocx(documentText);
          onFidelityNote?.(note);
        }
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
    <div className="relative flex items-center gap-2.5">
      {(
        [
          ['docx', 'DOCX', 'Download as a Word document (.docx)'],
          ['pdf', 'PDF', 'Download as a PDF'],
          ['html', 'HTML', 'Download as a self-contained web page (.html)'],
        ] as const
      ).map(([fmt, label, hint]) => (
        <button
          key={fmt}
          type="button"
          onClick={() => void onExport(fmt)}
          disabled={disabled || busy !== null}
          title={hint}
          className="flex items-center gap-[7px] whitespace-nowrap rounded-[9px] border border-surface-ctl bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-secondary transition hover:border-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={14} strokeWidth={1.8} />
          {busy === fmt ? 'Exporting…' : label}
        </button>
      ))}
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full mt-1 max-w-[280px] text-right text-[11px] text-dered-text"
        >
          {error}
        </span>
      )}
    </div>
  );
};

export default V2DraftPage;
