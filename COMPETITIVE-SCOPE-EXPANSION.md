# Scope Expansion: Competitive Analysis & Feature Roadmap

**Date:** 2026-06-12 · **Author:** Claude Fable 5
**Inputs:** femmeandfemmelaw.com (fetched today), three web research deep dives (Harvey, Legora, CoCounsel — full source lists at end), the V2 codebase, and the 2026-06-12 Fable 5 deep dive (`FABLE5-DEEP-DIVE-REPORT.md`).
**Method:** every competitor claim is sourced; vendor marketing vs verified reporting is flagged. Recommendations are constrained by V2's zero-leak invariant and the existing Fable-5 roadmap (P0 hardening → Matter Workspace first).

---

## 1. The grounding fact: what Femme & Femme actually does

The V2 docs describe F&F generically as "family/probate/civil." The firm's own site is far more specific — and it changes which competitor features matter.

**femmeandfemmelaw.com (fetched 2026-06-12):** *"Compassionate legal services for the LGBTQ+ community and our allies"* — **Family Formation & Estate Planning Law**, Oakland (1300 Clay St). Two partners: **Lyla Bugara** (family creation + estate planning; public-defender/legal-aid background; English/Portuguese/Spanish) and **Rachel M. Schiff** (LGBTQ+ family law + estate planning; ex-Munger Tolles litigator; C.D./N.D./S.D. Cal. federal admissions). Both are CLA Trusts & Estates section members.

**Offerings (verbatim from /offerings):**
- *Family Protection & Formation:* Known Donor Contracts (sperm & egg) · Surrogacy Contracts · Confirmatory, Second-parent and Step-parent Adoptions · Parentage Judgments · Prenuptial, Postnuptial and Cohabitation Agreements (+ guardianship planning, domestic-partnership advising per homepage)
- *Wills, Trusts & Estate Planning:* Comprehensive Estate Planning · Trusts & Wills · Financial Powers of Attorney · Advance Healthcare Directives (+ estate administration, end-of-life planning per homepage)
- *B2B:* **LGBTQ+ Competence Consultations for Lawyers & Law Firms** — including "sensitivity and cultural competence review of briefs & motions that discuss LGBTQ+ issues" and presentations.

**Clients:** LGBTQ+, **polyamorous**, chosen, blended, and **immigrant** families.

**The practice-shape conclusion that drives everything below:** this is a **document-production and court-process practice, not a contested-litigation shop.** The unit of work is the *packet* — an estate-plan package (trust + pour-over will + AHCD + POA), an adoption filing (ADOPT-200/210/215), a parentage judgment (FL-200 + proposed judgment), a donor or surrogacy agreement, a prenup with its procedural-compliance trail. The California hooks are specific and verified: Fam C [§9000.5](https://california.public.law/codes/family_code_section_9000.5) streamlined confirmatory adoptions (no home study; [ADOPT-210](https://courts.ca.gov/system/files?file=2025-06/adopt210.pdf) agreement → ADOPT-215 order), [§7612(c)](https://codes.findlaw.com/ca/family-code/fam-sect-7612/) multi-parent findings (SB 274), [§7962](https://codes.findlaw.com/ca/family-code/fam-sect-7962.html) surrogacy pre-/post-birth judgments, the expanded [VDOP](https://selfhelp.courts.ca.gov/VDOP) for assisted-reproduction parents, Fam C §1615 prenup procedural requirements, Prob C §16061.7 trust-administration notice (120-day contest clock), [GC-210](https://courts.ca.gov/sites/default/files/courts/default/2024-11/gc210.pdf) guardianships, DE-111 probate petitions.

Notably, **V2's Drafting Magic was already built around exactly this packet shape** (trust, pour-over will, AHCD, financial POA, prenup — `api/agent/drafting-magic.ts`), and the CEB corpus already covers Trusts & Estates (40,263 chunks) and Family Law (7,511). The expansion below is therefore mostly *specialization and productization*, not greenfield.

---

## 2. Competitor synthesis (June 2026)

### 2.1 Harvey ($11B valuation, ~$1,200/seat/mo reported, ~20-seat minimums)
The platform: **Assistant** (chat + Deep Analysis + native Word/PDF/PPT/Excel generation), **Vault** (100K-doc repositories + Review Tables with claimed 96% extraction accuracy), **Knowledge** (LexisNexis alliance: US federal/state primary law + **Shepard's** validation in-product; public US Case Law source June 2026), **597 pre-built agents in 31 practice categories** + Agent Builder, **Word add-in** (redlining with negotiating-position awareness, playbooks), Outlook/Email Harvey, **Shared Spaces + guest accounts** (cross-org collaboration), mobile with dictation + document scanning, Command Center analytics. Multi-model (GPT-5.5, Claude Opus 4.8, Gemini, Mistral). One-click workflows: translate, proofread, **redact/anonymize**, doc→template conversion, chronology extraction.
**Directly relevant signal:** Harvey ships a **Family Law category (19 agents** — publicly named: "Draft Markup of Counterparty Prenuptial Agreement," "Draft Adoption Petition") **and Trusts & Estates (24 agents** — "Draft Revocable Living Trust Agreement"). Depth/jurisdiction-specificity unverified; **nothing California-procedure-specific anywhere**.
**Sources:** harvey.ai product pages + The Brief Apr/May/Jun 2026; [agents page](https://www.harvey.ai/agents); [$11B round](https://www.cnbc.com/2026/03/25/legal-ai-startup-harvey-raises-200-million-at-11-billion-valuation.html); pricing reports ([Vaquill](https://www.vaquill.ai/blog/harvey-legora-cocounsel-pricing-reality-2026), unverified).

### 2.2 Legora ($5.6B valuation, ~$3,000/seat/yr reported, 10-seat minimum)
The "**aOS**" (May 2026): **Legora Agent** (Plan→Execute→Review→Deliver, *proactive* email/document monitoring), **Tabular Review** (the signature: an AI spreadsheet over document sets — every cell cited, real-time multiplayer, lock/review/comment), **Word add-in** with automated playbooks, no-code **Workflows**, **Legal Research** (Qura acquisition: ~86M docs; EU-deep, US state law weak — Wolters Kluwer US statutes arriving Q3 2026), **Monitors** (Graceview acquisition: regulatory horizon-scanning productized as a client service), **Portal** (firms "productize their expertise" into client-facing AI workflows + document Q&A + live collaboration — GA Q1 2026 with Linklaters/Goodwin/Cleary as design partners), Editor/Outlook/mobile. Built primarily on Claude per TechCrunch.
**Zero family-law/probate/T&E presence; no California content.** Solution lanes: M&A, Litigation, Banking, Tax, Insurance.
**Sources:** legora.com product/newsroom; [aOS](https://www.artificiallawyer.com/2026/05/07/legora-launches-aos-agentic-operating-system/); [Portal](https://legora.com/newsroom/portal-announcement); [TechCrunch](https://techcrunch.com/2026/04/30/legal-ai-startup-legora-hits-5-6-valuation-and-its-battle-with-harvey-just-got-hotter/); pricing per [Spellbook](https://spellbook.com/briefs/legora-vs-harvey)/[TheLawGPT](https://www.thelawgpt.com/blog/legora-alternatives-affordable-legal-ai) (competitor-reported).

### 2.3 CoCounsel (Thomson Reuters; ~$639/user/mo solo for Westlaw Advantage + Essentials, per TR's own configurator)
Named skills: AI-Assisted Research (Westlaw), Ask Practical Law, Review Documents, Summarize, Extract Contract Data, Contract Policy Compliance, **Timeline**, Search a Database, Draft Correspondence, **Prepare for a Deposition**; CoCounsel 2.0 added Claims Explorer + Compare Documents; **CoCounsel Drafting** in Word (precedent search, playbook deviation analysis, Deal Proof, **TOA automation, KeyCite flags embedded in drafts**, discovery request/response drafting); **CoCounsel Legal** (Aug 2025) added **Deep Research** over Westlaw, **Guided Workflows** (Draft a Complaint, Draft/Respond to Discovery, Deposition Transcript Review), Litigation Document Analyzer with a **hallucination checker**; Nov 2025 agentic betas (10K-doc Tabular Analysis, Workflow Builder); **Apr 2026: full agentic rebuild on Anthropic's Claude Agent SDK** with a patent-pending **"citation ledger"** (records every source/passage the agent read); **May 2026: MCP connector exposing Westlaw/PL to Claude users**. The moat: 1.9B documents, 1.4B KeyCite signals, Rutter Group California practice guides (incl. *California Practice Guide: Family Law* + 250-form companion).
**Family law:** a dedicated marketing page (review CPS/GAL reports, bank statements, texts; chronologies; "best interests" analysis; declaration drafting) — but **generic skills mapped onto family facts: no family-law-specific workflows, no court forms, no support calculators.** Practical Law US has T&E content but **no family-law practice area**. The Smokeball partnership (Mar 2026) targets 2–30-lawyer firms.
**Sources:** TR press/help pages; [LawSites Aug 2025](https://www.lawnext.com/2025/08/thomson-reuters-launches-cocounsel-legal-with-agentic-ai-and-deep-research-capabilities-along-with-a-new-and-final-version-of-westlaw.html); [Claude Agent SDK rebuild](https://www.thomsonreuters.com/en-us/posts/innovation/rebuilding-for-the-agent-era-the-next-generation-of-cocounsel-legal/); [MCP](https://www.lawnext.com/2026/05/two-legal-research-providers-launch-mcp-integrations-with-claude-thomson-reuters-and-free-law-project-connect-their-data-to-ai.html); [configurator pricing](https://costbench.com/software/ai-legal-tools/cocounsel/).

### 2.4 The adjacent competitors the big three ignore
For F&F's actual work, the closer competition is estate-planning document automation: **WealthCounsel/WealthDocx** (1,000+ jurisdiction-specific T&E templates + "LawY" AI assistant), **Vanilla** (advisor-side guided questionnaires, AI plan summaries, existing-plan review/abstraction), **EncorEstate** — none LGBTQ+-specialized, none privilege-first, all advisor/attorney-generic. ([WealthCounsel](https://www.wealthcounsel.com/), [Vanilla](https://www.justvanilla.com/), [comparison](https://blog.encorestateplans.com/wealth-com-vs-encorestate-vs-vanilla).) On the family-law side, support-calculation tools (DissoMaster lineage) exist but contested-support math is mostly outside F&F's formation-focused practice.

### 2.5 Convergence table — what all three have vs V2 today

| Capability (competitor consensus) | Harvey | Legora | CoCounsel | V2 today |
|---|---|---|---|---|
| Bulk multi-doc **tabular review** w/ per-cell citations | Vault Review Tables | Tabular Review (multiplayer) | Tabular Analysis (10K docs) | ✗ (Drafting Magic compares a packet, but no table/grid surface) |
| **Word-native** drafting/redlining + playbooks | ✓ | ✓ | ✓ (+KeyCite flags, TOA) | ✗ (web app + DOCX export only) |
| **Agentic workflows**, pre-built + user-built libraries | 597 agents + Builder | Workflows + Skills | Guided Workflows + Builder | Partial (4 drafting skills, intent skills; no user-facing builder) |
| **Deep research** on licensed primary law w/ citator | Lexis + Shepard's | Qura + WK (US weak) | Westlaw + KeyCite | CourtListener + leginfo/LII/eCFR (existence + content-match; **no citator/treatment signal**) |
| **Timeline/chronology** extraction | ✓ | via tabular | Timeline skill | ✗ |
| Translate / redact / proofread one-clicks | ✓ | ✓ | partial | Redaction is *the architecture*; no translate/proofread workflows |
| **Client/external collaboration** | Shared Spaces + guests | **Portal** (productized client workflows) | HighQ | ✗ (attorney-only) |
| Email/PST ingestion + Outlook surface | ✓ | ✓ | ✓ | ✗ |
| Knowledge bases / firm playbooks | ✓ | ✓ | ✓ (+Practical Law) | Skills (committed markdown) only |
| Deposition/transcript tooling | ✓ | ✓ | ✓ | ✗ (low priority for F&F) |
| Regulatory/case **monitoring** | ✗ | **Monitors** | alerts via Westlaw | ✗ (has LegiScan/OpenStates tools — unexploited) |
| Mobile + dictation + doc scanning | ✓ | ✓ | ✗/partial | ✗ (vision blocked pending daemon OCR-redact) |
| **On-device PII tokenization / zero-leak** | ✗ (contractual ZDR only) | ✗ (BYOK/residency) | ✗ (zero-retention API calls) | **✓ — unique** |
| CA **Judicial Council forms** automation | ✗ | ✗ | ✗ | ✗ — **open ground** |
| Family-formation workflows (donor/surrogacy/adoption/parentage) | 2 generic agents | ✗ | ✗ | ✗ — **open ground** |
| Price for a 2-attorney firm | ~$29K+/yr (reported floor) | ~$30K/yr floor | ~$15K+/yr | **API cost only (~$2–5K/yr)** |

**Strategic read.** The big three are converging on the same enterprise platform (repository → tabular review → agents → Word → client portal) priced and packaged for 10+ seat firms, with primary-law moats (Lexis/Westlaw) V2 neither has nor needs for this practice (CEB + CourtListener + leginfo cover it, and the 6th addendum already rejected the TR subscription). **None of them does California court procedure, court forms, family formation, or consumer-client workflows — and none can match V2's privilege architecture.** The winning move is not to chase Harvey's breadth; it is to own the boutique-practice layer they structurally ignore, while adopting the three convergence features that genuinely transfer (tabular review, workflow packs, client collaboration).

---

## 3. Recommended feature expansions

Ordered by (practice-fit × differentiation ÷ effort), sequenced to respect the existing roadmap (P0 hardening and the Matter Workspace from `FABLE5-DEEP-DIVE-REPORT.md` come first; several items below *depend* on them). Every item states its zero-leak treatment.

### Tier 1 — Build next (high fit, rides existing rails)

**F1. Estate Plan Package & Review workflows** — *the Vanilla/WealthDocx move, LGBTQ+-specialized and privilege-first.* Effort **S–M**.
Two productized flows on top of Drafting Magic + the template system:
(a) **Package generation**: structured intake (family structure incl. multi-parent/poly/chosen-family, assets, fiduciaries, wishes) → full coordinated package: revocable living trust, pour-over will, AHCD, financial POA, certification of trust, funding instructions — with cross-document consistency enforced by the existing conflict-map logic. New drafting skills: `drafting/rlt-package`, `drafting/ahcd`, `drafting/poa`, with chosen-name/pronoun handling and non-traditional-family clause libraries as first-class template variables (no competitor has this; it is F&F's brand).
(b) **Estate Plan Review**: upload a client's *existing* documents → Drafting Magic's extraction/conflict pipeline produces a flagged review memo (outdated law, missing incapacity provisions, misaligned beneficiaries, unfunded trust) — this is literally the existing 9-section workproduct re-skinned and packaged as a billable product.
*Zero-leak:* unchanged — existing per-source tokenization path. *Code:* new skills + templates, `V2DraftPage`/Magic presets, intake schema.

**F2. Family Formation Pack with a Judicial Council forms engine** — *the open-ground flagship; no competitor touches court forms.* Effort **M**.
Workflows for the firm's bread-and-butter filings:
- **Confirmatory/stepparent adoption packet** (Fam C §9000.5): eligibility interview (married at birth? assisted reproduction? → streamlined path, no home study) → completed ADOPT-200/210/215 set + county-specific filing checklist (Alameda/SF/Contra Costa) + client instruction letter + timeline.
- **Parentage judgment workflows**: FL-200 petitions; §7962 surrogacy pre-birth order packages with a statutory compliance checklist (execution timing, notarization, independent counsel) enforced as a deterministic pre-flight; §7612(c) third-parent support (points & authorities skeleton from CEB/CourtListener research).
- **Guardianship (GC-210) and probate (DE-111) starters**, incl. the small-estate (§13100) vs probate decision tree and Heggstad (Prob C §850) identification.
**The forms engine is the key new capability and it composes beautifully with the invariant:** the model never fills a form — it outputs a *token-space field map* (`{form: "ADOPT-200", fields: {petitioner_name: "CLIENT_001", …}}`) validated by structured outputs; the **browser** rehydrates values locally and writes them into the official fillable PDF with `pdf-lib` (client-side, like the existing DOCX export). Raw client data never touches the server; the filled PDF never leaves the device unless the attorney exports it. Form templates (current Judicial Council PDFs) are versioned in-repo with revision dates, and a `form_version_check` step flags stale forms.
*Zero-leak:* **improved** — form-filling happens entirely on-device. *Code:* `services/forms/` (browser fill engine + field maps per form), new skills, a `forms` workflow surface; deadline/compliance checks reuse the in-process `deadline_calc` tool already proposed in the Fable-5 report.

**F3. Cultural-competence brief review — productize the consulting line.** Effort **S**.
F&F *sells* "sensitivity and cultural competence review of briefs & motions" to other firms today, by hand. Make it a workflow: upload a brief → flags misgendering/deadnaming, outdated terminology, incorrect statutory frameworks for LGBTQ+ families (e.g., treating a §7613 donor as a presumed parent, two-parent assumptions in multi-parent matters), heteronormative boilerplate — each flag with a suggested edit and, where doctrinal, a verified citation (existing citation/statute verify). Ships as a skill + a Draft-page preset reusing the propose→approve UX.
*Strategic kicker:* this is the first feature **other firms would pay F&F for** — either as a service F&F runs through V2, or eventually as a white-label seat. V2's privilege architecture is precisely what makes "send us your draft brief" palatable to outside counsel.
*Zero-leak:* unchanged (drafts tokenize like any document; party names in *filed* captions are already allowlist-handled). *Code:* one skill file + Draft-page preset; optional dedicated route.

**F4. Tabular Matter Review** — *the one universal competitor feature V2 lacks.* Effort **M** (depends on Matter Workspace).
A citation-per-cell extraction grid over a matter's documents: rows = documents (or accounts, or assets), columns = natural-language questions. F&F use cases: prenup financial-disclosure schedules (assets/debts/values/dates across statements — feeds Fam C §1615's fair-disclosure requirement), estate-asset inventories from brokerage/bank statements, trust-administration asset alignment, donor/surrogacy agreement term comparison. Implementation: Fable + structured outputs over the tokenized matter bundle; render rehydrated client-side; per-cell `source: {doc_id, offset}` anchors; "mark reviewed" per cell (Legora's pattern, simplified for two users). Batch API for big grids at 50% cost.
*Zero-leak:* unchanged (matter docs already tokenized; grid content is token-space at rest, rehydrated for display).

### Tier 2 — High value, do after Tier 1

**F5. Compliance calculators & matter timelines.** Effort **S–M**. Deterministic in-process tools (code, not model arithmetic): prenup §1615 procedural validator (7-day rule between final draft and signing, independent-counsel/waiver requirements, disclosure completeness); trust-administration clock (Prob C §16061.7 notice → 120-day contest deadline); probate milestone timeline; adoption process tracker. Each emits an auditable worksheet the attorney can file-paper. (Extends the `deadline_calc` proposal from the Fable-5 report; pairs with F2 packets.)

**F6. Client intake & status portal** — *the Legora Portal / Harvey Shared Spaces pattern, consumer-grade.* Effort **M–L** (hard-gated on P0 auth).
Guided intake questionnaires (family-formation intake, estate-planning intake — branching for multi-parent/poly/blended structures, chosen names vs legal names captured separately) that feed F1/F2 directly; a read-only matter-status view ("petition filed → hearing 7/22 → finalized") for clients. F&F's clientele is consumers, not GCs — no competitor serves this segment's intake needs.
*Zero-leak design decision to make explicitly:* client-entered data is raw PII from a device that has no daemon. Options: (a) intake stored end-to-end-encrypted (firm-held key), tokenized on the attorney's device on first open — preserves Option C purity; (b) treat intake as the existing "attorney pastes client facts" path. Recommend (a); either way it must be decided as an addendum, not silently. *Code:* new Clerk-authenticated client role, intake schema, encrypted blob store; significant new surface — hence the auth prerequisite.

**F7. LGBTQ+ family-law Monitors** — *Legora's Monitors, scoped to one community and two attorneys.* Effort **S**.
A weekly watch over: California parentage/adoption/ART legislation (LegiScan/OpenStates tools — already built, barely exploited), new published CA parentage/adoption opinions (CourtListener date-filtered), and federal developments bearing on marriage/parentage recognition (web_search). Output: a cited digest + "client-impact" notes (e.g., developments that would trigger the firm's standing advice on securing parentage judgments regardless of marital status — a live concern for this client base). Runs on the Batch API nightly/weekly at 50% cost; doubles as content for the firm's consulting/presentation line.
*Zero-leak:* trivially safe — public data only, no client content.

**F8. Translation & plain-language client deliverables.** Effort **S**.
Spanish/Portuguese client letters and plain-language plan summaries ("what your trust does, in one page") as one-click transforms on any draft — tokens pass through translation untouched (same preservation rule as the Draft flow), rehydration stays local. Serves the immigrant-family client base; Lyla's languages make attorney review practical. Mirrors Harvey/Legora translate workflows; explicitly watermark "not a certified translation."

### Tier 3 — Worthwhile, later

**F9. Chronology builder** (S–M): cited timelines from the matter file (parentage-intent evidence, estate-dispute fact patterns). CoCounsel's Timeline skill, grounded in the Matter Workspace.
**F10. DOCX tracked-changes round-trip** (M): import opposing draft → propose→approve → export a real tracked-changes DOCX (the `docx` dependency supports revisions). This delivers ~80% of the competitors' Word-add-in value without building one. A true Office.js add-in (the daemon is reachable from an add-in webview, so the invariant survives) is **L** and only worth it if drafting-in-Word friction proves real.
**F11. Knowledge base / firm playbooks UI** (M): promote `agents/california-legal/skills/*.md` from committed markdown to an attorney-editable (versioned, audit-logged) library — clause preferences, standard positions for donor agreements/prenups. Competitor table stakes; modest urgency at two attorneys.
**F12. Email ingestion** (M–L): Gmail/Outlook → matter file. High value, but it is a new high-volume raw-PII ingress; gate on the same chunked-tokenization machinery as the Matter Workspace and treat as its phase 2.
**F13. White-label exploration** (strategic, not engineering): F1–F3+F6 packaged for *other* LGBTQ+-serving boutiques — V2's privilege story + the competence layer is a defensible niche product the $11B players won't build. Revisit after the firm has run on Tier 1 for a quarter.

### Explicitly not recommended
- **Licensed-content research moat** (Westlaw/Lexis/Practical Law): rejected by partners (6th addendum), priced for enterprises, and unnecessary for this practice mix (CEB + CourtListener + leginfo + Rutter-via-library covers it). Revisit only if the citator gap (below) proves painful.
- **Deposition/discovery suites, M&A diligence, contract-portfolio dashboards**: wrong practice.
- **A citator clone**: full treatment analysis isn't buildable from free sources; do adopt the *cheap version* — the `citing_opinions` adverse-authority sweep already specified in the Fable-5 report (CourtListener citation network), which mitigates the "verified-but-since-disapproved" risk that KeyCite/Shepard's solve for competitors.

---

## 4. Sequencing against the existing roadmap

```
P0 hardening (auth, refusals, caching, structured outputs)   ← unchanged prerequisite
  └─ Matter Workspace + matter memory                         ← unchanged #1
       ├─ F1 Estate Plan Package & Review        (S–M)  ┐
       ├─ F2 Family Formation Pack + forms engine (M)   ├─ the practice-fit wave
       ├─ F3 Competence brief review              (S)   ┘
       ├─ F4 Tabular Matter Review                (M)   ← needs matter bundles
       ├─ F5 Calculators/timelines                (S–M)
       └─ F7 Monitors / F8 Translation            (S)
            └─ F6 Client intake & portal          (M–L) ← needs P0 auth + an addendum
                 └─ Tier 3 (F9–F13) as demand shows
```

The Verified Drafting Run and vision/OCR items from the Fable-5 report slot unchanged around this; F2's forms engine and F5's calculators are natural components of the Verified Drafting Run when it arrives.

---

## 5. Bottom line

Harvey, Legora, and CoCounsel validate the *patterns* (tabular review, workflow packs, client collaboration, monitoring) but are structurally committed to enterprise breadth: 10–20-seat minimums, $15K–$300K/yr, generic practice coverage, and **zero California-procedure, zero court-forms, zero family-formation depth**. CoCounsel's family-law page maps generic skills onto family facts; Harvey's 19 family-law agents are jurisdiction-generic; Legora has no family/probate presence at all. Meanwhile the estate-automation incumbents (WealthDocx/Vanilla) have the documents but not the privilege architecture, the LGBTQ+ competence, or the court-process layer.

V2's expansion path is therefore to become **the thing none of them are: a California family-formation and estate-planning workbench** — packets in (intake), verified packets out (plans, petitions, filled Judicial Council forms, compliance worksheets), with client names never leaving the attorney's laptop. Tier 1 (F1–F4) is buildable on existing rails in roughly the same effort class as the already-planned Matter Workspace, and F3 turns the firm's consulting sideline into the seed of a product other firms would pay for.

---

### Source appendix
**Firm:** https://www.femmeandfemmelaw.com/ · /offerings · /meet-the-femmes (fetched 2026-06-12).
**California law/forms:** Fam C §9000.5 (california.public.law; AdoptHelp); §7612/SB 274, §7962 (FindLaw; leginfo); VDOP (selfhelp.courts.ca.gov; DCSS); ADOPT-210/GC-210 (courts.ca.gov).
**Harvey:** harvey.ai (platform/assistant/vault/agents/microsoft-integrations/security/solutions/newsroom; Briefs Apr–Jun 2026); CNBC & TechCrunch (Mar 2026 round); LawSites; Artificial Lawyer (agents, LAB); Lawyerist, GC AI, GrowLaw, Vaquill, bindlegal, costbench, Contrary Research (pricing/commentary — unverified where noted).
**Legora:** legora.com (product/tabular-review/word-add-in/workflows/legal-research/agent/monitors/security/customers/newsroom: aOS, Portal, $100M ARR, Series D, Qura, Graceview, Cadastral, Wolters Kluwer); TechCrunch (Mar & Apr 2026); Crunchbase News; Artificial Lawyer; Law.com; ABA Journal; LawSites (Everlaw, NetDocuments); Legaltech Hub; Microsoft customer story; competitor-authored comparisons flagged (GC AI, Spellbook, Bind, Purple, TheLawGPT).
**CoCounsel:** TR press/help/product pages (CoCounsel Legal, Essentials, Drafting, family-law & criminal-law pages, Westlaw Advantage); TR Institute (Reimagined, guided workflows); LawSites (Aug 2025 launch; 1M users; MCP May 2026; Vals benchmarks); StockTitan (Smokeball); costbench (configurator pricing); lawxyai/aivortex/Lawyerist (reported pricing/commentary); Plaintiff Magazine (2023 solo review); Microsoft 365 app certification attestation.
**Adjacent:** wealthcounsel.com; justvanilla.com; encorestateplans.com comparisons; natlawreview.com drafting-systems review.
