# Review packet — `verification-edge-002`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `verification-edge-002` |
| category | verification |
| workflow | verify |
| track | frozen_evidence |
| data_class | public |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `e33208072770a8a44b7ce784a57f829698a2ddcce2435cc6195d5c16bc2506a6` |
| proposition_hashes | 5 — `6cba2a1f97d0`, `8c5c83e3549d`, `eb660e403c8e`, `ebcf90686e4f`, `f46b6c1f6e48` |
| source_hashes | 1 — `313629a04f8c` |

## 2. Prompt (what the model is asked)

```text
I want to rely on a published California Court of Appeal opinion, but the California Supreme Court granted review in that case last month and has not decided it yet. Under the current California Rules of Court, may I still cite the Court of Appeal opinion, what precedential weight does it carry, and does anything have to be disclosed in the citation?
```

## 3. Material criteria and their propositions

### C1. `verification-edge-002-c1`

**Criterion:** States that while review is pending the published Court of Appeal opinion has no binding or precedential effect and may be cited for potentially persuasive value only.

#### Proposition `verification-edge-002-p1`

> Pending review and filing of the Supreme Court's opinion, and unless the Supreme Court orders otherwise, a published Court of Appeal opinion in the matter has no binding or precedential effect and may be cited for potentially persuasive value only.

**Verbatim authoritative excerpt relied on:**

```text
Pending review and filing of the Supreme Court's opinion, unless otherwise ordered by the Supreme Court under (3), a published opinion of a Court of Appeal in the matter has no binding or precedential effect, and may be cited for potentially persuasive value only.
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

### C2. `verification-edge-002-c2`

**Criterion:** States that any citation to the Court of Appeal opinion must also note the grant of review and any subsequent Supreme Court action.

#### Proposition `verification-edge-002-p2`

> Any citation to a review-granted Court of Appeal opinion must also note the grant of review and any subsequent action by the Supreme Court.

**Verbatim authoritative excerpt relied on:**

```text
Any citation to the Court of Appeal opinion must also note the grant of review and any subsequent action by the Supreme Court.
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

### C3. `verification-edge-002-c3`

**Criterion:** Notes that the Supreme Court may order a different citability or precedential effect at any time after granting review.

#### Proposition `verification-edge-002-p3`

> At any time after granting review or after decision on review, the Supreme Court may order that all or part of the opinion is not citable or has a different binding or precedential effect.

**Verbatim authoritative excerpt relied on:**

```text
At any time after granting review or after decision on review, the Supreme Court may order that all or part of an opinion covered by (1) or (2) is not citable or has a binding or precedential effect different from that specified in (1) or (2).
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

### C4. `verification-edge-002-c4`

**Criterion:** Distinguishes this from an opinion that was never certified for publication, which must not be cited except under the stated exceptions.

#### Proposition `verification-edge-002-p4`

> Except as provided in subdivision (b), an opinion of a California Court of Appeal or superior court appellate division that is not certified for publication or ordered published must not be cited or relied on by a court or a party in any other action.

**Verbatim authoritative excerpt relied on:**

```text
Except as provided in (b), an opinion of a California Court of Appeal or superior court appellate division that is not certified for publication or ordered published must not be cited or relied on by a court or a party in any other action.
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

### Non-material criteria (not attested, listed for context)

- `verification-edge-002-c5` — Notes that subdivision (e) of the rule was adopted effective July 1, 2016.

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `verification-edge-002-a1` | contains | potentially persuasive | — |
| `verification-edge-002-a2` | statute | 8.1115 | — |

## 5. Your decision

```
task_id:      verification-edge-002
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
  --task verification-edge-002 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
