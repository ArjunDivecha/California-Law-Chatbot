# Review packet — `multiturn-006`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `multiturn-006` |
| category | multi_turn |
| workflow | draft |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `abccd0fc38b7f148f6b3d2ba950db90e88e0de94b00e64c1b04729cc5e01049b` |
| proposition_hashes | 5 — `06f387fd6fe9`, `296deb69d87b`, `465bf1111987`, `5e92b9a636f1`, `c0aa772a3eea` |
| source_hashes | 4 — `889a27cf4bad`, `9bccc1b717b5`, `c63314f20482`, `ca0c85bcc670` |

## 2. Prompt (what the model is asked)

```text
Multi-turn disclosure consultation ending in a drafting request (all parties and facts synthetic). Turn 1 established that Beatriz Okonkwo-Salvatierra filed a petition for dissolution on February 3, 2026 and asked when the preliminary declaration of disclosure must be served. Turn 3 revealed that after the date of separation Beatriz was offered an equity stake in a venture that grew directly out of a business the parties ran together during the marriage. Turn 5, the graded turn, asks for a short client letter that (a) restates the preliminary-declaration service deadlines for petitioner and respondent, (b) explains the post-separation opportunity disclosure duty and the fiduciary standard it rests on, and (c) drafts the representations a mutual waiver of the final declaration of disclosure must contain. The letter must integrate all accumulated facts using only the supplied Family Code authority.
```

### Conversation (5 turns; only the final user turn is graded)

**Turn 1 — user**

```text
Beatriz Okonkwo-Salvatierra filed her petition for dissolution on February 3, 2026 in a California superior court. When does she have to serve her preliminary declaration of disclosure, and when does the respondent have to serve his?
```

**Turn 2 — assistant**

```text
The Family Code sets service windows tied to the filing of the petition and of the response, subject to extension by written agreement of the parties or by court order.
```

**Turn 3 — user**

```text
New development. Three weeks after the date of separation, Beatriz was offered an equity stake in a logistics venture that came directly out of the freight brokerage the parties built together during the marriage. She would rather not tell him about it. Is that a problem?
```

**Turn 4 — assistant**

```text
There is an express post-separation disclosure duty that covers investment, business, and other income-producing opportunities that present themselves after separation but result from a pre-separation business activity.
```

**Turn 5 — user** **(graded)**

```text
Understood - she will disclose. Now please draft me a short client letter to Beatriz that does three things: restates the preliminary declaration of disclosure service deadlines for both her and the respondent, explains the post-separation opportunity disclosure duty and the fiduciary standard behind it, and sets out the representations that a mutual waiver of the final declaration of disclosure has to contain if they later want to use one.
```

## 3. Material criteria and their propositions

### C1. `multiturn-006-c1`

**Criterion:** The letter states both preliminary-declaration service deadlines: petitioner serves concurrently with the petition or within 60 days of filing the petition, and respondent serves concurrently with the response or within 60 days of filing the response.

#### Proposition `multiturn-006-p1`

> The petitioner shall serve the other party with the preliminary declaration of disclosure either concurrently with the petition for dissolution or legal separation, or within 60 days of filing the petition.

**Verbatim authoritative excerpt relied on:**

```text
(f) The petitioner shall serve the other party with the preliminary declaration of disclosure either concurrently with the petition for dissolution or legal separation, or within 60 days of filing the petition.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2104` |
| locator | Cal. Fam. Code § 2104 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2104> |
| source sha256 | `c63314f20482e85c0422581e1afbd97c2cf8c3930849d1ec32550b6f8a9efe7e` |

<details><summary>Full source excerpt as stored in the registry (487 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Except by court order for good cause, as provided in Section 2107, or when service of the preliminary declaration of disclosure is not required pursuant to Section 2110, in the time period set forth in subdivision (f), each party shall serve on the other party a preliminary declaration of disclosure, executed under penalty of perjury on a form prescribed by the Judicial Council. The commission of perjury on the preliminary declaration of disclosure may be grounds for setting aside the judgment, or any part or parts thereof, pursuant to Chapter 10 (commencing with Section 2120), in addition to any and all other remedies, civil or criminal, that otherwise are available under law for the commission of perjury. The preliminary declaration of disclosure shall include all tax returns filed by the declarant within the two years prior to the date that the party served the declaration. (b) The preliminary declaration of disclosure shall not be filed with the court, except on court order. However, the parties shall file proof of service of the preliminary declaration of disclosure with the court. (c) The preliminary declaration of disclosure shall set forth with sufficient particularity, that a person of reasonable and ordinary intelligence can ascertain, all of the following: (1) The identity of all assets in which the declarant has or may have an interest and all liabilities for which the declarant is or may be liable, regardless of the characterization of the asset or liability as community, quasi-community, or separate. (2) The declarant’s percentage of ownership in each asset and percentage of obligation for each liability when property is not solely owned by one or both of the parties. The preliminary declaration may also set forth the declarant’s characterization of each asset or liability. (d) A declarant may amend the preliminary declaration of disclosure without leave of the court. Proof of service of an amendment shall be filed with the court. (e) Along with the preliminary declaration of disclosure, each party shall provide the other party with a completed income and expense declaration unless an income and expense declaration has already been provided and is current and valid. (f) The petitioner shall serve the other party with the preliminary declaration of disclosure either concurrently with the petition for dissolution or legal separation, or within 60 days of filing the petition. When a petitioner serves the summons and petition by publication or posting pursuant to court order and the respondent files a response prior to a default judgment being entered, the petitioner shall serve the other party with the preliminary declaration of disclosure within 30 days of the response being filed. The respondent shall serve the other party with the preliminary declaration of disclosure either concurrently with the response to the petition, or within 60 days of filing the response. The time periods specified in this subdivision may be extended by written agreement of the parties or by court order.
```

</details>

#### Proposition `multiturn-006-p2`

> The respondent shall serve the other party with the preliminary declaration of disclosure either concurrently with the response to the petition, or within 60 days of filing the response.

**Verbatim authoritative excerpt relied on:**

```text
The respondent shall serve the other party with the preliminary declaration of disclosure either concurrently with the response to the petition, or within 60 days of filing the response.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2104` |
| locator | Cal. Fam. Code § 2104 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2104> |
| source sha256 | `c63314f20482e85c0422581e1afbd97c2cf8c3930849d1ec32550b6f8a9efe7e` |

<details><summary>Full source excerpt as stored in the registry (487 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Except by court order for good cause, as provided in Section 2107, or when service of the preliminary declaration of disclosure is not required pursuant to Section 2110, in the time period set forth in subdivision (f), each party shall serve on the other party a preliminary declaration of disclosure, executed under penalty of perjury on a form prescribed by the Judicial Council. The commission of perjury on the preliminary declaration of disclosure may be grounds for setting aside the judgment, or any part or parts thereof, pursuant to Chapter 10 (commencing with Section 2120), in addition to any and all other remedies, civil or criminal, that otherwise are available under law for the commission of perjury. The preliminary declaration of disclosure shall include all tax returns filed by the declarant within the two years prior to the date that the party served the declaration. (b) The preliminary declaration of disclosure shall not be filed with the court, except on court order. However, the parties shall file proof of service of the preliminary declaration of disclosure with the court. (c) The preliminary declaration of disclosure shall set forth with sufficient particularity, that a person of reasonable and ordinary intelligence can ascertain, all of the following: (1) The identity of all assets in which the declarant has or may have an interest and all liabilities for which the declarant is or may be liable, regardless of the characterization of the asset or liability as community, quasi-community, or separate. (2) The declarant’s percentage of ownership in each asset and percentage of obligation for each liability when property is not solely owned by one or both of the parties. The preliminary declaration may also set forth the declarant’s characterization of each asset or liability. (d) A declarant may amend the preliminary declaration of disclosure without leave of the court. Proof of service of an amendment shall be filed with the court. (e) Along with the preliminary declaration of disclosure, each party shall provide the other party with a completed income and expense declaration unless an income and expense declaration has already been provided and is current and valid. (f) The petitioner shall serve the other party with the preliminary declaration of disclosure either concurrently with the petition for dissolution or legal separation, or within 60 days of filing the petition. When a petitioner serves the summons and petition by publication or posting pursuant to court order and the respondent files a response prior to a default judgment being entered, the petitioner shall serve the other party with the preliminary declaration of disclosure within 30 days of the response being filed. The respondent shall serve the other party with the preliminary declaration of disclosure either concurrently with the response to the petition, or within 60 days of filing the response. The time periods specified in this subdivision may be extended by written agreement of the parties or by court order.
```

</details>

### C2. `multiturn-006-c2`

**Criterion:** The letter applies the turn-3 facts and states the duty of accurate and complete written disclosure of any investment, business, or other income-producing opportunity presenting itself after the date of separation that results from a pre-separation investment or significant business activity of either spouse.

#### Proposition `multiturn-006-p3`

> Each party owes the accurate and complete written disclosure of any investment, business, or other income-producing opportunity that presents itself after the date of separation but results from a pre-separation investment or significant business activity of either spouse.

**Verbatim authoritative excerpt relied on:**

```text
(2) The accurate and complete written disclosure of any investment opportunity, business opportunity, or other income-producing opportunity that presents itself after the date of separation, but that results from any investment, significant business activity outside the ordinary course of business, or other income-producing opportunity of either spouse from the date of marriage to the date of separation, inclusive.
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

### C3. `multiturn-006-c3`

**Criterion:** The letter grounds that duty in the spousal fiduciary standard: a duty of the highest good faith and fair dealing, with neither spouse taking unfair advantage of the other.

#### Proposition `multiturn-006-p4`

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

### C4. `multiturn-006-c4`

**Criterion:** The letter states that a mutual waiver of the final declaration of disclosure must be executed under penalty of perjury, entered into in open court or by separate stipulation.

#### Proposition `multiturn-006-p5`

> The parties may stipulate to a mutual waiver of the final declaration of disclosure by execution of a waiver under penalty of perjury entered into in open court or by separate stipulation.

**Verbatim authoritative excerpt relied on:**

```text
(d) The parties may stipulate to a mutual waiver of the requirements of subdivision (a) concerning the final declaration of disclosure, by execution of a waiver under penalty of perjury entered into in open court or by separate stipulation.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2105` |
| locator | Cal. Fam. Code § 2105 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2002 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2105> |
| source sha256 | `9bccc1b717b563eddd474c2d04271519d6492c4d2d7bd357888458c39f9401d9` |

<details><summary>Full source excerpt as stored in the registry (544 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Except by court order for good cause, before or at the time the parties enter into an agreement for the resolution of property or support issues other than pendente lite support, or, if the case goes to trial, no later than 45 days before the first assigned trial date, each party, or the attorney for the party in this matter, shall serve on the other party a final declaration of disclosure and a current income and expense declaration, executed under penalty of perjury on a form prescribed by the Judicial Council, unless the parties mutually waive the final declaration of disclosure. The commission of perjury on the final declaration of disclosure by a party may be grounds for setting aside the judgment, or any part or parts thereof, pursuant to Chapter 10 (commencing with Section 2120), in addition to any and all other remedies, civil or criminal, that otherwise are available under law for the commission of perjury. (b) The final declaration of disclosure shall include all of the following information: (1) All material facts and information regarding the characterization of all assets and liabilities. (2) All material facts and information regarding the valuation of all assets that are contended to be community property or in which it is contended the community has an interest. (3) All material facts and information regarding the amounts of all obligations that are contended to be community obligations or for which it is contended the community has liability. (4) All material facts and information regarding the earnings, accumulations, and expenses of each party that have been set forth in the income and expense declaration. (c) In making an order setting aside a judgment for failure to comply with this section, the court may limit the set aside to those portions of the judgment materially affected by the nondisclosure. (d) The parties may stipulate to a mutual waiver of the requirements of subdivision (a) concerning the final declaration of disclosure, by execution of a waiver under penalty of perjury entered into in open court or by separate stipulation. The waiver shall include all of the following representations: (1) Both parties have complied with Section 2104 and the preliminary declarations of disclosure have been completed and exchanged. (2) Both parties have completed and exchanged a current income and expense declaration, that includes all material facts and information regarding that party’s earnings, accumulations, and expenses. (3) Both parties have fully complied with Section 2102 and have fully augmented the preliminary declarations of disclosure, including disclosure of all material facts and information regarding the characterization of all assets and liabilities, the valuation of all assets that are contended to be community property or in which it is contended the community has an interest, and the amounts of all obligations that are contended to be community obligations or for which it is contended the community has liability. (4) The waiver is knowingly, intelligently, and voluntarily entered into by each of the parties. (5) Each party understands that this waiver does not limit the legal disclosure obligations of the parties, but rather is a statement under penalty of perjury that those obligations have been fulfilled. Each party further understands that noncompliance with those obligations will result in the court setting aside the judgment.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `multiturn-006-a1` | statute | 2104 | — |
| `multiturn-006-a2` | contains | 60 days | — |
| `multiturn-006-a3` | statute | 2102 | — |
| `multiturn-006-a4` | contains | penalty of perjury | — |

## 5. Your decision

```
task_id:      multiturn-006
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
  --task multiturn-006 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
