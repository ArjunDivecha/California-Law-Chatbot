# Phase 1 First Gate: SDK Capability Audit

**Date:** 2026-05-03
**Auditor:** Arjun (engineering)
**SDK inspected:** `@anthropic-ai/sdk@0.92.0` (latest on npm; current repo has `0.68.0` which **does not contain Managed Agents at all**)
**Method:** Type-definition inspection of installed npm package + source review of beta resource directories
**Plan reference:** §"Phase 1 first gate" in `docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md`

---

## Headline result: GO with two architecture corrections

Managed Agents is real, GA-shaped, and present in the latest SDK. Four of the five audit points pass cleanly. One fails as the plan was written but has a clean workaround (two agent versions, or a network-restricted Environment). Two **plan errors** were uncovered that need to be corrected before any Phase 1 build code is written.

---

## Audit point 1 — Core agent loop: ✅ PASS

The SDK exposes everything the plan assumed:

| Plan assumption | SDK reality |
|---|---|
| `client.beta.agents.create()` | ✅ `client.beta.agents.create({model, name, system, tools, mcp_servers, skills, metadata, ...})` |
| `client.beta.sessions.create()` | ✅ `client.beta.sessions.create({agent, environment_id, resources, vault_ids, metadata, ...})` |
| Session resumption with `last_event_id` | ✅ `client.beta.sessions.events.list(sessionID, {order, betas, ...})` — paginated event listing with cursor support; resumption is by re-listing events |
| Tool-callback streaming | ✅ `client.beta.sessions.events.stream(sessionID)` returns SSE `Stream<BetaManagedAgentsStreamSessionEvents>` |
| Send tool results back | ✅ `client.beta.sessions.events.send(sessionID, {events: [...]})` |
| Agent versioning | ✅ `client.beta.agents.versions.list(agentID)` + session can pin a specific version via `agent: {id, version}` |

Beta header: appears under `betas?: Array<BetaAPI.AnthropicBeta>` on every method. Plan's `anthropic-beta: managed-agents-2026-04-01` pinning approach (§J) is correct.

Models supported in `BetaManagedAgentsModel` enum: `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5`, plus older 4.5 variants. Plan's Opus 4.7 / Sonnet 4.6 split (§"Two agents") is supported.

---

## Audit point 2 — Custom tool registration: ✅ PASS

`BetaManagedAgentsCustomToolParams`:
```ts
{
  type: 'custom';
  name: string;          // 1-128 chars, [a-zA-Z0-9_-]
  description: string;   // 1-1024 chars
  input_schema: BetaManagedAgentsCustomToolInputSchema;  // JSON Schema
}
```

All six tools the plan needs (`ceb_search`, `courtlistener_search`, `statute_lookup`, `legiscan_search`, `openstates_search`, `citation_verify`) fit cleanly. Up to 128 tools per agent.

Tool execution flow (verified from event types):
1. Agent emits `BetaManagedAgentsAgentCustomToolUseEvent` in the session event stream
2. Our Vercel proxy reads the event via `events.stream()` or `events.list()`
3. We execute the tool locally (call our existing legal-data endpoints)
4. We POST the result back via `events.send({events: [{type: 'user_custom_tool_result', ...}]})`

---

## Audit point 3 — Per-session web_search/web_fetch dynamic gating: ❌ FAIL (with two clean workarounds)

**Plan assumed:** toggle `web_search` and `web_fetch` per session based on whether sanitization marked the input as privileged.

**SDK reality:** `enabled` flag on built-in tools (`bash`, `edit`, `read`, `write`, `glob`, `grep`, `web_fetch`, `web_search`) is set on `BetaManagedAgentsAgentToolConfigParams`, which is part of `AgentCreateParams` — set at agent creation time. `SessionCreateParams` has **no tool override field**. There is no per-session enable/disable for built-in tools.

**Two workarounds, both supported:**

**Workaround A — Two agent versions, switched per session.** Create one agent ID with two versions:
- `v1`: web_search + web_fetch enabled (non-privileged sessions)
- `v2`: web_search + web_fetch disabled (privileged sessions)

At session create, pass `agent: {id: AGENT_ID, version: privileged ? 2 : 1}`. The SDK supports pinning a specific version via the `BetaManagedAgentsAgentParams` shape on `SessionCreateParams.agent`.

**Workaround B — Network-restricted Environment (cleaner).** The SDK exposes `BetaLimitedNetworkParams` for environment cloud config:
```ts
networking: {
  type: 'limited',
  allow_mcp_servers: false,
  allow_package_managers: false,
  allowed_hosts: ['courtlistener.com', 'openstates.org', 'legiscan.com', 'leginfo.legislature.ca.gov']
}
```

Two environments: one open-network (non-privileged), one allowlisted (privileged). At session create, pass the appropriate `environment_id`. Even if the agent calls `web_search`, the container can only reach the allowlisted hosts. This is a **stronger** boundary than disabling the tool — it survives misconfiguration.

**Recommendation:** Use B (network-restricted Environment) as the primary mechanism. Use A (two agent versions) as defense-in-depth. The plan's §E "blocked when privileged marker present" wording is enforceable; the *mechanism* changes from "tool toggle" to "environment switch."

**Plan correction required:** Update §E to describe the Environment-based network restriction. Update §"Phase 0.b" to test against the allowlisted environment, not against a tool-disabled agent.

---

## Audit point 4 — Tool-callback authentication: ⚠️ MOOT (architecture was wrong)

**Plan assumed:** Anthropic POSTs back to our `/api/agent/sessions/:id/tools/:tool_call_id` to invoke custom tools, requiring signature verification.

**SDK reality:** **There is no inbound webhook from Anthropic.** The actual model is a *pull* model:
- Tool-call events appear in the session's event stream
- We pull them via `events.stream()` or `events.list()` (outbound HTTPS to `api.anthropic.com`, authenticated by our API key)
- We execute the tool locally
- We POST the result back via `events.send()` (also outbound HTTPS to `api.anthropic.com`)

There is no inbound traffic from Anthropic to our Vercel functions at all.

**Plan correction required:**

§A in the plan lists this route:
> `POST /api/agent/sessions/:id/tools/:tool_call_id` — internal tool-callback handler

**This endpoint does not exist and should not be created.** Tool execution happens inside the proxy that's holding the event stream open (or inside a worker that polls `events.list()` periodically). §A.1 "internal tool-callback protection" requirement is moot for the same reason — there's no inbound traffic to protect.

This actually **simplifies** the architecture by one route. Updated route table:

```
api/agent/sessions.ts                  POST  /api/agent/sessions
api/agent/sessions/[id]/events.ts      GET   /api/agent/sessions/:id/events  (proxies events.stream/list)
api/agent/draft.ts                     POST  /api/agent/draft
api/agent/verify.ts                    POST  /api/agent/verify
api/_lib/agentProxy.ts                 shared helpers (incl. tool dispatcher)
```

The `[id]/events.ts` handler holds the event stream, executes tool calls inline by calling into our existing `/api/ceb-search`, `/api/courtlistener-search`, etc., and POSTs results back via `events.send()` — all in the same request lifecycle. Or for long sessions: a Vercel cron worker polls `events.list()` and dispatches asynchronously.

---

## Audit point 5 — Session retention duration: ⚠️ UNKNOWN (not in SDK; check docs at implementation time)

The SDK exposes session lifecycle methods (`create`, `retrieve`, `update`, `archive`, `delete`) but **does not document a retention window in type definitions**. This is a runtime/docs question, not an SDK question.

**Action:** During Phase 1 build, query Anthropic platform docs or test empirically by leaving a session idle and seeing when `events.list()` starts returning a "session expired" error. Bound the §D failure-mode "Anthropic API outage mid-session → resume on recovery" wording to whatever the actual retention turns out to be.

This is the only soft point and it's a documentation lookup, not a blocker.

---

## Architectural surprises worth noting

These were not in the plan and are visible in SDK 0.92.0:

1. **`environment_id` is required on `SessionCreateParams`.** Sessions run inside Anthropic-managed containerized Environments (Firecracker microVMs per Vercel knowledge update). Plan never mentioned Environments. We need to create at least one (and likely two — privileged-allowlist + open-network per audit point 3 workaround B). Add to Phase 1 deliverables.

2. **`vaults` is a real beta resource** for storing credentials the agent can use. Could replace some 1Password key-management workflow described in §U. Worth evaluating in Phase 1, deferring decision.

3. **`memory-stores` is a real beta resource.** Plan §K dropped memory stores as "premature scope" — that decision still holds for 2 lawyers, but the capability exists if needed later. No plan change.

4. **`user-profiles` is a real beta resource** (per-user personalization). Out of scope; mentioned for completeness.

5. **Resources at session level** (`BetaManagedAgentsFileResourceParams`, `BetaManagedAgentsGitHubRepositoryResourceParams`, `BetaManagedAgentsMemoryStoreResourceParam`) — sessions can mount files, GitHub repos, or memory stores into the container. Likely useful for the drafting workflow (mounting templates) and document analysis workflow (mounting uploaded files).

6. **`SessionRequiresAction` event type** + `permission_policy: 'always_ask'` — the agent can require lawyer confirmation before tool execution. Useful for the §B `bash` "ask" permission and for Phase 6 §Y compliance attestation (lawyer review attestation).

7. **`AgentThreadContextCompactedEvent`** — Anthropic does context compaction on long sessions. Need to verify this preserves audit trail integrity (our app-side mirror should still capture every event).

---

## Required plan corrections (before any Phase 1 build code)

Three concrete edits to `docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md`:

1. **§E and §F:** Replace "web_search and web_fetch are blocked when privileged marker present" with the Environment-based network restriction approach. Add Environment creation to Phase 1 deliverables.
2. **§A:** Remove the `POST /api/agent/sessions/:id/tools/:tool_call_id` route. There is no inbound tool callback. Update the route table to four files.
3. **§A.1:** Remove "internal tool-callback protection" — endpoint doesn't exist. Other route protections (Clerk auth, session ownership, CORS, rate limit) all stand.

Smaller edits:
- §"Phase 0.b" test should run against the allowlisted Environment + sanitization layer combined, not just sanitization.
- §H agent versioning: the SDK exposes `agents.versions.list(agentID)` — use this in the audit log retrievability test.
- Phase 1 deliverables: add "create two Environments (`limited-allowlist`, `open`) and document their config in audit log" to the build list.

---

## Go / no-go on Managed Agents path

**GO** — Managed Agents is real, the plan is achievable with the three corrections above. SDK upgrade from `0.68.0` to `0.92.0` is required before any Phase 1 build code; that's a `npm install @anthropic-ai/sdk@latest` + smoke test.

If we'd been wrong about Managed Agents existing, this would have triggered the §P fallback to Anthropic Agent SDK self-hosted. We don't need that.

---

## Open questions (non-blocking, resolve during Phase 1 build)

1. **Session retention duration** (audit point 5) — needs docs lookup or empirical test
2. **Whether `vaults` should replace or supplement 1Password** for some key storage (e.g., session-scoped tool credentials)
3. **Context compaction behavior on long sessions** — does our event mirror capture compaction events losslessly? (probably yes via `AgentThreadContextCompactedEvent`, but verify)
4. **Environment lifecycle** — when do we tear down Environments? Per-session, per-day, long-lived?
5. **Pricing implications** of always-on Environments vs ephemeral — affects cost estimate in §L

---

## Time spent

Audit took ~30 minutes (target was 1 day max). Findings are conclusive enough to proceed with plan corrections immediately. No further investigation needed before Phase 1 build starts.
