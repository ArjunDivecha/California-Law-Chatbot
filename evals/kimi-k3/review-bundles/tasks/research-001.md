# Review packet — `research-001`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `research-001` |
| category | research |
| workflow | research |
| track | frozen_evidence |
| data_class | public |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `afc8f14fa1727ad8cbad756aaca97ce3afdb0540524c30681a5ea0a4972653b8` |
| proposition_hashes | 4 — `31c8998071f4`, `966dab707a76`, `a140b5d076ea`, `cc4ab29adbfb` |
| source_hashes | 2 — `9b26f9ecca13`, `b3632d7bb921` |

## 2. Prompt (what the model is asked)

```text
A prospective client married in 2015 and lives in Los Angeles. During the marriage she has been paid a salary, she inherited a condo from her aunt in 2019 that she rents out, and she owned a brokerage account before the wedding. Under the California Family Code, how is each of those three assets characterized, and what happens to the rent the inherited condo generates?
```

## 3. Material criteria and their propositions

### C1. `research-001-c1`

**Criterion:** States the Family Code section 760 general rule that property acquired by a married person during marriage while domiciled in California is community property, except as otherwise provided by statute.

#### Proposition `research-001-p1`

> Except as otherwise provided by statute, all property acquired by a married person during the marriage while domiciled in California is community property.

**Verbatim authoritative excerpt relied on:**

```text
Except as otherwise provided by statute, all property, real or personal, wherever situated, acquired by a married person during the marriage while domiciled in this state is community property.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-760` |
| locator | Cal. Fam. Code § 760 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=760> |
| source sha256 | `b3632d7bb921ac23a50d1d2f61aa426bc6988fc5390c7eff35dd44fdeb6981f7` |

<details><summary>Full source excerpt as stored in the registry (29 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
Except as otherwise provided by statute, all property, real or personal, wherever situated, acquired by a married person during the marriage while domiciled in this state is community property.
```

</details>

### C2. `research-001-c2`

**Criterion:** Characterizes the brokerage account owned before the wedding as separate property under Family Code section 770.

#### Proposition `research-001-p2`

> Separate property of a married person includes all property owned by the person before marriage.

**Verbatim authoritative excerpt relied on:**

```text
All property owned by the person before marriage.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-770` |
| locator | Cal. Fam. Code § 770 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=770> |
| source sha256 | `9b26f9ecca13b86febe675afe73e00f1b8540270f1fe73342852fa494aaf13f3` |

<details><summary>Full source excerpt as stored in the registry (66 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Separate property of a married person includes all of the following: (1) All property owned by the person before marriage. (2) All property acquired by the person after marriage by gift, bequest, devise, or descent. (3) The rents, issues, and profits of the property described in this section. (b) A married person may, without the consent of the person's spouse, convey the person's separate property.
```

</details>

### C3. `research-001-c3`

**Criterion:** Characterizes the inherited condo as separate property because it was acquired after marriage by gift, bequest, devise, or descent.

#### Proposition `research-001-p3`

> Separate property of a married person includes all property acquired by the person after marriage by gift, bequest, devise, or descent.

**Verbatim authoritative excerpt relied on:**

```text
All property acquired by the person after marriage by gift, bequest, devise, or descent.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-770` |
| locator | Cal. Fam. Code § 770 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=770> |
| source sha256 | `9b26f9ecca13b86febe675afe73e00f1b8540270f1fe73342852fa494aaf13f3` |

<details><summary>Full source excerpt as stored in the registry (66 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Separate property of a married person includes all of the following: (1) All property owned by the person before marriage. (2) All property acquired by the person after marriage by gift, bequest, devise, or descent. (3) The rents, issues, and profits of the property described in this section. (b) A married person may, without the consent of the person's spouse, convey the person's separate property.
```

</details>

### C4. `research-001-c4`

**Criterion:** States that the rents, issues, and profits of the separate-property condo are themselves separate property.

#### Proposition `research-001-p4`

> Separate property of a married person includes the rents, issues, and profits of the property described in Family Code section 770.

**Verbatim authoritative excerpt relied on:**

```text
The rents, issues, and profits of the property described in this section.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-770` |
| locator | Cal. Fam. Code § 770 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=770> |
| source sha256 | `9b26f9ecca13b86febe675afe73e00f1b8540270f1fe73342852fa494aaf13f3` |

<details><summary>Full source excerpt as stored in the registry (66 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Separate property of a married person includes all of the following: (1) All property owned by the person before marriage. (2) All property acquired by the person after marriage by gift, bequest, devise, or descent. (3) The rents, issues, and profits of the property described in this section. (b) A married person may, without the consent of the person's spouse, convey the person's separate property.
```

</details>

### C5. `research-001-c5`

**Criterion:** Characterizes the salary earned during the marriage as community property rather than separate property.

#### Proposition `research-001-p1`

> Except as otherwise provided by statute, all property acquired by a married person during the marriage while domiciled in California is community property.

**Verbatim authoritative excerpt relied on:**

```text
Except as otherwise provided by statute, all property, real or personal, wherever situated, acquired by a married person during the marriage while domiciled in this state is community property.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-760` |
| locator | Cal. Fam. Code § 760 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=760> |
| source sha256 | `b3632d7bb921ac23a50d1d2f61aa426bc6988fc5390c7eff35dd44fdeb6981f7` |

<details><summary>Full source excerpt as stored in the registry (29 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
Except as otherwise provided by statute, all property, real or personal, wherever situated, acquired by a married person during the marriage while domiciled in this state is community property.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `research-001-a1` | statute | 760 | — |
| `research-001-a2` | statute | 770 | — |
| `research-001-a3` | contains | separate property | — |

## 5. Your decision

```
task_id:      research-001
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
  --task research-001 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
