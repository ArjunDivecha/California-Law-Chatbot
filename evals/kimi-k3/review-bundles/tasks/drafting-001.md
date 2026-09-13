# Review packet — `drafting-001`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `drafting-001` |
| category | drafting |
| workflow | draft |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `d5297bea39c5294f0fb2ae24e80f83b978d802f56064857fdb7be5a60531e5e4` |
| proposition_hashes | 5 — `0b9090c0faeb`, `69f25a109975`, `869de8853d24`, `d6d552527c1b`, `e3e78a83e069` |
| source_hashes | 4 — `0e62ec069e8e`, `6947c4a957c8`, `75ae62b174b1`, `afaa15dbb8d7` |

## 2. Prompt (what the model is asked)

```text
You are assisting a California family-law and LGBTQ practice. All parties, dates, and facts below are synthetic and invented for this exercise. Do not use any tools; draft from the supplied authorities only.

Draft the child-support section of a declaration in support of a Request for Order for our client Rosalind Quiver-Bramble (petitioner; two minor children; the other parent, Anselm Quiver-Bramble, is the higher earner). The section must explain to the judicial officer how the statewide uniform guideline amount is produced, define each variable the formula uses, describe what counts as annual gross income, and address the $900 per month of child support Rosalind receives for an older child from a prior relationship. Close the declaration with the statutory certification a written declaration must carry to be used in place of a sworn affidavit in California.
```

## 3. Material criteria and their propositions

### C1. `drafting-001-c1`

**Criterion:** States the statewide uniform guideline formula for determining child support orders, CS = K[HN - (H%)(TN)].

#### Proposition `drafting-001-p1`

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

### C2. `drafting-001-c2`

**Criterion:** Correctly defines the formula components, including HN as the high earner’s net monthly disposable income and TN as the total net monthly disposable income of both parties.

#### Proposition `drafting-001-p2`

> In the guideline formula HN is the high earner’s net monthly disposable income, H% is the approximate percentage of time the high earner has or will have primary physical responsibility for the children compared to the other parent, and TN is the total net monthly disposable income of both parties.

**Verbatim authoritative excerpt relied on:**

```text
(C) HN = high earner’s net monthly disposable income. (D) H% = approximate percentage of time that the high earner has or will have primary physical responsibility for the children compared to the other parent. In cases in which parents have different time-sharing arrangements for different children, H% equals the average of the approximate percentages of time the high earner parent spends with each child. (E) TN = total net monthly disposable income of both parties.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4055-B` |
| locator | Cal. Fam. Code § 4055(b)(1)-(2) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | September 1, 2024 (Operative; Effective January 1, 2024) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4055> |
| source sha256 | `75ae62b174b1c11ba2d46999bd70afe712f9ddc089d913bfcb17198e11759033` |

<details><summary>Full source excerpt as stored in the registry (121 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(b) (1) The components of the formula are as follows: (A) CS = child support amount. (B) K = amount of both parents’ income to be allocated for child support as set forth in paragraph (3). (C) HN = high earner’s net monthly disposable income. (D) H% = approximate percentage of time that the high earner has or will have primary physical responsibility for the children compared to the other parent. In cases in which parents have different time-sharing arrangements for different children, H% equals the average of the approximate percentages of time the high earner parent spends with each child. (E) TN = total net monthly disposable income of both parties. (2) To compute net disposable income, see Section 4059.
```

</details>

### C3. `drafting-001-c3`

**Criterion:** States that annual gross income means income from whatever source derived and includes the listed categories such as salaries, wages, bonuses, rents, dividends, and pensions.

#### Proposition `drafting-001-p3`

> The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c), and includes but is not limited to commissions, salaries, royalties, wages, bonuses, rents, dividends, pensions, interest, trust income, and annuities.

**Verbatim authoritative excerpt relied on:**

```text
The annual gross income of each parent means income from whatever source derived, except as specified in subdivision (c) and includes, but is not limited to, the following: (1) Income such as commissions, salaries, royalties, wages, bonuses, rents, dividends, pensions, interest, trust income, annuities, workers’ compensation benefits, unemployment insurance benefits, disability insurance benefits, social security benefits, severance pay,
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

### C4. `drafting-001-c4`

**Criterion:** States that child support received by a party for children from another relationship is not included as part of that party’s gross or net income.

#### Proposition `drafting-001-p4`

> Child support received by a party for children from another relationship is not included as part of that party’s gross or net income.

**Verbatim authoritative excerpt relied on:**

```text
Child support received by a party for children from another relationship shall not be included as part of that party’s gross or net income.
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

### C5. `drafting-001-c5`

**Criterion:** Closes with a certification or declaration under penalty of perjury under the laws of the State of California that the foregoing is true and correct, subscribed and dated.

#### Proposition `drafting-001-p5`

> An unsworn written declaration may substitute for a sworn affidavit when it recites that it is certified or declared by the person to be true under penalty of perjury, is subscribed by that person, and states the date of execution and that it is so certified or declared under the laws of the State of California.

**Verbatim authoritative excerpt relied on:**

```text
such matter may with like force and effect be supported, evidenced, established or proved by the unsworn statement, declaration, verification, or certificate, in writing of such person which recites that it is certified or declared by him or her to be true under penalty of perjury, is subscribed by him or her, and (1), if executed within this state, states the date and place of execution, or (2), if executed at any place, within or without this state, states the date of execution and that it is so certified or declared under the laws of the State of California.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-CIV-PROC-CODE-2015-5` |
| locator | Cal. Civ. Proc. Code § 2015.5 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | July 1, 1981 (Operative) |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=2015.5> |
| source sha256 | `6947c4a957c8833fb4dbed759ae414ce20afb8ab843febe3afb3cbfaf750041e` |

<details><summary>Full source excerpt as stored in the registry (252 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
Whenever, under any law of this state or under any rule, regulation, order or requirement made pursuant to the law of this state, any matter is required or permitted to be supported, evidenced, established, or proved by the sworn statement, declaration, verification, certificate, oath, or affidavit, in writing of the person making the same (other than a deposition, or an oath of office, or an oath required to be taken before a specified official other than a notary public), such matter may with like force and effect be supported, evidenced, established or proved by the unsworn statement, declaration, verification, or certificate, in writing of such person which recites that it is certified or declared by him or her to be true under penalty of perjury, is subscribed by him or her, and (1), if executed within this state, states the date and place of execution, or (2), if executed at any place, within or without this state, states the date of execution and that it is so certified or declared under the laws of the State of California. The certification or declaration may be in substantially the following form: (a) If executed within this state: “I certify (or declare) under penalty of perjury that the foregoing is true and correct”: _____________ _________ (Date and Place)(Signature) (b) If executed at any place, within or without this state: “I certify (or declare) under penalty of perjury under the laws of the State of California that the foregoing is true and correct”: _____________ _________ (Date)(Signature)
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `drafting-001-a1` | statute | 4055 | — |
| `drafting-001-a2` | statute | 4058 | — |
| `drafting-001-a3` | contains | net monthly disposable income | — |
| `drafting-001-a4` | contains | under penalty of perjury / true and correct | MALFORMED_DELIVERABLE |

## 5. Your decision

```
task_id:      drafting-001
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
  --task drafting-001 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
