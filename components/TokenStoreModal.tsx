/**
 * TokenStoreModal — viewer + editor for the encrypted persistent token map.
 *
 * Shows every (token → real text) pair the device has accumulated so far.
 * The attorney can:
 *   - Forget any single token (deletes from the IndexedDB store; future
 *     rehydrates leave the token visible if a saved chat references it).
 *   - Manually add a new entity → token mapping for entities the auto
 *     detector misses (e.g. unusual surnames, nicknames).
 *
 * Open from the SanitizationBanner. Light-mode only per project rule.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { useSanitizer } from '../hooks/useSanitizer';
import type { SpanCategory } from '../api/_shared/sanitization/index.ts';
import { isCommonStopWord } from '../api/_shared/sanitization/tokenize.ts';
import {
  addToUserAllowlist,
  getUserAllowlist,
  removeFromUserAllowlist,
  subscribeToUserAllowlist,
} from '../services/sanitization/userAllowlist';

interface TokenStoreModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_OPTIONS: Array<{ value: SpanCategory; label: string }> = [
  { value: 'name', label: 'Person name' },
  { value: 'street_address', label: 'Street address' },
  { value: 'phone', label: 'Phone number' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date / DOB' },
  { value: 'ssn', label: 'SSN' },
  { value: 'tin', label: 'TIN' },
  { value: 'driver_license', label: 'Driver license' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'bank_account', label: 'Bank account' },
  { value: 'medical_record', label: 'Medical record' },
  { value: 'client_matter', label: 'Client/matter code' },
];

function inferCategoryFromToken(token: string): SpanCategory {
  if (token.startsWith('CLIENT_')) return 'name';
  if (token.startsWith('ADDRESS_')) return 'street_address';
  if (token.startsWith('PHONE_')) return 'phone';
  if (token.startsWith('EMAIL_')) return 'email';
  if (token.startsWith('DATE_')) return 'date';
  if (token.startsWith('SSN_')) return 'ssn';
  if (token.startsWith('TIN_')) return 'tin';
  if (token.startsWith('LICENSE_')) return 'driver_license';
  if (token.startsWith('CARD_')) return 'credit_card';
  if (token.startsWith('ACCT_')) return 'bank_account';
  if (token.startsWith('MRN_')) return 'medical_record';
  if (token.startsWith('MATTER_')) return 'client_matter';
  if (token.startsWith('ZIP_')) return 'zip';
  return 'name';
}

export const TokenStoreModal: React.FC<TokenStoreModalProps> = ({ open, onClose }) => {
  const { getMap, addEntity, forgetToken, tokenCount } = useSanitizer();
  const [tick, setTick] = useState(0);
  const [newRaw, setNewRaw] = useState('');
  const [newCategory, setNewCategory] = useState<SpanCategory>('name');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-pull the map when the modal opens or after any edit.
  const entries = useMemo(() => {
    if (!open) return [] as Array<[string, string]>;
    const map = getMap();
    return Array.from(map.entries()).sort(([a], [b]) => {
      // Group by token prefix, then numeric suffix.
      const [aPrefix, aNum] = a.split('_');
      const [bPrefix, bNum] = b.split('_');
      if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix);
      return Number(aNum) - Number(bNum);
    });
    // tick forces re-pull after add/remove
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tick, tokenCount, getMap]);

  useEffect(() => {
    if (open) setTick((n) => n + 1);
  }, [open]);

  const handleAdd = useCallback(async () => {
    const raw = newRaw.trim();
    if (!raw) return;
    if (isCommonStopWord(raw)) {
      setError(`Refusing to tokenize "${raw}" — that's a common stop word.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await addEntity(raw, newCategory);
      if (!token) {
        setError('Could not add entity (sanitizer not ready).');
        return;
      }
      setNewRaw('');
      setTick((n) => n + 1);
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Add failed.');
    } finally {
      setBusy(false);
    }
  }, [newRaw, newCategory, addEntity]);

  const handleForget = useCallback(
    async (token: string) => {
      if (!window.confirm(`Forget ${token}? This deletes the mapping from this device.`)) return;
      setBusy(true);
      try {
        await forgetToken(token);
        setTick((n) => n + 1);
      } finally {
        setBusy(false);
      }
    },
    [forgetToken]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Token store</h2>
            <p className="text-xs text-slate-500">
              {entries.length} {entries.length === 1 ? 'entity' : 'entities'} stored on this device. Tokens are stable across sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <label className="mb-1 block text-xs font-medium text-slate-700">Add manual entry</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newRaw}
              onChange={(e) => setNewRaw(e.target.value)}
              placeholder="Real text (e.g., Maria Esperanza)"
              className="min-w-[12rem] flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as SpanCategory)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
              disabled={busy}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={busy || !newRaw.trim()}
              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No entities stored yet. Tokens get added automatically when you mention a name, address, or other personal data in a chat — or use the form above to add one manually.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Token</th>
                  <th className="pb-2 pr-3 font-medium">Real text</th>
                  <th className="pb-2 pr-3 font-medium">Category</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([token, raw]) => (
                  <tr key={token} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 font-mono text-xs text-emerald-700">{token}</td>
                    <td className="py-1.5 pr-3 text-slate-900">{raw}</td>
                    <td className="py-1.5 pr-3 text-xs text-slate-500">{inferCategoryFromToken(token)}</td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => void handleForget(token)}
                        disabled={busy}
                        title="Delete this token mapping"
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <UserAllowlistSection />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// "Don't tokenize" section — user-editable allowlist of terms that the
// detector should always pass through unchanged. Reads from localStorage
// via the userAllowlist module; subscribes to changes so click-to-allow
// from the composer preview updates the modal in real time.
// ---------------------------------------------------------------------------

const UserAllowlistSection: React.FC = () => {
  const [list, setList] = useState<string[]>(() => getUserAllowlist());
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const refresh = () => setList(getUserAllowlist());
    return subscribeToUserAllowlist(refresh);
  }, []);

  const handleAdd = () => {
    const term = draft.trim();
    if (!term) return;
    addToUserAllowlist(term);
    setDraft('');
  };
  const handleRemove = (term: string) => {
    if (!window.confirm(`Stop allowlisting "${term}"? It will be tokenized again on future sends.`)) return;
    removeFromUserAllowlist(term);
  };

  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">Don't tokenize</h3>
      <p className="mb-2 text-xs text-slate-500">
        Terms in this list are always sent to the model unchanged. Click a highlighted term in the composer preview to add it here, or type one in below.
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Berkeley"
          className="min-w-[10rem] flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 rounded bg-slate-700 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
        >
          <Plus size={14} /> Allow
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No terms allowlisted yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {list.map((term) => (
            <li
              key={term}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-800"
            >
              <span>{term}</span>
              <button
                type="button"
                onClick={() => handleRemove(term)}
                title={`Remove "${term}" from the don't-tokenize list`}
                className="rounded-full p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-700"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TokenStoreModal;
