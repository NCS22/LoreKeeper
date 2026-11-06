---
description: SDD · Review the project constitution (CLAUDE.md and rules) and propose amendments
argument-hint: [additional context]
---

The constitution of this project is `CLAUDE.md` (Rules, Limits, NEVER, Verification) plus `.claude/rules/*`; there is no separate constitution file. Follow `.claude/rules/sdd.md`. Read `CLAUDE.md`, `.claude/rules/architecture.md`, `.claude/rules/data-model.md`, `docs/roadmap.md`, `docs/open-decisions.md` and `README.md`. Additional context: $ARGUMENTS

Review them and tell me, in Spanish, as a numbered list:
1. Contradictions between `CLAUDE.md`, the rules files, `docs/roadmap.md` and `docs/open-decisions.md`.
2. Rules that cannot be verified (no measurable check) or that nothing in the verification gate enforces.
3. Statements that are out of date (commands, status, structure) or missing for the current phase.
4. For each item, a proposed amendment with its reason, short and verifiable.

Maximum 20 lines. Do NOT edit any file before I answer. Then ask me with `AskUserQuestion` (multiple choice, in groups of up to 4 amendments) which amendments to apply, plus the option "Ninguna". Apply only the ones I choose, editing `CLAUDE.md` or the rule files directly (through @implementer if you cannot edit), and tell me in Spanish what changed.
