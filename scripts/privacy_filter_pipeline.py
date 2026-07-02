"""
=============================================================================
SCRIPT NAME: privacy_filter_pipeline.py
=============================================================================

DESCRIPTION:
    Downloads the ai4privacy/open-pii-masking-500k-ai4privacy dataset from
    Hugging Face, filters samples for person-name and address PII labels
    (GIVENNAME, MIDDLENAME, SURNAME, STREET, CITY, etc.), and splits them
    into train/val/test sets (80/10/10).  Each split is saved as a JSONL
    file containing the raw text and per-label span annotations.  The script
    then trains three PII-filter model variants using the opf CLI (Open PII
    Filter) with different hyperparameters (balanced, weighted, hard-negative)
    and evaluates each variant (plus a baseline) against the held-out test
    set, writing a comparison report to JSON.

INPUT FILES:
    (none — the dataset is streamed from Hugging Face Hub:
        ai4privacy/open-pii-masking-500k-ai4privacy)

OUTPUT FILES:
    {data-dir}/train.jsonl
        80% of filtered samples with text and PII span annotations for
        training.  Default location:
        /Users/arjundivecha/Dropbox/AAA%20Backup/A%20Working/California-Law-Chatbot-prd-run/scripts/data/privacy_filter/train.jsonl
    {data-dir}/val.jsonl
        10% of filtered samples for validation.  Default same directory.
    {data-dir}/test.jsonl
        10% of filtered samples for evaluation.  Default same directory.
    {data-dir}/dataset_report.json
        Summary statistics: total count and top-30 language distribution.
    {runs-dir}/run_a_balanced/
        Trained model checkpoint (balanced config).
        Default: .../scripts/runs/privacy_filter/run_a_balanced/
    {runs-dir}/run_b_weighted/
        Trained model checkpoint (weighted config).
    {runs-dir}/run_c_hardneg/
        Trained model checkpoint (hard-negative config).
    {report}
        JSON object mapping each evaluation variant to its return code
        and truncated stdout/stderr.  Default:
        .../scripts/reports/privacy_filter_eval.json

VERSION: 1.0
LAST UPDATED: 2026-06-05
AUTHOR: Arjun Divecha

DEPENDENCIES:
    - datasets (Hugging Face)
    - opf CLI (Open PII Filter — expected on PATH)
    - argparse, json, os, random, subprocess (stdlib)
    - collections.defaultdict (stdlib)

USAGE:
    python privacy_filter_pipeline.py [--limit N] [--langs LANG1,LANG2]
                                      [--data-dir DIR] [--runs-dir DIR]
                                      [--report PATH]

NOTES:
    - The opf CLI binary must be installed and available on PATH.
    - Default --limit is 3000 samples (after filtering).
    - Run from the scripts/ directory or provide absolute paths via
      --data-dir, --runs-dir, and --report.
    - Device is hardcoded to 'mps' (Apple Metal); change in source for
      CPU/CUDA.
=============================================================================
"""
import argparse, json, os, random, subprocess
from collections import defaultdict
from datasets import load_dataset

PERSON = {"GIVENNAME","MIDDLENAME","SURNAME"}
ADDRESS = {"STREET","BUILDINGNUMBER","CITY","STATE","ZIPCODE","SECONDARYADDRESS","COUNTY"}


def map_label(lbl):
    if lbl in PERSON:
        return "private_person"
    if lbl in ADDRESS:
        return "private_address"
    return None


def convert(limit, outdir, langs=None):
    ds = load_dataset('ai4privacy/open-pii-masking-500k-ai4privacy', split='train')
    rows = []
    for ex in ds:
        if langs and ex.get('language') not in langs:
            continue
        span_map = {}
        for m in ex.get('privacy_mask', []):
            label = map_label(m.get('label'))
            if not label:
                continue
            s, e = int(m['start']), int(m['end'])
            if s < e <= len(ex['source_text']):
                span_map.setdefault(label, []).append([s, e])
        if span_map:
            rows.append({'text': ex['source_text'], 'spans': span_map, 'language': ex.get('language','unk')})
        if limit and len(rows) >= limit:
            break

    random.seed(42)
    random.shuffle(rows)
    n = len(rows)
    n_train = int(n*0.8)
    n_val = int(n*0.1)
    splits = {
        'train': rows[:n_train],
        'val': rows[n_train:n_train+n_val],
        'test': rows[n_train+n_val:]
    }
    os.makedirs(outdir, exist_ok=True)
    for name, items in splits.items():
        path = os.path.join(outdir, f'{name}.jsonl')
        with open(path,'w') as f:
            for it in items:
                f.write(json.dumps({'text':it['text'],'spans':it['spans']}, ensure_ascii=False) + '\n')
    # report language dist
    dist = defaultdict(int)
    for it in rows:
        dist[it['language']] += 1
    with open(os.path.join(outdir,'dataset_report.json'),'w') as f:
        json.dump({'count':n,'languages':dict(sorted(dist.items(), key=lambda x:-x[1])[:30])}, f, indent=2)


def run(cmd):
    print('RUN:', ' '.join(cmd))
    subprocess.run(cmd, check=True)


def train_all(datadir, runs_dir, checkpoint=None):
    base = ['opf','train','--device','mps', os.path.join(datadir,'train.jsonl'), '--validation-dataset', os.path.join(datadir,'val.jsonl'), '--epochs','1','--batch-size','1','--grad-accum-steps','1','--max-train-examples','40','--max-validation-examples','20']
    variants = [
        ('run_a_balanced', []),
        ('run_b_weighted', ['--learning-rate','3e-5']),
        ('run_c_hardneg', ['--learning-rate','2e-5','--weight-decay','0.02'])
    ]
    for name, extra in variants:
        out = os.path.join(runs_dir,name)
        cmd = base + ['--output-dir', out, '--overwrite-output'] + extra
        if checkpoint:
            cmd += ['--checkpoint', checkpoint]
        run(cmd)


def evaluate(datadir, runs_dir, report_path):
    # lightweight comparison: use opf eval for base and each run on test
    results = {}
    ckpts = {'baseline':None, 'run_a_balanced':os.path.join(runs_dir,'run_a_balanced'), 'run_b_weighted':os.path.join(runs_dir,'run_b_weighted'), 'run_c_hardneg':os.path.join(runs_dir,'run_c_hardneg')}
    for name, ck in ckpts.items():
        cmd = ['opf','eval','--device','mps', os.path.join(datadir,'test.jsonl')]
        if ck:
            cmd += ['--checkpoint', ck]
        print('EVAL:', name)
        p = subprocess.run(cmd, capture_output=True, text=True)
        results[name] = {'returncode': p.returncode, 'stdout': p.stdout[-4000:], 'stderr': p.stderr[-2000:]}
    with open(report_path,'w') as f:
        json.dump(results,f,indent=2)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=3000)
    ap.add_argument('--langs', type=str, default='')
    ap.add_argument('--data-dir', default='data/privacy_filter')
    ap.add_argument('--runs-dir', default='runs/privacy_filter')
    ap.add_argument('--report', default='reports/privacy_filter_eval.json')
    args = ap.parse_args()
    langs = [x.strip() for x in args.langs.split(',') if x.strip()] or None
    convert(args.limit, args.data_dir, langs)
    train_all(args.data_dir, args.runs_dir)
    evaluate(args.data_dir, args.runs_dir, args.report)
