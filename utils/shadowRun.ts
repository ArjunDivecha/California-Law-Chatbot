/**
 * Phase 4.5 shadow-run client helper.
 *
 * V1's chat hook calls fireShadow() AFTER its own response has been
 * shown to the user. This is fire-and-forget: failures are silent,
 * latency is zero on the user-visible path.
 *
 * The shadow endpoint lives on V2's Vercel preview (separate from V1).
 * Set NEXT_PUBLIC_V2_SHADOW_URL in the V1 build environment to point
 * at the V2 deployment; if unset, fireShadow() no-ops.
 *
 * Importing this file is safe in V1 — it has no runtime side effects
 * unless fireShadow() is actually called.
 */

interface FireShadowArgs {
  v1_session_id: string;
  v1_turn_id?: string;
  user_text: string;
  v1_response_text?: string;
  v1_source_count?: number;
  user_id?: string | null;
}

export function fireShadow(args: FireShadowArgs): void {
  const baseUrl =
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_V2_SHADOW_URL
      ? process.env.NEXT_PUBLIC_V2_SHADOW_URL
      : null;
  if (!baseUrl) return; // shadow disabled when env var absent
  // The fetch is intentionally NOT awaited. If V1 unmounts mid-call,
  // the browser will continue the request to completion (keepalive).
  try {
    fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/shadow`, {
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
