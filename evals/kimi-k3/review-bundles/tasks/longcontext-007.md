# Review packet — `longcontext-007`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `longcontext-007` |
| category | long_context |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `cb20a02ad16997ae11093e2aa8a209c888ba90fdd54da5c358e90532652da409` |
| proposition_hashes | 4 — `dfe56a96b124`, `eb93ea885bb6`, `ef147aefeb9d`, `fa11400f586f` |
| source_hashes | 3 — `889a27cf4bad`, `bc17e7487982`, `ca0c85bcc670` |

## 2. Prompt (what the model is asked)

```text
Long-context California marital fiduciary-duty problem (all parties, documents, and facts synthetic). A roughly 39,000-word consolidated litigation file is embedded in the graded turn. A transaction-file extract buried at about 83 percent depth of the ledger section establishes the operative facts: the stipulated date of separation is February 14, 2024; on June 27, 2024 the respondent assigned a 40 percent community membership interest in Harborline Systems LLC, appraised at $1,410,000.00, to his brother for $1.00, with a recital that the transfer was intended in part as a gift and with no written spousal consent anywhere in the production; and on May 3, 2024 he was presented with a Cindermill Capital rollover equity opportunity arising out of a business engagement begun during the marriage, which he subscribed for on May 22, 2024 without any written disclosure to the petitioner. An exhibit insert at mid-depth shows an earlier March 3, 2023 assignment of a 5 percent interest for $84,000.00 that carried the petitioner’s written consent and predates separation. The graded answer must apply Family Code sections 2102(a), 2102(a)(2), 1100(b), and 721(b).
```

## 3. Material criteria and their propositions

### C1. `longcontext-007-c1`

**Criterion:** Retrieves the buried transaction extract and identifies the June 27, 2024 assignment of the 40 percent Harborline Systems LLC membership interest to Respondent’s brother for $1.00, against an appraised value of $1,410,000.00 and with no written spousal consent, as a disposition of community personal property for less than fair and reasonable value and in part as a gift, which Family Code section 1100(b) prohibits without the written consent of the other spouse.

#### Proposition `longcontext-007-p3`

> A spouse may not make a gift of community personal property, or dispose of community personal property for less than fair and reasonable value, without the written consent of the other spouse.

**Verbatim authoritative excerpt relied on:**

```text
A spouse may not make a gift of community personal property, or dispose of community personal property for less than fair and reasonable value, without the written consent of the other spouse.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-1100` |
| locator | Cal. Fam. Code § 1100 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=1100> |
| source sha256 | `bc17e7487982eafd793b83be7a4eecf2b7a7df16386169223b1234bbaf769605` |

<details><summary>Full source excerpt as stored in the registry (491 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Except as provided in subdivisions (b), (c), and (d) and Sections 761 and 1103, either spouse has the management and control of the community personal property, whether acquired prior to or on or after January 1, 1975, with like absolute power of disposition, other than testamentary, as the spouse has of the separate estate of the spouse. (b) A spouse may not make a gift of community personal property, or dispose of community personal property for less than fair and reasonable value, without the written consent of the other spouse. This subdivision does not apply to gifts mutually given by both spouses to third parties and to gifts given by one spouse to the other spouse. (c) A spouse may not sell, convey, or encumber community personal property used as the family dwelling, or the furniture, furnishings, or fittings of the home, or the clothing or wearing apparel of the other spouse or minor children which is community personal property, without the written consent of the other spouse. (d) Except as provided in subdivisions (b) and (c), and in Section 1102, a spouse who is operating or managing a business or an interest in a business that is all or substantially all community personal property has the primary management and control of the business or interest. Primary management and control means that the managing spouse may act alone in all transactions but shall give prior written notice to the other spouse of any sale, lease, exchange, encumbrance, or other disposition of all or substantially all of the personal property used in the operation of the business (including personal property used for agricultural purposes), whether or not title to that property is held in the name of only one spouse. Written notice is not, however, required when prohibited by the law otherwise applicable to the transaction. Remedies for the failure by a managing spouse to give prior written notice as required by this subdivision are only as specified in Section 1101. A failure to give prior written notice shall not adversely affect the validity of a transaction nor of any interest transferred. (e) Each spouse shall act with respect to the other spouse in the management and control of the community assets and liabilities in accordance with the general rules governing fiduciary relationships which control the actions of persons having relationships of personal confidence as specified in Section 721, until such time as the assets and liabilities have been divided by the parties or by a court. This duty includes the obligation to make full disclosure to the other spouse of all material facts and information regarding the existence, characterization, and valuation of all assets in which the community has or may have an interest and debts for which the community is or may be liable, and to provide equal access to all information, records, and books that pertain to the value and character of those assets and debts, upon request.
```

</details>

### C2. `longcontext-007-c2`

**Criterion:** States that from the February 14, 2024 date of separation to distribution each party is subject to the standards provided in Section 721 as to all activities that affect the other party’s assets and liabilities, and that those standards impose a duty of the highest good faith and fair dealing under which neither spouse shall take any unfair advantage of the other.

#### Proposition `longcontext-007-p1`

> From the date of separation to the date of distribution of the community asset or liability in question, each party is subject to the standards provided in Section 721 as to all activities that affect the assets and liabilities of the other party.

**Verbatim authoritative excerpt relied on:**

```text
From the date of separation to the date of the distribution of the community or quasi-community asset or liability in question, each party is subject to the standards provided in Section 721, as to all activities that affect the assets and liabilities of the other party
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2102` |
| locator | Cal. Fam. Code § 2102 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2102> |
| source sha256 | `889a27cf4bad4085819f11404c33f78c4be728fa88c5aa17980410f7473692c6` |

<details><summary>Full source excerpt as stored in the registry (417 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) From the date of separation to the date of the distribution of the community or quasi-community asset or liability in question, each party is subject to the standards provided in Section 721, as to all activities that affect the assets and liabilities of the other party, including, but not limited to, the following activities: (1) The accurate and complete disclosure of all assets and liabilities in which the party has or may have an interest or obligation and all current earnings, accumulations, and expenses, including an immediate, full, and accurate update or augmentation to the extent there have been material changes. (2) The accurate and complete written disclosure of any investment opportunity, business opportunity, or other income-producing opportunity that presents itself after the date of separation, but that results from any investment, significant business activity outside the ordinary course of business, or other income-producing opportunity of either spouse from the date of marriage to the date of separation, inclusive. The written disclosure shall be made in sufficient time for the other spouse to make an informed decision as to whether the spouse desires to participate in the investment opportunity, business, or other potential income-producing opportunity, and for the court to resolve any dispute regarding the right of the other spouse to participate in the opportunity. In the event of nondisclosure of an investment opportunity, the division of any gain resulting from that opportunity is governed by the standard provided in Section 2556. (3) The operation or management of a business or an interest in a business in which the community may have an interest. (b) From the date that a valid, enforceable, and binding resolution of the disposition of the asset or liability in question is reached, until the asset or liability has actually been distributed, each party is subject to the standards provided in Section 721 as to all activities that affect the assets or liabilities of the other party. Once a particular asset or liability has been distributed, the duties and standards set forth in Section 721 shall end as to that asset or liability. (c) From the date of separation to the date of a valid, enforceable, and binding resolution of all issues relating to child or spousal support and professional fees, each party is subject to the standards provided in Section 721 as to all issues relating to the support and fees, including immediate, full, and accurate disclosure of all material facts and information regarding the income or expenses of the party.
```

</details>

#### Proposition `longcontext-007-p4`

> The confidential relationship between spouses imposes a duty of the highest good faith and fair dealing on each spouse, and neither shall take any unfair advantage of the other.

**Verbatim authoritative excerpt relied on:**

```text
This confidential relationship imposes a duty of the highest good faith and fair dealing on each spouse, and neither shall take any unfair advantage of the other.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-721` |
| locator | Cal. Fam. Code § 721 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=721> |
| source sha256 | `ca0c85bcc670a86ff75253090a74fc5ecd249b88d2c871e8f25a03be881d899c` |

<details><summary>Full source excerpt as stored in the registry (175 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Subject to subdivision (b), either spouse may enter into any transaction with the other, or with any other person, respecting property, which either might if unmarried. (b) Except as provided in Sections 143, 144, 146, 16040, 16047, and 21385 of the Probate Code, in transactions between themselves, spouses are subject to the general rules governing fiduciary relationships that control the actions of persons occupying confidential relations with each other. This confidential relationship imposes a duty of the highest good faith and fair dealing on each spouse, and neither shall take any unfair advantage of the other. This confidential relationship is a fiduciary relationship subject to the same rights and duties of nonmarital business partners, as provided in Sections 16403, 16404, and 16503 of the Corporations Code, including, but not limited to, the following: (1) Providing each spouse access at all times to any books kept regarding a transaction for the purposes of inspection and copying. (2) Rendering upon request, true and full information of all things affecting any transaction that concerns the community property.
```

</details>

### C3. `longcontext-007-c3`

**Criterion:** Applies Family Code section 2102(a)(2) to the buried May 3, 2024 Cindermill rollover equity offering: because it presented itself after the date of separation but resulted from a business activity begun during the marriage, Respondent owed accurate and complete written disclosure in sufficient time for Petitioner to make an informed decision whether to participate, and no such written disclosure was made.

#### Proposition `longcontext-007-p2`

> A party must make accurate and complete written disclosure of any investment or other income-producing opportunity presenting itself after the date of separation that results from an investment or significant business activity of either spouse between the date of marriage and the date of separation, in sufficient time for the other spouse to make an informed decision whether to participate.

**Verbatim authoritative excerpt relied on:**

```text
The accurate and complete written disclosure of any investment opportunity, business opportunity, or other income-producing opportunity that presents itself after the date of separation, but that results from any investment, significant business activity outside the ordinary course of business, or other income-producing opportunity of either spouse from the date of marriage to the date of separation, inclusive. The written disclosure shall be made in sufficient time for the other spouse to make an informed decision as to whether the spouse desires to participate in the investment opportunity, business, or other potential income-producing opportunity
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2102` |
| locator | Cal. Fam. Code § 2102 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2102> |
| source sha256 | `889a27cf4bad4085819f11404c33f78c4be728fa88c5aa17980410f7473692c6` |

<details><summary>Full source excerpt as stored in the registry (417 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) From the date of separation to the date of the distribution of the community or quasi-community asset or liability in question, each party is subject to the standards provided in Section 721, as to all activities that affect the assets and liabilities of the other party, including, but not limited to, the following activities: (1) The accurate and complete disclosure of all assets and liabilities in which the party has or may have an interest or obligation and all current earnings, accumulations, and expenses, including an immediate, full, and accurate update or augmentation to the extent there have been material changes. (2) The accurate and complete written disclosure of any investment opportunity, business opportunity, or other income-producing opportunity that presents itself after the date of separation, but that results from any investment, significant business activity outside the ordinary course of business, or other income-producing opportunity of either spouse from the date of marriage to the date of separation, inclusive. The written disclosure shall be made in sufficient time for the other spouse to make an informed decision as to whether the spouse desires to participate in the investment opportunity, business, or other potential income-producing opportunity, and for the court to resolve any dispute regarding the right of the other spouse to participate in the opportunity. In the event of nondisclosure of an investment opportunity, the division of any gain resulting from that opportunity is governed by the standard provided in Section 2556. (3) The operation or management of a business or an interest in a business in which the community may have an interest. (b) From the date that a valid, enforceable, and binding resolution of the disposition of the asset or liability in question is reached, until the asset or liability has actually been distributed, each party is subject to the standards provided in Section 721 as to all activities that affect the assets or liabilities of the other party. Once a particular asset or liability has been distributed, the duties and standards set forth in Section 721 shall end as to that asset or liability. (c) From the date of separation to the date of a valid, enforceable, and binding resolution of all issues relating to child or spousal support and professional fees, each party is subject to the standards provided in Section 721 as to all issues relating to the support and fees, including immediate, full, and accurate disclosure of all material facts and information regarding the income or expenses of the party.
```

</details>

### C4. `longcontext-007-c4`

**Criterion:** Distinguishes the March 3, 2023 assignment of the 5 percent interest, which predates the February 14, 2024 separation and carries Petitioner’s endorsed written consent, and therefore does not present the section 1100(b) written-consent problem.

#### Proposition `longcontext-007-p3`

> A spouse may not make a gift of community personal property, or dispose of community personal property for less than fair and reasonable value, without the written consent of the other spouse.

**Verbatim authoritative excerpt relied on:**

```text
A spouse may not make a gift of community personal property, or dispose of community personal property for less than fair and reasonable value, without the written consent of the other spouse.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-1100` |
| locator | Cal. Fam. Code § 1100 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=1100> |
| source sha256 | `bc17e7487982eafd793b83be7a4eecf2b7a7df16386169223b1234bbaf769605` |

<details><summary>Full source excerpt as stored in the registry (491 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Except as provided in subdivisions (b), (c), and (d) and Sections 761 and 1103, either spouse has the management and control of the community personal property, whether acquired prior to or on or after January 1, 1975, with like absolute power of disposition, other than testamentary, as the spouse has of the separate estate of the spouse. (b) A spouse may not make a gift of community personal property, or dispose of community personal property for less than fair and reasonable value, without the written consent of the other spouse. This subdivision does not apply to gifts mutually given by both spouses to third parties and to gifts given by one spouse to the other spouse. (c) A spouse may not sell, convey, or encumber community personal property used as the family dwelling, or the furniture, furnishings, or fittings of the home, or the clothing or wearing apparel of the other spouse or minor children which is community personal property, without the written consent of the other spouse. (d) Except as provided in subdivisions (b) and (c), and in Section 1102, a spouse who is operating or managing a business or an interest in a business that is all or substantially all community personal property has the primary management and control of the business or interest. Primary management and control means that the managing spouse may act alone in all transactions but shall give prior written notice to the other spouse of any sale, lease, exchange, encumbrance, or other disposition of all or substantially all of the personal property used in the operation of the business (including personal property used for agricultural purposes), whether or not title to that property is held in the name of only one spouse. Written notice is not, however, required when prohibited by the law otherwise applicable to the transaction. Remedies for the failure by a managing spouse to give prior written notice as required by this subdivision are only as specified in Section 1101. A failure to give prior written notice shall not adversely affect the validity of a transaction nor of any interest transferred. (e) Each spouse shall act with respect to the other spouse in the management and control of the community assets and liabilities in accordance with the general rules governing fiduciary relationships which control the actions of persons having relationships of personal confidence as specified in Section 721, until such time as the assets and liabilities have been divided by the parties or by a court. This duty includes the obligation to make full disclosure to the other spouse of all material facts and information regarding the existence, characterization, and valuation of all assets in which the community has or may have an interest and debts for which the community is or may be liable, and to provide equal access to all information, records, and books that pertain to the value and character of those assets and debts, upon request.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `longcontext-007-a1` | contains | June 27, 2024 | — |
| `longcontext-007-a2` | statute | 1100 | — |
| `longcontext-007-a3` | contains | written consent | — |
| `longcontext-007-a4` | not_contains | without the written consent of Petitioner on March 3, 2023 | MATERIAL_FACT_INVENTION |

## 5. Your decision

```
task_id:      longcontext-007
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
  --task longcontext-007 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
