/**
 * V2 verify page — paste-a-passage citation verifier UI (DancingElephant
 * artboard 05 / 08b). The verify-stream endpoint (api/agent/verify-stream.ts)
 * streams per-citation verdicts for any pasted text; this page renders the
 * two-pane "Passage to verify" / "Verdicts" layout with the DancingElephant
 * teal/violet/amber verdict styling.
 *
 * All verification logic (streaming hook, verdict data, CiteLaw billing/cache
 * summary) is unchanged from the prior implementation — this file only
 * restyles the presentation layer and maps internal verdict statuses
 * (real / fake / ambiguous / pending / error) to display copy
 * (Verified / Contradicted / Verify manually).
 */

import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { useV2VerifyStream, type V2Verdict } from '../../hooks/useV2VerifyStream.ts';
import { V2SanitizationChip } from './V2SanitizationChip';

export const V2VerifyPage: React.FC = () => {
  const [text, setText] = useState('');
  const { state, verify, reset } = useV2VerifyStream();
  const placeholder =
    'Paste any passage of legal text here (a memo, draft, brief — anything) and click Verify. ' +
    'Every case citation is identity-checked against CiteLaw and CourtListener, and every statute/regulation cite ' +
    '(CA codes, U.S.C., C.F.R.) against the official code, by an adversarial sub-agent; ' +
    'each verdict is Verified / Contradicted / Verify manually with the model\'s reasoning.';

  const onVerify = useCallback(() => {
    if (!text.trim()) return;
    void verify(text);
  }, [text, verify]);

  return (
    <div className="flex flex-col h-screen bg-surface-app font-sans">
      <header className="bg-white border-b border-surface-line2 px-6 py-3.5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-[30px] h-[30px] rounded-lg overflow-hidden shrink-0">
              <img src="/dancingelephant.png" alt="DancingElephant" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-ink">Verify citations</h1>
              <p className="text-xs text-ink-muted">
                Every cite checked against the official record — an elephant never fabricates.
              </p>
            </div>
          </div>
          <Link to="/v2" className="text-[13px] font-medium text-brand hover:text-brand-deep">
            ← Back to chat
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-5xl flex flex-col px-6 py-6 overflow-y-auto">
          <div className="flex flex-col lg:flex-row gap-6">
            <section className="flex-1 rounded-xl border border-surface-line bg-white p-5 flex flex-col">
              <h2 className="text-sm font-semibold text-ink mb-3">Passage to verify</h2>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                rows={16}
                className="w-full flex-1 resize-y rounded-[10px] border border-surface-line3 px-3.5 py-3 text-[12.5px] leading-[1.7] font-mono text-ink-secondary focus:border-brand focus:outline-none"
                disabled={state.isStreaming}
              />
              <div className="mt-3">
                <V2SanitizationChip text={text} />
              </div>
              <div className="mt-4 flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={onVerify}
                  disabled={state.isStreaming || !text.trim()}
                  className="rounded-[10px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-surface-disabled disabled:text-ink-faint"
                >
                  {state.isStreaming ? 'Verifying…' : 'Verify citations'}
                </button>
                <span className="text-xs text-ink-faint">About 18 s per citation</span>
                {(state.done || state.isStreaming) && (
                  <button
                    type="button"
                    onClick={() => {
                      reset();
                      setText('');
                    }}
                    className="text-xs font-medium text-brand hover:text-brand-deep hover:underline"
                    disabled={state.isStreaming}
                  >
                    Clear
                  </button>
                )}
              </div>
            </section>

            <section className="flex-1 rounded-xl border border-surface-line bg-white p-5 flex flex-col gap-2.5 min-h-[400px]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Verdicts</h2>
                {state.done && (
                  <span className="text-xs text-ink-faint">
                    {Math.round(state.done.elapsed_ms / 1000)} s elapsed
                  </span>
                )}
              </div>
              <div className="de-rule opacity-60" />

              {!state.manifest && !state.isStreaming && (
                <p className="text-xs text-ink-muted">Paste a passage and click Verify.</p>
              )}
              {state.manifest && state.manifest.length === 0 && (
                <p className="text-xs text-ink-muted">No case or statute citations found in the passage.</p>
              )}

              {state.done && (
                <div className="flex gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-deteal-line bg-deteal-bg px-3 py-1 text-xs font-semibold text-deteal-text">
                    {state.done.verified} verified
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-dered-line bg-dered-bg px-3 py-1 text-xs font-semibold text-dered-DEFAULT">
                    {state.done.fake} contradicted
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-deamber-line bg-deamber-bg px-3 py-1 text-xs font-semibold text-deamber-text">
                    {state.done.ambiguous} verify manually
                  </span>
                </div>
              )}

              {state.verdicts.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  {state.verdicts.map((v) => (
                    <VerdictRow key={v.index} verdict={v} />
                  ))}
                </div>
              )}

              {state.done && (
                <div className="mt-3 rounded-lg bg-surface-pill border border-surface-pillline px-3 py-2 text-xs text-ink-secondary">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>{state.done.total}</strong> total citations
                    </div>
                  </div>
                  {state.done.citelaw && (
                    <div className="mt-1 text-[11px] text-ink-faint">
                      CiteLaw:{' '}
                      {state.done.citelaw.status === 'not_configured'
                        ? 'not configured'
                        : state.done.citelaw.status === 'unavailable'
                          ? 'temporarily unavailable'
                          : `${state.done.citelaw.billing?.credits_charged ?? 0} credits charged`}
                      {typeof state.done.citelaw.billing?.credits_remaining === 'number' &&
                        ` · ${state.done.citelaw.billing.credits_remaining} remaining`}
                      {state.done.citelaw.cache_hits > 0 &&
                        ` · ${state.done.citelaw.cache_hits} cached`}
                    </div>
                  )}
                </div>
              )}

              {state.error && (
                <div className="mt-2 rounded-lg border border-dered-line bg-dered-bg2 px-3 py-2 text-xs text-dered-text">
                  Verification error — {state.error.message}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

const VerdictRow: React.FC<{ verdict: V2Verdict }> = ({ verdict }) => {
  if (verdict.status === 'pending') {
    return (
      <div className="flex items-start gap-3 rounded-[10px] border border-surface-line bg-surface-app px-3.5 py-3 text-xs text-ink-muted">
        <Loader2 size={15} strokeWidth={2} className="animate-de-spin shrink-0 mt-0.5 text-ink-faint" />
        <span className="flex-1 font-mono text-[12.5px]">{verdict.citation.slice(0, 100)}</span>
      </div>
    );
  }
  if (verdict.status === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-[10px] border border-dered-line bg-dered-bg2 px-3.5 py-3 text-xs text-dered-text">
        <X size={15} strokeWidth={2} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[12.5px] text-ink">{verdict.citation.slice(0, 100)}</div>
          <div className="text-[12px] text-dered-text mt-0.5">Error: {verdict.error}</div>
        </div>
      </div>
    );
  }

  const isReal = verdict.status === 'real';
  const isAmbiguous = verdict.status === 'ambiguous';
  const verdictLabel = isReal ? 'Verified' : isAmbiguous ? 'Verify manually' : 'Contradicted';

  const Icon = isReal ? Check : isAmbiguous ? AlertCircle : X;
  const rowBorder = isReal ? 'border-deteal-line' : isAmbiguous ? 'border-deamber-line' : 'border-dered-line';
  const rowBg = isReal ? 'bg-deteal-bg2' : isAmbiguous ? 'bg-deamber-bg2' : 'bg-dered-bg2';
  const iconColor = isReal ? 'text-deteal-icon2' : isAmbiguous ? 'text-deamber-icon' : 'text-dered-DEFAULT';
  const labelColor = isReal ? 'text-deteal-text' : isAmbiguous ? 'text-deamber-text' : 'text-dered-DEFAULT';

  return (
    <div className={`flex items-start gap-3 rounded-[10px] border ${rowBorder} ${rowBg} px-3.5 py-3`}>
      <Icon size={17} strokeWidth={2} className={`${iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {verdict.citation_type && (
            <span
              className={`text-[9.5px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 shrink-0 ${
                verdict.citation_type === 'statute'
                  ? 'bg-brand-line text-brand-deep'
                  : 'bg-surface-disabled text-ink-muted'
              }`}
              title={
                verdict.citation_type === 'statute'
                  ? 'Statute / regulation — checked against the official code'
                  : 'Case — identity-checked against CiteLaw and CourtListener'
              }
            >
              {verdict.citation_type}
            </span>
          )}
          <span className="font-mono text-[12.5px] text-ink truncate">{verdict.citation}</span>
          <span className={`text-[11.5px] font-bold shrink-0 ${labelColor}`}>{verdictLabel}</span>
        </div>
        {verdict.case_name && verdict.match_url && isReal ? (
          <div className="text-xs mt-0.5">
            <a
              href={verdict.match_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:text-brand-deep underline"
            >
              {verdict.case_name} — CourtListener
            </a>
            {typeof verdict.confidence === 'number' && (
              <span className="text-ink-faint"> · identity match, conf {verdict.confidence.toFixed(2)}</span>
            )}
          </div>
        ) : (
          typeof verdict.confidence === 'number' && (
            <div className="text-[11px] text-ink-faint mt-0.5">conf {verdict.confidence.toFixed(2)}</div>
          )
        )}
        {verdict.reasoning && (
          <div className="text-xs text-ink-muted mt-0.5">{verdict.reasoning}</div>
        )}
      </div>
    </div>
  );
};

export default V2VerifyPage;
