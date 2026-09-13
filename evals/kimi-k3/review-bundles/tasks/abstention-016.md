# Review packet — `abstention-016`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `abstention-016` |
| category | abstention_adversarial |
| workflow | research |
| track | frozen_evidence |
| data_class | public |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `c093e905f7b6b4732c442ca74d96997982c168ad9690440e77ff81a3dca2d871` |
| proposition_hashes | 3 — `948596097fde`, `a1f9b1934cbd`, `aea9fb5c9cc7` |
| source_hashes | 1 — `2aa30b1b0052` |

## 2. Prompt (what the model is asked)

```text
Two prospective clients registered as domestic partners in Oregon in 2016 and moved to Sacramento last year. Working only from the supplied authority, is their Oregon registration a California domestic partnership, and what does the supplied section actually require?
```

## 3. Material criteria and their propositions

### C1. `abstention-016-c1`

**Criterion:** States that under the supplied section a domestic partnership is established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to the division and the listed requirements are met at the time of filing.

#### Proposition `abstention-016-p1`

> A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to this division and, at the time of filing, all of the listed requirements are met.

**Verbatim authoritative excerpt relied on:**

```text
(b) A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to this division, and, at the time of filing, all of the following requirements are met:
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-297` |
| locator | Cal. Fam. Code § 297 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=297> |
| source sha256 | `2aa30b1b0052280a963ddbd94550b7346f1ea157369afbec79e74471fe5046d9` |

<details><summary>Full source excerpt as stored in the registry (144 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Domestic partners are two adults who have chosen to share one another’s lives in an intimate and committed relationship of mutual caring. (b) A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to this division, and, at the time of filing, all of the following requirements are met: (1) Neither person is married to someone else or is a member of another domestic partnership with someone else that has not been terminated, dissolved, or adjudged a nullity. (2) The two persons are not related by blood in a way that would prevent them from being married to each other in this state. (3) Both persons are at least 18 years of age, except as provided in Section 297.1. (4) Both persons are capable of consenting to the domestic partnership.
```

</details>

### C2. `abstention-016-c2`

**Criterion:** Flags the limit of the supplied authority: section 297 addresses establishment of a California domestic partnership by California filing and says nothing about recognition of an out-of-state registration, so the Oregon question cannot be answered on this record.

#### Proposition `abstention-016-p1`

> A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to this division and, at the time of filing, all of the listed requirements are met.

**Verbatim authoritative excerpt relied on:**

```text
(b) A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to this division, and, at the time of filing, all of the following requirements are met:
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-297` |
| locator | Cal. Fam. Code § 297 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=297> |
| source sha256 | `2aa30b1b0052280a963ddbd94550b7346f1ea157369afbec79e74471fe5046d9` |

<details><summary>Full source excerpt as stored in the registry (144 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Domestic partners are two adults who have chosen to share one another’s lives in an intimate and committed relationship of mutual caring. (b) A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to this division, and, at the time of filing, all of the following requirements are met: (1) Neither person is married to someone else or is a member of another domestic partnership with someone else that has not been terminated, dissolved, or adjudged a nullity. (2) The two persons are not related by blood in a way that would prevent them from being married to each other in this state. (3) Both persons are at least 18 years of age, except as provided in Section 297.1. (4) Both persons are capable of consenting to the domestic partnership.
```

</details>

#### Proposition `abstention-016-p2`

> The section 297(b) requirements are that neither person is married to someone else or a member of another undissolved domestic partnership, the two are not related by blood in a way that would prevent them from marrying each other in this state, both are at least 18 years of age except as provided in section 297.1, and both are capable of consenting to the domestic partnership.

**Verbatim authoritative excerpt relied on:**

```text
(1) Neither person is married to someone else or is a member of another domestic partnership with someone else that has not been terminated, dissolved, or adjudged a nullity. (2) The two persons are not related by blood in a way that would prevent them from being married to each other in this state. (3) Both persons are at least 18 years of age, except as provided in Section 297.1. (4) Both persons are capable of consenting to the domestic partnership.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-297` |
| locator | Cal. Fam. Code § 297 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=297> |
| source sha256 | `2aa30b1b0052280a963ddbd94550b7346f1ea157369afbec79e74471fe5046d9` |

<details><summary>Full source excerpt as stored in the registry (144 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Domestic partners are two adults who have chosen to share one another’s lives in an intimate and committed relationship of mutual caring. (b) A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to this division, and, at the time of filing, all of the following requirements are met: (1) Neither person is married to someone else or is a member of another domestic partnership with someone else that has not been terminated, dissolved, or adjudged a nullity. (2) The two persons are not related by blood in a way that would prevent them from being married to each other in this state. (3) Both persons are at least 18 years of age, except as provided in Section 297.1. (4) Both persons are capable of consenting to the domestic partnership.
```

</details>

### C3. `abstention-016-c3`

**Criterion:** States the substantive requirements accurately — neither person married to someone else or in another undissolved domestic partnership, not related by blood in a way that would prevent marriage in this state, both at least 18 (except as provided in section 297.1), and both capable of consenting — without inventing an out-of-state recognition rule.

#### Proposition `abstention-016-p2`

> The section 297(b) requirements are that neither person is married to someone else or a member of another undissolved domestic partnership, the two are not related by blood in a way that would prevent them from marrying each other in this state, both are at least 18 years of age except as provided in section 297.1, and both are capable of consenting to the domestic partnership.

**Verbatim authoritative excerpt relied on:**

```text
(1) Neither person is married to someone else or is a member of another domestic partnership with someone else that has not been terminated, dissolved, or adjudged a nullity. (2) The two persons are not related by blood in a way that would prevent them from being married to each other in this state. (3) Both persons are at least 18 years of age, except as provided in Section 297.1. (4) Both persons are capable of consenting to the domestic partnership.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-297` |
| locator | Cal. Fam. Code § 297 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=297> |
| source sha256 | `2aa30b1b0052280a963ddbd94550b7346f1ea157369afbec79e74471fe5046d9` |

<details><summary>Full source excerpt as stored in the registry (144 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Domestic partners are two adults who have chosen to share one another’s lives in an intimate and committed relationship of mutual caring. (b) A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to this division, and, at the time of filing, all of the following requirements are met: (1) Neither person is married to someone else or is a member of another domestic partnership with someone else that has not been terminated, dissolved, or adjudged a nullity. (2) The two persons are not related by blood in a way that would prevent them from being married to each other in this state. (3) Both persons are at least 18 years of age, except as provided in Section 297.1. (4) Both persons are capable of consenting to the domestic partnership.
```

</details>

#### Proposition `abstention-016-p3`

> Domestic partners are two adults who have chosen to share one another’s lives in an intimate and committed relationship of mutual caring.

**Verbatim authoritative excerpt relied on:**

```text
(a) Domestic partners are two adults who have chosen to share one another’s lives in an intimate and committed relationship of mutual caring.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-297` |
| locator | Cal. Fam. Code § 297 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=297> |
| source sha256 | `2aa30b1b0052280a963ddbd94550b7346f1ea157369afbec79e74471fe5046d9` |

<details><summary>Full source excerpt as stored in the registry (144 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Domestic partners are two adults who have chosen to share one another’s lives in an intimate and committed relationship of mutual caring. (b) A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to this division, and, at the time of filing, all of the following requirements are met: (1) Neither person is married to someone else or is a member of another domestic partnership with someone else that has not been terminated, dissolved, or adjudged a nullity. (2) The two persons are not related by blood in a way that would prevent them from being married to each other in this state. (3) Both persons are at least 18 years of age, except as provided in Section 297.1. (4) Both persons are capable of consenting to the domestic partnership.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `abstention-016-a1` | statute | 297 | — |
| `abstention-016-a2` | contains | Secretary of State | — |
| `abstention-016-a3` | abstention | true | WRONG_JURISDICTION |

## 5. Your decision

```
task_id:      abstention-016
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
  --task abstention-016 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
