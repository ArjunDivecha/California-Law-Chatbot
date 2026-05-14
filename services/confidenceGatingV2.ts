/**
 * V2 confidence gating — adapted from services/confidenceGating.ts for
 * V2's verifier-verdict shape. Aggregates per-citation verdicts into a
 * single confidence assessment so the UI can show a "Quality" indicator
 * and optionally gate the answer.
 *
 * Inputs: list of V2 verifier verdicts (from useV2VerifyStream / verify-
 * stream endpoint). Each verdict has status ('real' | 'fake' | 'error')
 * and confidence (0..1).
 *
 * Output: { level: 'high' | 'medium' | 'low' | 'fail', caveat, score }
 *   - high  : all real, mean confidence ≥ 0.85
 *   - medium: all real, mean confidence 0.65..0.85
 *   - low   : ≤1 fake, mean confidence < 0.65
 *   - fail  : ≥2 fake citations, or fake-rate > 30%
 *
 * Used by V2DraftPage's VerificationPanel to surface a top-level summary
 * and by V2ChatPage's source panel to flag responses with low-confidence
 * sourcing.
 */

export interface V2VerdictInput {
  status: 'real' | 'fake' | 'error' | 'pending' | string;
  confidence?: number;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'fail';

export interface ConfidenceGateResult {
  level: ConfidenceLevel;
  /** Mean confidence across non-error verdicts; null if no signal. */
  score: number | null;
  /** Human-readable caveat the UI can surface near the response. */
  caveat: string;
  /** Counts for the UI. */
  counts: {
    total: number;
    real: number;
    fake: number;
    error: number;
  };
}

export function gateOnVerdicts(verdicts: V2VerdictInput[]): ConfidenceGateResult {
  const counts = {
    total: verdicts.length,
    real: verdicts.filter((v) => v.status === 'real').length,
    fake: verdicts.filter((v) => v.status === 'fake').length,
    error: verdicts.filter((v) => v.status === 'error').length,
  };
  if (counts.total === 0) {
    return {
      level: 'low',
      score: null,
      caveat: 'No citations to verify — confidence is based on the model alone.',
      counts,
    };
  }
  const fakeRate = counts.fake / counts.total;
  // Hard fail: ≥2 fakes OR >30% fake rate.
  if (counts.fake >= 2 || fakeRate > 0.3) {
    return {
      level: 'fail',
      score: null,
      caveat: `${counts.fake} of ${counts.total} citations could not be verified. Treat this response as unreliable until you confirm each cite.`,
      counts,
    };
  }
  const usable = verdicts.filter((v) => v.status === 'real' && typeof v.confidence === 'number');
  const meanConf =
    usable.length > 0
      ? usable.reduce((s, v) => s + (v.confidence ?? 0), 0) / usable.length
      : 0;
  if (counts.fake === 0 && meanConf >= 0.85) {
    return {
      level: 'high',
      score: meanConf,
      caveat: 'All citations verified with high confidence.',
      counts,
    };
  }
  if (counts.fake === 0 && meanConf >= 0.65) {
    return {
      level: 'medium',
      score: meanConf,
      caveat: `All ${counts.total} citations verified, but ${usable.length - usable.filter((v) => (v.confidence ?? 0) >= 0.85).length} at moderate confidence. Spot-check the lower-confidence ones.`,
      counts,
    };
  }
  return {
    level: 'low',
    score: meanConf || null,
    caveat:
      counts.fake === 1
        ? `1 citation could not be verified${meanConf ? `; mean confidence ${meanConf.toFixed(2)} on the rest` : ''}. Review carefully.`
        : `Low-confidence verification (mean ${meanConf.toFixed(2)}). Spot-check the cites before relying on this response.`,
    counts,
  };
}
