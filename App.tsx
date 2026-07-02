/**
 * =============================================================================
 * App.tsx — root router for the California Law Chatbot (V4, single front end)
 * =============================================================================
 * WHAT THIS FILE DOES:
 *   Mounts the one and only front end: the V2 agent-loop UI. The bare root
 *   path (and any legacy V1 path like /c/:chatId) redirects into /v2, so there
 *   is exactly one link — https://california-law-chatbot-v2.vercel.app — and
 *   exactly one front end. The V1 UI (OpenRouter-era ChatPage/Sidebar/useChat)
 *   was deleted at the 2026-07-02 V1 purge; its last state is preserved in git
 *   history (tag archive/v1-final-wip-2026-07-01 and earlier).
 *
 *   Auth: Clerk gates all app routes in production; a DEV-only bypass lets the
 *   local Vite server render without sign-in (dead code in prod builds).
 *   SanitizerProvider installs the on-device privacy filter before anything
 *   can send client text.
 *
 * INPUT FILES:  none at runtime (React SPA entry; imported by index.tsx).
 * OUTPUT FILES: none.
 * =============================================================================
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';

import ErrorBoundary from './components/ErrorBoundary';
import SignInPage from './components/SignInPage';
import { V2ChatPage } from './components/v2/V2ChatPage';
import { V2DraftPage } from './components/v2/V2DraftPage';
import { V2Sidebar } from './components/v2/V2Sidebar';
import { V2VerifyPage } from './components/v2/V2VerifyPage';
import { V2DraftingMagicPage } from './components/v2/V2DraftingMagicPage';
import { SanitizerProvider } from './hooks/useSanitizer';

const SignedInShell: React.FC = () => (
  <div className="flex">
    <V2Sidebar />
    <div className="flex-1 min-w-0">
      <Routes>
        {/* ONE front end. Root and every legacy V1 path land on /v2. */}
        <Route path="/" element={<Navigate to="/v2" replace />} />
        <Route path="/c/:chatId" element={<Navigate to="/v2" replace />} />
        <Route path="/v2" element={<V2ChatPage />} />
        <Route path="/v2/draft" element={<V2DraftPage />} />
        <Route path="/v2/verify" element={<V2VerifyPage />} />
        <Route path="/v2/magic" element={<V2DraftingMagicPage />} />
        {/* /v2/:sessionId loads a past session — keep AFTER literal
            routes so /v2/draft, /v2/verify, /v2/magic win over the param. */}
        <Route path="/v2/:sessionId" element={<V2ChatPage />} />
        <Route path="*" element={<Navigate to="/v2" replace />} />
      </Routes>
    </div>
  </div>
);

const App: React.FC = () => (
  <ErrorBoundary>
    {/* SanitizerProvider opens the device-scoped IndexedDB token store
        and installs RealChatSanitizer as the active ChatSanitizer.
        Per 6th addendum (Option C): token map lives only on the
        attorney's device; never sent to the server. The provider
        renders children immediately with ready=false until init
        completes, so the rest of the app mounts without delay. */}
    <SanitizerProvider>
      <Routes>
        {/* Sign-in (public) */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignInPage />} />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            // DEV-ONLY auth bypass: on a local Vite dev server
            // (import.meta.env.DEV) we skip Clerk sign-in entirely so the
            // app loads for UI iteration without a passkey/OAuth dance.
            // This branch is dead code in any production build (DEV is
            // false), so it can never weaken prod auth.
            import.meta.env.DEV ? (
              <SignedInShell />
            ) : (
              <>
                <SignedIn>
                  <SignedInShell />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            )
          }
        />
      </Routes>
    </SanitizerProvider>
  </ErrorBoundary>
);

export default App;
