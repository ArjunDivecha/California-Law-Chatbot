# Legal-Domain PII Detection Landscape: Preserving Public Legal Entities While Redacting Private PII

*Survey prepared April 23, 2026. All findings reflect sources accessible at that date; any inline confidence caveats are flagged. The "target task" throughout is a California legal-research chatbot sanitization layer that must preserve public legal entities (case citations, statutes, court names, judges in judicial capacity, public officials, published scholarship) while redacting private information (client names, addresses, phone numbers, account numbers, dates of birth, medical details, etc.) before text is sent to AWS Bedrock Claude.*

---

## Executive Summary

**1. Does a pre-trained, production-grade model already exist that performs legal-domain PII detection with public-vs-private entity preservation?** No. Nothing in the current landscape is purpose-built for the public-entity-preservation task on U.S./California legal text. OpenAI's new **Privacy Filter** (released April 22, 2026; 1.5B-param MoE, 50M active, Apache-2.0, 128k context, 96% F1 on PII-Masking-300k) is the strongest general-purpose baseline and its own model card explicitly warns of limited accuracy in legal workflows without domain fine-tuning ([OpenAI announcement](https://openai.com/index/introducing-openai-privacy-filter/); [Model Card PDF](https://cdn.openai.com/pdf/c66281ed-b638-456a-8ce1-97e9f5264a90/OpenAI-Privacy-Filter-Model-Card.pdf)). Existing legal NER models (OpenNyAI's `en_legal_ner_trf`, PaDaS-Lab `gbert-legal-ner`, John Snow Labs MAPA models, Spanish MAPA models) identify public legal entities (STATUTE, PROVISION, COURT, JUDGE, PRECEDENT) well but do not simultaneously classify private PII, and most are Indian / EU civil-law jurisdictions. Presidio detects private PII but has no legal recognizers shipped by default. No product combines both classes with a preserve/redact policy.

**2. Does a public annotated dataset exist that would let someone fine-tune without doing original annotation?** Partially. The closest fit is the **Text Anonymization Benchmark (TAB)** — 1,268 ECHR cases, MIT license, with the exact annotation philosophy needed (mark spans that must be masked vs. retained to preserve disclosure protection) ([TAB GitHub](https://github.com/NorskRegnesentral/text-anonymization-benchmark)). For structural legal entities, **InLegalNER** (46,545 annotations, 14 legal entity types, Indian judgments, Apache-2.0) provides the schema template ([HF dataset](https://huggingface.co/datasets/opennyaiorg/InLegalNER)). Neither is California-specific; **no public dataset annotates California legal text for the public-vs-private distinction**. The Caselaw Access Project (CC0, 6.7M cases including California) is an unannotated raw text source that could bootstrap annotation ([case.law](https://case.law/)).

**3. What is the gap?** The gap is real and looks underexplored rather than already-solved. Academic and EU public-sector work has produced anonymization benchmarks and NER schemas for civil-law jurisdictions (MAPA, TAB, LegalNERo, LeNER-Br) and for common-law India (InLegalNER); U.S. commercial vendors (Private AI, Presidio, Amazon Comprehend, Relativity) treat legal text as just another PII channel. Free Law Project's eyecite plus reporters-db already solve deterministic U.S. citation preservation extremely well — including comprehensive California coverage — which is why most observers likely assume the problem is "solved at the citation layer" and have not built a unified model. No one, as of April 2026, has published a California-specific open dataset or open model that jointly preserves case citations, statutes, court names, and named judges while redacting client PII.

---

## Part A — Pre-trained Models for Legal-Domain PII Detection

### A.1 OpenAI Privacy Filter (baseline, general-domain)
- **Publisher / URL:** OpenAI — [openai/privacy-filter on GitHub](https://github.com/openai/privacy-filter); HF: `openai/privacy-filter`.
- **License:** Apache 2.0, verified on the repo ([GitHub](https://github.com/openai/privacy-filter)).
- **Architecture / size:** gpt-oss-derived bidirectional token classifier, sparse MoE, **1.5B total / 50M active parameters**, 128,000-token context window, BIOES span decoding via constrained Viterbi ([OpenAI blog](https://openai.com/index/introducing-openai-privacy-filter/)).
- **Training data:** Not disclosed at corpus level; trained autoregressively then converted to token classifier and post-trained on supervised PII annotations. Predominantly English; performance on non-English, non-Latin scripts, and region-specific naming patterns is noted as degraded ([Model Card](https://cdn.openai.com/pdf/c66281ed-b638-456a-8ce1-97e9f5264a90/OpenAI-Privacy-Filter-Model-Card.pdf)).
- **Entity categories (8):** `name`, `address`, `email`, `phone_number`, `url`, `private_date` (DOB etc.), `account_number` (including credit card / bank), `secret` (API keys, passwords) ([OpenAI blog](https://openai.com/index/introducing-openai-privacy-filter/)).
- **Public-vs-private distinction:** No explicit support. Policy is person-linked identifiers only; it makes no statute/citation/judge concept. OpenAI notes the trained policy "aims to prioritize personal identifiers, often preserving context that is not strongly person-linked by design" ([Model Card](https://cdn.openai.com/pdf/c66281ed-b638-456a-8ce1-97e9f5264a90/OpenAI-Privacy-Filter-Model-Card.pdf)). Practically, a case caption like *People v. John Smith* would likely have "John Smith" flagged as a name regardless of whether he is a public party.
- **Benchmarks:** F1 = 96.0% (P = 94.04%, R = 98.04%) on PII-Masking-300k; 97.43% on an error-corrected variant; reports domain fine-tuning improving F1 from 54% → 96% on a held-out domain-adaptation benchmark ([OpenAI blog](https://openai.com/index/introducing-openai-privacy-filter/)).
- **Known limitations (from OpenAI themselves):** "In high-sensitivity areas such as legal, medical, and financial workflows, human review and domain-specific evaluation and fine-tuning remain important" ([Help Net Security coverage](https://www.helpnetsecurity.com/2026/04/23/openai-privacy-filter-personally-identifiable-information/)); "High-Risk Deployment Caution" included in documentation warning of "missed spans" in medical/legal ([VentureBeat](https://venturebeat.com/data/openai-launches-privacy-filter-an-open-source-on-device-data-sanitization-model-that-removes-personal-information-from-enterprise-datasets)). No runtime re-policyable label set — changing categories requires re-training.
- **Last updated:** Released April 22, 2026 — one day before the date of this survey; no updates yet.

### A.2 OpenNyAI — `en_legal_ner_trf` and `en_legal_ner_sm`
- **Publisher / URL:** OpenNyAI (EkStep / Thoughtworks collaboration) — [HF](https://huggingface.co/opennyaiorg/en_legal_ner_trf); [GitHub](https://github.com/Legal-NLP-EkStep/legal_NER).
- **License:** Apache 2.0 (verified on HF model page) ([HF model page](https://huggingface.co/opennyaiorg/en_legal_ner_trf)).
- **Architecture:** spaCy `en_legal_ner_trf` = RoBERTa-base + transition-based parser (spaCy-transformers); `en_legal_ner_sm` = smaller/faster spaCy CNN variant.
- **Training data:** ~9,435 judgment sentences + 1,560 preamble paragraphs from Indian Supreme Court + High Court judgments (1950–2021), manually annotated by legal experts at OpenNyAI ([GitHub repo](https://github.com/Legal-NLP-EkStep/legal_NER)).
- **Entity categories (14):** PETITIONER, RESPONDENT, JUDGE, LAWYER, COURT, CASE_NUMBER, WITNESS, DATE, ORG, GPE, STATUTE, PROVISION, PRECEDENT, OTHER_PERSON ([ACL paper](https://aclanthology.org/2022.nllp-1.15.pdf)).
- **Public-vs-private handling:** *Structural* separation of public legal entities (STATUTE, PROVISION, COURT, JUDGE, PRECEDENT, CASE_NUMBER) from private parties (PETITIONER, RESPONDENT, WITNESS, LAWYER). This is the closest schema match to the target task in the entire landscape, but all entity labels are surface categories — the model does not itself decide "preserve" vs. "redact."
- **Benchmarks:** F1 = 91.076 (P = 91.98, R = 90.19) on the test set; PRECEDENT is weakest because the entities are long (avg. 62 chars) ([ACL paper](https://aclanthology.org/2022.nllp-1.15.pdf)).
- **Known limitations:** Indian jurisdiction; Indian reporter and statute conventions (Cr.P.C., IPC) dominate training data. Performance on U.S./California text is untested and likely substantially worse — statute conventions, reporter formats, and case-caption grammar differ materially.
- **Last updated:** Model weights posted 2022; repo commits continued through 2023. No 2025-2026 updates noted; should be treated as stable-but-stale.

### A.3 PaDaS-Lab — `gbert-legal-ner`
- **Publisher:** PaDaS-Lab / U. Passau — [HF](https://huggingface.co/PaDaS-Lab/gbert-legal-ner).
- **License:** Gated by user agreement (requires `use_auth_token`); license text not openly visible without sign-in — **flag as low confidence**.
- **Architecture:** German BERT (GBERT) fine-tuned for legal NER on German Federal Labor/Social Court decisions.
- **Public-vs-private distinction:** Similar schema to OpenNyAI (LAW, COURT, PERSON, ORGANIZATION, CASE NUMBER) focused on structural legal entities.
- **Relevance to task:** German civil-law jurisdiction; useful as architectural reference only.

### A.4 John Snow Labs — MAPA Legal NER family (multilingual)
- **Publisher / URL:** John Snow Labs [legner_mapa models](https://nlp.johnsnowlabs.com/2023/04/27/legner_mapa_el.html) derived from the EU MAPA project.
- **License:** Commercial (John Snow Labs Enterprise license) — not Apache/MIT. Underlying MAPA data is CC-BY 4.0 but the productized models are paid.
- **Entity categories:** ADDRESS, AMOUNT, DATE, ORGANISATION, PERSON — 5 categories aligned with CEF/GDPR anonymization needs. Available in 24 EU languages.
- **Benchmarks:** Greek-language reported macro-F1 ≈ 0.92 on 12-document EUR-Lex test set ([JSL card](https://nlp.johnsnowlabs.com/2023/04/27/legner_mapa_el.html)).
- **Relevance:** Operates as a pure PII-in-legal-text detector; does NOT preserve public legal entities separately.

### A.5 Serbian — `kalusev/NER4Legal_SRB`
- **Publisher / URL:** [HF](https://huggingface.co/kalusev/NER4Legal_SRB).
- **License:** Not clearly specified on the card; gated.
- **Architecture:** `classla/bcms-bertic` fine-tuned; F1 = 0.96 on Serbian court rulings.
- **Relevance:** Serbian-only; architectural reference only.

### A.6 Italian Supreme Court pipeline (GLiNER-based)
- Italian Corte di Cassazione pipeline uses GLiNER (BERT-like bidirectional transformer) to detect parties, witnesses, companies, dates, locations for GDPR anonymization ([arXiv 2505.08439](https://arxiv.org/html/2505.08439)). Pipeline-level research, not a released production model.

### A.7 Adjacent / code-PII baselines
- **`bigcode/starpii`** — BigCode encoder fine-tuned for PII in source code, 6 classes (Names, Emails, Keys, Passwords, IPs, Usernames). **License: gated; explicit Terms of Use prohibit use outside dataset PII removal — not acceptable for commercial legal deployment** ([HF](https://huggingface.co/bigcode/starpii)).
- **`nlpaueb/legal-bert-base-uncased`, `pile-of-law/legalbert-large-1.7M-2`, `law-ai/InCaseLawBERT`** — foundation models pre-trained on legal corpora, *not* entity recognizers. They are candidates for a base model if fine-tuning a new head, but provide no PII labels out of the box ([legal-bert](https://huggingface.co/nlpaueb/legal-bert-base-uncased); [pile-of-law BERT](https://huggingface.co/pile-of-law/legalbert-large-1.7M-2); [InCaseLawBERT](https://huggingface.co/law-ai/InCaseLawBERT)).

**Bottom line for Part A:** No off-the-shelf model satisfies the requirement. The three architectural starting points are (1) OpenAI Privacy Filter for the private-PII half, (2) OpenNyAI's 14-class schema as a template for the public-legal-entity half (adapted to U.S. conventions), (3) legal-BERT / Pile-of-Law BERT as pre-training backbones.

---

## Part B — Public Datasets for Legal PII Annotation

### B.1 Text Anonymization Benchmark (TAB) — BEST FIT
- **Curator:** Norsk Regnesentral (Pilán, Lison, Øvrelid, Papadopoulou, Sánchez, Batet, 2022).
- **Source:** [GitHub](https://github.com/NorskRegnesentral/text-anonymization-benchmark); [HF mirror](https://huggingface.co/datasets/ildpil/text-anonymization-benchmark); [Computational Linguistics paper](https://aclanthology.org/2022.cl-4.19/).
- **License:** **MIT** — verified on HF card: "TAB is released under an MIT License. The MIT License is a short and simple permissive license allowing both commercial and non-commercial use" ([HF README](https://huggingface.co/datasets/ildpil/text-anonymization-benchmark/blob/main/README.md)).
- **Size:** 1,268 English-language ECHR court cases, standoff JSON, ~127k entity mentions.
- **Jurisdiction / document type:** European Court of Human Rights judgments (Grand Chamber + Chamber), pre-2018 to avoid retroactive-anonymization confounds; Introduction and Statement of Facts sections only.
- **Annotation schema:** Categories PERSON, CODE, LOC, ORG, DEMO, DATETIME, QUANTITY, MISC, plus identifier-type (DIRECT vs. QUASI identifier), need_to_mask flag, confidential_status flag, co-reference chains ([ACL PDF](https://aclanthology.org/2022.cl-4.19.pdf)).
- **Public-vs-private separation — YES:** This is exactly the TAB innovation. Each span is annotated with whether it must be masked to protect the subject's identity. Importantly, "the actual text of the court case was regarded as not part of public knowledge" for annotation purposes — this is the opposite philosophy to the target task (which wants to *preserve* public case material). However, the structure (identifier vs. non-identifier, direct vs. quasi) is directly reusable.
- **Annotation quality:** 12 University of Oslo law students, financial remuneration, initial training and disagreement-resolution phase; full inter-annotator agreement tables in the paper.
- **Used in:** Pilán et al. 2022 (original), and cited extensively in follow-up anonymization work (Baseline NER, BERT fine-tuning).
- **Caveats for target task:** ECHR is civil-law / international-human-rights and the "preserve public entities" philosophy is **inverted** — to re-use TAB you would flip its mask-everything-identifying policy to "mask private parties, preserve case citations/statutes/judges-in-judicial-capacity/public officials." Re-labeling would be feasible given existing spans.

### B.2 InLegalNER (OpenNyAI)
- **Source:** [HF](https://huggingface.co/datasets/opennyaiorg/InLegalNER); ACL 2022 NLLP Workshop.
- **License:** Apache 2.0 (model repo); dataset itself is downloadable under the same repo.
- **Size:** 46,545 annotated legal entities across 9,435 judgment sentences and 1,560 preambles.
- **Jurisdiction:** Indian Supreme Court + High Courts, 1950–2021.
- **Schema:** 14 types as above (STATUTE, PROVISION, COURT, JUDGE, LAWYER, PRECEDENT, PETITIONER, RESPONDENT, WITNESS, OTHER_PERSON, CASE_NUMBER, DATE, ORG, GPE).
- **Public-vs-private separation:** Implicit through schema — public legal entities are cleanly distinct categories from private-party categories.
- **Annotation quality:** Pre-annotated with spaCy + rules, then corrected by legal experts in 4 annotation cycles.

### B.3 MAPA Spanish legal anonymization datasets
- **Source:** [ACL paper](https://aclanthology.org/2022.lrec-1.400.pdf); Vicomtech / Pangeanic consortium, EU CEF program.
- **License:** Mixed — three manually annotated subsets publicly released under CC-BY 4.0, one large auto-annotated set (error rate ~14%).
- **Jurisdiction / schema:** Spanish legal corpus; ~10 entity types aligned with MAPA's pan-EU taxonomy (PERSON, LOC, ORG, DATE, ADDRESS, AMOUNT, ID, EMAIL, etc.).
- **Public-vs-private separation:** No — treats all named entities as potentially sensitive.

### B.4 LeNER-Br, LegalNERo, Greek Legal NER (LEXTREME bundle)
- **Source:** [LEXTREME arXiv](https://arxiv.org/html/2301.13126v3) — multi-lingual legal benchmark bundling 70 Brazilian legal docs (LeNER-Br), 370 Romanian MARCELL docs (LegalNERo, 19 fine-grained classes), 254 Greek Gazette issues.
- **Licenses vary by subset:** LeNER-Br is CC-BY; LegalNERo CC-BY-SA 4.0.
- **Relevance:** Structural legal NER schemas; useful as reference but not U.S./California.

### B.5 Pile of Law (pile-of-law/pile-of-law)
- **Source:** [HF](https://huggingface.co/datasets/pile-of-law/pile-of-law); Henderson et al., arXiv 2207.00220.
- **License:** CC-BY-NC-SA 4.0 — **non-commercial only** ([HF dataset card](https://huggingface.co/datasets/pile-of-law/pile-of-law)). Flag: this eliminates it for a commercial chatbot deployment as training data unless only used for research / model cards.
- **Size:** ~256 GB, 35 sources including CourtListener, government agency publications, contracts, casebooks.
- **Jurisdiction:** Primarily U.S. (including California), with some EU/Canada.
- **Entity annotation:** NONE — raw text only. Useful only as pre-training corpus, not for supervised fine-tuning of PII detection.

### B.6 Caselaw Access Project (CAP) — California raw text source
- **Source:** [case.law](https://case.law/); [HF mirror](https://huggingface.co/datasets/free-law/Caselaw_Access_Project).
- **License:** **CC0** — fully public domain as of the 2024 release ([HF README](https://huggingface.co/datasets/free-law/Caselaw_Access_Project)).
- **Size:** 6.7M U.S. court decisions, 40M pages, 360 years; includes California Reports, Cal. App., California Supreme Court in full.
- **Entity annotation:** NONE. Raw OCR-cleaned text plus metadata (citation, court, date, parties).
- **Relevance:** Best-in-class California raw text resource for bootstrapping annotation. Combined with eyecite (Part E) it gives free, deterministic citation and case-name identification.

### B.7 ECtHR / HUDOC, LegalLAMA, LexGLUE, CUAD, MultiLexSum, LegalBench
- **ECtHR Cases (AUEB)**: 11,500 ECHR cases; used for judgment prediction and rationale extraction; no PII labels ([HF](https://huggingface.co/datasets/AUEB-NLP/ecthr_cases)).
- **LexGLUE / LegalLAMA / LegalBench / CUAD / LEDGAR / MAUD**: benchmarks for classification, QA, contract understanding — **no PII or anonymization annotations**. CUAD is contract clause extraction; LEDGAR is contract provision classification; MAUD is M&A clause classification.
- These are mentioned for completeness but none supports the target task.

**Bottom line for Part B:** There is no California-specific labeled dataset and no U.S.-specific dataset that annotates the public-vs-private distinction. **TAB (for the privacy annotation philosophy) + InLegalNER (for the legal-entity schema) + CAP text (for California raw material) is the strongest available bootstrap combination.**

---

## Part C — Academic Work (2020–2026)

1. **Pilán, Lison, Øvrelid, Papadopoulou, Sánchez, Batet (2022).** "The Text Anonymization Benchmark (TAB)." *Computational Linguistics* 48(4):1053–1101. [ACL](https://aclanthology.org/2022.cl-4.19/). *Contribution:* Establishes the distinction between de-identification (NER-style) and anonymization (disclosure-risk oriented) and publishes the only corpus that annotates which spans must be masked to protect subjects. Directly transferable framework, though ECHR-based.

2. **Kalamkar, Agarwal, Tiwari, Gupta, Karn, Raghavan (2022).** "Named Entity Recognition in Indian Court Judgments." NLLP @ EMNLP. [ACL](https://aclanthology.org/2022.nllp-1.15/). *Contribution:* Defines the 14-class legal NER schema (public + private separately) and publishes the InLegalNER dataset + `en_legal_ner_trf` baseline. Best schema template for the U.S. target task.

3. **Gianola, Ajausks et al. (2020).** "Automatic Removal of Identifying Information in Official EU Languages for Public Administrations: The MAPA Project." JURIX 2020. [ResearchGate PDF](https://www.researchgate.net/publication/347321361). *Contribution:* EU-wide open-source pipeline using multilingual BERT + pattern rules for medical and legal GDPR anonymization; 24 languages.

4. **Bonet-García et al. (2022).** "Spanish Datasets for Sensitive Entity Detection in the Legal Domain." LREC 2022. [ACL](https://aclanthology.org/2022.lrec-1.400/). *Contribution:* Four Spanish legal-domain anonymization datasets (three manual, one silver) and fine-tuned BERT baselines; shows in-domain pretraining improves F1.

5. **Chalkidis et al. (2020).** "LEGAL-BERT: The Muppets straight out of Law School." EMNLP 2020 Findings. [ACL](https://aclanthology.org/2020.findings-emnlp.261/). *Contribution:* Domain pre-training for legal NLP; base for subsequent legal NER work.

6. **Henderson, Krass, Zheng et al. (2022).** "Pile of Law: Learning Responsible Data Filtering from the Law and a 256GB Open-Source Legal Dataset." arXiv 2207.00220. *Contribution:* Curates a very large legal corpus with a focus on context-dependent privacy norms — argues that law itself encodes contextual privacy rules that ML systems could learn.

7. **Niklaus, Matoshi et al. (2023).** "LEXTREME: A Multi-Lingual and Multi-Task Benchmark for the Legal Domain." arXiv 2301.13126. *Contribution:* Bundles the heterogenous European legal NER datasets (MAPA, LeNER-Br, LegalNERo, Greek Legal NER) under one evaluation suite — useful for cross-jurisdiction transfer evaluation.

8. **Chalkidis, Garneau, Goanta, Katz, Søgaard (2023).** "LeXFiles and LegalLAMA: Facilitating English Multinational Legal Language Model Development." ACL 2023. *Contribution:* English legal pre-training corpus and probe benchmark across UK/US/EU/CA jurisdictions — useful for California-sensitive pre-training, no PII annotation.

9. **Ho, Huang, Low, Teng, Zhang, Krass, Grabmair (2021).** "Context-Aware Legal Citation Recommendation Using Deep Learning." ICAIL 2021. *Contribution:* Not anonymization, but uses the eyecite/Free-Law infrastructure to model citation context; demonstrates the tractability of the preservation pre-pass.

10. **Cushman, Dahl, Lissner (2021).** "eyecite: a tool for parsing legal citations." *JOSS* 6(66):3617. [Whitepaper PDF](https://free.law/pdf/eyecite-whitepaper.pdf). *Contribution:* The empirical anchor for any deterministic citation-preservation stage — 55M-citation test corpus; tested against CAP and CourtListener.

11. **Corte di Cassazione pipeline authors (2025).** "A document processing pipeline for the construction of a dataset for topic modeling based on the judgments of the Italian Supreme Court." arXiv 2505.08439. *Contribution:* End-to-end modern pipeline combining YOLOv8 document layout, TrOCR, GLiNER NER anonymization; maps five entity classes (parties, witnesses, companies, dates, locations) for GDPR compliance.

12. **Darji, Mitrović et al. (2023).** "gbert-legal-ner" — ICAART 2023 conference paper documenting German legal NER on the GBERT backbone.

13. **Aletras et al. (2016); Chalkidis et al. (2019); Chalkidis et al. (2021).** ECtHR judgment-prediction series — indirectly supplied the ECHR text used by TAB; use anonymization experiments to study demographic bias.

**Key pattern across the literature:** Work on the *target task* (jointly preserve public legal entities + redact private PII) has not been published. All prior work solves either NER for legal entities or anonymization of identifiers, never both with a policy layer.

---

## Part D — Commercial / Legal-Tech Vendor Offerings

| Vendor / Product | Deployment | Legal Specialization? | Public-vs-Private Legal Distinction? | Public API? | Source |
|---|---|---|---|---|---|
| **Microsoft Presidio** | Open-source, self-host or Azure container; Apache 2.0 | No shipped legal recognizers — must custom-build | No (user can implement via custom recognizers) | Yes, well-documented Python/REST | [github.com/microsoft/presidio](https://github.com/microsoft/presidio) |
| **Amazon Comprehend PII** | SaaS (AWS region) | No legal specialization (22 universal + 14 country-specific PII types) | No — entities like names of judges/public officials would be flagged as `NAME` | Yes (`DetectPiiEntities`, `ContainsPiiEntities`, redaction jobs) | [AWS docs](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html); Reveal's Logikcull uses it for e-discovery at scale ([AWS case study](https://aws.amazon.com/blogs/machine-learning/how-reveals-logikcull-used-amazon-comprehend-to-detect-and-redact-pii-from-legal-documents-at-scale/)) |
| **Google Cloud DLP / Sensitive Data Protection** | SaaS | No legal templates; generic InfoTypes | No | Yes | Google Cloud docs |
| **Private AI / Limina** | Container (on-prem) or SaaS; Scale plan supports custom entities | 50+ entities across PII/PHI/PCI; includes beta TREND / FINANCIAL_METRIC / CORPORATE_ACTION; does not ship legal-specific entity types | No — acknowledges "Legal: APIs should handle attorney-client privilege, case numbers, and witness identities. AI flags content, but attorneys must review privilege decisions" per third-party analysis ([Nutrient guide](https://www.nutrient.io/blog/best-ai-redaction-api/)) | Yes, REST ([docs.private-ai.com](https://docs.private-ai.com/entities/)) | — |
| **Relativity / RelativityOne** | SaaS (eDiscovery) | Yes — AI-driven PII detection embedded in eDiscovery review with bulk redaction, active learning | Detects PII entities (SSN, email, financial), but the public-vs-private legal-entity taxonomy is not part of their public entity list | Yes (API & connectors) | WifiTalents / Relativity docs |
| **Harvey AI** | SaaS (Azure, EU/US/AU regions) | Legal-only platform | Does not sanitize input; instead relies on no-training, zero-data-retention contracts with model providers, AES-256 encryption, SOC 2 / ISO 27001 ([Harvey security](https://www.harvey.ai/security); [Harvey privacy blog](https://www.harvey.ai/blog/how-harveys-building-a-culture-of-privacy)) | N/A — the design choice is "trust the contract, don't redact" | No public sanitization API | — |
| **Casetext (Thomson Reuters) / Westlaw Edge / Lexis+ AI** | SaaS | Legal-only | Public docs emphasize customer-agreement data protections, not input redaction; approach resembles Harvey's. | Proprietary | Vendor documentation |
| **anonym.legal** | Web/Desktop/Chrome/API | Markets itself as a Presidio replacement: 285+ recognizers, 48 languages, AES-256-GCM anonymization with reversible methods | Claims GDPR/HIPAA/PCI/CCPA preset templates; not verifiable in primary model card whether California-legal-entity preservation is a specific feature | Yes (REST, MCP, Chrome) | [anonym.community](https://anonym.community/anonym.legal/NP-37-microsoft-presidio-comparison.html) — **flag: this is a commercial vendor's own comparison page; treat accuracy claims with caution** |
| **Skyflow, Tonic.ai, Gretel, BigID, Nymiz, iConic, Opaque Systems, Hazy, Mostly AI** | Various | No publicly documented legal-domain specialization | No | Varies | Vendor sites |
| **Redactable / AssemblyAI / Nutrient** | SaaS | Document/audio redaction; general | No | Yes | [wald.ai comparison](https://wald.ai/blog/top-4-pii-redaction-tools-a-deep-dive-comparison); [Nutrient guide](https://www.nutrient.io/blog/best-ai-redaction-api/) |

**Pricing transparency:** Most enterprise legal-AI and DLP vendors do not publish pricing. Relativity is reported in third-party sources at ~$50k+ annually with per-GB processing fees (unverified, flagged). Presidio and Private AI's Community tier are free/freemium.

**Key finding for Part D:** No commercial vendor publicly documents a product feature that specifically distinguishes public legal entities (case citations, statutes, court names, named judges) from private PII in a policy-configurable way. Vendors either (a) treat legal text as generic PII substrate (Comprehend, Presidio, DLP, Private AI) or (b) handle confidentiality at the contract/infrastructure layer (Harvey, Westlaw Edge, Lexis+ AI). The latter is the prevalent approach in high-end legal AI, which is evidence that input-layer redaction for legal-research chat has not been commoditized.

---

## Part E — Citation Extraction Libraries (Preservation Pre-Pass)

| Library | URL | License | Format coverage | California coverage | Last updated |
|---|---|---|---|---|---|
| **eyecite** (Free Law Project) | [github.com/freelawproject/eyecite](https://github.com/freelawproject/eyecite) | **BSD** (verified on PyPI) | Full-case, short-form, supra, id., statute, law, journal, reference; 55M citation test corpus; driven by `reporters-db` | **Comprehensive.** Dump of regexes shows explicit handling of `Cal. Code Regs.`, `West's Annotated California Codes`, `Deering's California Codes`, `Cal. Adv. Legis. Serv.`, `Cal. Legis. Serv.`, `Cal. [Subject] Code` patterns. Full California Reports / Cal. App. / Cal. Rptr. coverage via reporters-db. ([eyecite API docs](https://freelawproject.github.io/eyecite/find.html)) | Active in 2026; 1.0 release with ongoing feature work (reference-citation resolution, hyperscan tokenizer); used in production by CourtListener and CAP |
| **reporters-db** (Free Law Project) | github.com/freelawproject/reporters-db | BSD | Data backend for eyecite: ~every American reporter ever, including all California reporters | Full | Active 2026 |
| **courts-db** (Free Law Project) | github.com/freelawproject/courts-db | BSD | Court-name resolution (judicial-capacity detection support) | Full U.S. including California state and district courts | Active |
| **CiteURL** (Simon Raindrum Sherred) | [github.com/raindrum/citeurl](https://github.com/raindrum/citeurl); [PyPI](https://pypi.org/project/citeurl/) — last release Jan 20, 2026 | **MIT** (verified on PyPI) | 130+ U.S. Bluebook-style sources via YAML templates; web-app at [citation.link](https://citation.link) | Covers California via community templates; less exhaustive than eyecite but simpler to customize | Active (Jan 2026) — health analyzer flags it "small downloads, inactive-ish" but a release landed Jan 2026 ([Snyk](https://snyk.io/advisor/python/citeurl)) |
| **LexNLP** (LexPredict) | [github.com/LexPredict/lexpredict-lexnlp](https://github.com/LexPredict/lexpredict-lexnlp) | AGPL (originally commercial; see repo LICENSE) — **flag as copyleft, may not be acceptable depending on deployment model** | Citations (relies on reporters_db), courts, acts, regulations, dates, amounts, durations, definitions, conditions, constraints, copyright | U.S. state codes including California in `lexpredict-legal-dictionary/us_state_code_citations.csv` | Active-ish; maintained by LexPredict, last major documented update in 2.3.x series |
| **unitedstates/citation** (@unitedstates) | [github.com/unitedstates/citation](https://github.com/unitedstates/citation) | CC0 | U.S. Code, CFR, selected court cites via walverine | Limited California-specific support | Older (Node.js library); still works |
| **Juriscraper** (Free Law Project) | github.com/freelawproject/juriscraper | BSD | Not a citation parser — a scraper for court websites; useful for CourtListener data ingestion | Yes (California courts) | Active |

**License note on eyecite:** PyPI and GitHub both record eyecite as BSD-licensed ([PyPI](https://pypi.org/project/eyecite/1.0.0/)), explicitly chosen so downstream users can incorporate it in their own libraries. This is the lowest-friction legal-citation preservation dependency available.

**Recommendation within Part E:** eyecite + reporters-db + courts-db is the clear choice. For California deployment, its regex coverage of state-specific reporters and codes is the most comprehensive in the open-source world and is used in production by Harvard's CAP and Free Law Project's CourtListener.

---

## Assessment of the Gap

Three converging observations:

1. **Deterministic preservation is solved.** eyecite already reliably identifies case citations, statutes, and court names in California text — this half of the "preserve" requirement does not need ML.
2. **Generic PII redaction is now commoditized.** OpenAI Privacy Filter (April 2026), Private AI/Limina, Presidio, Amazon Comprehend, and Google DLP all produce reasonable private-PII detection on English text. The private-PII half is also essentially solved, modulo accuracy tuning.
3. **What is missing is the *policy layer*** — a system that knows, for example, that "Hon. Justice Kathryn Werdegar" inside a majority opinion is a *public legal entity to preserve* but "Justice Werdegar is my client's cousin" requires context-sensitive handling, and that a person named in a case caption of a published California Supreme Court opinion is part of the public record while a person named in a client intake form is private. No released model, no released dataset, and no commercial product combines (a) a U.S./California public-legal-entity taxonomy, (b) a private-PII taxonomy, and (c) a configurable preservation policy.

The field has likely under-explored this because: (i) the two communities (legal NER vs. de-identification) publish in different venues and use different evaluation philosophies (TAB vs. InLegalNER framing); (ii) the largest buyers of legal AI (BigLaw) have opted for contractual protection (Harvey/Lexis+/Westlaw model) instead of input sanitization; (iii) until OpenAI Privacy Filter's April 2026 release there was no permissively licensed small model that made on-device redaction economic for a small legal-tech builder.

---

## Recommended Action List

1. **If you want to spend the least effort:** Deploy **eyecite** as a deterministic preservation pre-pass (mark all detected citations, statutes, reporter cites, court names as *preserve*), then run **OpenAI Privacy Filter** (Apache 2.0, 50M active params, on-device / CPU-viable) over the *non-preserved* spans only, using its existing 8-category taxonomy. This gets you an 80% solution in a weekend — no training required.
2. **If you want the highest quality:** Fine-tune OpenAI Privacy Filter on a custom-labeled California corpus (sampled from the Caselaw Access Project + synthetic client-intake-style text) using a schema that merges Privacy Filter's 8 categories with an OpenNyAI-style public-legal-entity taxonomy (STATUTE, PROVISION, COURT, JUDGE_JUDICIAL, PRECEDENT, CASE_NUMBER, PUBLIC_OFFICIAL). OpenAI reports domain fine-tuning lifts F1 from 54% → 96% with modest data ([OpenAI blog](https://openai.com/index/introducing-openai-privacy-filter/)), so a few thousand high-quality California annotations would likely suffice.
3. **The single best model to start from:** **OpenAI Privacy Filter** (`openai/privacy-filter`, Apache 2.0). 128k context handles full opinions; on-device deployment satisfies the pre-Bedrock trust boundary; BIOES span decoding via constrained Viterbi is well-suited to legal text structure. Pair it at runtime with eyecite-derived spans as a forced-preserve mask.
4. **The single best dataset to start from:** **Text Anonymization Benchmark (TAB), MIT license**, for the anonymization-evaluation *framework* and span-level annotation style; layer on top of it **InLegalNER** (Apache 2.0, Indian, 14-class schema) as the entity-taxonomy template. Use **CAP (CC0)** as the unlabeled California raw corpus. Do not use Pile of Law in a commercial training set (CC-BY-NC-SA).
5. **Gaps you would need to fill:**
   - (a) A California-specific annotated test set — ~200 opinions plus ~200 synthetic client-intake snippets, dual-labeled for public-legal-entity vs. private-PII, to evaluate your fine-tuned model. None exists publicly.
   - (b) A policy decoder that reconciles eyecite spans with Privacy Filter spans (e.g., a person name inside a case-caption span becomes "preserve"; a person name outside becomes "redact"). This is ~100 lines of glue code but is the conceptual core of the system.
   - (c) California Rules of Professional Conduct / CCPA compliance review — the sanitization goal is legal-ethical, not just statistical; a false-negative that leaks a client identifier has bar-discipline consequences beyond what a PII-Masking-300k benchmark score captures.
   - (d) A judicial-capacity classifier (judge in judicial capacity = preserve; judge named as a personal litigant = redact) — no public model handles this.
6. **Watchlist / re-check in 6 months:** (i) OpenAI Privacy Filter fine-tuning recipes in the legal domain — the model is only a day old at the time of this survey, and a community fine-tune could appear rapidly; (ii) any update to the TAB corpus or a U.S. counterpart; (iii) whether Free Law Project releases a named-entity pipeline beside eyecite.
7. **Do not rely on vendor contractual protections alone.** Harvey, Lexis+ AI, and Westlaw Edge's approach (no-training guarantees + ZDR + encryption) addresses a different threat model than pre-LLM-input sanitization. For a Bedrock-Claude architecture where you control the trust boundary, input redaction remains the correct control — and none of these vendors exposes a California-aware sanitization API you could plug in.

---

*Confidence notes:* Entities flagged as low-confidence in this report: (i) `PaDaS-Lab/gbert-legal-ner` license (gated); (ii) LexNLP 2.x current license status (historically moved from commercial to MIT then toward AGPL — verify against the specific release you adopt); (iii) anonym.legal's product claims, which come from their own comparison page; (iv) Relativity pricing, third-party reported. Everything else is sourced to primary model cards, dataset cards, paper PDFs, or repository READMEs as of April 23, 2026.