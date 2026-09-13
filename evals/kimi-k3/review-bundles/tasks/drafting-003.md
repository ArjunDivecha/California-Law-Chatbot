# Review packet — `drafting-003`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `drafting-003` |
| category | drafting |
| workflow | draft |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `28aabeac7b3c32325f029bc7cd1206d08687d219fdc0f50f7605a20f45d88075` |
| proposition_hashes | 6 — `19aae5dca502`, `591ef7d8b451`, `7f96a0042b54`, `8c91735bff8c`, `93946201059e`, `eccc9f5e550d` |
| source_hashes | 2 — `09b651bbba9c`, `6fe51139415d` |

## 2. Prompt (what the model is asked)

```text
You are assisting a California family-law and LGBTQ practice. All parties, dates, and facts below are synthetic and invented for this exercise. Do not use any tools; draft from the supplied authorities only.

Our client Ignatius Barrow-Whitlock is the support obligor for three children. He nets roughly $1,750 per month, below full-time minimum wage earnings, and pays a court-ordered $310 per month of child support for a child of a different relationship, plus mandatory union dues and a health plan premium. Draft the points and authorities section requesting a low-income adjustment. Explain the presumption and how it can be rebutted, identify the deductions used to reach net disposable income, and explain how the resulting order is allocated among the three children.
```

## 3. Material criteria and their propositions

### C1. `drafting-003-c1`

**Criterion:** States the rebuttable presumption that an obligor whose net disposable income per month is less than the monthly gross income earned from full-time minimum wage (Labor Code section 1182.12, 40 hours per week, 52 weeks per year) is entitled to a low-income adjustment.

#### Proposition `drafting-003-p1`

> In all cases in which the obligor’s net disposable income per month is less than the monthly gross income earned from full-time minimum wage established by Labor Code section 1182.12 at 40 hours per week, 52 weeks per year, there is a rebuttable presumption that the obligor is entitled to a low-income adjustment.

**Verbatim authoritative excerpt relied on:**

```text
In all cases in which the net disposable income per month of the obligor is less than the amount of monthly gross income earned from full-time minimum wage, established by Section 1182.12 of the Labor Code, at 40 hours per week, 52 weeks per year, there is a rebuttable presumption that the obligor is entitled to a low-income adjustment.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4055-D` |
| locator | Cal. Fam. Code § 4055(b)(5)-(d) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | September 1, 2024 (Operative; Effective January 1, 2024) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4055> |
| source sha256 | `09b651bbba9c7dcfaedc93754748af789f44b4669d3db652f36e391c6c126635` |

<details><summary>Full source excerpt as stored in the registry (585 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(5) If the amount calculated under the formula results in a positive number, the higher earner shall pay that amount to the lower earner. If the amount calculated under the formula results in a negative number, the lower earner shall pay the absolute value of that amount to the higher earner. (6) In any default proceeding where proof is by affidavit pursuant to Section 2336, or in any proceeding for child support in which a party fails to appear after being duly noticed, H% shall be set at zero in the formula if the noncustodial parent is the higher earner or at 100 if the custodial parent is the higher earner, where there is no evidence presented demonstrating the percentage of time that the noncustodial parent has primary physical responsibility for the children. H% shall not be set as described in paragraph (3) if the moving party in a default proceeding is the noncustodial parent or if the party who fails to appear after being duly noticed is the custodial parent. A statement by the party who is not in default as to the percentage of time that the noncustodial parent has primary physical responsibility for the children shall be deemed sufficient evidence. (7) In all cases in which the net disposable income per month of the obligor is less than the amount of monthly gross income earned from full-time minimum wage, established by Section 1182.12 of the Labor Code, at 40 hours per week, 52 weeks per year, there is a rebuttable presumption that the obligor is entitled to a low-income adjustment. The presumption may be rebutted by evidence showing that the application of the lowest amount of child support permitted pursuant to this paragraph would be unjust and inappropriate in the particular case. In determining whether the presumption is rebutted, the court shall consider the principles provided in Section 4053, and the impact of the contemplated adjustment on the respective net incomes of the obligor and the obligee. The low-income adjustment shall reduce the child support amount otherwise determined under this section by an amount that is no greater than the amount calculated by multiplying the child support amount otherwise determined under this section by a fraction, the numerator of which is the amount of monthly gross income earned from full-time minimum wage, established by Section 1182.12 of the Labor Code, at 40 hours per week, 52 weeks per year, minus the obligor’s net disposable income per month, and the denominator of which is the amount of monthly gross income earned from full-time minimum wage, established by Section 1182.12 of the Labor Code, at 40 hours per week, 52 weeks per year. (8) Unless the court orders otherwise, the order for child support shall allocate the support amount so that the amount of support for the youngest child is the amount of support for one child, and the amount for the next youngest child is the difference between that amount and the amount for two children, with similar allocations for additional children. However, this paragraph does not apply to cases in which there are different time-sharing arrangements for different children or where the court determines that the allocation would be inappropriate in the particular case. (c) If a court uses a computer to calculate the child support order and the obligor’s income qualifies for a low-income adjustment, the computer program shall provide the range of the adjustment permitted by paragraph (7) of subdivision (b). (d) This section shall be operative September 1, 2024.
```

</details>

### C2. `drafting-003-c2`

**Criterion:** States that the presumption may be rebutted by evidence that the lowest permitted amount would be unjust and inappropriate, and that the court considers the principles of section 4053 and the impact on the respective net incomes of obligor and obligee.

#### Proposition `drafting-003-p2`

> The low-income adjustment presumption may be rebutted by evidence showing that the lowest permitted amount of child support would be unjust and inappropriate in the particular case, and in deciding that question the court shall consider the principles provided in section 4053 and the impact of the adjustment on the respective net incomes of obligor and obligee.

**Verbatim authoritative excerpt relied on:**

```text
The presumption may be rebutted by evidence showing that the application of the lowest amount of child support permitted pursuant to this paragraph would be unjust and inappropriate in the particular case. In determining whether the presumption is rebutted, the court shall consider the principles provided in Section 4053, and the impact of the contemplated adjustment on the respective net incomes of the obligor and the obligee.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4055-D` |
| locator | Cal. Fam. Code § 4055(b)(5)-(d) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | September 1, 2024 (Operative; Effective January 1, 2024) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4055> |
| source sha256 | `09b651bbba9c7dcfaedc93754748af789f44b4669d3db652f36e391c6c126635` |

<details><summary>Full source excerpt as stored in the registry (585 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(5) If the amount calculated under the formula results in a positive number, the higher earner shall pay that amount to the lower earner. If the amount calculated under the formula results in a negative number, the lower earner shall pay the absolute value of that amount to the higher earner. (6) In any default proceeding where proof is by affidavit pursuant to Section 2336, or in any proceeding for child support in which a party fails to appear after being duly noticed, H% shall be set at zero in the formula if the noncustodial parent is the higher earner or at 100 if the custodial parent is the higher earner, where there is no evidence presented demonstrating the percentage of time that the noncustodial parent has primary physical responsibility for the children. H% shall not be set as described in paragraph (3) if the moving party in a default proceeding is the noncustodial parent or if the party who fails to appear after being duly noticed is the custodial parent. A statement by the party who is not in default as to the percentage of time that the noncustodial parent has primary physical responsibility for the children shall be deemed sufficient evidence. (7) In all cases in which the net disposable income per month of the obligor is less than the amount of monthly gross income earned from full-time minimum wage, established by Section 1182.12 of the Labor Code, at 40 hours per week, 52 weeks per year, there is a rebuttable presumption that the obligor is entitled to a low-income adjustment. The presumption may be rebutted by evidence showing that the application of the lowest amount of child support permitted pursuant to this paragraph would be unjust and inappropriate in the particular case. In determining whether the presumption is rebutted, the court shall consider the principles provided in Section 4053, and the impact of the contemplated adjustment on the respective net incomes of the obligor and the obligee. The low-income adjustment shall reduce the child support amount otherwise determined under this section by an amount that is no greater than the amount calculated by multiplying the child support amount otherwise determined under this section by a fraction, the numerator of which is the amount of monthly gross income earned from full-time minimum wage, established by Section 1182.12 of the Labor Code, at 40 hours per week, 52 weeks per year, minus the obligor’s net disposable income per month, and the denominator of which is the amount of monthly gross income earned from full-time minimum wage, established by Section 1182.12 of the Labor Code, at 40 hours per week, 52 weeks per year. (8) Unless the court orders otherwise, the order for child support shall allocate the support amount so that the amount of support for the youngest child is the amount of support for one child, and the amount for the next youngest child is the difference between that amount and the amount for two children, with similar allocations for additional children. However, this paragraph does not apply to cases in which there are different time-sharing arrangements for different children or where the court determines that the allocation would be inappropriate in the particular case. (c) If a court uses a computer to calculate the child support order and the obligor’s income qualifies for a low-income adjustment, the computer program shall provide the range of the adjustment permitted by paragraph (7) of subdivision (b). (d) This section shall be operative September 1, 2024.
```

</details>

### C3. `drafting-003-c3`

**Criterion:** Identifies the statutory deductions from annual gross income used to compute net disposable income, including state and federal income tax liability, FICA, mandatory union dues and retirement required as a condition of employment, and health insurance or health plan premiums.

#### Proposition `drafting-003-p3`

> Annual net disposable income is computed by deducting from the parent’s annual gross income the actual amounts attributable to the listed items, beginning with the state and federal income tax liability resulting from the parties’ taxable income.

**Verbatim authoritative excerpt relied on:**

```text
The annual net disposable income of each parent shall be computed by deducting from the parent’s annual gross income the actual amounts attributable to the following items or other items permitted under this article: (a) The state and federal income tax liability resulting from the parties’ taxable income.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4059` |
| locator | Cal. Fam. Code § 4059(a)-(f) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4059> |
| source sha256 | `6fe51139415d7a97e522571227e0059e6d5a54876f6afc9c217791a25ff4ce5e` |

<details><summary>Full source excerpt as stored in the registry (395 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
The annual net disposable income of each parent shall be computed by deducting from the parent’s annual gross income the actual amounts attributable to the following items or other items permitted under this article: (a) The state and federal income tax liability resulting from the parties’ taxable income. Federal and state income tax deductions shall bear an accurate relationship to the tax status of the parties (that is, single, married, married filing separately, or head of household) and number of dependents. State and federal income taxes shall be those actually payable (not necessarily current withholding) after considering appropriate filing status, all available exclusions, deductions, and credits. Unless the parties stipulate otherwise, the tax effects of spousal support shall not be considered in determining the net disposable income of the parties for determining child support, but shall be considered in determining spousal support consistent with Chapter 3 (commencing with Section 4330) of Part 3. (b) Deductions attributed to the employee’s contribution or the self-employed worker’s contribution pursuant to the Federal Insurance Contributions Act (FICA), or an amount not to exceed that allowed under FICA for persons not subject to FICA, provided that the deducted amount is used to secure retirement or disability benefits for the parent. (c) Deductions for mandatory union dues and retirement benefits, provided that they are required as a condition of employment. (d) Deductions for health insurance or health plan premiums for the parent and for any children the parent has an obligation to support and deductions for state disability insurance premiums. (e) Any child or spousal support actually being paid by the parent pursuant to a court order, to or for the benefit of a person who is not a subject of the order to be established by the court. In the absence of a court order, child support actually being paid, not to exceed the amount established by the guideline, for natural or adopted children of the parent not residing in that parent’s home, who are not the subject of the order to be established by the court, and of whom the parent has a duty of support. Unless the parent proves payment of the support, a deduction shall not be allowed under this subdivision. (f) Job-related expenses, if allowed by the court after consideration of whether the expenses are necessary, the benefit to the employee, and any other relevant facts.
```

</details>

#### Proposition `drafting-003-p4`

> Deductions for mandatory union dues and retirement benefits required as a condition of employment, and for health insurance or health plan premiums for the parent and children the parent has an obligation to support, are deducted in computing net disposable income.

**Verbatim authoritative excerpt relied on:**

```text
Deductions for mandatory union dues and retirement benefits, provided that they are required as a condition of employment. (d) Deductions for health insurance or health plan premiums for the parent and for any children the parent has an obligation to support and deductions for state disability insurance premiums.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4059` |
| locator | Cal. Fam. Code § 4059(a)-(f) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4059> |
| source sha256 | `6fe51139415d7a97e522571227e0059e6d5a54876f6afc9c217791a25ff4ce5e` |

<details><summary>Full source excerpt as stored in the registry (395 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
The annual net disposable income of each parent shall be computed by deducting from the parent’s annual gross income the actual amounts attributable to the following items or other items permitted under this article: (a) The state and federal income tax liability resulting from the parties’ taxable income. Federal and state income tax deductions shall bear an accurate relationship to the tax status of the parties (that is, single, married, married filing separately, or head of household) and number of dependents. State and federal income taxes shall be those actually payable (not necessarily current withholding) after considering appropriate filing status, all available exclusions, deductions, and credits. Unless the parties stipulate otherwise, the tax effects of spousal support shall not be considered in determining the net disposable income of the parties for determining child support, but shall be considered in determining spousal support consistent with Chapter 3 (commencing with Section 4330) of Part 3. (b) Deductions attributed to the employee’s contribution or the self-employed worker’s contribution pursuant to the Federal Insurance Contributions Act (FICA), or an amount not to exceed that allowed under FICA for persons not subject to FICA, provided that the deducted amount is used to secure retirement or disability benefits for the parent. (c) Deductions for mandatory union dues and retirement benefits, provided that they are required as a condition of employment. (d) Deductions for health insurance or health plan premiums for the parent and for any children the parent has an obligation to support and deductions for state disability insurance premiums. (e) Any child or spousal support actually being paid by the parent pursuant to a court order, to or for the benefit of a person who is not a subject of the order to be established by the court. In the absence of a court order, child support actually being paid, not to exceed the amount established by the guideline, for natural or adopted children of the parent not residing in that parent’s home, who are not the subject of the order to be established by the court, and of whom the parent has a duty of support. Unless the parent proves payment of the support, a deduction shall not be allowed under this subdivision. (f) Job-related expenses, if allowed by the court after consideration of whether the expenses are necessary, the benefit to the employee, and any other relevant facts.
```

</details>

### C4. `drafting-003-c4`

**Criterion:** States that child or spousal support actually being paid under a court order for a person who is not a subject of the order being established is deducted in computing net disposable income.

#### Proposition `drafting-003-p5`

> Any child or spousal support actually being paid by the parent pursuant to a court order to or for the benefit of a person who is not a subject of the order to be established by the court is deducted in computing net disposable income.

**Verbatim authoritative excerpt relied on:**

```text
Any child or spousal support actually being paid by the parent pursuant to a court order, to or for the benefit of a person who is not a subject of the order to be established by the court.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4059` |
| locator | Cal. Fam. Code § 4059(a)-(f) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4059> |
| source sha256 | `6fe51139415d7a97e522571227e0059e6d5a54876f6afc9c217791a25ff4ce5e` |

<details><summary>Full source excerpt as stored in the registry (395 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
The annual net disposable income of each parent shall be computed by deducting from the parent’s annual gross income the actual amounts attributable to the following items or other items permitted under this article: (a) The state and federal income tax liability resulting from the parties’ taxable income. Federal and state income tax deductions shall bear an accurate relationship to the tax status of the parties (that is, single, married, married filing separately, or head of household) and number of dependents. State and federal income taxes shall be those actually payable (not necessarily current withholding) after considering appropriate filing status, all available exclusions, deductions, and credits. Unless the parties stipulate otherwise, the tax effects of spousal support shall not be considered in determining the net disposable income of the parties for determining child support, but shall be considered in determining spousal support consistent with Chapter 3 (commencing with Section 4330) of Part 3. (b) Deductions attributed to the employee’s contribution or the self-employed worker’s contribution pursuant to the Federal Insurance Contributions Act (FICA), or an amount not to exceed that allowed under FICA for persons not subject to FICA, provided that the deducted amount is used to secure retirement or disability benefits for the parent. (c) Deductions for mandatory union dues and retirement benefits, provided that they are required as a condition of employment. (d) Deductions for health insurance or health plan premiums for the parent and for any children the parent has an obligation to support and deductions for state disability insurance premiums. (e) Any child or spousal support actually being paid by the parent pursuant to a court order, to or for the benefit of a person who is not a subject of the order to be established by the court. In the absence of a court order, child support actually being paid, not to exceed the amount established by the guideline, for natural or adopted children of the parent not residing in that parent’s home, who are not the subject of the order to be established by the court, and of whom the parent has a duty of support. Unless the parent proves payment of the support, a deduction shall not be allowed under this subdivision. (f) Job-related expenses, if allowed by the court after consideration of whether the expenses are necessary, the benefit to the employee, and any other relevant facts.
```

</details>

### C5. `drafting-003-c5`

**Criterion:** States that unless the court orders otherwise the support amount is allocated so that the amount for the youngest child is the one-child amount and the amount for the next youngest is the difference between that amount and the two-child amount, with similar allocations for additional children.

#### Proposition `drafting-003-p6`

> Unless the court orders otherwise, the child support order shall allocate the support amount so that the amount for the youngest child is the amount of support for one child and the amount for the next youngest child is the difference between that amount and the amount for two children, with similar allocations for additional children.

**Verbatim authoritative excerpt relied on:**

```text
Unless the court orders otherwise, the order for child support shall allocate the support amount so that the amount of support for the youngest child is the amount of support for one child, and the amount for the next youngest child is the difference between that amount and the amount for two children, with similar allocations for additional children.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4055-D` |
| locator | Cal. Fam. Code § 4055(b)(5)-(d) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | September 1, 2024 (Operative; Effective January 1, 2024) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4055> |
| source sha256 | `09b651bbba9c7dcfaedc93754748af789f44b4669d3db652f36e391c6c126635` |

<details><summary>Full source excerpt as stored in the registry (585 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(5) If the amount calculated under the formula results in a positive number, the higher earner shall pay that amount to the lower earner. If the amount calculated under the formula results in a negative number, the lower earner shall pay the absolute value of that amount to the higher earner. (6) In any default proceeding where proof is by affidavit pursuant to Section 2336, or in any proceeding for child support in which a party fails to appear after being duly noticed, H% shall be set at zero in the formula if the noncustodial parent is the higher earner or at 100 if the custodial parent is the higher earner, where there is no evidence presented demonstrating the percentage of time that the noncustodial parent has primary physical responsibility for the children. H% shall not be set as described in paragraph (3) if the moving party in a default proceeding is the noncustodial parent or if the party who fails to appear after being duly noticed is the custodial parent. A statement by the party who is not in default as to the percentage of time that the noncustodial parent has primary physical responsibility for the children shall be deemed sufficient evidence. (7) In all cases in which the net disposable income per month of the obligor is less than the amount of monthly gross income earned from full-time minimum wage, established by Section 1182.12 of the Labor Code, at 40 hours per week, 52 weeks per year, there is a rebuttable presumption that the obligor is entitled to a low-income adjustment. The presumption may be rebutted by evidence showing that the application of the lowest amount of child support permitted pursuant to this paragraph would be unjust and inappropriate in the particular case. In determining whether the presumption is rebutted, the court shall consider the principles provided in Section 4053, and the impact of the contemplated adjustment on the respective net incomes of the obligor and the obligee. The low-income adjustment shall reduce the child support amount otherwise determined under this section by an amount that is no greater than the amount calculated by multiplying the child support amount otherwise determined under this section by a fraction, the numerator of which is the amount of monthly gross income earned from full-time minimum wage, established by Section 1182.12 of the Labor Code, at 40 hours per week, 52 weeks per year, minus the obligor’s net disposable income per month, and the denominator of which is the amount of monthly gross income earned from full-time minimum wage, established by Section 1182.12 of the Labor Code, at 40 hours per week, 52 weeks per year. (8) Unless the court orders otherwise, the order for child support shall allocate the support amount so that the amount of support for the youngest child is the amount of support for one child, and the amount for the next youngest child is the difference between that amount and the amount for two children, with similar allocations for additional children. However, this paragraph does not apply to cases in which there are different time-sharing arrangements for different children or where the court determines that the allocation would be inappropriate in the particular case. (c) If a court uses a computer to calculate the child support order and the obligor’s income qualifies for a low-income adjustment, the computer program shall provide the range of the adjustment permitted by paragraph (7) of subdivision (b). (d) This section shall be operative September 1, 2024.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `drafting-003-a1` | statute | 4055 | — |
| `drafting-003-a2` | statute | 4059 | — |
| `drafting-003-a3` | contains | low-income adjustment | — |

## 5. Your decision

```
task_id:      drafting-003
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
  --task drafting-003 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
