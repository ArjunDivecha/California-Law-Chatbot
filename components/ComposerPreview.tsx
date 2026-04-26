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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import {
  type Span,
  type SpanCategory,
} from '../api/_shared/sanitization/index.ts';
import { useSanitizer } from '../hooks/useSanitizer';
import { detectPii } from '../services/sanitization/detectionPipeline';

const PREVIEW_DEBOUNCE_MS = 350;

const QUICK_ADD_CATEGORIES: Array<{ value: SpanCategory; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'street_address', label: 'Address' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date' },
  { value: 'client_matter', label: 'Matter' },
];

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

function inferCategoryFromTokenPrefix(token: string): SpanCategory {
  const prefix = token.split('_')[0];
  const map: Record<string, SpanCategory> = {
    CLIENT: 'name',
    ADDRESS: 'street_address',
    PHONE: 'phone',
    EMAIL: 'email',
    DATE: 'date',
    SSN: 'ssn',
    TIN: 'tin',
    LICENSE: 'driver_license',
    CARD: 'credit_card',
    ACCT: 'bank_account',
    MRN: 'medical_record',
    MATTER: 'client_matter',
    ZIP: 'zip',
  };
  return map[prefix] ?? 'name';
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
  const { unlocked, getMap, addEntity, daemonStatus } = useSanitizer();
  const [, setTick] = useState(0);
  const [detectorSpans, setDetectorSpans] = useState<Span[]>([]);
  const [usedOpf, setUsedOpf] = useState<boolean>(false);
  const [detecting, setDetecting] = useState<boolean>(false);
  const [quickAddRaw, setQuickAddRaw] = useState('');
  const [quickAddCat, setQuickAddCat] = useState<SpanCategory>('name');
  const [quickAddBusy, setQuickAddBusy] = useState(false);
  const [quickAddNote, setQuickAddNote] = useState<string | null>(null);

  // Debounced OPF-driven detection. Fires ~350ms after the user pauses
  // typing. Calls detectPii in best-effort mode — when the daemon is
  // healthy we get OPF spans (catches lowercase / mixed-case / addresses);
  // when unreachable we fall back to the heuristic detector silently and
  // mark usedOpf=false so the UI can flag it.
  //
  // Each typing burst cancels the prior in-flight call via the
  // generation counter. Only the latest call's result wins.
  useEffect(() => {
    if (!text || !text.trim()) {
      setDetectorSpans([]);
      setUsedOpf(false);
      setDetecting(false);
      return;
    }
    let cancelled = false;
    setDetecting(true);
    const handle = window.setTimeout(async () => {
      try {
        const result = await detectPii(text, 'best-effort');
        if (cancelled) return;
        setDetectorSpans(result.spans);
        setUsedOpf(result.usedOpf);
      } catch {
        if (cancelled) return;
        setDetectorSpans([]);
        setUsedOpf(false);
      } finally {
        if (!cancelled) setDetecting(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [text]);

  const handleQuickAdd = useCallback(async () => {
    const raw = quickAddRaw.trim();
    if (!raw) return;
    setQuickAddBusy(true);
    setQuickAddNote(null);
    try {
      const token = await addEntity(raw, quickAddCat);
      if (token) {
        setQuickAddNote(`Added: ${raw} → ${token}`);
        setQuickAddRaw('');
        setTick((n) => n + 1);
      } else {
        setQuickAddNote('Sanitization not ready.');
      }
    } catch (err) {
      setQuickAddNote((err as { message?: string })?.message ?? 'Add failed.');
    } finally {
      setQuickAddBusy(false);
    }
  }, [quickAddRaw, quickAddCat, addEntity]);

  // Re-pull the map periodically so that newly assigned tokens (post
  // send-message) appear here on the next render.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const { segments, hasSpans, tokenForRaw } = useMemo(() => {
    const map = unlocked ? getMap() : new Map<string, string>();
    const byRaw = new Map<string, string>();
    for (const [token, raw] of map) {
      byRaw.set(raw.toLowerCase(), token);
    }
    const tokenForRaw = (raw: string): string | undefined => byRaw.get(raw.toLowerCase());

    // Mirror the second pass of tokenize(): overlay literal matches for
    // every entry in the store the detector missed. Longest raws first
    // so multi-word names beat single-word substrings inside them.
    const manualSpans: Span[] = [];
    if (text && map.size > 0) {
      const sortedRaws = Array.from(map.entries()).sort(
        ([, a], [, b]) => b.length - a.length
      );
      const lower = text.toLowerCase();
      const occupied = new Set<number>();
      for (const s of detectorSpans) {
        for (let i = s.start; i < s.end; i++) occupied.add(i);
      }
      for (const [token, raw] of sortedRaws) {
        if (!raw) continue;
        const needle = raw.toLowerCase();
        let idx = 0;
        while ((idx = lower.indexOf(needle, idx)) !== -1) {
          const before = idx === 0 ? '' : text[idx - 1];
          const after = idx + needle.length >= text.length ? '' : text[idx + needle.length];
          const wordLeft = !before || /\W/.test(before);
          const wordRight = !after || /\W/.test(after);
          if (wordLeft && wordRight) {
            // Skip if any character in this range is already covered.
            let collides = false;
            for (let k = idx; k < idx + needle.length; k++) {
              if (occupied.has(k)) { collides = true; break; }
            }
            if (!collides) {
              const category = inferCategoryFromTokenPrefix(token);
              manualSpans.push({
                start: idx,
                end: idx + needle.length,
                category,
                raw: text.slice(idx, idx + needle.length),
                label: 'manual_store',
              });
              for (let k = idx; k < idx + needle.length; k++) occupied.add(k);
            }
          }
          idx += needle.length;
        }
      }
    }

    const allSpans = [...detectorSpans, ...manualSpans].sort(
      (a, b) => a.start - b.start
    );
    const segs = buildSegments(text, allSpans, tokenForRaw);
    return { segments: segs, hasSpans: allSpans.length > 0, tokenForRaw };
  }, [text, unlocked, getMap, detectorSpans]);

  if (!text.trim()) return null;

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-500">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck size={12} className={usedOpf ? 'text-emerald-600' : 'text-amber-500'} />
          Sanitization preview
          {detecting ? (
            <span className="text-slate-400 normal-case tracking-normal">· detecting…</span>
          ) : usedOpf ? (
            <span className="text-emerald-700 normal-case tracking-normal">· OPF</span>
          ) : daemonStatus.state === 'unreachable' ? (
            <span className="text-amber-700 normal-case tracking-normal">· fallback (OPF unreachable)</span>
          ) : (
            <span className="text-slate-400 normal-case tracking-normal">· heuristic</span>
          )}
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
      {unlocked && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
            Detector missed something? Add it to the token store
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={quickAddRaw}
              onChange={(e) => setQuickAddRaw(e.target.value)}
              placeholder="Exact text to tokenize (e.g. james donde)"
              className="min-w-[10rem] flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              disabled={quickAddBusy}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleQuickAdd();
                }
              }}
            />
            <select
              value={quickAddCat}
              onChange={(e) => setQuickAddCat(e.target.value as SpanCategory)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
              disabled={quickAddBusy}
            >
              {QUICK_ADD_CATEGORIES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleQuickAdd()}
              disabled={quickAddBusy || !quickAddRaw.trim()}
              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {quickAddNote && (
            <p className="mt-1 text-[11px] text-emerald-700">{quickAddNote}</p>
          )}
        </div>
      )}
      {!unlocked && (
        <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
          Sanitization is not unlocked — this preview shows what *would* happen, but the wire payload will go through unmodified until the store opens.
        </p>
      )}
    </div>
  );
};

export default ComposerPreview;
