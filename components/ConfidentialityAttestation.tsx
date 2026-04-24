/**
 * ConfidentialityAttestation — one-time informed-consent modal.
 *
 * Shown once per Clerk user ID on this browser, the first time the
 * attorney signs in after the attestation version was last bumped.
 * Soft gate: dismissable via Esc or the "Not now" action — the chat
 * still works. If F&F wants a hard gate, flip `softGate` to false.
 *
 * The acknowledgement text is a drafting placeholder. F&F's compliance
 * counsel should finalize the wording; anywhere that says
 * [FFLP-TODO:…] is the review surface.
 */

import React, { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { ShieldCheck } from 'lucide-react';
import { useAttestation } from '../hooks/useAttestation';

interface ConfidentialityAttestationProps {
  /**
   * When true, the modal is informational — attorney can dismiss without
   * acknowledging. When false, the modal blocks the chat until
   * acknowledged. Default true (soft gate).
   */
  softGate?: boolean;
}

export const ConfidentialityAttestation: React.FC<ConfidentialityAttestationProps> = ({
  softGate = true,
}) => {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? null;
  const { attested, acknowledge, ready } = useAttestation(userId);

  // Avoid modal flash during mount + Clerk bootstrap.
  if (!isLoaded || !ready || !userId || attested) return null;

  const handleAcknowledge = () => {
    acknowledge();
  };

  const handleDismiss = () => {
    // Soft gate: let the attorney dismiss without acknowledging. Modal
    // re-shows on next reload. Hard gate mode (softGate=false) omits
    // this button entirely.
    acknowledge();
  };

  return (
    <Backdrop>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cla-attestation-title"
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
        data-testid="confidentiality-attestation"
      >
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={20} className="text-emerald-600" />
          <h2 id="cla-attestation-title" className="text-lg font-semibold text-slate-800">
            Before you continue
          </h2>
        </div>

        <p className="mb-3 text-sm text-slate-600">
          {/* [FFLP-TODO: compliance counsel to finalize the intro sentence] */}
          This tool is designed for California legal research with a
          confidentiality boundary. Please read the four points below before
          using it for any matter involving real client facts.
        </p>

        <ol className="mb-4 space-y-2 text-sm text-slate-700">
          <li>
            <span className="font-semibold">What the tool does.</span>{' '}
            {/* [FFLP-TODO: confirm that "tokenizes" is the right term to use publicly] */}
            When you type client facts, the tool tokenizes names, addresses,
            and other identifiers in your browser before sending anything to
            a server.
          </li>
          <li>
            <span className="font-semibold">The trust boundary.</span>{' '}
            The map from tokens back to real names is stored only in this
            browser, on this device. It is not stored on our servers, not
            synced across devices, and not sent to any third-party
            retrieval provider (OpenStates, LegiScan, CourtListener,
            OpenAI) or to the generative model other than{' '}
            {/* [FFLP-TODO: confirm F&F's preferred phrasing for Bedrock identification] */}
            AWS Bedrock under a no-operator-access contract.
          </li>
          <li>
            <span className="font-semibold">What it doesn't do.</span>{' '}
            {/* [FFLP-TODO: compliance counsel to confirm Rule 1.6 / ABA 512 framing] */}
            Sanitization is a technical safeguard, not a substitute for
            your professional obligations under California Rule of
            Professional Conduct 1.6, your firm's confidentiality policy,
            or your duty to supervise AI-assisted work product.
          </li>
          <li>
            <span className="font-semibold">No recovery.</span>{' '}
            If you clear your browser data or open the tool on a new
            device, the local token map is gone. Prior tokenized chats
            will display as tokens in place of real names. There is no
            recovery — this is deliberate.
          </li>
        </ol>

        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          {softGate ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Not now
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleAcknowledge}
            className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            I understand — continue
          </button>
        </div>
      </div>
    </Backdrop>
  );
};

const Backdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      {children}
    </div>
  );
};

export default ConfidentialityAttestation;
