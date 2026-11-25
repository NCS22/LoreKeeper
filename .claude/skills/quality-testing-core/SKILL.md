---
name: quality-testing-core
description: Decides how much testing a LoreKeeper change needs and of what kind. Use it before writing or changing production code or a test, when planning or splitting a spec into tasks, when validating a spec, and when auditing, simplifying or removing tests. Covers criticality levels, coverage targets, test types, useful versus coverage-only tests, the test-first way of working with its evidence line, and the criticality inventory.
---

# Quality testing core - LoreKeeper

The goal is not more tests: every test must give a real guarantee about the behavior of the application, and testing must accompany development without slowing it down. Tests are proportional to criticality: CORE and IMPORTANT changes carry tests, TIER 0 changes carry none.

Authority order: the constitution (`CLAUDE.md` and `.claude/rules/*`) prevails over this skill, and this skill prevails over the inventory `docs/criticality-inventory.md`. A disagreement is fixed in the same task that finds it.

## 1. When to consult it and the quick procedure

Consult it before touching a production file or a test, while writing a plan's test design section or a task list, at validation, and in any test audit.

Answer the eight questions in order; each points to its section.

| # | Question | How to answer | Section |
|---|---|---|---|
| 1 | What criticality has the component? | Find its entry in `docs/criticality-inventory.md` by its path; check the file still fits the level | 2 |
| 2 | What coverage is expected? | Target of the level on lines and branches, minus any override or floor in the entry | 3 |
| 3 | Which behaviors deserve protection? | The `Strategy` column, plus the behavior the task changes | 4 |
| 4 | Which test type fits? | Decision table of section 4, by level and layer | 4 |
| 5 | Is the test useful or only raising coverage? | Would it fail if the result were wrong? | 5 |
| 6 | Is the behavior already covered? | Search procedure of section 6 | 6 |
| 7 | Can a test be simplified or removed? | Only through a proposal approved by the user | 7 |
| 8 | Which checks before finishing? | Section 10 | 10 |

Then apply the way of working of section 8 and keep the inventory current (section 9).

References, read only when the situation needs them:
- [references/assertion-quality.md](references/assertion-quality.md): the six weak-assertion criteria, each with a weak and a strong example from this repository (section 5, FR-6).
- [references/test-type-strategies.md](references/test-type-strategies.md): what each test type protects and how, fake versus real (section 4, FR-12).
- [references/audit-and-removal.md](references/audit-and-removal.md): verdicts, protected tests, the proposal format, the D-6 case, the 005b re-check by blob ids (section 7, FR-9, FR-10, FR-15).

## 2. Levels and how to classify

Classify by risk and behavior, never by location, size or technology. Every production component has exactly one level and a written reason.

| Level | Definition | Typical in this repository |
|---|---|---|
| `CORE` | Incorrect behavior can compromise integrity, security or essential operation: authentication and authorization, owner isolation, spoiler filtering (Phase 4), critical persistence, complex business rules | `account-password.ts`, `prisma-universe-repository.ts`, `remember-universe.ts`, the acting-user check, Server Actions |
| `IMPORTANT` | Failure significantly harms the user experience or blocks usual tasks: relevant UI components, forms and validations, interactions, navigation, state handling, loading, error and empty states | `universe-name.ts`, `universe-creation-state.ts`, `sign-in-form.tsx`, `page-access-guard.ts` |
| `TIER 0` | No relevant behavior, or correctness already guaranteed by static tools: types, constants, declarative configuration, static helpers without significant logic | `src/messages/en.ts`, `src/components/ui/button.tsx`, ports (interfaces), `tsconfig.json`, the lockfile |

Terms:
- **Relevant logic**: branching, computation, transformation, validation, or any decision whose wrong result a user or the data would notice.
- **Production component**: anything the application ships or runs, including configuration, `package.json` and `pnpm-lock.yaml`, the Prisma schema and migrations, `src/styles/tokens.css` and `src/messages/en.ts`. These are usually TIER 0 unless they hold relevant logic; schema integrity is protected by the integration tests of the components that use it.
- **Not production, never classified**: tests, test support (fakes, contracts, helpers), generated code, test-runner and browser-test configuration, agent setup, documentation. Custom lint rules and test support are **tooling** (see section 8, tooling rule).

How to classify:
1. Ask what happens if the component returns a wrong result. Data of another user exposed, a session given to the wrong person, a spoiler shown, data lost: `CORE`. A person blocked, misled or shown a broken state: `IMPORTANT`. Nothing a type check would not catch: `TIER 0`.
2. A component that mixes declaration and behavior is classified by its riskiest behavior, or split into two entries.
3. Components protected by the protected tests (owner isolation now, spoiler filtering from Phase 4) are always `CORE`.
4. Group files into one entry only when they share level and strategy.

Worked example: `page-access-guard.ts` only redirects; real authorization is enforced per operation by the acting-user check, so the guard is `IMPORTANT` while the acting-user check stays `CORE`.

**Reclassification (FR-2).** If a `TIER 0` component turns out to hold relevant logic (found by whoever adds or modifies it, or by the reviewer at validation), reclassify it in the inventory **before** deciding anything about its tests. Reclassifying upward below the new target makes `pnpm test:coverage` fail until the entry reaches the target or records a floor with its plan (IMPORTANT) or an override with its reason (CORE, which never records a floor; section 3).

## 3. Coverage targets and the thresholds policy

Targets are quality goals per inventory entry, not quotas, on **lines and branches** (statements and functions are not part of the policy). The entry is the sum of its files; a test that exercises several components counts toward each.

| Level | Lines | Branches |
|---|---|---|
| `CORE` | 100 % | 100 % |
| `IMPORTANT` | 80 % | 80 % |
| `TIER 0` | none | none |

- **Exception**: when the target needs redundant, fragile or low-value tests (for example an unreachable defensive branch), write in the entry's `Exceptions and floors` cell exactly `override: lines 100, branches 92, reason: <why>`, with both metrics; the override replaces the target of the entry. Never cover it with an artificial test.
- **Floor**: an IMPORTANT entry below its target that no small test of behavior brings to it records `floor: lines 74.4, branches 71.9, plan: <how it is raised>`, with the figure as printed of each metric below its target (a metric at its target, or with nothing to measure, is left out); the plan is usually "raise it when the component is next touched". Figures have one decimal at most, and an entry carries at most one record, an override or a floor. A CORE entry never records a floor: it reaches 100 % or records an override with its reason.
- **Reading `pnpm test:coverage`**: it runs the `unit`, `database` and `component` Vitest projects one at a time and ends with a per-entry table: lines and branches per test type and combined, level, required figure (the override, else the floor, else the target of the level) and the distance to it, the overrides and floors in use, and the unmatched, duplicated and stale patterns. After printing everything it fails when a CORE or IMPORTANT entry is below its required figure (the combined figure as printed, one decimal), when an override or floor is not in its written form, or when a production file matches no entry or more than one; a stale pattern is only a warning. A figure above its floor or override prints a notice and fails nothing, but the validation of a spec requires that no such notice remains: the record is raised to the new figure, or removed when the entry reaches its target. End-to-end is "not measured": a behavior protected only by a browser test is written in the entry as `protected by browser test <name>`. It is not an unprotected behavior, so a behavior-keeping change needs no characterization tests (section 8); but if the measured coverage of the entry is below its target, the entry still records a floor with its plan, usually "component tests when touched" (an IMPORTANT entry; a CORE entry never records a floor, it gets the tests or an override, as said above).
- **Coverage is not quality.** A line is covered when it runs, not when its result is checked. 100 % with weak assertions protects nothing; judge tests by section 5.

**Thresholds policy (FR-8), active since spec 005b.** `pnpm test:coverage` enforces the table above per entry: CORE 100, IMPORTANT 80, TIER 0 excluded, lines and branches, with the overrides and floors written in the inventory applied. The thresholds live in the report script `tests/support/coverage/report-coverage-by-inventory-entry.mjs`, not in Vitest: `vitest.config.mts` has no `thresholds` key and `pnpm test` never fails on coverage. The command is a required check at the validation of every spec, not at each task (`.claude/rules/sdd.md`, "Validation").

## 4. Behaviors to protect and the test type

Protect what a person or the data would notice: outcomes, typed errors, boundaries of inputs, owner scoping, the state that results from an interaction. Do not protect private details, literal texts that are not the behavior, or markup structure.

| Level | Layer or kind | Test type | Protect |
|---|---|---|---|
| CORE | Domain rules and value objects | Unit, exhaustive | Every rule, branch and input boundary |
| CORE | Application use cases | Unit with fakes from `tests/support/fakes/` that pass the contracts in `tests/support/contracts/`, plus database scenarios for owner isolation | Order of rules, acting user, typed errors, owner isolation |
| CORE | Infrastructure (repositories, authenticator, session, schema) | Integration against the test database (`database` project) | Owner scoping of every query, persistence, storage failures mapped to typed errors |
| CORE | Server Actions, input schemas, error mapping | Integration through the action; unit for shared mappers and parsers | Zod validation, acting-user check, mapped response, nothing internal exposed |
| CORE | Composition and security configuration | No test of their own; integration tests run through them | The real wiring is the one tested |
| IMPORTANT | Validators, reducers, interpreters, layout math | Unit | The resulting state or chosen message |
| IMPORTANT | Interactive components, hooks, providers | Component test (`.test.tsx`, `component` project, jsdom), when the component is touched | Roles, labels, focus, result of an interaction |
| IMPORTANT | Pages composed of Server Components, the proxy | The end-to-end journey; unit for logic extracted from them | The page is reached and shows what it composes |
| Any | User flows | End-to-end (Playwright), a small set of critical journeys | What only a browser shows: cookies, headers, real redirects, 320 px, keyboard |
| TIER 0 | Types, `ui` primitives, messages, styles, configuration | None | - |

Mocks and fakes: a fake is acceptable when it passes the same contract test as the real implementation; a hand-written stub that the real implementation is never checked against hides real errors. Anything about SQL, owner scoping or provider behavior is proved against the test database, not a fake. The proportion of unit, integration and end-to-end tests is a consequence of this table, never a quota. Strategy per type with real examples: [references/test-type-strategies.md](references/test-type-strategies.md).

## 5. Useful test versus coverage-only test

A test is weak when it would still pass if the result were wrong (FR-6). Before keeping a test, check:

- It asserts the outcome, not only that something ran (`toHaveBeenCalled` alone, `toBeDefined`, `not.toThrow` on a function that cannot throw).
- It would fail if the rule were inverted, the boundary moved by one, or the error type changed.
- It checks the specific value or typed error, not a truthy shape.
- It exercises a behavior no other test at a lower level already proves.
- It does not depend on private structure, call order or exact markup that a correct refactor would change.
- Its name says the behavior, so a failure explains itself.

A test written only to turn a coverage line green fails these checks; do not write it, record an override instead. Weak and strong examples of each check: [references/assertion-quality.md](references/assertion-quality.md).

## 6. Is it already covered

Before writing a test, look in this order:
1. The inventory entry: `Strategy` and `Protection` say what exists and which browser test protects it.
2. The mirrored path: `src/.../x.ts` is tested in `tests/.../x.test.ts`.
3. Search `tests/` by behavior (the function, error class or message key), not only by file name; use cases are also covered by `tests/support/contracts/`.
4. `pnpm test:coverage` for the entry: which test type reaches which lines.
5. `tests/e2e/*.spec.ts` for user flows.

If a lower-level test already proves the behavior, do not repeat it higher up.

## 7. Simplify or remove

- Nothing is deleted or simplified without the explicit approval of the user at a flow gate. The bulk cleanup of 005b is approved group by group in its spec; after 005b closes, each deletion or simplification is a case-by-case proposal (FR-15).
- **Protected tests** (owner isolation; spoiler filtering from Phase 4) are untouchable: only KEEP or REVIEW, a group verdict never covers them, and any change needs its own approval and never reduces what it checks. The single exception (D-6): the behavior they protect is removed entirely; then the proposal goes test by test and shows that no remaining path loses its protection.
- Proposal format, one per test or group:

```
Proposal: DELETE | SIMPLIFY <test file> > <describe> > <test name>
Protects: <behavior and inventory entry id>
Why no protection is lost: <the test or strategy that keeps it>
Protected test: no | yes, behavior removed entirely (D-6), other paths checked: <list>
```

Verdicts, the protected-test list and the 005b re-check by blob ids: [references/audit-and-removal.md](references/audit-and-removal.md).

## 8. The way of working

One case applies to each task that touches a CORE or IMPORTANT component:

| Change | Rule |
|---|---|
| Changes behavior | Test first: write it, run it, see it fail for the expected reason (red), then write the code until it passes (green) |
| Keeps behavior (refactor, rename, move, removal of code without behavior change) | No new test; the tests that protect the behavior pass before and after |
| Keeps behavior on a known gap (no protecting test) | Characterization tests that pin the current behavior first, passing on the current code; then the change with green before and after |
| Removes behavior | A proposal to delete the tests of that behavior comes first (section 7), approved by the user; protected tests test by test (D-6) |

**Bug fixes (FR-14).** In a CORE or IMPORTANT component, first a test that reproduces the bug and fails. In a TIER 0 component, no test: fix it; if the fix reveals relevant logic, reclassify (section 2).

**TIER 0** changes carry no tests; a broken type check is fixed with the type checker as protection.

**Tooling rule.** Test support and custom lint rules are not classified; a change to them carries tests only when it changes a check that protects a CORE or IMPORTANT component (for example an import-boundary lint rule in `tests/lint`).

**Evidence line.** Each such task records under it in `tasks.md` exactly one line, naming the tests involved (file and test name), in one of these four forms:

```
  - Evidence: red then green: <tests>
  - Evidence: green before and after: <tests>
  - Evidence: characterization then green before and after: <tests>
  - Evidence: behavior removed with approval of <date> at <gate>: <tests deleted>
```

Example: `  - Evidence: red then green: tests/modules/universes/domain/universe-name.test.ts > rejects a name one character over the maximum and reports the limit`.

A spec with no production component with behavior says so in its test design section and carries no evidence line (FR-17).

## 9. Inventory upkeep

`docs/criticality-inventory.md` is updated in the same task that adds, modifies, renames, moves, merges or deletes a production file (FR-4):
- New file: add it to the entry that shares its level and strategy, or a new entry with the next id of its area. Ids are never reused.
- Moved, renamed or deleted file: fix the `Files` patterns; `pnpm test:coverage` lists stale patterns and unmatched files.
- Changed behavior: re-check the level (section 2) and the `Strategy`.
- Coverage changed in a CORE or IMPORTANT entry: refresh the dated `Protection` snapshot and the floors or overrides.
- The plan's test design section shows the level that decided the tests.
- Done when the report shows the file in exactly one entry and no unmatched or duplicated file.

## 10. Checks before finishing

| Check | When |
|---|---|
| `pnpm typecheck` and `pnpm lint` (no warnings) | Always |
| `pnpm test` (needs `docker compose up -d`) | Always |
| `pnpm test:e2e` | The change affects a user flow |
| The spoiler protection tests | The change touches queries, visibility or reading progress |
| `pnpm test:coverage` | Work on a CORE or IMPORTANT component; read its entry and update the snapshot |
| Evidence line present and the tests it names exist | Every task on a CORE or IMPORTANT component |
| No tests added for TIER 0 | Always |
| Inventory entry current | Any production file added, changed, moved or deleted |

Never silence errors, skip tests or relax strict mode to make a check pass.
