<!--
=============================================================================
DOCUMENT: docs/VERIFICATION_ALTERNATIVES_REVIEW_2026-07-02.md
WHAT THIS IS: Decision-grade review of alternatives for the chatbot's
verification layer (case citations, statutes/regs/rules, secondary sources),
commissioned 2026-07-02 after F&F attorneys reported the CEB corpus stale and
the verifiers "not up to snuff." Verification touches PUBLIC data only — no
client-confidentiality constraints.
HOW IT WAS PRODUCED: 17-agent research workflow (6 research verticals →
per-vertical adversarial fact-checking of load-bearing claims → completeness
critic → 2 gap-filling researchers → synthesis), ~967k tokens, 444 tool
calls. One refuted claim was corrected before synthesis. The two
highest-stakes claims (CEB ToS AI-ingestion prohibition; CourtListener
citation-lookup API limits) were additionally re-verified by hand against
ceb.com/terms-and-conditions and wiki.free.law on 2026-07-02.
KNOWN GAP: the third gap-research agent (vLex/CLA + CEB API licensing deep
dive) failed mid-run; §8 open questions cover the residue.
INPUT SOURCES: live web research (URLs inline) + repo code inspection.
OUTPUT FILE: /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/docs/VERIFICATION_ALTERNATIVES_REVIEW_2026-07-02.md
=============================================================================
-->

# Verification Alternatives Review — California Law Chatbot

**Date:** 2026-07-02
**Prepared for:** Arjun Divecha and the partners, Femme & Femme LLP
**Scope:** Alternatives for the chatbot's verification layer only (public legal data — case citations, statutes/regulations/rules, practice-guide passages). No client-confidentiality constraints apply to these sources. All claims below were adversarially verified against primary sources; anything that failed verification or came back "unclear" is marked with an asterisk (*) and explained in place. One claim in the research was outright refuted and is presented only in corrected form (see Section 3.1, Free Law Project citator row).

---

## 1. Executive Summary

The verification stack can be substantially rebuilt for **roughly $500–$1,900/yr in required spend** (plus small usage-based API costs), far inside the $1k–$15k appetite — but one recommendation is a *stop*, not a *buy*, and it is the most important one.

**Recommendation 1 — Fix citation verification by switching endpoints (cost: ~$100–$250/yr).** Replace the CourtListener `/search/` call with CourtListener's purpose-built **Citation Lookup & Verification API** (`POST /api/rest/v4/citation-lookup/`), plus a paid Free Law Project membership for higher rate limits. This is a small code change that eliminates the fuzzy-search "ambiguous" verdicts, and CourtListener's absorption of the Harvard Caselaw Access Project (CA Supreme Court from 1850, Courts of Appeal from 1905) largely closes the older-California-opinion gap. Sources: [citation-lookup docs](https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup), [May 2026 API-in-membership announcement](https://free.law/2026/05/07/api-included-in-memberships/), [coverage page](https://www.courtlistener.com/help/coverage/opinions/).

**Recommendation 2 — Retire the CEB RAG; do not refresh it (cost: $0; removes legal risk).** CEB's Terms & Conditions now *verbatim* prohibit ingesting CEB content "into … databases, file storage, artificial intelligence applications, or large language models" ([ceb.com/terms-and-conditions](https://ceb.com/terms-and-conditions/)). The 77,406-embedding CEB index is not merely stale — it is a contract violation that no re-scrape cadence can cure, and *Thomson Reuters v. Ross* (D. Del., Feb 11, 2025) makes the copyright exposure concrete. Keep CEB as a live, human-in-browser lookup (which is continuously updated and includes the TrueCite citator); replace embedded secondary content with licensed and public-domain sources (Recommendation 3).

**Recommendation 3 — Rebuild the statutes/secondary substrate on free, license-clean sources (cost: ~$140–$540/yr).** (a) Replace leginfo HTML scraping with the official **leginfo bulk database** — daily diff ZIPs, public domain under Gov. Code §10248.5, which natively provides the change-detection the stack lacks ([downloads.leginfo.legislature.ca.gov](https://downloads.leginfo.legislature.ca.gov/)). (b) Add California Rules of Court, CACI 2026, and Judicial Council forms via official PDF downloads (free, predictable Jan-1 cadence). (c) Standardize bill verification on **LegiScan's free API** (30,000 queries/month). (d) Join the **California Lawyers Association** (from $140/yr) to get vLex Fastcase Premium (stated $995/yr value) including the Cert citator in-browser and current CLA section publications.

**Recommendation 4 — Add a California citability rules layer (cost: $0; mandatory).** The current verifier will happily "verify" a *real but uncitable* opinion. Under CRC 8.1115(a), unpublished/depublished Court of Appeal opinions must not be cited; violations have drawn monetary sanctions with State Bar referral ([rule text](https://courts.ca.gov/cms/rules/index/eight/rule8_1115)). A rules-engine layer that checks publication/depublication/review-granted status converts the verifier from an existence checker into a citability checker. This is the highest-priority California-specific fix.

**Recommendation 5 — Treat the "still good law" citator gap as open; fail closed (cost: $0 now; up to ~$1k/yr conditional).** No in-budget, production-safe automated citator exists as of July 2026. KeyCite/Shepard's are enterprise-gated; the Free Law Project's free citator is pre-production; Midpage's AI citator is promising but its API is sales-gated with no published price, its consumer ToS likely prohibits embedding outputs in the firm's own chatbot, and its accuracy is unaudited for California. Interim design: unverifiable-treatment citations are flagged "existence verified; good-law status NOT checked — confirm in Cert/CEB TrueCite," using the vLex Cert citator the firm gets free through CLA as the human backstop. In parallel: open a vLex Labs conversation about programmatic Cert access, and get a written Midpage developer quote + license terms before any build.

**Expected total annual cost (required items): ~$490–$1,890.** Optional additions (Trellis trial-court data ~$1,100–$2,000/yr; Midpage, quote pending) stay well within budget. Details in Section 7.

---

## 2. Current Stack Assessment

What is actually weak, in order of severity:

1. **CEB RAG is both stale and non-compliant.** The 77,406 embeddings were snapshotted ~November 2025 and are ~8 months stale; lawyers already notice. More seriously, CEB's ToS expressly forbids this ingestion pattern (verbatim quote in Section 5), caps "reasonable use" at 500 page views/100 printed pages per day, and grants only a revocable license. Staleness is a symptom; the license is the disease.
2. **No good-law signal anywhere.** Nothing in the stack answers "has this case been overruled, depublished, or accepted for review?" An existence-verified citation can still be sanctionable to cite.
3. **Wrong CourtListener endpoint.** `citation_verify` uses the generic `/search/` endpoint. CourtListener ships a dedicated citation-lookup API that parses text with eyecite and returns deterministic per-citation status codes (200 found / 404 valid-but-absent / 400 bad reporter / 300 multiple matches / 429 throttled), 250 citations and 64,000 characters per request, 60 valid citations/minute ([docs](https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup)). The current "ambiguous" verdicts are largely an artifact of using fuzzy search plus default rate limits (authenticated non-member limits are ~5/min, 50/hr, 125/day).
4. **No quote/pincite/holding-support verification.** The Stanford "Hallucination-Free?" study (JELS 2025) shows the dangerous failure mode is *misgrounded* citations — a real case cited for a proposition it does not support — which existence checks completely miss; even Lexis+ AI hallucinated ~17% and Westlaw AI-Assisted Research ~34% of the time ([Stanford HAI summary](https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries)). The Princeton benchmark (arXiv [2606.21155](https://arxiv.org/html/2606.21155), June 2026) found even a GPT-5 agent with database search reached only 82.6% recall on verbatim misquotes, 84.0% on content misrepresentation, and a strikingly low 18.2% on incorrect pincites.
5. **Statute verification is brittle and incomplete.** HTML scraping of leginfo works but has no change-detection, and the stack covers none of: California Code of Regulations, Rules of Court, local court rules, CACI, or Judicial Council forms.
6. **No California citability logic.** No check for CRC 8.1115 unpublished/depublished status or review-granted status.

---

## 3. Comparison Matrices

Legend: entries marked * failed adversarial verification or returned "unclear" — the note in the cell states exactly what is and is not verified. "Cost" figures are annual unless noted.

### 3.1 Case-law verification (existence + citator)

| Option | CA coverage | Freshness | API | Realistic cost | ToS for AI use | Integration effort | Verdict |
|---|---|---|---|---|---|---|---|
| **CourtListener Citation Lookup API** ([docs](https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup)) | Strong: CA Supreme Ct from 1850, Cts of Appeal from 1905, Superior from 1963, via CAP + vLex partnership ([coverage](https://www.courtlistener.com/help/coverage/opinions/)) | Continuous; ~18.1M citations | Yes — dedicated endpoint; 250 cites/req, 60 valid/min; token auth. Note: throttle JSON key is `wait_util`, not `wait_until` | Free tier; membership $100–$1,000/yr for higher limits ([announcement](https://free.law/2026/05/07/api-included-in-memberships/)) | Explicitly built as an anti-hallucination guardrail; membership scope is "personal, educational, research, journalistic, exploratory" — confirm the firm's internal-tool use bucket | Low — swap one endpoint | **Adopt now.** Existence only; no treatment signal |
| **CourtListener MCP connector** ([launch post](https://free.law/2026/05/12/courtlistener-is-now-available-inside-claude/)) | Same corpus | Live since May 12, 2026 | MCP; citation-verification tool included. *Auth described as account-linked; "OAuth" specifically not stated in the announcement | Free with account | Built for Claude/agents | Medium (differs from current server-side REST pattern) | Optional alternative path if the verifier becomes a Claude agent |
| **vLex/Fastcase Cert (via CLA benefit)** ([CLA page](https://calawyers.org/vlex-fastcase/), [Cert docs](https://support.vlex.com/document-types/case-law/cert-tm)) | Strongest affordable CA depth — Cert grew out of Judicata tech that worked well *only* for California ([LawSites](https://www.lawnext.com/2024/07/new-citators-from-vlex-and-paxton-underscore-that-they-are-the-holy-grail-for-legal-research-companies.html)) | Editorially maintained (AI + human review of 700k+ references) | **No self-serve citator API.** vLex developer portal lists only an Anonymisation API live; citations/Vincent "coming soon" ([developer.vlex.com](https://developer.vlex.com/)) | $0 incremental in-browser (inside CLA membership, from $140/yr) | Bar-benefit browser license; *no API rights granted — do not automate against the CLA login | Low for humans; API path requires a vLex Labs negotiation | **Use in-browser now as the human good-law backstop; pursue API talk** |
| **Westlaw / KeyCite / CoCounsel** ([KeyCite](https://legal.thomsonreuters.com/en/products/westlaw/keycite)) | Deepest CA citator coverage | Best-in-class | No small-firm KeyCite API; May 2026 Claude–CoCounsel MCP is workflow-level, not a data API ([press release](https://www.thomsonreuters.com/en/press-releases/2026/may/thomson-reuters-and-anthropic-expand-partnership-to-connect-claude-with-cocounsel-legal)). *Next-gen CoCounsel GA stated as "this summer"; the previously reported "August 2026" month is unverified | ~$1,594/yr single-state Classic (reported reseller figure) for browser use; API enterprise-only | ToS restricts automated access/scraping | Blocked for automation | Poor fit for the pipeline; possible manual subscription only |
| **LexisNexis Shepard's / Protégé API** ([API page](https://www.lexisnexis.com/en-us/products/lexis-api.page)) | Deep CA coverage | Best-in-class | *Protégé API confirmed (request-gated, enterprise) with Ask/Summarize capabilities; the specific "Shepard's Citations via Protégé API" listing could NOT be independently confirmed on the fetched page | Quote-based; seat prices reported (third-party) $128–$494/user/mo | Programmatic use contemplated under an approved license only | High, sales-gated | One exploratory call at most; likely out of appetite |
| **Bloomberg BCite** | Adequate CA, in-platform only | Continuous | No BCite API (only an enterprise dockets API) | Flat platform subscription; no citator API price exists | Enterprise licensing required for automation | Blocked | Rule out for the pipeline |
| **Casetext SmartCite/Parallel Search** | Moot | — | None — standalone products retired post-TR acquisition ($650M, Aug 2023; [TR press release](https://www.thomsonreuters.com/en/press-releases/2023/august/thomson-reuters-completes-acquisition-of-casetext-inc)) | — | — | — | Not available; do not plan around it |
| **Free Law Project open-source citator** ([progress report](https://free.law/2025/05/01/citator/)) | Pre-production; no CA-specific coverage yet | In development | None yet | Expected free | Aligned with AI use | — today | **Watch, do not depend on.** CORRECTION: the earlier-reported "pilots launch September 2026 / cohort June 1, 2026" timeline was REFUTED — it belongs to FLP's separate Litigant Portal project. Verified status: early proof-of-concept, no production date |
| **Midpage** (see gap-research deep dive) | National 10M+ (marketed 13.8M) opinions, largely CourtListener-derived; *no documented pre-1950 CA official-reports depth, no documented depublication/review-granted tracking ([midpage.ai/data](https://www.midpage.ai/data)) | Best-in-class: replica <10s lag, API within ~5 hrs | REST + MCP + SQL replica exist ([MCP docs](https://midpage-docs.apidocumentation.com/documentation/integration/mcp-tools)) — but the developer tier is **sales-gated, no published price**; the $30/$80/mo self-serve plans do NOT include pipeline API access ([pricing](https://www.midpage.ai/pricing)) | Interactive: $360–$960/yr. Pipeline: unknown, quote required | **Red flag:** consumer ToS clause D.2.v bars offering "any service based on the Output or Service" ([T&C](https://www.midpage.ai/terms-and-conditions)); embedding citator signals in the firm's chatbot plausibly violates it absent a developer license | Low via MCP interactively; pipeline blocked on sales + license | **Conditionally viable only.** Citator accuracy is founder-self-reported at 86–89% vs incumbents' ~90% (unverified); the promised Vanderbilt VAILL independent audit has no published results as of July 2026; Vals AI scored Midpage 78% on research Q&A (not the citator) ([Vals report](https://www.vals.ai/industry-reports/vlair-10-14-25)). Seed-stage vendor (~$6.2M raised) = single-point-of-failure risk |

### 3.2 Statutes, regulations, court rules, bills, trial courts

| Option | CA coverage | Freshness | API | Realistic cost | ToS for AI use | Integration effort | Verdict |
|---|---|---|---|---|---|---|---|
| **leginfo bulk database** ([downloads dir](https://downloads.leginfo.legislature.ca.gov/)) | Complete — all 29 codes, Constitution, bills | Verified daily: pubinfo_daily ZIPs dated the day checked | No REST API; public bulk directory with documented relational schema | Free | Public domain (Gov. Code §10248.5) — cleanest possible | Medium: nightly pull + diff job | **Adopt.** Replaces HTML scraping; gives change-detection natively |
| **CCR — official Westlaw/Barclays portal + Cornell LII mirror** ([OAL](https://oal.ca.gov/publications/ccr/)) | Full CCR (official); LII per-section pages | Official updated weekly | **No official API or bulk download exists** | Free to read | Westlaw portal ToS restricts scraping; LII more permissive but *confirm before bulk ingestion | Medium-high — messiest area | Add via LII weekly ingestion (ToS-checked); link the official portal for humans |
| **CA Rules of Court + CACI + Judicial Council forms** ([rules](https://courts.ca.gov/forms-rules/rules-court), [CACI 2026 PDF](https://courts.ca.gov/system/files/file/judicial_council_of_california_civil_jury_instructions_2026.pdf)) | Complete statewide; CACI 2026 edition (adopted Dec 2025) posted | Predictable: rules amendments effective Jan 1; CACI annual + mid-year supplement | No API — official PDFs | Free | **Caution:** courts.ca.gov ToS permits download "only for your personal, non-commercial use" and bans data mining/bots ([ToS](https://courts.ca.gov/11529.htm)) — acquire via manual/official bulk PDF download, not crawling | Low (a handful of stable PDFs, annual refresh) | **Adopt via official downloads, not scraping** |
| **LegiScan** ([legiscan.com](https://legiscan.com/legiscan)) | Full CA 2025–26 session | Near-real-time API; weekly bulk datasets | Yes — free public API, 30,000 queries/mo | Free (paid tiers exist, unneeded) | Public-domain underlying data; free-tier terms explicit | Low — swap of existing calls | **Adopt as primary bill source** |
| **OpenStates / Plural (incumbent)** ([docs](https://docs.openstates.org/api-v3/)) | Full CA | Adequate | Yes, key required | Free for non-commercial; **no published commercial tier** — commercial access is still being "explored," demo-gated ([Plural blog](https://blog.openstates.org/2023-june-changes/)) | Undefined commercial stance = mild ToS risk for a for-profit firm | Zero (already integrated) | Demote to fallback |
| **Trellis** ([plans](https://support.trellis.law/what-are-the-different-tiers)) | Broadest CA superior-court/tentative-rulings coverage | Near-real-time (reported) | Yes — dockets, rulings, webhooks; confirm API entitlement at self-serve tier | $1,099.95/yr (Research) or $1,999.95/yr (+Judge Analytics); ~900 views/yr caps | Subscription ToS; internal use fine, redistribution restricted | Low-medium | Optional — only if trial-court signal is wanted |
| **UniCourt / Docket Alarm** | CA present, less CA-focused | Real-time (reported) | UniCourt API is Enterprise/sales-gated only (self-serve $59–$399/mo excludes API, [pricing](https://unicourt.com/pricing/)); Docket Alarm sales-gated, PACER-leaning | Likely over budget once API enabled | Restrictive commercial terms | Blocked on sales | Not recommended vs Trellis |

### 3.3 Secondary sources (practice guides)

| Option | CA coverage | Freshness | API | Realistic cost | ToS for AI use | Integration effort | Verdict |
|---|---|---|---|---|---|---|---|
| **CEB OnLAW Pro (incumbent)** ([product](https://ceb.com/products/onlaw-pro/)) | Best-in-class CA: 150+ titles across exactly the firm's practice areas | Continuously editor-updated + TrueCite citator | **None** — no API, no licensing/embedding program | Already paid | **Prohibited verbatim** for AI/LLM/database ingestion ([ToS](https://ceb.com/terms-and-conditions/)) | Low as human lookup | **Keep as live lookup; decommission the RAG** |
| **vLex Fastcase via CLA** ([CLA page](https://calawyers.org/vlex-fastcase/)) | Current CA section publications + 50-state law; lighter treatise depth than CEB/Rutter. *CLA page confirms section publications back to 2014 are on the platform, but the "18 sections / all of them" count is not verified | Live; actively published | Fastcase Legal Data API exists (contact-sales); *embedding rights unconfirmed — get in writing | From $140/yr (CLA base + one section) | Member browser use clearly licensed; API/AI rights must be negotiated | Low to start (human use); medium for API | **Strong buy** — best current-CA-content value |
| **Rutter Group / Practical Law (TR)** | Deepest paid CA practice content | Current 2026 editions | *Practical Law Data API exposes "only limited metadata" per TR's own API terms — and the API itself may have been discontinued (removed from TR's Legal API page in late 2023); current availability doubtful | Reported ~$600+/user/yr entry for Practical Law; Rutter negotiated | No compliant full-text embedding path; *TR v. Ross* is the controlling cautionary precedent ([Perkins Coie analysis](https://perkinscoie.com/insights/update/fair-use-defense-failed-thomson-reuters-v-ross-jury-still-out-generative-ai)) | Human-lookup only | Consider for research quality; not a RAG fix |
| **Lexis Practical Guidance / Matthew Bender** | Solid CA titles | Current | APIs surface Lexis's own AI outputs, not embeddable full text | Negotiated, opaque | Standard terms bar systematic copying | Human-lookup only | Lower priority than CLA/vLex |
| **Free official content (CACI, forms, self-help, Rules of Court)** | Authoritative statewide | Verified current | No API; official PDFs | Free | See courts.ca.gov ToS caution above | Low-medium | **Adopt selectively via official downloads** |

### 3.4 AI-native and general search APIs

| Option | CA coverage | Freshness | API | Realistic cost | ToS for AI use | Integration effort | Verdict |
|---|---|---|---|---|---|---|---|
| **Anthropic web_search / web_fetch** ([tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)) | Open web; restrictable via domain allow-lists to courtlistener.com, courts.ca.gov, leginfo | Real-time | Already native to the stack | $10/1k searches + tokens; web_fetch free beyond tokens | Permitted; Anthropic disclaims accuracy — supplementary only | Near zero | **Adopt as fallback layer** with an allow-list |
| **Exa** ([pricing](https://exa.ai/pricing)) | General web, domain filters | Live | Yes | Search $7/1k; free tier ~20k req/mo | Commercial OK; review full ToS | Low | Viable alternate general backend |
| **Parallel.ai** | General web | Live | Yes; Task API returns per-element citations + confidence | Search $5/1k; Task $3–$10/1k | Built for agents; *legal-specific terms unreviewed | Low-moderate | Interesting for structured secondary-claim checks |
| **Brave / Tavily** | General web | Live | Yes | $5/1k; $8/1k PAYG | Commercial OK | Low | Pick at most one general backend; don't stack |
| **descrybe.com** ([LawSites](https://www.lawnext.com/2026/05/descrybe-collaborates-with-anthropic-in-launch-of-claude-for-the-legal-industry.html)) | US incl. CA appellate; 3.6M+ summarized opinions; "Cytator" issue-level citator (June 2025) | Active; Claude legal engine launched May 12, 2026 | Via Claude connector/MCP; **no public developer REST API confirmed** | $20/mo commercial | Built for AI assistants; *detailed API terms unread | Unknown until API surface confirmed | Promising cheap complement — verify programmatic access first |
| **Isaacus (Kanon 2)** ([pricing](https://docs.isaacus.com/pricing/costs)) | None — no case-law corpus; operates on documents you supply | Active model line | Yes (embed/rerank/classify) | ~$0.35/M tokens | Commercial infrastructure by design | Moderate | Wrong tool for verification; only relevant as a reranker over *licensed* content |
| **SerpAPI / Serper (Google Scholar)** | Broad but scraped | Live | Yes, legally contested | Cheap, irrelevant | **Avoid:** Google sued SerpApi (filed Dec 19, 2025; MTD Feb 20, 2026, hearing May 19, 2026) over scraping ([SerpApi's own account](https://serpapi.com/blog/google-v-serpapi-motion-to-dismiss-why-were-in-the-right/)). *Note: the litigation concerns Google Search, not Scholar specifically, but Google's general ToS bars automated access and Scholar has no API | — | **Avoid** — needless legal exposure for a law firm |
| **Purpose-built cite-checkers (CiteSentinel, LawDroid CiteCheck, Clearbrief, etc.)** | Inherit from CourtListener/Justia/GovInfo | New 2025–26 | No confirmed public APIs — document-scanning apps | ~$20/document-class pricing | Attorney tools | Blocked as backend | Not a backend; validates that CourtListener is the right substrate |

---

## 4. Recommended Target Architecture

A four-layer, fail-closed pipeline. "Fail closed" means an unverifiable citation is *flagged and routed to a human*, never silently passed — consistent with the Vals AI benchmark's praise of refusal-over-hallucination behavior (Accuracy 50% / Authoritativeness 40% / Appropriateness 10% weighting; [LawNext coverage](https://www.lawnext.com/2025/10/vals-ais-latest-benchmark-finds-legal-and-general-ai-now-outperform-lawyers-in-legal-research-accuracy.html)).

**Layer 1 — Deterministic extraction: eyecite (free).** BSD-2-licensed, production-stable (v2.7.8, released 2026-07-01), the same engine inside CourtListener and CAP, tested against 50M+ citations ([GitHub](https://github.com/freelawproject/eyecite), [PyPI](https://pypi.org/project/eyecite/)). Runs in a small serverless Python function (or the Node port for TS-native). Replaces ad-hoc parsing; deduplicates and batches citations to stay under the 250-per-request lookup limit.

**Layer 2 — Existence quorum: CourtListener Citation Lookup API (primary) + Anthropic web_search (fallback).** Map status codes directly to verdicts: 200 = exists; 404 = valid format but not found (flag); 300 = disambiguate; 400 = malformed. On 404/300, fall back to a domain-allow-listed `web_search`/`web_fetch` pass pinned to courtlistener.com, courts.ca.gov, and leginfo.legislature.ca.gov, then to a manual queue. Do not automate Google Scholar, the LexisNexis-hosted California Official Reports site (its terms prohibit robotic/systematic access — [LexisNexis terms §1.2](https://www.lexisnexis.com/en-us/terms/general/default.page)), or SerpAPI-class scrapers.

**Layer 3 — California citability rules engine (mandatory, free).** After existence: (a) is it a Cal.App./appellate-division opinion? (b) published/certified? (c) review granted? (d) depublished? Verdicts: "citable," "persuasive-only (review granted)," or "REAL BUT UNCITABLE — CRC 8.1115." Status data: CourtListener opinion metadata plus the official courts.ca.gov published (120-day) and unpublished/non-citable (60-day) listings as the authoritative human cross-check ([slip opinions page](https://www.courts.ca.gov/opinions-slip.htm)). Engineering caveat (unverified, from an internal code inspection note): CourtListener's `precedential_status` field may not carry distinct depublished/review-granted values, and post-2020 CA opinions may return empty parallel-citation arrays — validate this during the build and lean on the official lists where CL metadata is silent.

**Layer 4 — Good-law + holding-support (phased, fail-closed today).**
- *Now:* every response carries an explicit banner on case citations: "Existence verified; treatment (good-law) status not machine-checked." Attorneys confirm treatment in **Cert** (free via CLA) or **CEB TrueCite** (already paid). This is honest and defensible; a silent gap is neither.
- *Holding-support (build this quarter):* retrieve the matched opinion text from CourtListener (returned in the lookup response's cluster objects) and run a quote/pincite/entailment check with the existing Claude verifier — "does this passage actually support the generated proposition?" This attacks the *misgrounded* failure mode the Stanford study identified as most dangerous, at token-cost only.
- *Conditional vendor:* Midpage's developer API is the only affordable candidate for automated treatment signals, but only if three gates pass: (1) a written quote within budget; (2) a developer license that explicitly permits pipeline use, in-product display, and caching (the public consumer ToS likely forbids this); (3) an independent California spot-check — run 30–50 known-overruled/depublished California cases against its citator vs Cert/KeyCite before trusting it. Architect it behind an abstraction layer so it is one swappable input, never the foundation.
- *Watch:* Free Law Project's open-source citator (pre-production, no committed date — the previously circulated September 2026 pilot timeline was a misattribution) and vLex's "coming soon" citations API.

**Weakness → fix map:**

| Current weakness | Fix | Layer |
|---|---|---|
| /search/ misuse, rate-limit "ambiguous" verdicts | Citation Lookup API + FLP membership | 2 |
| Older CA opinions missing | CAP-backed CourtListener corpus (CA Supreme 1850+) | 2 |
| No good-law signal | Fail-closed flag + human Cert/TrueCite; conditional Midpage; watch FLP/vLex | 4 |
| No quote/pincite/support check | Opinion-text entailment check via Claude verifier | 4 |
| Real-but-uncitable opinions pass | CRC 8.1115 rules engine | 3 |
| CEB RAG stale + non-compliant | Retire; CLA/vLex + free official content + live CEB lookup | — (Section 5) |
| No statute change-detection | leginfo bulk daily-diff pipeline | statutes |
| No CCR / Rules of Court / CACI | LII weekly (ToS-checked) + official PDF ingestion | statutes |
| Bill-source commercial ambiguity | LegiScan free API primary; OpenStates fallback | statutes |

---

## 5. CEB Staleness: Retire, Don't Refresh

The instinct is to re-scrape the PDFs on a cadence. The research says the correct move is to decommission the embedding entirely:

1. **The license prohibits it, verbatim:** "Users may not ingest, download, copy, or store CEB materials of any type or form (content and/or product) into their own systems and/or electronic storage devices, including databases, file storage, artificial intelligence applications, or large language models" ([CEB Terms & Conditions](https://ceb.com/terms-and-conditions/)). Reasonable use is capped at 500 page views/100 printed pages per day; the license is non-exclusive, non-transferable, and revocable. No refresh cadence cures a categorical prohibition. (The conclusion that the current RAG violates the terms is our legal-adjacent inference from that text; the quoted language itself is verified verbatim.)
2. **The copyright exposure is concrete:** *Thomson Reuters v. Ross Intelligence* (D. Del., Feb 11, 2025, Judge Bibas) rejected fair use for building a legal tool from licensed publisher content — 2,243 of 2,830 headnotes held infringing, market harm decisive ([analysis](https://perkinscoie.com/insights/update/fair-use-defense-failed-thomson-reuters-v-ross-jury-still-out-generative-ai)). A law firm that markets a compliance-forward AI tool should not be the test case.
3. **No licensed path exists:** CEB has no API, developer program, or content-licensing/embedding offering.
4. **The replacement is better anyway.** The live OnLAW Pro product is continuously editor-updated with the TrueCite citator ([product page](https://ceb.com/products/onlaw-pro/)) — the staleness the lawyers complain about is an artifact of snapshotting, not of CEB. Keep CEB as the authoritative human lookup. For machine-usable secondary content: CLA/vLex section publications (licensed, current, CA-specific, from $140/yr — pending written confirmation of API/embedding rights before any programmatic ingestion), plus license-clean official content (CACI 2026, Judicial Council forms, Rules of Court) acquired via official downloads, not crawlers (the courts.ca.gov ToS bans bots/data-mining and limits downloads to personal, non-commercial use — [ToS](https://courts.ca.gov/11529.htm) — so acquire manually/via published bulk PDFs and note the "non-commercial" wording for the partners' judgment).

Product change: the "CEB Verified" amber badge and the ceb-only mode should be reworked — CEB-derived answers can no longer come from a local index. Either link out to OnLAW for the attorney to pull the passage, or re-point the RAG at the licensed CLA/vLex and official corpora.

---

## 6. Phased Migration Plan

**This week (quick wins, ~2–4 engineering days total):**
1. Swap `citation_verify` from `/search/` to `POST /api/rest/v4/citation-lookup/`; map status codes to verdicts. (~1 day)
2. Buy an FLP membership ($100–$250/yr tier) to lift rate limits. (~minutes)
3. Add domain allow-lists to the existing Anthropic web_search verification calls (courtlistener.com, courts.ca.gov, leginfo.legislature.ca.gov). (~half day)
4. Freeze all writes/refreshes to the CEB embedding index and add the "treatment not machine-checked" disclaimer to case-citation output. (~half day)
5. Join CLA; give both attorneys vLex Fastcase Premium logins for Cert checks. (~minutes)

**This month (~2–3 engineering weeks):**
1. Build the CRC 8.1115 citability layer (publication/depublication/review-granted logic + courts.ca.gov cross-check links). (~1 week, including validating CourtListener metadata behavior)
2. Replace leginfo scraping with the bulk-DB pipeline: baseline load (~1 GB), nightly daily-ZIP diff, change-detection alerts. (~1 week)
3. Migrate bill verification to LegiScan free API; keep OpenStates as fallback. (~1–2 days)
4. Add eyecite as the extraction layer (small Python serverless function). (~1–2 days)
5. Ingest Rules of Court + CACI 2026 + key Judicial Council forms via official PDFs; schedule Jan-1/mid-year refreshes. (~2–3 days)
6. Decommission the CEB index; rework the CEB badge/mode UX. (~2–3 days)

**This quarter (~3–5 engineering weeks + vendor conversations):**
1. Build the holding-support/pincite check: pull matched opinion text, run entailment/quote verification in the Claude verifier. (~2 weeks)
2. CCR ingestion via Cornell LII with weekly refresh, after a ToS check. (~1–2 weeks)
3. Vendor diligence, in parallel: written Midpage developer quote + license terms + 30–50-case California citator spot-check; vLex Labs conversation about programmatic Cert; confirm CLA/vLex API embedding rights in writing. (partner + a few engineer-days)
4. Optional: Trellis subscription if the partners want tentative-rulings/local-rules signal. (~2–3 days integration)

---

## 7. Annual Cost Table

| Provider | Purpose | Annual cost | Confidence |
|---|---|---|---|
| Free Law Project membership | Citation-lookup rate limits | $100–$250 (tiers to $1,000) | High — published tiers |
| CLA membership (base + 1 section) | vLex Fastcase Premium incl. Cert; section publications | ~$140 (add sections $99 each) | High — published; "$995/yr value" is CLA's stated figure |
| leginfo bulk DB | Statutes + change-detection | $0 | High — public domain |
| LegiScan free API | Bills | $0 | High — published 30k/mo cap |
| CACI / Rules of Court / forms | Rules content | $0 | High |
| eyecite | Citation parsing | $0 (BSD) | High |
| Anthropic web_search | Fallback verification | ~$10–$120 usage-based ($10/1k searches) | High on rate; usage estimate ours |
| CEB (existing subscription) | Live human lookup + TrueCite | Already paid; no increment | High |
| **Required subtotal** | | **~$490–$1,890** (incl. optional extra CLA sections and FLP tier headroom) | |
| Trellis (optional) | CA trial-court/tentative rulings | $1,099.95 or $1,999.95 | High — published |
| Midpage self-serve (optional, interactive only) | Attorney-facing citator second opinion | $360–$960 | High on price; does NOT license pipeline use |
| Midpage developer API (conditional) | Automated treatment signal | Unknown — quote-only | **Low** — no published price; top open diligence item |
| descrybe commercial (optional) | Cheap citator complement | $240 | Medium — price published; programmatic access unconfirmed |
| Westlaw single-state (not recommended) | Manual KeyCite | ~$1,594 (reported reseller figure) | Low-medium — conflicting reseller prices |

Worst realistic case with every optional item: still under ~$6,000/yr.

---

## 8. What We Did Not Verify / Open Questions for the Partners

1. **Midpage developer pricing and license scope.** No published price; the consumer ToS likely prohibits embedding outputs in the chatbot. Needed in writing before any build: quote, pipeline/in-product/caching rights. Also unverified: its citator accuracy for California (founder self-claim of 86–89%; the announced Vanderbilt VAILL audit has no published results as of July 2026), and its handling of depublication/review-granted status.
2. **vLex Cert programmatic access.** The CLA benefit grants no API rights; the vLex developer portal shows the citations API as "coming soon." Whether vLex Labs will license Cert treatment flags to a 2-attorney firm, and at what price, is unknown.
3. **CLA/vLex embedding rights.** Whether the Fastcase Legal Data API license permits internal RAG/embedding of CLA section content is unconfirmed — do not embed until confirmed in writing. The "18 section publications, all hosted" count also was not verified (the CLA page confirms section publications back to 2014 are on the platform, without the count).
4. **CourtListener commercial-use bucket.** Membership API access is scoped to "personal, educational, research, journalistic, and exploratory" use, with heavier/commercial use via separate agreement. Whether an internal 2-attorney verification tool needs a commercial agreement should be confirmed with FLP (likely a friendly conversation with a nonprofit).
5. **CourtListener metadata gaps for the citability layer.** The claims that `precedential_status` lacks depublished/review-granted values and that post-2020 CA opinions return empty citation arrays came from an unadversarially-verified internal inspection — validate during the Layer-3 build.
6. **Lexis Protégé API / Shepard's.** Whether Shepard's is actually exposed through the Protégé API could not be confirmed from the fetched page. Worth exactly one exploratory sales call, no more.
7. **Cornell LII terms for CCR bulk ingestion**, and the exact lag of LII behind OAL's weekly official updates.
8. **courts.ca.gov "personal, non-commercial" download language** as applied to a firm's internal tool ingesting official PDFs — a judgment call for the attorneys, not the engineers.
9. **Timing details we could not pin down:** TR's next-gen CoCounsel GA ("this summer" per the press release; "August 2026" unverified) and the exact mechanism (OAuth vs other) of the CourtListener MCP account link.
10. **Reported-not-primary pricing:** Westlaw/Lexis seat prices are reseller/third-party figures with conflicts across sources; treat as indicative only.

---

*Every load-bearing claim above carries its source inline. Claims marked * returned "unclear" in adversarial verification; the one refuted claim (the FLP citator's "September 2026 pilot" timeline, which actually belongs to FLP's separate Litigant Portal initiative) appears only in corrected form.*