/**
 * Sidebar component — shows the user's past chats and controls for creating,
 * renaming, and deleting chats. Mirrors the ChatGPT sidebar UX.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { Sparkles } from 'lucide-react';
import { useAuthFetch } from '../utils/authFetch.ts';
import { deriveTitleFromRaw, getChatSanitizer } from '../services/sanitization/chatAdapter';

interface ChatMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const navigate = useNavigate();
  const { chatId: activeChatId } = useParams<{ chatId: string }>();
  const authFetch = useAuthFetch();

  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const fetchChats = useCallback(async () => {
    try {
      const res = await authFetch('/api/chats');  // list
      if (!res.ok) return;
      const data = await res.json();
      // Server-side titles are tokenized (post-Day-4.5). Rehydrate with
      // the local sanitizer for display. Pass-through today.
      const sanitizer = getChatSanitizer();
      const rehydrated = (data.chats ?? []).map((c: ChatMeta) => ({
        ...c,
        title: sanitizer.rehydrateMessage(c.title ?? ''),
      }));
      setChats(rehydrated);
    } catch {
      // silently fail — sidebar is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats, activeChatId]); // Refresh whenever active chat changes (new save)

  // Update title in-place when useChat reports a successful save.
  // The event carries the tokenized title (what the server now stores);
  // we rehydrate for display against the local sanitizer.
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, title } = (e as CustomEvent<{ id: string; title: string }>).detail;
      const display = getChatSanitizer().rehydrateMessage(title ?? '');
      setChats(prev => prev.map(c => c.id === id ? { ...c, title: display } : c));
    };
    window.addEventListener('chat-saved', handler);
    return () => window.removeEventListener('chat-saved', handler);
  }, []);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleNewChat = async () => {
    try {
      const res = await authFetch('/api/chats', { method: 'POST' });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[Sidebar] New chat failed:', res.status, body);
        return;
      }
      const meta: ChatMeta = await res.json();
      if (!meta.id) {
        console.error('[Sidebar] New chat response missing id:', meta);
        return;
      }
      setChats(prev => [meta, ...prev]);
      navigate(`/c/${meta.id}`);
    } catch (err) {
      console.error('[Sidebar] New chat error:', err);
    }
  };

  const handleDelete = async (chatId: string) => {
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;
    try {
      await authFetch(`/api/chats?id=${chatId}`, { method: 'DELETE' });
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (activeChatId === chatId) navigate('/');
    } catch {
      // ignore
    }
    setMenuOpenId(null);
  };

  const startRename = (chat: ChatMeta) => {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
    setMenuOpenId(null);
  };

  const commitRename = async (chatId: string) => {
    const rawTitle = renameValue.trim();
    if (!rawTitle) { setRenamingId(null); return; }
    try {
      // Tokenize what goes to the server; keep the raw string for local display.
      const tokenizedTitle = await deriveTitleFromRaw(rawTitle);
      const res = await authFetch(`/api/chats?id=${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: tokenizedTitle }),
      });
      if (res.ok) {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: rawTitle } : c));
      }
    } catch {
      // ignore
    }
    setRenamingId(null);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      {/* Toggle button (always visible) */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-50 border-r border-gray-200 flex flex-col z-40 transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <span className="font-semibold text-gray-800 text-sm">Chats</span>
        </div>

        {/* New chat */}
        <div className="px-3 py-2">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New chat
          </button>
          <button
            onClick={() => navigate('/drafting-magic')}
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-700 transition-colors"
          >
            <Sparkles size={15} />
            Drafting Magic
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {loading ? (
            <p className="text-xs text-gray-400 px-3 py-2">Loading…</p>
          ) : chats.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2">No chats yet</p>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                className={`group relative flex items-center rounded-lg mb-0.5 ${
                  activeChatId === chat.id ? 'bg-gray-200' : 'hover:bg-gray-100'
                }`}
              >
                {renamingId === chat.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(chat.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(chat.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="flex-1 text-sm px-3 py-2 bg-white border border-pink-300 rounded-lg outline-none"
                  />
                ) : (
                  <>
                    <button
                      className="flex-1 text-left px-3 py-2 text-sm text-gray-700 truncate"
                      onClick={() => navigate(`/c/${chat.id}`)}
                    >
                      {chat.title}
                    </button>

                    {/* 3-dot menu */}
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 rounded hover:bg-gray-300 transition-opacity"
                      onClick={e => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === chat.id ? null : chat.id);
                      }}
                      aria-label="Chat options"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                      </svg>
                    </button>

                    {menuOpenId === chat.id && (
                      <div className="absolute right-1 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-36">
                        <button
                          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => startRename(chat)}
                        >
                          Rename
                        </button>
                        <button
                          className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(chat.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer: user avatar + sign out */}
        <div className="border-t border-gray-200 px-4 py-3 flex items-center gap-3">
          <UserButton afterSignOutUrl="/sign-in" />
          <span className="text-xs text-gray-500">Account</span>
        </div>
      </aside>
    </>
  );
};
