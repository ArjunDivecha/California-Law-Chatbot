# AskPauli

> **AI legal research & drafting for California solo and small firms — where client
> data never leaves the lawyer's machine.** Named in homage to the Rev. Dr. Pauli
> Murray (1910–1985): Black, gender-nonconforming civil rights lawyer, California's
> first Black deputy attorney general, the scholar behind *Brown v. Board*'s legal
> backbone and the "Jane Crow" article RBG built *Reed v. Reed* on. We ask what
> would Pauli do — and we verify every citation.

Renamed from **California Law Chatbot** on 2026-07-22. Built for Femme & Femme LLP
(CA family-law / LGBTQ+ practice); commercialization assessment in
`docs/commercialization-assessment-2026-07-16.md`.

**This README describes the CURRENT system (V4, verified 2026-07-24).** The V1
Gemini/OpenRouter/CEB architecture was purged 2026-07-02 and its documentation
removed from this file 2026-07-24 — recover via git history (`git log --all`,
archive tags). Deep architecture docs live in `openwiki/` (start with
`openwiki/quickstart.md`); operator notes in `CLAUDE.md`.

## What it is

- **Two surfaces, one engine.** A web app (`app.askpauli.com`, Vercel + Clerk +
  Upstash) and a **local-first macOS desktop app** (Tauri 2; sessions, drafts, and
  audit logs in per-user SQLite under `~/Library/Application Support/AskPauli/` —
  zero cloud data stores; Upstash/Blob credentials are stripped at boot and the
  code fails closed if any cloud path is reached). Landing page: `askpauli.com`.
- **Anthropic-direct agent loop** (`api/_lib/agentLoop.ts`): research, drafting,
  and citation-verification workflows calling the Anthropic Messages API under
  standard commercial terms + DPA (no training on API content). No other model
  provider touches client content.
- **Automatic latest-model adoption** (`api/_lib/modelResolver.ts`, 2026-07-22):
  at boot, one background Models-API call resolves the newest model in each
  approved family — Fable (research), Opus (unavailability failover), Sonnet
  (quick mode + citation verifier) — cached, zero per-turn latency, pinned
  known-good ids until resolution lands. `approvedModels.ts` remains the
  fail-closed guard: families outside fable/opus/sonnet/haiku (and any
  preview/mythos surface) are refused before a request is sent.
- **Confidentiality-first pipeline**: on-device PII tokenization before any text
  leaves the browser/app (`services/sanitization/`), a fail-closed server-side
  regex backstop (`agentProxy.ts`), a server-authoritative compliance policy
  engine (`api/_lib/compliance/policyEngine.ts` — matter modes, consent
  hard-blocks, disclosures, lawyer-review gates), an outbound tool-query
  exfiltration guard, and per-turn audit manifests recording the exact model
  and policy applied.
- **Verified citations**: CourtListener case-law search + a citation-verifier
  sub-agent (newest Sonnet) + statute verification against official sources
  (leginfo / Cornell LII / eCFR). CEB integration is permanently retired (their
  ToS prohibits ingestion) — do not reintroduce.

## Commands

Package manager **yarn 4**, Node **v24**. See `CLAUDE.md` for the verified list;
highlights:

```bash
yarn build              # vite build → dist/
yarn dev:full           # local web dev (API :3000 + vite :5173)
yarn desktop            # self-contained desktop dev (sidecar :8477 + native window)
yarn desktop:app        # build → sign → NOTARIZE the distributable AskPauli.app
node scripts/build-desktop-installer.mjs   # attorney installer zip (contains live keys — private channels only)
yarn test:sanitization && yarn test:traps  # plus tests/*.test.mjs and runTrapsWire.mjs — keep 100% green
```

## Status (2026-07-24)

- Production web: `app.askpauli.com` (Vercel auto-deploy from `main`).
- Desktop: notarized, Gatekeeper-accepted `AskPauli.app`; installer zip shared
  with the firm's attorneys. No auto-update yet (known gap).
- Sanitization suite fully green: wire traps 120/120, analyze traps 120/120,
  unit tests 153/153.
- Commercial track: local-first desktop is the product direction; the only
  planned server for the commercial version is a thin license/key-provisioning
  service (see the commercialization memory/docs). Pending: Clerk → license-key
  auth, auto-update, discovery interviews via the Lavender Law network.

## 🚧 Architectural dead-ends — DO NOT REVISIT WITHOUT NEW EVIDENCE

This section exists so that future-Arjun and future-Claude don't re-litigate paths that were investigated and rejected. Each entry: **what we tried**, **why it didn't work**, **what would need to change before reconsidering**.

### Claude Pro/Max subscription billing for V2 (2026-05-14)

**What we tried.** Anthropic's June 15 2026 policy created a per-user Agent SDK credit on Claude subscriptions ($20 Pro / $100 Max 5x / $200 Max 20x per month). The hope was that each F&F attorney's V2 calls could bill against their own subscription credit, with auto-failover to F&F's API key when exhausted. We explored two architectures:

- **Option B — browser-direct via `dangerouslyAllowBrowser`.** Each attorney's browser would call `api.anthropic.com` directly with their OAuth bearer token; the V2 server would only proxy tools + sanitization + audit. Preferred for invisibility.
- **Option A — local proxy on each attorney's Mac.** A small daemon spawning Claude Code, with V2 cloud talking to it via WebSocket.

**Why Option B doesn't work.** Empirically verified 2026-05-14 via three smoke tests:

| Test | Result |
|---|---|
| `POST /v1/messages` with `Authorization: Bearer <oauth>` | HTTP 429 `rate_limit_error` — Anthropic intentionally rejects OAuth tokens on the standard messages endpoint |
| `POST /api/oauth/claude_cli/create_api_key` with the same token | HTTP 403 `OAuth token does not meet scope requirement org:create_api_key` — Claude Code's OAuth is issued only with `user:inference` scope; the scope needed to mint a derived API key is not granted |
| `@anthropic-ai/claude-agent-sdk` `query()` | HTTP 200 in ~8s — BUT a fetch-trace proved the SDK spawns the local `claude` binary as a subprocess (`child_process.spawn`). The success path runs **inside the Claude Code binary**, not over HTTP that a browser could replicate |

**Conclusion: there is no documented or working browser-to-Anthropic OAuth-inference path.** The SDK works because it shells out to a locally-installed compiled binary; a browser cannot do that. Option B is permanently impossible against today's Anthropic auth surface.

**Why Option A was rejected.** Architecturally possible but requires a local daemon installed per attorney machine + reachable from V2 cloud. For 2 attorneys, the ongoing operational cost (install/upgrade/rotate-token/handle-offline) outweighs the ~$400/mo savings the subscription credit would unlock. F&F's API key path (current production) is simpler and the firm can afford it.

**What would change the calculus.**

1. **Anthropic publishes a documented browser-OAuth-inference endpoint** — e.g., `api.anthropic.com/v1/oauth-messages` or a CORS-friendly authenticated endpoint. If that ships, Option B becomes viable.
2. **Anthropic issues F&F a `org:create_api_key`-scoped OAuth client_id** — would unlock the OAuth → temporary API key exchange path, which is HTTP-based and browser-callable.
3. **F&F grows past 5 attorneys** — operational cost of Option A's local daemon amortizes better; the $400+/mo savings starts mattering.
4. **A binary alternative to the Claude Code CLI appears that runs in WASM or as a hosted service** — unlikely but would also unlock Option B.

**Evidence to re-validate before reopening.** Re-run the three smoke tests in this section. If `POST /v1/messages` with an OAuth bearer ever returns 200 (not 429), or if a new Anthropic SDK appears that doesn't spawn a subprocess, the dead-end is gone and Option B is back on the table.

**Filed as:** Phase 6 abandoned 2026-05-14. Tasks #117 (research) marked done; #118–#125 deleted. Commit: see V2 commit timeline.

---

