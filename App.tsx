
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
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
import { SanitizerProvider, useSanitizer } from './hooks/useSanitizer';
import { ConfidentialityAttestation } from './components/ConfidentialityAttestation';
import TokenStoreModal from './components/TokenStoreModal';
import { DaemonSetupModal } from './components/DaemonSetupModal';
import { ShieldCheck, ShieldAlert, RotateCcw, KeyRound } from 'lucide-react';
import type { AppMode } from './types';

const AppHeader: React.FC<{
  sidebarOpen: boolean;
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  responseMode?: ReturnType<typeof useChat>['responseMode'];
  setResponseMode?: ReturnType<typeof useChat>['setResponseMode'];
  responseModeDisabled?: boolean;
  leftAccessory?: React.ReactNode;
}> = ({ sidebarOpen, appMode, onModeChange, responseMode, setResponseMode, responseModeDisabled = false, leftAccessory }) => {
  return (
    <header className="bg-white border-b border-gray-100 px-4 py-4 sm:px-6">
      <div className={`mx-auto flex flex-col items-center gap-3 sm:flex-row sm:justify-between ${sidebarOpen ? 'max-w-full' : 'max-w-4xl'}`}>
        <div className={`flex items-center justify-center gap-3 ${sidebarOpen ? '' : 'sm:pl-10'}`}>
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

        <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-end">
          {leftAccessory}
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
      <AppHeader
        sidebarOpen={sidebarOpen}
        appMode={appMode}
        onModeChange={handleModeChange}
        leftAccessory={<SanitizationBanner />}
      />
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
// SanitizationBanner — status indicator shown at the top of the chat header.
// Auto-unlocked on sign-in; no passphrase prompt. Click to reset the local
// token map (wipes the IndexedDB store, generates a fresh device key).
// ---------------------------------------------------------------------------
const SanitizationBanner: React.FC = () => {
  const { unlocked, ready, tokenCount, reset, initError, daemonStatus } = useSanitizer();
  const [modalOpen, setModalOpen] = useState(false);

  if (!ready) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
        <ShieldAlert size={12} /> Initializing…
      </span>
    );
  }

  if (!unlocked) {
    return (
      <span
        title={initError ?? 'Sanitization could not be initialized on this device.'}
        className="inline-flex items-center gap-1.5 rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-900"
      >
        <ShieldAlert size={12} /> Sanitization unavailable
      </span>
    );
  }

  const handleReset = async () => {
    if (
      !window.confirm(
        'Reset the local token map?\n\nThis wipes the encrypted store on this device. Prior tokenized chats will become un-rehydrate-able (tokens will show through instead of real names). Use this only if you want to start fresh.'
      )
    ) {
      return;
    }
    await reset();
  };

  // Daemon status indicator: green dot when OPF is healthy + model loaded;
  // amber when daemon up but model not loaded yet (warming); red when
  // unreachable (sends will fail-closed). Tooltip carries the detail.
  let daemonDot: React.ReactNode = null;
  let daemonTitle = '';
  if (daemonStatus.state === 'healthy') {
    if (daemonStatus.health.modelLoaded) {
      daemonDot = <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" aria-label="OPF ready" />;
      daemonTitle = `OPF detector ready (v${daemonStatus.health.version}). Model loaded; idle unload after ${daemonStatus.health.idleUnloadSeconds}s.`;
    } else {
      daemonDot = <span className="inline-block w-2 h-2 rounded-full bg-amber-400" aria-label="OPF warming" />;
      daemonTitle = `OPF daemon up; model not loaded. First detect call will trigger ~19s cold start.`;
    }
  } else if (daemonStatus.state === 'unreachable') {
    daemonDot = <span className="inline-block w-2 h-2 rounded-full bg-rose-500" aria-label="OPF unreachable" />;
    daemonTitle = `OPF detector unreachable: ${daemonStatus.error}. Sends will fail-closed.`;
  } else {
    daemonDot = <span className="inline-block w-2 h-2 rounded-full bg-slate-300" aria-label="OPF status unknown" />;
    daemonTitle = 'Probing OPF detector…';
  }

  return (
    <>
      <div className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
        <span title={daemonTitle} className="inline-flex items-center pl-0.5">{daemonDot}</span>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title={`${tokenCount} ${tokenCount === 1 ? 'entity' : 'entities'} in local map — click to view & edit.`}
          className="inline-flex items-center gap-1 rounded hover:bg-emerald-100 px-1"
        >
          <ShieldCheck size={12} />
          Sanitization · {tokenCount}
          <KeyRound size={10} className="opacity-60" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          title="Reset the local token map (wipes IndexedDB on this device)."
          className="rounded p-0.5 hover:bg-emerald-100"
        >
          <RotateCcw size={10} className="opacity-60" />
        </button>
      </div>
      <TokenStoreModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
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
        leftAccessory={<SanitizationBanner />}
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
          <DraftingMode onModeChange={() => handleModeChange('research')} />
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
// ---------------------------------------------------------------------------
// DaemonGate — shows setup modal when daemon is unreachable on first load.
// Lives inside SanitizerProvider so it can read daemonStatus.
// Only shows for signed-in users (the daemon is only needed for chat).
// ---------------------------------------------------------------------------
const DaemonGate: React.FC = () => {
  const { daemonStatus, ready } = useSanitizer();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // The public Drafting Magic preview is a shareable product demo. It should
  // render even when Safari cannot reach the user's local OPF daemon.
  if (location.pathname.startsWith('/drafting-magic-preview')) return null;

  // Wait until the first health probe completes before showing the modal,
  // so we don't flash it on every page load while the probe is in-flight.
  if (!ready || dismissed) return null;
  if (daemonStatus.state !== 'unreachable') return null;

  return <DaemonSetupModal onDismiss={() => setDismissed(true)} />;
};

// Root App
// ---------------------------------------------------------------------------
const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <ErrorBoundary>
      <SanitizerProvider>
        <DaemonGate />
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
                  <ConfidentialityAttestation />
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
          <Route path="/drafting-magic-preview" element={<StandaloneDraftingPage sidebarOpen={false} initialMode="magic" />} />
        </Routes>
      </SanitizerProvider>
    </ErrorBoundary>
  );
};

export default App;
