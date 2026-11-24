---
description: SDD · Split the plan into small, verifiable tasks
argument-hint: <NNN-feature>
---
Read `.claude/rules/sdd.md` first (Flow and Approval gates) and follow it.

The first word of $ARGUMENTS is the spec folder name. Delegate to the @planner subagent (Agent tool, subagent_type "planner"), following the "If asked for the tasks" section of its instructions: from `specs/<folder>/spec.md` and the approved `specs/<folder>/plan.md`, generate ONLY `specs/<folder>/tasks.md` (do not touch the plan) following the format in `.claude/rules/sdd.md`:
- Atomic tasks in dependency order: one verifiable result and one commit each, described in 1-3 lines, no "Scope" paragraph or file lists.
- Each one with at most ~3 FRs, a one-line "Tests:" proportional to the criticality of what the task changes (skill `quality-testing-core`: CORE and IMPORTANT carry tests in `tests/`, mirroring `src/`; TIER 0 none) and a one-line verifiable "Done when:".
- "Spoiler suite: required" on every task that touches queries, visibility or reading progress.
- Checkboxes (`- [ ]`) and `Status: draft`.
- No maximum number of tasks; if the list is long because the spec is too big, stop and propose splitting the spec.

If the plan is not `approved`, stop and tell me. Show me a summary in Spanish and close with the Tasks gate (`sdd.md`, Approval gates): "Aprobar las tareas y empezar a implementar" (@planner sets `Status: approved` on `tasks.md`, then start `/sdd-implement <folder>` through the `Skill` tool), "Pedir cambios" (@planner edits the tasks and the gate is asked again), "Parar aquí".

Git (`.claude/rules/git.md`): when I approve the tasks, commit them (`tasks(NNN): ...`) and push the branch before starting `/sdd-implement`.
