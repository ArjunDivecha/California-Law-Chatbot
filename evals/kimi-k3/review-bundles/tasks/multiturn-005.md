# Review packet — `multiturn-005`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `multiturn-005` |
| category | multi_turn |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `b32395114174166e5adc207b666743ed9520100f4c6efec88c93bc9e09b175fb` |
| proposition_hashes | 5 — `39a91dc34f07`, `6ab7a79edbce`, `d6588d68ad55`, `dd9b19a00d1b`, `e4b5a3715621` |
| source_hashes | 2 — `f18c843488d5`, `fd8496bf42e0` |

## 2. Prompt (what the model is asked)

```text
Multi-turn parentage consultation (all parties and facts synthetic). Turn 1 established that Marisela Quintanilla-Boateng conceived through assisted reproduction using semen from a known donor, Tobias Ferrante, while her spouse Adaeze Quintanilla-Boateng intended to parent the child. Turn 3 revealed that the semen was never provided to a licensed physician and surgeon or to a licensed sperm bank and that nobody signed anything before conception. Turn 5, the graded turn, further reveals that before conception Marisela and Tobias orally agreed Tobias would not be a parent, that Marisela and Adaeze orally agreed they would both be parents, and that Adaeze has received the child into her home and holds the child out as her own, and asks for one integrated answer on the donor's status, Adaeze's status, and what proof is required. The answer must integrate all accumulated facts using only the supplied Family Code authority.
```

### Conversation (5 turns; only the final user turn is graded)

**Turn 1 — user**

```text
Marisela Quintanilla-Boateng conceived through assisted reproduction using semen from a known donor, Tobias Ferrante. Her spouse Adaeze Quintanilla-Boateng intended to be the child's other parent from the start. What is the donor's legal status?
```

**Turn 2 — assistant**

```text
The Family Code treats a semen donor who provides semen to a licensed physician and surgeon or a licensed sperm bank for use in assisted reproduction by a woman other than the donor's spouse as not the natural parent of the resulting child, unless the donor and the woman signed a written agreement before conception that the donor would be a parent.
```

**Turn 3 — user**

```text
That is the problem. Tobias handed the sample over directly at Marisela's home. It never went to a physician or a sperm bank, and nobody signed anything before the conception.
```

**Turn 4 — assistant**

```text
That moves the analysis to the branch of the statute that governs semen not provided to a licensed physician and surgeon or a licensed sperm bank, which has its own alternative requirements.
```

**Turn 5 — user** **(graded)**

```text
Final facts. Before conception Marisela and Tobias talked it through and agreed out loud that Tobias would have no parental role. Separately, Marisela and Adaeze agreed out loud before conception that they would both be the child's parents. Since the birth Adaeze has received the child into her home and openly holds the child out as her own. Given all of that, is Tobias a parent, is Adaeze a parent, and what exactly would we have to prove?
```

## 3. Material criteria and their propositions

### C1. `multiturn-005-c1`

**Criterion:** Applies the turn-3 fact that the semen was not provided to a licensed physician and surgeon or a licensed sperm bank, and states the resulting alternative route: the donor is treated as not the natural parent if a court finds by clear and convincing evidence that the child was conceived through assisted reproduction and that the woman and the donor had a pre-conception oral agreement that the donor would not be a parent.

#### Proposition `multiturn-005-p2`

> Where the semen was not provided to a licensed physician and surgeon or a licensed sperm bank, the donor is treated as not the natural parent if a court finds by clear and convincing evidence that the child was conceived through assisted reproduction and that, prior to conception, the woman and the donor had an oral agreement that the donor would not be a parent.

**Verbatim authoritative excerpt relied on:**

```text
(B) A court finds by clear and convincing evidence that the child was conceived through assisted reproduction and that, prior to the conception of the child, the woman and the donor had an oral agreement that the donor would not be a parent.
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

### C2. `multiturn-005-c2`

**Criterion:** States the licensed-provider rule established in turn 1 and does not apply it to these facts: a donor who provides semen to a licensed physician and surgeon or a licensed sperm bank is treated as not the natural parent unless the donor and the woman signed a pre-conception written agreement that the donor would be a parent.

#### Proposition `multiturn-005-p1`

> A semen donor who provides semen to a licensed physician and surgeon or a licensed sperm bank for use in assisted reproduction by a woman other than the donor's spouse is treated in law as not the natural parent, unless the donor and the woman signed a written agreement before conception that the donor would be a parent.

**Verbatim authoritative excerpt relied on:**

```text
(1) The donor of semen provided to a licensed physician and surgeon or to a licensed sperm bank for use in assisted reproduction by a woman other than the donor’s spouse is treated in law as if the donor is not the natural parent of a child thereby conceived, unless the donor and the woman signed a written agreement before the conception of the child, that the donor would be a parent.
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

### C3. `multiturn-005-c3`

**Criterion:** States that the other intended parent's consent shall be in writing and signed by the other intended parent and the woman conceiving through assisted reproduction, and that no such writing exists on these facts.

#### Proposition `multiturn-005-p3`

> An intended parent's consent to assisted reproduction shall be in writing and signed by the other intended parent and the woman conceiving through assisted reproduction.

**Verbatim authoritative excerpt relied on:**

```text
The other intended parent’s consent shall be in writing and signed by the other intended parent and the woman conceiving through assisted reproduction.
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

### C4. `multiturn-005-c4`

**Criterion:** Applies the turn-5 oral-agreement fact: failure to consent in writing does not preclude a finding that the intended parent consented if the court finds by clear and convincing evidence a pre-conception oral agreement that both would be parents.

#### Proposition `multiturn-005-p4`

> Failure to consent in writing does not preclude the court from finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to conception, the woman and the intended parent had an oral agreement that both would be parents of the child.

**Verbatim authoritative excerpt relied on:**

```text
(2) Failure to consent in writing, as required by paragraph (1), does not preclude the court from finding that the intended parent consented if the court finds by clear and convincing evidence that, prior to the conception of the child, the woman and the intended parent had an oral agreement that the woman and the intended parent would both be parents of the child.
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

### C5. `multiturn-005-c5`

**Criterion:** Identifies the independent presumed-parent route on the turn-5 facts: a person is presumed to be the natural parent if that person receives the child into their home and openly holds out the child as their natural child.

#### Proposition `multiturn-005-p5`

> A person is presumed to be the natural parent of a child if the presumed parent receives the child into their home and openly holds out the child as their natural child.

**Verbatim authoritative excerpt relied on:**

```text
(d) The presumed parent receives the child into their home and openly holds out the child as their natural child.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-7611` |
| locator | Cal. Fam. Code § 7611 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2020 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=7611> |
| source sha256 | `f18c843488d5240189aa5d475da1bd695bde248dde23611c2a2da168c82f47b5` |

<details><summary>Full source excerpt as stored in the registry (332 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
A person is presumed to be the natural parent of a child if the person meets the conditions provided in Chapter 1 (commencing with Section 7540) or Chapter 3 (commencing with Section 7570) of Part 2 or in any of the following subdivisions: (a) The presumed parent and the child’s natural mother are, or have been, married to each other and the child is born during the marriage, or within 300 days after the marriage is terminated by death, annulment, declaration of invalidity, or divorce, or after a judgment of separation is entered by a court. (b) Before the child’s birth, the presumed parent and the child’s natural mother have attempted to marry each other by a marriage solemnized in apparent compliance with law, although the attempted marriage is or could be declared invalid, and either of the following is true: (1) If the attempted marriage could be declared invalid only by a court, the child is born during the attempted marriage, or within 300 days after its termination by death, annulment, declaration of invalidity, or divorce. (2) If the attempted marriage is invalid without a court order, the child is born within 300 days after the termination of cohabitation. (c) After the child’s birth, the presumed parent and the child’s natural mother have married, or attempted to marry, each other by a marriage solemnized in apparent compliance with law, although the attempted marriage is or could be declared invalid, and either of the following is true: (1) With the presumed parent’s consent, the presumed parent is named as the child’s parent on the child’s birth certificate. (2) The presumed parent is obligated to support the child under a written voluntary promise or by court order. (d) The presumed parent receives the child into their home and openly holds out the child as their natural child. (e) The child is in utero after the death of the decedent and the conditions set forth in Section 249.5 of the Probate Code are satisfied.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `multiturn-005-a1` | statute | 7613 | — |
| `multiturn-005-a2` | contains | clear and convincing evidence | UNSUPPORTED_PROPOSITION |
| `multiturn-005-a3` | statute | 7611 | — |

## 5. Your decision

```
task_id:      multiturn-005
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
  --task multiturn-005 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
