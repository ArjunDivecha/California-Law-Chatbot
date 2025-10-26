
import React from 'react';
import { useChat } from './hooks/useChat';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import { Bot, User } from 'lucide-react';

const App: React.FC = () => {
  const { messages, sendMessage, isLoading } = useChat();

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
       <header className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center mr-4 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16.5l-4-4-4 4"/><path d="M12 22a7 7 0 0 0 7-7h-1a6 6 0 0 1-6 6v1z"/><path d="M12 2a7 7 0 0 0-7 7h1a6 6 0 0 1 6-6v-1z"/><path d="M5 16.5l4-4 4 4"/><path d="m2 12h7"/><path d="m15 12h7"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">California Law Chatbot</h1>
            <p className="text-sm text-gray-500">Your AI legal research assistant</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto flex flex-col">
          <ChatWindow messages={messages} isLoading={isLoading} />
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </main>
    </div>
  );
};

export default App;