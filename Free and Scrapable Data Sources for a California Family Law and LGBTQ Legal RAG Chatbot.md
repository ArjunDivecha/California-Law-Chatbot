# Free, API-Accessible & Scrapable Data Sources for a California Family Law & LGBTQ Legal RAG Chatbot

## TL;DR

- **The highest-value additions to your existing CEB + CourtListener stack are three fully-free primary-law sources**: (1) the **Caselaw Access Project**, now fully open CC0 and downloadable without a key from `static.case.law` (or via Hugging Face mirrors) for the historical California Supreme Court and Court of Appeal corpus through 2020; (2) **Leginfo** for the actual California Family Code, Probate Code, and Welfare & Institutions Code (public-domain text, no API — scrape the `.xhtml` pages or load the state’s MySQL dumps); and (3) **govinfo/eCFR/Cornell LII** for the federal overlay (US Code, CFR) that governs LGBTQ family issues (Social Security survivor benefits, immigration, Title VII/IX).
- **For the LGBTQ-specific and family-law “explainer” layer** — the content that makes a chatbot genuinely useful to lay users — scrape the public guides/briefs from **NCLR, Lambda Legal, Transgender Law Center, ACLU, Williams Institute, and MAP**, plus **California Courts self-help (`selfhelp.courts.ca.gov`)** and **Judicial Council forms**. These are copyrighted (not public domain), so treat them as retrieval-only/attributed context, respect robots.txt and rate limits, and prefer their PDFs.
- **Watch three traps**: CourtListener’s free API tier was sharply cut on May 7, 2026 (now 5/min, 50/hr, 125/day for new users) so use **bulk data** instead of the live API for corpus-building; CAP case law ends in 2020 and Pile of Law’s CourtListener subset is frozen at 12/31/2022, so you need CourtListener’s continuous feed for recent opinions; and the LGBTQ-org guides carry restrictive copyrights, so do not redistribute their text — index it for grounded, cited answers.

## Key Findings

### Tier 1 — Must-have, fully free primary law (public domain, bulk/scrapable)

1. **California codes via Leginfo** — the Family Code, Probate Code, and Welfare & Institutions Code are the statutory backbone of your domain. **Public domain** by statute (Cal. Gov. Code §10248.5). No official API; scrape the JSF `.xhtml` pages or use the state’s MySQL dumps.
1. **Caselaw Access Project (CAP)** — historical California appellate/Supreme Court opinions through 2020, now **CC0 and fully open** (no key) from `static.case.law` and Hugging Face. Your cleanest bulk source for older, citable California case law.
1. **CourtListener / Free Law Project bulk data** — recent and historical California opinions, oral arguments, dockets; free bulk PostgreSQL/CSV dumps regenerated quarterly. Use bulk, not the (now-throttled) API, for corpus-building.
1. **Federal overlay (govinfo + eCFR + Cornell LII)** — US Code and CFR in bulk XML/JSON, public domain. Relevant to LGBTQ family law’s federal dimensions.

### Tier 2 — High-value secondary/explainer content (copyrighted, scrape as attributed retrieval context)

1. **California Courts self-help (`selfhelp.courts.ca.gov`)** and **Judicial Council forms** — plain-language family law (divorce, parentage, custody, DV restraining orders), the most chatbot-useful “how-to” content.
1. **NCLR, Lambda Legal, Transgender Law Center, ACLU** — know-your-rights guides, fact sheets, case dockets, briefs on parentage, marriage, trans rights.
1. **Williams Institute (UCLA)** and **Movement Advancement Project (MAP)** — research reports and structured 50-state policy data on LGBTQ law/demographics.

### Tier 3 — Pre-packaged corpora to bootstrap quickly

1. **Pile of Law** (Hugging Face) — 256GB legal corpus including CourtListener opinions, statutes/codes, state codes; CC-BY-NC-SA (non-commercial).
1. **MultiLegalPile / LexGLUE** — large multilingual/benchmark legal corpora.
1. **CAP Hugging Face mirrors** — ready-to-ingest Parquet/JSONL versions of the case law (CC0).

-----

## Details by source

### PRIMARY CALIFORNIA LAW

**California Family Code / Probate Code / Welfare & Institutions Code (Leginfo)**

- *Contents & relevance*: The literal statutory text of your core domain. Family Code governs marriage, domestic partnership, parentage, custody, support, and DV restraining orders; Probate Code covers guardianship/conservatorship and estate matters relevant to LGBTQ families; Welfare & Institutions Code covers dependency, foster care, and SOGIE-related youth provisions. **Maximum relevance.**
- *Access method*: **No official public API.** The official site (`leginfo.legislature.ca.gov`) is a JSF/`.xhtml` application — code sections live at URLs like `codes_displaySection.xhtml?lawCode=FAM&sectionNum=...`. Scrapable but the URL structure is awkward; community scrapers exist (e.g., GitHub `rasa/law-scraper`, `tylerpearson/california-laws-api`). The most robust path is the **state’s bulk database dumps** (the `pubinfo`/`capublic` MySQL database, published via FTP), which Open States and others import directly — giving you the full code text plus bill data without HTML scraping.
- *Coverage/recency*: Current California codes, updated as bills are chaptered; the downloadable dataset is the authoritative current text.
- *Format*: HTML/XHTML (scraped); MySQL dump (bulk); community JSON wrappers.
- *Licensing*: **Public domain.** Per Cal. Gov. Code §10248.5 (added by Stats. 2016, Ch. 441 (AB 884), effective Sept. 22, 2016), the published legislative information “is within the public domain and the State of California retains no copyright or other proprietary interest in that information.” Free and legal to use, including commercially.
- *HF/pre-packaged*: Portions appear inside Pile of Law’s state-code subsets; no dedicated current CA-codes HF dataset of note — best to ingest directly.

**California legislative bills & history (LGBTQ rights evolution)**

- *Contents/relevance*: Bill text and history for landmark CA LGBTQ statutes (e.g., SB 132 incarcerated-trans protections; SB 107 / AB 352 / SB 497 gender-affirming-care shield laws; AB 1525; SB 923 TGI Inclusive Care Act; the 2003 Gender Nondiscrimination Bill). Useful for explaining how and why the law evolved.
- *Access method*: Scrape Leginfo bill pages, OR use **LegiScan** — a **free public API capped at 30,000 queries/month** (the cap mirrors its OneVote public tracking service and resets on the 1st of each month; free registration required) returning JSON, plus weekly bulk CSV/JSON dataset snapshots for California. **Open States** also offers an API/bulk feed.
- *Coverage*: All CA sessions; LegiScan covers current + historical.
- *Format*: JSON (LegiScan/Open States API), CSV/JSON bulk, HTML (Leginfo).
- *Licensing*: Underlying CA legislative text is public domain (§10248.5); LegiScan requires a free account/API key and has its own terms for its packaged data.

**California Courts published opinions (Supreme Court & Courts of Appeal)**

- *Contents/relevance*: Precedential CA family/LGBTQ case law (e.g., *Elisa B. v. Superior Court* on parentage). High relevance for citable authority.
- *Access method*: The Judicial Branch site (`courts.ca.gov/opinions`) posts **slip opinions** and keeps them ~120 days, after which they move to the Case Information search tool. **No official bulk API** for opinion text; the free archive of published opinions (1850–present) is powered by LexisNexis (the California Official Reports site) and requires accepting terms. Practically, **do not scrape the court site for bulk history — get CA opinions from CourtListener and CAP instead** (both ingest CA appellate opinions). For very recent opinions (last 60–120 days), scrape the slip-opinion PDFs from `courts.ca.gov` or rely on CourtListener’s daily collection.
- *Coverage/recency*: `courts.ca.gov` = most current (same-day slip opinions); CAP = through 2020; CourtListener = historical + updated continuously.
- *Format*: PDF/DOC (court site); JSON/CSV (CourtListener); JSON (CAP).
- *Licensing*: Opinions are public record/public domain; the court site’s LexisNexis-powered reports require agreeing to terms, which is why aggregators are preferable.

**CourtListener / Free Law Project**

- *Contents/relevance*: 9M+ decisions from 2,000+ courts including the California Supreme Court and all six Court of Appeal districts; 3.4M+ minutes of oral arguments; the RECAP federal-docket archive (useful for the many LGBTQ impact cases litigated in the Ninth Circuit and N.D./C.D./S.D. Cal.); and a database of 16,191 judges. Very high relevance and the best source for *recent* CA opinions.
- *Access method*:
  - **REST API v4** (`courtlistener.com/api/rest/v4/`): token auth from your profile. **Critical 2026 change** — Free Law Project’s May 7, 2026 announcement states, “Before today, we gave every CourtListener user 5,000 API requests per hour out of the box”; the v4 docs now read that “authenticated users may make up to **5 requests per minute, 50 requests per hour, and 125 requests per day**.” Users with ≥1,000 prior requests were grandfathered at the old rate; higher limits require a Free Law Project membership or commercial agreement. The previously closed PACER APIs are now open to all members.
  - **Citation-lookup endpoint** (separate limits): “throttled to **60 valid citations per minute**,” “look[s] up at most **250 citations in any single request**,” with a ~64,000-character (~50-page) text cap per call — built on the Eyecite parser. Ideal as a hallucination guardrail.
  - **Bulk data** (`courtlistener.com/help/api/bulk-data/`): free PostgreSQL-format CSV dumps of courts, dockets, opinion clusters, opinions, judges, and oral arguments — **regenerated quarterly** (last day of Mar/Jun/Sep/Dec, ~3 AM PST). This is the right tool for corpus-building; filter by California court IDs (e.g., `cal`, `calctapp`).
  - **Case-law embeddings**: ~2TB of opinion embeddings downloadable from the public S3 bucket (`s3://com-courtlistener-storage/embeddings/opinions/`, `--no-sign-request`).
- *Coverage/recency*: Continuously updated as courts release opinions; deepest open collection for CA appellate law.
- *Format*: JSON (API), CSV/PostgreSQL (bulk), text/PDF fields per opinion.
- *Licensing*: Bulk content is Creative Commons–licensed (site notes CC BY-ND for some content); underlying opinions are public domain. Free and legal for your use; respect throttles.
- *HF/pre-packaged*: `harvard-lil/cold-cases` (COLD Cases, 8.3M decisions, CC0) reformats CourtListener bulk data and contains the full CAP within it.

**Caselaw Access Project (CAP / Harvard LIL)**

- *Contents/relevance*: Roughly **40 million pages of US court decisions making 6.4 million cases freely available** (per Harvard Library), digitized from the Harvard Law School Library collection — “the earliest case is from 1658, and the most recent cases are from 2020.” Includes the full historical **California Reports (Cal., Cal.2d–Cal.5th), California Appellate Reports (Cal.App.–Cal.App.5th), West’s California Reporter (Cal. Rptr. series), Pacific Reporter, and California Unreported Cases (1855–1910)**. Excellent for older citable CA precedent.
- *Access method (current, 2026)*: **The live API (`api.case.law`) and native search were retired/disabled in September 2024** (per the Library of Congress guide, which now directs keyword search to CourtListener). CAP is now a **static archival site**: the full data is hosted at **`https://static.case.law`**, browsable/downloadable via the `case.law` JavaScript front-end, organized **by reporter → volume**, as JSON case files plus metadata and page images. **No API key, no account, no daily cap** — the pre-2024 “500 cases/day / register / bulk-access agreement” rules are obsolete.
- *Coverage/recency*: All official book-published US case law **through 2020**; California (a former print-first “restricted” jurisdiction) effectively ends ~2018–2020. **No recent opinions** — pair with CourtListener for currency.
- *Format*: JSON (static files), page-image PDFs; Parquet/JSONL on HF mirrors.
- *Licensing*: **CC0 1.0 / public domain.** Harvard Law School confirms LIL marked the **full, unqualified release on March 8, 2024** (the “Transform: Justice” event), after Ravel’s negotiated eight-year exclusivity over the ~40M pages — which passed to LexisNexis on acquisition — expired. Recommended citation: *President and Fellows of Harvard University, “Caselaw Access Project,” 2024, <https://case.law/>*. Fully free and legal, including commercial use.
- *HF/pre-packaged*:
  - `free-law/Caselaw_Access_Project` — cleaned, **Parquet, ~38.1 GB, CC0**, ~6.6M decisions (gated by a free click-through agreement).
  - `TeraflopAI/Caselaw_Access_Project` — original cleaned version (Shippole/Komatsuzaki), CC0 (the upstream of the free-law mirror).
  - `common-pile/caselaw_access_project` — **6,919,240 documents / ~78 GB text, JSONL.gz, CC0**; plus a `_filtered` variant used to train the Comma model.

**California Code of Regulations (CCR)**

- *Contents/relevance*: Administrative regulations (e.g., 2 CCR §14000 et seq. civil-rights regs; CDCR regs implementing SB 132; Medi-Cal/health regs relevant to gender-affirming care). Moderate relevance — useful for implementation detail.
- *Access method*: The official CCR is published by **Barclays/Thomson-Reuters via a free Westlaw-based interface**; awkward to scrape (JS, session-based) and the publisher asserts control. **Better free path**: Public.Resource.Org (`law.resource.org/pub/us/code/ccr/`) hosts a bulk copy of the CCR (Carl Malamud published the full CCR there in 2012). Use that for bulk, recognizing it may not be perfectly current.
- *Coverage/recency*: Official site updated weekly; the resource.org copy is older.
- *Format*: HTML (official), bulk files (resource.org).
- *Licensing*: California asserts the official compilation is restricted; regulatory *text* with the force of law is generally treatable as public domain (the OAL has disputed this). Lower-risk to use the text for retrieval; flag this as a gray area.

### LGBTQ-SPECIFIC LEGAL ORGANIZATIONS (copyrighted — scrape as attributed retrieval context)

**NCLR — National Center for LGBTQ Rights (formerly Lesbian Rights)** — San Francisco–based; the single most California-relevant LGBTQ legal org.

- *Contents/relevance*: Resources/publications page (`nclrights.org/get-help/resources/`) with fact sheets and practice guides on parentage (Voluntary Declaration of Parentage/VDOP explainers), custody, divorce, immigration, youth/SOGIE, and conversion therapy (#BornPerfect); plus its litigation docket. **Very high relevance** — much of it California-specific.
- *Access method*: Scrape HTML pages + linked PDFs. No API. Respect robots.txt; moderate difficulty (standard WordPress-style site).
- *Coverage/recency*: Current; actively updated through 2025.
- *Format*: HTML, PDF.
- *Licensing*: Copyrighted by NCLR. Retrieval/attribution context only, not redistribution.

**Lambda Legal**

- *Contents/relevance*: Litigation Library (`lambdalegal.org/litigation-library/`) and the legacy case database (`legacy.lambdalegal.org`) with dockets, legal documents/briefs, and Know-Your-Rights guides; many California cases (e.g., *Chandler v. CDCR* defending SB 132). High relevance, national + CA.
- *Access method*: Scrape the current site + legacy archive (the legacy site is static and easy to crawl). No API.
- *Coverage/recency*: Current docket actively maintained; legacy archive frozen.
- *Format*: HTML, PDF (briefs, FAQs).
- *Licensing*: Copyrighted. Retrieval/attribution only.

**Transgender Law Center (Oakland)**

- *Contents/relevance*: California’s first statewide trans legal org. Resource guides incl. “California Transgender Law 101,” “ID Please” (changing CA/federal identity documents), and KYR guides. **Very high CA relevance** for trans/parentage/name-change questions.
- *Access method*: Scrape `transgenderlawcenter.org` + hosted PDFs (many mirrored on `.edu` sites and LawHelpCA). No API. Note some older flagship guides are dated.
- *Coverage/recency*: Mixed — some guides current, some older; verify dates.
- *Format*: HTML, PDF.
- *Licensing*: Copyrighted. Retrieval/attribution only.

**ACLU / ACLU of Northern & Southern California**

- *Contents/relevance*: KYR resources on LGBTQ employment, gender-affirming care, passports (*Orr v. Trump* Q&As), and DOJ-subpoena guidance. Good for current federal-vs-California tension. Moderate-high relevance.
- *Access method*: Scrape HTML/PDF. No API.
- *Licensing*: Copyrighted. Retrieval/attribution only.

**Williams Institute (UCLA School of Law)**

- *Contents/relevance*: The leading think tank on SOGI law/demographics — reports on LGBTQ parenting, adult LGBT population by state, anti-LGBT victimization, and the impact of federal executive orders. Strong for demographic/contextual grounding (e.g., how many LGBTQ parents are in CA) rather than black-letter law.
- *Access method*: Scrape publications (`williamsinstitute.law.ucla.edu/publications/`) as PDFs; “Data Interactives” provide visual data. No documented public API.
- *Coverage/recency*: Current through 2025.
- *Format*: PDF reports, HTML, some downloadable data.
- *Licensing*: Copyrighted academic work; cite and attribute.

**Movement Advancement Project (MAP)**

- *Contents/relevance*: **Equality Maps** tracking 50+ LGBTQ laws/policies across all states + DC + the five territories (Relationship & Parental Recognition, Nondiscrimination, Health Care, Identity Documents, etc.), with per-state profiles and a policy tally. Excellent **structured** comparative-law data and California’s standing.
- *Access method*: **No public API**; maps update in real time. MAP runs a **data-requests process** (`datarequests@mapresearch.org`) and publishes some historical datasets (e.g., a 2010-vs-2020 policy comparison). Scrape the equality-maps pages/state profiles; some materials are login-restricted to movement staff.
- *Coverage/recency*: Real-time, very current (snapshots dated e.g. April 2, 2026).
- *Format*: HTML (maps), PDF reports, some datasets on request.
- *Licensing*: Copyrighted; request permission/use the data-request channel for structured data; attribute.

### FAMILY-LAW-SPECIFIC SELF-HELP & LEGAL AID

**California Courts Self-Help (`selfhelp.courts.ca.gov`) & Judicial Council forms**

- *Contents/relevance*: Plain-language guides on divorce/legal separation, **parentage**, custody/visitation, child & spousal support, DV restraining orders, and guardianship — plus official fillable forms (e.g., FL-series, DV-series, NC-series name-change, FL-200 parentage) with instructions. **The single most useful “how-to” content for a lay-facing chatbot.**
- *Access method*: Scrape HTML guides + form PDFs. No API. Standard government CMS, straightforward to crawl; respect rate limits.
- *Coverage/recency*: Current statewide; regularly updated.
- *Format*: HTML, PDF (forms).
- *Licensing*: California government work — effectively public/free to use; forms are public. Lower-risk than the advocacy-org content.

**LawHelpCA & legal-aid guides (Bay Area Legal Aid, CRLA, Disability Rights California, LA LGBT Center, etc.)**

- *Contents/relevance*: LawHelpCA (`lawhelpca.org`) is the statewide self-help portal aggregating local legal-aid resources and organization referrals; legal-aid orgs publish CA family-law explainers. Disability Rights California hosts a detailed “Your Rights in California” trans/LGBTQ fact sheet co-authored by CA advocates. Useful breadth for referrals and plain-language coverage.
- *Access method*: Scrape HTML/PDF. No API.
- *Licensing*: Copyrighted by respective orgs; retrieval/attribution.

### FEDERAL OVERLAY & GENERAL LEGAL CORPORA

**US Code & CFR (govinfo + eCFR + Cornell LII)**

- *Contents/relevance*: Federal law touching LGBTQ family issues — Title VII/IX, Social Security survivor benefits (cf. *Ely v. Saul*), immigration, *Obergefell*/*Bostock* context, federal foster-care/HHS rules. Moderate but important overlay.
- *Access method*:
  - **govinfo Bulk Data Repository** (`govinfo.gov/bulkdata`): free **XML** for CFR (annual editions 1996–present), eCFR (current XML per title), and Congressional bills; add `/xml` or `/json` to bulkdata URLs. Also a documented **GovInfo API** (Open API/Swagger). No key for bulk; a free API key is needed for the search service.
  - **eCFR REST API** (`ecfr.gov/developers/documentation/api/v1`): free JSON API with point-in-time/historical CFR versions; full interactive docs.
  - **US Code**: downloadable in **USLM XML** from the Office of Law Revision Counsel (`uscode.house.gov`) and via govinfo.
- *Coverage/recency*: eCFR updated within days of Federal Register publication; very current.
- *Format*: XML, JSON, PDF, text.
- *Licensing*: **Public domain** (US government works). Fully free/legal.

**Cornell LII (Legal Information Institute)**

- *Contents/relevance*: Clean HTML of the **US Code, CFR/eCFR**, plus the **Wex** legal dictionary/encyclopedia (good plain-language definitions for a chatbot). High utility for definitions and federal text.
- *Access method*: **No official public API/bulk** for LII’s enhanced pages — LII itself builds from govinfo XML (its eCFR pipeline scrapes the GPO bulk site and processes the XML). Scraping LII HTML (e.g., `law.cornell.edu/uscode/text`, `/cfr/text`, `/wex`) is possible, but it is **better to take the underlying US Code/CFR from govinfo bulk** and use LII/Wex selectively for definitions. Respect LII’s terms.
- *Format*: HTML.
- *Licensing*: Underlying law is public domain; LII’s editorial layer (Wex) is copyrighted — attribute.

**Pile of Law (Hugging Face: `pile-of-law/pile-of-law`)**

- *Contents/relevance*: Per Henderson et al. (“Pile of Law,” arXiv:2207.00220, 2022), a **256GB** dataset of **35 data sources** of English legal/administrative text — including **CourtListener opinions (synchronized as of 12/31/2022)**, statutes, **state codes**, regulations, casebooks, and contracts. Contains California and family-law content embedded within the court-opinion and code subsets. Good for bootstrapping a broad legal base.
- *Access method*: HF `datasets` library; files are `.jsonl.xz` per subset (e.g., `train.courtlistener_opinions...`). No auth beyond HF.
- *Coverage/recency*: Court opinions synced through end of 2022; not current.
- *Format*: JSONL (xz-compressed).
- *Licensing*: **CC-BY-NC-SA 4.0**, and the authors note many sub-licenses restrict commercial use and ask that the data not be indexed by search engines. **If your chatbot is commercial, Pile of Law is problematic** — prefer pulling the underlying public-domain sources directly. Good for research/prototyping.

**MultiLegalPile (`joelniklaus/Multi_Legal_Pile`) & LexGLUE**

- *Contents/relevance*: Per Niklaus et al. (ACL 2024), MultiLegalPile is “a 689GB corpus in 24 languages from 17 jurisdictions” across five legal text types (caselaw, legislation, contracts, etc.); English subsets are usable. LexGLUE is a benchmark suite (classification/QA tasks), more for evaluation/fine-tuning than as a RAG corpus. Moderate relevance — general, not CA/family-specific.
- *Access method*: HF `datasets`; config = `{language}_{type}` (e.g., `en_caselaw`). 
- *Licensing*: Mixed; the `legal_mc4` subset is “less permissively licensed than the other types” — check per-subset. Some subsets non-commercial.

-----

## Recommendations (staged)

**Stage 1 — Build the free, public-domain core (do first; lowest legal risk, highest authority):**

1. Ingest the **California Family Code, Probate Code, and Welfare & Institutions Code** from the state’s MySQL dump (or scrape Leginfo) — public domain and the literal text your users need. Refresh quarterly or when major bills chapter.
1. Add **CourtListener bulk data** filtered to California courts (`cal`, `calctapp`) for opinions + oral arguments, and **CAP** (via `static.case.law` or the `common-pile`/`free-law` HF Parquet/JSONL mirrors, CC0) for pre-2020 CA precedent. Dedupe overlap (CourtListener ingests CAP).
1. Layer in the **federal overlay** from govinfo/eCFR bulk XML + selected Cornell LII/Wex definitions.
   *Benchmark to proceed:* retrieval returns correct statute sections and leading CA cases (e.g., *Elisa B.*, marriage/parentage cases) for test queries.

**Stage 2 — Add the lay-facing explainer layer (highest user value):**
4. Scrape **California Courts self-help + Judicial Council forms** (government, low-risk) for divorce/parentage/custody/DV/name-change workflows.
5. Scrape **NCLR, Lambda Legal, Transgender Law Center, ACLU** guides/PDFs and **MAP/Williams Institute** reports — store as **attributed, retrieval-only** chunks with source URLs; do not redistribute verbatim. Implement per-source rate limiting, honor robots.txt, and set a descriptive User-Agent.
*Benchmark:* lay-user questions (“How do I establish parentage as a non-biological mom in CA?”) return a court self-help guide + the relevant Family Code section + an NCLR/TLC explainer.

**Stage 3 — Currency & guardrails:**
6. Add a **daily/weekly delta** from `courts.ca.gov` slip opinions (last 60–120 days) or CourtListener’s continuous feed so recent opinions aren’t missed (CAP stops at 2020).
7. Wire **CourtListener’s citation-lookup API** as a **citation-verification guardrail** to catch hallucinated case cites in generated answers (60 citations/min, 250/request).
8. Track **MAP Equality Maps** and CA bill feeds (LegiScan free tier / Open States) so the bot reflects fast-moving 2025–2026 changes (shield laws, EO litigation).

**Thresholds that change the plan:**

- *If the chatbot is or becomes commercial*: drop Pile of Law and any non-commercial HF subsets; rely only on public-domain primary law + your own scrapes of openly available org content with attribution; seek MAP’s data-use permission.
- *If you need >125 CourtListener API calls/day*: get a Free Law Project membership rather than scraping around the throttle.
- *If recency matters more than history*: prioritize CourtListener’s live collection + court slip opinions over CAP.

## Caveats

- **Recency gaps**: CAP ends in 2020; Pile of Law’s CourtListener subset is frozen at 12/31/2022. Only CourtListener’s live collection and the court’s own slip-opinion feed give you 2023–2026 California opinions.
- **CourtListener throttle change is recent (May 7, 2026)** and the rate numbers may continue to evolve; verify current limits on the memberships page before architecting around the API. Use bulk data for corpus-building regardless.
- **Licensing distinctions matter**: primary law (codes, regs, opinions, US Code/CFR) is public domain and safe; advocacy-org and think-tank content (NCLR, Lambda, TLC, ACLU, Williams, MAP) is **copyrighted** — use it as cited, retrieval-grounded context, not redistributed text. Pile of Law and some MultiLegalPile subsets are **non-commercial**.
- **Scraping legality**: Ninth Circuit (*hiQ v. LinkedIn*) and N.D. Cal. (*Meta v. Bright Data*) hold that scraping **publicly available** (non-logged-in) data is generally lawful under the CFAA, but **contract/ToS claims can survive**, and robots.txt should be treated as good-faith guidance. Stay on the public side of any login wall, rate-limit, and identify your crawler.
- **CCR is a gray area**: the official compilation is published under a Thomson-Reuters/Barclays contract and the OAL asserts restrictions; the public.resource.org copy is a defensible free source but may not be perfectly current.
- **California Courts opinion site** is powered by LexisNexis and requires accepting terms for the historical archive — which is why CAP/CourtListener are the recommended bulk sources rather than scraping the court site directly.
- I was unable to verify exact California-specific case/volume counts within CAP via retrievable text (the static site is JavaScript-rendered); confirm by browsing `static.case.law` directly if precise figures are needed. The 6.4 million case / 40 million page figures are corpus-wide.