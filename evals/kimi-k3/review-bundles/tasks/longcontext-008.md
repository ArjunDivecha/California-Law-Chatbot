# Review packet — `longcontext-008`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `longcontext-008` |
| category | long_context |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `04755ddf74510e37875b64f0340296040f6f984a241219b91690358669494765` |
| proposition_hashes | 4 — `4cc8da3997a4`, `76c9b82722eb`, `de3720613850`, `e65ffadeb24c` |
| source_hashes | 1 — `fd8496bf42e0` |

## 2. Prompt (what the model is asked)

```text
Long-context California assisted-reproduction parentage problem (all parties, documents, and facts synthetic). A roughly 33,000-word consolidated litigation file is embedded in the graded turn. An exhibit insert at about 70 percent of the exhibit section catalogues a Known Donor Agreement signed April 29, 2022 by the known donor and the woman conceiving, before conception, providing that the donor shall not be a parent, and a written consent to assisted reproduction signed May 4, 2022 by the woman conceiving and by her spouse, the intended parent, also before conception. A declaration insert at about 86 percent of the declaration section corrects a superseded intake questionnaire that said a cryobank was used and establishes that the semen was provided directly to the parties at home and was not provided to a licensed physician and surgeon or to a licensed sperm bank, with the insemination performed at home. The graded answer must select Family Code section 7613(b)(2)(A) rather than section 7613(b)(1), treat the donor as not a parent on the strength of the pre-conception written agreement, and treat the consenting spouse as a parent under section 7613(a)(1).
```

## 3. Material criteria and their propositions

### C1. `longcontext-008-c1`

**Criterion:** Retrieves the buried declaration correction and states that the semen was provided directly to the parties at home and was not provided to a licensed physician and surgeon or to a licensed sperm bank, rejecting the superseded intake questionnaire reference to a cryobank, and explains that this fact takes the case out of Family Code section 7613(b)(1) and into section 7613(b)(2).

#### Proposition `longcontext-008-p2`

> A donor of semen provided to a licensed physician and surgeon or to a licensed sperm bank for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as not the natural parent, unless the donor and the woman signed a written agreement before conception that the donor would be a parent.

**Verbatim authoritative excerpt relied on:**

```text
The donor of semen provided to a licensed physician and surgeon or to a licensed sperm bank for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived, unless the donor and the woman signed a written agreement before the conception of the child, that the donor would be a parent.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-7613` |
| locator | Cal. Fam. Code § 7613 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2024 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=7613> |
| source sha256 | `fd8496bf42e0ca6acf60f7aca04b76f0d27eb34c75905057fe2f5c833a4cc463` |

<details><summary>Full source excerpt as stored in the registry (794 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) (1) If a woman conceives through assisted reproduction with semen or ova or both donated by a donor who is not the woman’s spouse, with the consent of another intended parent, that intended parent is treated in law as if that intended parent is the natural parent of a child thereby conceived. The other intended parent’s consent shall be in writing and signed by the other intended parent and the woman conceiving through assisted reproduction. (2) Failure to consent in writing, as required by paragraph (1), does not preclude the court from finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to the conception of the child, the woman and the intended parent had an oral agreement that the woman and the intended parent would both be parents of the child. (b) (1) The donor of semen provided to a licensed physician and surgeon or to a licensed sperm bank for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived, unless the donor and the woman signed a written agreement before the conception of the child, that the donor would be a parent. (2) If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank as specified in paragraph (1), the donor of semen for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived if either of the following are met: (A) The donor and the woman signed a written agreement before conception that the donor would not be a parent. (B) A court finds by clear and convincing evidence that the child was conceived through assisted reproduction and that, prior to the conception of the child, the woman and the donor had an oral agreement that the donor would not be a parent. (c) A person providing ova for use in assisted reproduction by a person other than the provider’s spouse or nonmarital partner is treated in law as if the provider is not the natural parent of a child thereby conceived unless the court finds satisfactory evidence that the provider of the ova, and each recipient, intended for that provider to have parental rights. (d) (1) A provider of an embryo for use in assisted reproduction to an intended parent who is not the provider’s spouse or nonmarital partner is treated in law as if the provider is not the natural parent of a child thereby conceived unless the court finds satisfactory evidence that the provider and the intended parent intended for the provider to be a parent. (2) If the provider of ova, semen, or embryos is not the original source of the ova or sperm, each original provider’s written consent to the donation is required unless that person has executed a writing to consent to the donation, or to waive or relinquish their right to the genetic material, or as otherwise ordered by a court of law. (e) (1) Notwithstanding any other law, persons who are not married to one another and who share legal control over the disposition of embryos shall not be prevented from entering into a written agreement whereby one person renounces all legal interest in the embryos, with the specific intent that the person renouncing all legal interest shall not be a legal parent of any child conceived with use of the embryos, despite any prior oral or written agreements, or legal judgments to the contrary. After that interest has been renounced in a writing signed by all persons with legal interest in or control over disposition of the embryos, the renouncing person shall be treated in law as a donor, and not a legal parent. Upon execution of that agreement, the person who retains legal interest in and control over disposition of the embryos shall have the sole right to determine the use and disposition of the embryos, including the right to attempt conception of a child, subject to any limitation pursuant to paragraph (2) of subdivision (d). Either party may file the agreement with the court, and the court shall issue an order establishing the nonparentage of the donor. (2) If persons who share legal control over and interest in one or more embryos are married to one another at the time of signing the agreement, the agreement shall only become legally binding upon the court’s entry of a final decree of dissolution that incorporates the agreement, after which the presumptions pursuant to Section 7540 or subdivisions (a), (b), or (c) of Section 7611 shall not apply.
```

</details>

#### Proposition `longcontext-008-p3`

> If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank, the donor is treated in law as not the natural parent if the donor and the woman signed a written agreement before conception that the donor would not be a parent.

**Verbatim authoritative excerpt relied on:**

```text
If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank as specified in paragraph (1), the donor of semen for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived if either of the following are met: (A) The donor and the woman signed a written agreement before conception that the donor would not be a parent.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-7613` |
| locator | Cal. Fam. Code § 7613 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2024 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=7613> |
| source sha256 | `fd8496bf42e0ca6acf60f7aca04b76f0d27eb34c75905057fe2f5c833a4cc463` |

<details><summary>Full source excerpt as stored in the registry (794 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) (1) If a woman conceives through assisted reproduction with semen or ova or both donated by a donor who is not the woman’s spouse, with the consent of another intended parent, that intended parent is treated in law as if that intended parent is the natural parent of a child thereby conceived. The other intended parent’s consent shall be in writing and signed by the other intended parent and the woman conceiving through assisted reproduction. (2) Failure to consent in writing, as required by paragraph (1), does not preclude the court from finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to the conception of the child, the woman and the intended parent had an oral agreement that the woman and the intended parent would both be parents of the child. (b) (1) The donor of semen provided to a licensed physician and surgeon or to a licensed sperm bank for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived, unless the donor and the woman signed a written agreement before the conception of the child, that the donor would be a parent. (2) If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank as specified in paragraph (1), the donor of semen for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived if either of the following are met: (A) The donor and the woman signed a written agreement before conception that the donor would not be a parent. (B) A court finds by clear and convincing evidence that the child was conceived through assisted reproduction and that, prior to the conception of the child, the woman and the donor had an oral agreement that the donor would not be a parent. (c) A person providing ova for use in assisted reproduction by a person other than the provider’s spouse or nonmarital partner is treated in law as if the provider is not the natural parent of a child thereby conceived unless the court finds satisfactory evidence that the provider of the ova, and each recipient, intended for that provider to have parental rights. (d) (1) A provider of an embryo for use in assisted reproduction to an intended parent who is not the provider’s spouse or nonmarital partner is treated in law as if the provider is not the natural parent of a child thereby conceived unless the court finds satisfactory evidence that the provider and the intended parent intended for the provider to be a parent. (2) If the provider of ova, semen, or embryos is not the original source of the ova or sperm, each original provider’s written consent to the donation is required unless that person has executed a writing to consent to the donation, or to waive or relinquish their right to the genetic material, or as otherwise ordered by a court of law. (e) (1) Notwithstanding any other law, persons who are not married to one another and who share legal control over the disposition of embryos shall not be prevented from entering into a written agreement whereby one person renounces all legal interest in the embryos, with the specific intent that the person renouncing all legal interest shall not be a legal parent of any child conceived with use of the embryos, despite any prior oral or written agreements, or legal judgments to the contrary. After that interest has been renounced in a writing signed by all persons with legal interest in or control over disposition of the embryos, the renouncing person shall be treated in law as a donor, and not a legal parent. Upon execution of that agreement, the person who retains legal interest in and control over disposition of the embryos shall have the sole right to determine the use and disposition of the embryos, including the right to attempt conception of a child, subject to any limitation pursuant to paragraph (2) of subdivision (d). Either party may file the agreement with the court, and the court shall issue an order establishing the nonparentage of the donor. (2) If persons who share legal control over and interest in one or more embryos are married to one another at the time of signing the agreement, the agreement shall only become legally binding upon the court’s entry of a final decree of dissolution that incorporates the agreement, after which the presumptions pursuant to Section 7540 or subdivisions (a), (b), or (c) of Section 7611 shall not apply.
```

</details>

### C2. `longcontext-008-c2`

**Criterion:** Concludes that Ignatius Prewitt-Moreau is treated in law as not the natural parent under section 7613(b)(2)(A), because the buried April 29, 2022 Known Donor Agreement is a written agreement signed by the donor and the woman before conception that the donor would not be a parent.

#### Proposition `longcontext-008-p3`

> If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank, the donor is treated in law as not the natural parent if the donor and the woman signed a written agreement before conception that the donor would not be a parent.

**Verbatim authoritative excerpt relied on:**

```text
If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank as specified in paragraph (1), the donor of semen for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived if either of the following are met: (A) The donor and the woman signed a written agreement before conception that the donor would not be a parent.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-7613` |
| locator | Cal. Fam. Code § 7613 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2024 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=7613> |
| source sha256 | `fd8496bf42e0ca6acf60f7aca04b76f0d27eb34c75905057fe2f5c833a4cc463` |

<details><summary>Full source excerpt as stored in the registry (794 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) (1) If a woman conceives through assisted reproduction with semen or ova or both donated by a donor who is not the woman’s spouse, with the consent of another intended parent, that intended parent is treated in law as if that intended parent is the natural parent of a child thereby conceived. The other intended parent’s consent shall be in writing and signed by the other intended parent and the woman conceiving through assisted reproduction. (2) Failure to consent in writing, as required by paragraph (1), does not preclude the court from finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to the conception of the child, the woman and the intended parent had an oral agreement that the woman and the intended parent would both be parents of the child. (b) (1) The donor of semen provided to a licensed physician and surgeon or to a licensed sperm bank for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived, unless the donor and the woman signed a written agreement before the conception of the child, that the donor would be a parent. (2) If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank as specified in paragraph (1), the donor of semen for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived if either of the following are met: (A) The donor and the woman signed a written agreement before conception that the donor would not be a parent. (B) A court finds by clear and convincing evidence that the child was conceived through assisted reproduction and that, prior to the conception of the child, the woman and the donor had an oral agreement that the donor would not be a parent. (c) A person providing ova for use in assisted reproduction by a person other than the provider’s spouse or nonmarital partner is treated in law as if the provider is not the natural parent of a child thereby conceived unless the court finds satisfactory evidence that the provider of the ova, and each recipient, intended for that provider to have parental rights. (d) (1) A provider of an embryo for use in assisted reproduction to an intended parent who is not the provider’s spouse or nonmarital partner is treated in law as if the provider is not the natural parent of a child thereby conceived unless the court finds satisfactory evidence that the provider and the intended parent intended for the provider to be a parent. (2) If the provider of ova, semen, or embryos is not the original source of the ova or sperm, each original provider’s written consent to the donation is required unless that person has executed a writing to consent to the donation, or to waive or relinquish their right to the genetic material, or as otherwise ordered by a court of law. (e) (1) Notwithstanding any other law, persons who are not married to one another and who share legal control over the disposition of embryos shall not be prevented from entering into a written agreement whereby one person renounces all legal interest in the embryos, with the specific intent that the person renouncing all legal interest shall not be a legal parent of any child conceived with use of the embryos, despite any prior oral or written agreements, or legal judgments to the contrary. After that interest has been renounced in a writing signed by all persons with legal interest in or control over disposition of the embryos, the renouncing person shall be treated in law as a donor, and not a legal parent. Upon execution of that agreement, the person who retains legal interest in and control over disposition of the embryos shall have the sole right to determine the use and disposition of the embryos, including the right to attempt conception of a child, subject to any limitation pursuant to paragraph (2) of subdivision (d). Either party may file the agreement with the court, and the court shall issue an order establishing the nonparentage of the donor. (2) If persons who share legal control over and interest in one or more embryos are married to one another at the time of signing the agreement, the agreement shall only become legally binding upon the court’s entry of a final decree of dissolution that incorporates the agreement, after which the presumptions pursuant to Section 7540 or subdivisions (a), (b), or (c) of Section 7611 shall not apply.
```

</details>

### C3. `longcontext-008-c3`

**Criterion:** Concludes that Naledi Fairweather-Oyelaran is treated in law as the natural parent under section 7613(a)(1), identifying the buried May 4, 2022 written consent signed by both the intended parent and the woman conceiving through assisted reproduction as satisfying the writing-and-signature requirement.

#### Proposition `longcontext-008-p1`

> If a woman conceives through assisted reproduction with donated semen with the consent of another intended parent, that intended parent is treated in law as the natural parent of the child, and the consent shall be in writing and signed by the intended parent and the woman conceiving.

**Verbatim authoritative excerpt relied on:**

```text
If a woman conceives through assisted reproduction with semen or ova or both donated by a donor who is not the woman’s spouse, with the consent of another intended parent, that intended parent is treated in law as if that intended parent is the natural parent of a child thereby conceived. The other intended parent’s consent shall be in writing and signed by the other intended parent and the woman conceiving through assisted reproduction.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-7613` |
| locator | Cal. Fam. Code § 7613 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2024 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=7613> |
| source sha256 | `fd8496bf42e0ca6acf60f7aca04b76f0d27eb34c75905057fe2f5c833a4cc463` |

<details><summary>Full source excerpt as stored in the registry (794 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) (1) If a woman conceives through assisted reproduction with semen or ova or both donated by a donor who is not the woman’s spouse, with the consent of another intended parent, that intended parent is treated in law as if that intended parent is the natural parent of a child thereby conceived. The other intended parent’s consent shall be in writing and signed by the other intended parent and the woman conceiving through assisted reproduction. (2) Failure to consent in writing, as required by paragraph (1), does not preclude the court from finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to the conception of the child, the woman and the intended parent had an oral agreement that the woman and the intended parent would both be parents of the child. (b) (1) The donor of semen provided to a licensed physician and surgeon or to a licensed sperm bank for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived, unless the donor and the woman signed a written agreement before the conception of the child, that the donor would be a parent. (2) If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank as specified in paragraph (1), the donor of semen for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived if either of the following are met: (A) The donor and the woman signed a written agreement before conception that the donor would not be a parent. (B) A court finds by clear and convincing evidence that the child was conceived through assisted reproduction and that, prior to the conception of the child, the woman and the donor had an oral agreement that the donor would not be a parent. (c) A person providing ova for use in assisted reproduction by a person other than the provider’s spouse or nonmarital partner is treated in law as if the provider is not the natural parent of a child thereby conceived unless the court finds satisfactory evidence that the provider of the ova, and each recipient, intended for that provider to have parental rights. (d) (1) A provider of an embryo for use in assisted reproduction to an intended parent who is not the provider’s spouse or nonmarital partner is treated in law as if the provider is not the natural parent of a child thereby conceived unless the court finds satisfactory evidence that the provider and the intended parent intended for the provider to be a parent. (2) If the provider of ova, semen, or embryos is not the original source of the ova or sperm, each original provider’s written consent to the donation is required unless that person has executed a writing to consent to the donation, or to waive or relinquish their right to the genetic material, or as otherwise ordered by a court of law. (e) (1) Notwithstanding any other law, persons who are not married to one another and who share legal control over the disposition of embryos shall not be prevented from entering into a written agreement whereby one person renounces all legal interest in the embryos, with the specific intent that the person renouncing all legal interest shall not be a legal parent of any child conceived with use of the embryos, despite any prior oral or written agreements, or legal judgments to the contrary. After that interest has been renounced in a writing signed by all persons with legal interest in or control over disposition of the embryos, the renouncing person shall be treated in law as a donor, and not a legal parent. Upon execution of that agreement, the person who retains legal interest in and control over disposition of the embryos shall have the sole right to determine the use and disposition of the embryos, including the right to attempt conception of a child, subject to any limitation pursuant to paragraph (2) of subdivision (d). Either party may file the agreement with the court, and the court shall issue an order establishing the nonparentage of the donor. (2) If persons who share legal control over and interest in one or more embryos are married to one another at the time of signing the agreement, the agreement shall only become legally binding upon the court’s entry of a final decree of dissolution that incorporates the agreement, after which the presumptions pursuant to Section 7540 or subdivisions (a), (b), or (c) of Section 7611 shall not apply.
```

</details>

### C4. `longcontext-008-c4`

**Criterion:** Notes the alternative route in section 7613(a)(2), that failure to consent in writing would not preclude a finding of consent on clear and convincing evidence of a pre-conception oral agreement that both would be parents, while making clear that on this file the written consent exists so the alternative is not needed.

#### Proposition `longcontext-008-p4`

> Failure to consent in writing does not preclude a finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to conception, the woman and the intended parent had an oral agreement that both would be parents.

**Verbatim authoritative excerpt relied on:**

```text
Failure to consent in writing, as required by paragraph (1), does not preclude the court from finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to the conception of the child, the woman and the intended parent had an oral agreement that the woman and the intended parent would both be parents of the child.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-7613` |
| locator | Cal. Fam. Code § 7613 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2024 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=7613> |
| source sha256 | `fd8496bf42e0ca6acf60f7aca04b76f0d27eb34c75905057fe2f5c833a4cc463` |

<details><summary>Full source excerpt as stored in the registry (794 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) (1) If a woman conceives through assisted reproduction with semen or ova or both donated by a donor who is not the woman’s spouse, with the consent of another intended parent, that intended parent is treated in law as if that intended parent is the natural parent of a child thereby conceived. The other intended parent’s consent shall be in writing and signed by the other intended parent and the woman conceiving through assisted reproduction. (2) Failure to consent in writing, as required by paragraph (1), does not preclude the court from finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to the conception of the child, the woman and the intended parent had an oral agreement that the woman and the intended parent would both be parents of the child. (b) (1) The donor of semen provided to a licensed physician and surgeon or to a licensed sperm bank for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived, unless the donor and the woman signed a written agreement before the conception of the child, that the donor would be a parent. (2) If the semen is not provided to a licensed physician and surgeon or a licensed sperm bank as specified in paragraph (1), the donor of semen for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived if either of the following are met: (A) The donor and the woman signed a written agreement before conception that the donor would not be a parent. (B) A court finds by clear and convincing evidence that the child was conceived through assisted reproduction and that, prior to the conception of the child, the woman and the donor had an oral agreement that the donor would not be a parent. (c) A person providing ova for use in assisted reproduction by a person other than the provider’s spouse or nonmarital partner is treated in law as if the provider is not the natural parent of a child thereby conceived unless the court finds satisfactory evidence that the provider of the ova, and each recipient, intended for that provider to have parental rights. (d) (1) A provider of an embryo for use in assisted reproduction to an intended parent who is not the provider’s spouse or nonmarital partner is treated in law as if the provider is not the natural parent of a child thereby conceived unless the court finds satisfactory evidence that the provider and the intended parent intended for the provider to be a parent. (2) If the provider of ova, semen, or embryos is not the original source of the ova or sperm, each original provider’s written consent to the donation is required unless that person has executed a writing to consent to the donation, or to waive or relinquish their right to the genetic material, or as otherwise ordered by a court of law. (e) (1) Notwithstanding any other law, persons who are not married to one another and who share legal control over the disposition of embryos shall not be prevented from entering into a written agreement whereby one person renounces all legal interest in the embryos, with the specific intent that the person renouncing all legal interest shall not be a legal parent of any child conceived with use of the embryos, despite any prior oral or written agreements, or legal judgments to the contrary. After that interest has been renounced in a writing signed by all persons with legal interest in or control over disposition of the embryos, the renouncing person shall be treated in law as a donor, and not a legal parent. Upon execution of that agreement, the person who retains legal interest in and control over disposition of the embryos shall have the sole right to determine the use and disposition of the embryos, including the right to attempt conception of a child, subject to any limitation pursuant to paragraph (2) of subdivision (d). Either party may file the agreement with the court, and the court shall issue an order establishing the nonparentage of the donor. (2) If persons who share legal control over and interest in one or more embryos are married to one another at the time of signing the agreement, the agreement shall only become legally binding upon the court’s entry of a final decree of dissolution that incorporates the agreement, after which the presumptions pursuant to Section 7540 or subdivisions (a), (b), or (c) of Section 7611 shall not apply.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `longcontext-008-a1` | contains | April 29, 2022 | — |
| `longcontext-008-a2` | statute | 7613 | — |
| `longcontext-008-a3` | contains | May 4, 2022 | — |
| `longcontext-008-a4` | not_contains | semen was provided to a licensed sperm bank | MATERIAL_FACT_INVENTION |

## 5. Your decision

```
task_id:      longcontext-008
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
  --task longcontext-008 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
