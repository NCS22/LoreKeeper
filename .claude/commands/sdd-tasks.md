---
description: SDD · Split the plan into small, verifiable tasks
argument-hint: <NNN-feature>
---
Read `.claude/rules/sdd.md` first (Flow and Approval gates) and follow it.

The first word of $ARGUMENTS is the spec folder name. Delegate to the @planner subagent (Agent tool, subagent_type "planner"), following the "If asked for the tasks" section of its instructions: from `specs/<folder>/spec.md` and the approved `specs/<folder>/plan.md`, generate ONLY `specs/<folder>/tasks.md` (do not touch the plan) following the format in `.claude/rules/sdd.md`:
- Small tasks (max. 20-30 min each), in dependency order.
- Each one with the FRs it covers, the tests it brings (in `tests/`, mirroring `src/`) and a verifiable "Done when:" line.
- "Spoiler suite: required" on every task that touches queries, visibility or reading progress.
- Checkboxes (`- [ ]`) and `Status: draft`.
- Maximum 10 tasks: if more are needed, stop and propose splitting the spec.

If the plan is not `approved`, stop and tell me. Show me a summary in Spanish and close with the Tasks gate (`sdd.md`, Approval gates): "Aprobar las tareas y empezar a implementar" (@planner sets `Status: approved` on `tasks.md`, then start `/sdd-implement <folder>` through the `Skill` tool), "Pedir cambios" (@planner edits the tasks and the gate is asked again), "Parar aquí".
