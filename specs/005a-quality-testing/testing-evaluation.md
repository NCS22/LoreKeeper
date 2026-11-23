# Testing evaluation 005a — Diagnosis, distribution and optional tools

Point-in-time document of spec 005a (FR-11). Spec 005b reads it as a frozen snapshot of the commit that closes 005a. The living criticality of each component is in `docs/criticality-inventory.md`; the rules for writing tests are in the skill `quality-testing-core`.

Measured on 2026-11-23 at commit `5f3473d` (the working tree differed only in documents). Every figure below comes from the command written next to it, run from the repository root in Git Bash with the local PostgreSQL up. Report files are written outside the repository (`<scratch>` is any temporary folder).

## 1. Diagnosis with numbers

### 1.1 Method (repeatable)

- **Line count.** Physical lines, blank lines and comments included, of the files git tracks: `git ls-files <pathspec> | wc -l` gives the file count and `git ls-files <pathspec> | xargs cat | wc -l` the line count. Physical lines are a rough size, not a quality measure; they are used only to compare areas and types with each other. The binary `src/app/favicon.ico` counts as the 12 line breaks `wc -l` finds in it.
- **Production set.** The one of the inventory (plan 2.1, D-T4-1): `src/` without the generated Prisma client, the schema and migrations under `prisma/`, and the root production files `package.json`, `next.config.ts`, `tsconfig.json` and `pnpm-lock.yaml`. The lockfile is written by pnpm and has 8171 lines, so it is reported apart and left out of every ratio.
- **Areas.** The areas of the inventory; `src/app/globals.css` goes with messages and styles (MSG-2) and `src/proxy.ts` with the app routes (APP-3).
- **Test types.** By file location and the `DATABASE_BACKED_TEST_FILES` list of `vitest.config.mts`: database-backed (`tests/shared/infrastructure`, `tests/modules/*/infrastructure`, `tests/modules/universes/application`, `tests/app`, `tests/components/workspace/load-workspace-universes-for-page.test.ts`), lint tests (`tests/lint`, they run in the `unit` project), unit (every other `*.test.ts`), end-to-end specs (`tests/e2e/*.spec.ts`), end-to-end support (`tests/e2e/support`) and test support (`tests/support` without its one test file, which counts as unit).
- **Cases and runtime.** From the JSON reports of the runners, not from counting `it(` by hand: `pnpm exec vitest run --project unit --reporter=json --outputFile=<scratch>/vitest-unit.json`, the same with `--project database` (to `vitest-database.json`), and `pnpm exec vitest run --reporter=json --outputFile=<scratch>/vitest-all.json` for the whole suite; for Playwright, the JSON reporter of a `pnpm test:e2e` run (`PLAYWRIGHT_JSON_OUTPUT_NAME=<scratch>/playwright.json pnpm exec playwright test --reporter=json` after `next build`). Wall time is the elapsed time of each command; "file time" is the sum of `endTime - startTime` of the file results (it adds up files that ran in parallel). Cases per type are counted by grouping the file results of `vitest-all.json` by the test-type rule above.
- **Spec 004.** `git diff --numstat 1a9e0c6 98ac3a7`: `1a9e0c6` is the merge base of pull request #4 (`git merge-base fd03067^1 fd03067^2`) and `98ac3a7` its last commit (`docs(004): close spec`). Rows are summed by path: `src/` (production code), `prisma/` (schema and migration), `tests/e2e/`, `tests/support/`, the rest of `tests/`.
- **Volume by level.** Each `Files` pattern of the inventory (production entries only) matched with Node's `path.matchesGlob` against `git ls-files`, lines counted as above.
- **Coverage by level.** The dated `Protection` snapshots of `docs/criticality-inventory.md` (T6, from one full `pnpm test:coverage`).

### 1.2 Production volume by area

| Area | Pathspec | Files | Lines |
|---|---|---:|---:|
| Accounts | `src/modules/accounts` | 15 | 854 |
| Universes | `src/modules/universes` | 21 | 626 |
| Shared | `src/shared ':!src/shared/infrastructure/generated'` | 24 | 1185 |
| App routes, actions and proxy | `src/app src/proxy.ts ':!src/app/globals.css'` | 22 | 843 |
| Components (feature) | `src/components ':!src/components/ui'` | 60 | 3637 |
| Components (`ui` primitives) | `src/components/ui` | 12 | 540 |
| Messages and styles | `src/messages src/styles src/app/globals.css` | 3 | 564 |
| Configuration and schema | `prisma package.json next.config.ts tsconfig.json ':!prisma/migrations/migration_lock.toml'` | 6 | 369 |
| **Production total, lockfile excluded** | | **163** | **8618** |
| Lockfile (not in the ratios) | `pnpm-lock.yaml` | 1 | 8171 |

By criticality (the `Files` patterns of each inventory entry matched against `git ls-files`, lockfile excluded): CORE 17 entries, 57 files, 2644 lines; IMPORTANT 18 entries, 65 files, 4274 lines; TIER 0 10 entries, 41 files, 1700 lines (the three add up to the total above).

### 1.3 Test volume by type

| Type | Pathspec | Files | Lines | Share of test lines |
|---|---|---:|---:|---:|
| Unit | every `*.test.ts` under `tests/` minus the two rows below | 51 | 5387 | 28 % |
| Database-backed | the `DATABASE_BACKED_TEST_FILES` paths | 25 | 4762 | 25 % |
| Lint tests | `tests/lint` | 4 | 645 | 3 % |
| End-to-end specs | `'tests/e2e/*.spec.ts'` | 15 | 5104 | 27 % |
| End-to-end support | `tests/e2e/support` | 22 | 1068 | 6 % |
| Test support | `tests/support ':!tests/support/**/*.test.ts'` | 21 | 2091 | 11 % |
| **Total** | `tests` | **138** | **19057** | 100 % |

All Vitest test files together (`git ls-files '*.test.ts' | grep '^tests/'`): 80 files, 10794 lines. Test support includes the coverage report script added by 005a T4.

Test files of Vitest by area of the code they test (unit, database-backed and lint together; `git ls-files` per folder):

| Area | Test folder | Files | Test lines | Production lines | Test lines per production line |
|---|---|---:|---:|---:|---:|
| Accounts | `tests/modules/accounts` | 14 | 2049 | 854 | 2.4 |
| Universes | `tests/modules/universes` | 17 | 1518 | 626 | 2.4 |
| Shared | `tests/shared` | 18 | 2779 | 1185 | 2.3 |
| App and proxy | `tests/app`, `tests/proxy.test.ts` | 7 | 1591 | 843 | 1.9 |
| Components (feature and `ui`) | `tests/components` | 18 | 1947 | 4177 | 0.5 |
| Styles | `tests/styles` | 1 | 74 | 564 | 0.1 |
| Lint rules | `tests/lint` | 4 | 645 | - | - |
| Test support guard | `tests/support/database/test-database-guard.test.ts` | 1 | 191 | - | - |

**Ratios.** All test lines against production lines: 19057 / 8618 = **2.2**. Vitest test files only: 10794 / 8618 = 1.25. Test lines are 19057 / (19057 + 8618) = 69 % of the production and test lines together, close to the "roughly three quarters" of the spec's context.

### 1.4 Cases and runtime by type

| Type | Files | Cases (all passed) | Share of cases | Wall time | File time |
|---|---:|---:|---:|---:|---:|
| Unit (project `unit` without lint) | 51 | 1141 | 57 % | 6.9 s for the whole `unit` project (report span 5.5 s) | 8.5 s |
| Lint tests (project `unit`) | 4 | 174 | 9 % | included above | 5.1 s |
| Database-backed (project `database`, one file at a time) | 25 | 485 | 24 % | 55.8 s (report span 54.5 s) | 30.2 s |
| Component (project `component`) | 0 | 0 | 0 % | - | - |
| End-to-end (Playwright, 8 workers) | 15 | 208 | 10 % | 76.3 s (report `stats.duration`), plus `next build` (not measured) | 499.1 s summed over the tests |
| **Total** | 95 | **2008** | 100 % | | |

Sources: `vitest-unit.json` (1315 cases), `vitest-database.json` (485 cases), `vitest-all.json` (1800 cases, 59.4 s wall, the split above), and the Playwright report of the T4 run of 2026-11-23 15:01 UTC (208 expected, 0 skipped, 0 unexpected, 0 flaky). The Playwright run was not repeated for this task because nothing under `src/` or `tests/` changed after it (`git diff --stat 2c11c7a HEAD -- src tests` is empty). Runtimes are one run on this machine; they vary between runs and are only comparable with each other.

End-to-end cases per spec file (Playwright report): `access` 40, `sign-up` 39, `sign-in` 27, `sign-out` 21, `universes-failures` 15, `error-pages` 12, `universes` 12, `narrow-width` 8, `universes-layout` 8, `universes-remembered` 6, `session-renewal` 5, `universes-isolation` 5, `universes-tabs` 5, `smoke` 3, `sample-data-absent` 2.

### 1.5 Coverage by criticality (inventory snapshot of 2026-11-23)

- **CORE, 17 entries:** 12 at 100 % lines and branches combined; 3 with a small recorded gap (ACC-2 branches 98.6 %, UNI-4 95.8/87.5 %, SHR-1 96.7/97.9 %); 2 not measurable by coverage and protected by named tests (CFG-2, CFG-3). The infrastructure entries reach their figures through the database project, not through unit tests (ACC-4: unit 26.8 % lines, database 97.6 %; UNI-4: unit 50 %, database 91.7 %), and so do the Server Actions (APP-1 and APP-2: unit 0 %, database 100 %) and the use cases of universes (UNI-3: unit 58.3 %, database 100 %).
- **IMPORTANT, 18 entries:** 6 at or above the 80 % target, all of them pure logic tested by unit tests (UNI-1, UNI-2, SHR-5, SHR-6, CMP-1, CMP-3); 5 below the target with partial unit coverage (APP-3, APP-6, CMP-7, CMP-10, CMP-11); 7 at 0 % in Vitest and protected only by browser tests (APP-4, APP-5, CMP-2, CMP-4, CMP-5, CMP-8, CMP-9). Those 7 are the pages, forms, hooks and providers: there was no environment to test a React component before 005a T3.
- **TIER 0, 10 entries:** no target; any figure is incidental (for example MSG-1 83.3 % because the tests import the messages).

### 1.6 The "3.4 times" claim for spec 004

The spec's context says that spec 004 "produced about 3.4 times more test code than production code". `git diff --numstat 1a9e0c6 98ac3a7`, summed by path:

| Part | Files | Added | Deleted |
|---|---:|---:|---:|
| Production code `src/` | 90 | 1703 | 3211 |
| Schema and migration `prisma/` | 2 | 92 | 9 |
| Vitest tests (`tests/` minus the two rows below) | 32 | 2505 | 421 |
| Test support `tests/support/` | 7 | 340 | 26 |
| End-to-end `tests/e2e/` (specs and support) | 20 | 3010 | 30 |
| Documents, agent setup, `vitest.config.mts` | 15 | 876 | 16 |

**Verdict: confirmed, with two precisions.**
- The figure is reproduced by added test lines against added `src/` lines: (2505 + 340 + 3010) / 1703 = 5855 / 1703 = **3.44**. Counting the schema and migration as production gives 5855 / 1795 = 3.26.
- It compares added lines only. The net production change was negative (src 1703 - 3211 = -1508 lines, mostly the sample data and `src/mocks/` removed: `git diff --shortstat 1a9e0c6 98ac3a7 -- src/mocks` is 1251 deletions), while tests grew by 5855 - 477 = 5378 lines.
- Half of that test code is end-to-end: 3010 of 5855 added lines (51 %). Without it the ratio is 2845 / 1703 = 1.67.

The "about six hours" of the same sentence is not part of FR-11 and git cannot measure it; for reference, the first task commit of 004 is at 17:50 and the closing commit at 22:59 of 2026-11-17 (`git log --format='%h %ad %s' --date=iso 1a9e0c6..98ac3a7`), with the spec, plan and tasks written on 2026-11-12.

### 1.7 What the numbers say

1. **Test code is twice the production code (2.2), and a third of it is end-to-end.** E2E specs and their support are 6172 lines (32 %) for 208 cases; Vitest has 1800 cases in 10794 lines. In spec 004, the last one built, E2E was half of the new test code.
2. **The backend has about 2.4 test lines per production line and is almost at 100 %.** CORE is covered; the open question there is not coverage but whether many tests repeat each other, which is the job of the audit (T11 to T14) and 005b, not of this document.
3. **The database tests are a quarter of the cases and almost all of the Vitest time.** 485 cases take about 55 s (one file at a time, over the shared test database), against about 6 s for 1315 unit and lint cases. The universes use cases (UNI-3) and the Server Actions get their coverage there.
4. **The interactive UI is covered only through the browser.** 7 IMPORTANT entries have 0 % in Vitest; their behavior is protected only by end-to-end tests, which are the slowest type (76 s with 8 workers, about 499 s of test time) and the only one that needs a production build.
5. **Some end-to-end files test rules a lower level already proves.** `access.spec.ts` has 40 cases, while the page access policy and guard it exercises (ACC-2, SHR-5) are at 100 % by unit tests. Whether they repeat each other or prove something only a browser can show (redirects of real requests, headers, the proxy matcher) is decided per group in the audit, not here.

## 2. Recommended distribution

The table says which test type protects each kind of component. It is read with the level of the component in the inventory. **The proportion between unit, integration and end-to-end tests is a consequence of applying it, not a quota:** no percentage of tests per type is set, and a type is not added to reach a share.

| Level | Layer or kind of component | Recommended test type | What the tests must protect | What they should not do | Supported by |
|---|---|---|---|---|---|
| CORE | Domain rules and value objects (ACC-1, ACC-2, SHR-4, `session-policy.ts`) | Unit, exhaustive | Every rule and branch, the boundaries of every input | Re-test the same rule through a use case or a page | 1.5: ACC-1 at 100/100 by unit alone; 1.4: unit is the cheapest type |
| CORE | Application use cases (ACC-3, UNI-3, SHR-2) | Unit with in-memory fakes that pass the shared contract tests in `tests/support/contracts/`, plus the database scenarios that prove owner isolation | The order of the rules, the acting user, the typed errors, owner isolation | Repeat every domain branch; run against PostgreSQL what a fake that satisfies the contract can prove | 1.5: UNI-3 gets 100 % only from the database project; 1.7 (3): those tests are the slow part |
| CORE | Infrastructure: repositories, authenticator, session reading, schema (ACC-4, UNI-4, SHR-1, CFG-3) | Integration against the test database | Owner scoping of every query, persistence, translation of storage failures into typed errors | Test each branch of a mapper twice, once by unit and once by integration | 1.5: ACC-4 and UNI-4 reach their figures in the database project |
| CORE | Presentation boundary: Server Actions, input schemas, error mapping, the page loader (APP-1, APP-2, SHR-3, CMP-6) | Integration through the action against the test database; unit for the shared mapper and parsers | Zod validation, the acting-user check, the mapped response, nothing internal exposed | Restate the use case's rules | 1.5: APP-1 and APP-2 at 0 % unit, 100 % database; SHR-3 100 % by unit |
| CORE | Composition and security configuration (ACC-5, UNI-5, CFG-2) | No test of their own: the integration tests run through them; CFG-2 keeps its structural test and browser checks | That the real wiring is the one the integration tests use; the security headers | Test the wiring itself | 1.5: ACC-5 and UNI-5 at 100 % from other tests; CFG-2 protected by named tests |
| IMPORTANT | Domain values and pure client logic: validators, reducers, interpreters, layout math (UNI-1, UNI-2, SHR-5, CMP-1, CMP-3, the reducers of CMP-7, CMP-11) | Unit | The behavior a person sees: the state that results, the message chosen | Assert private details or every literal text | 1.5: the 6 IMPORTANT entries at target are all of this kind |
| IMPORTANT | Interactive components, hooks and providers (APP-5, APP-6, CMP-2, CMP-4, CMP-5, CMP-7 provider, CMP-8, CMP-9, CMP-10) | Component test in the `component` project (`.test.tsx`), written when the component is touched | What the person can do and perceive: roles, labels, focus, the result of an interaction | Snapshot markup; repeat a reducer already unit-tested | 1.5: 7 entries at 0 % in Vitest; 1.7 (4) |
| IMPORTANT | Pages that compose Server Components, and the proxy (APP-3, APP-4) | The end-to-end journey that loads them; unit for logic extracted from them (the proxy body) | That the page is reached and shows what it composes | Test layout that a TIER 0 piece owns | 1.5: APP-4 at 0 % in Vitest, protected by named browser tests |
| Any | End-to-end | A small set of critical user journeys, plus what only a real browser can show (cookies, headers, redirects of real requests, 320 px layout, keyboard, a data store that cannot be reached) | That the pieces work together for the person | Repeat a rule or a message that a unit or integration test already proves | 1.3 and 1.6: E2E is 32 % of the test code and 51 % of spec 004's; 1.4: the slowest type; 1.7 (5) |
| TIER 0 | Types, `ui` primitives, empty states, messages, styles, configuration files, lockfile (ACC-6, UNI-6, SHR-7, APP-7, CMP-12, CMP-13, MSG-1, MSG-2, CFG-1, CFG-4) | None | - | Add tests to raise a percentage; incidental coverage is not a target | 1.2: 10 entries, 1700 lines; 1.5: no target |

Notes:
- Lint-rule tests (`tests/lint`) and test support are tooling, not production. The lint tests protect the architecture invariants of `CLAUDE.md` and stay unit tests; test support gets a test only when a wrong result in it would hide a failure (today only the test-database guard has one).
- The table applies to new tests from now on. Existing tests are not moved or removed because of it; each group is judged in the audit report and decided by the user at the 005b gate.
- A short version of this table goes into the architecture rule (task T15, FR-16 category (a)).

## 3. Evaluation of the optional tools

None of these tools is installed, configured or scripted by 005a (FR-11). Adding any of them is a dependency or tooling change that needs the user's approval (`CLAUDE.md`, ASK FIRST). Costs are estimated from the diagnosis above, not measured; package names are examples of the kind of tool and were not checked against the registry.

### 3.1 Mutation testing

- **What it is.** A tool (for TypeScript and Vitest, for example StrykerJS with its Vitest runner) changes the production code in small ways (a `<` for a `<=`, a condition removed, a returned value replaced) and runs the tests against each change. A change that no test notices points to an assertion that is too weak or to a branch that is run but never checked.
- **Benefit.** It answers the question that coverage cannot: CORE is already at or near 100 % (1.5), so coverage no longer tells strong tests from tests that only execute the code. On the CORE domain files (ACC-1, ACC-2, SHR-4, `session-policy.ts`) it would find the weak assertions the audit is looking for by hand, with evidence per line. It also gives 005b an objective check after removing tests: the mutations killed before and after must stay the same.
- **Cost.** At least two new development dependencies (the core and the Vitest runner) and a configuration file. Run time grows with the number of mutations times the tests that cover each one: acceptable on the unit project (1315 cases in about 6 s), not acceptable on the database project (485 cases in about 55 s, one file at a time over one shared database) or on end-to-end tests, which would have to be excluded.
- **Complexity.** Medium. The tool must be limited to a list of files and to the `unit` project; surviving mutants have to be read one by one, and some are equivalent (a change that cannot alter behavior), which takes judgment.
- **Recommendation: a one-off run, not a permanent step.** After the 005b cleanup, ask for approval to run it once on a few CORE domain files with the `unit` project only, and record the surviving mutants as findings. Do not add it to `pnpm test` or to any gate; reconsider a recurring run only if that first run finds weak assertions that the audit missed.

### 3.2 Extra static analysis of the tests

- **What it is.** ESLint plugins for test files (for example `@vitest/eslint-plugin` and `eslint-plugin-playwright`) with rules such as "a test has at least one assertion", "no focused or skipped test", "no conditional assertion" and "no identical test titles".
- **Benefit.** Small today. Skipped and focused tests are already caught: every Vitest and Playwright case passed with 0 skipped (1.4) and the verification gate forbids skipping. The rules would catch a test with no assertion, which the audit looks for by hand, and keep catching it in future specs without anyone reading the test.
- **Cost.** One or two new development dependencies, configuration in `eslint.config.mjs`, and a first pass over 138 test files (1.3) to fix or justify the hits, because `pnpm lint` fails on any warning. Plugin upgrades follow Vitest and Playwright versions.
- **Complexity.** Low to install, medium to tune: rules such as "expect in every test" misfire on tests whose assertions live in shared helpers (`tests/support/contracts/`, `tests/e2e/support/`) and need an allow-list of those helpers.
- **Recommendation: not now.** The gain over the audit and the review is small. Reconsider after 005b, picking only the assertion rules if the audit finds tests without real assertions, as a separate approved change.

### 3.3 Scripts that detect redundant tests

- **What it is.** A script that records the lines each single test covers (per-test coverage) and lists tests whose covered lines are a subset of another test's, or of tests of a lower type (for example an end-to-end case whose rule is fully covered by unit tests).
- **Benefit.** In theory it would point at the overlap of 1.7 (5), such as the 40 cases of `access.spec.ts` against the page access policy and guard at 100 % by unit tests.
- **Cost.** High for this project. Vitest coverage is per run, not per test, so it would need one run per test or a custom reporter (2008 cases; the database project alone takes about 55 s per full run), and end-to-end tests are not measured at all (1.4, plan 2.2), so the most expensive overlap would stay invisible. The output is noisy: two tests that cover the same lines can still check different behavior (a different input, a different assertion), so every hit needs a human verdict anyway.
- **Complexity.** High. A new script under `tests/support/` with its own maintenance and its own risk of wrong results, for a decision the user takes group by group.
- **Recommendation: do it by hand during the audit.** The audit report (T11 to T14) already judges each test group against the eleven criteria, including overlap with lower levels for the end-to-end specs, and the user decides at the 005b gate. Spec 005a's own decision D7 discarded per-test coverage for the same reason. Not to be built.

### 3.4 Mechanisms to keep the inventory current

- **What it is.** Whatever makes the inventory fail loudly when a production file is added, moved or deleted without its entry being updated (FR-4).
- **Already in place after 005a.**
  1. The rule: every plan and task shows the level that decided its tests, and the task that changes a production component updates its entry (FR-4; the level shown in the test design section of the plan and task templates, T17).
  2. The report of `pnpm test:coverage` prints the unmatched files, the files in two entries and the inventory patterns that match no file (D-T4-1), and the measured figures that refresh the `Protection` snapshots.
  3. Validation checks the reclassification (FR-2, added by T17), so `@reviewer` looks at the inventory once per spec.
- **Benefit of a further step.** Today the report only prints; nothing fails if a task forgets the inventory, and it runs only when someone runs `pnpm test:coverage`. A failing check (exit code other than 0 when a list is not empty) would make the forgotten entry impossible to miss.
- **Cost.** Small for the check itself: an option of the existing report script, no new dependency. The real cost is where it runs: `pnpm test:coverage` needs the local PostgreSQL and takes longer than `pnpm test`, and there is no continuous integration yet (no `.github/workflows`; OD-22 in `docs/open-decisions.md`).
- **Complexity.** Low for the check; the decision of when it runs depends on OD-22.
- **Recommendation: the rule plus the printed lists now; a failing check only after 005b.** Keep the inventory upkeep in the flow and the lists of the report as they are in 005a. Once 005b has cleaned the tests and turned on the coverage thresholds, propose turning the unmatched and duplicated lists into a failure of the same command, and run it in continuous integration when OD-22 is decided. The check that a pattern matches no file stays a warning, because a deleted file is not always a mistake until its entry is removed.
