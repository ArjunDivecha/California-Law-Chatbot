# Review packet — `longcontext-004`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `longcontext-004` |
| category | long_context |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `b9dff6efebec54cc01f41850d42b4f17619ce74b7537d7d44daf40ef0b376047` |
| proposition_hashes | 5 — `24b2ba0492db`, `53b8764e1743`, `6929ee56e046`, `d2b86a80ca0c`, `ea197d835547` |
| source_hashes | 2 — `8e03d3530cd5`, `b9fc81fdf044` |

## 2. Prompt (what the model is asked)

```text
Long-context California spousal-support factor problem (all parties, documents, and facts synthetic). A roughly 43,000-word consolidated litigation file is embedded in the graded turn, with the operative facts split across three declaration inserts at roughly 28, 55, and 86 percent depth of an 8,600-word declaration section that itself sits in the second half of the packet. Buried facts: the marriage was solemnized June 8, 1999 per a certified marriage certificate and the parties separated January 30, 2024 (a nearly 25-year marriage); Petitioner left registered nursing in 2003 to devote time to domestic duties, her license lapsed in 2008, and a joint vocational evaluator priced a nine-month refresher program at $18,400 with roughly two years to entry-level wage; Petitioner worked full time to pay Respondent through dental school from 1999 to 2003 and he was licensed in 2004; and on September 12, 2019, after a contested evidentiary hearing, the court issued a restraining order after hearing under section 6340 on findings of intentionally caused bodily injury. A distractor exhibit at about 18 percent depth reproduces an originally filed FL-100 stating a June 8, 2009 marriage date, corrected by amended petition. The graded answer must map these facts onto Family Code section 4320(a)(1), (a)(2), (b), (c), (f), and (i)(4).
```

## 3. Material criteria and their propositions

### C1. `longcontext-004-c1`

**Criterion:** Retrieves the buried marriage and separation dates and states that the marriage ran from June 8, 1999 to the January 30, 2024 separation, a duration of roughly twenty-four years and seven months, rejecting the June 8, 2009 date on the originally filed FL-100 as a corrected typographical error, and identifies duration of the marriage as a section 4320(f) circumstance.

#### Proposition `longcontext-004-p4`

> The court shall consider the duration of the marriage.

**Verbatim authoritative excerpt relied on:**

```text
The duration of the marriage.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4320-B` |
| locator | Cal. Fam. Code § 4320(c)-(n) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2019 |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4320> |
| source sha256 | `b9fc81fdf044e8a0449d533196f160fc41a86337ddfbcfc95293ab37e578b22b` |

<details><summary>Full source excerpt as stored in the registry (364 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(c) The ability of the supporting party to pay spousal support, taking into account the supporting party’s earning capacity, earned and unearned income, assets, and standard of living. (d) The needs of each party based on the standard of living established during the marriage. (e) The obligations and assets, including the separate property, of each party. (f) The duration of the marriage. (g) The ability of the supported party to engage in gainful employment without unduly interfering with the interests of dependent children in the custody of the party. (h) The age and health of the parties. (i) All documented evidence of any history of domestic violence, as defined in Section 6211, between the parties or perpetrated by either party against either party’s child, including, but not limited to, consideration of: (1) A plea of nolo contendere. (2) Emotional distress resulting from domestic violence perpetrated against the supported party by the supporting party. (3) Any history of violence against the supporting party by the supported party. (4) Issuance of a protective order after a hearing pursuant to Section 6340. (5) A finding by a court during the pendency of a divorce, separation, or child custody proceeding, or other proceeding under Division 10 (commencing with Section 6200), that the spouse has committed domestic violence. (j) The immediate and specific tax consequences to each party. (k) The balance of the hardships to each party. (l) The goal that the supported party shall be self-supporting within a reasonable period of time. Except in the case of a marriage of long duration as described in Section 4336, a “reasonable period of time” for purposes of this section generally shall be one-half the length of the marriage. However, nothing in this section is intended to limit the court’s discretion to order support for a greater or lesser length of time, based on any of the other factors listed in this section, Section 4336, and the circumstances of the parties. (m) The criminal conviction of an abusive spouse shall be considered in making a reduction or elimination of a spousal support award in accordance with Section 4324.5 or 4325. (n) Any other factors the court determines are just and equitable.
```

</details>

### C2. `longcontext-004-c2`

**Criterion:** Applies section 4320(a)(1) to the buried vocational evidence: the lapsed nursing license, the nine-month refresher program, the $18,400 cost, and the roughly two-year runway to entry-level wage go to marketable skills, the job market for those skills, and the time and expenses required to acquire the appropriate education or training.

#### Proposition `longcontext-004-p1`

> In ordering spousal support the court shall consider the marketable skills of the supported party, the job market for those skills, the time and expenses required for the supported party to acquire the appropriate education or training to develop those skills, and the possible need for retraining or education to acquire other, more marketable skills or employment.

**Verbatim authoritative excerpt relied on:**

```text
The marketable skills of the supported party; the job market for those skills; the time and expenses required for the supported party to acquire the appropriate education or training to develop those skills; and the possible need for retraining or education to acquire other, more marketable skills or employment.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4320` |
| locator | Cal. Fam. Code § 4320 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2019 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4320> |
| source sha256 | `8e03d3530cd5ecf444cdc3f0ceaa7587db4babc5944c2e6bcff17cf3b04e9764` |

<details><summary>Full source excerpt as stored in the registry (158 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
In ordering spousal support under this part, the court shall consider all of the following circumstances: (a) The extent to which the earning capacity of each party is sufficient to maintain the standard of living established during the marriage, taking into account all of the following: (1) The marketable skills of the supported party; the job market for those skills; the time and expenses required for the supported party to acquire the appropriate education or training to develop those skills; and the possible need for retraining or education to acquire other, more marketable skills or employment. (2) The extent to which the supported party's present or future earning capacity is impaired by periods of unemployment that were incurred during the marriage to permit the supported party to devote time to domestic duties. (b) The extent to which the supported party contributed to the attainment of an education, training, a career position, or a license by the supporting party.
```

</details>

### C3. `longcontext-004-c3`

**Criterion:** Applies section 4320(a)(2) to the buried fact that Petitioner stopped working in 2003 and did not work outside the home again during the marriage, treating that as a period of unemployment incurred during the marriage to permit her to devote time to domestic duties that impairs her present or future earning capacity.

#### Proposition `longcontext-004-p2`

> The court shall consider the extent to which the supported party’s present or future earning capacity is impaired by periods of unemployment incurred during the marriage to permit the supported party to devote time to domestic duties.

**Verbatim authoritative excerpt relied on:**

```text
The extent to which the supported party's present or future earning capacity is impaired by periods of unemployment that were incurred during the marriage to permit the supported party to devote time to domestic duties.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4320` |
| locator | Cal. Fam. Code § 4320 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2019 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4320> |
| source sha256 | `8e03d3530cd5ecf444cdc3f0ceaa7587db4babc5944c2e6bcff17cf3b04e9764` |

<details><summary>Full source excerpt as stored in the registry (158 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
In ordering spousal support under this part, the court shall consider all of the following circumstances: (a) The extent to which the earning capacity of each party is sufficient to maintain the standard of living established during the marriage, taking into account all of the following: (1) The marketable skills of the supported party; the job market for those skills; the time and expenses required for the supported party to acquire the appropriate education or training to develop those skills; and the possible need for retraining or education to acquire other, more marketable skills or employment. (2) The extent to which the supported party's present or future earning capacity is impaired by periods of unemployment that were incurred during the marriage to permit the supported party to devote time to domestic duties. (b) The extent to which the supported party contributed to the attainment of an education, training, a career position, or a license by the supporting party.
```

</details>

### C4. `longcontext-004-c4`

**Criterion:** Applies section 4320(b) to the buried fact that Petitioner worked full time as a nurse from 1999 through 2003 and paid Respondent’s dental school tuition and the household expenses, treating that as a contribution to the attainment of an education, training, a career position, or a license by the supporting party.

#### Proposition `longcontext-004-p3`

> The court shall consider the extent to which the supported party contributed to the attainment of an education, training, a career position, or a license by the supporting party.

**Verbatim authoritative excerpt relied on:**

```text
The extent to which the supported party contributed to the attainment of an education, training, a career position, or a license by the supporting party.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4320` |
| locator | Cal. Fam. Code § 4320 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2019 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4320> |
| source sha256 | `8e03d3530cd5ecf444cdc3f0ceaa7587db4babc5944c2e6bcff17cf3b04e9764` |

<details><summary>Full source excerpt as stored in the registry (158 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
In ordering spousal support under this part, the court shall consider all of the following circumstances: (a) The extent to which the earning capacity of each party is sufficient to maintain the standard of living established during the marriage, taking into account all of the following: (1) The marketable skills of the supported party; the job market for those skills; the time and expenses required for the supported party to acquire the appropriate education or training to develop those skills; and the possible need for retraining or education to acquire other, more marketable skills or employment. (2) The extent to which the supported party's present or future earning capacity is impaired by periods of unemployment that were incurred during the marriage to permit the supported party to devote time to domestic duties. (b) The extent to which the supported party contributed to the attainment of an education, training, a career position, or a license by the supporting party.
```

</details>

### C5. `longcontext-004-c5`

**Criterion:** Applies section 4320(i) to the buried September 12, 2019 order, treating the issuance of a protective order after a hearing pursuant to Section 6340 as documented evidence of a history of domestic violence the court must consider, and does so notwithstanding that the order has expired and no new restraining order is sought.

#### Proposition `longcontext-004-p5`

> The court shall consider all documented evidence of any history of domestic violence as defined in Section 6211 between the parties, including the issuance of a protective order after a hearing pursuant to Section 6340.

**Verbatim authoritative excerpt relied on:**

```text
All documented evidence of any history of domestic violence, as defined in Section 6211, between the parties or perpetrated by either party against either party’s child, including, but not limited to, consideration of: (1) A plea of nolo contendere. (2) Emotional distress resulting from domestic violence perpetrated against the supported party by the supporting party. (3) Any history of violence against the supporting party by the supported party. (4) Issuance of a protective order after a hearing pursuant to Section 6340.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-4320-B` |
| locator | Cal. Fam. Code § 4320(c)-(n) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2019 |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=4320> |
| source sha256 | `b9fc81fdf044e8a0449d533196f160fc41a86337ddfbcfc95293ab37e578b22b` |

<details><summary>Full source excerpt as stored in the registry (364 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(c) The ability of the supporting party to pay spousal support, taking into account the supporting party’s earning capacity, earned and unearned income, assets, and standard of living. (d) The needs of each party based on the standard of living established during the marriage. (e) The obligations and assets, including the separate property, of each party. (f) The duration of the marriage. (g) The ability of the supported party to engage in gainful employment without unduly interfering with the interests of dependent children in the custody of the party. (h) The age and health of the parties. (i) All documented evidence of any history of domestic violence, as defined in Section 6211, between the parties or perpetrated by either party against either party’s child, including, but not limited to, consideration of: (1) A plea of nolo contendere. (2) Emotional distress resulting from domestic violence perpetrated against the supported party by the supporting party. (3) Any history of violence against the supporting party by the supported party. (4) Issuance of a protective order after a hearing pursuant to Section 6340. (5) A finding by a court during the pendency of a divorce, separation, or child custody proceeding, or other proceeding under Division 10 (commencing with Section 6200), that the spouse has committed domestic violence. (j) The immediate and specific tax consequences to each party. (k) The balance of the hardships to each party. (l) The goal that the supported party shall be self-supporting within a reasonable period of time. Except in the case of a marriage of long duration as described in Section 4336, a “reasonable period of time” for purposes of this section generally shall be one-half the length of the marriage. However, nothing in this section is intended to limit the court’s discretion to order support for a greater or lesser length of time, based on any of the other factors listed in this section, Section 4336, and the circumstances of the parties. (m) The criminal conviction of an abusive spouse shall be considered in making a reduction or elimination of a spousal support award in accordance with Section 4324.5 or 4325. (n) Any other factors the court determines are just and equitable.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `longcontext-004-a1` | contains | June 8, 1999 | — |
| `longcontext-004-a2` | statute | 4320 | — |
| `longcontext-004-a3` | contains | September 12, 2019 | — |
| `longcontext-004-a4` | not_contains | married on June 8, 2009 | MATERIAL_FACT_INVENTION |

## 5. Your decision

```
task_id:      longcontext-004
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
  --task longcontext-004 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
