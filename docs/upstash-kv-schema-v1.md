# Upstash KV Schema (V2, v1)

**Status:** Pre-Phase-1 design artifact. Phase 1's agent loop (`api/_lib/agentLoop.ts`) implements against this schema.

**Owner:** App (the V2 Vercel proxy). Anthropic never sees these keys directly — they are read/written exclusively by our code.

**Schema version:** 1.0 (2026-05-12). Bumps require a migration note in this file and a corresponding `schema_version` field write.

---

## Key inventory

| Key | Type | Value shape | TTL | Read | Write |
|---|---|---|---|---|---|
| `session:{id}:messages` | List | JSON-stringified message block | ∞ (chat-history retention; see §H) | Agent loop (build context) | Agent loop (append after each turn) |
| `session:{id}:meta` | Hash | `{ user_id, created_at, last_active_at, schema_version, model, system_prompt_sha256 }` | ∞ | Agent loop, auth check, audit | Agent loop (init + last_active touch) |
| `session:{id}:toolresult:{tool_use_id}` | String (JSON) | `{ tool_use_id, name, result, hash, written_at }` | 24h | Agent loop (idempotency) | Agent loop (after first tool dispatch) |
| `session:{id}:lock` | String | epoch ms of last lock acquire | 30s (auto-expire) | Agent loop (single-flight) | Agent loop (acquire/release) |
| `audit:YYYY-MM-DD` | List | JSON-stringified audit record (see `api/_shared/auditLog.ts`) | 90 days | Audit reads | Every route on every request |
| `audit_record_envelope:{id}` | String | AES-256-GCM ciphertext of §6 Option C metadata-only redaction record | 7 years | Discovery / break-glass only | Sanitization layer on each redaction event |
| `audit_record_envelope:dek` | String | AES-256-encrypted DEK (KEK in 1Password) | 7 years | KEK holder | KEK holder (rotation only) |

---

## Detailed shapes

### `session:{id}:messages` — append-only conversation state

```jsonc
// Each list element (LPUSH or RPUSH) is one JSON-stringified message block.
{
  "role": "user" | "assistant",
  "content": [                              // Anthropic content-block array
    { "type": "text", "text": "…" },
    { "type": "tool_use", "id": "toolu_…", "name": "ceb_search", "input": {…} },
    { "type": "tool_result", "tool_use_id": "toolu_…", "content": [{…}] }
  ],
  "turn_id": "t_2026_05_12_…",              // app-generated, stable
  "sequence": 7,                            // monotone within a session
  "appended_at": "2026-05-12T20:00:00.000Z",
  "sanitization": {                         // attestation of what was redacted
    "privileged": true,
    "compound_risk_buckets": 3,
    "redactions_count": 2,
    "by_category": { "name": 1, "phone": 1 }
  }
}
```

**Write pattern:** RPUSH to preserve send order. Each turn appends one user-block message and one assistant-block message (which may contain `tool_use` + interleaved `tool_result` blocks if the loop iterated through tools before `stop_reason: 'end_turn'`).

**Read pattern:** LRANGE 0 -1 to rebuild the full message history before each `messages.create()` call. Cap message-history length per the §I retention policy (TBD: probably the last 100 turns per session, with older turns summarized into a single system note).

**Atomicity:** All blocks belonging to one turn (assistant message + its tool_use + tool_result blocks) are appended atomically when the turn ends — never partial.

---

### `session:{id}:meta` — session metadata

```jsonc
{
  "user_id": "user_clerk_…",                // Clerk user id
  "created_at": "2026-05-12T19:00:00.000Z",
  "last_active_at": "2026-05-12T20:00:00.000Z",
  "schema_version": 1,
  "model": "claude-sonnet-4-6",             // resolved at session start
  "system_prompt_sha256": "ab12…",          // pinned per §H
  "agent_config_sha256": "cd34…",           // tool list + temp + max_tokens snapshot
  "title": "…",                             // user-visible session title (sanitized)
  "schema_version_at_creation": 1
}
```

**Why pinned hashes:** §H of the plan requires every audit record to bind to the exact agent configuration that produced the assistant turn. The §G audit log writes the `system_prompt_sha256` and `agent_config_sha256` alongside each turn so a deposition reconstruction can prove the response came from a specific known configuration.

---

### `session:{id}:toolresult:{tool_use_id}` — tool idempotency

When the agent loop's tool dispatcher writes to this key with a TTL of 24 hours, the same `tool_use_id` cannot be re-executed within that window. This prevents replay attacks and accidental double-execution if a connection retries mid-turn.

```jsonc
{
  "tool_use_id": "toolu_01XYZ…",
  "name": "ceb_search",
  "input": { "query": "…", "category": "trusts" },
  "result": { "results": [...], "fetched_at": "…" },
  "hash": "ab12…",                          // sha256 of canonicalized result
  "written_at": "2026-05-12T20:00:00.000Z"
}
```

---

### `session:{id}:lock` — single-flight guarantee

A lightweight redis lock (string with 30s auto-expire) prevents two concurrent agent-loop iterations from racing on the same session — e.g., when an SSE connection drops and the client reconnects before the prior turn has finished writing.

Acquire pattern: `SET session:{id}:lock {epoch_ms} NX EX 30`. Release on turn-end or on graceful abort.

---

### `audit:YYYY-MM-DD` — daily audit list

Already implemented in `api/_shared/auditLog.ts`. Schema is the `AuditRecord` interface there:

```ts
interface AuditRecord {
  timestamp: string;
  route: string;
  flowType?: string;
  userId?: string | null;
  model?: string;
  sourceProviders?: string[];
  sanitizedPromptHmac?: string;             // HMAC, never the raw text
  promptLength?: number;
  backstopTriggered?: boolean;
  backstopCategories?: string[];
  latencyMs?: number;
  warningFlags?: string[];
  statusCode?: number;
}
```

90-day TTL refreshed on every push. Phase 7 migrates this to S3 Object Lock in F&F's AWS account; until then, Upstash holds it.

---

### `audit_record_envelope:{id}` — §6 Option C compound-risk audit record

**Status:** Pending F&F partner sign-off on plan addendum #3 (Option C ratification). Schema below is the proposed shape; Phase 1 implementation defers until counsel signs off.

```jsonc
{
  "id": "ar_2026_05_12_…",                  // stable ULID
  "session_id": "sess_…",
  "attorney_id": "user_clerk_…",
  "input_sha256": "ab12…",                  // HMAC of raw input
  "sanitized_sha256": "cd34…",              // HMAC of sanitized prompt of record
  "redaction_decisions_count": 4,
  "by_category_counts": { "name": 2, "phone": 1, "client_matter": 1 },
  "confidence": 0.93,
  "privileged_bool": true,
  "compound_risk_buckets": 3,
  "timestamp": "2026-05-12T20:00:00.000Z",
  "schema_version": 1
}
```

**Encryption:** Record stored as `AES-256-GCM(plaintext_json, DEK)`. DEK lives in Upstash under `audit_record_envelope:dek` encrypted by a KEK held in 1Password. Break-glass access logged per §U.

**Retention:** 7 years.

**No raw or ciphertext of privileged content** — only the metadata above. This is the entire point of Option C.

---

## Retention summary

| Key family | TTL | Rationale |
|---|---|---|
| `session:{id}:messages` | ∞ (subject to §I cap) | Chat history; user-visible |
| `session:{id}:meta` | ∞ | Session metadata; cheap |
| `session:{id}:toolresult:{tool_use_id}` | 24 h | Idempotency window; short-lived |
| `session:{id}:lock` | 30 s | Single-flight; auto-expires on crash |
| `audit:YYYY-MM-DD` | 90 days | Trust-and-safety review window |
| `audit_record_envelope:{id}` | 7 years | Litigation reconstruction (Option C) |
| `audit_record_envelope:dek` | 7 years | Key material; rotated annually |

---

## Capacity sketch

Per-attorney rough order of magnitude (assuming 100 sessions/week, 20 turns/session):

| Item | Daily writes | Steady-state size |
|---|---|---|
| `session:*` keys | ~30 sessions × 40 messages = 1.2k LPUSHes | ~50 KB / session |
| `audit:YYYY-MM-DD` | ~1.2k records | ~5 MB / day |
| `audit_record_envelope:{id}` | ~1.2k records | ~2 MB / day, ~5 GB over 7 yr |

Upstash free-tier limits comfortably cover one attorney; the small-firm tier covers F&F's full footprint with room.

---

## Open items for Phase 1 implementation

1. Decide LPUSH vs RPUSH and codify in the agent loop. Reference implementation in §D should match this doc.
2. Define the `turn_id` / `sequence` write contract — Phase 1 must use a monotone counter to avoid out-of-order replay.
3. Specify the message-history cap (§I retention policy mentions ~100 turns) and the rotate-to-summary path for older turns.
4. Finalize the `audit_record_envelope` JSON schema if F&F counsel ratifies Option C. If counsel chooses Option B instead, replace the envelope record with the full plaintext-derived ciphertext per the original §E spec.
5. Define the recovery UX when a session's `messages` list is truncated or unavailable (read-only mode? regenerate? prompt the user?). Phase 1 deliverable per the plan.

---

**Cross-references:**

- `api/_shared/auditLog.ts` — concrete implementation of the audit-list write path
- `docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md` §A (architecture), §D (state ownership), §E (sanitization), §G (audit log), §H (versioning), §I (retention)
- `docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md` 2026-05-12 third addendum (§6 Option C, tentative)
- `docs/sanitization-audit-2026-05-10.md` §6 (retention reconciliation options)
- `reports/latency-baseline-2026-05-12.json` (V2 stack latency measurements)
