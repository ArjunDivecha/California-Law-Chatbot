/**
 * DaemonSetupModal — shown on first load when the OPF privacy-filter
 * daemon is not running on the user's machine.
 *
 * Guides the user through opening Terminal via Spotlight and pasting
 * one install command. Polls every 3s and auto-dismisses when the
 * daemon comes online.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Copy, Check, Loader2 } from 'lucide-react';

const INSTALL_CMD =
  'curl -fsSL https://raw.githubusercontent.com/ArjunDivecha/California-Law-Chatbot/codex/bedrock-confidentiality-migration/tools/opf-daemon/install-remote.sh | bash';

interface Props {
  onDismiss: () => void;
}

export const DaemonSetupModal: React.FC<Props> = ({ onDismiss }) => {
  const [step, setStep] = useState<'guide' | 'waiting'>('guide');
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    setStep('waiting');
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('http://127.0.0.1:47821/v1/health', { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          clearInterval(intervalRef.current!);
          onDismiss();
        }
      } catch { /* not running yet */ }
    }, 3000);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8">

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
            <ShieldCheck size={32} className="text-blue-600" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-center text-slate-900 mb-2">
          One-time privacy setup required
        </h2>
        <p className="text-sm text-center text-slate-500 mb-6">
          This chatbot keeps client information private by running a filter on your
          computer before anything is sent. Takes about 2 minutes to set up — only once.
        </p>

        {step === 'guide' ? (
          <>
            <ol className="space-y-4 mb-6">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-sm text-slate-700">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-xs font-mono">⌘ Space</kbd> to open Spotlight, type <strong>Terminal</strong>, press <strong>Enter</strong>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                <div className="flex-1">
                  <p className="text-sm text-slate-700 mb-2">Click <strong>Copy</strong> then paste into Terminal and press <strong>Enter</strong></p>
                  <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2">
                    <code className="text-xs text-green-400 flex-1 break-all">{INSTALL_CMD}</code>
                    <button
                      onClick={handleCopy}
                      className="flex-shrink-0 flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded transition-colors"
                    >
                      {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                <span className="text-sm text-slate-700">
                  Wait for Terminal to say <strong>"Privacy filter is ready"</strong>, then click the button below
                </span>
              </li>
            </ol>

            <button
              onClick={handleDone}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              I've done it — connect me
            </button>
          </>
        ) : (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-slate-600 mb-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Connecting to privacy filter…</span>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              This will close automatically once the filter is running.
            </p>
            <button
              onClick={() => setStep('guide')}
              className="text-xs text-blue-600 hover:underline"
            >
              ← Go back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
