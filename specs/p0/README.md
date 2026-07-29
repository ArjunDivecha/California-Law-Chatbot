# P0 Divecha-gated fix plan (2026-07-09 code review)

Author-mode contracts only. No product code is implemented by this plan.
Each contract must be proven by **external gates**, not agent self-certification.

## Why these three (and only these)

From the full-repo review, **P0** was the minimum set that closes live trust-boundary
and product-compliance holes without expanding into CI hygiene (P1) or refactors (P2).

| # | Spec ID | Bet (one line) | Severity if left open |
|---|---------|----------------|------------------------|
| 1 | `CALC-P0-CONSENT-ANTHROPIC-001` | Consent-blocked confidential/protected sessions must not call Anthropic | Policy says no external model call; loop still calls Anthropic |
| 2 | `CALC-P0-VERIFIER-EVIDENCE-001` | Verifier must treat CourtListener `hits` as evidence + allowlist model | Real cites forced `ambiguous`; unapproved verifier models possible |
| 3 | `CALC-P0-COMPLIANCE-CHROME-001` | Draft / Verify / Magic mount attestation + matter mode | Highest-PII surfaces lack confidentiality chrome |

**Explicitly not P0 (do not fold into these contracts):** CI test gate, dual lockfile,
review-gate-on-export, firm-controlled storage, Magic decomposition, plaintext draft LS,
session ownership fail-open, client `system_prompt` rejection.

## Execution order

```
          ┌─────────────────────────────────────┐
          │  CALC-P0-CONSENT-ANTHROPIC-001      │  server loop
          │  (api/_lib/agentLoop + tests)       │
          └─────────────────────────────────────┘
                         │ independent
          ┌─────────────────────────────────────┐
          │  CALC-P0-VERIFIER-EVIDENCE-001      │  verifier only
          │  (verifierSubAgent + tests)         │
          └─────────────────────────────────────┘
                         │ independent
          ┌─────────────────────────────────────┐
          │  CALC-P0-COMPLIANCE-CHROME-001      │  UI only
          │  (V2 pages / shell + tests)         │
          └─────────────────────────────────────┘
```

All three are **scope-disjoint enough to run in parallel** (separate worktrees or sequential
PRs). Preferred merge order if serial:

1. **Verifier** (smallest, pure bugfix)  
2. **Consent Anthropic block** (core policy enforcement)  
3. **Compliance chrome** (UI; depends on nothing from 1–2)

Do **not** combine into one mega-PR: different blast radii and review needs.

## Files

| Contract | Path |
|----------|------|
| Consent → Anthropic hard-block | [`CALC-P0-CONSENT-ANTHROPIC-001.spec.md`](./CALC-P0-CONSENT-ANTHROPIC-001.spec.md) |
| Verifier evidence + model gate | [`CALC-P0-VERIFIER-EVIDENCE-001.spec.md`](./CALC-P0-VERIFIER-EVIDENCE-001.spec.md) |
| Compliance chrome on all V2 surfaces | [`CALC-P0-COMPLIANCE-CHROME-001.spec.md`](./CALC-P0-COMPLIANCE-CHROME-001.spec.md) |

## Handoff (Build Mode)

For each contract, from repo root, after Author validation is green:

```text
Use $divecha in Build Mode on
/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/specs/p0/<SPEC_FILE>.spec.md.
Resolve TODO gates and review.command against the real repo, present a preflight
estimate and flip budget.preflight_estimate to complete, ask before any
requires_permission gate, implement until all checks pass, and append ledger state.
Do not touch any scope.forbid path.
```

Or run the automated loop (after Build Mode has resolved commands):

```bash
python3 ~/.agents/skills/divecha/scripts/run_codex_loop.py \
  specs/p0/<SPEC_FILE>.spec.md \
  --cwd "/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot" \
  --trust
```

## Author validation (already run)

```bash
python3 ~/.agents/skills/divecha/scripts/validate_contract.py --mode author \
  specs/p0/CALC-P0-CONSENT-ANTHROPIC-001.spec.md
python3 ~/.agents/skills/divecha/scripts/validate_contract.py --mode author \
  specs/p0/CALC-P0-VERIFIER-EVIDENCE-001.spec.md
python3 ~/.agents/skills/divecha/scripts/validate_contract.py --mode author \
  specs/p0/CALC-P0-COMPLIANCE-CHROME-001.spec.md
```

Expected: `DIVECHA_CONTRACT_VALID mode=author` for each.

## Done definition (per contract)

DONE is mechanical (Divecha runner):

1. Every `gates[].command` exits 0  
2. Git diff ⊆ `scope.in` and hits no `scope.forbid`  
3. `review.command` exits 0 (`review.mode: required`)  
4. `budget.preflight_estimate: complete`  

Passing gates proves the **build loop**, not the product bet. Product confirmation is listed under each contract’s `scale` field.
