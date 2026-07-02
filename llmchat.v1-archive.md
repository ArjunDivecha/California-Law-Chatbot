# llmchat.md - Project Context Log

This file is the shared memory between project sessions and agents.
It is append-only. Do not edit existing entries unless explicitly asked.
Each session appends a timestamped block at the bottom.

---
SESSION START: 2026-05-14 16:13 PDT | Agent: Codex
---

### Session Summary
Consolidated summary of this thread plus the broader California-Law-Chatbot chat history, with emphasis on Drafting Magic, privacy/sanitization boundaries, Safari/OPF behavior, Vercel branch deployment issues, and current model/runtime assumptions.

### Decisions Made
- Drafting Magic was built as a multi-document workbench flow (Inputs/Compare/Strategy/Draft/Review) for trust + will + AHCD + financial POA + prenup workflows, with pathway packaging for Estate Planning and Family Law variants.
- Confidentiality architecture remains fail-closed: client-sensitive text must be tokenized locally before cloud generation, with rehydration staying local.
- OPF is a local privacy filter daemon boundary, not a chat model role; if OPF is unavailable, cloud draft generation is blocked.
- Managed-agent style expansion was reviewed against V2 planning, with preserved preference for sanitization-first routing and strict backend controls on privileged paths.
- For branch previews, a deployment is considered shareable only after rendered-browser validation, not just HTTP 200/build success.

### Architecture / Design
- Core sanitization stack:
  - Local OPF daemon client in `services/sanitization/opfClient.ts` (`https://localhost:47822` with local bridge fallback).
  - Detection merge pipeline in `services/sanitization/detectionPipeline.ts` combining OPF spans + deterministic regex/pattern/name heuristics.
  - Guard rails in `api/_shared/sanitization/guard.ts` for hard rejection of raw PII-shaped content before retrieval/model calls.
- Drafting Magic:
  - Main UI/workflow in `components/draftingMagic/DraftingMagicPage.tsx`.
  - Cloud drafting route in `api/drafting-magic.ts` using sanitized packet payloads only.
  - DOCX export path in `components/draftingMagic/draftDocxExport.ts`.
- OPF daemon implementation:
  - Installer/runtime in `tools/opf-daemon/`.
  - Daemon loads OPF lazily and reports `model_loaded` health status.

### What Was Fixed In This Thread
1. Upload controls in Drafting Magic were changed from fragile proxy interactions to native file inputs so visible user click path works reliably.
2. Upload behavior was re-tested using actual browser click -> macOS file picker -> file selection -> UI state update, not only injected test paths.
3. Branch preview blank-screen root cause was identified as missing branch-scoped preview env (`VITE_CLERK_PUBLISHABLE_KEY`) on one preview branch; fix path was to push to the env-configured preview branch and verify rendered page.

### Current Model/Runtime Notes
- OPF model source is OpenAI Privacy Filter checkpoint (`openai/privacy-filter`) loaded locally by the daemon.
- OPF is not the same thing as OpenAI chat completion models; it is a local token-classification privacy filter.
- Cloud generation model routing in this repo is currently Anthropic Bedrock role-based (`BEDROCK_*_MODEL`), post-sanitization.
- OpenAI still appears in the stack for embeddings/retrieval-related paths (for example `text-embedding-3-small`) in relevant repo workflows.

### Constraints & Gotchas
- Vercel preview env vars are branch-scoped in this setup; a new branch can deploy successfully but still render blank if required client env vars are missing.
- Safari can fail on local privacy filter transport/cert trust even when Chrome works; local bridge/cert handling is part of the supported path.
- False-positive completion claims previously caused trust damage; validations must be explicit and user-visible.
- Untracked local fixture/scripts exist in some worktrees and should not be accidentally staged when committing focused UI fixes.

### Open Questions
- Whether to standardize preview env strategy so all feature branches inherit required auth/env config automatically.
- Whether to expose OPF model/checkpoint metadata in-app for easier operational debugging (without leaking sensitive internals).
- Whether to add automated e2e checks that assert rendered page content and upload clickability on preview URLs before sharing links.

### Context for Next Session
Priority is reliability and confidence in attorney-facing workflows: keep sanitization fail-closed, verify real UI behavior end-to-end, and avoid claiming deployment readiness without rendered-browser confirmation on the exact shared URL.

---
SESSION END: 2026-05-14 16:13 PDT | Agent: Codex
---

---
SESSION START: 2026-05-14 16:27 PDT | Agent: Codex
---

### Session Summary
Detailed consolidated handoff across this conversation and related California-Law-Chatbot threads. Focus is on end-to-end product path for Drafting Magic, privacy architecture (OPF + tokenization + rehydration), branch/worktree/deployment history, model/runtime clarification, and reliability lessons from failed validations.

### Expanded Timeline
1. Drafting Magic concept and scope:
   - Product direction moved from generic compare/generate to a legal packet workbench for estate and family law documents.
   - Primary document set: trust, pour-over will, AHCD, durable financial POA, prenup; later expanded with family-law pathways (prenups, confirming adoption, known donor contracts).
2. Initial UX build and route work:
   - New Drafting Magic page and multi-tab workflow surfaced.
   - Early regressions included blank loading states and panel-layout mismatches.
3. Sanitization-first integration:
   - Flow constrained so cloud draft generation only receives tokenized packet text.
   - Rehydration and token-map management remain local/browser-side.
4. Browser compatibility incident (Safari):
   - Privacy setup/connect sequence stuck in Safari due to local OPF connectivity/cert/bridge behavior.
   - Principle preserved: do not bypass privacy gate; fix local transport path instead.
5. Upload control regressions:
   - User-visible upload path broke after control refactors.
   - Early tests incorrectly used indirect injection paths and were over-claimed as fixed.
   - Final correction replaced proxy upload behavior with native file inputs and validated actual click-to-picker path.
6. Vercel preview-sharing incident:
   - Link shared after build/HTTP checks but before rendered-page validation; user saw blank screen.
   - Root cause: branch-scoped preview env mismatch (`VITE_CLERK_PUBLISHABLE_KEY`) on a non-configured branch preview.
   - Fixed by moving tested commit onto env-configured preview branch and re-validating rendered UI.
7. Model/source clarification loop:
   - Distinction clarified between:
     - OPF local model/checkpoint for PII detection.
     - Anthropic Bedrock models for post-sanitization generation roles.
     - OpenAI embeddings usage in retrieval paths.
   - OPF underlying checkpoint confirmed as OpenAI Privacy Filter (`openai/privacy-filter`).

### Product Surface (Drafting Magic)
- Route/UI:
  - Primary page: `components/draftingMagic/DraftingMagicPage.tsx`.
  - Stages: `Inputs`, `Compare`, `Strategy`, `Draft`, `Review`.
- Inputs stage:
  - Manage packet by practice pathway and package template.
  - Source Library with include/exclude toggles, base selection, upload, open/source preview.
- Compare/Strategy:
  - Matrix-style issue extraction and decisioning (keep/revise/discard/add).
  - Matter-model checks (trust identity, fiduciary alignment, property character, execution packet).
  - Law-impact path checklist that gates drafting posture.
- Draft:
  - Generation only from sanitized packet.
  - Section-level regeneration with lock support and lineage cues.
- Review:
  - Decision/rationale carrythrough plus export-oriented final checks.
- Export:
  - DOCX summary/export path in `components/draftingMagic/draftDocxExport.ts`.

### Privacy + Sanitization Architecture
- Local-first sanitization boundary:
  - OPF daemon client: `services/sanitization/opfClient.ts`.
  - Daemon endpoints (loopback): HTTPS `https://localhost:47822`, HTTP/bridge fallback on `127.0.0.1`.
- Detection pipeline:
  - `services/sanitization/detectionPipeline.ts` merges:
    - OPF spans (preferred).
    - Deterministic regex/pattern/name heuristics as complementary/fallback behavior.
- Hard guard:
  - `api/_shared/sanitization/guard.ts` enforces fail-closed checks before external retrieval/model routes.
- Drafting Magic cloud route:
  - `api/drafting-magic.ts` expects sanitized packet payload and preserves audit/safety posture.

### OPF Model Details (Confirmed)
- OPF daemon runtime:
  - `tools/opf-daemon/opf_daemon.py` instantiates `OPF(device="cpu", output_mode="typed")`.
- Checkpoint source and identity:
  - `~/.opf-daemon/repo/opf/_common/checkpoint_download.py` defaults to repo `openai/privacy-filter`.
  - Local checkpoint path: `~/.opf/privacy_filter`.
  - `~/.opf/privacy_filter/config.json` has `"model_type": "privacy_filter"`.
- Practical implication:
  - Name/entity detection in OPF is OpenAI Privacy Filter checkpoint inference, not a GPT chat model.

### Branch / Worktree / Deployment State
- Relevant branches:
  - `main`
  - `codex/bedrock-confidentiality-migration`
  - `codex/drafting-magic`
  - `codex/drafting-magic-sanitized`
  - `V2`
- Key commit path:
  - Upload fix finalized in `codex/drafting-magic-sanitized`, then fast-forwarded into `codex/drafting-magic` to reuse configured preview env.
- Preview-link reliability lesson:
  - Build-ready and HTTP 200 are necessary but not sufficient.
  - Required release check for shared link now includes browser-render + console sanity + critical UI element presence.

### Incidents, Root Causes, and Corrective Actions
- Incident: Upload “fixed” claim was false.
  - Root cause: validation used non-user path (injected upload), not visible control click path.
  - Correction: native file input controls + literal click-to-open picker verification.
- Incident: Shared Vercel link showed blank screen.
  - Root cause: missing branch-scoped preview env var for Clerk on that preview branch.
  - Correction: deploy on env-configured branch and confirm rendered page content before sharing.
- Incident: Safari privacy step stuck.
  - Root cause class: local bridge/cert/loopback transport reliability differences vs Chrome.
  - Correction direction: preserve gate, improve local transport readiness and explicit setup UX; avoid bypassing OPF requirement.

### Validation Standard (Now Explicit)
- “Done/tested” requires:
  - User-path action verification for UI controls (not only internal handler invocation).
  - Runtime-render validation on target URL.
  - Console/error review for blocking failures.
  - Route-level and build-level checks as supplemental evidence only.

### Model/Provider Reality Check
- OPF sanitization model source:
  - OpenAI Privacy Filter checkpoint (`openai/privacy-filter`, `model_type: privacy_filter`).
- Post-sanitization generation:
  - Anthropic Bedrock role-based env routing (`BEDROCK_*_MODEL`) for generation/verification/research roles.
- OpenAI usage in repo:
  - Present in embeddings/retrieval-related paths (`text-embedding-3-small` contextually referenced in repo history).

### Current Risks
- Branch-scoped env drift can silently break previews.
- Safari OPF transport still requires careful ongoing validation after any privacy-flow change.
- Complex Drafting Magic state transitions (pathway/package/source toggles + draft freshness) can regress without automated e2e coverage.
- Team trust risk from over-optimistic validation claims; process discipline remains essential.

### Recommended Backlog (Execution-Ready)
1. Add CI/browser smoke for preview URL render:
   - Assert Drafting Magic heading and key panels present.
   - Fail on missing critical env/client boot errors.
2. Add upload e2e test:
   - Click visible upload control, select fixture, assert filename + source preview + section/word metadata update.
3. Add branch-env policy:
   - Move required preview envs from branch-specific to shared preview scope where safe, or enforce per-branch env checklist on deploy.
4. Add OPF readiness diagnostics in UI:
   - Distinguish cert failure, bridge blocked, daemon unreachable, and model-unloaded states with precise remediation steps.
5. Add release checklist gating shared links:
   - Build ok, route ok, render ok, console clean for blocking errors, key user-path interactions verified.

### Context for Next Session
Continue from a reliability-first posture: preserve confidentiality guardrails, prefer user-visible validation evidence over internal assumptions, and treat preview sharing as a release action requiring runtime proof on the exact URL being sent.

---
SESSION END: 2026-05-14 16:27 PDT | Agent: Codex
---
