# Tasks 005a — Quality testing strategy

Status: approved

Spec: `specs/005a-quality-testing/spec.md`. Plan: `specs/005a-quality-testing/plan.md` (approved).

Reading notes for the whole list:
- Test design (FR-17): no production component with behavior. FR-13 and FR-18 do not apply, so no task carries an evidence line. No task touches queries, visibility or reading progress, so none carries "Spoiler suite: required".
- "Tests:" says which verification replaces tests (NFR-1: no test of production code is added, changed or removed). "Baseline" means the lists of (file, test name, status) saved by T1 outside the repository; "same-result check" means repeating the Vitest and Playwright JSON runs and comparing them with that baseline.
- Tasks that edit instruction files (T15 to T20) first run the plan's markers (section 1.4) with Grep over `CLAUDE.md`, `.claude/rules/`, `.claude/commands/` and `.claude/agents/`, edit only the hits of their category and report any other hit without editing it (FR-16).
- Tasks that cover several areas or files group simple mechanical work of the same kind (sdd.md "Tasks"); each is still one verifiable result and one commit, and a task stops and asks the user if a step does not fit what its description says.
- The coverage report script under `tests/support/coverage/` is tooling and carries no test (FR-14).

## Measuring tools (NFR-1 first)

- [x] **T1. Capture the same-result baseline.** Before any change, with the local database up, run `vitest run --reporter=json` and the Playwright JSON reporter and save the (file, full test name, status) lists in the system temporary folder, outside the repository. NFR-1
  - Tests: none (no code); baseline of the existing suite.
  - Done when: both lists exist outside the repository, every listed test passes, and `git status` shows no change besides this checkbox.

- [x] **T2. Install and configure coverage.** Add the development dependency `@vitest/coverage-v8` at `^5.1.0` (same version as `vitest`, confirmed), `coverage/` in `.gitignore`, the `coverage` block of the Vitest configuration (V8, production `src/` included, generated and declaration files excluded, JSON reporter, no `thresholds`) and a `test:coverage` script that runs the `unit` and `database` projects one at a time. Stop and ask if `@vitejs/plugin-react` or any package beyond the approved one is needed. FR-7, FR-8
  - Tests: none (tooling); `pnpm typecheck`, `pnpm lint`, `pnpm test` and the same-result check against the baseline.
  - Done when: `pnpm test:coverage` leaves one JSON report per project and exits successfully, the configuration has no `thresholds` key, `onlyBuiltDependencies` is unchanged, and the same-result check equals the baseline.

- [x] **T3. Install the component-test tools and add the empty `component` project.** Add `jsdom`, `@testing-library/react` (range supporting React 19) and `@testing-library/dom` as development dependencies with the caret ranges read from the registry (`user-event` and `jest-dom` not installed), and a third Vitest project with `environment: jsdom` that includes only `tests/**/*.test.tsx`, also added to `test:coverage`. Stop and ask if `@vitejs/plugin-react` or any other package is needed for the JSX transform. FR-7, NFR-1
  - Tests: none (tooling); a throwaway `.test.tsx` outside the commit proves the JSX transform and is deleted; same-result check.
  - Done when: `vitest run` and `pnpm test:coverage` pass with the project empty, only the three approved packages are added, the throwaway file is not in the diff, and the same-result check equals the baseline.

## Inventory (docs/criticality-inventory.md)

- [ ] **T4. Create the inventory skeleton and the coverage report script.** The skeleton has the header (how to read it, levels by reference to the skill, targets 100/80/none on lines and branches, exceptions, authority order constitution > skill > inventory, thresholds defined but not active), empty tables per area with the agreed columns and the closing sections. The plain `.mjs` script, run at the end of `test:coverage`, reads the coverage JSON and the `Files` column and prints per entry lines and branches by test type and combined, level, target, distance, and unmatched or duplicated files. FR-3, FR-5, FR-7
  - Tests: none, tooling that protects no CORE or IMPORTANT component (FR-14); run on the empty inventory and on a throwaway entry.
  - Done when: `pnpm test:coverage` exits successfully, lists every production file as unmatched against the empty inventory, shows E2E as "not measured", and the throwaway entry is not committed.

- [ ] **T5. Fill the inventory tables of every area.** One row per component or cohesive group for accounts, universes, shared, app routes and proxy, components, messages and styles, configuration and schema (including the TIER 0 row for the development dependencies of the manifest and lockfile) and the "Not production" section, each with level, reason, strategy, dated measured snapshot and any exception or gap; owner-isolation components are CORE with "contains protected tests", and browser-only protections name their test. FR-1, FR-3, FR-4
  - Tests: none (document); the report script's unmatched and duplicate lists are empty, and two entries are cross-checked by hand against the raw JSON.
  - Done when: every production file matches exactly one entry, the two hand-checked figures equal the script output, and the manifest row is TIER 0 with no tests.

- [ ] **T6. Close the inventory.** Resolve or list each "Open judgment calls" item for the user, check the levels of the ten reference components (plan section 7) against what their files contain, swap and report any that contradicts its level, and refresh the dated snapshots from one full `pnpm test:coverage`. FR-2, FR-3, NFR-3
  - Tests: none (document); the one-off listing of production files against the inventory.
  - Done when: unmatched and duplicate lists are both empty, every reference component has its entry with a consistent level, and each swap is reported.

## Evaluation (testing-evaluation.md)

- [ ] **T7. Write the diagnosis and the recommended distribution.** Production and test volume by area and type, cases and runtime per type from the Vitest and Playwright JSON reports, the check of the "3.4 times" claim for spec 004 with `git diff --numstat`, and the table of recommended test types by criticality and layer (the proportion is a consequence, not a quota), with the method written so it can be repeated. FR-11
  - Tests: none (document); every figure is traceable to a command written next to it.
  - Done when: the file shows volumes, split by type, runtime, the verified or corrected 3.4 claim, and a distribution table whose rows the diagnosis supports.

- [ ] **T8. Evaluate the four optional tools.** Benefit, cost, complexity and recommendation for mutation testing, extra static analysis, redundancy-detection scripts and mechanisms to keep the inventory current; nothing is installed. FR-11
  - Tests: none (document); `git diff` shows no dependency or script added by this task.
  - Done when: the four tools each have benefit, cost, complexity and a recommendation.

## The skill (.claude/skills/quality-testing-core/)

- [ ] **T9. Create the skill `quality-testing-core` with `SKILL.md`.** Front matter and the ten sections (procedure; levels and reclassification; coverage targets and thresholds policy not active; behaviors and test type; useful versus coverage-only test; already covered; simplify or remove; way of working with the exact evidence line; inventory upkeep; checks before finishing), in about 250 lines. Check whether `.agents/skills` needs an identical copy; stop and ask if unclear. FR-12, FR-13, FR-14
  - Tests: none (document); front matter parses, the folder is visible through the skills paths, and a search finds the four evidence-line cases.
  - Done when: the ten sections exist, no entry is added to `skills-lock.json`, the copy question is settled and reported, and `SKILL.md` has about 250 lines or fewer.

- [ ] **T10. Write the three skill references and check the skill.** `assertion-quality.md` (weak-assertion criteria with examples from this repository), `test-type-strategies.md` (what each type protects, fake versus real) and `audit-and-removal.md` (verdicts, protected tests, proposal format, D-6 case, 005b re-check by blob ids); `SKILL.md` links all three. FR-6, FR-10, FR-12
  - Tests: none (document); each example names a real test and line, the strategies agree with the distribution of T7, and any two skill copies are identical.
  - Done when: the three files exist and are linked, each criterion has a weak and a strong example, and the re-check rule matches plan section 1.1.

## Audit report (audit-report.md)

- [ ] **T11. Create the audit report and audit the accounts and shared tests.** Header with the 005b re-check rule by blob ids, the groups table, the rule that a group verdict never applies to protected tests, and empty sections A to E; then groups (`A-01`...) with test files and short blob ids, inventory entries protected, type, one verdict and a reason by the eleven criteria for every test file of accounts and shared. FR-9
  - Tests: none (document); `git diff --name-status` shows nothing under `tests/`.
  - Done when: every test file under `tests/modules/accounts` and `tests/shared` is in exactly one group with one verdict and a reason.

- [ ] **T12. Audit the remaining test areas.** The same format for universes (noting groups that hold owner-isolation tests), app, components, styles, the proxy test, lint tests, test support (groups of their own) and the end-to-end specs and their support (checking overlap with lower levels). FR-9, FR-10
  - Tests: none (document); `git diff --name-status` shows nothing under `tests/`.
  - Done when: every other test file is in exactly one group with one verdict, and each group holding an owner-isolation test names it.

- [ ] **T13. Write the protected tests and coverage gaps sections.** Section C lists every owner-isolation test individually (file, describe and test name, line, what it proves, KEEP or REVIEW, "untouchable") with cross-references from the groups; section D lists CORE and IMPORTANT components without enough protection, with the inventory entry id. FR-10, FR-9
  - Tests: none (document); a search of `tests/` for cross-user cases is compared with section C, and section D with the gaps of the inventory.
  - Done when: no owner-isolation test is missing from C, none carries a verdict other than KEEP or REVIEW, and D matches the inventory gaps.

- [ ] **T14. Close the audit report.** Section A counts by verdict and type, section E decision sheet that only lists group ids (approval is the answer at the 005b gate), and the completeness check of every file under `tests/`. FR-9, NFR-4
  - Tests: none (document); `Glob tests/**` against the report, and blob ids recomputed with `git hash-object` equal the recorded ones.
  - Done when: no test file is unmatched or duplicated, the recorded blob ids equal the current ones, and `git diff` shows no change under `tests/` except the new coverage folder.

## Instruction and flow files (FR-16, closed list)

- [ ] **T15. Rules in `CLAUDE.md`, `sdd.md` and the architecture rule (categories a and b).** Rewrite the "tests with every change" sentences and the Commands row for coverage, with the pointer to the skill; update the architecture test table and `tests/` tree with the distribution of T7; and add "except a justified proposal approved by the user" to the NEVER rule for deleting or simplifying tests only (the wording is shown before the commit). FR-16, FR-15
  - Tests: none (document); search the three files for "tests with every change" and "new tests for the change", and `git diff -U0` shows the NEVER exception on tests only.
  - Done when: no old marker remains in the three files, the rewritten lines say CORE and IMPORTANT carry tests and TIER 0 none, and the other three NEVER prohibitions stay unconditional.

- [ ] **T16. Tests proportional to criticality in agents and commands (category a).** Rewrite the sentences about tests in the implementer, reviewer and planner definitions and in `sdd-implement`, `sdd-plan` and `sdd-tasks`, with the pointer to the skill inside them. FR-16
  - Tests: none (document); search those folders for "with its tests" and "none skipped or deleted".
  - Done when: no marker hit remains there and no standalone line was added.

- [ ] **T17. Templates and validation checks (categories c and d).** Add the test design section to the plan template and the evidence line to the task template in `sdd.md` and to their copies in `sdd-plan`, `sdd-tasks` and the planner definition, and add the FR-18 checks and the FR-2 reclassification check to Validation in `sdd.md`, `sdd-validate` and the reviewer's validation brief. FR-17, FR-18, FR-13
  - Tests: none (document); each copy compared with `sdd.md`, and the three validation files list the same checks.
  - Done when: all template copies equal `sdd.md` in wording, the three validation files list the same checks, and nothing else changed in them.

- [ ] **T18. Numbering with letters (category e).** Spec numbers shared by one context take consecutive letters and branches are `spec-` plus number, letter and name, in `sdd.md`, `git.md`, `sdd-spec`, the planner definition and any `argument-hint` that says digits only. FR-19
  - Tests: none (document); search for `spec-NNN` and "next free three-digit number".
  - Done when: no old numbering rule remains in those files and the example branch is `spec-005a-quality-testing`.

- [ ] **T19. Roadmap renumbering and the references to spec 005 (category f).** Phase 1 lists 005a and 005b before 006 (six specs) in `docs/roadmap.md` with the note and the "needs resolved first" column aligned; the lifecycle spec with the trash decision is 006 in the roadmap, in "Current status" of `CLAUDE.md`, in OD-6 of `docs/open-decisions.md` and in the two data-model lines; the two code comments stay as documented. FR-20
  - Tests: none (document); search those four files for "005".
  - Done when: every spec 005 reference reads 005a, 005b or 006 as decided, Phase 1 counts six specs, and no production file changed.

- [ ] **T20. Structure, Stack and the reference block in `CLAUDE.md` (categories g and h).** The Structure `.claude/` entry names `quality-testing-core`; the Stack gets the "Installed by spec 005a" bullet with the packages of T2 and T3 and the date, and the "`jsdom` and testing-library are not approved" sentence is updated (`@vitejs/plugin-react` stays not approved); and one Workflow block, 12 lines or fewer, points to the skill and the inventory with the plan's rules. FR-12, FR-7, NFR-2
  - Tests: none (document); `git diff -U0 CLAUDE.md` counts the added lines of the block, and the bullet matches the `package.json` ranges.
  - Done when: the block has 15 lines or fewer and links to files that exist, the bullet lists exactly the installed packages, and the skill is named in Structure.

## Final checks

- [ ] **T21. Review the closed list.** Review `git diff -U0` of every instruction file against categories (a) to (h) and search for `tests with every change`, `none deleted`, `spec-NNN` and spec 005 as the lifecycle spec. FR-16, FR-19, FR-20
  - Tests: none (document check); search results recorded in the validation report.
  - Done when: every changed hunk fits one category, no old marker remains, and only the two documented code comments mention spec 005.

- [ ] **T22. Final same-result check.** With the database up, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` and the same-result comparison against the baseline of T1, and confirm no `thresholds` key. NFR-1, FR-8
  - Tests: none (comparison of the suite with its own baseline).
  - Done when: every check is green, the two lists equal the baseline, and `git diff --name-status` shows under `tests/` only added files in `tests/support/coverage/`.

- [ ] **T23. Completion-criteria check.** The coordinator launches two independent read-only runs for each of the ten reference components (plan section 7), giving each only the skill, the inventory and the component path to answer the eight questions; the results are compared with each other and with the inventory entry and shown as a table to the user. FR-12
  - Tests: none (consistency check; no file created).
  - Done when: for the ten components both runs give the same level and test type and match the inventory entry, or each difference is listed for the user.
