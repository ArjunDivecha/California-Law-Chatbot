# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

California Law Chatbot — React 19 + TypeScript + Vite single-page app with Vercel serverless API functions served locally via an Express dev server. See `CLAUDE.md` for full architecture details and `README.md` for user-facing docs.

### Running the development servers

Two processes are needed:

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| API server (Express) | `npm run dev:api` | 3000 | Wraps all `/api/*.ts` Vercel functions; loads `.env` via dotenv |
| Frontend (Vite) | `npm run dev` | 5173 | Proxies `/api` requests to port 3000 |

Combined shortcut: `npm run dev:full` (starts both, but the API server runs in background — prefer running them separately in two terminals for cleaner log output).

### Environment variables

A `.env` file in the repo root is required. Copy `.env.example` to `.env` and populate with real keys. The required keys for full functionality are:
- `OPENROUTER_API_KEY` — routes to Gemini and Claude models
- `OPENAI_API_KEY` — native OpenAI embeddings for CEB search
- `UPSTASH_VECTOR_REST_URL` / `UPSTASH_VECTOR_REST_TOKEN` — CEB vector database

Without these keys the UI loads and chat input works, but responses return "Authentication error with AI service."

### Build and type-checking

- `npm run build` — Vite production build (uses esbuild, succeeds even with TS errors)
- `npx tsc --noEmit` — full TypeScript type-check (the codebase has 2 pre-existing TS errors that don't block the build)
- No ESLint configuration exists in this repo; there is no lint script.

### Testing

- `npm run test:verification` — runs `test-verification-system.js` (requires valid API keys)
- `npm run test:openrouter` — runs `test-comprehensive.js` (requires valid API keys)
- No unit test framework (Jest, Vitest, etc.) is configured.

### Gotchas

- Both `yarn.lock` and `package-lock.json` exist. The `packageManager` field declares Yarn 4.9.1, but `README.md` documents `npm install` and the `package-lock.json` is current. Use `npm install` for dependency management.
- The `dev-server.js` imports `.ts` files directly via Node.js dynamic `import()` — this works because Vite's node loader handles TS transpilation at import time for the API functions.
- Source files (components, services, hooks, etc.) live at the repo root, not under `src/`.
