---
paths:
  - "specs/**"
  - "docs/**"
---

# Spec-Driven Development - LoreKeeper

How a feature goes from idea to code. Complements `CLAUDE.md` (Workflow, Rules, Limits, Verification), `architecture.md` and `data-model.md`; it never overrides them.

## Flow

Constitution -> Spec -> Clarification -> Plan -> Tasks -> Implementation -> Validation -> Change.

- The constitution is `CLAUDE.md` (Rules, Limits, NEVER) plus `.claude/rules/*`. There is no separate constitution file.
- Never move on to the next phase without the user's explicit approval. Spec, plan and tasks each carry a `Status:` line (`draft | approved`; the spec also `implemented`); it changes to `approved` only after that approval.
- The spec rules: if something is not in the spec, it is not implemented. If a decision is missing, stop and ask.
- A requirements change is made first in the spec, then in the plan and the tasks, and last in the code.
- Anything listed as out of scope, pending or an open decision in `CLAUDE.md` or `docs/spec.md` (if it exists) cannot be specified as decided: mark it `[NEEDS CLARIFICATION]` and stop.
- Language: everything written in the repository (specs, plans, tasks, code, docs) is in English; questions, summaries and reports to the user are in Spanish.
- Every technical report shown to the user must be readable by the user: long explanations, broad detail and no technical jargon. The order and severity of the findings cannot be changed. The original reports are kept for the technical team.

## Spec (`specs/NNN-feature/spec.md`)

`NNN` is the next free three-digit number (e.g. `specs/001-universe-crud/`). The spec describes the WHAT and the WHY: no stack, architecture or file names.

```
# Spec NNN — <Name>

Status: draft | approved | implemented

## Context and goal

## Users

## User stories
- US-1. As a <role>, I want <action> so that <benefit>.

## Definitions (only if there are terms that could be interpreted in several ways)

## Functional requirements

## Non-functional requirements

## Spoiler impact
Does the feature read or write information that has a spoiler boundary? How does it behave in READER and in AUTHOR universes? If it does not touch narrative information, say "None" and why.

## Edge cases

## Out of scope
Checked against the out-of-scope list in docs/spec.md (if it exists) and CLAUDE.md.

## Completion criteria

## Open questions

- [NEEDS CLARIFICATION] <question>
```

### Requirements in EARS

- FR-x: WHEN <event>, THE SYSTEM SHALL <response>.
- FR-x: IF <unwanted condition>, THEN THE SYSTEM SHALL <response>.
- FR-x: WHILE <state>, THE SYSTEM SHALL <response>.
- FR-x: THE SYSTEM SHALL <permanent behavior>.

Every FR (and NFR) must be verifiable: nothing like "fast", "intense" or "pretty" without a measurable criterion.

## Plan (`specs/NNN-feature/plan.md`)

Starts from an approved spec with no open questions. It carries `Status: draft | approved` and says HOW, respecting `architecture.md` and `data-model.md`. Sections:

1. **Affected modules and layers**: which modules (existing or new; a new module, layer or top-level folder is marked "needs approval"), and what goes in `domain`, `application`, `infrastructure` and presentation.
2. **Data**: entities, JSONB attributes (with their Zod schema) and any Prisma schema change or migration (marked "needs approval").
3. **Use cases**: one per file, with the acting user and, for reads, the `ViewerContext`; errors they throw.
4. **Contracts**: Server Actions or Route Handlers, with their Zod input schemas and response shape.
5. **UI**: routes and components, Server vs Client Components, states (empty, loading, error), accessibility.
6. **Spoiler impact**: where the visibility rule is applied for every read path touched.
7. **Tests**: per layer, mirroring `src/` in `tests/`; which need the spoiler suite; E2E if a user flow changes.
8. **Decisions**: each with the alternative discarded and why.
9. **Coverage**: which FR each part covers; every FR must be covered.

## Tasks (`specs/NNN-feature/tasks.md`)

```
Status: draft | approved

- [ ] **Tn. <Description>.** FR-x, FR-y
  - Tests: <tests written with the task, in tests/>
  - Done when: <verifiable check>
```

- Maximum 20-30 minutes per task, in dependency order. Every task includes its own tests (CLAUDE.md: tests with every change).
- Add `- Spoiler suite: required` when the task touches queries, visibility or reading progress.
- If there are more than 10 tasks, propose splitting the spec.

## Implementation

One task at a time: the minimum code that fulfills the task, with its tests. Then run the verification gate below, mark the task `- [x]` and stop.

### Verification gate (from CLAUDE.md)

1. `pnpm typecheck` and `pnpm lint` pass with no new warnings.
2. `pnpm test` passes, including the new tests.
3. `pnpm test:e2e` if the change affects a user flow (once that script exists).
4. The spoiler protection tests if the change touches queries, visibility or reading progress.
5. Schema changes: the migration applies cleanly on an empty database.
6. The diff has no secrets and nothing outside the task.

Validation (whole spec) repeats this gate and then goes through every FR and the completion criteria.

## Closing a spec

When the last task is done and validation passes: set the spec to `implemented`, update "Current status" in `CLAUDE.md`, record closed decisions in `docs/decisions/` and remove them from the open decisions in `docs/spec.md` (when those files exist).
