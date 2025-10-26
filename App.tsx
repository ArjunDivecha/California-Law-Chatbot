
import React, { useState, useEffect } from 'react';
import { useChat } from './hooks/useChat';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';

const App: React.FC = () => {
  const [courtListenerApiKey, setCourtListenerApiKey] = useState<string | null>(null);
  const [tempApiKey, setTempApiKey] = useState('');

  useEffect(() => {
    const storedKey = localStorage.getItem('courtlistener_api_key');
    if (storedKey) {
      setCourtListenerApiKey(storedKey);
    }
  }, []);

  const { messages, sendMessage, isLoading } = useChat(courtListenerApiKey);

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      const trimmedKey = tempApiKey.trim();
      localStorage.setItem('courtlistener_api_key', trimmedKey);
      setCourtListenerApiKey(trimmedKey);
      setTempApiKey(''); // Clear the input after saving
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
       <header className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <img src="https://picsum.photos/seed/lawbot/40/40" alt="CA Seal" className="w-10 h-10 rounded-full mr-4" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">California Law Chatbot</h1>
              <p className="text-sm text-gray-500">Your AI legal research assistant</p>
            </div>
          </div>
        </div>
      </header>

      {!courtListenerApiKey && (
        <div className="bg-yellow-100 border-b border-yellow-300 p-3 text-center text-sm text-yellow-800 shadow-md">
          <div className="max-w-4xl mx-auto">
            <p className="font-semibold">CourtListener API Key Required for Case Law Search</p>
            <p className="mb-2">
              To search specific cases, please enter your API key. Get a free key from the <a href="https://www.courtlistener.com/api/register/" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-900 font-medium">CourtListener Website</a>.
            </p>
            <div className="flex justify-center items-center space-x-2 mt-2">
              <input 
                type="password" 
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="px-2 py-1 text-sm border border-yellow-400 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 w-64"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              />
              <button
                onClick={handleSaveApiKey}
                className="px-3 py-1 text-sm font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save Key
              </button>
            </div>
            <p className="text-xs text-yellow-700 mt-1">Your key is stored only in your browser's local storage.</p>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto flex flex-col">
          <ChatWindow messages={messages} isLoading={isLoading} />
          <ChatInput onSend={sendMessage} disabled={isLoading || !courtListenerApiKey} />
        </div>
      </main>
    </div>
  );
};

export default App;