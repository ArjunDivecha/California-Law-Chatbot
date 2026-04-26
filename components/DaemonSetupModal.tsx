/**
 * DaemonSetupModal — shown on first load when the OPF privacy-filter
 * daemon is not running on the user's machine.
 *
 * Guides the user through a 2-click install:
 *   1. Click "Download Setup File"
 *   2. Double-click the downloaded file in Finder
 *
 * Polls the daemon health every 3 seconds and auto-dismisses when it
 * comes online.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Download, Loader2 } from 'lucide-react';

interface Props {
  onDismiss: () => void;
}

export const DaemonSetupModal: React.FC<Props> = ({ onDismiss }) => {
  const [downloaded, setDownloaded] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll every 3s once the user has downloaded the file
  useEffect(() => {
    if (!downloaded) return;
    setDetecting(true);
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('http://127.0.0.1:47821/v1/health', { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          clearInterval(intervalRef.current!);
          onDismiss();
        }
      } catch { /* not running yet */ }
    }, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [downloaded, onDismiss]);

  const handleDownload = () => {
    window.location.href = '/api/download-daemon-installer';
    setDownloaded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
            <ShieldCheck size={32} className="text-blue-600" />
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-semibold text-center text-slate-900 mb-2">
          One-time privacy setup required
        </h2>
        <p className="text-sm text-center text-slate-500 mb-6">
          This chatbot protects client information by running a privacy filter
          on your device before anything leaves your computer.
          You only need to do this once.
        </p>

        {!downloaded ? (
          <>
            {/* Steps */}
            <ol className="space-y-3 mb-6">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-sm text-slate-700">Click <strong>Download Setup File</strong> below</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                <span className="text-sm text-slate-700">Open your <strong>Downloads</strong> folder and double-click <em>Install Privacy Filter.command</em></span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                <span className="text-sm text-slate-700">A Terminal window will open — wait for it to say <strong>"Privacy filter is ready"</strong></span>
              </li>
            </ol>

            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              <Download size={18} />
              Download Setup File
            </button>
          </>
        ) : (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-slate-600 mb-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">
                {detecting ? 'Waiting for privacy filter to start…' : 'Preparing…'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              This window will close automatically once setup is complete.
            </p>

            {/* Reminder if they haven't run it yet */}
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
              <p className="text-xs text-amber-800 font-medium mb-1">Haven't run it yet?</p>
              <p className="text-xs text-amber-700">
                Open your <strong>Downloads</strong> folder, find <em>Install Privacy Filter.command</em>, and double-click it.
                If macOS asks "Are you sure?", click <strong>Open</strong>.
              </p>
            </div>

            <button
              onClick={handleDownload}
              className="mt-4 text-xs text-blue-600 hover:underline"
            >
              Download again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
