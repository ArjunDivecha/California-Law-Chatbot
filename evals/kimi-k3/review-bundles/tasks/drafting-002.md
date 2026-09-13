# Review packet — `drafting-002`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `drafting-002` |
| category | drafting |
| workflow | draft |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `54bcdab063fcb69ce654719502258c3ee289d23ff6faaf3a8fed97970b29608c` |
| proposition_hashes | 4 — `486836cbf297`, `8ab084c1c465`, `a391f326eb81`, `c43549443f7b` |
| source_hashes | 1 — `afaa15dbb8d7` |

## 2. Prompt (what the model is asked)

```text
You are assisting a California family-law and LGBTQ practice. All parties, dates, and facts below are synthetic and invented for this exercise. Do not use any tools; draft from the supplied authorities only.

Our client Perpetua Okonkwo-Feathering asks the court to base child support on the other parent’s earning capacity. The other parent, Thaddeus Okonkwo-Feathering, left a $190,000 engineering position eleven months ago, reports $0 income, has provided no pay records, and spent four months of the past year incarcerated on a misdemeanor conviction. Draft the argument section of the points and authorities on income and earning capacity. Address both the unknown-income and known-income routes, the record the court needs to impute, and any statutory limit that cuts against our position.
```

## 3. Material criteria and their propositions

### C1. `drafting-002-c1`

**Criterion:** States that when a parent’s annual gross income is unknown the court shall consider the earning capacity of that parent.

#### Proposition `drafting-002-p1`

> In a case when a parent’s annual gross income is unknown, the court shall consider the earning capacity of the parent.

**Verbatim authoritative excerpt relied on:**

```text
In a case when a parent’s annual gross income is unknown, the court shall consider the earning capacity of the parent.
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

### C2. `drafting-002-c2`

**Criterion:** States that when a parent’s annual gross income is known the court may, in its discretion, consider earning capacity in lieu of income, consistent with the best interests of the children.

#### Proposition `drafting-002-p2`

> In a case when a parent’s annual gross income is known, the court may, in its discretion, consider the earning capacity of a parent in lieu of the parent’s income, consistent with the best interests of the children.

**Verbatim authoritative excerpt relied on:**

```text
In a case when a parent’s annual gross income is known, the court may, in its discretion, consider the earning capacity of a parent in lieu of the parent’s income, consistent with the best interests of the children, taking into consideration the overall welfare and developmental needs of the children, and the time that parent spends with the children.
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

### C3. `drafting-002-c3`

**Criterion:** States that in determining earning capacity the court shall consider the specific circumstances of the parent, including assets, employment and earnings history, job skills, educational attainment, age, health, and the local job market.

#### Proposition `drafting-002-p3`

> When determining earning capacity the court shall consider the specific circumstances of the parent, including assets, residence, employment and earnings history, job skills, educational attainment, literacy, age, health, criminal record and other employment barriers, record of seeking work, and the local job market.

**Verbatim authoritative excerpt relied on:**

```text
When determining the earning capacity of the parent pursuant to this subdivision, the court shall consider the specific circumstances of the parent, to the extent known. Those circumstances include, but are not limited to, evidence of the parent’s assets, residence, employment and earnings history, job skills, educational attainment, literacy, age, health, criminal record and other employment barriers, and record of seeking work, as well as the local job market, the availability of employers willing to hire the parent, prevailing earnings levels in the local community, and other relevant background factors affecting the parent’s ability to earn.
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

### C4. `drafting-002-c4`

**Criterion:** Discloses the controlling limit that incarceration or involuntary institutionalization of a parent shall not be treated as voluntary unemployment in establishing or modifying support orders, regardless of the nature of the offense.

#### Proposition `drafting-002-p4`

> Notwithstanding any other law, the incarceration or involuntary institutionalization of a parent shall not be treated as voluntary unemployment in establishing or modifying support orders regardless of the nature of the offense.

**Verbatim authoritative excerpt relied on:**

```text
Notwithstanding any other law, the incarceration or involuntary institutionalization of a parent shall not be treated as voluntary unemployment in establishing or modifying support orders regardless of the nature of the offense.
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
| `drafting-002-a1` | statute | 4058 | — |
| `drafting-002-a2` | contains | earning capacity | — |
| `drafting-002-a3` | contains | incarcerat | MISSED_CONTROLLING_CONTRARY_AUTHORITY |

## 5. Your decision

```
task_id:      drafting-002
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
  --task drafting-002 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
