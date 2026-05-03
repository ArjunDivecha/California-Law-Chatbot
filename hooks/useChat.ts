import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage, MessageRole, ResponseMode, SourceMode, VerificationStatus } from '../types';
import { ChatService } from '../gemini/chatService';
import { PracticeArea } from '../components/SourceModeSelector';
import { useAuthFetch } from '../utils/authFetch.ts';

const SAVE_DEBOUNCE_MS = 1500;
const LOCAL_DRAFT_PREFIX = 'cal-law-chat-draft:';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'initial-bot-message',
  role: MessageRole.BOT,
  text: "Hello! I'm your California law research assistant. I can help you with questions about California statutes, case law, and legal research. What would you like to know?",
};

interface LocalChatDraft {
  messages: ChatMessage[];
  title?: string;
  updatedAt: number;
}

function draftKey(chatId: string): string {
  return `${LOCAL_DRAFT_PREFIX}${chatId}`;
}

function readLocalDraft(chatId: string): LocalChatDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(draftKey(chatId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalChatDraft;
    if (!Array.isArray(parsed?.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalDraft(chatId: string, messages: ChatMessage[], title?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: LocalChatDraft = { messages, title, updatedAt: Date.now() };
    window.localStorage.setItem(draftKey(chatId), JSON.stringify(payload));
  } catch {
    // Ignore localStorage quota/privacy errors; server save still handles persistence.
  }
}

function clearLocalDraft(chatId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(draftKey(chatId));
  } catch {
    // Ignore storage errors.
  }
}

export const useChat = (chatId?: string) => {
  const navigate = useNavigate();
  const authFetch = useAuthFetch();

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>('hybrid');
  const [responseMode, setResponseMode] = useState<ResponseMode>('accuracy');
  const [practiceArea, setPracticeArea] = useState<PracticeArea>('');

  const chatServiceRef = useRef<ChatService | null>(null);
  const courtListenerApiKeyRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track current chatId in a ref so closures always see the latest value
  const currentChatIdRef = useRef<string | undefined>(chatId);
  useEffect(() => { currentChatIdRef.current = chatId; }, [chatId]);
  // Track which chatId the current `messages` state actually belongs to.
  // Prevents the local-draft safety-net from writing stale messages under a new chatId during navigation.
  const messagesForChatIdRef = useRef<string | undefined>(undefined);

  // -------------------------------------------------------------------------
  // Initialise ChatService once
  // -------------------------------------------------------------------------
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const config = await res.json();
          courtListenerApiKeyRef.current = config.hasCourtListenerKey ? 'configured' : null;
        }
      } catch { /* ignore */ }
      chatServiceRef.current = new ChatService(courtListenerApiKeyRef.current);
    };
    init();

    return () => {
      abortControllerRef.current?.abort();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Load chat from backend when chatId changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!chatId) {
      messagesForChatIdRef.current = undefined;
      setMessages([WELCOME_MESSAGE]);
      return;
    }

    // If sendMessage just POST-created this chat and already set ownership, skip the reset/reload —
    // the messages state is already correct (user message + bot response in progress).
    if (messagesForChatIdRef.current === chatId) {
      return;
    }

    // Navigating to a different chat: invalidate ownership, reset display, then load from server.
    messagesForChatIdRef.current = undefined;
    setMessages([WELCOME_MESSAGE]);

    let cancelled = false;
    setChatLoading(true);

    authFetch(`/api/chats?id=${chatId}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        const loaded: ChatMessage[] = data.messages ?? [];
        const localDraft = readLocalDraft(chatId);
        const remoteUpdatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : 0;
        const shouldPreferLocalDraft =
          !!localDraft?.messages?.length &&
          (localDraft.updatedAt > remoteUpdatedAt || localDraft.messages.length > loaded.length);
        setMessages(shouldPreferLocalDraft
          ? localDraft.messages
          : (loaded.length > 0 ? loaded : [WELCOME_MESSAGE]));
        messagesForChatIdRef.current = chatId;
      })
      .catch(() => {
        if (cancelled) return;
        const localDraft = readLocalDraft(chatId);
        setMessages(localDraft?.messages?.length ? localDraft.messages : [WELCOME_MESSAGE]);
        messagesForChatIdRef.current = chatId;
      })
      .finally(() => {
        if (!cancelled) setChatLoading(false);
      });

    return () => { cancelled = true; };
  }, [chatId]);

  // Local safety net: mirror the latest chat state so text survives transient save failures.
  useEffect(() => {
    const id = currentChatIdRef.current;
    if (!id) return;
    if (messagesForChatIdRef.current !== id) return;  // messages haven't been loaded for this chat yet
    if (messages.length === 1 && messages[0].id === WELCOME_MESSAGE.id) return;
    writeLocalDraft(id, messages);
  }, [messages, chatId]);

  // -------------------------------------------------------------------------
  // Persist messages to backend (debounced)
  // -------------------------------------------------------------------------
  const scheduleSave = useCallback((updatedMessages: ChatMessage[]) => {
    if (!currentChatIdRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const id = currentChatIdRef.current;
      if (!id) return;
      writeLocalDraft(id, updatedMessages);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await authFetch(`/api/chats?id=${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: updatedMessages }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error('[scheduleSave] PUT failed:', res.status, body);
          return;
        }
        clearLocalDraft(id);
        // Notify sidebar of the server-canonical title (server may have auto-titled on first save)
        try {
          const meta = await res.json();
          if (meta?.title) {
            window.dispatchEvent(new CustomEvent('chat-saved', { detail: { id, title: meta.title } }));
          }
        } catch { /* response parse is best-effort */ }
      } catch (err: any) {
        console.error('[scheduleSave] PUT error:', err?.message ?? err);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [authFetch]);

  // -------------------------------------------------------------------------
  // Send a message
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !chatServiceRef.current) return;

    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // If this is a brand-new conversation (no chatId yet), create one first
    let activeChatId = currentChatIdRef.current;
    if (!activeChatId) {
      try {
        const title = text.slice(0, 60) + (text.length > 60 ? '…' : '');
        const res = await authFetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
        if (res.ok) {
          const meta = await res.json();
          activeChatId = meta.id;
          currentChatIdRef.current = meta.id;
          // Claim ownership: messages we're about to append belong to this new chatId.
          messagesForChatIdRef.current = meta.id;
          // Navigate to the new chat URL (replaces current history entry so
          // back button doesn't loop)
          navigate(`/c/${meta.id}`, { replace: true });
        }
      } catch { /* proceed without persistence */ }
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: MessageRole.USER,
      text,
    };

    const botMessageId = `bot-${Date.now()}`;
    const initialBotMessage: ChatMessage = {
      id: botMessageId,
      role: MessageRole.BOT,
      text: '',
      sources: [],
      sourceMode,
      responseMode,
    };

    setMessages(prev => [...prev, userMessage, initialBotMessage]);
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role === MessageRole.USER ? 'user' : 'assistant',
        text: msg.text,
      }));

      const lastUpdateRef = { current: Date.now() };
      const accumulatedTextRef = { current: '' };

      const progressCallback = {
        onToken: (token: string) => {
          // Speed mode streaming — show tokens as they arrive
          setIsLoading(false);
          accumulatedTextRef.current += token;
          const now = Date.now();
          if (now - lastUpdateRef.current > 50) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === botMessageId
                  ? { ...msg, text: msg.text + accumulatedTextRef.current }
                  : msg
              )
            );
            accumulatedTextRef.current = '';
            lastUpdateRef.current = now;
          }
        },
        onInitialResponse: (response: any) => {
          setIsLoading(false);
          setMessages(prev =>
            prev.map(msg =>
              msg.id === botMessageId
                ? {
                    ...msg,
                    text: response.text,
                    sources: response.sources,
                    verificationStatus: response.verificationStatus as VerificationStatus,
                    claims: response.claims,
                    sourceMode: response.sourceMode,
                    responseMode: response.responseMode,
                    isCEBBased: response.isCEBBased,
                    cebCategory: response.cebCategory,
                  }
                : msg
            )
          );
        },
        onVerificationComplete: (response: any) => {
          setMessages(prev => {
            const updated = prev.map(msg =>
              msg.id === botMessageId
                ? {
                    ...msg,
                    text: response.text,
                    verificationStatus: response.verificationStatus,
                    verificationReport: response.verificationReport,
                  }
                : msg
            );
            setTimeout(() => scheduleSave(updated), 0);
            return updated;
          });
        },
      };

      const botResponseData = await chatServiceRef.current.sendMessage(
        text,
        conversationHistory,
        responseMode,
        sourceMode,
        abortController.signal,
        progressCallback
      );

      if (abortController.signal.aborted) {
        setMessages(prev => prev.filter(msg => msg.id !== botMessageId));
        return;
      }

      const finalMessages = (prev: ChatMessage[]) => prev.map(msg =>
        msg.id === botMessageId
          ? {
              ...msg,
              text: msg.text || botResponseData.text,
              sources: botResponseData.sources,
              verificationStatus: botResponseData.verificationStatus,
              verificationReport: botResponseData.verificationReport,
              claims: botResponseData.claims,
              sourceMode: botResponseData.sourceMode,
              responseMode: botResponseData.responseMode,
              isCEBBased: botResponseData.isCEBBased,
              cebCategory: botResponseData.cebCategory,
            }
          : msg
      );
      setMessages(prev => {
        const updated = finalMessages(prev);
        setTimeout(() => scheduleSave(updated), 0);
        return updated;
      });
    } catch (error: any) {
      if (abortController.signal.aborted || error.message === 'Request cancelled') {
        setMessages(prev => prev.filter(msg => msg.id !== botMessageId));
        return;
      }
      console.error('Failed to get bot response:', error);
      setMessages(prev => {
        const updated = prev.map(msg =>
          msg.id === botMessageId
            ? {
                ...msg,
                text: "I'm sorry, but I'm having trouble connecting to my knowledge base right now. Please try again in a moment.",
              }
            : msg
        );
        // Save even on error so the user message is persisted
        setTimeout(() => scheduleSave(updated), 0);
        return updated;
      });
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [messages, responseMode, sourceMode, navigate, scheduleSave]);

  return {
    messages,
    sendMessage,
    isLoading,
    chatLoading,
    sourceMode,
    setSourceMode,
    responseMode,
    setResponseMode,
    practiceArea,
    setPracticeArea,
  };
};
