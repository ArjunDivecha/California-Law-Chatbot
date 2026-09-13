# Review packet — `longcontext-009`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `longcontext-009` |
| category | long_context |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `f28736b132edadf8e5ab182744df149a7f729624800790d60b5b8ee932863d24` |
| proposition_hashes | 5 — `0df2269de6b5`, `5cfb10437dcf`, `80dd0187ad88`, `927d4e7d3305`, `bc5d656e1680` |
| source_hashes | 1 — `ad5ba1c60565` |

## 2. Prompt (what the model is asked)

```text
Long-context California bifurcation problem (all parties, documents, and facts synthetic). A roughly 46,000-word consolidated litigation file is embedded in the graded turn. A correspondence insert at about 35 percent of the correspondence section is a July 30, 2025 objection asserting that no preliminary declaration of disclosure has been served. A declaration insert at about 31 percent of the declaration section establishes that the preliminary declaration of disclosure with a completed schedule of assets and debts was served with the noticed motion by electronic service on August 15, 2025, sixteen days after that objection, that the final declaration of disclosure served October 2, 2025 is a different document, and that the parties never stipulated in writing to defer service. A second declaration insert at about 68 percent establishes that the petitioner is a named dependent on the respondent’s employer group health plan with no coverage of her own, is the contingent survivor annuitant under his defined benefit pension whose survivor election terminates on entry of a status judgment, that the respondent holds an IRA in which the community has an interest and a nonprobate transfer account, and that she resides in the family residence. The graded answer must apply Family Code section 2337(a), (b), (c)(2), (c)(5), and (c)(8).
```

## 3. Material criteria and their propositions

### C1. `longcontext-009-c1`

**Criterion:** Retrieves the buried proof of service and states that the preliminary declaration of disclosure with a completed schedule of assets and debts was served with the noticed motion on August 15, 2025, so the section 2337(b) prerequisite is satisfied; explains that the July 30, 2025 objection predates that service and that the October 2, 2025 final declaration of disclosure is a different document.

#### Proposition `longcontext-009-p2`

> A preliminary declaration of disclosure with a completed schedule of assets and debts shall be served on the nonmoving party with the noticed motion unless it has been served previously or unless the parties stipulate in writing to defer service until a later time.

**Verbatim authoritative excerpt relied on:**

```text
A preliminary declaration of disclosure with a completed schedule of assets and debts shall be served on the nonmoving party with the noticed motion unless it has been served previously, or unless the parties stipulate in writing to defer service of the preliminary declaration of disclosure until a later time.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2337` |
| locator | Cal. Fam. Code § 2337 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2016 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2337> |
| source sha256 | `ad5ba1c6056549ca3fcad037534091c161419a9d2364da133bd93af49b6a76e2` |

<details><summary>Full source excerpt as stored in the registry (990 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) In a proceeding for dissolution of marriage, the court, upon noticed motion, may sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues. (b) A preliminary declaration of disclosure with a completed schedule of assets and debts shall be served on the nonmoving party with the noticed motion unless it has been served previously, or unless the parties stipulate in writing to defer service of the preliminary declaration of disclosure until a later time. (c) The court may impose upon a party any of the following conditions on granting a severance of the issue of the dissolution of the status of the marriage, and in case of that party’s death, an order of any of the following conditions continues to be binding upon that party’s estate: (1) The party shall indemnify and hold the other party harmless from any taxes, reassessments, interest, and penalties payable by the other party in connection with the division of the community estate that would not have been payable if the parties were still married at the time the division was made. (2) Until judgment has been entered on all remaining issues and has become final, the party shall maintain all existing health and medical insurance coverage for the other party and any minor children as named dependents, so long as the party is eligible to do so. If at any time during this period the party is not eligible to maintain that coverage, the party shall, at the party’s sole expense, provide and maintain health and medical insurance coverage that is comparable to the existing health and medical insurance coverage to the extent it is available. To the extent that coverage is not available, the party shall be responsible to pay, and shall demonstrate to the court’s satisfaction the ability to pay, for the health and medical care for the other party and the minor children, to the extent that care would have been covered by the existing insurance coverage but for the dissolution of marital status, and shall otherwise indemnify and hold the other party harmless from any adverse consequences resulting from the loss or reduction of the existing coverage. For purposes of this subdivision, “health and medical insurance coverage” includes any coverage for which the parties are eligible under any group or individual health or other medical plan, fund, policy, or program. (3) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in a termination of the other party’s right to a probate homestead in the residence in which the other party resides at the time the severance is granted. (4) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the rights of the other party to a probate family allowance as the surviving spouse of the party. (5) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the other party’s rights with respect to any retirement, survivor, or deferred compensation benefits under any plan, fund, or arrangement, or to any elections or options associated therewith, to the extent that the other party would have been entitled to those benefits or elections as the spouse or surviving spouse of the party. (6) The party shall indemnify and hold the other party harmless from any adverse consequences if the bifurcation results in the loss of rights to social security benefits or elections to the extent the other party would have been entitled to those benefits or elections as the surviving spouse of the party. (7) (A) The court may make an order pursuant to paragraph (3) of subdivision (b) of Section 5040 of the Probate Code, if appropriate, that a party maintain a beneficiary designation for a nonprobate transfer, as described in Section 5000 of the Probate Code, for a spouse or domestic partner for up to one-half of or, upon a showing of good cause, for all of a nonprobate transfer asset until judgment has been entered with respect to the community ownership of that asset, and until the other party’s interest therein has been distributed to him or her. (B) Except upon a showing of good cause, this paragraph does not apply to any of the following: (i) A nonprobate transfer described in Section 5000 of the Probate Code that was not created by either party or that was acquired by either party by gift, descent, or devise. (ii) An irrevocable trust. (iii) A trust of which neither party is the grantor. (iv) Powers of appointment under a trust instrument that was not created by either party or of which neither party is a grantor. (v) The execution and filing of a disclaimer pursuant to Part 8 (commencing with Section 260) of Division 2 of the Probate Code. (vi) The appointment of a party as a trustee. (8) In order to preserve the ability of the party to defer the distribution of the Individual Retirement Account or annuity (IRA) established under Section 408 or 408A of the Internal Revenue Code of 1986, as amended, (IRC) upon the death of the other party, the court may require that one-half, or all upon a showing of good cause, of the community interest in any IRA, by or for the benefit of the party, be assigned and transferred to the other party pursuant to Section 408(d)(6) of the Internal Revenue Code. This paragraph does not limit the power granted pursuant to subdivision (g).
```

</details>

### C2. `longcontext-009-c2`

**Criterion:** States the section 2337(a) authority that in a dissolution proceeding the court may, upon noticed motion, sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues.

#### Proposition `longcontext-009-p1`

> In a proceeding for dissolution of marriage the court, upon noticed motion, may sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues.

**Verbatim authoritative excerpt relied on:**

```text
In a proceeding for dissolution of marriage, the court, upon noticed motion, may sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2337` |
| locator | Cal. Fam. Code § 2337 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2016 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2337> |
| source sha256 | `ad5ba1c6056549ca3fcad037534091c161419a9d2364da133bd93af49b6a76e2` |

<details><summary>Full source excerpt as stored in the registry (990 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) In a proceeding for dissolution of marriage, the court, upon noticed motion, may sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues. (b) A preliminary declaration of disclosure with a completed schedule of assets and debts shall be served on the nonmoving party with the noticed motion unless it has been served previously, or unless the parties stipulate in writing to defer service of the preliminary declaration of disclosure until a later time. (c) The court may impose upon a party any of the following conditions on granting a severance of the issue of the dissolution of the status of the marriage, and in case of that party’s death, an order of any of the following conditions continues to be binding upon that party’s estate: (1) The party shall indemnify and hold the other party harmless from any taxes, reassessments, interest, and penalties payable by the other party in connection with the division of the community estate that would not have been payable if the parties were still married at the time the division was made. (2) Until judgment has been entered on all remaining issues and has become final, the party shall maintain all existing health and medical insurance coverage for the other party and any minor children as named dependents, so long as the party is eligible to do so. If at any time during this period the party is not eligible to maintain that coverage, the party shall, at the party’s sole expense, provide and maintain health and medical insurance coverage that is comparable to the existing health and medical insurance coverage to the extent it is available. To the extent that coverage is not available, the party shall be responsible to pay, and shall demonstrate to the court’s satisfaction the ability to pay, for the health and medical care for the other party and the minor children, to the extent that care would have been covered by the existing insurance coverage but for the dissolution of marital status, and shall otherwise indemnify and hold the other party harmless from any adverse consequences resulting from the loss or reduction of the existing coverage. For purposes of this subdivision, “health and medical insurance coverage” includes any coverage for which the parties are eligible under any group or individual health or other medical plan, fund, policy, or program. (3) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in a termination of the other party’s right to a probate homestead in the residence in which the other party resides at the time the severance is granted. (4) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the rights of the other party to a probate family allowance as the surviving spouse of the party. (5) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the other party’s rights with respect to any retirement, survivor, or deferred compensation benefits under any plan, fund, or arrangement, or to any elections or options associated therewith, to the extent that the other party would have been entitled to those benefits or elections as the spouse or surviving spouse of the party. (6) The party shall indemnify and hold the other party harmless from any adverse consequences if the bifurcation results in the loss of rights to social security benefits or elections to the extent the other party would have been entitled to those benefits or elections as the surviving spouse of the party. (7) (A) The court may make an order pursuant to paragraph (3) of subdivision (b) of Section 5040 of the Probate Code, if appropriate, that a party maintain a beneficiary designation for a nonprobate transfer, as described in Section 5000 of the Probate Code, for a spouse or domestic partner for up to one-half of or, upon a showing of good cause, for all of a nonprobate transfer asset until judgment has been entered with respect to the community ownership of that asset, and until the other party’s interest therein has been distributed to him or her. (B) Except upon a showing of good cause, this paragraph does not apply to any of the following: (i) A nonprobate transfer described in Section 5000 of the Probate Code that was not created by either party or that was acquired by either party by gift, descent, or devise. (ii) An irrevocable trust. (iii) A trust of which neither party is the grantor. (iv) Powers of appointment under a trust instrument that was not created by either party or of which neither party is a grantor. (v) The execution and filing of a disclaimer pursuant to Part 8 (commencing with Section 260) of Division 2 of the Probate Code. (vi) The appointment of a party as a trustee. (8) In order to preserve the ability of the party to defer the distribution of the Individual Retirement Account or annuity (IRA) established under Section 408 or 408A of the Internal Revenue Code of 1986, as amended, (IRC) upon the death of the other party, the court may require that one-half, or all upon a showing of good cause, of the community interest in any IRA, by or for the benefit of the party, be assigned and transferred to the other party pursuant to Section 408(d)(6) of the Internal Revenue Code. This paragraph does not limit the power granted pursuant to subdivision (g).
```

</details>

### C3. `longcontext-009-c3`

**Criterion:** Identifies the section 2337(c)(2) health and medical insurance condition as put in issue by the buried fact that Petitioner is covered as a named dependent under Respondent’s employer group plan and has no coverage available through an employer of her own.

#### Proposition `longcontext-009-p3`

> The court may condition severance on the moving party maintaining, until judgment has been entered on all remaining issues and has become final, all existing health and medical insurance coverage for the other party and any minor children as named dependents, so long as the party is eligible to do so.

**Verbatim authoritative excerpt relied on:**

```text
Until judgment has been entered on all remaining issues and has become final, the party shall maintain all existing health and medical insurance coverage for the other party and any minor children as named dependents, so long as the party is eligible to do so.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2337` |
| locator | Cal. Fam. Code § 2337 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2016 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2337> |
| source sha256 | `ad5ba1c6056549ca3fcad037534091c161419a9d2364da133bd93af49b6a76e2` |

<details><summary>Full source excerpt as stored in the registry (990 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) In a proceeding for dissolution of marriage, the court, upon noticed motion, may sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues. (b) A preliminary declaration of disclosure with a completed schedule of assets and debts shall be served on the nonmoving party with the noticed motion unless it has been served previously, or unless the parties stipulate in writing to defer service of the preliminary declaration of disclosure until a later time. (c) The court may impose upon a party any of the following conditions on granting a severance of the issue of the dissolution of the status of the marriage, and in case of that party’s death, an order of any of the following conditions continues to be binding upon that party’s estate: (1) The party shall indemnify and hold the other party harmless from any taxes, reassessments, interest, and penalties payable by the other party in connection with the division of the community estate that would not have been payable if the parties were still married at the time the division was made. (2) Until judgment has been entered on all remaining issues and has become final, the party shall maintain all existing health and medical insurance coverage for the other party and any minor children as named dependents, so long as the party is eligible to do so. If at any time during this period the party is not eligible to maintain that coverage, the party shall, at the party’s sole expense, provide and maintain health and medical insurance coverage that is comparable to the existing health and medical insurance coverage to the extent it is available. To the extent that coverage is not available, the party shall be responsible to pay, and shall demonstrate to the court’s satisfaction the ability to pay, for the health and medical care for the other party and the minor children, to the extent that care would have been covered by the existing insurance coverage but for the dissolution of marital status, and shall otherwise indemnify and hold the other party harmless from any adverse consequences resulting from the loss or reduction of the existing coverage. For purposes of this subdivision, “health and medical insurance coverage” includes any coverage for which the parties are eligible under any group or individual health or other medical plan, fund, policy, or program. (3) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in a termination of the other party’s right to a probate homestead in the residence in which the other party resides at the time the severance is granted. (4) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the rights of the other party to a probate family allowance as the surviving spouse of the party. (5) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the other party’s rights with respect to any retirement, survivor, or deferred compensation benefits under any plan, fund, or arrangement, or to any elections or options associated therewith, to the extent that the other party would have been entitled to those benefits or elections as the spouse or surviving spouse of the party. (6) The party shall indemnify and hold the other party harmless from any adverse consequences if the bifurcation results in the loss of rights to social security benefits or elections to the extent the other party would have been entitled to those benefits or elections as the surviving spouse of the party. (7) (A) The court may make an order pursuant to paragraph (3) of subdivision (b) of Section 5040 of the Probate Code, if appropriate, that a party maintain a beneficiary designation for a nonprobate transfer, as described in Section 5000 of the Probate Code, for a spouse or domestic partner for up to one-half of or, upon a showing of good cause, for all of a nonprobate transfer asset until judgment has been entered with respect to the community ownership of that asset, and until the other party’s interest therein has been distributed to him or her. (B) Except upon a showing of good cause, this paragraph does not apply to any of the following: (i) A nonprobate transfer described in Section 5000 of the Probate Code that was not created by either party or that was acquired by either party by gift, descent, or devise. (ii) An irrevocable trust. (iii) A trust of which neither party is the grantor. (iv) Powers of appointment under a trust instrument that was not created by either party or of which neither party is a grantor. (v) The execution and filing of a disclaimer pursuant to Part 8 (commencing with Section 260) of Division 2 of the Probate Code. (vi) The appointment of a party as a trustee. (8) In order to preserve the ability of the party to defer the distribution of the Individual Retirement Account or annuity (IRA) established under Section 408 or 408A of the Internal Revenue Code of 1986, as amended, (IRC) upon the death of the other party, the court may require that one-half, or all upon a showing of good cause, of the community interest in any IRA, by or for the benefit of the party, be assigned and transferred to the other party pursuant to Section 408(d)(6) of the Internal Revenue Code. This paragraph does not limit the power granted pursuant to subdivision (g).
```

</details>

### C4. `longcontext-009-c4`

**Criterion:** Identifies the section 2337(c)(5) retirement, survivor, or deferred compensation indemnity condition as put in issue by the buried fact that Petitioner is the contingent survivor annuitant under Respondent’s defined benefit plan and that the plan administrator has confirmed her survivor election rights terminate on entry of a judgment dissolving marital status.

#### Proposition `longcontext-009-p4`

> The court may condition severance on the party indemnifying and holding the other party harmless from any adverse consequences if the bifurcation results in the loss of the other party’s rights with respect to any retirement, survivor, or deferred compensation benefits, or any associated elections or options, that the other party would have been entitled to as the spouse or surviving spouse.

**Verbatim authoritative excerpt relied on:**

```text
Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the other party’s rights with respect to any retirement, survivor, or deferred compensation benefits under any plan, fund, or arrangement, or to any elections or options associated therewith, to the extent that the other party would have been entitled to those benefits or elections as the spouse or surviving spouse of the party.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2337` |
| locator | Cal. Fam. Code § 2337 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2016 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2337> |
| source sha256 | `ad5ba1c6056549ca3fcad037534091c161419a9d2364da133bd93af49b6a76e2` |

<details><summary>Full source excerpt as stored in the registry (990 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) In a proceeding for dissolution of marriage, the court, upon noticed motion, may sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues. (b) A preliminary declaration of disclosure with a completed schedule of assets and debts shall be served on the nonmoving party with the noticed motion unless it has been served previously, or unless the parties stipulate in writing to defer service of the preliminary declaration of disclosure until a later time. (c) The court may impose upon a party any of the following conditions on granting a severance of the issue of the dissolution of the status of the marriage, and in case of that party’s death, an order of any of the following conditions continues to be binding upon that party’s estate: (1) The party shall indemnify and hold the other party harmless from any taxes, reassessments, interest, and penalties payable by the other party in connection with the division of the community estate that would not have been payable if the parties were still married at the time the division was made. (2) Until judgment has been entered on all remaining issues and has become final, the party shall maintain all existing health and medical insurance coverage for the other party and any minor children as named dependents, so long as the party is eligible to do so. If at any time during this period the party is not eligible to maintain that coverage, the party shall, at the party’s sole expense, provide and maintain health and medical insurance coverage that is comparable to the existing health and medical insurance coverage to the extent it is available. To the extent that coverage is not available, the party shall be responsible to pay, and shall demonstrate to the court’s satisfaction the ability to pay, for the health and medical care for the other party and the minor children, to the extent that care would have been covered by the existing insurance coverage but for the dissolution of marital status, and shall otherwise indemnify and hold the other party harmless from any adverse consequences resulting from the loss or reduction of the existing coverage. For purposes of this subdivision, “health and medical insurance coverage” includes any coverage for which the parties are eligible under any group or individual health or other medical plan, fund, policy, or program. (3) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in a termination of the other party’s right to a probate homestead in the residence in which the other party resides at the time the severance is granted. (4) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the rights of the other party to a probate family allowance as the surviving spouse of the party. (5) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the other party’s rights with respect to any retirement, survivor, or deferred compensation benefits under any plan, fund, or arrangement, or to any elections or options associated therewith, to the extent that the other party would have been entitled to those benefits or elections as the spouse or surviving spouse of the party. (6) The party shall indemnify and hold the other party harmless from any adverse consequences if the bifurcation results in the loss of rights to social security benefits or elections to the extent the other party would have been entitled to those benefits or elections as the surviving spouse of the party. (7) (A) The court may make an order pursuant to paragraph (3) of subdivision (b) of Section 5040 of the Probate Code, if appropriate, that a party maintain a beneficiary designation for a nonprobate transfer, as described in Section 5000 of the Probate Code, for a spouse or domestic partner for up to one-half of or, upon a showing of good cause, for all of a nonprobate transfer asset until judgment has been entered with respect to the community ownership of that asset, and until the other party’s interest therein has been distributed to him or her. (B) Except upon a showing of good cause, this paragraph does not apply to any of the following: (i) A nonprobate transfer described in Section 5000 of the Probate Code that was not created by either party or that was acquired by either party by gift, descent, or devise. (ii) An irrevocable trust. (iii) A trust of which neither party is the grantor. (iv) Powers of appointment under a trust instrument that was not created by either party or of which neither party is a grantor. (v) The execution and filing of a disclaimer pursuant to Part 8 (commencing with Section 260) of Division 2 of the Probate Code. (vi) The appointment of a party as a trustee. (8) In order to preserve the ability of the party to defer the distribution of the Individual Retirement Account or annuity (IRA) established under Section 408 or 408A of the Internal Revenue Code of 1986, as amended, (IRC) upon the death of the other party, the court may require that one-half, or all upon a showing of good cause, of the community interest in any IRA, by or for the benefit of the party, be assigned and transferred to the other party pursuant to Section 408(d)(6) of the Internal Revenue Code. This paragraph does not limit the power granted pursuant to subdivision (g).
```

</details>

### C5. `longcontext-009-c5`

**Criterion:** Identifies the section 2337(c)(8) IRA condition as put in issue by the buried fact that Respondent holds a Cobblestone Trust individual retirement account in which the community has an interest.

#### Proposition `longcontext-009-p5`

> To preserve the ability to defer distribution of an IRA upon the death of the other party, the court may require that one-half, or all upon a showing of good cause, of the community interest in any IRA be assigned and transferred to the other party pursuant to Internal Revenue Code section 408(d)(6).

**Verbatim authoritative excerpt relied on:**

```text
In order to preserve the ability of the party to defer the distribution of the Individual Retirement Account or annuity (IRA) established under Section 408 or 408A of the Internal Revenue Code of 1986, as amended, (IRC) upon the death of the other party, the court may require that one-half, or all upon a showing of good cause, of the community interest in any IRA, by or for the benefit of the party, be assigned and transferred to the other party pursuant to Section 408(d)(6) of the Internal Revenue Code.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2337` |
| locator | Cal. Fam. Code § 2337 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2016 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2337> |
| source sha256 | `ad5ba1c6056549ca3fcad037534091c161419a9d2364da133bd93af49b6a76e2` |

<details><summary>Full source excerpt as stored in the registry (990 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) In a proceeding for dissolution of marriage, the court, upon noticed motion, may sever and grant an early and separate trial on the issue of the dissolution of the status of the marriage apart from other issues. (b) A preliminary declaration of disclosure with a completed schedule of assets and debts shall be served on the nonmoving party with the noticed motion unless it has been served previously, or unless the parties stipulate in writing to defer service of the preliminary declaration of disclosure until a later time. (c) The court may impose upon a party any of the following conditions on granting a severance of the issue of the dissolution of the status of the marriage, and in case of that party’s death, an order of any of the following conditions continues to be binding upon that party’s estate: (1) The party shall indemnify and hold the other party harmless from any taxes, reassessments, interest, and penalties payable by the other party in connection with the division of the community estate that would not have been payable if the parties were still married at the time the division was made. (2) Until judgment has been entered on all remaining issues and has become final, the party shall maintain all existing health and medical insurance coverage for the other party and any minor children as named dependents, so long as the party is eligible to do so. If at any time during this period the party is not eligible to maintain that coverage, the party shall, at the party’s sole expense, provide and maintain health and medical insurance coverage that is comparable to the existing health and medical insurance coverage to the extent it is available. To the extent that coverage is not available, the party shall be responsible to pay, and shall demonstrate to the court’s satisfaction the ability to pay, for the health and medical care for the other party and the minor children, to the extent that care would have been covered by the existing insurance coverage but for the dissolution of marital status, and shall otherwise indemnify and hold the other party harmless from any adverse consequences resulting from the loss or reduction of the existing coverage. For purposes of this subdivision, “health and medical insurance coverage” includes any coverage for which the parties are eligible under any group or individual health or other medical plan, fund, policy, or program. (3) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in a termination of the other party’s right to a probate homestead in the residence in which the other party resides at the time the severance is granted. (4) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the rights of the other party to a probate family allowance as the surviving spouse of the party. (5) Until judgment has been entered on all remaining issues and has become final, the party shall indemnify and hold the other party harmless from any adverse consequences to the other party if the bifurcation results in the loss of the other party’s rights with respect to any retirement, survivor, or deferred compensation benefits under any plan, fund, or arrangement, or to any elections or options associated therewith, to the extent that the other party would have been entitled to those benefits or elections as the spouse or surviving spouse of the party. (6) The party shall indemnify and hold the other party harmless from any adverse consequences if the bifurcation results in the loss of rights to social security benefits or elections to the extent the other party would have been entitled to those benefits or elections as the surviving spouse of the party. (7) (A) The court may make an order pursuant to paragraph (3) of subdivision (b) of Section 5040 of the Probate Code, if appropriate, that a party maintain a beneficiary designation for a nonprobate transfer, as described in Section 5000 of the Probate Code, for a spouse or domestic partner for up to one-half of or, upon a showing of good cause, for all of a nonprobate transfer asset until judgment has been entered with respect to the community ownership of that asset, and until the other party’s interest therein has been distributed to him or her. (B) Except upon a showing of good cause, this paragraph does not apply to any of the following: (i) A nonprobate transfer described in Section 5000 of the Probate Code that was not created by either party or that was acquired by either party by gift, descent, or devise. (ii) An irrevocable trust. (iii) A trust of which neither party is the grantor. (iv) Powers of appointment under a trust instrument that was not created by either party or of which neither party is a grantor. (v) The execution and filing of a disclaimer pursuant to Part 8 (commencing with Section 260) of Division 2 of the Probate Code. (vi) The appointment of a party as a trustee. (8) In order to preserve the ability of the party to defer the distribution of the Individual Retirement Account or annuity (IRA) established under Section 408 or 408A of the Internal Revenue Code of 1986, as amended, (IRC) upon the death of the other party, the court may require that one-half, or all upon a showing of good cause, of the community interest in any IRA, by or for the benefit of the party, be assigned and transferred to the other party pursuant to Section 408(d)(6) of the Internal Revenue Code. This paragraph does not limit the power granted pursuant to subdivision (g).
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `longcontext-009-a1` | contains | August 15, 2025 | — |
| `longcontext-009-a2` | statute | 2337 | — |
| `longcontext-009-a3` | contains | preliminary declaration of disclosure | — |
| `longcontext-009-a4` | not_contains | preliminary declaration of disclosure was served on October 2, 2025 | MATERIAL_FACT_INVENTION |

## 5. Your decision

```
task_id:      longcontext-009
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
  --task longcontext-009 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
