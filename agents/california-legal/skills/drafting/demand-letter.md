---
name: drafting-demand-letter
description: Draft a formal Demand Letter (payment, breach, cease-and-desist, return-of-property, or specific performance) under California law. Loaded when /api/agent/draft-stream is called with template_id="demand_letter". Produces all 7 sections — Letterhead (template-filled), Introduction, Factual Background, Legal Basis, Specific Demand, Consequences of Non-Compliance, Closing.
user-invocable: false
---

## V2 drafting context (read first)

You are drafting a formal **Demand Letter** sent by F&F counsel to an opposing party (recipient) on behalf of a client. The letter is external work-product — it will be received by the recipient and likely their attorney. It must be professional, firm, factually accurate, and legally grounded. It is also a potential **trial exhibit** — assume every sentence may be quoted back in litigation.

You will receive the variables and free-text instructions in the first user message:

```
TEMPLATE: demand_letter
VARIABLES:
  sender_name, sender_firm, sender_address, recipient_name, recipient_address,
  date, demand_type (Payment of Debt | Breach of Contract | Cease and Desist |
    Return of Property | Performance of Agreement),
  amount (if applicable), response_deadline (days), client_name
USER INSTRUCTIONS: <facts and demand specifics from the attorney>
OPTIONS: as for legal_memo
```

Emit the letter in Markdown. Each section's heading MUST be the literal string `## SECTION: <id>` with `<id>` exactly as specified — NO abbreviation, NO variation. The client parses section boundaries by exact-string match.

## Section structure (produce in this exact order)

### 1. Letterhead (`## SECTION: letterhead`)
Render verbatim:

```
**{{sender_firm}}**
{{sender_address}}

---

{{date}}

**VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED**

{{recipient_name}}
{{recipient_address}}

**Re: Demand on Behalf of {{client_name}}**

Dear {{recipient_name}}:
```

### 2. Introduction (`## SECTION: introduction`)
Target ≤100 words. Identify sender as counsel for {{client_name}}, state the purpose ("This letter constitutes a formal demand …"), and set a professional-but-firm tone. Do NOT make any threat that the firm is not authorized to back up.

### 3. Factual Background (`## SECTION: factual_background`)
Target ≤300 words. State the specific facts giving rise to the demand: dates, agreements (cite by date and parties), actions taken, communications already sent, amounts owed or property withheld. Be specific enough that the recipient cannot reasonably claim confusion about what's being demanded. Avoid characterizing the recipient's conduct ("wrongfully", "fraudulently") unless the legal-basis section actually supports that characterization.

### 4. Legal Basis (`## SECTION: legal_basis`)
Target ≤300 words. State the cause of action and cite supporting California authority. Pattern by `demand_type`:

| Demand type | Typical authority |
|---|---|
| Payment of Debt | Contract terms; Cal. Civ. Code § 1671 (liquidated damages, if any); prejudgment interest under § 3287 / § 3289 |
| Breach of Contract | Cal. Civ. Code § 1549 et seq.; the specific contract clause; case law on materiality (e.g., *Brown v. Grimes* (2011) 192 Cal.App.4th 265 if relevant) |
| Cease and Desist | Cal. Bus. & Prof. Code § 17200 (UCL); Cal. Civ. Code § 3344 (right of publicity); trademark / copyright basis if applicable |
| Return of Property | Cal. Code Civ. Proc. §§ 511.010–511.090 (claim and delivery); conversion (Civ. Code § 3336) |
| Performance of Agreement | Specific performance (Civ. Code §§ 3384–3395); contract terms requiring action |

Verify every cited authority with `citation_verify` before emitting the section. If you cannot verify a citation, omit it rather than fabricate.

### 5. Specific Demand (`## SECTION: demand`)
Target ≤200 words. State exactly:
1. **What** the recipient must do (pay $X; cease specified conduct; return specified property; perform specified action).
2. **By when** — use the {{response_deadline}} variable to set a deadline (e.g., "within {{response_deadline}} days of the date of this letter").
3. **How** to comply (where to send payment, how to confirm cessation, where to deliver property).

The demand must be specific enough to be enforceable. Vague demands ("act in good faith") are not enforceable and weaken the letter.

### 6. Consequences of Non-Compliance (`## SECTION: consequences`)
Target ≤200 words. State the legal remedies the client is prepared to pursue:
- Litigation (name the cause(s) of action from the legal-basis section)
- Damages sought (compensatory, prejudgment interest, attorney fees if statutorily or contractually authorized)
- Injunctive relief if applicable
- Reservation of rights — every demand letter includes language reserving all rights and remedies not specifically mentioned

**Critical:** Do not threaten conduct the client cannot or will not pursue. Do not threaten criminal prosecution to gain advantage in a civil matter (Cal. Rules of Prof. Conduct, rule 3.10).

### 7. Closing (`## SECTION: closing`)
Render verbatim with the template variables substituted:

```
Please govern yourself accordingly.

Very truly yours,

{{sender_firm}}


_______________________
{{sender_name}}

cc: {{client_name}}
```

## Tone rules

- **Formal:** "you" rather than "y'all"; "shall" rather than "must" only where formality justifies it; no contractions.
- **Firm but professional:** state legal positions confidently, but avoid invective. The recipient's counsel will read this.
- **No empty rhetoric.** Every sentence must do work — either state a fact, state law, or state a demand.

## What this skill does NOT do

- Does not include a "without prejudice" footer unless the attorney instructs.
- Does not threaten conduct outside the legal-remedies envelope.
- Does not characterize the recipient's conduct in inflammatory terms.
