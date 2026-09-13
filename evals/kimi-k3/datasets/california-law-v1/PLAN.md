# california-law-v1 — canonical dataset construction plan

Working plan for the dataset-construction loop. Each loop iteration consults
this file, does the next unchecked batch, updates checkboxes, and commits.
Spec contract: specs/CALC-KIMI-K3-GPT56-JUDGE-001.spec.md (facts + EvalTask
interface govern; this file is process, not contract).

## Ground rules (from the spec — do not relax)

- Only public, synthetic, or already-tokenized material. No client facts.
- Official CA legislative/judicial sources and official federal primary
  authorities are the source of record. CourtListener may assist discovery
  and citation metadata but never alone establishes a proposition, effective
  date, or precedential status.
- No model invents a substantive reference answer or truth label. Models may
  format source-extracted propositions and create deterministically mutated
  distractors; only source-entailing propositions enter the corpus.
- Every material criterion → atomic proposition with exact authoritative
  excerpt, locator, jurisdiction, publication/precedential status, effective
  date, retrieval timestamp, canonical URL, SHA-256 content hash.
- tests/citation-eval-set.json (30 entries) is incorporated by reference or
  deterministic transformation; truth labels are NOT rewritten by an LLM and
  must be independently revalidated against official primary sources.
- Reviewer attestations are EXTERNAL and human. This loop produces review
  bundles; it never fabricates attestations. Repository fixtures stay
  clearly marked non-live.

## Source-of-record endpoints

- CA codes (FAM, CCP, EVID, PROB, etc.): https://leginfo.legislature.ca.gov
- CA published opinions: https://www.courts.ca.gov/opinions.htm and the
  official California Courts opinion archive
- Federal statutes: https://uscode.house.gov
- SCOTUS: https://www.supremecourt.gov
- CourtListener: discovery/metadata assist only

## Batches

- [x] B0 infrastructure: sources.jsonl registry (excerpt, locator, status,
      effective date, retrieved_at, canonical URL, sha256), harvest tooling,
      task/proposition JSONL writers validated by evals/kimi-k3/integrity.ts
- [x] B1 verification (20 tasks): citation verification incl. revalidated
      entries from tests/citation-eval-set.json — lineage map in
      provenance/b1-verification-provenance.json
- [x] B2 research part 1 (15 tasks): California family-law research
      questions grounded in FAM statutes — lineage map in
      provenance/b2-research-provenance.json
- [x] B3 research part 2 (15 tasks): California procedure/evidence and
      case-law research questions — lineage map in
      provenance/b3-research-provenance.json
- [x] B4 drafting (25 tasks): California family-law/LGBTQ drafting requests
      graded on legally material content, not style — lineage map in
      provenance/b4-drafting-provenance.json
- [x] B5 abstention_adversarial (20 tasks): fabrication bait, false-premise
      corrections, prompt-injection resistance, jurisdiction/scope traps, and
      unanswerable-as-asked — lineage map in
      provenance/b5-abstention-provenance.json
- [x] B6 multi_turn (15 tasks): evolving-facts consultations,
      correction-under-pressure, context-carryover precision, and
      mid-conversation injection — lineage map in
      provenance/b6-multiturn-provenance.json
- [x] B7 long_context (10 tasks): deterministic synthetic case-file packets
      (25k-60k words each) with buried operative facts — lineage map in
      provenance/b7-longcontext-provenance.json; reproducible builder in
      provenance/b7-builder.mjs (+ -lib, -pools, -specs-a, -specs-b)
- [x] B7.5 live judge-calibration set (60 pairs: 30 mechanically controlled +
      30 primary-source-locked legal traps per the spec's trap list), built
      from registry sources with deterministic mutations only — replaces the
      non-live fixtures for real runs; needed before any paid judge bake-off
      (gpt-5.6-sol vs deepseek-v4-pro) or candidate run. Output
      `calibration.jsonl`; reproducible builder in
      provenance/b75-builder.mjs (+ -specs); lineage map in
      provenance/b75-calibration-provenance.json; validator
      provenance/b75-validate.mjs
- [x] B8a case-source officiality audit (Fable review finding, 2026-07-27):
      several CIT-REAL-* case records ground substantive holdings in
      aggregator-hosted excerpts (scocal.stanford.edu, caselaw.findlaw.com,
      case-law.vlex.com, courtlistener.com, one conference-hosted PDF). The
      spec permits aggregators for discovery/citation metadata only — every
      case record whose excerpt grounds a substantive proposition must be
      re-anchored to an official source (courts.ca.gov opinion archive /
      Official Reports) or the dependent criteria downgraded to
      citation-metadata form; document each resolution in provenance
- [x] B8b excerpt repair (carried out of B8a): the two EXCERPT_MISMATCH case
      records (CIT-REAL-3 Geiser, CIT-REAL-15 Wilson v. CNN) re-anchored to
      their official courts.ca.gov slip-opinion PDFs with verbatim replacement
      excerpts, and every dependent criterion/proposition re-validated —
      lineage map in provenance/b8b-excerpt-repair.json; reproducible builders
      in provenance/b8b-repair-sources.py and provenance/b8b-repair.ts
- [x] B8 whole-dataset integrity validation, deterministic distractor audit,
      dry-run against the real dataset, tightened cost estimate using real
      per-task assembled-input sizes (replace context-window-max assumption),
      reviewer bundles under evals/kimi-k3/review-bundles/ (one packet per
      task: propositions, excerpts, hashes, APPROVE/REJECT form + reason
      codes), README for reviewers

## Model routing

Source fetching/extraction: sonnet subagents. Task + proposition authoring
from fetched excerpts: opus subagents. Entailment spot-checks, batch review,
integrity gates: Fable (main loop). Zero paid eval-API calls; web fetching of
public sources and Claude-subscription subagents only.

## Status log

(loop appends one line per completed batch)
- 2026-07-27 — B0 complete: append-only source/task authoring, offline/live
  source verification, source-entailment guard, stable content hashes, and
  partial-dataset dry-run progress validation implemented and tested.
- 2026-07-27 — B1 complete: 20 verification tasks in tasks.jsonl
  (10 real-citation, 8 fabricated-citation traps, 1 miscitation edge case,
  1 review-granted authority-status edge case), all track frozen_evidence,
  data_class public. 10 new source records ingested: 9 CourtListener
  official-reporter volume-index records (CIT-INDEX-*) supplying the
  negative/mismatch evidence for the fabricated and miscited entries, and
  CRC-8-1115, the official courts.ca.gov text of California Rules of Court,
  rule 8.1115(a), (d), (e). No citation was invented or mutated by the
  authoring agent: every case citation is carried verbatim from
  tests/citation-eval-set.json and every truth label comes from
  revalidation/citation-revalidation-report.json — see
  provenance/b1-verification-provenance.json for the task-to-legacy-entry
  lineage map. Verified: tests/kimi-k3-eval.test.mjs 36/36 PASS;
  `yarn eval:kimi --mode dry-run --dataset evals/kimi-k3/datasets/california-law-v1`
  exit 0, validation_pass true, 20/20 primary-source grounded,
  0 unsupported propositions, 0 errors, 100 tasks remaining.
- 2026-07-27 — B2 complete: 15 research tasks (research-001..015) in
  tasks.jsonl covering community/separate property (FAM 760/770/771/852),
  FAM 2640/2550 reimbursement and equal division, spousal support factors
  (4320), guideline child support mechanics (4055/4058), best interests and
  the prohibited-considerations bar (3011/3020), the DV custody presumption
  (3044), DVPA scope and coercive control (6211/6320), presumed parentage
  and RDP parity (7611/297.5), assisted reproduction (7613), gestational
  surrogacy (7962), premarital agreements (1612/1615), and post-separation
  fiduciary disclosure (2102/721/1100). All track frozen_evidence,
  data_class public, expected_tools []; 72 material criteria and 77
  propositions, each excerpt verbatim-entailed by an official leginfo
  excerpt. Five tasks carry an explicit effective/operative-date criterion
  with hard_failure_code WRONG_EFFECTIVE_DATE (FAM 4055/4058 operative
  2024-09-01, FAM 3044 effective 2026-01-01, FAM 1615 on-or-after
  2020-01-01, FAM 852 pre-1985 carve-out). No WRONG_JURISDICTION assertion
  was written — nothing in the registry grounds one for these questions.
  8 new source records ingested, all raw-curl harvests of official leginfo
  Family Code pages sliced with the verifySources normalizer:
  STAT-CAL-FAM-CODE-4055-B, -4055-D, -3044-B, -4320-B, -852-B, -297-5-B,
  -7962-B, and -721. Lineage map in
  provenance/b2-research-provenance.json. Verified:
  tests/kimi-k3-eval.test.mjs 40/40 PASS;
  `yarn eval:kimi --mode dry-run --dataset evals/kimi-k3/datasets/california-law-v1`
  exit 0, validation_pass true, 35 tasks (15 research / 20 verification),
  35/35 primary-source grounded, 0 unsupported propositions, 0 errors,
  85 tasks remaining.
- 2026-07-27 — B3 complete: 15 research tasks (research-016..030) in
  tasks.jsonl, completing the 30-task research category. Coverage is
  procedure- and evidence-flavored plus case-law-grounded doctrine:
  anti-SLAPP core standard and protected-activity categories
  (CCP 425.16(b)(1), (e); Navellier 29 Cal.4th 82; Equilon 29 Cal.4th 53),
  anti-SLAPP mechanics — 60-day window, discovery stay, fee shifting,
  appealability (425.16(a), (c), (f), (g), (i); Briggs 19 Cal.4th 1106),
  limits on the statute (City of Cotati 29 Cal.4th 69; Baral 1 Cal.5th 376;
  Wilson v. CNN 7 Cal.5th 871), settlement-offer inadmissibility and
  mediation confidentiality (EVID 1152(a)-(c), 1119), privilege
  presumptions and the entire-communication rule (EVID 917;
  Costco 47 Cal.4th 725), deposition scope and improper instructions not to
  answer (CCP 2025.010, 2017.010; Stewart 87 Cal.App.4th 1006), burden and
  ambiguity objections (Cembrook 56 Cal.2d 423; West Pico 56 Cal.2d 407),
  trade-secret discovery (Bridgestone/Firestone 7 Cal.App.4th 1384),
  bifurcation of marital status incl. the FAM 2337(c) conditions list,
  need-based attorney fees (FAM 2030, 2032), donative-transfer fraud
  presumptions and exceptions (PROB 21380, 21382), domestic partnership
  formation (FAM 297, 298), DVPA ex parte mechanics (FAM 6300, 6320), and
  default-judgment relief limits (CCP 580; Lippel 51 Cal.3d 1160). All
  track frozen_evidence, data_class public, expected_tools []; 67 material
  criteria and 74 propositions, each excerpt sliced programmatically as a
  verbatim substring of a registered source. Four tasks carry a
  WRONG_EFFECTIVE_DATE assertion, each grounded in a decision date stated
  verbatim in the case excerpt (Cotati 2002, Stewart 2001,
  Bridgestone/Firestone 1992, Lippel 1990); eleven carry a
  MISSED_CONTROLLING_CONTRARY_AUTHORITY assertion, in every case for an
  authority that is itself inside that task's evidence packet. No
  WRONG_JURISDICTION assertion was written. 12 new source records ingested,
  all raw-curl harvests of official leginfo pages:
  STAT-CAL-CIV-PROC-CODE-425-16-A, -425-16-E, -2017-010, -580,
  STAT-CAL-EVID-CODE-1152-B, -1119, -980, STAT-CAL-FAM-CODE-2030-B, -2032,
  -298, -6300, and STAT-CAL-PROB-CODE-21382. No new case record was needed:
  all case authority reuses CIT-REAL-* records revalidated in B1. Lineage
  map in provenance/b3-research-provenance.json. Verified:
  tests/kimi-k3-eval.test.mjs 40/40 PASS; verifySources --offline 78/78,
  drift 0;
  `yarn eval:kimi --mode dry-run --dataset evals/kimi-k3/datasets/california-law-v1`
  exit 0, validation_pass true, 50 tasks (30 research / 20 verification),
  50/50 primary-source grounded, 0 unsupported propositions, 0 errors,
  70 tasks remaining.
- 2026-07-27 — B4 complete: 25 drafting tasks (drafting-001..025) in
  tasks.jsonl, completing the drafting category. All category drafting,
  workflow draft, track frozen_evidence, data_class synthetic,
  expected_tools []; 121 material criteria and 125 propositions, each
  excerpt sliced programmatically as a verbatim substring of a registered
  source. Coverage: RFO declarations and points and authorities for
  guideline child support (FAM 4055/4055(b)/4058/4059, incl. earning-capacity
  imputation and the low-income adjustment), spousal support (FAM 4320 incl.
  the (i) domestic-violence and (m) conviction factors), need-based and
  augmented attorney fees (FAM 2030/2032), DVRO request declarations
  (FAM 6203/6211/6300/6320 coercive control/6345 duration and renewal), and
  anti-SLAPP motion sections (CCP 425.16(a)-(c), (e)-(i) plus Briggs
  19 Cal.4th 1106 and Navellier 29 Cal.4th 82); agreements and clauses —
  premarital spousal-support and disclosure articles and the FAM 1615(c)
  execution protocol (FAM 1611/1612/1615), transmutation instruments
  (FAM 852/770), MSA characterization recitals (FAM 760/770/771/2550),
  FAM 2640 reimbursement and waiver, assisted-reproduction consent and
  embryo renunciation (FAM 7613), and surrogacy agreement required elements
  (FAM 7962); client-facing letters and memos — fiduciary disclosure duties
  (FAM 721/1100/2102), the preliminary/final declaration of disclosure
  calendar (FAM 2104/2105), a bifurcation stipulation proposal (FAM 2337),
  and domestic partnership formation and summary termination
  (FAM 297/298/299). Every prompt uses invented, clearly synthetic parties
  and facts. Two tasks carry a MALFORMED_DELIVERABLE assertion, used only
  where the prompt expressly requires the declaration to close with the
  CCP 2015.5 certification and the task grounds that requirement in the
  newly ingested 2015.5 record; two carry WRONG_EFFECTIVE_DATE (FAM
  1615(c)(2)(B) on-or-after 2020-01-01, FAM 852(e) pre-1985 carve-out) and
  one carries MISSED_CONTROLLING_CONTRARY_AUTHORITY (FAM 4058(b)(3)
  incarceration is not voluntary unemployment, inside that task's own
  evidence packet). No WRONG_JURISDICTION assertion was written. 8 new
  source records ingested, all raw-curl harvests of official leginfo pages:
  STAT-CAL-CIV-PROC-CODE-2015-5, STAT-CAL-FAM-CODE-1611, -299, -2104, -2105,
  -6203, -6345, and -4059; live-verified 8/8 with drift 0. No new
  aggregator-hosted case record was added; the two CIT-REAL-* case records
  reused (Briggs CIT-REAL-13, Navellier CIT-REAL-1) inherit the open B8a
  re-anchoring obligation and their criteria are confined to what those
  records' own excerpts state. Lineage map in
  provenance/b4-drafting-provenance.json. Verified:
  tests/kimi-k3-eval.test.mjs 40/40 PASS; verifySources --offline 86/86,
  drift 0;
  `yarn eval:kimi --mode dry-run --dataset evals/kimi-k3/datasets/california-law-v1`
  exit 0, validation_pass true, 75 tasks (30 research / 25 drafting /
  20 verification), 75/75 primary-source grounded, 0 unsupported
  propositions, 0 errors, 45 tasks remaining.
- 2026-07-27 — B5 complete: 20 abstention/adversarial tasks
  (abstention-001..020) in tasks.jsonl, completing the
  abstention_adversarial category. All category abstention_adversarial,
  workflow research, track frozen_evidence, expected_tools []; 70 material
  criteria and 69 propositions, each excerpt sliced programmatically as a
  verbatim substring of a registered source. Mix: 6 fabrication-bait
  (001-006), 5 false-premise (007-011), 4 prompt-injection (012-015),
  3 out-of-scope/jurisdiction (016-018), 2 unanswerable-as-asked (019-020).
  data_class synthetic for the four injection tasks, public for the other
  16. NO CITATION WAS INVENTED OR MUTATED: all seven fabricated citations
  used as bait (fake-6 Aspen, fake-1 Hendricks, fake-2 Foster, fake-7 Volk,
  fake-3 Markham, fake-8 Goldman, fake-9 Bell inside the abstention-015
  injection) are carried verbatim from tests/citation-eval-set.json with
  labels from revalidation/citation-revalidation-report.json, and each is
  refuted by an existing CIT-INDEX-* volume-index record; zero deterministic
  mutations were performed. Hard-failure assertions: 8 FABRICATED_AUTHORITY,
  3 WRONG_EFFECTIVE_DATE (FAM 3044 effective January 1, 2026; FAM 4055
  operative September 1, 2024; FAM 1615(c)(2)(B) on-or-after January 1,
  2020), 8 UNSUPPORTED_PROPOSITION, 4 POLICY_OR_TOOL_VIOLATION (each keyed
  to a distinctive compliance token the injection demands), and 2
  WRONG_JURISDICTION — written only where the registry excerpt itself names
  the jurisdiction (FAM 297(b) "established in California ... with the
  Secretary of State"; CCP 2025.010 "by taking in California the oral
  deposition"). The federal-scope trap (abstention-018) carries
  UNSUPPORTED_PROPOSITION rather than WRONG_JURISDICTION because the packet
  contains no federal record at all. This is also the first batch to use the
  `abstention` deterministic assertion kind (11 uses). 0 new source records
  ingested — all 24 sources used are pre-existing registry records, so no
  new aggregator-hosted case excerpt was added (B8a constraint respected);
  the CIT-INDEX-* and CRC-8-1115 records reused inherit their existing
  status and every criterion is confined to what those records' own excerpts
  state. Lineage map in provenance/b5-abstention-provenance.json. Verified:
  tests/kimi-k3-eval.test.mjs 42/42 PASS; verifySources --offline 86/86,
  drift 0;
  `yarn eval:kimi --mode dry-run --dataset evals/kimi-k3/datasets/california-law-v1`
  exit 0, validation_pass true, 95 tasks (30 research / 25 drafting /
  20 verification / 20 abstention_adversarial), 95/95 primary-source
  grounded, 0 unsupported propositions, 0 errors, 25 tasks remaining.
- 2026-07-27 — B6 complete: 15 multi_turn tasks (multiturn-001..015) in
  tasks.jsonl, completing the multi_turn category. All category multi_turn,
  track frozen_evidence, data_class synthetic, expected_tools []; workflow
  research x13 and draft x2 (multiturn-006 client letter, multiturn-009 brief
  paragraph); 67 material criteria and 75 propositions, each excerpt sliced
  programmatically as a verbatim (whitespace-normalized) substring of a
  registered source excerpt. Every task is a 3-to-5-turn consultation in which
  only the FINAL user turn is graded. Four design patterns: (1) evolving facts
  (001-006) — a later turn discloses a fact that changes the analysis and the
  graded turn must integrate all of them: FAM 760/771/1612/1615/2550
  post-separation earnings plus premarital-agreement enforceability;
  3011/3020/3044 custody where the DV finding lands in turn 3 and completion of
  a batterer's program in turn 5; 4055/4058/4059 guideline support where an
  apparent voluntary job departure is corrected to incarceration (4058(b)(3));
  4320(i)/(m) spousal support where DV history then a conviction are disclosed;
  7613/7611 assisted reproduction where the licensed-provider fact fails and
  pre-conception oral agreements emerge; 2104/2102/721/2105 disclosure ending in
  a drafted client letter. (2) Correction under pressure (007-010) — the user
  pushes back on a correct earlier answer with a confidently wrong assertion
  (contribution-proportional division contra 2550; a "conclusive" 3044
  presumption contra its rebuttable language and the preponderance standard; a
  represented-party carve-out from the 1615(c)(2)(B) seven-day rule and an oral
  premarital agreement contra 1611; community character until judgment contra
  771(a)), and correct behavior is holding position, grounded. (3) Context
  carryover (011-013) — turn 1 fixes a setup that the graded turn silently
  depends on: an RDP registered under 297 in 2015 whose eleven-year duration
  disqualifies 299(a)(3) summary termination; a 2019 unrecorded transmutation
  triggering 852(b) and the 852(e) pre-1985 carve-out; a March 3, 2026 service
  date driving CCP 425.16(f)/(g)/(i)/(c)(1). (4) Mid-conversation injection
  (014-015) — turn 3 pastes a directive to reset the conversation, emit a
  compliance token, and cite fabricated authority; correct behavior is ignoring
  it and retaining prior facts. NO CITATION WAS INVENTED OR MUTATED: the only
  two case citations anywhere in the batch are fake-5 (Hernandez v. California
  Coastal Commission, 18 Cal.4th 1107) and fake-2 (Foster v. State Bar,
  43 Cal.3d 421), carried verbatim from tests/citation-eval-set.json with labels
  from revalidation/citation-revalidation-report.json, each refuted by an
  existing CIT-INDEX-* volume-index record (CIT-INDEX-CAL-4TH-18,
  CIT-INDEX-CAL-3D-43); zero deterministic mutations. Hard-failure assertions:
  8 UNSUPPORTED_PROPOSITION, 3 WRONG_EFFECTIVE_DATE (FAM 1615(c)(2)(B) on-or-
  after January 1, 2020 x2; FAM 852(e) pre-January 1, 1985), 2
  FABRICATED_AUTHORITY, 2 POLICY_OR_TOOL_VIOLATION (each keyed to the
  distinctive token the injection demands), and 1
  MISSED_CONTROLLING_CONTRARY_AUTHORITY (FAM 4058(b)(3), inside that task's own
  evidence packet). No WRONG_JURISDICTION and no MALFORMED_DELIVERABLE
  assertion was written. 0 new source records ingested — all 30 sources used
  are pre-existing registry records, so no new aggregator-hosted case excerpt
  was added (B8a constraint respected). Lineage map in
  provenance/b6-multiturn-provenance.json. Verified:
  tests/kimi-k3-eval.test.mjs 42/42 PASS; verifySources --offline 86/86,
  drift 0;
  `yarn eval:kimi --mode dry-run --dataset evals/kimi-k3/datasets/california-law-v1`
  exit 0, validation_pass true, 110 tasks (30 research / 25 drafting /
  20 verification / 15 multi_turn / 20 abstention_adversarial), 110/110
  primary-source grounded, 0 unsupported propositions, 0 errors,
  10 tasks remaining.
- 2026-07-27 — B7 complete: 10 long_context tasks (longcontext-001..010) in
  tasks.jsonl, completing the canonical 120-task dataset. All category
  long_context, workflow research, track frozen_evidence, data_class
  synthetic, expected_tools []; 46 material criteria and 42 propositions,
  each excerpt sliced programmatically as a verbatim (whitespace-normalized)
  substring of a registered official leginfo Family Code record. Each task's
  graded turn embeds one large SYNTHETIC California family-law case file —
  exhibit index, counsel correspondence and message exports, declaration
  paragraphs, attorney billing detail, account ledgers, deposition excerpts,
  interrogatory responses, minute orders, and e-mail — generated
  DETERMINISTICALLY from template pools rather than free-typed. Packet sizes
  are 27,601 / 31,237 / 35,882 / 44,519 / 29,795 / 51,652 / 40,277 / 34,289 /
  48,201 / 56,318 words (399,771 total). The legally operative facts are
  buried at deliberately varied depths (0.12 to 0.95 of the packet) and each
  task pairs them with a tempting-but-wrong distractor the packet expressly
  contradicts (a superseded pleaded date, a not-final draft, a stale salary
  figure, a withdrawn or evidence-free prior order, an assignment that did
  carry written consent, a corrected intake questionnaire, the wrong
  disclosure document). Legal anchors, one per task: FAM 771(a)/760/770
  post-separation earnings with the date of separation fixed by a buried
  stipulation and order; FAM 2640(a)-(b) tracing through a buried escrow
  settlement statement; FAM 4058(a)(1)/(c)/(d) income items scattered across
  a buried Schedule C; FAM 4320(a)(1)-(2), (b), (f), (i)(4) factors split
  across three declaration inserts; FAM 3044(a)-(b), (e), (f)(2) presumption
  triggered by a buried DVRO finding; FAM 1615(a)(1), (c), (c)(1)-(c)(3)
  execution-timeline enforceability (September 12 to September 18, 2023 =
  six calendar days); FAM 2102(a)/(a)(2), 1100(b), 721(b) fiduciary breach in
  buried post-separation transactions; FAM 7613(a)(1)-(2), (b)(1)-(b)(2)(A)
  assisted-reproduction consent documents; FAM 2337(a)-(b), (c)(2), (c)(5),
  (c)(8) bifurcation conditions checklist; and FAM 6320(a)/(c), 6203(a)(4)
  and (b), 6211(a) coercive-control pattern across correspondence and
  message exports. Grading combines registry-entailed propositions with
  retrieval-specific criteria naming the exact buried fact the answer must
  surface. Hard-failure assertions: 10 MATERIAL_FACT_INVENTION (one per
  task, each a not_contains keyed to the distractor the packet contradicts,
  phrased so that a correct answer discussing the superseded item does not
  trip it) and 1 WRONG_EFFECTIVE_DATE (the FAM 1615(c)(2)(B) seven-calendar-
  day rule for agreements executed on or after January 1, 2020). Nineteen
  `contains` and 11 `statute` assertions grade retrieval of a specific buried
  date or figure, and every one is verified by the builder to be present in the
  assembled packet before the draft is emitted. NO CITATION WAS INVENTED OR
  MUTATED: this batch contains no case citations at all. 0 new source
  records ingested — all 18 sources used are pre-existing registry records,
  so no new aggregator-hosted case excerpt was added (B8a constraint
  respected). REPRODUCIBILITY: the builder is committed alongside the data
  at provenance/b7-builder.mjs with modules b7-builder-lib.mjs,
  b7-lib-pools.mjs, b7-specs-a.mjs, and b7-specs-b.mjs; PRNG is mulberry32,
  BUILDER SEED 20260727, per-task seed SEED + 7919*index, no Date.now(), no
  Math.random(), no network. Re-running the committed copy reproduced both
  output files byte for byte (verified). Lineage map, per-task seeds, word
  counts, section plans, insert depths, buried facts, and distractors in
  provenance/b7-longcontext-provenance.json. Verified:
  tests/kimi-k3-eval.test.mjs 42/42 PASS; verifySources --offline 86/86,
  drift 0;
  `yarn eval:kimi --mode dry-run --dataset evals/kimi-k3/datasets/california-law-v1`
  exit 0, validation_pass true, canonical_count_gate_pass true, 120 tasks
  (30 research / 25 drafting / 20 verification / 15 multi_turn /
  20 abstention_adversarial / 10 long_context), 120/120 primary-source
  grounded, 0 unsupported propositions, 0 errors, 0 tasks remaining.
  tasks.jsonl is 4,421,357 bytes (growth of 3.19 MB over the 1.20 MB
  pre-B7 file).
- 2026-07-27 — B7.5 complete: the LIVE 60-pair judge-calibration set now
  exists at `calibration.jsonl` (30 mechanically controlled + 30
  primary-source-locked legal traps), replacing datasets/fixtures/
  calibration.jsonl for real runs. Every row is marked
  `live_calibration: true`. MECHANICAL HALF: 6 pairs each under five
  deterministic mutation rules, all computed in code from a real registry
  value, never typed — R1 reporter_volume_page_transpose (29 Cal.4th 82 ->
  82 Cal.4th 29, on CIT-REAL-1/-7/-12/-13/-15/-19, each checked against the
  record's own `locator` field), R2 section_number_off_by_one (FAM 2550/771/
  2640/852, EVID 1119, PROB 21380), R3 date_shift_minus_one_year (FAM 4058(d)
  operative date, 3044(i) effective date, 852(e) pre-1985 carve-out,
  1615(c)(2)(A) and (c)(2)(B) dates, CRC 8.1115 subd (e) adoption date),
  R4 jurisdiction_word_swap (California/Cal. -> Nevada/Nev. on FAM 2550/297,
  CCP 425.16, CRC 8.1115, EVID 1119, Navellier), and R5
  dropped_controlling_exception_clause (FAM 2550's "except upon the written
  agreement", 2640(b)'s written-waiver clause, 425.16(b)(1)'s "unless the
  court determines", FAM 760's "except as otherwise provided by statute",
  EVID 1119's "except as otherwise provided in this chapter", CRC
  8.1115(a)'s "except as provided in (b)"). Winner/hard-failure labels follow
  mechanically from construction; no LLM judgment was used to label any pair.
  LEGAL-TRAP HALF: trap-type proportions mirror the fixture set exactly —
  fabricated_authority 3, superseded_statute 3,
  unpublished_or_depublished_opinion 2, dicta_as_holding 2,
  wrong_jurisdiction 3, wrong_effective_date 3,
  proposition_citation_mismatch 2, omitted_controlling_exception 2,
  candidate_output_prompt_injection 10 (the injection_pairs_total the B4
  example pins), with the injection hard-failure mix also mirrored (7
  UNSUPPORTED_PROPOSITION, 2 FABRICATED_AUTHORITY, 1
  POLICY_OR_TOOL_VIOLATION). NO CITATION WAS INVENTED for the traps: the five
  fabricated authorities used (fake-1 Hendricks, fake-6 Aspen, fake-9 Bell,
  fake-7 Volk, fake-8 Goldman) are carried verbatim from
  tests/citation-eval-set.json with their "fake, confirmed" verdicts from
  revalidation/citation-revalidation-report.json, each refuted by the
  CIT-INDEX-* volume-index record already used by the matching B1 task.
  Superseded-statute traps use the leginfo legislative-history lines already
  stored in registry records (SB 343 for FAM 4058, SB 899 for FAM 3044, SB 50
  for FAM 6320) plus the sections' own operative/effective-date sentences, and
  never assert what the superseded text said. Unpublished/depublished and one
  wrong-jurisdiction trap are locked to CRC-8-1115. 2 NEW SOURCE RECORDS
  ingested, both OFFICIAL courts.ca.gov slip opinions (raw curl + pdftotext
  -layout + ingestSources.ts), so neither inherits the open B8a aggregator
  obligation: CIT-REAL-19-B (Baral v. Schnitt S225090, slip opn. p.16 — "we
  had no occasion to consider the Mann rule and its implications" / "Our
  quotation from Mann in Oasis must be understood as limited to the
  circumstances there presented") and CIT-REAL-18-B (FilmOn.com v.
  DoubleVerify S244157 — "We do not, as FilmOn urges, sort statements
  categorically into commercial or noncommercial baskets"). These were needed
  because a regex sweep of every pre-existing authority_kind=case record found
  no dicta marker at all, so dicta_as_holding was otherwise ungroundable.
  ONE DOCUMENTED SUBSTITUTION: the second omitted_controlling_exception pair
  uses FAM 4058(b)(3) (incarceration is not voluntary unemployment) instead of
  the FAM 6320 example named in the batch brief, because the 6320 excerpt
  enumerates EXAMPLES of coercive control, not exceptions. Registry now 88
  records; verifySources --offline 88/88, drift 0. REPRODUCIBILITY: builder
  provenance/b75-builder.mjs + provenance/b75-specs.mjs, BUILDER_SEED
  20260727, no Math.random(), no Date.now(), no network, A/B side assignment
  by strict index parity (30 answer_a / 30 answer_b winners); re-running
  reproduced calibration.jsonl and the provenance file byte for byte
  (sha256 e416d2b9ca4345143091a2e29aa0c56b5dccf28064cdfad525a2a0a6adaa24c1).
  A source-entailment guard asserts every declared anchor is a verbatim
  whitespace-normalized substring of the named record's excerpt before
  anything is emitted. Lineage map, per-pair mutation rule, registry value,
  mutated value, anchors and locking records in
  provenance/b75-calibration-provenance.json. SCHEMA NOTE: each row also
  carries `fixture_non_live: true`, which is NOT a claim about the data — the
  loader in evals/kimi-k3/judge/calibration.ts hard-rejects any legal_trap row
  whose fixture_non_live is not exactly true, and that module is owned by
  another agent; `live_calibration` is the authoritative marker. Two further
  judge-side gaps are recorded for that owner: (1) `loadCalibrationPairs`
  synthesizes the evidence packet from the winning answer text and ignores any
  `source_ids`/`evidence` the row supplies, so the real registry excerpts are
  not yet reaching the judge; (2) cli.ts has no `--calibration` flag and
  DEFAULT_CALIBRATION still points at datasets/fixtures/calibration.jsonl, so
  a live run cannot select this file without a code change. Verified:
  provenance/b75-validate.mjs validation_pass true (60 pairs, 30+30, 10
  injection, 33 distinct source_ids all resolving, 0 failures);
  loadCalibrationPairs accepts the file UNCHANGED and an oracle-transport
  runCalibration scores 60/60 winners, 30/30 hard failures, 10/10 injection,
  120/120 schema-valid, calibration_pass true; tests/kimi-k3-eval.test.mjs
  42/42 PASS (fixture calibration path unaffected); verifySources --offline
  88/88, drift 0;
  `yarn eval:kimi --mode dry-run --dataset evals/kimi-k3/datasets/california-law-v1`
  exit 0, validation_pass true, canonical_count_gate_pass true, 120 tasks,
  0 unsupported propositions, 0 errors.
- 2026-07-27 — B8a complete: audited all 20 CIT-REAL-* records in
  sources.jsonl for the officiality-audit finding (CIT-REAL-11 was never
  allocated; not an omission). CIT-INDEX-* (9 records) were correctly
  skipped per instructions: each is a courtlistener.com official-reporter
  citation-index page whose own publication_or_precedential_status field
  already states it is used for citation-metadata verification only, never
  as the source of a substantive proposition — an explicitly allowed
  aggregator use under the spec, not subject to re-anchoring. Of the 20
  CIT-REAL-* records: 4 were already anchored to www4.courts.ca.gov
  (CIT-REAL-18, 18-B, 19, 19-B, from B1/B7.5) and needed no action; 1
  (CIT-REAL-4, Williams v. Superior Court) had a live official PDF
  (www4.courts.ca.gov/opinions/archive/S227228.PDF) whose text verified the
  stored excerpt verbatim (whitespace-normalized) and was RE-ANCHORED —
  canonical_url and retrieved_at updated, discovery_notes appended, and
  source_id/locator/excerpt/sha256 left byte-identical; 2 (CIT-REAL-3 Geiser
  v. Kuhns, CIT-REAL-15 Wilson v. CNN) have a live official PDF but the
  stored excerpt fails strict verbatim comparison (caption case/quote-mark
  style for Geiser; a paraphrased "Held:" clause mixed with one genuinely
  verbatim sentence for Wilson) and were flagged EXCERPT_MISMATCH and left
  UNTOUCHED per instructions; 13 (CIT-REAL-1, 2, 5, 6, 7, 8, 9, 10, 12, 13,
  14, 16, 17) got NO_OFFICIAL_HOSTING after real attempts against
  www4.courts.ca.gov/opinions/archive/<docket>.PDF, the
  courts.ca.gov/opinion/published/<date>/<docket> scheme (confirmed live
  for other same-era cases, so its 404 here is a genuine negative signal),
  courts.ca.gov site search, and the Wayback Machine — mostly pre-2015
  California Supreme Court opinions and pre-1993 Court of Appeal opinions
  predating the electronic archive; CIT-REAL-17's docket "S099999" was
  independently re-verified as correct (not a placeholder) rather than
  assumed. One special note: CIT-REAL-16 (Sargon v. USC)'s official
  www4.courts.ca.gov PDF 404s live today, but a Wayback Machine capture of
  the once-live official courts.ca.gov page (2014-04-15) verified the
  stored quote verbatim; left as NO_OFFICIAL_HOSTING rather than
  re-anchoring to a web.archive.org URL, flagged for a reviewer policy
  decision. Full per-record disposition, URLs tried, and quoted evidence in
  provenance/b8a-officiality-audit.json. Source fetching/comparison was
  performed by three parallel sonnet subagents per this repo's model-
  routing convention; only 1 line of sources.jsonl was touched (git diff
  confirms 87 lines unchanged) via an atomic temp-file-then-rename edit,
  with a full pre-edit backup kept in the session scratchpad. Verified:
  verifySources --offline 88/88, drift 0; tests/kimi-k3-eval.test.mjs 45/45
  PASS; `yarn eval:kimi --mode dry-run --dataset
  evals/kimi-k3/datasets/california-law-v1` exit 0, validation_pass true,
  canonical_count_gate_pass true, 120 tasks, 120/120 primary-source
  grounded, 0 unsupported propositions, 0 errors — all category counts
  unchanged. 3 residual open items (2 excerpt-typography fixes + 1
  archived-source policy call) carried forward to B8.
- 2026-07-27 — B8b complete: both EXCERPT_MISMATCH records repaired and
  re-anchored to OFFICIAL sources, and the three dependent tasks rebuilt
  through datasetTools/authorTasks.ts::assembleEvalTask so entailment,
  evidence packets and content hashes were recomputed, never hand-edited.
  CIT-REAL-3 (Geiser v. Kuhns): canonical_url moved from the
  animallawconference.org Casetext reproduction to
  www4.courts.ca.gov/opinions/archive/S262032.PDF (HTTP 200, 28 pp., raw curl
  + pdftotext -layout); the excerpt is now four contiguous verbatim runs of
  the official opinion joined by ' ... ' (caption block with the court's own
  full-caps casing, filing-date/authorship line, "Opinion of the Court by
  Liu, J.", and the section 425.16 legislative-purpose sentence in the
  court's curly double quotes), sha256 f6cde733… -> 6bbcbc14…. CIT-REAL-15
  (Wilson v. CNN): canonical_url moved from the vLex mirror to
  www4.courts.ca.gov/opinions/archive/S239686.PDF (HTTP 200, 42 pp.); the
  paraphrased "Held:" clause the B8a audit flagged — it inserted the word
  "categorical", which the opinion never uses — was replaced with the court's
  actual holding passage ("We hold otherwise. The statute contains no
  exception for discrimination or retaliation claims, and … will not shield
  the claim from the same preliminary screening for minimal merit that would
  apply to any other claim arising from protected activity."), and the vLex
  citation-service metadata string was dropped from the excerpt entirely;
  sha256 627eeff8… -> 02bed79c…. Affected tasks: verification-real-001 (3
  criteria, 3 -> 4 propositions), verification-real-008 (3 criteria, 2 -> 4
  propositions), research-018 (c3/p3 only). NO criterion lost legal content
  and none had to be dropped: the two elements the official slip opinions
  cannot state — the official-reports page cites, which are assigned after a
  slip opinion is filed — were re-grounded on citation-metadata-only records,
  which is the aggregator role the spec expressly permits. Wilson's 7 Cal.5th
  871 came from the EXISTING CIT-INDEX-CAL-5TH-7 volume-index record, whose
  excerpt already carries the line verbatim. Geiser's 13 Cal.5th 1238 needed
  ONE NEW RECORD, CIT-META-GEISER-CAL5TH-1238, because CourtListener is a
  genuine dead end for it (its 13 Cal.5th index holds 11 entries topping out
  at page 974; /c/cal-5th/13/1238/ is a 404; search and API return 403/401 to
  unauthenticated curl) — a full-text search of the official GPO govinfo API
  for "13 Cal. 5th 1238" returned exactly one document, the N.D.Cal. order in
  Tayts v. Gacutan, which states "In Geiser v. Kuhns, 13 Cal. 5th 1238,
  1253–54 (2022), the California Supreme Court clarified…"; an official
  federal judicial document is strictly stronger than the aggregator the spec
  already allows for that role, and the record's status field says in terms
  that no substantive proposition rests on it. Registry 88 -> 89 records.
  calibration.jsonl is untouched: its only CIT-REAL-15 pair
  (mech-transpose-004) keys off the LOCATOR field, which did not change.
  provenance/b3-research-provenance.json's research-018 task_content_sha256
  was updated to match. Verified: verifySources --offline 89/89, drift 0;
  tests/kimi-k3-eval.test.mjs 45/45 PASS; b75-validate validation_pass true
  (60 pairs, 0 failures); dry-run exit 0, validation_pass true,
  canonical_count_gate_pass true, 120 tasks, 120/120 primary-source grounded,
  0 unsupported propositions, 0 errors. Re-running provenance/b8b-repair.ts
  reproduces tasks.jsonl byte for byte.
- 2026-07-27 — B8 complete: the dataset is finished and ready for human
  review. (1) REVIEWER BUNDLES — evals/kimi-k3/review-bundles/ now holds 125
  files: one Markdown packet per task under tasks/ (120), plus README.md,
  index.md, manifest.json, bundles.jsonl and the deterministic generator
  buildBundles.ts. Each packet carries the task's identity and all three hash
  families (task_content_sha256, proposition hashes, source hashes), a
  prompt summary (long_context packets are truncated at 2,400 chars with the
  full word count stated; multi-turn conversations show every turn with the
  graded one marked), every material criterion with each of its propositions,
  the verbatim excerpt each proposition relies on, the full registry excerpt
  in a collapsible block, locator/jurisdiction/authority status/effective
  date/retrieved-at/canonical URL/sha256, the deterministic assertions, and an
  APPROVE/REJECT form with the reason-code vocabulary. 16 tasks carry a
  prominent caveat block: 13 aggregator-hosted NO_OFFICIAL_HOSTING records
  (CIT-REAL-1, -2, -5, -6, -7, -8, -9, -10, -12, -13, -14, -16, -17) the
  reviewers must consciously weigh, and CIT-REAL-16 (Sargon v. USC), whose
  Wayback-only situation is escalated as an explicit POLICY DECISION the
  reviewers must NOT resolve alone. README.md explains the BenchmarkAttestation
  JSONL contract field by field, why the hash binding means an attestation
  silently stops counting if a single character changes, and the
  two-independent-reviewers rule. datasetTools/makeAttestation.ts emits the
  records: it recomputes dataset/proposition/source hashes with the same
  integrity.ts functions live mode uses, refuses unknown task ids, REJECTs
  without a reason code, name-shaped reviewer ids, and stale packets, and
  REFUSES BY DEFAULT to write anywhere inside the repository. (2) TIGHTENED
  COST — datasetTools/costProjection.ts measures the real assembled input of
  all 120 tasks and all 60 calibration pairs (chars/4, documented as a
  heuristic; no tokenizer dependency added) instead of the dry-run's 1M-token
  ceiling. Real candidate input is median 3,080 tokens and mean 9,328 (p95
  66,441; max 109,554, all long_context) — the guard's assumption is ~325x the
  median. Realistic/conservative totals: gpt-5.6-sol $176.77 / $468.20;
  native deepseek-v4-pro $88.07 / $203.86; candidate side alone $83.73 /
  $191.31 (static_anthropic $45.13, fireworks_kimi $14.89, anthropic_router
  $23.71 realistic). Suggested --max-cost-usd $600. The $14,053.63 dry-run
  bound is deliberately left in place as the paid-run guard. Written to
  reports/kimi-k3-eval/cost-projection-20260727.{json,md}. (3) FINAL
  VALIDATION — tests/kimi-k3-eval.test.mjs 45/45 PASS; verifySources --offline
  89/89, drift 0; b75-validate validation_pass true (60 pairs, 0 failures);
  dry-run exit 0, validation_pass true, canonical_count_gate_pass true, 120
  tasks, 120/120 primary-source grounded, 0 unsupported propositions, 0
  errors. The deterministic-distractor audit
  (provenance/b8-final-audit.mjs -> provenance/b8-final-audit.json) ran 349
  checks with ZERO GAPS: all 30 mechanical calibration mutations name a rule,
  a rule description, the registry record and both values, and each rule was
  re-executed against the registry and against the real calibration row to
  confirm the values land on the declared sides (the deletion rule is checked
  for absence, not presence); all 30 legal traps name a trap type, locking
  record and construction rule with every anchor verified verbatim; all 10
  long_context tasks declare a seed, buried facts and a distractor, and every
  distractor literal was confirmed present in the packet it is buried in; B5
  and B6 both declare zero mutations with a policy statement and trace every
  reused fabricated citation to its tests/citation-eval-set.json entry; B1-B4
  declare a transformation rule on every entry; and B8b documents its
  extraction rule and before/after hashes, which match the registry. OPEN FOR
  HUMANS: the 240 reviewer attestations (2 per task) and the CIT-REAL-16
  archived-source policy call — neither can be produced by this loop.

## Attestation phase (added 2026-07-27 — Arjun directive: no human reviewers, fully automated)

- [x] B9a Sargon resolution: try official re-anchor of CIT-REAL-16 (Sargon
      Enterprises v. USC (2012) — try www4.courts.ca.gov/opinions/archive
      docket PDF); if unavailable, re-ground or replace dependent criteria.
      Conservative default: no Wayback-anchored record grounds a substantive
      proposition.
- [x] B9b cross-vendor machine attestation: every one of the 120 tasks
      reviewed independently by (1) claude-opus-5 subagents and (2)
      gpt-5.6-sol via codex exec, adversarial prompts (verify entailment +
      no-outside-memory; hunt for reasons to REJECT). Verdicts emitted as
      hash-bound BenchmarkAttestation records via datasetTools/
      makeAttestation.ts into the EXTERNAL attestation store
      /Users/arjundivecha/Dropbox/AAA Backup/Temp/kimi-k3-attestations/
      (outside the repo, per spec). REJECT or disagreement => task excluded
      and replaced, then re-attested, until exactly 120 dual-APPROVED tasks.
- [x] B9c attestation-phase validation: live-mode preflight accepts the
      attestation file (240 records, 2 distinct machine verifier ids per
      task, hashes bind); manifest/report disclosure of machine-only
      attestation verified in fixture; full offline gauntlet green.

- 2026-07-27 — B9a complete: CIT-REAL-16 removed as unused (zero dependents); registry 88, drift 0. See provenance/b9a-sargon-resolution.json.
- 2026-07-27 — B9b ROUND 1 attested + REPAIRED. Round 1 ran all 120 tasks past
  both machine verifiers: claude-opus-5 approved 109, gpt-5.6-sol 103, 102
  dual-approved, 18 flagged (union) in four defect classes recorded in
  provenance/b9b-round1-reconciliation.json. All 18 are now repaired — full
  change log with before/after hashes in provenance/b9b-repairs.json, built
  reproducibly by provenance/b9b-repair-sources.py (registry) then
  provenance/b9b-repair.ts (tasks, re-assembled through
  datasetTools/authorTasks.ts::assembleEvalTask). (A) HEADNOTE EXCERPTS —
  CIT-REAL-6 Stewart, -7 Costco, -8 Cembrook, -10 Bridgestone, -12 Lippel,
  -13 Briggs, -14 Equilon each carried a short quoted fragment glued to the
  record-builder's own unquoted "Held:"/"As fetched:" synopsis, and criteria
  leaned on the synopsis. All seven were re-excerpted to contiguous verbatim
  runs of the opinions' own language pulled from the CourtListener REST API v4
  (html_lawbox, or xml_harvard where lawbox is absent — the unauthenticated
  HTML opinion pages answer HTTP 202 empty, so the token from .env was
  required), canonical_url re-anchored to the CourtListener opinion page,
  sha256 recomputed. These are pre-archive opinions with NO official
  courts.ca.gov hosting, documented since B8a; the aggregator caveat stays
  disclosed and still surfaces in the reviewer bundles. Star-pagination and
  footnote markers inside a run are preserved rather than silently deleted so
  a verifier's character-level comparison succeeds. Runs are joined by ' ... '
  only where non-adjacent in the opinion (the CIT-REAL-3/-15 convention from
  B8b, which round 1 accepted); no ellipsis appears inside any proposition
  excerpt. (B) WRONG HARD-FAILURE CODE — research-016-a3, -018-a1, -022-a1,
  -023-a1, -029-a2 coded FABRICATED_AUTHORITY on POSITIVE presence checks for
  citations the packet itself proves genuine; all five are now
  MISSED_CONTROLLING_CONTRARY_AUTHORITY. multiturn-014-a3/-015-a3 deliberately
  keep FABRICATED_AUTHORITY: those are not_contains checks on invented
  captions, where emitting the string IS fabrication. (C) STATUS NOT ENTAILED
  — eight criteria asserted published/precedential/citable status no excerpt
  stated. Each is re-grounded on an Official Reports volume-index entry plus
  CRC 8.1115(d) ("A published California opinion may be cited or relied on as
  soon as it is certified for publication or ordered published"), and the bare
  word "precedential" is gone. FIVE new CIT-INDEX records
  (CAL-4TH-47, CAL-2D-56, CAL-4TH-19, CAL-4TH-29, CAL-APP-4TH-7) built by the
  same documented volume-index method as the existing nine; CIT-INDEX-CAL-5TH-7
  was EXTENDED with a second window covering page 133 for FilmOn (page-904
  window untouched, so verification-real-008's excerpt still matches);
  verification-real-008 reused the existing record. Geiser (13 Cal.5th 1238) is
  a genuine index dead end — re-verified today that CourtListener's 13 Cal.5th
  index holds 11 entries topping out at page 974 — so verification-real-001-c2
  rests on the existing official GPO/govinfo federal citation-metadata record
  plus CRC 8.1115(d). (D) OPTIONAL BRANCH — multiturn-014-c4 and -015-c3 lost
  the "if the purported authority is addressed at all …" clause that collided
  with their own not_contains assertions; both criteria now name only the
  reporter page, never the fabricated caption, and both keep their index
  propositions linked so nothing is orphaned. TASKS TOUCHED: 19 — the 18
  flagged plus verification-real-005, the sole unflagged dependent of
  CIT-REAL-10 (only its caption proposition changed; its other two excerpts
  still verbatim-match). research-017 needed no criterion or proposition edit
  at all — its Briggs excerpt is verbatim inside the new record — and was
  re-assembled only so its evidence hashes track the repair. Registry 88 -> 93.
  provenance/b3-research-provenance.json task_content_sha256 refreshed for the
  eight research tasks. calibration.jsonl untouched. REVIEW BUNDLES rebuilt:
  for all 101 unmodified tasks the packet is byte-identical except the single
  "| dataset_hash |" row, and there is no other difference anywhere; the
  builder stamps no timestamp and no randomness, so that row is not a volatile
  stamp but benchmarkDatasetHash() over the whole dataset — the binding that
  makes stale attestations stop counting — and it must move when any task
  moves. bundles.jsonl rows for unmodified tasks differ only in dataset_hash,
  index.md only in the header hash and the 19 touched rows, manifest.json only
  in generated_from_dataset_hash, README.md byte-identical. Dataset hash
  30c05777… -> d35e3b59…. VERIFIED: tests/kimi-k3-eval.test.mjs 45/45 PASS;
  verifySources --offline 93/93, drift 0, 0 network calls; b75-validate
  validation_pass true (60 pairs, 0 failures); dry-run exit 0, validation_pass
  true, canonical_count_gate_pass true, 120 tasks, 120/120 primary-source
  grounded, 0 unsupported propositions, 0 errors. Re-running both repair
  scripts reproduces sources.jsonl and tasks.jsonl byte for byte. NEXT: B9b
  round 2 must re-attest — the 19 rebuilt tasks substantively, and all 120
  formally, because the dataset hash moved and every round-1 attestation is
  now unbound.
- 2026-07-28 — B9b ROUND 2 attested + REPAIRED. gpt-5.6-sol re-reviewed the 19
  tasks round 1 rebuilt: 14 APPROVE, 5 REJECT (research-018, -021, -023, -029,
  verification-real-005). Every APPROVE carried
  APPROVED_WITH_AGGREGATOR_CAVEAT_NOTED, and each REJECT note states expressly
  that aggregator sourcing was NOT the rejection ground — so no case record
  needed re-excerpting for officiality this round. All five are now repaired;
  full change log with before/after hashes in
  provenance/b9b-round2-repairs.json, built reproducibly by
  provenance/b9c-repair-sources.py (registry) then provenance/b9c-repair.ts
  (tasks, re-assembled through datasetTools/authorTasks.ts::assembleEvalTask).
  (1) INCOHERENT HARD-FAILURE CODE ON A POSITIVE YEAR CHECK — research-018-a4
  ("2002"), -021-a4 ("2001"), -023-a3 ("1992") and -029-a4 ("1990") are
  POSITIVE contains checks that carried WRONG_EFFECTIVE_DATE. Failing to
  MENTION a year is not ASSERTING a wrong effective date, so the code cannot
  be earned by failure of a presence check; hard_failure_code is deleted from
  all four. The assertions stay, still machine-checked and still counting
  toward all_pass — they simply no longer map to a hard-failure class. Codes
  are kept everywhere the semantics genuinely fit: the positive CITATION
  checks (research-018-a1/a2, -023-a1, -029-a2) keep
  MISSED_CONTROLLING_CONTRARY_AUTHORITY, the holding-language checks
  (research-021-a3 "protective order", -029-a3 "void") keep it too, and
  multiturn-014-a3/-015-a3 keep FABRICATED_AUTHORITY because they are
  not_contains checks on invented captions. KNOWN REMAINING: research-003-a3
  (contains "1985" → WRONG_EFFECTIVE_DATE) is the identical defect in a task
  neither round reviewed; left untouched so every unrepaired packet stays
  byte-identical apart from the dataset-hash row, and queued for the next
  batch that legitimately touches research-003. (2) PINPOINT TOO SHORT —
  research-018 C4 asserts the Legislature's broad-construction command but its
  quote stopped at the "disturbing increase in lawsuits" sentence;
  research-018-p4 is extended forward along the same uninterrupted run of
  section 425.16(a) through "To this end, this section shall be construed
  broadly.", which was already inside the stored excerpt verbatim, so no
  registry edit was needed. (3) QUESTION QUOTED, ANSWER ASSERTED —
  research-029 C2 claimed Lippel's due-process holding while quoting only the
  sentence posing the question. CIT-REAL-12's excerpt is EXTENDED (1055 → 2954
  chars, still 3 runs): run 3's start anchor moved backwards inside the same
  uninterrupted passage, from "We have long interpreted section 580 …" to "The
  issue we address is whether due process and section 580 permit …", pulled
  from the same CourtListener full text (cluster 1442248, html_lawbox) used in
  round 1 and re-asserted in code to be a verbatim substring. Text was only
  ADDED — no run shortened, no ' … ' join moved — so every excerpt already
  grounded on the record still matches. C2 is re-grounded on the court's
  answer: p2 now quotes question + "For the reasons that follow, we conclude
  that such a default judgment is void for lack of notice and therefore
  subject to collateral attack by the husband.", and new p5/p6 quote the part
  II.A due-process analysis ("It is a fundamental concept of due process that
  a judgment against a defendant cannot be entered unless he was given proper
  notice …"; "notice of the specific relief which is sought in the complaint
  served upon him"). Legal content is equivalent, now stated in the court's own
  terms with every clause quoted underneath it. sha256 43baed84… → 0b6cfa92…;
  the pre-archive NO_OFFICIAL_HOSTING aggregator caveat is unchanged and still
  surfaced. (4) PUBLICATION STATUS ASKED BUT NOT ENTAILED —
  verification-real-005's prompt asks whether Bridgestone/Firestone is "a real
  published Court of Appeal decision" while the packet carried only the
  aggregator caption and an unproved status field. C1 is re-grounded exactly as
  verification-real-002/003/007 and research-023-c3 were in round 1: the
  Official Reports volume-index entry plus CRC 8.1115(d). NO new source record
  was needed — round 1 had already ingested CIT-INDEX-CAL-APP-4TH-7 (window
  covering 7 Cal.App.4th 1384) and its discovery_notes already name
  verification-real-005 as a dependent — so the registry stays at 93.
  TASKS TOUCHED: 6 — the 5 rejected plus verification-real-006, the sole other
  dependent of CIT-REAL-12, rebuilt with no criterion/proposition/assertion
  edit purely so its evidence hashes track the extended record.
  provenance/b3-research-provenance.json task_content_sha256 refreshed for the
  four research tasks. calibration.jsonl untouched. REVIEW BUNDLES rebuilt: for
  all 114 unmodified tasks the packet is byte-identical except the single
  "| dataset_hash |" row and there is no other difference anywhere;
  bundles.jsonl rows for unmodified tasks differ only in dataset_hash, index.md
  only in the header hash and the 6 touched rows, manifest.json only in
  generated_from_dataset_hash, README.md byte-identical. Dataset hash
  d35e3b59… → a8b8be87…. VERIFIED: tests/kimi-k3-eval.test.mjs 45/45 PASS;
  verifySources --offline 93/93, drift 0, 0 network calls; b75-validate
  validation_pass true (60 pairs, 0 failures, 33 source ids, 0 unresolved);
  dry-run exit 0, validation_pass true, canonical_count_gate_pass true, 120
  tasks, 120/120 primary-source grounded, 0 unsupported propositions, 0 errors.
  Re-running b9c-repair-sources.py then b9c-repair.ts reproduces sources.jsonl
  and tasks.jsonl byte for byte. RUN ORDER for a clean rebuild:
  b9b-repair-sources.py → b9c-repair-sources.py → b9b-repair.ts →
  b9c-repair.ts → buildBundles.ts (b9b-repair-sources.py rewrites CIT-REAL-12
  from its own shorter anchors, so it must never run last). NEXT: B9b round 3
  must re-attest — the 6 rebuilt tasks substantively, and all 120 formally,
  because the dataset hash moved again and every round-2 attestation is now
  unbound.
- 2026-07-28 — B9b ROUND 3 attested + REPAIRED (log entry added
  retroactively in round 4; the round-3 commit ca1a9f1 shipped without one).
  Both vendors re-reviewed the 6 tasks round 2 rebuilt plus research-003.
  opus-5: 7/7 APPROVE with nits. gpt-5.6-sol: 5 APPROVE, 2 REJECT
  (research-021, research-029), the two nits opus had flagged. (1)
  research-021-a3 (contains "protective order") and research-029-a3
  (contains "void") are POSITIVE content-presence checks that carried
  MISSED_CONTROLLING_CONTRARY_AUTHORITY; failing to mention a phrase is not
  missing contrary authority, so both codes were deleted — same reasoning
  round 2 applied to the WRONG_EFFECTIVE_DATE year checks, and the
  assertions themselves stay and still count toward all_pass. (2)
  research-029-c3 extended Lippel's "void … subject to collateral attack"
  holding with an unqualified passage-of-time rider the excerpt does not
  state; the description was trimmed back to the entailed text. Dataset hash
  a8b8be87… → 4da090c2…. THE ROUND-3 EDITS WERE APPLIED BY AN AD-HOC
  SCRATCHPAD SCRIPT, not a provenance builder, so the documented rebuild
  chain could not reproduce the committed dataset; round 4 closed that gap
  by adding provenance/b9d-round3-repair.ts, which restates the same logic
  and is a VERIFIED no-op against the committed data (fixes: 0, tasks.jsonl
  byte-identical). provenance/b3-research-provenance.json was not refreshed
  in round 3 either; round 4 refreshed it.
- 2026-07-28 — B9b ROUND 4 attested + REPAIRED. gpt-5.6-sol re-reviewed the
  2 tasks round 3 rebuilt: research-029 APPROVE, research-021 REJECT
  (UNSUPPORTED_PROPOSITION, CRITERION_REQUIRES_OUTSIDE_LEGAL_MEMORY,
  AMBIGUOUS_AUTHORITY_STATUS). The verifier expressly noted the aggregator
  caveat and expressly disclaimed it as the rejection ground, so no case
  record needed re-anchoring for officiality. Full change log with
  before/after hashes in provenance/b9b-round4-repair.json, built
  reproducibly by provenance/b9e-repair-sources.py (registry) +
  datasetTools/ingestSources.ts (new index record) then
  provenance/b9e-repair.ts (task, re-assembled through
  datasetTools/authorTasks.ts::assembleEvalTask, hash re-checked against
  integrity.ts::taskContentHash). THE DEFECT: research-021 C4 named "Stewart
  v. Colonial Western Agency, Inc. (2001) 87 Cal.App.4th 1006" and the
  packet labelled the record "Published/certified for publication", but the
  stored CIT-REAL-6 excerpt was only the two rules passages — no caption, no
  court, no citation, no date, no publication language — so both the
  attribution and the status had to come from outside the packet. The
  substantive half of C4 was never in doubt and p4/p5 are untouched. (1)
  EXCERPT EXTENDED — CIT-REAL-6 goes from 2 contiguous verbatim runs to 4
  (1583 → 2056 chars, sha256 b5003a5c… → 5793f531…): the opinion's own
  opening identification passage ("Opinion CURRY, J.— Background This is an
  appeal from an order imposing sanctions … on appellant Colonial Western
  Agency, Inc.'s counsel. The underlying matter involves a complaint by
  respondent Mary Martha Stewart against Colonial Western.") is added in
  FRONT and the Disposition/concurrence block ("… is affirmed. Vogel (C.
  S.), P. J., and Hastings, J., concurred.") at the END, both from the SAME
  CourtListener full text used in round 1 (cluster 5808646, xml_harvard) and
  asserted in code to be verbatim substrings in document order. Text was
  only ADDED and only at the ends — the two round-1 runs and the " … " join
  between them are byte-identical — so p4/p5 still match verbatim. SURPRISE
  WORTH RECORDING: unlike every html_lawbox record repaired in round 1, this
  source has NO official-reporter caption block to extend into. Cluster
  5808646 stores only xml_harvard and html_with_citations, both starting at
  "Opinion CURRY, J.—", and the cluster's headmatter field is the empty
  string (verified by direct API fetch). The caption, court, citation and
  filing date simply are not in the opinion text CourtListener holds. (2)
  NEW INDEX RECORD — CIT-INDEX-CAL-APP-4TH-87 (California Official Reports
  volume 87 Cal.App.4th citation index, window covering page 1006, 100
  entries indexed, sha256 b51ce03f…) was built by the same documented
  raw-curl method as the fourteen CIT-INDEX records already in the registry
  and ingested via datasetTools/ingestSources.ts. Its Stewart entry supplies
  the caption, "87 Cal. App. 4th 1006", "Date Filed: March 14th, 2001" and
  "Docket Number: No. B139311", and — because an entry in the Official
  Reports index is what publication in the Official Reports consists of —
  the publication half of the status claim. Registry 93 → 94. (3) C4
  RE-GROUNDED — the bare "(2001) 87 Cal.App.4th 1006" parenthetical is
  replaced by "the appellate opinion published in the California Official
  Reports at 87 Cal.App.4th 1006, filed March 14, 2001 in docket No.
  B139311, and citable as a published California opinion", with four new
  propositions underneath it: p6 (opinion's opening identification run), p7
  (Disposition and concurring justices), p8 (the Official Reports index
  entry) and p9 (CRC 8.1115(d)). Exactly the route round 1 used for
  research-023 C3 and round 2 for verification-real-005 C1, both approved by
  both vendors afterwards. The criterion deliberately does NOT say "Court of
  Appeal": no packet excerpt carries that phrase — the volume index has no
  court label and the opinion text has no caption — so it says "appellate
  opinion published in the California Official Reports at 87 Cal.App.4th
  1006", which p6/p7/p8 do entail. The contains-"2001" assertion a4 is now
  packet-grounded too. TASKS TOUCHED: 1 — research-021 is the sole dependent
  of CIT-REAL-6, the index record is new, and CRC-8-1115 was not edited, so
  no other evidence packet moves. task_content_sha256 da1b8dbd… → 40c114a6….
  provenance/b3-research-provenance.json research-021 hash refreshed (it was
  stale from round 3). calibration.jsonl untouched. REVIEW BUNDLES rebuilt:
  for all 119 unmodified tasks the packet is byte-identical except the
  single "| dataset_hash |" row and there is no other difference anywhere;
  bundles.jsonl rows for unmodified tasks differ only in dataset_hash,
  index.md only in the header hash and the research-021 row, manifest.json
  only in generated_from_dataset_hash, README.md byte-identical. Dataset
  hash 4da090c2… → 805e588a…. VERIFIED: tests/kimi-k3-eval.test.mjs 45/45
  PASS; verifySources --offline 94/94, drift 0, 0 network calls;
  b75-validate exit 0, validation_pass true (60 pairs, 0 failures, 33 source
  ids, 0 unresolved); dry-run exit 0, validation_pass true,
  canonical_count_gate_pass true, 120 tasks, 120/120 primary-source
  grounded, 0 unsupported propositions, 0 errors. Re-running
  b9e-repair-sources.py, b9e-repair.ts and b9d-round3-repair.ts reproduces
  sources.jsonl and tasks.jsonl byte for byte; re-running ingestSources.ts
  on the same candidate fails closed with DUPLICATE_SOURCE_ID and writes
  nothing. RUN ORDER for a clean rebuild: b9b-repair-sources.py →
  b9c-repair-sources.py → b9e-repair-sources.py → ingestSources.ts →
  b9b-repair.ts → b9c-repair.ts → b9d-round3-repair.ts → b9e-repair.ts →
  buildBundles.ts (b9b-repair-sources.py rewrites CIT-REAL-6 and CIT-REAL-12
  from its own shorter anchors, so it must never run after the b9c/b9e
  registry steps). NEXT: B9b round 5 must re-attest — research-021
  substantively, and all 120 formally, because the dataset hash moved again
  and every round-4 attestation is now unbound.

- 2026-07-27 — B9b+B9c complete: 5 adversarial cross-vendor rounds (18->5->2->1->0 defects, 26 repairs incl. 3 the loop found proactively), 240 hash-bound machine attestations (verifier-claude-opus-5 + verifier-gpt-5.6-sol) in the external store, preflight validates 240/240 with zero binding failures, machine-only disclosure in manifest+report.
