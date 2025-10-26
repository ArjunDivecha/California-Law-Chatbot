
import React from 'react';
import { useChat } from './hooks/useChat';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';

const App: React.FC = () => {
  // Read CourtListener API key from environment variables (set in Vercel)
  const courtListenerApiKey = process.env.COURTLISTENER_API_KEY || null;

  const { messages, sendMessage, isLoading } = useChat(courtListenerApiKey);

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
       <header className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center">
          <div className="flex items-center">
            <img src="https://picsum.photos/seed/lawbot/40/40" alt="CA Seal" className="w-10 h-10 rounded-full mr-4" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">California Law Chatbot</h1>
              <p className="text-sm text-gray-500">Your AI legal research assistant</p>
            </div>
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