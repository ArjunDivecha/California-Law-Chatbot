---
schema_version: 1
artifact_type: repo_agent_context
surface: claude_code
repo_name: California-Law-Chatbot
github_repo: ArjunDivecha/California-Law-Chatbot
session_id: a6bd9b76-d6df-4c27-8817-bb2d5234f878
source_file: a6bd9b76-d6df-4c27-8817-bb2d5234f878.jsonl
exported_at: 2026-07-29T21:43:50.606432+00:00
export_base_commit_sha: 55da25c2abaafb166d138d32a24762b5623c361f
redacted: true
---

# Repo Agent Context: California-Law-Chatbot

_Surface:_ `claude_code`  
_Session:_ `a6bd9b76-d6df-4c27-8817-bb2d5234f878`

## Transcript

**User:** <command-message>deep-research</command-message>
<command-name>/deep-research</command-name>
<command-args>Analyze Harvey AI research at https://www.harvey.ai/research and all linked primary research publications as of 2026-07-29. Determine what methods, empirical findings, evaluation practices, retrieval/citation architecture, agent/workflow design, privacy or governance techniques, and product lessons are transferable to the California-Law-Chatbot repository in the current working directory. Distinguish independently supported findings from Harvey marketing claims, identify limitations and contrary evidence, compare each promising idea against capabilities that already exist in this repo, and recommend a prioritized set of small concrete experiments with measurable success criteria for a


**User:** Base directory for this skill: /Users/arjundivecha/.claude/skills/deep-research

# Deep Research

Run the durable workflow:

`Workflow({ scriptPath: "/Users/arjundivecha/.claude/skills/deep-research/references/deep_research.workflow.js", args: "<specific research question>" })`

Clarify only when missing scope would materially change the research. Pass the
complete refined question as `args`.

## Retrieval routing

- Route the academic/technical angle through Exa with publication-category
  search. Use natural-language factual clues; do not reduce it to keywords.
- Route official, regulatory, and current-primary-source angles through Exa or
  native WebSearch with domain constraints.
- Add exactly one Octen plain-search lane for breadth, contrarian evidence, or
  practitioner sources. Cap


**Assistant:** I'll launch the deep-research workflow on this.


**Assistant:** Workflow is running in the background. While it fans out, let me inventory the repo's existing eval/citation/retrieval capabilities so I can do the "compare against what already exists" part properly.


**Assistant:** I have solid repo context. Key finding already in hand that will sharpen the comparison: this repo has substantially more evaluation machinery in flight than I expected — a canonical 120-task CA legal dataset with a calibrated multi-vendor LLM judge (`reports/kimi-k3-eval/`), and a live citation-provider benchmark showing CourtListener search catches only **40% of fabricated citations** while the current production verifier catches **0%** (it abstains).

Now waiting on the research workflow.


**User:** <task-notification>
<task-id>w922whx97</task-id>
<tool-use-id>toolu_019PNibPd4G4KkzWMvyvFJ3V</tool-use-id>
<output-file>/private/tmp/claude-501/-Users-arjundivecha-Dropbox-AAA-Backup-A-Working-California-Law-Chatbot/a6bd9b76-d6df-4c27-8817-bb2d5234f878/tasks/w922whx97.output</output-file>
<status>completed</status>
<summary>Dynamic workflow "Deep research harness — Exa-led primary and publication retrieval, native web cross-checks, one capped Octen diversity lane, robust fetch, adversarial verification, and cited synthesis." completed</summary>
<result>{"question":"Analyze Harvey AI's published research (https://www.harvey.ai/research and all linked primary publications, including any arXiv/SSRN papers, BigLaw Bench and successor benchmarks, joint work with LexisNexis/Stanford/vendors, and


**Assistant:** You've hit your weekly limit · resets 1pm (America/Los_Angeles)
