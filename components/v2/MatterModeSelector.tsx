/**
 * =============================================================================
 * MatterModeSelector — choose a session's matter mode (P2/P6 UI)
 * components/v2/MatterModeSelector.tsx
 * =============================================================================
 * The user-facing control for the matter model. Public research vs a client
 * matter (confidential) vs protected discovery. Drives confidentiality:
 * confidential/protected modes gate web_search/tools and require client consent
 * server-side. protected_discovery is a LOCKED flag — downgrading out of it
 * asks for explicit attorney confirmation (the server enforces this too).
 *
 * Talks to /api/matter-context (GET to load, POST to change). Light mode only.
 *
 * INPUT FILES:  none. OUTPUT FILES: none. (network: /api/matter-context)
 * =============================================================================
 */
import { useCallback, useEffect, useState } from 'react';

type MatterMode = 'public_research' | 'client_confidential' | 'protected_discovery';
type ConsentStatus = 'not_obtained' | 'allowed' | 'restricted' | 'prohibited' | 'revoked';

const LABELS: Record<MatterMode, string> = {
  public_research: 'Public research',
  client_confidential: 'Client matter (confidential)',
  protected_discovery: 'Protected discovery',
};

const CONSENT_LABELS: Record<ConsentStatus, string> = {
  not_obtained: 'Consent: not obtained',
  allowed: 'Consent: allowed',
  restricted: 'Consent: allowed w/ restrictions',
  prohibited: 'Consent: prohibited',
  revoked: 'Consent: revoked',
};

interface Props {
  sessionId: string;
  getToken: () => Promise<string | null>;
}

export function MatterModeSelector({ sessionId, getToken }: Props) {
  const [mode, setMode] = useState<MatterMode>('public_research');
  const [locked, setLocked] = useState(false);
  const [consent, setConsent] = useState<ConsentStatus>('not_obtained');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  // Load current matter context for this session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const resp = await fetch(`/api/matter-context?session_id=${encodeURIComponent(sessionId)}`, { headers });
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        setMode((data.matter_mode as MatterMode) ?? 'public_research');
        setLocked(Boolean(data.protected_locked));
        setConsent((data.consent as ConsentStatus) ?? 'not_obtained');
      } catch {
        /* non-fatal — keep default */
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, authHeaders]);

  const apply = useCallback(
    async (requested: MatterMode, attorneyOverride = false) => {
      setBusy(true);
      setError(null);
      try {
        const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
        const resp = await fetch('/api/matter-context', {
          method: 'POST',
          headers,
          body: JSON.stringify({ session_id: sessionId, matter_mode: requested, attorney_override: attorneyOverride }),
        });
        if (resp.status === 409) {
          // Locked-protected downgrade — confirm and retry with override.
          const reason = (await resp.json().catch(() => ({})))?.error ?? 'Protected discovery is locked.';
          if (window.confirm(`${reason}\n\nConfirm downgrade out of protected discovery?`)) {
            await apply(requested, true);
          }
          return;
        }
        if (!resp.ok) {
          setError((await resp.json().catch(() => ({})))?.error ?? `Error ${resp.status}`);
          return;
        }
        const data = await resp.json();
        setMode((data.matter_mode as MatterMode) ?? requested);
        setLocked(Boolean(data.protected_locked));
        setConsent((data.consent as ConsentStatus) ?? 'not_obtained');
      } catch {
        setError('Could not update matter mode');
      } finally {
        setBusy(false);
      }
    },
    [sessionId, authHeaders],
  );

  // Record the client's AI-use consent (COPRAC/PRD §5.10). The server stores
  // it versioned + signer-stamped; the policy engine blocks all external tool
  // calls in confidential/protected modes until it is 'allowed'/'restricted'.
  const applyConsent = useCallback(
    async (requested: ConsentStatus) => {
      if (requested !== 'not_obtained') {
        const ok = window.confirm(
          `Record client AI-use consent as "${CONSENT_LABELS[requested].replace('Consent: ', '')}" for this matter?\n\n` +
            'You are attesting, as the supervising attorney, that this reflects the client\'s informed consent ' +
            '(or restriction) regarding the use of AI tools on this matter. This is recorded with your user id and a timestamp.',
        );
        if (!ok) return;
      }
      setBusy(true);
      setError(null);
      try {
        const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
        const resp = await fetch('/api/matter-context', {
          method: 'POST',
          headers,
          body: JSON.stringify({ session_id: sessionId, matter_mode: mode, client_ai_consent: requested }),
        });
        if (!resp.ok) {
          setError((await resp.json().catch(() => ({})))?.error ?? `Error ${resp.status}`);
          return;
        }
        const data = await resp.json();
        setConsent((data.consent as ConsentStatus) ?? requested);
      } catch {
        setError('Could not record consent');
      } finally {
        setBusy(false);
      }
    },
    [sessionId, mode, authHeaders],
  );

  return (
    <div className="flex items-center gap-1.5" title="Matter mode — drives confidentiality controls">
      {locked && (
        <span className="text-amber-600" aria-label="Protected discovery locked" title="Protected discovery is locked">🔒</span>
      )}
      <select
        aria-label="Matter mode"
        disabled={busy}
        value={mode}
        onChange={(e) => apply(e.target.value as MatterMode)}
        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-pink-200"
      >
        {(Object.keys(LABELS) as MatterMode[]).map((m) => (
          <option key={m} value={m}>{LABELS[m]}</option>
        ))}
      </select>
      {mode !== 'public_research' && (
        <select
          aria-label="Client AI consent"
          disabled={busy}
          value={consent}
          onChange={(e) => applyConsent(e.target.value as ConsentStatus)}
          title="Client AI-use consent for this matter — external research tools stay disabled until consent is recorded"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-200 ${
            consent === 'allowed' || consent === 'restricted'
              ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
              : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
        >
          {(Object.keys(CONSENT_LABELS) as ConsentStatus[]).map((c) => (
            <option key={c} value={c}>{CONSENT_LABELS[c]}</option>
          ))}
        </select>
      )}
      {mode !== 'public_research' && consent === 'not_obtained' && (
        <span
          className="text-[11px] text-amber-700"
          title="COPRAC/PRD §5.10 — the policy engine blocks external tool calls on this matter until client AI consent is recorded"
        >
          research tools off until consent recorded
        </span>
      )}
      {error && <span className="text-red-500" title={error}>!</span>}
    </div>
  );
}

export default MatterModeSelector;
