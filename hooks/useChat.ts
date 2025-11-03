import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage, MessageRole, SourceMode } from '../types';
import { ChatService } from '../gemini/chatService';

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>('hybrid'); // Default to hybrid mode
  
  const chatServiceRef = useRef<ChatService | null>(null);
  const courtListenerApiKeyRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Fetch configuration from server-side API
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          // We don't expose the actual key, just whether it exists
          // The ChatService will handle API calls server-side
          courtListenerApiKeyRef.current = config.hasCourtListenerKey ? 'configured' : null;
        }
      } catch (error) {
        console.error('Failed to fetch config:', error);
        courtListenerApiKeyRef.current = null;
      }
    };

    const initializeChat = async () => {
      try {
        await fetchConfig();
        chatServiceRef.current = new ChatService(courtListenerApiKeyRef.current);
        
        const initialText = 'Hello! I\'m your California law research assistant. I can help you with questions about California statutes, case law, and legal research. What would you like to know?';

      setMessages([
        {
          id: 'initial-bot-message',
          role: MessageRole.BOT,
          text: initialText,
          // No sourceMode - welcome message doesn't need mode badge
        },
      ]);
    } catch (error) {
      console.error("Failed to initialize ChatService:", error);
      const text = error instanceof Error ? error.message : "An unknown error occurred.";
      setMessages([{
          id: 'init-error-message',
          role: MessageRole.BOT,
          text: `Critical Error: Could not start the chat service. Please check your Gemini API key configuration and console for details.\nDetails: ${text}`
      }]);
    }
    };

    initializeChat();

    // Cleanup: cancel any pending requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);


  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !chatServiceRef.current) return;

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      console.log('🛑 Cancelling previous request...');
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: MessageRole.USER,
      text,
    };

    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsLoading(true);

    // Create a temporary bot message for streaming
    const botMessageId = `bot-${Date.now()}`;
    const initialBotMessage: ChatMessage = {
      id: botMessageId,
      role: MessageRole.BOT,
      text: '',
      sources: [],
      sourceMode,
    };

    // Add initial empty bot message
    setMessages(prevMessages => [...prevMessages, initialBotMessage]);

    try {
      // Build conversation history from messages (exclude the current user message just added)
      const conversationHistory = messages.map(msg => ({
        role: msg.role === MessageRole.USER ? 'user' : 'assistant',
        text: msg.text
      }));

      // Create streaming callbacks
      const streamCallbacks = {
        onToken: (token: string) => {
          console.log('📝 Received token:', token.substring(0, 50) + (token.length > 50 ? '...' : ''));
          // Update the bot message with new token
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.id === botMessageId
                ? { ...msg, text: msg.text + token }
                : msg
            )
          );
        },
        onComplete: (fullText: string) => {
          console.log('✅ Streaming completed. Total length:', fullText.length);
        },
        onMetadata: (metadata: any) => {
          console.log('📊 Received metadata:', metadata);
        },
        onError: (error: Error) => {
          console.error('❌ Streaming error:', error);
        }
      };

      // Pass conversation history, source mode, abort signal, and stream callbacks to ChatService
      const botResponseData = await chatServiceRef.current.sendMessage(
        text,
        conversationHistory,
        sourceMode,
        abortController.signal,
        streamCallbacks
      );

      // Check if request was cancelled
      if (abortController.signal.aborted) {
        console.log('✅ Request was cancelled, ignoring response');
        // Remove the temporary message
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== botMessageId));
        return;
      }

      // Update the bot message with final data (sources, verification status, etc.)
      // Keep the streamed text if it exists, otherwise use botResponseData.text
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === botMessageId
            ? {
                ...msg,
                text: msg.text || botResponseData.text, // Preserve streamed text
                sources: botResponseData.sources,
                verificationStatus: botResponseData.verificationStatus,
                verificationReport: botResponseData.verificationReport,
                claims: botResponseData.claims,
                sourceMode: botResponseData.sourceMode,
                isCEBBased: botResponseData.isCEBBased,
                cebCategory: botResponseData.cebCategory,
              }
            : msg
        )
      );
    } catch (error: any) {
      // Don't show error for cancelled requests
      if (abortController.signal.aborted || error.message === 'Request cancelled') {
        console.log('✅ Request was cancelled');
        // Remove the temporary message
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== botMessageId));
        return;
      }

      console.error('Failed to get bot response:', error);
      // Update the bot message with error text
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === botMessageId
            ? {
                ...msg,
                text: "I'm sorry, but I'm having trouble connecting to my knowledge base right now. Please try again in a moment.",
              }
            : msg
        )
      );
    } finally {
      // Only clear loading if this request wasn't cancelled
      if (!abortController.signal.aborted) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [messages, sourceMode]); // Add sourceMode to dependencies

  return { 
    messages, 
    sendMessage, 
    isLoading,
    sourceMode,
    setSourceMode
  };
};