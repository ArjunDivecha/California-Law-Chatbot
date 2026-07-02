#!/usr/bin/env python3
"""
=============================================================================
SCRIPT NAME: wandb_tail_opf.py
=============================================================================

DESCRIPTION:
    Tails a training log file and mirrors parsed progress metrics to Weights
    & Biases (wandb). The script continuously polls a log file (specified via
    --log), reads only newly appended lines by tracking the file offset, and
    matches each line against a regex for training progress fields (epoch,
    batch, windows, examples_seen, tokens, train_loss, train_token_accuracy,
    ETA). Each parsed batch's metrics are logged to wandb once, deduplicated
    by batch number. The script loops indefinitely until killed, unless the
    environment variable WANDB_TAIL_ONCE is set to "1", in which case it
    processes existing lines and exits.

INPUT FILES:
    Log file (path provided via --log CLI argument at runtime)
        A training log containing lines matching the regex pattern for
        "train progress:" with fields: epoch, batch, windows,
        examples_seen, tokens, train_loss, train_token_accuracy, ETA.
        The script reads it incrementally using file.seek() — no absolute
        path can be hardcoded because it is user-specified per invocation.

OUTPUT FILES:
    (none — metrics are logged to Weights & Biases via wandb.log(); the
     wandb run URL is printed to stdout for user reference)

VERSION: 1.0
LAST UPDATED: 2026-06-05
AUTHOR: Arjun Divecha

DEPENDENCIES:
    - wandb (Weights & Biases SDK)

USAGE:
    python wandb_tail_opf.py --log /path/to/training.log [--project PROJECT] [--name NAME] [--poll-seconds SECONDS]

    Environment variable (optional):
        WANDB_TAIL_ONCE=1  — process existing log lines and exit (no loop)

NOTES:
    - The --log argument is required; all other arguments are optional.
    - The script resumes a wandb run if one with the same --name exists
      (wandb.init(resume="allow")).
    - The regex is tuned for a specific log format produced by the OPF
      (Optimal Power Flow / privacy-filter) training harness.
    - Deduplication is by batch number; if the same batch appears across
      multiple lines only the first occurrence is logged to wandb.
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import re
import time
from pathlib import Path

import wandb


PROGRESS_RE = re.compile(
    r"train progress: "
    r"epoch=(?P<epoch>\d+)/(?:\d+) "
    r"batch=(?P<batch>\d+)/(?P<total_batches>\d+) "
    r"windows=(?P<windows>\d+)/(?P<total_windows>\d+) "
    r"examples_seen=(?P<examples_seen>\d+)/(?P<total_examples>\d+) "
    r"tokens=(?P<tokens>\d+) "
    r"train_loss=(?P<train_loss>[0-9.]+) "
    r"train_token_accuracy=(?P<train_token_accuracy>[0-9.]+) "
    r"eta_epoch=(?P<eta_epoch>\S+) "
    r"eta_total=(?P<eta_total>\S+)"
)


def parse_line(line: str) -> dict[str, object] | None:
    match = PROGRESS_RE.search(line)
    if not match:
        return None
    values = match.groupdict()
    batch = int(values["batch"])
    total_batches = int(values["total_batches"])
    examples_seen = int(values["examples_seen"])
    total_examples = int(values["total_examples"])
    tokens = int(values["tokens"])
    return {
        "epoch": int(values["epoch"]),
        "batch": batch,
        "total_batches": total_batches,
        "progress_pct": 100.0 * batch / total_batches,
        "windows": int(values["windows"]),
        "total_windows": int(values["total_windows"]),
        "examples_seen": examples_seen,
        "total_examples": total_examples,
        "examples_pct": 100.0 * examples_seen / total_examples,
        "tokens": tokens,
        "train_loss": float(values["train_loss"]),
        "train_token_accuracy": float(values["train_token_accuracy"]),
        "eta_epoch": values["eta_epoch"],
        "eta_total": values["eta_total"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", required=True)
    parser.add_argument("--project", default="privacy-filter-full-train")
    parser.add_argument("--name", default="opf-run-b-weighted-a100")
    parser.add_argument("--poll-seconds", type=float, default=5.0)
    args = parser.parse_args()

    log_path = Path(args.log)
    run = wandb.init(project=args.project, name=args.name, resume="allow")
    print(f"WANDB_URL={run.url}", flush=True)

    seen_batches: set[int] = set()
    offset = 0
    while True:
        if not log_path.exists():
            time.sleep(args.poll_seconds)
            continue

        with log_path.open("r", encoding="utf-8", errors="replace") as handle:
            handle.seek(offset)
            for line in handle:
                metrics = parse_line(line)
                if metrics is None:
                    continue
                batch = int(metrics["batch"])
                if batch in seen_batches:
                    continue
                seen_batches.add(batch)
                wandb.log(metrics, step=batch)
            offset = handle.tell()

        if os.environ.get("WANDB_TAIL_ONCE") == "1":
            break
        time.sleep(args.poll_seconds)


if __name__ == "__main__":
    main()
