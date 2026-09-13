# Review packet — `research-006`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `research-006` |
| category | research |
| workflow | research |
| track | frozen_evidence |
| data_class | public |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `3da79514227fbc0df713b8127de8a8f495910ea5daa796d114bce2de6bae2627` |
| proposition_hashes | 6 — `1fcb3ea1661d`, `7d6a91be1d89`, `992437c277fa`, `cde521470b7e`, `dd6ee2b91369`, `f8541b7f4b8b` |
| source_hashes | 3 — `09b651bbba9c`, `0e62ec069e8e`, `75ae62b174b1` |

## 2. Prompt (what the model is asked)

```text
I need to explain California guideline child support to a client from first principles. What is the statewide uniform guideline formula, what does each component of it mean, where does net disposable income come from, and which version of Family Code section 4055 governs an order I am setting today?
```

## 3. Material criteria and their propositions

### C1. `research-006-c1`

**Criterion:** States the guideline formula as CS = K[HN - (H%)(TN)].

#### Proposition `research-006-p1`

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

### C2. `research-006-c2`

**Criterion:** Defines K as the amount of both parents’ income allocated for child support under section 4055(b)(3).

#### Proposition `research-006-p2`

> In the guideline formula, K is the amount of both parents’ income to be allocated for child support as set forth in paragraph (3) of Family Code section 4055(b).

**Verbatim authoritative excerpt relied on:**

```text
K = amount of both parents’ income to be allocated for child support as set forth in paragraph (3).
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

### C3. `research-006-c3`

**Criterion:** Defines HN as the high earner’s net monthly disposable income and TN as the total net monthly disposable income of both parties.

#### Proposition `research-006-p3`

> In the guideline formula, HN is the high earner’s net monthly disposable income and TN is the total net monthly disposable income of both parties.

**Verbatim authoritative excerpt relied on:**

```text
HN = high earner’s net monthly disposable income.
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

### C4. `research-006-c4`

**Criterion:** Defines H% as the approximate percentage of time the high earner has or will have primary physical responsibility for the children compared to the other parent, and directs net disposable income to Family Code section 4059.

#### Proposition `research-006-p4`

> In the guideline formula, H% is the approximate percentage of time that the high earner has or will have primary physical responsibility for the children compared to the other parent.

**Verbatim authoritative excerpt relied on:**

```text
H% = approximate percentage of time that the high earner has or will have primary physical responsibility for the children compared to the other parent.
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

#### Proposition `research-006-p5`

> To compute net disposable income for the guideline formula, see Family Code section 4059.

**Verbatim authoritative excerpt relied on:**

```text
To compute net disposable income, see Section 4059.
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

### C5. `research-006-c5`

**Criterion:** States that the governing version of section 4055 is operative September 1, 2024.

#### Proposition `research-006-p6`

> Family Code section 4055 as currently enacted shall be operative September 1, 2024.

**Verbatim authoritative excerpt relied on:**

```text
This section shall be operative September 1, 2024.
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
| `research-006-a1` | statute | 4055 | — |
| `research-006-a2` | contains | September 1, 2024 | WRONG_EFFECTIVE_DATE |
| `research-006-a3` | statute | 4059 | — |

## 5. Your decision

```
task_id:      research-006
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
  --task research-006 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
