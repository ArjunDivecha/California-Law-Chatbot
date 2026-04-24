/**
 * SanitizedPreview — split-pane live preview of what tokenization
 * would do to the attorney's current input.
 *
 * The component is intentionally dumb: all state manipulation lives in
 * services/sanitization/previewSession.ts. We pass rawText in, run
 * computePreview() to get render-ready data, and call the edit helpers
 * in response to UI events.
 *
 * This is the Day 6 UI. It uses ephemeral token assignments — the
 * tokens reset when the component unmounts. Day 7 will swap the
 * ephemeral session for the passphrase-unlocked persistent store via
 * a useSanitizer() context.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { X, Edit2 } from 'lucide-react';
import {
  addManualToken,
  computePreview,
  emptyPreviewSession,
  renameToken,
  suppressToken,
  type PreviewSessionState,
} from '../services/sanitization/previewSession.ts';
import type { SpanCategory } from '../api/_shared/sanitization/index.ts';

interface SanitizedPreviewProps {
  /** The attorney's current input text. */
  rawText: string;
  /** Optional — called whenever the sanitized output changes. */
  onSanitizedChange?: (sanitized: string) => void;
  /** If true, renders in a compact inline mode (used beside the composer). */
  compact?: boolean;
}

const CATEGORY_COLORS: Record<SpanCategory, string> = {
  name: 'bg-amber-100 text-amber-900 border-amber-300',
  street_address: 'bg-sky-100 text-sky-900 border-sky-300',
  zip: 'bg-sky-100 text-sky-900 border-sky-300',
  phone: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  email: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  ssn: 'bg-rose-100 text-rose-900 border-rose-300',
  tin: 'bg-rose-100 text-rose-900 border-rose-300',
  driver_license: 'bg-rose-100 text-rose-900 border-rose-300',
  credit_card: 'bg-rose-100 text-rose-900 border-rose-300',
  bank_account: 'bg-rose-100 text-rose-900 border-rose-300',
  medical_record: 'bg-rose-100 text-rose-900 border-rose-300',
  date: 'bg-violet-100 text-violet-900 border-violet-300',
  client_matter: 'bg-slate-200 text-slate-900 border-slate-400',
};

export const SanitizedPreview: React.FC<SanitizedPreviewProps> = ({
  rawText,
  onSanitizedChange,
  compact = false,
}) => {
  const [session, setSession] = useState<PreviewSessionState>(() => emptyPreviewSession());

  const preview = useMemo(() => computePreview(rawText, session), [rawText, session]);

  // Notify parent of changes on every render where sanitized text changes.
  // Using a ref would be cleaner but a dependency on sanitized is sufficient.
  const lastSanitized = React.useRef<string>('');
  React.useEffect(() => {
    if (preview.sanitized !== lastSanitized.current) {
      lastSanitized.current = preview.sanitized;
      onSanitizedChange?.(preview.sanitized);
    }
  }, [preview.sanitized, onSanitizedChange]);

  const handleRemoveToken = useCallback(
    (raw: string, category: SpanCategory) => {
      setSession((s) => suppressToken(s, raw, category));
    },
    []
  );

  const handleRename = useCallback((oldValue: string) => {
    const next = window.prompt(`Rename token "${oldValue}" to:`, oldValue);
    if (!next || next === oldValue) return;
    setSession((s) => renameToken(s, oldValue, next));
  }, []);

  /**
   * Lets the attorney right-click (or double-click) an un-tokenized word
   * to mark it confidential. We capture the selection from the rendered
   * sanitized preview and feed it back as a manual span.
   */
  const handleManualRedact = useCallback(() => {
    const selection = window.getSelection?.();
    const text = selection?.toString().trim();
    if (!text) return;
    // Find the selection in rawText. Use the first match — attorney can
    // repeat for each occurrence.
    const start = rawText.indexOf(text);
    if (start < 0) return;
    setSession((s) => addManualToken(s, start, start + text.length, text, 'name'));
  }, [rawText]);

  if (!rawText.trim()) {
    return (
      <div className={`rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 ${compact ? '' : 'mt-2'}`}>
        Start typing — the sanitized preview will appear here. Client-identifying facts are tokenized
        before any network request.
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border border-slate-200 bg-white ${compact ? 'p-2 text-xs' : 'p-3 text-sm'}`}
      data-testid="sanitized-preview"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-slate-700">Sanitized preview</span>
        <button
          type="button"
          onClick={handleManualRedact}
          className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
          title="Select text in the preview then click to tokenize it"
        >
          + Redact selection
        </button>
      </div>

      <div
        className="whitespace-pre-wrap break-words rounded bg-slate-50 p-2 font-mono leading-relaxed"
        data-testid="sanitized-text"
      >
        {preview.segments.length === 0
          ? rawText
          : preview.segments.map((seg, i) =>
              seg.token ? (
                <span
                  key={`${i}-${seg.token.value}`}
                  className={`mx-0.5 rounded border px-1 ${CATEGORY_COLORS[seg.token.category]}`}
                  title={`${seg.token.raw} → ${seg.token.value}`}
                >
                  {seg.token.value}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
      </div>

      {preview.tokens.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-slate-600">
            Token map — stays on this computer
          </div>
          <ul className="space-y-1">
            {preview.tokens.map((t) => (
              <li
                key={t.value}
                className={`flex items-center justify-between rounded border px-2 py-1 ${CATEGORY_COLORS[t.category]}`}
              >
                <span className="truncate">
                  <span className="font-mono">{t.value}</span>
                  <span className="mx-2 text-slate-500">→</span>
                  <span>{t.raw}</span>
                </span>
                <span className="ml-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRename(t.value)}
                    title="Rename"
                    className="rounded p-0.5 hover:bg-white/60"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveToken(t.raw, t.category)}
                    title="Un-redact"
                    className="rounded p-0.5 hover:bg-white/60"
                  >
                    <X size={12} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`mt-3 text-xs text-slate-500 ${compact ? 'hidden' : ''}`}>
        This preview is what will be sent over the network. Real names stay on this computer.
      </div>
    </div>
  );
};

export default SanitizedPreview;
