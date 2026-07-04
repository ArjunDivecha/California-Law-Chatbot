/**
 * V2 sidebar — the only sidebar shown on /v2* routes. Lists the
 * authenticated user's V2 sessions newest-first, with a New Chat button
 * that mints a fresh session and navigates to /v2.
 *
 * Sessions are loaded via GET /api/agent/sessions (Clerk-authed). The
 * sidebar is intentionally narrow — V2's chrome is minimal because the
 * chat surface itself is the focus. No V1 chat-mode complexity here.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { getChatSanitizer } from '../../services/sanitization/chatAdapter';
import { useSanitizer } from '../../hooks/useSanitizer';

interface SessionSummary {
  session_id: string;
  title: string | null;
  last_active_at: string | null;
  created_at: string | null;
  message_count: number;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const V2Sidebar: React.FC = () => {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ sessionId?: string }>();
  const activeSessionId = params.sessionId ?? null;

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Same rehydration pattern as V2ChatPage: session titles in KV are
  // tokenized form ("CLIENT_001"), so apply rehydrateMessage at render
  // time. tokenCount in deps so the list refreshes once the
  // IndexedDB token map loads after mount.
  const { tokenCount, unlocked } = useSanitizer();
  const displayedSessions = useMemo(() => {
    if (!unlocked || tokenCount === 0) return sessions;
    const sanitizer = getChatSanitizer();
    return sessions.map((s) => ({
      ...s,
      title: s.title ? sanitizer.rehydrateMessage(s.title) : s.title,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, tokenCount, unlocked]);

  const load = useCallback(async () => {
    // Don't fetch until Clerk has finished loading + we're signed in.
    // Calling getToken() before isLoaded returns null → server 401 →
    // noisy console errors. Wait for the auth surface to be ready.
    if (!isLoaded || !isSignedIn) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError('No auth token');
        return;
      }
      const resp = await fetch('/api/agent/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        setError(`HTTP ${resp.status}`);
        setSessions([]);
        return;
      }
      const data = (await resp.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reload when the URL session changes (a new turn there may have
  // promoted that session to the top of the list).
  useEffect(() => {
    void load();
  }, [activeSessionId, load]);

  // Expose a manual refresh so the chat page can trigger it after a
  // new turn lands. Attached to window for cross-component reach
  // without a context — pragmatic since there's only one V2Sidebar
  // instance at a time.
  useEffect(() => {
    (window as unknown as { __v2RefreshSidebar?: () => void }).__v2RefreshSidebar = () => {
      void load();
    };
    return () => {
      delete (window as unknown as { __v2RefreshSidebar?: () => void }).__v2RefreshSidebar;
    };
  }, [load]);

  return (
    <aside
      className="w-72 shrink-0 border-r border-gray-100 bg-white flex flex-col h-screen"
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <div className="p-3 border-b border-gray-100">
        <button
          type="button"
          // The nonce matters: when the user is already on /v2 (the common
          // case — first chat of the day starts there), navigate('/v2')
          // alone is a no-op and the button appears dead. V2ChatPage
          // watches location.state.newChat and resets (fresh session id,
          // cleared messages/draft) whenever it sees a new nonce.
          onClick={() => navigate('/v2', { state: { newChat: Date.now() } })}
          className="w-full rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold py-2"
        >
          + New chat
        </button>
        <button
          type="button"
          onClick={() => navigate('/v2/draft')}
          className="w-full mt-2 rounded-lg border border-pink-300 text-pink-700 hover:bg-pink-50 text-sm font-semibold py-2"
        >
          Draft a document
        </button>
        <button
          type="button"
          onClick={() => navigate('/v2/magic')}
          className="w-full mt-2 rounded-lg border border-pink-300 text-pink-700 hover:bg-pink-50 text-sm font-semibold py-2"
        >
          Drafting Magic
        </button>
        <button
          type="button"
          onClick={() => navigate('/v2/verify')}
          className="w-full mt-2 rounded-lg border border-pink-300 text-pink-700 hover:bg-pink-50 text-sm font-semibold py-2"
        >
          Verify citations
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && sessions.length === 0 && (
          <div className="text-xs text-gray-400 px-2 py-3">Loading…</div>
        )}
        {error && (
          <div className="text-xs text-red-600 px-2 py-2">{error}</div>
        )}
        {!loading && !error && displayedSessions.length === 0 && (
          <div className="text-xs text-gray-400 px-2 py-3">
            No chats yet. Start one to see it here.
          </div>
        )}
        {displayedSessions.map((s) => {
          const isActive = s.session_id === activeSessionId;
          return (
            <button
              key={s.session_id}
              type="button"
              onClick={() => navigate(`/v2/${s.session_id}`)}
              className={`w-full text-left rounded-md px-2 py-2 mb-0.5 ${
                isActive
                  ? 'bg-pink-50 border border-pink-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
              title={s.session_id}
            >
              <div className="text-[13px] text-gray-900 truncate">
                {s.title || '(untitled session)'}
              </div>
              <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                <span>{s.message_count} msg</span>
                <span>·</span>
                <span>{formatRelative(s.last_active_at)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default V2Sidebar;
