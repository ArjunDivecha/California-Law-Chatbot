# Persistent Chat History (ChatGPT-style)

## Context

The California Law Chatbot currently stores chat state only in React `useState` (`hooks/useChat.ts:7`). Every refresh discards the conversation — there is no database, no user identity, no routing, and no sidebar. The user wants ChatGPT-desktop-style persistence: a sidebar of past chats, the ability to resume any past chat, accessible from any browser on the web.

**Decisions already confirmed:**
- **Auth**: Google OAuth via Clerk (Vite-friendly, free tier 10k MAU, clean `<SignIn>` + `<UserButton>` components)
- **Storage**: Vercel Blob (message bodies) + Vercel KV (chat index/metadata)
- **Branch**: Build on `main` (orthogonal to the in-progress Google GenAI migration)

## Data Model

### Vercel KV — index & metadata
- `user:{userId}:chats` → **sorted set**, score = `updatedAt` ms epoch, member = `chatId`. Enables `ZREVRANGE` for "my chats, newest first, paginated".
- `chat:{chatId}:meta` → JSON string: `{ id, userId, title, createdAt, updatedAt, sourceMode, responseMode, messageCount }`

### Vercel Blob — message bodies
- `chats/{userId}/{chatId}.json` → serialized `ChatMessage[]` (private, accessed only via our API; userId in path double-locks ownership).
- Atomic overwrite on each save (chat payloads stay small — ~5–100 KB for typical sessions).

### Ownership enforcement
1. Clerk middleware extracts `userId` from session; reject with 401 if absent.
2. API handlers read `chat:{chatId}:meta`, verify `meta.userId === session.userId`, else 403.
3. Blob path includes `userId` — a leaked `chatId` still can't cross to another account's namespace.

## New / Modified Files

### New
- `utils/auth.ts` — Clerk server helper: `getUserId(req): Promise<string>` (throws 401 on missing session).
- `utils/chatStore.ts` — CRUD helpers: `createChat`, `listChats`, `loadChat`, `saveChat`, `deleteChat`, `renameChat`. Uses `@vercel/kv` + `@vercel/blob`.
- `api/chats/index.ts` — `GET` (list), `POST` (create).
- `api/chats/[chatId].ts` — `GET` (load), `PUT` (save messages), `DELETE`, `PATCH` (rename).
- `components/Sidebar.tsx` — Chat list + "New chat" button + per-row rename/delete + Clerk `<UserButton>`.
- `components/SignInPage.tsx` — Minimal page wrapping Clerk `<SignIn>` with app branding.

### Modified
- `package.json` — add `@clerk/clerk-react`, `@clerk/backend`, `@vercel/kv`, `@vercel/blob`, `react-router-dom`.
- `index.tsx` — wrap `<App>` in `<ClerkProvider>` + `<BrowserRouter>`.
- `App.tsx:1` — replace single-page render with `<Routes>`: `/sign-in`, `/` (redirect), `/c/:chatId`. Wrap protected routes in Clerk's `<SignedIn>` / `<SignedOut>` gates. Add sidebar to layout.
- `hooks/useChat.ts:6` — accept `chatId` prop; on mount, `GET /api/chats/{chatId}` to hydrate messages; after each `onComplete`, debounced `PUT` to persist. For a fresh URL, `POST /api/chats` on first `sendMessage` and `navigate(\`/c/\${newId}\`)`.
- `.env.example` — add `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `KV_*`, `BLOB_READ_WRITE_TOKEN`.

## Reuse of Existing Code

- `ChatMessage` type in `types.ts:45` is already fully serializable — no changes needed.
- `conversationHistory` construction in `hooks/useChat.ts:109` already maps messages to backend shape; reuse when rehydrating from persisted state.
- `ChatService` (`gemini/chatService.ts`) is stateless per request — unchanged; it continues to receive `conversationHistory` from the loaded chat.
- Existing `localStorage` dismissal flags for warnings (`App.tsx:24`) keep working unchanged.

## UX Flow

1. Unauthenticated user → `<SignedOut>` shows `/sign-in` (Clerk `<SignIn>` with Google provider enabled).
2. Signed in with no chats → auto `POST /api/chats`, redirect to `/c/{newId}` (blank chat, initial welcome message).
3. User sends first message → debounced `PUT` saves messages; title auto-generated from first user message truncated to 60 chars on first save.
4. Sidebar `ZREVRANGE` shows chats newest-first. Click → `navigate('/c/{id}')` → `useChat` refetches + rehydrates.
5. "+ New chat" → `POST /api/chats` → navigate to new id.
6. Delete → `DELETE /api/chats/{id}` → remove blob + KV key + sorted-set entry.

## Title Generation

First pass: first user message → `text.slice(0, 60) + (text.length > 60 ? '…' : '')`. Cheap, no extra API call. Future enhancement (explicitly out of scope for this plan): call Gemini with a 2-token "summarize in 5 words" prompt after first bot response.

## Step-by-Step Implementation

1. **Install deps** — `npm install @clerk/clerk-react @clerk/backend @vercel/kv @vercel/blob react-router-dom`.
2. **Provision cloud resources**:
   - Create Clerk application; enable Google OAuth; copy keys.
   - `vercel kv create cal-law-chat-kv`; `vercel blob create cal-law-chat-blob`; `vercel env pull`.
3. **Add Clerk provider + router** — modify `index.tsx` and `App.tsx` for `<ClerkProvider>`, `<BrowserRouter>`, route structure.
4. **Build `utils/auth.ts` + `utils/chatStore.ts`** — typed CRUD over KV + Blob with ownership checks.
5. **Build `/api/chats` endpoints** — two files, CORS headers copied from existing endpoints (see `api/ceb-search.ts` pattern).
6. **Build `Sidebar.tsx`** — list, new chat, rename (inline), delete (confirm), `<UserButton>` footer.
7. **Refactor `useChat`** — add `chatId` prop, load on mount, debounced save on `onComplete` / `onVerificationComplete`.
8. **Wire routes in `App.tsx`** — sidebar + chat pane layout; redirect unauthenticated users to `/sign-in`.
9. **Deploy to Vercel preview, test, then promote.**

## Verification

- **Type check**: `npm run build` must pass with zero TS errors.
- **Local dev** (`npm run dev`):
  1. Visit `localhost:5173` → redirected to `/sign-in`.
  2. Sign in with Google → redirected to `/c/{newId}`.
  3. Send 2–3 messages with verification → refresh page → chat state fully restored.
  4. Create a second chat via "+ New chat" → sidebar lists both, newest on top.
  5. Rename chat → persists after refresh. Delete chat → disappears, 404 on direct URL.
- **Cross-device test via Playwright MCP**:
  1. Deploy preview (`vercel --yes`).
  2. Playwright: sign in on preview URL, create chat, send message.
  3. New Playwright browser context → sign in as same user → verify sidebar shows the chat → click → messages load.
- **Ownership test**: sign in as user A, create chat, note `chatId`. Sign out, sign in as user B, `GET /api/chats/{chatIdFromA}` must return 403.
- **Console/network**: no chat data in client bundle; all KV/Blob access server-side only.

## Cost Envelope (all free tier)

- Clerk: 10k MAU free.
- Vercel KV: 30k requests/day, 256 MB.
- Vercel Blob: 1 GB storage, 10k ops/month.
- Well within budget for a small legal research app.

## Out of Scope

- AI-generated chat titles (simple truncation for v1).
- Full-text search across chat history (can add via Upstash Vector later).
- Chat sharing / export links.
- Mobile-optimized collapsible sidebar (basic responsive CSS only).
- Migrating existing anonymous users' in-memory chats (they have none persisted anyway).
