import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage, MessageRole, ResponseMode, SourceMode, VerificationStatus } from '../types';
import { ChatService } from '../gemini/chatService';
import { PracticeArea } from '../components/SourceModeSelector';
import { useAuthFetch } from '../utils/authFetch.ts';

const SAVE_DEBOUNCE_MS = 1500;

const WELCOME_MESSAGE: ChatMessage = {
  id: 'initial-bot-message',
  role: MessageRole.BOT,
  text: "Hello! I'm your California law research assistant. I can help you with questions about California statutes, case law, and legal research. What would you like to know?",
};

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
      setMessages([WELCOME_MESSAGE]);
      return;
    }

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
        setMessages(loaded.length > 0 ? loaded : [WELCOME_MESSAGE]);
      })
      .catch(() => {
        if (!cancelled) setMessages([WELCOME_MESSAGE]);
      })
      .finally(() => {
        if (!cancelled) setChatLoading(false);
      });

    return () => { cancelled = true; };
  }, [chatId]);

  // -------------------------------------------------------------------------
  // Persist messages to backend (debounced)
  // -------------------------------------------------------------------------
  const scheduleSave = useCallback((updatedMessages: ChatMessage[], title?: string) => {
    if (!currentChatIdRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const id = currentChatIdRef.current;
      if (!id) return;
      try {
        const res = await authFetch(`/api/chats?id=${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: updatedMessages, title }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error('[scheduleSave] PUT failed:', res.status, body);
        }
      } catch (err) {
        console.error('[scheduleSave] PUT error:', err);
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

      const streamCallbacks = {
        onToken: (token: string) => {
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
        onComplete: (fullText: string) => {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === botMessageId ? { ...msg, text: fullText } : msg
            )
          );
        },
        onMetadata: (_metadata: any) => { /* no-op */ },
        onError: (error: Error) => {
          console.error('Streaming error:', error);
          if (accumulatedTextRef.current) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === botMessageId
                  ? { ...msg, text: msg.text + accumulatedTextRef.current }
                  : msg
              )
            );
          }
        },
      };

      const progressCallback = {
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
            // Determine title from first user message
            const userMsgs = updated.filter(m => m.role === MessageRole.USER);
            const title =
              userMsgs.length === 1
                ? userMsgs[0].text.slice(0, 60) + (userMsgs[0].text.length > 60 ? '…' : '')
                : undefined;
            // Schedule save outside the updater via a microtask
            setTimeout(() => scheduleSave(updated, title), 0);
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
      // Get updated messages outside state updater, then save
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
      setMessages(prev =>
        prev.map(msg =>
          msg.id === botMessageId
            ? {
                ...msg,
                text: "I'm sorry, but I'm having trouble connecting to my knowledge base right now. Please try again in a moment.",
              }
            : msg
        )
      );
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
