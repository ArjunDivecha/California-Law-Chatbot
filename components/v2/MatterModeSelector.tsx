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
import { Check, Lock } from 'lucide-react';

type MatterMode = 'public_research' | 'client_confidential' | 'protected_discovery';
type ConsentStatus = 'not_obtained' | 'allowed' | 'restricted' | 'prohibited' | 'revoked';

const LABELS: Record<MatterMode, string> = {
  public_research: 'Public research',
  client_confidential: 'Client matter (confidential)',
  protected_discovery: 'Protected discovery',
};

/** Short segment labels (the artboard's 3-segment control). LABELS above is
 *  kept as the long-form/accessible wording used in titles + confirms. */
const SEGMENT_LABELS: Record<MatterMode, string> = {
  public_research: 'Public research',
  client_confidential: 'Client confidential',
  protected_discovery: 'Protected discovery',
};

/** Active-segment fill per mode (teal / violet / dark amber). */
const SEGMENT_ACTIVE: Record<MatterMode, string> = {
  public_research: 'bg-deteal-icon text-white',
  client_confidential: 'bg-brand text-white',
  protected_discovery: 'bg-deamber-lock text-white',
};

/** Short consent-chip wording (the long CONSENT_LABELS still drive the
 *  attestation confirm dialog, so their semantics are untouched). */
const CONSENT_CHIP: Record<ConsentStatus, string> = {
  not_obtained: 'Consent not obtained',
  allowed: 'Client consent recorded',
  restricted: 'Allowed w/ restrictions',
  prohibited: 'Consent prohibited',
  revoked: 'Consent revoked',
};

const CONSENT_CHIP_STYLE: Record<ConsentStatus, string> = {
  not_obtained: 'border-deamber-line bg-deamber-bg text-deamber-text hover:bg-deamber-bg2',
  allowed: 'border-deteal-line bg-deteal-bg text-deteal-text hover:bg-deteal-bg2',
  restricted: 'border-deteal-line bg-deteal-bg text-deteal-text hover:bg-deteal-bg2',
  prohibited: 'border-dered-line bg-dered-bg text-dered hover:bg-dered-bg2',
  revoked: 'border-dered-line bg-dered-bg text-dered hover:bg-dered-bg2',
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
  /** Notifies the parent whenever the effective matter mode loads/changes
   *  (used e.g. to gate sends on devices without the on-device filter). */
  onModeChange?: (mode: MatterMode) => void;
}

export function MatterModeSelector({ sessionId, getToken, onModeChange }: Props) {
  const [mode, setMode] = useState<MatterMode>('public_research');
  const [locked, setLocked] = useState(false);
  const [consent, setConsent] = useState<ConsentStatus>('not_obtained');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Consent chip popover (replaces the old <select>; same options/handler).
  const [consentOpen, setConsentOpen] = useState(false);

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
        onModeChange?.((data.matter_mode as MatterMode) ?? 'public_research');
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
        onModeChange?.((data.matter_mode as MatterMode) ?? requested);
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

  const consentRecorded = consent === 'allowed' || consent === 'restricted';

  return (
    <div className="flex flex-wrap items-center gap-2" title="Matter mode — drives confidentiality controls">
      {/* 3-segment matter-mode control. Same change semantics as the old
          <select>: each segment calls apply(), which handles the 409
          attorney-override confirm and the locked-downgrade flow. */}
      <div
        role="radiogroup"
        aria-label="Matter mode"
        className={`flex overflow-hidden rounded-[9px] border text-xs font-semibold ${
          locked ? 'border-deamber-line' : 'border-surface-line3'
        } ${busy ? 'opacity-60' : ''}`}
      >
        {(Object.keys(SEGMENT_LABELS) as MatterMode[]).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => { if (!active) void apply(m); }}
              title={
                m === 'protected_discovery' && locked
                  ? 'Protected discovery is locked — downgrading requires attorney confirmation'
                  : LABELS[m]
              }
              className={`flex items-center gap-1.5 px-3 py-[7px] transition ${
                active ? SEGMENT_ACTIVE[m] : 'bg-white text-ink-muted hover:bg-surface-pill'
              } ${busy ? 'cursor-not-allowed' : ''}`}
            >
              {m === 'protected_discovery' && (
                <Lock size={12} strokeWidth={1.8} aria-hidden />
              )}
              {SEGMENT_LABELS[m]}
            </button>
          );
        })}
      </div>

      {/* Consent status chip → popover with every consent option, wired to
          the same applyConsent() attestation flow the <select> used. */}
      {mode !== 'public_research' && (
        <div className="relative">
          <button
            type="button"
            disabled={busy}
            aria-haspopup="listbox"
            aria-expanded={consentOpen}
            aria-label="Client AI consent"
            onClick={() => setConsentOpen((v) => !v)}
            title="Client AI-use consent for this matter — external research tools stay disabled until consent is recorded"
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${CONSENT_CHIP_STYLE[consent]} ${
              busy ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            {consentRecorded && <Check size={12} strokeWidth={2.2} aria-hidden />}
            {CONSENT_CHIP[consent]}
          </button>
          {consentOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setConsentOpen(false)} />
              <div
                role="listbox"
                className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border border-surface-line bg-white p-1.5 shadow-card"
              >
                {(Object.keys(CONSENT_LABELS) as ConsentStatus[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="option"
                    aria-selected={consent === c}
                    onClick={() => {
                      setConsentOpen(false);
                      void applyConsent(c);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition hover:bg-surface-pill ${
                      consent === c ? 'text-brand-deep' : 'text-ink-secondary'
                    }`}
                  >
                    <Check
                      size={12}
                      strokeWidth={2.2}
                      aria-hidden
                      className={consent === c ? '' : 'invisible'}
                    />
                    {CONSENT_LABELS[c]}
                  </button>
                ))}
                <div className="px-2.5 pb-1 pt-2 text-[10.5px] leading-snug text-ink-faint">
                  COPRAC/PRD §5.10 — the policy engine blocks external tool calls on this
                  matter until client AI consent is recorded.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {mode !== 'public_research' && consent === 'not_obtained' && (
        <span
          className="text-[11px] text-deamber-text"
          title="COPRAC/PRD §5.10 — the policy engine blocks external tool calls on this matter until client AI consent is recorded"
        >
          Research tools off until consent is recorded.
        </span>
      )}
      {error && (
        <span className="text-[11px] font-semibold text-dered" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}

export default MatterModeSelector;
