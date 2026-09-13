#!/usr/bin/env python3
"""
b9c-repair-sources.py -- B9b round-2 attestation repair, sources.jsonl edit step.

WHAT THIS DOES
  Round 2 of the cross-vendor machine attestation (verifier-gpt-5.6-sol,
  scratchpad attest/gpt56-round2.jsonl) rejected 5 of the 19 re-reviewed tasks.
  One of the five rejections -- research-029 -- is a registry-side defect:

    research-029 C2 asserted that Lippel HELD it is a denial of due process,
    as embodied in Code of Civil Procedure section 580, to enter a default
    child-support judgment on a petition that never asked for support, but the
    pinpoint quote backing it was the sentence in which the court merely POSES
    that question ("In this action we are asked to decide whether ..."). The
    court's own answer -- the due-process analysis in part II.A of the opinion
    -- was not inside the stored CIT-REAL-12 excerpt at all, so the criterion
    could not be entailed from the packet.

  This script extends the CIT-REAL-12 (In re Marriage of Lippel) excerpt so the
  answering passage is present. The excerpt's third contiguous run, which
  previously began at "We have long interpreted section 580 in accordance with
  its plain language.", now begins earlier in the SAME uninterrupted passage of
  the opinion, at "The issue we address is whether due process and section 580
  permit ...". The run therefore now carries the court's due-process holding:

    "It is a fundamental concept of due process that a judgment against a
     defendant cannot be entered unless he was given proper notice and an
     opportunity to defend. ... California satisfies these due process
     requirements in default cases through section 580."
    "It is fundamental to the concept of due process that a defendant be given
     notice of the existence of a lawsuit and notice of the specific relief
     which is sought in the complaint served upon him. ... The instant case is
     a prime example of the foregoing; the petition which was served on Ronald
     sought no monetary relief from him."

  The run count stays at 3 and no ' ... ' join moves, so every proposition
  excerpt already grounded on this record (research-029 p3/p4,
  verification-real-006 p1/p2/p3) is still a verbatim substring of the new
  excerpt. Only the run-3 start anchor moves backwards; text is added, never
  removed. sha256 is recomputed, retrieved_at refreshed, and a round-2 note is
  appended to discovery_notes.

  Nothing else in sources.jsonl is touched; every other line is copied through
  byte-identically. No new source record is created: the Official Reports
  volume-index record verification-real-005 needs (CIT-INDEX-CAL-APP-4TH-7,
  7 Cal.App.4th, window covering page 1384) was already ingested in the B9b
  round-1 repair, which named verification-real-005 as a dependent of it.

RUN ORDER
  provenance/b9b-repair-sources.py   (round-1 registry edits)  -- FIRST
  provenance/b9c-repair-sources.py   (this script)             -- SECOND
  provenance/b9b-repair.ts           (round-1 task rebuild)    -- THIRD
  provenance/b9c-repair.ts           (round-2 task rebuild)    -- FOURTH
  b9b-repair-sources.py rewrites CIT-REAL-12 from its own (shorter) anchors, so
  re-running it AFTER this script reverts the extension; always finish with
  this script before rebuilding tasks.

INPUT FILES (absolute paths)
  /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl
  <texts-dir>/cl_lippel_lawbox.txt   full text of In re Marriage of Lippel

  <texts-dir> defaults to the directory holding this script and is overridden
  with --texts <dir>. The session copy of the opinion text lives in the B9b
  round-2 scratchpad:
  /private/tmp/claude-501/-Users-arjundivecha-Dropbox-AAA-Backup-A-Working-California-Law-Chatbot/b4ee7987-310b-456b-a455-a50fcb9e9dd4/scratchpad/b9br2/

OUTPUT FILES (absolute paths)
  /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl  (atomic rewrite: temp file + os.replace)
  stdout: JSON summary (old/new sha256, excerpt size, record count)

REGENERATING THE INPUT
  Identical to the B9b round-1 step -- CourtListener REST API v4, cluster
  1442248, field html_lawbox (the unauthenticated HTML opinion page answers
  HTTP 202 with an empty body):

    curl -sS -H "Authorization: Token $COURTLISTENER_API_KEY" \
      "https://www.courtlistener.com/api/rest/v4/opinions/?cluster=1442248&format=json"

  Tags stripped, HTML entities unescaped, whitespace collapsed to single
  spaces.

NOTES
  Every run is located by an explicit start/end anchor pair and sliced out of
  the official text, then re-asserted to be a whitespace-normalized substring
  of that text before anything is written; the script aborts if any anchor is
  missing. Nothing is transcribed by hand. Reporter star-pagination markers
  (*1166) and subdivision markers (A. (1)) inside a run are preserved verbatim.
  Idempotent: re-running against already-repaired data reproduces identical
  bytes. No Date.now(), no randomness, no network.
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
RETRIEVED_AT = "2026-07-28T00:30:00Z"
TARGET = "CIT-REAL-12"
TEXT_FILE = "cl_lippel_lawbox.txt"

# Same three runs the B9b round-1 repair wrote, with run 3's START anchor moved
# backwards to the beginning of part II ("The issue we address ...") so the
# court's due-process answer is inside the excerpt. Runs 1 and 2 are unchanged.
SEGMENTS = [
    ("51 Cal.3d 1160 (1990)",
     "Supreme Court of California. December 17, 1990."),
    ("PANELLI, J. In this action we are asked to decide",
     "subject to collateral attack by the husband."),
    ("The issue we address is whether due process and section 580 permit",
     "that a plaintiff cannot be granted more relief than is asked for in "
     "the complaint."),
]

ROUND2_NOTE = (
    " [B9b round-2 attestation repair 2026-07-28: EXCERPT EXTENDED. Round 2 "
    "(verifier-gpt-5.6-sol) rejected research-029 with "
    "UNSUPPORTED_PROPOSITION / CRITERION_PROPOSITION_MISMATCH because C2's "
    "pinpoint quoted only the sentence in which the court POSES the "
    "due-process question, while the criterion asserted the court's answer to "
    "it. The third contiguous run of this excerpt now starts earlier in the "
    "same uninterrupted passage of the opinion -- at 'The issue we address is "
    "whether due process and section 580 permit ...' instead of at 'We have "
    "long interpreted section 580 ...' -- so it carries the court's own "
    "due-process analysis in part II.A ('It is a fundamental concept of due "
    "process that a judgment against a defendant cannot be entered unless he "
    "was given proper notice and an opportunity to defend ... California "
    "satisfies these due process requirements in default cases through "
    "section 580'; 'It is fundamental to the concept of due process that a "
    "defendant be given notice of the existence of a lawsuit and notice of "
    "the specific relief which is sought in the complaint served upon him'). "
    "Text was only ADDED: the run count stays at 3, no ' ... ' join moved, "
    "and every proposition excerpt previously grounded on this record is "
    "still a verbatim substring. Same source and method as the round-1 "
    "re-excerpt (html_lawbox of CourtListener opinion cluster 1442248, REST "
    "API v4, token-authenticated), each run asserted in code to be a "
    "whitespace-normalized substring of that full text before the record was "
    "written. The pre-archive NO_OFFICIAL_HOSTING aggregator caveat above is "
    "unchanged and still surfaced in the reviewer bundle. retrieved_at "
    "refreshed; sha256 recomputed over the new excerpt bytes.]"
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
    return seg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--texts",
                    default=os.path.dirname(os.path.abspath(__file__)))
    args = ap.parse_args()

    path = os.path.join(args.texts, TEXT_FILE)
    if not os.path.exists(path):
        sys.exit(f"ABORT: missing input text {path}")
    text = norm(open(path, encoding="utf-8").read())
    runs = [slice_segment(text, a, b, f"{TARGET}[{k}]")
            for k, (a, b) in enumerate(SEGMENTS)]
    excerpt = " ... ".join(runs)

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
        if "[B9b round-2 attestation repair" not in rec["discovery_notes"]:
            rec["discovery_notes"] = rec["discovery_notes"] + ROUND2_NOTE
        touched = {"source_id": TARGET, "old_sha256": old_sha,
                   "new_sha256": rec["sha256"], "runs": len(runs),
                   "old_excerpt_chars": old_chars,
                   "new_excerpt_chars": len(excerpt)}
        out.append(json.dumps({k: rec[k] for k in FIELD_ORDER},
                              ensure_ascii=False))

    if touched is None:
        sys.exit(f"ABORT: {TARGET} not found in {SOURCES}")

    tmp = SOURCES + ".b9c.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, SOURCES)
    print(json.dumps({"touched": [touched], "record_count": len(out)},
                     indent=1))


if __name__ == "__main__":
    main()
