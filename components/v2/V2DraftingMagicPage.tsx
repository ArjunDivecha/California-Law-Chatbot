/**
 * V2 Drafting Magic page — /v2/magic. V2-native adaptation of the
 * Drafting Magic feature from codex/drafting-magic-sanitized.
 *
 * Workbench for "reconcile a packet of estate-planning documents +
 * draft the updated document set" (per docs/PRD_DRAFTING_MAGIC.md).
 *
 * UI sections:
 *   1. Source list — name, role, base toggle, text-paste or file upload
 *   2. Drafting instructions / new requirement textarea
 *   3. Output toggle (Draft new document | Review memo)
 *   4. Generate button → POST /api/agent/drafting-magic → stream output
 *   5. Output pane — renders the 9 structured sections from the response
 *
 * File upload supports .txt, .md, .rtf (text-only formats). PDF/DOCX
 * binary parsing is a follow-up — would need pdf.js + mammoth deps.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useV2DraftingMagicStream, type MagicSource } from '../../hooks/useV2DraftingMagicStream.ts';

const ROLE_OPTIONS = [
  'trust',
  'pour-over will',
  'AHCD',
  'financial POA',
  'prenup',
  'statute',
  'instruction',
  'client facts',
  'other',
];

function newSessionId(): string {
  return `v2m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function newSourceId(): string {
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const V2DraftingMagicPage: React.FC = () => {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const [sessionId] = useState(() => newSessionId());
  const [sources, setSources] = useState<MagicSource[]>([]);
  const [instructions, setInstructions] = useState('');
  const [outputType, setOutputType] = useState<'draft' | 'review_memo'>('draft');
  const { state, send, reset } = useV2DraftingMagicStream();

  const addSource = useCallback(() => {
    setSources((prev) => [
      ...prev,
      {
        id: newSourceId(),
        name: `Source ${prev.length + 1}`,
        role: 'other',
        included: true,
        base: prev.length === 0,
        text: '',
      },
    ]);
  }, []);

  const updateSource = useCallback((id: string, patch: Partial<MagicSource>) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }, []);

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const setBase = useCallback((id: string) => {
    setSources((prev) => prev.map((s) => ({ ...s, base: s.id === id })));
  }, []);

  const onFile = useCallback(
    async (id: string, file: File) => {
      const ext = file.name.toLowerCase().split('.').pop() ?? '';
      if (!['txt', 'md', 'rtf', 'text'].includes(ext)) {
        updateSource(id, {
          text: `[Unsupported file type ".${ext}". Drafting Magic in V2 currently supports .txt / .md / .rtf only. PDF/DOCX extraction is a follow-up.]\n`,
        });
        return;
      }
      try {
        const text = await file.text();
        updateSource(id, { name: file.name, text });
      } catch (err) {
        updateSource(id, { text: `[File read error: ${(err as Error).message}]` });
      }
    },
    [updateSource],
  );

  const canGenerate =
    sources.some((s) => s.included && s.text.trim().length > 0) &&
    instructions.trim().length > 10 &&
    !state.isStreaming;

  const onGenerate = useCallback(() => {
    void send({
      session_id: sessionId,
      packet: sources,
      instructions: instructions.trim(),
      output_type: outputType,
      user_id: userId,
    });
  }, [send, sessionId, sources, instructions, outputType, userId]);

  // Auto-add one source on mount so the workbench isn't empty
  useEffect(() => {
    if (sources.length === 0) addSource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: '#FAFAF8', fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm">
              <img src="/Heart Favicon.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">California Law Chatbot</h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pink-500">
                V2 Drafting Magic · Estate-Planning Workbench
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link to="/v2" className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700 hover:bg-gray-200">
              ← Chat
            </Link>
            <span className="text-gray-400">
              session: <span className="font-mono">{sessionId.slice(0, 14)}…</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-6xl flex flex-col px-6 py-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: packet builder */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Packet</h2>
                <button
                  type="button"
                  onClick={addSource}
                  className="text-xs rounded-full bg-pink-500 hover:bg-pink-600 text-white font-semibold px-3 py-1"
                  disabled={state.isStreaming}
                >
                  + Add source
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Upload or paste each source document (trust, pour-over will, AHCD, financial POA, prenup, statute,
                client facts, etc.). Mark ONE as the BASE — the new draft is anchored on it. Roles help the model
                map cross-references.
              </p>

              <div className="space-y-3">
                {sources.map((s) => (
                  <div key={s.id} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => updateSource(s.id, { name: e.target.value })}
                        placeholder="Source name"
                        className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
                        disabled={state.isStreaming}
                      />
                      <select
                        value={s.role}
                        onChange={(e) => updateSource(s.id, { role: e.target.value })}
                        className="rounded border border-gray-200 px-1 py-1 text-xs"
                        disabled={state.isStreaming}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <label className="text-[11px] inline-flex items-center gap-1">
                        <input
                          type="radio"
                          checked={s.base}
                          onChange={() => setBase(s.id)}
                          disabled={state.isStreaming}
                        />
                        Base
                      </label>
                      <label className="text-[11px] inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={s.included}
                          onChange={(e) => updateSource(s.id, { included: e.target.checked })}
                          disabled={state.isStreaming}
                        />
                        Include
                      </label>
                      <button
                        type="button"
                        onClick={() => removeSource(s.id)}
                        className="text-[11px] text-red-600 hover:underline"
                        disabled={state.isStreaming}
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="file"
                      accept=".txt,.md,.rtf,.text,text/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onFile(s.id, f);
                      }}
                      disabled={state.isStreaming}
                      className="text-[11px] text-gray-500 mb-1"
                    />
                    <textarea
                      value={s.text}
                      onChange={(e) => updateSource(s.id, { text: e.target.value })}
                      placeholder="Paste source text here (or upload above)..."
                      rows={4}
                      disabled={state.isStreaming}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs font-mono"
                    />
                    <div className="text-[10px] text-gray-400 mt-1">
                      {s.text.length} chars · {s.text.split(/\s+/).filter((w) => w).length} words
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-700 mb-1">
                    Drafting instructions / new requirement <span className="text-red-500">*</span>
                  </span>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="What do you want? E.g., 'Reconcile fiduciary appointments across these documents and produce an updated revocable trust naming Maria Chen as successor trustee. New requirement: California SB 1234 (2026) on remote notarization.'"
                    rows={5}
                    disabled={state.isStreaming}
                    className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
                  />
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">Output:</span>
                  <button
                    type="button"
                    onClick={() => setOutputType('draft')}
                    className={`text-xs rounded-full px-3 py-1 border ${outputType === 'draft' ? 'bg-pink-50 border-pink-300 text-pink-700 font-semibold' : 'border-gray-200 text-gray-700'}`}
                    disabled={state.isStreaming}
                  >
                    Draft new document
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutputType('review_memo')}
                    className={`text-xs rounded-full px-3 py-1 border ${outputType === 'review_memo' ? 'bg-pink-50 border-pink-300 text-pink-700 font-semibold' : 'border-gray-200 text-gray-700'}`}
                    disabled={state.isStreaming}
                  >
                    Review memo
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={!canGenerate}
                  className="w-full rounded-lg bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 text-sm"
                >
                  {state.isStreaming ? 'Generating…' : `Generate ${outputType === 'draft' ? 'Draft' : 'Review Memo'}`}
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  Est. 2–5 minutes. Streams structured output as it's produced.
                </p>
              </div>
            </section>

            {/* RIGHT: output pane */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 min-h-[500px] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Workproduct</h2>
                {state.source_count !== null && (
                  <span className="text-[10px] text-gray-400">
                    {state.source_count} source{state.source_count === 1 ? '' : 's'} · {state.output_type}
                  </span>
                )}
              </div>
              {!state.tokens && !state.isStreaming && !state.error && (
                <div className="text-center text-sm text-gray-400 py-12">
                  Add sources + instructions, then Generate. Output streams here with structured sections
                  (source inventory, extraction, conflict map, drafting strategy, generated draft, compliance
                  checklist, source lineage, review flags).
                </div>
              )}
              {(state.isStreaming || state.tokens) && (
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {state.privileged !== null && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${state.privileged ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}
                    >
                      {state.privileged ? '⚠️ Privileged content detected' : '🌐 No privileged content detected'}
                    </span>
                  )}
                  {state.tokens && (
                    <div className="text-[13px] leading-relaxed text-gray-900 v2-md">
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
                          h2: ({ node, ...props }) => (
                            <h2
                              {...props}
                              className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wider text-pink-600 border-t border-gray-100 pt-3"
                            />
                          ),
                        }}
                      >
                        {state.tokens}
                      </ReactMarkdown>
                      {state.isStreaming && <span className="ml-1 inline-block animate-pulse">▍</span>}
                    </div>
                  )}
                  {!state.tokens && state.round > 0 && (
                    <div className="text-sm text-gray-500 italic">Working on round {state.round}…</div>
                  )}
                </div>
              )}
              {state.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mt-3">
                  <strong>Error — </strong>
                  <span className="font-mono text-xs">{state.error.code}</span>
                  <div className="mt-1">{state.error.message}</div>
                </div>
              )}
              {state.done && (
                <div className="text-xs text-gray-400 text-right mt-3 border-t border-gray-100 pt-2">
                  {state.done.tool_rounds} tool round{state.done.tool_rounds === 1 ? '' : 's'} ·{' '}
                  {state.done.total_tokens.toLocaleString()} tokens ·{' '}
                  {Math.round(state.done.elapsed_ms / 100) / 10}s · stop={state.done.stop_reason}
                </div>
              )}
              {state.done && state.tokens && (
                <MagicExportPanel draftText={state.tokens} outputType={state.output_type ?? 'draft'} />
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

/**
 * MagicExportPanel — DOCX export of the generated_draft section (or
 * the whole workproduct if no generated_draft section). Reuses the V1
 * /api/export-document endpoint for proper formatting.
 */
const MagicExportPanel: React.FC<{ draftText: string; outputType: 'draft' | 'review_memo' }> = ({
  draftText,
  outputType,
}) => {
  const [busy, setBusy] = useState<null | 'docx' | 'pdf' | 'html'>(null);
  const [error, setError] = useState<string | null>(null);

  const onExport = useCallback(
    async (format: 'docx' | 'pdf' | 'html') => {
      setBusy(format);
      setError(null);
      try {
        // Parse sections: pull out generated_draft + supporting sections.
        const re = /## SECTION: (\w+)\s*\n/g;
        const markers: Array<{ id: string; start: number; end: number }> = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(draftText)) !== null) {
          markers.push({ id: m[1], start: m.index, end: re.lastIndex });
        }
        const sections = markers.map((mk, i) => {
          const tailStart = i + 1 < markers.length ? markers[i + 1].start : draftText.length;
          return {
            sectionId: mk.id,
            sectionName: mk.id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            content: draftText.slice(mk.end, tailStart).trim(),
          };
        });
        // Export ONLY the generated_draft section if present; otherwise
        // export the full workproduct.
        const draftSection = sections.find((s) => s.sectionId === 'generated_draft');
        const exportSections = draftSection ? [draftSection] : sections;

        const doc = {
          id: `v2_magic_${Date.now()}`,
          templateId: 'drafting_magic',
          templateName: outputType === 'review_memo' ? 'Review Memo' : 'Drafting Magic — Generated Draft',
          createdAt: new Date().toISOString(),
          sections: exportSections.map((s) => ({
            sectionId: s.sectionId,
            sectionName: s.sectionName,
            content: s.content,
            wordCount: s.content.split(/\s+/).filter((w) => w).length,
            citations: [],
            generatedAt: new Date().toISOString(),
            revisionCount: 0,
          })),
          formatting: {
            fontFamily: 'Times New Roman',
            fontSize: 12,
            lineSpacing: 'double',
            margins: { top: 1, bottom: 1, left: 1, right: 1 },
            pageNumbers: true,
          },
        };
        const resp = await fetch('/api/export-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: doc, format }),
        });
        if (!resp.ok) {
          setError(`Export failed: HTTP ${resp.status}`);
          setBusy(null);
          return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `drafting-magic-${outputType}-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [draftText, outputType],
  );

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Export</h3>
      </div>
      <div className="flex items-center gap-2">
        {(['docx', 'pdf', 'html'] as const).map((fmt) => (
          <button
            key={fmt}
            type="button"
            onClick={() => onExport(fmt)}
            disabled={busy !== null}
            className="rounded-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white text-xs font-semibold px-3 py-1"
          >
            {busy === fmt ? 'Generating…' : `Export ${fmt.toUpperCase()}`}
          </button>
        ))}
      </div>
      {error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800">{error}</div>}
    </div>
  );
};

export default V2DraftingMagicPage;
