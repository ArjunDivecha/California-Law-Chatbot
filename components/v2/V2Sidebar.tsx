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
import { useAuth, useUser } from '@clerk/clerk-react';
import { Plus, FileText, Wand2, CheckCircle } from 'lucide-react';
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

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const V2Sidebar: React.FC = () => {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
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
    <aside className="w-72 shrink-0 border-r border-surface-line2 bg-white flex flex-col h-screen font-sans">
      <div className="px-4 pt-5 pb-3.5 flex items-center gap-2.5">
        <img src="/dancingelephant.png" alt="" className="w-8 h-8 rounded-[9px]" />
        <span className="font-display text-[17px] font-semibold text-ink">DancingElephant</span>
      </div>

      <div className="px-3.5 pb-3.5 flex flex-col gap-2">
        <button
          type="button"
          // The nonce matters: when the user is already on /v2 (the common
          // case — first chat of the day starts there), navigate('/v2')
          // alone is a no-op and the button appears dead. V2ChatPage
          // watches location.state.newChat and resets (fresh session id,
          // cleared messages/draft) whenever it sees a new nonce.
          onClick={() => navigate('/v2', { state: { newChat: Date.now() } })}
          className="w-full flex items-center justify-center gap-2 rounded-[10px] bg-brand hover:bg-brand-deep text-white text-[13.5px] font-semibold py-2.5"
        >
          <Plus size={15} strokeWidth={2} />
          New chat
        </button>
      </div>

      <nav className="px-2.5 flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => navigate('/v2/draft')}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-ink-secondary hover:bg-surface-pill"
        >
          <FileText size={16} strokeWidth={1.5} />
          Draft a document
        </button>
        <button
          type="button"
          onClick={() => navigate('/v2/magic')}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-ink-secondary hover:bg-surface-pill"
        >
          <Wand2 size={16} strokeWidth={1.5} />
          Drafting Magic
        </button>
        <button
          type="button"
          onClick={() => navigate('/v2/verify')}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-ink-secondary hover:bg-surface-pill"
        >
          <CheckCircle size={16} strokeWidth={1.5} />
          Verify citations
        </button>
      </nav>

      <div className="px-[18px] pt-[18px] pb-2 text-[11px] font-semibold text-ink-faint tracking-[.05em] uppercase">
        Recent
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-0">
        {loading && sessions.length === 0 && (
          <div className="text-xs text-ink-faint px-2.5 py-3">Loading…</div>
        )}
        {error && (
          <div className="text-xs text-dered px-2.5 py-2">{error}</div>
        )}
        {!loading && !error && displayedSessions.length === 0 && (
          <div className="text-[13px] text-ink-faint px-2.5 py-2">
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
              className={`w-full text-left rounded-md px-2.5 py-2 mb-0.5 border ${
                isActive
                  ? 'bg-brand-tint border-brand-line'
                  : 'hover:bg-surface-pill border-transparent'
              }`}
              title={s.session_id}
            >
              <div className="text-[13px] text-ink truncate">
                {s.title || '(untitled session)'}
              </div>
              <div className="text-[11px] text-ink-faint flex items-center gap-2 mt-0.5">
                <span>{s.message_count} messages</span>
                <span>·</span>
                <span>{formatRelative(s.last_active_at)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-[18px] py-3.5 border-t border-surface-line2 flex items-center gap-2.5">
        <div className="w-[28px] h-[28px] rounded-full bg-brand-tint text-brand flex items-center justify-center text-xs font-semibold">
          {getInitials(user?.fullName)}
        </div>
        <div className="text-[12.5px] font-medium text-ink-secondary truncate">
          {user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Account'}
        </div>
      </div>
    </aside>
  );
};

export default V2Sidebar;
