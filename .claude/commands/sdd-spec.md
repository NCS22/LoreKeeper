---
description: SDD · Interview and generate the spec
argument-hint: <feature-name | NNN-feature> <initial idea>
---

Do NOT write code at any point. Follow `.claude/rules/sdd.md`.

The first word of $ARGUMENTS is the feature folder name (`specs/<folder>/`, e.g. `001-universe-crud`; if it has no number, @planner assigns the next free one); the rest is the initial idea. Full arguments: $ARGUMENTS

Delegate the writing to the @planner subagent (Agent tool, subagent_type "planner"), following the "If asked for the spec" section of its instructions. Subagents do not see this conversation: pass it the folder, the initial idea in my words, and the paths to read (`CLAUDE.md`, `.claude/rules/sdd.md`, `docs/spec.md` if it exists, the relevant rules).

Your job (talk to me in Spanish):
1. If @planner returns questions, ask me them ONE at a time (maximum 5) to remove ambiguities (edge cases, errors, spoiler behavior, what stays out of this version), then call @planner again with my answers.
2. @planner generates `specs/<folder>/spec.md` following the `sdd.md` template, with the requirements in EARS, "Spoiler impact" and "Out of scope" filled, and "Status: draft". Anything that is out of scope, pending or an open decision in `CLAUDE.md` or `docs/spec.md` goes in as `[NEEDS CLARIFICATION]`, not as a decision.
3. Only the WHAT and the WHY: no stack, architecture or file names.
4. Show me the path and a summary, and STOP for my approval. Suggest `/sdd-clarify <folder>` as the next step.
