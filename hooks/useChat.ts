import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage, MessageRole, ResponseMode, SourceMode, VerificationStatus } from '../types';
import { ChatService } from '../gemini/chatService';
import { PracticeArea } from '../components/SourceModeSelector';
import { useAuthFetch } from '../utils/authFetch.ts';
import {
  deriveTitleFromRaw,
  getChatSanitizer,
  presavePiiScan,
  rehydrateMessagesForDisplay,
  tokenizeForWire,
  tokenizeMessagesForSave,
} from '../services/sanitization/chatAdapter';

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
        console.log('[useChat] GET', { chatId, messagesLen: data.messages?.length ?? 0, _debug: data._debug });
        // Server stores tokenized content. Rehydrate against the local
        // sanitizer's token map before display. Today (pre-Day-7) the
        // adapter is a pass-through — no change from existing behavior.
        const loaded: ChatMessage[] = rehydrateMessagesForDisplay(data.messages ?? []);
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
  const scheduleSave = useCallback((updatedMessages: ChatMessage[], title?: string) => {
    console.log('[scheduleSave] called', { id: currentChatIdRef.current, msgCount: updatedMessages.length });
    if (!currentChatIdRef.current) { console.warn('[scheduleSave] no chatId, skipping'); return; }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const id = currentChatIdRef.current;
      console.log('[scheduleSave] timer fired', { id, msgCount: updatedMessages.length });
      if (!id) { console.warn('[scheduleSave] timer fired but no id'); return; }
      writeLocalDraft(id, updatedMessages, title);
      try {
        console.log('[scheduleSave] calling authFetch PUT...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => { controller.abort(); console.error('[scheduleSave] authFetch timed out after 15s'); }, 15000);
        // Tokenize every message and the title before they leave the
        // browser. With the pass-through adapter this is a no-op; with
        // the Day-7 real sanitizer, Upstash + Blob receive tokens only.
        const tokenizedMessages = await tokenizeMessagesForSave(updatedMessages);
        const tokenizedTitle = title ? await deriveTitleFromRaw(title) : undefined;

        // Day 6.5 pre-save scan — fail fast before the network round-trip
        // if the already-tokenized payload still contains raw PII
        // (client-side tokenizer bug or not-yet-unlocked adapter).
        const presave = presavePiiScan({ title: tokenizedTitle, messages: tokenizedMessages });
        if (!presave.clean) {
          console.warn(
            `[scheduleSave] presave-pii-detected categories=${JSON.stringify(presave.categories)} dirty=${JSON.stringify(presave.dirtyIndexes)} — save aborted, local draft retained`
          );
          // Keep the local draft so the attorney's work isn't lost while
          // they re-sanitize. Don't round-trip — the server backstop
          // would reject with 400 anyway.
          return;
        }

        const res = await authFetch(`/api/chats?id=${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: tokenizedMessages, title: tokenizedTitle }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log('[scheduleSave] PUT response', res.status);
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error('[scheduleSave] PUT failed:', res.status, body);
          return;
        }
        clearLocalDraft(id);
        console.log('[scheduleSave] PUT ok, local draft cleared');
        // Notify sidebar so it can update the title in-place without a full re-fetch.
        // We ship the *tokenized* title — that's what the server now stores, and
        // the sidebar rehydrates on display.
        if (tokenizedTitle) {
          window.dispatchEvent(new CustomEvent('chat-saved', { detail: { id, title: tokenizedTitle } }));
        }
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
        // Title is tokenized via the chat sanitizer adapter before hitting Redis.
        const title = await deriveTitleFromRaw(text);
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

    // Speed mode is for general legal research, not client work — bypass
    // the entire sanitization pipeline. No tokenization, no detection,
    // no token-store updates. Wire gets the raw text. The attorney is
    // responsible for keeping client info out of this mode (the UI
    // surfaces the active mode prominently).
    //
    // Accuracy mode runs the full OPF-driven tokenize-for-wire path and
    // tags the user message with the detector that was used.
    const sanitizer = getChatSanitizer();
    const isSpeedMode = responseMode === 'speed';

    let sanitizedText: string;
    let tokenizedHistory: Array<{ role: string; text: string; usedOpf: boolean }>;
    let sanitizationMethod: 'opf' | 'heuristic' | undefined;

    if (isSpeedMode) {
      sanitizedText = text;
      tokenizedHistory = messages.map((msg) => ({
        role: msg.role === MessageRole.USER ? 'user' : 'assistant',
        text: msg.text,
        usedOpf: false,
      }));
      sanitizationMethod = undefined; // No sanitization marker in Speed mode
    } else {
      // Tokenize the new prompt AND the conversation history through the
      // OPF-driven path BEFORE any rendering, so the user message bubble
      // can be tagged with the correct sanitization method on first paint.
      //
      // tokenizeForWire returns spans from OPF when the daemon is healthy
      // and falls back to the local heuristic detector when unreachable.
      // If any single tokenize call falls back, the whole send is tagged
      // 'heuristic' since the wire payload includes both the new prompt
      // and the history.
      const wire = await tokenizeForWire(text);
      sanitizedText = wire.sanitized;
      tokenizedHistory = await Promise.all(
        messages.map(async (msg) => {
          const r = await tokenizeForWire(msg.text);
          return {
            role: msg.role === MessageRole.USER ? 'user' : 'assistant',
            text: r.sanitized,
            usedOpf: r.usedOpf,
          };
        })
      );
      const allUsedOpf = wire.usedOpf && tokenizedHistory.every((h) => h.usedOpf);
      sanitizationMethod = allUsedOpf ? 'opf' : 'heuristic';
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: MessageRole.USER,
      text,
      ...(sanitizationMethod ? { sanitizationMethod } : {}),
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
      // Strip the usedOpf flag — chatService.sendMessage takes the public shape.
      const conversationHistory = tokenizedHistory.map(({ role, text }) => ({ role, text }));

      const lastUpdateRef = { current: Date.now() };
      const accumulatedTextRef = { current: '' };

      const progressCallback = {
        onToken: (token: string) => {
          // Speed mode streaming — show tokens as they arrive. Rehydrate
          // each token chunk so any CLIENT_001 the model produced shows
          // up as the real name in the UI.
          setIsLoading(false);
          accumulatedTextRef.current += sanitizer.rehydrateMessage(token);
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
                    text: sanitizer.rehydrateMessage(response.text),
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
          console.log('[onVerificationComplete] fired', { chatId: currentChatIdRef.current });
          setMessages(prev => {
            const updated = prev.map(msg =>
              msg.id === botMessageId
                ? {
                    ...msg,
                    text: sanitizer.rehydrateMessage(response.text),
                    verificationStatus: response.verificationStatus,
                    verificationReport: response.verificationReport,
                  }
                : msg
            );
            // Determine title from first user message
            const firstUser = updated.find(m => m.role === MessageRole.USER);
            // Pass raw full text; scheduleSave tokenizes first then slices.
            const title = firstUser?.text;
            // Schedule save outside the updater via a microtask
            setTimeout(() => scheduleSave(updated, title), 0);
            return updated;
          });
        },
      };

      const botResponseData = await chatServiceRef.current.sendMessage(
        sanitizedText,
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
              text: msg.text || sanitizer.rehydrateMessage(botResponseData.text),
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
        const firstUser = updated.find(m => m.role === MessageRole.USER);
        // Pass raw full text; scheduleSave tokenizes first then slices.
        const title = firstUser?.text;
        setTimeout(() => scheduleSave(updated, title), 0);
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
        const firstUser = updated.find(m => m.role === MessageRole.USER);
        // Pass raw full text; scheduleSave tokenizes first then slices.
        const title = firstUser?.text;
        // Save even on error so the user message is persisted
        setTimeout(() => scheduleSave(updated, title), 0);
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
