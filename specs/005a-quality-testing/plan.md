# Plan 005a — Quality testing strategy

Status: approved

Spec: `specs/005a-quality-testing/spec.md` (Status: approved, no open questions; FR-1 to FR-20 and NFR-1 to NFR-4, decisions D-1 to D-6 of the user, 2026-11-20). Source of intent: `CALIDAD.md` (repository root, kept until the user confirms its content is covered; this plan never touches it).

This is a process and tooling spec. It has no production module, no data change, no use case, no contract and no screen. Its products are documents (inventory, audit report, evaluation, one skill), edits to the instruction files in a closed list (FR-16) and the configuration of two kinds of tooling (coverage measurement, component-test environment). Items that `CLAUDE.md` puts under "ASK FIRST" (Q1 to Q6) were answered by the user on 2026-11-20 and are recorded in section "Approved on 2026-11-20" below; approving the plan approves them.

## 0. Approach in one paragraph

Build the measuring tools first and prove they change no outcome (coverage provider and the DOM test environment, NFR-1), then produce the knowledge (inventory of every production file, one skill, audit report of every test file, written diagnosis and evaluation), and only at the end rewrite the instructions so that the agents use that knowledge ("tests proportional to criticality", test-first rule, evidence line, validation checks, spec numbering with letters, roadmap renumbering). The documents are lightweight markdown: one table per area, one row per cohesive group of files. The skill is the single place where the detailed rules live; the flow rules only carry what they must (the test design section, the evidence line and the validation checks), so nothing is written twice. Nothing existing in `tests/` is touched, and nothing is activated that could fail the current suite (thresholds are defined, not enabled).

## Inputs already decided (not new decisions)

- **Spec 005a** records D-1 to D-6 (user, 2026-11-20). D-4 (the constitution amendment in the NEVER rule and the alignment of the other instructions) is already approved: it is applied here without being asked again.
- **Testing stack** today: Vitest 5.1 with two projects (`unit` and `database`, `vitest.config.mts`) and Playwright; no coverage provider, no DOM environment. The sentence in `CLAUDE.md` "`jsdom` and testing-library are not approved" is replaced because Q2 was approved on 2026-11-20 (D-5 approved them subject to this plan).
- **Skills mechanism**: `CLAUDE.md` says `.claude/skills` is a local link to `.agents/skills` and that git stores both as identical copies; `skills-lock.json` locks only skills installed from a source (today only `frontend-design`, with its source and hash).
- **Known leftover** (spec, out of scope): the comments that still say "spec 005" in `prisma/schema.prisma` and in `universe-repository.ts` stay as they are; spec 006 corrects them.

## Approved on 2026-11-20

The user answered the six questions that this plan had marked "needs approval" on 2026-11-20. Approving the plan approves these decisions; nothing below remains open, except the stop conditions written in Q2 and Q3.

1. **Q1. Coverage provider: approved.** Development dependency `@vitest/coverage-v8` at `^5.1.0` (the same range as `vitest`; the implementer checks that the installed Vitest version and the provider resolve to the same one), the script `pnpm test:coverage`, and `coverage/` added to `.gitignore` (generated output). Discarded: `@vitest/coverage-istanbul` (instruments the code, slower); no provider (fallback with raw `NODE_V8_COVERAGE` and a project script: more code, less reliable).
2. **Q2. Component-test tools: approved.** Development dependencies `jsdom`, `@testing-library/react` (a range that supports React 19) and `@testing-library/dom` (peer of the former); the implementer reads the registry and the peer ranges and records the exact caret ranges. `@testing-library/user-event` and `@testing-library/jest-dom` are not approved (each would be asked when a test needs it). Environment: a third Vitest project named `component` with `environment: jsdom` that includes only `tests/**/*.test.tsx`; the existing two projects keep matching only `*.test.ts`, so no existing test changes environment (NFR-1) and no file needs a per-file marker. **Stop condition:** if the JSX transform of the `component` project needs `@vitejs/plugin-react`, that package is NOT approved; the implementer stops and asks. Discarded: per-file marker, `happy-dom`, refusing the tools (section 2.4 fallback).
3. **Q3. Project-written skill folder: approved.** The skill is created at `.claude/skills/quality-testing-core/` and gets NO entry in `skills-lock.json` (the lock records skills installed from a source with a hash; an invented source would be false). Machine note: on this machine `.claude/skills` is a real directory tracked by git (it holds `frontend-design`), not a link. **Check for the implementer:** compare with the `CLAUDE.md` Structure note ("a local link to `.agents/skills`; git stores both as identical copies") and see whether `.agents/skills` needs an identical copy of the new folder; if that is unclear, it stops and asks. Discarded: creating it only in `.agents/skills/`; a folder outside both (Claude Code would not discover it).
4. **Q4. Placement of the new files: approved as planned.** The living inventory is the flat file `docs/criticality-inventory.md` (no new folder; the `docs/` line of the Structure section of `CLAUDE.md` is not edited, it is outside the closed list of FR-16); the two point-in-time documents are `specs/005a-quality-testing/audit-report.md` and `specs/005a-quality-testing/testing-evaluation.md` (005b reads them as a frozen snapshot of the closing commit); the coverage report script lives in the new subfolder `tests/support/coverage/` (plain `.mjs`, no new dependency). Discarded: the point-in-time documents in `docs/` or in a new `docs/testing/` folder.
5. **Q5. Reference set for the completion check: changed by the user.** The page access guard (with `src/proxy.ts`) is IMPORTANT. Reason: the guard only redirects; real authorization is enforced per operation by the acting-user check, which stays CORE. The remember-universe use case stays CORE, as FR-10 requires, because it holds owner-isolation tests (final decision of the user, 2026-11-20). The set is 3 CORE (`prisma-universe-repository`, `remember-universe`, the account password rule), 5 IMPORTANT and 2 TIER 0 (table in section 7), and the provisional guide of 2.1 is aligned with it. The levels remain provisional until the inventory classifies them.
6. **Q6. Two readings of the spec: accepted, no scope widened.** (a) The re-check rule of FR-9 is written only in the skill and in the header of the audit report; the flow rules are not edited for it (if the user wants it in `sdd.md`, that is a `/sdd-change` of FR-16). (b) FR-16(a) rewrites of the agent definitions and commands carry the pointer to the skill inside the rewritten sentence; no standalone lines are added to them.

## 1. Affected modules and layers

**No production module, layer or top-level folder is created or changed.** The only production change is the TIER 0 entry for the development dependencies of `package.json` and `pnpm-lock.yaml` (spec, definition of production component), subject to Q1 and Q2. The dependency direction `presentation → application → domain ← infrastructure` is not touched; the import-boundary lint rules are not touched.

### 1.1 New documents

| Document | Content and format | FRs |
|---|---|---|
| `docs/criticality-inventory.md` (Q4) | The inventory. A header (how to read it, the level definitions by reference to the skill, how coverage is shown, the authority order constitution > skill > inventory), then **one markdown table per area** (accounts, universes, shared, app routes and actions, components, messages and styles, configuration and schema), then a closing section "Not production (not classified)" that lists the excluded patterns (tests, test support, generated code, test-runner and browser-test configuration, agent setup, documentation, custom lint rules and their tests) and a section "Open judgment calls". Columns: `Id` (area prefix and number, e.g. `ACC-3`), `Files` (repository-relative glob patterns, one per line; the coverage script reads this column), `Responsibility`, `Level`, `Why`, `Strategy` (test types and what to protect), `Protection` (measured lines and branches by test type with the date of the snapshot, or "protected by browser test X", or "none: gap"), `Exceptions and gaps` (target override with its reason, or gap with the plan to close it). One row per component or per group that shares level and strategy; every production file matches exactly one row (NFR-3). | FR-1, FR-3, FR-5, NFR-3 |
| `specs/005a-quality-testing/audit-report.md` (Q4) | The audit report. A header with the rule for 005b's re-check (below), then: (A) summary counts per verdict and per test type; (B) **the groups table**, one row per test group, with `Group id` (`A-01`...: stable, the id the user cites at the 005b gate), `Test files` (each with its short git blob id, see below), `Inventory entries protected`, `Type`, `Verdict` (KEEP, REFACTOR, DELETE, REPLACE or REVIEW; exactly one per group), `Reason` (by the eleven criteria of `CALIDAD.md` section 6), `Behavior protected`, `Protection kept` (required for DELETE and REPLACE: the test or strategy that keeps the protection), `Protected tests inside` (cross-reference to section C), `Missing information` (required for REVIEW); (C) **the protected tests**, one row per test (file, describe and test name, line, what it proves, verdict KEEP or REVIEW only, "untouchable: a group verdict never applies to it"); (D) coverage gaps of CORE and IMPORTANT components (findings, with the entry id); (E) a decision sheet that only lists the group ids and states that approval is given as the answer at the 005b gate, not by this file. Test support and the tests of lint rules are groups of their own. | FR-9, FR-10, NFR-4 |
| `specs/005a-quality-testing/testing-evaluation.md` (Q4) | The written diagnosis with numbers, the recommended distribution of test types, and the evaluation of the four optional tools (section 2.3 of this plan describes both). | FR-11 |

**Re-check rule of FR-9 (written in the skill and in the audit report header).** The report stores, for each test file, the first 12 characters of its git blob id at the time the report is closed (`git hash-object <file>`). When 005b starts it recomputes the ids at the commit that closes 005a (which equals the commit where the report was written, because 005a changes no test, NFR-1) and compares them with the current ones; every group with at least one different id, an added file or a removed file is marked REVIEW before the user is asked. The check needs no script: one `git hash-object` per file listed.

### 1.2 The skill (Q3)

Created in `.claude/skills/quality-testing-core/`; the implementer checks whether `.agents/skills` needs an identical copy (see Q3) and asks if unclear.

```
.claude/skills/quality-testing-core/
├── SKILL.md                      # the operational core, short enough to be read whole on every use
└── references/                   # read only when the situation needs it
    ├── assertion-quality.md      # FR-6: the weak-assertion criteria with examples from this repository
    ├── test-type-strategies.md   # FR-12: unit, integration, component, end-to-end; what each protects and how; mocks and fakes
    └── audit-and-removal.md      # FR-9, FR-10, FR-15: verdicts, protected tests, the proposal format, the 005b re-check
```

`SKILL.md` has YAML front matter (`name: quality-testing-core`, a `description` that says when to use it: before writing or changing production code or a test, when planning, validating or auditing tests) and these sections, each answering one of the eight questions of the completion criteria: (1) when to consult it and the 8-question quick procedure; (2) levels and how to classify, reclassification (FR-1, FR-2); (3) coverage targets 100/80/0 on lines and branches, exceptions, gaps, how to read `pnpm test:coverage`, coverage versus real quality (FR-5, FR-8); (4) what behaviors to protect and which test type (decision table by layer and level, E2E only for user flows, behaviors only protected by browser tests are recorded, not measured); (5) useful test versus coverage-only test (FR-6, pointing to the reference); (6) is it already covered (inventory entry, mirrored test path, search by behavior, coverage by entry, E2E list); (7) simplify or remove (FR-15, D-3, D-6: proposal format, never without the user's approval at a gate, protected tests only in the D-6 case); (8) the way of working (FR-13: red then green; green before and after; characterization then green before and after; behavior removed with approval; FR-14: bug fixes, TIER 0 none, tooling rule; the exact evidence line); (9) inventory upkeep (FR-4: when a task must touch it, the authority order, fix in the same task); (10) checks to run before finishing (typecheck, lint, test, test:e2e when a user flow changes, the spoiler suite when queries, visibility or reading progress change, `pnpm test:coverage` for CORE or IMPORTANT work). The skill also holds the coverage threshold policy of FR-8 (values, what counts, how exceptions are written) and says that it is not enabled before 005b closes the cleanup.

Size and style: operational (tables, checklists, one worked example per rule), written in English, no theory. `SKILL.md` stays under about 250 lines; the references are read on demand.

### 1.3 Tooling configuration (subject to Q1 and Q2)

| File | Change | FRs |
|---|---|---|
| `package.json` and `pnpm-lock.yaml` | Development dependencies of Q1 and Q2 (caret ranges per `CLAUDE.md`); scripts `test:coverage` (see 2.2). `onlyBuiltDependencies` is not extended (none of them needs an install script; the implementer confirms). One commit with the lockfile. | FR-7, FR-4 (TIER 0 entry) |
| `vitest.config.mts` | A `coverage` block (provider, `include` of the production source, `exclude` of generated and declaration files, JSON reporter, per-project output folders passed by the script); no `thresholds` (FR-8); a third project `component` (Q2). Coverage is off by default, so `pnpm test` is unchanged. | FR-7, FR-8, NFR-1 |
| `.gitignore` | One line for the coverage output folder (Q1). | FR-7 |
| `tests/support/coverage/report-coverage-by-inventory-entry.mjs` (Q4) | Reads the coverage JSON of each test type and the `Files` column of the inventory; prints, per entry, lines and branches by test type and combined, the level, the target and the distance to it, and lists unmatched or duplicated production files (a by-product that serves NFR-3). Plain script, no test (tooling, FR-14). | FR-3, FR-7, NFR-3 |

Q1 and Q2 are approved. Contingency: if the `component` project cannot transform JSX without `@vitejs/plugin-react` (not approved), the implementer stops and asks; if that package is then refused, the `component` project is not created and section 2.4 is the fallback described in FR-7 (a later spec).

### 1.4 Instruction and flow files (FR-16, the closed list)

Nothing outside the categories (a) to (h) is edited. At each task the implementer first runs the markers below with `Grep` over `CLAUDE.md`, `.claude/rules/`, `.claude/commands/` and `.claude/agents/`, edits only the hits that belong to a category, and **reports any other hit without editing it**. The file list below comes from a search of today's files and is the expected result, not an authorization for other changes.

| Cat. | Files and places (marker to search) | What changes |
|---|---|---|
| (a) tests proportional to criticality | `CLAUDE.md`: Workflow "with its tests", ALWAYS "Add or update tests with every change", Verification "including new tests for the change", Commands table (row for the coverage command, Q1 approved). `.claude/rules/sdd.md`: Tasks "Every task includes its own tests (CLAUDE.md: tests with every change)", Implementation "with its tests", verification gate "including the new tests". `.claude/rules/architecture.md`: section 12 table of test type per layer and the `tests/` tree of section 2 (`components/` also holds component tests; `support/coverage/`). `.claude/agents/implementer.md`: "with its tests", "add the tests they need". `.claude/agents/reviewer.md`: "Tests exist for each change ... none skipped or deleted". `.claude/commands/sdd-implement.md`: "with its tests". `.claude/commands/sdd-tasks.md` and `.claude/agents/planner.md`: the "Tests:" description. `.claude/commands/sdd-plan.md`: "tests per layer". | "tests with every change" becomes "tests proportional to criticality" (CORE and IMPORTANT changes carry tests, TIER 0 none); the pointer to the skill lives inside these rewritten sentences. Architecture table gets the distribution of the evaluation and the component-test row. |
| (b) the NEVER rule | `CLAUDE.md` NEVER: "Silence errors, skip or delete tests, or relax strict mode". | Gains "except a justified proposal approved by the user" for deleting or simplifying tests only; silencing errors, skipping tests and relaxing strict mode stay forbidden without exception. The wording is shown in the task before it is committed. |
| (c) templates | `.claude/rules/sdd.md` Plan (item 7 and the new test design section) and Tasks (the template). `.claude/commands/sdd-plan.md`, `.claude/commands/sdd-tasks.md`, `.claude/agents/planner.md` (copies of the template). | Plan: a test design section (every affected component, its level, behaviors, test type; or "no production component with behavior"). Tasks: the evidence line under each CORE or IMPORTANT task (FR-13 wording). |
| (d) validation | `.claude/rules/sdd.md` Validation; `.claude/commands/sdd-validate.md` (reviewer brief); `.claude/agents/reviewer.md` ("If asked to validate the implementation"). | The checks of FR-18 and the reclassification check of FR-2. |
| (e) numbering | `.claude/rules/sdd.md` (Spec section "NNN is the next free three-digit number", Git section "spec-NNN-name"); `.claude/rules/git.md` (branch table, naming line, commit-message examples); `.claude/commands/sdd-spec.md` (folder name, branch `spec-<folder>`, "next free three-digit number"); `.claude/agents/planner.md` ("NNN = next free number"). The `argument-hint` lines of the other commands are changed only if they say digits only. | Numbers shared by specs from one context take consecutive letters (`NNNa`, `NNNb`); branches are `spec-` plus the number with its letter plus the name. |
| (f) renumbering | `CLAUDE.md` "Current status"; `docs/roadmap.md` (list of specs and description of Phase 1, the provisional-numbers note, the "Needs resolved first" column); `docs/open-decisions.md` OD-6 ("executed by spec 005"); `.claude/rules/data-model.md` (the two lines that name spec 005 as the lifecycle spec, in the universes table). | 005a and 005b appear inside Phase 1 before 006; the lifecycle spec, with the OD-6 trash decision, is 006. Phase 1 goes from four specs to six. |
| (g) structure | `CLAUDE.md` Structure (`.claude/` line: the skills entry names `quality-testing-core`). | One mention. |
| (h) stack | `CLAUDE.md` Stack: a bullet "Installed by spec 005a (approved <date>)" with the approved packages; the sentence "`jsdom` and testing-library are not approved" (inside the spec 003 bullet) is updated (Q2 approved; `@vitejs/plugin-react` is not approved). | Records the approvals. |

**Reference block of FR-12 / NFR-2** (the only new lines that count toward the limit of 15): one short block placed in Workflow of `CLAUDE.md`, planned at 12 lines or fewer, with: where the skill and the inventory are; consult the skill before writing or changing a production file or a test; classify the component first (inventory entry, or add it); tests are proportional to criticality and give a real guarantee (behavior over implementation, no coverage-only tests); CORE and IMPORTANT behavior changes are test-first, behavior-keeping changes add no test; TIER 0 gets none; deleting or simplifying a test only through an approved proposal. The count is checked with `git diff -U0 CLAUDE.md`: added lines of the block only; rewritten lines of the closed list are listed separately.

## 2. Data

**No data, no JSONB attribute and no Prisma schema change or migration.** The only change near the package manifest is the development dependencies (Q1, Q2) with `pnpm-lock.yaml`.

### 2.1 Inventory method (FR-1, FR-3, NFR-3)

The production file set is defined once so the match is mechanical: every file under `src/` except `src/shared/infrastructure/generated/`; `prisma/schema.prisma` and `prisma/migrations/**`; `package.json` (and the lockfile with it); `next.config.ts`; and any other application configuration found at the repository root (the implementer lists each root file in the inventory as production or as "not production" with the reason; the test-runner and browser-test configuration, the ESLint configuration, the Docker Compose file and the Prisma CLI configuration are tooling). The implementer lists the files with `Glob`, writes the entries area by area, and checks the match with the coverage script (unmatched or duplicated files) plus a one-off listing; an unmatched or duplicated file is a defect.

**Provisional classification guide** (a starting point so the implementer applies the same criteria; each level is confirmed by reading the file, and the doubtful ones go to "Open judgment calls" and are shown to the user at validation):

| Area | Provisional level | Reason |
|---|---|---|
| Accounts domain, application, infrastructure, composition | CORE | Authentication: a mistake compromises access. |
| Shared session pieces (session policy, session readers, password hasher, Better Auth instance, server environment) | CORE | Authentication and session. |
| Page access guard (`page-access-guard`) with `src/proxy.ts` | IMPORTANT | The guard only redirects; real authorization is enforced per operation by the acting-user check, which stays CORE (decided by the user, 2026-11-20). |
| Shared presentation (same-site check, acting-user reader, action runner, input parser, error-to-response mapper) | CORE | Security boundary: ownership, request origin, no internals in responses. |
| Universes application (including `remember-universe`), repositories and the not-found error | CORE | Owner isolation; holds the protected tests. |
| Server Actions of the routes and their input schemas | CORE | Entry point where acting user and validation are enforced. |
| Universes domain rules (name, description, text, id, initial selection) | IMPORTANT | Validation and forms; a wrong result blocks the usual task. |
| Pure client logic (result interpreters, state reducers, time limits, messages by code, navigation logic) | IMPORTANT | State handling and user interaction, tested at unit level. |
| Interactive components (forms, user menu, workspace, accessibility control and preferences) | IMPORTANT | Interaction, navigation, loading, error and empty states; from now on unit-tested as components when touched. |
| shadcn wrappers, toggle buttons without logic, message dictionary, design tokens, types and constants, package manifest | TIER 0 | Declarative; correctness by the type checker and the contrast checks of the tokens. |
| Graph layout and label helpers (installed, unused until Phase 3) | IMPORTANT or TIER 0 | Judgment call: they compute, but nothing uses them yet. |
| Schema, migrations, `next.config.ts` | judgment call | The spec says usually TIER 0 unless relevant logic: the CHECK constraints and the security headers are relevant logic, so a CORE or IMPORTANT entry with "protected by the integration tests / header test" is likely. |

**Coverage column.** The inventory keeps a dated snapshot of the measured figures (lines and branches by test type) written when the entry is created or touched; the live figures come from `pnpm test:coverage`. Keeping only a snapshot avoids a document that goes stale on every run.

### 2.2 Coverage measurement design (FR-5, FR-7, FR-8)

- **Provider and scope.** The V8 provider (Q1, option a); `coverage.include` is the production source of `src/`; generated Prisma client and declaration files are excluded. Because `include` lists every production file, a file no test imports shows up at 0 %, which is how a gap becomes visible. Metrics that count are **lines and branches** (statements and functions are not part of the policy).
- **By test type.** Vitest merges projects in one run, so contribution cannot be told apart. The script `pnpm test:coverage` therefore runs the projects one at a time, each with its own output folder, and then runs the report script: `vitest run --project unit --coverage ...` for `unit`, the same for `database`, the same for `component` once it has files, then `node tests/support/coverage/report-coverage-by-inventory-entry.mjs`. It needs the local PostgreSQL, like `pnpm test`. The report prints for each inventory entry the columns unit, database, component and combined, for lines and branches; E2E is shown as "not measured" with the browser test names recorded in the inventory entry.
- **Per criticality.** The script takes the `Level` of each entry, applies the target (CORE 100 %, IMPORTANT 80 %, TIER 0 no target, shown without distance), applies a recorded exception if the entry has one, and prints the distance to the target. A test that exercises several components counts for each of them (the report is per file, the entry is the sum of its files). An entry reclassified upward that is below the new target prints the gap and does not fail anything.
- **Thresholds policy (defined, not activated).** The policy text (values, lines and branches per entry, TIER 0 excluded, exceptions written in the entry as "override: lines 100, branches 92, reason") lives in the skill and in the header of the inventory. The mechanism for 005b is described, not built: generate Vitest `coverage.thresholds` per glob from the inventory entries. In 005a `vitest.config.mts` has no `thresholds` key, and `pnpm test:coverage` always exits successfully when the tests pass (checked by reading the config and by running it with a deliberately uncovered CORE file in the report).
- **Q1 is approved** (V8 provider); no fallback is needed.

### 2.3 Evaluation write-up (FR-11), in `testing-evaluation.md`

1. **Diagnosis with numbers.** Method (so it can be repeated): production volume = physical lines and file count of the production set of 2.1 split by area; test volume = physical lines and file count of `tests/` split into unit, database-backed (the `DATABASE_BACKED_TEST_FILES` list of `vitest.config.mts`), lint tests, end-to-end specs, end-to-end support, and test support; test cases per type from the JSON reports of Vitest and Playwright (not from counting `it(` by hand); runtime per project from the same reports; the "spec 004 produced about 3.4 times more test than production lines" claim checked with `git diff --numstat` over the spec 004 commits. The numbers are produced during implementation and written in the file; this plan does not state them.
2. **Recommended distribution.** A table by criticality and layer (CORE domain and application: exhaustive unit with in-memory fakes that satisfy the shared contract tests; CORE infrastructure and Server Actions: integration against the test database, focused on ownership and failure translation, not on every branch of the mapper; IMPORTANT pure client logic: unit; IMPORTANT interactive components: component tests in the `component` project when touched; end-to-end: a small set of critical user journeys, never repeating what a lower level already proves; TIER 0: nothing), with the observation that the proportion is a consequence, not a quota. A short version goes into the architecture rule (category (a)).
3. **Evaluation of the four optional tools**, each with benefit, cost, complexity and a recommendation, none installed: mutation testing (useful to find weak assertions in CORE domain files; cost in run time and a new dependency; recommendation to consider a one-off run on a few CORE files after 005b, not a permanent step); extra static analysis (test-linting plugins that catch missing assertions or focused tests; small gain over the current review, new dependencies; recommendation: not now); scripts that detect redundant tests (per-test coverage comparison; heavy and noisy; recommendation: do it by hand per group during the 005b audit instead); mechanisms to keep the inventory current (the FR-4 rule in every plan and task, the unmatched or duplicated file list the coverage script already prints, a failing check later in CI once OD-22 is decided; recommendation: the rule plus the printed list now, a failing check only after 005b).

### 2.4 Fallback for FR-7 only if the `component` project proves impossible (Q2 stop condition)

Not built in 005a. The plan for it would be a later spec: move the logic of each IMPORTANT component (form state, field messages) into pure functions beside the component, unit-test them, and keep two or three browser tests for the visual behavior. The inventory would record the interface components as "protected by browser test X" and not as a coverage gap.

## 3. Use cases

None. This spec creates no use case and has no acting user or `ViewerContext`; there is no application code.

## 4. Contracts

None. No Server Action, no Route Handler, no Zod schema. The only commands added are developer scripts (`pnpm test:coverage`).

## 5. UI

None. No route, component, state or accessibility change. The `frontend-tester` is not needed for validation (the spec has no UI requirement).

## 6. Spoiler impact

None, as in the spec: no narrative information is read or written, and no query, visibility rule or reading-progress code changes. How the protected tests are handled:

- The owner-isolation tests are found by searching `tests/` for the cases that check that a user cannot read or change another user's universe or remembered universe (repository integration tests, use case scenarios against the database, Server Action tests, end-to-end access tests) and are listed **individually**, by file, test name and line, in section C of the audit report with the verdict KEEP or REVIEW. The group that contains them never carries a verdict that applies to them.
- The components those tests protect are classified CORE in the inventory and the entry says "contains protected tests".- Spoiler suite: not applicable (it does not exist before Phase 4, and no task here touches queries, visibility or reading progress). When it is created, its tests join section C and their components become CORE (the rule is in the skill).
- No existing test file is modified. Check: `git diff --name-status` against the branch start for `tests/` shows only added files under `tests/support/coverage/` (and no change to a protected file).

## 7. Tests

**Test design (FR-17):** no production component with behavior. FR-13 and FR-18 do not apply to this spec; no red step and no green-before-and-after line is expected in its task list. The single production-side entry is the TIER 0 inventory row for the development dependencies of `package.json` and `pnpm-lock.yaml`; it has no tests.

Tests added by this spec: none for production code (NFR-1). The coverage report script is tooling and carries no test (FR-14: it protects no CORE or IMPORTANT component). How 005a is verified instead:

| Check | What it proves | FR / NFR |
|---|---|---|
| **Same-result check (NFR-1).** Before the first tooling change, with the local database up, run `vitest run --reporter=json --outputFile=<temp>` and the Playwright JSON reporter, and save the list of (file, full test name, status) outside the repository (system temporary folder, not committed). After the last tooling task, and after any task that touches `vitest.config.mts`, repeat and compare the two lists: same tests, same outcomes. | Nothing existing changed; the new project and the provider alter no outcome. | NFR-1, FR-7 |
| `pnpm typecheck`, `pnpm lint` (no warnings), `pnpm test`, `pnpm test:e2e` green after the tooling tasks; typecheck and lint after the others. A `component` project with no test files must not make `vitest run` fail (confirmed when it is created; if Vitest complains, the setting that allows an empty project is added and reported). | The verification checks give the same result as before. | NFR-1 |
| `pnpm test:coverage` runs from a clean tree, produces the per-entry report with unit, database and (empty) component columns, and exits successfully; two entries are cross-checked by hand against the raw JSON. `vitest.config.mts` has no `thresholds` key. | Measurement works per entry and type; thresholds are not active. | FR-5, FR-7, FR-8 |
| One-off listings: every production file matches one inventory entry (the report's unmatched and duplicate lists are empty); every file under `tests/` appears in exactly one audit group (`Glob tests/**` against the report). | Completeness. | NFR-3, NFR-4 |
| `git diff -U0` review of the instruction files: every changed hunk is in a category (a) to (h); the added lines of the reference block in `CLAUDE.md` are 15 or fewer; a search for `tests with every change`, `none deleted`, `spec-NNN`, and `spec 005` as the lifecycle spec shows no remaining hit in the files of the closed list (the two code comments are the documented leftover). | The closed list was respected and the replacement is complete. | FR-16, FR-19, FR-20, NFR-2 |
| Skill check: front matter valid, the folder is visible through both paths and the two git copies are identical, `SKILL.md` under about 250 lines. | The skill is usable by agents. | FR-12 |
| **Completion-criteria check.** The coordinator launches two independent read-only subagent runs per component of the reference set; each gets only the skill, the inventory and the component path and answers the eight questions. The answers of the two runs are compared (same level, same test type) and with the inventory entry. A summary table is given to the user in the validation report; no report file is created. The final judgment may be a manual check by the user. | The agents answer consistently. | FR-12, completion criteria |
| `@reviewer` on the documents, FR by FR (no hacker: no authentication, ownership, spoiler or data-exposure surface changes; no frontend-tester: no UI). | Each FR is satisfied by a written artifact. | FR-1 to FR-20 |

**Reference set for the completion check (Q5, as changed by the user on 2026-11-20)** (ten real components: 3 CORE, 5 IMPORTANT, 2 TIER 0; level provisional, confirmed by the inventory):

| # | Component | Level | Expected test type |
|---|---|---|---|
| 1 | `src/modules/universes/infrastructure/prisma-universe-repository.ts` (owner isolation; protected tests) | CORE | Integration against the test database |
| 2 | `src/modules/universes/application/remember-universe.ts` (owner-isolation tests, FR-10) | CORE | Unit with fakes plus the database scenario |
| 3 | `src/modules/accounts/domain/account-password.ts` | CORE | Unit |
| 4 | `src/shared/presentation/page-access-guard.ts` (only redirects; authorization is the acting-user check, CORE) | IMPORTANT | Unit |
| 5 | `src/modules/universes/domain/universe-name.ts` | IMPORTANT | Unit |
| 6 | `src/components/universes/universe-creation-state.ts` | IMPORTANT | Unit (pure reducer) |
| 7 | `src/app/sign-in/_components/sign-in-form.tsx` | IMPORTANT | Component test when touched; end-to-end journey exists |
| 8 | `src/components/accounts/run-with-time-limit.ts` | IMPORTANT | Unit |
| 9 | `src/messages/en.ts` | TIER 0 | None |
| 10 | `src/components/ui/button.tsx` | TIER 0 | None |

If the implementer finds that reading a file contradicts its provisional level (for example, a file listed as TIER 0 holds logic), it swaps in a similar component of the same level and reports the swap; consistency is checked against the inventory either way.

## 8. Decisions

Each with the alternative discarded.

- **D1. Inventory as one flat markdown file with one table per area and one row per cohesive group.** Discarded: a header comment in every source file (touches production code, breaks NFR-1, scatters the data); a JSON or YAML file (the user cannot read it comfortably); one document per file (the maintenance burden `CALIDAD.md` asks to avoid). The `Files` column holds glob patterns so a script can match it.
- **D2. Audit report and evaluation inside the spec folder, inventory in `docs/`.** The inventory is living and used by every later spec; the other two are a snapshot that 005b reads. Discarded: all three in `docs/` (mixes living and frozen documents); a new `docs/testing/` folder (new folder with no need).
- **D3. Audit group ids and the 005b re-check by git blob ids.** Each group is a row with its own id and verdict, so the user answers per id. Discarded: a re-check by commit date or by hand (error-prone); a hash script (the spec forbids installing redundancy tooling here and a `git hash-object` per file is enough).
- **D4. One `SKILL.md` plus three on-demand references.** Keeps the always-read part short (the project reads skills often) while examples and the audit procedure load only when needed. Discarded: one very long `SKILL.md` (read in full on every use); several separate skills (the spec asks for one named skill and one entry point).
- **D5. The skill is created at `.claude/skills/quality-testing-core/`, not locked in `skills-lock.json`** (Q3). Discarded: adding a lock entry (it would invent a source and hash); placing it outside the link (not discovered).
- **D6. V8 coverage provider** (Q1). Discarded: istanbul (slower, instrumentation, no need for source-level precision at this size).
- **D7. Coverage by test type by running the Vitest projects one at a time and merging in the report script.** Discarded: one merged run (cannot say which test type contributed, which FR-7 requires); per-test coverage (heavy; the same effect during the audit is done by hand per group).
- **D8. A plain `.mjs` script under `tests/support/coverage/` for the per-entry report** (Q4). Discarded: only per-glob `coverage.thresholds` (no per-entry report and it would be an activated threshold); a custom Vitest reporter (more coupled to Vitest internals); a TypeScript runner for a `.ts` script (a new dependency).
- **D9. The DOM environment is a third Vitest project selected by the `.test.tsx` extension** (Q2). Discarded: a global `jsdom` environment (existing tests would change environment, against NFR-1); a per-file marker (every future file must remember it, and a forgotten one fails confusingly).
- **D10. Thresholds are described, not configured, in 005a.** Discarded: configuring them behind a flag now (the spec says not to activate them, and an unused switch is code to maintain); making the report fail on a gap (the current suite would fail).
- **D11. Policy on lines and branches per inventory entry, with recorded overrides.** Discarded: statements and functions (not required by the spec, add noise); a project-wide percentage (the quota the spec rejects).
- **D12. The detailed rules (red-green, characterization, removal proposals) live only in the skill; the flow rules carry the template line and the validation checks.** Discarded: copying the rules into `sdd.md`, the agents and the commands (the duplication this spec is meant to remove, and `FR-16` limits the edits).
- **D13. Instruction edits are made by category in separate tasks, always starting from a fresh search and reporting hits outside the list.** Discarded: one big edit pass (it is hard to review against a closed list).
- **D14. NFR-1 is checked by comparing before and after lists of (file, test name, status) from the runners' JSON reports, kept outside the repository.** Discarded: comparing only counts (a swapped outcome would pass).
- **D15. The audit is done area by area (accounts, shared, universes, app and components, lint and support, end-to-end), one commit per area.** Discarded: one pass over all test files (a single unreviewable document change).

## 9. Coverage (FR and NFR to the parts of this plan)

| Requirement | Covered by |
|---|---|
| FR-1 | Inventory method and classification guide (2.1), skill section 2, inventory table (1.1) |
| FR-2 | Skill section 2 (reclassification rule), validation check (1.4 category d), "Open judgment calls" of the inventory |
| FR-3 | Inventory columns and the coverage snapshot (1.1, 2.1) |
| FR-4 | Skill section 9, the TIER 0 inventory row for the development dependencies (section 1), plan and task template lines (1.4 category c) |
| FR-5 | Coverage targets and per-entry report with overrides (2.2), skill section 3, inventory columns |
| FR-6 | Skill section 5 and `references/assertion-quality.md`; used by the audit (section C and reasons) and the validation check (1.4 category d) |
| FR-7 | Provider, scripts, config, report script (1.3, 2.2), the component project (Q2, D9), fallbacks (1.3, 2.4) |
| FR-8 | Threshold policy in the skill and the inventory header, mechanism described only (2.2, D10); verified by the absence of `thresholds` (section 7) |
| FR-9 | Audit report format, group ids, re-check rule by blob ids (1.1); the rule is in the skill and the report header (Q6a) |
| FR-10 | Audit report section C and the group rule (1.1), CORE classification of the protected components (2.1, section 6), skill `references/audit-and-removal.md` |
| FR-11 | `testing-evaluation.md` (1.1, 2.3) |
| FR-12 | The skill (1.2), the eight-question check (section 7), the reference block in `CLAUDE.md` (1.4) |
| FR-13 | Skill section 8, the evidence line in the task template (1.4 category c) |
| FR-14 | Skill section 8 (bug fixes, TIER 0, tooling), the ALWAYS rewrite (1.4 category a) |
| FR-15 | Skill section 7 and `references/audit-and-removal.md`, the NEVER exception (1.4 category b) |
| FR-16 | The closed list by category and file (1.4), the diff review (section 7) |
| FR-17 | The test design section in the plan and task templates (1.4 category c) and its application in section 7 of this plan |
| FR-18 | The validation checks (1.4 category d) |
| FR-19 | Numbering, folder and branch rules (1.4 category e) |
| FR-20 | Roadmap, current status, OD-6 and data-model references (1.4 category f) |
| NFR-1 | Baseline and same-result check, no existing test touched, the `component` project design (sections 2.2, 7; D9, D14) |
| NFR-2 | Reference block of 12 lines or fewer, counted with `git diff -U0` (1.4, section 7) |
| NFR-3 | Production file set and one-row-per-file rule (2.1); the report script's unmatched and duplicate lists; one-off listing (section 7) |
| NFR-4 | Audit report of every file under `tests/` (1.1, D15); one-off listing (section 7) |

## 10. Order of work (input for the tasks, not the tasks)

1. Baseline of the same-result check (outside the repository).
2. Tooling: coverage provider and script entry (Q1), then the component project (Q2), each followed by the same-result check.
3. The coverage report script, then the first coverage run (the numbers feed the diagnosis and the inventory snapshot).
4. The inventory, area by area (several commits).
5. The skill (needs the inventory format and the distribution of the evaluation): `SKILL.md`, then the three references.
6. The evaluation write-up: diagnosis with numbers, distribution, tool evaluation.
7. The audit report, area by area (several commits), then the protected-tests section and the gaps section.
8. Instruction edits by category: (b) the constitution; (a) the sweep, by file group; (c) and (d) the templates and validation; (e) numbering; the reference block, (g) and (h); (f) roadmap, current status, OD-6, data-model.
9. Final checks: the one-off listings, the closed-list diff review, the eight-question check on the reference set.

The skill must exist before the reference block points to it; the inventory and the skill must exist before the audit refers to entry ids and to the verdict rules. The user decides at the validation gate whether `CALIDAD.md` can be removed (it is not touched here).
