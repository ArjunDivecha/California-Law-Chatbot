# Review packet — `verification-real-002`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `verification-real-002` |
| category | verification |
| workflow | verify |
| track | frozen_evidence |
| data_class | public |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `85b1b3c14d3247d85ea5d123c9796238dcd0fdfe4d488d106bbef70b081a845d` |
| proposition_hashes | 3 — `789bc5032f92`, `c1a8b6b1fc1e`, `da121a078144` |
| source_hashes | 3 — `313629a04f8c`, `b4a126bb4b9d`, `d7d7746cfd70` |

## ⚠ Source caveats you must weigh

- **`CIT-REAL-7` (Costco Wholesale Corp. v. Superior Court) — NO_OFFICIAL_HOSTING.** The excerpt is hosted by an aggregator, not by an official California court site. The B8a audit tried the courts.ca.gov opinion archive, the published-opinion URL scheme, courts.ca.gov site search, and the Wayback Machine and found no live official copy (these are mostly pre-2015 Supreme Court and pre-1993 Court of Appeal opinions that predate the electronic archive). Decide whether you are willing to attest that the quoted words are the court’s words on this basis.

## 2. Prompt (what the model is asked)

```text
I am opposing a motion to compel production of an attorney opinion letter and want to cite Costco Wholesale Corp. v. Superior Court (2009) 47 Cal.4th 725 for the rule that the entire communication is privileged. Is that citation accurate, and does the case really say that?
```

## 3. Material criteria and their propositions

### C1. `verification-real-002-c1`

**Criterion:** Confirms that the citation 47 Cal.4th 725 corresponds to Costco Wholesale Corp. v. Superior Court, docket No. S163335, filed November 30, 2009.

#### Proposition `verification-real-002-p1`

> Official-reporter citation index metadata places Costco Wholesale Corp. v. Superior Court (docket No. S163335, filed November 30, 2009) at 47 Cal. 4th 725 in the California Official Reports, with parallel citations 219 P.3d 736 and 101 Cal. Rptr. 3d 758.

**Verbatim authoritative excerpt relied on:**

```text
Costco Wholesale Corp. v. Superior Court | Date Filed: November 30th, 2009 | Citations: 219 P.3d 736, 47 Cal. 4th 725, 101 Cal. Rptr. 3d 758, 2009 Cal. LEXIS 12375 | Docket Number: No. S163335
```

| source field | value |
| --- | --- |
| source_id | `CIT-INDEX-CAL-4TH-47` |
| locator | California Official Reports, volume 47 Cal.4th citation index (window covering page 725) |
| jurisdiction | California |
| authority status | Official-reporter citation index metadata (CourtListener); used for citation-metadata verification only, not as the source of a substantive legal proposition |
| effective date | 2026-07-27 |
| retrieved at | 2026-07-27T23:59:00Z |
| canonical URL | <https://www.courtlistener.com/c/cal-4th/47/> |
| source sha256 | `b4a126bb4b9d51ded0fdde9a0771f28277ff179942d14bca9238a932a15e1749` |

<details><summary>Full source excerpt as stored in the registry (197 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
CourtListener citation index for California Official Reports, volume 47 Cal.4th (https://www.courtlistener.com/c/cal-4th/47/), entries ordered by official-reporter starting page; 45 entries indexed for the volume. Window covering page 725: People v. Johnson | Date Filed: November 23rd, 2009 | Citations: 218 P.3d 972, 47 Cal. 4th 668, 101 Cal. Rptr. 3d 332, 2009 Cal. LEXIS 12136 | Docket Number: S166894 ;; Roby v. McKesson Corp. | Date Filed: November 30th, 2009 | Citations: 22 Am. Disabilities Cas. (BNA) 1041, 219 P.3d 749, 47 Cal. 4th 686, 101 Cal. Rptr. 3d 773, 2009 Cal. LEXIS 12374 | Docket Number: S149752 ;; Costco Wholesale Corp. v. Superior Court | Date Filed: November 30th, 2009 | Citations: 219 P.3d 736, 47 Cal. 4th 725, 101 Cal. Rptr. 3d 758, 2009 Cal. LEXIS 12375 | Docket Number: No. S163335 ;; People v. Ervine | Date Filed: December 7th, 2009 | Citations: 220 P.3d 820, 47 Cal. 4th 745, 102 Cal. Rptr. 3d 786, 2009 Cal. LEXIS 12406 | Docket Number: S054372 ;; People v. Butler | Date Filed: December 10th, 2009 | Citations: 219 P.3d 982, 47 Cal. 4th 814, 102 Cal. Rptr. 3d 56, 2009 Cal. LEXIS 12407 | Docket Number: S068230
```

</details>

### C2. `verification-real-002-c2`

**Criterion:** Confirms the opinion holds that where the communication is a confidential one between attorney and client, the entire communication, including its recitation or summary of factual material, is privileged.

#### Proposition `verification-real-002-p2`

> The opinion states that when the communication is a confidential one between attorney and client, the entire communication, including its recitation or summary of factual material, is privileged.

**Verbatim authoritative excerpt relied on:**

```text
when the communication is a confidential one between attorney and client, the entire communication, including its recitation or summary of factual material, is privileged
```

| source field | value |
| --- | --- |
| source_id | `CIT-REAL-7` |
| locator | 47 Cal.4th 725 |
| jurisdiction | California |
| authority status | Published, precedential (California Supreme Court opinion) |
| effective date | 2009-11-30 |
| retrieved at | 2026-07-27T23:59:00Z |
| canonical URL | <https://www.courtlistener.com/opinion/5608098/costco-wholesale-corp-v-superior-court/> |
| source sha256 | `d7d7746cfd70db518a25a925c2c630fb30a6824409f9b3399955215c66b65518` |
| ⚠ officiality | AGGREGATOR-HOSTED (NO_OFFICIAL_HOSTING) |

<details><summary>Full source excerpt as stored in the registry (178 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
WERDEGAR, J. In this case we consider whether the trial court erred by directing a referee to conduct an in camera review of an opinion letter sent by outside counsel to a corporate client, allowing the referee to redact the letter to conceal that portion the referee believed to be privileged, and ordering the client to disclose the remainder to the opposing party. We conclude the court’s directions and order violated the attorney-client privilege, and violated as well the statutory prohibition against requiring disclosure of information claimed to be subject to the attorney-client privilege in order to rule on a claim of privilege. (Evid. Code, § 915, subd. (a).) ... As we have explained, when the communication is a confidential one between attorney and client, the entire communication, including its recitation or summary of factual material, is privileged. In sum, if, as plaintiffs contend, the factual material referred to or summarized in Hensley’s opinion letter is itself unprivileged it may be discoverable by some other means, but plaintiffs may not obtain it by compelling disclosure of the letter.
```

</details>

### C3. `verification-real-002-c3`

**Criterion:** States that the decision is published in the California Official Reports at 47 Cal.4th 725 and, as a published California opinion, may be cited or relied on.

#### Proposition `verification-real-002-p1`

> Official-reporter citation index metadata places Costco Wholesale Corp. v. Superior Court (docket No. S163335, filed November 30, 2009) at 47 Cal. 4th 725 in the California Official Reports, with parallel citations 219 P.3d 736 and 101 Cal. Rptr. 3d 758.

**Verbatim authoritative excerpt relied on:**

```text
Costco Wholesale Corp. v. Superior Court | Date Filed: November 30th, 2009 | Citations: 219 P.3d 736, 47 Cal. 4th 725, 101 Cal. Rptr. 3d 758, 2009 Cal. LEXIS 12375 | Docket Number: No. S163335
```

| source field | value |
| --- | --- |
| source_id | `CIT-INDEX-CAL-4TH-47` |
| locator | California Official Reports, volume 47 Cal.4th citation index (window covering page 725) |
| jurisdiction | California |
| authority status | Official-reporter citation index metadata (CourtListener); used for citation-metadata verification only, not as the source of a substantive legal proposition |
| effective date | 2026-07-27 |
| retrieved at | 2026-07-27T23:59:00Z |
| canonical URL | <https://www.courtlistener.com/c/cal-4th/47/> |
| source sha256 | `b4a126bb4b9d51ded0fdde9a0771f28277ff179942d14bca9238a932a15e1749` |

<details><summary>Full source excerpt as stored in the registry (197 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
CourtListener citation index for California Official Reports, volume 47 Cal.4th (https://www.courtlistener.com/c/cal-4th/47/), entries ordered by official-reporter starting page; 45 entries indexed for the volume. Window covering page 725: People v. Johnson | Date Filed: November 23rd, 2009 | Citations: 218 P.3d 972, 47 Cal. 4th 668, 101 Cal. Rptr. 3d 332, 2009 Cal. LEXIS 12136 | Docket Number: S166894 ;; Roby v. McKesson Corp. | Date Filed: November 30th, 2009 | Citations: 22 Am. Disabilities Cas. (BNA) 1041, 219 P.3d 749, 47 Cal. 4th 686, 101 Cal. Rptr. 3d 773, 2009 Cal. LEXIS 12374 | Docket Number: S149752 ;; Costco Wholesale Corp. v. Superior Court | Date Filed: November 30th, 2009 | Citations: 219 P.3d 736, 47 Cal. 4th 725, 101 Cal. Rptr. 3d 758, 2009 Cal. LEXIS 12375 | Docket Number: No. S163335 ;; People v. Ervine | Date Filed: December 7th, 2009 | Citations: 220 P.3d 820, 47 Cal. 4th 745, 102 Cal. Rptr. 3d 786, 2009 Cal. LEXIS 12406 | Docket Number: S054372 ;; People v. Butler | Date Filed: December 10th, 2009 | Citations: 219 P.3d 982, 47 Cal. 4th 814, 102 Cal. Rptr. 3d 56, 2009 Cal. LEXIS 12407 | Docket Number: S068230
```

</details>

#### Proposition `verification-real-002-p3`

> Under California Rules of Court, rule 8.1115(d), a published California opinion may be cited or relied on as soon as it is certified for publication or ordered published.

**Verbatim authoritative excerpt relied on:**

```text
A published California opinion may be cited or relied on as soon as it is certified for publication or ordered published.
```

| source field | value |
| --- | --- |
| source_id | `CRC-8-1115` |
| locator | Cal. Rules of Court, rule 8.1115(a), (d), (e) |
| jurisdiction | California |
| authority status | Operative California Rule of Court published by the Judicial Council of California on the official courts.ca.gov rules index; subdivision (e) adopted effective July 1, 2016 |
| effective date | 2016-07-01 |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://courts.ca.gov/cms/rules/index/eight/rule8_1115> |
| source sha256 | `313629a04f8c81e99743bbe4d537444e4fbce9ab7ceb7f44633408af70bd91a4` |

<details><summary>Full source excerpt as stored in the registry (301 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) Unpublished opinion Except as provided in (b), an opinion of a California Court of Appeal or superior court appellate division that is not certified for publication or ordered published must not be cited or relied on by a court or a party in any other action. (d) When a published opinion may be cited A published California opinion may be cited or relied on as soon as it is certified for publication or ordered published. (e) When review of published opinion has been granted (1) While review is pending Pending review and filing of the Supreme Court's opinion, unless otherwise ordered by the Supreme Court under (3), a published opinion of a Court of Appeal in the matter has no binding or precedential effect, and may be cited for potentially persuasive value only. Any citation to the Court of Appeal opinion must also note the grant of review and any subsequent action by the Supreme Court. (2) After decision on review After decision on review by the Supreme Court, unless otherwise ordered by the Supreme Court under (3), a published opinion of a Court of Appeal in the matter, and any published opinion of a Court of Appeal in a matter in which the Supreme Court has ordered review and deferred action pending the decision, is citable and has binding or precedential effect, except to the extent it is inconsistent with the decision of the Supreme Court or is disapproved by that court. (3) Supreme Court order At any time after granting review or after decision on review, the Supreme Court may order that all or part of an opinion covered by (1) or (2) is not citable or has a binding or precedential effect different from that specified in (1) or (2). (Subd (e) adopted effective July 1, 2016.)
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `verification-real-002-a1` | citation | Costco | — |
| `verification-real-002-a2` | contains | 2009 | — |

## 5. Your decision

```
task_id:      verification-real-002
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
  --task verification-real-002 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
