/**
 * V2 client-side sanitization preview. Wraps services/sanitization/
 * previewSession.computePreview with React state + a 300ms debounce on
 * the text input. Runs the SAME detector that gates server-side
 * (api/_shared/sanitization/analyze) — no network round-trip; the
 * detector is pure JS that runs in the browser.
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
 */

import { useEffect, useRef, useState } from 'react';
import {
  computePreview,
  emptyPreviewSession,
  type PreviewData,
  type PreviewSessionState,
} from '../services/sanitization/previewSession.ts';

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

  useEffect(() => {
    if (!text || text.length === 0) {
      sessionRef.current = emptyPreviewSession();
      setPreview(EMPTY);
      setIsComputing(false);
      return;
    }
    setIsComputing(true);
    const t = setTimeout(() => {
      try {
        const next = computePreview(text, sessionRef.current);
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
  }, [text]);

  return {
    preview,
    isComputing,
    hasDetections: preview.tokens.length > 0,
  };
}
