
import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage, MessageRole } from '../types';
import { ChatService } from '../gemini/chatService';

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Use a ref to hold the ChatService instance to keep it stable across re-renders
  const chatServiceRef = useRef<ChatService | null>(null);

  // Initialize the chat service and the initial message
  useEffect(() => {
    chatServiceRef.current = new ChatService();
    setMessages([
      {
        id: 'initial-bot-message',
        role: MessageRole.BOT,
        text: 'Hello! I am an AI assistant for California law. You can ask me general questions or about specific case law. How can I help?',
      },
    ]);
  }, []);


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
