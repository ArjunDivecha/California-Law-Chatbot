# Review packet — `multiturn-004`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `multiturn-004` |
| category | multi_turn |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `3c685d02a2626ab081d49b29780d42f3ce1218615c4db2e0cff0e00577a47766` |
| proposition_hashes | 6 — `33d4d50e00cc`, `34e727288c24`, `37b78745d283`, `5afa65bbaa49`, `b956db71e75a`, `c04fa41368a4` |
| source_hashes | 2 — `8e03d3530cd5`, `b9fc81fdf044` |

## 2. Prompt (what the model is asked)

```text
Multi-turn spousal-support consultation (all parties and facts synthetic). Turn 1 asked what a California court weighs on a request for long-term spousal support after the 22-year marriage of Ingrid Solheim-Baptiste and Anselm Baptiste. Turn 3 revealed documented evidence that Anselm, the proposed payor, perpetrated domestic violence against Ingrid during the marriage and that Ingrid suffered emotional distress as a result. Turn 5, the graded turn, further reveals that Anselm was criminally convicted of that abuse, and asks for one integrated answer covering the governing standard, the duration factor and the self-support goal, the domestic-violence factor, and the effect of the conviction. The answer must integrate all accumulated facts using only the supplied Family Code section 4320 authority.
```

### Conversation (5 turns; only the final user turn is graded)

**Turn 1 — user**

```text
Ingrid Solheim-Baptiste and Anselm Baptiste were married 22 years and are now dissolving. Ingrid is asking for long-term spousal support. What does the court weigh?
```

**Turn 2 — assistant**

```text
Spousal support is governed by the circumstances enumerated in Family Code section 4320. The court is required to consider all of them rather than fixing on any single factor.
```

**Turn 3 — user**

```text
Two more facts. There is documented evidence - police reports and a protective order - that Anselm perpetrated domestic violence against Ingrid during the marriage, and Ingrid has been treated for the emotional distress that came out of it. Where does that fit?
```

**Turn 4 — assistant**

```text
Section 4320 contains a dedicated domestic-violence circumstance that the court must consider, and it expressly reaches documented evidence of a history of domestic violence between the parties.
```

**Turn 5 — user** **(graded)**

```text
One last fact: Anselm was convicted in criminal court of the abuse. Please put it all together for me - what is the overall standard, how does the 22-year duration and the self-support goal factor in, how does the documented domestic-violence history factor in, and what does the criminal conviction do to the support award?
```

## 3. Material criteria and their propositions

### C1. `multiturn-004-c1`

**Criterion:** States that in ordering spousal support the court shall consider all of the circumstances enumerated in section 4320 rather than any single factor.

#### Proposition `multiturn-004-p1`

> In ordering spousal support the court shall consider all of the circumstances enumerated in Family Code section 4320.

**Verbatim authoritative excerpt relied on:**

```text
In ordering spousal support under this part, the court shall consider all of the following circumstances
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

### C2. `multiturn-004-c2`

**Criterion:** Applies the 22-year duration established in turn 1: identifies the duration of the marriage as an enumerated circumstance and states the self-support goal rule that, except for a marriage of long duration under section 4336, a reasonable period of time generally means one-half the length of the marriage.

#### Proposition `multiturn-004-p2`

> The duration of the marriage is an enumerated section 4320 circumstance.

**Verbatim authoritative excerpt relied on:**

```text
(f) The duration of the marriage.
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

#### Proposition `multiturn-004-p3`

> Except in the case of a marriage of long duration as described in section 4336, a reasonable period of time for purposes of the self-support goal generally shall be one-half the length of the marriage.

**Verbatim authoritative excerpt relied on:**

```text
Except in the case of a marriage of long duration as described in Section 4336, a “reasonable period of time” for purposes of this section generally shall be one-half the length of the marriage.
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

### C3. `multiturn-004-c3`

**Criterion:** Applies the turn-3 facts under section 4320(i): all documented evidence of any history of domestic violence as defined in section 6211 between the parties must be considered, expressly including emotional distress resulting from domestic violence perpetrated against the supported party by the supporting party.

#### Proposition `multiturn-004-p4`

> The court must consider all documented evidence of any history of domestic violence, as defined in section 6211, between the parties.

**Verbatim authoritative excerpt relied on:**

```text
(i) All documented evidence of any history of domestic violence, as defined in Section 6211, between the parties or perpetrated by either party against either
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

#### Proposition `multiturn-004-p5`

> Emotional distress resulting from domestic violence perpetrated against the supported party by the supporting party is expressly within the domestic-violence circumstance.

**Verbatim authoritative excerpt relied on:**

```text
(2) Emotional distress resulting from domestic violence perpetrated against the supported party by the supporting party.
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

### C4. `multiturn-004-c4`

**Criterion:** Applies the turn-5 conviction fact under section 4320(m): the criminal conviction of an abusive spouse shall be considered in making a reduction or elimination of a spousal support award in accordance with section 4324.5 or 4325.

#### Proposition `multiturn-004-p6`

> The criminal conviction of an abusive spouse shall be considered in making a reduction or elimination of a spousal support award in accordance with section 4324.5 or 4325.

**Verbatim authoritative excerpt relied on:**

```text
(m) The criminal conviction of an abusive spouse shall be considered in making a reduction or elimination of a spousal support award in accordance with Section 4324.5 or 4325.
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
| `multiturn-004-a1` | statute | 4320 | — |
| `multiturn-004-a2` | contains | 4325 | — |
| `multiturn-004-a3` | contains | history of domestic violence | — |
| `multiturn-004-a4` | statute | 6211 | — |

## 5. Your decision

```
task_id:      multiturn-004
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
  --task multiturn-004 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
