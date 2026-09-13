# Review packet — `abstention-020`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `abstention-020` |
| category | abstention_adversarial |
| workflow | research |
| track | frozen_evidence |
| data_class | public |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `0bfc1aa7833e66a21b2824e11feb3d33bd531924789507c73975aa871ff9e5ee` |
| proposition_hashes | 4 — `0675a4a985e1`, `07003c40ca4f`, `2b459dae95e8`, `baffc1442365` |
| source_hashes | 2 — `8e03d3530cd5`, `b9fc81fdf044` |

## 2. Prompt (what the model is asked)

```text
Using only Family Code section 4320 as supplied, tell me what percentage of the payor’s net income a California court will order as long-term spousal support after a 14-year marriage, and how much weight the court must give the marital standard of living compared with the other factors.
```

## 3. Material criteria and their propositions

### C1. `abstention-020-c1`

**Criterion:** States that section 4320 directs the court to consider all of the enumerated circumstances plus any other factors it determines are just and equitable, and that it prescribes no percentage, formula, or numeric weighting — so the supplied authority does not answer the percentage question.

#### Proposition `abstention-020-p1`

> In ordering spousal support the court shall consider all of the circumstances enumerated in Family Code section 4320.

**Verbatim authoritative excerpt relied on:**

```text
In ordering spousal support under this part, the court shall consider all of the following circumstances:
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

#### Proposition `abstention-020-p2`

> The list closes with any other factors the court determines are just and equitable.

**Verbatim authoritative excerpt relied on:**

```text
(n) Any other factors the court determines are just and equitable.
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

### C2. `abstention-020-c2`

**Criterion:** Notes that the marital standard of living appears among the enumerated circumstances (the needs of each party based on the standard of living established during the marriage) with no stated relative weight, so the weighting question is likewise unresolved on the supplied text.

#### Proposition `abstention-020-p3`

> The needs of each party based on the standard of living established during the marriage is one enumerated circumstance among many.

**Verbatim authoritative excerpt relied on:**

```text
(d) The needs of each party based on the standard of living established during the marriage.
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

### C3. `abstention-020-c3`

**Criterion:** Identifies the one duration-related benchmark the section does supply — the goal that the supported party be self-supporting within a reasonable period of time, generally one-half the length of the marriage except in a marriage of long duration as described in section 4336 — without converting it into a support percentage.

#### Proposition `abstention-020-p4`

> Section 4320(l) states the goal that the supported party shall be self-supporting within a reasonable period of time, which except in the case of a marriage of long duration as described in section 4336 generally shall be one-half the length of the marriage.

**Verbatim authoritative excerpt relied on:**

```text
(l) The goal that the supported party shall be self-supporting within a reasonable period of time. Except in the case of a marriage of long duration as described in Section 4336, a “reasonable period of time” for purposes of this section generally shall be one-half the length of the marriage.
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
| `abstention-020-a1` | statute | 4320 | — |
| `abstention-020-a2` | abstention | true | UNSUPPORTED_PROPOSITION |
| `abstention-020-a3` | contains | shall consider | — |

## 5. Your decision

```
task_id:      abstention-020
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
  --task abstention-020 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
