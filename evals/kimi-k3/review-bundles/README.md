# Benchmark review — california-law-v1

**For the two independent non-attorney reviewers.** Read this once, then work
through [index.md](index.md).

---

## 1. What you are being asked to do (and what you are not)

You are validating the **benchmark**, not any AI system's answers.

For each of the 120 tasks there is one packet in [`tasks/`](tasks/). Each packet
lists the task's **material criteria** — the things a correct answer must
contain — and, under each criterion, the **atomic propositions** it rests on,
each with the **verbatim excerpt** of the statute, rule, or court opinion it was
taken from, plus that source's locator, jurisdiction, publication/precedential
status, effective date, retrieval time, canonical URL, and SHA-256 hash.

For every material criterion you answer exactly one question:

> **Is this criterion entailed by the excerpt printed underneath it, using
> nothing but the words on this page?**

If yes for every material criterion in the packet → **APPROVE**.
If any criterion needs legal knowledge you brought with you, or the quoted words
do not actually say what the criterion claims → **REJECT**, with a reason code.

You are explicitly **not**:

- judging whether the law is good law today beyond what the excerpt states;
- researching the case or statute yourself;
- scoring, ranking, or even looking at any model's output. There is none in
  these packets, by design.

You do not need to be a lawyer. That is the point: if a criterion can only be
verified by someone who already knows California family law, the criterion is
defective and should be rejected.

## 2. Why two of you

The spec requires **two independent APPROVE attestations from two distinct
reviewers for every task** before a paid canonical run may start. A task with
fewer than two, or with a disagreement between you, is **excluded** and must be
replaced — the dataset cannot reach exactly 120 valid tasks without it.

So: **do not compare notes while reviewing.** Independent means independent. If
you disagree, that is a useful signal, not a failure — the benchmark owner
resolves it, not you.

## 3. Two things that are not clean — you must weigh them

### 3a. Thirteen source records are aggregator-hosted (`NO_OFFICIAL_HOSTING`)

The spec's rule is that official California legislative and judicial sources are
the source of record, and that aggregators (CourtListener, FindLaw, vLex,
scocal.stanford.edu, …) may assist **discovery and citation metadata** but may
never alone establish a substantive proposition.

Thirteen case records still ground their excerpt in an aggregator copy. A real
search was done for each — the courts.ca.gov opinion archive, the
`courts.ca.gov/opinion/published/<date>/<docket>` scheme, courts.ca.gov site
search, and the Wayback Machine — and no live official copy exists. These are
mostly pre-2015 California Supreme Court opinions and pre-1993 Court of Appeal
opinions that predate the electronic archive. Full evidence per record is in
`../datasets/california-law-v1/provenance/b8a-officiality-audit.json`.

The thirteen:

| source_id | case |
| --- | --- |
| `CIT-REAL-1` | Navellier v. Sletten |
| `CIT-REAL-2` | Taus v. Loftus |
| `CIT-REAL-5` | Coy v. Superior Court |
| `CIT-REAL-6` | Stewart v. Colonial Western Agency, Inc. |
| `CIT-REAL-7` | Costco Wholesale Corp. v. Superior Court |
| `CIT-REAL-8` | Cembrook v. Superior Court |
| `CIT-REAL-9` | West Pico Furniture Co. v. Superior Court |
| `CIT-REAL-10` | Bridgestone/Firestone, Inc. v. Superior Court |
| `CIT-REAL-12` | In re Marriage of Lippel |
| `CIT-REAL-13` | Briggs v. Eden Council for Hope and Opportunity |
| `CIT-REAL-14` | Equilon Enterprises, LLC v. Consumer Cause, Inc. |
| `CIT-REAL-16` | Sargon Enterprises, Inc. v. University of Southern California |
| `CIT-REAL-17` | City of Cotati v. Cashman |

Any packet using one of these prints a **⚠ Source caveats** block at the top,
and the index marks the task. **This is a judgement call you are being asked to
make, not a formality.** If you are willing to attest that the quoted words are
the court's words on an aggregator copy, APPROVE and add the reason code
`APPROVED_WITH_AGGREGATOR_CAVEAT_NOTED` so the caveat is on the record. If you
are not, REJECT with `AGGREGATOR_SOURCE_NOT_ACCEPTABLE`.

### 3b. `CIT-REAL-16` (Sargon v. USC) is Wayback-only — needs a policy decision

Its official `courts.ca.gov` PDF returns 404 today. A Wayback Machine capture
of the once-live **official** page (2014-04-15) verified the stored quote
verbatim. The record was deliberately **not** re-anchored to a `web.archive.org`
URL, because whether an archived capture of an official page may serve as a
`canonical_url` is a policy question, not a research question.

**Do not resolve this one yourself.** Record your view in the packet, and flag
it to the benchmark owner. One policy must apply to the whole dataset:

- *"An archived capture of an official page is acceptable as canonical_url"* →
  the record is re-anchored to the Wayback URL and the task stands; or
- *"It is not"* → the task is excluded and replaced.

Two other records were repaired in batch B8b and are now anchored to official
`www4.courts.ca.gov` slip-opinion PDFs: `CIT-REAL-3` (Geiser v. Kuhns) and
`CIT-REAL-15` (Wilson v. CNN). Details in
`../datasets/california-law-v1/provenance/b8b-excerpt-repair.json`.

## 4. The attestation format

Your decision becomes one JSON object per line — the `BenchmarkAttestation`
record the spec defines:

```json
{
  "task_id": "verification-real-008",
  "reviewer_id": "REV-A",
  "reviewed_at": "2026-07-28T00:00:00Z",
  "dataset_hash": "30c057776c31d677b701d0341c8515a66bc8303adae487f9480ec424863b5e07",
  "proposition_hashes": ["032b9478…", "24e6273b…", "94ccf823…", "9f886b44…"],
  "source_hashes": ["02bed79c…", "1a1b9698…"],
  "decision": "APPROVE",
  "reason_codes": ["ENTAILED_AND_SELF_CONTAINED"]
}
```

| field | meaning |
| --- | --- |
| `task_id` | the task you reviewed |
| `reviewer_id` | **opaque** — `REV-A`, `REV-B`. No name, no e-mail, no initials that identify you. This is enforced by the tool. |
| `reviewed_at` | ISO-8601 UTC timestamp |
| `dataset_hash` | hash of the whole 120-task dataset as it stood when you reviewed |
| `proposition_hashes` | hashes of exactly the propositions in your packet |
| `source_hashes` | hashes of exactly the source excerpts in your packet |
| `decision` | `APPROVE` or `REJECT` |
| `reason_codes` | see below |

**Why the hashes matter.** Your attestation is bound to the exact text you read.
If a single character of a criterion, proposition, excerpt, or source record
changes afterwards, the hashes stop matching and your attestation silently stops
counting — the run reports the task as unattested rather than pretending it was
reviewed. You cannot accidentally vouch for text you never saw.

### Reason codes

APPROVE (zero or more):

- `ENTAILED_AND_SELF_CONTAINED`
- `APPROVED_WITH_AGGREGATOR_CAVEAT_NOTED`

REJECT (at least one required):

- `UNSUPPORTED_PROPOSITION` — the excerpt does not say what the proposition claims
- `CRITERION_REQUIRES_OUTSIDE_LEGAL_MEMORY` — you had to know law not on the page
- `STALE_EFFECTIVE_DATE` — the stated effective/operative date is wrong or superseded on the face of the excerpt
- `AMBIGUOUS_AUTHORITY_STATUS` — published/precedential status is unclear
- `FAILED_SOURCE_HASH` — the printed hash does not match the printed excerpt
- `EXCERPT_NOT_VERBATIM` — the "verbatim" excerpt is a paraphrase
- `CRITERION_PROPOSITION_MISMATCH` — the criterion and its proposition are about different things
- `AGGREGATOR_SOURCE_NOT_ACCEPTABLE` — see § 3a
- `ARCHIVED_SOURCE_NOT_ACCEPTABLE` — see § 3b
- `PROMPT_CONTAINS_NONPUBLIC_MATERIAL` — anything that looks like real client facts. **Report this immediately**; every prompt is supposed to be public or invented.

## 5. Attestations live OUTSIDE this repository

Reviewer attestations are external human evidence. They are **never** committed
to the repo, never generated by a coding agent, and never edited in a code
review. Keep your JSONL file somewhere outside the repository — e.g.
`~/benchmark-attestations/california-law-v1-REV-A.jsonl` — and hand it to the
benchmark owner, who passes it to the runner with `--attestations <path>`.

The tool below **refuses** to write inside the repository. The only attestation
file inside the repo is `../datasets/fixtures/attestations.jsonl`, which is
marked `fixture_non_live: true` and is rejected outright by live mode.

## 6. Emitting your attestation

From the repository root:

```bash
./node_modules/.bin/tsx evals/kimi-k3/datasetTools/makeAttestation.ts \
  --task verification-real-008 \
  --reviewer REV-A \
  --decision APPROVE \
  --reviewed-at 2026-07-28T00:00:00Z \
  --reason ENTAILED_AND_SELF_CONTAINED \
  --out ~/benchmark-attestations/california-law-v1-REV-A.jsonl
```

Add `--dry-run` to see the record without writing it. The tool computes all
three hash fields for you from the live dataset — do not type them by hand — and
it will refuse to run if the packets are stale relative to the dataset, if the
task id does not exist, if a REJECT carries no reason code, or if your
`reviewer_id` looks like a name.

## 7. Files here

| file | what it is |
| --- | --- |
| `README.md` | this document |
| `index.md` | all 120 tasks, with caveat flags, linking to the packets |
| `tasks/<task-id>.md` | one review packet per task (120 files) |
| `bundles.jsonl` | the same packets machine-readable (hashes, counts, flags) |
| `manifest.json` | dataset hash the packets were generated from, reason codes, caveat lists |
| `buildBundles.ts` | regenerates everything except this README |
| `../datasetTools/makeAttestation.ts` | the attestation tool |
