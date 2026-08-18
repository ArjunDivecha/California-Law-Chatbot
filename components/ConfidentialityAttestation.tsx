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

import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { ShieldCheck, Smartphone, Send, AlertTriangle, Lock } from 'lucide-react';
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
  // Soft-gate dismissal is session-local: hides the modal for this mount
  // only; it re-shows on the next reload until the attorney actually
  // acknowledges. (Previously dismiss called acknowledge(), permanently
  // recording attestation — a bug flagged in the 2026-06-16 review.)
  const [dismissed, setDismissed] = useState(false);
  // Acknowledgement checkbox (artboard 04). Required: "I understand —
  // continue" stays disabled until the attorney checks it, so attestation
  // can't be recorded without an affirmative act (Arjun, 2026-08-17).
  const [readChecked, setReadChecked] = useState(false);

  // Avoid modal flash during mount + Clerk bootstrap.
  if (!isLoaded || !ready || !userId || attested || dismissed) return null;

  const handleAcknowledge = () => {
    acknowledge();
  };

  const handleDismiss = () => {
    // Soft gate: hide for THIS session without recording attestation, so
    // the modal re-shows on next reload. Hard gate mode (softGate=false)
    // omits this button entirely.
    setDismissed(true);
  };

  return (
    <Backdrop>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cla-attestation-title"
        className="w-full max-w-[560px] rounded-2xl bg-white p-8 shadow-modal"
        data-testid="confidentiality-attestation"
      >
        <div className="de-rule mb-6" />
        <div className="mb-2 flex items-center gap-2.5">
          <ShieldCheck size={22} strokeWidth={1.5} className="text-deteal-icon" />
          <h2 id="cla-attestation-title" className="font-display text-[22px] font-semibold text-ink">
            Before you continue
          </h2>
        </div>

        <p className="mb-5 text-[13.5px] leading-relaxed text-ink-muted">
          A one-minute read on how DancingElephant handles client information. The short
          version:{' '}
          <span className="font-semibold text-ink">
            confidential client information never leaves your computer.
          </span>
        </p>

        <ol className="mb-[22px] flex flex-col gap-3.5 text-[13.5px] leading-relaxed text-ink">
          <li className="flex gap-3">
            <Smartphone size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-brand" />
            <div>
              {/* [FFLP-TODO: confirm that "tokenizes" is the right term to use publicly] */}
              <strong>What stays on this device.</strong> When you type client facts, names
              and identifiers are replaced with tokens in your browser. The map from tokens
              back to real names never leaves this device.
            </div>
          </li>
          <li className="flex gap-3">
            <Send size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-brand" />
            <div>
              {/* [FFLP-TODO: compliance counsel to finalize provider phrasing] */}
              <strong>What is sent.</strong> Only the tokenized text reaches the model and
              research providers — never the real names. Model inputs are not used for
              training.
            </div>
          </li>
          <li className="flex gap-3">
            <AlertTriangle size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-deamber-icon" />
            <div>
              {/* [FFLP-TODO: compliance counsel to confirm Rule 1.6 / ABA 512 framing] */}
              <strong>Your obligations stand.</strong> This is a technical safeguard, not a
              substitute for your duties under Rule of Professional Conduct 1.6 or your
              duty to supervise AI-assisted work.
            </div>
          </li>
          <li className="flex gap-3">
            <Lock size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-muted" />
            <div>
              <strong>No recovery.</strong> Clearing browser data deletes the local token
              map permanently. Prior chats will show tokens in place of names. This is
              deliberate.
            </div>
          </li>
        </ol>

        <label className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-surface-line bg-surface-app px-3.5 py-3 text-[13px] leading-relaxed cursor-pointer">
          <input
            type="checkbox"
            checked={readChecked}
            onChange={(e) => setReadChecked(e.target.checked)}
            className="mt-0.5 accent-brand"
          />
          I&apos;ve read the four points above and understand where client information does
          and doesn&apos;t go.
        </label>

        <div className="flex items-center justify-between">
          {softGate ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="text-[13px] text-ink-muted hover:text-ink-secondary"
            >
              Not now
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={!readChecked}
            className={
              readChecked
                ? 'inline-flex items-center gap-2 rounded-[10px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-deep'
                : 'inline-flex items-center gap-2 rounded-[10px] bg-surface-disabled px-5 py-2.5 text-[13.5px] font-semibold text-ink-faint cursor-not-allowed'
            }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(34,26,48,.45)] p-4">
      {children}
    </div>
  );
};

export default ConfidentialityAttestation;
