---
description: SDD · Interview and generate the spec
argument-hint: <feature-name | NNN-feature> <initial idea>
---

Do NOT write code at any point. Read `.claude/rules/sdd.md` first (Flow and Approval gates) and follow it.

The first word of $ARGUMENTS is the feature folder name (`specs/<folder>/`, e.g. `001-universe-crud`; if it has no number, @planner assigns the next free one); the rest is the initial idea. Full arguments: $ARGUMENTS

Git (`.claude/rules/git.md`): before @planner writes anything, check that the tree is clean and create the branch `spec-<folder>` from an up-to-date `main`; if the folder has no number, take the next free three-digit number from `specs/` yourself and tell @planner. A spec that stays `draft` is committed only if I answer "Parar aquí"; it is committed as approved at the clarification gate.

Delegate the writing to the @planner subagent (Agent tool, subagent_type "planner"), following the "If asked for the spec" section of its instructions. Subagents do not see this conversation: pass it the folder, the initial idea in my words, and the paths to read (`CLAUDE.md`, `.claude/rules/sdd.md`, `docs/roadmap.md`, `docs/open-decisions.md`, the relevant rules).

Your job (talk to me in Spanish):
1. If @planner returns questions, ask me them ONE at a time (maximum 5) to remove ambiguities (edge cases, errors, spoiler behavior, what stays out of this version), then call @planner again with my answers.
2. @planner generates `specs/<folder>/spec.md` following the `sdd.md` template, with the requirements in EARS, "Spoiler impact" and "Out of scope" filled, and "Status: draft". Anything that is out of scope, pending or an open decision in `CLAUDE.md`, `docs/roadmap.md` or `docs/open-decisions.md` goes in as `[NEEDS CLARIFICATION]`, not as a decision.
3. Only the WHAT and the WHY: no stack, architecture or file names.
4. Show me the path and a summary, then close with the Spec gate (`sdd.md`, Approval gates). Options: "Revisar la spec (QA)" starts `/sdd-clarify <folder>` through the `Skill` tool; "Pedir cambios"; "Parar aquí". The spec stays `Status: draft`: it is approved in the next phase.
