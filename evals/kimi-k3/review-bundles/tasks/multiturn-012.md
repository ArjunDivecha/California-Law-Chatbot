# Review packet — `multiturn-012`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `multiturn-012` |
| category | multi_turn |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `4a1ed2fc2b947cd7d1567822e0ce56086ecd58712eab1cddbd37882ea7e3bf6c` |
| proposition_hashes | 4 — `a201ead67d74`, `a24ab996c085`, `cc7bd67f2411`, `d7a2580d478c` |
| source_hashes | 2 — `53e3441ad1a2`, `f7702f04cafc` |

## 2. Prompt (what the model is asked)

```text
Multi-turn consultation testing context carryover (all parties and facts synthetic). Turn 1 established that in 2019 Ottoline Baszczuk-Ferrer signed a written instrument expressly declaring that her separate-property Oakland duplex was thereafter community property, that her spouse Emiliano Ferrer joined in the writing, and that the instrument was never recorded. Turn 3 asked whether the instrument is valid between the spouses. Turn 5, the graded turn, asks two questions that depend on the carried-over 2019 unrecorded-real-property setup: whether a judgment creditor of Emiliano who had no notice of the instrument is bound by it, and whether the same analysis governs an identical instrument Ottoline's mother signed in 1979. The answer must apply the transmutation writing rule, the recording rule for third parties, and the pre-1985 carve-out.
```

### Conversation (5 turns; only the final user turn is graded)

**Turn 1 — user**

```text
In 2019 Ottoline Baszczuk-Ferrer signed a written instrument expressly declaring that her separate-property duplex in Oakland was from then on community property. Her spouse Emiliano Ferrer joined in the writing. The instrument was never recorded anywhere. Please hold those facts.
```

**Turn 2 — assistant**

```text
Noted: a 2019 written express declaration transmuting Ottoline's separate real property to community property, joined in by the adversely affected spouse, and never recorded.
```

**Turn 3 — user**

```text
Between the two of them, is that instrument valid?
```

**Turn 4 — assistant**

```text
A transmutation of real or personal property is not valid unless made in writing by an express declaration made, joined in, consented to, or accepted by the spouse whose interest in the property is adversely affected. On the facts as stated, that writing requirement is met as between the spouses.
```

**Turn 5 — user** **(graded)**

```text
Two follow-ups. First, a judgment creditor of Emiliano has now recorded an abstract against the duplex and says it never had any notice of the 2019 instrument - is the creditor bound by the transmutation? Second, Ottoline's mother signed a functionally identical instrument about her own house back in 1979; does the same rule govern hers?
```

## 3. Material criteria and their propositions

### C1. `multiturn-012-c1`

**Criterion:** Applies the carried-over unrecorded-instrument fact: because a transmutation of real property is not effective as to third parties without notice thereof unless recorded, the never-recorded 2019 instrument is not effective against Emiliano's judgment creditor that had no notice of it.

#### Proposition `multiturn-012-p2`

> A transmutation of real property is not effective as to third parties without notice thereof unless recorded.

**Verbatim authoritative excerpt relied on:**

```text
(b) A transmutation of real property is not effective as to third parties without notice thereof unless recorded.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-852-B` |
| locator | Cal. Fam. Code § 852(b)-(e) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=852> |
| source sha256 | `f7702f04cafc53ede329841a056674fb9d5369e676b509489603d524caf2ffe3` |

<details><summary>Full source excerpt as stored in the registry (130 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(b) A transmutation of real property is not effective as to third parties without notice thereof unless recorded. (c) This section does not apply to a gift between the spouses of clothing, wearing apparel, jewelry, or other tangible articles of a personal nature that is used solely or principally by the spouse to whom the gift is made and that is not substantial in value taking into account the circumstances of the marriage. (d) Nothing in this section affects the law governing characterization of property in which separate property and community property are commingled or otherwise combined. (e) This section does not apply to or affect a transmutation of property made before January 1, 1985, and the law that would otherwise be applicable to that transmutation shall continue to apply.
```

</details>

### C2. `multiturn-012-c2`

**Criterion:** Restates the validity rule carried over from turn 3: a transmutation is not valid unless made in writing by an express declaration made, joined in, consented to, or accepted by the adversely affected spouse, and distinguishes inter-spousal validity from effectiveness against third parties.

#### Proposition `multiturn-012-p1`

> A transmutation of real or personal property is not valid unless made in writing by an express declaration that is made, joined in, consented to, or accepted by the spouse whose interest in the property is adversely affected.

**Verbatim authoritative excerpt relied on:**

```text
(a) A transmutation of real or personal property is not valid unless made in writing by an express declaration that is made, joined in, consented to, or accepted by the spouse whose interest in the property is adversely affected.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-852` |
| locator | Cal. Fam. Code § 852 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=852> |
| source sha256 | `53e3441ad1a2594d6c5f2c06edc012fdc573c7196432c4f9b0212a175e8590f4` |

<details><summary>Full source excerpt as stored in the registry (39 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) A transmutation of real or personal property is not valid unless made in writing by an express declaration that is made, joined in, consented to, or accepted by the spouse whose interest in the property is adversely affected.
```

</details>

#### Proposition `multiturn-012-p2`

> A transmutation of real property is not effective as to third parties without notice thereof unless recorded.

**Verbatim authoritative excerpt relied on:**

```text
(b) A transmutation of real property is not effective as to third parties without notice thereof unless recorded.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-852-B` |
| locator | Cal. Fam. Code § 852(b)-(e) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=852> |
| source sha256 | `f7702f04cafc53ede329841a056674fb9d5369e676b509489603d524caf2ffe3` |

<details><summary>Full source excerpt as stored in the registry (130 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(b) A transmutation of real property is not effective as to third parties without notice thereof unless recorded. (c) This section does not apply to a gift between the spouses of clothing, wearing apparel, jewelry, or other tangible articles of a personal nature that is used solely or principally by the spouse to whom the gift is made and that is not substantial in value taking into account the circumstances of the marriage. (d) Nothing in this section affects the law governing characterization of property in which separate property and community property are commingled or otherwise combined. (e) This section does not apply to or affect a transmutation of property made before January 1, 1985, and the law that would otherwise be applicable to that transmutation shall continue to apply.
```

</details>

### C3. `multiturn-012-c3`

**Criterion:** Answers the 1979 question with the pre-1985 carve-out: section 852 does not apply to or affect a transmutation of property made before January 1, 1985, and the law that would otherwise be applicable to that transmutation continues to apply.

#### Proposition `multiturn-012-p3`

> Family Code section 852 does not apply to or affect a transmutation of property made before January 1, 1985, and the law that would otherwise be applicable to that transmutation continues to apply.

**Verbatim authoritative excerpt relied on:**

```text
(e) This section does not apply to or affect a transmutation of property made before January 1, 1985, and the law that would otherwise be applicable to that transmutation shall continue to apply.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-852-B` |
| locator | Cal. Fam. Code § 852(b)-(e) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=852> |
| source sha256 | `f7702f04cafc53ede329841a056674fb9d5369e676b509489603d524caf2ffe3` |

<details><summary>Full source excerpt as stored in the registry (130 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(b) A transmutation of real property is not effective as to third parties without notice thereof unless recorded. (c) This section does not apply to a gift between the spouses of clothing, wearing apparel, jewelry, or other tangible articles of a personal nature that is used solely or principally by the spouse to whom the gift is made and that is not substantial in value taking into account the circumstances of the marriage. (d) Nothing in this section affects the law governing characterization of property in which separate property and community property are commingled or otherwise combined. (e) This section does not apply to or affect a transmutation of property made before January 1, 1985, and the law that would otherwise be applicable to that transmutation shall continue to apply.
```

</details>

### C4. `multiturn-012-c4`

**Criterion:** Notes that nothing in section 852 affects the law governing characterization of property in which separate property and community property are commingled or otherwise combined.

#### Proposition `multiturn-012-p4`

> Nothing in section 852 affects the law governing characterization of property in which separate property and community property are commingled or otherwise combined.

**Verbatim authoritative excerpt relied on:**

```text
(d) Nothing in this section affects the law governing characterization of property in which separate property and community property are commingled or otherwise combined.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-852-B` |
| locator | Cal. Fam. Code § 852(b)-(e) |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T18:00:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=852> |
| source sha256 | `f7702f04cafc53ede329841a056674fb9d5369e676b509489603d524caf2ffe3` |

<details><summary>Full source excerpt as stored in the registry (130 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(b) A transmutation of real property is not effective as to third parties without notice thereof unless recorded. (c) This section does not apply to a gift between the spouses of clothing, wearing apparel, jewelry, or other tangible articles of a personal nature that is used solely or principally by the spouse to whom the gift is made and that is not substantial in value taking into account the circumstances of the marriage. (d) Nothing in this section affects the law governing characterization of property in which separate property and community property are commingled or otherwise combined. (e) This section does not apply to or affect a transmutation of property made before January 1, 1985, and the law that would otherwise be applicable to that transmutation shall continue to apply.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `multiturn-012-a1` | statute | 852 | — |
| `multiturn-012-a2` | contains | recorded | — |
| `multiturn-012-a3` | contains | January 1, 1985 | WRONG_EFFECTIVE_DATE |

## 5. Your decision

```
task_id:      multiturn-012
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
  --task multiturn-012 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
