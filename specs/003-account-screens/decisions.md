# Decisions - Spec 003 Account screens

Decisions taken after `plan.md` was approved, during implementation, that the plan did not record. Each one was reported by the implementer, shown to the user and approved by the user at the implementation gate of the task named in its heading.

## T1 - Playwright harness (approved by the user at the T1 implementation gate, 2026-11-08)

### D-T1-1. `@playwright/test` is pinned to 1.64.1 in the lockfile

- **Decided:** `package.json` keeps the specifier `^1.64.1` and `pnpm-lock.yaml` resolves it to 1.64.1, the same version as the `playwright` library that was already installed.
- **Why:** the first install resolved 1.65.0 and left two Playwright lines in the lockfile (`playwright` 1.64.x and `@playwright/test` 1.65.0). The plan asked for the same version line as the installed `playwright` (item 4).
- **Discarded:** letting 1.65.0 in. It would leave a version mismatch between `playwright` and `@playwright/test`.

### D-T1-2. `readTestDatabaseUrl()` exists in two places

- **Decided:** the copy in `vitest.config.mts` stays as it is, and a second copy lives in `tests/support/database/prepare-test-database.ts`; `playwright.config.ts` and the E2E helpers use the second one.
- **Why:** `vitest.config.mts` is not in the list of files T1 may edit (plan item 5 says it is not edited), so the shared helper could not replace its copy.
- **Discarded:** editing `vitest.config.mts` so it imports the shared function. That is outside the approved scope of the task. Removing the duplication can be done later with its own approval.

### D-T1-3. The Playwright `webServer` entries wait on `port`, not on `url`

- **Decided:** both servers (3100, healthy; 3101, unreachable data) are considered ready when a TCP connection to their port succeeds.
- **Why:** with `url`, Playwright treats a response other than a success as "server not ready". Once the guard exists, the unreachable-data server answers `503` or a redirect to some addresses, and Playwright would consider it down.
- **Discarded:** waiting on a URL.

### D-T1-4. The default export of `tests/support/database/global-setup.ts` is renamed `prepareTestDatabaseForVitest`

- **Decided:** the function that `vitest.config.mts` registers as global setup is now called `prepareTestDatabaseForVitest`; the shared helper keeps the name `prepareTestDatabase`.
- **Why:** after the helpers moved to `prepare-test-database.ts`, both functions would have the same name in the same file's imports. The registration in `vitest.config.mts` is by file path, so it is not affected.
- **Discarded:** keeping `prepareTestDatabase` for the vitest entry point and renaming the shared helper.

### D-T1-5. The forbidden identifiers of the NFR-8 structural test live in the test file

- **Decided:** the list of identifiers used to provoke failures in the E2E harness, which no file under `src/` may contain, is a constant inside `tests/lint/test-controls-absent.test.ts`. Every later task that adds such an identifier to the E2E harness adds it to that list in the same commit.
- **Why:** one place, next to the check that uses it, with no extra file.
- **Discarded:** a separate shared list file (YAGNI).
