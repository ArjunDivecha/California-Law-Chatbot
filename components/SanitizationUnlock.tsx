/**
 * SanitizationUnlock — modal for creating or unlocking the attorney's
 * sanitization store.
 *
 * First-time users get a "create passphrase" flow with an explicit
 * no-recovery warning. Returning users get an "unlock" flow. Wrong
 * passphrase is surfaced with a clear message.
 */

import React, { useState } from 'react';
import { Lock, Unlock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useSanitizer, WrongPassphraseError } from '../hooks/useSanitizer';

interface SanitizationUnlockProps {
  /** Called after the store unlocks successfully. */
  onUnlocked?: () => void;
  /** Called if the attorney chooses to dismiss without unlocking. */
  onDismiss?: () => void;
}

const MIN_PASSPHRASE_LENGTH = 12;

export const SanitizationUnlock: React.FC<SanitizationUnlockProps> = ({
  onUnlocked,
  onDismiss,
}) => {
  const { hasExistingStore, unlock } = useSanitizer();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const isCreate = !hasExistingStore;

  const canSubmit =
    passphrase.length >= MIN_PASSPHRASE_LENGTH &&
    (!isCreate || (confirm === passphrase && acknowledged));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await unlock(passphrase);
      setPassphrase('');
      setConfirm('');
      onUnlocked?.();
    } catch (err) {
      if (err instanceof WrongPassphraseError) {
        setError(
          'Incorrect passphrase. Remember: there is no recovery. If you cannot recall it, start over by clearing your browser data.'
        );
      } else {
        setError(
          `Unable to unlock the store: ${
            (err as { message?: string })?.message ?? String(err)
          }`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
      data-testid="sanitization-unlock"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          {isCreate ? <Lock size={20} /> : <Unlock size={20} />}
          <h2 className="text-lg font-semibold text-slate-800">
            {isCreate ? 'Create sanitization passphrase' : 'Unlock sanitization store'}
          </h2>
        </div>

        {isCreate ? (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle size={16} /> No recovery
            </div>
            <p>
              This passphrase encrypts the map of real client names on this computer. If you forget
              it, the map is permanently unreadable — prior chats will be visible only as tokens.
            </p>
            <p className="mt-2">
              Use at least {MIN_PASSPHRASE_LENGTH} characters. Write it down somewhere safe.
            </p>
          </div>
        ) : (
          <p className="mb-4 text-sm text-slate-600">
            Enter your sanitization passphrase to unlock the token map on this computer. Real client
            names will then appear in place of tokens when chats load.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Passphrase</span>
            <input
              type="password"
              autoComplete={isCreate ? 'new-password' : 'current-password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="block w-full rounded border border-slate-300 px-2 py-1 focus:border-slate-500 focus:outline-none"
              autoFocus
              minLength={isCreate ? MIN_PASSPHRASE_LENGTH : 1}
            />
          </label>

          {isCreate && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Confirm passphrase</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="block w-full rounded border border-slate-300 px-2 py-1 focus:border-slate-500 focus:outline-none"
                />
              </label>

              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5"
                />
                I understand that if I lose this passphrase my token map is permanently unreadable.
              </label>
            </>
          )}

          {error && (
            <div className="rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Not now
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Working…' : isCreate ? 'Create and unlock' : 'Unlock'}
              {!submitting && <CheckCircle2 size={14} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SanitizationUnlock;
