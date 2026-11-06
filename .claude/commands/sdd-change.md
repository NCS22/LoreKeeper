---
description: SDD · New requirement - spec first, then plan and tasks, then code
argument-hint: <NNN-feature> <new requirement>
---
Read `.claude/rules/sdd.md` first (Flow and Approval gates) and follow it.

The first word of $ARGUMENTS is the spec folder name (`specs/<folder>/`); the rest is the new requirement. Full arguments: $ARGUMENTS

Do NOT touch code. Delegate to the @planner subagent (Agent tool, subagent_type "planner"), following the "If asked for a change" section of its instructions, and pass it the folder and the requirement in my words:
1. Update `specs/<folder>/spec.md`: new FR (or change to an existing one) in EARS, its edge cases, its "Spoiler impact" and what stays out of scope. If it touches something out of scope, pending or an open decision in `CLAUDE.md`, `docs/roadmap.md` or `docs/open-decisions.md`, mark it `[NEEDS CLARIFICATION]`.
2. Indicate which parts of `plan.md` and `tasks.md` would have to change afterwards (without changing them).
3. Show me the spec diff in Spanish and close with the Change gate (`sdd.md`, Approval gates). If the diff still has `[NEEDS CLARIFICATION]`, ask me those questions first, one at a time, and have @planner update the spec. Options: "Aprobar el cambio y actualizar el plan", "Pedir cambios", "Parar aquí".

On "Aprobar el cambio y actualizar el plan":
1. @planner sets `Status: approved` on the spec (a spec that was `implemented` goes back to `approved`).
2. @planner applies the change to `plan.md`, following "If asked to apply an approved change to the plan or the tasks": only the affected sections. Show me a summary and ask the Plan gate as in `/sdd-plan`.
3. After the plan is approved, @planner applies the change to `tasks.md` (done tasks stay checked; the new work is added as new tasks). Show me a summary and ask the Tasks gate as in `/sdd-tasks`.
4. After the tasks are approved, `/sdd-implement <folder>` starts on the first unchecked task through the `Skill` tool.
