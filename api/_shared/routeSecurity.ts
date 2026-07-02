/**
 * =============================================================================
 * Shared route security: CORS allowlist + hardening headers (P3/F8 + P6 §5.12)
 * api/_shared/routeSecurity.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   Replaces the wildcard `Access-Control-Allow-Origin: *` on legal-text routes
 *   with a strict origin ALLOWLIST, and attaches the hardening headers (CSP,
 *   HSTS, frame DENY, nosniff, …) from the device threat-model module. A
 *   wildcard CORS on an unauthenticated route lets any site call it; this closes
 *   that (PRD §8 route lockdown / Gap G). Same-origin SPA requests are
 *   unaffected (they don't need a CORS header at all).
 *
 * INPUT FILES:  none (pure header logic).
 * OUTPUT FILES: none.
 * =============================================================================
 */
import { securityHeaders } from '../_lib/compliance/securityHeaders.js';

/** Minimal response surface we need (compatible with VercelResponse). */
export interface MinimalRes {
  setHeader(name: string, value: string): void;
}

/** Allowed browser origins. Prod origins + localhost dev + APP_ORIGIN env. */
export function defaultAllowedOrigins(): string[] {
  const list = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://california-law-chatbot.vercel.app',
    'https://california-law-chatbot-v2.vercel.app',
    'https://chat.femmeandfemmelaw.com',
  ];
  // APP_ORIGIN supports a single origin or a comma-separated list.
  const env = process.env.APP_ORIGIN;
  if (env) list.push(...env.split(',').map((s) => s.trim()).filter(Boolean));
  return list;
}

/**
 * The origin to echo back, or null. Pure: a missing Origin (same-origin /
 * non-CORS request) ⇒ null (no ACAO needed); an allowlisted origin ⇒ itself;
 * anything else ⇒ null (browser blocks the cross-origin call). Never '*'.
 */
export function resolveCorsOrigin(
  requestOrigin: string | undefined,
  allowed: string[] = defaultAllowedOrigins(),
): string | null {
  if (!requestOrigin) return null;
  return allowed.includes(requestOrigin) ? requestOrigin : null;
}

export interface ResponseSecurityOptions {
  methods?: string;
  allowed?: string[];
}

/** Apply hardening headers + strict CORS to a response. */
export function applyResponseSecurity(
  res: MinimalRes,
  requestOrigin?: string,
  opts: ResponseSecurityOptions = {},
): void {
  for (const [k, v] of Object.entries(securityHeaders())) res.setHeader(k, v);
  const origin = resolveCorsOrigin(requestOrigin, opts.allowed);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', opts.methods ?? 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}

/** Normalize a possibly-array header value to a single string. */
export function headerString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
