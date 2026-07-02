/**
 * V2 client-side chat cache — localStorage-backed wrapper around
 * GET /api/agent/session?id=. Avoids re-fetching the same session's
 * full message history when the attorney navigates back to a session
 * they just viewed.
 *
 * Cache semantics:
 *   - Key: `cla-v2-session-cache:<sessionId>`
 *   - Value: { messages, meta, fetched_at }
 *   - TTL: 5 minutes (longer than a typical sidebar-click round-trip,
 *     short enough that stale-after-new-turn windows are minor).
 *   - Invalidated on local writes (post-turn) via invalidateSession.
 *
 * Adapted from V1's utils/chatStore.ts (which used a similar pattern
 * for /api/chats history). V2's IndexedDB-based variant (richer queryable
 * cache) is a future optimization — localStorage is enough for now.
 */

const CACHE_PREFIX = 'cla-v2-session-cache:';
const TTL_MS = 5 * 60 * 1000;

export interface CachedSessionPayload {
  messages: unknown[];
  meta: Record<string, unknown> | null;
  fetched_at: number;
}

function cacheKey(sessionId: string): string {
  return `${CACHE_PREFIX}${sessionId}`;
}

export function readCachedSession(sessionId: string): CachedSessionPayload | null {
  if (typeof window === 'undefined' || !sessionId) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSessionPayload;
    if (!parsed || typeof parsed.fetched_at !== 'number') return null;
    if (Date.now() - parsed.fetched_at > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedSession(sessionId: string, payload: Omit<CachedSessionPayload, 'fetched_at'>): void {
  if (typeof window === 'undefined' || !sessionId) return;
  try {
    window.localStorage.setItem(
      cacheKey(sessionId),
      JSON.stringify({ ...payload, fetched_at: Date.now() }),
    );
  } catch {
    // Quota / privacy-mode errors — degrade silently
  }
}

export function invalidateSession(sessionId: string): void {
  if (typeof window === 'undefined' || !sessionId) return;
  try {
    window.localStorage.removeItem(cacheKey(sessionId));
  } catch {}
}

export function clearAllSessionCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(window.localStorage);
    for (const k of keys) {
      if (k.startsWith(CACHE_PREFIX)) window.localStorage.removeItem(k);
    }
  } catch {}
}

/**
 * High-level fetcher: read-through cache. Returns parsed messages +
 * meta. Cache hit avoids the network round-trip.
 */
export async function fetchSessionWithCache(
  sessionId: string,
  authFetch: () => Promise<string | null>,
): Promise<CachedSessionPayload | null> {
  const cached = readCachedSession(sessionId);
  if (cached) return cached;
  const token = await authFetch();
  if (!token) return null;
  try {
    const resp = await fetch(`/api/agent/session?id=${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      messages?: unknown[];
      meta?: Record<string, unknown>;
    };
    const payload = {
      messages: data.messages ?? [],
      meta: data.meta ?? null,
    };
    writeCachedSession(sessionId, payload);
    return { ...payload, fetched_at: Date.now() };
  } catch {
    return null;
  }
}
