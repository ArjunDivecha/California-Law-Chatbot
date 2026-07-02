---
name: matter-intake
description: Run a uniform matter-intake interview when the attorney is opening a new matter — covers identification, conflicts clearance, source, risk triage, materiality, outside counsel, internal owners, legal hold, key dates, and initial posture. Produces a matter-record draft the attorney saves into their matter-management system. Trigger phrases the upstream skill lists — "new matter", "intake this matter", "client intake", "open a matter", "onboard" — fire this in V2.
user-invocable: false
argument-hint: "[optional matter name]"
---

<!--
Adapted from anthropics/claude-for-legal/litigation-legal/skills/matter-intake/SKILL.md
Apache-2.0 © 2026 Anthropic PBC
Upstream skill is designed for the Claude Code plugin runtime — it instructs the
model to read/write filesystem paths under ~/.claude/plugins/config/claude-for-
legal/ and append YAML rows to _log.yaml. V2 is a CHAT interface with no
filesystem tools, so this adaptation preserves the upstream workflow (the
intake questions, the conflicts-check gating, the matter.md output schema)
but instructs the model to PRODUCE drafts the attorney saves manually,
rather than claim filesystem side effects it cannot perform.
-->

## V2 chat context (read first)

You are guiding an F&F attorney through opening a new matter. V2 is a chat interface — you have NO filesystem tools. When this workflow calls for "creating matter.md" or "appending to _log.yaml", produce the markdown / YAML CONTENT inline so the attorney can copy it into their matter-management system. Never claim to have written or saved a file.

Default jurisdiction is **California** unless the attorney specifies otherwise. The risk-triage and materiality framing below uses California-civil defaults; adjust if the attorney indicates a different posture.

## Workflow

Run the uniform intake interview in order. Cover every section; if the attorney doesn't know an answer, capture it as "unknown" rather than skipping — the gaps themselves are informative.

### 1. Identification

- Matter name (e.g., "Acme v. Us 2026", "Estate of Chen 2026", "DOL Investigation 2026")
- Counterparty (or decedent, or investigating agency)
- Matter type: `contract | employment | ip | regulatory | investigation | product | trust | probate | family | other`
- Our role: `plaintiff | defendant | claimant | respondent | investigated | petitioner | trustee | executor | other`
- Jurisdiction (court, arbitration forum, regulatory body — default California state)

### 2. Conflicts clearance — this is a gate

Before going further, confirm the conflicts check status:

- **Status:** `cleared | pending | not-run | waived`
- **Method:** how was it run? (e.g., conflicts-search system, name search across past matters, partner-by-partner check)
- **Cleared by:** the person who ran it
- **Cleared date:** YYYY-MM-DD
- **Checked against:** brief list of names/entities run — at minimum the counterparty, known affiliates, adverse counsel, key witnesses
- **Notes:** anything flagged but cleared

**If `not-run` — STOP and offer three paths:**

1. **Run it now** — pause the intake. Return when `cleared` or `waived` with rationale.
2. **Mark pending with owner + due date** — capture who is running it, expected return, what they're checking. The matter record carries `conflicts.status: pending` and surfaces in every status report until resolved.
3. **Bypass with documented rationale** — only with explicit attorney acknowledgment. Capture: who authorized the bypass, date, why. This stays in the record permanently; never auto-clears.

Do not proceed silently. The intake doesn't decide whether a conflict exists — the attorney/firm does. The intake ensures the check happened and the record reflects it.

### 3. Source

How did this matter arrive?
- `demand-letter | complaint-served | subpoena | regulator-inquiry | internal-report | pre-suit-threat | client-referral | walk-in | other`

If the attorney has the initiating document (complaint, demand, subpoena, regulatory letter), ask them to share or attach it — it sharpens every subsequent question.

### 4. Risk triage

- **Severity:** high / medium / low
- **Likelihood:** high / medium / low
- **Resulting risk rating:** the matrix product — typically critical / high / medium / low
- **Damages exposure range** (best estimate, can be very rough at intake)
- **Non-monetary exposure:** injunction risk? Consent decree? Reputational? Precedent that locks in unfavorable law?

If the firm's risk-calibration framework is thin or unwritten, don't fake precision. Use the attorney's gut and note that the calibration is approximate.

### 5. Materiality

Is this matter material for disclosure / reserve / monitoring purposes?
- `reserved | disclosed | monitored | none`
- If `reserved`: reserve amount + whether finance has been notified
- If `disclosed`: filing and footnote location

### 6. Outside counsel

- Firm
- Lead partner + email (used for status-request drafts later)
- Engagement letter status: `signed | pending | none`
- Budget authorization: amount + approver

**Flag if risk is medium-or-higher and no outside counsel is assigned.**

### 7. Internal owners

Which stakeholders need to be looped in?
- Business lead (the operational owner of whatever the dispute touches)
- HR partner (if employment)
- Communications contact (if reputational risk)
- CISO (if data or cyber)
- Other (IT, finance, etc.)

### 8. Legal hold

- Issued? If yes: date, scope, custodians (list of names).
- Next refresh date (default: six months from issuance; adjust per matter and CA preservation duty).
- If no AND this is active or reasonably anticipated litigation: flag urgently and offer to run a legal-hold issuance immediately after intake.

### 9. Key dates

- Response deadline (answer, objection, opposition)
- Next hearing or conference
- Statute of limitations cutoff (if applicable)
- Any regulatory or administrative deadlines

### 10. Initial posture

One-paragraph theory:
- What's our story?
- What's theirs?
- What's the pivot fact?
- Initial posture: `fight | settle | investigate | wait`

## Output to produce

After the interview, generate three things the attorney can copy into their matter-management system. Show all three; ask the attorney to flag anything wrong or thin before they save.

### A. Matter-record markdown (matter.md equivalent)

```markdown
# [Matter Name]

**Slug:** [lowercased-hyphen-year, e.g., acme-v-us-2026]
**Opened:** [YYYY-MM-DD]
**Our role:** [role]
**Status:** [active / threatened / monitoring / closed]

## Identification

[counterparty, jurisdiction, type, source]

## Conflicts

**Status:** [cleared/pending/not-run/waived]
**Method:** [...]
**Cleared by:** [name]
**Cleared date:** [YYYY-MM-DD]
**Checked against:** [entities]
**Notes:** [...]

## Risk triage

**Severity:** [band] — [why]
**Likelihood:** [band] — [why]
**Risk rating:** [critical/high/medium/low]
**Exposure:** [dollar range + non-monetary]

## Materiality

[reserved/disclosed/monitored/none, with reserve amount or disclosure location]

## Outside counsel

[firm, lead, engagement, budget]

## Internal owners

[stakeholders + why each]

## Legal hold

[status, date, scope, custodians]

## Key dates

[ordered list]

## Initial theory

[paragraph; flag as a working hypothesis to be confirmed with outside counsel before any filing]

## Open questions

[anything unknown that matters]
```

### B. History-log seed entry

```markdown
## [YYYY-MM-DD] — Matter opened

[source, who brought it in, initial triage summary, outside counsel assigned, legal hold issued y/n]
```

### C. Portfolio-row YAML

```yaml
- id: [slug]
  name: "[full name]"
  type: [type]
  role: [role]
  counterparty: "[counterparty]"
  jurisdiction: "[jurisdiction]"
  status: [active/threatened/monitoring]
  source: [source]
  outside_counsel:
    firm: "[firm]"
    lead: "[lead]"
    email: "[email]"
    engagement: [signed/pending/none]
  conflicts:
    status: [cleared/pending/not-run/waived]
    method: "[method]"
    cleared_by: "[name]"
    cleared_date: [YYYY-MM-DD]
  risk: [critical/high/medium/low]
  materiality: [reserved/disclosed/monitored/none]
  exposure_range: "[$X–$Y]"
  legal_hold:
    issued: [true/false]
    issued_date: [YYYY-MM-DD or null]
    next_refresh: [YYYY-MM-DD or null]
  opened: [YYYY-MM-DD]
  next_deadline: [YYYY-MM-DD]
```

## What this skill does NOT do

- **Run the conflicts check itself.** It records the result and the method. The actual clearance happens in the firm's system or judgment.
- **Decide the initial theory.** It captures what the attorney says; it doesn't invent one.
- **Issue the legal hold.** It flags if missing and recommends running the legal-hold workflow next. The attorney issues the hold.
- **Write files.** V2 is a chat interface. The outputs above are drafts for the attorney to save.

## California-specific notes

- F&F's primary practice areas (probate, family law, business litigation, business entities, business transactions per CEB namespaces) — bias the matter-type defaults toward `probate | family | contract | other` rather than the upstream defaults that lean toward corporate litigation.
- For probate matters: `our role` is typically `petitioner | executor | trustee` rather than `plaintiff | defendant`.
- California preservation duty: under *Cedars-Sinai Medical Center v. Superior Court* (1998) 18 Cal.4th 1 and CCP §2031.300, the duty to preserve attaches once litigation is reasonably anticipated. Default the legal-hold-needed flag to `yes` for any matter type that isn't pure transactional / pre-dispute.
- Statute-of-limitations defaults to track: CCP §337 (4 yr written K), CCP §339 (2 yr oral K), CCP §340 (1 yr personal injury defamation libel etc.), CCP §335.1 (2 yr injury to person), Probate Code §16460 (3 yr claims against trustee).
