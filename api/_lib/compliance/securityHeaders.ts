/**
 * =============================================================================
 * Device threat-model helpers: CSP / security headers + session idle timeout (P6)
 * api/_lib/compliance/securityHeaders.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   The local-device threat model (PRD §5.12): client-side token maps + drafts
 *   are vulnerable to XSS / malicious extensions / a stolen device. The server
 *   pieces we can enforce: a strict Content-Security-Policy + hardening headers
 *   on every legal-text route, and a session idle-timeout check so an abandoned
 *   session can't be resumed indefinitely. (Token-map at-rest passphrase /
 *   secure-enclave protection is client-side, tracked under P6 follow-on.)
 *
 * INPUT FILES:  none (pure).
 * OUTPUT FILES: none.
 * =============================================================================
 */

/** Strict CSP: only same-origin code; connect limited to our known providers. */
export function buildCspHeader(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://api.anthropic.com https://api.openai.com https://*.upstash.io https://*.clerk.accounts.dev https://clerk.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/** Security headers to attach to every legal-text route response. */
export function securityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': buildCspHeader(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };
}

/**
 * Has a session been idle past the timeout? Fails CLOSED: unparseable
 * timestamps are treated as expired.
 */
export function isSessionExpired(lastActiveISO: string, nowISO: string, idleMinutes = 30): boolean {
  const last = Date.parse(lastActiveISO);
  const now = Date.parse(nowISO);
  if (Number.isNaN(last) || Number.isNaN(now)) return true;
  return now - last > idleMinutes * 60_000;
}
