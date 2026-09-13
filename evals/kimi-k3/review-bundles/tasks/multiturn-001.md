# Review packet — `multiturn-001`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `multiturn-001` |
| category | multi_turn |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `f9471bed6285dd85c4b49f1c475bc0370f5972f2b0786e66595d97a0214eef97` |
| proposition_hashes | 5 — `3c1b79779b96`, `4605ad81b619`, `6236945dbc8e`, `7c4a21fab2b1`, `da8e614f0592` |
| source_hashes | 5 — `76d3e069a8fd`, `a738d13f431d`, `b3632d7bb921`, `c32e4a3242ed`, `fb7294173087` |

## 2. Prompt (what the model is asked)

```text
Multi-turn dissolution consultation (all parties and facts synthetic). Turn 1 established that Rosalind Achterberg-Nyad and Priya Vantongeren married in California in 2013 and asked how property acquired during the marriage is characterized. Turn 3 revealed that they signed a premarital agreement on June 14, 2021 containing a spousal-support waiver, that Priya was first handed the final version on June 11, 2021 and signed it three days later, and that Priya had no lawyer of her own. Turn 5, the graded turn, additionally reveals that the parties separated on March 2, 2025 and that Rosalind has earned consulting income since then, and asks for one integrated answer covering (a) how the consulting income earned after separation is characterized, (b) whether the spousal-support waiver is enforceable, (c) whether the agreement was executed voluntarily under the seven-day rule, and (d) how the remaining community estate is divided. The answer must integrate all facts accumulated across the conversation, using only the supplied Family Code authority.
```

### Conversation (5 turns; only the final user turn is graded)

**Turn 1 — user**

```text
I am consulting about a California dissolution. Rosalind Achterberg-Nyad and Priya Vantongeren married in Los Angeles in 2013 and have lived in California the whole time. As a starting point, how is property that either of them acquired during the marriage characterized?
```

**Turn 2 — assistant**

```text
Under the Family Code, property acquired by a married person during the marriage while domiciled in California is community property except as otherwise provided by statute, and property owned before marriage or acquired by gift, bequest, devise, or descent is that person's separate property.
```

**Turn 3 — user**

```text
One thing I left out. They signed a premarital agreement on June 14, 2021. It has an article waiving spousal support both ways. Priya was first handed the final version on June 11, 2021 and signed it three days later, and she did not have a lawyer of her own at any point. Does that change anything?
```

**Turn 4 — assistant**

```text
It may. Premarital agreements have their own enforceability rules, including a specific rule about spousal-support provisions and a timing requirement tied to when the party was first presented with the final agreement.
```

**Turn 5 — user** **(graded)**

```text
Last piece: they separated on March 2, 2025, and since that date Rosalind has been earning roughly $14,000 a month in consulting fees that she has deposited into an account in her own name. Please give me one integrated answer: how is that post-separation consulting income characterized, is the spousal-support waiver enforceable against Priya, was the agreement executed voluntarily under the seven-day rule, and how does the court divide whatever community estate remains?
```

## 3. Material criteria and their propositions

### C1. `multiturn-001-c1`

**Criterion:** Characterizes the consulting income Rosalind earned after the March 2, 2025 separation as her separate property, because earnings and accumulations of a spouse after the date of separation are the separate property of that spouse (Fam. Code, sec. 771(a)).

#### Proposition `multiturn-001-p2`

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

### C2. `multiturn-001-c2`

**Criterion:** States the general community-property rule carried over from turn 1: property acquired by a married person during the marriage while domiciled in California is community property except as otherwise provided by statute (Fam. Code, sec. 760).

#### Proposition `multiturn-001-p1`

> Except as otherwise provided by statute, all property acquired by a married person during the marriage while domiciled in California is community property.

**Verbatim authoritative excerpt relied on:**

```text
all property, real or personal, wherever situated, acquired by a married person during the marriage while domiciled in this state is community property
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

### C3. `multiturn-001-c3`

**Criterion:** Applies Family Code section 1612(c) to the turn-3 facts: because Priya was not represented by independent counsel when she signed, the spousal-support waiver is not enforceable against her.

#### Proposition `multiturn-001-p4`

> A premarital-agreement provision regarding spousal support, including a waiver of it, is not enforceable if the party against whom enforcement of the spousal support provision is sought was not represented by independent counsel at the time the agreement containing the provision was signed.

**Verbatim authoritative excerpt relied on:**

```text
Any provision in a premarital agreement regarding spousal support, including, but not limited to, a waiver of it, is not enforceable if the party against whom enforcement of the spousal support provision is sought was not represented by independent counsel at the time the agreement containing the provision was signed
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-1612` |
| locator | Cal. Fam. Code § 1612 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2002 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=1612> |
| source sha256 | `a738d13f431daa0bb4fec854e3cb725a9bd16a40306dcfc2942d70bcb3fe1bfb` |

<details><summary>Full source excerpt as stored in the registry (269 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Parties to a premarital agreement may contract with respect to all of the following: (1) The rights and obligations of each of the parties in any of the property of either or both of them whenever and wherever acquired or located. (2) The right to buy, sell, use, transfer, exchange, abandon, lease, consume, expend, assign, create a security interest in, mortgage, encumber, dispose of, or otherwise manage and control property. (3) The disposition of property upon separation, marital dissolution, death, or the occurrence or nonoccurrence of any other event. (4) The making of a will, trust, or other arrangement to carry out the provisions of the agreement. (5) The ownership rights in and disposition of the death benefit from a life insurance policy. (6) The choice of law governing the construction of the agreement. (7) Any other matter, including their personal rights and obligations, not in violation of public policy or a statute imposing a criminal penalty. (b) The right of a child to support may not be adversely affected by a premarital agreement. (c) Any provision in a premarital agreement regarding spousal support, including, but not limited to, a waiver of it, is not enforceable if the party against whom enforcement of the spousal support provision is sought was not represented by independent counsel at the time the agreement containing the provision was signed, or if the provision regarding spousal support is unconscionable at the time of enforcement. An otherwise unenforceable provision in a premarital agreement regarding spousal support may not become enforceable solely because the party against whom enforcement is sought was represented by independent counsel.
```

</details>

### C4. `multiturn-001-c4`

**Criterion:** Applies the section 1615(c)(2)(B) seven-calendar-day requirement to an agreement executed on or after January 1, 2020, and identifies that a June 11 to June 14, 2021 interval is less than seven calendar days between first presentation of the final agreement and signature, regardless of representation.

#### Proposition `multiturn-001-p3`

> For a premarital agreement executed on or after January 1, 2020, voluntary execution requires that the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel.

**Verbatim authoritative excerpt relied on:**

```text
For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-1615` |
| locator | Cal. Fam. Code § 1615 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=1615> |
| source sha256 | `c32e4a3242ed779cec8b59a6c7f1f971b848da951ec7278c551e6815fba2239a` |

<details><summary>Full source excerpt as stored in the registry (551 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) A premarital agreement is not enforceable if the party against whom enforcement is sought proves either of the following: (1) That party did not execute the agreement voluntarily. (2) The agreement was unconscionable when it was executed and, before execution of the agreement, all of the following applied to that party: (A) That party was not provided a fair, reasonable, and full disclosure of the property or financial obligations of the other party. (B) That party did not voluntarily and expressly waive, in writing, any right to disclosure of the property or financial obligations of the other party beyond the disclosure provided. (C) That party did not have, or reasonably could not have had, an adequate knowledge of the property or financial obligations of the other party. (b) An issue of unconscionability of a premarital agreement shall be decided by the court as a matter of law. (c) For the purposes of subdivision (a), it shall be deemed that a premarital agreement was not executed voluntarily unless the court finds in writing or on the record all of the following: (1) The party against whom enforcement is sought was represented by independent legal counsel at the time of signing the agreement or, after being advised to seek independent legal counsel, expressly waived, in a separate writing, representation by independent legal counsel. The advisement to seek independent legal counsel shall be made at least seven calendar days before the final agreement is signed. (2) One of the following: (A) For an agreement executed between January 1, 2002, and January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and advised to seek independent legal counsel and the time the agreement was signed. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement. (B) For an agreement executed on or after January 1, 2020, the party against whom enforcement is sought had not less than seven calendar days between the time that party was first presented with the final agreement and the time the agreement was signed, regardless of whether the party is represented by legal counsel. This requirement does not apply to nonsubstantive amendments that do not change the terms of the agreement. (3) The party against whom enforcement is sought, if unrepresented by legal counsel, was fully informed of the terms and basic effect of the agreement as well as the rights and obligations the party was giving up by signing the agreement, and was proficient in the language in which the explanation of the party’s rights was conducted and in which the agreement was written. The explanation of the rights and obligations relinquished shall be memorialized in writing and delivered to the party prior to signing the agreement. The unrepresented party shall, on or before the signing of the premarital agreement, execute a document declaring that the party received the information required by this paragraph and indicating who provided that information. (4) The agreement and the writings executed pursuant to paragraphs (1) and (3) were not executed under duress, fraud, or undue influence, and the parties did not lack capacity to enter into the agreement. (5) Any other factors the court deems relevant.
```

</details>

### C5. `multiturn-001-c5`

**Criterion:** States that the court divides the remaining community estate equally under Family Code section 2550 absent a written agreement of the parties or an oral stipulation in open court.

#### Proposition `multiturn-001-p5`

> In a proceeding for dissolution of marriage the court shall divide the community estate of the parties equally, except upon the written agreement of the parties, on oral stipulation in open court, or as otherwise provided in the division.

**Verbatim authoritative excerpt relied on:**

```text
divide the community estate of the parties equally
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2550` |
| locator | Cal. Fam. Code § 2550 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2550> |
| source sha256 | `76d3e069a8fd3ea8b2c5793ca897a897d5726c067e755bc4ec5a96fc1d5d7384` |

<details><summary>Full source excerpt as stored in the registry (84 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
Except upon the written agreement of the parties, or on oral stipulation of the parties in open court, or as otherwise provided in this division, in a proceeding for dissolution of marriage or for legal separation of the parties, the court shall, either in its judgment of dissolution of the marriage, in its judgment of legal separation of the parties, or at a later time if it expressly reserves jurisdiction to make such a property division, divide the community estate of the parties equally.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `multiturn-001-a1` | statute | 771 | — |
| `multiturn-001-a2` | statute | 1615 | — |
| `multiturn-001-a3` | contains | seven calendar days | WRONG_EFFECTIVE_DATE |
| `multiturn-001-a4` | contains | equally | — |

## 5. Your decision

```
task_id:      multiturn-001
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
  --task multiturn-001 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
