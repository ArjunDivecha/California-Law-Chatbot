/**
 * Preview Session — ephemeral token assignments for the live preview UI.
 *
 * The persistent token store (api/_shared/sanitization/store.ts) is the
 * durable source of truth for tokens across sessions. But while the
 * attorney is typing, we need *immediate* feedback without hitting
 * IndexedDB for every keystroke. This module holds a pure, in-memory
 * map for the preview component, derived from the current input text
 * each render.
 *
 * Day 7 will replace the ephemeral counter with lookups against the
 * unlocked persistent store. Until then, the preview is visually
 * complete but the tokens re-start at _001 every mount.
 */

import { analyze, type Span, type SpanCategory } from '../../api/_shared/sanitization/index.ts';
import { overlapsAllowlist, findAllowlistMatches } from '../../api/_shared/sanitization/allowlist.ts';

const TOKEN_PREFIX: Record<SpanCategory, string> = {
  name: 'CLIENT',
  ssn: 'SSN',
  tin: 'TIN',
  phone: 'PHONE',
  email: 'EMAIL',
  street_address: 'ADDRESS',
  zip: 'ZIP',
  date: 'DATE',
  credit_card: 'CARD',
  bank_account: 'ACCT',
  driver_license: 'LICENSE',
  medical_record: 'MRN',
  client_matter: 'MATTER',
};

export interface PreviewSegment {
  /** Text to render verbatim. */
  text: string;
  /** When set, this segment is a tokenized span — the UI should highlight it. */
  token?: {
    value: string;
    category: SpanCategory;
    /** Original raw text (for the un-redact action). */
    raw: string;
  };
}

export interface PreviewData {
  /** The interleaved segments — render in order. */
  segments: PreviewSegment[];
  /** Unique token list for the side panel. */
  tokens: Array<{ value: string; category: SpanCategory; raw: string }>;
  /** The sanitized string that would be submitted right now. */
  sanitized: string;
  /** Aggregate counts by category, for optional telemetry. */
  categoryCounts: Partial<Record<SpanCategory, number>>;
}

export interface PreviewSessionState {
  /**
   * Map of `${category}:${raw.toLowerCase()}` → stable token value for the
   * lifetime of this preview session. Survives edits to the raw text so
   * repeated mentions of the same entity share one token, exactly like
   * the persistent store does.
   */
  assigned: Map<string, { value: string; category: SpanCategory; raw: string }>;
  /** Category counters for allocating new token numbers. */
  counters: Partial<Record<SpanCategory, number>>;
  /** Spans the attorney manually *removed* — text here must not re-tokenize. */
  suppressed: Set<string>;
  /** Spans the attorney manually *added* (non-detected text they clicked). */
  manual: Array<{ start: number; end: number; category: SpanCategory; raw: string }>;
}

export function emptyPreviewSession(): PreviewSessionState {
  return {
    assigned: new Map(),
    counters: {},
    suppressed: new Set(),
    manual: [],
  };
}

function assignmentKey(category: SpanCategory, raw: string): string {
  return `${category}:${raw.trim().toLowerCase()}`;
}

function allocateToken(
  state: PreviewSessionState,
  category: SpanCategory,
  raw: string
): { value: string; category: SpanCategory; raw: string } {
  const key = assignmentKey(category, raw);
  const existing = state.assigned.get(key);
  if (existing) return existing;
  const next = (state.counters[category] ?? 0) + 1;
  state.counters[category] = next;
  const value = `${TOKEN_PREFIX[category]}_${String(next).padStart(3, '0')}`;
  const token = { value, category, raw };
  state.assigned.set(key, token);
  return token;
}

// ---------------------------------------------------------------------------
// Edit actions — pure functions returning a new state
// ---------------------------------------------------------------------------

/** Attorney clicked "un-redact" on a tokenized span. */
export function suppressToken(
  state: PreviewSessionState,
  raw: string,
  category: SpanCategory
): PreviewSessionState {
  const next = cloneState(state);
  next.suppressed.add(assignmentKey(category, raw));
  next.assigned.delete(assignmentKey(category, raw));
  return next;
}

/** Attorney selected a plain-text range and clicked "redact this". */
export function addManualToken(
  state: PreviewSessionState,
  start: number,
  end: number,
  raw: string,
  category: SpanCategory = 'name'
): PreviewSessionState {
  const next = cloneState(state);
  // Unsuppress if previously removed — the attorney changed their mind.
  next.suppressed.delete(assignmentKey(category, raw));
  next.manual.push({ start, end, category, raw });
  return next;
}

/** Attorney renamed a pseudonym (e.g. CLIENT_001 → ELDER). */
export function renameToken(
  state: PreviewSessionState,
  oldValue: string,
  newValue: string
): PreviewSessionState {
  if (!newValue || oldValue === newValue) return state;
  const next = cloneState(state);
  for (const [key, tok] of next.assigned.entries()) {
    if (tok.value === oldValue) {
      next.assigned.set(key, { ...tok, value: newValue });
    }
  }
  return next;
}

function cloneState(state: PreviewSessionState): PreviewSessionState {
  return {
    assigned: new Map(state.assigned),
    counters: { ...state.counters },
    suppressed: new Set(state.suppressed),
    manual: [...state.manual],
  };
}

// ---------------------------------------------------------------------------
// Compute — pure function that turns (rawText + state) into PreviewData
// ---------------------------------------------------------------------------

export function computePreview(rawText: string, state: PreviewSessionState): PreviewData {
  if (!rawText || typeof rawText !== 'string') {
    return { segments: [], tokens: [], sanitized: '', categoryCounts: {} };
  }

  const { spans } = analyze(rawText);

  // Merge in the manual redactions. They may overlap allowlist or not — we
  // trust the attorney's explicit choice over the allowlist in that case.
  const allowlistHits = findAllowlistMatches(rawText);
  const combined: Span[] = [];
  for (const s of spans) {
    const key = assignmentKey(s.category, s.raw);
    if (state.suppressed.has(key)) continue;
    combined.push(s);
  }
  for (const m of state.manual) {
    // Manual tokenization wins over allowlist — the attorney knows their client.
    if (m.end > m.start) {
      combined.push({
        start: m.start,
        end: m.end,
        category: m.category,
        raw: m.raw,
        label: 'manual',
      });
    }
  }

  // De-overlap: longest wins at overlap, ties broken by earliest start.
  combined.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });
  const kept: Span[] = [];
  for (const s of combined) {
    const last = kept[kept.length - 1];
    if (!last || s.start >= last.end) kept.push(s);
    else if (s.end - s.start > last.end - last.start) kept[kept.length - 1] = s;
  }

  // Allocate tokens on the caller's own state object. Token assignments
  // persist across subsequent computePreview calls so renames and repeat
  // mentions resolve to the same CLIENT_001. React still sees state
  // changes on edits (suppress/addManual/rename) via new references from
  // those helpers.
  const working = state;

  const segments: PreviewSegment[] = [];
  const tokenSet = new Map<string, { value: string; category: SpanCategory; raw: string }>();
  const categoryCounts: Partial<Record<SpanCategory, number>> = {};
  let cursor = 0;
  const parts: string[] = [];

  for (const s of kept) {
    // If the span overlaps an allowlist hit AND it wasn't a manual addition,
    // skip it — public-legal entities must stay intact.
    const isManual = state.manual.some(
      (m) => m.start === s.start && m.end === s.end && m.category === s.category
    );
    if (!isManual && overlapsAllowlist(s.start, s.end, allowlistHits)) {
      continue;
    }

    const token = allocateToken(working, s.category, s.raw);
    const leading = rawText.slice(cursor, s.start);
    if (leading) segments.push({ text: leading });
    segments.push({ text: s.raw, token });
    parts.push(leading, token.value);
    tokenSet.set(token.value, token);
    categoryCounts[s.category] = (categoryCounts[s.category] ?? 0) + 1;
    cursor = s.end;
  }
  const trailing = rawText.slice(cursor);
  if (trailing) {
    segments.push({ text: trailing });
    parts.push(trailing);
  }

  return {
    segments,
    tokens: Array.from(tokenSet.values()),
    sanitized: parts.join(''),
    categoryCounts,
  };
}
