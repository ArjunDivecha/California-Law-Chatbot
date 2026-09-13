# Review packet — `multiturn-013`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `multiturn-013` |
| category | multi_turn |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `b2f1f553f435e64ddd7013eaf4be08f294faef9cfdeed539232adba26f88c562` |
| proposition_hashes | 5 — `cc56a2162630`, `d15ed4beec45`, `e36aa7bcb110`, `f8b1f07c4cd9`, `fffc55bf88d3` |
| source_hashes | 2 — `9dee8cbbb809`, `b56fcecef405` |

## 2. Prompt (what the model is asked)

```text
Multi-turn consultation testing context carryover (all parties and facts synthetic). Turn 1 established that the Cordovan Ridge Tenants Alliance was served with a defamation complaint on March 3, 2026, arising entirely from testimony its director Delphine Sarraute gave at a Cordovan City Council hearing. Turn 3 asked whether the claim is subject to a special motion to strike. Turn 5, the graded turn, asks three questions whose answers depend on remembering the March 3, 2026 service date and the official-proceeding character of the testimony: what the filing deadline is, whether the investigator may take the plaintiff's deposition next week, and whether an immediate appeal is available if the motion is denied. It also asks about fee exposure.
```

### Conversation (5 turns; only the final user turn is graded)

**Turn 1 — user**

```text
The Cordovan Ridge Tenants Alliance was personally served with a defamation complaint on March 3, 2026. Every allegation arises from testimony our director Delphine Sarraute gave at a Cordovan City Council hearing on a proposed rent ordinance. Keep the service date in mind.
```

**Turn 2 — assistant**

```text
Noted: service of the complaint on March 3, 2026, with the claims arising from testimony before a city council.
```

**Turn 3 — user**

```text
Is a claim like that subject to a special motion to strike?
```

**Turn 4 — assistant**

```text
A cause of action arising from an act in furtherance of the right of petition or free speech in connection with a public issue is subject to a special motion to strike unless the plaintiff establishes a probability of prevailing, and the statutory definition expressly includes a written or oral statement made before a legislative, executive, or judicial proceeding or any other official proceeding authorized by law.
```

**Turn 5 — user** **(graded)**

```text
Three practical questions then. What is our deadline to file the motion? Our investigator wants to take the plaintiff's deposition next week - can she? And if the judge denies the motion, do we have to wait until after trial to appeal? Also, what is our fee exposure either way?
```

## 3. Material criteria and their propositions

### C1. `multiturn-013-c1`

**Criterion:** Applies the carried-over March 3, 2026 service date: the special motion may be filed within 60 days of service of the complaint, or in the court's discretion at any later time upon terms it deems proper.

#### Proposition `multiturn-013-p1`

> The special motion to strike may be filed within 60 days of service of the complaint or, in the court's discretion, at any later time upon terms it deems proper, and is scheduled for hearing not more than 30 days after service of the motion unless docket conditions require a later hearing.

**Verbatim authoritative excerpt relied on:**

```text
(f) The special motion may be filed within 60 days of the service of the complaint or, in the court’s discretion, at any later time upon terms it deems proper. The motion shall be scheduled by the clerk of the court for a hearing not more than 30 days after the service of the motion unless the docket conditions of the court require a later hearing.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-CIV-PROC-CODE-425-16-E` |
| locator | Cal. Civ. Proc. Code § 425.16(e)-(j) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2025 |
| retrieved at | 2026-07-27T20:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=425.16> |
| source sha256 | `b56fcecef40548e14d921561ce15a88012ab7f6d4230872177062eb5bd9b4ac2` |

<details><summary>Full source excerpt as stored in the registry (445 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
As used in this section, “act in furtherance of a person’s right of petition or free speech under the United States or California Constitution in connection with a public issue” includes: (1) any written or oral statement or writing made before a legislative, executive, or judicial proceeding, or any other official proceeding authorized by law, (2) any written or oral statement or writing made in connection with an issue under consideration or review by a legislative, executive, or judicial body, or any other official proceeding authorized by law, (3) any written or oral statement or writing made in a place open to the public or a public forum in connection with an issue of public interest, or (4) any other conduct in furtherance of the exercise of the constitutional right of petition or the constitutional right of free speech in connection with a public issue or an issue of public interest. (f) The special motion may be filed within 60 days of the service of the complaint or, in the court’s discretion, at any later time upon terms it deems proper. The motion shall be scheduled by the clerk of the court for a hearing not more than 30 days after the service of the motion unless the docket conditions of the court require a later hearing. (g) All discovery proceedings in the action shall be stayed upon the filing of a notice of motion made pursuant to this section. The stay of discovery shall remain in effect until notice of entry of the order ruling on the motion. The court, on noticed motion and for good cause shown, may order that specified discovery be conducted notwithstanding this subdivision. (h) For purposes of this section, “complaint” includes “cross-complaint” and “petition,” “plaintiff” includes “cross-complainant” and “petitioner,” and “defendant” includes “cross-defendant” and “respondent.” (i) An order granting or denying a special motion to strike shall be appealable under Section 904.1. (j) (1) Any party who files a special motion to strike pursuant to this section, and any party who files an opposition to a special motion to strike, shall, promptly upon so filing, transmit to the Judicial Council, by email or facsimile, a copy of the endorsed, filed caption page of the motion or opposition, a copy of any related notice of appeal or petition for a writ, and a conformed copy of any order issued pursuant to this section, including any order granting or denying a special motion to strike, discovery, or fees. (2) The Judicial Council shall maintain a public record of information transmitted pursuant to this subdivision for at least three years, and may store the information on microfilm or other appropriate electronic media.
```

</details>

### C2. `multiturn-013-c2`

**Criterion:** Answers the deposition question with the discovery stay: all discovery proceedings are stayed upon the filing of a notice of motion under the section and remain stayed until notice of entry of the order ruling on the motion, subject to a noticed motion for good cause to conduct specified discovery.

#### Proposition `multiturn-013-p2`

> All discovery proceedings are stayed upon the filing of a notice of motion under section 425.16, the stay remains in effect until notice of entry of the order ruling on the motion, and the court may on noticed motion and for good cause shown order that specified discovery be conducted.

**Verbatim authoritative excerpt relied on:**

```text
(g) All discovery proceedings in the action shall be stayed upon the filing of a notice of motion made pursuant to this section. The stay of discovery shall remain in effect until notice of entry of the order ruling on the motion. The court, on noticed motion and for good cause shown, may order that specified discovery be conducted notwithstanding this subdivision.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-CIV-PROC-CODE-425-16-E` |
| locator | Cal. Civ. Proc. Code § 425.16(e)-(j) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2025 |
| retrieved at | 2026-07-27T20:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=425.16> |
| source sha256 | `b56fcecef40548e14d921561ce15a88012ab7f6d4230872177062eb5bd9b4ac2` |

<details><summary>Full source excerpt as stored in the registry (445 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
As used in this section, “act in furtherance of a person’s right of petition or free speech under the United States or California Constitution in connection with a public issue” includes: (1) any written or oral statement or writing made before a legislative, executive, or judicial proceeding, or any other official proceeding authorized by law, (2) any written or oral statement or writing made in connection with an issue under consideration or review by a legislative, executive, or judicial body, or any other official proceeding authorized by law, (3) any written or oral statement or writing made in a place open to the public or a public forum in connection with an issue of public interest, or (4) any other conduct in furtherance of the exercise of the constitutional right of petition or the constitutional right of free speech in connection with a public issue or an issue of public interest. (f) The special motion may be filed within 60 days of the service of the complaint or, in the court’s discretion, at any later time upon terms it deems proper. The motion shall be scheduled by the clerk of the court for a hearing not more than 30 days after the service of the motion unless the docket conditions of the court require a later hearing. (g) All discovery proceedings in the action shall be stayed upon the filing of a notice of motion made pursuant to this section. The stay of discovery shall remain in effect until notice of entry of the order ruling on the motion. The court, on noticed motion and for good cause shown, may order that specified discovery be conducted notwithstanding this subdivision. (h) For purposes of this section, “complaint” includes “cross-complaint” and “petition,” “plaintiff” includes “cross-complainant” and “petitioner,” and “defendant” includes “cross-defendant” and “respondent.” (i) An order granting or denying a special motion to strike shall be appealable under Section 904.1. (j) (1) Any party who files a special motion to strike pursuant to this section, and any party who files an opposition to a special motion to strike, shall, promptly upon so filing, transmit to the Judicial Council, by email or facsimile, a copy of the endorsed, filed caption page of the motion or opposition, a copy of any related notice of appeal or petition for a writ, and a conformed copy of any order issued pursuant to this section, including any order granting or denying a special motion to strike, discovery, or fees. (2) The Judicial Council shall maintain a public record of information transmitted pursuant to this subdivision for at least three years, and may store the information on microfilm or other appropriate electronic media.
```

</details>

### C3. `multiturn-013-c3`

**Criterion:** Answers the appeal question: an order granting or denying a special motion to strike is appealable under section 904.1, so the client need not wait for a final judgment.

#### Proposition `multiturn-013-p3`

> An order granting or denying a special motion to strike shall be appealable under Code of Civil Procedure section 904.1.

**Verbatim authoritative excerpt relied on:**

```text
(i) An order granting or denying a special motion to strike shall be appealable under Section 904.1.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-CIV-PROC-CODE-425-16-E` |
| locator | Cal. Civ. Proc. Code § 425.16(e)-(j) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2025 |
| retrieved at | 2026-07-27T20:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=425.16> |
| source sha256 | `b56fcecef40548e14d921561ce15a88012ab7f6d4230872177062eb5bd9b4ac2` |

<details><summary>Full source excerpt as stored in the registry (445 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
As used in this section, “act in furtherance of a person’s right of petition or free speech under the United States or California Constitution in connection with a public issue” includes: (1) any written or oral statement or writing made before a legislative, executive, or judicial proceeding, or any other official proceeding authorized by law, (2) any written or oral statement or writing made in connection with an issue under consideration or review by a legislative, executive, or judicial body, or any other official proceeding authorized by law, (3) any written or oral statement or writing made in a place open to the public or a public forum in connection with an issue of public interest, or (4) any other conduct in furtherance of the exercise of the constitutional right of petition or the constitutional right of free speech in connection with a public issue or an issue of public interest. (f) The special motion may be filed within 60 days of the service of the complaint or, in the court’s discretion, at any later time upon terms it deems proper. The motion shall be scheduled by the clerk of the court for a hearing not more than 30 days after the service of the motion unless the docket conditions of the court require a later hearing. (g) All discovery proceedings in the action shall be stayed upon the filing of a notice of motion made pursuant to this section. The stay of discovery shall remain in effect until notice of entry of the order ruling on the motion. The court, on noticed motion and for good cause shown, may order that specified discovery be conducted notwithstanding this subdivision. (h) For purposes of this section, “complaint” includes “cross-complaint” and “petition,” “plaintiff” includes “cross-complainant” and “petitioner,” and “defendant” includes “cross-defendant” and “respondent.” (i) An order granting or denying a special motion to strike shall be appealable under Section 904.1. (j) (1) Any party who files a special motion to strike pursuant to this section, and any party who files an opposition to a special motion to strike, shall, promptly upon so filing, transmit to the Judicial Council, by email or facsimile, a copy of the endorsed, filed caption page of the motion or opposition, a copy of any related notice of appeal or petition for a writ, and a conformed copy of any order issued pursuant to this section, including any order granting or denying a special motion to strike, discovery, or fees. (2) The Judicial Council shall maintain a public record of information transmitted pursuant to this subdivision for at least three years, and may store the information on microfilm or other appropriate electronic media.
```

</details>

### C4. `multiturn-013-c4`

**Criterion:** States fee exposure both ways: a prevailing defendant is entitled to attorney's fees and costs, and a plaintiff prevailing on a motion found frivolous or solely intended to cause unnecessary delay is awarded costs and reasonable attorney's fees.

#### Proposition `multiturn-013-p4`

> A prevailing defendant on a special motion to strike is entitled to recover attorney's fees and costs, and if the court finds the motion frivolous or solely intended to cause unnecessary delay it shall award costs and reasonable attorney's fees to a plaintiff prevailing on the motion.

**Verbatim authoritative excerpt relied on:**

```text
(c) (1) Except as provided in paragraph (2), in any action subject to subdivision (b), a prevailing defendant on a special motion to strike shall be entitled to recover that defendant’s attorney’s fees and costs. If the court finds that a special motion to strike is frivolous or is solely intended to cause unnecessary delay, the court shall award costs and reasonable attorney’s fees to a plaintiff prevailing on the motion, pursuant to Section 128.5.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-CIV-PROC-CODE-425-16-A` |
| locator | Cal. Civ. Proc. Code § 425.16(a), (b)(2)-(d) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2025 |
| retrieved at | 2026-07-27T20:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=425.16> |
| source sha256 | `9dee8cbbb809447acd0a323bb22aa19d834b61b6dcb27ff4fefb6e3d12961cd9` |

<details><summary>Full source excerpt as stored in the registry (465 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
The Legislature finds and declares that there has been a disturbing increase in lawsuits brought primarily to chill the valid exercise of the constitutional rights of freedom of speech and petition for the redress of grievances. The Legislature finds and declares that it is in the public interest to encourage continued participation in matters of public significance, and that this participation should not be chilled through abuse of the judicial process. To this end, this section shall be construed broadly. (b) (1) A cause of action against a person arising from any act of that person in furtherance of the person’s right of petition or free speech under the United States Constitution or the California Constitution in connection with a public issue shall be subject to a special motion to strike, unless the court determines that the plaintiff has established that there is a probability that the plaintiff will prevail on the claim. (2) In making its determination, the court shall consider the pleadings, and supporting and opposing affidavits stating the facts upon which the liability or defense is based. (3) If the court determines that the plaintiff has established a probability that the plaintiff will prevail on the claim, neither that determination nor the fact of that determination shall be admissible in evidence at any later stage of the case, or in any subsequent action, and no burden of proof or degree of proof otherwise applicable shall be affected by that determination in any later stage of the case or in any subsequent proceeding. (c) (1) Except as provided in paragraph (2), in any action subject to subdivision (b), a prevailing defendant on a special motion to strike shall be entitled to recover that defendant’s attorney’s fees and costs. If the court finds that a special motion to strike is frivolous or is solely intended to cause unnecessary delay, the court shall award costs and reasonable attorney’s fees to a plaintiff prevailing on the motion, pursuant to Section 128.5. (2) A defendant who prevails on a special motion to strike in an action subject to paragraph (1) shall not be entitled to attorney’s fees and costs if that cause of action is brought pursuant to Section 11130, 11130.3, 54960, or 54960.1 of the Government Code, or pursuant to Chapter 2 (commencing with Section 7923.100) of Part 4 of Division 10 of Title 1 of the Government Code. Nothing in this paragraph shall be construed to prevent a prevailing defendant from recovering attorney’s fees and costs pursuant to Section 7923.115, 11130.5, or 54960.5 of the Government Code. (d) This section shall not apply to any enforcement action brought in the name of the people of the State of California by the Attorney General, Insurance Commissioner, district attorney, or city attorney, acting as a public prosecutor.
```

</details>

### C5. `multiturn-013-c5`

**Criterion:** Ties the answer back to the turn-1 facts by identifying the city-council testimony as a statement made before a legislative or other official proceeding authorized by law.

#### Proposition `multiturn-013-p5`

> A protected act includes any written or oral statement or writing made before a legislative, executive, or judicial proceeding, or any other official proceeding authorized by law.

**Verbatim authoritative excerpt relied on:**

```text
(1) any written or oral statement or writing made before a legislative, executive, or judicial proceeding, or any other official proceeding authorized by law
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-CIV-PROC-CODE-425-16-E` |
| locator | Cal. Civ. Proc. Code § 425.16(e)-(j) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2025 |
| retrieved at | 2026-07-27T20:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=425.16> |
| source sha256 | `b56fcecef40548e14d921561ce15a88012ab7f6d4230872177062eb5bd9b4ac2` |

<details><summary>Full source excerpt as stored in the registry (445 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
As used in this section, “act in furtherance of a person’s right of petition or free speech under the United States or California Constitution in connection with a public issue” includes: (1) any written or oral statement or writing made before a legislative, executive, or judicial proceeding, or any other official proceeding authorized by law, (2) any written or oral statement or writing made in connection with an issue under consideration or review by a legislative, executive, or judicial body, or any other official proceeding authorized by law, (3) any written or oral statement or writing made in a place open to the public or a public forum in connection with an issue of public interest, or (4) any other conduct in furtherance of the exercise of the constitutional right of petition or the constitutional right of free speech in connection with a public issue or an issue of public interest. (f) The special motion may be filed within 60 days of the service of the complaint or, in the court’s discretion, at any later time upon terms it deems proper. The motion shall be scheduled by the clerk of the court for a hearing not more than 30 days after the service of the motion unless the docket conditions of the court require a later hearing. (g) All discovery proceedings in the action shall be stayed upon the filing of a notice of motion made pursuant to this section. The stay of discovery shall remain in effect until notice of entry of the order ruling on the motion. The court, on noticed motion and for good cause shown, may order that specified discovery be conducted notwithstanding this subdivision. (h) For purposes of this section, “complaint” includes “cross-complaint” and “petition,” “plaintiff” includes “cross-complainant” and “petitioner,” and “defendant” includes “cross-defendant” and “respondent.” (i) An order granting or denying a special motion to strike shall be appealable under Section 904.1. (j) (1) Any party who files a special motion to strike pursuant to this section, and any party who files an opposition to a special motion to strike, shall, promptly upon so filing, transmit to the Judicial Council, by email or facsimile, a copy of the endorsed, filed caption page of the motion or opposition, a copy of any related notice of appeal or petition for a writ, and a conformed copy of any order issued pursuant to this section, including any order granting or denying a special motion to strike, discovery, or fees. (2) The Judicial Council shall maintain a public record of information transmitted pursuant to this subdivision for at least three years, and may store the information on microfilm or other appropriate electronic media.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `multiturn-013-a1` | statute | 425.16 | — |
| `multiturn-013-a2` | contains | 60 days | UNSUPPORTED_PROPOSITION |
| `multiturn-013-a3` | contains | stayed | — |
| `multiturn-013-a4` | contains | 904.1 | — |

## 5. Your decision

```
task_id:      multiturn-013
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
  --task multiturn-013 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
