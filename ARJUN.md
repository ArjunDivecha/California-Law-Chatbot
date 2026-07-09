# ARJUN.md — product memo

*Fable 5, 2026-07-06. Blunt, ranked by value ÷ effort. This is the memo, not the manual.*

## What this repo is worth

**Alive, and it's your only real production app.** This is the Femme & Femme Law research
and drafting assistant, deployed at `chat.femmeandfemmelaw.com` for actual attorneys. It is
not superseded by anything in the ecosystem and it doesn't duplicate any of your quant
repos — it stands alone. It is also the most engineering-mature thing you own: a genuine
fail-closed compliance layer, on-device PII tokenization, Clerk auth, a bounded agent loop,
and a documented model allowlist. Most of your repos are experiments; this one has users
and ethical/liability stakes, so the ROI calculus is different — here, **reliability of the
confidentiality promise is the product**, not features.

One thing to internalize before you touch it: there is a live confidentiality regression
right now (a California driver-license number is not being redacted on the way out —
FABLE.md P0), and it shipped only because **no CI runs the test that catches it.** For a
tool whose entire legal justification is "we protect client data," that's the one class of
bug that can cost you a bar complaint. Fix that first; everything else is upside.

## Extensions ranked by value ÷ effort

1. **Ship the P0 fix + turn on a CI test gate.** *(value: very high · effort: low)*
   Close the driver-license leak (the Divecha contract in FABLE.md is ready to hand to
   Codex) and add a GitHub Action that runs all 15 unit tests + both trap runners on every
   push. Your suite is fast, offline, and already green except the one trap — there is no
   reason it isn't gating merges. **Why now:** it's the difference between "we have a
   privacy filter" and "we can prove our privacy filter never regressed." **First step:**
   run the FABLE.md handoff prompt, then add `.github/workflows/test.yml` calling a new
   `yarn test:all`.

2. **Client-facing "trust receipt" per response.** *(value: high · effort: medium)*
   You already build a per-turn compliance manifest (`api/_lib/compliance/turnManifest.ts`)
   and an audit log — it's invisible. Surface a small, human-readable receipt on each
   answer: what was tokenized, which Anthropic model (ZDR/DPA-covered), what sources were
   touched. **Why now:** it converts your hidden compliance engineering into the thing that
   *wins the client and satisfies the ethics rules* — a family-law client handing over the
   most sensitive facts of their life wants to see the lock, not be told it exists.
   **First step:** render the existing manifest fields in `components/v2/V2ChatPage.tsx`
   behind an expandable "How this answer was protected" chip. **Reuse:** `turnManifest.ts`,
   `api/_shared/auditLog.ts`, the existing `V2SanitizationChip`.

3. **Firm-private matter memory (not the personal-knowledge MCP).** *(value: high · effort: medium-high)*
   You already built the hard part in the P5-infra commits: a firm-controlled sqlite-vec
   store (`api/_lib/compliance/sqliteVecStore.ts`) and a local, fail-closed embeddings
   daemon (`api/_lib/compliance/localEmbeddings.ts`). Feed the firm's *own* prior briefs,
   standard clauses, and past drafting into it so the assistant drafts in the firm's voice
   and cites its own precedents. **Why now:** Drafting Magic already exists; grounding it in
   the firm's real work is the leap from "generic legal LLM" to "our associate." **First
   step:** an ingest script that embeds a folder of the firm's approved documents into the
   existing firm store. **Critical:** keep this in the firm-controlled store — do **not**
   route client documents through your personal-knowledge MCP (that's your personal
   knowledge base, wrong trust domain).

4. **Auto-drafted billable time entries.** *(value: high · effort: medium)*
   The billing fee-rule guards from P7 (`api/_lib/compliance/billing.ts`) are already in the
   trust boundary. Every research/drafting session is billable attorney time that today goes
   uncaptured. Emit a reviewable draft time entry ("0.4h — researched CA custody
   modification standard") the attorney can approve. **Why now:** it's the rare feature that
   pays for itself in literal dollars per session. **First step:** add a per-session
   duration + task-summary artifact keyed off the existing session store.

5. **Public intake / triage front door.** *(value: medium-high · effort: medium)*
   A no-PII, `public_research`-mode public page that screens family-law/LGBTQ inquiries and
   routes qualified leads to the firm. **Why now:** lead-gen with essentially zero marginal
   cost, and it reuses the exact mode where the compliance layer is already safe for
   unauthenticated public text. **First step:** a stripped `/intake` route locked to
   `public_research` with the tool set disabled except public statute lookup.

6. **One-click court-ready packets.** *(value: medium · effort: low-medium)*
   Extend `api/export-document.ts` so Drafting Magic output comes out as a formatted,
   caption-ready DOCX/PDF filing packet rather than raw prose. **Why now:** pure time
   savings on work already 80% done. **First step:** a packet template applied at export.

## Quick wins (< 1 hour, outsized payoff)

- **Add a `test:all` script** that runs all 15 unit files + `runTraps.mjs` + `runTrapsWire.mjs`. Even before CI, it makes "did I break sanitization?" a one-liner. (Precursor to extension #1.)
- **Kill the dual lockfile.** `package-lock.json` is stale and `yarn.lock` is canonical (`packageManager: yarn@4.9.1`). Removing the npm lockfile ends a whole class of "works on my machine" drift. (Your call — I don't delete files without your say-so.)
- **De-clutter the repo root.** ~15 loose PDFs/PNGs/screenshots (`Morgan v V2X Inc.pdf`, `Etf pair trading -*`, `Finrobot-*`, `drafting-magic-*.png`) sit in the root; moving them into `docs/assets/` makes the tree legible to any future agent. (Recommend; won't move without permission.)
- **Fix the stale lock docstring** at `api/_lib/sessionStore.ts:366` ("30s" → 330s).

## What NOT to do

- **Don't chase more legal data sources.** You already tried the multi-source, two-pass
  verification path (Gemini generator + Claude verifier + CEB + CourtListener + OpenStates +
  LegiScan) and deliberately purged it. CEB is legally off-limits (their T&Cs), and the
  marginal case-law connector is not what's holding the product back — confidentiality proof
  and firm-private grounding are. Reintroducing retired sources is negative EV.
- **Don't turn this into a general-purpose all-practice-areas legal bot.** The moat is that
  it's tuned for California family-law / LGBTQ practice for one firm that trusts it. Breadth
  dilutes the tuning and multiplies the compliance surface you have to defend.
- **Don't do the big refactor for its own sake.** `V2DraftingMagicPage.tsx` (2808 lines) and
  `agentLoop.ts` (1661 lines) are large, but they work and they're covered. Split them only
  when a feature drags you into them — a standalone "clean it up" project is effort with no
  user-visible return.
