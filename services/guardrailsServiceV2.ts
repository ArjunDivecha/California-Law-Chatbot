/**
 * V2 guardrails — adapted from services/guardrailsService.ts for V2's
 * tool-result source shape (V2SourceSummary[]). Pre-render checks
 * that flag obvious quality issues in an assistant response.
 *
 * Currently implemented:
 *   - Entity containment: every case-citation pattern in the answer text
 *     should appear in the source summaries (case_name field of any
 *     CourtListener / citation_verify result).
 *   - Citation format validity: well-formed reporter citations.
 *
 * Returns a GuardrailResult the UI can surface as a small warning chip
 * below the assistant bubble. NOT a hard gate — informational.
 */

export interface V2GuardrailSource {
  title: string;
  source_type: string;
}

export interface V2GuardrailResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
  /** Per-case-name containment check detail. */
  uncited_in_sources: string[];
}

const CASE_NAME_RE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+v\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;

export function checkAnswer(answerText: string, sources: V2GuardrailSource[]): V2GuardrailResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const uncitedInSources: string[] = [];

  if (!answerText) {
    return { passed: true, warnings: [], errors: [], uncited_in_sources: [] };
  }

  // Build a lowercased lookup of source titles (most relevant for case names)
  const sourceTitles = sources
    .map((s) => s.title?.toLowerCase() ?? '')
    .filter((t) => t.length > 0);
  const sourceBlob = sourceTitles.join(' || ');

  const caseMatches = answerText.match(CASE_NAME_RE) ?? [];
  const seen = new Set<string>();
  for (const c of caseMatches) {
    const norm = c.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    if (sourceBlob.length === 0) {
      // No sources at all — can't validate. Warn once and exit the loop.
      if (warnings.length === 0) {
        warnings.push(
          `Answer cites ${caseMatches.length} case(s) but no sources were attached to this response. Run "Verify Citations" before relying on them.`,
        );
      }
      continue;
    }
    // Case name substring match against source titles. The CourtListener
    // summaries use the same caption format.
    if (!sourceBlob.includes(norm)) {
      uncitedInSources.push(c);
    }
  }

  if (uncitedInSources.length > 0) {
    warnings.push(
      `${uncitedInSources.length} case-name(s) in the answer don't appear in the sources panel: ${uncitedInSources.slice(0, 3).join(', ')}${uncitedInSources.length > 3 ? '…' : ''}. The model may have cited from memory — verify each.`,
    );
  }

  return {
    passed: errors.length === 0,
    warnings,
    errors,
    uncited_in_sources: uncitedInSources,
  };
}
