/**
 * =============================================================================
 * Draft citation-QC SSE client — hooks/useV2DraftQC.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   Client half of the automatic QC loop (see api/agent/draft-qc.ts).
 *   Given the draft's editable sections, it tokenizes every section body
 *   on-device (sections hold REHYDRATED client text — raw names must never
 *   leave the machine), wire-guards the assembled body, streams the
 *   verifier's per-citation verdicts, and exposes a progressive per-section
 *   map: pending → verifying → clean | flagged | no_citations.
 *
 *   Verdict text (citation/reasoning) is rehydrated on receipt so any
 *   echoed @@TOKEN@@ placeholders render as real names on-device only.
 *
 * INPUT FILES:  none (browser module).
 * OUTPUT FILES: none.
 * =============================================================================
 */

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  getChatSanitizer,
  tokenizeForWire,
} from '../services/sanitization/chatAdapter';
import { assertNoRawPii } from '../services/sanitization/wireGuard';
import { getUserAllowlist } from '../services/sanitization/userAllowlist';

export interface QcIssue {
  citation: string;
  citation_type: 'case' | 'statute';
  status: 'fake' | 'ambiguous' | 'error';
  confidence?: number;
  reasoning?: string;
  case_name?: string;
  match_url?: string;
}

export type QcSectionStatus =
  | 'pending'
  | 'verifying'
  | 'clean'
  | 'flagged'
  | 'no_citations';

export interface QcSectionResult {
  status: QcSectionStatus;
  citation_count: number;
  verdicts_in: number;
  issues: QcIssue[];
}

export interface QcSummary {
  verified: number;
  fake: number;
  ambiguous: number;
  errors: number;
  total: number;
  skipped: number;
  elapsed_ms: number;
}

export interface DraftQcState {
  isRunning: boolean;
  perSection: Record<string, QcSectionResult>;
  summary: QcSummary | null;
  error: string | null;
  /** ISO timestamp of the last completed run (null until one finishes). */
  completedAt: string | null;
}

const INITIAL: DraftQcState = {
  isRunning: false,
  perSection: {},
  summary: null,
  error: null,
  completedAt: null,
};

export interface QcSectionInput {
  section_id: string;
  title: string;
  text: string;
}

export function useV2DraftQC() {
  const [state, setState] = useState<DraftQcState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const { getToken } = useAuth();

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, isRunning: false }));
  }, []);

  /**
   * Run QC over `sections`. When `merge` is true, existing per-section
   * results for sections NOT in this run are kept (used for single-section
   * re-verification after a fix); otherwise state is replaced.
   */
  const run = useCallback(
    async (sessionId: string, sections: QcSectionInput[], merge = false): Promise<void> => {
      const targets = sections.filter((s) => s.text.trim().length > 0);
      if (targets.length === 0) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setState((s) => ({
        isRunning: true,
        error: null,
        summary: merge ? s.summary : null,
        completedAt: s.completedAt,
        perSection: {
          ...(merge ? s.perSection : {}),
          ...Object.fromEntries(
            targets.map((t) => [
              t.section_id,
              { status: 'pending', citation_count: 0, verdicts_in: 0, issues: [] } as QcSectionResult,
            ]),
          ),
        },
      }));

      // On-device tokenization gate — QC section bodies carry client text.
      let wireSections: Array<{ section_id: string; title: string; text: string }>;
      try {
        wireSections = [];
        for (const t of targets) {
          const wire = await tokenizeForWire(t.text);
          wireSections.push({ section_id: t.section_id, title: t.title, text: wire.sanitized });
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          isRunning: false,
          error: `Sanitization failed: ${(err as Error).message}. QC was blocked to prevent raw client text from leaving the device.`,
        }));
        return;
      }
      const body = {
        session_id: sessionId,
        sections: wireSections,
        user_allowlist: getUserAllowlist(),
      };
      try {
        assertNoRawPii(body);
      } catch (err) {
        setState((s) => ({ ...s, isRunning: false, error: (err as Error).message }));
        return;
      }

      const token = await getToken().catch(() => null);
      let resp: Response;
      try {
        resp = await fetch('/api/agent/draft-qc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState((s) => ({ ...s, isRunning: false, error: (err as Error).message }));
        return;
      }
      if (!resp.ok || !resp.body) {
        setState((s) => ({ ...s, isRunning: false, error: `QC request failed: HTTP ${resp.status}` }));
        return;
      }

      const sanitizer = getChatSanitizer();
      const rehydrate = (v: unknown): string | undefined =>
        typeof v === 'string' ? sanitizer.rehydrateMessage(v) : undefined;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep = buffer.indexOf('\n\n');
          while (sep !== -1) {
            const raw = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            sep = buffer.indexOf('\n\n');
            if (!raw.trim()) continue;
            let kind = '';
            const dataLines: string[] = [];
            for (const line of raw.split('\n')) {
              if (line.startsWith('event:')) kind = line.slice(6).trim();
              else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
            }
            if (!kind || dataLines.length === 0) continue;
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
            } catch {
              continue;
            }
            if (kind === 'manifest') {
              const counts = (data.sections as Array<{ section_id: string; citation_count: number }>) ?? [];
              setState((s) => {
                const per = { ...s.perSection };
                for (const c of counts) {
                  const cur = per[c.section_id];
                  if (!cur) continue;
                  per[c.section_id] = {
                    ...cur,
                    citation_count: c.citation_count,
                    status: c.citation_count === 0 ? 'no_citations' : 'verifying',
                  };
                }
                return { ...s, perSection: per };
              });
            } else if (kind === 'verdict') {
              const sid = String(data.section_id ?? '');
              const status = String(data.status ?? '');
              setState((s) => {
                const cur = s.perSection[sid];
                if (!cur) return s;
                const issues =
                  status === 'fake' || status === 'ambiguous' || status === 'error'
                    ? [
                        ...cur.issues,
                        {
                          citation: rehydrate(data.citation) ?? String(data.citation ?? ''),
                          citation_type: (data.citation_type as 'case' | 'statute') ?? 'case',
                          status: status as QcIssue['status'],
                          confidence: data.confidence as number | undefined,
                          reasoning: rehydrate(data.reasoning),
                          case_name: rehydrate(data.case_name),
                          match_url: data.match_url as string | undefined,
                        },
                      ]
                    : cur.issues;
                return {
                  ...s,
                  perSection: {
                    ...s.perSection,
                    [sid]: { ...cur, verdicts_in: cur.verdicts_in + 1, issues },
                  },
                };
              });
            } else if (kind === 'summary') {
              const sectionStatuses =
                (data.sections as Array<{ section_id: string; status: string; issue_count: number }>) ?? [];
              setState((s) => {
                const per = { ...s.perSection };
                for (const sec of sectionStatuses) {
                  const cur = per[sec.section_id];
                  if (!cur) continue;
                  per[sec.section_id] = {
                    ...cur,
                    status: (sec.status as QcSectionStatus) ?? cur.status,
                  };
                }
                return {
                  ...s,
                  perSection: per,
                  isRunning: false,
                  completedAt: new Date().toISOString(),
                  summary: {
                    verified: Number(data.verified ?? 0),
                    fake: Number(data.fake ?? 0),
                    ambiguous: Number(data.ambiguous ?? 0),
                    errors: Number(data.errors ?? 0),
                    total: Number(data.total ?? 0),
                    skipped: Number(data.skipped ?? 0),
                    elapsed_ms: Number(data.elapsed_ms ?? 0),
                  },
                };
              });
            } else if (kind === 'error') {
              setState((s) => ({
                ...s,
                isRunning: false,
                error: String(data.message ?? 'QC stream error'),
              }));
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setState((s) => ({ ...s, isRunning: false, error: (err as Error).message }));
        }
      } finally {
        setState((s) => (s.isRunning ? { ...s, isRunning: false } : s));
        abortRef.current = null;
      }
    },
    [getToken],
  );

  return { state, run, cancel, reset };
}
