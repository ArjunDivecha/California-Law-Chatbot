# Privacy Filter Multilingual Fine-Tuning Run

## Purpose

This worktree contains the end-to-end Privacy Filter fine-tuning effort for improving detection of foreign names and addresses using OpenAI's `openai/privacy-filter` model and the AI4Privacy multilingual PII dataset.

Primary goal:

- Improve `private_person` and `private_address` detection for non-US / non-English examples.

This was done in a separate worktree and branch so the main California Law Chatbot checkout stayed untouched.

## Branch And Worktree

- Branch: `codex/privacy-filter-prd-run`
- Local worktree: `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-prd-run`
- Original repo remained on `main`: `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot`

## Key Files

- PRD/runbook: `docs/PRD_PRIVACY_FILTER_MULTILINGUAL_FINETUNING_RUNBOOK.md`
- Compact local pipeline: `scripts/privacy_filter_pipeline.py`
- Local compact eval report: `reports/privacy_filter_eval.json`
- Compact comparison report: `reports/PRIVACY_FILTER_RUN_COMPARISON.md`
- Full remote checkpoint: `remote_artifacts/runs/privacy_filter_full/run_b_weighted/model.safetensors`
- Full remote checkpoint config: `remote_artifacts/runs/privacy_filter_full/run_b_weighted/config.json`
- Full fine-tune summary: `remote_artifacts/runs/privacy_filter_full/run_b_weighted/finetune_summary.json`
- Full eval report: `remote_artifacts/reports/privacy_filter_full_eval.json`
- Full train/val/test splits: `remote_artifacts/data/privacy_filter_full/`

## Dataset

Source dataset:

- `ai4privacy/open-pii-masking-500k-ai4privacy`

The full remote run used a language-filtered multilingual subset over:

- `es`, `fr`, `de`, `it`, `pt`, `nl`, `pl`, `tr`, `ar`, `hi`, `te`, `ru`, `zh`, `ja`, `ko`

The dataset was converted from AI4Privacy's `privacy_mask` format into OPF's expected JSONL format:

```json
{
  "text": "...",
  "spans": {
    "private_person": [[0, 10]],
    "private_address": [[25, 60]]
  }
}
```

Label mapping:

- `GIVENNAME`, `MIDDLENAME`, `SURNAME` -> `private_person`
- `STREET`, `BUILDINGNUMBER`, `CITY`, `STATE`, `ZIPCODE`, `SECONDARYADDRESS`, `COUNTY` -> `private_address`

Full split sizes after filtering and conversion:

- Train: `209,331`
- Validation: `26,166`
- Test: `26,167`
- Total: `261,664`

## Local Compact Validation Run

Before launching the full remote run, a compact local validation run was executed on the M4 Max Mac to prove the pipeline worked end-to-end.

That compact run trained three variants:

- `run_a_balanced`
- `run_b_weighted`
- `run_c_hardneg`

Compact run outcome:

- `run_b_weighted` was the best candidate.
- It improved compact eval detection F1 from `0.5839` baseline to `0.6377`.
- It improved precision from `0.5222` baseline to `0.6567`.

Because the compact run used only a tiny subset, it was treated as a pipeline and hyperparameter sanity check, not a final model-selection benchmark.

## Full Remote Training Run

Remote instance:

- Provider: Verda
- Instance ID: `ea06fd8a-4d56-4ae7-a163-1507cb77d270`
- IP: `65.108.32.169`
- GPU: `NVIDIA A100-SXM4-80GB`

The full run trained only the chosen candidate:

- `run_b_weighted`

Final training command profile:

```bash
opf train \
  --device cuda \
  data/privacy_filter_full/train.jsonl \
  --validation-dataset data/privacy_filter_full/val.jsonl \
  --epochs 1 \
  --batch-size 1 \
  --grad-accum-steps 32 \
  --output-dir runs/privacy_filter_full/run_b_weighted \
  --overwrite-output \
  --learning-rate 3e-5
```

Important operational note:

- An initial attempt with `--batch-size 8 --grad-accum-steps 4` caused CUDA OOM even on A100 80GB.
- The successful profile used `--batch-size 1 --grad-accum-steps 32`.
- `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` was set for safer CUDA allocation behavior.

Training completed successfully.

Training summary:

- Epochs: `1`
- Train windows/examples: `209,331`
- Validation windows/examples: `26,166`
- Optimizer steps: `6,542`
- Final train loss: `0.082959`
- Validation loss: `0.060810`
- Validation token accuracy: `0.9761`
- Best epoch: `1`

## Full Eval Results

Full held-out test set:

- Test examples: `26,167`
- Test tokens: `830,862`

Baseline OPF:

- Loss: `2.2431`
- Token accuracy: `0.7996`
- Detection precision: `0.5351`
- Detection recall: `0.7366`
- Detection F1: `0.6199`
- Span precision: `0.3804`
- Span recall: `0.6413`
- Span F1: `0.4775`

Fine-tuned `run_b_weighted`:

- Loss: `0.0581`
- Token accuracy: `0.9777`
- Detection precision: `0.9871`
- Detection recall: `0.9794`
- Detection F1: `0.9832`
- Span precision: `0.8790`
- Span recall: `0.9167`
- Span F1: `0.8974`

Headline result:

- Detection F1 improved from `0.6199` to `0.9832`.
- Span F1 improved from `0.4775` to `0.8974`.

This is a very strong improvement on the AI4Privacy-style held-out distribution.

## Spot Checks

A few manual spot checks were run against examples containing Spanish, French, Arabic, Hindi/Indian, and Japanese names/addresses.

Result:

- The fine-tuned model was generally more aggressive and more granular.
- The baseline often masked full addresses as one clean `<PRIVATE_ADDRESS>` span.
- The fine-tuned model sometimes fragmented addresses into multiple `<PRIVATE_ADDRESS>` spans.
- Some hard examples still showed misses, such as partial handling of Arabic and Japanese address/name forms.

Interpretation:

- The full held-out eval is strongly positive.
- Manual spot checks show this should not yet be treated as fully solved for production foreign-name/address detection.
- A harder, real-world validation set is still needed before deploying this as the default production redactor.

## W&B Monitoring

Weights & Biases was attached via a sidecar log parser because OPF's trainer does not natively emit W&B metrics.

Project:

- `privacy-filter-full-train`

Run URL:

- `https://wandb.ai/arjun-divecha-dancing-elephant/privacy-filter-full-train/runs/j5zsvtmy`

Note:

- The W&B run tracked parsed training progress from `full_run.log`, not native OPF callbacks.

## Artifact Pullback

The completed remote artifacts were pulled back locally into:

```text
remote_artifacts/
```

Verified local files:

- `remote_artifacts/runs/privacy_filter_full/run_b_weighted/model.safetensors`
- `remote_artifacts/runs/privacy_filter_full/run_b_weighted/config.json`
- `remote_artifacts/runs/privacy_filter_full/run_b_weighted/finetune_summary.json`
- `remote_artifacts/runs/privacy_filter_full/run_b_weighted/USAGE.txt`
- `remote_artifacts/reports/privacy_filter_full_eval.json`
- `remote_artifacts/data/privacy_filter_full/train.jsonl`
- `remote_artifacts/data/privacy_filter_full/val.jsonl`
- `remote_artifacts/data/privacy_filter_full/test.jsonl`

Local verification:

- Checkpoint size: `2.6G`
- Eval JSON parses successfully.
- Fine-tune summary JSON parses successfully.
- Split line counts verified: `209,331 / 26,166 / 26,167`.

Checksums:

```text
6c59dd2372cfeab7c74c4a76819f92799b842a879e499498dfb67cbd34bc41fa  remote_artifacts/runs/privacy_filter_full/run_b_weighted/model.safetensors
be039f60a12622a73ec32af4a55e3d4a8301d59ffa134fa0b518a54708209bcd  remote_artifacts/reports/privacy_filter_full_eval.json
1ea7e4550f35774626cbc8add9767115b76cc6c4dcb71decba06af3c3fafd64b  remote_artifacts/runs/privacy_filter_full/run_b_weighted/finetune_summary.json
```

The remote GPU was idle after completion, so the instance no longer needed to remain online after artifact pullback.

## How To Use The Fine-Tuned Checkpoint

Example local inference command, assuming OPF is installed:

```bash
opf redact \
  --checkpoint remote_artifacts/runs/privacy_filter_full/run_b_weighted \
  --device cpu \
  "María González vive en Calle de Alcalá 45, 28014 Madrid."
```

On a CUDA machine:

```bash
opf redact \
  --checkpoint remote_artifacts/runs/privacy_filter_full/run_b_weighted \
  --device cuda \
  "María González vive en Calle de Alcalá 45, 28014 Madrid."
```

Full eval rerun:

```bash
opf eval \
  --device cuda \
  remote_artifacts/data/privacy_filter_full/test.jsonl \
  --checkpoint remote_artifacts/runs/privacy_filter_full/run_b_weighted
```

## Recommendation

Use `run_b_weighted` as the candidate checkpoint for further evaluation.

Do not deploy it blindly as production default yet. The model is excellent on the AI4Privacy held-out test distribution, but manual examples show potential issues with span fragmentation and some non-Latin / locale-specific edge cases.

Recommended next steps:

1. Build a real-world hard eval set with foreign names and addresses from target jurisdictions.
2. Evaluate baseline vs `run_b_weighted` on that hard set.
3. Inspect false positives, false negatives, and span fragmentation.
4. If quality holds, wire the checkpoint into the app's OPF runtime behind a feature flag.
5. Keep the original OPF checkpoint available for rollback.

## Important Caveats

- The full eval is strong but synthetic-data-adjacent; it reflects the AI4Privacy distribution.
- The checkpoint may behave differently on real legal documents or client-provided text.
- The model can mask more aggressively and fragment outputs compared with baseline.
- The W&B key and HF token were used during the run; rotate exposed tokens after completion.
