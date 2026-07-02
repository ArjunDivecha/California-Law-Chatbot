"""
=============================================================================
SCRIPT NAME: opf_ab_test.py
=============================================================================

INPUT FILES:
- remote_artifacts/data/privacy_filter_full/test.jsonl: Official held-out test set (26,167 examples)
  Format: {"text": "...", "spans": {"private_person": [[start, end]], ...}}

OUTPUT FILES:
- reports/opf_ab_test_YYYY-MM-DD.md:   Human-readable markdown comparison report
- reports/opf_ab_test_YYYY-MM-DD.json: Raw metrics for all sections

VERSION: 1.0
LAST UPDATED: 2026-05-12
AUTHOR: Generated via Claude Code

DESCRIPTION:
A/B comparison of the baseline OPF privacy filter (no checkpoint override) vs
the fine-tuned run_b_weighted checkpoint trained on the AI4Privacy multilingual
dataset.

Three evaluation sections:
  1. Official held-out test set sample (stratified first-N from test.jsonl)
  2. Curated legal-context prompts — attorney-style queries with foreign names
     across 10 language groups commonly seen in California courts
  3. English-only regression check — ensures baseline English PII detection
     is not degraded by fine-tuning on multilingual data

For sections 2 & 3 the script runs `opf redact --format json` on each prompt
and computes its own precision/recall/F1 against hand-labelled ground truth.

The curated prompts deliberately embed names in attorney-query context:
  "My client [Name] would like to dispute..."
so they stress-test the model in the use case that actually matters.

DEPENDENCIES:
- Python stdlib only: subprocess, json, random, pathlib, datetime, tempfile,
  shutil, textwrap, argparse, os

USAGE:
  # Run from the California-Law-Chatbot-prd-run directory:
  cd "/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-prd-run"
  python3 scripts/opf_ab_test.py

  # Optional flags:
  python3 scripts/opf_ab_test.py --sample-size 2000 --seed 42 --device cpu

NOTES:
- Eval on 2000 examples takes ~5 min on M4 Max CPU; full 26k ~65 min.
- Fine-tuned checkpoint is 2.6 GB; it is NOT downloaded — must already be
  present at remote_artifacts/runs/privacy_filter_full/run_b_weighted/
- Set --device mps for Apple Silicon GPU acceleration (experimental).
- Writes results incrementally: metrics JSON is written per-section so a crash
  mid-run still produces a partial report.
=============================================================================
"""

import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import textwrap
from datetime import date
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent.resolve()
REPO_DIR = SCRIPT_DIR.parent

OPF_BIN = Path.home() / ".opf-daemon/venv/bin/opf"
CHECKPOINT_FINETUNED = REPO_DIR / "remote_artifacts/runs/privacy_filter_full/run_b_weighted"
TEST_JSONL = REPO_DIR / "remote_artifacts/data/privacy_filter_full/test.jsonl"
REPORTS_DIR = REPO_DIR / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

DATE_STR = date.today().isoformat()
REPORT_MD = REPORTS_DIR / f"opf_ab_test_{DATE_STR}.md"
REPORT_JSON = REPORTS_DIR / f"opf_ab_test_{DATE_STR}.json"

# ---------------------------------------------------------------------------
# Curated legal-context prompts
# Each entry: {"text": str, "spans": {"private_person": [[s,e]], ...}}
# Spans are char-level, inclusive start, exclusive end (same as OPF format).
# Language groups reflect California court demographics.
# ---------------------------------------------------------------------------
LEGAL_PROMPTS = [
    # ── Spanish (es) ─────────────────────────────────────────────────────────
    {
        "text": "My client María González would like to dispute the property boundary at 123 Main St.",
        "spans": {"private_person": [[10, 24]]},
        "lang": "es", "scenario": "spanish_name_in_english_query",
    },
    {
        "text": "Please review the custody agreement for José Luis Hernández-Morales, DOB 1985-03-14.",
        "spans": {"private_person": [[40, 67]], "private_date": [[73, 83]]},
        "lang": "es", "scenario": "spanish_compound_surname",
    },
    {
        "text": "The respondent, Alejandra Fuentes de la Cruz, contests the dissolution.",
        "spans": {"private_person": [[16, 44]]},
        "lang": "es", "scenario": "spanish_de_la_surname",
    },
    # ── Chinese (zh) ─────────────────────────────────────────────────────────
    {
        "text": "Client Wei Zhang requests review of the commercial lease at 400 Sacramento Blvd.",
        "spans": {"private_person": [[7, 16]]},
        "lang": "zh", "scenario": "chinese_name_western_order",
    },
    {
        "text": "Opposing party Zhang Wei (张伟) disputes the contract terms.",
        "spans": {"private_person": [[15, 24]]},
        "lang": "zh", "scenario": "chinese_name_with_hanzi",
    },
    {
        "text": "Please prepare the estate plan for Li Meizhen, currently residing in Cupertino.",
        "spans": {"private_person": [[35, 45]]},
        "lang": "zh", "scenario": "chinese_three_character_name",
    },
    # ── Vietnamese (vi) ───────────────────────────────────────────────────────
    {
        "text": "My client Nguyen Thi Lan needs advice on the small business licensing requirements.",
        "spans": {"private_person": [[10, 24]]},
        "lang": "vi", "scenario": "vietnamese_three_part_name",
    },
    {
        "text": "The petitioner, Pham Van An, seeks modification of the support order.",
        "spans": {"private_person": [[16, 27]]},
        "lang": "vi", "scenario": "vietnamese_middle_honorific",
    },
    # ── Korean (ko) ───────────────────────────────────────────────────────────
    {
        "text": "Attorney Kim Ji-won represents the plaintiff in the trademark dispute.",
        "spans": {"private_person": [[9, 19]]},
        "lang": "ko", "scenario": "korean_hyphenated_given_name",
    },
    {
        "text": "My client Park Seo-yeon would like to contest the eviction notice.",
        "spans": {"private_person": [[10, 23]]},
        "lang": "ko", "scenario": "korean_name_romanized",
    },
    # ── Arabic (ar) ───────────────────────────────────────────────────────────
    {
        "text": "Client Fatima Al-Hassan disputes the employment termination at Acme Corp.",
        "spans": {"private_person": [[7, 23]]},
        "lang": "ar", "scenario": "arabic_al_surname",
    },
    {
        "text": "Please advise Mohammed Ibn Khalid regarding the immigration petition.",
        "spans": {"private_person": [[14, 33]]},
        "lang": "ar", "scenario": "arabic_patronymic_ibn",
    },
    # ── Hindi / Indian (hi) ───────────────────────────────────────────────────
    {
        "text": "My client Rajesh Kumar Patel is seeking advice on the employment contract.",
        "spans": {"private_person": [[10, 28]]},
        "lang": "hi", "scenario": "indian_three_part_name",
    },
    {
        "text": "The respondent, Priya Subramaniam, has filed a counter-petition.",
        "spans": {"private_person": [[16, 33]]},
        "lang": "hi", "scenario": "south_indian_surname",
    },
    # ── French (fr) ───────────────────────────────────────────────────────────
    {
        "text": "Client Pierre-Jean Dubois requests review of the real estate contract.",
        "spans": {"private_person": [[7, 25]]},
        "lang": "fr", "scenario": "french_hyphenated_given_name",
    },
    {
        "text": "Please prepare the trust documents for Marie-Claire de Villeneuve.",
        "spans": {"private_person": [[39, 65]]},
        "lang": "fr", "scenario": "french_de_particle",
    },
    # ── Russian (ru) ──────────────────────────────────────────────────────────
    {
        "text": "My client Ivan Petrov would like to dispute the business partnership agreement.",
        "spans": {"private_person": [[10, 21]]},
        "lang": "ru", "scenario": "russian_name_romanized",
    },
    {
        "text": "The claimant Olga Nikolaevna Sorokina contests the inheritance distribution.",
        "spans": {"private_person": [[13, 37]]},
        "lang": "ru", "scenario": "russian_patronymic_full_name",
    },
    # ── Japanese (ja) ─────────────────────────────────────────────────────────
    {
        "text": "Client Tanaka Hiroshi requests legal advice on the employment dispute.",
        "spans": {"private_person": [[7, 21]]},
        "lang": "ja", "scenario": "japanese_name_surname_first",
    },
    {
        "text": "My client Yamamoto Keiko is seeking dissolution of the business partnership.",
        "spans": {"private_person": [[10, 24]]},
        "lang": "ja", "scenario": "japanese_female_given_name",
    },
    # ── German (de) ───────────────────────────────────────────────────────────
    {
        "text": "Please advise Hans-Wilhelm Müller on the corporate restructuring.",
        "spans": {"private_person": [[14, 33]]},
        "lang": "de", "scenario": "german_hyphenated_umlaut",
    },
    {
        "text": "Client Sophie von Bernstein disputes the commercial lease terms.",
        "spans": {"private_person": [[7, 27]]},
        "lang": "de", "scenario": "german_von_particle",
    },
    # ── Portuguese / Brazilian (pt) ───────────────────────────────────────────
    {
        "text": "My client Ana Carolina Ferreira da Silva needs probate advice.",
        "spans": {"private_person": [[10, 40]]},
        "lang": "pt", "scenario": "portuguese_compound_name_da",
    },
    {
        "text": "The petitioner João Paulo Rodrigues requests modification of child support.",
        "spans": {"private_person": [[15, 35]]},
        "lang": "pt", "scenario": "portuguese_accented_name",
    },
]

# ---------------------------------------------------------------------------
# English regression prompts — these must NOT regress from baseline
# ---------------------------------------------------------------------------
ENGLISH_REGRESSION_PROMPTS = [
    {
        "text": "My client John Smith would like to review the contract.",
        "spans": {"private_person": [[10, 20]]},
        "lang": "en", "scenario": "english_basic_full_name",
    },
    {
        "text": "Please contact Jane Doe at jane.doe@example.com regarding the lease.",
        "spans": {
            "private_person": [[15, 23]],
            "private_email": [[27, 47]],
        },
        "lang": "en", "scenario": "english_name_and_email",
    },
    {
        "text": "Client Robert J. Williams, SSN 123-45-6789, filed for bankruptcy.",
        "spans": {
            "private_person": [[7, 25]],
            "secret": [[31, 42]],
        },
        "lang": "en", "scenario": "english_name_and_ssn",
    },
    {
        "text": "The defendant Mary O'Brien-Johnson lives at 500 Oak Street, San Francisco, CA 94102.",
        "spans": {
            "private_person": [[14, 34]],
            "private_address": [[44, 83]],
        },
        "lang": "en", "scenario": "english_hyphenated_name_and_address",
    },
    {
        "text": "Please call Dr. Elizabeth Thompson at (415) 555-0123 to schedule.",
        "spans": {
            "private_person": [[16, 34]],
            "private_phone": [[38, 52]],
        },
        "lang": "en", "scenario": "english_title_name_phone",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run_opf_eval(dataset_path: Path, checkpoint: Path | None, device: str,
                 max_examples: int | None, metrics_out: Path) -> dict:
    """
    Run `opf eval` and return parsed metrics dict.
    Writes metrics JSON to metrics_out for fault tolerance.
    """
    cmd = [str(OPF_BIN), "eval", str(dataset_path),
           "--device", device,
           "--per-class",
           "--metrics-out", str(metrics_out)]
    if checkpoint:
        cmd += ["--checkpoint", str(checkpoint)]
    if max_examples:
        cmd += ["--max-examples", str(max_examples)]

    print(f"  Running: {' '.join(cmd[:6])} ... (max={max_examples})")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ERROR: opf eval failed\n{result.stderr[-2000:]}", file=sys.stderr)
        raise RuntimeError(f"opf eval failed with code {result.returncode}")

    if not metrics_out.exists():
        raise RuntimeError(f"metrics file not written: {metrics_out}")

    with open(metrics_out) as f:
        return json.load(f)


def run_opf_redact(text: str, checkpoint: Path | None, device: str) -> dict:
    """
    Run `opf redact --format json` on a single text string.
    Returns the parsed JSON output dict.
    """
    cmd = [str(OPF_BIN), "redact", "--format", "json",
           "--device", device, "--output-mode", "typed",
           "--no-print-color-coded-text"]
    if checkpoint:
        cmd += ["--checkpoint", str(checkpoint)]
    cmd.append(text)

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"opf redact failed: {result.stderr[-500:]}")

    # Output is JSON followed by optional ANSI legend; extract just the JSON object
    raw = result.stdout.strip()
    brace = raw.find('{')
    if brace < 0:
        raise RuntimeError(f"No JSON in opf redact output: {raw[:200]}")
    # Find the matching closing brace
    depth = 0
    end_idx = brace
    for i, ch in enumerate(raw[brace:], start=brace):
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end_idx = i
                break
    return json.loads(raw[brace:end_idx + 1])


def extract_predicted_spans(redact_output: dict, category: str) -> list[tuple[int, int]]:
    """
    Pull [start, end] pairs for a given category from opf redact JSON output.
    OPF redact `typed` mode returns spans as list of {start, end, label}.
    """
    spans = []
    for span in redact_output.get("detected_spans", []):
        if span.get("label") == category:
            spans.append((span["start"], span["end"]))
    return spans


def iou_match(pred: list[tuple[int, int]], gold: list[tuple[int, int]],
              threshold: float = 0.5) -> tuple[int, int, int]:
    """
    Compute TP, FP, FN using IoU-based matching (threshold overlap required).
    Returns (tp, fp, fn).
    """
    matched_gold = set()
    tp = 0
    for ps, pe in pred:
        for i, (gs, ge) in enumerate(gold):
            if i in matched_gold:
                continue
            intersection = max(0, min(pe, ge) - max(ps, gs))
            union = max(pe, ge) - min(ps, gs)
            if union > 0 and intersection / union >= threshold:
                tp += 1
                matched_gold.add(i)
                break
    fp = len(pred) - tp
    fn = len(gold) - len(matched_gold)
    return tp, fp, fn


def prf(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    """Precision, recall, F1 from TP/FP/FN counts."""
    p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
    return p, r, f


def eval_prompt_set(prompts: list[dict], checkpoint: Path | None,
                    device: str, label: str) -> dict:
    """
    Run opf redact on each prompt in the list and aggregate P/R/F1.
    Returns a dict of results including per-prompt details.
    """
    total_tp = total_fp = total_fn = 0
    per_prompt = []
    for p in prompts:
        text = p["text"]
        gold_spans_by_cat = p["spans"]
        try:
            out = run_opf_redact(text, checkpoint, device)
        except Exception as e:
            per_prompt.append({"text": text[:60], "error": str(e)})
            continue

        # Aggregate across all categories present in ground truth
        prompt_tp = prompt_fp = prompt_fn = 0
        cat_details = {}
        # Collect all predicted categories
        pred_by_cat: dict[str, list] = {}
        for span in out.get("detected_spans", []):
            cat = span.get("label", "unknown")
            pred_by_cat.setdefault(cat, []).append((span["start"], span["end"]))

        all_cats = set(gold_spans_by_cat.keys()) | set(pred_by_cat.keys())
        for cat in all_cats:
            gold = [tuple(s) for s in gold_spans_by_cat.get(cat, [])]
            pred = pred_by_cat.get(cat, [])
            tp, fp, fn = iou_match(pred, gold)
            prompt_tp += tp; prompt_fp += fp; prompt_fn += fn
            pp, pr, pf = prf(tp, fp, fn)
            cat_details[cat] = {"tp": tp, "fp": fp, "fn": fn, "f1": round(pf, 4)}

        total_tp += prompt_tp; total_fp += prompt_fp; total_fn += prompt_fn
        pp, pr, pf = prf(prompt_tp, prompt_fp, prompt_fn)
        per_prompt.append({
            "lang": p.get("lang"), "scenario": p.get("scenario"),
            "text_preview": text[:70],
            "f1": round(pf, 4),
            "precision": round(pp, 4),
            "recall": round(pr, 4),
            "categories": cat_details,
            "predicted_spans": out.get("detected_spans", []),
        })

    prec, rec, f1 = prf(total_tp, total_fp, total_fn)
    return {
        "label": label,
        "n_prompts": len(prompts),
        "aggregate": {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "tp": total_tp, "fp": total_fp, "fn": total_fn,
        },
        "per_prompt": per_prompt,
    }


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def fmt_delta(baseline: float, finetuned: float) -> str:
    """Format a metric delta with sign and colour indicator."""
    delta = finetuned - baseline
    sign = "+" if delta >= 0 else ""
    flag = "▲" if delta > 0.01 else ("▼" if delta < -0.01 else "≈")
    return f"{sign}{delta:.4f} {flag}"


def extract_eval_metric(metrics: dict, key: str, per_class_cat: str | None = None) -> float:
    """
    Pull a scalar metric from opf eval metrics JSON.
    opf eval --metrics-out produces a dict; structure may vary by version.
    Tries both flat and nested structures.
    """
    if per_class_cat and "per_class" in metrics:
        cls = metrics["per_class"].get(per_class_cat, {})
        if key in cls:
            return float(cls[key])
    # Flat search
    if key in metrics:
        return float(metrics[key])
    # nested under "detection" or "span"
    for section in ("detection", "span", "token"):
        if section in metrics and key in metrics[section]:
            return float(metrics[section][key])
    return float("nan")


def build_markdown_report(results: dict) -> str:
    """Render the full markdown comparison report."""

    sec1_b = results.get("section1_baseline", {})
    sec1_f = results.get("section1_finetuned", {})
    sec2_b = results.get("section2_baseline", {})
    sec2_f = results.get("section2_finetuned", {})
    sec3_b = results.get("section3_baseline", {})
    sec3_f = results.get("section3_finetuned", {})

    def metric_row(name: str, b_val: float, f_val: float) -> str:
        return (f"| {name} | {b_val:.4f} | {f_val:.4f} | "
                f"{fmt_delta(b_val, f_val)} |")

    def eval_row(key: str, label: str, b: dict, f: dict, cat: str | None = None) -> str:
        bv = extract_eval_metric(b, key, cat)
        fv = extract_eval_metric(f, key, cat)
        return metric_row(label, bv, fv)

    def prompt_table(baseline: dict, finetuned: dict) -> str:
        rows = ["| Scenario | Lang | Baseline F1 | Fine-tuned F1 | Delta |",
                "|---|---|---|---|---|"]
        b_map = {p.get("scenario", ""): p for p in baseline.get("per_prompt", []) if "scenario" in p}
        for fp in finetuned.get("per_prompt", []):
            if "error" in fp:
                continue
            sc = fp.get("scenario", "?")
            lang = fp.get("lang", "?")
            bf1 = b_map.get(sc, {}).get("f1", float("nan"))
            ff1 = fp.get("f1", float("nan"))
            if bf1 != bf1:  # nan check
                delta = "n/a"
            else:
                delta = fmt_delta(bf1, ff1)
            rows.append(f"| `{sc}` | {lang} | {bf1:.4f} | {ff1:.4f} | {delta} |")
        return "\n".join(rows)

    lines = [
        f"# OPF Privacy Filter A/B Test Report",
        f"",
        f"**Date:** {DATE_STR}  ",
        f"**Baseline:** OPF default checkpoint (no override)  ",
        f"**Fine-tuned:** `run_b_weighted` — trained on AI4Privacy multilingual 500k  ",
        f"",
        f"---",
        f"",
        f"## Section 1: Official Held-Out Test Set",
        f"",
        f"Stratified sample from `remote_artifacts/data/privacy_filter_full/test.jsonl`  ",
        f"Sample size: **{results.get('sample_size', '?')}** examples  ",
        f"",
        f"| Metric | Baseline | Fine-tuned | Delta |",
        f"|---|---|---|---|",
    ]

    for key, label in [
        ("detection_f1",  "Detection F1"),
        ("detection_precision", "Detection Precision"),
        ("detection_recall",    "Detection Recall"),
        ("span_f1",             "Span F1"),
        ("span_precision",      "Span Precision"),
        ("span_recall",         "Span Recall"),
        ("token_accuracy",      "Token Accuracy"),
        ("loss",                "Loss"),
    ]:
        lines.append(eval_row(key, label, sec1_b, sec1_f))

    # Per-class private_person row if available
    b_pp_f1 = extract_eval_metric(sec1_b, "f1", "private_person")
    f_pp_f1 = extract_eval_metric(sec1_f, "f1", "private_person")
    if b_pp_f1 == b_pp_f1:  # not nan
        lines.append(metric_row("private_person F1 (per-class)", b_pp_f1, f_pp_f1))
    b_pa_f1 = extract_eval_metric(sec1_b, "f1", "private_address")
    f_pa_f1 = extract_eval_metric(sec1_f, "f1", "private_address")
    if b_pa_f1 == b_pa_f1:
        lines.append(metric_row("private_address F1 (per-class)", b_pa_f1, f_pa_f1))

    lines += [
        f"",
        f"---",
        f"",
        f"## Section 2: Legal-Context Prompts (Foreign Names)",
        f"",
        f"Hand-curated attorney-style queries with foreign names across 10 language groups.  ",
        f"Evaluated with IoU ≥ 0.5 span matching.  ",
        f"",
        f"| Metric | Baseline | Fine-tuned | Delta |",
        f"|---|---|---|---|",
        metric_row("Aggregate Precision",
                   sec2_b.get("aggregate", {}).get("precision", float("nan")),
                   sec2_f.get("aggregate", {}).get("precision", float("nan"))),
        metric_row("Aggregate Recall",
                   sec2_b.get("aggregate", {}).get("recall", float("nan")),
                   sec2_f.get("aggregate", {}).get("recall", float("nan"))),
        metric_row("Aggregate F1",
                   sec2_b.get("aggregate", {}).get("f1", float("nan")),
                   sec2_f.get("aggregate", {}).get("f1", float("nan"))),
        f"",
        f"### Per-Prompt Results",
        f"",
        prompt_table(sec2_b, sec2_f),
        f"",
        f"---",
        f"",
        f"## Section 3: English Regression Check",
        f"",
        f"English-only prompts — verifies baseline English detection is not degraded.  ",
        f"",
        f"| Metric | Baseline | Fine-tuned | Delta |",
        f"|---|---|---|---|",
        metric_row("Aggregate Precision",
                   sec3_b.get("aggregate", {}).get("precision", float("nan")),
                   sec3_f.get("aggregate", {}).get("precision", float("nan"))),
        metric_row("Aggregate Recall",
                   sec3_b.get("aggregate", {}).get("recall", float("nan")),
                   sec3_f.get("aggregate", {}).get("recall", float("nan"))),
        metric_row("Aggregate F1",
                   sec3_b.get("aggregate", {}).get("f1", float("nan")),
                   sec3_f.get("aggregate", {}).get("f1", float("nan"))),
        f"",
        f"### Per-Prompt Regression Details",
        f"",
        prompt_table(sec3_b, sec3_f),
        f"",
        f"---",
        f"",
        f"## Recommendation",
        f"",
    ]

    # Auto-generate recommendation based on numbers
    sec2_f1_b = sec2_b.get("aggregate", {}).get("f1", 0)
    sec2_f1_f = sec2_f.get("aggregate", {}).get("f1", 0)
    sec3_f1_b = sec3_b.get("aggregate", {}).get("f1", 0)
    sec3_f1_f = sec3_f.get("aggregate", {}).get("f1", 0)
    foreign_delta = sec2_f1_f - sec2_f1_b
    regression = sec3_f1_b - sec3_f1_f  # positive = regression

    if foreign_delta > 0.05 and regression < 0.05:
        verdict = (f"✅ **Deploy candidate.** Fine-tuned model improves foreign-name F1 by "
                   f"+{foreign_delta:.4f} with no significant English regression "
                   f"({-regression:+.4f}).")
    elif foreign_delta > 0.05 and regression >= 0.05:
        verdict = (f"⚠️ **Investigate regression.** Foreign-name F1 improved by "
                   f"+{foreign_delta:.4f} but English F1 dropped by {regression:.4f}. "
                   f"Check whether the regression is real or noise before deploying.")
    elif foreign_delta <= 0.05:
        verdict = (f"❌ **Insufficient gain.** Fine-tuned F1 delta on foreign names is "
                   f"only {foreign_delta:+.4f}. May not justify the checkpoint swap.")
    else:
        verdict = "⚠️ Ambiguous — review per-prompt details above."

    lines += [
        verdict,
        f"",
        f"---",
        f"",
        f"*Generated by `scripts/opf_ab_test.py` — do not edit manually.*",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="OPF A/B test: baseline vs fine-tuned")
    parser.add_argument("--sample-size", type=int, default=2000,
                        help="Number of examples from test.jsonl for Section 1 (default 2000)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", default="cpu",
                        help="Device for opf: cpu | mps | cuda (default: cpu)")
    parser.add_argument("--full", action="store_true",
                        help="Run full test set (26k) instead of sample — takes ~65 min on CPU")
    args = parser.parse_args()

    sample_size = None if args.full else args.sample_size
    random.seed(args.seed)

    print(f"\n{'='*60}")
    print(f"OPF A/B Test  —  {DATE_STR}")
    print(f"Baseline:    default OPF checkpoint")
    print(f"Fine-tuned:  {CHECKPOINT_FINETUNED.name}")
    print(f"Device:      {args.device}")
    print(f"Sample:      {'FULL (26167)' if sample_size is None else sample_size}")
    print(f"{'='*60}\n")

    # Validate
    if not OPF_BIN.exists():
        sys.exit(f"ERROR: opf binary not found at {OPF_BIN}")
    if not CHECKPOINT_FINETUNED.exists():
        sys.exit(f"ERROR: fine-tuned checkpoint not found at {CHECKPOINT_FINETUNED}")
    if not TEST_JSONL.exists():
        sys.exit(f"ERROR: test.jsonl not found at {TEST_JSONL}")

    results: dict = {"sample_size": sample_size or 26167, "seed": args.seed,
                     "device": args.device}

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        # ── Section 1: Official test set ─────────────────────────────────────
        print("─── Section 1: Official test set eval ───")
        print(f"  Baseline …")
        m_out_b = tmpdir / "sec1_baseline.json"
        results["section1_baseline"] = run_opf_eval(
            TEST_JSONL, None, args.device, sample_size, m_out_b)

        # Write partial results immediately (fault tolerance)
        REPORT_JSON.write_text(json.dumps(results, indent=2))
        print(f"  Partial results saved → {REPORT_JSON}")

        print(f"  Fine-tuned …")
        m_out_f = tmpdir / "sec1_finetuned.json"
        results["section1_finetuned"] = run_opf_eval(
            TEST_JSONL, CHECKPOINT_FINETUNED, args.device, sample_size, m_out_f)
        REPORT_JSON.write_text(json.dumps(results, indent=2))
        print(f"  Section 1 done ✓")

        # ── Section 2: Legal prompts ──────────────────────────────────────────
        print("\n─── Section 2: Legal-context prompts ───")
        print(f"  Baseline ({len(LEGAL_PROMPTS)} prompts) …")
        results["section2_baseline"] = eval_prompt_set(
            LEGAL_PROMPTS, None, args.device, "baseline")
        REPORT_JSON.write_text(json.dumps(results, indent=2))

        print(f"  Fine-tuned ({len(LEGAL_PROMPTS)} prompts) …")
        results["section2_finetuned"] = eval_prompt_set(
            LEGAL_PROMPTS, CHECKPOINT_FINETUNED, args.device, "finetuned")
        REPORT_JSON.write_text(json.dumps(results, indent=2))
        print(f"  Section 2 done ✓")

        # ── Section 3: English regression ────────────────────────────────────
        print("\n─── Section 3: English regression check ───")
        print(f"  Baseline ({len(ENGLISH_REGRESSION_PROMPTS)} prompts) …")
        results["section3_baseline"] = eval_prompt_set(
            ENGLISH_REGRESSION_PROMPTS, None, args.device, "baseline")
        REPORT_JSON.write_text(json.dumps(results, indent=2))

        print(f"  Fine-tuned ({len(ENGLISH_REGRESSION_PROMPTS)} prompts) …")
        results["section3_finetuned"] = eval_prompt_set(
            ENGLISH_REGRESSION_PROMPTS, CHECKPOINT_FINETUNED, args.device, "finetuned")
        REPORT_JSON.write_text(json.dumps(results, indent=2))
        print(f"  Section 3 done ✓")

    # ── Write final reports ───────────────────────────────────────────────────
    REPORT_JSON.write_text(json.dumps(results, indent=2))
    md = build_markdown_report(results)
    REPORT_MD.write_text(md)

    print(f"\n{'='*60}")
    print(f"DONE")
    print(f"{'='*60}")
    print(f"\nResults:")
    print(f"  Markdown report: {REPORT_MD}")
    print(f"  JSON metrics:    {REPORT_JSON}")
    # Percent-encode spaces for file:// URL
    md_url = "file://" + str(REPORT_MD).replace(" ", "%20")
    json_url = "file://" + str(REPORT_JSON).replace(" ", "%20")
    print(f"\n  {REPORT_MD}")
    print(f"  {md_url}")
    print(f"\n  {REPORT_JSON}")
    print(f"  {json_url}")

    # Print Section 2 headline
    b_f1 = results.get("section2_baseline", {}).get("aggregate", {}).get("f1", float("nan"))
    f_f1 = results.get("section2_finetuned", {}).get("aggregate", {}).get("f1", float("nan"))
    print(f"\nForeign-name legal prompt F1:  baseline={b_f1:.4f}  fine-tuned={f_f1:.4f}"
          f"  delta={fmt_delta(b_f1, f_f1)}")

    b3_f1 = results.get("section3_baseline", {}).get("aggregate", {}).get("f1", float("nan"))
    f3_f1 = results.get("section3_finetuned", {}).get("aggregate", {}).get("f1", float("nan"))
    print(f"English regression F1:         baseline={b3_f1:.4f}  fine-tuned={f3_f1:.4f}"
          f"  delta={fmt_delta(b3_f1, f3_f1)}")


if __name__ == "__main__":
    main()
