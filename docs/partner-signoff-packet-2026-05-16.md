# F&F partner sign-off packet — California Law Chatbot V2

**Date:** 2026-05-16
**Ask:** Two partner signatures unblock Phase 4.5 shadow run and Phase 5 cutover.
**Read time:** 5 minutes (this page) + 10 minutes (§Q memo, attached).

---

## What you are signing

By signing the §Q memo (separate attachment) you acknowledge three things:

1. **Team-plan posture is understood.** F&F runs V2 on Anthropic's Team plan. No ZDR / no BAA / no SOC 2. The original 2026-05-03 plan that promised those is replaced by the rewritten §Q memo dated 2026-05-15.
2. **On-device tokenization is the privilege boundary.** Names, addresses, SSNs, dates, ZIP codes, and other client identifiers are replaced by opaque tokens (`CLIENT_001`, `ADDRESS_007`) in your browser **before** any text leaves your laptop. Anthropic sees the tokenized form. Real identifiers never leave the device.
3. **7-year audit chain is the discovery-of-record.** Each request writes an HMAC-only audit record. Plain text is never persisted server-side. This is what we hand a court / bar panel / malpractice carrier on request.

The §Q memo (`docs/q-ff-communication-memo-2026-05-15.md`) is the operative document. This page is the cover sheet.

---

## Empirical evidence (the 120-trap zero-leak gate)

Two consecutive full-suite runs, each across 120 hand-authored adversarial inputs covering compound identifiers, single-word and foreign names, tool-output reintroduction, financial identifiers, adversarial prompts, and direct PII:

| Run | Generated at | Total | Pass | Fail | Wire-leaks |
|---|---|---|---|---|---|
| `gliner-final-v8-run1` | 2026-05-15 16:10 UTC | 120 | 120 | 0 | **0** |
| `gliner-final-v8-run2` | 2026-05-15 16:11 UTC | 120 | 120 | 0 | **0** |

Category breakdown (run 1; run 2 identical): compound_identifier 25/25, single_word_name 10/10, tool_output_reintroduction 11/11, financial 10/10, adversarial 10/10, mixed_direct_pii 54/54.

Reports:
- [`reports/traps-wire-gliner-final-v8-run1.json`](file:///Users/arjundivecha/Dropbox/AAA%20Backup/A%20Working/California-Law-Chatbot-V2/reports/traps-wire-gliner-final-v8-run1.json)
- [`reports/traps-wire-gliner-final-v8-run2.json`](file:///Users/arjundivecha/Dropbox/AAA%20Backup/A%20Working/California-Law-Chatbot-V2/reports/traps-wire-gliner-final-v8-run2.json)

**Architecture detail:** The detector is GLiNER (multilingual span-based PII model) running as a local HTTPS daemon on each attorney's laptop. Browser → daemon → token map → tokenized text on the wire. If the daemon is unreachable, V2 fails closed — no chat works rather than silently sending raw text.

---

## Addendum index (what changed since the original plan)

The plan was authored 2026-05-03. Nine signed amendments since:

| # | Date | What changed |
|---|---|---|
| 1 | 2026-05-10 | Managed Agents removed from plan (architecture pivot) |
| 2 | 2026-05-10 | ZDR / BAA / SOC 2 dropped — Team plan only |
| 3 | 2026-05-12 | Token-map retention model — Option C (tentative) |
| 4 | 2026-05-12 | Managed Agents revisit (scope clarification) |
| 5 | 2026-05-12 | Anthropic legal-industry launch — tool inventory revisions |
| **6** | **2026-05-13** | **F&F partner ratifications: Option C, no TR, accept Opus 4.7 cost** |
| 7 | 2026-05-13 | web_search privilege gate dropped (informational only) |
| 8 | 2026-05-14 | Confidence-hold-back gate (D19) dropped |
| 9 | 2026-05-15 | GLiNER replaces OPF as primary detector |

All nine codified in [`docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md`](file:///Users/arjundivecha/Dropbox/AAA%20Backup/A%20Working/California-Law-Chatbot-V2/docs/MANAGED_AGENTS_RECONSTRUCTION_PLAN.md). Addendum 6 is the relevant one — it ratified the three previously-blocking decisions (retention model, no TR subscription, Opus 4.7 cost).

---

## What this sign-off unblocks

**Phase 4.5 shadow run (1 week).** V1 dual-fires every production query to V2's `/api/agent/shadow` endpoint. Only V1's response is shown to the user. V2's response is logged with full trace. Daily divergence report. Wire is already implemented on V1 branch `shadow-run-flip` — flips on by setting `VITE_V2_SHADOW_URL` in Vercel.

**Cutover gate to Phase 5a:** ≤ 20% material divergence on a representative sample, no critical hallucinations from V2, 7 consecutive clean days.

---

## Non-signature gates still open

These are engineering tasks, not partner decisions. Listed for transparency:

- [ ] Malpractice carrier UPL written confirmation (Arjun to chase carrier)
- [ ] `AUDIT_ENVELOPE_DEK` (32-byte base64) provisioned in V2's Vercel env
- [ ] GLiNER daemon installed on each attorney laptop (one-time, `tools/gliner-daemon/install.sh`)
- [ ] `VITE_V2_SHADOW_URL` set in V1's Vercel env (flips dual-fire on)
- [ ] KEK/DEK rotation strategy decision (audit envelope at-rest key management)

---

## Rollback commitment

If anything fails in production (per plan §M triggers): single flag flip, ~3 minutes back to V1. All V1 code remains in repo during Phase 5a. Phase 5b legacy teardown happens only after 30 consecutive clean days.

---

**Signatures**

I acknowledge the Team-plan posture, the on-device tokenization design, and the 7-year audit retention as the operative privilege chain for V2. The §Q memo dated 2026-05-15 replaces the original "ZDR + BAA + SOC 2" framing.

Partner: ________________________________  Date: ____________

Partner: ________________________________  Date: ____________
