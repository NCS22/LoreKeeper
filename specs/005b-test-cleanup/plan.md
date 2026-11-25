# Plan 005b — Test cleanup and coverage thresholds

Status: approved

Spec: `specs/005b-test-cleanup/spec.md` (approved 2026-11-24; FR-1..FR-12, NFR-1..NFR-4, user decisions D-1..D-8). Inputs: the audit report of 005a (frozen, not edited), `docs/criticality-inventory.md`, the skill `quality-testing-core`, the coverage script of 005a.

## 0. Approach in one paragraph

No production file changes (NFR-1). The work is: (1) apply the 18 approved groups, plus A-26 by D-2 and the strengthening of P-16 by D-3, each in its own unit of work with a fixed check procedure (section 7.1) that includes a coverage comparison by counts; (2) close the coverage gaps with a few small tests where they reach the target, an override for ACC-2 and UNI-4 (D-8) and for what stays uncovered in SHR-1, and a floor for every other IMPORTANT entry below target; (3) turn on the thresholds by extending the existing coverage script (it reads the inventory and sets a failing exit code), not by Vitest `thresholds`; (4) edit the instructions, flow rules, skill and inventory only in the closed list of FR-12. Records are written in the inventory before the thresholds are turned on, so the coverage command passes the moment it starts to fail on gaps.

## 1. Affected modules and layers

No module, layer or top-level folder is created or changed. `src/` is not touched.

| Area | What changes | FR |
|---|---|---|
| `tests/` (existing files of the 18 groups, A-26, the file of P-16) | Cases removed, merged or made exact, only as section 7.2 lists | FR-2..FR-6 |
| `tests/` (new files) | Two new test files for small tests (N-1, N-2, section 7.3); cases added to existing files of A-22, A-24, A-56 | FR-7, FR-8 |
| `tests/support/coverage/report-coverage-by-inventory-entry.mjs` | Reads floors and overrides from the renamed column `Exceptions and floors`, fails below the target, prints notices, fails on an unmatched or duplicated file | FR-10, FR-11 |
| `vitest.config.mts` | Only the comment that says "no coverage gate is active yet" is updated; no `thresholds` key is added | FR-10 |
| `docs/criticality-inventory.md` | Floors, overrides, snapshots, header text, rename of the column `Exceptions and gaps` to `Exceptions and floors` (the seven table headers and the two sentences of "How to read it" that name it), SHR-7 strategy, NP-5 at the end | FR-7..FR-9, FR-12 |
| `CLAUDE.md`, `.claude/rules/sdd.md`, `.claude/commands/sdd-validate.md`, `.claude/agents/reviewer.md` (only if it restates the validation checks), the skill, `docs/roadmap.md` | The closed list of FR-12 and nothing else | FR-12 |

Presentation, application, domain and infrastructure layers: none (no production change). The dependency direction is untouched.

## 2. Data

None. No entity, JSONB attribute, Prisma schema change or migration (NFR-1). The only "data" is the text format of two records in the inventory cell `Exceptions and floors` (section 7.4; the column is renamed, decision U4).

## 3. Use cases

None.

## 4. Contracts

None. No Server Action or Route Handler changes. (The command-line contract of `pnpm test:coverage` is in section 7.4.)

## 5. UI

None. The browser tests of A-88, A-93 and A-95 are trimmed, not the screens.

## 6. Spoiler impact

None. Tests and tooling only; no narrative information. The protected owner-isolation tests (29) are never weakened (FR-3, NFR-2); the spoiler suite does not exist yet.

## 7. Test design

No production component with behavior changes. The table lists the components whose tests change, with their inventory level (read from `docs/criticality-inventory.md`).

### 7.1 Check procedure applied to every group (FR-1, FR-6)

Before the group (FR-1): for each file of the group, `git hash-object <file>` cut to 12 characters is compared with the id in the group's row of the audit report; `git ls-files <folder of the group>` is compared with the files listed (added or removed). Protected tests inside a changed file are re-read against section C. Any difference: the group is not applied, it goes back to REVIEW in `decisions.md`, and the user is asked.

After the group (FR-6):
- (a) `pnpm typecheck`, `pnpm lint`, `pnpm test` green; the protected tests that run in the group's files pass (each listed in the group's row of 7.2).
- (b) Every behavior in the column "Behavior protected" of the audit row is mapped to at least one remaining test by name in the task record; the mapping is written before the removal.
- (c) Coverage: `pnpm test:coverage` is run once before the first group (baseline) and after each group. For every CORE and IMPORTANT entry named in the group's row, the combined covered and total counts for lines and branches (the report prints `covered/total`) are compared with the previous run; the covered count must not drop. Comparing counts also catches a drop smaller than one decimal. TIER 0 entries are not checked.
- (d) Browser groups (A-88, A-93, A-95): coverage does not measure them; `pnpm test:e2e` is run whole and passes, including the browser tests named as the kept protection.
- Any failure: the group is stopped, reverted by editing it back, and recorded as REVIEW.

The outcome (applied or skipped, and why) goes in the task of the group (FR-2).

### 7.2 The groups: what changes, criterion, protection kept

Criterion codes (FR-4): **E** = exact assertion instead of a weak one; **R** = removal only because a named test checks the same behavior (the task shows it by name); **W** = work count instead of wall clock; **N** = no new tool or configuration. Line numbers are those of the audit report; the task finds the test by name, because lines move.

| Group | Change | Criterion | Protection kept and how it is shown | Entries for 7.1(c) |
|---|---|---|---|---|
| A-08 `account-errors.test.ts` | The test "same message for both failures" asserts the exact fixed message with `toBe` and drops the comparison of two instances and the phrase regular expression | E (chosen over removing it, because an exact assertion is possible and the removal relies on a test that only compares the two failures with each other) | Kind and code tests of the file stay; `sign-in.test.ts:49` (A-02) still proves both credential failures are equal | ACC-1 |
| A-42 `universe-errors.test.ts` | Same change for the not-found message | E | Kind and code test stays; `remember-universe.test.ts` P-12 and `actions.test.ts` P-19 (protected, untouched) compare the real answers | UNI-3 |
| A-18 `validation-error.test.ts` | The three single-property tests fold into one whole-list comparison that includes a minimum and a maximum length; the `toContain("name")` becomes the exact message | E, then R for the folded cases (the whole-list case at line 11 checks every property they check, shown by listing them) | Stable code, domain error identity and order of issues stay | SHR-4 |
| A-72 `universe-issue-messages.test.ts` | The "not empty and not unknown" checks become one exact expected message per code (`en.universeCreation.issues` entry), including `nameInvalidCharacters` and `modeInvalid`; the loop that checks every vocabulary code keeps guarding the code list | E | Limits, fail-loud, unknown code and vocabulary-source tests stay; `interpret-universe-action-result.test.ts:56` (A-70) | CMP-3 |
| A-63 `force-layout.test.ts` | Drop the `elapsedPerTick < 16` assertion (the code exposes no work count: ticks are fixed by settings and none is reported before the first listener), keep the 300-node no-overlap assertion and rename the test so it no longer promises speed. The two drag tests stop waiting 600 ms and 200 ms: they wait for a number of `onTick` notifications (a count of work) | W for the drags; removal with a stated loss for speed ("a slow tick is no longer detected by any test; speed is not protected") | Same layout properties checked (no overlap, determinism, pull of neighbours, dragged node held until released, bigger radii); `releaseNode` and `restart` paths still run | CMP-11 |
| A-21 `prisma-client.test.ts` | Remove "accepts a connection" and "has the four authentication tables"; rename the describe of the schema cases so it says it is the schema | R: every database test empties the authentication tables first (`emptyAuthenticationTables`, A-82) and fails loudly if the connection or a table is missing; the task reads that helper and shows it | Schema constraints (UUID, time zone, unique email, email CHECK, cascades) and the two `getPrismaClient` tests stay | SHR-6 (CFG-3 is not measured; its named tests stay) |
| A-28 `get-acting-user.test.ts` | Remove the two restatements ("no session", "session cannot be checked"); keep the wiring test (line 20) and P-06 as it is | R: `require-acting-user.test.ts` lines 61 and 79 (A-15) prove the same two outcomes; the task reads both and compares | P-06 untouched (D-3); P-01 unchanged | SHR-2 |
| A-26 `server-error-logger.test.ts` (D-2, FR-5) | Remove the two runtime cases; keep the third (the three `@ts-expect-error` calls). The runtime `toHaveBeenCalledTimes(3)` stays with its spy (it keeps the three calls from printing); the type check is what protects | R for the two removed cases: `map-error-to-response.test.ts:128-155` (A-29) and `run-action.test.ts:73` (A-32) are run and read first | The compile-time pin that the log context cannot take a password or a body; the inventory entry SHR-7 records it (FR-12(e)). TIER 0: no coverage check | none (TIER 0) |
| A-14 `better-auth-account-authenticator.test.ts` | The "cause kept" test (line 573) and the one at line 224-235 assert the cause by identity or kind, as `better-auth-session-reader.test.ts:426` does, instead of `toBeDefined()` | E | The contract run (line 69) and every other case stay; this group is applied before A-17, A-19 and A-20 because they name its contract cases | ACC-4, SHR-1 |
| A-17 `session-policy.test.ts` | Delete the file (DELETE) | R: before deleting, the contract cases `account-authenticator-contract.ts:376-415` (through A-14), `read-session-for-guard.test.ts:125` and `:145` (A-22) and `tests/e2e/session-renewal.spec.ts` are run and pass; a temporary change of one constant (86 400 to 86 401 and 2 592 000 to 2 592 001, one at a time) is shown to make them fail, then reverted in the same step (decision U3: approved by the user as a transient touch of production that keeps nothing) | The 30-day lifetime and daily renewal | SHR-1 (`session-policy.ts` stays covered by import; the counts are compared) |
| A-19 `better-auth-instance.test.ts` | Remove the tests that read `$context.sessionConfig` and `$context.options` (lines 78-100); keep one behavior test that the stored user identifier is a UUID (sign up, read the stored id); add the message check to the "naming no value" test (line 182) as `server-environment.test.ts` does | R: lifetime and renewal by the contract cases `:376-415` (A-14); cookie cache off by the test at line 147 of the same file; sign-in after sign-up with no verification by contract `:168`. The cookie attribute tests (56-75, 130-152) stay | Cookie attributes, no session-data cookie, built-once instance, generic failure without environment | SHR-1 |
| A-20 `better-auth-session-reader.test.ts` | Remove the "no cookie" case at 113 and the invalid-session cases at 272, 288, 298 and 309; keep 278 (deleted from the database); the "cause kept" at 401 asserts the cause as line 426 does | R, one case at a time: each removed case is matched to its contract case (`account-authenticator-contract.ts:431`, `:443`, `:382`, `:451`) by reading both; a case with no match stays. E for the cause | P-02, P-03, P-04 untouched (FR-3); the forged-request and failure-mapping tests stay | SHR-1 |
| A-54 `sign-up/actions.test.ts` | In the block at lines 134-204, remove the 121-character, line-break and repeat-password cases and four of the five invalid emails; keep line 185 (every failing field together) and one invalid email | R: `account-display-name.test.ts`, `account-email.test.ts` and `new-account.test.ts` (A-06, A-07, A-10) prove the rules; line 185 proves the mapping to `fieldErrors` | Password kept out of every row, repeated email in another case, existing session | APP-1 |
| A-33 `create-universe.test.ts` | Remove the cases for 3 empty names, a name over the limit, a description over the limit and 4 invalid modes; keep the null character, lone surrogate, every failing field together and nothing stored or consumed on failure | R: `universe-name.test.ts:14` and `:35`, `universe-description.test.ts:30`, `universe-mode.test.ts:21` (A-45, A-41, A-44) | P-07 and P-08 untouched (FR-3); whole DTOs, stored order and owner stay | UNI-3, UNI-4 |
| A-35 `is-universe-name-in-use.test.ts` | Replace the four cases (case, accents, composed and decomposed, whitespace) by one case with a name that differs from the stored one in all four ways and expects `true` | R: `universe-name.test.ts:105-135` (A-45) checks `toComparableUniverseName` per difference; the one case keeps the wiring | P-09 untouched; empty name, no universes, owner scope stay | UNI-3, UNI-1 |
| A-48 `prisma-universe-repository.test.ts` | The "keeps the cause" test asserts the unique-constraint cause as line 127 does for reads; the three `rejects.toThrow()` cases (name and description limits, existing owner) assert the specific database error. The task first runs each case to see which error the database raises and writes that exact error (code or constraint); it is not guessed here | E | Line 12 (storage contract on PostgreSQL, carries P-22, P-23, P-24) is not touched; deleted-universe cases stay | UNI-4, CFG-3 (not measured) |
| A-93 `sign-in.spec.ts` | The six sign-ins for six unsafe destinations (lines 99-116) become one: the real redirect after a real sign-in with a foreign destination | R: the rule is proved by `return-destination.test.ts:144` (A-12) and the browser case that stays | Real form behavior (history, focus, single submission, lost connection, 30 seconds, no cookies) untouched | none measured; 7.1(d) |
| A-95 `sign-up.spec.ts` | The four unsafe destinations (173-182) become one; the five sign-ups for names (242-276) become one per distinct message (control characters, empty name) | R: A-12 and `account-display-name.test.ts` (A-06); one case per message keeps what the browser adds | The remaining form behavior untouched | 7.1(d) |
| A-88 `access.spec.ts` | The six sign-ins for six refused destinations (234-253) become one; the 12 method-by-address cases (94-117) become one address per method (4 cases); the case at line 212 is removed only if the task shows it checks the same as `sign-in.spec.ts:89` | R | Statuses, `location`, `no-store`, no `set-cookie`, static files, matcher, replayed operation, headers received stay (the content the report says the browser adds) | 7.1(d) |

Protected tests that live in or run through these groups (FR-3), none changed: P-02, P-03, P-04 (A-20); P-06 (A-28); P-07, P-08 (A-33); P-09 (A-35); P-22, P-23, P-24 run by A-48 and listed in A-81. P-01, P-05, P-10..P-15, P-17..P-21, P-25..P-29 are in KEEP groups not touched. The task of each group lists the protected tests of its files and runs them by name before and after.

**Order (FR-2, edge case on dependencies).** Independent unit groups first, then the groups that rely on A-14, then the universes, then the three browser groups.
1. A-08, A-42, A-18, A-72, A-63 (no dependency)
2. A-21, A-28, A-26 (A-26 relies on A-29 and A-32, which are KEEP and unchanged)
3. A-14, then A-17, A-19, A-20 (A-17, A-19 and A-20 name the contract cases that A-14 runs)
4. A-54, A-33, A-35, A-48 (rely on KEEP groups)
5. Strengthening of P-16 (7.3), in its own task, after A-48
6. Browser cycle: A-93, then A-95, then A-88. The three groups name each other. A-93 goes first and keeps its one sign-in case; A-95 second, keeping its one case; A-88 last, because its reason points to `sign-in.spec.ts` as the place where the same case also lives. Each file keeps one case, so no copy is the last one whichever way the cycle is read (FR-6(b)).

### 7.3 Added and strengthened tests (FR-3, FR-7, FR-8)

**P-16 (D-3), inside the file of A-47 (KEEP group).** The refused direct insert is kept first; it now asserts the specific database error (the foreign key violation: Prisma code `P2003` is expected with the PostgreSQL adapter; the task confirms the code by running the case once and writes the real one, or the constraint name or SQL state if the adapter reports it that way). It then checks that no row exists. After it, a control insert of the account's own universe is run in the same test and must be accepted (that proves the database would take a valid write, so the refusal came from the owner key). The control comes after the refused insert because the table keeps one row per account. It checks at least what it checked before. Verified green before (old test) and green after; P-15 and every other case of the file untouched.

**Gap-closing tests (small, behavior only, type chosen by the skill, section 4 of the skill).**

| Entry (level) | Test | File (mirrors `src/`) | Expected figures after (to be confirmed by the report) |
|---|---|---|---|
| CMP-7 (IMPORTANT) | Component test: the provider starts with the universe chosen by the server, the graph view and no creation form; actions dispatched through the hook change the state; the hook outside the provider fails loudly | New `tests/components/workspace/workspace-state.test.tsx` (new group N-1) | Today 72.0 / 87.5. Expected lines about 95-100, branches 100: reaches 80 in both, so the floor is not used |
| APP-3 (IMPORTANT) | Unit case in the existing proxy test: with the real guard and the real access policy and only the session reader replaced, a signed-out request for a page is redirected to sign-in and a signed-in request passes | Case added to `tests/proxy.test.ts` (stays in A-56) | Today 50.0 / -. Expected lines 100 |
| APP-6 (IMPORTANT) | Component test: activating the try-again button reloads the page | New `tests/app/session-check-failed/_components/try-again-button.test.tsx` (new group N-2) | Today 50.0 / -. Expected lines about 100 (the error page is already covered by A-52) |
| SHR-1 (CORE) | Database case: the exported `readSessionForGuard` (its own lazily built instance) answers signed-out without a cookie and signed-in with a real session cookie. Added to the file of A-22 | Case added to `tests/shared/infrastructure/read-session-for-guard.test.ts` | Closes lines 71-76 of `read-session-for-guard.ts` if the test environment can build the instance; otherwise those lines go to the override (7.5) |
| SHR-1 (CORE) | The scrypt failure path (lines 78-79): the task tries a stored hash that passes the parse limits but that scrypt refuses, and checks the result in the hasher test (stays in A-24) | Case added to `tests/shared/infrastructure/scrypt-password-hasher.test.ts` | Added only if some stored value reaches the failure by behavior. If none does (the parameters are checked before the callback), the lines stay in the override and no test is written. If the case shows that a stored value makes `verifyPasswordAsTyped` reject instead of answering `false`, that is a production finding (the doc comment promises it never throws): the task stops and reports it, because fixing it is outside this spec (NFR-1) |

Component tests clean up after each test explicitly (`afterEach(cleanup)`), because Vitest globals are off; they use only `@testing-library/react` and `@testing-library/dom`, both already approved. No new dependency.

**Entries that get a floor and not tests (FR-8), with the reason:**

| Entry | Why no small tests |
|---|---|
| APP-4 | Async Server Components; browser tests are the protection |
| APP-5, CMP-2, CMP-4, CMP-8, CMP-9 | Interactive screens: a test that reaches 80 % is a full component test, postponed by D-4 |
| CMP-5 | Three small components. A test of each could reach 80 % of lines, but the two defensive checks of `universe-empty-state.tsx` (focus target and live region both present) make the branch figure uncertain and no partial test is allowed, so it gets a floor (decision U1) |
| CMP-10 | `accessibility-control.tsx` is about half of the entry by size (182 of about 370 lines) and has no test; tests of the store, script and hook alone leave the entry near 50 % |
| CMP-11 | `resolve-css-color.ts` needs a browser canvas (a test in jsdom could only check the "no canvas" error, which would be artificial), so the entry cannot reach 80 % in lines; the five untaken branches of `force-layout.ts` (unknown id on drag, release and radii) are real behavior but alone do not bring the entry to 80 %; floor |

**ACC-2 and UNI-4 (D-8): no test.** **SHR-1: override only for what stays uncovered (FR-7).**

### 7.4 Threshold mechanism and its checks (FR-10, FR-11, D-5, D-7)

Where: `tests/support/coverage/report-coverage-by-inventory-entry.mjs`, run last by `pnpm test:coverage`. A non-zero exit code of the script fails the command; `pnpm test` is untouched. The script keeps printing everything first and sets the exit code at the end, so one run shows all failures.

Written forms in the cell `Exceptions and floors` (the column is renamed from `Exceptions and gaps`, decision U4; the script reads the column by its new name, in the same task that renames it, so the command never reads a missing column):
- Override: `override: lines <n>, branches <n>, reason: <text>` (as in 005a, both metrics, one decimal at most).
- Floor: `floor: lines <n>, branches <n>, plan: <text>`; only on an IMPORTANT entry, never on a CORE one (D-I5, P15); at least one metric; a metric that is not written keeps the policy target (or nothing to measure). The plan text of a floor is "raise it when the component is next touched" (or the reason it cannot be raised).
- At most one of the two per entry. Other text in the cell (`-`, `Not measured: ...`) contains neither token and is ignored.

Rules per entry (CORE and IMPORTANT only; TIER 0 excluded):
- Required figure of a metric = the override figure, else the floor figure (IMPORTANT entries only; a floor on a CORE entry is never applied, see "Malformed record"), else the policy target. The measured figure is the combined one, taken as printed: `Number(percent.toFixed(1))`. It fails if the printed measured figure is below the required one. A drop smaller than one decimal is not detected (accepted, FR-10).
- A metric with no elements (no branches) is "not applicable" and never fails. An entry with no measured file is printed as "not measured" and does not fail.
- Notice, no failure: the printed figure is above the override or floor figure of that metric (D-7). The notice names entry, metric, figure and the record.
- Failure lines carry the entry id, the metric, the measured figure and the required figure and its source (policy, floor or override).
- Malformed record (a cell with `override:` or `floor:` that does not match its form, an empty reason or plan, both tokens, a non-number, a floor on a CORE entry): failure that names the entry; a floor on a CORE entry is not applied (D-I5).
- FR-11: a production file with no entry or with two entries is a failure that names the file. The existing warning for a pattern that matches no file stays a warning. The header text of the script and its banner ("thresholds are not active") are rewritten. The comment in `vitest.config.mts` that says no gate is active is updated; no `thresholds` key is added.

Test design for this tooling (skill, tooling rule): the script is not a classified component and no CORE or IMPORTANT behavior changes through it, so it gets no permanent test (as in 005a FR-14). Verification is the set of temporary checks required by the completion criteria, done after the script task, each one reverted afterwards and the revert shown by `git diff --stat` (only the intended files differ). The checks re-run only the final script (the `coverage/` reports from the last full run are reused), so they are quick:
1. A CORE entry with an uncovered metric (temporarily mark an entry whose combined figure is below 100, for example CMP-1 branches, as CORE): failure with id, metric, figure and target.
2. An IMPORTANT entry below 80 (temporarily remove the floor of CMP-11): failure with the figures.
3. An entry with a floor that drops below it (temporarily raise a floor by 0.1 above its figure): failure.
4. A production file with no entry (a temporary untracked file under `src/`): failure that names it.
5. A production file in two entries (temporarily add its pattern to a second entry): failure that names it.
6. A malformed record, a record without reason, a floor without plan: failure that names the entry (three cases).
7. A floor and an override set 0.1 below the figure: notice printed, exit code 0.
8. `pnpm test` is run before and after the script task and shows the same result (no coverage dependency); `vitest.config.mts` has no `thresholds` key.
9. A floor on a CORE entry (temporarily write one on ACC-1): failure that names the entry, the floor not applied. Added after the plan was approved (D-I5) and already done, see the follow-up of T33 in the task list.

### 7.5 Overrides, floors and inventory updates (FR-7, FR-8, FR-9, FR-12)

- After all groups and the gap-closing tests, `pnpm test:coverage` is run once and the figures as printed are written (one decimal): ACC-2 override (`lines 100, branches 98.6` expected, reason of D-8 for the undecodable path); UNI-4 override (`lines 95.8, branches 87.5` expected, reason of D-8 for the unknown stored mode); SHR-1 override only if something stays uncovered, naming each path and why a test of it would be artificial (the lazy instance only runs in the server during the browser tests, if the test of 7.3 could not reach it; the scrypt failure path, if no stored value reaches it); a floor per IMPORTANT entry that did not reach 80 (floors only on IMPORTANT entries, never on CORE, D-I5; APP-4, APP-5, CMP-2, CMP-4, CMP-5, CMP-8, CMP-9, CMP-10, CMP-11), with the printed figure of each metric below target; and no record for CMP-7, APP-3 and APP-6 if they reach 80 in both metrics (if one does not after its tests, the tests are already written and the entry gets a floor; the task states this before writing them, with the expected figure above).
- The `gap:` records and the `none: gap` form of `Protection` disappear (FR-9); the dated `Protection` snapshots of the entries whose counts changed get the new date.
- Rename of the column (U4): in one task, `Exceptions and gaps` becomes `Exceptions and floors` in the seven table headers of the inventory, in the column description and the "Exceptions" bullet of "How to read it", in the "Exception" bullet of skill section 3 (it names the cell), and in the one place of the coverage script that reads the column by name. The script and the inventory change together, so no run reads a missing column. The task also searches the repository for any other mention (the only ones found today are those listed; the audit report of 005a is frozen and is not edited).
- Inventory header and skill (FR-12(d)): the "defined but not active" paragraphs, the `Gap` bullet, the reclassification sentence "records a gap ... fails nothing" (skill section 2), the reading of `pnpm test:coverage` (skill section 3), the exception definition and the "Exceptions" bullet of the inventory ("How to read it") are rewritten for overrides, floors and active thresholds; the inventory entry SHR-7 records the retained compile-time check (FR-12(e)).
- Instructions (FR-12(a), (b)): `CLAUDE.md` Verification gets a separate line "`pnpm test:coverage` passes (at the validation of a spec, not at each task)" and the Commands paragraph describes the command as failing below targets and on an unmatched or duplicated file; `sdd.md` Validation (and `.claude/commands/sdd-validate.md`, and `.claude/agents/reviewer.md` if it restates the checks) says the same and adds that no floor or override notice may remain (each raised to the new figure or removed when the target is reached). The task starts by searching those files for the verification list; nothing else in them changes.
- FR-12(c) (the "Current status" of `CLAUDE.md` and the Phase 1 row of `docs/roadmap.md`) is done in the closing step of the flow, not in a task, as `sdd.md` "Closing a spec" says.
- FR-12(f) and the source document: at the end, after the user confirms that 005a and 005b cover the content of `CALIDAD.md` (manual check), the user's file is deleted and `CALIDAD.md` is removed from the NP-5 row of the inventory. Without that confirmation nothing is deleted.

### 7.6 Groups of tests after the cleanup (NFR-4)

Every test file keeps the group of the audit report. New groups: **N-1** `tests/components/workspace/workspace-state.test.tsx` (CMP-7, component) and **N-2** `tests/app/session-check-failed/_components/try-again-button.test.tsx` (APP-6, component). Cases added to `tests/proxy.test.ts`, `read-session-for-guard.test.ts` and `scrypt-password-hasher.test.ts` stay in A-56, A-22 and A-24. Each task records the group it touches.

### 7.7 Evidence lines

The tasks change no production component, so none carries an `Evidence:` line (sdd.md, Tasks). The proof for each group is the check procedure of 7.1 recorded in the task; the new small tests are written for components that keep their behavior.

## 8. Decisions

- **P1. Group tasks, one per approved group, plus A-26 and P-16 as their own tasks.** Discarded: one task for all the REFACTOR groups of a folder (FR-2 asks for one unit of work per group, and a coverage comparison after each).
- **P2. Order as in 7.2** (dependencies first, browser cycle A-93, A-95, A-88). Discarded: report order of ids (A-14 would come after the groups that rely on it).
- **P3. The criterion of FR-4 is chosen per group in 7.2.** Where the report offers "exact assertion" or "remove", the exact assertion wins (A-08, A-42, A-14, A-20 cause, A-48), because the behavior stays checked. Where the report names another test that checks the same rule, removal is used and the task shows it (A-21, A-28, A-33, A-35, A-54, A-17, the browser cycle).
- **P4. A-63: the speed check is removed and not replaced.** The code exposes no count of work before the first listener, so no work measure exists without changing production; the plan states that speed is not protected. Discarded: a limit measured with the wall clock; a new benchmark suite (out of scope, no new tool).
- **P5. A-26 keeps the runtime spy and count with the three compile-time calls.** Discarded: wrapping the three calls in a function that never runs (the test would have no assertion and look empty); moving the check next to the type.
- **P6. Thresholds are enforced by the existing script, not by Vitest `thresholds`.** The 005a plan described generated per-glob thresholds, but Vitest merges neither the three projects as separate measures nor a floor, notices, one-decimal comparison, "not measured" or malformed-record failures. The script already reads the inventory and the combined figures. Discarded: Vitest per-glob thresholds (cannot express the written forms or the notice); a new Vitest reporter (more coupled to Vitest).
- **P7. One record per entry, written forms as in 7.4, in one column renamed `Exceptions and floors` (decision U4).** Discarded: separate columns for override and floor (more columns in every table for no gain); keeping the name `Exceptions and gaps` (it names a record that is no longer written).
- **P8. The records are written in the inventory before the script starts failing.** Discarded: script first (the command would fail between two tasks).
- **P9. Coverage compared by counts, with a baseline before the first group.** Discarded: comparing the printed percentages only (a one-line drop in a large entry can hide under one decimal).
- **P10. APP-3 gets a unit case with the session reader replaced, not a test in the database project.** The seam replaced is the reader, which has its own tests (A-22, A-23); the real guard and policy run. Discarded: moving the proxy test to the database project (needs a change in `vitest.config.mts` and the real environment) and a floor (cheap to close).
- **P11. CMP-10, CMP-11 and CMP-5 get floors, not partial tests** (7.3). The spec forbids partial tests.
- **P12. The coverage script gets no permanent test, only the temporary checks of 7.4.** Discarded: exporting its functions and testing them in `tests/lint` (a refactor of the script with no requirement behind it; the spec's completion criteria ask for temporary checks).
- **P13. `--passWithNoTests` stays in the `component` step of `test:coverage`** even though component tests now exist (decision U5, approved 2026-11-24). Discarded: removing it in the task of N-1.
- **P14. The `Protection` snapshot is refreshed by each group task only when its counts changed**, and once at the end for the entries with a record. Discarded: refreshing every entry on every task.
- **P15. No floors on CORE entries (D-I5, approved by the user on 2026-11-25 at the implementation gate after T34; the spec was aligned by `/sdd-change`).** A CORE entry below 100 % reaches it or records an override with its reason; a floor is allowed only on IMPORTANT entries, and the coverage script treats a floor on a CORE entry as a malformed record. Discarded: floors on CORE and IMPORTANT, as 7.4 first wrote them (a CORE component could stay below its target with only a plan to raise it); writing the rule only in the documents (the script would still apply a CORE floor and pass). Numbered P15 because P13 and P14 were already taken.

## 9. Coverage (FR and NFR to the parts of this plan)

| Requirement | Covered by |
|---|---|
| FR-1 | 7.1 (before the group), 7.2 task per group, `decisions.md` only if a group returns to REVIEW |
| FR-2 | 7.2 (groups, order), 7.3 (what else may change), 7.6; outcomes recorded in the tasks |
| FR-3 | 7.2 (protected tests listed per group), 7.3 (P-16 only) |
| FR-4 | 7.2 (criterion per group), decisions P3, P4 |
| FR-5 | 7.2 row A-26, decision P5 |
| FR-6 | 7.1 (a) to (d) |
| FR-7 | 7.3 (SHR-1 tests), 7.5 (ACC-2, UNI-4, SHR-1 overrides) |
| FR-8 | 7.3 (small tests with figures, floors with reasons), 7.5 |
| FR-9 | 7.2 (snapshots, P14), 7.5, decision P15 (no floor on CORE) |
| FR-10 | 7.4 (check 9), decision P15 |
| FR-11 | 7.4, 7.5 (the command passes at the end) |
| FR-12 | 7.5 (a), (b), (d), (e), (f); (c) in the closing step |
| NFR-1 | Section 1 (no `src/` change); A-17 temporary check reverted in the same step and never committed (U3) |
| NFR-2 | 7.2 (protected tests run by name before and after), 7.3 |
| NFR-3 | No size target; the reduction is reported in the closing summary |
| NFR-4 | 7.6 |

## 10. Order of work (input for the tasks, not the tasks)

1. Baseline: `pnpm test:coverage` before any change, figures kept in the task record.
2. Groups in the order of 7.2 (steps 1 to 6), each with the procedure of 7.1; P-16 after A-48.
3. Small tests for CMP-7, APP-3, APP-6 and the SHR-1 cases (7.3), each its own task.
4. Rename of the column to `Exceptions and floors` in the inventory, the skill and the script's lookup, in one task (U4); then the records in the inventory (ACC-2, UNI-4, SHR-1, floors) with the figures of one final run (7.5).
5. Script change and temporary checks (7.4); `pnpm test:coverage` passes on the repository.
6. Edits of the closed list (7.5: instructions, rules, commands and agents, skill, inventory header, SHR-7).
7. Validation, closing step (Current status and roadmap), and, after the user confirms, removal of `CALIDAD.md` and its NP-5 mention.

## Needs approval

None open. The five questions of the first draft were answered by the user on 2026-11-24 and are recorded below.

## Decisions of the user on the plan (2026-11-24)

- **U1. Small tests (FR-8).** Tests for CMP-7, APP-3, APP-6 and the SHR-1 case; floors for the other nine IMPORTANT entries (APP-4, APP-5, CMP-2, CMP-4, CMP-5, CMP-8, CMP-9, CMP-10, CMP-11); CMP-10 is not tested (the control is about half of the entry and has no test). Discarded: four tests for CMP-5 (branch figure uncertain, no partial tests); floors for all twelve.
- **U2. Toolchain of component tests.** If the first `.test.tsx` (N-1) needs a change in `vitest.config.mts`, the task stops and asks the user before touching it. Discarded: allowing a change limited to the `component` project.
- **U3. Proof for A-17.** A temporary change of the session-policy constants, reverted in the same step and never committed. The user accepts this transient touch of production as compatible with NFR-1 because nothing is kept; the final diff must show no change in `src/`. Discarded: only running the named tests.
- **U4. Column name.** The inventory column `Exceptions and gaps` is renamed `Exceptions and floors` (section 7.5 lists everything that names it, and the script reads the new name). Fit with the spec, recorded for the reviewer: FR-9 ends the "gap" record and FR-12(d) rewrites the definitions of exception and gap and the part of the inventory that explains how to read it, which is where the column is described; the rename of the table headers and of the script's lookup follows from that rewrite. The closed list of FR-12 does not name the table headers literally, so this is a reading of FR-12(d), not a literal one. If the reviewer or the user prefers the literal reading, the change goes through `/sdd-change`.
- **U5. `--passWithNoTests`.** Stays in `package.json`; the scripts do not change. Discarded: removing it in the task of N-1.
