---
description: SDD · New requirement - spec first, then code
argument-hint: <NNN-feature> <new requirement>
---
The first word of $ARGUMENTS is the spec folder name (`specs/<folder>/`); the rest is the new requirement. Full arguments: $ARGUMENTS

Do NOT touch code. Follow `.claude/rules/sdd.md`. Delegate to the @planner subagent (Agent tool, subagent_type "planner"), following the "If asked for a change" section of its instructions, and pass it the folder and the requirement in my words:
1. Update `specs/<folder>/spec.md`: new FR (or change to an existing one) in EARS, its edge cases, its "Spoiler impact" and what stays out of scope. If it touches something out of scope, pending or an open decision in `CLAUDE.md` or `docs/spec.md`, mark it `[NEEDS CLARIFICATION]`.
2. Indicate which parts of `plan.md` and `tasks.md` would have to change afterwards (without changing them).
3. Show me the spec diff in Spanish and wait for my approval. After approval, the plan and the tasks are updated and approved again before any code.
