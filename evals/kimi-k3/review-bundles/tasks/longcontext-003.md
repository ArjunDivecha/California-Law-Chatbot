# Review packet — `longcontext-003`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `longcontext-003` |
| category | long_context |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `d3888e06735777123a42d43f2caf808f6d9a2aec94eac359b56a5512448aab6d` |
| proposition_hashes | 3 — `3bcdad517c06`, `93c5f90ac193`, `e1c05cf986d5` |
| source_hashes | 1 — `afaa15dbb8d7` |

## 2. Prompt (what the model is asked)

```text
Long-context California guideline-support income problem (all parties, documents, and facts synthetic). A roughly 34,000-word consolidated litigation file is embedded in the graded turn. Buried at about 66 percent depth inside the interrogatory-response section is Schedule C to an amended Income and Expense Declaration listing six amounts: $214,000.00 base salary, $38,500.00 annual bonus, $54,000.00 gross rents, $19,200.00 veterans disability compensation expressly not based on need, $4,800.00 county general assistance whose eligibility is based on a determination of need, and $14,400.00 of child support actually received for a child of a prior relationship who is not a child of this proceeding. An earlier correspondence insert at about 22 percent depth states a superseded $186,000.00 base salary taken from a 2022 offer letter. The graded answer must include the first four items under Family Code section 4058(a)(1), exclude the last two under section 4058(c), use the $214,000.00 figure, and reach $325,700.00.
```

## 3. Material criteria and their propositions

### C1. `longcontext-003-c1`

**Criterion:** Retrieves the buried Schedule C and includes in annual gross income the $214,000.00 base salary, the $38,500.00 bonus, the $54,000.00 of rents, and the $19,200.00 of veterans disability compensation, correctly relying on the fact stated on the schedule that the veterans benefit is not based on need, because section 4058(a)(1) lists salaries, bonuses, rents, and veterans benefits that are not based on need.

#### Proposition `longcontext-003-p1`

> The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c), and includes but is not limited to salaries, wages, bonuses, rents, and veterans benefits that are not based on need.

**Verbatim authoritative excerpt relied on:**

```text
The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c) and includes, but is not limited to, the following: (1) Income such as commissions, salaries, royalties, wages, bonuses, rents, dividends, pensions, interest, trust income, annuities, workers’ compensation benefits, unemployment insurance benefits, disability insurance benefits, social security benefits, severance pay, veterans benefits that are not based on need
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4058` |
| locator | Cal. Fam. Code § 4058 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | September 1, 2024 (Operative; Effective January 1, 2024) |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4058> |
| source sha256 | `afaa15dbb8d764e434a7acf22e454e793b96580da569e93228e163e48b2a0897` |

<details><summary>Full source excerpt as stored in the registry (447 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c) and includes, but is not limited to, the following: (1) Income such as commissions, salaries, royalties, wages, bonuses, rents, dividends, pensions, interest, trust income, annuities, workers’ compensation benefits, unemployment insurance benefits, disability insurance benefits, social security benefits, severance pay, veterans benefits that are not based on need, military allowances for housing and food, and spousal support actually received from a person not a party to the proceeding to establish a child support order pursuant to this article. (2) Income from the proprietorship of a business, such as gross receipts from the business reduced by expenditures required for the operation of the business. (3) In the discretion of the court, employee benefits or self-employment benefits, taking into consideration the benefit to the employee, any corresponding reduction in living expenses, and other relevant facts. (b) (1) (A) In a case when a parent’s annual gross income is unknown, the court shall consider the earning capacity of the parent. (B) In a case when a parent’s annual gross income is known, the court may, in its discretion, consider the earning capacity of a parent in lieu of the parent’s income, consistent with the best interests of the children, taking into consideration the overall welfare and developmental needs of the children, and the time that parent spends with the children. (2) When determining the earning capacity of the parent pursuant to this subdivision, the court shall consider the specific circumstances of the parent, to the extent known. Those circumstances include, but are not limited to, evidence of the parent’s assets, residence, employment and earnings history, job skills, educational attainment, literacy, age, health, criminal record and other employment barriers, and record of seeking work, as well as the local job market, the availability of employers willing to hire the parent, prevailing earnings levels in the local community, and other relevant background factors affecting the parent’s ability to earn. (3) Notwithstanding any other law, the incarceration or involuntary institutionalization of a parent shall not be treated as voluntary unemployment in establishing or modifying support orders regardless of the nature of the offense. “Incarcerated or involuntarily institutionalized” has the same meaning as subdivision (e) of Section 4007.5. (c) Annual gross income does not include any income derived from child support payments actually received, and income derived from any public assistance program, eligibility for which is based on a determination of need. Child support received by a party for children from another relationship shall not be included as part of that party’s gross or net income. (d) This section shall be operative September 1, 2024.
```

</details>

### C2. `longcontext-003-c2`

**Criterion:** Excludes the $4,800.00 of county general assistance because annual gross income does not include income derived from any public assistance program the eligibility for which is based on a determination of need (Fam. Code, sec. 4058(c)).

#### Proposition `longcontext-003-p2`

> Annual gross income does not include income derived from child support payments actually received or income derived from any public assistance program the eligibility for which is based on a determination of need, and child support received by a party for children from another relationship is not included in that party’s gross or net income.

**Verbatim authoritative excerpt relied on:**

```text
Annual gross income does not include any income derived from child support payments actually received, and income derived from any public assistance program, eligibility for which is based on a determination of need. Child support received by a party for children from another relationship shall not be included as part of that party’s gross or net income.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4058` |
| locator | Cal. Fam. Code § 4058 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | September 1, 2024 (Operative; Effective January 1, 2024) |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4058> |
| source sha256 | `afaa15dbb8d764e434a7acf22e454e793b96580da569e93228e163e48b2a0897` |

<details><summary>Full source excerpt as stored in the registry (447 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c) and includes, but is not limited to, the following: (1) Income such as commissions, salaries, royalties, wages, bonuses, rents, dividends, pensions, interest, trust income, annuities, workers’ compensation benefits, unemployment insurance benefits, disability insurance benefits, social security benefits, severance pay, veterans benefits that are not based on need, military allowances for housing and food, and spousal support actually received from a person not a party to the proceeding to establish a child support order pursuant to this article. (2) Income from the proprietorship of a business, such as gross receipts from the business reduced by expenditures required for the operation of the business. (3) In the discretion of the court, employee benefits or self-employment benefits, taking into consideration the benefit to the employee, any corresponding reduction in living expenses, and other relevant facts. (b) (1) (A) In a case when a parent’s annual gross income is unknown, the court shall consider the earning capacity of the parent. (B) In a case when a parent’s annual gross income is known, the court may, in its discretion, consider the earning capacity of a parent in lieu of the parent’s income, consistent with the best interests of the children, taking into consideration the overall welfare and developmental needs of the children, and the time that parent spends with the children. (2) When determining the earning capacity of the parent pursuant to this subdivision, the court shall consider the specific circumstances of the parent, to the extent known. Those circumstances include, but are not limited to, evidence of the parent’s assets, residence, employment and earnings history, job skills, educational attainment, literacy, age, health, criminal record and other employment barriers, and record of seeking work, as well as the local job market, the availability of employers willing to hire the parent, prevailing earnings levels in the local community, and other relevant background factors affecting the parent’s ability to earn. (3) Notwithstanding any other law, the incarceration or involuntary institutionalization of a parent shall not be treated as voluntary unemployment in establishing or modifying support orders regardless of the nature of the offense. “Incarcerated or involuntarily institutionalized” has the same meaning as subdivision (e) of Section 4007.5. (c) Annual gross income does not include any income derived from child support payments actually received, and income derived from any public assistance program, eligibility for which is based on a determination of need. Child support received by a party for children from another relationship shall not be included as part of that party’s gross or net income. (d) This section shall be operative September 1, 2024.
```

</details>

### C3. `longcontext-003-c3`

**Criterion:** Excludes the $14,400.00 of child support actually received for a child of a prior relationship, because annual gross income does not include income derived from child support payments actually received and child support received for children from another relationship is not part of that party’s gross or net income (Fam. Code, sec. 4058(c)).

#### Proposition `longcontext-003-p2`

> Annual gross income does not include income derived from child support payments actually received or income derived from any public assistance program the eligibility for which is based on a determination of need, and child support received by a party for children from another relationship is not included in that party’s gross or net income.

**Verbatim authoritative excerpt relied on:**

```text
Annual gross income does not include any income derived from child support payments actually received, and income derived from any public assistance program, eligibility for which is based on a determination of need. Child support received by a party for children from another relationship shall not be included as part of that party’s gross or net income.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4058` |
| locator | Cal. Fam. Code § 4058 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | September 1, 2024 (Operative; Effective January 1, 2024) |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4058> |
| source sha256 | `afaa15dbb8d764e434a7acf22e454e793b96580da569e93228e163e48b2a0897` |

<details><summary>Full source excerpt as stored in the registry (447 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c) and includes, but is not limited to, the following: (1) Income such as commissions, salaries, royalties, wages, bonuses, rents, dividends, pensions, interest, trust income, annuities, workers’ compensation benefits, unemployment insurance benefits, disability insurance benefits, social security benefits, severance pay, veterans benefits that are not based on need, military allowances for housing and food, and spousal support actually received from a person not a party to the proceeding to establish a child support order pursuant to this article. (2) Income from the proprietorship of a business, such as gross receipts from the business reduced by expenditures required for the operation of the business. (3) In the discretion of the court, employee benefits or self-employment benefits, taking into consideration the benefit to the employee, any corresponding reduction in living expenses, and other relevant facts. (b) (1) (A) In a case when a parent’s annual gross income is unknown, the court shall consider the earning capacity of the parent. (B) In a case when a parent’s annual gross income is known, the court may, in its discretion, consider the earning capacity of a parent in lieu of the parent’s income, consistent with the best interests of the children, taking into consideration the overall welfare and developmental needs of the children, and the time that parent spends with the children. (2) When determining the earning capacity of the parent pursuant to this subdivision, the court shall consider the specific circumstances of the parent, to the extent known. Those circumstances include, but are not limited to, evidence of the parent’s assets, residence, employment and earnings history, job skills, educational attainment, literacy, age, health, criminal record and other employment barriers, and record of seeking work, as well as the local job market, the availability of employers willing to hire the parent, prevailing earnings levels in the local community, and other relevant background factors affecting the parent’s ability to earn. (3) Notwithstanding any other law, the incarceration or involuntary institutionalization of a parent shall not be treated as voluntary unemployment in establishing or modifying support orders regardless of the nature of the offense. “Incarcerated or involuntarily institutionalized” has the same meaning as subdivision (e) of Section 4007.5. (c) Annual gross income does not include any income derived from child support payments actually received, and income derived from any public assistance program, eligibility for which is based on a determination of need. Child support received by a party for children from another relationship shall not be included as part of that party’s gross or net income. (d) This section shall be operative September 1, 2024.
```

</details>

### C4. `longcontext-003-c4`

**Criterion:** Uses the $214,000.00 current base salary rather than the superseded $186,000.00 figure from the original Income and Expense Declaration, and identifies the buried preparer note and the payroll register as the basis for that correction.

#### Proposition `longcontext-003-p1`

> The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c), and includes but is not limited to salaries, wages, bonuses, rents, and veterans benefits that are not based on need.

**Verbatim authoritative excerpt relied on:**

```text
The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c) and includes, but is not limited to, the following: (1) Income such as commissions, salaries, royalties, wages, bonuses, rents, dividends, pensions, interest, trust income, annuities, workers’ compensation benefits, unemployment insurance benefits, disability insurance benefits, social security benefits, severance pay, veterans benefits that are not based on need
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4058` |
| locator | Cal. Fam. Code § 4058 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | September 1, 2024 (Operative; Effective January 1, 2024) |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4058> |
| source sha256 | `afaa15dbb8d764e434a7acf22e454e793b96580da569e93228e163e48b2a0897` |

<details><summary>Full source excerpt as stored in the registry (447 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c) and includes, but is not limited to, the following: (1) Income such as commissions, salaries, royalties, wages, bonuses, rents, dividends, pensions, interest, trust income, annuities, workers’ compensation benefits, unemployment insurance benefits, disability insurance benefits, social security benefits, severance pay, veterans benefits that are not based on need, military allowances for housing and food, and spousal support actually received from a person not a party to the proceeding to establish a child support order pursuant to this article. (2) Income from the proprietorship of a business, such as gross receipts from the business reduced by expenditures required for the operation of the business. (3) In the discretion of the court, employee benefits or self-employment benefits, taking into consideration the benefit to the employee, any corresponding reduction in living expenses, and other relevant facts. (b) (1) (A) In a case when a parent’s annual gross income is unknown, the court shall consider the earning capacity of the parent. (B) In a case when a parent’s annual gross income is known, the court may, in its discretion, consider the earning capacity of a parent in lieu of the parent’s income, consistent with the best interests of the children, taking into consideration the overall welfare and developmental needs of the children, and the time that parent spends with the children. (2) When determining the earning capacity of the parent pursuant to this subdivision, the court shall consider the specific circumstances of the parent, to the extent known. Those circumstances include, but are not limited to, evidence of the parent’s assets, residence, employment and earnings history, job skills, educational attainment, literacy, age, health, criminal record and other employment barriers, and record of seeking work, as well as the local job market, the availability of employers willing to hire the parent, prevailing earnings levels in the local community, and other relevant background factors affecting the parent’s ability to earn. (3) Notwithstanding any other law, the incarceration or involuntary institutionalization of a parent shall not be treated as voluntary unemployment in establishing or modifying support orders regardless of the nature of the offense. “Incarcerated or involuntarily institutionalized” has the same meaning as subdivision (e) of Section 4007.5. (c) Annual gross income does not include any income derived from child support payments actually received, and income derived from any public assistance program, eligibility for which is based on a determination of need. Child support received by a party for children from another relationship shall not be included as part of that party’s gross or net income. (d) This section shall be operative September 1, 2024.
```

</details>

### C5. `longcontext-003-c5`

**Criterion:** Applies the version of Family Code section 4058 that is operative September 1, 2024 rather than an earlier formulation of the income definition.

#### Proposition `longcontext-003-p3`

> Family Code section 4058 in its current form is operative September 1, 2024.

**Verbatim authoritative excerpt relied on:**

```text
This section shall be operative September 1, 2024.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4058` |
| locator | Cal. Fam. Code § 4058 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | September 1, 2024 (Operative; Effective January 1, 2024) |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4058> |
| source sha256 | `afaa15dbb8d764e434a7acf22e454e793b96580da569e93228e163e48b2a0897` |

<details><summary>Full source excerpt as stored in the registry (447 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c) and includes, but is not limited to, the following: (1) Income such as commissions, salaries, royalties, wages, bonuses, rents, dividends, pensions, interest, trust income, annuities, workers’ compensation benefits, unemployment insurance benefits, disability insurance benefits, social security benefits, severance pay, veterans benefits that are not based on need, military allowances for housing and food, and spousal support actually received from a person not a party to the proceeding to establish a child support order pursuant to this article. (2) Income from the proprietorship of a business, such as gross receipts from the business reduced by expenditures required for the operation of the business. (3) In the discretion of the court, employee benefits or self-employment benefits, taking into consideration the benefit to the employee, any corresponding reduction in living expenses, and other relevant facts. (b) (1) (A) In a case when a parent’s annual gross income is unknown, the court shall consider the earning capacity of the parent. (B) In a case when a parent’s annual gross income is known, the court may, in its discretion, consider the earning capacity of a parent in lieu of the parent’s income, consistent with the best interests of the children, taking into consideration the overall welfare and developmental needs of the children, and the time that parent spends with the children. (2) When determining the earning capacity of the parent pursuant to this subdivision, the court shall consider the specific circumstances of the parent, to the extent known. Those circumstances include, but are not limited to, evidence of the parent’s assets, residence, employment and earnings history, job skills, educational attainment, literacy, age, health, criminal record and other employment barriers, and record of seeking work, as well as the local job market, the availability of employers willing to hire the parent, prevailing earnings levels in the local community, and other relevant background factors affecting the parent’s ability to earn. (3) Notwithstanding any other law, the incarceration or involuntary institutionalization of a parent shall not be treated as voluntary unemployment in establishing or modifying support orders regardless of the nature of the offense. “Incarcerated or involuntarily institutionalized” has the same meaning as subdivision (e) of Section 4007.5. (c) Annual gross income does not include any income derived from child support payments actually received, and income derived from any public assistance program, eligibility for which is based on a determination of need. Child support received by a party for children from another relationship shall not be included as part of that party’s gross or net income. (d) This section shall be operative September 1, 2024.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `longcontext-003-a1` | contains | $14,400 | — |
| `longcontext-003-a2` | statute | 4058 | — |
| `longcontext-003-a3` | contains | $214,000 | — |
| `longcontext-003-a4` | not_contains | base salary is $186,000 | MATERIAL_FACT_INVENTION |

## 5. Your decision

```
task_id:      longcontext-003
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
  --task longcontext-003 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
