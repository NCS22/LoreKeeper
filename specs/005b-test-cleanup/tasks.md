# Tasks 005b — Test cleanup and coverage thresholds

Status: approved

Spec: `specs/005b-test-cleanup/spec.md`. Plan: `specs/005b-test-cleanup/plan.md` (sections cited per task). Checkboxes are marked when the task is done and verified; the outcome of every group (applied or skipped, and why) is written under its task.

## Test design

No production component with behavior changes (NFR-1: `src/` is never touched; the temporary constant change of T11 is reverted in the same step and never committed, decision U3). The components below only have their tests changed; levels are those of `docs/criticality-inventory.md`.

- Common procedure of every group task (plan 7.1): before, hash and file list against the audit row (FR-1); after, `pnpm typecheck`, `pnpm lint`, `pnpm test` green, protected tests of the files pass by name, every "behavior protected" of the audit row mapped to a remaining test by name before the removal, and the combined covered/total counts of lines and branches of each CORE and IMPORTANT entry named in the task not lower than the previous run (T1 is the baseline). Browser groups: `pnpm test:e2e` whole. Any failure: the group is reverted and recorded as REVIEW.
- Groups and their entries: A-08 (ACC-1, CORE), A-42 and A-33 and A-35 (UNI-3, UNI-1, UNI-4), A-18 (SHR-4, CORE), A-72 (CMP-3), A-63 (CMP-11, IMPORTANT), A-21 (SHR-6, IMPORTANT), A-28 (SHR-2, CORE), A-26 (SHR-7, TIER 0: no coverage check, no tests added), A-14 (ACC-4, SHR-1, CORE), A-17 and A-19 and A-20 (SHR-1, CORE), A-54 (APP-1, CORE), A-48 (UNI-4, CORE; CFG-3 not measured), P-16 (inside the file of A-47). Test types stay as they are (unit, database, component); exact assertions (E), removal with a named equivalent (R), work counts instead of wall clock (W), no new tool (N).
- New small tests (plan 7.3): CMP-7 component test (new group N-1), APP-3 unit case in `tests/proxy.test.ts`, APP-6 component test (new group N-2), SHR-1 database case for `readSessionForGuard`, SHR-1 scrypt failure case (only if a stored value reaches it). Each is a test of behavior that does not change.
- Tooling (inventory records, coverage script, instruction edits): not classified components with behavior, no permanent tests; the script is verified by the temporary checks of plan 7.4 (T31), each reverted and shown by `git diff --stat`.
- Spoiler suite: not required by any task (no query, visibility or reading-progress change; the 29 protected owner-isolation tests are never weakened).
- Evidence lines: no task carries an `Evidence:` line because no production component changes; the proof of each group is the plan 7.1 procedure recorded in the task.
- Levels not stated above: UNI-3 is CORE and CMP-3 is IMPORTANT.

## Tasks

- [x] **T1. Baseline coverage.** FR-6
  - Tests: none; runs `pnpm test:coverage` once before any change and records the covered/total counts of lines and branches per entry in this task.
  - Done when: the counts of every CORE and IMPORTANT entry are written under the task and `git status` shows no file changed.
  - Baseline (2026-11-25, `pnpm test:coverage` before any change; unit 1315 tests in 55 files, database 485 tests in 25 files, component project found no `.test.tsx` file; 0 unmatched files, 0 duplicated, 0 stale patterns). Combined covered/total; `-` = nothing to measure.

    | Entry | Level | Lines | Branches |
    |---|---|---|---|
    | ACC-1 | CORE | 66/66 | 34/34 |
    | ACC-2 | CORE | 80/80 | 73/74 |
    | ACC-3 | CORE | 13/13 | 4/4 |
    | ACC-4 | CORE | 41/41 | 18/18 |
    | ACC-5 | CORE | 6/6 | - |
    | UNI-1 | IMPORTANT | 37/37 | 22/22 |
    | UNI-2 | IMPORTANT | 5/5 | 6/6 |
    | UNI-3 | CORE | 36/36 | 17/17 |
    | UNI-4 | CORE | 23/24 | 7/8 |
    | UNI-5 | CORE | 10/10 | - |
    | SHR-1 | CORE | 118/122 | 47/48 |
    | SHR-2 | CORE | 5/5 | 2/2 |
    | SHR-3 | CORE | 74/74 | 48/48 |
    | SHR-4 | CORE | 22/22 | 4/4 |
    | SHR-5 | IMPORTANT | 26/26 | 13/13 |
    | SHR-6 | IMPORTANT | 5/5 | - |
    | APP-1 | CORE | 22/22 | - |
    | APP-2 | CORE | 31/31 | 4/4 |
    | APP-3 | IMPORTANT | 1/2 | - |
    | APP-4 | IMPORTANT | 0/25 | 0/8 |
    | APP-5 | IMPORTANT | 0/86 | 0/40 |
    | APP-6 | IMPORTANT | 3/6 | - |
    | CMP-1 | IMPORTANT | 79/79 | 82/83 |
    | CMP-2 | IMPORTANT | 0/21 | 0/6 |
    | CMP-3 | IMPORTANT | 106/106 | 138/140 |
    | CMP-4 | IMPORTANT | 0/151 | 0/72 |
    | CMP-5 | IMPORTANT | 0/12 | 0/6 |
    | CMP-6 | CORE | 6/6 | 2/2 |
    | CMP-7 | IMPORTANT | 18/25 | 28/32 |
    | CMP-8 | IMPORTANT | 0/147 | 0/72 |
    | CMP-9 | IMPORTANT | 0/30 | 0/14 |
    | CMP-10 | IMPORTANT | 12/102 | 4/32 |
    | CMP-11 | IMPORTANT | 61/82 | 23/32 |
    | CFG-2 | CORE | not measured | not measured |
    | CFG-3 | CORE | not measured | not measured |

- [x] **T2. Group A-08: exact fixed message in `account-errors.test.ts`.** FR-1, FR-2, FR-4
  - Tests: the "same message for both failures" test asserts the exact message with `toBe` (criterion E); protected by `sign-in.test.ts` A-02.
  - Done when: procedure of plan 7.1 recorded (ACC-1 counts not lower than T1) and `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
  - Outcome (2026-11-25): applied, criterion E. In `account errors > InvalidCredentialsError has one fixed message that names neither the email nor the password` the comparison of two instances and the phrase regular expression were replaced by `toBe("The email or the password is incorrect.")`. Test name and the other two tests unchanged; no test removed (1800 tests before and after).
  - Before (FR-1): `git hash-object` of `tests/modules/accounts/domain/account-errors.test.ts` = `a9d5687237e5`, same as the audit row; `git ls-files tests/modules/accounts/domain` lists 8 files, each with the blob id the audit report records, none added or removed. Section C lists no protected test in this file.
  - After (a): `pnpm typecheck`, `pnpm lint` (0 warnings) and `pnpm test` (80 files, 1800 tests) green. Protected/kept by name: `sign-in.test.ts > signIn > answers a wrong password and an unknown email with the same error and starts no session` (A-02) passes, untouched.
  - After (b), behaviors of the audit row mapped to remaining tests: business rule violation with its code -> `account errors > EmailAlreadyRegisteredError is a business rule violation with its code`; authentication error with its code -> `account errors > InvalidCredentialsError is an authentication error with its code`; one message for both failures -> `account errors > InvalidCredentialsError has one fixed message that names neither the email nor the password` (now exact) and `signIn > answers a wrong password and an unknown email with the same error and starts no session` (A-02).
  - After (c), `pnpm test:coverage`: ACC-1 combined lines 66/66, branches 34/34 (T1: 66/66, 34/34); not lower.
- [x] **T3. Group A-42: exact not-found message in `universe-errors.test.ts`.** FR-1, FR-2, FR-4
  - Tests: same change as T2 for the not-found message (E); P-12 and P-19 untouched and run by name.
  - Done when: procedure of plan 7.1 recorded (UNI-3 counts not lower) and `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
  - Outcome (2026-11-25): applied, criterion E. In `UniverseNotFoundError > always has the same message, so a foreign and a missing universe look identical` the comparison of two new instances (`message` and `toEqual`) was replaced by `toBe("The universe was not found.")`. Test name and the kind and code test unchanged; no test removed (2 tests in the file before and after).
  - Before (FR-1): `git hash-object` of `tests/modules/universes/domain/universe-errors.test.ts` = `3602d35e3487`, same as the audit row; `git ls-files tests/modules/universes/domain` lists 7 files, each with the blob id the audit report records, none added or removed. Section C lists no protected test in this file (P-12 is in `remember-universe.test.ts`, P-19 in `tests/app/universes/actions.test.ts`, both untouched).
  - After (a), checks of D-I1: `pnpm typecheck` and `pnpm lint` (0 warnings) green; `pnpm vitest run` of `universe-errors.test.ts`, `remember-universe.test.ts` and `tests/app/universes/actions.test.ts`: 3 files, 56 tests passed. Protected by name: P-12 `rememberUniverse: fake storage` and `rememberUniverse: PostgreSQL storage > gives the same not found error for a foreign and for a nonexistent universe, storing nothing` pass; P-19 `rememberUniverseAction with a bad identifier (FR-30, FR-35) > answers the same not-found result for a foreign and for a nonexistent universe, logs each once and stores nothing` passes.
  - After (b), behaviors of the audit row mapped to remaining tests: not-found error with the not-found code -> `UniverseNotFoundError > is a not found error with the not found code`; one fixed message -> `UniverseNotFoundError > always has the same message, so a foreign and a missing universe look identical` (now exact), with the identical real answers in P-12 and P-19.
  - After (c), coverage: checkpoint after T18 (D-I1).
- [x] **T4. Group A-18: fold `validation-error.test.ts`.** FR-1, FR-2, FR-4
  - Tests: three single-property tests fold into the whole-list case with minimum and maximum length and an exact message (E, then R by listing the properties); code, identity and order tests stay.
  - Done when: procedure of plan 7.1 recorded (SHR-4 counts not lower) and `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
  - Outcome (2026-11-25): applied, criteria E then R. The shared issue list now has three issues: `name` (maximum 120 only), `password` (minimum 8 and maximum 128) and `mode` (no length). The whole-list case, renamed `ValidationError > keeps every issue with its details in the order it was given`, compares `error.issues` with `toEqual` against that list written out as literals (before, it compared the list with the same array it was built from). The three single-property tests `keeps the numeric detail of an issue`, `carries the minimum and the maximum length of an issue together` and `leaves the minimum length unset when the rule has none` were removed (R); `names the failing fields in its message` now asserts `toBe("Validation failed for: name, password, mode")` instead of two `toContain` (E). `has a stable code` and `is a domain error and a regular error with its own name` unchanged. Tests in the file: 7 before, 4 after.
  - Before (FR-1): `git hash-object` of `tests/shared/domain/validation-error.test.ts` = `e57c7cb1ddb7`, same as the audit row; `git ls-files tests/shared/domain` lists 3 files, each with the blob id the audit report records (`error-kinds.test.ts` `9f76c0f2429f`, `session-policy.test.ts` `5260716cea3f`), none added or removed. Section C lists no protected test in this file and the audit row names none.
  - After (a), checks of D-I1: `pnpm typecheck` and `pnpm lint` (0 warnings) green; `pnpm vitest run tests/shared/domain/validation-error.test.ts --reporter=verbose`: 1 file, 4 tests passed, each by name.
  - After (b), behaviors of the audit row mapped to remaining tests (written before the removal): keeps every issue with its details in order -> `ValidationError > keeps every issue with its details in the order it was given`, which checks every property the removed cases checked: maximum 120 on `name` (was `keeps the numeric detail`), no maximum on `mode` (same), minimum 8 and maximum 128 together on `password` (was `carries the minimum and the maximum length`), no minimum on `name` (was `leaves the minimum length unset`; `toEqual` fails if a defined value appears), plus field, code and order of all three; stable code `VALIDATION_ERROR` -> `ValidationError > has a stable code`; domain error with its own name -> `ValidationError > is a domain error and a regular error with its own name`; the message naming the failing fields -> `ValidationError > names the failing fields in its message` (now exact).
  - After (c), coverage: checkpoint after T18 (D-I1).
- [x] **T5. Group A-72: exact messages in `universe-issue-messages.test.ts`.** FR-1, FR-2, FR-4
  - Tests: one exact expected message per code instead of "not empty and not unknown" (E); the vocabulary-wide loop stays.
  - Done when: procedure of plan 7.1 recorded (CMP-3 counts not lower) and `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
  - Outcome (2026-11-25): applied, criterion E. In `getUniverseIssueMessage > maps %s to its own message` each case now carries its expected `en.universeCreation.issues` entry (`NAME_REQUIRED`, `NAME_INVALID_CHARACTERS`, `DESCRIPTION_INVALID_CHARACTERS`, `MODE_INVALID`, four different texts) and asserts it with `toBe`, instead of `not.toBe("")` and `not.toBe(UNKNOWN)`; two codes swapping messages now fail. The loop `has its own message for every issue code the vocabulary exports` is unchanged and keeps guarding the code list. The `toThrow()` without a message (line 54, "small" in the audit row) is not in the plan row and was left as it is. Test names unchanged; no test removed (11 tests in the file before and after).
  - Before (FR-1): `git hash-object` of `tests/components/universes/universe-issue-messages.test.ts` = `d5dbd79d460c`, same as the audit row; `git ls-files tests/components/universes` lists 7 files, each with the blob id the audit report records (A-66 to A-72), none added or removed. The audit row names no protected test and section C lists none in this file; the plan row names `interpret-universe-action-result.test.ts:56` (A-70) as kept, untouched.
  - After (a), checks of D-I1: `pnpm typecheck` and `pnpm lint` (0 warnings) green; `pnpm vitest run` of `universe-issue-messages.test.ts` and `interpret-universe-action-result.test.ts`, verbose: 2 files, 53 tests passed (11 and 42). Kept by name: `interpretCreateUniverseResult > gives each rejected field its own message and ignores fields it does not know` (A-70) passes.
  - After (b), behaviors of the audit row mapped to remaining tests: each issue code has its own message -> `getUniverseIssueMessage > maps %s to its own message` (four cases, now exact), with `NAME_TOO_LONG` and `DESCRIPTION_INVALID_CHARACTERS` also exact in A-70; length messages state the limit of the issue -> `states the limit of the issue for %s, not a limit written in the UI` and `gives name and description different messages for the same kind of failure`; a missing limit fails loudly -> `fails loudly when a length issue carries no limit, instead of showing a made-up number`; unknown codes get the generic message -> `falls back to a generic message for a code it does not know`; the codes come from the vocabulary -> `reads the codes from the vocabulary it is given, not from constants of its own` and `has its own message for every issue code the vocabulary exports`.
  - After (c), coverage: checkpoint after T18 (D-I1).
- [ ] **T6. Group A-63: remove the wall clock from `force-layout.test.ts`.** FR-1, FR-2, FR-4
  - Tests: drop the `elapsedPerTick < 16` assertion and rename the test so it no longer promises speed (stated loss); the two drag tests wait for a count of `onTick` notifications (W).
  - Done when: procedure of plan 7.1 recorded (CMP-11 counts not lower), the task states that speed is no longer protected, and the three gates are green.
- [ ] **T7. Group A-21: trim `prisma-client.test.ts`.** FR-1, FR-2, FR-4
  - Tests: remove "accepts a connection" and "has the four authentication tables" after reading `emptyAuthenticationTables` (R); rename the schema describe.
  - Done when: procedure of plan 7.1 recorded (SHR-6 counts not lower) and the three gates green.
- [ ] **T8. Group A-28: remove the two restatements in `get-acting-user.test.ts`.** FR-1, FR-2, FR-3
  - Tests: remove "no session" and "session cannot be checked" after reading `require-acting-user.test.ts` lines 61 and 79 (R); the wiring test and P-06 untouched and run by name.
  - Done when: procedure of plan 7.1 recorded (SHR-2 counts not lower) and the three gates green.
- [ ] **T9. Group A-26 (D-2): keep only the compile-time case in `server-error-logger.test.ts`.** FR-1, FR-2, FR-5
  - Tests: remove the two runtime cases after running and reading `map-error-to-response.test.ts` (A-29) and `run-action.test.ts` (A-32); the three `@ts-expect-error` calls and the spy stay.
  - Done when: the named tests pass, `pnpm typecheck` still proves the pin, `pnpm lint` and `pnpm test` green (TIER 0: no coverage check, no tests added).

- [ ] **T10. Group A-14: exact cause assertions in `better-auth-account-authenticator.test.ts`.** FR-1, FR-2, FR-4
  - Tests: the "cause kept" test and the one at lines 224-235 assert the cause by identity or kind instead of `toBeDefined()` (E); the contract run untouched.
  - Done when: procedure of plan 7.1 recorded (ACC-4, SHR-1 counts not lower) and the three gates green.
- [ ] **T11. Group A-17: delete `session-policy.test.ts`.** FR-1, FR-2, NFR-1
  - Tests: before deleting, the contract cases through A-14, `read-session-for-guard.test.ts` and `session-renewal.spec.ts` pass; each constant is changed by one unit temporarily to show they fail, then reverted in the same step (U3).
  - Done when: procedure of plan 7.1 recorded (SHR-1 counts not lower), `git diff --stat` shows no change in `src/`, and the three gates green.
- [ ] **T12. Group A-19: trim `better-auth-instance.test.ts`.** FR-1, FR-2, FR-4
  - Tests: remove the `$context` readings (lines 78-100), keep one behavior test that the stored user id is a UUID, add the message check to the "naming no value" test (R, E).
  - Done when: procedure of plan 7.1 recorded (SHR-1 counts not lower) and the three gates green.
- [ ] **T13. Group A-20: trim `better-auth-session-reader.test.ts`.** FR-1, FR-2, FR-3
  - Tests: remove the "no cookie" and the four invalid-session cases only where each matches a contract case by reading both; the "cause kept" test asserts the cause as line 426 does (R, E); P-02, P-03, P-04 untouched and run by name.
  - Done when: procedure of plan 7.1 recorded (SHR-1 counts not lower), each removed case shown with its match, and the three gates green.
- [ ] **T14. Group A-54: trim `sign-up/actions.test.ts`.** FR-1, FR-2, FR-4
  - Tests: remove the 121-character, line-break, repeat-password and four of five invalid-email cases, naming A-06, A-07 and A-10 tests (R); keep line 185 and one invalid email.
  - Done when: procedure of plan 7.1 recorded (APP-1 counts not lower) and the three gates green.
- [ ] **T15. Group A-33: trim `create-universe.test.ts`.** FR-1, FR-2, FR-3
  - Tests: remove the empty-name, over-limit and invalid-mode cases after matching them to A-45, A-41 and A-44 (R); P-07 and P-08 untouched and run by name.
  - Done when: procedure of plan 7.1 recorded (UNI-3, UNI-4 counts not lower) and the three gates green.
- [ ] **T16. Group A-35: one combined case in `is-universe-name-in-use.test.ts`.** FR-1, FR-2, FR-3
  - Tests: replace the four difference cases with one case differing in all four ways, matched to `universe-name.test.ts:105-135` (R); P-09 untouched and run by name.
  - Done when: procedure of plan 7.1 recorded (UNI-3, UNI-1 counts not lower) and the three gates green.
- [ ] **T17. Group A-48: specific errors in `prisma-universe-repository.test.ts`.** FR-1, FR-2, FR-3
  - Tests: run each case first to learn the real database error, then assert it in the "keeps the cause" test and the three `rejects.toThrow()` cases (E); line 12 and P-22, P-23, P-24 untouched.
  - Done when: procedure of plan 7.1 recorded (UNI-4 counts not lower) and the three gates green.
- [ ] **T18. Strengthen P-16 (D-3) in the file of A-47.** FR-3, FR-6
  - Tests: the refused direct insert asserts the specific database error and that no row exists, then a control insert of the account's own universe is accepted; P-15 and the other cases untouched. Verified green before and after.
  - Done when: the real error code is written in the task, procedure of plan 7.1 recorded and the three gates green.
- [ ] **T19. Group A-93: one unsafe-destination sign-in in `sign-in.spec.ts`.** FR-1, FR-2, FR-4
  - Tests: the six sign-ins for unsafe destinations become one real sign-in with a foreign destination (R, `return-destination.test.ts:144`); form behavior cases untouched.
  - Done when: `pnpm test:e2e` whole passes, including the kept browser tests (plan 7.1(d)), and the three gates green.
- [ ] **T20. Group A-95: trim `sign-up.spec.ts`.** FR-1, FR-2, FR-4
  - Tests: four unsafe destinations become one; five name sign-ups become one per distinct message (R, A-12 and A-06).
  - Done when: `pnpm test:e2e` whole passes and the three gates green.
- [ ] **T21. Group A-88: trim `access.spec.ts`.** FR-1, FR-2, FR-4
  - Tests: six refused-destination sign-ins become one, the 12 method-by-address cases become 4 (one address per method), the case at line 212 is removed only if shown equal to `sign-in.spec.ts:89` (R).
  - Done when: `pnpm test:e2e` whole passes (each of the three files keeps one case of the cycle) and the three gates green.
- [ ] **T22. Component test for CMP-7 (group N-1).** FR-7, FR-8
  - Tests: new `tests/components/workspace/workspace-state.test.tsx` (initial server-chosen universe, graph view, no creation form, actions through the hook, hook outside the provider fails loudly); stops and asks the user if `vitest.config.mts` needs a change (U2).
  - Done when: the test passes with `afterEach(cleanup)`, no config or dependency changed, and the combined CMP-7 figures are recorded (expected 80 or more in both).
- [ ] **T23. Unit case for APP-3 in `tests/proxy.test.ts`.** FR-8
  - Tests: with the real guard and policy and only the session reader replaced, a signed-out page request redirects to sign-in and a signed-in one passes.
  - Done when: the case passes and the APP-3 figures are recorded (expected 100 lines).
- [ ] **T24. Component test for APP-6 (group N-2).** FR-8
  - Tests: new `tests/app/session-check-failed/_components/try-again-button.test.tsx`: activating the button reloads the page.
  - Done when: the test passes with `afterEach(cleanup)` and the APP-6 figures are recorded (expected about 100 lines).
- [ ] **T25. Database case for `readSessionForGuard` (SHR-1).** FR-7
  - Tests: case added to `read-session-for-guard.test.ts`: signed-out without cookie, signed-in with a real session cookie, through the exported lazily built instance.
  - Done when: it passes and the task records whether lines 71-76 of the file are now covered; if the test environment cannot build the instance, the paths are noted for the override of T28 and no test is written.
- [ ] **T26. Scrypt failure case (SHR-1), only if reachable.** FR-7
  - Tests: case in `scrypt-password-hasher.test.ts` with a stored hash that passes the parse limits but that scrypt refuses; none is written if no stored value reaches lines 78-79.
  - Done when: the case passes, or the task records that no stored value reaches the lines (they go to the override of T28); if `verifyPasswordAsTyped` rejects instead of answering `false`, stop and report the production finding (NFR-1).
- [ ] **T27. Rename the column to `Exceptions and floors`.** FR-9, FR-12
  - Tests: none (tooling and docs); `pnpm test:coverage` runs and prints the same figures as before the task.
  - Done when: the seven table headers, the two sentences of "How to read it", the "Exception" bullet of skill section 3 and the script's lookup use the new name, a repository search finds no other mention (the audit report is frozen), and the coverage command still runs.

- [ ] **T28. Write the overrides in the inventory (ACC-2, UNI-4, SHR-1).** FR-7, FR-9
  - Tests: none; one final `pnpm test:coverage` run gives the figures written as printed, in the form `override: lines <n>, branches <n>, reason: <text>`.
  - Done when: ACC-2 and UNI-4 carry the D-8 reasons, SHR-1 carries an override only for what T25 and T26 left uncovered (each path and why a test would be artificial), and the `gap:` records of these entries are gone.

- [ ] **T29. Write the floors and refresh snapshots in the inventory.** FR-8, FR-9
  - Tests: none; figures come from the same run as T28.
  - Done when: each IMPORTANT entry below target (APP-4, APP-5, CMP-2, CMP-4, CMP-5, CMP-8, CMP-9, CMP-10, CMP-11, plus CMP-7, APP-3 or APP-6 if one fell short) has `floor: ..., plan: <text>`; every `gap:` record and `none: gap` form is gone; the `Protection` snapshots of entries whose counts changed carry the new date.

- [ ] **T30. Thresholds in the coverage script.** FR-10, FR-11
  - Tests: none permanent (decision P12); script reads overrides and floors, fails below the required figure, prints notices, fails on a malformed record and on a production file with no entry or two entries; `vitest.config.mts` only gets its comment updated, no `thresholds` key.
  - Done when: `pnpm test:coverage` passes on the repository, the banner and header text are rewritten, and `pnpm test` gives the same result as before the task.

- [ ] **T31. Temporary checks of the threshold script.** FR-10, FR-11
  - Tests: the eight temporary checks of plan 7.4, each shown failing or passing as expected and then reverted.
  - Done when: each check's result is written under the task and `git diff --stat` after the last revert shows no file changed (the commit holds only the checkbox and the record).

- [ ] **T32. Edits to the instructions and the flow (FR-12 a, b).** FR-12
  - Tests: none (docs); searched first for the verification lists.
  - Done when: `CLAUDE.md` Verification has the separate `pnpm test:coverage` line and the Commands paragraph describes the failing command; `sdd.md` Validation, `.claude/commands/sdd-validate.md` and, only if it restates the checks, `.claude/agents/reviewer.md` say the same and that no floor or override notice may remain; nothing else in them changes.

- [ ] **T33. Edits to the skill and the inventory header (FR-12 d, e).** FR-12
  - Tests: none (docs).
  - Done when: the "defined but not active" paragraphs, the `Gap` bullet, the reclassification sentence, the reading of `pnpm test:coverage` and the exception definition describe overrides, floors and active thresholds, and the SHR-7 entry records the retained compile-time check.

- [ ] **T34. Final check.** FR-11, NFR-1, NFR-2
  - Tests: none new; runs `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm test:coverage`.
  - Done when: all pass, no floor or override notice is printed, `git diff --stat main` shows no change in `src/`, and the 29 protected tests are listed as passing.

- [ ] **T35. Remove `CALIDAD.md` (only after the user confirms).** FR-12
  - Tests: none (docs); runs only after the user confirms that 005a and 005b cover its content; without it the task stays unchecked.
  - Done when: the user's file is deleted and `CALIDAD.md` is removed from the NP-5 row of the inventory.
