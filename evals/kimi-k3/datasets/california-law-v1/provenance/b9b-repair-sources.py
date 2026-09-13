#!/usr/bin/env python3
"""
b9b-repair-sources.py -- B9b round-1 attestation repair, sources.jsonl edit step.

WHAT THIS DOES
  Round 1 of the cross-vendor machine attestation (claude-opus-5 + gpt-5.6-sol)
  rejected 18 of the 120 canonical tasks. Defect class A was
  EXCERPT_NOT_VERBATIM: seven case records in sources.jsonl carried excerpts
  that mixed a short quoted fragment with the record-builder's own unquoted
  "Held: ..." / "As fetched: ..." synopsis prose, so criteria that depended on
  the synopsis rested on a summariser's paraphrase rather than the court's
  words. Defect class C was STATUS_NOT_ENTAILED: criteria asserting that an
  opinion is published / precedential / citable were not entailed by the quoted
  evidence.

  This script repairs the registry side of both:

    (A) Replaces the excerpt of CIT-REAL-6 (Stewart), CIT-REAL-7 (Costco),
        CIT-REAL-8 (Cembrook), CIT-REAL-10 (Bridgestone/Firestone),
        CIT-REAL-12 (Lippel), CIT-REAL-13 (Briggs) and CIT-REAL-14 (Equilon)
        with VERBATIM judicial language taken from the full text of each
        opinion, re-anchors canonical_url to the CourtListener opinion page the
        text came from, refreshes retrieved_at, recomputes sha256 over the new
        excerpt bytes, and appends a disclosure note to discovery_notes.
        No editorial headnote or synopsis text survives in any of the seven.

    (C) Appends five new CIT-INDEX-* California Official Reports volume-index
        records (citation-metadata role only, exactly as the nine CIT-INDEX
        records already in the registry) and extends the existing
        CIT-INDEX-CAL-5TH-7 record with a second page window so that the
        publication-status criteria of the affected tasks can be grounded in an
        Official Reports index entry instead of asserted.

  Nothing else in sources.jsonl is touched; every other line is copied through
  byte-identically.

INPUT FILES (absolute paths)
  /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl
  <texts-dir>/cl_stewart_harvard.txt      full text of Stewart v. Colonial Western Agency, Inc.
  <texts-dir>/cl_costco_harvard.txt       full text of Costco Wholesale Corp. v. Superior Court
  <texts-dir>/cl_cembrook_lawbox.txt      full text of Cembrook v. Superior Court
  <texts-dir>/cl_bridgestone_lawbox.txt   full text of Bridgestone/Firestone, Inc. v. Superior Court
  <texts-dir>/cl_lippel_lawbox.txt        full text of In re Marriage of Lippel
  <texts-dir>/cl_briggs_lawbox.txt        full text of Briggs v. Eden Council for Hope & Opportunity
  <texts-dir>/cl_equilon_lawbox.txt       full text of Equilon Enterprises v. Consumer Cause, Inc.
  <texts-dir>/idx.json                    CourtListener volume-index windows (build_index.py output)

  <texts-dir> defaults to the directory holding this script and is overridden
  with --texts <dir>. The session copy lives in the B9b scratchpad:
  /private/tmp/claude-501/-Users-arjundivecha-Dropbox-AAA-Backup-A-Working-California-Law-Chatbot/b4ee7987-310b-456b-a455-a50fcb9e9dd4/scratchpad/b9brepair/

OUTPUT FILES (absolute paths)
  /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl  (atomic rewrite: temp file + os.replace)
  stdout: JSON summary (touched ids, old/new sha256, record count)

REGENERATING THE INPUTS
  The seven opinion texts come from the CourtListener REST API v4 (the
  unauthenticated HTML opinion pages answer 202/empty to curl; the API answers
  200 with COURTLISTENER_API_KEY from the repo .env):

    curl -sS -H "Authorization: Token $COURTLISTENER_API_KEY" \
      "https://www.courtlistener.com/api/rest/v4/opinions/?cluster=<id>&format=json"

    cluster 5808646 -> Stewart 87 Cal.App.4th 1006        (field xml_harvard)
    cluster 5608098 -> Costco 47 Cal.4th 725              (field xml_harvard)
    cluster 1156481 -> Cembrook 56 Cal.2d 423             (field html_lawbox)
    cluster 2279020 -> Bridgestone 7 Cal.App.4th 1384     (field html_lawbox)
    cluster 1442248 -> Lippel 51 Cal.3d 1160              (field html_lawbox)
    cluster 1404828 -> Briggs 19 Cal.4th 1106             (field html_lawbox)
    cluster 2519835 -> Equilon 29 Cal.4th 53              (field html_lawbox)

  Tags stripped, HTML entities unescaped, whitespace collapsed to single
  spaces. idx.json is produced by build_index.py in the same scratchpad.

NOTES
  Every excerpt segment below is located in the official text by an explicit
  start/end anchor pair and sliced out of it, then re-asserted to be a
  whitespace-normalized substring of that text before anything is written; the
  script aborts if any anchor is missing or any assertion fails. Nothing is
  transcribed by hand. Segments that are non-contiguous in the opinion are
  joined with ' ... ', the convention the registry already uses (CIT-REAL-3,
  CIT-REAL-15); no ellipsis is ever inserted INSIDE a segment, and every
  proposition excerpt built on these records in b9b-repair.ts is a single
  uninterrupted segment substring. Reporter star-pagination markers (*1015) and
  footnote markers ([1]) that appear inside a segment are preserved verbatim
  rather than silently deleted.

  Idempotent: re-running against already-repaired data reproduces identical
  bytes. No Date.now(), no randomness; the only network use is regenerating the
  inputs above.
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
RETRIEVED_AT = "2026-07-27T23:59:00Z"

CL = "https://www.courtlistener.com/opinion/"
URLS = {
    "CIT-REAL-6": CL + "5808646/stewart-v-colonial-western-agency-inc/",
    "CIT-REAL-7": CL + "5608098/costco-wholesale-corp-v-superior-court/",
    "CIT-REAL-8": CL + "1156481/cembrook-v-superior-court/",
    "CIT-REAL-10": CL + "2279020/bridgestonefirestone-inc-v-superior-court/",
    "CIT-REAL-12": CL + "1442248/in-re-marriage-of-lippel/",
    "CIT-REAL-13": CL + "1404828/briggs-v-eden-council-for-hope-opportunity/",
    "CIT-REAL-14": CL + "2519835/equilon-enterprises-v-consumer-cause-inc/",
}

# source_id -> (text file, [(start anchor, end anchor), ...])
SEGMENTS = {
    "CIT-REAL-6": ("cl_stewart_harvard.txt", [
        ("Code of Civil Procedure section 2025, subdivision (m)(3) governs",
         "Relevance objections should be held in abeyance until an attempt is "
         "made to use the testimony at trial."),
        ("Code of Civil Procedure section 2025, subdivision (n) goes on to state",
         "deposing counsel’s conduct has reached a stage where suspension "
         "is warranted."),
    ]),
    "CIT-REAL-7": ("cl_costco_harvard.txt", [
        ("WERDEGAR, J. In this case we consider",
         "in order to rule on a claim of privilege. (Evid. Code, § 915, "
         "subd. (a).)"),
        ("As we have explained, when the communication is a confidential one",
         "but plaintiffs may not obtain it by compelling disclosure of the "
         "letter."),
    ]),
    "CIT-REAL-8": ("cl_cembrook_lawbox.txt", [
        ("56 Cal.2d 423 (1961) MICHAEL CEMBROOK",
         "Supreme Court of California. Aug. 3, 1961."),
        ("But neither ambiguity nor burden are of themselves",
         "make any order consistent with justice."),
        ("The trial court possesses ample power under sections 2033 and 2019",
         "it may order such questions to be rephrased."),
    ]),
    "CIT-REAL-10": ("cl_bridgestone_lawbox.txt", [
        ("7 Cal.App.4th 1384 (1992)",
         "First District, Division One. June 24, 1992."),
        ("We therefore hold that the party claiming the privilege",
         "the information sought is essential to a fair resolution of the "
         "lawsuit."),
    ]),
    "CIT-REAL-12": ("cl_lippel_lawbox.txt", [
        ("51 Cal.3d 1160 (1990)",
         "Supreme Court of California. December 17, 1990."),
        ("PANELLI, J. In this action we are asked to decide",
         "subject to collateral attack by the husband."),
        ("We have long interpreted section 580 in accordance with its plain "
         "language.",
         "that a plaintiff cannot be granted more relief than is asked for in "
         "the complaint."),
    ]),
    "CIT-REAL-13": ("cl_briggs_lawbox.txt", [
        ("81 Cal.Rptr.2d 471 (1999)",
         "Supreme Court of California. January 21, 1999."),
        ("WERDEGAR, J. Must a defendant, moving specially",
         "Accordingly, we reverse the judgment of the Court of Appeal."),
        ("For the foregoing reasons, we conclude the Court of Appeal erred",
         "need not separately demonstrate that the statement concerned an "
         "issue of public significance."),
    ]),
    "CIT-REAL-14": ("cl_equilon_lawbox.txt", [
        ("124 Cal.Rptr.2d 507 (2002)",
         "Supreme Court of California. August 29, 2002."),
        ("WERDEGAR, J. Must a defendant, in order to obtain a dismissal",
         "For the following reasons, we conclude not."),
        ("The Court of Appeal correctly held that Consumer Cause",
         "faced no additional requirement of proving Equilon's subjective "
         "intent."),
    ]),
}

REPAIR_NOTE = (
    " [B9b round-1 attestation repair {date}: RE-EXCERPTED TO VERBATIM OPINION "
    "TEXT after attestation round 1. Both machine verifiers (claude-opus-5 and "
    "gpt-5.6-sol) rejected the dependent tasks with EXCERPT_NOT_VERBATIM / "
    "AGGREGATOR_SOURCE_NOT_ACCEPTABLE because the previous excerpt combined a "
    "short in-quotes fragment with the record-builder's own unquoted "
    "'{synopsis}' synopsis of the holding, so criteria that leaned on the "
    "synopsis rested on a summariser's paraphrase rather than the court's "
    "words. The excerpt above is now {n} contiguous verbatim run(s) of the "
    "opinion's own language ({what}), taken from {field} of CourtListener "
    "opinion cluster {cluster} (REST API v4, token-authenticated; the "
    "unauthenticated HTML opinion page answers HTTP 202 with an empty body) "
    "and each asserted in code to be a whitespace-normalized substring of that "
    "full text before the record was written. This opinion is a pre-archive "
    "decision with NO official courts.ca.gov hosting (courts.ca.gov's public "
    "opinion archive does not reach back this far), which the registry has "
    "documented since B8a; a full-text aggregator reproduction remains the "
    "only route to VERBATIM judicial language for it, and that aggregator "
    "caveat stays disclosed and is surfaced in the reviewer bundle. Reporter "
    "star-pagination markers and footnote markers inside a run are preserved "
    "verbatim rather than silently deleted. canonical_url re-anchored to the "
    "CourtListener opinion page; retrieved_at refreshed; sha256 recomputed "
    "over the new excerpt bytes.]"
)

NOTE_ARGS = {
    "CIT-REAL-6": dict(
        synopsis="counsel must seek a protective order ...", n=2,
        what="the Code of Civil Procedure section 2025(m)(3) discussion holding "
             "relevance/materiality/admissibility objections unnecessary at a "
             "deposition, and the section 2025(n) suspension-and-"
             "protective-order discussion ending in the court's 'Taken as a "
             "whole' conclusion",
        field="the xml_harvard field (Harvard Caselaw Access Project "
              "transcription of the official California Appellate Reports)",
        cluster="5808646"),
    "CIT-REAL-7": dict(
        synopsis="holding that an attorney opinion letter ...", n=2,
        what="the opening paragraph in which the court states its conclusion "
             "that the in camera review and redacted-disclosure order violated "
             "the attorney-client privilege and Evidence Code section 915(a), "
             "and the passage holding the entire communication privileged",
        field="the xml_harvard field (Harvard Caselaw Access Project "
              "transcription of the official California Official Reports)",
        cluster="5608098"),
    "CIT-REAL-8": dict(
        synopsis="objections based on ambiguity may ...", n=3,
        what="the official reporter caption block, the court's 'But neither "
             "ambiguity nor burden' passage, and the court's closing statement "
             "of the trial court's power to narrow or rephrase rather than "
             "deny in toto",
        field="the html_lawbox field", cluster="1156481"),
    "CIT-REAL-10": dict(
        synopsis="As fetched: the party seeking ...", n=2,
        what="the official reporter caption block and the court's 'We therefore "
             "hold' passage stating the prima facie particularized showing",
        field="the html_lawbox field", cluster="2279020"),
    "CIT-REAL-12": dict(
        synopsis="Held: entry of a default child-support order ...", n=3,
        what="the official reporter caption block, the opinion's opening "
             "statement of the question and holding, and the court's statement "
             "that section 580 means a plaintiff cannot be granted more relief "
             "than is asked for in the complaint",
        field="the html_lawbox field", cluster="1442248"),
    "CIT-REAL-13": dict(
        synopsis="Held: Under Code of Civil Procedure section 425.16 ...", n=3,
        what="the official reporter caption block, the opinion's opening "
             "statement of the question and holding, and the court's own "
             "Conclusion paragraph",
        field="the html_lawbox field", cluster="1404828"),
    "CIT-REAL-14": dict(
        synopsis="Held: a defendant invoking the anti-SLAPP statute ...", n=3,
        what="the official reporter caption block, the opinion's opening "
             "statement of the question and holding, and the court's closing "
             "statement that Consumer Cause faced no additional requirement of "
             "proving subjective intent",
        field="the html_lawbox field", cluster="2519835"),
}

INDEX_NOTE = (
    "Added during the B9b round-1 attestation repair (2026-07-27) so that the "
    "publication-status criteria round 1 rejected as UNSUPPORTED_PROPOSITION "
    "({dependents}) can be grounded in an Official Reports volume-index entry "
    "instead of asserted: an entry in the California Official Reports index is "
    "what publication in the Official Reports consists of. Fetched {url} with "
    "curl (raw HTML, not LLM-mediated) on 2026-07-27; every <article> block on "
    "the volume index (following 'Next' pagination) was parsed for the case "
    "name and the page's own literal 'Date Filed:', 'Citations:' and 'Docket "
    "Number:' field values, sorted by the official-reporter starting page "
    "parsed out of the '{label} <page>' citation, and the entries bracketing "
    "page {page} were transcribed verbatim into the excerpt above, joined by "
    "' ;; '. Reproduce with provenance/b9b-repair-sources.py plus the same "
    "URL. CourtListener is used here strictly for citation metadata (which "
    "case occupies which volume/page), which is the aggregator role the spec "
    "permits; no substantive legal proposition rests on it."
)

# slug -> (source_id, reporter label, target page, volume title, dependents)
NEW_INDEX = [
    ("CIT-INDEX-CAL-4TH-47", "https://www.courtlistener.com/c/cal-4th/47/",
     "Cal. 4th", 47, 725, "verification-real-002"),
    ("CIT-INDEX-CAL-2D-56", "https://www.courtlistener.com/c/cal-2d/56/",
     "Cal. 2d", 56, 423, "verification-real-003"),
    ("CIT-INDEX-CAL-4TH-19", "https://www.courtlistener.com/c/cal-4th/19/",
     "Cal. 4th", 19, 1106, "verification-real-007"),
    ("CIT-INDEX-CAL-4TH-29", "https://www.courtlistener.com/c/cal-4th/29/",
     "Cal. 4th", 29, 82, "research-016"),
    ("CIT-INDEX-CAL-APP-4TH-7", "https://www.courtlistener.com/c/cal-app-4th/7/",
     "Cal. App. 4th", 7, 1384, "research-023, verification-real-005"),
]

REPORTER_NAME = {
    "Cal. 4th": "Cal.4th", "Cal. 2d": "Cal.2d", "Cal. App. 4th": "Cal.App.4th",
    "Cal. 5th": "Cal.5th",
}

CAL5TH7_EXTENSION_NOTE = (
    " [B9b round-1 attestation repair 2026-07-27: EXTENDED with a second page "
    "window covering page 133 (FilmOn.com Inc. v. DoubleVerify Inc., 7 Cal.5th "
    "133) so that verification-real-009's publication-status criterion, which "
    "round 1 rejected as UNSUPPORTED_PROPOSITION, can be grounded in the same "
    "volume index rather than asserted. Built by the same documented method "
    "from the same URL, appended after the existing page-904 window; the "
    "page-904 window is unchanged and verification-real-008's proposition "
    "excerpt still matches it verbatim. sha256 recomputed over the new bytes.]"
)


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
    seg = text[i:j + len(end)]
    if norm(seg) not in norm(text):
        sys.exit(f"ABORT: {label} segment is not verbatim in the source text")
    return norm(seg)


def build_case_excerpts(texts_dir):
    out = {}
    for source_id, (fname, anchors) in SEGMENTS.items():
        path = os.path.join(texts_dir, fname)
        if not os.path.exists(path):
            sys.exit(f"ABORT: missing input text {path}")
        text = norm(open(path, encoding="utf-8").read())
        segs = [slice_segment(text, a, b, f"{source_id}[{k}]")
                for k, (a, b) in enumerate(anchors)]
        out[source_id] = " ... ".join(segs)
    return out


def build_index_records(texts_dir):
    idx = json.load(open(os.path.join(texts_dir, "idx.json"), encoding="utf-8"))
    records = []
    for source_id, url, label, volume, page, dependents in NEW_INDEX:
        data = idx.get(source_id)
        if not data or not data.get("window"):
            sys.exit(f"ABORT: no index window for {source_id}")
        short = REPORTER_NAME[label]
        excerpt = (
            f"CourtListener citation index for California Official Reports, "
            f"volume {volume} {short} ({url}), entries ordered by "
            f"official-reporter starting page; {data['count']} entries indexed "
            f"for the volume. Window covering page {page}: {data['window']}"
        )
        records.append({
            "source_id": source_id,
            "canonical_url": url,
            "locator": (f"California Official Reports, volume {volume} {short} "
                        f"citation index (window covering page {page})"),
            "jurisdiction": "California",
            "authority_kind": "case",
            "publication_or_precedential_status": (
                "Official-reporter citation index metadata (CourtListener); "
                "used for citation-metadata verification only, not as the "
                "source of a substantive legal proposition"),
            "effective_date": "2026-07-27",
            "retrieved_at": RETRIEVED_AT,
            "excerpt": norm(excerpt),
            "sha256": sha256_of(norm(excerpt)),
            "discovery_notes": INDEX_NOTE.format(
                dependents=dependents, url=url, label=label, page=page),
        })
    return records, idx


FIELD_ORDER = ("source_id", "canonical_url", "locator", "jurisdiction",
               "authority_kind", "publication_or_precedential_status",
               "effective_date", "retrieved_at", "excerpt", "sha256",
               "discovery_notes")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--texts", default=os.path.dirname(os.path.abspath(__file__)))
    args = ap.parse_args()

    case_excerpts = build_case_excerpts(args.texts)
    index_records, idx = build_index_records(args.texts)

    cal5th7_window = idx["CIT-INDEX-CAL-5TH-7-133"]["window"]

    lines = open(SOURCES, encoding="utf-8").read().split("\n")
    out, touched = [], []
    for line in lines:
        if not line.strip():
            continue
        rec = json.loads(line)
        sid = rec["source_id"]
        if sid in case_excerpts:
            old = rec["sha256"]
            excerpt = case_excerpts[sid]
            rec["canonical_url"] = URLS[sid]
            rec["excerpt"] = excerpt
            rec["sha256"] = sha256_of(excerpt)
            rec["retrieved_at"] = RETRIEVED_AT
            note = REPAIR_NOTE.format(date="2026-07-27", **NOTE_ARGS[sid])
            if "[B9b round-1 attestation repair" not in rec["discovery_notes"]:
                rec["discovery_notes"] = rec["discovery_notes"] + note
            touched.append({"source_id": sid, "old_sha256": old,
                            "new_sha256": rec["sha256"],
                            "excerpt_chars": len(excerpt)})
            out.append(json.dumps({k: rec[k] for k in FIELD_ORDER},
                                  ensure_ascii=False))
        elif sid == "CIT-INDEX-CAL-5TH-7":
            old = rec["sha256"]
            addition = f" Window covering page 133: {cal5th7_window}"
            if "Window covering page 133:" not in rec["excerpt"]:
                rec["excerpt"] = norm(rec["excerpt"] + addition)
                rec["discovery_notes"] = (rec["discovery_notes"]
                                          + CAL5TH7_EXTENSION_NOTE)
            rec["sha256"] = sha256_of(rec["excerpt"])
            rec["locator"] = ("California Official Reports, volume 7 Cal.5th "
                              "citation index (windows covering pages 133 and "
                              "904)")
            touched.append({"source_id": sid, "old_sha256": old,
                            "new_sha256": rec["sha256"],
                            "excerpt_chars": len(rec["excerpt"])})
            out.append(json.dumps({k: rec[k] for k in FIELD_ORDER},
                                  ensure_ascii=False))
        else:
            out.append(line)

    ids = {json.loads(x)["source_id"] for x in out}
    for rec in index_records:
        if rec["source_id"] in ids:
            continue
        out.append(json.dumps({k: rec[k] for k in FIELD_ORDER},
                              ensure_ascii=False))
        touched.append({"source_id": rec["source_id"], "old_sha256": None,
                        "new_sha256": rec["sha256"],
                        "excerpt_chars": len(rec["excerpt"])})

    tmp = SOURCES + ".b9b.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, SOURCES)
    print(json.dumps({"touched": touched, "record_count": len(out)}, indent=1))


if __name__ == "__main__":
    main()
