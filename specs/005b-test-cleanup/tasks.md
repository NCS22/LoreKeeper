# Tasks 005b — Test cleanup and coverage thresholds

Status: draft

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

- [ ] **T1. Baseline coverage.** FR-6
  - Tests: none; runs `pnpm test:coverage` once before any change and records the covered/total counts of lines and branches per entry in this task.
  - Done when: the counts of every CORE and IMPORTANT entry are written under the task and `git status` shows no file changed.

- [ ] **T2. Group A-08: exact fixed message in `account-errors.test.ts`.** FR-1, FR-2, FR-4
  - Tests: the "same message for both failures" test asserts the exact message with `toBe` (criterion E); protected by `sign-in.test.ts` A-02.
  - Done when: procedure of plan 7.1 recorded (ACC-1 counts not lower than T1) and `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
- [ ] **T3. Group A-42: exact not-found message in `universe-errors.test.ts`.** FR-1, FR-2, FR-4
  - Tests: same change as T2 for the not-found message (E); P-12 and P-19 untouched and run by name.
  - Done when: procedure of plan 7.1 recorded (UNI-3 counts not lower) and `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
- [ ] **T4. Group A-18: fold `validation-error.test.ts`.** FR-1, FR-2, FR-4
  - Tests: three single-property tests fold into the whole-list case with minimum and maximum length and an exact message (E, then R by listing the properties); code, identity and order tests stay.
  - Done when: procedure of plan 7.1 recorded (SHR-4 counts not lower) and `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
- [ ] **T5. Group A-72: exact messages in `universe-issue-messages.test.ts`.** FR-1, FR-2, FR-4
  - Tests: one exact expected message per code instead of "not empty and not unknown" (E); the vocabulary-wide loop stays.
  - Done when: procedure of plan 7.1 recorded (CMP-3 counts not lower) and `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
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
