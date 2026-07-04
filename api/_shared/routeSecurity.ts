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
import { allowedOrigins, resolveAllowedOrigin } from '../_lib/httpGuard.js';

/** Minimal response surface we need (compatible with VercelResponse). */
export interface MinimalRes {
  setHeader(name: string, value: string): void;
}

/**
 * Allowed browser origins — delegates to the SINGLE source of truth in
 * httpGuard.ts (built-in defaults + V2_ALLOWED_ORIGINS + APP_ORIGIN env).
 * This route family and the /api/agent/* family previously carried two
 * independent allow-lists that drifted apart; they now converge here.
 */
export function defaultAllowedOrigins(): string[] {
  return allowedOrigins();
}

/**
 * The origin to echo back, or null. Pure: a missing Origin (same-origin /
 * non-CORS request) ⇒ null (no ACAO needed); an allowlisted origin ⇒ itself;
 * anything else ⇒ null (browser blocks the cross-origin call). Never '*'.
 *
 * Origin resolution is delegated to httpGuard.resolveAllowedOrigin so there
 * is exactly one allow-list across the codebase. An explicit `allowed` list
 * (rare; no current caller passes one) still overrides for local scoping.
 */
export function resolveCorsOrigin(
  requestOrigin: string | undefined,
  allowed?: string[],
): string | null {
  if (allowed) {
    if (!requestOrigin) return null;
    return allowed.includes(requestOrigin) ? requestOrigin : null;
  }
  return resolveAllowedOrigin(requestOrigin);
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
