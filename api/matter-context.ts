/**
 * =============================================================================
 * Matter context API — set/read a session's matter mode + client consent (P2/P6)
 * api/matter-context.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   The server-side endpoint behind the matter-selector UI. It is the
 *   AUTHORITATIVE place a session's matter mode (public_research /
 *   client_confidential / protected_discovery), the locked-protected flag, and
 *   client AI-use consent are set and read. Enforces the "locked protected
 *   flag" safety (no accidental downgrade) via validateMatterTransition, and
 *   ownership (a user can only touch their own sessions).
 *
 *   GET  /api/matter-context?session_id=...  → current matter context + consent
 *   POST /api/matter-context { session_id, matter_mode, client_ai_consent?,
 *        matter_id?, attorney_override? } → apply change (409 on locked downgrade)
 *
 * INPUT FILES:  none (reads/writes session meta in Upstash Redis via sessionStore)
 * OUTPUT FILES: none
 * =============================================================================
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '@clerk/backend';
import { applyResponseSecurity, headerString } from './_shared/routeSecurity.js';
import { readMeta, writeMeta } from './_lib/sessionStore.js';
import { validateMatterTransition, parseMatterMode } from './_lib/compliance/matterContext.js';
import { recordClientConsent, getAttestations } from './_lib/compliance/attestations.js';
import type { ClientAiConsentStatus } from './_lib/compliance/policyEngine.js';

const CONSENT_VALUES = new Set<ClientAiConsentStatus>([
  'not_obtained', 'allowed', 'restricted', 'prohibited', 'revoked',
]);

async function getUserId(req: VercelRequest): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw Object.assign(new Error('CLERK_SECRET_KEY not set'), { status: 500 });
  let token: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else {
    const cookie = req.headers.cookie ?? '';
    const m = cookie.match(/(?:^|;\s*)__session=([^;]+)/);
    token = m ? decodeURIComponent(m[1]) : undefined;
  }
  if (!token) throw Object.assign(new Error('No session token'), { status: 401 });
  try {
    const payload = await verifyToken(token, { secretKey });
    if (!payload.sub) throw new Error('No userId in token');
    return payload.sub;
  } catch {
    throw Object.assign(new Error('Authentication failed'), { status: 401 });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyResponseSecurity(res, headerString(req.headers.origin), { methods: 'GET, POST, OPTIONS' });
  if (req.method === 'OPTIONS') return res.status(204).end();

  let userId: string;
  try {
    userId = await getUserId(req);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 401;
    return res.status(status).json({ error: (e as Error).message });
  }

  const sessionId = (req.method === 'GET' ? req.query.session_id : req.body?.session_id) as string | undefined;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'session_id required' });
  }
  const meta = await readMeta(sessionId);
  // Ownership: enforce only when the session already exists. A not-yet-persisted
  // session (no meta until the first turn) is claimed by the caller on POST.
  if (meta && meta.user_id !== userId) return res.status(403).json({ error: 'forbidden' });

  if (req.method === 'GET') {
    const att = meta ? await getAttestations(sessionId) : null;
    return res.status(200).json({
      matter_id: meta?.matter_id ?? null,
      matter_mode: meta?.matter_mode ?? 'public_research',
      protected_locked: meta?.protected_locked ?? false,
      consent: att?.consent ?? 'not_obtained',
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const requested = parseMatterMode(req.body?.matter_mode);
  if (!requested) return res.status(400).json({ error: 'invalid matter_mode' });

  const transition = validateMatterTransition(
    { matterMode: meta?.matter_mode ?? 'public_research', protectedLocked: meta?.protected_locked ?? false },
    requested,
    { attorneyOverride: Boolean(req.body?.attorney_override) },
  );
  if (!transition.allowed || !transition.next) {
    return res.status(409).json({ error: transition.reason ?? 'transition not allowed' });
  }

  await writeMeta(sessionId, {
    ...(meta ? {} : { user_id: userId, created_at: new Date().toISOString(), schema_version: 1, model: '' }),
    last_active_at: new Date().toISOString(),
    matter_mode: transition.next.matterMode,
    protected_locked: transition.next.protectedLocked,
    ...(typeof req.body?.matter_id === 'string' ? { matter_id: req.body.matter_id } : {}),
  });

  const consent = req.body?.client_ai_consent as ClientAiConsentStatus | undefined;
  if (consent && CONSENT_VALUES.has(consent)) {
    await recordClientConsent(sessionId, consent, `attorney:${userId}`, 'v1', new Date().toISOString());
  }

  const att = await getAttestations(sessionId);
  return res.status(200).json({
    matter_mode: transition.next.matterMode,
    protected_locked: transition.next.protectedLocked,
    consent: att.consent,
  });
}
