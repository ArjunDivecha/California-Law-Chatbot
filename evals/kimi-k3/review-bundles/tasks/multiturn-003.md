# Review packet — `multiturn-003`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `multiturn-003` |
| category | multi_turn |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `9d774612b5720be441a36c3e60c9df2fdeb40d24d0afa89e07a480bc6297513d` |
| proposition_hashes | 5 — `3a65f1f3beac`, `48b95e83de04`, `819e3cf41f74`, `900e074454ea`, `be02d98416af` |
| source_hashes | 3 — `0e62ec069e8e`, `6fe51139415d`, `afaa15dbb8d7` |

## 2. Prompt (what the model is asked)

```text
Multi-turn child-support consultation (all parties and facts synthetic). Turn 1 asked how California calculates guideline child support for Yolanda Brakhage-Ntuli and Desmond Ntuli. Turn 3 revealed that Desmond left a $190,000-per-year logistics job eight months ago and now reports no income, and asked whether the court can use what he could earn. Turn 5, the graded turn, reveals that Desmond did not quit voluntarily but has been incarcerated since that date, and asks for one integrated answer covering the guideline formula, how gross and net disposable income are determined, when earning capacity may be used, and how the incarceration fact changes the earning-capacity analysis. The answer must integrate all accumulated facts using only the supplied Family Code authority.
```

### Conversation (5 turns; only the final user turn is graded)

**Turn 1 — user**

```text
Yolanda Brakhage-Ntuli and Desmond Ntuli have two children and are setting child support in a California case. How does the statewide guideline actually compute the number?
```

**Turn 2 — assistant**

```text
California uses a statewide uniform guideline formula, and each parent's net monthly disposable income is derived from that parent's annual gross income after the deductions the statute allows.
```

**Turn 3 — user**

```text
Here is the complication. Desmond walked away from a $190,000-a-year logistics job eight months ago and now reports zero income. Can the court run the formula on what he could be earning rather than on zero?
```

**Turn 4 — assistant**

```text
There is a statutory earning-capacity provision that governs when the court may use earning capacity instead of actual income, and it distinguishes the case where a parent's gross income is unknown from the case where it is known.
```

**Turn 5 — user** **(graded)**

```text
I have to correct myself on the key fact. Desmond did not quit to avoid support - he has been incarcerated since he left the job, and he is still in custody. Please give me the whole picture now: what the guideline formula is, how gross income and net disposable income are determined, when the court may use earning capacity instead of actual income, and what the incarceration does to that earning-capacity argument.
```

## 3. Material criteria and their propositions

### C1. `multiturn-003-c1`

**Criterion:** States the statewide uniform guideline formula CS = K[HN - (H%)(TN)].

#### Proposition `multiturn-003-p1`

> The statewide uniform guideline for determining child support orders is CS = K[HN - (H%)(TN)].

**Verbatim authoritative excerpt relied on:**

```text
The statewide uniform guideline for determining child support orders is as follows: CS = K[HN - (H%)(TN)].
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4055` |
| locator | Cal. Fam. Code § 4055 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | September 1, 2024 (Operative; Effective January 1, 2024) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4055> |
| source sha256 | `0e62ec069e8eb4ca21baccbb17f31324ca61b3859ba4a09a638607303456e96e` |

<details><summary>Full source excerpt as stored in the registry (17 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
The statewide uniform guideline for determining child support orders is as follows: CS = K[HN - (H%)(TN)].
```

</details>

### C2. `multiturn-003-c2`

**Criterion:** Explains that annual gross income means income from whatever source derived except as specified in section 4058(c), and that annual net disposable income is computed by deducting the section 4059 items from annual gross income.

#### Proposition `multiturn-003-p2`

> The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c) of section 4058.

**Verbatim authoritative excerpt relied on:**

```text
(a) The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c)
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

#### Proposition `multiturn-003-p3`

> The annual net disposable income of each parent is computed by deducting from that parent's annual gross income the actual amounts attributable to the items listed in section 4059 or other items permitted under the article.

**Verbatim authoritative excerpt relied on:**

```text
The annual net disposable income of each parent shall be computed by deducting from the parent’s annual gross income the actual amounts attributable to the following items or other items permitted under this article
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

### C3. `multiturn-003-c3`

**Criterion:** States the earning-capacity rule carried over from turn 3: when a parent's annual gross income is known, the court may in its discretion consider earning capacity in lieu of income, consistent with the best interests of the children.

#### Proposition `multiturn-003-p4`

> When a parent's annual gross income is known, the court may in its discretion consider that parent's earning capacity in lieu of income, consistent with the best interests of the children.

**Verbatim authoritative excerpt relied on:**

```text
(B) In a case when a parent’s annual gross income is known, the court may, in its discretion, consider the earning capacity of a parent in lieu of the parent’s income, consistent with the best interests of the children, taking into consideration the overall welfare and developmental needs of the children, and the time that parent spends with the children.
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

### C4. `multiturn-003-c4`

**Criterion:** Integrates the turn-5 correction: because Desmond is incarcerated, his incarceration shall not be treated as voluntary unemployment in establishing or modifying support orders, regardless of the nature of the offense.

#### Proposition `multiturn-003-p5`

> Notwithstanding any other law, the incarceration or involuntary institutionalization of a parent shall not be treated as voluntary unemployment in establishing or modifying support orders regardless of the nature of the offense.

**Verbatim authoritative excerpt relied on:**

```text
(3) Notwithstanding any other law, the incarceration or involuntary institutionalization of a parent shall not be treated as voluntary unemployment in establishing or modifying support orders regardless of the nature of the offense.
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
| `multiturn-003-a1` | statute | 4058 | — |
| `multiturn-003-a2` | contains | shall not be treated as voluntary unemployment | MISSED_CONTROLLING_CONTRARY_AUTHORITY |
| `multiturn-003-a3` | contains | earning capacity | — |
| `multiturn-003-a4` | statute | 4059 | — |

## 5. Your decision

```
task_id:      multiturn-003
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
  --task multiturn-003 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
