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

## T5 - Sign-up page and form (approved by the user at the T5 implementation gate, 2026-11-08)

### D-T5-1. Several messages on one field cannot be reached through the real form

- **Decided:** the accounts engine (spec 002, not editable here) returns a single issue per field, by order of precedence, so a display name longer than 120 characters that also has a control character shows only the "not allowed" message. The browser test checks that real behavior. The case "all messages of a field together" stays covered by the unit test of `account-issue-messages` (T3).
- **Why:** spec 002 is out of scope for this feature.
- **Consequence to watch in validation:** the spec's edge case "a too long name with a line break: all its messages are shown" (FR-4, the edge cases and a completion criterion) cannot be demonstrated in a browser. The reviewer may flag it. The resolution is either accepting it or correcting the spec wording through `/sdd-change`.
- **Discarded:** changing the accounts engine to return several issues per field.

### D-T5-2. The sign-in to sign-up journey test reloads the page

- **Decided:** after a client navigation from sign-in to sign-up, the test calls `page.reload()` before typing.
- **Why:** with `cacheComponents`, Next keeps the previous page hidden in the document, so both forms are in the DOM and `getByLabel` finds two "Email" fields. It is a test matter only; the field ids do not clash. It is the same behavior that justified plan D6.
- **Discarded:** not recorded.

### D-T5-3. The shared helpers of the sign-in spec moved to a support file

- **Decided:** the three identical local helpers `findSessionCookieValue`, `interceptServerActionsOfPage` and `createGate` moved from `tests/e2e/sign-in.spec.ts` to `tests/e2e/support/account-form-support.ts`. No test and no behavior changed.
- **Why:** the sign-up spec needs the same helpers.
- **Discarded:** not recorded.

### D-T5-4. One new harness identifier in the NFR-8 list

- **Decided:** the only new harness identifier is `interceptServerActionsOfPage`; it was added to the forbidden list of `tests/lint/test-controls-absent.test.ts` (decision D-T1-5). Nothing in `src/` references test-only controls.
- **Why:** the helper intercepts and holds Server Action calls to provoke "no answer", so it is a failure-provoking control.
- **Discarded:** not recorded.

## T6 - Guard engine, proxy and the session-check-failed page (approved by the user at the T6 implementation gate, 2026-11-08)

### D-T6-1. First-step verification in the production build: plan D2 and D5 hold

- **Decided:** the checks asked by T6 step (a) were made in the production build and passed; no spec 002 file was touched.
  - D2: the Better Auth cookie plugin does not throw in the proxy scope. A GET with a session delayed by 1 day and 1 minute returned 200 with a single `Set-Cookie: better-auth.session_token=...; Max-Age=2592000; HttpOnly; SameSite=strict`; the browser stored it for 30 more days and the database moved `expiresAt` to 30 days ahead.
  - D5: an operation call without a session gets `401`, `text/plain`, `no-store`, body "Signed out."; the Next client throws `Error("Signed out.")`. On the 3101 server with a valid cookie it gets `503` with "The session could not be checked.". If the call were let through, the action response would re-render the page, which justifies refusing it. With renewal pending plus a sign-out, the `Set-Cookie` order is the renewed cookie first and then the deletions, so the browser ends with no cookie.
- **Why:** these were the reliances the plan declared unverified.
- **Discarded:** not applicable (the plan's fallback for D2 was not needed).

### D-T6-2. A proxy redirect does not have an empty body in Next.js 16.4.5

- **Decided:** Next ends the proxy redirect with `res.end(destination)`, so the body is only the destination address (for example `/sign-in?returnTo=%2F`), with no workspace text, which satisfies NFR-4. The unit test asserts an empty body for the response the guard produces; the browser test asserts that the network body is only that address. Next requires an absolute URL for a proxy redirect (a relative one gives 500 "Invalid URL"), so the guard uses `NextResponse.redirect(new URL(location, request.url), 303)`, which Next emits as a relative address.
- **Why:** it is how the installed Next.js behaves.
- **Discarded:** not recorded.

### D-T6-3. A proxy rewrite answers 200, not 503

- **Decided:** `NextResponse.rewrite(url, { status: 503 })` is not honored by the framework, so the status option was removed to avoid misleading code. The error page is served with 200 and `no-store`. The spec asks for no specific status.
- **Why:** plan section 4 allowed this outcome ("otherwise the page's own status").
- **Discarded:** keeping the ignored `status` option.

### D-T6-4. The guard uses its own Better Auth instance (important finding)

- **Decided:** the proxy is bundled separately from pages and actions, but they share `globalThis`. With the shared Better Auth instance (key `lorekeeper.betterAuthInstance`), the `instanceof APIError` check of the accounts engine failed and a wrong password was read as `INFRASTRUCTURE_ERROR` (4 sign-in browser tests failed). The fix: `src/shared/infrastructure/read-session-for-guard.ts` builds its own instance with the already exported `createBetterAuthInstance` and keeps it under another global key (`lorekeeper.guardBetterAuthInstance`). The Prisma client stays the only shared object, because nothing checks its error classes. This is not the "without the plugin" variant of plan D2 (the instance has the plugin) and no spec 002 file changed.
- **Why:** each bundle has its own copy of the library, so class identity checks fail across bundles when the instance is shared.
- **Discarded:** sharing the instance.

### D-T6-5. The Next.js testing helper has a different name in the installed version

- **Decided:** the installed Next exports `unstable_doesMiddlewareMatch`, while its docs for the same version say `unstable_doesProxyMatch`. The existing function is used in the test helper.
- **Why:** it is the one that exists.
- **Discarded:** not recorded.

### D-T6-6. The matcher of `src/proxy.ts`

- **Decided:** `/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$).*)`, with the path-segment boundary of decision D-T2-2. `/_next/staticfoo` goes through the guard. `tests/proxy.test.ts` checks that the matcher equals `classifyAddress` over a broad list of addresses.
- **Why:** the matcher and the policy must define the public resources in the same way.
- **Discarded:** the usual pattern without segment boundary (see D-T2-2).

### D-T6-7. Minor decisions of the guard

- **Decided:**
  - The guard defines structural types of the policy and of the reader locally, so it imports no module.
  - The `_rsc` query parameter is removed by chunk filtering, without rebuilding the query.
  - A repeated `returnTo` is treated as "no destination", like the page does.
  - A `%20` in the query leaves the destination as `+`: Next normalizes it before the guard, and it is equivalent in a query.
  - The text of the session-check-failed page is in a new group `sessionCheckFailed` of `src/messages/en.ts`.
  - No identifier was added to the NFR-8 forbidden list.
- **Why:** not recorded.
- **Discarded:** not recorded.

### D-T6-8. Existing browser tests changed because the guard is on

- **Decided:** in `tests/e2e/smoke.spec.ts` the `/` test on 3100 now checks that a browser without a session ends at `/sign-in?returnTo=%2F`, and the one on 3101 expects a 303 to that address with no workspace text (before: 200 with the workspace). The sign-in and sign-up specs pass unchanged.
- **Why:** the behavior the smoke test described (workspace open to anyone) is what this feature removes (legitimate change).
- **Discarded:** not recorded.

## T7 - The guard in the browser (approved by the user at the T7 implementation gate, 2026-11-08)

### D-T7-1. 404 responses carry a longer `Cache-Control` than the guard's exact `no-store`

- **Decided:** Next.js answers its not-found page with `private, no-cache, no-store, max-age=0, must-revalidate`. The test for an address that does not exist uses `toContain("no-store")`, while `/` and `/sign-in` are checked for the exact value the guard sets.
- **Why:** the not-found page is produced by the framework after the guard, with its own header.
- **Discarded:** forcing the exact value on the not-found page.

### D-T7-2. The `source` of the security headers repeats the proxy matcher

- **Decided:** the `source` pattern of `headers()` in `next.config.ts` repeats the regular expression of the proxy matcher (path-segment boundary exclusion of the public resources), with a comment saying so. At the T7 gate the user asked for a test that keeps the two equal; it is added right after T7 as its own small commit, and its entry will be added below when it lands.
- **Why:** the configuration file cannot import the matcher, because `src/proxy.ts` imports application modules.
- **Discarded:** importing the matcher into the configuration file.

### D-T7-3. The body of a redirect to a HEAD request may be empty

- **Decided:** for GET, POST, PUT and DELETE the body of the redirect is the destination address itself (decision D-T6-2); for HEAD it may be empty. The test accepts both forms and rejects anything else.
- **Why:** a response to HEAD has no body by definition.
- **Discarded:** not recorded.

### D-T7-4. Test that keeps `next.config` headers and the proxy matcher equal (decision 40)

- **Decided:** `tests/lint/next-config-headers.test.ts` (84 tests) evaluates the real `headers()` of `next.config.ts` and the proxy matcher, with the installed `unstable_doesMiddlewareMatch` helper, over 41 addresses. It proves that the headers are applied if and only if the proxy runs, and that both agree with `classifyAddress`. It is the test announced in D-T7-2.
- **Why:** decision D-T7-2 (the regular expression is duplicated in two files).
- **Limit:** it compares behavior with the proxy helper, not with Next's internal headers engine, so a change of that engine between versions would only be caught by the T7 browser check.
- **Discarded:** comparing the two patterns as strings, because a rewrite that behaves the same would break the test.
- **Approval:** the user, at the T7 implementation gate (2026-11-08).

## T8 - User menu, sign-out and clean start (approved by the user on 2026-11-09, by asking to continue the tasks of the spec after the T8 report)

### D-T8-1. A 503 in the user menu gives the FR-28 message

- **Decided:** the task brief said "503: generic message", but plan section 4 (`error-pages.spec.ts`) and FR-24 say that for a sign-out the FR-28 message applies ("could not confirm, the session may still be open"). The implementation follows the spec and the existing interpreter: a 503 is a thrown error and gives the FR-28 message. The generic message (FR-9) stays for a well-formed failure result, covered by the unit tests of the interpreter.
- **Why:** the spec and the plan are the requirement; the brief differed.
- **Discarded:** not recorded.
- **Approval:** the user, on 2026-11-09, by asking to continue the tasks of the spec after the T8 report.

### D-T8-2. The sign-out state lives in `UserMenu` and the panel is controlled

- **Decided:** if the panel is closed while the sign-out waits and the call fails, the panel reopens and focuses the message.
- **Why:** not recorded.
- **Discarded:** blocking the closing of the panel for up to 30 s.
- **Approval:** the user, on 2026-11-09, by asking to continue the tasks of the spec after the T8 report.

### D-T8-3. The placeholder of the menu is a disabled hidden button

- **Decided:** the fallback shown while the menu loads is a disabled button with `aria-hidden`, so there are not two "Account menu" buttons in the accessibility tree.
- **Why:** to avoid a duplicated control for assistive technologies.
- **Discarded:** not recorded.
- **Approval:** the user, on 2026-11-09, by asking to continue the tasks of the spec after the T8 report.

### D-T8-4. "A failed sign-in in another tab" is covered as "already signed in"

- **Decided:** with a session already created, sign-in answers "already signed in" before validating, so a real failure in another tab that has a workspace does not exist. The test covers "already signed in" in a tab of the same context. "A failed submission leaves the form as it is" is covered by `sign-in.spec` and `sign-up.spec`.
- **Why:** the case as written in the plan cannot happen with the engine's order of checks (002 FR-19).
- **Discarded:** not recorded.
- **Approval:** the user, on 2026-11-09, by asking to continue the tasks of the spec after the T8 report.

### D-T8-5. Hydration helper in the sign-out spec

- **Decided:** a click before React attaches does nothing, so the spec waits for `__reactProps$` on the menu trigger and on the "New universe" button, like `waitForFormHydration` does for the forms.
- **Why:** to avoid clicks lost before hydration.
- **Discarded:** not recorded.
- **Approval:** the user, on 2026-11-09, by asking to continue the tasks of the spec after the T8 report.

### D-T8-6. Unicode escapes in the spec file

- **Decided:** the writing tool and the shell turn escapes such as the right-to-left override into literal characters. Those literals were replaced by escapes with a Python script that builds the backslash with `chr(92)`; the file is ASCII only.
- **Why:** literal direction-control characters in source are invisible and fragile (same case as the note under T2).
- **Discarded:** not recorded.
- **Approval:** the user, on 2026-11-09, by asking to continue the tasks of the spec after the T8 report.

## T9 - Not-found page, error page and reduced top bar (approved by the user at the T9 implementation gate, 2026-11-09)

### D-T9-1. `error.tsx` uses `retry()` instead of `reset()`

- **Decided:** the error page calls `retry()`, not `reset()` as `tasks.md` T9 said. Approved explicitly by the user.
- **Why:** in the installed Next.js 16.4.5 the types and the local docs (`error.md`) give `retry()` as the recommended action: it asks the server for the content again and repaints it, while `reset()` repaints the same payload that already failed, which is exactly the `InfrastructureError` case of `UserMenuLoader`.
- **Discarded:** `reset()` as written in `tasks.md`.

### D-T9-2. `error.tsx` is verified without a browser

- **Decided:** `error.tsx` cannot be reached in a browser. With NFR-8 (no test controls in `src/`) there is no legitimate way to make the render fail after the guard passes, and on the 3101 server the guard rewrites everything to `/session-check-failed`, which the browser tests cover. The file is verified by `tests/app/error.test.ts` (5 tests, `renderToStaticMarkup` in Node, no jsdom): the heading and the button are present, the error text is not shown, no menu, no workspace content, no "signed out", the click calls `retry` once, and no fixed colors. The file runs in Vitest's "database" project because the mirror folder `tests/app/**` is in that list; it works and only runs serially.
- **Why:** NFR-8 forbids a failure switch in the application, and jsdom is not approved.
- **Discarded:** not recorded.

### D-T9-3. `PreferencesSync` lives in `MinimalTopbar`

- **Decided:** `PreferencesSync` is mounted in `MinimalTopbar`, not in `not-found.tsx`.
- **Why:** any use of the reduced top bar applies the changes made in its accessibility control (plan section 5).
- **Discarded:** mounting it in `not-found.tsx`.

### D-T9-4. Minimal refactor to avoid duplication

- **Decided:** the menu placeholder moved to `src/components/topbar/user-menu-slot.tsx`, shared by `Topbar` and `MinimalTopbar`, and `src/app/session-check-failed/page.tsx` now uses `AccountPageShell` with the same markup. It stays within the edit permission for `topbar.tsx` of plan item 5.
- **Why:** to avoid duplicating the placeholder and the page frame.
- **Discarded:** not recorded.

### D-T9-5. Sign-out from the not-found page works

- **Decided:** the plan said nothing about how a Server Action called from a nonexistent address behaves; the browser test confirms that sign-out works from the not-found page.
- **Why:** it was an open question in the plan; the test settles it.
- **Discarded:** not applicable.

### D-T9-6. Test details of `error-pages.spec.ts`

- **Decided:** workspace texts are searched with `exact: true` because "Workspace" also matched "Back to the workspace"; the response of the call redirected to 3101 arrives with the 3100 URL, so it is identified by the `next-action` header and the 503 status.
- **Why:** to make the assertions precise.
- **Discarded:** not recorded.

## T10 - Session renewal, 320 px matrix and consolidation of the E2E suite (approved by the user at the T10 implementation gate, 2026-11-09)

### D-T10-1. Helpers duplicated across the E2E specs moved to `tests/e2e/support/`

- **Decided:** the helpers that earlier specs duplicated moved to `tests/e2e/support/`: server addresses, `SAMPLE_UNIVERSE_NAME`, `expectWorkspaceIsShown`, `WORKSPACE_ONLY_TEXTS`, the operation-call headers, the user-menu locators, two copies of `signInThroughTheForm`, `buildLongEmail` and `waitForElementHydration`. No behavior changed. `error-pages.spec.ts` now uses the longer `WORKSPACE_ONLY_TEXTS` list from `access.spec.ts`, so it checks more texts. Only tests changed.
- **Why:** the new specs of T10 needed the same helpers (consolidation task).
- **Discarded:** not recorded.

### D-T10-2. `submitSignInForm` stays separate from `signInThroughTheForm`

- **Decided:** the first does not wait for the workspace root (used by `access.spec.ts`); the second waits for `/`.
- **Why:** not recorded.
- **Discarded:** not recorded.

### D-T10-3. A window of 300 s for the "30 days" browser expirations

- **Decided:** where the browser expiration of the cookie is compared with 30 days, a window of plus or minus 300 s is used between the test clock and the browser clock (same machine).
- **Why:** the two clocks are read at different moments.
- **Discarded:** not recorded.

### D-T10-4. `SameSite` is compared case-insensitively

- **Decided:** the session cookie is compared case-insensitively for `SameSite`, as decision D-T6-1 already showed (`SameSite=strict` in the header).
- **Why:** the library writes `strict` in lower case and the browser reports `Strict`.
- **Discarded:** not recorded.

### D-T10-5. A test fixes "at most once a day" at header level

- **Decided:** the "two openings on the same day" test fixes the behavior "extended at most once a day" (spec 002 FR-23) at the level of response headers; it passed 8 of 8.
- **Why:** not recorded.
- **Discarded:** not recorded.

### D-T10-6. Name of the 320 px spec and limits of the proof

- **Decided:** the spec is `tests/e2e/narrow-width.spec.ts`, as `tasks.md` and the plan say (the brief of the task said `narrow-viewport`). Limits of the proof, stated here:
  - Neither the browser clock nor the server clock is moved. The proof is the `Set-Cookie` of each response, the stored cookie never going backward, and the server accepting the session after 31 simulated days in the test database (plan D11).
  - `Secure` is only checked to be absent over http; over HTTPS it stays the manual check 002 FR-29.
  - `error.tsx` is not tested in a browser; it is covered by `tests/app/error.test.ts` and by `/session-check-failed`, which shares `AccountPageShell`.
  - The 320 px checks are geometric (`scrollWidth <= clientWidth`, boxes inside 0 to 320), without screenshots.
- **Why:** the plan and the tasks name the file this way; the limits are what the tools can prove.
- **Discarded:** the name `narrow-viewport`.
