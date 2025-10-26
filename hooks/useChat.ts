import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage, MessageRole } from '../types';
import { ChatService } from '../gemini/chatService';

export const useChat = (courtListenerApiKey: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const chatServiceRef = useRef<ChatService | null>(null);

  useEffect(() => {
    try {
      chatServiceRef.current = new ChatService(courtListenerApiKey);
      
      const initialText = courtListenerApiKey
        ? 'Hello! I am an AI assistant for California law. You can ask me general questions or about specific case law. How can I help?'
        : 'Hello! I am an AI assistant for California law. To enable the chat and search for specific court cases, please provide a CourtListener API key in the banner above.';

      setMessages([
        {
          id: 'initial-bot-message',
          role: MessageRole.BOT,
          text: initialText,
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
  }, [courtListenerApiKey]);


  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !chatServiceRef.current) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: MessageRole.USER,
      text,
    };

    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsLoading(true);

    try {
      const botResponseData = await chatServiceRef.current.sendMessage(text);
      
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: MessageRole.BOT,
        text: botResponseData.text,
        sources: botResponseData.sources,
      };
      setMessages(prevMessages => [...prevMessages, botMessage]);
    } catch (error) {
      console.error('Failed to get bot response:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: MessageRole.BOT,
        text: "I'm sorry, but I'm having trouble connecting to my knowledge base right now. Please try again in a moment.",
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { messages, sendMessage, isLoading };
};