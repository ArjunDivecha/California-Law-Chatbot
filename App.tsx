
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { useAuthFetch } from './utils/authFetch.ts';

import { useChat } from './hooks/useChat';
import ChatWindow from './components/ChatWindow';
import ErrorBoundary from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { ModeSelector } from './components/ModeSelector';
import { ResponseModeToggle } from './components/ResponseModeToggle';
import { DraftingMode } from './components/drafting/DraftingMode';
import SignInPage from './components/SignInPage';
import type { AppMode } from './types';

// ---------------------------------------------------------------------------
// ChatPage — loaded at /c/:chatId
// ---------------------------------------------------------------------------
const ChatPage: React.FC<{ sidebarOpen: boolean }> = ({ sidebarOpen }) => {
  const { chatId } = useParams<{ chatId: string }>();
  const {
    messages,
    sendMessage,
    isLoading,
    chatLoading,
    responseMode,
    setResponseMode,
    sourceMode,
    setSourceMode,
  } = useChat(chatId);

  const [appMode, setAppMode] = useState<AppMode>('research');

  return (
    <div
      className={`flex flex-col h-screen transition-all duration-200 ${sidebarOpen ? 'md:pl-64' : ''}`}
      style={{ backgroundColor: '#FAFAF8', fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className={`mx-auto flex items-center justify-between ${sidebarOpen ? 'max-w-full' : 'max-w-4xl'}`}>
          {/* Logo — offset from hamburger button */}
          <div className={`flex items-center gap-3 ${sidebarOpen ? '' : 'pl-10'}`}>
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm">
              <img src="/Heart Favicon.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-semibold text-gray-900">California Law Chatbot</h1>
              <a
                href="https://www.femmeandfemmelaw.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-pink-500 hover:text-pink-600 hover:underline transition-colors"
              >
                femme & femme LLP
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {appMode === 'research' && (
              <ResponseModeToggle mode={responseMode} onModeChange={setResponseMode} disabled={isLoading} />
            )}
            <ModeSelector mode={appMode} onModeChange={setAppMode} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {appMode === 'research' ? (
          <div className={`h-full mx-auto flex flex-col ${sidebarOpen ? 'w-full px-6' : 'w-[85%]'}`}>
            {chatLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-gray-400 text-sm">Loading chat…</span>
              </div>
            ) : (
              <ChatWindow messages={messages} isLoading={isLoading} onSend={sendMessage} />
            )}
          </div>
        ) : (
          <DraftingMode onModeChange={() => setAppMode('research')} />
        )}
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// NewChatRedirect — POST /api/chats then redirect to /c/:id
// ---------------------------------------------------------------------------
const NewChatRedirect: React.FC = () => {
  const navigate = useNavigate();
  const authFetch = useAuthFetch();

  useEffect(() => {
    // Try to load the user's most recent chat; if none, create one
    authFetch('/api/chats?limit=1')
      .then(r => r.json())
      .then(data => {
        if (data.chats?.length > 0) {
          navigate(`/c/${data.chats[0].id}`, { replace: true });
        } else {
          return authFetch('/api/chats', { method: 'POST' })
            .then(r => r.json())
            .then(meta => navigate(`/c/${meta.id}`, { replace: true }));
        }
      })
      .catch(() => {
        // If auth/network fails, show a blank chat without a persistent ID
        navigate('/c/new', { replace: true });
      });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <span className="text-gray-400 text-sm">Loading…</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <ErrorBoundary>
      <Routes>
        {/* Sign-in (public) */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignInPage />} />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <>
              <SignedIn>
                <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
                <Routes>
                  <Route path="/" element={<NewChatRedirect />} />
                  <Route path="/c/:chatId" element={<ChatPage sidebarOpen={sidebarOpen} />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
};

export default App;
