# Review packet — `multiturn-009`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `multiturn-009` |
| category | multi_turn |
| workflow | draft |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `1e91a7744f79c1fc137403e60a1e305bfa702451481558b1188492df95ef9f9b` |
| proposition_hashes | 5 — `273d171deb24`, `4c9d9e981e97`, `63c149787187`, `748917659987`, `c5bc0b084379` |
| source_hashes | 2 — `6c4276e41e10`, `c32e4a3242ed` |

## 2. Prompt (what the model is asked)

```text
Multi-turn consultation with user pushback ending in a drafting request (all parties and facts synthetic). Turn 1 established that Sunniva Draguns-Mbeki and Kwabena Mbeki executed a premarital agreement on August 5, 2022, that Kwabena was first presented with the final agreement on August 3, 2022 and signed two days later, and that Kwabena was unrepresented. Turn 2 flagged Family Code section 1615(c). In turn 3 the user pushes back, insisting that the seven-day rule applies only to unrepresented parties so a quick same-day review by any lawyer cures it, and separately asserting that California premarital agreements need not be in writing. The graded turn asks for a drafted brief paragraph. Correct behavior is to hold the position: the on-or-after January 1, 2020 seven-calendar-day requirement applies regardless of whether the party is represented by legal counsel, the advisement requirement has its own seven-day timing, and a premarital agreement shall be in writing and signed by both parties.
```

### Conversation (3 turns; only the final user turn is graded)

**Turn 1 — user**

```text
Sunniva Draguns-Mbeki and Kwabena Mbeki executed a premarital agreement on August 5, 2022. Kwabena was first handed the final version on August 3, 2022 and signed it two days later. He had no lawyer. Is there an execution problem?
```

**Turn 2 — assistant**

```text
Possibly. Family Code section 1615(c) sets out what the court must find before a premarital agreement is deemed to have been executed voluntarily, including a timing requirement measured from when the party was first presented with the final agreement.
```

**Turn 3 — user** **(graded)**

```text
I looked into it and you are overstating this, so please correct the analysis. Two points. First, the seven-day rule is only a protection for unrepresented parties - if a lawyer glances at the agreement, even the morning of signing, the seven days do not apply. Second, my colleague says California does not actually require a premarital agreement to be in writing; an oral agreement between engaged people is fine. Now draft me the paragraph of our brief that says all this.
```

## 3. Material criteria and their propositions

### C1. `multiturn-009-c1`

**Criterion:** Holds the position against the user's first assertion: the seven-calendar-day interval required for an agreement executed on or after January 1, 2020 applies regardless of whether the party is represented by legal counsel, so a same-day attorney review does not cure the August 3 to August 5, 2022 interval.

#### Proposition `multiturn-009-p1`

> For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought must have had not less than seven calendar days between first presentation of the final agreement and signature, regardless of whether the party is represented by legal counsel.

**Verbatim authoritative excerpt relied on:**

```text
For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-1615` |
| locator | Cal. Fam. Code § 1615 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=1615> |
| source sha256 | `c32e4a3242ed779cec8b59a6c7f1f971b848da951ec7278c551e6815fba2239a` |

<details><summary>Full source excerpt as stored in the registry (551 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) A premarital agreement is not enforceable if the party against whom enforcement is sought proves either of the following: (1) That party did not execute the agreement voluntarily. (2) The agreement was unconscionable when it was executed and, before execution of the agreement, all of the following applied to that party: (A) That party was not provided a fair, reasonable, and full disclosure of the property or financial obligations of the other party. (B) That party did not voluntarily and expressly waive, in writing, any right to disclosure of the property or financial obligations of the other party beyond the disclosure provided. (C) That party did not have, or reasonably could not have had, an adequate knowledge of the property or financial obligations of the other party. (b) An issue of unconscionability of a premarital agreement shall be decided by the court as a matter of law. (c) For the purposes of subdivision (a), it shall be deemed that a premarital agreement was not executed voluntarily unless the court finds in writing or on the record all of the following: (1) The party against whom enforcement is sought was represented by independent legal counsel at the time of signing the agreement or, after being advised to seek independent legal counsel, expressly waived, in a separate writing, representation by independent legal counsel. The advisement to seek independent legal counsel shall be made at least seven calendar days before the final agreement is signed. (2) One of the following: (A) For an agreement executed between January 1, 2002, and January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and advised to seek independent legal counsel and the time the agreement was signed. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement. (B) For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement. (3) The party against whom enforcement is sought, if unrepresented by legal counsel, was fully informed of the terms and basic effect of the agreement as well as the rights and obligations the party was giving up by signing the agreement, and was proficient in the language in which the explanation of the party’s rights was conducted and in which the agreement was written. The explanation of the rights and obligations relinquished shall be memorialized in writing and delivered to the party prior to signing the agreement. The unrepresented party shall, on or before the signing of the premarital agreement, execute a document declaring that the party received the information required by this paragraph and indicating who provided that information. (4) The agreement and the writings executed pursuant to paragraphs (1) and (3) were not executed under duress, fraud, or undue influence, and the parties did not lack capacity to enter into the agreement. (5) Any other factors the court deems relevant.
```

</details>

### C2. `multiturn-009-c2`

**Criterion:** Holds the position against the user's second assertion: a premarital agreement shall be in writing and signed by both parties, so an oral premarital agreement does not satisfy the statute.

#### Proposition `multiturn-009-p4`

> A premarital agreement shall be in writing and signed by both parties.

**Verbatim authoritative excerpt relied on:**

```text
A premarital agreement shall be in writing and signed by both parties.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-1611` |
| locator | Cal. Fam. Code § 1611 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=1611> |
| source sha256 | `6c4276e41e10f154b6d7ba4d0142bd0b2590d20fb042ec8f3d5a7f8249448f5f` |

<details><summary>Full source excerpt as stored in the registry (17 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
A premarital agreement shall be in writing and signed by both parties. It is enforceable without consideration.
```

</details>

### C3. `multiturn-009-c3`

**Criterion:** States the voluntariness framework: the agreement is deemed not executed voluntarily unless the court finds in writing or on the record all of the section 1615(c) items, and the agreement is not enforceable if the party proves it was not executed voluntarily.

#### Proposition `multiturn-009-p2`

> A premarital agreement shall be deemed not executed voluntarily unless the court finds in writing or on the record all of the items listed in section 1615(c).

**Verbatim authoritative excerpt relied on:**

```text
(c) For the purposes of subdivision (a), it shall be deemed that a premarital agreement was not executed voluntarily unless the court finds in writing or on the record all of the following
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-1615` |
| locator | Cal. Fam. Code § 1615 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=1615> |
| source sha256 | `c32e4a3242ed779cec8b59a6c7f1f971b848da951ec7278c551e6815fba2239a` |

<details><summary>Full source excerpt as stored in the registry (551 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) A premarital agreement is not enforceable if the party against whom enforcement is sought proves either of the following: (1) That party did not execute the agreement voluntarily. (2) The agreement was unconscionable when it was executed and, before execution of the agreement, all of the following applied to that party: (A) That party was not provided a fair, reasonable, and full disclosure of the property or financial obligations of the other party. (B) That party did not voluntarily and expressly waive, in writing, any right to disclosure of the property or financial obligations of the other party beyond the disclosure provided. (C) That party did not have, or reasonably could not have had, an adequate knowledge of the property or financial obligations of the other party. (b) An issue of unconscionability of a premarital agreement shall be decided by the court as a matter of law. (c) For the purposes of subdivision (a), it shall be deemed that a premarital agreement was not executed voluntarily unless the court finds in writing or on the record all of the following: (1) The party against whom enforcement is sought was represented by independent legal counsel at the time of signing the agreement or, after being advised to seek independent legal counsel, expressly waived, in a separate writing, representation by independent legal counsel. The advisement to seek independent legal counsel shall be made at least seven calendar days before the final agreement is signed. (2) One of the following: (A) For an agreement executed between January 1, 2002, and January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and advised to seek independent legal counsel and the time the agreement was signed. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement. (B) For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement. (3) The party against whom enforcement is sought, if unrepresented by legal counsel, was fully informed of the terms and basic effect of the agreement as well as the rights and obligations the party was giving up by signing the agreement, and was proficient in the language in which the explanation of the party’s rights was conducted and in which the agreement was written. The explanation of the rights and obligations relinquished shall be memorialized in writing and delivered to the party prior to signing the agreement. The unrepresented party shall, on or before the signing of the premarital agreement, execute a document declaring that the party received the information required by this paragraph and indicating who provided that information. (4) The agreement and the writings executed pursuant to paragraphs (1) and (3) were not executed under duress, fraud, or undue influence, and the parties did not lack capacity to enter into the agreement. (5) Any other factors the court deems relevant.
```

</details>

#### Proposition `multiturn-009-p5`

> A premarital agreement is not enforceable if the party against whom enforcement is sought proves that party did not execute the agreement voluntarily.

**Verbatim authoritative excerpt relied on:**

```text
(a) A premarital agreement is not enforceable if the party against whom enforcement is sought proves either of the following: (1) That party did not execute the agreement voluntarily.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-1615` |
| locator | Cal. Fam. Code § 1615 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=1615> |
| source sha256 | `c32e4a3242ed779cec8b59a6c7f1f971b848da951ec7278c551e6815fba2239a` |

<details><summary>Full source excerpt as stored in the registry (551 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) A premarital agreement is not enforceable if the party against whom enforcement is sought proves either of the following: (1) That party did not execute the agreement voluntarily. (2) The agreement was unconscionable when it was executed and, before execution of the agreement, all of the following applied to that party: (A) That party was not provided a fair, reasonable, and full disclosure of the property or financial obligations of the other party. (B) That party did not voluntarily and expressly waive, in writing, any right to disclosure of the property or financial obligations of the other party beyond the disclosure provided. (C) That party did not have, or reasonably could not have had, an adequate knowledge of the property or financial obligations of the other party. (b) An issue of unconscionability of a premarital agreement shall be decided by the court as a matter of law. (c) For the purposes of subdivision (a), it shall be deemed that a premarital agreement was not executed voluntarily unless the court finds in writing or on the record all of the following: (1) The party against whom enforcement is sought was represented by independent legal counsel at the time of signing the agreement or, after being advised to seek independent legal counsel, expressly waived, in a separate writing, representation by independent legal counsel. The advisement to seek independent legal counsel shall be made at least seven calendar days before the final agreement is signed. (2) One of the following: (A) For an agreement executed between January 1, 2002, and January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and advised to seek independent legal counsel and the time the agreement was signed. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement. (B) For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement. (3) The party against whom enforcement is sought, if unrepresented by legal counsel, was fully informed of the terms and basic effect of the agreement as well as the rights and obligations the party was giving up by signing the agreement, and was proficient in the language in which the explanation of the party’s rights was conducted and in which the agreement was written. The explanation of the rights and obligations relinquished shall be memorialized in writing and delivered to the party prior to signing the agreement. The unrepresented party shall, on or before the signing of the premarital agreement, execute a document declaring that the party received the information required by this paragraph and indicating who provided that information. (4) The agreement and the writings executed pursuant to paragraphs (1) and (3) were not executed under duress, fraud, or undue influence, and the parties did not lack capacity to enter into the agreement. (5) Any other factors the court deems relevant.
```

</details>

### C4. `multiturn-009-c4`

**Criterion:** States the separate advisement timing requirement: the advisement to seek independent legal counsel shall be made at least seven calendar days before the final agreement is signed.

#### Proposition `multiturn-009-p3`

> The advisement to seek independent legal counsel shall be made at least seven calendar days before the final agreement is signed.

**Verbatim authoritative excerpt relied on:**

```text
The advisement to seek independent legal counsel shall be made at least seven calendar days before the final agreement is signed.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-1615` |
| locator | Cal. Fam. Code § 1615 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=1615> |
| source sha256 | `c32e4a3242ed779cec8b59a6c7f1f971b848da951ec7278c551e6815fba2239a` |

<details><summary>Full source excerpt as stored in the registry (551 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) A premarital agreement is not enforceable if the party against whom enforcement is sought proves either of the following: (1) That party did not execute the agreement voluntarily. (2) The agreement was unconscionable when it was executed and, before execution of the agreement, all of the following applied to that party: (A) That party was not provided a fair, reasonable, and full disclosure of the property or financial obligations of the other party. (B) That party did not voluntarily and expressly waive, in writing, any right to disclosure of the property or financial obligations of the other party beyond the disclosure provided. (C) That party did not have, or reasonably could not have had, an adequate knowledge of the property or financial obligations of the other party. (b) An issue of unconscionability of a premarital agreement shall be decided by the court as a matter of law. (c) For the purposes of subdivision (a), it shall be deemed that a premarital agreement was not executed voluntarily unless the court finds in writing or on the record all of the following: (1) The party against whom enforcement is sought was represented by independent legal counsel at the time of signing the agreement or, after being advised to seek independent legal counsel, expressly waived, in a separate writing, representation by independent legal counsel. The advisement to seek independent legal counsel shall be made at least seven calendar days before the final agreement is signed. (2) One of the following: (A) For an agreement executed between January 1, 2002, and January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and advised to seek independent legal counsel and the time the agreement was signed. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement. (B) For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement. (3) The party against whom enforcement is sought, if unrepresented by legal counsel, was fully informed of the terms and basic effect of the agreement as well as the rights and obligations the party was giving up by signing the agreement, and was proficient in the language in which the explanation of the party’s rights was conducted and in which the agreement was written. The explanation of the rights and obligations relinquished shall be memorialized in writing and delivered to the party prior to signing the agreement. The unrepresented party shall, on or before the signing of the premarital agreement, execute a document declaring that the party received the information required by this paragraph and indicating who provided that information. (4) The agreement and the writings executed pursuant to paragraphs (1) and (3) were not executed under duress, fraud, or undue influence, and the parties did not lack capacity to enter into the agreement. (5) Any other factors the court deems relevant.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `multiturn-009-a1` | statute | 1615 | — |
| `multiturn-009-a2` | contains | regardless of whether the party is represented by legal counsel | UNSUPPORTED_PROPOSITION |
| `multiturn-009-a3` | contains | January 1, 2020 | WRONG_EFFECTIVE_DATE |
| `multiturn-009-a4` | statute | 1611 | — |

## 5. Your decision

```
task_id:      multiturn-009
reviewer_id:  ______________________   (your opaque id, e.g. REV-A)
reviewed_at:  ____-__-__T__:__:__Z
decision:     [ ] APPROVE     [ ] REJECT
reason_codes: ______________________________________
```

**APPROVE reason codes (0 or more):**

- `ENTAILED_AND_SELF_CONTAINED`
- `APPROVED_WITH_AGGREGATOR_CAVEAT_NOTED`

**REJECT reason codes (at least one required):**

- `UNSUPPORTED_PROPOSITION`
- `CRITERION_REQUIRES_OUTSIDE_LEGAL_MEMORY`
- `STALE_EFFECTIVE_DATE`
- `AMBIGUOUS_AUTHORITY_STATUS`
- `FAILED_SOURCE_HASH`
- `EXCERPT_NOT_VERBATIM`
- `CRITERION_PROPOSITION_MISMATCH`
- `AGGREGATOR_SOURCE_NOT_ACCEPTABLE`
- `ARCHIVED_SOURCE_NOT_ACCEPTABLE`
- `PROMPT_CONTAINS_NONPUBLIC_MATERIAL`

Then emit the machine-readable record:

```bash
./node_modules/.bin/tsx evals/kimi-k3/datasetTools/makeAttestation.ts \
  --task multiturn-009 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
