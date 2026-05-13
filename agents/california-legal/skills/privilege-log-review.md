---
name: privilege-log-review
description: First-pass review of a privilege log — make the obvious privilege calls, leave the close ones for attorney review without deciding them. Triggered by phrases the upstream skill lists — "review the privilege log", "priv log", "check privilege on these docs", "QA the privilege log before production".
user-invocable: false
argument-hint: "[log file or document set]"
---

<!--
Adapted from anthropics/claude-for-legal/litigation-legal/skills/privilege-log-review/SKILL.md
Apache-2.0 © 2026 Anthropic PBC
Upstream skill loads a privilege-log file from disk and writes a reviewed
output. V2 is a chat interface — the attorney pastes the log entries (or
the relevant fields) into the chat; the skill produces the review inline
as a Markdown table the attorney saves.
-->

## V2 chat context (read first)

You are helping an F&F attorney do a first-pass review of a privilege log. V2 is a chat interface — the attorney pastes the log (or relevant entries) into the conversation. Produce the reviewed output as a Markdown table the attorney can copy. **Never make a close call.** Three states only: obvious-priv, obvious-not-priv, needs-attorney-review.

## The default is to flag, not to decide

Under-flagging is a one-way door: a privileged document inadvertently produced. Even with FRE 502(d) clawback or California Evid. Code §912 clawback, the disclosure can carry waiver, costs the attorney trust with the client, and may seed a subpart or subject-matter waiver argument.

Over-flagging is a two-way door: the attorney clears flags in review. The default is to flag.

## Disclosed-document use restriction

Before reviewing entries from another matter or another party's discovery, ask: "Were these documents obtained through discovery in a different proceeding?" If yes, flag the implied-undertaking / protective-order question. Privilege review of disclosed documents outside their originating proceeding may itself be a violation.

## Workflow

### 1. Confirm scope

- Which matter is this log for? (Slug or matter name; affects which custodians and which counsel will appear.)
- What's the production phase? Initial disclosure, response to RFPs, regulator production, sealed-records review for a court motion — different phases have different stakes.
- Who's the producing party? Us, opposing counsel for QA, or a third-party subpoena response.
- What privileges are in play? In California civil practice, typically:
  - **Attorney-client (Evid. Code §§952, 954)**
  - **Work product (CCP §2018.030 — absolute for impressions/conclusions/opinions; qualified for ordinary work product)**
  - **Joint-defense / common-interest** (depending on agreement)
  - **Spousal communications (Evid. Code §980)** if applicable
  - **Mediation confidentiality (Evid. Code §1119)** if applicable
  - **Self-critical analysis** (limited recognition in CA; flag conservatively)

### 2. For each entry, evaluate against the three states

| State | When to use | What goes in the cell |
|---|---|---|
| **obvious-priv** | Document is on its face a communication between attorney and client for legal advice, OR clearly the attorney's mental impressions / litigation analysis | Confirm the privilege basis and flag for inclusion on the log |
| **obvious-not-priv** | Pure business document with no attorney involvement, OR the document was sent to a third party without common-interest agreement, OR the document predates the attorney-client relationship | Recommend producing without privilege claim |
| **needs-attorney-review** | Anything that's not clearly one of the above — including any close call, any document where the privilege basis depends on facts the skill can't verify, any document with mixed business/legal content | Flag with the specific question the attorney needs to answer |

### 3. Common patterns that trip up first-pass review

Surface these explicitly to the attorney rather than deciding:

- **Cc'd attorney.** A business email that happens to cc an in-house lawyer is NOT privileged just because the lawyer is on the to/cc line. Privilege attaches only if the dominant purpose of the communication was to seek or render legal advice. → `needs-attorney-review`
- **Attorney as a fact witness.** When the attorney is communicating about a transaction they were a fact participant in (not as counsel — e.g., they witnessed a closing), the communication isn't privileged. → `needs-attorney-review`
- **Forwarded chains.** Privileged content within a longer email chain that gets forwarded to a non-privileged recipient can waive. Review the WHOLE chain. → `needs-attorney-review`
- **In-house counsel wearing two hats.** Mixed legal-and-business advice from in-house counsel — typically only the legal portion is privileged, and the entry may need redaction rather than withholding. → `needs-attorney-review`
- **Third-party recipients.** Privilege is waived by disclosure to a third party absent common-interest, joint-defense, or other recognized exception (translator, accountant supporting the legal advice, etc.). → `needs-attorney-review`
- **Crime-fraud exception.** Communications in furtherance of a crime or fraud are NOT privileged, even otherwise-attorney-client. The skill cannot evaluate this. → `needs-attorney-review` (always)
- **Documents predating the attorney-client relationship.** Not privileged. → `obvious-not-priv` if the dates are clearly outside the engagement period.
- **Public records or filings.** Court filings, recorded deeds, published rulings — not privileged regardless of attorney involvement. → `obvious-not-priv`
- **Drafts of documents that became public.** A draft contract that was negotiated and signed — the draft itself may or may not be privileged depending on whether it reflects legal advice. → `needs-attorney-review`

### 4. Output

Produce a Markdown table the attorney can save:

| Bates / Doc ID | Date | From | To (incl. cc) | Subject | State | Privilege basis / Question for attorney |
|---|---|---|---|---|---|---|
| ABC-001234 | 2026-03-15 | Counsel | Client | Re: Trust amendment options | obvious-priv | A-C; attorney rendering legal advice on amendment |
| ABC-001235 | 2026-03-16 | CFO | CEO, cc'd outside counsel | Re: Quarterly close | needs-attorney-review | Cc'd attorney — confirm whether the dominant purpose was legal advice or just keeping counsel informed of a business email |
| ABC-001240 | 2026-03-18 | Client | Public agency | Re: Permit application | obvious-not-priv | Third-party communication; no privilege |
| ... | ... | ... | ... | ... | ... | ... |

End with a summary count: `N obvious-priv | N obvious-not-priv | N needs-attorney-review`.

Remind the attorney: **every `needs-attorney-review` flag must be cleared by an attorney before production. None of these are pre-decided.**

## What this skill does NOT do

- **Make close privilege calls.** Three states only; anything in doubt is `needs-attorney-review`.
- **Decide crime-fraud exception.** Always flag for attorney review.
- **Evaluate common-interest or joint-defense.** Always flag — depends on facts and any underlying agreement the skill cannot read.
- **Produce a final log for service.** The output is a draft; the attorney finalizes after reviewing every flag.
- **Apply redactions.** Mixed business-and-legal documents may need entry-level redaction rather than withholding; the skill flags the question, the attorney decides and redacts.
- **Override clawback or 502(d) protections.** If the attorney mistakenly produces something later realized to be privileged, the clawback procedures are a separate workflow.

## California-specific notes

- **Evid. Code §954** — attorney-client privilege is a CLIENT privilege; only the holder waives. Note who the holder is (especially in entity contexts — the corporation, not the executive).
- **Evid. Code §952** — "confidential communication between client and lawyer" includes the lawyer's office staff, translators, and others whose disclosure is reasonably necessary for the transmission. Cc'd paralegal generally doesn't waive; cc'd unrelated third party does.
- **CCP §2018.030(a)** — work product reflecting an attorney's impressions, conclusions, opinions, legal research or theories is **absolutely privileged**. Not subject to discovery under any circumstance.
- **CCP §2018.030(b)** — ordinary work product is **qualifiedly privileged**; produced only upon a showing of undue prejudice and inability to obtain equivalent material elsewhere.
- **Evid. Code §912** — California waiver rules. Inadvertent disclosure does NOT waive privilege if the holder took reasonable steps to prevent and to rectify. F&F's privilege log should anticipate clawback under §912 if anything slips.
- **Evid. Code §1119** — mediation confidentiality is broader and stronger than attorney-client. Any document prepared for mediation, communications during mediation, and mediator statements are inadmissible and not subject to discovery. If reviewing for production in a case where the documents touched a mediation, flag for the §1119 question explicitly.
- **Probate/trust matters:** the attorney-client privilege belongs to the trustee in their fiduciary capacity, not personally. A successor trustee can waive prior trustee's privilege over trust-administration communications under *Wells Fargo Bank v. Superior Court* (2000) 22 Cal.4th 201 — relevant if reviewing a former-trustee's log.
- **Family-law matters:** spousal communications privilege (Evid. Code §980) applies; but communications between spouses about marital wrongdoing are typically not privileged in the dissolution action itself.
