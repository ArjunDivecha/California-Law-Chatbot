/**
 * V2 verify page — placeholder until P4.6 ships the full paste-a-passage
 * verifier UI. The verify-stream endpoint already exists (api/agent/
 * verify-stream.ts) and is reachable from V2DraftPage's "Verify Citations"
 * button. This route gives the workflow toggle a destination.
 *
 * P4.6 replaces this with a textarea + per-citation verdict panel that
 * accepts any pasted text (not just a freshly-generated draft).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useV2VerifyStream, type V2Verdict } from '../../hooks/useV2VerifyStream.ts';
import { V2SanitizationChip } from './V2SanitizationChip';

export const V2VerifyPage: React.FC = () => {
  const [text, setText] = useState('');
  const { state, verify, reset } = useV2VerifyStream();
  const placeholder =
    'Paste any passage of legal text here (a memo, draft, brief — anything) and click Verify. ' +
    'Every case citation is checked against CourtListener by an adversarial sub-agent; ' +
    'each verdict is real / fake with the model\'s reasoning.';

  const onVerify = useCallback(() => {
    if (!text.trim()) return;
    void verify(text);
  }, [text, verify]);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: '#FAFAF8', fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm">
              <img src="/Heart Favicon.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">California Law Chatbot</h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pink-500">
                V2 Verify · Citation Sub-Agent
              </span>
            </div>
          </div>
          <Link to="/v2" className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200">
            ← Chat
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-5xl flex flex-col px-6 py-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Passage to verify</h2>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                rows={16}
                className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-pink-400 focus:outline-none"
                disabled={state.isStreaming}
              />
              <div className="mt-2">
                <V2SanitizationChip text={text} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onVerify}
                  disabled={state.isStreaming || !text.trim()}
                  className="rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {state.isStreaming ? 'Verifying…' : 'Verify Citations'}
                </button>
                {(state.done || state.isStreaming) && (
                  <button
                    type="button"
                    onClick={() => {
                      reset();
                      setText('');
                    }}
                    className="text-xs text-pink-600 hover:underline"
                    disabled={state.isStreaming}
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                ~18s per citation. A passage with 5 cites takes about a minute and a half.
              </p>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 min-h-[400px]">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Verdicts</h2>
              {!state.manifest && !state.isStreaming && (
                <p className="text-xs text-gray-500">Paste a passage and click Verify.</p>
              )}
              {state.manifest && state.manifest.length === 0 && (
                <p className="text-xs text-gray-500">No case citations found in the passage.</p>
              )}
              {state.verdicts.length > 0 && (
                <div className="space-y-1.5">
                  {state.verdicts.map((v) => (
                    <VerdictRow key={v.index} verdict={v} />
                  ))}
                </div>
              )}
              {state.done && (
                <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700 flex items-center justify-between">
                  <div>
                    <strong>{state.done.verified}</strong> verified ·{' '}
                    <strong>{state.done.fake}</strong> not verified ·{' '}
                    <strong>{state.done.total}</strong> total
                  </div>
                  <div className="text-gray-400">{Math.round(state.done.elapsed_ms / 1000)}s</div>
                </div>
              )}
              {state.error && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
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
      <div className="flex items-start gap-2 text-xs text-gray-500">
        <span className="animate-spin">⟳</span>
        <span className="flex-1 font-mono text-[11px]">{verdict.citation.slice(0, 100)}</span>
      </div>
    );
  }
  if (verdict.status === 'error') {
    return (
      <div className="flex items-start gap-2 text-xs text-red-700">
        <span>✗</span>
        <div className="flex-1">
          <div className="font-mono text-[11px]">{verdict.citation.slice(0, 100)}</div>
          <div className="text-[11px] text-red-600">Error: {verdict.error}</div>
        </div>
      </div>
    );
  }
  const isReal = verdict.status === 'real';
  const isAmbiguous = verdict.status === 'ambiguous';
  // Visual key: real=green-✓, fake=red-✗, ambiguous=amber-? with manual-verify
  // hint so the attorney knows the tool punted, not that the cite is bad.
  const tag = isReal ? '✓' : isAmbiguous ? '?' : '✗';
  const color = isReal
    ? 'text-emerald-700'
    : isAmbiguous
    ? 'text-amber-700'
    : 'text-red-700';
  const bg = isReal
    ? 'bg-emerald-50 border-emerald-200'
    : isAmbiguous
    ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200';
  return (
    <div className={`flex items-start gap-2 text-xs rounded border ${bg} px-2 py-1.5`}>
      <span className={`${color} font-bold`}>{tag}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-gray-700 truncate">{verdict.citation}</span>
          {typeof verdict.confidence === 'number' && (
            <span className="text-[10px] text-gray-400 shrink-0">conf {verdict.confidence.toFixed(2)}</span>
          )}
          {isAmbiguous && (
            <span className="text-[10px] font-semibold text-amber-800 shrink-0">VERIFY MANUALLY</span>
          )}
        </div>
        {verdict.case_name && verdict.match_url && isReal && (
          <a
            href={verdict.match_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-pink-600 underline hover:text-pink-700"
          >
            {verdict.case_name}
          </a>
        )}
        {verdict.reasoning && (
          <div className="text-[11px] text-gray-600 mt-0.5">{verdict.reasoning}</div>
        )}
      </div>
    </div>
  );
};

export default V2VerifyPage;
