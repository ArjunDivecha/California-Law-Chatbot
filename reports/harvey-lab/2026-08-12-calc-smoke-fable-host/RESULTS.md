# Harvey LAB benchmark result

- Run: `calc-smoke-fable-host-20260812`
- Task: `corporate-ma/review-data-room-red-flag-review`
- Agent: `california-law/claude-fable-5`
- Judge: `claude-sonnet-4-6`
- Score: **38/50 criteria passed (76%) — task fail**
- Coverage: **13/13 documents read**
- Agent trajectory: **20 turns**, 2,164,040 input tokens, 34,610 output tokens, 679.74 seconds

Misses were C-008, C-022, C-025, C-032, C-041, C-042, C-043, C-044, C-045, C-046, C-047, and C-049. The largest concrete failure was the missing required `red-flag-tracker.xlsx` (C-042–C-044). Other misses were specific omissions/numbering mismatches, a non-issue section, the requested investment-committee names, top-10 customer concentration, exact $38.7M debt total, and quantified holdback terms.

This run used LAB's official agent loop, tools, task rubric, and LLM judge, but a temporary host fallback because Podman's VM failed to boot on this Mac. It is therefore a functional benchmark result, not a secure-container validation. The original agent stopped at the 20-turn cap; the DOCX was converted from its generated memo after the run so the rubric could score the required memo artifact. No tracker was added after the run.
