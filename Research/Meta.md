## Executive Summary

1. Production-grade legal PII model with public-entity preservation? No. The strongest open-weight detectors are NVIDIA gliner-PII and the Knowledgator GLiNER-PII family. gliner-PII ships under the NVIDIA Open Model License Agreement, uses a 570 M-parameter GLiNER transformer, lists “Legal: Protect client information in contracts, filings, and discovery materials” as a use case, and reports strict F1 0.70 on Argilla PII, 0.64 on AI4Privacy, and 0.87 on Nemotron-PII. It detects 55+ PII/PHI categories but has no built-in label for case citations, statutes, court names, or judges in judicial capacity. The research prototype LegNER does recognize LAW and CASE_REFERENCE alongside PERSON and ORGANIZATION and achieves 99% accuracy on 1,542 EUR-Lex cases, but it is not released as a maintained package and does not implement a preserve policy for public entities. 
2. Fine-tune without fresh annotation? Partially yes. The Text Anonymization Benchmark (TAB) provides 1,268 English ECHR court cases manually annotated with `identifier_type` = DIRECT / QUASI / NO_MASK and is released under the MIT License. It is the only public corpus that explicitly marks which spans ought to be masked. The synthetic nvidia/Nemotron-PII dataset (200k rows) provides 55+ PII span types and was used to train gliner-PII. Neither is California-specific. 
3. Gap: There is no open, California-centric corpus or model that jointly (a) detects private client PII and (b) preserves public legal entities with an evaluable policy. Existing resources cover either generic PII detection or legal NER without masking decisions. The absence reflects annotation cost and jurisdictional specificity, not a technical blocker. 

## Part A — Pre-trained models for legal-domain PII detection

1. nvidia/gliner-PII – NVIDIA

1. Model name and publisher: nvidia/gliner-PII, NVIDIA
2. Source: Hugging Face hub
3. License: NVIDIA Open Model License Agreement
4. Architecture and size: GLiNER transformer, 5.7×10^8 parameters
5. Training data: Synthetic Nemotron-PII, ∼100k records, 55+ entity types across 50+ industries
6. Entity categories: 55+ PII/PHI labels (email, phone_number, ssn, bank_routing_number, credit_debit_card, etc.)
7. Public-vs-private legal distinction: No; legal use case listed without citation/statute preservation
8. Reported benchmarks: Argilla PII 0.70, AI4Privacy 0.64, Nemotron-PII 0.87 strict F1 @ 0.3
9. Limitations: Performance varies by domain; human review recommended for high-stakes use
10. Last updated: 2025-10-28
11. knowledgator/gliner-pii-edge-v1.0 – Knowledgator

1. Model name and publisher: knowledgator/gliner-pii-edge-v1.0
2. Source: Hugging Face
3. License: Apache 2.0 (repository)
4. Architecture and size: GLiNER edge-optimized, ∼197 MB UINT8
5. Training data: Synthetic multi-pii dataset
6. Entity categories: 60+ predefined PII categories
7. Public-vs-private legal distinction: No
8. Reported benchmarks: F1 75.50% on synthetic-multi-pii-ner-v1
9. Limitations: Lower recall than base/large variants
10. Last updated: 2024
11. LegNER – Karamitsos et al.

1. Model name and publisher: LegNER, research team
2. Source: Frontiers in Artificial Intelligence article
3. License: Academic publication; no model package released
4. Architecture and size: BERT-base with legal-domain pretraining
5. Training data: 1,542 manually annotated EUR-Lex court cases
6. Entity categories: PERSON, ORGANIZATION, LOCATION, DATE, LAW, CASE_REFERENCE
7. Public-vs-private legal distinction: Partial; LAW and CASE_REFERENCE are separate labels, but PERSON is not split by role
8. Reported benchmarks: Accuracy 99%, F1 >99%, >12 docs/sec
9. Limitations: EU corpus only; no California evaluation
10. Last updated: Published 2025
11. Microsoft Presidio

1. Model name and publisher: Presidio, Microsoft
2. Source: GitHub microsoft/presidio
3. License: MIT
4. Architecture and size: Framework with spaCy/Stanza recognizers, pluggable transformers
5. Training data: Generic spaCy models
6. Entity categories: PERSON, PHONE, EMAIL, US_SSN, etc.; extensible
7. Public-vs-private legal distinction: Requires custom recognizers
8. Reported benchmarks: None for legal domain
9. Limitations: No built-in citation preservation
10. Last updated: Actively maintained
11. OpenAI Privacy Filter

1. Model name and publisher: OpenAI Privacy Filter
2. Source: Bloomberg Law coverage April 2026
3. License: Described as open-weight; verify official repo
4. Architecture and size: Reported 1.5B MoE, runs locally
5. Training data: Mix of public and synthetic PII data
6. Entity categories: Names, dates, account numbers, email addresses
7. Public-vs-private legal distinction: Not documented
8. Reported benchmarks: None published
9. Limitations: Can miss uncommon identifiers; not a compliance certification
10. Last updated: Announced April 2026



## Part B — Public datasets for legal PII annotation

1. Text Anonymization Benchmark (TAB)

1. Dataset name and curator: TAB, Norsk Regnesentral
2. Source: GitHub NorskRegnesentral/text-anonymization-benchmark
3. License: MIT
4. Size: 1,268 English ECHR court cases
5. Jurisdiction and document type: European Court of Human Rights judgments
6. Annotation schema: entity_type, identifier_type (DIRECT, QUASI, NO_MASK), confidential_status, co-reference
7. Public vs private separation: Yes – NO_MASK marks spans to preserve
8. Quality notes: Manual annotation with quality_checked flag
9. Used in: Pilán et al. 2022 TAB paper
10. Known issues: Not US/California; limited to ECHR style
11. nvidia/Nemotron-PII

1. Dataset name and curator: Nemotron-PII, NVIDIA
2. Source: Hugging Face datasets/nvidia/Nemotron-PII
3. License: NVIDIA dataset license
4. Size: 200k rows synthetic documents
5. Jurisdiction and document type: Multi-industry synthetic, includes legal agreements
6. Annotation schema: Span-level labels for 55+ PII types
7. Public vs private separation: No
8. Quality notes: Persona-grounded synthetic generation
9. Used in: Training gliner-PII
10. Known issues: Synthetic; lacks real citation structures
11. Pile of Law

1. Dataset name and curator: Pile of Law, Stanford/ EleutherAI
2. Source: Hugging Face pile-of-law
3. License: Mixed; research use with restrictions
4. Size: 256 GB of legal text
5. Jurisdiction and document type: US and European court opinions, regulations, filings
6. Annotation schema: None for PII
7. Public vs private separation: No
8. Quality notes: Curated for pretraining
9. Used in: Legal LM pretraining
10. Known issues: Requires separate annotation
11. CUAD

1. Dataset name and curator: CUAD, The Atticus Project
2. Source: Hugging Face theatticusproject/cuad-qa
3. License: CC BY 4.0
4. Size: 510 contracts, >13,000 annotations across 41 categories
5. Jurisdiction and document type: US commercial contracts from EDGAR
6. Annotation schema: 41 clause types, not PII
7. Public vs private separation: No
8. Quality notes: Expert lawyer annotations
9. Used in: NeurIPS 2021 contract review benchmark
10. Known issues: No PII labels
11. E-NER

1. Dataset name and curator: E-NER, academic authors
2. Source: arXiv 2212.09306
3. License: Research use
4. Size: ∼400k tokens across 52 legal documents
5. Jurisdiction and document type: US SEC EDGAR filings
6. Annotation schema: Legal NER tags
7. Public vs private separation: No
8. Quality notes: Demonstrates domain shift
9. Used in: Legal NER studies
10. Known issues: Financial disclosure focus



## Part C — Academic work on legal PII / legal-entity recognition

- Pilán et al., 2022, The Text Anonymization Benchmark (TAB): Introduces 1,268 ECHR cases with masking decisions and privacy-oriented evaluation metrics, moving beyond traditional de-identification.
- Karamitsos et al., 2025, LegNER: Proposes domain-adapted BERT for legal NER and anonymization, reporting 99.4% F1 and coherent anonymized outputs for GDPR workflows.
- Garat & Wonsever, Towards Deidentification of Legal Texts: Early survey of legal de-identification challenges for publishing sensitive legal documents.
- Hendrycks et al., 2021, CUAD: Demonstrates feasibility of large-scale expert legal annotation for contract review, relevant for annotation cost modeling.
- Henderson et al., 2022, Pile of Law: Curates 256 GB legal corpus and argues for learning responsible filtering from law.
- E-NER paper, 2022: Quantifies 29.4-60.4% accuracy degradation when applying general English NER to legal text. 

## Part D — Commercial / legal-tech vendor offerings

- Private AI: API for detection/redaction across 50+ languages; offers SaaS and on-prem deployment. No public documentation of public-entity preserve list.
- Microsoft Presidio: Open-source framework; supports custom recognizers and on-prem deployment.
- Amazon Comprehend: Managed DetectPiiEntities API; used by Logikcull to process millions of legal documents weekly. No built-in legal preserve policy.
- Google Cloud DLP: Inspection templates for PII detection; no prebuilt legal citation template found.
- Skyflow, Tonic.ai, Gretel, BigID: Offer data vaults and synthetic data platforms; public docs do not detail citation preservation. 

## Part E — Citation extraction libraries

1. Eyecite (Free Law Project)

- URL: github.com/freelawproject/eyecite
- License: Permissive BSD
- Formats handled: Full case, short form, supra, id., statutory, law journal
- California coverage: Uses reporter database covering nearly every American reporter, including California reporters
- Last updated: Active; used by CourtListener and Caselaw Access Project 
- CiteURL

- URL: PyPI citeurl
- License: MIT (verify in repo)
- Formats handled: Bluebook-style citations to over 130 sources including federal/state court opinions, U.S. Code, CFR, state constitutions, and state statutes
- California coverage: Yes
- Last updated: Maintained on PyPI 
- unitedstates/citation

- URL: github.com/unitedstates/citation
- License: Open source
- Formats handled: US legal codes, court opinions
- California coverage: US federal focus; limited state
- Last updated: Maintenance mode



## Recommended action list

1. Least effort: Deploy nvidia/gliner-PII locally and add Eyecite as a deterministic pre-pass to whitelist all citation spans before redaction.
2. Highest quality: Fine-tune gliner-PII on TAB using DIRECT/QUASI as redact and NO_MASK as preserve, then augment with 200-500 manually annotated California opinions for LAW and CASE_REFERENCE.
3. Single best model to start from: nvidia/gliner-PII – 570M parameters, NVIDIA Open Model License, explicit legal use case.
4. Single best dataset to start from: TAB – MIT-licensed, only corpus with explicit masking decisions.
5. Gaps to fill: California corpus with parallel private-PII and public-entity labels; policy for judges in official capacity; evaluation measuring over-redaction of citations.
6. Architecture: Run sanitization inside your trust boundary before calling AWS Bedrock Claude; do not rely on Bedrock’s generic PII detection.
7. Validation: Build a 100-document California gold set to measure recall of private PII and preservation rate of public legal entities.