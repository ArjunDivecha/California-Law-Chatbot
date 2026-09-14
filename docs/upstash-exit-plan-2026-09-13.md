# Moving the web app off Upstash Redis — plan (2026-09-13)

Status: **DONE 2026-09-13** — steps 1–5 shipped (see CLAUDE.md “Current state”); step 6 (remove Upstash env/dependency, delete the database) is pending a soak period. Original plan follows.

Original status line: proposal, not started. Arjun's direction on 2026-09-13: the web app at
dancingelephant.ai should stop using Upstash, as the desktop app already has. This
document is the plan; nothing chatbot-owned has been deleted or migrated yet.

## What the web app still keeps in Upstash Redis (`cal-law-chat-redis`)

After the 2026-09-13 purge of stale Personal-Knowledge-System keys, the database holds
only chatbot data (268 keys):

| Key family | Written by | Shape / semantics needed |
|---|---|---|
| `session:{id}:messages`, `:meta` | `api/_lib/sessionStore.ts` | list append + range; hash set/getall |
| `session:{id}:toolresult:{id}` | sessionStore | string with 24h TTL |
| `session:{id}:lock` | sessionStore | `SET NX EX` single-flight lock |
| rate-limit counters | sessionStore / `httpGuard.ts` | `INCR` + `EXPIRE` |
| `user:{id}:sessions` | sessionStore | sorted set (recency index) |
| `chat:{id}`, per-user zset | `api/chats.ts` | string + zset (reimplements Redis client locally) |
| `audit:{day}` (90d), `manifest:*` | `api/_shared/auditLog.ts` | `LPUSH` + `EXPIRE` |
| `audit_record_envelope:{id}` (7y) | auditLog | string with 7-year TTL — legal retention, must migrate, never drop |
| `box:{user}:tokens` | Box integration | string |

## Why this is smaller than it looks

`api/_lib/desktop/sqliteKv.ts` already implements the full `SessionRedis` interface
(lists, hashes, TTL/NX strings, sorted sets) **and** the `AuditSink` interface over
SQLite, and the desktop server injects it with `setSessionRedis()` / `setAuditSink()`.
The web app needs the same thing backed by a store Vercel functions can reach.

## Recommended target: Turso (libSQL) via the Vercel Marketplace

- SQLite-compatible, so `sqliteKv.ts` ports nearly line-for-line (swap `better-sqlite3`
  for `@libsql/client`, make the statements async). One schema for desktop and web.
- Durable and cheap at this scale (268 keys, tens of MB).
- Alternative if a relational store is preferred: Neon Postgres (Marketplace). Same
  adapter shape, different SQL dialect; slightly more work.
- Not suitable: Vercel Blob (no atomic counters/locks), Vercel Runtime Cache (ephemeral).

Follow the `vercel:marketplace` skill to provision; it wires the env vars into the project.

## Steps

1. **Adapter.** `api/_lib/libsqlKv.ts` implementing `SessionRedis` + `AuditSink`, derived
   from `sqliteKv.ts`. Lazy TTL enforcement on read, plus a small sweep on write.
2. **Wiring.** In `sessionStore.ts` `resolveRedis()` and `auditLog.ts`, pick the adapter
   from env (`SESSION_STORE=libsql|upstash`) so the switch is a config flip with rollback.
3. **`api/chats.ts`.** Replace its private `new Redis(...)` with the shared adapter (this
   file also duplicates Clerk auth — gotcha 6 in CLAUDE.md; do not widen scope beyond the
   store).
4. **Migrate data.** One-off script: export every remaining key (the pattern in
   `reports/upstash-cleanup-2026-09-13/backup-pks-keys.mjs` already does the read side),
   import into the new store preserving TTLs. The 48 audit envelopes carry a 7-year
   retention and are the only records that matter legally; verify count and HMACs after
   import.
5. **Verify.** Existing tests mock the store via `setSessionRedis`, so run them against the
   new adapter; then Playwright the live flows (new session, resume, single-flight lock,
   rate limit, audit write) on a preview deploy before flipping production.
6. **Decommission.** Flip `SESSION_STORE`, watch a day of traffic, then remove
   `UPSTASH_REDIS_*` from Vercel env and `@upstash/redis` from `package.json`. Delete the
   `cal-law-chat-redis` database only after the audit envelopes are confirmed in the new
   store.

## Out of scope here

The Personal Knowledge System's own Upstash database and vector index are separate
resources with a separate lifecycle (see `Memory/knowledge-system/reports/20260913_upstash_cleanup/`).
