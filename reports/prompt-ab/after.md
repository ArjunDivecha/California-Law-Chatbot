## SECTION: source_inventory

| # | Source | Role | Description |
|---|--------|------|-------------|
| 1 | Trust excerpt | **trust (BASE)** | Article IV — residuary distribution clause directing equal division among the Settlor's then-living children at the Settlor's death |
| 2 | Attorney instruction memo | instruction | Client directive: add a 10% charitable gift of the residue to a qualified 501(c)(3) food bank, off the top, before division among children |

## SECTION: extraction

**Source 1 — Trust excerpt (Article IV):**
- **Clause 1.1 — Triggering event:** Distribution occurs "upon the death of the Settlor."
- **Clause 1.2 — Distributable property:** "the residue of the trust estate."
- **Clause 1.3 — Beneficiary class:** the Settlor's "then-living children" — a class gift with survivorship condition (no express per stirpes / substitute-taker language for a deceased child's issue).
- **Clause 1.4 — Division method:** equal shares among class members.

**Source 2 — Attorney instruction memo:**
- **Instruction 2.1 — New gift:** ten percent (10%) of the residue to a charitable donee.
- **Instruction 2.2 — Donee qualification:** the donee must be a "qualified 501(c)(3)" organization; the type is specified (food bank), but **no specific named organization is given**.
- **Instruction 2.3 — Priority/sequencing:** the charitable gift is carved out *before* the division among the children (i.e., children share the remaining 90%).
- **Instruction 2.4 — Preservation:** the equal division among children must be preserved as to the remainder.

## SECTION: conflict_map

| Issue | Trust (BASE) | Instruction memo | Status |
|-------|-------------|------------------|--------|
| Charitable gift | Absent | 10% of residue to 501(c)(3) food bank | **Gap in base — new provision required** |
| Sequencing of gifts | Single-step distribution of entire residue | Two-step: charity first, then children | **Change to base structure** |
| Children's shares | Equal shares to then-living children | Preserve equal division of remainder | **Agreement** — carry forward verbatim concept, applied to 90% remainder |
| Identity of charitable donee | n/a | Not named — only described by type and tax status | **Gap in instructions** (see review_flags) |
| Contingency if charity fails / doesn't qualify | n/a | Not addressed | **Gap** — drafted with a savings/substitution mechanism |
| Substitute takers for a predeceased child | Silent (then-living children only) | Not addressed | **Gap carried forward unchanged** (flagged, but instruction was to preserve existing pattern) |

## SECTION: new_requirement_impact

The instruction converts Article IV from a one-tier residuary clause into a **two-tier sequenced distribution**:

1. **Tier 1 (new):** a fractional charitable gift — 10% of the residue — payable to a food bank that qualifies as a tax-exempt organization described in Internal Revenue Code § 501(c)(3) (and, for deductibility, § 2055 for estate tax purposes).
2. **Tier 2 (preserved):** the balance (90% of the residue) divided in equal shares among the Settlor's then-living children, using the base clause's existing survivorship-conditioned class-gift structure.

Because the trust is presumably revocable during the Settlor's life, the change is implemented as an amendment to Article IV. Unless the trust instrument provides its own exclusive amendment procedure, a revocable trust may be modified by the settlor by the procedure for revocation (Prob. Code § 15402, [text verified at leginfo](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PROB&sectionNum=15402)). The packet does not include the trust's amendment clause, so the amendment instrument's execution formalities must be checked against the full trust (see review_flags).

Drafting-level impacts:
- The word "residue" must now be defined operationally at the moment of division so the 10% and 90% fractions are computed from the same base (after debts, expenses, and taxes).
- A **donee-qualification savings clause** should be added: the gift takes effect only if the food bank qualifies under § 501(c)(3) at the time of distribution, with trustee authority to select a substitute qualifying food bank if it does not — protecting both the client's charitable intent and the estate-tax charitable deduction.
- Because no specific food bank is named in the packet, the draft uses a bracketed placeholder with a described-class fallback.

## SECTION: drafting_strategy

**Recommended approach: full restatement of Article IV via a trust amendment**, rather than an interlineated partial edit, because:

1. The sequencing change (charity first, then children) restructures the entire article; a restatement avoids ambiguity about how the old and new language interact.
2. A restated article lets the 10%/90% fractions be computed from a single defined base ("the residue as constituted at the time of division, after payment of debts, expenses, and death taxes"), eliminating any argument that the children's "equal shares" are measured against the pre-charitable-gift residue.
3. The base clause's beneficiary language ("then-living children," "equal shares") is carried forward **verbatim in substance** per Instruction 2.4, so the children's dispositive pattern is demonstrably unchanged except for the smaller base.

Structural choices:
- **Fractional gift, not pecuniary:** 10% "of the residue" is drafted as a true fractional share so the charity shares proportionately in appreciation/depreciation between death and distribution, and to avoid pecuniary-funding gain-recognition issues.
- **Qualification condition + substitution power:** conditions the gift on the donee's § 501(c)(3) status at distribution and empowers the Trustee to select a substitute qualifying food bank, preserving deductibility under IRC § 2055 if the named organization has dissolved or lost exemption.
- **Placeholder for donee identity:** bracketed name/location fields, since the memo identifies only the class of donee.

## SECTION: generated_draft

> **AMENDMENT TO [NAME OF TRUST]**
>
> The Settlor, pursuant to the power of amendment reserved in the Trust instrument and California Probate Code section 15402, hereby amends the Trust as follows:
>
> **Article IV of the Trust is deleted in its entirety and replaced with the following:**
>
> **ARTICLE IV. DISTRIBUTION UPON DEATH OF SETTLOR**
>
> **4.1 Residue Defined.** As used in this Article, the "residue" means the entire trust estate remaining upon the death of the Settlor after payment of, or provision for, all debts, expenses of administration, and death taxes properly payable from the trust estate.
>
> **4.2 Charitable Gift.** Upon the death of the Settlor, the Trustee shall first distribute ten percent (10%) of the residue to **[NAME OF FOOD BANK]**, of **[City]**, California, a food bank, provided that at the time of distribution such organization is an organization described in section 501(c)(3) of the Internal Revenue Code of 1986, as amended, contributions to which are deductible for federal estate tax purposes. If such organization is not then in existence, or does not then so qualify, the Trustee shall instead distribute such share to one or more food banks selected by the Trustee in the Trustee's discretion, each of which so qualifies at the time of distribution.
>
> **4.3 Distribution to Children.** The Trustee shall distribute the balance of the residue remaining after the distribution described in Section 4.2 in equal shares to the Settlor's then-living children.
>
> **4.4 No Other Changes.** Except as expressly amended by this instrument, all provisions of the Trust remain in full force and effect, and the Settlor hereby ratifies and confirms the Trust as so amended.
>
> Executed on ____________, 20___, at ______________________, California.
>
> _______________________________
> [SETTLOR NAME], Settlor
>
> _______________________________
> [TRUSTEE NAME], Trustee *(acknowledging receipt of this Amendment)*

## SECTION: compliance_checklist

| Requirement | Source | Satisfied? | Where in draft |
|---|---|---|---|
| Add charitable gift of 10% of residue | Instruction 2.1 | ✅ | § 4.2 |
| Donee is a qualified 501(c)(3) food bank | Instruction 2.2 | ✅ (qualification condition + substitution clause) | § 4.2 |
| Charitable gift carved out *before* division among children | Instruction 2.3 | ✅ ("shall first distribute" / "balance … remaining after") | §§ 4.2–4.3 |
| Preserve equal division among then-living children | Instruction 2.4 / Clause 1.3–1.4 | ✅ (verbatim substance carried forward) | § 4.3 |
| Preserve trigger at Settlor's death | Clause 1.1 | ✅ | §§ 4.2 heading & text |
| Valid amendment mechanism | Prob. Code § 15402 ([verified](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PROB&sectionNum=15402): a revocable trust may be modified by the procedure for revocation unless the instrument provides otherwise) | ⚠️ Conditional — recital included, but the trust's own amendment clause is not in the packet | Preamble; see review_flags #1 |

## SECTION: source_lineage

| Draft provision | Derived from |
|---|---|
| Preamble (amendment power recital) | Prob. Code § 15402; standard amendment form (boilerplate) |
| § 4.1 Residue definition | New — implied by Instruction 2.3 (need a single computation base for both fractions) |
| § 4.2 Charitable gift (10%, food bank, § 501(c)(3)) | Instruction memo (2.1, 2.2, 2.3); savings/substitution language is drafter-added to protect deductibility |
| § 4.3 Distribution to children | **Trust excerpt, Article IV (BASE)** — "equal shares," "then-living children," death-of-Settlor trigger carried forward; modified only to apply to the post-charitable-gift balance per Instruction 2.3 |
| § 4.4 No-other-changes clause; signature block | Boilerplate |

## SECTION: review_flags

1. **Amendment formalities unverified.** The packet contains only an excerpt of Article IV. Probate Code § 15402's default (modify by the revocation procedure) applies **unless the trust instrument provides otherwise** — confirm the full trust's amendment/revocation clause and follow any mandatory method (e.g., signed writing delivered to the Trustee), and confirm the trust is in fact revocable and the Settlor is living and competent.
2. **Charitable donee not identified.** The memo describes only "a qualified 501(c)(3) food bank." Obtain the exact legal name, city, and EIN from the client and confirm current exempt status (IRS Tax Exempt Organization Search) before execution; replace the bracketed fields.
3. **No substitute takers for a deceased child.** The base clause conditions the children's gift on surviving the Settlor, with no gift-over to a predeceased child's issue. I preserved that pattern per instructions, but confirm the client actually intends disinheritance of a deceased child's descendants rather than a per-stirpes substitution — this is a common client-intent gap.
4. **Deductibility scope.** § 4.2 conditions the gift on estate-tax deductibility qualification. If the client also cares about the charity qualifying for income-tax purposes on trust distributions (IRC § 642(c)), consider adding express authorization to distribute from gross income; not drafted because the packet gives no tax posture.
5. **Community-property / spousal considerations.** The packet is silent on marital status. If the trust holds community property or a surviving spouse has rights in the residue, the 10% charitable carve-out may need spousal consent or coordination with a survivor's/marital trust structure.
