# Review packet — `multiturn-011`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `multiturn-011` |
| category | multi_turn |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `c635d63cf809a19fa6ad869e964f401e39591b8907d003aaf949cdf9b6b766d2` |
| proposition_hashes | 6 — `7067ab4394d9`, `8e8694cbf245`, `9ee393f9719a`, `beaa81ff9c76`, `c58d10093f19`, `fc02958c8e55` |
| source_hashes | 3 — `2aa30b1b0052`, `7fef0e8209c3`, `b8ff3a1559a1` |

## 2. Prompt (what the model is asked)

```text
Multi-turn consultation testing context carryover (all parties and facts synthetic). Turn 1 established that Devanshi Rakotomalala and Wren Aubuchon-Silva filed a Declaration of Domestic Partnership with the California Secretary of State on May 12, 2015 and have never married. Turn 3 asked about their property rights as registered domestic partners. Turn 5, the graded turn, asks whether they may end the partnership by filing a Notice of Termination of Domestic Partnership - given that the partnership has run about eleven years, they own no real property, and there are no children - and when termination would take effect. The correct answer must carry forward the registered-domestic-partnership setup from turn 1 and apply the summary-termination conditions, including the duration condition that disqualifies an eleven-year partnership, plus the effective-date rule and the fallback dissolution procedure.
```

### Conversation (5 turns; only the final user turn is graded)

**Turn 1 — user**

```text
Devanshi Rakotomalala and Wren Aubuchon-Silva filed a Declaration of Domestic Partnership with the California Secretary of State on May 12, 2015. They have never married each other. I want to keep that setup in mind for everything that follows.
```

**Turn 2 — assistant**

```text
Understood. A California domestic partnership is established when both persons file a Declaration of Domestic Partnership with the Secretary of State and the statutory requirements are met at the time of filing.
```

**Turn 3 — user**

```text
First question. What are their rights as to each other's property and obligations, compared with a married couple?
```

**Turn 4 — assistant**

```text
Registered domestic partners have the same rights, protections, and benefits, and are subject to the same responsibilities, obligations, and duties under law, as are granted to and imposed upon spouses.
```

**Turn 5 — user** **(graded)**

```text
Now the real question. They want to end it. The partnership has run about eleven years, they own no real property anywhere, there are no children of the relationship, and they have already agreed in writing on splitting what little they own. Can they simply file a Notice of Termination of Domestic Partnership with the Secretary of State, and if so when does the termination take effect?
```

## 3. Material criteria and their propositions

### C1. `multiturn-011-c1`

**Criterion:** Carries forward the turn-1 setup and answers on the registered-domestic-partnership framework established by the May 12, 2015 filing of a Declaration of Domestic Partnership with the Secretary of State, rather than a marriage framework.

#### Proposition `multiturn-011-p1`

> A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to the division and the listed requirements are met at the time of filing.

**Verbatim authoritative excerpt relied on:**

```text
(b) A domestic partnership shall be established in California when both persons file a Declaration of Domestic Partnership with the Secretary of State pursuant to this division
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

#### Proposition `multiturn-011-p2`

> Registered domestic partners have the same rights, protections, and benefits, and the same responsibilities, obligations, and duties under law, as are granted to and imposed upon spouses.

**Verbatim authoritative excerpt relied on:**

```text
Registered domestic partners shall have the same rights, protections, and benefits, and shall be subject to the same responsibilities, obligations, and duties under law, whether they derive from statutes, administrative regulations, court rules, government policies, common law, or any other provisions or sources of law, as are granted to and imposed upon spouses.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-297-5` |
| locator | Cal. Fam. Code § 297.5 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2007 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=297.5> |
| source sha256 | `b8ff3a1559a114d68ca31a4e3646150364bdce037b3bed72ba1c3fb447bb2d66` |

<details><summary>Full source excerpt as stored in the registry (53 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
Registered domestic partners shall have the same rights, protections, and benefits, and shall be subject to the same responsibilities, obligations, and duties under law, whether they derive from statutes, administrative regulations, court rules, government policies, common law, or any other provisions or sources of law, as are granted to and imposed upon spouses.
```

</details>

### C2. `multiturn-011-c2`

**Criterion:** States that summary termination by filing a Notice of Termination of Domestic Partnership is available only if all of the statutory conditions exist at the time of filing.

#### Proposition `multiturn-011-p3`

> A registered domestic partnership may be terminated without a dissolution proceeding by filing a Notice of Termination of Domestic Partnership with the Secretary of State only if all of the listed conditions exist at the time of filing.

**Verbatim authoritative excerpt relied on:**

```text
(a) A registered domestic partnership may be terminated without filing a proceeding for dissolution of domestic partnership by the filing of a Notice of Termination of Domestic Partnership with the Secretary of State pursuant to this section, provided that all of the following conditions exist at the time of the filing
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-299` |
| locator | Cal. Fam. Code § 299(a)-(d) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2011 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=299> |
| source sha256 | `7fef0e8209c35be760ccf70f3d737db950084a8ea485fbe5204cfc565de2134b` |

<details><summary>Full source excerpt as stored in the registry (792 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) A registered domestic partnership may be terminated without filing a proceeding for dissolution of domestic partnership by the filing of a Notice of Termination of Domestic Partnership with the Secretary of State pursuant to this section, provided that all of the following conditions exist at the time of the filing: (1) The Notice of Termination of Domestic Partnership is signed by both registered domestic partners. (2) There are no children of the relationship of the parties born before or after registration of the domestic partnership or adopted by the parties after registration of the domestic partnership, and neither of the registered domestic partners, to their knowledge, is pregnant. (3) The registered domestic partnership is not more than five years in duration. (4) Neither party has any interest in real property wherever situated, with the exception of the lease of a residence occupied by either party which satisfies the following requirements: (A) The lease does not include an option to purchase. (B) The lease terminates within one year from the date of filing of the Notice of Termination of Domestic Partnership. (5) There are no unpaid obligations in excess of the amount described in paragraph (6) of subdivision (a) of Section 2400, as adjusted by subdivision (b) of Section 2400, incurred by either or both of the parties after registration of the domestic partnership, excluding the amount of any unpaid obligation with respect to an automobile. (6) The total fair market value of community property assets, excluding all encumbrances and automobiles, including any deferred compensation or retirement plan, is less than the amount described in paragraph (7) of subdivision (a) of Section 2400, as adjusted by subdivision (b) of Section 2400, and neither party has separate property assets, excluding all encumbrances and automobiles, in excess of that amount. (7) The parties have executed an agreement setting forth the division of assets and the assumption of liabilities of the community property, and have executed any documents, title certificates, bills of sale, or other evidence of transfer necessary to effectuate the agreement. (8) The parties waive any rights to support by the other domestic partner. (9) The parties have read and understand a brochure prepared by the Secretary of State describing the requirements, nature, and effect of terminating a domestic partnership. (10) Both parties desire that the domestic partnership be terminated. (b) The registered domestic partnership shall be terminated effective six months after the date of filing of the Notice of Termination of Domestic Partnership with the Secretary of State pursuant to this section, provided that neither party has, before that date, filed with the Secretary of State a notice of revocation of the termination of domestic partnership, in the form and content as shall be prescribed by the Secretary of State, and sent to the other party a copy of the notice of revocation by first-class mail, postage prepaid, at the other party’s last known address. The effect of termination of a domestic partnership pursuant to this section shall be the same as, and shall be treated for all purposes as, the entry of a judgment of dissolution of a domestic partnership. (c) The termination of a domestic partnership pursuant to subdivision (b) does not prejudice nor bar the rights of either of the parties to institute an action in the superior court to set aside the termination for fraud, duress, mistake, or any other ground recognized at law or in equity. A court may set aside the termination of domestic partnership and declare the termination of the domestic partnership null and void upon proof that the parties did not meet the requirements of subdivision (a) at the time of the filing of the Notice of Termination of Domestic Partnership with the Secretary of State. (d) The superior courts shall have jurisdiction over all proceedings relating to the dissolution of domestic partnerships, nullity of domestic partnerships, and legal separation of partners in a domestic partnership. The dissolution of a domestic partnership, nullity of a domestic partnership, and legal separation of partners in a domestic partnership shall follow the same procedures, and the partners shall possess the same rights, protections, and benefits, and be subject to the same responsibilities, obligations, and duties, as apply to the dissolution of marriage, nullity of marriage, and legal separation of spouses in a marriage, respectively, except as provided in subdivision (a), and except that, in accordance with the consent acknowledged by domestic partners in the Declaration of Domestic Partnership form, proceedings for dissolution, nullity, or legal separation of a domestic partnership registered in this state may be filed in the superior courts of this state even if neither domestic partner is a resident of, or maintains a domicile in, the state at the time the proceedings are filed.
```

</details>

### C3. `multiturn-011-c3`

**Criterion:** Applies the duration condition to the carried-over facts: because the registered domestic partnership must be not more than five years in duration and this one has run about eleven years, the couple does not qualify for the Notice of Termination route.

#### Proposition `multiturn-011-p4`

> One of the conditions for summary termination is that the registered domestic partnership is not more than five years in duration.

**Verbatim authoritative excerpt relied on:**

```text
(3) The registered domestic partnership is not more than five years in duration.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-299` |
| locator | Cal. Fam. Code § 299(a)-(d) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2011 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=299> |
| source sha256 | `7fef0e8209c35be760ccf70f3d737db950084a8ea485fbe5204cfc565de2134b` |

<details><summary>Full source excerpt as stored in the registry (792 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) A registered domestic partnership may be terminated without filing a proceeding for dissolution of domestic partnership by the filing of a Notice of Termination of Domestic Partnership with the Secretary of State pursuant to this section, provided that all of the following conditions exist at the time of the filing: (1) The Notice of Termination of Domestic Partnership is signed by both registered domestic partners. (2) There are no children of the relationship of the parties born before or after registration of the domestic partnership or adopted by the parties after registration of the domestic partnership, and neither of the registered domestic partners, to their knowledge, is pregnant. (3) The registered domestic partnership is not more than five years in duration. (4) Neither party has any interest in real property wherever situated, with the exception of the lease of a residence occupied by either party which satisfies the following requirements: (A) The lease does not include an option to purchase. (B) The lease terminates within one year from the date of filing of the Notice of Termination of Domestic Partnership. (5) There are no unpaid obligations in excess of the amount described in paragraph (6) of subdivision (a) of Section 2400, as adjusted by subdivision (b) of Section 2400, incurred by either or both of the parties after registration of the domestic partnership, excluding the amount of any unpaid obligation with respect to an automobile. (6) The total fair market value of community property assets, excluding all encumbrances and automobiles, including any deferred compensation or retirement plan, is less than the amount described in paragraph (7) of subdivision (a) of Section 2400, as adjusted by subdivision (b) of Section 2400, and neither party has separate property assets, excluding all encumbrances and automobiles, in excess of that amount. (7) The parties have executed an agreement setting forth the division of assets and the assumption of liabilities of the community property, and have executed any documents, title certificates, bills of sale, or other evidence of transfer necessary to effectuate the agreement. (8) The parties waive any rights to support by the other domestic partner. (9) The parties have read and understand a brochure prepared by the Secretary of State describing the requirements, nature, and effect of terminating a domestic partnership. (10) Both parties desire that the domestic partnership be terminated. (b) The registered domestic partnership shall be terminated effective six months after the date of filing of the Notice of Termination of Domestic Partnership with the Secretary of State pursuant to this section, provided that neither party has, before that date, filed with the Secretary of State a notice of revocation of the termination of domestic partnership, in the form and content as shall be prescribed by the Secretary of State, and sent to the other party a copy of the notice of revocation by first-class mail, postage prepaid, at the other party’s last known address. The effect of termination of a domestic partnership pursuant to this section shall be the same as, and shall be treated for all purposes as, the entry of a judgment of dissolution of a domestic partnership. (c) The termination of a domestic partnership pursuant to subdivision (b) does not prejudice nor bar the rights of either of the parties to institute an action in the superior court to set aside the termination for fraud, duress, mistake, or any other ground recognized at law or in equity. A court may set aside the termination of domestic partnership and declare the termination of the domestic partnership null and void upon proof that the parties did not meet the requirements of subdivision (a) at the time of the filing of the Notice of Termination of Domestic Partnership with the Secretary of State. (d) The superior courts shall have jurisdiction over all proceedings relating to the dissolution of domestic partnerships, nullity of domestic partnerships, and legal separation of partners in a domestic partnership. The dissolution of a domestic partnership, nullity of a domestic partnership, and legal separation of partners in a domestic partnership shall follow the same procedures, and the partners shall possess the same rights, protections, and benefits, and be subject to the same responsibilities, obligations, and duties, as apply to the dissolution of marriage, nullity of marriage, and legal separation of spouses in a marriage, respectively, except as provided in subdivision (a), and except that, in accordance with the consent acknowledged by domestic partners in the Declaration of Domestic Partnership form, proceedings for dissolution, nullity, or legal separation of a domestic partnership registered in this state may be filed in the superior courts of this state even if neither domestic partner is a resident of, or maintains a domicile in, the state at the time the proceedings are filed.
```

</details>

### C4. `multiturn-011-c4`

**Criterion:** States the effective-date rule that a qualifying summary termination takes effect six months after the date of filing of the Notice with the Secretary of State.

#### Proposition `multiturn-011-p5`

> A registered domestic partnership terminated under this route is terminated effective six months after the date of filing of the Notice of Termination of Domestic Partnership with the Secretary of State, absent a timely notice of revocation.

**Verbatim authoritative excerpt relied on:**

```text
(b) The registered domestic partnership shall be terminated effective six months after the date of filing of the Notice of Termination of Domestic Partnership with the Secretary of State pursuant to this section
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-299` |
| locator | Cal. Fam. Code § 299(a)-(d) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2011 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=299> |
| source sha256 | `7fef0e8209c35be760ccf70f3d737db950084a8ea485fbe5204cfc565de2134b` |

<details><summary>Full source excerpt as stored in the registry (792 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) A registered domestic partnership may be terminated without filing a proceeding for dissolution of domestic partnership by the filing of a Notice of Termination of Domestic Partnership with the Secretary of State pursuant to this section, provided that all of the following conditions exist at the time of the filing: (1) The Notice of Termination of Domestic Partnership is signed by both registered domestic partners. (2) There are no children of the relationship of the parties born before or after registration of the domestic partnership or adopted by the parties after registration of the domestic partnership, and neither of the registered domestic partners, to their knowledge, is pregnant. (3) The registered domestic partnership is not more than five years in duration. (4) Neither party has any interest in real property wherever situated, with the exception of the lease of a residence occupied by either party which satisfies the following requirements: (A) The lease does not include an option to purchase. (B) The lease terminates within one year from the date of filing of the Notice of Termination of Domestic Partnership. (5) There are no unpaid obligations in excess of the amount described in paragraph (6) of subdivision (a) of Section 2400, as adjusted by subdivision (b) of Section 2400, incurred by either or both of the parties after registration of the domestic partnership, excluding the amount of any unpaid obligation with respect to an automobile. (6) The total fair market value of community property assets, excluding all encumbrances and automobiles, including any deferred compensation or retirement plan, is less than the amount described in paragraph (7) of subdivision (a) of Section 2400, as adjusted by subdivision (b) of Section 2400, and neither party has separate property assets, excluding all encumbrances and automobiles, in excess of that amount. (7) The parties have executed an agreement setting forth the division of assets and the assumption of liabilities of the community property, and have executed any documents, title certificates, bills of sale, or other evidence of transfer necessary to effectuate the agreement. (8) The parties waive any rights to support by the other domestic partner. (9) The parties have read and understand a brochure prepared by the Secretary of State describing the requirements, nature, and effect of terminating a domestic partnership. (10) Both parties desire that the domestic partnership be terminated. (b) The registered domestic partnership shall be terminated effective six months after the date of filing of the Notice of Termination of Domestic Partnership with the Secretary of State pursuant to this section, provided that neither party has, before that date, filed with the Secretary of State a notice of revocation of the termination of domestic partnership, in the form and content as shall be prescribed by the Secretary of State, and sent to the other party a copy of the notice of revocation by first-class mail, postage prepaid, at the other party’s last known address. The effect of termination of a domestic partnership pursuant to this section shall be the same as, and shall be treated for all purposes as, the entry of a judgment of dissolution of a domestic partnership. (c) The termination of a domestic partnership pursuant to subdivision (b) does not prejudice nor bar the rights of either of the parties to institute an action in the superior court to set aside the termination for fraud, duress, mistake, or any other ground recognized at law or in equity. A court may set aside the termination of domestic partnership and declare the termination of the domestic partnership null and void upon proof that the parties did not meet the requirements of subdivision (a) at the time of the filing of the Notice of Termination of Domestic Partnership with the Secretary of State. (d) The superior courts shall have jurisdiction over all proceedings relating to the dissolution of domestic partnerships, nullity of domestic partnerships, and legal separation of partners in a domestic partnership. The dissolution of a domestic partnership, nullity of a domestic partnership, and legal separation of partners in a domestic partnership shall follow the same procedures, and the partners shall possess the same rights, protections, and benefits, and be subject to the same responsibilities, obligations, and duties, as apply to the dissolution of marriage, nullity of marriage, and legal separation of spouses in a marriage, respectively, except as provided in subdivision (a), and except that, in accordance with the consent acknowledged by domestic partners in the Declaration of Domestic Partnership form, proceedings for dissolution, nullity, or legal separation of a domestic partnership registered in this state may be filed in the superior courts of this state even if neither domestic partner is a resident of, or maintains a domicile in, the state at the time the proceedings are filed.
```

</details>

### C5. `multiturn-011-c5`

**Criterion:** Identifies the fallback: dissolution of a domestic partnership follows the same procedures, and carries the same rights and duties, as dissolution of marriage.

#### Proposition `multiturn-011-p6`

> Dissolution of a domestic partnership follows the same procedures, and the partners possess the same rights and duties, as apply to the dissolution of marriage.

**Verbatim authoritative excerpt relied on:**

```text
The dissolution of a domestic partnership, nullity of a domestic partnership, and legal separation of partners in a domestic partnership shall follow the same procedures, and the partners shall possess the same rights, protections, and benefits, and be subject to the same responsibilities, obligations, and duties, as apply to the dissolution of marriage, nullity of marriage, and legal separation of spouses in a marriage, respectively
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-299` |
| locator | Cal. Fam. Code § 299(a)-(d) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2011 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=299> |
| source sha256 | `7fef0e8209c35be760ccf70f3d737db950084a8ea485fbe5204cfc565de2134b` |

<details><summary>Full source excerpt as stored in the registry (792 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) A registered domestic partnership may be terminated without filing a proceeding for dissolution of domestic partnership by the filing of a Notice of Termination of Domestic Partnership with the Secretary of State pursuant to this section, provided that all of the following conditions exist at the time of the filing: (1) The Notice of Termination of Domestic Partnership is signed by both registered domestic partners. (2) There are no children of the relationship of the parties born before or after registration of the domestic partnership or adopted by the parties after registration of the domestic partnership, and neither of the registered domestic partners, to their knowledge, is pregnant. (3) The registered domestic partnership is not more than five years in duration. (4) Neither party has any interest in real property wherever situated, with the exception of the lease of a residence occupied by either party which satisfies the following requirements: (A) The lease does not include an option to purchase. (B) The lease terminates within one year from the date of filing of the Notice of Termination of Domestic Partnership. (5) There are no unpaid obligations in excess of the amount described in paragraph (6) of subdivision (a) of Section 2400, as adjusted by subdivision (b) of Section 2400, incurred by either or both of the parties after registration of the domestic partnership, excluding the amount of any unpaid obligation with respect to an automobile. (6) The total fair market value of community property assets, excluding all encumbrances and automobiles, including any deferred compensation or retirement plan, is less than the amount described in paragraph (7) of subdivision (a) of Section 2400, as adjusted by subdivision (b) of Section 2400, and neither party has separate property assets, excluding all encumbrances and automobiles, in excess of that amount. (7) The parties have executed an agreement setting forth the division of assets and the assumption of liabilities of the community property, and have executed any documents, title certificates, bills of sale, or other evidence of transfer necessary to effectuate the agreement. (8) The parties waive any rights to support by the other domestic partner. (9) The parties have read and understand a brochure prepared by the Secretary of State describing the requirements, nature, and effect of terminating a domestic partnership. (10) Both parties desire that the domestic partnership be terminated. (b) The registered domestic partnership shall be terminated effective six months after the date of filing of the Notice of Termination of Domestic Partnership with the Secretary of State pursuant to this section, provided that neither party has, before that date, filed with the Secretary of State a notice of revocation of the termination of domestic partnership, in the form and content as shall be prescribed by the Secretary of State, and sent to the other party a copy of the notice of revocation by first-class mail, postage prepaid, at the other party’s last known address. The effect of termination of a domestic partnership pursuant to this section shall be the same as, and shall be treated for all purposes as, the entry of a judgment of dissolution of a domestic partnership. (c) The termination of a domestic partnership pursuant to subdivision (b) does not prejudice nor bar the rights of either of the parties to institute an action in the superior court to set aside the termination for fraud, duress, mistake, or any other ground recognized at law or in equity. A court may set aside the termination of domestic partnership and declare the termination of the domestic partnership null and void upon proof that the parties did not meet the requirements of subdivision (a) at the time of the filing of the Notice of Termination of Domestic Partnership with the Secretary of State. (d) The superior courts shall have jurisdiction over all proceedings relating to the dissolution of domestic partnerships, nullity of domestic partnerships, and legal separation of partners in a domestic partnership. The dissolution of a domestic partnership, nullity of a domestic partnership, and legal separation of partners in a domestic partnership shall follow the same procedures, and the partners shall possess the same rights, protections, and benefits, and be subject to the same responsibilities, obligations, and duties, as apply to the dissolution of marriage, nullity of marriage, and legal separation of spouses in a marriage, respectively, except as provided in subdivision (a), and except that, in accordance with the consent acknowledged by domestic partners in the Declaration of Domestic Partnership form, proceedings for dissolution, nullity, or legal separation of a domestic partnership registered in this state may be filed in the superior courts of this state even if neither domestic partner is a resident of, or maintains a domicile in, the state at the time the proceedings are filed.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `multiturn-011-a1` | statute | 299 | — |
| `multiturn-011-a2` | contains | five years | UNSUPPORTED_PROPOSITION |
| `multiturn-011-a3` | contains | six months | — |
| `multiturn-011-a4` | statute | 297 | — |

## 5. Your decision

```
task_id:      multiturn-011
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
  --task multiturn-011 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
