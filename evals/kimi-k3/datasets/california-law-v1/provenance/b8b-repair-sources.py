#!/usr/bin/env python3
"""
B8b excerpt repair -- sources.jsonl edit step.

WHAT THIS DOES
  Repairs the two EXCERPT_MISMATCH records flagged by the B8a officiality audit
  (provenance/b8a-officiality-audit.json) by replacing their aggregator-derived
  excerpts with VERBATIM text sliced out of the official California Supreme Court
  slip-opinion PDFs, re-anchoring canonical_url to those official PDFs, and
  recomputing sha256 over the new excerpt bytes. It also appends one new
  citation-metadata-only source record that grounds the official-reports page
  cite for Geiser v. Kuhns.

INPUT FILES (absolute paths)
  /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl
  <scratchpad>/b8/geiser.txt      (pdftotext -layout of https://www4.courts.ca.gov/opinions/archive/S262032.PDF)
  <scratchpad>/b8/wilson.txt      (pdftotext -layout of https://www4.courts.ca.gov/opinions/archive/S239686.PDF)
  <scratchpad>/b8/tayts_raw.txt   (pdftotext of https://www.govinfo.gov/content/pkg/USCOURTS-cand-3_25-cv-03001/pdf/USCOURTS-cand-3_25-cv-03001-1.pdf)

OUTPUT FILES (absolute paths)
  /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1/sources.jsonl  (rewritten atomically: temp file + os.replace)
  <scratchpad>/b8/sources.jsonl.pre-b8b.bak  (pre-edit backup, written by the caller)

REGENERATING THE INPUTS (the three .txt files above are session scratch)
  curl -sSL -o S262032.PDF https://www4.courts.ca.gov/opinions/archive/S262032.PDF
  curl -sSL -o S239686.PDF https://www4.courts.ca.gov/opinions/archive/S239686.PDF
  curl -sSL -o tayts.pdf   https://www.govinfo.gov/content/pkg/USCOURTS-cand-3_25-cv-03001/pdf/USCOURTS-cand-3_25-cv-03001-1.pdf
  pdftotext -layout S262032.PDF geiser.txt
  pdftotext -layout S239686.PDF wilson.txt
  pdftotext           tayts.pdf tayts_raw.txt
  Then run this script from the directory holding those .txt files.

NOTES
  Every excerpt segment is asserted to be a whitespace-normalized verbatim
  substring of the official extracted text before anything is written; the
  script aborts if any assertion fails. Segments that are non-contiguous in the
  official document are joined with ' ... ', the convention already used by the
  registry.
"""
import hashlib
import json
import os
import re
import sys

SCRATCH = os.path.dirname(os.path.abspath(__file__))
DATASET = ("/Users/arjundivecha/Dropbox/AAA Backup/A Working/"
           "California-Law-Chatbot/evals/kimi-k3/datasets/california-law-v1")
SOURCES = os.path.join(DATASET, "sources.jsonl")
RETRIEVED_AT = "2026-07-27T23:30:00Z"

GEISER_PDF = "https://www4.courts.ca.gov/opinions/archive/S262032.PDF"
WILSON_PDF = "https://www4.courts.ca.gov/opinions/archive/S239686.PDF"
TAYTS_PDF = ("https://www.govinfo.gov/content/pkg/USCOURTS-cand-3_25-cv-03001/"
             "pdf/USCOURTS-cand-3_25-cv-03001-1.pdf")


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def official_text(path, drop_line_numbers=False):
    raw = open(os.path.join(SCRATCH, path), encoding="utf-8").read()
    if drop_line_numbers:
        keep = [ln for ln in raw.split("\n")
                if ln.strip() and not re.fullmatch(r"\d+", ln.strip())]
        raw = " ".join(keep)
    return norm(raw)


GEISER_TEXT = official_text("geiser.txt")
WILSON_TEXT = official_text("wilson.txt")
TAYTS_TEXT = official_text("tayts_raw.txt", drop_line_numbers=True)

GEISER_SEGS = [
    "IN THE SUPREME COURT OF CALIFORNIA GREGORY GEISER, Plaintiff and "
    "Appellant, v. PETER KUHNS et al., Defendants and Appellants. S262032 "
    "Second Appellate District, Division Five B279738 Los Angeles County "
    "Superior Court BS161018, BS16019, BS161020",
    "August 29, 2022 Justice Liu authored the opinion of the Court, in which "
    "Chief Justice Cantil-Sakauye and Justices Corrigan, Kruger, Groban, "
    "Jenkins, and Guerrero concurred.",
    "Opinion of the Court by Liu, J.",
    "The Legislature enacted Code of Civil Procedure section 425.16 to combat "
    "“a disturbing increase” in Strategic Lawsuits Against Public "
    "Participation (SLAPPs): “lawsuits brought primarily to chill the "
    "valid exercise of the constitutional rights of freedom of speech and "
    "petition for the redress of grievances.”",
]

WILSON_SEGS = [
    "IN THE SUPREME COURT OF CALIFORNIA STANLEY WILSON, Plaintiff and "
    "Appellant, v. CABLE NEWS NETWORK, INC., et al., Defendants and "
    "Respondents. S239686 Second Appellate District, Division One B264944 "
    "Los Angeles County Superior Court BC559720",
    "July 22, 2019 Justice Kruger authored the opinion of the Court, in which "
    "Chief Justice Cantil-Sakauye and Justices Chin, Corrigan, Liu, "
    "Cuéllar, and Groban concurred.",
    "Opinion of the Court by Kruger, J.",
    "Plaintiff Stanley Wilson began working for Cable News Network, Inc., in "
    "1996, and wrote and produced stories for the network for more than 17 "
    "years.",
    "We hold otherwise. The statute contains no exception for discrimination "
    "or retaliation claims, and in some cases the actions a plaintiff alleges "
    "in support of his or her claim may qualify as protected speech or "
    "petitioning activity under section 425.16. In such cases, the "
    "plaintiff’s allegations about the defendant’s invidious motives "
    "will not shield the claim from the same preliminary screening for minimal "
    "merit that would apply to any other claim arising from protected activity.",
]

TAYTS_SEGS = [
    "In Geiser v. Kuhns, 13 Cal. 5th 1238, 1253–54 (2022), the California "
    "Supreme Court clarified the “first step is satisfied so long as the "
    "challenged speech or conduct, considered in light of its context, may "
    "reasonably be understood to implicate a public issue, even if it also "
    "implicates a private dispute”",
]


def build(segs, text, label):
    for i, seg in enumerate(segs):
        if norm(seg) not in text:
            sys.exit(f"ABORT: {label} segment {i} is not verbatim in the "
                     f"official text")
    return " ... ".join(segs)


GEISER_EXCERPT = build(GEISER_SEGS, GEISER_TEXT, "GEISER")
WILSON_EXCERPT = build(WILSON_SEGS, WILSON_TEXT, "WILSON")
TAYTS_EXCERPT = build(TAYTS_SEGS, TAYTS_TEXT, "TAYTS")

REPAIR_NOTE_GEISER = (
    " [B8b excerpt repair 2026-07-27: RE-ANCHORED to the official California "
    "Supreme Court slip opinion at " + GEISER_PDF + " (HTTP 200, 28 pp.), "
    "fetched with raw curl and converted with `pdftotext -layout`. The prior "
    "excerpt came from an aggregator reproduction (animallawconference.org, "
    "Casetext-sourced) and failed strict verbatim comparison on two cosmetic "
    "points flagged by the B8a audit: mixed-case caption and single-quote "
    "glyphs. The excerpt above is now a ' ... '-joined concatenation of four "
    "contiguous verbatim runs of the official opinion text (caption block; "
    "filing date and authorship line; 'Opinion of the Court by Liu, J.'; the "
    "section 425.16 legislative-purpose sentence with the court's own curly "
    "double quotation marks), each asserted in code to be a "
    "whitespace-normalized substring of the official extraction before the "
    "record was written. Word content is unchanged from the prior excerpt "
    "except for the added docket/date/authorship block; sha256 recomputed over "
    "the new bytes.]"
)

REPAIR_NOTE_WILSON = (
    " [B8b excerpt repair 2026-07-27: RE-ANCHORED to the official California "
    "Supreme Court slip opinion at " + WILSON_PDF + " (HTTP 200, 42 pp.), "
    "fetched with raw curl and converted with `pdftotext -layout`. The prior "
    "vLex-derived excerpt mixed genuine opinion text with citation-service "
    "metadata and a PARAPHRASED 'Held:' clause (it inserted the word "
    "'categorical', which the opinion does not use), which the B8a audit "
    "flagged as EXCERPT_MISMATCH. The excerpt above is now a ' ... '-joined "
    "concatenation of five contiguous verbatim runs of the official opinion "
    "(caption block; filing date and authorship line; 'Opinion of the Court by "
    "Kruger, J.'; the part I opening sentence; and the court's actual holding "
    "passage beginning 'We hold otherwise.'), each asserted in code to be a "
    "whitespace-normalized substring of the official extraction before the "
    "record was written. The parallel-reporter citation string that previously "
    "lived in this excerpt is NOT court text and was dropped; the official "
    "reports cite 7 Cal.5th 871 remains in this record's locator field and is "
    "separately grounded for the dependent task criterion by the "
    "citation-metadata record CIT-INDEX-CAL-5TH-7. sha256 recomputed over the "
    "new bytes.]"
)

NEW_RECORD = {
    "source_id": "CIT-META-GEISER-CAL5TH-1238",
    "canonical_url": TAYTS_PDF,
    "locator": ("Tayts v. Gacutan (N.D.Cal. Jan. 16, 2026) No. "
                "3:25-cv-03001-JSC, order re: special motion to strike, p. 12 "
                "(official GPO govinfo USCOURTS copy) -- quoting the "
                "California Official Reports citation of Geiser v. Kuhns"),
    "jurisdiction": ("United States District Court, Northern District of "
                     "California (federal)"),
    "authority_kind": "case",
    "publication_or_precedential_status": (
        "Official federal court document published by the U.S. Government "
        "Publishing Office (govinfo USCOURTS collection); used here for "
        "CITATION-METADATA VERIFICATION ONLY -- which volume and page of the "
        "California Official Reports the California Supreme Court's opinion in "
        "Geiser v. Kuhns occupies -- and never as the source of a substantive "
        "California-law proposition"
    ),
    "effective_date": "2026-01-16",
    "retrieved_at": RETRIEVED_AT,
    "excerpt": TAYTS_EXCERPT,
    "discovery_notes": (
        "Added during the B8b excerpt repair (2026-07-27) to give task "
        "criterion verification-real-001-c1 a real source-entailed grounding "
        "for the official-reports page cite '13 Cal.5th 1238', which the "
        "official Geiser slip opinion (a slip opinion, filed before the "
        "Official Reports assign a page) does not and cannot state. "
        "CourtListener was tried first and is a genuine dead end here: "
        "https://www.courtlistener.com/c/cal-5th/13/ indexes only 11 entries "
        "for volume 13 Cal.5th, the highest being 13 Cal. 5th 974, and "
        "https://www.courtlistener.com/c/cal-5th/13/1238/ returns HTTP 404, so "
        "no CIT-INDEX-* volume-index record could be built for this page; the "
        "CourtListener search page and REST API returned HTTP 403/401 to "
        "unauthenticated curl. The record above was found instead by a "
        "full-text search of the official GPO govinfo API "
        "(POST https://api.govinfo.gov/search, query \"13 Cal. 5th 1238\") "
        "which returned exactly one document, USCOURTS-cand-3_25-cv-03001-1; "
        "the PDF was fetched with raw curl from the govinfo.gov permalink and "
        "converted with `pdftotext` (no -layout), and the excerpt was "
        "reconstructed deterministically by dropping the CM/ECF line-number "
        "gutter (lines consisting solely of digits) and joining the remaining "
        "lines with single spaces; the resulting sentence was then asserted in "
        "code to be a whitespace-normalized substring of that extraction. "
        "This is an official federal judicial document used in the "
        "citation-metadata role the spec permits for aggregators -- a strictly "
        "stronger source than an aggregator for that role -- and no "
        "substantive proposition rests on it."
    ),
}


def sha256_of(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main():
    lines = open(SOURCES, encoding="utf-8").read().split("\n")
    out = []
    touched = []
    for line in lines:
        if not line.strip():
            continue
        rec = json.loads(line)
        if rec["source_id"] == "CIT-REAL-3":
            rec["canonical_url"] = GEISER_PDF
            rec["excerpt"] = GEISER_EXCERPT
            rec["sha256"] = sha256_of(GEISER_EXCERPT)
            rec["retrieved_at"] = RETRIEVED_AT
            rec["discovery_notes"] = rec["discovery_notes"] + REPAIR_NOTE_GEISER
            touched.append(rec["source_id"])
            out.append(json.dumps(rec, ensure_ascii=False))
        elif rec["source_id"] == "CIT-REAL-15":
            rec["canonical_url"] = WILSON_PDF
            rec["excerpt"] = WILSON_EXCERPT
            rec["sha256"] = sha256_of(WILSON_EXCERPT)
            rec["retrieved_at"] = RETRIEVED_AT
            rec["discovery_notes"] = rec["discovery_notes"] + REPAIR_NOTE_WILSON
            touched.append(rec["source_id"])
            out.append(json.dumps(rec, ensure_ascii=False))
        else:
            out.append(line)

    ids = {json.loads(x)["source_id"] for x in out}
    if NEW_RECORD["source_id"] not in ids:
        rec = dict(NEW_RECORD)
        rec["sha256"] = sha256_of(rec["excerpt"])
        ordered = {k: rec[k] for k in (
            "source_id", "canonical_url", "locator", "jurisdiction",
            "authority_kind", "publication_or_precedential_status",
            "effective_date", "retrieved_at", "excerpt", "sha256",
            "discovery_notes")}
        out.append(json.dumps(ordered, ensure_ascii=False))
        touched.append(ordered["source_id"])

    tmp = SOURCES + ".b8b.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, SOURCES)
    print(json.dumps({
        "touched": touched,
        "record_count": len(out),
        "geiser_sha256": sha256_of(GEISER_EXCERPT),
        "wilson_sha256": sha256_of(WILSON_EXCERPT),
        "tayts_sha256": sha256_of(TAYTS_EXCERPT),
    }, indent=1))


if __name__ == "__main__":
    main()
