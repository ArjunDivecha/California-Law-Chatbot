---
name: legal-hold
description: Issue, refresh, release, or report on legal holds. Drafts the hold notice text the attorney sends to custodians; produces a portfolio-wide hold status report on request. Triggered by phrases the upstream skill lists — "issue a hold", "refresh hold", "release hold", "preservation notice", "litigation hold", "spoliation", "hold status".
user-invocable: false
argument-hint: "[matter slug] [issue | refresh | release | status]"
---

<!--
Adapted from anthropics/claude-for-legal/litigation-legal/skills/legal-hold/SKILL.md
Apache-2.0 © 2026 Anthropic PBC
Upstream skill writes legal-hold-vN.docx files into matter folders and
appends YAML rows. V2 is a chat interface — produces the notice text
inline as Markdown the attorney can paste into Word / send as email.
-->

## V2 chat context (read first)

You are helping an F&F attorney issue, refresh, or release a legal hold, or report on the portfolio-wide hold status. V2 is a chat interface — produce the notice TEXT inline (as Markdown the attorney can paste into Word or an email). Never claim to have sent the notice yourself; the attorney sends it.

## When the duty to preserve attaches

In California, the duty to preserve evidence attaches when litigation is **reasonably anticipated**, not only when it's filed. *Cedars-Sinai Medical Center v. Superior Court* (1998) 18 Cal.4th 1; *Williams v. Russ* (2008) 167 Cal.App.4th 1215. Triggers include: a demand letter, a litigation hold from another party, an EEOC/DFEH/Civil Rights Department charge, an internal report of misconduct that's reasonably likely to become a claim, or counterparty conduct that signals litigation. When in doubt, the duty has attached and the hold should issue.

Federally, FRCP 37(e) controls the spoliation sanction framework for ESI; California's parallel framework is CCP §2031.300 and the inherent power of the court.

## Routing by intent

Determine which action the attorney wants:

- **Issue** — first-time hold for a matter
- **Refresh** — periodic reminder (default cadence: every 6 months) plus check whether custodians or scope have changed
- **Release** — litigation has resolved; preservation duty terminated; custodians can return to normal retention
- **Status** — portfolio-wide report: which matters have active holds, when last refreshed, when next refresh is due, any custodian departures flagged

## Workflow — Issue

### 1. Capture the matter context

- Matter slug (so the attorney can correlate)
- Subject-matter scope: what is being preserved? Be specific. ("All documents and communications relating to Project Acme from 2024-01-01 forward" is good. "All documents about Acme" is bad — too broad.)
- Date range: when does the preservation duty start? End is typically open-ended until release.
- Custodians: full list of names. Include departed-but-relevant custodians too (the attorney needs to coordinate with IT to preserve their archived mailboxes / drives).
- Systems: email, file shares, chat (Slack/Teams), texts, CRM, financial systems, physical files, voicemail, etc. Be specific about which apply.

### 2. Confirm the legal basis with the attorney

One sentence on what triggered the hold: "Demand letter received 2026-05-10 from opposing counsel re trust accounting", "EEOC charge filed 2026-04-22", "Pre-litigation threat from client's nephew re will contest", etc. Goes in the notice; helps custodians understand why they're being asked.

### 3. Draft the notice text

```markdown
# LEGAL HOLD NOTICE — [MATTER NAME]
**[FIRM] PRIVILEGED & CONFIDENTIAL — ATTORNEY WORK PRODUCT**

**Date:** [YYYY-MM-DD]
**From:** [Attorney name]
**To:** [Custodian list]
**Re:** Preservation of records relating to [matter name]

---

You are receiving this notice because you may have records relevant to a legal matter the firm is handling. As of the date above, **you are required to preserve all records** in your possession or control that relate to the matters described below. Failure to preserve evidence in pending or reasonably anticipated litigation can result in serious legal consequences for the firm and for the individuals involved.

## What's being preserved

**Subject matter:** [specific scope]
**Time period:** [start date] through further notice
**Custodians:** [name list, or a department-level scope]
**Systems involved:** [email, drives, chat, texts, etc.]

## What you must do

1. **Stop routine deletion.** Suspend automatic deletion rules, retention policies that would purge records in scope, and any clean-up practices (e.g., emptying deleted-items folders, archiving messages, deleting texts after a period).
2. **Preserve in place.** Do not move, alter, or copy records out of their current systems. The firm will coordinate any collection with IT.
3. **Preserve hard copies.** Any physical records (notes, files, drafts) in scope must be retained in place.
4. **No personal devices.** If you use personal devices or accounts for any work in scope (text messages, personal email, personal cloud storage), preserve those too. Coordinate with IT.
5. **Flag departures.** If you are aware of any departing or recently-departed employee whose records are in scope, notify [contact] immediately so their archives can be preserved.
6. **No discussion outside the team.** This hold notice is privileged. Do not discuss the matter, this notice, or the underlying issue except with the legal team or counsel.

## Duration

This hold remains in effect until you receive a written release notice. **Do not assume it has ended.** Refresh notices will go out every six months.

## Questions

Contact [attorney name + email].

---

**Acknowledgment** — please reply to this email confirming you have read and understood this hold notice. If you have any questions about scope, contact the legal team before acting.
```

### 4. Update the portfolio row

After the attorney confirms the notice, produce the YAML fields to update on the matter's row:

```yaml
legal_hold:
  issued: true
  issued_date: [YYYY-MM-DD]
  scope: "[scope summary]"
  custodians: [list]
  last_refresh: [YYYY-MM-DD — same as issued_date on first issuance]
  next_refresh: [YYYY-MM-DD — issued_date + 6 months by default]
  released: null
```

## Workflow — Refresh

1. Confirm the matter is still active and the underlying preservation duty hasn't terminated.
2. Capture what's changed since the last refresh:
   - New custodians?
   - Departed custodians (and whether their archives were preserved)?
   - Scope expansions or contractions?
   - New systems brought into scope?
3. Draft refreshed notice text with the changes called out. Tag the version (`legal-hold-v2`).
4. Update `last_refresh` and `next_refresh` on the portfolio row.
5. If any custodians have departed without their archives being preserved, **flag this as a spoliation risk** for the attorney to address immediately.

## Workflow — Release

1. Confirm with the attorney that the matter has resolved (settled, dismissed, judgment final and non-appealable, etc.) and that the preservation duty has terminated. Be conservative — appeals, post-judgment motions, and pending sub-claims can extend the duty.
2. Draft release notice text:

```markdown
# LEGAL HOLD RELEASE NOTICE — [MATTER NAME]
**Date:** [YYYY-MM-DD]

The legal hold issued [issued date] in connection with [matter name] is **hereby released**. You may resume normal document retention practices for the records previously identified in the hold scope, subject to any other retention obligations that may apply (regulatory, employment, etc.).

If you have questions, contact [attorney name + email].
```

3. Update the portfolio row: `released: [YYYY-MM-DD]`.

## Workflow — Status

Read across all active matters and produce a report:

| Slug | Hold issued? | Last refresh | Next refresh due | Days until due | Custodian count | Notes |
|---|---|---|---|---|---|---|

Flag:
- Any hold whose next-refresh date is past (overdue)
- Any matter with risk ≥ medium that has no hold issued
- Any departed-custodian flag not yet resolved

## What this skill does NOT do

- **Send the notice.** The attorney sends; this skill drafts.
- **Decide whether the duty has attached.** It applies the California reasonably-anticipated-litigation standard to the facts the attorney provides. If the attorney isn't sure, surface the question; don't decide.
- **Collect the documents.** The hold preserves in place. Collection is a separate workflow (chain of custody, forensic imaging if needed).
- **Override the attorney's judgment.** If the attorney says "release this hold" and the skill thinks the duty might still attach, flag the concern but follow direction.

## California-specific notes

- **CCP §2031.300 spoliation framework.** Knowing destruction of evidence after the preservation duty attached supports terminating sanctions, evidentiary sanctions, monetary sanctions, or adverse-inference jury instructions. Counsel for the responding party can be sanctioned independently.
- **Litigation privilege does NOT cover spoliation.** Civ. Code §47(b) protects communications in litigation but not the underlying conduct.
- **Probate/estate matters:** preservation extends to the original of the will, trust instrument, codicils, account statements, and decedent's records. If a fiduciary is involved, the duty to preserve applies in parallel with the fiduciary's accounting duty under Prob. Code §16060 et seq.
- **Family-law matters:** preservation reaches the parties' communications (email, text, social DMs), financial records, and any documents that bear on community-property characterization, support, or custody. Both parties often need separate notices.
- **Employment matters:** California-specific records to preserve include personnel files (Lab. Code §1198.5), pay statements (Lab. Code §226), DFEH/CRD charge correspondence, and time records (Wage Order requirements). The 4-year statute of limitations on most California wage-and-hour claims makes scope wider than the federal default.
