/**
 * V2 client-side sanitization preview. Wraps services/sanitization/
 * previewSession.computePreview with React state + a 300ms debounce on
 * the text input. Calls the GLiNER daemon (same detector as the on-send
 * tokenization path) so the preview is accurate, not just heuristic.
 * Falls back to the lightweight regex+heuristic path if the daemon is
 * unreachable.
 *
 * Returns:
 *   - preview      — segments + tokens + sanitized + categoryCounts
 *   - isComputing  — true between the input change and the debounce fire
 *   - hasDetections — convenience boolean (tokens.length > 0)
 *
 * The preview is *informational* (per the 7th addendum dropping the
 * web_search gate). The chip and span list let the attorney SEE what
 * the sanitizer found, but neither this hook nor anything downstream
 * blocks submission.
 *
 * Detector parity (Phase C.2 follow-up 2026-05-15): the preview now
 * uses GLiNER too. Previously this hook ran only the regex+heuristic
 * analyze() — fast enough for keystroke debouncing but missed
 * lowercase names ("john smith") and slightly-misspelled addresses
 * that GLiNER catches. GLiNER's 45 ms steady-state is comfortably
 * under the 300 ms debounce window.
 */

import { useEffect, useRef, useState } from 'react';
import {
  computePreview,
  emptyPreviewSession,
  type PreviewData,
  type PreviewSessionState,
} from '../services/sanitization/previewSession.ts';
import { detectSpans } from '../services/sanitization/opfClient.ts';
import {
  getUserAllowlistLower,
  subscribeToUserAllowlist,
} from '../services/sanitization/userAllowlist.ts';
import {
  findUserDenylistSpans,
  subscribeToUserDenylist,
} from '../services/sanitization/userDenylist.ts';
import type { Span } from '../api/_shared/sanitization/index.ts';

export type { PreviewData };

const EMPTY: PreviewData = {
  segments: [],
  tokens: [],
  sanitized: '',
  categoryCounts: {},
};

const DEBOUNCE_MS = 300;

export function useV2SanitizationPreview(text: string): {
  preview: PreviewData;
  isComputing: boolean;
  hasDetections: boolean;
} {
  const [preview, setPreview] = useState<PreviewData>(EMPTY);
  const [isComputing, setIsComputing] = useState(false);
  // Preview session state — keep across keystrokes so that repeated
  // mentions of the same entity get the same CLIENT_001 token. Reset
  // only when the input clears to empty (a fresh turn).
  const sessionRef = useRef<PreviewSessionState>(emptyPreviewSession());
  // Last-fire timestamp so we discard stale daemon responses that
  // arrive after a newer keystroke.
  const lastFireRef = useRef<number>(0);
  // Bumped whenever the user allowlist changes so the preview recomputes
  // and dismissed (allowlisted) terms disappear from the chips/banner
  // immediately. Same-tab edits dispatch a CustomEvent; cross-tab edits
  // fire a StorageEvent — subscribeToUserAllowlist handles both.
  const [allowlistVersion, setAllowlistVersion] = useState(0);
  useEffect(
    () => subscribeToUserAllowlist(() => setAllowlistVersion((v) => v + 1)),
    []
  );
  // Same recompute trigger for the "always privileged" denylist.
  useEffect(
    () => subscribeToUserDenylist(() => setAllowlistVersion((v) => v + 1)),
    []
  );

  useEffect(() => {
    if (!text || text.length === 0) {
      sessionRef.current = emptyPreviewSession();
      setPreview(EMPTY);
      setIsComputing(false);
      return;
    }
    setIsComputing(true);
    const ts = ++lastFireRef.current;
    const t = setTimeout(async () => {
      let glinerSpans: Span[] = [];
      try {
        const result = await detectSpans(text);
        glinerSpans = result.spans;
      } catch {
        // Daemon unreachable — fall back to the heuristic-only path
        // (existing analyze() in computePreview). The preview will
        // miss some cases (single-word lowercase names) but the
        // on-send tokenization tries the daemon again and may succeed
        // or fail-closed. Important: do NOT silently send raw — the
        // failure-closed behavior is on the SEND path, not here.
        glinerSpans = [];
      }
      // Drop if a newer keystroke has fired since.
      if (ts !== lastFireRef.current) return;
      // Pass the per-device user allowlist so computePreview drops any
      // term the attorney marked "not private" — applied to the combined
      // heuristic + GLiNER span set (analyze() can re-detect a term we'd
      // otherwise filter only out of the GLiNER spans). Mirrors the
      // wire-path suppression in detectPii so the preview matches what
      // actually gets sent.
      const allow = getUserAllowlistLower();
      // "Always privileged" terms are force-detected regardless of what
      // the ML detector found — mirrors the wire path in detectPii.
      const denySpans = findUserDenylistSpans(text);
      try {
        const next = computePreview(
          text,
          sessionRef.current,
          [...glinerSpans, ...denySpans],
          allow
        );
        setPreview(next);
      } catch {
        setPreview(EMPTY);
      } finally {
        setIsComputing(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
    };
  }, [text, allowlistVersion]);

  return {
    preview,
    isComputing,
    hasDetections: preview.tokens.length > 0,
  };
}
