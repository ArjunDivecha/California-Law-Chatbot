# Review packet — `longcontext-001`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `longcontext-001` |
| category | long_context |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `f988ef4898245829ad6d0387984af1e8c45c58481d0ea8596c1ccc21927db472` |
| proposition_hashes | 3 — `34c638af4e83`, `65e09a5d6c5b`, `9ccf5d5ed190` |
| source_hashes | 3 — `9b26f9ecca13`, `b3632d7bb921`, `fb7294173087` |

## 2. Prompt (what the model is asked)

```text
Long-context California characterization problem (all parties, documents, and facts synthetic). A roughly 27,000-word consolidated litigation file is embedded in the graded turn: exhibit index, counsel correspondence, declaration paragraphs, attorney billing detail, an account ledger, deposition excerpts, interrogatory responses, minute orders, and e-mail. Three legally operative facts are buried at different depths: an early letter and the original FL-100 plead a February 3, 2021 date of separation; a Stipulation and Order entered November 14, 2023 and buried in the minute-order section fixes the operative date of separation as October 17, 2022 and expressly supersedes the pleaded date; a ledger insert shows the petitioner performed no consulting services before November 1, 2022 and has received $18,400 monthly since; and declaration paragraphs disclose a condominium inherited by will in 2019 and its rents. The graded answer must retrieve the stipulated date, characterize all of the consulting income as post-separation separate property under Family Code section 771(a), and characterize the inherited condominium and its rents as separate property under section 770, against the section 760 general rule.
```

## 3. Material criteria and their propositions

### C1. `longcontext-001-c1`

**Criterion:** Retrieves the buried operative fact and states that the date of separation is October 17, 2022, as fixed by the Stipulation and Order entered November 14, 2023, rather than the February 3, 2021 date pleaded in the original FL-100 and asserted in the early correspondence, which the stipulation expressly supersedes and withdraws.

#### Proposition `longcontext-001-p1`

> The earnings and accumulations of a spouse after the date of separation of the spouses are the separate property of that spouse.

**Verbatim authoritative excerpt relied on:**

```text
The earnings and accumulations of a spouse and the minor children living with, or in the custody of, the spouse, after the date of separation of the spouses, are the separate property of the spouse.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-771` |
| locator | Cal. Fam. Code § 771 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2017 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=771> |
| source sha256 | `fb729417308760d45b7783cd66329a3aeeb69a14f942dd2d4fbd69ad7f6441a6` |

<details><summary>Full source excerpt as stored in the registry (70 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The earnings and accumulations of a spouse and the minor children living with, or in the custody of, the spouse, after the date of separation of the spouses, are the separate property of the spouse. (b) Notwithstanding subdivision (a), the earnings and accumulations of an unemancipated minor child related to a contract of a type described in Section 6750 shall remain the sole legal property of the minor child.
```

</details>

### C2. `longcontext-001-c2`

**Criterion:** Characterizes the Kestrel Bridge Advisory consulting fees as Petitioner’s separate property because the earnings and accumulations of a spouse after the date of separation are the separate property of that spouse (Fam. Code, sec. 771(a)), and connects that rule to the buried fact that the engagement began November 1, 2022 and no services were performed before that date, so all of the payments post-date the October 17, 2022 separation.

#### Proposition `longcontext-001-p1`

> The earnings and accumulations of a spouse after the date of separation of the spouses are the separate property of that spouse.

**Verbatim authoritative excerpt relied on:**

```text
The earnings and accumulations of a spouse and the minor children living with, or in the custody of, the spouse, after the date of separation of the spouses, are the separate property of the spouse.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-771` |
| locator | Cal. Fam. Code § 771 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2017 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=771> |
| source sha256 | `fb729417308760d45b7783cd66329a3aeeb69a14f942dd2d4fbd69ad7f6441a6` |

<details><summary>Full source excerpt as stored in the registry (70 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The earnings and accumulations of a spouse and the minor children living with, or in the custody of, the spouse, after the date of separation of the spouses, are the separate property of the spouse. (b) Notwithstanding subdivision (a), the earnings and accumulations of an unemancipated minor child related to a contract of a type described in Section 6750 shall remain the sole legal property of the minor child.
```

</details>

### C3. `longcontext-001-c3`

**Criterion:** States the Family Code section 760 baseline that, except as otherwise provided by statute, property acquired by a married person during the marriage while domiciled in California is community property, and uses it as the default against which the separate-property characterizations are made.

#### Proposition `longcontext-001-p2`

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

### C4. `longcontext-001-c4`

**Criterion:** Characterizes the Sparrowgrass Court condominium as Petitioner’s separate property because it was acquired after marriage by devise or bequest, and characterizes the rent it produces as separate property because the rents, issues, and profits of separate property are themselves separate property (Fam. Code, sec. 770(a)(2), (a)(3)).

#### Proposition `longcontext-001-p3`

> Separate property of a married person includes all property acquired by the person after marriage by gift, bequest, devise, or descent, and the rents, issues, and profits of that property.

**Verbatim authoritative excerpt relied on:**

```text
Separate property of a married person includes all of the following: (1) All property owned by the person before marriage. (2) All property acquired by the person after marriage by gift, bequest, devise, or descent. (3) The rents, issues, and profits of the property described in this section.
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

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `longcontext-001-a1` | contains | October 17, 2022 | — |
| `longcontext-001-a2` | statute | 771 | — |
| `longcontext-001-a3` | statute | 770 | — |
| `longcontext-001-a4` | not_contains | date of separation is February 3, 2021 | MATERIAL_FACT_INVENTION |

## 5. Your decision

```
task_id:      longcontext-001
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
  --task longcontext-001 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
