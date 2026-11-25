# Decisions 005b — Test cleanup and coverage thresholds

Decisions taken after the plan was approved. Design decisions of the plan stay in `plan.md` section 8.

## D-I1. Targeted test runs per task, full runs at checkpoints

- **Decided:** from T3 onwards, each task runs `pnpm typecheck`, `pnpm lint` and only the test files it changes plus the protected tests it names, instead of the whole `pnpm test` and `pnpm test:coverage` after every group (plan 7.1 (a) and (c)). The whole suite and the coverage comparison run at checkpoints: after T18 (`pnpm test` and `pnpm test:coverage`, every CORE and IMPORTANT entry compared with the T1 baseline counts) and after T21 (`pnpm test:e2e` whole, instead of after each of T19, T20 and T21). T22 to T26 record their figures from one coverage run after T26. T34 still runs everything.
- **Why:** the tasks change only tests, never `src/` (NFR-1), so a group cannot break files it does not touch; the user asked to shorten the wait. Tasks T2 to T17 only remove or tighten tests, so their covered counts can only stay or go down: if the T18 run is not lower than the baseline for any entry, no group lowered a count (FR-6). T18 only adds a control insert to a database test, so it cannot lower a count either. If one dropped, the groups that touch that entry are checked one by one and the one that caused it is reverted and recorded as REVIEW.
- **Discarded:** the full suite and coverage after every group, as plan 7.1 says (several minutes per task for a check that the checkpoints give with the same result).
- **Approved by:** the user, 2026-11-25, at the implementation gate after T2.
