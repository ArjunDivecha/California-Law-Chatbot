# Review packet — `longcontext-002`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `longcontext-002` |
| category | long_context |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `cf623cb91d75792e18c42e1adaf40f491d10d3c01eaea97d121991f8b77cfe66` |
| proposition_hashes | 3 — `451c8481e472`, `74ed0d695416`, `eded95eb86ce` |
| source_hashes | 2 — `b3632d7bb921`, `d626b80ba5ae` |

## 2. Prompt (what the model is asked)

```text
Long-context California reimbursement-tracing problem (all parties, documents, and facts synthetic). A roughly 30,000-word consolidated litigation file is embedded in the graded turn. Buried at about 72 percent depth inside an account-ledger section is a Fidelity Pacific escrow settlement excerpt for the April 22, 2016 purchase of 1147 Larkspur Terrace showing two buyer wires: $187,450.00 from a premarital sole-name Coastline Savings account, certified by the escrow holder as traceable entirely to pre-marriage funds, and $61,200.00 from a joint account funded exclusively by post-marriage earnings, for a total down payment of $248,650.00. The same excerpt lists post-closing payments of mortgage interest, principal reduction, property taxes, insurance, and maintenance. A declaration insert at mid-depth establishes that no written waiver of reimbursement exists. The graded answer must compute the Family Code section 2640(b) reimbursement as $187,450.00, exclude the community $61,200.00 wire, apply section 2640(a) to include downpayments and principal reduction while excluding interest, maintenance, insurance, and taxation, and address the written-waiver condition.
```

## 3. Material criteria and their propositions

### C1. `longcontext-002-c1`

**Criterion:** Retrieves the buried escrow settlement figures and states that the reimbursable separate-property contribution is $187,450.00, the March 28, 2016 wire from the premarital sole-name Coastline Savings account no. xxxx-3390, and not the $248,650.00 total buyer funds.

#### Proposition `longcontext-002-p2`

> In the division of the community estate, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party’s contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.

**Verbatim authoritative excerpt relied on:**

```text
In the division of the community estate under this division, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party's contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2640` |
| locator | Cal. Fam. Code § 2640 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2005 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2640> |
| source sha256 | `d626b80ba5ae2de47a7e5f324564b3099c80b040c99c71d2e2de411f389cb302` |

<details><summary>Full source excerpt as stored in the registry (125 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) "Contributions to the acquisition of property," as used in this section, include downpayments, payments for improvements, and payments that reduce the principal of a loan used to finance the purchase or improvement of the property but do not include payments of interest on the loan or payments made for maintenance, insurance, or taxation of the property. (b) In the division of the community estate under this division, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party's contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.
```

</details>

### C2. `longcontext-002-c2`

**Criterion:** Excludes the $61,200.00 April 14, 2016 wire from the reimbursement because it came from the joint account funded exclusively by post-marriage employment earnings and therefore cannot be traced to a separate property source, and identifies the Larkspur Terrace property as community property acquired during the marriage under Family Code section 760.

#### Proposition `longcontext-002-p2`

> In the division of the community estate, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party’s contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.

**Verbatim authoritative excerpt relied on:**

```text
In the division of the community estate under this division, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party's contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2640` |
| locator | Cal. Fam. Code § 2640 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2005 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2640> |
| source sha256 | `d626b80ba5ae2de47a7e5f324564b3099c80b040c99c71d2e2de411f389cb302` |

<details><summary>Full source excerpt as stored in the registry (125 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) "Contributions to the acquisition of property," as used in this section, include downpayments, payments for improvements, and payments that reduce the principal of a loan used to finance the purchase or improvement of the property but do not include payments of interest on the loan or payments made for maintenance, insurance, or taxation of the property. (b) In the division of the community estate under this division, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party's contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.
```

</details>

#### Proposition `longcontext-002-p3`

> All property acquired by a married person during the marriage while domiciled in California is community property except as otherwise provided by statute.

**Verbatim authoritative excerpt relied on:**

```text
all property, real or personal, wherever situated, acquired by a married person during the marriage while domiciled in this state is community property
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-760` |
| locator | Cal. Fam. Code § 760 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 (Operative) |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=760> |
| source sha256 | `b3632d7bb921ac23a50d1d2f61aa426bc6988fc5390c7eff35dd44fdeb6981f7` |

<details><summary>Full source excerpt as stored in the registry (29 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
Except as otherwise provided by statute, all property, real or personal, wherever situated, acquired by a married person during the marriage while domiciled in this state is community property.
```

</details>

### C3. `longcontext-002-c3`

**Criterion:** Applies the Family Code section 2640(a) definition to the buried payment schedule: downpayments, payments for improvements, and payments that reduce loan principal count as contributions to the acquisition of property, while payments of interest on the loan and payments for maintenance, insurance, or taxation do not, so the $296,411.08 of mortgage interest, the $131,802.55 of property taxes, the $22,614.90 of insurance, and the $46,308.71 of maintenance are excluded.

#### Proposition `longcontext-002-p1`

> Contributions to the acquisition of property include downpayments, payments for improvements, and payments that reduce the principal of a loan used to finance the purchase or improvement of the property, but do not include payments of interest on the loan or payments made for maintenance, insurance, or taxation of the property.

**Verbatim authoritative excerpt relied on:**

```text
"Contributions to the acquisition of property," as used in this section, include downpayments, payments for improvements, and payments that reduce the principal of a loan used to finance the purchase or improvement of the property but do not include payments of interest on the loan or payments made for maintenance, insurance, or taxation of the property.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2640` |
| locator | Cal. Fam. Code § 2640 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2005 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2640> |
| source sha256 | `d626b80ba5ae2de47a7e5f324564b3099c80b040c99c71d2e2de411f389cb302` |

<details><summary>Full source excerpt as stored in the registry (125 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) "Contributions to the acquisition of property," as used in this section, include downpayments, payments for improvements, and payments that reduce the principal of a loan used to finance the purchase or improvement of the property but do not include payments of interest on the loan or payments made for maintenance, insurance, or taxation of the property. (b) In the division of the community estate under this division, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party's contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.
```

</details>

### C4. `longcontext-002-c4`

**Criterion:** States the statutory condition that reimbursement is owed unless the party has made a written waiver of the right to reimbursement or signed a writing that has the effect of a waiver, and finds on this file that no such waiver exists, so the claim is not defeated.

#### Proposition `longcontext-002-p2`

> In the division of the community estate, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party’s contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.

**Verbatim authoritative excerpt relied on:**

```text
In the division of the community estate under this division, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party's contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-2640` |
| locator | Cal. Fam. Code § 2640 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2005 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2640> |
| source sha256 | `d626b80ba5ae2de47a7e5f324564b3099c80b040c99c71d2e2de411f389cb302` |

<details><summary>Full source excerpt as stored in the registry (125 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) "Contributions to the acquisition of property," as used in this section, include downpayments, payments for improvements, and payments that reduce the principal of a loan used to finance the purchase or improvement of the property but do not include payments of interest on the loan or payments made for maintenance, insurance, or taxation of the property. (b) In the division of the community estate under this division, unless a party has made a written waiver of the right to reimbursement or has signed a writing that has the effect of a waiver, the party shall be reimbursed for the party's contributions to the acquisition of property of the community property estate to the extent the party traces the contributions to a separate property source.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `longcontext-002-a1` | contains | $187,450 | — |
| `longcontext-002-a2` | statute | 2640 | — |
| `longcontext-002-a3` | contains | written waiver | — |
| `longcontext-002-a4` | not_contains | reimbursed $248,650 | MATERIAL_FACT_INVENTION |

## 5. Your decision

```
task_id:      longcontext-002
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
  --task longcontext-002 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
