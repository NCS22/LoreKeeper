---
description: SDD · Implement the tasks of a spec one at a time, verifying each one
argument-hint: <NNN-feature> [Tn]
---
Read `.claude/rules/sdd.md` first (Flow, Approval gates, Implementation) and follow it.

$ARGUMENTS has the format `NNN-feature [Tn]`; if `Tn` is omitted, take the first unchecked task in `tasks.md`. Before launching anything, read the `Status:` lines yourself: if `plan.md` or `tasks.md` is not `approved`, tell me which one is pending and stop.

For each task, delegate to the @implementer subagent (Agent tool, subagent_type "implementer"), passing it the folder, the task id, the FR/NFR ids the task lists and the plan sections it cites (read them from `tasks.md` yourself, only that task), so it reads by section as "Reading budget" in `sdd.md` says, not whole files. It also reads `CLAUDE.md` and the rules for the code it touches.
1. Write the minimum code that fulfills the task, with its tests, respecting the architecture rules (layers, Zod at the boundaries, spoiler filtering in the backend, descriptive names, no `any`).
2. Run `pnpm typecheck`, `pnpm lint` and `pnpm test` (plus the spoiler suite or `pnpm test:e2e` when the task requires them).
3. Mark that task as done in `tasks.md` and indicate which FRs it covers.
4. If it needs something from CLAUDE.md "ASK FIRST" (dependency, module, schema change…), it stops and I decide.

When a task finishes, check its report yourself: `pnpm typecheck`, `pnpm lint` and `pnpm test` must appear green with no new warnings (and the spoiler suite or `pnpm test:e2e` when the task requires them). If not, or if the implementer stopped for an approval or because the plan is wrong, tell me in Spanish and stop.

UI check: if the task changes UI (files under `src/app/**` or `src/components/**`, or its FRs describe screens), launch @frontend-tester (Agent tool, subagent_type "frontend-tester") once the gate is green, passing it the folder, the task id, the UI FR ids and the routes and states from the implementer's report. A task without UI does not launch it. If it reports high-severity failures, send them to @implementer as a findings list (it fixes only those, same verification gate) and run the tester again only on those failures. Add its report to the one you show me.

Git (`.claude/rules/git.md`): once the report shows the verification gate green, commit the task yourself (`feat(NNN): Tn ...`: code, tests, checkbox and decisions together; one commit per task) and push the branch, before asking the gate. The @implementer must not run git commands that write; tell it so in its prompt. If a task stops half done, commit it as `wip(NNN): Tn partial`.

Show me the report in Spanish and close with the Implementation gate (`sdd.md`, Approval gates), with these options:
- "Siguiente tarea (Tn)": call @implementer again for the next unchecked task and ask the gate again. After the last task this option is "Pasar a la validación" and starts `/sdd-validate <folder>` through the `Skill` tool.
- "Hacer el resto de las tareas sin parar": run the remaining tasks in order following "The rest without stopping" in `sdd.md`, with no gate between them. When they end, or it stops, show me one report for all of them and ask the gate again.
- "Parar aquí".
