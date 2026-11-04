---
description: SDD · Generate the technical plan of an approved spec
argument-hint: <NNN-feature>
---
The first word of $ARGUMENTS is the spec folder name. Delegate to the @planner subagent (Agent tool, subagent_type "planner"), following the "If asked for the plan" section of its instructions and generating ONLY `plan.md`. Pass it the folder and these paths to read: `CLAUDE.md`, `.claude/rules/sdd.md`, `.claude/rules/architecture.md`, `.claude/rules/data-model.md`, `docs/spec.md` (if it exists) and `specs/<folder>/spec.md`.
Do NOT write code. If the spec is not `approved` or has open questions, stop and tell me.

`specs/<folder>/plan.md` must follow the "Plan" section of `sdd.md`: affected modules and layers, data, use cases (with `ViewerContext` for reads), contracts with Zod, UI, spoiler impact, tests per layer (mirroring `src/` in `tests/`), decisions with their discarded alternative, and which FR each part covers. Everything must respect `CLAUDE.md` and the architecture rules, and cover all the FRs. Anything that needs approval (new dependency, module, layer, top-level folder, Prisma schema change, pending or open feature) is listed as a question for me, not decided.

Show me a summary in Spanish and STOP for my approval. Then suggest `/sdd-tasks <folder>`.
