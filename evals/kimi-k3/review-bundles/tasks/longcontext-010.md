# Review packet — `longcontext-010`

> Validate the BENCHMARK, not any model answer. For every material criterion below, ask only: **is this criterion entailed by the excerpt printed underneath it, using nothing but the words on this page?** If you need outside legal knowledge to agree, that is a REJECT. See ../README.md.

## 1. Identity and hashes

| field | value |
| --- | --- |
| task_id | `longcontext-010` |
| category | long_context |
| workflow | research |
| track | frozen_evidence |
| data_class | synthetic |
| dataset_hash | `805e588a4c6979f364ef4cd9d854edee211bf83da0ab506ef0d39e60c1bbfce5` |
| task_content_sha256 | `0aded8c4c2e0e4b755f7ac73fab16b079ca65456062036a9c9585231c999d5e8` |
| proposition_hashes | 5 — `276d718c2114`, `2faad3f0f51b`, `34c96dae726f`, `4524fb0c2f98`, `d8e1f00becab` |
| source_hashes | 3 — `39695f1101d6`, `693535f8c1d1`, `ed9c0324f4b4` |

## 2. Prompt (what the model is asked)

```text
Long-context California DVPA coercive-control problem (all parties, documents, and facts synthetic). A roughly 55,000-word consolidated litigation file is embedded in the graded turn, the largest in the batch, with the operative message exports buried at roughly 12, 41, and 88 percent of a 13,000-word correspondence-and-messages section and a bank-ledger custodian note at about 47 percent of the ledger section. The buried facts show four distinct coercive-control categories: January 19, 2025 messages establishing app-based location monitoring of the petitioner’s movements; February 2, 2025 messages isolating her from her sister and friends; a March 4, 2025 custodian note recording removal of her banking access, closure of her separate account, and $60.00 weekly "allowance" transfers; May 16, 2025 messages destroying her contraception and cancelling her appointment; and a December 19, 2025 message threatening to report her and her mother to immigration unless she withdrew her Request for Order. A distractor minute order at about 30 percent of the minute-order section records a July 22, 2019 request denied as withdrawn with no evidence taken and no findings. The graded answer must apply Family Code section 6320(a) and (c), section 6203(a)(4) and (b), and section 6211(a).
```

## 3. Material criteria and their propositions

### C1. `longcontext-010-c1`

**Criterion:** States that the parties are spouses, so abuse perpetrated between them is domestic violence within Family Code section 6211(a), relying on the buried declarant note that they married in 2016, separated in 2025, and remain spouses with no dissolution judgment entered.

#### Proposition `longcontext-010-p5`

> Domestic violence is abuse perpetrated against a spouse or former spouse, among other listed persons.

**Verbatim authoritative excerpt relied on:**

```text
"Domestic violence" is abuse perpetrated against any of the following persons: (a) A spouse or former spouse.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-6211` |
| locator | Cal. Fam. Code § 6211 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 1994 |
| retrieved at | 2026-07-27T13:50:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=6211> |
| source sha256 | `39695f1101d67015efd021add7b012831aad967518cf04e0cc51f7c8ef71e181` |

<details><summary>Full source excerpt as stored in the registry (139 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
"Domestic violence" is abuse perpetrated against any of the following persons: (a) A spouse or former spouse. (b) A cohabitant or former cohabitant, as defined in Section 6209. (c) A person with whom the respondent is having or has had a dating or engagement relationship. (d) A person with whom the respondent has had a child, where the presumption applies that the male parent is the father of the child of the female parent under the Uniform Parentage Act (Part 3 (commencing with Section 7600) of Division 12). (e) A child of a party or a child who is the subject of an action under the Uniform Parentage Act, where the presumption applies that the male parent is the father of the child to be protected. (f) Any other person related by consanguinity or affinity within the second degree.
```

</details>

### C2. `longcontext-010-c2`

**Criterion:** Retrieves the buried December 19, 2025 message and identifies it as compelling the other party by threat or intimidation, including a threat based on actual or suspected immigration status, to abstain from conduct in which she has a right to engage, namely prosecuting her Request for Order.

#### Proposition `longcontext-010-p3`

> Examples of coercive control include isolating the other party from friends, relatives, or other sources of support; depriving the other party of basic necessities; controlling, regulating, or monitoring the other party’s movements, communications, daily behavior, finances, economic resources, or access to services; compelling the other party by threat or intimidation, including threats based on actual or suspected immigration status, to abstain from conduct in which the other party has a right to engage; and reproductive coercion including deliberately interfering with contraception use.

**Verbatim authoritative excerpt relied on:**

```text
Isolating the other party from friends, relatives, or other sources of support. (2) Depriving the other party of basic necessities. (3) Controlling, regulating, or monitoring the other party’s movements, communications, daily behavior, finances, economic resources, or access to services. (4) Compelling the other party by force, threat of force, or intimidation, including threats based on actual or suspected immigration status, to engage in conduct from which the other party has a right to abstain or to abstain from conduct in which the other party has a right to engage. (5) Engaging in reproductive coercion, which consists of control over the reproductive autonomy of another through force, threat of force, or intimidation, and may include, but is not limited to, unreasonably pressuring the other party to become pregnant, deliberately interfering with contraception use or access to reproductive health information, or using coercive tactics to control, or attempt to control, pregnancy outcomes.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-6320` |
| locator | Cal. Fam. Code § 6320 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2026 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=6320> |
| source sha256 | `ed9c0324f4b42611e6a497f51097332eff2b1d5f37b18b389b75b47c91e689c1` |

<details><summary>Full source excerpt as stored in the registry (506 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The court may issue an ex parte order enjoining a party from molesting, attacking, striking, stalking, threatening, sexually assaulting, battering, credibly impersonating as described in Section 528.5 of the Penal Code, falsely personating as described in Section 529 of the Penal Code, harassing, telephoning, including, but not limited to, making annoying telephone calls as described in Section 653m of the Penal Code, destroying personal property, contacting, either directly or indirectly, by mail or otherwise, coming within a specified distance of, or disturbing the peace of the other party, and, in the discretion of the court, on a showing of good cause, of other named family or household members. (b) On a showing of good cause, the court may include in a protective order a grant to the petitioner of the exclusive care, possession, or control of any animal owned, possessed, leased, kept, or held by either the petitioner or the respondent or a minor child residing in the residence or household of either the petitioner or the respondent. The court may order the respondent to stay away from the animal and forbid the respondent from taking, transferring, encumbering, concealing, molesting, attacking, striking, threatening, harming, or otherwise disposing of the animal. (c) As used in subdivision (a), “disturbing the peace of the other party” refers to conduct that, based on the totality of the circumstances, destroys the mental or emotional calm of the other party. This conduct may be committed directly or indirectly, including through the use of a third party, and by any method or through any means including, but not limited to, telephone, online accounts, text messages, internet-connected devices, including connected devices as defined in Section 22948.30 of the Business and Professions Code, or other electronic technologies. This conduct includes, but is not limited to, coercive control, which is a pattern of behavior that in purpose or effect unreasonably interferes with a person’s free will and personal liberty. Examples of coercive control include, but are not limited to, unreasonably engaging in any of the following: (1) Isolating the other party from friends, relatives, or other sources of support. (2) Depriving the other party of basic necessities. (3) Controlling, regulating, or monitoring the other party’s movements, communications, daily behavior, finances, economic resources, or access to services. (4) Compelling the other party by force, threat of force, or intimidation, including threats based on actual or suspected immigration status, to engage in conduct from which the other party has a right to abstain or to abstain from conduct in which the other party has a right to engage. (5) Engaging in reproductive coercion, which consists of control over the reproductive autonomy of another through force, threat of force, or intimidation, and may include, but is not limited to, unreasonably pressuring the other party to become pregnant, deliberately interfering with contraception use or access to reproductive health information, or using coercive tactics to control, or attempt to control, pregnancy outcomes. (d) This section does not limit any remedies available under this act or any other provision of law.
```

</details>

### C3. `longcontext-010-c3`

**Criterion:** Identifies at least three further coercive-control categories from the buried record with their supporting facts: monitoring of movements through the location application on January 19, 2025; isolation from her sister and friends on February 2, 2025; control of finances and economic resources through the March 4, 2025 removal of banking access, closure of her separate account, and $60.00 weekly allowance; and reproductive coercion through the May 16, 2025 destruction of her contraception and cancellation of her appointment.

#### Proposition `longcontext-010-p3`

> Examples of coercive control include isolating the other party from friends, relatives, or other sources of support; depriving the other party of basic necessities; controlling, regulating, or monitoring the other party’s movements, communications, daily behavior, finances, economic resources, or access to services; compelling the other party by threat or intimidation, including threats based on actual or suspected immigration status, to abstain from conduct in which the other party has a right to engage; and reproductive coercion including deliberately interfering with contraception use.

**Verbatim authoritative excerpt relied on:**

```text
Isolating the other party from friends, relatives, or other sources of support. (2) Depriving the other party of basic necessities. (3) Controlling, regulating, or monitoring the other party’s movements, communications, daily behavior, finances, economic resources, or access to services. (4) Compelling the other party by force, threat of force, or intimidation, including threats based on actual or suspected immigration status, to engage in conduct from which the other party has a right to abstain or to abstain from conduct in which the other party has a right to engage. (5) Engaging in reproductive coercion, which consists of control over the reproductive autonomy of another through force, threat of force, or intimidation, and may include, but is not limited to, unreasonably pressuring the other party to become pregnant, deliberately interfering with contraception use or access to reproductive health information, or using coercive tactics to control, or attempt to control, pregnancy outcomes.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-6320` |
| locator | Cal. Fam. Code § 6320 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2026 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=6320> |
| source sha256 | `ed9c0324f4b42611e6a497f51097332eff2b1d5f37b18b389b75b47c91e689c1` |

<details><summary>Full source excerpt as stored in the registry (506 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The court may issue an ex parte order enjoining a party from molesting, attacking, striking, stalking, threatening, sexually assaulting, battering, credibly impersonating as described in Section 528.5 of the Penal Code, falsely personating as described in Section 529 of the Penal Code, harassing, telephoning, including, but not limited to, making annoying telephone calls as described in Section 653m of the Penal Code, destroying personal property, contacting, either directly or indirectly, by mail or otherwise, coming within a specified distance of, or disturbing the peace of the other party, and, in the discretion of the court, on a showing of good cause, of other named family or household members. (b) On a showing of good cause, the court may include in a protective order a grant to the petitioner of the exclusive care, possession, or control of any animal owned, possessed, leased, kept, or held by either the petitioner or the respondent or a minor child residing in the residence or household of either the petitioner or the respondent. The court may order the respondent to stay away from the animal and forbid the respondent from taking, transferring, encumbering, concealing, molesting, attacking, striking, threatening, harming, or otherwise disposing of the animal. (c) As used in subdivision (a), “disturbing the peace of the other party” refers to conduct that, based on the totality of the circumstances, destroys the mental or emotional calm of the other party. This conduct may be committed directly or indirectly, including through the use of a third party, and by any method or through any means including, but not limited to, telephone, online accounts, text messages, internet-connected devices, including connected devices as defined in Section 22948.30 of the Business and Professions Code, or other electronic technologies. This conduct includes, but is not limited to, coercive control, which is a pattern of behavior that in purpose or effect unreasonably interferes with a person’s free will and personal liberty. Examples of coercive control include, but are not limited to, unreasonably engaging in any of the following: (1) Isolating the other party from friends, relatives, or other sources of support. (2) Depriving the other party of basic necessities. (3) Controlling, regulating, or monitoring the other party’s movements, communications, daily behavior, finances, economic resources, or access to services. (4) Compelling the other party by force, threat of force, or intimidation, including threats based on actual or suspected immigration status, to engage in conduct from which the other party has a right to abstain or to abstain from conduct in which the other party has a right to engage. (5) Engaging in reproductive coercion, which consists of control over the reproductive autonomy of another through force, threat of force, or intimidation, and may include, but is not limited to, unreasonably pressuring the other party to become pregnant, deliberately interfering with contraception use or access to reproductive health information, or using coercive tactics to control, or attempt to control, pregnancy outcomes. (d) This section does not limit any remedies available under this act or any other provision of law.
```

</details>

### C4. `longcontext-010-c4`

**Criterion:** Explains that this conduct is enjoinable because disturbing the peace of the other party means conduct that, based on the totality of the circumstances, destroys the other party’s mental or emotional calm, may be committed by text message or internet-connected device, and includes coercive control as a pattern of behavior that in purpose or effect unreasonably interferes with free will and personal liberty, and that section 6320(a) authorizes an order enjoining threatening, harassing, destroying personal property, contacting, and disturbing the peace.

#### Proposition `longcontext-010-p1`

> The court may issue an ex parte order enjoining a party from, among other conduct, threatening, harassing, destroying personal property, contacting directly or indirectly, or disturbing the peace of the other party.

**Verbatim authoritative excerpt relied on:**

```text
The court may issue an ex parte order enjoining a party from molesting, attacking, striking, stalking, threatening, sexually assaulting, battering, credibly impersonating as described in Section 528.5 of the Penal Code, falsely personating as described in Section 529 of the Penal Code, harassing, telephoning, including, but not limited to, making annoying telephone calls as described in Section 653m of the Penal Code, destroying personal property, contacting, either directly or indirectly, by mail or otherwise, coming within a specified distance of, or disturbing the peace of the other party
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-6320` |
| locator | Cal. Fam. Code § 6320 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2026 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=6320> |
| source sha256 | `ed9c0324f4b42611e6a497f51097332eff2b1d5f37b18b389b75b47c91e689c1` |

<details><summary>Full source excerpt as stored in the registry (506 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The court may issue an ex parte order enjoining a party from molesting, attacking, striking, stalking, threatening, sexually assaulting, battering, credibly impersonating as described in Section 528.5 of the Penal Code, falsely personating as described in Section 529 of the Penal Code, harassing, telephoning, including, but not limited to, making annoying telephone calls as described in Section 653m of the Penal Code, destroying personal property, contacting, either directly or indirectly, by mail or otherwise, coming within a specified distance of, or disturbing the peace of the other party, and, in the discretion of the court, on a showing of good cause, of other named family or household members. (b) On a showing of good cause, the court may include in a protective order a grant to the petitioner of the exclusive care, possession, or control of any animal owned, possessed, leased, kept, or held by either the petitioner or the respondent or a minor child residing in the residence or household of either the petitioner or the respondent. The court may order the respondent to stay away from the animal and forbid the respondent from taking, transferring, encumbering, concealing, molesting, attacking, striking, threatening, harming, or otherwise disposing of the animal. (c) As used in subdivision (a), “disturbing the peace of the other party” refers to conduct that, based on the totality of the circumstances, destroys the mental or emotional calm of the other party. This conduct may be committed directly or indirectly, including through the use of a third party, and by any method or through any means including, but not limited to, telephone, online accounts, text messages, internet-connected devices, including connected devices as defined in Section 22948.30 of the Business and Professions Code, or other electronic technologies. This conduct includes, but is not limited to, coercive control, which is a pattern of behavior that in purpose or effect unreasonably interferes with a person’s free will and personal liberty. Examples of coercive control include, but are not limited to, unreasonably engaging in any of the following: (1) Isolating the other party from friends, relatives, or other sources of support. (2) Depriving the other party of basic necessities. (3) Controlling, regulating, or monitoring the other party’s movements, communications, daily behavior, finances, economic resources, or access to services. (4) Compelling the other party by force, threat of force, or intimidation, including threats based on actual or suspected immigration status, to engage in conduct from which the other party has a right to abstain or to abstain from conduct in which the other party has a right to engage. (5) Engaging in reproductive coercion, which consists of control over the reproductive autonomy of another through force, threat of force, or intimidation, and may include, but is not limited to, unreasonably pressuring the other party to become pregnant, deliberately interfering with contraception use or access to reproductive health information, or using coercive tactics to control, or attempt to control, pregnancy outcomes. (d) This section does not limit any remedies available under this act or any other provision of law.
```

</details>

#### Proposition `longcontext-010-p2`

> Disturbing the peace of the other party refers to conduct that, based on the totality of the circumstances, destroys the mental or emotional calm of the other party, committed by any means including text messages and internet-connected devices, and includes coercive control, a pattern of behavior that in purpose or effect unreasonably interferes with a person’s free will and personal liberty.

**Verbatim authoritative excerpt relied on:**

```text
As used in subdivision (a), “disturbing the peace of the other party” refers to conduct that, based on the totality of the circumstances, destroys the mental or emotional calm of the other party. This conduct may be committed directly or indirectly, including through the use of a third party, and by any method or through any means including, but not limited to, telephone, online accounts, text messages, internet-connected devices, including connected devices as defined in Section 22948.30 of the Business and Professions Code, or other electronic technologies. This conduct includes, but is not limited to, coercive control, which is a pattern of behavior that in purpose or effect unreasonably interferes with a person’s free will and personal liberty.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-6320` |
| locator | Cal. Fam. Code § 6320 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2026 |
| retrieved at | 2026-07-27T14:05:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=6320> |
| source sha256 | `ed9c0324f4b42611e6a497f51097332eff2b1d5f37b18b389b75b47c91e689c1` |

<details><summary>Full source excerpt as stored in the registry (506 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) The court may issue an ex parte order enjoining a party from molesting, attacking, striking, stalking, threatening, sexually assaulting, battering, credibly impersonating as described in Section 528.5 of the Penal Code, falsely personating as described in Section 529 of the Penal Code, harassing, telephoning, including, but not limited to, making annoying telephone calls as described in Section 653m of the Penal Code, destroying personal property, contacting, either directly or indirectly, by mail or otherwise, coming within a specified distance of, or disturbing the peace of the other party, and, in the discretion of the court, on a showing of good cause, of other named family or household members. (b) On a showing of good cause, the court may include in a protective order a grant to the petitioner of the exclusive care, possession, or control of any animal owned, possessed, leased, kept, or held by either the petitioner or the respondent or a minor child residing in the residence or household of either the petitioner or the respondent. The court may order the respondent to stay away from the animal and forbid the respondent from taking, transferring, encumbering, concealing, molesting, attacking, striking, threatening, harming, or otherwise disposing of the animal. (c) As used in subdivision (a), “disturbing the peace of the other party” refers to conduct that, based on the totality of the circumstances, destroys the mental or emotional calm of the other party. This conduct may be committed directly or indirectly, including through the use of a third party, and by any method or through any means including, but not limited to, telephone, online accounts, text messages, internet-connected devices, including connected devices as defined in Section 22948.30 of the Business and Professions Code, or other electronic technologies. This conduct includes, but is not limited to, coercive control, which is a pattern of behavior that in purpose or effect unreasonably interferes with a person’s free will and personal liberty. Examples of coercive control include, but are not limited to, unreasonably engaging in any of the following: (1) Isolating the other party from friends, relatives, or other sources of support. (2) Depriving the other party of basic necessities. (3) Controlling, regulating, or monitoring the other party’s movements, communications, daily behavior, finances, economic resources, or access to services. (4) Compelling the other party by force, threat of force, or intimidation, including threats based on actual or suspected immigration status, to engage in conduct from which the other party has a right to abstain or to abstain from conduct in which the other party has a right to engage. (5) Engaging in reproductive coercion, which consists of control over the reproductive autonomy of another through force, threat of force, or intimidation, and may include, but is not limited to, unreasonably pressuring the other party to become pregnant, deliberately interfering with contraception use or access to reproductive health information, or using coercive tactics to control, or attempt to control, pregnancy outcomes. (d) This section does not limit any remedies available under this act or any other provision of law.
```

</details>

### C5. `longcontext-010-c5`

**Criterion:** Answers the "he never hit her" argument by stating that abuse includes engaging in any behavior that has been or could be enjoined pursuant to Section 6320 and is not limited to the actual infliction of physical injury or assault.

#### Proposition `longcontext-010-p4`

> Abuse includes engaging in any behavior that has been or could be enjoined pursuant to Section 6320, and abuse is not limited to the actual infliction of physical injury or assault.

**Verbatim authoritative excerpt relied on:**

```text
To engage in any behavior that has been or could be enjoined pursuant to Section 6320. (b) Abuse is not limited to the actual infliction of physical injury or assault.
```

| source field | value |
| --- | --- |
| source_id | `STAT-CAL-FAM-CODE-6203` |
| locator | Cal. Fam. Code § 6203 |
| jurisdiction | California |
| authority status | operative statute |
| effective date | January 1, 2016 |
| retrieved at | 2026-07-27T21:30:00Z |
| canonical URL | <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=6203> |
| source sha256 | `693535f8c1d15d0165f8cfe9e1cc09f7b05e704afc4ec0fed8a2b042d2761fc2` |

<details><summary>Full source excerpt as stored in the registry (77 words) — the quoted proposition excerpt above must appear inside it verbatim</summary>

```text
(a) For purposes of this act, “abuse” means any of the following: (1) To intentionally or recklessly cause or attempt to cause bodily injury. (2) Sexual assault. (3) To place a person in reasonable apprehension of imminent serious bodily injury to that person or to another. (4) To engage in any behavior that has been or could be enjoined pursuant to Section 6320. (b) Abuse is not limited to the actual infliction of physical injury or assault.
```

</details>

## 4. Deterministic assertions (machine-checked, FYI)

| assertion_id | kind | expected | hard failure code |
| --- | --- | --- | --- |
| `longcontext-010-a1` | contains | coercive control | — |
| `longcontext-010-a2` | statute | 6320 | — |
| `longcontext-010-a3` | contains | immigration | — |
| `longcontext-010-a4` | not_contains | restraining order was granted on July 22, 2019 | MATERIAL_FACT_INVENTION |

## 5. Your decision

```
task_id:      longcontext-010
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
  --task longcontext-010 --reviewer REV-A --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1.jsonl
```

_Attestation files live OUTSIDE this repository. Never commit them._
