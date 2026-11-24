# Decisions 005a — Quality testing strategy

Decisions taken after the plan was approved, not recorded in `plan.md`.

## D-T3-1. The empty `component` project passes through a script flag

- **Decided:** the `component` step of `test:coverage` runs with `--passWithNoTests`; the `unit` and `database` steps do not, so an empty run of those still fails. The flag can be removed once the first `.test.tsx` exists.
- **Why:** Vitest 5 does not accept `passWithNoTests` inside a project definition (the type check rejects it), and the plan only asked for "the setting that allows an empty project".
- **Discarded:** a global `passWithNoTests` in the Vitest configuration, because it would also let an empty `unit` or `database` run pass silently.
- **Approved by:** the user, 2026-11-20, at the T3 implementation gate.

## D-T4-1. The report script takes the production candidates from git and reads the "Not production" table

- **Decided:** the coverage report script lists the candidate files with `git ls-files --cached --others --exclude-standard` (read-only), keeping every file under `src/` except the generated Prisma client, every file under `prisma/` and every file at the repository root. The "Not production (not classified)" section of the inventory is a table with `Id`, `Files` and `Why it is not production`; the script reads its `Files` column too, so a root file classified there is neither unmatched nor counted as an entry. A file in a production entry and in that table is reported as duplicated.
- **Why:** plan 2.1 asks that each root file be listed either as production or as "not production", and the script's unmatched list is the check for NFR-3. Git keeps ignored files (`.env`, build output, `next-env.d.ts`) out of the list without reimplementing the ignore rules; untracked new files still appear, so a file added during a task is caught before its commit.
- **Discarded:** listing only the files of the coverage reports (would miss `prisma/`, `package.json` and `next.config.ts`, which plan 2.1 puts in the production set); a hard-coded list of root files in the script (goes stale; the inventory is the place where each root file is classified); walking the file system (would need the ignore rules).
- **Also added:** a list of inventory patterns that match no file, so a pattern left behind by a move or a deletion is visible (FR-4 upkeep). It fails nothing.
- **Note:** untracked files at the root that are not part of the project (today `CALIDAD.md`, a user file) also appear as unmatched until T5 lists them in the "Not production" table.
- **Approved by:** the user, 2026-11-23, at the T4 implementation gate.

## D-T5-1. The "Not production" table lists only files the report script can see

- **Decided:** the `Files` column of the "Not production (not classified)" table holds only root files and `prisma/migrations/migration_lock.toml`. The folders outside the production candidates (`tests/`, the generated Prisma client, `docs/`, `specs/`, `.claude/`, `.agents/`) are named in the paragraph above the table, not as patterns.
- **Why:** the script (D-T4-1) matches every pattern against the production candidates only (`src/` without the generated client, `prisma/`, the root) and lists any pattern that matches no file. A pattern such as `tests/**` would always appear in that list, and T5 is done only when it is empty.
- **Discarded:** listing those folders as patterns (a permanent false alarm in the report); changing the script to skip the patterns of that table (a change to T4's tooling outside this task).
- **Also decided:** `prisma/migrations/migration_lock.toml` is "Not production" (written by the Prisma CLI), and `tsconfig.json` is production TIER 0 (CFG-4, read by the build); the first is in the table with its reason, the second is listed under "Open judgment calls" of the inventory.
- **Approved by:** the user, 2026-11-23, at the T5 implementation gate.

## D-T6-1. The judgment calls of the inventory are closed and removed

- **Proposed and rejected:** keeping the calls settled by the level definitions in a "Resolved judgment calls" section of `docs/criticality-inventory.md`. Rejected by the user on 2026-11-23: the resolved and the decided calls are deleted from the inventory, and "Open judgment calls" says none is open.
- **Resolved by the definitions (kept as they are):** type-only files TIER 0 (ACC-6, UNI-6, types of SHR-7); `server-error-logger.ts` and `error-messages.ts` TIER 0; CMP-6 CORE; `presets.ts` TIER 0; `account-form-field.tsx` and `account-form-message.tsx` IMPORTANT; CFG-3 CORE.
- **Decided by the user (current levels kept):** ACC-2 CORE, SHR-4 CORE, SHR-6 IMPORTANT, CMP-3 IMPORTANT with no protected test, CMP-11 IMPORTANT, CMP-13 TIER 0, CFG-2 CORE, CFG-4 TIER 0 production, APP-4 IMPORTANT as one entry.
- **Approved by:** the user, 2026-11-23, at the T6 implementation gate.

## D-T7-1. The lockfile is left out of the volume ratios and the end-to-end report of T4 is reused

- **Decided:** `pnpm-lock.yaml` (production TIER 0, CFG-1) is reported on its own line of the production volume and left out of every ratio, because its 8171 lines are written by pnpm and would almost double the production figure. The Playwright figures come from the JSON report of the T4 run (2026-11-23) instead of a new `pnpm test:e2e`, because no file under `src/` or `tests/` changed after it (`git diff --stat 2c11c7a HEAD -- src tests` is empty); the Vitest reports were run again for this task. Section 3 of `testing-evaluation.md` is left as "Pending: task T8".
- **Why:** plan 2.3 defines the production volume as the production set of 2.1, which includes the lockfile, but does not say how to treat a generated file in a ratio.
- **Discarded:** counting the lockfile in the ratios (the ratio would describe pnpm, not the code); leaving it out silently (the figure would not match the inventory); a new end-to-end run (a build and 76 s for the same result).
- **Approved by:** the user, 2026-11-23, at the T7 and T8 implementation gate.

## D-T9-1. The skill lives only in `.claude/skills/quality-testing-core/`

- **Decided:** `quality-testing-core` is a real folder under `.claude/skills/` with a single copy; nothing is added to `.agents/skills/` or `skills-lock.json`. The checks of plan section 7 ("visible through both paths and the two git copies are identical") and of T10 ("any two skill copies are identical") read as "one copy".
- **Why:** `.agents/skills/` is the store of skills installed from a source and locked in `skills-lock.json`; `.claude/skills/frontend-design` is a junction to it, so "link" in `CLAUDE.md` means a link per installed skill, not a link of the whole folder. A skill written by the project has no source to lock.
- **Discarded:** a real folder in `.agents/skills/quality-testing-core/` with a junction from `.claude/skills/`, like `frontend-design` (puts a project-written skill in the installer's store without a lock entry).
- **Approved by:** the user, 2026-11-24, at the T9 implementation gate.

## D-T11-1. One test file per group in the audit

- **Decided:** each test file is its own group in `audit-report.md`, also when two files share an inventory entry (for example `require-acting-user.test.ts` and `get-acting-user.test.ts`, both SHR-2), because they protect different components and can deserve different verdicts.
- **Discarded:** one group per inventory entry (it would force one verdict on files of different quality).
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24 (the user asked for the recommended choice while away); approved by the user on 2026-11-24 at the validation gate.

## D-T11-2. A small redundancy next to strong checks keeps KEEP

- **Decided:** a single redundant or weak case next to strong assertions is noted in the `Reason` and the group stays KEEP; REFACTOR is used when a behavior promised by a test name has only weak checks, or when several tests repeat each other (as `assertion-quality.md` says: a weak line next to strong lines is not a defect).
- **Discarded:** REFACTOR for any weak line (it would flag almost every group and hide the real defects).
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24; approved by the user on 2026-11-24 at the validation gate.

## D-T11-3. The server error logger test is REVIEW, not DELETE

- **Decided:** A-26 (`tests/shared/infrastructure/server-error-logger.test.ts`, TIER 0) gets REVIEW: two of its cases are exercised elsewhere, but its `@ts-expect-error` case is the only check that the log context cannot take a password or a body. The missing information is whether the user wants that compile-time guard kept as a test.
- **Discarded:** DELETE (would lose that guard without the user's say).
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24; approved by the user on 2026-11-24 at the validation gate.

## D-T11-4. Doubtful protected tests are named as candidates

- **Decided:** tests that may be owner-isolation tests but are not clearly so are named in `Protected tests inside` as "candidate", and T13 confirms or drops each one individually in section C.
- **Discarded:** leaving them out until T13 (one could be forgotten).
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24; approved by the user on 2026-11-24 at the validation gate.

## D-T11-5. Type column for unit tests that run in the database project

- **Decided:** the tests of `scrypt-password-hasher`, `server-environment` and `server-error-logger` are typed "unit (runs in the database project because of its folder; it uses no database)", because `vitest.config.mts` sends all of `tests/shared/infrastructure/**` to the `database` project.
- **Discarded:** typing them as database-backed (false: they touch no database) or as plain unit (hides where they run).
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24; approved by the user on 2026-11-24 at the validation gate.

## D-T12-1. Test support is grouped by purpose

- **Decided:** the files of `tests/support/` form 8 groups (A-80 to A-87) and the end-to-end support files 3 groups (A-103 to A-105), each grouped by purpose and with one verdict that judges whether the support is correct and faithful (C6, C7).
- **Discarded:** one group per support file (44 groups with no assertions of their own, the same verdict repeated).
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24 (the user asked for the recommended choice while away); approved by the user on 2026-11-24 at the validation gate.

## D-T12-2. A contract and its fake share a group, and the protected tests of a contract live there

- **Decided:** each repository contract is in one group with its fake and its real adapter support (A-80 accounts, A-81 universes). The owner-isolation tests written in the universe repository contract are named in A-81; the groups that run the contract (A-34 on the fake, A-48 on PostgreSQL) say that they run them. Each protected test has one place.
- **Discarded:** naming the contract tests in every group that runs them (the same protected test in two or three rows).
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24; approved by the user on 2026-11-24 at the validation gate.

## D-T12-3. D-T11-5 also applies to universes and app files

- **Decided:** `fake-universe-storage.test.ts`, `universe-dto.test.ts` and `tests/app/error.test.ts` are typed as unit tests that run in the database project because of their folder, as D-T11-5 says.
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24; approved by the user on 2026-11-24 at the validation gate.

## D-T12-4. The coverage report script is audited as a tooling script

- **Decided:** `tests/support/coverage/report-coverage-by-inventory-entry.mjs` is group A-87 with type "tooling script" and KEEP; it has no test cases and carries none (FR-14).
- **Discarded:** leaving it out of the report (NFR-4 asks for every file under `tests/`).
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24; approved by the user on 2026-11-24 at the validation gate.

## D-T13-1. Which tests count as protected

- **Decided:** a test is protected when its failure would let one account read, list, change or remember data of another account, or choose the acting account from the request. Under this rule section C lists 29 tests (P-01 to P-29). Rejecting an unknown `userId` key at the input schema is input validation, not protection, because the account is never read from the input (P-06, P-17, P-18 and P-28 prove that). Isolation between devices of the same account, a tab's state after an account change in the same browser and how the user menu shows the account are not owner isolation either. They stay with their IMPORTANT or CORE components without making them CORE.
- **Discarded:** counting every test that mentions another account or an identifier key (it would turn CMP-3, CMP-4 and CMP-9 into CORE components and freeze input validation tests as untouchable).
- **Also done:** the `Why` cell of SHR-1 in `docs/criticality-inventory.md` now says "Contains protected tests", because P-02 to P-05 protect it (FR-10, as the other CORE entries with protected tests say). The A-31 note that called `parse-action-input.test.ts:117` a protected candidate was updated to the result of section C.
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24 (the user asked for the recommended choice while away); approved by the user on 2026-11-24 at the validation gate.

## D-T14-1. Test types are normalized in the summary counts

- **Decided:** section A of `audit-report.md` counts groups and files by type using the `Type` column of section B, with these variants merged and their group ids named in the report: the unit tests that run in the database project without using it (D-T11-5, D-T12-3) in one row; the database-backed tests run on the fake and on PostgreSQL in one row; the contract variants inside "test support". A-01 (a unit test that runs the shared contract on the fake) keeps a row of its own.
- **Discarded:** one row per exact wording of the `Type` column (rows of one group that make the summary hard to read); merging every variant into the five plain types (hides where each test runs).
- **Approved by:** taken by the main agent as the recommended option on 2026-11-24 (the user asked for the recommended choice while away); approved by the user on 2026-11-24 at the validation gate.

## D-V-1. A behavior protected only by a browser test can still record a coverage gap

- **Decided:** `SKILL.md` section 3 says that such a behavior is not an unprotected behavior (a behavior-keeping change needs no characterization tests), but that an entry whose measured coverage is below its target still records `gap:` with its plan, as `audit-report.md` section D already reads it. The inventory entries that record both (APP-4, APP-5, CMP-2, CMP-4, CMP-5, CMP-8, CMP-9) stay as they are.
- **Discarded:** removing those `gap:` records from the inventory and from section D of the audit report (005b would then see those entries as having no gap).
- **Approved by:** the user, 2026-11-24, at the validation gate (finding 1 of the reviewer).

## D-V-2. `app-menu-bar.tsx` stays TIER 0

- **Decided:** the menu bar stays in CMP-13 (TIER 0) although its "New universe" item skips returning focus to the menu so that focus stays in the creation form; the entry's responsibility now names that choice. No test is written for it.
- **Discarded:** moving it to an IMPORTANT entry of interactive components with a gap and "component tests when touched".
- **Approved by:** the user, 2026-11-24, at the validation gate (finding 2 of the reviewer, FR-2).
