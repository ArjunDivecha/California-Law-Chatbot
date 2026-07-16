# Desktop (Tauri) spike — 2026-07-16

**What this proves:** the existing `/v2` React front end runs unchanged inside a
native Tauri 2 window on macOS, with the full V2 agent loop (policy engine, PII
pipeline, tools, Anthropic Messages API) running locally via `dev-server.js` —
no Vercel, no code changes to the app itself. Rust compile time on the M4 Max:
~31 s. Branch: `worktree-tauri-spike`.

## How to run it

```bash
# from the repo root (worktree)
yarn install
# terminal 1 — local API (loads keys from .env / .env.local / ~/Dropbox/AAA Backup/.env.txt)
yarn dev:api
# terminal 2 — front end
yarn dev
# terminal 3 — native window
yarn tauri dev
```

`src-tauri/tauri.conf.json` points the webview at `http://localhost:5173`
(Vite), which proxies `/api/*` to the Express dev server on `:3000`.

## Verified end-to-end (2026-07-16)

- `tauri dev` compiles and opens a 1440×900 native window running the app
  (sidebar, matter modes, chat/draft/verify surfaces; zero page errors).
- One real agent turn through the local stack:
  `POST /api/agent/turn` → correct Fam. Code § 2320 residency answer,
  1 tool round, 295 tokens, ~13 s.

## What the spike deliberately does NOT do yet

These are the phase-2 work items for a real desktop product:

1. **Local agent loop in-process** — today the API is a separate Node process
   (`dev-server.js`). Production shape: bundle it as a Tauri *sidecar* binary
   (or port `api/_lib/` to run under a Node sidecar with a fixed port), so the
   .app is self-contained.
2. **Kill the cloud dependencies** — `sessionStore.ts` (Upstash Redis) →
   local SQLite (better-sqlite3 is already a dependency); Vercel Blob chat
   persistence → local files; Clerk → license-key auth against the thin
   metering proxy.
3. **Metering proxy** — a single stateless endpoint holding the Anthropic key:
   license check → forward → meter. The desktop app must not embed the key.
4. **Packaging** — icons, signing (Developer ID), notarization, auto-update
   (Tauri updater), Windows build.

## Files added by the spike

- `src-tauri/` — Tauri scaffold (config, Rust entry, icons). `target/` is
  gitignored.
- `package.json` — added `@tauri-apps/cli` devDependency and `tauri` script.
