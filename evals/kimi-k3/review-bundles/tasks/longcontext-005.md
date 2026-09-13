# Review packet — `longcontext-005`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `longcontext-005` |
| category | long_context |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `72bb5a27b2d1c5f36e35e95394411b427c1624ce74bd562b4e5f1428d7e1d4f1` |
| proposition_hashes | 5 — `0617fc2a327f`, `3ddfbbfaab4f`, `62b10fa53f40`, `81608417f5bd`, `f9e96ec56d81` |
| source_hashes | 2 — `0c20a18fb5d2`, `fd46413d3c5c` |

## 2. Prompt (what the model is asked)

```text
Long-context California custody-presumption problem (all parties, documents, and facts synthetic). A roughly 28,000-word consolidated litigation file is embedded in the graded turn. Two orders are buried in the minute-order section near the end of the packet. The first, at about 25 percent of that section, is an unrelated civil harassment petition denied November 2, 2021 for failure to appear, expressly making no findings. The second, at about 78 percent, is a March 6, 2023 Findings and Order After Hearing in Case No. 23-DV-00418 in which the court, after a contested evidentiary hearing and on evidence not drawn from any custody evaluator, expressly found that the respondent perpetrated domestic violence against the petitioner and issued a three-year restraining order. A declaration insert at mid-depth establishes that the respondent seeks joint legal and physical custody and contends that his April 3, 2025 batterer’s program completion certificate by itself entitles him to that order. The graded answer must retrieve the March 6, 2023 finding, apply the Family Code section 3044(a) rebuttable presumption, state the preponderance standard, explain the section 3044(b) two-part showing in which program completion is only one listed factor, and state the section 3044(f)(2) obligation to state reasons in writing or on the record.
```

## 3. Material criteria and their propositions

### C1. `longcontext-005-c1`

**Criterion:** Retrieves the buried March 6, 2023 Findings and Order After Hearing in Case No. 23-DV-00418 as the finding that a party seeking custody perpetrated domestic violence, notes that it falls within the previous five years, and rejects the November 2, 2021 denial of the unrelated civil harassment petition as a finding, because that order expressly makes no findings.

#### Proposition `longcontext-005-p1`

> Upon a finding that a party seeking custody has perpetrated domestic violence within the previous five years against the other party seeking custody, there is a rebuttable presumption that an award of sole or joint physical or legal custody to the perpetrator is detrimental to the best interest of the child.

**Verbatim authoritative excerpt relied on:**

```text
Upon a finding by the court that a party seeking custody of a child has perpetrated domestic violence within the previous five years against the other party seeking custody of the child, or against the child or the child's siblings, or against a person in subparagraph (A) of paragraph (2) of subdivision (a) of Section 3011 with whom the party has a relationship, there is a rebuttable presumption that an award of sole or joint physical or legal custody of a child to a person who has perpetrated domestic violence is detrimental to the best interest of the child, pursuant to Sections 3011 and 3020.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-3044` |
| locator | Cal. Fam. Code § 3044 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2026 (Operative; Effective January 1, 2025) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=3044> |
| source sha256 | `fd46413d3c5cca30c23ab8234846dca2b936f69add2df5fdb777e2d07f367113` |

<details><summary>Full source excerpt as stored in the registry (106 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Upon a finding by the court that a party seeking custody of a child has perpetrated domestic violence within the previous five years against the other party seeking custody of the child, or against the child or the child's siblings, or against a person in subparagraph (A) of paragraph (2) of subdivision (a) of Section 3011 with whom the party has a relationship, there is a rebuttable presumption that an award of sole or joint physical or legal custody of a child to a person who has perpetrated domestic violence is detrimental to the best interest of the child, pursuant to Sections 3011 and 3020.
```

</details>

### C2. `longcontext-005-c2`

**Criterion:** States that the finding triggers the Family Code section 3044(a) rebuttable presumption that an award of sole or joint physical or legal custody to the perpetrator is detrimental to the best interest of the child, and applies it to Respondent because he is a party seeking joint legal and joint physical custody.

#### Proposition `longcontext-005-p1`

> Upon a finding that a party seeking custody has perpetrated domestic violence within the previous five years against the other party seeking custody, there is a rebuttable presumption that an award of sole or joint physical or legal custody to the perpetrator is detrimental to the best interest of the child.

**Verbatim authoritative excerpt relied on:**

```text
Upon a finding by the court that a party seeking custody of a child has perpetrated domestic violence within the previous five years against the other party seeking custody of the child, or against the child or the child's siblings, or against a person in subparagraph (A) of paragraph (2) of subdivision (a) of Section 3011 with whom the party has a relationship, there is a rebuttable presumption that an award of sole or joint physical or legal custody of a child to a person who has perpetrated domestic violence is detrimental to the best interest of the child, pursuant to Sections 3011 and 3020.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-3044` |
| locator | Cal. Fam. Code § 3044 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2026 (Operative; Effective January 1, 2025) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=3044> |
| source sha256 | `fd46413d3c5cca30c23ab8234846dca2b936f69add2df5fdb777e2d07f367113` |

<details><summary>Full source excerpt as stored in the registry (106 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Upon a finding by the court that a party seeking custody of a child has perpetrated domestic violence within the previous five years against the other party seeking custody of the child, or against the child or the child's siblings, or against a person in subparagraph (A) of paragraph (2) of subdivision (a) of Section 3011 with whom the party has a relationship, there is a rebuttable presumption that an award of sole or joint physical or legal custody of a child to a person who has perpetrated domestic violence is detrimental to the best interest of the child, pursuant to Sections 3011 and 3020.
```

</details>

### C3. `longcontext-005-c3`

**Criterion:** States that the presumption may only be rebutted by a preponderance of the evidence and that to overcome it the court must find paragraph (1) of subdivision (b) satisfied and must find that the paragraph (2) factors, on balance, support the legislative findings in Section 3020.

#### Proposition `longcontext-005-p2`

> The section 3044 presumption may only be rebutted by a preponderance of the evidence, and to overcome it the court shall find that paragraph (1) is satisfied and shall find that the factors in paragraph (2), on balance, support the legislative findings in Section 3020.

**Verbatim authoritative excerpt relied on:**

```text
This presumption may only be rebutted by a preponderance of the evidence. (b) To overcome the presumption set forth in subdivision (a), the court shall find that paragraph (1) is satisfied and shall find that the factors in paragraph (2), on balance, support the legislative findings in Section 3020.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-3044-B` |
| locator | Cal. Fam. Code § 3044(a) (final sentence)-(i) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2026 (Operative; Effective January 1, 2025) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=3044> |
| source sha256 | `0c20a18fb5d29eaab83854c89a3a16d5c7302ed503b02c26539654056168a510` |

<details><summary>Full source excerpt as stored in the registry (890 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
This presumption may only be rebutted by a preponderance of the evidence. (b) To overcome the presumption set forth in subdivision (a), the court shall find that paragraph (1) is satisfied and shall find that the factors in paragraph (2), on balance, support the legislative findings in Section 3020. (1) The perpetrator of domestic violence has demonstrated that giving sole or joint physical or legal custody of a child to the perpetrator is in the best interest of the child pursuant to Sections 3011 and 3020. In determining the best interest of the child, the preference for frequent and continuing contact with both parents, as set forth in subdivision (b) of Section 3020, or with the noncustodial parent, as set forth in paragraph (1) of subdivision (a) of Section 3040, may not be used to rebut the presumption, in whole or in part. (2) Additional factors: (A) The perpetrator has successfully completed a batterer’s treatment program that meets the criteria outlined in subdivision (c) of Section 1203.097 of the Penal Code. (B) The perpetrator has successfully completed a program of alcohol or drug abuse counseling, if the court determines that counseling is appropriate. (C) The perpetrator has successfully completed a parenting class, if the court determines the class to be appropriate. (D) The perpetrator is on probation or parole, and has or has not complied with the terms and conditions of probation or parole. (E) The perpetrator is restrained by a protective order or restraining order, and has or has not complied with its terms and conditions. (F) The perpetrator of domestic violence has committed further acts of domestic violence. (G) The court has determined, pursuant to Section 6322.5, that the perpetrator is a restrained person in possession or control of a firearm or ammunition in violation of Section 6389, Section 527.9 of the Code of Civil Procedure, or Section 18120 of the Penal Code. (c) For purposes of this section, a person has “perpetrated domestic violence” when the person is found by the court to have intentionally or recklessly caused or attempted to cause bodily injury, or sexual assault, or to have placed a person in reasonable apprehension of imminent serious bodily injury to that person or to another, or to have engaged in behavior involving, but not limited to, threatening, striking, harassing, destroying personal property, or disturbing the peace of another, for which a court may issue an ex parte order pursuant to Section 6320 to protect the other party seeking custody of the child or to protect the child and the child’s siblings. (d) (1) For purposes of this section, the requirement of a finding by the court shall be satisfied by, among other things, and not limited to, evidence that a party seeking custody has been convicted within the previous five years, after a trial or a plea of guilty or no contest, of a crime against the other party that comes within the definition of domestic violence contained in Section 6211 and of abuse contained in Section 6203, including, but not limited to, a crime described in subdivision (e) of Section 243 of, or Section 261, 273.5, 422, or 646.9 of, or former Section 262 of, the Penal Code. (2) The requirement of a finding by the court shall also be satisfied if a court, whether that court hears or has heard the child custody proceedings or not, has made a finding pursuant to subdivision (a) based on conduct occurring within the previous five years. (e) When a court makes a finding that a party has perpetrated domestic violence, the court may not base its findings solely on conclusions reached by a child custody evaluator or on the recommendation of the Family Court Services staff, but shall consider any relevant, admissible evidence submitted by the parties. (f) (1) It is the intent of the Legislature that this subdivision be interpreted consistently with the decision in Jaime G. v. H.L. (2018) 25 Cal.App.5th 794, which requires that the court, in determining that the presumption in subdivision (a) has been overcome, make specific findings on each of the factors in subdivision (b). (2) If the court determines that the presumption in subdivision (a) has been overcome, the court shall state its reasons in writing or on the record as to why paragraph (1) of subdivision (b) is satisfied and why the factors in paragraph (2) of subdivision (b), on balance, support the legislative findings in Section 3020. (g) In an evidentiary hearing or trial in which custody orders are sought and where there has been an allegation of domestic violence, the court shall make a determination as to whether this section applies prior to issuing a custody order, unless the court finds that a continuance is necessary to determine whether this section applies, in which case the court may issue a temporary custody order for a reasonable period of time, provided the order complies with Sections 3011 and 3020. (h) In a custody or restraining order proceeding in which a party has alleged that the other party has perpetrated domestic violence in accordance with the terms of this section, the court shall inform the parties of the existence of this section and shall give them a copy of this section prior to custody mediation in the case. (i) This section shall become effective on January 1, 2026.
```

</details>

### C4. `longcontext-005-c4`

**Criterion:** Rejects Respondent’s contention that completing the batterer’s treatment program is by itself sufficient, explaining that successful completion of such a program is only one of the additional factors listed in section 3044(b)(2) and is weighed on balance with the others.

#### Proposition `longcontext-005-p3`

> Successful completion of a batterer’s treatment program meeting the criteria of Penal Code section 1203.097(c) is one of the additional factors listed in section 3044(b)(2), which the court weighs on balance rather than treating any one factor as dispositive.

**Verbatim authoritative excerpt relied on:**

```text
Additional factors: (A) The perpetrator has successfully completed a batterer’s treatment program that meets the criteria outlined in subdivision (c) of Section 1203.097 of the Penal Code.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-3044-B` |
| locator | Cal. Fam. Code § 3044(a) (final sentence)-(i) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2026 (Operative; Effective January 1, 2025) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=3044> |
| source sha256 | `0c20a18fb5d29eaab83854c89a3a16d5c7302ed503b02c26539654056168a510` |

<details><summary>Full source excerpt as stored in the registry (890 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
This presumption may only be rebutted by a preponderance of the evidence. (b) To overcome the presumption set forth in subdivision (a), the court shall find that paragraph (1) is satisfied and shall find that the factors in paragraph (2), on balance, support the legislative findings in Section 3020. (1) The perpetrator of domestic violence has demonstrated that giving sole or joint physical or legal custody of a child to the perpetrator is in the best interest of the child pursuant to Sections 3011 and 3020. In determining the best interest of the child, the preference for frequent and continuing contact with both parents, as set forth in subdivision (b) of Section 3020, or with the noncustodial parent, as set forth in paragraph (1) of subdivision (a) of Section 3040, may not be used to rebut the presumption, in whole or in part. (2) Additional factors: (A) The perpetrator has successfully completed a batterer’s treatment program that meets the criteria outlined in subdivision (c) of Section 1203.097 of the Penal Code. (B) The perpetrator has successfully completed a program of alcohol or drug abuse counseling, if the court determines that counseling is appropriate. (C) The perpetrator has successfully completed a parenting class, if the court determines the class to be appropriate. (D) The perpetrator is on probation or parole, and has or has not complied with the terms and conditions of probation or parole. (E) The perpetrator is restrained by a protective order or restraining order, and has or has not complied with its terms and conditions. (F) The perpetrator of domestic violence has committed further acts of domestic violence. (G) The court has determined, pursuant to Section 6322.5, that the perpetrator is a restrained person in possession or control of a firearm or ammunition in violation of Section 6389, Section 527.9 of the Code of Civil Procedure, or Section 18120 of the Penal Code. (c) For purposes of this section, a person has “perpetrated domestic violence” when the person is found by the court to have intentionally or recklessly caused or attempted to cause bodily injury, or sexual assault, or to have placed a person in reasonable apprehension of imminent serious bodily injury to that person or to another, or to have engaged in behavior involving, but not limited to, threatening, striking, harassing, destroying personal property, or disturbing the peace of another, for which a court may issue an ex parte order pursuant to Section 6320 to protect the other party seeking custody of the child or to protect the child and the child’s siblings. (d) (1) For purposes of this section, the requirement of a finding by the court shall be satisfied by, among other things, and not limited to, evidence that a party seeking custody has been convicted within the previous five years, after a trial or a plea of guilty or no contest, of a crime against the other party that comes within the definition of domestic violence contained in Section 6211 and of abuse contained in Section 6203, including, but not limited to, a crime described in subdivision (e) of Section 243 of, or Section 261, 273.5, 422, or 646.9 of, or former Section 262 of, the Penal Code. (2) The requirement of a finding by the court shall also be satisfied if a court, whether that court hears or has heard the child custody proceedings or not, has made a finding pursuant to subdivision (a) based on conduct occurring within the previous five years. (e) When a court makes a finding that a party has perpetrated domestic violence, the court may not base its findings solely on conclusions reached by a child custody evaluator or on the recommendation of the Family Court Services staff, but shall consider any relevant, admissible evidence submitted by the parties. (f) (1) It is the intent of the Legislature that this subdivision be interpreted consistently with the decision in Jaime G. v. H.L. (2018) 25 Cal.App.5th 794, which requires that the court, in determining that the presumption in subdivision (a) has been overcome, make specific findings on each of the factors in subdivision (b). (2) If the court determines that the presumption in subdivision (a) has been overcome, the court shall state its reasons in writing or on the record as to why paragraph (1) of subdivision (b) is satisfied and why the factors in paragraph (2) of subdivision (b), on balance, support the legislative findings in Section 3020. (g) In an evidentiary hearing or trial in which custody orders are sought and where there has been an allegation of domestic violence, the court shall make a determination as to whether this section applies prior to issuing a custody order, unless the court finds that a continuance is necessary to determine whether this section applies, in which case the court may issue a temporary custody order for a reasonable period of time, provided the order complies with Sections 3011 and 3020. (h) In a custody or restraining order proceeding in which a party has alleged that the other party has perpetrated domestic violence in accordance with the terms of this section, the court shall inform the parties of the existence of this section and shall give them a copy of this section prior to custody mediation in the case. (i) This section shall become effective on January 1, 2026.
```

</details>

### C5. `longcontext-005-c5`

**Criterion:** States that if the court determines the presumption has been overcome it shall state its reasons in writing or on the record as to why paragraph (1) of subdivision (b) is satisfied and why the paragraph (2) factors on balance support the legislative findings in Section 3020, and notes that the buried order satisfies the rule that such a finding may not rest solely on a custody evaluator’s conclusions or a Family Court Services recommendation.

#### Proposition `longcontext-005-p4`

> If the court determines the presumption has been overcome, it shall state its reasons in writing or on the record as to why paragraph (1) of subdivision (b) is satisfied and why the factors in paragraph (2), on balance, support the legislative findings in Section 3020.

**Verbatim authoritative excerpt relied on:**

```text
If the court determines that the presumption in subdivision (a) has been overcome, the court shall state its reasons in writing or on the record as to why paragraph (1) of subdivision (b) is satisfied and why the factors in paragraph (2) of subdivision (b), on balance, support the legislative findings in Section 3020.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-3044-B` |
| locator | Cal. Fam. Code § 3044(a) (final sentence)-(i) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2026 (Operative; Effective January 1, 2025) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=3044> |
| source sha256 | `0c20a18fb5d29eaab83854c89a3a16d5c7302ed503b02c26539654056168a510` |

<details><summary>Full source excerpt as stored in the registry (890 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
This presumption may only be rebutted by a preponderance of the evidence. (b) To overcome the presumption set forth in subdivision (a), the court shall find that paragraph (1) is satisfied and shall find that the factors in paragraph (2), on balance, support the legislative findings in Section 3020. (1) The perpetrator of domestic violence has demonstrated that giving sole or joint physical or legal custody of a child to the perpetrator is in the best interest of the child pursuant to Sections 3011 and 3020. In determining the best interest of the child, the preference for frequent and continuing contact with both parents, as set forth in subdivision (b) of Section 3020, or with the noncustodial parent, as set forth in paragraph (1) of subdivision (a) of Section 3040, may not be used to rebut the presumption, in whole or in part. (2) Additional factors: (A) The perpetrator has successfully completed a batterer’s treatment program that meets the criteria outlined in subdivision (c) of Section 1203.097 of the Penal Code. (B) The perpetrator has successfully completed a program of alcohol or drug abuse counseling, if the court determines that counseling is appropriate. (C) The perpetrator has successfully completed a parenting class, if the court determines the class to be appropriate. (D) The perpetrator is on probation or parole, and has or has not complied with the terms and conditions of probation or parole. (E) The perpetrator is restrained by a protective order or restraining order, and has or has not complied with its terms and conditions. (F) The perpetrator of domestic violence has committed further acts of domestic violence. (G) The court has determined, pursuant to Section 6322.5, that the perpetrator is a restrained person in possession or control of a firearm or ammunition in violation of Section 6389, Section 527.9 of the Code of Civil Procedure, or Section 18120 of the Penal Code. (c) For purposes of this section, a person has “perpetrated domestic violence” when the person is found by the court to have intentionally or recklessly caused or attempted to cause bodily injury, or sexual assault, or to have placed a person in reasonable apprehension of imminent serious bodily injury to that person or to another, or to have engaged in behavior involving, but not limited to, threatening, striking, harassing, destroying personal property, or disturbing the peace of another, for which a court may issue an ex parte order pursuant to Section 6320 to protect the other party seeking custody of the child or to protect the child and the child’s siblings. (d) (1) For purposes of this section, the requirement of a finding by the court shall be satisfied by, among other things, and not limited to, evidence that a party seeking custody has been convicted within the previous five years, after a trial or a plea of guilty or no contest, of a crime against the other party that comes within the definition of domestic violence contained in Section 6211 and of abuse contained in Section 6203, including, but not limited to, a crime described in subdivision (e) of Section 243 of, or Section 261, 273.5, 422, or 646.9 of, or former Section 262 of, the Penal Code. (2) The requirement of a finding by the court shall also be satisfied if a court, whether that court hears or has heard the child custody proceedings or not, has made a finding pursuant to subdivision (a) based on conduct occurring within the previous five years. (e) When a court makes a finding that a party has perpetrated domestic violence, the court may not base its findings solely on conclusions reached by a child custody evaluator or on the recommendation of the Family Court Services staff, but shall consider any relevant, admissible evidence submitted by the parties. (f) (1) It is the intent of the Legislature that this subdivision be interpreted consistently with the decision in Jaime G. v. H.L. (2018) 25 Cal.App.5th 794, which requires that the court, in determining that the presumption in subdivision (a) has been overcome, make specific findings on each of the factors in subdivision (b). (2) If the court determines that the presumption in subdivision (a) has been overcome, the court shall state its reasons in writing or on the record as to why paragraph (1) of subdivision (b) is satisfied and why the factors in paragraph (2) of subdivision (b), on balance, support the legislative findings in Section 3020. (g) In an evidentiary hearing or trial in which custody orders are sought and where there has been an allegation of domestic violence, the court shall make a determination as to whether this section applies prior to issuing a custody order, unless the court finds that a continuance is necessary to determine whether this section applies, in which case the court may issue a temporary custody order for a reasonable period of time, provided the order complies with Sections 3011 and 3020. (h) In a custody or restraining order proceeding in which a party has alleged that the other party has perpetrated domestic violence in accordance with the terms of this section, the court shall inform the parties of the existence of this section and shall give them a copy of this section prior to custody mediation in the case. (i) This section shall become effective on January 1, 2026.
```

</details>

#### Proposition `longcontext-005-p5`

> A finding that a party has perpetrated domestic violence may not be based solely on conclusions reached by a child custody evaluator or on the recommendation of Family Court Services staff; the court shall consider any relevant, admissible evidence submitted by the parties.

**Verbatim authoritative excerpt relied on:**

```text
When a court makes a finding that a party has perpetrated domestic violence, the court may not base its findings solely on conclusions reached by a child custody evaluator or on the recommendation of the Family Court Services staff, but shall consider any relevant, admissible evidence submitted by the parties.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-3044-B` |
| locator | Cal. Fam. Code § 3044(a) (final sentence)-(i) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2026 (Operative; Effective January 1, 2025) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=3044> |
| source sha256 | `0c20a18fb5d29eaab83854c89a3a16d5c7302ed503b02c26539654056168a510` |

<details><summary>Full source excerpt as stored in the registry (890 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
This presumption may only be rebutted by a preponderance of the evidence. (b) To overcome the presumption set forth in subdivision (a), the court shall find that paragraph (1) is satisfied and shall find that the factors in paragraph (2), on balance, support the legislative findings in Section 3020. (1) The perpetrator of domestic violence has demonstrated that giving sole or joint physical or legal custody of a child to the perpetrator is in the best interest of the child pursuant to Sections 3011 and 3020. In determining the best interest of the child, the preference for frequent and continuing contact with both parents, as set forth in subdivision (b) of Section 3020, or with the noncustodial parent, as set forth in paragraph (1) of subdivision (a) of Section 3040, may not be used to rebut the presumption, in whole or in part. (2) Additional factors: (A) The perpetrator has successfully completed a batterer’s treatment program that meets the criteria outlined in subdivision (c) of Section 1203.097 of the Penal Code. (B) The perpetrator has successfully completed a program of alcohol or drug abuse counseling, if the court determines that counseling is appropriate. (C) The perpetrator has successfully completed a parenting class, if the court determines the class to be appropriate. (D) The perpetrator is on probation or parole, and has or has not complied with the terms and conditions of probation or parole. (E) The perpetrator is restrained by a protective order or restraining order, and has or has not complied with its terms and conditions. (F) The perpetrator of domestic violence has committed further acts of domestic violence. (G) The court has determined, pursuant to Section 6322.5, that the perpetrator is a restrained person in possession or control of a firearm or ammunition in violation of Section 6389, Section 527.9 of the Code of Civil Procedure, or Section 18120 of the Penal Code. (c) For purposes of this section, a person has “perpetrated domestic violence” when the person is found by the court to have intentionally or recklessly caused or attempted to cause bodily injury, or sexual assault, or to have placed a person in reasonable apprehension of imminent serious bodily injury to that person or to another, or to have engaged in behavior involving, but not limited to, threatening, striking, harassing, destroying personal property, or disturbing the peace of another, for which a court may issue an ex parte order pursuant to Section 6320 to protect the other party seeking custody of the child or to protect the child and the child’s siblings. (d) (1) For purposes of this section, the requirement of a finding by the court shall be satisfied by, among other things, and not limited to, evidence that a party seeking custody has been convicted within the previous five years, after a trial or a plea of guilty or no contest, of a crime against the other party that comes within the definition of domestic violence contained in Section 6211 and of abuse contained in Section 6203, including, but not limited to, a crime described in subdivision (e) of Section 243 of, or Section 261, 273.5, 422, or 646.9 of, or former Section 262 of, the Penal Code. (2) The requirement of a finding by the court shall also be satisfied if a court, whether that court hears or has heard the child custody proceedings or not, has made a finding pursuant to subdivision (a) based on conduct occurring within the previous five years. (e) When a court makes a finding that a party has perpetrated domestic violence, the court may not base its findings solely on conclusions reached by a child custody evaluator or on the recommendation of the Family Court Services staff, but shall consider any relevant, admissible evidence submitted by the parties. (f) (1) It is the intent of the Legislature that this subdivision be interpreted consistently with the decision in Jaime G. v. H.L. (2018) 25 Cal.App.5th 794, which requires that the court, in determining that the presumption in subdivision (a) has been overcome, make specific findings on each of the factors in subdivision (b). (2) If the court determines that the presumption in subdivision (a) has been overcome, the court shall state its reasons in writing or on the record as to why paragraph (1) of subdivision (b) is satisfied and why the factors in paragraph (2) of subdivision (b), on balance, support the legislative findings in Section 3020. (g) In an evidentiary hearing or trial in which custody orders are sought and where there has been an allegation of domestic violence, the court shall make a determination as to whether this section applies prior to issuing a custody order, unless the court finds that a continuance is necessary to determine whether this section applies, in which case the court may issue a temporary custody order for a reasonable period of time, provided the order complies with Sections 3011 and 3020. (h) In a custody or restraining order proceeding in which a party has alleged that the other party has perpetrated domestic violence in accordance with the terms of this section, the court shall inform the parties of the existence of this section and shall give them a copy of this section prior to custody mediation in the case. (i) This section shall become effective on January 1, 2026.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `longcontext-005-a1` | contains | March 6, 2023 | — |
| `longcontext-005-a2` | statute | 3044 | — |
| `longcontext-005-a3` | contains | preponderance | — |
| `longcontext-005-a4` | not_contains | finding of domestic violence on November 2, 2021 | MATERIAL_FACT_INVENTION |

## 5. Your decision

```
task_id:      longcontext-005
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
  --task longcontext-005 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
