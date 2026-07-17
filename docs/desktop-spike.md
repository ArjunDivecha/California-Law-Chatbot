# Desktop (Tauri) spike — 2026-07-16

> **Phase 3 landed (same day): a standalone .app.** `yarn desktop:app`
> produces `src-tauri/target/release/bundle/macos/California Law Chatbot.app`
> (~207 MB) with no runtime dependency on the repo: the whole server graph is
> esbuild-bundled to one CJS file (`scripts/build-desktop-sidecar.mjs`;
> better-sqlite3 ships as a real node_modules because its `bindings` loader
> can't be bundled; gliner/onnxruntime are external — browser-only), the
> agents/ skills + built front end ride along as resources, and a full Node
> 24 runtime is bundled as a Tauri externalBin (`Contents/MacOS/node`).
> Release builds spawn the sidecar from Rust and kill it on exit. Bundle
> placement gotchas: the CJS lives at `desktop-resources/api/_lib/` so
> skills.ts's `__dirname/../../agents` resolution still lands, and
> `import.meta.url` is shimmed (scripts/import-meta-url-shim.js) because
> CJS output lowers it to `{}`. API keys: the packaged app has no repo .env —
> desktop-env.mjs also reads `~/Library/Application Support/California Law
> Chatbot/.env` (and the AAA fallback on this machine).
> Verified end-to-end on the built .app: sidecar health, real agent turn
> (Fam. Code § 271, leginfo citation → the code-lookup tool works from
> inside the package), front end served, session rows in SQLite.
> Still deferred: Developer ID signing + notarization (ad-hoc signed now —
> fine on this Mac, Gatekeeper warns elsewhere), auto-update, Clerk →
> license-key auth + metering proxy (commercial build).

> **Phase 2 landed (same day):** sidecar + SQLite. `yarn desktop` now runs the
> fully local build: the Tauri CLI launches `desktop-server.mjs` (via the
> overlay config's `beforeDevCommand{wait:false}` — a Rust-side spawn would
> deadlock dev because the CLI blocks on devUrl before starting the binary;
> release builds DO spawn it from Rust, `src-tauri/src/lib.rs`). The sidecar
> serves the built front end AND the full V2 agent API on `127.0.0.1:8477`
> with **Upstash/Blob credentials deleted from the environment** and a
> SQLite adapter (`api/_lib/desktop/sqliteKv.ts`) injected via the existing
> `setSessionRedis()` / `setAuditSink()` seams. Sessions, tool-cache, locks,
> rate-limit counters, audit + manifest logs all land in
> `~/Library/Application Support/California Law Chatbot/sessions.db`
> (verified by row inspection after a real agent turn). Legacy `/api/chats`
> (Vercel Blob) is not mounted — the V2 UI persists chats in IndexedDB.
> Remaining for phase 3: bundle a real sidecar binary (no repo tsx), swap
> Clerk for license auth, signing/notarization/auto-update.

**What this proves:** the existing `/v2` React front end runs unchanged inside a
native Tauri 2 window on macOS, with the full V2 agent loop (policy engine, PII
pipeline, tools, Anthropic Messages API) running locally via `dev-server.js` —
no Vercel, no code changes to the app itself. Rust compile time on the M4 Max:
~31 s. Branch: `worktree-tauri-spike`.

## How to run it

```bash
# from the repo root (worktree)
yarn install

# SELF-CONTAINED DESKTOP MODE (phase 2) — one command:
yarn desktop        # vite build + sidecar on :8477 (SQLite, no cloud stores) + native window

# — or hot-reload dev mode (webview on the Vite dev server, Upstash-backed):
yarn dev:api        # terminal 1 — local API on :3000
yarn dev            # terminal 2 — Vite on :5173
yarn tauri dev      # terminal 3 — native window
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
