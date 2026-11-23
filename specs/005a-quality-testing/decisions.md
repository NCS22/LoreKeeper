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
- **Approved by:** pending, at the T7 implementation gate.
