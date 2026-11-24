---
description: SDD · Generate the technical plan of an approved spec
argument-hint: <NNN-feature>
---
Read `.claude/rules/sdd.md` first (Flow and Approval gates) and follow it.

The first word of $ARGUMENTS is the spec folder name. Delegate to the @planner subagent (Agent tool, subagent_type "planner"), following the "If asked for the plan" section of its instructions and generating ONLY `plan.md`. Pass it the folder and these paths to read: `CLAUDE.md`, `.claude/rules/sdd.md`, `.claude/rules/architecture.md`, `.claude/rules/data-model.md`, `docs/roadmap.md`, `docs/open-decisions.md` and `specs/<folder>/spec.md`.
Do NOT write code. If the spec is not `approved` or has open questions, stop and tell me.

`specs/<folder>/plan.md` must follow the "Plan" section of `sdd.md`: affected modules and layers, data, use cases (with `ViewerContext` for reads), contracts with Zod, UI, spoiler impact, test design (for every affected component, its level in `docs/criticality-inventory.md`, the behaviors to protect and the test type chosen, skill `quality-testing-core`, mirroring `src/` in `tests/`; or "no production component with behavior"), decisions with their discarded alternative, and which FR each part covers. Everything must respect `CLAUDE.md` and the architecture rules, and cover all the FRs. Anything that needs approval (new dependency, module, layer, top-level folder, Prisma schema change, pending or open feature) is listed as a question for me, not decided.

Show me a summary in Spanish. Before the gate, ask me each "needs approval" item of the plan with `AskUserQuestion`, one at a time, and have @planner record my answers in the plan: approving the plan approves them. Then close with the Plan gate (`sdd.md`, Approval gates): "Aprobar el plan y dividirlo en tareas" (@planner sets `Status: approved` on `plan.md`, then start `/sdd-tasks <folder>` through the `Skill` tool), "Pedir cambios" (@planner edits the plan and the gate is asked again), "Parar aquí".

Git (`.claude/rules/git.md`): when I approve the plan, commit it (`plan(NNN): ...`) and push the branch before starting `/sdd-tasks`.
