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

## T2 - Return-destination rule and page-access policy (approved by the user at the T2 implementation gate, 2026-11-08)

Note (not a decision): the writing tool turned the escape sequences for U+2028 and U+2029 into literal characters inside a regular expression; the files were fixed back to escaped sequences.

### D-T2-1. The public-resource constants live in `return-destination.ts`

- **Decided:** `PUBLIC_RESOURCE_PATHS`, `isPublicResourcePath` and `MAXIMUM_RETURN_DESTINATION_LENGTH` are defined in `src/modules/accounts/domain/return-destination.ts`, next to `SIGN_IN_PATH` and `SIGN_UP_PATH`. `page-access-policy.ts` imports them from there.
- **Why:** no circular dependency and no third file, and one single definition of "public resource" shared by the return-destination rule and the access policy.
- **Discarded:** a third constants file.

### D-T2-2. Public resources are matched on a path-segment boundary

- **Decided:** `/_next/static` and `/_next/image` count only as the exact address or as what hangs below `/…/`; `/_next/staticfoo` is a workspace address; `/favicon.ico` is only the exact address. Consequence for T6: the matcher of `src/proxy.ts` must use the same boundary, because the usual pattern `/((?!_next/static|_next/image|favicon.ico).*)` would also exclude `/_next/staticfoo`; `tests/proxy.test.ts` must check that the matcher equals the policy.
- **Why:** a prefix match would serve without a session an address that is not a public resource.
- **Discarded:** prefix matching.

### D-T2-3. Shape of `decidePageAccess`

- **Decided:** the input is `{ pathname, search, method, isOperationCall, sessionState, returnToParameter }`; the policy classifies the pathname itself. The output is one of `pass`; `redirect{location}` (relative, the guard adds the 303); `rewrite{destinationPath}` to `SESSION_CHECK_FAILED_PATH = "/session-check-failed"`; `refuse-operation-call-signed-out` (the guard turns it into 401); `refuse-operation-call-check-failed` (503). The method is case-insensitive; a navigation is only GET or HEAD; on the sign-in and sign-up pages any other method always passes, also with a failed session check (as the plan table says).
- **Why:** one place classifies addresses, so the caller cannot pass a class that disagrees with the path.
- **Discarded:** letting the caller pass the address class.

### D-T2-4. Extra prudence rules in `resolveReturnDestination`

- **Decided:** beyond the literal list of FR-20, it also rejects U+2028, U+2029 and C1 control characters; it checks the raw and the once-decoded text and rejects controls and backslashes even when double-encoded (`%250a`); it compares the decoded, lower-cased path after resolving `.` and `..` segments and removing trailing or repeated slashes (so `/a/../sign-in`, `/%73ign-in` and `/sign-in//` are rejected); it detects a `returnTo` key in the query case-insensitively and in encoded form; an empty query (`/a?`) is returned as `/a`.
- **Why:** each is a way to reach the sign pages, a public resource or another site that the literal list would let through.
- **Discarded:** implementing only the literal list.

### D-T2-5. The address builders re-apply the rule

- **Decided:** `buildSignInAddress` and `buildSignUpAddress` pass the destination through `resolveReturnDestination` again: an unsafe destination produces the address without the parameter; for `/` they keep `?returnTo=%2F`, as the plan expects for T6; the function is idempotent for already-safe destinations.
- **Why:** an address with a return destination can never be built from an unsafe value, whoever calls the builder.
- **Discarded:** trusting the caller.
