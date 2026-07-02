# PRD: End-to-End Multilingual Privacy Filter Fine-Tuning Run

## 1. Objective
Build and execute a reproducible fine-tuning pipeline for `openai/privacy-filter` to improve `private_person` and `private_address` detection for foreign languages and non-US address formats.

## 2. Scope
In scope:
- Dataset acquisition and normalization for AI4Privacy/Kaggle sources
- Label mapping to OpenAI Privacy Filter taxonomy
- Train/validation/test construction with language stratification
- Fine-tune runs, evaluation, error analysis, and release gating
- Staging rollout, canary, monitoring, and rollback plan

Out of scope:
- Full legal-document classifier redesign
- New UI work unrelated to redaction quality

## 3. Success Criteria
1. `private_person` and `private_address` F1 improve over baseline by target deltas.
2. Per-language recall floors are met for each launch language.
3. Over-redaction remains below threshold on production-like eval set.
4. No critical regression on English baseline and adjacent PII labels.

## 4. Data Plan
## 4.1 Sources
1. Kaggle: `open-pii-masking-500k-ai4privacy`
2. Hugging Face mirrors for schema verification and fallback
3. Internal validation set (real multilingual text) for final gate

## 4.2 Canonical Training Schema
Each sample must be converted to:
```json
{
  "text": "...",
  "spans": [
    {"start": 10, "end": 22, "label": "private_person"},
    {"start": 45, "end": 78, "label": "private_address"}
  ]
}
```

## 4.3 Label Mapping Rules
- Name-like entities -> `private_person`
- Residential/postal address-like entities -> `private_address`
- Preserve other categories only if present and high-confidence
- Exclude ambiguous pure-geography tags unless context indicates identifying address

## 5. Execution Phases
## Phase 0: Environment Readiness
1. Create isolated worktree and branch.
2. Verify Python/runtime dependencies and access to dataset sources.
3. Confirm `openai/privacy-filter` training CLI availability (`opf train`).

Exit gate:
- Reproducible environment setup documented and runnable.

## Phase 1: Data Ingestion + Normalization
1. Acquire source data snapshots and store immutable copies.
2. Normalize into canonical JSONL.
3. Validate span boundaries and label legality.
4. Stratify by language/region/script and split train/val/test.

Exit gate:
- `data/train.jsonl`, `data/val.jsonl`, `data/test.jsonl` validated.

## Phase 2: Baseline + Fine-Tuning Runs
1. Baseline eval using upstream checkpoint.
2. Run three training variants:
- Run A: balanced multilingual mix
- Run B: priority-language weighted mix
- Run C: weighted mix + hard negatives
3. Track metrics and configs for each run.

Exit gate:
- All runs complete with comparable metrics and artifacts.

## Phase 3: Evaluation + Error Analysis
1. Compute micro/macro and per-language P/R/F1 for target labels.
2. Quantify false positives (over-redaction) and false negatives.
3. Review hardest failure buckets: transliteration, punctuation noise, script mixing.

Exit gate:
- Selected candidate passes quantitative thresholds and qualitative review.

## Phase 4: Staging + Canary + Production
1. Stage model and execute integration tests.
2. Canary rollout (5% -> 25% -> 100%).
3. Monitor live quality/latency and rollback triggers.

Exit gate:
- Stable production performance through defined soak period.

## 6. Training Command Template
```bash
opf train \
  --train-data data/train.jsonl \
  --val-data data/val.jsonl \
  --test-data data/test.jsonl \
  --output-dir runs/run_b_priority_weighted
```

## 7. Required Reports
1. Baseline vs candidate comparison table
2. Per-language metrics table
3. Error taxonomy summary with examples
4. Launch recommendation and rollback conditions

## 8. Risks and Mitigations
1. Synthetic-to-real gap
- Mitigation: internal real-text eval gate required for launch.
2. Address ambiguity across locales
- Mitigation: strict mapping rules + locale-specific hard set.
3. Over-redaction harming usability
- Mitigation: explicit precision floor and false-positive budget.

## 9. Definition of Done
1. Candidate model passes all launch gates.
2. Reproducible training and evaluation artifacts are stored and versioned.
3. Canary rollout completed without rollback trigger.
4. Monitoring and retraining trigger policy active.

## 10. Immediate Next Execution Steps in This Branch
1. Implement dataset conversion script for Kaggle/AI4Privacy -> canonical JSONL.
2. Generate language-stratified splits.
3. Run baseline eval and first fine-tune run.
4. Publish initial metrics report.
