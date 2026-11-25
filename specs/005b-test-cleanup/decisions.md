# Decisions 005b — Test cleanup and coverage thresholds

Decisions taken after the plan was approved. Design decisions of the plan stay in `plan.md` section 8.

## D-I1. Targeted test runs per task, full runs at checkpoints

- **Decided:** from T3 onwards, each task runs `pnpm typecheck`, `pnpm lint` and only the test files it changes plus the protected tests it names, instead of the whole `pnpm test` and `pnpm test:coverage` after every group (plan 7.1 (a) and (c)). The whole suite and the coverage comparison run at checkpoints: after T18 (`pnpm test` and `pnpm test:coverage`, every CORE and IMPORTANT entry compared with the T1 baseline counts) and after T21 (`pnpm test:e2e` whole, instead of after each of T19, T20 and T21). T22 to T26 record their figures from one coverage run after T26. T34 still runs everything.
- **Why:** the tasks change only tests, never `src/` (NFR-1), so a group cannot break files it does not touch; the user asked to shorten the wait. Tasks T2 to T17 only remove or tighten tests, so their covered counts can only stay or go down: if the T18 run is not lower than the baseline for any entry, no group lowered a count (FR-6). T18 only adds a control insert to a database test, so it cannot lower a count either. If one dropped, the groups that touch that entry are checked one by one and the one that caused it is reverted and recorded as REVIEW.
- **Discarded:** the full suite and coverage after every group, as plan 7.1 says (several minutes per task for a check that the checkpoints give with the same result).
- **Approved by:** the user, 2026-11-25, at the implementation gate after T2.

## D-I2. T21 keeps the malformed-encoding destination in `access.spec.ts`

- **Decided:** of the six refused-destination sign-ins of group A-88, the one kept is the malformed encoding (`returnTo=%E0%A4%A`), which lands on the workspace root.
- **Why:** the address of another site is already sent in the browser by `sign-in.spec.ts` (T19) and `sign-up.spec.ts` (T20); the malformed encoding is the only one of the six that no other browser file sends, and it goes through the framework's own reading of the query before `resolveReturnDestination`, which the unit tests do not cover.
- **Discarded:** keeping the address of another site here too (a third browser copy of the same case, losing the only browser check of a malformed encoding).
- **Approved by:** the user, 2026-11-25, after T21.

## D-I3. Component tests are type-checked; the T22 file is `workspace-state-provider.test.tsx`

- **Decided:** `tests/**/*.tsx` is added to the `include` of `tsconfig.json`, so `pnpm typecheck` checks component tests. The test of T22 is named `tests/components/workspace/workspace-state-provider.test.tsx` instead of `workspace-state.test.tsx` (the name in plan 7.3, 7.6 and T22).
- **Why:** the `include` only had `tests/**/*.ts`, so no `.test.tsx` was type-checked. Even with the pattern, TypeScript leaves out a `.tsx` file whose base name matches a `.ts` file in the same folder, and `workspace-state.test.ts` (the reducer unit test of the same source file) already exists. The new name says what the file proves: the provider and its hook.
- **Discarded:** leaving `tsconfig.json` as it was (component tests never type-checked); keeping the planned name (that file still left out); `workspace-state.component.test.tsx` (keeps the source name but adds a word the repository uses nowhere else).
- **Approved by:** the user, 2026-11-25, after T22.

## D-I4. The skill names floors in the coverage question of section 1

- **Decided:** row 2 of the table in section 1 of `.claude/skills/quality-testing-core/SKILL.md` reads "Target of the level on lines and branches, minus any override or floor in the entry". Nothing else in that table changes.
- **Why:** T33 introduced floors as the second record of the `Exceptions and floors` cell, and the report script lowers the required figure for both; the row only named overrides, so it no longer described what `pnpm test:coverage` requires.
- **Discarded:** leaving the row as it was (it would describe only one of the two records the script applies).
- **Approved by:** the user, 2026-11-25, at the implementation gate after T34.

## D-I5. Floors only on IMPORTANT entries, never on CORE

- **Decided:** a coverage floor is allowed only on IMPORTANT entries; overrides stay allowed on CORE and IMPORTANT. A CORE entry below 100 % reaches it or records an override with its reason. The rule is written in the `Floor` bullet of section 3 of the skill and in the "Exceptions" bullet of "How to read it" of `docs/criticality-inventory.md`. `tests/support/coverage/report-coverage-by-inventory-entry.mjs` treats a floor on a CORE entry as a malformed record: it names the entry (`<id>: malformed record in "Exceptions and floors": a CORE entry cannot record a floor ...`), does not apply the floor, and ends with a non-zero exit code after printing everything.
- **Why:** plan 7.4 put no level limit on floors and T33 wrote "a CORE or IMPORTANT entry" into the skill and the inventory, which let a CORE component (the rules that protect ownership, accounts and spoilers) sit below 100 % with only a plan to raise it some day. An override must say why a figure cannot be reached; a floor only says it has not been reached yet, which is acceptable for IMPORTANT but not for CORE. Today no CORE entry records a floor (the nine floors are all IMPORTANT), so nothing in the inventory changes.
- **Discarded:** floors on CORE and IMPORTANT, as plan 7.4 and T33 left them (CORE could stay below its target without a reason); writing the rule only in the documents (a CORE floor would still be applied by the script and pass).
- **Approved by:** the user, 2026-11-25, at the implementation gate after T34.

## D-I6. The coverage check fails on an unknown level and on a malformed entry table

- **Decided:** in every production entry table (a table with a `Files` column outside the "Not production (not classified)" section), `tests/support/coverage/report-coverage-by-inventory-entry.mjs` counts as a failure, with the other failures and a non-zero exit code after printing everything: (a) an entry whose level is not CORE, IMPORTANT or TIER 0, empty included (`<id> [<level>]: unknown level "<level>" in "Level", expected CORE, IMPORTANT or TIER 0`); (b) a table that lacks one of the columns `Id`, `Level`, `Files` and `Exceptions and floors` (`table of "<section>" (inventory line <n>): missing column "<column>"`); (c) a row with a different number of cells than its header (`<id>: the row (inventory line <n>) has <n> cells and its table header has <n> (an unescaped "|" in a cell shifts the columns)`). The header comment of the script lists the three failures. With the real inventory the output is identical to the one before the fix (exit code 0, `Coverage check passed.`).
- **Why:** finding 1 (MEDIUM) of the security audit at validation: before the fix an unknown or empty level only printed `target: unknown level` and passed, a misspelt `Level` header left every entry of its table unchecked, and an unescaped `|` shifted the columns with the same effect, so a CORE or IMPORTANT entry could escape its target without any failure.
- **Discarded:** keeping the printed note only (the check would still pass with entries nobody measures against a target); failing only on the level (a missing column or a shifted row would still be caught only indirectly, and the failure would not name the table or the row).
- **Not fixed:** findings 2 to 5 of the same audit were left as they are by the user's choice at the validation gate: no coverage reports at all still lets the check pass silently; a heading that starts with "Not production" excludes its entries from the check; a CORE override of 0/0 is accepted with any reason; the comparison rounds to one decimal, which on a very large CORE entry could hide an uncovered line (theoretical today).
- **Approved by:** the user, 2026-11-25, at the validation gate.
