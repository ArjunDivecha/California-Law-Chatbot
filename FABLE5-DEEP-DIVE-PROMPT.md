# Deep-Dive Prompt for Claude Fable 5 — California Law Chatbot

> Run this in **Claude Code on the Claude Fable 5 model** (check `/model`), launched in the
> project directory. Claude Code reads the repos directly off disk — no pasting or bundling.
> Both versions are local:
>   - **V2** (current): the folder this prompt lives in — `California-Law-Chatbot-V2/`.
>   - **V1** (original): the sibling folder `../California-Law-Chatbot/` (its `main` branch),
>     the Google Gemini + OpenRouter/Bedrock era.
> Read directly from those paths; grep and follow references rather than loading everything at
> once. For a truly independent review, run it in a FRESH Claude Code session so no prior
> conversation biases the analysis.

---

You are Claude Fable 5 acting as a principal engineer + product strategist + appellate-grade
legal-tech reviewer. You launched on 2026-06-09 with a 1M-token context window, always-on
adaptive thinking, state-of-the-art vision, a persistent memory tool, code execution,
programmatic tool calling, context compaction, and senior-level legal/financial reasoning.
I want you to use those capabilities deliberately in this task.

## The product

The **California Law Chatbot (V2)** is a privacy-first legal-AI workbench built for the
attorneys at Femme & Femme LLP (California family/probate/civil practice). Its defining
constraint is a **zero-leak sanitization invariant**: client names, addresses, and other
identifiers are tokenized **in the browser** (e.g. `CLIENT_001`, `ADDRESS_002`) *before any
request leaves the laptop*, using a local GLiNER PII-detection daemon; the model only ever
sees placeholders; responses are rehydrated to real values for display only. The product
also fights AI hallucination by verifying every **case citation** (against CourtListener)
and every **statutory/regulatory citation** (CA codes via leginfo, U.S.C. via Cornell LII,
C.F.R. via the official eCFR API) for existence and content-match. The primary engine is now
Claude Fable 5; a Sonnet 4.6 sub-agent does citation verification.

## Your mission

Do an exhaustive deep dive into this entire product — **conceptualization → capabilities →
architecture → codebase → operations** — and then, most importantly, produce a forward-looking
analysis of how *your own enhanced Fable 5 capabilities* could massively expand what this
product can do. Be concrete, opinionated, and grounded only in evidence you can cite from the
code/docs; flag anything you infer vs. verify. No fabrication — if you can't confirm something,
say so and tell me what to show you.

## Both versions are on disk (V1 + V2)

Reason about the migration and what was learned by reading BOTH:
- **V1** = `../California-Law-Chatbot/` (original `main` branch — Google Gemini +
  OpenRouter/Bedrock era).
- **V2** = `./` (this `California-Law-Chatbot-V2/` folder — Anthropic-only, sanitization-first,
  Fable 5 engine). This is the product we're expanding.
Suggested approach: skim V1 to understand the starting point and record key V1 facts
(architecture, capabilities, design decisions) to your **memory tool**; then study V2 in depth
and compare. You don't need to load everything at once — grep, open files on demand, and follow
references. If anything you need isn't where you expect, search the repo before concluding.

## Read everything first

Ingest and map (request any you can't see):
- Repo root: `California-Law-Chatbot-V2/` — especially `api/` (agent loop, tools, endpoints),
  `components/v2/`, `hooks/`, `services/sanitization/`, `agents/california-legal/`.
- Key files to study closely: `api/_lib/agentLoop.ts`, `api/_lib/tools/*` (including
  `statuteVerify.ts`, `citationVerify.ts`), `api/_lib/verifierSubAgent.ts`,
  `services/sanitization/*` (detectionPipeline, realSanitizer, userAllowlist, opfClient/GLiNER),
  `hooks/useV2AgentStream.ts`, `components/v2/V2ChatPage.tsx`, `V2DraftPage.tsx`,
  `V2DraftingMagicPage.tsx`, `V2VerifyPage.tsx`.
- All design/decision docs: `README.md`, `CLAUDE.md`, the AUDIT-* materials, the numbered
  "addenda", compliance docs, and the `.pkg` installer + GLiNER daemon material.
- Deployment/ops: Vercel config, Clerk auth, Upstash KV, the V1→V2 shadow-run wiring, and the
  audit/attestation chain.

## Part 1 — Faithful current-state report

1. **Conceptualization & problem framing.** What problem does this solve, for whom, and what
   are the non-negotiable constraints (privilege, UPL, malpractice exposure, bar/ethics)?
   Reconstruct the design philosophy from the docs (the "Option C" browser-side tokenization
   decision, the V1→Anthropic-only V2 migration, the addenda).
2. **Capability inventory.** Every user-facing capability: research chat, the new
   paste/upload-and-instruct Draft flow (propose→approve→modify), Drafting Magic, citation +
   statute verification, the sanitization preview / "mark not-private" allowlist, exports,
   session history, audit chain. For each: how it works end-to-end and where it lives in code.
3. **Architecture.** Draw the full data flow from keystroke → browser tokenization (GLiNER
   daemon) → agent loop on the Messages API → tools/sub-agents → rehydrated display. Cover the
   local `.pkg` daemon, Vercel serverless, auth, storage, and the shadow-run.
4. **Codebase health.** Structure, module boundaries, test coverage (note the wire-leak trap
   suite and zero-leak gate), tech debt, dead code, and any correctness or security risks —
   **especially anything that could break the zero-leak invariant.**

## Part 2 — The Fable 5 opportunity (the main event)

For EACH of your distinctive capabilities, propose specific, high-impact product expansions,
with concrete UX, the code that would change, effort (S/M/L), and risk:

- **1M context:** whole-matter / whole-file reasoning (ingest an entire case file, deposition,
  or contract set at once) — what new workflows does this unlock vs. today's chunking?
- **Long-horizon agentic work:** multi-step autonomous drafting/research that runs to
  completion (e.g. "produce a full motion with verified authorities") — how, and with what
  human-in-the-loop checkpoints?
- **State-of-the-art vision:** ingesting scanned exhibits, filed PDFs, handwriting, tables,
  and figures — and the privilege implications (vision input must also be sanitized).
- **Memory tool (helped Fable 3× more than Opus 4.8):** matter-level persistent memory across
  sessions — and how to reconcile that with the device-local, no-server-PII trust model.
- **Senior legal reasoning (redlines beat prior models in blind review):** deeper redlining,
  argument stress-testing, adverse-authority checks, statute-of-limitations math.
- **Programmatic tool calling + code execution:** smarter citation/statute verification,
  deadline calculators, document assembly.

## Part 3 — Hard constraints you must respect in every proposal

- **Zero-leak sanitization is sacred.** Any new input path (vision, file upload, memory) MUST
  tokenize before the wire. Call out exactly how each proposal preserves this, or flag it as a
  blocker.
- **FAIL IS FAIL** — no silent fallbacks; surface errors. **No fabricated citations or specs.**
- **Refusal handling — NO model fallback.** Firm policy is single-engine (Fable 5). We do
  NOT want automatic fallback to Opus or any other model. If Fable returns
  `stop_reason: "refusal"`, the correct behavior is to (a) surface the refusal clearly to the
  attorney and (b) let us revise the request/prompt — never silently switch models. Assess how
  the app should detect and present a refusal under this single-engine policy, and propose that
  fix. Do NOT recommend a fallback chain.
- Light mode only; attorney-grade, non-technical UX; defensible audit trail.

## Output format

1. Executive summary (10 bullets max).
2. Current-state report (Parts 1.1–1.4).
3. Ranked opportunity roadmap — a table: opportunity · Fable capability leveraged · user value ·
   effort (S/M/L) · risk · zero-leak impact · suggested sequencing.
4. The single highest-leverage thing to build next, with a concrete implementation sketch.
5. Open questions / what you need me to show you to go deeper.

Be specific and cite file paths. Where you'd change code, name the files and the functions.
