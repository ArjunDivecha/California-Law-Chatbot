#!/usr/bin/env python3
"""
b9e-repair-sources.py -- B9b round-4 attestation repair, sources.jsonl edit step.

WHAT THIS DOES
  Round 4 of the cross-vendor machine attestation (verifier-gpt-5.6-sol,
  scratchpad attest/gpt56-round4.jsonl) re-reviewed the two tasks the round-3
  micro-repair rebuilt. research-029 was APPROVED; research-021 was REJECTED
  with UNSUPPORTED_PROPOSITION / CRITERION_REQUIRES_OUTSIDE_LEGAL_MEMORY /
  AMBIGUOUS_AUTHORITY_STATUS:

    "C4 attributes the quoted rules to Stewart (2001) 87 Cal.App.4th 1006 and
     labels the decision published/certified, but the case excerpt contains no
     caption, court, citation, decision date/year, or publication language.
     Those attribution and status claims therefore require reliance on
     ungrounded metadata or outside knowledge."

  Both halves are registry-side defects. This script repairs them:

    (A) EXTENDS the CIT-REAL-6 (Stewart v. Colonial Western Agency, Inc.)
        excerpt from 2 contiguous verbatim runs to 4, adding the opinion's own
        identification material at both ends of the passage already stored:

          run 1 (NEW)  "Opinion CURRY, J.— Background This is an appeal from an
                        order imposing sanctions ... The underlying matter
                        involves a complaint by respondent Mary Martha Stewart
                        against Colonial Western."
                       -> authoring justice, appellate posture, and both party
                          names, in the court's own words.
          run 2        section 2025(m)(3) discussion   (UNCHANGED, round 1)
          run 3        section 2025(n) discussion      (UNCHANGED, round 1)
          run 4 (NEW)  "Disposition The January 18, 2000, order imposing
                        sanctions ... is affirmed. Vogel (C. S.), P. J., and
                        Hastings, J., concurred."
                       -> the appellate panel (a presiding justice plus two
                          associate justices) and the disposition.

        Text is only ADDED and only at the ends: runs 2 and 3 and the ' ... '
        join between them are byte-identical, so research-021's existing p4 and
        p5 proposition excerpts are still verbatim substrings of the new
        excerpt.

        NOTE ON WHAT IS *NOT* AVAILABLE. Unlike the html_lawbox records repaired
        in round 1 (Cembrook, Bridgestone, Lippel, Briggs, Equilon), the
        CourtListener text for this opinion carries NO official-reporter caption
        block: cluster 5808646 stores only xml_harvard / html_with_citations,
        both of which begin at "Opinion CURRY, J.—", and the cluster's
        `headmatter` field is the empty string (verified by direct API fetch,
        2026-07-28). There is therefore no verbatim run in the source that
        states the case caption, the court, the reporter citation or the filing
        date. Those four facts are grounded instead by (B) below, which is
        exactly the route round 1 used for research-023 and round 2 used for
        verification-real-005 -- both APPROVED by both vendors.

    (B) EMITS the source candidate for a new California Official Reports
        volume-index record, CIT-INDEX-CAL-APP-4TH-87 (volume 87 Cal.App.4th,
        window covering page 1006), in the exact shape of the fourteen
        CIT-INDEX-* records already in the registry. The candidate is written to
        --emit and is appended to sources.jsonl by datasetTools/ingestSources.ts
        (a separate, deliberate step -- this script never appends it itself, so
        re-running the script cannot duplicate the record).

  Nothing else in sources.jsonl is touched; every other line is copied through
  byte-identically.

RUN ORDER
  provenance/b9b-repair-sources.py                     (round-1 registry)  1st
  provenance/b9c-repair-sources.py                     (round-2 registry)  2nd
  provenance/b9e-repair-sources.py  (this script)      (round-4 registry)  3rd
  datasetTools/ingestSources.ts --input <emit>         (round-4 registry)  4th
  provenance/b9b-repair.ts                             (round-1 tasks)     5th
  provenance/b9c-repair.ts                             (round-2 tasks)     6th
  provenance/b9d-round3-repair.ts                      (round-3 tasks)     7th
  provenance/b9e-repair.ts                             (round-4 tasks)     8th
  review-bundles/buildBundles.ts                                           9th
  b9b-repair-sources.py rewrites CIT-REAL-6 and CIT-REAL-12 from its own
  (shorter) anchors, so it must never run after b9c/b9e.

INPUT FILES (absolute paths)
  /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl
  <texts-dir>/cl_stewart_harvard.txt  full text of Stewart v. Colonial Western Agency, Inc.
  <texts-dir>/idx87.json              CourtListener volume-index window (build_index.py output)

  <texts-dir> defaults to the directory holding this script and is overridden
  with --texts <dir>. The session copies live in the B9b round-4 scratchpad:
  /private/tmp/claude-501/-Users-arjundivecha-Dropbox-AAA-Backup-A-Working-California-Law-Chatbot/b4ee7987-310b-456b-a455-a50fcb9e9dd4/scratchpad/b9br4/

OUTPUT FILES (absolute paths)
  /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl  (atomic rewrite: temp file + os.replace)
  <--emit>  JSON array holding the single CIT-INDEX-CAL-APP-4TH-87 candidate,
            consumed by datasetTools/ingestSources.ts
  stdout: JSON summary (old/new sha256, run count, excerpt size, record count)

REGENERATING THE INPUTS
  Opinion text -- CourtListener REST API v4, cluster 5808646, field xml_harvard
  (Harvard Caselaw Access Project transcription of the official California
  Appellate Reports; the unauthenticated HTML opinion page answers HTTP 202 with
  an empty body). COURTLISTENER_API_KEY comes from the repo .env:

    curl -sS -H "Authorization: Token $COURTLISTENER_API_KEY" \
      "https://www.courtlistener.com/api/rest/v4/opinions/?cluster=5808646&format=json"

  Tags stripped, HTML entities unescaped, whitespace collapsed to single spaces.
  This is the SAME file the round-1 repair used (cl_stewart_harvard.txt).

  Volume index -- the same build_index.py helper the round-1 index records used:

    python3 build_index.py '{"CIT-INDEX-CAL-APP-4TH-87":
      ["https://www.courtlistener.com/c/cal-app-4th/87/", "Cal. App. 4th", 1006]}'
      > idx87.json

USAGE
  python3 "…/provenance/b9e-repair-sources.py" --texts <dir> --emit <path.json>

NOTES
  Every run is located by an explicit start/end anchor pair and sliced out of
  the official text, then re-asserted to be a whitespace-normalized substring of
  that text before anything is written; the script aborts if any anchor is
  missing or if the four runs are not in document order. Nothing is transcribed
  by hand. Reporter star-pagination markers (*1015) inside a run are preserved
  verbatim. Idempotent: re-running against already-repaired data reproduces
  identical bytes. No Date.now(), no randomness, no network.
"""
import argparse
import hashlib
import json
import os
import re
import sys

DATASET = ("/Users/arjundivecha/Dropbox/AAA Backup/A Working/"
           "California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1")
SOURCES = os.path.join(DATASET, "sources.jsonl")
RETRIEVED_AT = "2026-07-28T03:00:00Z"
TARGET = "CIT-REAL-6"
TEXT_FILE = "cl_stewart_harvard.txt"
INDEX_FILE = "idx87.json"

INDEX_ID = "CIT-INDEX-CAL-APP-4TH-87"
INDEX_URL = "https://www.courtlistener.com/c/cal-app-4th/87/"
INDEX_VOLUME = 87
INDEX_REPORTER_SHORT = "Cal.App.4th"
INDEX_REPORTER_LABEL = "Cal. App. 4th"
INDEX_PAGE = 1006
INDEX_DEPENDENTS = "research-021"

# The two round-1 runs, bracketed by the opinion's own identification material.
# Order below is document order and is asserted as such before anything is
# written.
SEGMENTS = [
    ("Opinion CURRY, J.— Background This is an appeal from an order imposing "
     "sanctions",
     "The underlying matter involves a complaint by respondent Mary Martha "
     "Stewart against Colonial Western."),
    ("Code of Civil Procedure section 2025, subdivision (m)(3) governs",
     "Relevance objections should be held in abeyance until an attempt is "
     "made to use the testimony at trial."),
    ("Code of Civil Procedure section 2025, subdivision (n) goes on to state",
     "deposing counsel’s conduct has reached a stage where suspension "
     "is warranted."),
    ("Disposition The January 18, 2000, order imposing sanctions",
     "Vogel (C. S.), P. J., and Hastings, J., concurred."),
]

ROUND4_NOTE = (
    " [B9b round-4 attestation repair 2026-07-28: EXCERPT EXTENDED. Round 4 "
    "(verifier-gpt-5.6-sol) rejected research-021 with "
    "UNSUPPORTED_PROPOSITION / CRITERION_REQUIRES_OUTSIDE_LEGAL_MEMORY / "
    "AMBIGUOUS_AUTHORITY_STATUS because C4 attributed the quoted deposition "
    "rules to 'Stewart (2001) 87 Cal.App.4th 1006' and called the decision "
    "published/certified while the stored excerpt carried no caption, court, "
    "citation, date or publication language. This excerpt now holds 4 "
    "contiguous verbatim runs instead of 2: the opinion's own opening "
    "identification passage ('Opinion CURRY, J.— Background This is an appeal "
    "from an order imposing sanctions in the amount of $2,400 on appellant "
    "Colonial Western Agency, Inc.'s counsel. The underlying matter involves a "
    "complaint by respondent Mary Martha Stewart against Colonial Western.') "
    "has been added in front, and the opinion's Disposition and concurrence "
    "block ('Disposition The January 18, 2000, order imposing sanctions on "
    "Colonial Western's counsel as corrected nunc pro tunc on September 20, "
    "2000, is affirmed. Vogel (C. S.), P. J., and Hastings, J., concurred.') "
    "has been added at the end, so the packet now shows the party names, the "
    "appellate posture, the authoring justice and the three-justice panel in "
    "the court's own words. Text was only ADDED and only at the ends: the two "
    "round-1 runs and the ' ... ' join between them are byte-identical, so "
    "every proposition excerpt previously grounded on this record is still a "
    "verbatim substring. Same source and method as the round-1 re-excerpt "
    "(xml_harvard of CourtListener opinion cluster 5808646, REST API v4, "
    "token-authenticated), each run asserted in code to be a "
    "whitespace-normalized substring of that full text, in document order, "
    "before the record was written. NO OFFICIAL-REPORTER CAPTION BLOCK EXISTS "
    "IN THIS SOURCE: cluster 5808646 stores only xml_harvard and "
    "html_with_citations, both of which begin at 'Opinion CURRY, J.—', and the "
    "cluster's headmatter field is empty (verified by direct API fetch "
    "2026-07-28), so the caption, court, reporter citation and filing date are "
    "grounded instead in the new California Official Reports volume-index "
    "record CIT-INDEX-CAL-APP-4TH-87 plus Cal. Rules of Court, rule 8.1115(d) "
    "-- the same route round 1 used for research-023 and round 2 for "
    "verification-real-005, both approved by both vendors. The pre-archive "
    "NO_OFFICIAL_HOSTING aggregator caveat above is unchanged and still "
    "surfaced in the reviewer bundle. retrieved_at refreshed; sha256 "
    "recomputed over the new excerpt bytes.]"
)

INDEX_NOTE = (
    "Added during the B9b round-4 attestation repair (2026-07-28) so that the "
    "attribution and publication-status claims round 4 rejected as "
    "UNSUPPORTED_PROPOSITION / CRITERION_REQUIRES_OUTSIDE_LEGAL_MEMORY / "
    "AMBIGUOUS_AUTHORITY_STATUS ({dependents}) can be grounded in an Official "
    "Reports volume-index entry instead of asserted: an entry in the California "
    "Official Reports index is what publication in the Official Reports "
    "consists of, and it is also the only place the case caption, reporter "
    "citation, docket number and filing date of this opinion appear -- the "
    "CourtListener full text of cluster 5808646 has no caption block and the "
    "cluster's headmatter field is empty. Fetched {url} with curl (raw HTML, "
    "not LLM-mediated) on 2026-07-28; every <article> block on the volume index "
    "(following 'Next' pagination) was parsed for the case name and the page's "
    "own literal 'Date Filed:', 'Citations:' and 'Docket Number:' field values, "
    "sorted by the official-reporter starting page parsed out of the "
    "'{label} <page>' citation, and the entries bracketing page {page} were "
    "transcribed verbatim into the excerpt above, joined by ' ;; '. Reproduce "
    "with provenance/b9e-repair-sources.py plus the same URL. CourtListener is "
    "used here strictly for citation metadata (which case occupies which "
    "volume/page), which is the aggregator role the spec permits; no "
    "substantive legal proposition rests on it."
)

FIELD_ORDER = ("source_id", "canonical_url", "locator", "jurisdiction",
               "authority_kind", "publication_or_precedential_status",
               "effective_date", "retrieved_at", "excerpt", "sha256",
               "discovery_notes")


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def sha256_of(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def slice_segment(text, start, end, label):
    i = text.find(start)
    if i < 0:
        sys.exit(f"ABORT: {label} start anchor not found: {start!r}")
    j = text.find(end, i)
    if j < 0:
        sys.exit(f"ABORT: {label} end anchor not found: {end!r}")
    seg = norm(text[i:j + len(end)])
    if seg not in norm(text):
        sys.exit(f"ABORT: {label} segment is not verbatim in the source text")
    return i, seg


def build_excerpt(texts_dir):
    path = os.path.join(texts_dir, TEXT_FILE)
    if not os.path.exists(path):
        sys.exit(f"ABORT: missing input text {path}")
    text = norm(open(path, encoding="utf-8").read())
    sliced = [slice_segment(text, a, b, f"{TARGET}[{k}]")
              for k, (a, b) in enumerate(SEGMENTS)]
    offsets = [i for i, _ in sliced]
    if offsets != sorted(offsets):
        sys.exit(f"ABORT: {TARGET} runs are not in document order: {offsets}")
    return " ... ".join(seg for _, seg in sliced), len(sliced)


def build_index_candidate(texts_dir):
    path = os.path.join(texts_dir, INDEX_FILE)
    if not os.path.exists(path):
        sys.exit(f"ABORT: missing volume index {path}")
    data = json.load(open(path, encoding="utf-8")).get(INDEX_ID)
    if not data or not data.get("window"):
        sys.exit(f"ABORT: no index window for {INDEX_ID} in {path}")
    excerpt = norm(
        f"CourtListener citation index for California Official Reports, "
        f"volume {INDEX_VOLUME} {INDEX_REPORTER_SHORT} ({INDEX_URL}), entries "
        f"ordered by official-reporter starting page; {data['count']} entries "
        f"indexed for the volume. Window covering page {INDEX_PAGE}: "
        f"{data['window']}"
    )
    if f"{INDEX_REPORTER_LABEL} {INDEX_PAGE}" not in excerpt:
        sys.exit(f"ABORT: window does not cover {INDEX_REPORTER_LABEL} "
                 f"{INDEX_PAGE}")
    return {
        "source_id": INDEX_ID,
        "canonical_url": INDEX_URL,
        "locator": (f"California Official Reports, volume {INDEX_VOLUME} "
                    f"{INDEX_REPORTER_SHORT} citation index (window covering "
                    f"page {INDEX_PAGE})"),
        "jurisdiction": "California",
        "authority_kind": "case",
        "publication_or_precedential_status": (
            "Official-reporter citation index metadata (CourtListener); used "
            "for citation-metadata verification only, not as the source of a "
            "substantive legal proposition"),
        "effective_date": "2026-07-28",
        "retrieved_at": RETRIEVED_AT,
        "excerpt": excerpt,
        "sha256": sha256_of(excerpt),
        "discovery_notes": INDEX_NOTE.format(
            dependents=INDEX_DEPENDENTS, url=INDEX_URL,
            label=INDEX_REPORTER_LABEL, page=INDEX_PAGE),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--texts",
                    default=os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--emit", required=True,
                    help="path for the ingestSources.ts candidate JSON")
    args = ap.parse_args()

    excerpt, runs = build_excerpt(args.texts)
    candidate = build_index_candidate(args.texts)

    lines = open(SOURCES, encoding="utf-8").read().split("\n")
    out, touched = [], None
    for line in lines:
        if not line.strip():
            continue
        rec = json.loads(line)
        if rec["source_id"] != TARGET:
            out.append(line)
            continue
        old_sha, old_chars = rec["sha256"], len(rec["excerpt"])
        rec["excerpt"] = excerpt
        rec["sha256"] = sha256_of(excerpt)
        rec["retrieved_at"] = RETRIEVED_AT
        if "[B9b round-4 attestation repair" not in rec["discovery_notes"]:
            rec["discovery_notes"] = rec["discovery_notes"] + ROUND4_NOTE
        touched = {"source_id": TARGET, "old_sha256": old_sha,
                   "new_sha256": rec["sha256"], "runs": runs,
                   "old_excerpt_chars": old_chars,
                   "new_excerpt_chars": len(excerpt)}
        out.append(json.dumps({k: rec[k] for k in FIELD_ORDER},
                              ensure_ascii=False))

    if touched is None:
        sys.exit(f"ABORT: {TARGET} not found in {SOURCES}")

    tmp = SOURCES + ".b9e.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, SOURCES)

    with open(args.emit, "w", encoding="utf-8") as fh:
        json.dump([candidate], fh, ensure_ascii=False, indent=1)
        fh.write("\n")

    already = any(json.loads(x)["source_id"] == INDEX_ID for x in out)
    print(json.dumps({
        "touched": [touched],
        "record_count": len(out),
        "index_candidate": {"source_id": INDEX_ID,
                            "sha256": candidate["sha256"],
                            "excerpt_chars": len(candidate["excerpt"]),
                            "already_in_registry": already,
                            "emitted_to": args.emit},
    }, indent=1))


if __name__ == "__main__":
    main()
