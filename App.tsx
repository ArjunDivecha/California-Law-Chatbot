
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
import { DraftingMagicPage } from './components/draftingMagic/DraftingMagicPage';
import SignInPage from './components/SignInPage';
import type { AppMode } from './types';

const AppHeader: React.FC<{
  sidebarOpen: boolean;
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  responseMode?: ReturnType<typeof useChat>['responseMode'];
  setResponseMode?: ReturnType<typeof useChat>['setResponseMode'];
  responseModeDisabled?: boolean;
}> = ({ sidebarOpen, appMode, onModeChange, responseMode, setResponseMode, responseModeDisabled = false }) => {
  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4">
      <div className={`mx-auto flex items-center justify-between gap-4 ${sidebarOpen ? 'max-w-full' : 'max-w-4xl'}`}>
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

        <div className="flex min-w-0 items-center gap-2">
          {appMode === 'research' && responseMode && setResponseMode && (
            <ResponseModeToggle mode={responseMode} onModeChange={setResponseMode} disabled={responseModeDisabled} />
          )}
          <ModeSelector mode={appMode} onModeChange={onModeChange} />
        </div>
      </div>
    </header>
  );
};

const StandaloneDraftingPage: React.FC<{ sidebarOpen: boolean; initialMode: Extract<AppMode, 'drafting' | 'magic'> }> = ({
  sidebarOpen,
  initialMode,
}) => {
  const navigate = useNavigate();
  const [appMode, setAppMode] = useState<AppMode>(initialMode);

  const handleModeChange = (mode: AppMode) => {
    setAppMode(mode);
    if (mode === 'research') navigate('/');
    if (mode === 'drafting') navigate('/drafting');
    if (mode === 'magic') navigate('/drafting-magic');
  };

  useEffect(() => {
    setAppMode(initialMode);
  }, [initialMode]);

  return (
    <div
      className={`flex flex-col h-screen transition-all duration-200 ${sidebarOpen ? 'md:pl-64' : ''}`}
      style={{ backgroundColor: '#FAFAF8', fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <AppHeader sidebarOpen={sidebarOpen} appMode={appMode} onModeChange={handleModeChange} />
      <main className="flex-1 overflow-hidden">
        {appMode === 'drafting' ? (
          <DraftingMode onModeChange={() => handleModeChange('research')} />
        ) : (
          <DraftingMagicPage />
        )}
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ChatPage — loaded at /c/:chatId
// ---------------------------------------------------------------------------
const ChatPage: React.FC<{ sidebarOpen: boolean }> = ({ sidebarOpen }) => {
  const navigate = useNavigate();
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
  const handleModeChange = (mode: AppMode) => {
    setAppMode(mode);
    if (mode === 'drafting') navigate('/drafting');
    if (mode === 'magic') navigate('/drafting-magic');
  };

  return (
    <div
      className={`flex flex-col h-screen transition-all duration-200 ${sidebarOpen ? 'md:pl-64' : ''}`}
      style={{ backgroundColor: '#FAFAF8', fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <AppHeader
        sidebarOpen={sidebarOpen}
        appMode={appMode}
        onModeChange={handleModeChange}
        responseMode={responseMode}
        setResponseMode={setResponseMode}
        responseModeDisabled={isLoading}
      />

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
        ) : appMode === 'drafting' ? (
          <DraftingMode onModeChange={() => setAppMode('research')} />
        ) : (
          <DraftingMagicPage />
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
      .then(async r => {
        if (!r.ok) throw new Error(`List failed: ${r.status}`);
        return r.json();
      })
      .then(async data => {
        if (data.chats?.length > 0) {
          navigate(`/c/${data.chats[0].id}`, { replace: true });
        } else {
          const r2 = await authFetch('/api/chats', { method: 'POST' });
          if (!r2.ok) throw new Error(`Create failed: ${r2.status}`);
          const meta = await r2.json();
          if (!meta.id) throw new Error('No id in response');
          navigate(`/c/${meta.id}`, { replace: true });
        }
      })
      .catch((err) => {
        console.error('[NewChatRedirect]', err);
        // Stay on / and show loading — don't navigate to /c/undefined
      });
  }, [navigate, authFetch]);

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
        <Route path="/drafting-magic-preview" element={<StandaloneDraftingPage sidebarOpen={false} initialMode="magic" />} />

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
                  <Route path="/drafting" element={<StandaloneDraftingPage sidebarOpen={sidebarOpen} initialMode="drafting" />} />
                  <Route
                    path="/drafting-magic"
                    element={<StandaloneDraftingPage sidebarOpen={sidebarOpen} initialMode="magic" />}
                  />
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
