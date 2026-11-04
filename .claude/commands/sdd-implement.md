---
description: SDD · Implement ONE task, verify with typecheck, lint and tests
argument-hint: <NNN-feature> [Tn]
---
Implement ONLY one task of the spec given in $ARGUMENTS (format: `NNN-feature Tn`; if `Tn` is omitted, take the first unchecked task in `tasks.md`). Delegate to the @implementer subagent (Agent tool, subagent_type "implementer"), passing it the folder and the task id. It must read `specs/<folder>/tasks.md`, `plan.md` and `spec.md`, `CLAUDE.md`, `.claude/rules/sdd.md` and the rules for the code it touches. If `plan.md` or `tasks.md` are not `approved`, stop and tell me.

1. Write the minimum code that fulfills the task, with its tests, respecting the architecture rules (layers, Zod at the boundaries, spoiler filtering in the backend, descriptive names, no `any`).
2. Run `pnpm typecheck`, `pnpm lint` and `pnpm test` (plus the spoiler suite or `pnpm test:e2e` when the task requires them) and show me the result.
3. Mark that task as done in `tasks.md` and indicate which FRs it covers.
4. If it needs something from CLAUDE.md "ASK FIRST" (dependency, module, schema change…), it stops and I decide.

Then STOP and report to me in Spanish. Do not start the next task.
