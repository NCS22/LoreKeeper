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

## T3 - Form building blocks and session confirmation (approved by the user at the T3 implementation gate, 2026-11-08)

### D-T3-1. `signed-out-action-response.ts` is created in T3, not in T6

- **Decided:** `src/shared/presentation/signed-out-action-response.ts` is created in T3. It holds the constants of both refusals (401 with the text "Signed out." and 503 with the text "The session could not be checked.") and the `text/plain` content type. T6 must reuse this file, not recreate it. The two texts are new; if T6 wants others, they change in this one place.
- **Why:** the result interpreter needs the exact text of the refusal (plan D5) and cannot depend on a file that does not exist yet.
- **Discarded:** creating it in T6 and duplicating the strings in the interpreter.

### D-T3-2. `build-account-form-vocabulary.ts` is a server-only file

- **Decided:** an extra file, `src/components/accounts/build-account-form-vocabulary.ts`, builds the codes and field names that the pages pass to the forms as props. It is the only file in `src/components/accounts/` that imports `@/modules/accounts`; a client component importing it would fail the build.
- **Why:** plan D13 requires the pages to pass codes and field names as props; T4 and T5 both need them, so they are built once (DRY).
- **Discarded:** each page building its own vocabulary.

### D-T3-3. Shape of the interpreter API

- **Decided:** `interpretAccountActionResult(operation, outcome, vocabulary)` takes the `TimeLimitedOutcome` (`answered`, `timed-out` or `rejected`) and returns `succeeded`, `already-signed-in`, `field-errors` (with `messagesByField`) or `message` (a general message). The "could not confirm", wrong-password (FR-7) and generic-failure cases all come out as `message`.
- **Why:** the forms only need to know whether to leave the page, show messages on fields, or show one general message.
- **Discarded:** a richer result type per failure kind.

### D-T3-4. A missing limit is never invented

- **Decided:** if a display-name-too-long or password-length issue arrives without its limits, the neutral message "This value is not valid." is shown, instead of throwing or writing a number.
- **Why:** the limits come from the account rules and the interface must not supply its own. The universes form throws in this case; here a render crash would be worse.
- **Discarded:** throwing.

### D-T3-5. A validation failure with no form field is a general message

- **Decided:** a `VALIDATION_ERROR` with no form field (cross-site, `request`, `input`, unexpected keys, malformed issues) yields the general message of FR-9. On sign-in only the email and password fields are shown.
- **Why:** FR-9 asks for one generic message when no field of the form is involved.
- **Discarded:** showing unknown field names.

### D-T3-6. `useAccountSubmission` does not release itself after a success

- **Decided:** the form calls `releaseSubmission()` on any failure and leaves the submission locked when it is going to leave the page (FR-12). The hook has no unit tests (no jsdom); its browser behavior is covered in T4 and T5.
- **Why:** a released control after a success would allow a second submission while the page is being left.
- **Discarded:** automatic release after any outcome.

### D-T3-7. Messages use ASCII "..." for the in-progress labels

- **Decided:** messages such as "Creating account..." use three ASCII dots, like the rest of `en.ts` (for example "Loading graph...").
- **Why:** consistency with the existing dictionary.
- **Discarded:** the single ellipsis character.

## T4 - Sign-in page and form (approved by the user at the T4 implementation gate, 2026-11-08)

### D-T4-1. A pure function decides what the session confirmation means

- **Decided:** a new function `interpretSessionConfirmation` in `src/components/accounts/interpret-session-confirmation.ts`, with a unit test of 9 cases, decides whether the session confirmation (FR-14, plan D7) means "session not kept". Only an explicit authentication error does. Sign-up reuses it in T5.
- **Why:** T3 did not create it. Without it the rule would live inside the form component, covered only by the browser tests, and T5 would duplicate it.
- **Discarded:** keeping the rule inside the form component.

### D-T4-2. No new identifier in the forbidden list of the NFR-8 structural test

- **Decided:** nothing was added to the list in `tests/lint/test-controls-absent.test.ts`. The new support helpers (`waitForFormHydration`, `isServerActionRequest`) provoke no failure, and `UNREACHABLE_DATA_SERVER_ADDRESS` is already covered by the substring `UNREACHABLE_DATA_SERVER`.
- **Why:** the list exists only for identifiers that provoke failures (decision D-T1-5).
- **Discarded:** adding the helpers to the list anyway.

### D-T4-3. The redirect of a signed-in person who opens `/sign-in` is not done in the page

- **Decided:** T4 does not redirect an already signed-in person who opens the sign-in page (FR-21, FR-22, the "opening the page" part). In T4 the guard is not on and the page works as a public page, as `tasks.md` says; the redirect belongs to the guard (T6) with its browser tests in T7. In T4, FR-22 is covered only for submitting the form from another tab.
- **Why:** doing it in the page would duplicate T6 and force the page to handle `InfrastructureError`.
- **Discarded:** a server-side redirect in the page itself.

### D-T4-4. How the browser test sends the cross-site header and strips the cookie

- **Decided:** Chromium ignores a `Sec-Fetch-Site` change made with `route.continue`, so the test performs the call itself with `route.fetch({ headers })` and answers with `route.fulfill`. The cookie-stripped case uses the same mechanism and calls `context.clearCookies()`, because `route.fetch` stores the cookies it receives in the browser context.
- **Why:** it is the only way found to deliver a cross-site request and a response without the session cookie to the page, as the spec's cases require.
- **Discarded:** `route.continue` with changed headers.

### D-T4-5. A retry after 30 s without an answer waits for the stuck request

- **Decided:** Server Action calls are queued in the Next.js client, so after 30 s without an answer a retry is not sent until the stuck request ends. The T4 browser test finishes the hanging request before it retries. The interface already warns "the session may still be open". Finding for T5 and T8, which have the same case.
- **Why:** it is how the installed client behaves; the 30 s limit (plan D16) cannot cancel the call.
- **Discarded:** not recorded.

### D-T4-6. The form has `method="post"` and named fields

- **Decided:** the form has `method="post"` and each field has a `name` attribute. If JavaScript had not loaded and the form were submitted natively, the password would go in the body and never in the URL.
- **Why:** it keeps the password out of the address, the history and the logs in that case.
- **Discarded:** no `method` or `name` attributes.

### D-T4-7. The link to sign-up does not prefetch

- **Decided:** the link to the sign-up page uses `next/link` with `prefetch={false}`.
- **Why:** not recorded.
- **Discarded:** the default prefetch.
