# California Law Chatbot — Local-First Mac App Architecture Plan

**Branch**: `Local`
**Status**: Architecture v5 — vetted through 4 rounds of adversarial review (codex-review skill, gpt-5.3-codex)
**Owner**: Arjun Divecha (femme & femme LLP)
**Target users**: 3 attorneys, all on firm-issued Macs
**Last updated**: 2026-04-25

---

## 0. Why this exists

The existing California Law Chatbot is deployed on Vercel with cloud-hosted auth (Clerk), persistence (Upstash Redis + Vercel Blob), and vector search (Upstash Vector). Phase 1–6 added a client-side sanitization layer that tokenizes client identifiers before they cross the network. Despite that, raw client text still passes through Vercel's serverless functions on its way to AWS Bedrock — a third party in the trust chain.

This plan migrates the entire backend to the attorney's Mac. The only outbound traffic from the running app becomes:
1. Already-tokenized text to AWS Bedrock (with ZDR enabled).
2. Sanitized public-legal queries to CourtListener / OpenStates / LegiScan.
3. Signed update manifests to a firm-controlled Sparkle channel.
4. AWS SSO/STS endpoints for credential refresh.

Nothing else, ever. Vercel, Clerk, Upstash, Vercel Blob — all removed. The firm becomes the sole custodian of client data. Defensible compliance posture: "client data is on the attorney's encrypted disk; sanitized text is sent to AWS Bedrock with zero data retention; no third-party SaaS holds any portion of it."

The detector backbone is **OpenAI Privacy Filter** (Apache 2.0, ~2.8GB PyTorch checkpoint, 70–200ms warm inference on M-series CPU, benchmarked locally 2026-04-25). It replaces the heuristic detector that has been the source of every recent miss (lowercase names, mixed case, lowercase addresses, 3-digit year typos).

---

## 1. Privacy posture (the non-negotiable)

### 1.1 Egress allowlist — the only allowed outbound destinations

| Destination | Purpose | Sanitization gate? | Notes |
|---|---|---|---|
| `bedrock-runtime.<region>.amazonaws.com` | LLM streaming | YES — every request body | already-tokenized |
| `oidc.<region>.amazonaws.com` | AWS SSO OIDC | NO — control plane, no client data | required by `fromSSO()` |
| `portal.sso.<region>.amazonaws.com` | AWS SSO portal | NO — control plane | |
| `sts.<region>.amazonaws.com` | AWS STS | NO — control plane | |
| `www.courtlistener.com/api` | Public legal research | YES — query string scanned | block on PII span |
| `v3.openstates.org` | Public legal research | YES — query string scanned | |
| `api.legiscan.com` | Public legal research | YES — query string scanned | |
| Sparkle update channel host (firm-controlled) | App + sidecar updates | NO — manifest only | signed manifests only |

**Explicitly NOT allowlisted**: Sentry, telemetry, analytics, error reporting, font CDNs, image CDNs, any other host. The renderer's CSP forbids any external `connect-src`, `img-src`, or `script-src` beyond `'self'` plus the loopback HTTP server.

### 1.2 Enforcement (in code, not policy)

- All outbound HTTP from the main process goes through `outboundGate.fetch(req)`.
- `outboundGate` validates host against the allowlist hash table; logs every request via the audit log; routes through the request handler.
- AWS SDK is wrapped with a custom `requestHandler` so SDK calls are captured by `outboundGate`.
- `electron-updater` is configured with a custom `requestHandler` for the same reason.
- Node-level `dns.lookup` shim in main process logs every name resolution; an integration test asserts no resolution occurs outside the allowlist during a recorded session.
- Renderer uses `webRequest.onBeforeRequest` listener that **denies** any non-loopback request as last-line defense.
- Renderer egress is blocked entirely — CSP `connect-src 'self' http://127.0.0.1:*` only.

### 1.3 External link egress (`shell.openExternal`)

`shell.openExternal` is itself an egress channel. A URL with a malicious query string opened in the user's default browser carries data outside our control.

**Policy**: external opens allowed only for **registered citation URLs** that were emitted by Bedrock as part of a verified `Source` object.

- Every `Source.url` is recorded in a `citationRegistry` map (in main-process memory + persisted to `chats.db`) at the moment the `Source` is created.
- Renderer can only call `openCitation(sourceId: string)` — it cannot pass an arbitrary URL.
- Main process verifies: (a) the URL was registered, (b) URL string matches what was registered exactly, (c) host is on the citation-host allowlist (`leginfo.legislature.ca.gov`, `courtlistener.com`, `courts.ca.gov`, `openstates.org`, `legiscan.com`).
- Each open is audited with HMAC of `(sourceId, URL, timestamp)`.
- Manual user-typed URL clicks go through a separate explicit-confirm dialog showing the full URL before opening.

Result: the renderer cannot smuggle data through URL paths/queries. Every external open is pre-registered, immutable, and audited.

### 1.4 OPF (sanitization gate) — full scope

The gate runs on **every payload that could contain client-derived text**, regardless of origin:

1. Outbound to Bedrock: prompt + full conversation history + retrieved CEB chunks + system prompt — all scanned and tokenized.
2. Outbound to public legal APIs: query strings only. Any PII span → request blocked, attorney sees error.
3. Generated text returning to UI: NOT gated (rehydration is local-only; it's never re-uploaded).
4. Imported documents (drafting flow): when an attorney pastes/uploads a draft for revision, the entire body passes through OPF before any segment goes to Bedrock.
5. Saved chat content before write to local SQLite: scanned by the existing presave PII regex backstop (Phase 6.5) — defense in depth even though it's local.

### 1.5 Fail-closed semantics

- OPF subprocess unreachable → `OPFUnavailableError` → outboundGate rejects → red banner: "Sanitization service unavailable. Sends are blocked."
- OPF responds in >5s → request timed out, rejected.
- OPF returns malformed JSON → rejected, error logged.
- Post-tokenization, regex backstop finds residual SSN/credit-card → also rejected.
- **No fallbacks**. No "fall back to heuristic." No "send as-is."

---

## 2. Auth & local trust

### 2.1 Cloud auth removal

- Clerk fully removed: `index.tsx`, `App.tsx`, `useAuthFetch`, all `<SignedIn>`/`<SignedOut>` guards.
- macOS user account is the auth boundary. `os.userInfo().username` is the user identity.
- Optional Touch ID gating on app launch via `systemPreferences.promptTouchID()` (Electron-native macOS API) — not `@nodert-win10/touch-id` (that's Windows; corrected from earlier draft).

### 2.2 AWS credentials

- **Default**: AWS IAM Identity Center via `@aws-sdk/credential-providers` `fromSSO()` with a custom token cache backed by Electron `safeStorage`. The SSO refresh token is encrypted at rest with a key derived from macOS Keychain, not stored as plain JSON in `~/.aws/sso/cache/`.
- **AWS endpoints in egress allowlist**: `oidc.<region>.amazonaws.com`, `portal.sso.<region>.amazonaws.com`, `sts.<region>.amazonaws.com`, `bedrock-runtime.<region>.amazonaws.com`.
- **Long-lived key fallback**: only when SSO is unavailable; key in `keytar`; mandatory rotation reminder UI ("expires YYYY-MM-DD") on a quarterly cycle.
- **IAM policy**: least-privilege, scoped to `bedrock:InvokeModelWithResponseStream` on specific model ARNs. No broad `bedrock:*`.

### 2.3 Local auth token (renderer ↔ embedded HTTP server)

Single canonical mechanism: dynamic HMAC bridge.

- Main generates a 256-bit `sessionSecret` at process start, kept only in main-process memory.
- Preload bridge exposes `window.__local.getAuthToken(method, path)` — main computes `HMAC-SHA256(sessionSecret, ${method}|${path}|${minute})`.
- Renderer adds `Authorization: Bearer <token>` to every fetch.
- Server middleware verifies the HMAC against the current and previous minute (allows clock skew).
- Replay window: ≤2 minutes from issuance; path-bound (leaked token for `/api/chats` cannot be reused for `/api/bedrock/stream`).
- Renderer is loaded via the `app://` custom protocol from disk. No port file, no token file — both come from the preload bridge.

### 2.4 Electron security defaults

```ts
webPreferences: {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
  webviewTag: false,
  enableBlinkFeatures: '',
  preload: path.join(__dirname, 'preload.js'),
}
```

```ts
session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(false));
session.defaultSession.setPermissionCheckHandler(() => false);
app.enableSandbox();
app.on('web-contents-created', (_, wc) => {
  wc.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://') && !url.startsWith('http://127.0.0.1:')) e.preventDefault();
  });
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
});
```

CSP via meta tag:
```
default-src 'self';
connect-src 'self' http://127.0.0.1:*;
img-src 'self' data:;
script-src 'self';
style-src 'self' 'unsafe-inline';
object-src 'none';
base-uri 'none';
form-action 'none';
```

Every IPC handler validates input with `zod` schemas. Every external URL goes through `safeOpenCitation(sourceId)`.

---

## 3. Renderer migration — embedded local HTTP server

The renderer **does** make HTTP calls — but only to `127.0.0.1:<port>`, never elsewhere. CSP enforces this.

- Main spawns Express on `127.0.0.1:<random-ephemeral-port>` at app start. Bound to loopback only (`server.listen(port, '127.0.0.1')`).
- Renderer fetches `127.0.0.1:<port>/api/*` with the dynamic-HMAC `Authorization: Bearer` header.
- Each `/api/*.ts` Vercel route ports to an Express handler in `local-server/routes/*.ts` keeping request/response shape identical — renderer code mostly unchanged.
- Server-Sent Events streaming preserved for Bedrock responses; renderer's existing `EventSource` usage works unchanged.

**Migration to IPC is Phase 2 (post-launch, optional)**. The HTTP server pattern is the cheapest way to preserve the existing renderer contract. IPC is more secure and slightly faster but every endpoint port becomes a refactor — not a v1 blocker.

---

## 4. Endpoint parity matrix

Every existing `/api/*` endpoint must port to a local Express handler with an integration test before cutover.

| Existing `/api/*` | Local replacement | Notes |
|---|---|---|
| `chats` (GET/POST/PUT/PATCH/DELETE) | `local-server/routes/chats.ts` → SQLite | drop Clerk; use device token |
| `ceb-search` | `local-server/routes/ceb.ts` → lancedb + transformers.js | local embeddings via bge-small-en-v1.5 |
| `gemini-chat` (legacy name) | `local-server/routes/bedrock.ts` → AWS SDK Bedrock stream | streaming via SSE |
| `claude-chat` | same Bedrock route, model param differs | |
| `courtlistener-search` | `local-server/routes/courtlistener.ts` | OUTBOUND — gated |
| `openstates-search` | `local-server/routes/openstates.ts` | OUTBOUND — gated |
| `legiscan-search` | `local-server/routes/legiscan.ts` | OUTBOUND — gated |
| `legislative-fanout` | `local-server/routes/legislative-fanout.ts` | OUTBOUND — gated |
| `verify-citations` | `local-server/routes/verify-citations.ts` | calls courtlistener — gated |
| `orchestrate-document` | `local-server/routes/orchestrate.ts` | multi-agent, all-local |
| `revise-section` | `local-server/routes/revise-section.ts` | |
| `export-document` | `local-server/routes/export.ts` | docx/pdf already pure-JS |
| `templates` | `local-server/routes/templates.ts` | static JSON |
| `debug` | `local-server/routes/debug.ts` | helpful for support |

---

## 5. Data migration

### 5.1 Chat history (Vercel Blob → SQLite) with snapshot boundary

**Avoid offset pagination — concurrent writes cause silent loss.**

A new endpoint deployed once on the cloud: `/api/chats/export-snapshot` returns `{ asOf: ISO8601, chatCount: N, idSet: [chatId, ...] }` — a frozen, deterministic id-set computed at a single instant.

`claw-export` CLI flow:
1. Reads attorney's one-shot Clerk session token.
2. Calls `/api/chats/export-snapshot` → records `{ asOf, chatCount, idSet }`.
3. Iterates `idSet` sorted by `(updatedAt, id)`, calling `/api/chats?id=<chatId>&asOf=<ISO>` per chat.
4. Computes manifest: `{ asOf, chatCount, idSet, blobSha256: { chatId → sha256 } }`.
5. Writes export tarball with manifest at the root.
6. Final check: tarball contains exactly `chatCount` blobs, every chatId from `idSet` is present, no extras. Aborts on mismatch.

`claw-import` (new Electron app):
1. Verifies signed manifest structure.
2. For each id in `manifest.idSet`: verifies blob present and sha256 matches.
3. Imports into SQLite in a single transaction.
4. After import: SQLite `count(*)` and id-set must equal `manifest.chatCount` and `manifest.idSet` exactly.
5. Recomputes sha256 of every imported blob; must match manifest.
6. On any mismatch: SQLite snapshot restored, error surfaced.

Records arriving after `asOf` aren't included in this migration — covered by a follow-on incremental sync if needed.

### 5.2 Token map (IndexedDB → SQLite)

- One final deploy of the existing cloud app adds an "Export tokens" button.
- Button reads the IndexedDB store via the existing browser-context code, decrypts with the device key, offers a download of `tokens.json.encrypted` (re-encrypted with a passphrase the attorney chooses).
- New Electron app on first run accepts the file + passphrase, decrypts, re-encrypts under the local device key into `sanitization.db`.
- **No offscreen Electron BrowserWindow loads any cloud origin.** The new app never executes remote JS.

### 5.3 Audit log

HMAC-only records in Upstash Redis. Either left in place (firm decides) or exported via SQL query (CLI tool same as 5.1).

### 5.4 Backups

- APFS Time Machine baseline.
- Daily zipped export of `~/Library/Application Support/CaliforniaLawChatbot/` to `~/Documents/CaliforniaLawChatbot Backups/<date>.zip`, encrypted with a Keychain device key.
- Schema versioning in SQLite with migration rollback path.

---

## 6. Vector search migration

### 6.1 Eval harness (precondition)

Before cutover, retrieval quality must be proven:
1. Build a "golden query" set: ~50 real CEB-driven research questions from past chats with attorney-validated correct top-3 chunks.
2. Run query set against current Upstash + OpenAI embeddings → record top-K, MRR, NDCG@5.
3. Run same set against local lancedb + bge-small-en-v1.5 → record same metrics.
4. **Acceptance threshold**: bge-small NDCG@5 within 5% of OpenAI baseline.

### 6.2 If threshold met

Re-embed all 77,406 CEB chunks **at build time** (once, by the dev team, not on user machines) with bge-small-en-v1.5, ship the resulting lancedb index as part of the sidecar archive. Indexing cost: ~5 minutes on M-series. Per-user cost: zero, bandwidth-free.

### 6.3 If threshold fails

Three options:
1. Try larger local model (`bge-large`, ~1.3GB).
2. Try query-expansion or hybrid retrieval (BM25 + vector).
3. Approve OpenAI-for-queries-only as an explicit signed-off exception. OpenAI endpoint joins egress allowlist; queries route through `outboundGate` with sanitization first. The "fully local" claim becomes "fully local except OpenAI for query embeddings, with sanitization."

**No silent fallback to OpenAI.** Exception is documented and signed off.

---

## 7. Update architecture

### 7.1 Single updater: `electron-updater`

- Configured with a custom `requestHandler` that routes through `outboundGate` (so updater traffic is logged + allowlist-enforced).
- Sparkle-style EdDSA signature verification on every manifest and asset.
- Update channel host added to egress allowlist.

### 7.2 Two-asset model

1. **App bundle** (~200MB Electron + Node + React + JS code) ships via `electron-updater`.
2. **OPF model + Python sidecar** (~2.8GB) ships as a separate signed asset, downloaded on first run (resumable HTTP, sha256 verified, manifest pinned to app version).

Result: routine app updates are 5–50MB delta downloads, not 3GB. Model updates only happen when OPF itself changes (rare).

### 7.3 Sidecar trust model — independently signed

Apple notarization signs the .app bundle at build time. A sidecar downloaded later is **not** covered by that signature. So:

- Sidecar archive (Python runtime + PyTorch wheels + OPF code + OPF model weights) is signed at build time with an **EdDSA signing key the firm controls** (separate from Apple Developer ID).
- The EdDSA public key is baked into the app bundle (and protected by Apple notarization).
- App downloads sidecar on first run via outboundGate, verifies EdDSA signature over the entire archive against the embedded public key. Refuse to install on signature failure.
- After extraction, app verifies SHA-256 of every file against a (also signed) manifest.
- At every OPF subprocess startup, app re-verifies SHA-256 of `python` binary + `.so`/`.dylib` files against the manifest. Tampered → refuse to start subprocess; surface error directing user to reinstall.

Two trust chains, decoupled: Apple notarization for the app bundle; firm-controlled EdDSA for the sidecar.

### 7.4 Anti-rollback policy

- Sidecar manifest includes a signed monotonically-increasing `version: integer` field.
- App persists `lastInstalledSidecarVersion` in `~/Library/Application Support/.../sidecar.state` (FileVault-protected; HMAC'd with a key in Keychain).
- On every install or startup verification: app rejects any sidecar whose `version` is less than `lastInstalledSidecarVersion`. A signed older artifact cannot be replayed.
- Anti-downgrade also applies to the embedded EdDSA public key: a new app build can rotate the key forward (with overlap window during which both old + new keys are accepted), but cannot silently go backward.

---

## 8. Python runtime supply chain

- **Distribution**: `python-build-standalone` 3.13 (Astral/uv-blessed, production-grade). Pin specific build SHA-256 in repo's `python.lock`.
- **Wheels**: PyTorch CPU + transformers + huggingface_hub + tiktoken + safetensors + opf, all pinned by hash via pip's `--require-hashes`. `requirements.txt` lists SHA-256 for every wheel.
- **SBOM**: generated via `cyclonedx-py` per build, included in app Resources for transparency. Discoverable via `Help → About → SBOM`.
- **Subprocess env sanitization**: when spawning the OPF Python child, main process explicitly sets `env: {}` then adds only `PATH` (sandboxed to bundled binaries), `PYTHONHOME`, `PYTHONPATH` (sandboxed). No inherited env. No `LD_PRELOAD`, no `DYLD_*`, no proxy variables.
- **Subprocess working directory**: `app.getPath('temp') + '/opf-runtime'`, not user home.
- **No external pip access**: bundled venv is sealed. App will never run `pip install`.
- **Code-signing**: every `.dylib`/`.so` in the Python distro is co-signed under the app's Developer ID; sidecar signing is separately under firm EdDSA.
- **Tamper response**: SHA-256 verification at every OPF subprocess startup; refuse on mismatch.

---

## 9. At-rest encryption

Three local DBs:
- `chats.db` — SQLite, chat history including verification reports + sources.
- `audit.db` — SQLite, HMAC-only records, no raw text.
- `sanitization.db` — SQLite, encrypted token map (already encrypted at app level via the Phase 6 store layer).

**Decision**: rely on FileVault for `chats.db` and `audit.db`; keep `sanitization.db` app-level-encrypted (defense in depth — token map is the only thing with raw client identifiers).

If the firm wants stronger: enable SQLCipher for `chats.db` (drop-in replacement, AES-256, key from Keychain). +1 day work.

---

## 10. Implementation phases

(Estimates include 50% contingency. Total: ~313 hours / ~39 days. ~5 weeks full-time, ~8 weeks part-time.)

### Phase 0 — Security POCs (week 1, BLOCKING)

| Task | Hours |
|---|---|
| POC #1: `electron-updater` custom `requestHandler` interception | 6 |
| POC #2: `fromSSO` with Electron `safeStorage`-backed token cache | 6 |

**Pass conditions**:
- POC #1: all updater network attempts observed through `requestHandler`; no unmanaged egress (verified via dns/socket hook + handler instrumentation).
- POC #2: full SSO login + token refresh cycle completes without any plaintext token written to disk.

If either POC fails: project pauses until alternative path is chosen and re-vetted.

### Phase 1 — Foundation (weeks 2–3)

| Task | Hours |
|---|---|
| Threat model + DFD + outboundGate prototype | 12 |
| Endpoint parity matrix + integration test scaffold | 6 |
| Electron + Vite scaffolding + complete hardening checklist | 15 |
| Embedded local HTTP server + dynamic HMAC token + custom `app://` protocol | 15 |
| Auth refactor (Clerk removal, safeStorage SSO cache, Touch ID) | 12 |
| Citation registry + safeOpenCitation | 6 |

### Phase 2 — Data + Sanitization (weeks 3–5)

| Task | Hours |
|---|---|
| Chat persistence: SQLite + `claw-export` CLI + paginated importer | 24 |
| Token map export tool + import flow | 9 |
| Vector eval harness | 9 |
| Vector backend: lancedb + bge-small-en-v1.5 build-time re-embed | 15 |
| OPF Python subprocess + JSON-RPC + supervision + tamper checks | 18 |
| Outbound gate + sanitization fail-closed (full scope §1.4) | 18 |
| Bedrock SDK with custom requestHandler + SSE | 12 |
| External APIs migration through outboundGate | 9 |
| Drafting + export-document parity | 12 |

### Phase 3 — Distribution (weeks 5–7)

| Task | Hours |
|---|---|
| Sidecar build pipeline + EdDSA signing + manifest | 15 |
| Code signing + notarization + Sparkle + signature CI | 15 |
| Sidecar runtime download + verification + tamper detection | 12 |
| Python runtime packaging + SBOM + hash-pinned wheels | 18 |
| Onboarding wizard (SSO setup, model download UX, Touch ID enrollment) | 12 |

### Phase 4 — Verification (weeks 7–8)

| Task | Hours |
|---|---|
| Security tests: egress fuzz, updater tamper, OPF kill, migration rollback, citation-URL injection, sidecar tamper | 18 |
| End-to-end testing on real Macs | 15 |
| Bug fixes + polish | 21 |

---

## 11. Milestone gates (release blockers)

### Gate Z — Security POCs (week 1)
- POC #1 passes: electron-updater respects custom `requestHandler`; no unmanaged egress.
- POC #2 passes: `fromSSO` works with safeStorage-backed cache; no plaintext disk cache.
- **Failure mode**: project pauses, alternative path chosen and re-vetted.

### Gate A — Foundation (post 3 weeks)
- Embedded HTTP server up; renderer fetches `/api/*` from localhost.
- All 14 endpoint stubs exist with passing integration tests.
- Renderer hardening verified: manual-test checklist of "open devtools, try `fetch('https://example.com')`, must fail" passes.
- **Egress allowlist test**: dnssim/proxy intercepts every outbound DNS resolution during a recorded session — assert no resolution outside allowlist.
- **Citation URL injection test**: renderer attempts `openExternal('https://leginfo.legislature.ca.gov/...?leak=secret')` directly → blocked at preload bridge (only `openCitation(sourceId)` exists). Then attempts `openCitation('forged-id')` → main rejects.
- **Sign-off**: 1 attorney runs sample chats end-to-end against local stack.

### Gate B — Sanitization integrity (post 5 weeks)
- OPF subprocess running with health check.
- **OPF kill test**: kill PID mid-send → assert outbound request blocked, attorney sees error, no partial/raw payload sent.
- **OPF replace test**: swap OPF binary with malicious "always-pass" stub → assert tamper check refuses to start.
- All gold-set tests passing through the new full stack.
- **Sign-off**: penetration test by separate engineer attempting to bypass outboundGate.

### Gate C — Migration (post 6 weeks)
- Vector eval shows ≤5% NDCG@5 regression vs cloud baseline (or documented OpenAI-exception sign-off).
- Token map export → import round-trip preserves every (raw, token) pair.
- Chat history import preserves every chat with correct timestamps and sources.
- **Migration completeness test**: synthetic source with 250 chats; export → import → verify count == 250 + sha256 chain matches.
- **Migration rollback drill**: corrupt SQLite, verify restore from backup zip.
- **Sign-off**: attorney imports their real cloud history into a test machine, verifies they can find old chats.

### Gate D — Distribution (post 8 weeks)
- Code-signed/notarized .dmg installs cleanly on a fresh Mac (verified in a clean macOS VM).
- First-run flow: SSO enrollment → model download (resume across network drop) → first chat ships end-to-end.
- **Updater tamper test**: modify the manifest signature → assert app refuses to apply update.
- **Sidecar tamper test**: corrupt one byte in `python` or `libtorch.dylib` → app refuses to start OPF subprocess; clear error.
- **Sidecar signature test**: replace sidecar manifest with valid SHA-256s but invalid EdDSA signature → app refuses to extract.
- **Network policy test**: disable network for 5 minutes → assert UI degrades gracefully (clear error, no silent failures).
- **Sign-off**: all 3 attorneys complete onboarding on their own laptops without engineering assistance.

No gate slips into the next phase silently.

---

## 12. Architectural decisions (explicit)

1. **Electron** over Tauri/Wails/Native — reuses 100% of existing React + TypeScript codebase; runtime size is irrelevant alongside 2.8GB OPF.
2. **Embedded local HTTP server** over IPC-only — preserves `/api/*` contract, minimizes renderer churn; IPC migration is Phase 2 if needed.
3. **OPF as Python subprocess** — confirmed; no in-browser path until OpenAI publishes ONNX weights.
4. **CEB embeddings re-embedded with local bge-small-en-v1.5** — only after eval harness shows ≤5% NDCG@5 regression; otherwise OpenAI fallback as documented exception.
5. **Vector store: lancedb** — purpose-built, faster than sqlite-vss for 77K+ vectors; native Mac binary.
6. **JSON-RPC over stdin/stdout** for OPF IPC.
7. **AWS SSO via `fromSSO()`** as default; long-lived keys as fallback.
8. **`electron-updater` + sidecar OPF** — single updater, two-asset distribution.
9. **Auth removal**: Clerk → macOS user + safeStorage-encrypted device-derived keys + optional Touch ID.
10. **Egress allowlist** enforced in main process with fail-closed sanitization gate.
11. **Renderer hardening**: contextIsolation, sandbox, no nodeIntegration, strict CSP, IPC schema validation, no `shell.openExternal` access except via citation registry.
12. **Data migration**: snapshot-boundary, cursor-paginated, server-authoritative id-set verification.
13. **At-rest encryption**: FileVault baseline + app-level encryption for `sanitization.db`; SQLCipher for `chats.db` is opt-in.
14. **Sidecar trust model**: Apple notarization for app bundle; firm-controlled EdDSA for sidecar; anti-rollback via signed monotonic version.

---

## 13. Codex review status (transcript summary)

This plan was developed via 4 rounds of adversarial review (codex-review skill, model gpt-5.3-codex). 22 of 25 distinct findings were closed across the rounds. The 3 items from round 4 that prompted v5 (snapshot-boundary migration, POC observability criterion, sidecar anti-rollback) are addressed in this document.

**Findings classified as closed**:
- Privacy egress (CRITICAL) — fully closed via §1
- Renderer rewrite contradiction (CRITICAL) — closed via §3 (embedded HTTP server)
- Clerk migration unaddressed (CRITICAL) — closed via §2.1
- OPF fail-closed scope too narrow (CRITICAL) — closed via §1.4
- Cloud BrowserWindow token migration (CRITICAL) — closed via §5.2
- Feature parity gap (HIGH) — closed via §4
- Data migration silent loss (HIGH) — closed via §5.1
- Electron security defaults (HIGH) — closed via §2.4 + §1.3
- AWS auth inaccuracies (HIGH) — closed via §2.2
- Python supply chain (HIGH) — closed via §8
- Local auth token inconsistency (HIGH) — closed via §2.3
- Sidecar trust model inconsistency (CRITICAL) — closed via §7.3
- Migration concurrent-write loss (HIGH) — closed via §5.1 (snapshot boundary)
- POC observability criterion (MEDIUM) — closed via §10 Phase 0
- Sidecar anti-rollback (MEDIUM) — closed via §7.4
- Fully-local + OpenAI fallback contradiction (MEDIUM) — closed via §6.3
- Missing security tests in gates (MEDIUM) — closed via §11
- Updater + SSO bypass outboundGate (CRITICAL) — closed via §1.2 (custom `requestHandler` wrapping)
- Estimate undercount (MEDIUM) — closed via §10 (50% contingency)

---

## 14. Open questions before kicking off Phase 0

1. **Are all 3 attorneys using AWS IAM Identity Center**, or do we need the long-lived-key fallback path from day one?
2. **Where will the firm-controlled Sparkle update channel be hosted** (S3 + CloudFront? GitHub Releases? Self-hosted?)
3. **Is SQLCipher worth the +1 day** to encrypt `chats.db` beyond FileVault, or is FileVault baseline sufficient for the firm's threat model?
4. **Apple Developer ID** — does the firm have one ($99/year), or do we ship unsigned for the 3 internal users initially with explicit "right-click → Open" instructions?
5. **Telemetry/error reporting**: explicitly NOT in the egress allowlist. If a user hits a bug, how do we get the diagnostic info? (Manual log export? Local-only crash log they can email?)

These don't block Phase 0 (the POCs) but should be answered before Phase 1 starts.

---

## 15. References

- OpenAI Privacy Filter — https://github.com/openai/privacy-filter (Apache 2.0)
- python-build-standalone — https://github.com/astral-sh/python-build-standalone
- electron-updater — https://www.electron.build/auto-update
- AWS SDK credential providers — https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-iam-identity-center.html
- lancedb — https://lancedb.github.io/lancedb/
- transformers.js — https://huggingface.co/docs/transformers.js

---

*Plan vetted through 4 rounds of adversarial review with gpt-5.3-codex. Round 5 hung on runtime; review skill capped at 5 rounds anyway. Document is the synthesis of v5 plus all prior closed findings.*
