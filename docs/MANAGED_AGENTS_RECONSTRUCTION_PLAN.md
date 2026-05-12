# Chatbot Reconstruction Plan — Anthropic Agent SDK on Messages API

**Plan file destination:** `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md` *(filename kept for git continuity; contents now describe the Agent SDK path)*
**Date:** 2026-05-03 (original), **2026-05-10 architecture pivot**, **2026-05-10 ZDR-removal addendum**, **2026-05-12 token-map retention addendum (tentative — pending F&F partner review)**, **2026-05-12 Managed-Agents revisit (scope clarification, not reversal)**, **2026-05-12 Anthropic legal-industry launch addendum (tool inventory + phase revisions)**
**Status:** Final, post Opus + Codex (3 rounds, approved) + Ultraplan + Council review + ZDR scope verification, + 2026-05-10 plan-level pivot to Anthropic Team plan (no ZDR). The 2026-05-12 third addendum below is **tentative pending F&F partner sign-off**; the 2026-05-12 fourth and fifth addenda below carry forward the consequences of Anthropic's 2026-05-12 legal-industry launch.

---

## 2026-05-12 (fifth addendum) — Anthropic legal-industry launch: tool inventory + Phase deliverable revisions

**Trigger:** Anthropic's 2026-05-12 release of:
- 12 practice-area plugins (Apache-2.0 at [`anthropics/claude-for-legal`](https://github.com/anthropics/claude-for-legal))
- 20+ MCP connectors (Free Law Project for CourtListener, Thomson Reuters CoCounsel for Westlaw + Practical Law + KeyCite, Solve Intelligence for citation verification, iManage / NetDocuments for DMS, Definely / Ironclad / DocuSign for contracts, Harvey, Everlaw, Relativity, etc.)
- Claude Skills as an open standard (`agentskills.io`, Apache-2.0, Pro+/Team/Enterprise availability)
- `mcp-client-2025-11-20` beta on the Messages API — first-class `mcp_servers` parameter on `messages.create()` ([docs](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector))
- Claude for Microsoft 365 (Word / Outlook plug-ins)
- Claude Cowork (hosted workspace product)

The 2026-05-12 fourth addendum (immediately below) handled the Managed-Agents implications. This fifth addendum covers the rest — what's adoptable into V2's Messages-API runtime, and which Phase deliverables it changes.

**Finding:** The available tooling landscape changed materially. Several things V2 was building from scratch (citation verifier in Phase 3, drafting workflow patterns in Phase 2) now have higher-quality Anthropic-blessed equivalents reachable via the `mcp_servers` parameter or as Apache-2.0 Skill markdown. **The V2 wedge (sanitization-first privilege gating) does not change.** What changes is the tools and the system-prompt content behind that wedge.

### Adoption decision matrix

| Item | Verdict | Phase | Notes |
|---|---|---|---|
| Default model → `claude-opus-4-7` | **Adopt** | Phase 1 | Anthropic positions Opus 4.7 as legal-reasoning flagship (90.9% on Harvey's BigLaw Bench). Current default is `claude-sonnet-4-6`. Cost increase is real — see cost-impact note below. |
| MCP toolset support in `agentLoop.ts` | **Adopt** | Phase 1 | Add `mcp_servers` parameter + `mcp-client-2025-11-20` beta header to `messages.create()`; handle `mcp_tool_use` / `mcp_tool_result` content block types. Privilege gating extends to MCP toolsets (omit when `privileged=true`). |
| Free Law Project CourtListener MCP | **Adopt (additive)** | Phase 1 | Keep in-process `courtlistener_search` for audit-fidelity. Add MCP as alternative path for cases where PACER / judge profiles / oral arguments are useful and audit-trail-at-our-wire is not required. |
| Inlined Skill content from `anthropics/claude-for-legal` (Apache-2.0) | **Adopt** | Phase 1 | Specifically: `litigation-legal/skills/{matter-intake,claim-chart,legal-hold,privilege-log-review}/SKILL.md` as system-prompt augmentation. This is the V2 portability principle (fourth addendum) cashing in. |
| Thomson Reuters CoCounsel MCP (Westlaw + Practical Law + KeyCite) | **Adopt later** | Phase 2 | Single biggest research-quality upgrade. Depends on F&F having a TR subscription (open question). Privilege-gated like `web_search`. |
| Solve Intelligence MCP for citation verification | **Evaluate before Phase 3** | Phase 3 | Could replace the hand-rolled verifier sub-agent. Decision criterion: F1 against ground-truth citations on a 30-question evaluation set. If acceptable, replace Phase 3's verifier scope with an MCP tool call. If insufficient, build the hand-rolled verifier as originally planned. |
| iManage / NetDocuments MCP | **Adopt later, strict gating** | Phase 4+ | Only if F&F adopts one of those DMS products. **Privileged-input disabled by design** — a DMS contains client-confidential documents; MCP tool inputs flow through Anthropic per standard retention. Include in tools array ONLY when `privileged=false`, which means an attorney can never use V2 to fetch a privileged matter document — that lookup happens in the attorney's iManage UI directly, not through V2. |
| Definely / Ironclad / DocuSign MCP | **Watch** | TBD | Contract-lifecycle integrations. Out of F&F's current scope (probate / family law primary focus). |
| Harvey MCP | **Skip** | — | Separate Harvey subscription required (different price point + commercial relationship). |
| Claude for M365 Word / Outlook | **Skip from V2's product surface** | — | Useful for F&F attorneys directly, but doesn't gate input. F&F licenses these at the Anthropic plan level, not the V2 product level. |
| Claude Cowork as the V2 chat surface | **Skip** | — | No sanitization-first input gate. V2's `/v2` route keeps that role. |
| Managed Agents deployment of the plugins | **Sandbox-only** | — | See fourth addendum. Synthetic-data evaluation track for pattern study; never in production. |

### Phase-by-phase plan revisions

**Phase 1 (Spike) — REVISED deliverables.** Adds to the existing Phase 1 deliverable list (per §A and the plan ground truth):

- **(0) Tool-result sanitization wrapper** — *prerequisite to MCP and to any expansion of the tool surface.* The 2026-05-10 second addendum and `docs/sanitization-audit-2026-05-10.md` §8 item #8 both require: "every `tool_result` block runs through the same sanitizer before being appended to `messages`." Current `api/_lib/agentLoop.ts` `dispatchWithCache` returns raw tool content directly into the next `tool_result` block — the 100-trap gate didn't catch this because the runner tests `analyze(simulated_tool_result)` directly, not the agent loop's integration. **Fix before any tool-surface expansion** (the audit explicitly bound MCP/W5 wrapper as Step 3 of the V2 build plan). Implementation: run `analyze()` on each tool's content before constructing the `tool_result` block, tokenize any HIGH_RISK spans, attach a `tool_output_sanitization` attestation to the audit record. Smoke: re-author W5 traps in `tests/traps/manifest-v1.json` to exercise the AGENT LOOP path end-to-end (not just `analyze()`); verify all redactions fire at the loop's wire, not just the sanitizer's.
- Default model → `claude-opus-4-7` in `api/_lib/agentLoop.ts` (`DEFAULT_MODEL`). Re-run latency baseline + smoke after the bump.
- Extract `DEFAULT_SYSTEM_PROMPT` from `agentLoop.ts` into `agents/california-legal/skills/*.md` matching the `anthropics/claude-for-legal` Skill frontmatter shape (per fourth addendum portability principle, open item #12). **Load by workflow / intent, not concatenation.** A workflow-aware loader picks Skills relevant to the current turn (matter-intake when starting a matter, claim-chart when building one) rather than concatenating every Skill into every system prompt — which would bloat context, dilute the model's task focus, and waste Opus 4.7 tokens.
- Define `source` block schema for tool results — per fourth addendum portability principle (open item #14).
- **MCP toolset support** in `agentLoop.ts` and `agentProxy.ts`. **Implementation detail:** MCP is on Anthropic's beta surface (`client.beta.messages.create` / `client.beta.messages.stream` with `betas: ["mcp-client-2025-11-20"]`), not on the stable `client.messages.create` we currently call. Build a thin beta-call wrapper that the agent loop dispatches to ONLY when at least one MCP toolset is in the tools array; stable inference-only calls keep the current code path unchanged. Handle `mcp_tool_use` / `mcp_tool_result` content block types alongside the existing `tool_use` / `tool_result` types in the streaming loop. Privilege gating in `buildToolsArray(privileged)` extends to MCP toolsets (omit when `privileged=true`, per the §E gating extension below). Add a feature flag (env var `V2_MCP_ENABLED=true`) so the new code path can be rolled out independently of model bump and prompt extraction.
- **MCP pilot — deterministic public server first.** Before wiring the Free Law Project endpoint (auth/URL shape not yet cleanly documented in their public-facing materials as of 2026-05-12), pilot with a deterministic, publicly-documented MCP server (e.g., one of Anthropic's reference servers) so the beta-call wrapper, privilege gating, and `mcp_tool_use` handling can be validated against a known-shape integration. Only then point at Free Law Project's official endpoint.

### Phase 1 follow-up sequencing (corrected by Codex review 2026-05-12)

The deliverables above must land in this order — each gates the next:

1. **Tool-result sanitization wrapper** (closes the existing audit/code gap; required by the 2026-05-10 second addendum's "inputs AND tool outputs" scope; required by `docs/sanitization-audit-2026-05-10.md` §8 item #8). Adding MCP before this is done would expand the tool-output leak surface before the current in-process path is compliant with the addendum it claims to implement.
2. **Default model bump → `claude-opus-4-7`** and re-run latency baseline + smoke. Quick win; validates the model the 2026-05-12 announcement cites; baseline numbers feed the cost-impact decision (below).
3. **System prompt → Skill markdown + workflow-aware loader.** Per fourth addendum portability principle. Workflow-intent dispatch, not concatenation.
4. **MCP plumbing behind a feature flag + privilege gating + beta-call wrapper.** Implement against a deterministic public MCP server first.
5. **Free Law Project CourtListener MCP pilot** once the official endpoint + auth shape are confirmed. Keep in-process `courtlistener_search` running as the audit-fidelity path.

Anything beyond #1 that expands the tool surface (including switching CourtListener to MCP-only) is blocked until #1 lands.

**Phase 2 (Drafting workflows) — REVISED scope.** Instead of authoring drafting-workflow patterns from scratch:
- Pull Skill content from `anthropics/claude-for-legal/{commercial-legal,corporate-legal,ip-legal}/skills/*.md` (Apache-2.0).
- Adapt for California probate / family law where F&F practices.
- Build the drafting UI on top of V2's existing agent loop with these skills as `system_prompt` overrides (loaded per-route or per-flow).

Net delta: less hand-authoring of attorney workflow patterns; more curation of which Anthropic Skills are relevant to F&F's practice. Reduces Phase 2 effort by an estimated 30–50%.

**Phase 3 (Verifier sub-agent) — POSSIBLY REPLACED.** Branched path:
1. Build a 30-question citation-verification evaluation set drawn from V2's existing trap-manifest sources (or new authored cases).
2. Run Solve Intelligence MCP against the eval set; measure F1 against ground-truth citations.
3. If F1 is acceptable (threshold TBD with Arjun, suggested ≥ 0.90), replace Phase 3's hand-rolled verifier with the MCP tool call. Phase 3 collapses to "wire Solve Intelligence MCP into the agent loop with same privilege gating as other MCP toolsets."
4. If F1 is insufficient, proceed with the hand-rolled verifier as originally planned.

**Phase 4 (UI integration) — NO CHANGE.** V2 chat at `/v2` is built (commit `f2a4971`). Phase 4 follow-ups (Clerk auth, session persistence, markdown rendering, citation rendering, sidebar integration) unchanged.

**Phase 4.5 (Shadow run) — NO CHANGE.**

**Phase 5 (Cutover + teardown) — NO CHANGE** (still deletes ~7,800 lines of orchestration).

### Tool inventory (replaces the implied "two custom tools + web_search" list)

```
V2 tools, post-2026-05-12 fifth addendum:

  in-process (audit-fidelity-critical — full input/output observability at V2's wire):
    - ceb_search                    (Upstash Vector + OpenAI embedding, 5 namespaces)
    - courtlistener_search          (CourtListener REST v4)

  mcp_servers via Messages API (Anthropic dispatches server-side, retention per Team-plan policy):
    - free_law_project_mcp          (Phase 1 — additive alternative to in-process courtlistener_search)
    - tr_cocounsel_mcp              (Phase 2 — if F&F subscription confirmed)
    - solve_intelligence_mcp        (Phase 3 candidate — replaces verifier sub-agent if eval passes)
    - imanage_mcp / netdocuments_mcp (Phase 4+ — DMS adoption + privileged-off-only inclusion)

  anthropic server-side tools (built into messages.create, retention per Team-plan policy):
    - web_search_20250305           (Phase 1 — privilege-gated, omit when privileged)

  system prompt content (Apache-2.0 Skills inlined per portability principle):
    - litigation: matter-intake, claim-chart, legal-hold, privilege-log-review
    - drafting:   selected from commercial-legal/, corporate-legal/, ip-legal/
    (loaded from agents/california-legal/skills/*.md once portability extraction lands)
```

### Privilege-gating extends to MCP toolsets (clarifying §E)

`buildToolsArray(privileged)` in `api/_lib/tools/index.ts` already omits `web_search_20250305` when `privileged=true`. This addendum extends that contract:

- **`free_law_project_mcp`, `tr_cocounsel_mcp`, `solve_intelligence_mcp`**: omit when `privileged=true`. These are public-research tools. A privileged input shouldn't generate a search query into them.
- **`imanage_mcp` / `netdocuments_mcp`** (if adopted): omit when `privileged=true`. The DMS contains the privileged material; sending a privileged input as a search query to it would leak the input via MCP-side telemetry / Anthropic-side retention. The privileged-input case is "use iManage directly, not through V2."
- **`ceb_search` and `courtlistener_search` (in-process)**: ALWAYS available, including when `privileged=true`. These tool inputs and outputs are entirely within V2's wire — no Anthropic retention exposure for the search query itself (only the resulting `tool_result` block reaches Anthropic, which the §6 Option C audit-record-envelope already accounts for).

### Cost impact (§U-adjacent — Arjun decision before Phase 5 cutover)

Opus 4.7 is materially more expensive than Sonnet 4.6 per million input/output tokens (current pricing at [`claude.com/pricing`](https://claude.com/pricing) — verify before committing). At V2's measured ~26k tokens per turn (latency baseline 2026-05-12), an Opus 4.7 turn costs roughly N× a Sonnet 4.6 turn. Three options Arjun chooses among before Phase 5:

1. **Cap session length** to bound monthly spend (e.g., 100 turns/attorney/month).
2. **Tier-route**: Sonnet 4.6 for routine queries, Opus 4.7 for explicitly-flagged "deep research" or compound-risk-bucket-rich turns. Decision logic in `agentProxy.ts`.
3. **Accept the increase** — quality gain on legal reasoning is the primary value driver for F&F.

Not blocking Phase 1; needs an answer before billing real attorney usage in Phase 4.5 shadow run.

### Plan supersession order

This 2026-05-12 fifth addendum:
- Updates the tool inventory (supersedes the implied "two custom tools + web_search" list in §B).
- Updates Phase 1 deliverables (adds Opus 4.7 default, MCP toolset support, Free Law Project pilot, portability extraction).
- Updates Phase 2 scope (skill content reuse over from-scratch authoring; estimated 30–50% effort reduction).
- Adds a branched Phase 3 path (Solve Intelligence MCP eval before hand-rolling verifier).
- Adds the cost-impact decision point.
- Does NOT change Phase 4, Phase 4.5, or Phase 5 plans.
- Does NOT change the V2 wedge (sanitization-first privilege gating) — see fourth addendum portability principle.

---

## 2026-05-12 (fourth addendum) — Managed Agents revisit: scope clarification, not reversal

**Finding:** The 2026-05-10 first addendum rejected Managed Agents on the grounds that "Managed Agents is NOT covered by ZDR ... incompatible with F&F's ZDR requirement for privileged content." The 2026-05-10 second addendum then removed ZDR from the project's compliance posture entirely (F&F stays on Team plan; ZDR/BAA/SOC 2 paperwork permanently off the table). This left the first addendum's rejection logically dependent on a premise that no longer holds. The original conclusion is correct, but the original reasoning isn't — the issue is broader than ZDR.

Triggered by Anthropic's 2026-05-12 legal-industry launch ([`claude.com/blog/claude-for-the-legal-industry`](https://claude.com/blog/claude-for-the-legal-industry)) and the open-source [`anthropics/claude-for-legal`](https://github.com/anthropics/claude-for-legal) repository, which together position Managed Agents as the preferred deployment surface for the 12 practice-area plugins. Reconsidered the decision; concluded the rejection stands but the reasoning needs correction and the absolutist wording needs softening.

**Actual current reasoning for staying on Messages API (replaces the obsolete ZDR-implies-everything reasoning of the first addendum):**

1. **ZDR-eligibility asymmetry across Anthropic surfaces** — per `platform.claude.com/docs/en/agents-and-tools/mcp-connector` and `docs/api-and-data-retention` as of 2026-05-12:
   - **Messages API: ZDR-eligible** under enterprise paperwork. Presently moot for F&F (Team plan, no ZDR) but preserves optionality if F&F's posture or Anthropic's pricing ever shifts.
   - **Managed Agents: not ZDR-eligible**, ever. MA is a stateful resource with manual-delete semantics — structurally outside the ZDR shape.
   - **MCP connector: not ZDR-eligible** under any tier. The moment a `mcp_servers` parameter is included on `messages.create()`, that specific call falls outside ZDR. Privilege-gated tool inclusion (omit MCP toolsets when input is privileged) protects this.
   - **Claude Skills (runtime): not ZDR-eligible**. Skills delivered as system-prompt text content via `messages.create()` remain ZDR-eligible because they're indistinguishable from any other system prompt.

2. **Auto-delete vs manual-delete retention shape** — under current Team-plan posture (no ZDR for any surface), Messages API auto-deletes after the trust-and-safety retention window (~30 days). Managed Agents persist on Anthropic infrastructure until manually deleted. Even without ZDR, the auto-delete window is shorter and more deterministic than the manual-delete obligation V2 would take on with MA. A forgotten cleanup process on MA = unbounded retention = a discovery target.

3. **Audit-trail control** — `api/_lib/agentLoop.ts` writes audit records at every step (every tool dispatch, every model invocation, every span detection) to `api/_shared/auditLog.ts` and ultimately to `audit:YYYY-MM-DD` lists in Upstash KV. Managed Agents dispatches tools server-side; we'd consume audit via an API callback rather than logging at the dispatch site. Defensibility under a litigation hold is meaningfully easier when V2 logs at its own wire, with HMAC-stable references back to the sanitized prompt of record.

4. **Switching cost** — V2's Phase 1 spike (commits `8401011` through `f2a4971`) is ~1,600 lines of working, gated, audited code. Switching runtime to MA would rewrite ~1,200 of those lines (`agentLoop.ts`, `sessionStore.ts`, parts of `agentProxy.ts`). Bad ROI when ~90% of MA's value (Skills content, MCP connectors, sub-agent patterns) is reachable from Messages API today via `mcp_servers` parameter and inlined-Skill-content system prompts.

**What this changes:**

| Item | 2026-05-10 first addendum (original) | 2026-05-12 fourth addendum (corrected) |
|---|---|---|
| Wording | "Permanently off the table — not a fallback, not a future option" | **Off the table for privileged / client-confidential workflows under Anthropic's current ZDR scope.** Revisit if (a) Anthropic ships ZDR-eligible Managed Agents, (b) F&F adopts a separate non-confidential product surface (internal marketing review, public-FAQ generation) where Team-plan retention is acceptable, or (c) F&F's roadmap grows to include the scheduled-agent workflows the 2026-05-12 announcement positions on MA (`docket-watcher`, `renewal-tracker`, `regulatory-monitor`). |
| Reasoning | "Not ZDR-eligible, incompatible with F&F's ZDR posture" (premise invalidated by 2026-05-10 second addendum) | (a) ZDR-eligibility asymmetry preserves future optionality; (b) auto-delete vs manual-delete is a real Team-plan retention difference; (c) audit-trail control favors self-hosted; (d) switching cost is real. |
| Sandbox track | Not mentioned | **Allowed:** synthetic-data evaluation of the Apache-2.0 `anthropics/claude-for-legal` plugins on MA. Pattern study only — borrow agent structure, reviewer-note conventions, source-tag schema, handoff patterns, worker isolation. **No real F&F matters, no privileged drafts, no production attorney prompts.** |

**V2 portability principle (newly explicit):**

To keep the cost of a future runtime swap manageable, V2's agent definitions should adopt a shape close enough to Anthropic's plugin format that migration would be a runtime swap, not a product rewrite. Phase 1 follow-up work (not blocking, but should land before Phase 5 cutover):

- **Extract the hardcoded system prompt** in `agentLoop.ts` (`DEFAULT_SYSTEM_PROMPT`) into one or more `agents/california-legal/skills/<name>.md` files with the same frontmatter shape as Anthropic's Skill files (`name`, `description`, `user-invocable`, `argument-hint` per the `claude-for-legal` repo).
- **Extract agent config** (model, max_tokens, tool list, max-iterations cap, default system prompt id) into `agents/california-legal/agent.yaml` with field names matching Anthropic's plugin schema.
- **Define a `source` block schema** for tool results so retrieval provenance is structured the same way Anthropic's plugins surface it (e.g. `{ source_type: 'ceb' | 'courtlistener' | 'web', title, citation, url, retrieved_at }`). Tools return structured `source` arrays alongside content; the model is prompted to cite via `source_id`.
- **Keep the privilege-gated tool-array construction** (`buildToolsArray(privileged)`) and the sanitization-first proxy regardless of runtime. Those are the V2 wedge and don't change.

If MA later becomes ZDR-eligible (or if F&F adopts a non-confidential product surface), the migration is then a runtime swap that consumes the same `agent.yaml`, `skills/*.md`, and `source` schema we've been using — not a rewrite of attorney-facing product behavior.

**Plan supersession order:** this 2026-05-12 fourth addendum supersedes the **wording** of the 2026-05-10 first addendum (specifically the "permanently off the table — not a fallback, not a future option" line). The original **conclusion** (Messages API is V2's runtime) stands; the **reasoning** is replaced as above. The 2026-05-10 first addendum's other content (Managed Agents' specific incompatibilities — `beta.agents.*` / `beta.sessions.*` / Environments) remains accurate as a historical description of the alternative we declined.

---

## 2026-05-12 (third addendum, TENTATIVE — pending F&F partner review) — Token-map retention model: hybrid (Option C)

> ⚠️ **Status: NOT YET BINDING.** This addendum is Arjun's working decision based on the sanitization audit (`docs/sanitization-audit-2026-05-10.md` §6). It must be reviewed and signed off by F&F partners before it supersedes the §E retention table. The key open question for counsel is restated in **Required F&F counsel input** below. Do not merge to `main` and do not treat as the binding plan until that sign-off is recorded here.

**Finding:** The 2026-05-10 sanitization audit (§6) surfaced an unresolved conflict between two parts of the codebase:

- Plan §E specifies a **server-side envelope-encrypted token map**: AES-256-GCM, DEK in Upstash KV, KEK in 1Password vault, 7-year retention for litigation reconstruction.
- The imported sanitization layer (`codex/drafting-magic-sanitized` → V2) implements a **client-side per-attorney passphrase-encrypted IndexedDB token store**: privileged content never leaves the device.

These two models are mutually exclusive. The audit drafted three options (A client-only, B server envelope-encrypted, C hybrid metadata-only audit record). Audit recommendation: **Option C**.

**Decision (tentative):** **Option C — hybrid.** Client-side IndexedDB carries the live token map for the duration of an attorney's active session; the server stores only an envelope-encrypted, metadata-only audit record per redaction event. Privileged ciphertext does not leave the attorney's device.

**Why C and not B (the original §E choice):** The original §E argument for full server-side ciphertext rested on "we may be subpoenaed to prove the sanitized prompt corresponds to the user's actual privileged input" (§E line 483 in pre-2026-05-12 form). The 2026-05-10 no-ZDR pivot changes this argument's weight in two ways:
1. Anthropic itself retains the sanitized form for ~30 days under Team-plan trust-and-safety policy. For *recent* matters, the "what did Anthropic see?" question is independently answerable from Anthropic's own records — F&F does not need to be the sole custodian.
2. The 7-year window is only load-bearing for malpractice or discovery actions referring to a specific *historical* query. Option B answering that need means F&F's own infrastructure carries privileged ciphertext for 7 years, which is itself a discovery target and a new attack surface (compromised Upstash + compromised 1Password = full historical privileged content disclosure).

Option C trades the ability to rehydrate the verbatim privileged input years later for an attestable record that the redaction happened, with hashed evidence of the input and the sanitized form, plus categorical and counted metadata. This covers most realistic deposition lines ("did you redact client names in matter X?" → yes, with timestamp, count, category, and hash matching the sanitized prompt of record) without storing privileged ciphertext on F&F infrastructure.

**Required F&F counsel input (this is what must be answered before this addendum is binding):**

> *In a plausible malpractice or discovery scenario 5+ years out, will F&F's defense ever need to rehydrate the exact privileged input verbatim, or is "we can prove the redaction happened, when, by category, and that the sanitized prompt of record matches a specific hash of the original input" sufficient?*

- If **sufficient** → ratify Option C; this addendum lands as binding.
- If **insufficient** → revert to Option B (server envelope-encrypted full ciphertext); F&F accepts Upstash as a sub-processor of privileged ciphertext and a 7-year retention obligation on F&F-controlled infrastructure.
- If **counsel asks for a middle ground** (e.g., shorter retention, different cipher boundary, named-custodian access logging) → record their preference here and draft addendum #4.

**What this changes (if ratified):**

| Item | Before (plan §E as-written) | After (Option C ratified) |
|---|---|---|
| Token-map storage (live session) | Server-side Upstash KV, envelope-encrypted | **Client-side IndexedDB on attorney device, passphrase-encrypted** (per imported sanitization layer) |
| Token-map retention | 7 years on Upstash, AES-256-GCM, KEK in 1Password | **Not retained server-side at all.** Lives on attorney device for the active session; cleared per attorney workflow |
| Server-side audit record per redaction event | (not specified separately) | **New artifact:** envelope-encrypted record per redaction event containing `{session_id, attorney_id, input_sha256, sanitized_sha256, redaction_decisions_count, by_category_counts, confidence, privileged_bool, timestamp}`. No plaintext, no ciphertext of privileged content. 7-year retention, AES-256-GCM, KEK in 1Password, DEK in Upstash KV. Break-glass access logged per §U. |
| Litigation reconstruction capability | Verbatim rehydration via break-glass | **Attestable redaction events** (proof a redaction occurred, by category, with hash binding to sanitized prompt of record). No verbatim rehydration after attorney session ends. |
| Privileged ciphertext on Upstash? | Yes (encrypted) | **No.** Only metadata/hashes. |
| Single-point-of-failure scope | Full Upstash + 1Password compromise = all-history privileged content | One attorney's laptop + their passphrase = one attorney's *active session* matters only |
| Attorney workflow burden | Transparent (server holds it) | Must safeguard passphrase + device; passphrase recovery story must be defined (see Open implementation items below) |

**Plan supersession order:** if and only if ratified by F&F partner sign-off, this 2026-05-12 third addendum supersedes the retention rows of the §E table and the supporting reasoning paragraph in §E. The rest of §E (sanitization runs in the Vercel proxy *before* any input reaches the Messages API; agent receives `privileged: false` content; envelope-encryption semantics for the surviving server-side audit record) is unchanged. The §G audit log + §Y attestation generator gain a new artifact type (the per-redaction audit record) and must be updated correspondingly when Phase 1 design begins.

**Open implementation items (must be resolved during Phase 1 if Option C ratifies):**
1. **Passphrase recovery story.** If an attorney forgets the IndexedDB passphrase, the active-session token map is lost — they cannot rehydrate any in-flight sanitized prompts. Define: who issues recovery passphrases, how device migration works, what happens on attorney offboarding.
2. **IndexedDB durability story.** Browser-cleared IndexedDB = lost live token map. Define: backup cadence (encrypted export to attorney-controlled storage?), browser-clear warning UX.
3. **Audit-record schema lock.** The per-redaction record schema above is a draft. Finalize fields, hash algorithm version field, schema version field before Phase 1.
4. **§Y attestation update.** The per-session attestation generator must reference the new audit-record artifact and confirm its integrity. Spec update required.
5. **CI assertion (§S) update.** The "final sanitization check" still scans outbound `messages.create()` payloads against the live (now client-side) token map. Mechanism is unchanged because that check runs inside the same browser/proxy session where the live map exists. Document the call site for clarity.

**Implications for in-flight work:**
- The committed mechanical fixes from audit §8 (commit `a720572`) are unaffected by this choice — they sit at the detection layer, not retention.
- Audit §8 item #9 ("Architectural reconciliation of §6 retention model") becomes ✅ pending F&F sign-off — `docs/sanitization-audit-2026-05-10.md` §10 status table updated correspondingly.
- The 100-trap authoring work (Step 2) does not depend on the retention choice and can proceed in parallel.

---

## 2026-05-10 (second addendum) — No ZDR. Sanitization is the only line of defense.

**Finding:** F&F remains on Anthropic's **Team plan**, not the enterprise plan that confers ZDR. ZDR/BAA/SOC 2 paperwork (Phase 0.a) is **permanently off the table** for this project — not a fallback, not a future option, not paperwork-in-flight.

**What this changes:**

| Item | Before (assumed ZDR) | After (no ZDR) |
|---|---|---|
| Defense posture | Sanitization redacts privileged content; ZDR ensures Anthropic does not retain whatever leaks through | **Sanitization is the only line of defense.** Anything that reaches `api.anthropic.com` is retained under Team-plan policy (~30-day trust-and-safety retention, longer if flagged, accessible by Anthropic staff for trust-and-safety review). A sanitization miss is a privilege breach. |
| Phase 0.a paperwork | Required gate for Phase 4.5 + Phase 5 | **Removed from plan.** No DPA, no BAA, no SOC 2 dependency. |
| Phase 0.b (engineering smoke test) | Pre-flight bug-catcher | Folded into the formal gate below; stops being a separate item. |
| Phase 0.c (formal privilege review) | Pre-cutover gate, 100 traps, zero leaks | **Promoted to the single hardest gate in the project.** 100 traps remain (per Arjun decision 2026-05-10); criterion is zero leaks across two consecutive full-suite runs. **If the sanitization layer cannot reach zero on the trap set, the migration stops here** — there is no second net. |
| Sanitization scope (§E) | Inputs only | **Inputs AND tool outputs.** Per Arjun decision 2026-05-10. Every `tool_result` block is run through the same sanitizer before being appended to `messages`, in case a public-record tool surfaces a term that, in context, re-identifies a client. Trade-off (possible false-positive redactions degrading answer quality) accepted. |
| §Q F&F communication memo | "Direct enterprise subscription, signed ZDR DPA + BAA + SOC 2" | **Rewrite required before Phase 5.** Honest framing: Team plan, sanitization layer is the contractual privilege boundary, Anthropic privacy controls (training opt-out, abuse-monitoring posture) documented, trust-and-safety retention disclosed. Draft owned by Arjun + F&F partners. |
| §Y attestation generator | Attests "ZDR + BAA + SOC 2 on file" alongside sanitization + audit chain | Attests **only** sanitization decisions, audit-chain integrity, agent-config SHA, tool-call traces, verification report. The attestation cannot claim non-retention by Anthropic. The §Y JSON schema gains an explicit `inference_provider_retention_policy` field stating Team-plan terms verbatim. |
| §W evidentiary discovery hardening | "ZDR" claim defensible in deposition | Deposition answer to "what does Anthropic see and retain?" is now "the sanitized form, retained ~30 days under Team-plan trust-and-safety policy, accessible to Anthropic staff." F&F partners must be briefed on this before Phase 5. |
| §X UPL exposure controls | Unchanged structurally | Unchanged. |
| §M rollback triggers | Unchanged | Unchanged, but **a single confirmed sanitization failure in production triggers immediate rollback** (already in §M as "any privacy/sanitization failure, immediate, no threshold" — re-emphasized here). |
| §U key management | 6 keys including OpenRouter | OpenRouter dropped per 2026-05-10 first addendum; no change here. |

**Defense-in-depth still available on Team plan (must be configured before Phase 1 sends real-format traffic):**
- Console → Workspace → Privacy: opt out of training-data use.
- Per-API-key tagging so a leak can be scoped + revoked quickly.
- Egress allowlist (§U) keeps blast radius small if a key is exfiltrated.
- The `tools`-array privilege gating for `web_search` (§E) still works exactly as designed and remains in scope.

**Pre-flight critical path is now sanitization-first.** The four open-items at the bottom of this doc are re-ordered:

1. **Sanitization branch import + deep audit** (was item 1): pull `codex/drafting-magic-sanitized` into V2, document every redaction rule, NER pass, n-gram entity-correlation pass, confidence scorer. Deliverable: `docs/sanitization-audit-2026-05-XX.md` including a "known weaknesses" section.
2. **Threat model + 100-trap authoring** (new): formalize the threat classes (direct PII, compound identifiers, adversarial prompts, indirect leakage via tool inputs, verifier-loop cross-contamination). Half the traps drawn from sanitized F&F matter patterns; the other half synthetic.
3. **Privilege smoke test + iterate sanitization to zero** (was §0.b + §0.c): run all 100 traps, patch every failure, re-run the whole suite, repeat until two consecutive full-suite zero-leak runs. **Hard gate. No Anthropic traffic until this passes.**
4. KV schema + tool-call latency baseline (was items 3 + 4): unchanged, can run in parallel with sanitization iteration.

**CI assertion added (§S):** every `messages.create()` call in dev/CI runs through a "final sanitization check" that scans the outbound payload for any string in the privileged token map. Belt-and-suspenders for what is now a single point of failure.

**Plan supersession order:** this 2026-05-10 second addendum supersedes any prior wording in §0.a, §0.b, §0.c, §Q, §Y, and §W that assumed ZDR. Other sections unaffected except where called out in the table above.

---

## 2026-05-10 (first addendum) — Architecture Pivot — Managed Agents removed from the plan

> ℹ️ **Wording revised 2026-05-12** — see the fourth addendum at the top of this document. The "permanently off the table" framing below was based on F&F having a ZDR requirement; the 2026-05-10 second addendum subsequently removed ZDR from the project's posture, invalidating the original premise. The conclusion (MA stays out of V2's runtime) is unchanged; the reasoning has been corrected and the absolutist language has been softened to "off the table for privileged / client-confidential workflows under current ZDR scope."

**Finding (original 2026-05-10 wording — preserved for historical record):** Anthropic's official platform docs explicitly state Managed Agents is NOT covered by ZDR: *"Claude Managed Agents is a stateful resource. You can delete session transcripts, but there is no automatic deletion."* This is incompatible with F&F's ZDR requirement for privileged content. Managed Agents is therefore **permanently off the table** for this project — not a fallback, not a future option.

**Pivot:** The agent runtime is now **Anthropic Agent SDK self-hosted on the Messages API**. The Messages API is GA and ZDR-eligible under enterprise terms (Phase 0 paperwork). We own the agent loop, session state, tool dispatch, and event mirror — Anthropic only handles inference.

**What changes in this plan:**
- No `beta.agents.*` / `beta.sessions.*` / Environments — those are Managed-Agents-only primitives
- Agent loop runs in our Vercel function: `messages.create({tools, messages})` → execute tool_use → append `tool_result` → loop until `stop_reason: 'end_turn'`
- App fully owns conversation state in Upstash KV (no remote "session" to mirror — there's only one copy)
- Per-tool privilege gating happens in our code at the request-construction site (no Environment switch needed)
- Beta-API churn risk (§J) drops to ~zero — Messages API breaking changes are years apart, not quarterly
- Beta header `anthropic-beta: managed-agents-*` is removed entirely

**What stays identical:**
- All of Phase 0 (compliance paperwork, privilege smoke test, formal privilege review gate)
- All of Phases 2–6 (drafting workflows, verifier sub-agent, UI integration, shadow run, cutover, attestation generator)
- Deletion math (~7,800 lines): the OpenRouter proxies, custom orchestrator under `agents/`, `orchestrate-document.ts`, `verifierService.ts`, and the bulk of `chatService.ts` all go regardless of which Anthropic runtime we use
- Tool layer (§B), sanitization (§E with mechanism change), audit log (§G), versioning (§H), retention (§I), evidentiary controls (§W), UPL (§X), per-session attestation (§Y)
- **No fallback inference provider.** Direct Anthropic subscription is the only path. Bedrock and OpenRouter are explicitly out of scope for this and any future phase of this project. If Anthropic ZDR/BAA paperwork doesn't close, that is a project-level block to be resolved with Anthropic — not an architectural pivot.

A corrigendum is added to `docs/phase-1-sdk-audit.md` recording the ZDR-scope finding that invalidated the Managed Agents path.

---

## Context

The chatbot currently runs an OpenRouter dual-model pipeline (Gemini generator + Claude verifier) plus a custom 4-agent orchestrator under `agents/` for document drafting. Combined orchestration footprint: ~7,800 lines.

**This plan migrates to the Anthropic Agent SDK self-hosted on the direct Messages API.** Anthropic only provides inference; we own the agent loop, session state, tool dispatch, and audit trail in a thin Vercel proxy. Two model roles (workbench + verifier) talk to the same Messages API endpoint with different system prompts and tool sets.

**Why now:** ZDR/BAA/SOC 2 paperwork is in flight separately and gates only Phase 5 cutover. Phases 1–4 may run against staging/non-confidential data while paperwork closes.

**Intended outcome:** Delete ~7,800 lines of orchestration. Replace with one shared agent loop (~250 lines in `api/_lib/agentLoop.ts`) + a thin Vercel proxy (~400 lines of shared helpers + 5 thin route files) + the existing legal-data endpoints used as tools. Keep the existing CEB RAG, CourtListener/legislative integrations, sanitization layer, and drafting UI. Net result: lower maintenance burden, cleaner audit trail, and no in-house orchestration code in the malpractice critical path.

**Supersedes:** This plan supersedes the in-flight `utils/googleGenAI.ts` Google GenAI direct migration referenced in `CLAUDE.md`. That untracked file and its branch will not merge. The stale `CLAUDE.md` reference is scrubbed in Phase 5.

---

## Ground Truth (verified 2026-05-03)

| Claim | Reality |
|---|---|
| `gemini/chatService.ts` | **3,085 lines** |
| `agents/` folder | **8 files, 2,521 lines** on main. Custom 4-agent orchestrator (researchAgent 507, drafterAgent 409, citationAgent 279, verifierAgent 332, orchestrator 369, tools 350, types 262, index 13). All call OpenRouter. Largest single deletion target. |
| `api/orchestrate-document.ts` | 1,239 lines, drives drafting pipeline |
| `api/gemini-chat.ts` / `api/claude-chat.ts` / `api/anthropic-chat.ts` | 327 / 197 / 85 lines (three Claude/Gemini endpoints with overlapping responsibilities) |
| `services/verifierService.ts` | 447 lines, JSON-from-text parsing of Claude verifier output |
| `components/drafting/` | **9 files, 2,991 lines on branch** — working DocumentPreview/OrchestrationModal/VariableInputPanel flow |
| `services/sanitization/` | Lives on `codex/drafting-magic-sanitized` branch, not main |
| `api/ceb-search.ts` | OpenAI native embeddings (line 527), not OpenRouter; queries Upstash Vector across 5 CEB namespaces |
| `@anthropic-ai/sdk@0.68.0` | Confirmed; upgrade to latest pre-Phase-1 (typed tool-use helpers and current Messages API model IDs). |
| `vercel.json` | `maxDuration: 300` for heavy endpoints; Pro plan ceiling is higher and not yet configured |

### Deletion target

| File / dir | Lines | Disposition |
|---|---|---|
| `gemini/chatService.ts` | 3,085 | Shrinks to ~300–600 lines (final number is a Phase 1 deliverable to be measured, not asserted up front). Bundles session bootstrap, polling loop, event reconciliation against the Upstash mirror, sanitization-confidence UI state, source-mode advanced toggle, CEB badge rendering. |
| `agents/` (8 files) | 2,521 | **Deleted** — one shared `agentLoop.ts` (~250 lines) replaces the custom 4-agent orchestrator |
| `api/orchestrate-document.ts` | 1,239 | Deleted — model handles drafting in one loop with the drafting system prompt |
| `api/gemini-chat.ts` | 327 | Deleted — generator collapses into the agent |
| `api/claude-chat.ts` | 197 | Deleted — verifier collapses into the agent |
| `api/anthropic-chat.ts` | 85 | Folded into a single `api/agent-proxy.ts` |
| `services/verifierService.ts` | 447 | Deleted — verifier sub-agent replaces it |
| **Net deletion** | **~7,800 lines** |

**Kept and rewired:** `api/ceb-search.ts` (582), `api/courtlistener-search.ts`, `api/legislative-search.ts`, `api/legislative-billtext.ts`, `api/verify-citations.ts` (266), `api/serper-scholar.ts`, `services/confidenceGating.ts` (149), `services/guardrailsService.ts` (247), `services/retrievalPruner.ts` (171), `gemini/cebIntegration.ts`, `components/drafting/*` (per §10).

**Other API endpoints (not touched by this migration, listed for completeness):** `api/chats.ts` (276) — chat history persistence, required for §N in-flight chat compatibility; `api/templates.ts` (522) — drafting template CRUD, drives Phase 2 template selection; `api/export-document.ts` (670) — Word/PDF export, called from drafting UI; `api/config.ts` (15) — client-side config; `api/debug.ts` (38) — env diagnostic. All kept; none rewired.

**Empty stub to delete during cleanup:** `services/geminiService.ts` (0 lines on main).

**Ground-truth correction:** Of the 8 files in `agents/`, all but `agents/citationAgent.ts` (279 lines) call OpenRouter directly. `citationAgent.ts` is regex- and tool-driven via `verifyCitationTool` from `tools.ts`. Doesn't change deletion math — all 8 still go.

---

## Architecture: Before vs After

```
BEFORE:
  UI → chatService (3,085 lines, regex query classification)
     → api/gemini-chat + api/claude-chat → OpenRouter → Gemini/Claude
  UI → DraftingMode → api/orchestrate-document (1,239)
     → agents/{research,drafter,citation,verifier} (2,521) → OpenRouter

AFTER (Agent SDK on Messages API):
  UI → chatService thin (~300)
     → api/agent/* routes (thin handlers)
     → api/_lib/agentLoop.ts (~250 lines: the loop)
        ├── messages.create({tools, messages}) → Anthropic Messages API (inference only, ZDR-eligible)
        ├── on tool_use → dispatch to api/ceb-search, courtlistener-search,
        │                 legislative-*, verify-citations (in-process call)
        ├── append tool_result, loop
        └── on stop_reason 'end_turn' → return final message + audit trail
     → Upstash KV (full conversation state, owned by us)
```

**Two model roles, same loop, separate conversations:**

- **Workbench (Opus 4.7):** handles research, drafting, citing, self-review. Different system prompts for the workflows in §11.
- **Verifier (Sonnet 4.6):** runs after the workbench finishes, in a fresh conversation. Sees only the final answer + sources, not the workbench's reasoning. Adversarial check: every citation must (a) resolve to a real authority and (b) the proposition stated by the agent must match an exact-or-near-exact quote from that authority.

**One Vercel proxy:** five thin route files under `api/agent/*` import `api/_lib/agentLoop.ts`. The loop is the only code that talks to `messages.create()`. Tool dispatch is an in-process function call — no inbound webhooks, no remote session, no Environments. Conversation state lives entirely in Upstash KV under our keys.

---

## Phase 0 — Compliance + Privilege Pre-flight (parallel workstream)

Runs in parallel with Phase 1 design; gates only Phase 5 cutover.

**0.a — Compliance paperwork (user-driven):**
- Anthropic enterprise ZDR DPA, signed
- BAA, signed
- SOC 2 Type II report, current
- Malpractice carrier UPL review: written confirmation that AI-summarized non-CA authority is covered, and that the policy doesn't exclude AI-assisted legal work
- F&F two-paragraph memo (§Q) explaining the direct Anthropic subscription choice

**0.b — Engineering smoke test (Arjun, ~1 day):**
- Author ~30 compound-query "privilege traps" — innocuous-looking queries that combine to identify a hypothetical client (e.g., "$4.3M claim, Marin County, tech founder")
- Run them through the existing `services/sanitization/` layer (after pulling `codex/drafting-magic-sanitized` to main)
- Fix any obvious leakage in the sanitization rules before Phase 1 code
- This is a pre-flight engineering check, not a legal-defensibility audit

**0.c — Pre-production privilege review gate (before Phase 5 cutover):**
- Before any real client-confidential work runs through the new system, run a structured privilege review with both F&F lawyers
- Test set: 100 traps, half drawn from real (sanitized) F&F matter patterns, half synthetic compound queries
- Pass criterion: zero confirmed leaks across all 100 on the production sanitization configuration
- This is the formal gate; the Phase 0.b smoke test is just to catch obvious bugs early
- If the review surfaces a real leak, cutover is paused until the boundary is fixed

**No Phase 0 architectural fallback.** Direct Anthropic subscription is the only inference path for this project. Bedrock and OpenRouter are out of scope, permanently. If ZDR/BAA/SOC 2 paperwork does not close on Anthropic's side, escalate with Anthropic; do not switch providers.

---

## Phase 1 — Spike (2 weeks)

**Goal:** Prove one Agent SDK loop (Opus 4.7, Messages API) with `ceb_search` and `courtlistener_search` tools beats the current `chatService.ts` pipeline on a 50-question gold set.

**Phase 1 first gate (Day 0–1, before any other Phase 1 work): Messages API loop smoke test.**

The original Managed Agents SDK capability audit (`docs/phase-1-sdk-audit.md`, 2026-05-03) is superseded by the 2026-05-10 ZDR-scope finding — see the corrigendum at the bottom of that file. The Managed Agents primitives audited there (`beta.agents.*`, `beta.sessions.*`, Environments, event streaming) are no longer used by this plan.

The Messages API smoke test is much smaller; the API is GA and well-documented. It must confirm:

1. **Tool-use loop semantics:** `messages.create({tools, messages})` returns `stop_reason: 'tool_use'` with `content` containing one or more `tool_use` blocks. Appending matching `tool_result` blocks (by `tool_use_id`) and calling `messages.create()` again continues the conversation. Loop terminates on `stop_reason: 'end_turn'`. Validated by a 10-line script with one fake tool.
2. **Parallel tool calls:** When the model emits multiple `tool_use` blocks in one assistant turn, we can dispatch them in parallel and assemble one user message with all `tool_result` blocks. Validated by a test prompt asking for two simultaneous lookups.
3. **Streaming:** `messages.stream({tools, messages})` yields `content_block_start` / `content_block_delta` / `content_block_stop` events including for `tool_use` blocks; we can render the assistant's prose token-by-token while tool calls are forming. Validated against a streaming smoke test.
4. **Error semantics:** Rate-limit (429), overload (529), and transient 5xx responses are surfaced with retry-after metadata so our loop can back-off rather than fail-fast. Validated by forcing a 429 in dev.
5. **Token-usage and stop reasons:** every loop iteration reports `usage.input_tokens` / `usage.output_tokens`; we can record these against the audit log for the per-session attestation (§Y).

If any of 1–3 fail, the plan is broken at a deeper level than runtime choice and would require a re-think; that is not expected — these are basic Messages API behaviors used by every Anthropic-tool-use customer.

Time-boxed: 0.5 day. Output: signed-off smoke-test note appended to `docs/phase-1-sdk-audit.md` recording all five points as pass/fail.

**Build (after smoke test passes):**
- **Upgrade `@anthropic-ai/sdk` from `0.68.0` → latest** — current version pre-dates the typed `messages.create` tool-use helpers we want; pin a known-good version.
- One agent loop module `api/_lib/agentLoop.ts` (~250 lines) implementing: build `tools` array (with privilege-aware inclusion of `web_search`), invoke `messages.create()` / `messages.stream()`, dispatch `tool_use` blocks to handler map, append `tool_result` blocks, loop until `end_turn` (or hit max-iterations safety cap), persist every step to Upstash KV + audit log.
- Opus 4.7 model, system prompt for California legal research.
- `ceb_search` and `courtlistener_search` registered in the handler map (LegiScan / OpenStates / citation_verify added in Phase 2).
- The four `/api/agent/*` route files import `agentLoop.ts`.
- Full conversation state in Upstash KV under `session:{id}:messages` (an append-only list of `{role, content}` blocks).
- Test harness: run all 50 questions through both the current pipeline and the new loop.

**Evaluate:**
- 50 gold questions drawn from sanitized F&F query history + CEB topic distribution
- **Both F&F lawyers grade independently, blind to which system produced which response**
- Inter-rater agreement reported (Cohen's κ); disagreements resolved by discussion
- Per-question rubric:
  - (a) citation accuracy
  - (b) source coverage (relative to a curated "ideal" source set)
  - (c) legal-analysis correctness
  - (d1) citation resolution: every cited case/statute resolves to a real authority via CourtListener/leginfo
  - (d2) proposition fidelity: agent's stated proposition for that citation is supported by an exact-or-near-exact quote from the authority
  - (e) end-to-end latency (machine-measured: p50, p95, p99)

**Latency budget:**
- Per-tool callback round-trip measured separately (agent → proxy → tool → proxy → agent)
- **Hard threshold:** p95 latency for a 4-tool research query ≤ 1.4× current pipeline. If breached, redesign tool layer (bundled calls, parallel tool calls where order doesn't matter) before Phase 2.

**Go / no-go:**
- New agent must be ≥ current on (a), (b), (c), (d1), (d2)
- Latency within budget
- κ ≥ 0.6
- If failed: one more 2-week iteration with bundled-call tool design. Hard stop at two iterations.

---

## Phase 2 — Drafting workflows (1 week)

**Goal:** Replace `api/orchestrate-document.ts` with the same agent loop using a drafting system prompt.

- Drafting system prompt variant per template (legal_memo, demand_letter, motion_compel, client_letter)
- `POST /api/agent/draft` endpoint
- Structured template variables passed as the first user message
- Agent generates all sections in one loop — no 5-phase pipeline, no four sub-agents
- Tool set: research tools (Phase 1) + LegiScan + OpenStates + citation_verify
- Stream sections as they're generated using `messages.stream()` directly to the client (Server-Sent Events through `/api/agent/draft`)
- Existing Word/PDF export endpoint (`api/export-document.ts`, 670 lines) reused as-is; drafting UI calls into it unchanged

**Go / no-go:** All 4 templates produce complete drafts with verified citations; word count within ±50% of target; zero hallucinated cases on a 10-document spot-check.

---

## Phase 3 — Verifier sub-agent (1 week)

**Goal:** Adversarial verification as a separate agent-loop invocation.

- Separate conversation per verification run, fresh `messages` array, no shared context with workbench
- System prompt: extract every citation + the proposition the workbench attached to it; verify each via tools; output a structured report
- Tools: `citation_verify`, `courtlistener_search`, `statute_lookup`, `ceb_search` (cross-reference)
- Output schema: per-claim verification status (verified / partially_verified / unsupported) with exact quote evidence
- UI: verification report panel inline with the answer

**Go / no-go:** On a test set including intentionally fabricated citations, the verifier flags ≥95% of hallucinations.

---

## Phase 4 — UI integration (1 week)

**Goal:** Replace source-mode UX with workflow-based UX. Wire existing drafting UI to the new agent endpoint.

**Workflows replacing the CEB/AI/Hybrid source toggle:**
| Workflow | Use case |
|---|---|
| Quick Answer | Direct response with sources |
| Research Memo | Multi-step research with structured authority ranking |
| Draft Document | Drafting flow (Phase 2) |
| Verify Citation | Adversarial check on lawyer-pasted text |
| Analyze Document | Read uploaded file, identify legal issues |
| Find Cases / Statutes | Search-only |

Source mode becomes an advanced toggle; agent picks sources by default.

**Drafting UI disposition** (`components/drafting/`, 2,991 lines on branch):
| Component | Lines | Action |
|---|---|---|
| `DraftingMode.tsx` | 472 | Keep, rewire endpoint |
| `OrchestrationModal.tsx` | 603 | Keep, simplify (drop 5-phase progress UI; one loop, streamed) |
| `OrchestrationVisual.tsx` | 652 | Audit — likely coupled to deleted phase semantics; reduce or remove |
| `DocumentPreview.tsx` | 565 | Keep |
| `VariableInputPanel.tsx` | 187 | Keep |
| `ProgressIndicator.tsx` | 242 | Audit — same coupling concern |
| `TemplateSelector.tsx` | 149 | Keep |
| `defaultTestData.ts` | 108 | Keep |
| `index.ts` | 13 | Keep |

Sanitization UI from `codex/drafting-magic-sanitized` audited and merged in this phase.

---

## Phase 4.5 — Shadow run (1 week)

Inserted between Phase 4 and Phase 5. **Phase 4.5 sends every production query through the new system, even though only the legacy answer is shown to the user. That is real client-confidential traffic. Therefore Phase 0 compliance gates apply at the start of Phase 4.5, not just at Phase 5 cutover.**

**Hard gates before Phase 4.5 starts:**
- Phase 0.a paperwork: signed Anthropic ZDR DPA + BAA + current SOC 2 Type II report
- Phase 0.c formal privilege review passed (zero leaks across 100 traps)
- Malpractice carrier UPL written confirmation in hand

**During Phase 4.5:**
- Both old and new systems receive every production query
- Only old-system response shown to the user
- New-system response logged with full trace (tools called, sources, citations, verification report)
- Daily diff report: response divergence rate, citation overlap, latency comparison
- Lawyers spot-check 10 divergences/day with structured feedback
- **Cutover gate to Phase 5a:** ≤ 20% material divergence on a representative sample, no critical hallucinations in the new system

---

## Phase 5a — Cutover (1 week)

Phase 5 is split into two sub-phases. **Phase 5a deploys the new stack behind a feature flag without removing any legacy code.** Phase 5b is the legacy teardown after a 30-day clean window.

**Phase 5a deliverables:**
- Deploy to Vercel preview, full Playwright run on all 6 workflows
- Deploy to production behind a single feature flag (`USE_LEGACY_PIPELINE` defaults `false`)
- All legacy files (`agents/`, `api/orchestrate-document.ts`, `api/gemini-chat.ts`, `api/claude-chat.ts`, `services/verifierService.ts`, `api/anthropic-chat.ts`) **remain in the repo and on production** — flag-gated, not deleted
- All legacy env vars (`OPENROUTER_API_KEY`, `@google/genai` dep) **remain configured** so the flag can flip back instantly
- Rollback by flipping `USE_LEGACY_PIPELINE=true` and redeploying (~3 min)
- 30-day observation window with rollback triggers per §M

## Phase 5b — Legacy teardown (1 day, after 30 clean days)

**Hard gate:** 30 consecutive days in production on the new stack with **none** of the §M rollback triggers fired. If any trigger fires inside the window, the clock resets after remediation.

**Phase 5b deliverables:**
- Delete: `agents/` (8 files), `api/orchestrate-document.ts`, `api/gemini-chat.ts`, `api/claude-chat.ts`, `services/verifierService.ts`, `services/geminiService.ts` (empty stub)
- Replace with thin client: `gemini/chatService.ts` (3,085 → ~300–600), `api/anthropic-chat.ts` folded into the new `api/agent/*` routes
- Drop `OPENROUTER_API_KEY` and `@google/genai` dependency
- Remove `USE_LEGACY_PIPELINE` flag and all legacy code paths
- Update `CLAUDE.md` (scrub `utils/googleGenAI.ts` reference, document new architecture)

---

## Architecture details

### A. Routes and the agent loop

Vercel file-system routing — five files under `api/agent/`, shared logic in `api/_lib/`. Total new code: ~650 lines (loop + shared helpers + four thin handlers).

```
api/agent/sessions.ts                              POST  /api/agent/sessions       (start a conversation, optional first user message)
api/agent/sessions/[id]/turn.ts                    POST  /api/agent/sessions/:id/turn   (send the next user message, streams the assistant turn)
api/agent/draft.ts                                 POST  /api/agent/draft          (one-shot drafting workflow, streamed)
api/agent/verify.ts                                POST  /api/agent/verify         (verifier in a fresh conversation, streamed)
api/_lib/agentLoop.ts                              ~250 lines — the tool-use loop (the only file that calls messages.create / messages.stream)
api/_lib/agentProxy.ts                             ~400 lines — sanitize, rehydrate, KV reads/writes, tool dispatcher map, audit-log writes
```

Endpoint behaviors:

- `POST /api/agent/sessions` — sanitize first user message, create session record in KV, return `{session_id}`. Conversation state is just an empty `messages` array keyed by `session_id`.
- `POST /api/agent/sessions/:id/turn` — sanitize new user message, append to KV-stored `messages`, hand to `agentLoop.run()`, stream assistant turn + tool dispatches back via SSE. On `end_turn`, the full assistant turn (including all interleaved `tool_use` / `tool_result` blocks) is appended to the KV `messages` list.
- `POST /api/agent/draft` — same loop, drafting system prompt, drafting tool set.
- `POST /api/agent/verify` — same loop, verifier system prompt, verification tool set, fresh `messages` array.

**Tool execution is an in-process function call.** When `messages.create()` returns `stop_reason: 'tool_use'`, the loop:

1. Reads the `tool_use` blocks from the response `content`
2. Dispatches each to the corresponding handler in the tool dispatcher map (a switch on `tool_use.name` → call into `api/ceb-search.ts` / `api/courtlistener-search.ts` / etc. as in-process imports, not HTTP calls)
3. Builds a user message with one `tool_result` block per `tool_use_id`, in the same order
4. Appends to `messages`, calls `messages.create()` again
5. Repeats until `stop_reason: 'end_turn'` (or hits a max-iteration safety cap, default 12, which writes an error to the audit log and surfaces "agent stopped" to the UI)

There is no inbound webhook from Anthropic, no remote session to poll, no event stream to mirror. Tool dispatch is a JavaScript function call inside the same Vercel request that holds the Messages API stream open. The earlier Managed Agents-era language about pull-model event streams (`events.list()` / `events.send()`) does not apply.

### A.1 Route protection & CORS

The existing repo's `api/*` handlers ship `Access-Control-Allow-Origin: *`. **That is unacceptable for the new agent surface.** Every new `/api/agent/*` route enforces the controls below; the existing tool-callback targets (`api/ceb-search.ts`, etc.) tighten their CORS to the same allowlist when used as agent callbacks.

**Required controls per route:**

| Control | Rule |
|---|---|
| Authentication | All `/api/agent/*` routes require a valid Clerk JWT in `Authorization: Bearer <token>`. Unauthenticated requests → 401, no body leaked. |
| Authorization (session ownership) | `POST /api/agent/sessions/:id/turn` and any session-scoped route must verify the calling user owns the `session_id` (via the meta record in Upstash KV, per §D). Cross-user access → 403. |
| CORS allowlist | `Access-Control-Allow-Origin` set explicitly to `https://<production-domain>` (and the Vercel preview domain during Phase 4). No wildcards. Credentials enabled only for first-party origins. |
| ~~Internal tool-callback protection~~ | **Not applicable on the Agent SDK / Messages API path.** Tools are dispatched as in-process function calls from the loop; there is no inbound HTTP endpoint for Anthropic to call back into. |
| Method allowlist | Each route registers its allowed methods explicitly; everything else → 405. |
| Rate limiting | Per-user rate limit on `POST /api/agent/sessions` (e.g. 60/min) to prevent runaway billing. |
| Request size cap | `1 MB` body limit on session/draft/verify routes; tool-callback routes sized to Anthropic's max event payload. |

**Required CI tests (added to §S regression suite):**
- Unauthenticated POST to each `/api/agent/*` route → 401
- Authenticated user A attempts to GET user B's session events → 403
- Forged origin header on a session-create POST → 403 / blocked by CORS
- Method mismatch (GET on POST-only route, etc.) → 405

**Tightening pass on existing routes** (Phase 4 deliverable): audit `api/ceb-search.ts`, `api/courtlistener-search.ts`, `api/legislative-search.ts`, `api/legislative-billtext.ts`, `api/verify-citations.ts`, `api/serper-scholar.ts`, `api/chats.ts`, `api/templates.ts`, `api/export-document.ts` — replace `Access-Control-Allow-Origin: *` with the production-domain allowlist. These routes are still hit by the browser (chat-history, drafting UI) so CORS must still allow first-party origin, but only first-party.

### B. Tool layer — what the loop dispatches

Tool definitions passed in the `tools` array of every `messages.create()` call:

| Tool | Backend | Notes |
|---|---|---|
| `ceb_search` | Upstash Vector via `api/ceb-search.ts` (in-process import) | OpenAI embeddings (kept for now per §6) |
| `courtlistener_search` | CourtListener v4 REST | |
| `statute_lookup` | leginfo.legislature.ca.gov | |
| `legiscan_search` | LegiScan API | |
| `openstates_search` | OpenStates API | |
| `citation_verify` | CourtListener citation lookup | Used by verifier loop |
| `web_search` | Anthropic-hosted built-in tool | **Conditionally included.** Only added to the `tools` array when the request is not privileged (per §E). Anthropic executes this server-side; tool definition is just the name. |

Tool permissions (default-deny, enforced in the loop):
- All custom tools: allow, log
- `web_search` (built-in, Anthropic-hosted): **omitted from the `tools` array entirely** when the input is sanitization-flagged as privileged. The model literally cannot call a tool that isn't in its tool list. See §E for the privilege boundary mechanism.
- No `bash`, `file_read`, `file_write`, `file_delete` — we're on the Messages API, not a sandboxed agent runtime, so those primitives don't exist. If the drafting workflow needs to read uploaded files, we read them in our handler and pass the content as a user message; we don't expose a filesystem tool.

### B.1 Environments — N/A on this path

The Managed-Agents-only concept of `environment_id` and Anthropic-managed Firecracker microVMs does not apply to the Messages API. There is no remote container to provision or constrain. Privilege control is enforced in our code at the moment the `tools` array is built (see §E), not at a container-network layer.

The previously-drafted Environment configuration (`env-allowlisted`, `env-open`) is dropped from the plan. No Environment creation or env-var pinning is needed.

### C. Connection / streaming model

A single agent turn (user message → tool-use rounds → final assistant message) runs inside one Vercel function invocation. The function holds an SSE stream open to the client and a `messages.stream()` connection open to Anthropic; tool calls between rounds happen inline as in-process function calls.

| Bound | Limit | Headroom |
|---|---|---|
| Vercel Pro default function timeout | 300s | Covers typical research turns (≤ 60s) and ~all drafting turns (≤ 180s). |
| Vercel Pro streaming function with `maxDuration: 800` | 800s (~13 min) | For unusually long drafting turns. Raise selectively on `/api/agent/draft`. |
| Beyond 13 min | requires async/queue split | Not anticipated for Phase 1–3. If hit, split the loop into a queue worker (Vercel Queues or QStash) and a polling endpoint, per the original §11 async-queue note. |

No need for the earlier "polling" architecture — that was forced by the Managed Agents long-lived remote session. On the Messages API, every turn is bounded by our Vercel function lifetime, and `messages.stream()` events flow straight through to the client SSE stream.

### D. Session durability — app owns everything

| State | Owner | Storage |
|---|---|---|
| Conversation `messages` array (the canonical state) | **App** | Upstash KV append-only list under `session:{id}:messages`. Every assistant turn (including its `tool_use` and the matching `tool_result` blocks) is appended atomically when the turn ends. |
| Sanitization token map | **App** | Envelope-encrypted Upstash entry (KEK in 1Password, DEK in KV), retained 7 years for audit reconstruction; break-glass access only. See §E retention policy. |
| Final agent output | **App** | Audit log + chat-history store |
| Agent config snapshot (system prompt + tool list + model + temp) | **App** | Tamper-evident audit log per §G, content-addressed by SHA-256 |
| Per-iteration token usage | **App** | Recorded alongside each turn for §Y attestation |

The conversation is just an array of role+content blocks under our keys. There is no remote session to mirror — there's only one copy of the state, and we own it.

**Failure modes:**

| Failure | Behavior |
|---|---|
| Browser close mid-turn | Function continues to completion; assistant turn appended to KV; client on reload reads `messages` and re-renders. If the user clicks away before the function returns, the turn still finishes server-side. |
| Network flap | Client reconnects via SSE `Last-Event-ID`; server replays buffered events from this turn. If the turn already finished, client just reads the new `messages` list. |
| Vercel function cold-start | Function is stateless; KV is the truth. |
| Tool execution failure | Loop catches the thrown error, builds a `tool_result` block with `is_error: true` and the error message, appends, lets the model decide whether to retry or report. |
| Anthropic API rate-limit (429) | Loop reads the `retry-after` header and backs off; if retries exhausted, persists the partial turn and surfaces "service throttled" to the UI. User can resume the same turn later by sending a new user message. |
| Anthropic API outage | Loop fails fast; partial turn already in KV; UI shows error with retry button that resumes from the existing `messages` list. |
| Vercel function timeout (300s / 800s) | Streaming gracefully ends; partial turn (whatever blocks have been received and tool calls have completed) is persisted to KV; UI shows truncation and a "continue" affordance. |
| Tool call partial work | Each tool handler is idempotent; if a retry happens, the duplicate `tool_result` is detected (matching `tool_use_id`) and the second one is discarded. |

**Phase 1 deliverable additions:** Upstash KV schema for `session:{id}:messages`, idempotent tool handlers keyed by `tool_use_id`, client-side `session_id` URL persistence, SSE reconnect / Last-Event-ID handling, recovery UX.

### E. Sanitization & privilege boundary

Sanitization runs in the Vercel proxy *before* any input reaches the Messages API.

- Per-input output: `{sanitized_text, token_map, privileged: bool, confidence: 0..1}`
- Token map held in app memory + encrypted Upstash entry, never sent to Anthropic
- **Privilege hold-back:** if `confidence < 0.98`, the request is queued for mandatory human review with a UI banner; user must explicitly approve sanitized form OR rewrite. Default-deny on ambiguity.
- **Compound-query defense:** beyond per-token detection, sanitizer runs an n-gram entity-correlation pass; combinations seeded from F&F matter index. Adversarial smoke test (§0.b) and formal review (§0.c) are the empirical checks.
- **Privilege boundary mechanism — per-tool gating in code.** When the loop builds the `tools` array for `messages.create()`, it conditionally omits any tool whose backend reaches outside our allowlisted legal-data hosts. Concretely: `web_search` (Anthropic-hosted, can reach arbitrary domains) is **not included in the `tools` array at all** when the input is sanitization-flagged as privileged. The model cannot call a tool it doesn't see. This is enforced in `api/_lib/agentLoop.ts` at the request-construction site and verified by a CI test in §S (a privileged-flagged prompt produces a `messages.create` call whose `tools` array does not contain `web_search`). The Managed-Agents-era "network-restricted Environment" mechanism is moot — there is no remote container in the loop.
- Audit log records every redaction decision: input hash, redacted spans, replacement tokens, confidence, timestamp, *combination* that triggered a flag (not just individual tokens). Audit log also records the exact `tools` array passed to each `messages.create()` call, so the privilege boundary is verifiable after the fact.

**Token-map retention policy (resolves the audit/discovery vs minimization tension):**

| Artifact | Retention | Encryption | Access |
|---|---|---|---|
| Token map (active session) | Session lifetime + 1 hour | AES-256, per-session key in app memory | Vercel proxy only |
| Token map (after session end, for 7-year audit window) | 7 years | AES-256-GCM with envelope encryption; KEK in 1Password vault, DEK in Upstash KV | Break-glass legal/audit access only, logged per §U |
| Final rehydrated output (what the user saw) | 7 years | At-rest encryption only | Standard chat-history access |
| Sanitized prompt (what Anthropic saw) | 7 years | At-rest encryption only | Standard audit access |

**Reasoning:** Final rehydrated outputs alone are *not* sufficient for litigation reconstruction. A subpoena could ask "what exactly did the AI see when it produced this answer?" — and we need to be able to prove the sanitized prompt corresponds to the user's actual privileged input. That requires retaining the token map. Storing it under envelope encryption with logged break-glass access protects the privileged content while preserving evidentiary reconstructability.

The earlier "deleted on session end" wording was wrong — corrected here. Phase 4 implementer: ensure no code path deletes the encrypted token-map entry; expiry is governed by the 7-year retention sweep only.

### F. Data-classification per tool

| Tool | May receive | Blocked |
|---|---|---|
| `ceb_search` | Sanitized legal queries | Raw client names, matter numbers, financial figures |
| `courtlistener_search` | Public-record case names, citations, generic legal terms | Anything client-identifying |
| `statute_lookup` | Code + section identifiers | (lookup args are public refs) |
| `legiscan_search` / `openstates_search` | Bill numbers, generic policy terms | Client-identifying terms |
| `citation_verify` | Citation strings | Surrounding privileged context |
| `web_search` | Sanitized queries (non-privileged sessions only) | **Omitted from the `tools` array entirely** when the privileged marker is present. Tool-list construction is the enforcement point; no container-network controls available on this path. |
| ~~`web_fetch`, `bash`, `file_read`, `file_write`~~ | N/A | Not available on the Messages API path; rows removed. |

Agent receives only `privileged: false` content. Privileged terms held in app-boundary token map; rehydrated only into the final response shown to the user.

### G. Audit log — tamper-evident

- Append-only log (Upstash list or Postgres with INSERT-only role)
- Each entry: monotonic ID, NTP-synced timestamp, SHA-256 hash chain (each entry references prior entry's hash)
- Daily digest signed and offsite-backed-up
- Per-session chain-of-custody: who-accessed, when, why, output served
- Retention 7 years (matches CA Bar record retention)
- Phase 5 acceptance: prove a Phase 1 week-1 agent config is still retrievable

### H. Agent versioning

- On every agent config change (system prompt, tool list, model, temperature), app code snapshots the full definition to the audit log, content-addressed by SHA-256
- Every chat session response stores the SHA of the agent version that produced it
- Verification at Phase 5: a Phase 1 week-1 SHA can still be retrieved and replayed

### I. Retention matrix

| Data class | Staging | Production |
|---|---|---|
| Chat transcripts | 30 days | 7 years (CA Bar) |
| Tool call payloads (input + output) | 30 days | 7 years |
| Agent config snapshots | 7 years | 7 years |
| Verification reports | 30 days | 7 years |
| Audit logs (auth, access, redaction decisions) | 90 days | 7 years |
| Web search/fetch query logs | 30 days | 7 years (privilege-sensitive) |
| Anonymized eval gold-set | indefinite | indefinite |

All production retention: tamper-evident storage with daily clock-synced timestamps and SHA-256 chain-of-custody.

### J. API stability

We're on the **Messages API (GA)**, not a beta surface. No `anthropic-beta` header required. Breaking changes on Messages are years apart (the tool-use shape has been stable since 2024), so the quarterly re-validation budget the original plan called out for Managed Agents is no longer needed.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Messages API breaking change | Low | Medium | Pin `@anthropic-ai/sdk` to a known-good version in `package.json`; subscribe to Anthropic changelog; treat any breaking change as a normal dependency upgrade with a CI re-run of §S + §T |
| Model deprecation | Medium (annual cadence) | Low | Plan tracks current model IDs in `CLAUDE.md`; model rotation is a one-line config change in `agentLoop.ts`. Run §S regression suite before flipping. |

### K. Memory stores — dropped

The original plan listed firm style guide, attorney preferences, known-bad-sources, common templates as separate "memory stores." None had a maintenance owner; "known-bad sources" is a moving target (cases get vacated, good cases get overruled). For 2 lawyers, premature scope. Templates already live as system-prompt fragments and as files under `templates/`. Revisit memory after Phase 5 if a real need emerges.

---

## Operational sections

### L. Cost estimate

Steady-state monthly at F&F volume (~800 sessions/month):

| Line item | Estimate |
|---|---|
| Anthropic API tokens (Opus 4.7 + Sonnet 4.6 mix) | $80–200 |
| ~~Managed Agent session-hours~~ | $0 — no Managed Agents in this plan; inference-only on Messages API has no session/container charge |
| Vercel Pro | already paid |
| Upstash Vector + KV | $40–100 |
| Clerk | $25 |
| OpenAI embeddings (per §6, kept) | $5–15 |
| **Total monthly steady-state** | **~$170–360** |

Refine in Phase 1 with telemetry.

### M. Rollback mechanics

Objective rollback triggers (any one fires → roll back):
- Hallucination rate > 2× Phase 1 baseline over rolling 24h
- p95 latency > 2× Phase 1 baseline over rolling 6h
- Two or more lawyer-reported "wrong answer" tickets in 24h
- Any privacy/sanitization failure (immediate, no threshold)

**Rollback procedure:**
- Flip `USE_LEGACY_PIPELINE=true` in Vercel env, redeploy (~3 min)
- Legacy stack kept hot for 30 days post-cutover
- Owner: Arjun. Backup: documented runbook in repo.
- Post-rollback: incident review within 48h before any retry

### N. Backward compatibility for in-flight chats

- Legacy chat transcripts remain readable in the new UI (read-only view)
- In-flight legacy sessions on cutover day allowed to complete on legacy stack for 24h, then archived; users start new sessions on new stack
- Chat history sidebar shows both legacy and new sessions with a visual marker

### O. Lawyer rollout

- Week before cutover: 1-hour walkthrough with both lawyers, recording archived
- Cutover day: side-by-side `/legacy` route for 1 week with explicit sunset date
- First 2 weeks post-cutover: daily 15-min check-in per lawyer; log every complaint/missing-feature
- Documentation: short README per workflow + inline "what does this do?" tooltips on the workflow selector

### P. Phase 1 failure fallback

Direct Anthropic subscription is the only inference path; there is no provider-level fallback. If Phase 1 fails:
1. Diagnose where the loop underperforms (model choice, system prompt, tool design)
2. Tool-layer issues → one more 2-week iteration with bundled-call tool design and parallel-tool-call optimization
3. Model-quality issues → swap Opus 4.7 ↔ Sonnet 4.6 (one line change in `agentLoop.ts`); re-run gold set
4. **Hard stop:** maximum two Phase 1 iterations. If both fail, the migration is dead — but the current OpenRouter pipeline keeps running until then, so there is no production-availability risk.

### Q. F&F communication memo (sent before Phase 5)

> "We are migrating the chatbot's AI infrastructure to a direct Anthropic enterprise subscription. The compliance posture is Anthropic's enterprise Zero Data Retention agreement, signed BAA, and current SOC 2 Type II report. Signed copies of all three are on file."
>
> "The migration replaces our custom orchestration layer with the Anthropic Agent SDK running against the direct Messages API, and reduces our internal codebase by approximately 7,800 lines. We chose the Agent SDK over Anthropic's hosted Managed Agents product because Managed Agents is explicitly not covered by Zero Data Retention; the Messages API is ZDR-eligible under the enterprise agreement. There is no change to data residency, retention, or access controls visible to clients. The change is internal-architecture only. Effective date: [DATE]."

### R. Incident response drill (before Phase 5)

Tabletop drill scenarios:
- A: privileged client text accidentally sent to web_search tool
- B: agent hallucinates a case citation that lawyer files in court
- C: Anthropic API key leaks
- D: Sanitization layer fails open (client name reaches agent)

For each: detection mechanism, response steps, notification path (F&F partners, Anthropic Trust & Safety, affected client if applicable), post-incident review template.

### S. Prompt & guardrail regression tests (CI)

- Confidentiality: agent never echoes back sanitized tokens
- No-external-search-with-client-facts: when sanitization active, `web_search` is **not present in the `tools` array** passed to `messages.create()` (verified by inspecting the loop's outbound request)
- Fail-closed: when any guardrail check throws, request returns error (not partial response)
- Privilege markers: privileged-tagged inputs never appear in outbound tool-use blocks
- Refusal preservation: jurisdictional refusals ("not licensed in [state]") remain intact
- UPL banner: every response involving non-CA authority wrapped with "for reference only — confirm with [jurisdiction]-licensed counsel"

Runs on every PR. Failure blocks merge.

### T. Tool determinism contract tests (CI)

Pinned-fixture tests per tool:

| Tool | Fixture |
|---|---|
| `ceb_search` | 10 queries with frozen Upstash snapshot → expected top-K with stable ordering |
| `courtlistener_search` | 10 queries with VCR cassettes → expected case list |
| `statute_lookup` | 10 (code, section) pairs with cached HTML → expected canonical text |
| `legiscan_search` | 5 bills with cached responses |
| `openstates_search` | 5 queries with cached responses |
| `citation_verify` | 20 citations (10 real, 10 fabricated) → expected verified/unverified |

Tests fail if tool output drifts. Run on every PR touching tool callbacks.

### U. Key management runbook

- **Rotation cadence:** Anthropic and OpenAI keys rotated every 90 days; CourtListener / OpenStates / LegiScan annually
- **Storage:** 1Password vault scoped to F&F engineering; Vercel env vars sourced from 1Password CLI on deploy
- **Emergency revoke:** documented runbook (revoke at provider, rotate Vercel env, redeploy, audit log) — target time-to-revoke < 15 min
- **Egress allowlist:** Vercel function fetch restricted to: `api.anthropic.com`, `api.openai.com`, `*.upstash.io`, `courtlistener.com`, `openstates.org`, `legiscan.com`. Block all others by default.
- **Break-glass access:** any human read of production transcripts logged with reason, reviewed weekly

### V. DPIA addendum

Produced before Phase 5:
- Data flow diagram (client → Vercel → Anthropic; client → Vercel → OpenAI for embeddings; client → Vercel → CourtListener / OpenStates / LegiScan)
- Data classifications at each hop
- New/changed processors vs prior architecture
- ZDR scope per endpoint (inference, logs, telemetry, abuse-monitoring, support workflows) with exceptions documented
- Risk register update
- Owner: Arjun. Reviewer: F&F managing partner. Sign-off required before Phase 5.

### W. Evidentiary discovery hardening

In a malpractice action, plaintiff's counsel can subpoena: source code, system prompts, evaluation logs, redaction decisions, agent versions, tool-call traces. Plan must assume everything written here will be read by an adversarial expert witness.

- **System prompts:** Treated as legal artifacts. Every change reviewed and signed off; full version history retained 7 years; no disclaimers like "the model may hallucinate" inside the system prompt itself (becomes evidence of known defect).
- **Eval logs:** Every gold-set grading preserved as evidentiary record showing the system was tested before deployment. Failed evals not deleted — they show the firm caught problems pre-cutover.
- **Tool-call traces:** Per-session trace stored with chain-of-custody (per §G) so any output is reconstructable from inputs.
- **Privileged work-product marking:** Internal eval discussions and design docs subject to attorney work-product privilege are marked accordingly and stored separately from operational logs.
- **Litigation hold capability:** Runbook for freezing all logs/configs related to a specific session or matter on subpoena receipt — tested in §R IR drill.

### X. UPL exposure controls

Most malpractice policies have a UPL (Unauthorized Practice of Law) exclusion. If the bot is interpreted as practicing non-CA law, coverage may be voided.

- **Jurisdictional banner** on every response involving non-CA authority (system-prompt-enforced, verifier-checked)
- **Refusal patterns** for queries that look like a request for legal advice on non-CA law (vs reference research)
- **Insurance review** — Phase 0 deliverable confirms in writing that the policy covers AI-summarized non-CA authority
- **Audit:** every cross-jurisdictional response logged with its jurisdiction tag

### Y. Per-session compliance attestation (Phase 6 — post-cutover)

The audit log (§G) and retention matrix (§I) preserve every primitive a court would need. But primitives are not an artifact a lawyer can attach to a filing. §Y adds a generator that produces, on demand, a court-quality record of what the system did during a single chat session or drafting matter.

**Purpose:** Give the firm one signed file per session that proves, with cryptographically verifiable evidence, that the AI operated under documented controls when producing a specific output. Designed for malpractice defense, bar inquiries, and discovery production.

**Trigger:**
- Lawyer-initiated from chat UI: "Export compliance record" button on any saved session or generated document
- Automatic on every session end (stored in audit log; emitted as artifact only on request)
- Bulk-export by date range or matter ID for litigation-hold response

**Contents (signed JSON sidecar; the legally-binding artifact):**

| Field | Source |
|---|---|
| `session_id`, `user_id`, `timestamp_start`, `timestamp_end` | Session metadata |
| `agent_config_sha` | §H — the SHA of the agent definition that produced the response |
| `agent_config_full` | Inlined or referenced via SHA — system prompt, tool list, model, temperature |
| `sanitization` | `{confidence, redacted_spans_count, manual_review_triggered}` — never the actual privileged content |
| `tool_call_log` | Per-call: tool name, timestamp, input hash, output hash, latency. Inputs/outputs themselves stored separately under privilege controls. |
| `sources_retrieved` | CEB passages, CourtListener cases, statutes — by ID and citation, not full text |
| `verification_report` | Per-claim: citation resolves Y/N, proposition fidelity (full/partial/none), authority level |
| `upl_flags` | List of jurisdictions invoked + whether banner was emitted |
| `final_output_hash` | SHA-256 of the rehydrated output the lawyer saw |
| `audit_log_anchor` | Block of audit-log entry IDs + their hash-chain prior-hashes that bracket this session |
| `attestation_signature` | Ed25519 signature over the entire JSON, signed by the daily compliance key |

**Format:**
- **JSON** is the legally-binding artifact (machine-verifiable, chain-of-custody friendly)
- **PDF** is generated from the JSON for human readability — embeds the signature in metadata, reproduces the JSON contents in a readable layout

**Signing:**
- Daily Ed25519 key pair, private key in 1Password vault scoped to compliance
- Public key published on a stable URL and pinned in the firm's records-retention policy
- Key rotation logged in the audit chain itself

**Verification:**
- Standalone CLI tool `verify-attestation <file.json>` packaged with the firm's records and provided to opposing counsel on request
- Verifier checks: (1) Ed25519 signature against published public key, (2) every referenced audit-log entry's hash-chain link, (3) `agent_config_sha` resolves to a retrievable definition, (4) `final_output_hash` matches the rehydrated output if the firm chooses to disclose it
- Pass = the artifact is authentic and the underlying records have not been tampered with since signature time

**What it proves (and doesn't):**

| Provable | Not provable |
|---|---|
| The exact AI configuration that produced this output | That the legal analysis was correct |
| What sources the AI consulted | That the lawyer's judgment was sound |
| That citations resolve to real authorities | That the lawyer reviewed the output before relying on it |
| That privileged content was sanitized at confidence X | That privileged content wasn't leaked through some other channel |
| That logs are intact since signing time | That the lawyer interpreted the output competently |

The boundary is intentional and documented in the artifact. F&F's competence rule (CA RPC 1.1 + Comment [1]) puts independent professional judgment on the lawyer; this attestation handles the AI tool's portion of the chain of custody.

**Lawyer-side companion (separate workstream, not in this plan):** A "review attestation" UI where the lawyer explicitly marks "I reviewed this AI output before relying on it" with timestamp. Combined with §Y, the two artifacts together cover both halves of CA RPC 1.1 — competent supervision of the tool, and independent professional judgment by the lawyer.

**Retention:** Attestation files are 7 years (matches §I). Underlying audit-log entries referenced by an attestation are flagged for the same retention floor — even if the standard sweep would otherwise expire them, anything referenced by a live attestation cannot be deleted.

**Phase 6 deliverables (~2 weeks after Phase 5b):**
- Attestation generator endpoint (`POST /api/attestations` — generates and returns signed JSON + PDF)
- Daily Ed25519 key rotation cron + audit-log entry on rotation
- Standalone `verify-attestation` CLI tool with documented usage for opposing counsel
- Bulk-export endpoint for litigation-hold response
- Phase 6 acceptance test: generate an attestation for a Phase 1 spike session and verify the standalone tool validates it cleanly

---

## Files that change at implementation time

| Action | Files |
|---|---|
| **Delete entirely** | `agents/` (8 files, 2,521 lines), `api/orchestrate-document.ts` (1,239), `api/gemini-chat.ts` (327), `api/claude-chat.ts` (197), `services/verifierService.ts` (447), `services/geminiService.ts` (0, empty stub) |
| **Replace with thin client** | `gemini/chatService.ts` (3,085 → ~300–600, measured at Phase 1), `api/anthropic-chat.ts` (85 → folded into the new `api/agent/*` route files; helpers in `api/_lib/agentProxy.ts`) |
| **New** | `api/agent/sessions.ts`, `api/agent/sessions/[id]/turn.ts`, `api/agent/draft.ts`, `api/agent/verify.ts`, `api/_lib/agentLoop.ts` (~250 lines, the only file that calls `messages.create` / `messages.stream`), `api/_lib/agentProxy.ts` (~400 lines: sanitize/rehydrate/KV/audit) |
| **Keep, rewire** | `components/drafting/*` (per Phase 4 audit), `gemini/cebIntegration.ts`, `services/confidenceGating.ts`, `services/guardrailsService.ts`, `services/retrievalPruner.ts` |
| **Keep as tool callback targets** | `api/ceb-search.ts` (582), `api/courtlistener-search.ts`, `api/legislative-search.ts`, `api/legislative-billtext.ts`, `api/verify-citations.ts` (266), `api/serper-scholar.ts` |
| **Keep, untouched by migration** | `api/chats.ts` (276, chat history), `api/templates.ts` (522, drafting templates), `api/export-document.ts` (670, Word/PDF), `api/config.ts` (15), `api/debug.ts` (38) |
| **Env updates** | Drop `OPENROUTER_API_KEY`. Keep `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `UPSTASH_*`, `COURTLISTENER_API_KEY`, `OPENSTATES_API_KEY`, `LEGISCAN_API_KEY` |
| **Dependencies** | Drop `@google/genai`. `@anthropic-ai/sdk` upgraded to latest stable for current Messages API model IDs and typed tool-use helpers. No beta SDK channel needed. |
| **CLAUDE.md** | Remove stale `utils/googleGenAI.ts` reference; document new architecture |

---

## Verification (when Phase 1 begins)

The plan-revision phase is not code-verified. The next gate is **Phase 1 spike completion**:

1. 50-question gold set scored against rubric (a)–(e), including (d1) citation resolution + (d2) proposition fidelity
2. Inter-rater κ ≥ 0.6 reported
3. Per-tool callback latency p50/p95/p99 logged
4. End-to-end latency comparison vs current `chatService.ts` pipeline
5. Agent-config SHA retrievable from audit log
6. Written go/no-go decision before Phase 2 starts

---

## Parked branches (do not merge until the phase that needs them)

Three remote branches contain work that is needed later but should **not** merge into `main` now. Merging early invites conflicts with new agent-loop code and ships changes ahead of their gating phase.

| Branch | Contents | When to merge | Archive tag |
|---|---|---|---|
| `codex/drafting-magic-sanitized` | Drafting UI (`components/drafting/*`, 2,991 lines) + sanitization layer (`services/sanitization/*`, ~1,600 lines) + sanitization tests + OPF daemon | **Phase 0.b** — pull at the start of Phase 0 so the privilege smoke test has something to run against. Drafting UI rewires in Phase 4. | `archive/drafting-magic-sanitized-2026-05-03` |
| `codex/drafting-magic` | Identical to `drafting-magic-sanitized` (verified by `git diff` — 0 commits between them) | Same as above; pick one and delete the other after merge | `archive/drafting-magic-2026-05-03` |
| ~~`codex/bedrock-confidentiality-migration`~~ | Bedrock SDK switch + sanitization core + speed-mode + OPF auto-install UX | **Will not be merged.** Bedrock is permanently out of scope. Branch is kept only because the tag `archive/bedrock-confidentiality-2026-05-03` may be useful historical reference for the sanitization layer (which exists in identical form on `codex/drafting-magic-sanitized`, the path actually used). Safe to delete the remote branch; the tag persists. | `archive/bedrock-confidentiality-2026-05-03` |

**Tags are immutable archive points** so the branches can be found again even if they're force-pushed or deleted later. Created `2026-05-03`.

**Cleanup once the agent-loop migration ships and stabilizes (post-Phase-5b):**
- Bedrock is not used; archive `codex/bedrock-confidentiality-migration` (delete remote branch; tag survives as historical reference)
- After Phase 4 merges sanitization+drafting: delete `codex/drafting-magic` and `codex/drafting-magic-sanitized` (tags survive)

---

## Open Items

**Pre-Phase-1 critical path — STATUS as of 2026-05-12 (closed sequence):**

1. ✅ **Sanitization branch audit** — pulled `codex/drafting-magic-sanitized`, full audit completed in `docs/sanitization-audit-2026-05-10.md`. Mechanical fixes from §8 items 4–7 + 10 committed in `a720572`; design-heavy §8 items 1, 2, 3 resolved through Step 3 iteration (commit `06eb445`).
2. ✅ **Self-administered privilege smoke test (Step 3 in 2026-05-10 addendum re-sequencing)** — formalized as 100-trap manifest, NOT the original 30. Two consecutive zero-leak runs achieved 2026-05-12 — HARD GATE met. Artifacts: `tests/traps/manifest-v1.json`, `tests/traps/runTraps.mjs`, `reports/traps-baseline-2026-05-12.json`.
3. ✅ **Upstash KV conversation schema** — design doc `docs/upstash-kv-schema-v1.md`. Phase 1 implements against this.
4. ✅ **Tool-call latency baseline** — Anthropic-stack baseline (Gemini path intentionally excluded — being deleted in Phase 5). `reports/latency-baseline-2026-05-12.json`, `scripts/latency-baseline.mjs`. Numbers in README's V2 Status section.

**Additional pre-Phase-1 items introduced by the 2026-05-10 ZDR-removal addendum:**

5. ✅ **Step 0 — SDK upgrade** `@anthropic-ai/sdk` 0.68.0 → 0.95.2 (commit `58dec1e`). Done.
6. ✅ **Step 1c — §6 token-map retention reconciliation** — addendum #3 (this doc, 2026-05-12 third addendum) proposes Option C. ⏸ Tentative, **pending F&F partner sign-off** — only social-process dependency on the critical path.

(The original Managed Agents SDK capability audit was completed 2026-05-03 and then superseded 2026-05-10 by the ZDR-scope finding — see corrigendum in `docs/phase-1-sdk-audit.md`. The replacement gate is the 100-trap zero-leak gate described above.)

**User decisions (Arjun):**

7. ~~ZDR / BAA / SOC 2 status~~ — **resolved 2026-05-10**: F&F remains on Anthropic Team plan; ZDR/BAA/SOC 2 paperwork is permanently off the plan. See 2026-05-10 (second addendum) above. Sanitization is the only line of defense.
8. **Malpractice carrier UPL review** — written confirmation still required before Phase 5
9. **Gold question set source** — sanitized F&F query logs vs newly constructed: **decided 2026-05-12** — newly constructed (synthetic), all 100. F&F-matter half deferred to v2 of the trap manifest if attorney input becomes available.
10. **F&F partner sign-off on Option C retention** (2026-05-12 third addendum) — open. Required before Phase 1's audit-record-writer is finalized.
11. **Gemini-grounding replacement acceptance criterion for Phase 1** — tracked informally, not pinned. Replacement is Anthropic `web_search_20250305` with privilege gating (omit tool when input is privileged). `services/confidenceGating.ts` to be rewired from Gemini grounding-metadata shape to Anthropic citations.

**Phase 1 follow-ups (forward-compat with 2026-05-12 fourth addendum's V2 Portability Principle):**

12. **Extract system prompt to `agents/california-legal/skills/*.md`** — currently a hardcoded string constant in `api/_lib/agentLoop.ts` (`DEFAULT_SYSTEM_PROMPT`). Move to one or more Skill markdown files matching `anthropics/claude-for-legal` frontmatter (`name`, `description`, `user-invocable`, `argument-hint`). Should land before Phase 5 cutover so the runtime swap path remains cheap.
13. **Extract agent config to `agents/california-legal/agent.yaml`** — model, max_tokens, tool list, max-iterations cap as data, not code. Field names should mirror Anthropic's plugin schema.
14. **Define `source` block schema for tool results** — `{ source_type, title, citation, url, retrieved_at }`. Tools return `sources[]` alongside content; system prompt directs the model to cite by `source_id`. Matches Anthropic's plugin source-provenance contract.
15. **Synthetic-data sandbox track on Managed Agents** — Apache-2.0 `anthropics/claude-for-legal` plugins evaluated with fake matters only. No real F&F data, no production prompts. Purpose: pattern study (agent structure, reviewer-note conventions, handoff shapes) so V2 stays aligned with Anthropic's design choices without taking on MA's retention shape in production.

**Deferred to post-Phase-5:**

16. **Embeddings re-evaluation (Voyage vs OpenAI)** — separate project after migration is stable
