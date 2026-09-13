# Review packet — `longcontext-006`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `longcontext-006` |
| category | long_context |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `dfde416503e8c8ec8fb142dd49ae799451f34b7a8de947791727fbd941004acd` |
| proposition_hashes | 5 — `0daeefd7a631`, `24ccbefa8b39`, `43fd9788cb83`, `9ee691244382`, `cc11fb397fb3` |
| source_hashes | 1 — `c32e4a3242ed` |

## 2. Prompt (what the model is asked)

```text
Long-context California premarital-agreement enforceability problem (all parties, documents, and facts synthetic). A roughly 50,000-word consolidated litigation file is embedded in the graded turn, with the operative facts buried inside a 14,000-word correspondence section at roughly 20, 63, and 79 percent of that section. The buried facts: Draft Version 3 was circulated August 2, 2023 and expressly labelled not final, with two articles still open; the FINAL EXECUTION VERSION was transmitted September 12, 2023 at 4:47 p.m. with substantive changes to Articles 7 and 11 (so the nonsubstantive-amendment carve-out does not apply) and with the written advisement to retain independent counsel given the same day; the agreement was signed September 18, 2023, six calendar days later; the respondent was unrepresented throughout, signed no separate writing waiving representation by independent legal counsel, and received no writing memorializing the rights and obligations he was relinquishing; and the parties married October 7, 2023. The graded answer must apply Family Code section 1615(c)(2)(B) for agreements executed on or after January 1, 2020, section 1615(c)(1), section 1615(c)(3), and section 1615(a)(1).
```

## 3. Material criteria and their propositions

### C1. `longcontext-006-c1`

**Criterion:** Retrieves the buried transmittal and notary entries and states that Respondent was first presented with the final agreement on September 12, 2023 and signed on September 18, 2023, an interval of six calendar days, which is less than the seven calendar days section 1615(c)(2)(B) requires for an agreement executed on or after January 1, 2020, regardless of whether the party is represented by counsel.

#### Proposition `longcontext-006-p1`

> For a premarital agreement executed on or after January 1, 2020, the party against whom enforcement is sought must have had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of representation; the requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement.

**Verbatim authoritative excerpt relied on:**

```text
For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement.
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

### C2. `longcontext-006-c2`

**Criterion:** Explains that the August 2, 2023 circulation of Draft Version 3 does not start the seven-day clock because that draft was not the final agreement and the changes made to Articles 7 and 11 were substantive, so the statutory carve-out for nonsubstantive amendments that do not change the terms of the agreement does not apply.

#### Proposition `longcontext-006-p1`

> For a premarital agreement executed on or after January 1, 2020, the party against whom enforcement is sought must have had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of representation; the requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement.

**Verbatim authoritative excerpt relied on:**

```text
For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement.
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

### C3. `longcontext-006-c3`

**Criterion:** Applies section 1615(c)(1) to the buried facts: Respondent was not represented by independent legal counsel at signing and signed no separate writing expressly waiving that representation, and in any event the September 12, 2023 advisement was not made at least seven calendar days before the final agreement was signed.

#### Proposition `longcontext-006-p2`

> Voluntary execution requires that the party against whom enforcement is sought was represented by independent legal counsel at the time of signing or, after being advised to seek independent legal counsel, expressly waived that representation in a separate writing, and the advisement shall be made at least seven calendar days before the final agreement is signed.

**Verbatim authoritative excerpt relied on:**

```text
The party against whom enforcement is sought was represented by independent legal counsel at the time of signing the agreement or, after being advised to seek independent legal counsel, expressly waived, in a separate writing, representation by independent legal counsel. The advisement to seek independent legal counsel shall be made at least seven calendar days before the final agreement is signed.
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

### C4. `longcontext-006-c4`

**Criterion:** Applies section 1615(c)(3) to the buried fact that no writing memorializing the rights and obligations relinquished was delivered to the unrepresented Respondent before signing.

#### Proposition `longcontext-006-p3`

> An unrepresented party must have been fully informed of the terms and basic effect of the agreement and of the rights and obligations being given up, and the explanation of the rights and obligations relinquished shall be memorialized in writing and delivered to the party prior to signing the agreement.

**Verbatim authoritative excerpt relied on:**

```text
The party against whom enforcement is sought, if unrepresented by legal counsel, was fully informed of the terms and basic effect of the agreement as well as the rights and obligations the party was giving up by signing the agreement, and was proficient in the language in which the explanation of the party’s rights was conducted and in which the agreement was written. The explanation of the rights and obligations relinquished shall be memorialized in writing and delivered to the party prior to signing the agreement.
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

### C5. `longcontext-006-c5`

**Criterion:** Concludes that because the court cannot find all of the section 1615(c) requirements, the agreement is deemed not to have been executed voluntarily, and that a premarital agreement is not enforceable if the party against whom enforcement is sought proves that the party did not execute it voluntarily.

#### Proposition `longcontext-006-p4`

> A premarital agreement is deemed not to have been executed voluntarily unless the court finds in writing or on the record all of the enumerated requirements of section 1615(c).

**Verbatim authoritative excerpt relied on:**

```text
For the purposes of subdivision (a), it shall be deemed that a premarital agreement was not executed voluntarily unless the court finds in writing or on the record all of the following:
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

#### Proposition `longcontext-006-p5`

> A premarital agreement is not enforceable if the party against whom enforcement is sought proves that the party did not execute the agreement voluntarily.

**Verbatim authoritative excerpt relied on:**

```text
A premarital agreement is not enforceable if the party against whom enforcement is sought proves either of the following: (1) That party did not execute the agreement voluntarily.
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
| `longcontext-006-a1` | contains | September 12, 2023 | — |
| `longcontext-006-a2` | statute | 1615 | — |
| `longcontext-006-a3` | contains | seven calendar days | WRONG_EFFECTIVE_DATE |
| `longcontext-006-a4` | not_contains | first presented with the final agreement on August 2, 2023 | MATERIAL_FACT_INVENTION |

## 5. Your decision

```
task_id:      longcontext-006
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
  --task longcontext-006 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
