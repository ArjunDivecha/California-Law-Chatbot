---
name: drafting-motion-compel
description: Draft a Motion to Compel Further Discovery Responses under California Code of Civil Procedure §§ 2030.300 (interrogatories), 2031.310 (RFPDs), or 2033.290 (RFAs). Loaded when /api/agent/draft-stream is called with template_id="motion_compel". Produces all 10 sections — caption, notice of motion, memorandum of points and authorities (introduction, statement of facts, argument with elements analysis, prayer), declaration in support, and separate statement reference.
user-invocable: false
---

## V2 drafting context (read first)

You are drafting a **Motion to Compel Further Discovery Responses** for filing in a California Superior Court. This is litigation work-product, filed with the court, served on opposing counsel, and reviewed by the discovery referee or judicial officer. Every sentence will be scrutinized. Procedural defects sink motions — be precise.

The motion is governed by:
- **Interrogatories:** Cal. Code Civ. Proc. § 2030.300 (45-day deadline; separate statement required under CRC 3.1345)
- **Requests for Production of Documents:** Cal. Code Civ. Proc. § 2031.310 (same)
- **Requests for Admissions:** Cal. Code Civ. Proc. § 2033.290 (same)
- **Form Interrogatories:** Cal. Code Civ. Proc. § 2030.300 (same path)
- **Depositions:** Cal. Code Civ. Proc. § 2025.480 (60-day deadline; no separate statement)

You will receive the variables and free-text instructions in the first user message:

```
TEMPLATE: motion_compel
VARIABLES:
  court_name, case_number, plaintiff, defendant, moving_party, responding_party,
  attorney_name, firm_name, bar_number, discovery_type (Form Interrogatories |
    Special Interrogatories | Request for Production of Documents | Request for
    Admissions | Deposition Questions),
  discovery_set_number, hearing_date, hearing_time, hearing_department,
  meet_confer_attempts, deficient_response_examples
USER INSTRUCTIONS: <description of deficient responses, meet-and-confer history,
  specific objections being challenged>
OPTIONS: as for legal_memo
```

Emit the motion in Markdown. Each section's heading MUST be the literal string `## SECTION: <id>` with `<id>` exactly as specified below — NO abbreviation, NO variation. The client parses section boundaries by exact-string match. (`mpa_argument`, not `argument`. `notice_of_motion`, not `notice`.) Produce all 10 sections — do not omit any, even when the section is short or boilerplate.

## Section structure (produce in this exact order)

### 1. Caption (`## SECTION: caption`)
Render the standard California state-court caption verbatim:

```
{{attorney_name}} (SBN {{bar_number}})
{{firm_name}}
[firm address]

Attorneys for {{moving_party}}

SUPERIOR COURT OF THE STATE OF CALIFORNIA

{{court_name}}

{{plaintiff}},
                                  Plaintiff,
       vs.                                              Case No. {{case_number}}
{{defendant}},
                                  Defendant.

NOTICE OF MOTION AND MOTION TO COMPEL FURTHER RESPONSES TO {{discovery_type}}, SET {{discovery_set_number}}; MEMORANDUM OF POINTS AND AUTHORITIES; DECLARATION OF {{attorney_name}}; SEPARATE STATEMENT

Date: {{hearing_date}}
Time: {{hearing_time}}
Dept: {{hearing_department}}
```

### 2. Notice of Motion (`## SECTION: notice_of_motion`)
Target ≤150 words. Standard opening: "TO ALL PARTIES AND THEIR ATTORNEYS OF RECORD: PLEASE TAKE NOTICE that on {{hearing_date}} at {{hearing_time}}, in Department {{hearing_department}} of the above-entitled Court, {{moving_party}} will and hereby does move this Court for an order compelling {{responding_party}} to provide further responses to {{discovery_type}}, Set {{discovery_set_number}}, pursuant to [Code Civ. Proc., § 2030.300 / § 2031.310 / § 2033.290 — pick the right one for the {{discovery_type}}]."

State the relief sought: further responses without objection (other than privilege), sanctions in a specified amount, and any other relief the Court deems just.

### 3. Memorandum: Introduction (`## SECTION: mpa_introduction`)
Target ≤200 words. State the dispute in one paragraph. Identify the specific requests at issue (e.g., "Special Interrogatories Nos. 3, 7, 12, and 18"). State what the responses lack (boilerplate objections, evasive answers, refusal to produce). State the meet-and-confer effort under § 2016.040 (date, mode, outcome).

### 4. Memorandum: Statement of Facts (`## SECTION: mpa_facts`)
Target ≤400 words. Procedural history of the discovery dispute:
- Date discovery was served
- Date responses were due
- Date responses were received (if any) — note any extensions in writing
- Specific defects (objections without merit; non-responsive answers; failure to verify; failure to identify documents under § 2031.230 or § 2031.280)
- Meet-and-confer correspondence — date, mode (letter / call / email), what was requested, what was rejected
- Why the dispute could not be resolved without court intervention

### 5. Memorandum: Argument (`## SECTION: mpa_argument`)
Target ≤1500 words. Organize by `###` subsection per legal point:

**A. The Motion Is Timely.** Cite the 45-day deadline (or 60-day for depositions) from the relevant statute. Compute from the date of service of the verified responses (not the date of receipt). Note any written extension agreement.

**B. Good Cause Standard / Burden Shift.** For RFPDs, cite § 2031.310(b)(1) — moving party must show good cause for the discovery sought. For interrogatories, the burden is on the responding party to justify objections (§ 2030.300(a)). Cite the case law:
- *Coy v. Superior Court* (1962) 58 Cal.2d 210 (purpose of discovery)
- *Williams v. Superior Court* (2017) 3 Cal.5th 531 (privacy balancing; relevance threshold)
- *Stewart v. Colonial Western Agency, Inc.* (2001) 87 Cal.App.4th 1006 (objection waiver; specificity)

**C. The Specific Objections Are Without Merit.** Address EACH objection class actually raised by the responding party. Common objections and counters:
- **Vague and ambiguous** — counter with the request as a reasonable reader would read it; cite *Cembrook v. Superior Court* (1961) 56 Cal.2d 423
- **Overly broad / unduly burdensome** — opposing party must articulate specific burden; cite *West Pico Furniture Co. v. Superior Court* (1961) 56 Cal.2d 407
- **Privilege** — opposing party bears the burden of establishing each element; cite Evid. Code § 917 and *Costco Wholesale Corp. v. Superior Court* (2009) 47 Cal.4th 725
- **Privacy** — apply the *Williams v. Superior Court* balancing framework
- **Trade secret** — opposing party must designate under Evid. Code § 1060 and identify with reasonable particularity; cite *Bridgestone/Firestone, Inc. v. Superior Court* (1992) 7 Cal.App.4th 1384

**D. Sanctions Are Warranted.** Cite § 2023.030 (range of sanctions) and the specific statute's sanctions clause (e.g., § 2030.300(d) for interrogatories). Calculate the requested sanctions amount from declared attorney time at the moving counsel's regular hourly rate. The court "shall impose" monetary sanctions unless it finds the losing party acted with substantial justification — flag this language.

### 6. Memorandum: Prayer / Conclusion (`## SECTION: mpa_prayer`)
Target ≤150 words. State the specific relief requested:
1. Order compelling further responses without objection (except privilege) within a specified number of days
2. Monetary sanctions in the amount of $___ against {{responding_party}} and counsel jointly and severally
3. Such other relief as the Court deems just

### 7. Declaration in Support (`## SECTION: declaration`)
Target ≤500 words. Standard form: "I, {{attorney_name}}, declare as follows:" — then numbered factual paragraphs that lay foundation for the procedural facts in the Statement of Facts. Cover:
- Bar admission and role in the case
- Service of the discovery at issue (with date and method)
- Receipt of the responses at issue (with date and method)
- Meet-and-confer correspondence (attach as exhibits A, B, C — describe each)
- Attorney time spent on the motion, at moving counsel's regular hourly rate

End with the penalty-of-perjury statement: "I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct. Executed on [date] at [city], California."

### 8. Separate Statement Reference (`## SECTION: separate_statement`)
Required for non-deposition motions under CRC 3.1345. The separate statement is itself a separate document filed alongside the motion; do not generate it inline. Generate a placeholder reference:

```
[The Separate Statement of Items in Dispute, filed concurrently herewith, is incorporated by reference. See California Rules of Court, rule 3.1345.]
```

### 9. Proof of Service Reference (`## SECTION: pos_reference`)
```
[Proof of Service is filed concurrently herewith.]
```

### 10. Signature Block (`## SECTION: signature`)
Render verbatim:

```
DATED: {{date}}

                                              {{firm_name}}


                                              By: ______________________________
                                                  {{attorney_name}}
                                                  Attorneys for {{moving_party}}
```

## Citation discipline (especially strict for filings)

- Every case citation is verified via `courtlistener_search` AND `citation_verify`. Filing an unverified citation in a court paper is a sanctionable Rule 3.3 violation.
- California citation style only (not Bluebook) for California authorities. Federal authorities (rare in a state-court motion) use Bluebook.
- Parallel citations are not required by CRC for state-court filings but are good practice for Supreme Court and Court of Appeal cases.

## What this skill does NOT do

- Does NOT generate the actual Separate Statement (different document, different format under CRC 3.1345 — flagged as a follow-up to the attorney).
- Does NOT generate the Proof of Service (handled by the firm's service workflow).
- Does NOT assess whether the motion is winnable — the model drafts the motion the attorney has decided to file. Strategic decisions are the attorney's call.
- Does NOT decide whether to seek terminating, issue, or evidence sanctions — those are usually escalation paths after a successful motion to compel, not part of the first motion.

## Caveat discipline

The reader is a licensed attorney. No generic disclaimers anywhere in the output ("this is not legal advice", "consult an attorney", "for informational purposes") — the AI-use notice lives in the application chrome, never in the document. A caveat earns its place only when it changes what the attorney should do next (an unresolved ambiguity, a jurisdiction-specific trap, an unverifiable fact); state it once, where it applies, not as scattered hedge sentences. Do not compress sections unless asked.
