/**
 * Phase 4.5 shadow-run client helper (V1-side).
 *
 * V1's chat hook calls fireShadow() AFTER its own response has been
 * shown to the user. Fire-and-forget: failures are silent, latency is
 * zero on the user-visible path.
 *
 * The shadow endpoint lives on V2's Vercel deployment (separate from
 * V1). Set VITE_V2_SHADOW_URL in the V1 build environment to point at
 * the V2 deployment; if unset, fireShadow() no-ops, so this file is
 * safe to land on V1 main ahead of partner sign-off.
 *
 * Vite convention: the URL is exposed to the browser bundle via the
 * VITE_ prefix on import.meta.env. (The V2 copy of this file uses
 * process.env.NEXT_PUBLIC_* — they target different bundlers.)
 */

interface FireShadowArgs {
  v1_session_id: string;
  v1_turn_id?: string;
  user_text: string;
  v1_response_text?: string;
  v1_source_count?: number;
  user_id?: string | null;
}

function getShadowBaseUrl(): string | null {
  try {
    const raw = import.meta.env?.VITE_V2_SHADOW_URL;
    if (typeof raw === 'string' && raw.length > 0) return raw;
  } catch {
    // import.meta.env is missing in non-Vite contexts (SSR, tests) —
    // treat that as "shadow disabled".
  }
  return null;
}

export function fireShadow(args: FireShadowArgs): void {
  const baseUrl = getShadowBaseUrl();
  if (!baseUrl) return; // shadow disabled when env var absent
  try {
    void fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/shadow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      keepalive: true,
    }).catch(() => {
      // Shadow failures are silent — must not affect the user-visible
      // V1 path in any way.
    });
  } catch {
    // ignore
  }
}
