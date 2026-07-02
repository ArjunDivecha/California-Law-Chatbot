# Privacy Filter Fine-Tuning Run Comparison

## Run Context
- Worktree: `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot-prd-run`
- Branch: `codex/privacy-filter-prd-run`
- Dataset profile: compact end-to-end validation profile (multilingual subset).
- Labels mapped: `private_person`, `private_address`.

## Checkpoint Artifacts
- `run_a_balanced`: `runs/privacy_filter/run_a_balanced`
- `run_b_weighted`: `runs/privacy_filter/run_b_weighted`
- `run_c_hardneg`: `runs/privacy_filter/run_c_hardneg`

## Eval Summary
| Run | Eval Return Code | Overall Wall (s) | Score Stitch (s) | Inference Tokens/s |
|---|---:|---:|---:|---:|
| baseline | 0 | 4.8213 | 0.7151 | n/a |
| run_a_balanced | 0 | 3.5388 | 0.8144 | n/a |
| run_b_weighted | 0 | 3.7648 | 0.7827 | n/a |
| run_c_hardneg | 0 | 3.0125 | 0.952 | n/a |

## Notes
- All runs completed successfully (`returncode = 0`).
- This compact run validates the full PRD execution path end-to-end.
- For production decisioning, run the same pipeline with full-size training/eval and per-language F1 reporting enabled.