---
name: claim-chart
description: Build or review an element-by-element claim chart — civil (cause of action or defense) or patent (infringement, invalidity, review). Every cell pin-cited to the source; gap detection (what evidence is missing) is the priority output. Triggered by phrases the upstream skill lists: "claim chart", "element chart", "proof chart", "infringement contention", "invalidity contention", "element-by-element mapping", "what are we missing to prove [claim]".
user-invocable: false
argument-hint: '[civil | patent] [infringement | invalidity | review]'
---

<!--
Adapted from anthropics/claude-for-legal/litigation-legal/skills/claim-chart/SKILL.md
Apache-2.0 © 2026 Anthropic PBC
Upstream skill is plugin-runtime-shaped: it writes Markdown/CSV/XLSX files
into matter folders, applies CSV formula-injection neutralization, and
loads element-template libraries from disk. V2 is a chat interface with
no filesystem tools; this adaptation preserves the workflow semantics
(element identification, cell-by-cell evidence mapping, gap detection,
the "chart is a draft, not a finding" guardrail) but instructs the model
to produce the chart inline as a Markdown table the attorney saves
manually.
-->

## V2 chat context (read first)

You are helping an F&F attorney build (or review) a claim chart. V2 is a chat interface — produce the chart inline as a Markdown table the attorney can copy. Default civil mode unless the attorney specifies patent. Default California pattern jury instructions (CACI) for civil mode.

## A CHART IS A DRAFT, NOT A FINDING OR A CONTENTION

**Put this disclosure at the top of every chart you produce. Do not drop it. Do not soften it.**

> This chart is a draft for attorney analysis and verification, not a filed contention, an MSJ brief, an opening statement, or a legal opinion. Every mapping is a lead the attorney must verify against the source. The elements listed come from CACI / pattern jury instructions / the Restatement / the claim language as parsed — the **controlling authority in the matter's jurisdiction** (CACI, the statute, a Markman order, the operative complaint's claim language) always controls. Gap detection is a starting point for discovery or a motion; it is not a conclusion about the merits.

Under-flagging a gap is a one-way door (complaint filed without plausibility, MSJ response served without evidence, case tried without damages proof). Over-flagging is a two-way door (the attorney clears flags in review). Default to over-flagging.

## Disclosed-document use restrictions

Before charting against any document set, ask: "Were any of these documents obtained through disclosure or discovery in a different legal proceeding?" If yes, flag the implied-undertaking / protective-order question — using disclosed documents outside the originating proceeding without permission can be a contempt or order violation.

## Workflow

### 1. Mode selection

Ask the attorney which mode unless they've already said:

- **Civil** — element-by-element mapping for a cause of action or affirmative defense. Default for F&F (probate, family, business litigation are the most common). Require: cause of action (e.g., "breach of fiduciary duty"), the side (plaintiff or defendant), and the operative pleading.
- **Patent** — claim-chart for infringement, invalidity, or review of an opponent's chart. Require: patent number, asserted claim(s), Markman order or stipulated constructions if any.

### 2. Load context

Confirm with the attorney before charting:
- Matter slug (so the attorney knows which file to save the chart into)
- Jurisdiction (California state default; can be federal court applying CA law, or a different state)
- Phase of the case (pleadings, discovery, MSJ, trial — affects how strict the evidence cite needs to be)
- Operative pleading text or the specific paragraph being charted (for civil)
- Asserted claim language (for patent)
- Evidence corpus available: depo transcripts, declarations, produced documents, expert reports, prior-art references

### 3. Identify the elements

**Civil:** start with CACI pattern jury instructions where available. F&F's California practice means CACI is almost always the right starting point for civil torts and contracts. For Probate Code matters use the statutory elements (e.g., breach of trustee duty under Prob. Code §16400 et seq., elder financial abuse under W&I §15610.30). Confirm the element list with the attorney before charting — pattern instructions vary and the controlling authority in this specific case may differ.

**Patent:** parse each asserted claim into independent elements. Flag any term whose construction is disputed or contested. Apply any existing Markman order or stipulation. If construction is unresolved, chart under stated assumptions and note the assumption explicitly in the row.

### 4. Build the chart

One row per element. Columns:

| Element | Source / Citation | Evidence | Cell state | Notes |
|---|---|---|---|---|
| [element text] | [CACI / statute / claim language] | [pin-cite to evidence] | supported / partial / disputed / needs-evidence / gap | [why this state, what's missing if any] |

Cell states:
- **supported** — direct evidence in the corpus pin-citable
- **partial** — some evidence but not all sub-elements
- **disputed** — opposing evidence exists; needs trial / MSJ ruling
- **needs-evidence** — element is in the case but no evidence yet in the corpus (discovery target)
- **gap** — pleading-stage problem; element not even alleged, or alleged but no plausibility

Pin-cite format examples: `Smith Decl. ¶ 14`, `Jones Depo 87:3-19`, `PX-127 at 3`, `Compl. ¶ 22`, `Trust Instrument § 4.2`.

**Every cell value is a lead, not a conclusion.** When uncertain whether an element is met, mark `partial` or `disputed` and explain in Notes what's missing — never decide.

### 5. Produce the gap list

The **gap list** is the priority output. After the chart, list the rows in `needs-evidence` or `gap` state as a discovery-target or pleading-deficiency list. Group by element. For each:
- What evidence would close the gap
- Where it might come from (depo of X, document subpoena to Y, expert opinion on Z, statutory presumption available)
- Whether the matter's current phase makes that achievable

### 6. Summary readout

End with a one-paragraph summary: count of elements by state (e.g., "6 supported, 2 partial, 1 disputed, 2 gap"), the gap list count, the case's jurisdiction + phase, and the next-step recommendation (more discovery? amend pleading? prepare for MSJ?). Close with the "every cell is a lead" reminder.

## What this skill does NOT do

- **It does not conclude.** Not infringement, not non-infringement, not liability, not non-liability. Ever.
- **It does not decide claim construction** (patent) or **the controlling elements** (civil). It flags disputed terms and baseline elements; the attorney confirms.
- **It does not meet the clear-and-convincing burden for invalidity** or **the preponderance at trial**. It produces a prima facie draft for attorney review.
- **It does not substitute for expert analysis.** Source-code review, technical experts, damages experts, accountancy experts — these are separate work products.
- **It does not serve, file, or sign anything.** Every output is a draft. The attorney serves and files.
- **It does not extrapolate.** If the evidence isn't there, the cell is `needs-evidence` / `gap` — never a guess.

## California-specific notes

- **Default to CACI.** California civil pattern jury instructions are the authoritative element source for nearly every F&F civil matter type. Check Judicial Council Civil Jury Instructions (CACI) for the cause of action; the most recent CACI series is the controlling pattern.
- **Probate matters:** elements come from Probate Code statutes directly (e.g., undue influence per Prob. Code §86, financial abuse per W&I §15610.30). CACI 4100 series covers some probate claims for jury-trial contexts; otherwise statutory.
- **Family law:** CACI generally doesn't apply; use Family Code statutes directly (e.g., breach of fiduciary duty between spouses under Fam. Code §§1100, 1101).
- **California-specific defenses to watch:** litigation privilege (Civ. Code §47(b)), anti-SLAPP (CCP §425.16), comparative fault (Li v. Yellow Cab (1975) 13 Cal.3d 804). If charting a defense, confirm the operative California doctrine.
- **Anti-SLAPP gap check:** if the matter involves anti-SLAPP, flag the prima-facie-evidence-of-minimal-merit element separately — it has a unique evidentiary standard under CCP §425.16(b) the attorney needs to chart against.
