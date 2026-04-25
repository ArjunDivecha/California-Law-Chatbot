/**
 * ComposerPreview — live "what hits the wire" view rendered under the
 * chat composer.
 *
 * Left column: the attorney's raw text with detected spans highlighted.
 * Right column: the same text with each span replaced by its token
 * (CLIENT_001, ADDRESS_001, …). Updates as the attorney types.
 *
 * The preview is read-only at this layer — it shows what *would* happen
 * if you sent the message right now. Editing the token map happens in
 * the TokenStoreModal (open from the SanitizationBanner). Reading
 * detection comes from the same `analyze()` the wire path uses, so
 * what you see is what gets sent.
 *
 * Hidden when the input is empty.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  analyze,
  type Span,
  type SpanCategory,
} from '../api/_shared/sanitization/index.ts';
import { useSanitizer } from '../hooks/useSanitizer';

interface ComposerPreviewProps {
  text: string;
}

const CATEGORY_BG: Record<SpanCategory, string> = {
  name: 'bg-amber-100 text-amber-900',
  street_address: 'bg-sky-100 text-sky-900',
  zip: 'bg-sky-100 text-sky-900',
  phone: 'bg-emerald-100 text-emerald-900',
  email: 'bg-emerald-100 text-emerald-900',
  ssn: 'bg-rose-100 text-rose-900',
  tin: 'bg-rose-100 text-rose-900',
  driver_license: 'bg-rose-100 text-rose-900',
  credit_card: 'bg-rose-100 text-rose-900',
  bank_account: 'bg-rose-100 text-rose-900',
  medical_record: 'bg-rose-100 text-rose-900',
  date: 'bg-violet-100 text-violet-900',
  client_matter: 'bg-slate-200 text-slate-900',
};

interface PreviewSegment {
  type: 'plain' | 'span';
  text: string;
  category?: SpanCategory;
  token?: string;
}

function buildSegments(
  text: string,
  spans: Span[],
  tokenForRaw: (raw: string, category: SpanCategory) => string | undefined
): PreviewSegment[] {
  if (!text) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const segments: PreviewSegment[] = [];
  let cursor = 0;
  for (const s of sorted) {
    if (s.start > cursor) {
      segments.push({ type: 'plain', text: text.slice(cursor, s.start) });
    }
    const raw = text.slice(s.start, s.end);
    const token = tokenForRaw(raw, s.category);
    segments.push({ type: 'span', text: raw, category: s.category, token });
    cursor = s.end;
  }
  if (cursor < text.length) {
    segments.push({ type: 'plain', text: text.slice(cursor) });
  }
  return segments;
}

export const ComposerPreview: React.FC<ComposerPreviewProps> = ({ text }) => {
  const { unlocked, getMap } = useSanitizer();
  const [, setTick] = useState(0);

  // Re-pull the map periodically so that newly assigned tokens (post
  // send-message) appear here on the next render.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const { segments, hasSpans, tokenForRaw } = useMemo(() => {
    const map = unlocked ? getMap() : new Map<string, string>();
    // Build a reverse lookup: lowercased raw → token. Token allocation
    // uses category-prefixed lookup keys, so identical raw strings under
    // different categories map to different tokens — but for display the
    // category is already known per span, so a simple Map suffices in
    // practice (collisions are vanishingly rare and the worst case is a
    // best-effort token preview).
    const byRaw = new Map<string, string>();
    for (const [token, raw] of map) {
      byRaw.set(raw.toLowerCase(), token);
    }
    const tokenForRaw = (raw: string): string | undefined => byRaw.get(raw.toLowerCase());

    const result = analyze(text);
    const segs = buildSegments(text, result.spans, tokenForRaw);
    return { segments: segs, hasSpans: result.spans.length > 0, tokenForRaw };
  }, [text, unlocked, getMap]);

  if (!text.trim()) return null;

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-500">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck size={12} className="text-emerald-600" />
          Sanitization preview
        </span>
        <span>
          {hasSpans
            ? `${segments.filter((s) => s.type === 'span').length} entit${
                segments.filter((s) => s.type === 'span').length === 1 ? 'y' : 'ies'
              } detected`
            : 'No entities detected'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
        <div className="bg-white px-3 py-2 text-sm leading-relaxed">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">You typed</p>
          <p className="whitespace-pre-wrap break-words text-slate-900">
            {segments.length === 0
              ? <span className="text-slate-400">{text}</span>
              : segments.map((seg, i) =>
                  seg.type === 'plain' ? (
                    <React.Fragment key={i}>{seg.text}</React.Fragment>
                  ) : (
                    <span
                      key={i}
                      className={`rounded px-1 ${CATEGORY_BG[seg.category!]}`}
                      title={`${seg.category} → ${seg.token ?? '(token will be assigned on send)'}`}
                    >
                      {seg.text}
                    </span>
                  )
                )}
          </p>
        </div>
        <div className="bg-white px-3 py-2 text-sm leading-relaxed">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Sent to model</p>
          <p className="whitespace-pre-wrap break-words text-slate-900">
            {segments.length === 0 ? (
              <span className="text-slate-400">{text}</span>
            ) : (
              segments.map((seg, i) =>
                seg.type === 'plain' ? (
                  <React.Fragment key={i}>{seg.text}</React.Fragment>
                ) : (
                  <span
                    key={i}
                    className="rounded bg-emerald-50 px-1 font-mono text-xs text-emerald-800"
                    title={seg.token ? `${seg.token} → ${seg.text}` : 'Token assigned on send'}
                  >
                    {seg.token ?? `${seg.category!.toUpperCase()}_???`}
                  </span>
                )
              )
            )}
          </p>
        </div>
      </div>
      {!unlocked && (
        <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
          Sanitization is not unlocked — this preview shows what *would* happen, but the wire payload will go through unmodified until the store opens.
        </p>
      )}
    </div>
  );
};

export default ComposerPreview;
