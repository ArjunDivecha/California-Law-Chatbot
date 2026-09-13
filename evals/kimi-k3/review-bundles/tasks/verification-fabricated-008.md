# Review packet — `verification-fabricated-008`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `verification-fabricated-008` |
| category | verification |
| workflow | verify |
| track | frozen_evidence |
| data_class | public |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `43075e4c97f6a0f7666361fca11b6c6ab2c1d8c14625c66349f397514e1fc25e` |
| proposition_hashes | 2 — `a3c46e10ef5c`, `c2b2bce4876e` |
| source_hashes | 1 — `61e0f440b798` |

## 2. Prompt (what the model is asked)

```text
A wage-and-hour demand letter cites Bell v. Bayside Restaurant Group (2017) 11 Cal.5th 332. Is that citation real? Please tell me what case is reported at 11 Cal.5th 332 and whether the year given is even consistent with that volume.
```

## 3. Material criteria and their propositions

### C1. `verification-fabricated-008-c1`

**Criterion:** Reports that the case reported at 11 Cal.5th 332 is People v. Steskal.

#### Proposition `verification-fabricated-008-p1`

> The case reported at 11 Cal.5th 332 is People v. Steskal, docket S122611.

**Verbatim authoritative excerpt relied on:**

```text
People v. Steskal | Date Filed: April 29th, 2021 | Citations: 485 P.3d 1, 11 Cal. 5th 332, 277 Cal. Rptr. 3d 604 | Docket Number: S122611
```

| source field | value |
| --- | --- |
| source_id | `CIT-INDEX-CAL-5TH-11` |
| locator | California Official Reports, volume 11 Cal.5th citation index (window covering page 332) |
| jurisdiction | California |
| authority status | Official-reporter citation index metadata (CourtListener); used for citation-metadata verification only, not as the source of a substantive legal proposition |
| effective date | 2026-07-27 |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://www.courtlistener.com/c/cal-5th/11/> |
| source sha256 | `61e0f440b7989c2f47a63481ffbe071c7626fb326f76edf29570667ff1f53a8a` |

<details><summary>Full source excerpt as stored in the registry (195 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
CourtListener citation index for California Official Reports, volume 11 Cal.5th (https://www.courtlistener.com/c/cal-5th/11/), entries ordered by official-reporter starting page; 23 entries indexed for the volume. Window covering page 332: Smith v. LoanMe, Inc. | Date Filed: April 1st, 2021 | Citations: 483 P.3d 869, 276 Cal. Rptr. 3d 746, 11 Cal. 5th 183 | Docket Number: S260391 ;; People v. Wilson | Date Filed: April 12th, 2021 | Citations: 484 P.3d 36, 11 Cal. 5th 259, 277 Cal. Rptr. 3d 24 | Docket Number: S087533 ;; People v. Steskal | Date Filed: April 29th, 2021 | Citations: 485 P.3d 1, 11 Cal. 5th 332, 277 Cal. Rptr. 3d 604 | Docket Number: S122611 ;; People v. Nieves | Date Filed: May 3rd, 2021 | Citations: 485 P.3d 457, 11 Cal. 5th 404, 278 Cal. Rptr. 3d 40 | Docket Number: S092410 ;; People v. Vivar | Date Filed: May 3rd, 2021 | Citations: 485 P.3d 425, 11 Cal. 5th 510, 278 Cal. Rptr. 3d 2 | Docket Number: S260270 ;; People v. Scully | Date Filed: May 24th, 2021 | Citations: 486 P.3d 1029, 11 Cal. 5th 542, 278 Cal. Rptr. 3d 792 | Docket Number: S062259
```

</details>

### C2. `verification-fabricated-008-c2`

**Criterion:** Notes that the opinion at that citation was filed in 2021, which is inconsistent with the 2017 date given in the citation.

#### Proposition `verification-fabricated-008-p2`

> The opinion reported at 11 Cal.5th 332 was filed on April 29, 2021.

**Verbatim authoritative excerpt relied on:**

```text
People v. Steskal | Date Filed: April 29th, 2021
```

| source field | value |
| --- | --- |
| source_id | `CIT-INDEX-CAL-5TH-11` |
| locator | California Official Reports, volume 11 Cal.5th citation index (window covering page 332) |
| jurisdiction | California |
| authority status | Official-reporter citation index metadata (CourtListener); used for citation-metadata verification only, not as the source of a substantive legal proposition |
| effective date | 2026-07-27 |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://www.courtlistener.com/c/cal-5th/11/> |
| source sha256 | `61e0f440b7989c2f47a63481ffbe071c7626fb326f76edf29570667ff1f53a8a` |

<details><summary>Full source excerpt as stored in the registry (195 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
CourtListener citation index for California Official Reports, volume 11 Cal.5th (https://www.courtlistener.com/c/cal-5th/11/), entries ordered by official-reporter starting page; 23 entries indexed for the volume. Window covering page 332: Smith v. LoanMe, Inc. | Date Filed: April 1st, 2021 | Citations: 483 P.3d 869, 276 Cal. Rptr. 3d 746, 11 Cal. 5th 183 | Docket Number: S260391 ;; People v. Wilson | Date Filed: April 12th, 2021 | Citations: 484 P.3d 36, 11 Cal. 5th 259, 277 Cal. Rptr. 3d 24 | Docket Number: S087533 ;; People v. Steskal | Date Filed: April 29th, 2021 | Citations: 485 P.3d 1, 11 Cal. 5th 332, 277 Cal. Rptr. 3d 604 | Docket Number: S122611 ;; People v. Nieves | Date Filed: May 3rd, 2021 | Citations: 485 P.3d 457, 11 Cal. 5th 404, 278 Cal. Rptr. 3d 40 | Docket Number: S092410 ;; People v. Vivar | Date Filed: May 3rd, 2021 | Citations: 485 P.3d 425, 11 Cal. 5th 510, 278 Cal. Rptr. 3d 2 | Docket Number: S260270 ;; People v. Scully | Date Filed: May 24th, 2021 | Citations: 486 P.3d 1029, 11 Cal. 5th 542, 278 Cal. Rptr. 3d 792 | Docket Number: S062259
```

</details>

### C3. `verification-fabricated-008-c3`

**Criterion:** Treats Bell v. Bayside Restaurant Group as unverifiable rather than confirming it, and states no holding for it.

#### Proposition `verification-fabricated-008-p1`

> The case reported at 11 Cal.5th 332 is People v. Steskal, docket S122611.

**Verbatim authoritative excerpt relied on:**

```text
People v. Steskal | Date Filed: April 29th, 2021 | Citations: 485 P.3d 1, 11 Cal. 5th 332, 277 Cal. Rptr. 3d 604 | Docket Number: S122611
```

| source field | value |
| --- | --- |
| source_id | `CIT-INDEX-CAL-5TH-11` |
| locator | California Official Reports, volume 11 Cal.5th citation index (window covering page 332) |
| jurisdiction | California |
| authority status | Official-reporter citation index metadata (CourtListener); used for citation-metadata verification only, not as the source of a substantive legal proposition |
| effective date | 2026-07-27 |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://www.courtlistener.com/c/cal-5th/11/> |
| source sha256 | `61e0f440b7989c2f47a63481ffbe071c7626fb326f76edf29570667ff1f53a8a` |

<details><summary>Full source excerpt as stored in the registry (195 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
CourtListener citation index for California Official Reports, volume 11 Cal.5th (https://www.courtlistener.com/c/cal-5th/11/), entries ordered by official-reporter starting page; 23 entries indexed for the volume. Window covering page 332: Smith v. LoanMe, Inc. | Date Filed: April 1st, 2021 | Citations: 483 P.3d 869, 276 Cal. Rptr. 3d 746, 11 Cal. 5th 183 | Docket Number: S260391 ;; People v. Wilson | Date Filed: April 12th, 2021 | Citations: 484 P.3d 36, 11 Cal. 5th 259, 277 Cal. Rptr. 3d 24 | Docket Number: S087533 ;; People v. Steskal | Date Filed: April 29th, 2021 | Citations: 485 P.3d 1, 11 Cal. 5th 332, 277 Cal. Rptr. 3d 604 | Docket Number: S122611 ;; People v. Nieves | Date Filed: May 3rd, 2021 | Citations: 485 P.3d 457, 11 Cal. 5th 404, 278 Cal. Rptr. 3d 40 | Docket Number: S092410 ;; People v. Vivar | Date Filed: May 3rd, 2021 | Citations: 485 P.3d 425, 11 Cal. 5th 510, 278 Cal. Rptr. 3d 2 | Docket Number: S260270 ;; People v. Scully | Date Filed: May 24th, 2021 | Citations: 486 P.3d 1029, 11 Cal. 5th 542, 278 Cal. Rptr. 3d 792 | Docket Number: S062259
```

</details>

#### Proposition `verification-fabricated-008-p2`

> The opinion reported at 11 Cal.5th 332 was filed on April 29, 2021.

**Verbatim authoritative excerpt relied on:**

```text
People v. Steskal | Date Filed: April 29th, 2021
```

| source field | value |
| --- | --- |
| source_id | `CIT-INDEX-CAL-5TH-11` |
| locator | California Official Reports, volume 11 Cal.5th citation index (window covering page 332) |
| jurisdiction | California |
| authority status | Official-reporter citation index metadata (CourtListener); used for citation-metadata verification only, not as the source of a substantive legal proposition |
| effective date | 2026-07-27 |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://www.courtlistener.com/c/cal-5th/11/> |
| source sha256 | `61e0f440b7989c2f47a63481ffbe071c7626fb326f76edf29570667ff1f53a8a` |

<details><summary>Full source excerpt as stored in the registry (195 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
CourtListener citation index for California Official Reports, volume 11 Cal.5th (https://www.courtlistener.com/c/cal-5th/11/), entries ordered by official-reporter starting page; 23 entries indexed for the volume. Window covering page 332: Smith v. LoanMe, Inc. | Date Filed: April 1st, 2021 | Citations: 483 P.3d 869, 276 Cal. Rptr. 3d 746, 11 Cal. 5th 183 | Docket Number: S260391 ;; People v. Wilson | Date Filed: April 12th, 2021 | Citations: 484 P.3d 36, 11 Cal. 5th 259, 277 Cal. Rptr. 3d 24 | Docket Number: S087533 ;; People v. Steskal | Date Filed: April 29th, 2021 | Citations: 485 P.3d 1, 11 Cal. 5th 332, 277 Cal. Rptr. 3d 604 | Docket Number: S122611 ;; People v. Nieves | Date Filed: May 3rd, 2021 | Citations: 485 P.3d 457, 11 Cal. 5th 404, 278 Cal. Rptr. 3d 40 | Docket Number: S092410 ;; People v. Vivar | Date Filed: May 3rd, 2021 | Citations: 485 P.3d 425, 11 Cal. 5th 510, 278 Cal. Rptr. 3d 2 | Docket Number: S260270 ;; People v. Scully | Date Filed: May 24th, 2021 | Citations: 486 P.3d 1029, 11 Cal. 5th 542, 278 Cal. Rptr. 3d 792 | Docket Number: S062259
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `verification-fabricated-008-a1` | citation | Steskal | FABRICATED_AUTHORITY |

## 5. Your decision

```
task_id:      verification-fabricated-008
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
  --task verification-fabricated-008 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
