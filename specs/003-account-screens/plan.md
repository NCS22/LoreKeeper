# Plan 003 — Account screens

Status: approved

Spec: `specs/003-account-screens/spec.md` (Status: approved, no open questions; FR-1 to FR-34 and NFR-1 to NFR-8). It builds on spec 002 (implemented and merged, including FR-40 to FR-42, the display name and the email of the acting user). Spec 002 stays untouched: the three account actions, the acting-user check, the session reader, the error vocabulary and the Better Auth instance are used as they are.

Every item that `CLAUDE.md` puts under "ASK FIRST" was asked to the user and answered on 2026-11-08. The answers are recorded in the next section, one numbered item each; the text of the plan refers to them as "item N". The change to the spec that item 2 needed (the definition of public resources and the accepted risk) was approved by the user and is now in the spec; D20 records it.

## Approved decisions (approved by the user on 2026-11-08)

Already approved earlier:
- `@playwright/test` (E2E, local runs): approved on 2026-11-06 (`CLAUDE.md`, OD-17), to be installed by this spec, same version line as the installed `playwright` library (`^1.64.1`). `jsdom` and testing-library are **not** approved and nothing in this plan needs them. The Playwright MCP server in `.mcp.json` is agent tooling and is not part of this plan.
- OD-12 and OD-17 are decided (2026-11-06); this plan records them (see "Inputs already decided").

Decided on 2026-11-08 (options considered and discarded are in section 8):

1. **Page gate mechanism: approved, `src/proxy.ts`** (Node runtime). It checks the session against the database on every request, redirects with `303` before anything is rendered, writes the renewed cookie and sets `Cache-Control: no-store`. A check in layouts or pages and a cookie-presence-only proxy are discarded (D1).
2. **Public static resources: approved, option A.** `/_next/static`, `/_next/image` and `/favicon.ico` are served without a session. Hashed build files contain the fake sample data that is also in the repository; they can be fetched without a session by someone who knows their address. This is recorded as an accepted risk until stored universes replace the sample data. The spec change it needed was approved on 2026-11-08 and is in `spec.md`: the "Public resources" definition names these three, FR-20 and FR-21 follow it, there is a new edge case and completion criterion, and the accepted risk is written there (to be revisited by the stored-universes spec). See D20.
3. **A fourth, read-only Server Action `confirmSessionStartedAction`: approved** (new file `src/app/confirm-session-started/actions.ts`) for FR-14. No change to the spec 002 engine or to the account actions.
4. **Playwright setup: approved.** `playwright.config.ts` at the repository root (new top-level file), the script `"test:e2e": "next build && playwright test"` in `package.json`, `.gitignore` entries `/test-results/` and `/playwright-report/`, `playwright.config.ts` added to `tsconfig.json` `include`, and the download of the Chromium browser only (`pnpm exec playwright install chromium`; Firefox and WebKit are not installed). `tests/e2e/` is the folder `architecture.md` already names.
5. **Minimal edits to existing files: approved.** `package.json` and `pnpm-lock.yaml` (dependency and script), `.gitignore`, `tsconfig.json`, `next.config.ts` (security headers, FR-34), `src/messages/en.ts` (new groups only), `src/components/topbar/topbar.tsx` (adds the user menu), `src/modules/accounts/index.ts` (new exports only), `tests/support/database/global-setup.ts` (its three helper functions move to a file shared with the E2E setup; behavior unchanged). Nothing in spec 001, in the accounts engine or in `vitest.config.mts` is edited.
6. **New folders and files inside the existing structure: approved** (no new top-level folder and no new module): `src/proxy.ts`; `src/components/accounts/`; `_components/` folders under `src/app/sign-in` and `src/app/sign-up`; `src/app/session-check-failed/`; `src/app/confirm-session-started/`; `src/app/error.tsx`; `src/app/not-found.tsx`; `tests/e2e/` with `support/`; `tests/support/database/prepare-test-database.ts`.
7. **User menu on wide screens: approved, option A.** One trigger button in the top bar at every width that opens a panel with the full name, the full email and "Sign out"; from the `md` breakpoint the trigger shows the display name on one line cut with an ellipsis, and the panel always has it in full (FR-26 allows a cut when a way to read all of it exists).
8. **Line-break case of the completion criteria: approved, option A.** The display name stays a single-line text field. The rule is exercised through the real form with the control characters such a field can hold (tab, U+0007, U+2028); the literal line break stays covered by the spec 002 domain tests (D19).
9. **Documentation follow-ups at closing: approved**, done by the implementer because the planner cannot write outside `specs/`: `CLAUDE.md` ("Current status", `pnpm test:e2e` confirmed, structure notes, the Playwright line), `.claude/rules/architecture.md` (`tests/e2e/` set up, `src/proxy.ts` as the page gate, `src/components/accounts/`), `docs/roadmap.md` (progress of Phase 1), and removal of OD-12 and OD-17 from `docs/open-decisions.md` (their text stays in this plan; OD-12 only after checking that plan 002 records it, which it does).
10. **Task count: approved as planned.** The task list reaches the maximum of 10 tasks with no spare (see "Size check") and the spec is not split now. If a task overflows during implementation, the implementer stops and proposes the split of the spec then.

## Inputs already decided (not new decisions)

- **OD-12 (decided 2026-11-06, executed by specs 002 and 003):** Better Auth with email and password, session in a cookie backed by a database session, one owner per universe, no sharing in Phase 1. Spec 002 delivered the engine; this spec delivers the screens and the page access. Social sign-in, email verification and password recovery stay in Phase 5. The row is removed from `docs/open-decisions.md` when this spec closes.
- **OD-17 (decided 2026-11-06, executed by this spec):** only `@playwright/test` (local runs; GitHub Actions is OD-22); `jsdom` and testing-library are deferred until a component with enough logic justifies them; this spec uses Playwright only for the account flows; turning the spec 001 manual list into tests is a later short spec. Removed from `docs/open-decisions.md` when this spec closes.
- **Handed over by spec 002** (its "Accepted risks and follow-ups" and `decisions.md`): renewal of the cookie lifetime on page visits, proven in a real browser (FR-16, D2, D10); the first real run of Server Actions and cookies in the Next.js runtime (all Playwright tests, D12); the manual checks of 002 FR-29 and FR-31 (section 7); security headers (FR-34, D17); `SameSite=Strict` (002 item 11), whose consequence is in D18.

## 1. Affected modules and layers

No new module and no new layer. The existing `accounts` module gets two pure domain files and exports. Everything else is presentation, one infrastructure reader and tests.

| Layer | File | Content | FRs |
|---|---|---|---|
| Domain (`src/modules/accounts/domain/`) | `return-destination.ts` | The single rule of FR-20: `resolveReturnDestination(candidate)` returns the safe path-and-query (never a fragment) or `null`; the constants `SIGN_IN_PATH`, `SIGN_UP_PATH`, `RETURN_DESTINATION_PARAMETER` (`returnTo`) and the 2,048-character limit; builders `buildSignInAddress(destination \| null)` and `buildSignUpAddress(destination \| null)`. Pure functions, no framework. | 13, 19, 20 |
| Domain | `page-access-policy.ts` | `classifyAddress(path)` returns one of `sign-in-page`, `sign-up-page`, `public-resource`, `workspace-address` (matching is case-sensitive, so `/Sign-In` is a workspace address, which the return rule then refuses); `decidePageAccess(input)` returns the decision of the table in section 4. Pure, no framework. | 15, 18, 21, 22, 24, 27 |
| Public interface | `src/modules/accounts/index.ts` (edit) | Adds exports of the functions and constants above. The existing exports are untouched. | |
| Infrastructure (shared) | `src/shared/infrastructure/read-session-for-guard.ts` | `readSessionForGuard(requestHeaders)` reads the session with the Better Auth server API asking for the response headers, and returns `{ state: "signed-in" \| "signed-out" \| "check-failed", setCookieLines }`. `setCookieLines` are the cookie lines the library produced: the renewed session cookie (FR-16, FR-17) or the cleanup of a dead one. A failure is `check-failed`, logged with `logServerError`; the library's own 401 "session removed while renewing" is `signed-out` (it reuses `isSessionRemovedWhileRenewing`). Reads nothing from `next/headers`. | 15, 16, 17, 24 |
| Presentation (shared) | `src/shared/presentation/page-access-guard.ts` | `guardPageRequest(request, dependencies)`: reads the session, asks the policy and turns the decision into a response (section 4). It receives the reader and the policy as parameters, so it imports no module and is unit tested with fakes. | 15 to 18, 21, 22, 24, 27 |
| Presentation (shared) | `src/shared/presentation/signed-out-action-response.ts` | Client-safe constants of the two refusals given to Server Action requests: status and exact text of "signed out" and of "session could not be checked". Used by the guard and by the sign-out control. | 27, 28 |
| Presentation | `src/proxy.ts` (approved, item 1) | `export const config = { matcher }` excluding `/_next/static`, `/_next/image` and `/favicon.ico`; the function wires `readSessionForGuard` and the accounts policy into `guardPageRequest`. Nothing else. | 15 to 18, 21, 22 |
| Presentation | `next.config.ts` (edit, item 5) | `headers()`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` for every route except the public resources (the static files and optimized images, which the framework serves itself). Content Security Policy and forced HTTPS stay in Phase 5 (spec, Out of scope). | 34 |
| Presentation (`src/app/`) | `sign-in/page.tsx`, `sign-in/_components/sign-in-form.tsx`, `sign-up/page.tsx`, `sign-up/_components/sign-up-form.tsx` | The two pages (Server Components behind a `Suspense` boundary because they read `searchParams`) and their client forms. The page resolves the return destination with the domain rule and gives the form the already-safe destination, the address of the other page and the issue codes as props. | 1 to 14, 19, 22, 30 |
| Presentation | `confirm-session-started/actions.ts` (approved, item 3) | `confirmSessionStartedAction()`: same-site check, `getActingUser()`, answers `null`; no session gives the authentication error through `runAction`. No input. | 14 |
| Presentation | `session-check-failed/page.tsx` and `_components/try-again-button.tsx` | The generic error page of FR-24 (internal rewrite target, D8). | 24 |
| Presentation | `error.tsx`, `not-found.tsx` | The error boundary page (a render failed after the guard passed) and the not-found page of FR-23. | 23, 24 |
| Presentation (`src/components/accounts/`) | `account-page-shell.tsx`, `account-form-field.tsx`, `account-form-message.tsx`, `use-account-submission.ts`, `run-with-time-limit.ts`, `interpret-account-action-result.ts`, `account-issue-messages.ts`, `leave-account-page.ts` | Shared building blocks of the forms and of the sign-out control (section 5). The three files with logic (`run-with-time-limit`, `interpret-account-action-result`, `account-issue-messages`) are pure and unit tested (D14). | 3 to 14, 27, 28, 32 |
| Presentation (`src/components/topbar/`) | `user-menu.tsx`, `user-menu-loader.tsx`, `minimal-topbar.tsx`; `topbar.tsx` (edit) | The user menu (client), the Server Component that reads the acting user behind `Suspense`, the reduced top bar of the not-found page, and the one-line change that adds the menu to the workspace top bar. | 23, 25, 26, 27, 28 |
| Presentation | `src/messages/en.ts` (edit) | New groups: account forms, issue messages keyed by stable code, generic and "could not confirm" messages, storage-blocked messages, user menu, not-found, error page. | |

Dependency direction holds: `presentation → application → domain ← infrastructure`. The domain files import nothing but standard TypeScript. Presentation reaches the module only through `@/modules/accounts`. **Client components never import `@/modules/accounts`**: its index also exports the composition, which imports Better Auth, `pg` and `next/headers`, and that cannot be bundled for the browser. Server Components (the pages, the menu loader, the proxy) import it and pass plain values down as props (D13).

Not touched: spec 001 code and tests, `src/mocks/`, `src/components/universes/`, `src/components/workspace/` (clean start needs no change, D6), `vitest.config.mts`, the accounts engine, the Prisma schema.

## 2. Data

None. No Prisma schema change, no migration, no new column, no JSONB. No new environment variable and no change to `.env.example`: the application reads only the three variables it already reads; the E2E configuration sets their values for its own test servers in `playwright.config.ts`.

The tests touch stored data in one way only: the E2E suite connects to the **test database** (`TEST_DATABASE_URL`, guarded by the existing `readSafeTestDatabaseName`) with `pg` to create nothing and to move the timestamps of sessions backward (D10). The application has no knowledge of it.

## 3. Use cases

No new use case. Rules that need no port are pure domain policy (section 1). The screens call, and do not change:

| Caller | Calls | Errors it must handle (stable codes of 002) |
|---|---|---|
| Sign-up form | `signUpAction`, then `confirmSessionStartedAction` | `VALIDATION_ERROR` (issues by field, or a `request`/`input` issue with no form field), `BUSINESS_RULE_VIOLATION` (email taken), `INFRASTRUCTURE_ERROR`, `UNKNOWN_ERROR`, any other code |
| Sign-in form | `signInAction`, then `confirmSessionStartedAction` | `VALIDATION_ERROR`, `AUTHENTICATION_ERROR` (generic credentials message), the rest as above |
| User menu loader | `getActingUser()` (002) | `AuthenticationError` renders nothing (the session ended while the page was being rendered, for example by the sign-out action that re-renders the page); `InfrastructureError` is rethrown to `error.tsx` |
| Sign-out control | `signOutAction` | any failure result gives the generic message; a refusal by the guard (D5) is read as "already signed out" |
| `confirmSessionStartedAction` | `getActingUser()` | `AuthenticationError` (the browser did not keep the session) |

No `ViewerContext` is needed: nothing here reads narrative data (section 6).

## 4. Contracts

### Proxy decisions (`decidePageAccess`, `guardPageRequest`)

Inputs: the classification of the address, the method, whether the request carries the `next-action` header (a Server Action call), the session state, the requested path and query, and the raw `returnTo` parameter. Every answer carries `Cache-Control: no-store` (D9) and, when the reader produced them, the cookie lines (FR-16, FR-17).

| Address | Request | Session | Answer |
|---|---|---|---|
| public resource (`/_next/static`, `/_next/image`, `/favicon.ico`) | any | any | not matched by the proxy; served by the framework without a session and never redirected (FR-21) |
| sign-in or sign-up page | GET or HEAD | signed out | pass (FR-1, FR-2) |
| sign-in or sign-up page | GET or HEAD | signed in | `303` to the resolved `returnTo` or `/` (FR-22) |
| sign-in or sign-up page | GET or HEAD | check failed | rewrite to `/session-check-failed` (FR-24) |
| sign-in or sign-up page | any other method (a form action) | any | pass; the action answers "already signed in" by itself (FR-22) |
| workspace address (also an address that does not exist) | any, no `next-action` | signed out | `303` to `buildSignInAddress(resolveReturnDestination(path + query))`; the return destination is carried only for GET and HEAD, with no body (FR-18, FR-21, NFR-4) |
| workspace address | any with `next-action` (an "operation call" in the spec) | signed out | `401`, content type exactly `text/plain`, fixed text, nothing else, and the operation does not run: the refusal of FR-21 (exception), NFR-4 (D5) |
| workspace address | any, no `next-action` | check failed | rewrite to `/session-check-failed` (FR-24) |
| workspace address | any with `next-action` (an operation call) | check failed | `503`, content type exactly `text/plain`, fixed text, the operation does not run and the person is not treated as signed out: the generic failure of FR-24 (second sentence) and, for a sign-out, FR-28 (D5) |
| workspace address | any | signed in | pass (FR-31) |

The rewrite keeps the requested address in the browser and shows the error page of FR-24 with no workspace content and no user menu; the status is `503` if the framework honours a status on a rewrite, otherwise the page's own (the spec asks for no particular status; the implementer reports which one). `/session-check-failed` is itself a workspace address for the guard, so a signed-out person cannot request it directly.

### Return destination (the one rule, FR-20)

`resolveReturnDestination(candidate: string | null | undefined): string | null`. The candidate is the text of the `returnTo` parameter after the URL parser decoded it once, or the path and query of the requested address. The rule returns `null` (the caller then uses the workspace root, silently) unless, in this order: the length is at most 2,048 characters; no control character appears raw or percent-encoded; no backslash appears raw or percent-encoded; it decodes once without error; both the text and its once-decoded form start with a single `/` (not `//`, and no `%2f`/`%5c` at the start); its decoded path, compared case-insensitively and ignoring trailing slashes, is neither the sign-in page, the sign-up page nor a public resource (an address under `/_next/static` or `/_next/image`, or `/favicon.ico`, as the spec defines them); and its query has no `returnTo` of its own. A fragment is cut off. The test table contains every case of FR-20 and the valid examples `/`, `/?x=1`, `/a/b?x=1&y=2`. Nobody else decides whether a destination is safe: the proxy and the two pages call this function; the client receives the result as a prop and never evaluates it (no duplicated rule).

### Server Actions

| Action | Input | Result |
|---|---|---|
| `signUpAction`, `signInAction`, `signOutAction` (002, unchanged) | as in 002 | `ActionResult` as in 002 |
| `confirmSessionStartedAction` (approved, item 3) | none | `{ ok: true, value: null }`, or `{ ok: false, error: { code: "AUTHENTICATION_ERROR", ... } }`; same-site rejection as the other actions |

### What the forms do with an answer (pure, `interpret-account-action-result.ts`)

| Answer | Sign-up | Sign-in | Sign-out |
|---|---|---|---|
| success (`signed-up` / `signed-in`) | confirm, then leave to the destination | same | leave to the sign-in page |
| `already-signed-in` | leave to the destination, workspace untouched | same | not applicable |
| `VALIDATION_ERROR` with issues on form fields | message on each field (FR-4); all messages of a field together | message on each empty field (FR-6) | generic (FR-9) |
| `VALIDATION_ERROR` with no form field (`request`, `input`) | generic (FR-9) | generic | generic |
| `BUSINESS_RULE_VIOLATION` | "an account with that email already exists" on the email field (FR-5) | generic | generic |
| `AUTHENTICATION_ERROR` | generic | one credentials message, one place (FR-7) | generic |
| any other code, or a result that does not have the expected shape | generic (FR-9) | generic | generic |
| thrown error, or no answer in 30 s | "could not confirm; the account may exist" (FR-10) | "could not reach / result unknown" (FR-10) | "sign-out could not be confirmed; the session may still be open" (FR-28), except the refusal of D5 for "signed out", which is a success |

After a failed sign-up or sign-in the display name and the email stay and the passwords are cleared (FR-8, FR-9, FR-10). `confirmSessionStartedAction` shows the storage message (FR-14) only on an explicit authentication error; any other failure or silence proceeds with the navigation, because the confirmation exists only to avoid a redirect loop and the guard decides the rest.

## 5. UI

### Routes and components

| Route | Rendering | Notes |
|---|---|---|
| `/sign-up`, `/sign-in` | Server Component page (reads `searchParams`) inside `<Suspense>` with a card-shaped fallback; the form is a Client Component | `export const metadata` with the title; `instant = false` only if the build validation of `cacheComponents` asks for it (the implementer follows the local Next guide "Authentication with Cache Components") |
| `/` (workspace root) | unchanged; the top bar gets `<Suspense fallback={disabled placeholder}><UserMenuLoader /></Suspense>` | the static shell has no session data; the guard has already admitted the request |
| any other address | `not-found.tsx` with `MinimalTopbar` (brand, accessibility control, user menu), `PreferencesSync`, a message and a link to `/` | FR-23 |
| `/session-check-failed` | Server Component with a client "Try again" button that reloads the requested address | FR-24; no menu |
| `error.tsx` | Client Component error boundary, same visual as the page above, button calls `reset()` | an error after the guard passed; never shows the error text |

Forms: `noValidate`; the display name and the email are `type="text"` with `inputMode="email"`, `autoComplete`, `autoCapitalize="none"` and `spellCheck={false}` for the email (an `email` input would strip whitespace and run browser validation, FR-3); no `required`, `pattern` or `maxLength` anywhere (FR-3); passwords are `type="password"`. Controlled fields: display name and email survive a failure, the passwords are emptied (FR-8). Every field has a visible `<label>`; each error is a paragraph with an id referenced by the field's `aria-describedby`, with `aria-invalid` (NFR-2). When an answer brings errors the focus moves to the first field with an error, or to the general message (a `role="alert"` element with `tabIndex={-1}`) when there is none; general messages (FR-9, FR-10, FR-14, FR-28) use the same element. The submit button is natively disabled while a submission waits, its label changes ("Creating account…", "Signing in…", "Signing out…") and the form has `aria-busy` (NFR-5); a synchronous reference guard also blocks a second submission from Enter or a double click before the state update arrives (FR-12). The wait limit is 30 s through `run-with-time-limit.ts` (`Promise.race`); Server Actions cannot be aborted, so a late answer is ignored (D16).

Leaving a page (`leave-account-page.ts`): after a sign-up or sign-in success, and after a sign-out, the client calls `window.location.replace(address)` — a new document, not a client navigation (D6). This gives the clean start of FR-32 without touching the spec 001 provider, removes the form from the history (FR-30) and makes the browser request the next page again (FR-29). After "already signed in" it does the same without any claim on the workspace of other tabs.

User menu (`user-menu.tsx`, Client Component, item 7 option A): a `Popover` like the accessibility control. Trigger: an icon button; from `md` upward it also shows the display name on one line with an ellipsis. Panel: the display name and the email in full as plain text inside `<bdi>` with `unicode-bidi: isolate`, wrapping with `overflow-wrap: anywhere` and `min-w-0` so nothing scrolls horizontally at 320 px (FR-26, NFR-6), and a "Sign out" button with the in-progress state and a `role="alert"` message area. Text content is always a React text node, never HTML. The loader passes `displayName`, `email` and `signInAddress` as props.

States: loading (the Suspense fallbacks), submitting, field errors, general errors, no answer, storage blocked, empty (not applicable). Styling uses only the existing tokens and utility classes (`bg-surface`, `text-danger`, `border-line-control`, `rounded-control`…); no new token (NFR-3). Preferences are applied on every page by the init script of the root layout (FR-33); `MinimalTopbar` mounts `PreferencesSync` so changes made there also apply.

### Accessibility

Keyboard-only completion of both forms, the menu and the error and not-found actions (NFR-1) is asserted in the browser tests where it can be (tab order, Enter, Escape) and checked manually for screen readers, contrast and focus (section 7). Heading levels: one `h1` per page.

## 6. Spoiler impact

None. Accounts, pages and the user menu read and write no narrative information: no works, narrative units, reading progress or spoiler boundaries. `READER` and `AUTHOR` are not touched. No `ViewerContext` is built and no visibility rule exists to apply. The spoiler suite is not required in any task. The sample data in the workspace is unchanged (FR-31).

## 7. Tests

`pnpm test` runs Vitest as today (spec 001 and 002 tests unchanged). `pnpm test:e2e` is new and runs Playwright against the production build. No test needs `jsdom`: logic that a component would hide is extracted into pure functions and tested directly (D14); behavior in the browser is covered by Playwright.

### Vitest

| Layer | Test file (mirrors `src/`) | Covers |
|---|---|---|
| Domain | `tests/modules/accounts/domain/return-destination.test.ts` | Table-driven over every invalid case of FR-20 (`//x`, `/\x`, `\x`, `\\x`, absolute address, `javascript:` and `data:`, `%2f%2f`, `%5c`, raw and encoded line break, tab and null, 2,049 characters, `/sign-in`, `/sign-in/`, `/Sign-In`, `/sign-in?x=1`, `/sign-up…`, each of the three public resources (`/_next/static/x.js`, `/_next/image?url=x`, `/favicon.ico`), a query that already carries `returnTo`) and the valid ones (`/`, `/?x=1`, `/a/b?x=1&y=2`); a fragment is cut; builders encode the destination (FR-19, FR-20) |
| Domain | `.../page-access-policy.test.ts` | Classification (exactly `/_next/static`, `/_next/image` and `/favicon.ico` are public resources; any other address, including other `/_next/…` addresses and other letter cases, is a workspace address; nonexistent address is a workspace address) and the whole decision table of section 4 (FR-18, FR-21, FR-22, FR-24, FR-27) |
| Shared presentation | `tests/shared/presentation/page-access-guard.test.ts` | With a fake reader and real `NextRequest`: redirect `303` with `Location`, empty body and no workspace text in body or headers; `no-store`; cookie lines forwarded on pass and on redirect; `401` (no session) and `503` (session not checkable) text responses to operation calls, with the exact content type, the operation not run, body and headers free of workspace text, and the person not treated as signed out in the `503` case (FR-21 exception, FR-24 second sentence, NFR-4, the two operation-call edge cases and the completion criterion); rewrite on a failed check; every method (NFR-4, FR-21) |
| Proxy | `tests/proxy.test.ts` | The matcher with `unstable_doesProxyMatch`: `/`, `/sign-in`, `/nope` match; `/_next/static/x.js`, `/_next/image` and `/favicon.ico` do not, so the matcher excludes exactly the three public resources of the spec and is kept equal to the policy's list. If that experimental helper is not available, the same list is checked against the matcher pattern directly |
| Components | `tests/components/accounts/interpret-account-action-result.test.ts` | Every row of the table in section 4, including malformed results and codes not in the list (FR-4 to FR-10, FR-14, FR-28) |
| Components | `.../account-issue-messages.test.ts` | Every issue code exported by the accounts module has a message; limits come from the issue, never from the interface; several issues on one field give all messages (FR-4, NFR-2) |
| Components | `.../run-with-time-limit.test.ts` | Fake timers: answer before 30 s, silence at 30 s, a rejection, a late answer ignored (FR-10, FR-11) |
| Lint | `tests/lint/test-controls-absent.test.ts` | NFR-8: no file under `src/` reads `process.env` except the server-environment reader, none imports from `tests/` or from Playwright, and `src/` contains none of the identifiers the E2E support uses to provoke failures |
| Database-backed | `tests/shared/infrastructure/read-session-for-guard.test.ts` | Real engine: valid session, none, deleted, tampered and expired give `signed-in`/`signed-out`; with simulated `Date` at 24 hours the cookie lines contain the session cookie with `Max-Age=2592000`, `HttpOnly`, `SameSite=Strict` (FR-16, FR-17); a dead cookie yields cleanup lines; a database failure is `check-failed` and is logged (FR-24) |
| Database-backed | `tests/app/confirm-session-started/actions.test.ts` | With a session: `ok`; without: `AUTHENTICATION_ERROR`; foreign `Origin` rejected (FR-14) |

### Playwright (`tests/e2e/`, Chromium, production build)

Harness (`playwright.config.ts`, `tests/e2e/support/`): `globalSetup` prepares the test database through `prepare-test-database.ts` (create if missing, apply migrations, refuse unsafe names, empty the authentication tables) — the helper is the three functions of `tests/support/database/global-setup.ts` moved to a vitest-independent file that both setups call. Two `next start` processes share the build made by `pnpm test:e2e`: the **healthy** one on port 3100 against the test database, and the **unreachable-data** one on port 3101 with a `DATABASE_URL` that points to a closed port. Both use the same fixed, test-only `BETTER_AUTH_SECRET` (so a cookie signed by one is accepted by the other as a cookie) and an `http://localhost` base URL; cookies are not scoped by port, so a person signed in on 3100 reaches 3101 with the same session. Every test creates its own account with a unique email, so tests do not collide.

| Spec file | Flows |
|---|---|
| `access.spec.ts` | Signed-out request to `/`, `/?x=1`, `/nope`, a `POST` and a `HEAD`, with no redirect following: `303`, `Location` carrying the destination, empty body, no sample-universe names or top-bar labels in body or headers, and no `Set-Cookie` of a session (NFR-4, FR-18, FR-21); a forged Server Action call (an operation call) to `/` from a signed-out client, made without a browser, gets the `401` text, is not redirected, runs nothing, and its body and headers contain none of the workspace's text (FR-21 exception, NFR-4); signed-out requests for a real static file under `/_next/static` (its address read from the loaded `/sign-in` page), for `/_next/image` and for `/favicon.ico` are not redirected, and the sign-up and sign-in pages load completely in a signed-out browser, while any other address is redirected (FR-20, FR-21, completion criterion of the spec); security headers on `/sign-in` and on `/` when signed in (FR-34) |
| `sign-up.spec.ts` | Create an account, land in the workspace root signed in; every case of the completion criteria through the real form (121 and 120 characters, control characters, repeat password, empty, invalid email, password limits, duplicate email in another case with spaces, then sign in with the lower-cased email); messages on the right fields; typed values kept, passwords cleared; no browser validation stops anything; double click and double Enter send one submission; in-progress label and disabled control; connection lost and no answer in 30 s (`page.route` and the Playwright clock) give the message of FR-10 and allow retry; a foreign-site request header and a failing data store (unreachable-data server) give the generic message; blocked cookies (the route strips `Set-Cookie`) give the storage message and no loop; return destination kept between the two pages and after a failed submission; a signed-in tab opening or submitting the form lands on the destination and keeps its session; the page is not a history step (FR-1, FR-3 to FR-14, FR-19, FR-22, FR-30, NFR-5) |
| `sign-in.spec.ts` | The sign-in counterpart: wrong password and unknown email show the same message in the same place; empty fields; kept email, cleared password; return to `/?x=1` with the query; sign-in links carry the destination; storage blocked; failing data store (FR-2, FR-6 to FR-8, FR-13, FR-14, FR-19) |
| `sign-out.spec.ts` | User menu content for a name of 120 characters, an email of 254 characters, markup and direction-control characters (plain text, in full, isolated); sign-out lands on `/sign-in` with no return destination; with an already expired, deleted or other-tab-ended session no error is shown (FR-27); with the request blocked the message of FR-28 and retry; the old session is rejected afterwards and a second context's session stays valid; the browser back action never shows workspace content and ends at sign-in; after sign-in the back action does not return to the sign-in page; **clean start**: create a universe in memory, sign out, sign in, see only the sample data and initial state; a failed submission and an "already signed in" answer leave another tab's workspace as it is (FR-25 to FR-32) |
| `error-pages.spec.ts` | Signed in, an unknown address shows the designed not-found page with the top bar, the menu and a link to the root, and signed out it redirects to sign-in; on the unreachable-data server, with the cookie of a signed-in person, the workspace, `/sign-in` and `/sign-up` show the error page, not workspace content, no menu, and not the sign-in form; "Try again" reloads; a sign-out made on the unreachable-data server by a person with a session cookie is not run, shows the message of FR-28 ("could not be confirmed, the session may still be open"), leaves the person in the workspace, allows retry and does not send them to sign in, and a forged operation call there gets the `503` text with no workspace text (FR-23, FR-24 second sentence, FR-28) |
| `session-renewal.spec.ts` | See D10: a person who opens the workspace once a "day" for 31 simulated days is still signed in and every response carries the renewed cookie; absent for 31 simulated days is signed out and the dead cookie is cleaned; the cookie after sign-up, sign-in and renewal is `HttpOnly`, `SameSite=Strict`, path `/` and has a lifetime of 30 days (FR-16, FR-17) |
| `narrow-width.spec.ts` | At 320 px, with a 120-character name and a 254-character email: sign-up, sign-in, user menu panel, sign-out, not-found and error pages have no horizontal scroll and every control is reachable; keyboard-only completion of both forms (NFR-6, NFR-1 in part) |

### Manual checks by the user (completion criteria of the spec)

NFR-1 to NFR-3 (keyboard, screen reader, contrast and focus); FR-33 (preferences applied on the sign-up, sign-in, not-found and error pages, including after a sign-out); from spec 002: **002 FR-29** (set `BETTER_AUTH_URL=https://localhost:3000`, serve over HTTPS, create an account, check in the browser tools that the session cookie has `Secure`, `HttpOnly`, `SameSite=Strict` and the `__Secure-` prefix, then repeat with `http://localhost:3000` and confirm there is no `Secure`) and **002 FR-31** (create an account, stop the application, `docker compose restart postgres`, wait until healthy, start the application, reload — the session is still valid —, sign out and sign in again). Docker Desktop, a `.env` with `TEST_DATABASE_URL` and a downloaded Chromium are prerequisites on the user's machine.

Spoiler suite: not required. Verification gate per task: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e` for every task that changes a user flow.

## 8. Decisions

| # | Decision | Discarded alternative and why |
|---|---|---|
| D1 | The page gate is `src/proxy.ts`, with a real database check on every request to a page (approved, item 1). The proxy answers before any rendering, so a signed-out person never receives the prerendered workspace (NFR-4), and it can write cookies, which a layout or a Server Component cannot (FR-16). | A check in layouts or pages: with `cacheComponents` the static shell of the workspace is sent before a dynamic check resolves, so a redirect would arrive after content; a Server Component also cannot set the renewed cookie. A cookie-presence-only proxy: a deleted or tampered session would pass (FR-26). |
| D2 | The guard reads the session through the Better Auth server API asking for the response headers, and puts the cookie lines on whatever response it returns. The library's Next.js cookie plugin writes through `next/headers`, which does not exist in the proxy scope. To be verified first in the guard task, in the production build: that the plugin does not throw there (its hook catches only the exact "outside a request scope" error) and that the renewed `Set-Cookie` reaches the browser. If it throws, the implementer stops and reports; the fix (building the instance for the guard without the plugin) edits a spec 002 file and needs the user's approval. | Reading the cookie and the database table ourselves: a second implementation of session rules. Renewing from a Server Component: the library skips renewal for RSC requests and the cookie cannot be written (002 round 1, M2). |
| D3 | The access rules live in the accounts domain as pure functions; the glue is `guardPageRequest` in shared presentation with injected reader and policy; `src/proxy.ts` only wires. | Logic inside `proxy.ts`: untestable without the framework. Putting the rules in `src/shared`: shared is for pieces used by several modules; the pages are the accounts' pages. |
| D4 | The return destination is evaluated only on the server, by the one function of the accounts domain, in the proxy and in the two pages; the form gets a safe destination as a prop. | A `returnTo` input in the account actions: a change of spec 002 (excluded here). The client re-checking it: two copies of a security rule. |
| D5 | Implements the spec: FR-21 (exception for an operation call to a workspace address without a valid session), the second sentence of FR-24 (session not checkable), NFR-4 and the two edge cases and the completion criterion on operation calls (approved change of 2026-11-08). The spec asks only for a refusal with no content and no workspace text; the `401`/`503` numbers, the fixed text and the exact content type are this plan's means. A Server Action call (an operation call) from a signed-out client to a workspace address is refused by the proxy with `401` and a fixed `text/plain` body and the operation does not run (and with `503` when the session cannot be checked, without treating the person as signed out). Verified in the installed Next.js: a cookie change inside an action makes the framework re-render the current page in the action's answer, so passing such a call through would send workspace content to a signed-out caller; and the client throws an `Error` carrying the body only when the status is 400 or more and the content type is exactly `text/plain` (a default `Response` adds a charset and would not match; the guard sets the header explicitly). The sign-out control treats the `401` text as "already signed out" (FR-27) and any other thrown error as "not confirmed" (FR-28). A browser test guards this reliance on framework behavior. | Letting action calls through (the earlier idea in plan 002): leaks the re-rendered page. A redirect: the action protocol does not follow it as a navigation. Rewriting to the sign-in page: the sign-out action does not exist there, so the call would fail as an unknown action. |
| D6 | After a sign-up or sign-in success and after a sign-out the client does `window.location.replace(...)`: a new document, so every in-memory universe and all workspace state disappear (FR-32), the form is not a history step (FR-30), and the browser asks the server again for the next page (FR-29). Spec 001 code and tests are untouched. | A client navigation: `cacheComponents` keeps previous routes alive, so state can come back. A key that remounts the provider on session change, or a reset function in the provider: edits spec 001 files and still does not cover state outside the provider. |
| D7 | After a sign-up or sign-in success, a read-only action confirms that the browser kept the session before leaving the page (approved, item 3). Only an explicit authentication error shows the storage message; any other outcome proceeds. | Navigating and noticing afterwards: needs a marker in the address or in browser storage, both worse. Extending the account results: a spec 002 change. |
| D8 | A failed session check is answered by rewriting to the internal page `/session-check-failed`, which is a normal application page using the root layout, so it has the design tokens and the preferences script (FR-24). | An inline HTML document from the proxy: cannot reference the hashed style files nor the preferences script. A redirect to sign-in: treats the person as signed out, which FR-24 forbids. Letting the proxy throw: the framework's default error page, not the application's. |
| D9 | Every answer of the guard carries `Cache-Control: no-store`, so the browser never shows a stored workspace page on the back action (FR-29), together with D6. The browser test checks the header on `/`; if the framework replaces it for prerendered pages, the same header moves to `headers()` in `next.config.ts`, an already approved edit. | Relying on the history entry being replaced alone: earlier workspace entries would still be restorable. |
| D10 | Test-only controls stay outside the application. Failures: a second server whose `DATABASE_URL` points to a closed port, route interception and header changes by the browser test, and the Playwright clock for the 30 s limit. Simulated passage of time: the test moves the `expiresAt` and `updatedAt` of the account's session rows back in the test database, which is exactly what real time would do to the stored values the engine compares with the clock; "a day without use" is one day plus one minute back, "absent" is 31 days back. `src/` contains no test hook, no environment switch and no import from `tests/`, and the structural test of NFR-8 fails if one appears. | A header, cookie or environment switch inside the application removed in production: its absence would have to be proven by testing product code for a negative. A preload that patches the server's clock: it changes `Date` for every library in the process. |
| D11 | The limit of D10 is stated: a real browser's clock cannot be moved (cookie expiry uses the system clock), so the proof that the renewed cookie reaches the browser is the `Set-Cookie` of every response (name, 30-day lifetime, `HttpOnly`, `SameSite=Strict`, path) together with the cookie stored by the browser and with the server still accepting the session after 31 simulated days. | Pretending that the browser expired its own cookie: it cannot be made to. |
| D12 | The E2E suite runs against the production build (`next build`, then two `next start` processes), with unique accounts per test. | `next dev`: the proxy, `cacheComponents` and the cookie behavior differ from what ships. Building inside the web-server command: the two servers would start before the build ends. |
| D13 | Issue codes and field names are read from `@/modules/accounts` by Server Components and handed to the client forms as plain props; the client never imports the module (its index drags server-only code into the browser bundle). | Importing the index in client code: breaks the build. Copying the code strings into the interface: drift (the issue-message test covers the exported list anyway). Moving the constants to `src/shared`: edits spec 002 files. |
| D14 | Logic of the interface is extracted into pure, unit-tested functions; the rest is covered in Playwright. | `jsdom` and testing-library: not approved (OD-17). |
| D15 | One popover user menu in the top bar, like the accessibility control; the reduced `MinimalTopbar` is used by the not-found page because the workspace `Topbar` needs the workspace layout context. | An item in the existing menu bar: it is hidden below `md` (FR-25 asks for every width). Reusing `Topbar` outside `WorkspaceLayout`: throws. |
| D16 | The 30 s limit is a race between the action and a timer; a late answer is ignored. | `AbortController`: Server Actions cannot be aborted. |
| D17 | Security headers (FR-34) in `next.config.ts` `headers()`. | Setting them in the proxy: it does not run for the build files and would duplicate. A Content Security Policy or HSTS now: deferred to Phase 5 by the user (spec). |
| D18 | Consequence of `SameSite=Strict` (spec 002 item 11), recorded as asked there: a person who arrives from another site's link is first treated as signed out (the browser does not send the cookie), is sent to sign in carrying the destination, and after pressing the form button gets "already signed in" and lands on that destination. No requirement changes. | Changing the cookie to `Lax`: a spec 002 decision. |
| D19 | The display name field is a single-line text field (approved, item 8). | A multi-line field: worse for everyone to let a line break through. |
| D20 | Aligned with the spec change approved on 2026-11-08 ("Public resources" definition, FR-20, FR-21, edge case, completion criterion and accepted risk). Public resources are `/_next/static`, `/_next/image` and `/favicon.ico`; the proxy matcher excludes exactly them, so they are served without a session and never redirected (approved, item 2). The sample data inside the generated static files is the accepted risk written in the spec ("Accepted risks"): those files can be requested without a session, their names are generated, they contain only sample data already public in the repository, and the stored-universes spec must revisit it. | Answering a build file to a signed-out person only if the sign pages use it: needs the build manifests, complex and fragile. Keeping sample data out of every client script: not possible with the current interface. |

Risks and notes
- The two framework behaviors D5 relies on and the proxy scope question of D2 were read in the installed `next` and `better-auth` packages, not run. The first guard task starts with them as an explicit check; a different result is reported before anything is worked around.
- The `_rsc` query parameter that client navigations add must not enter the return destination; the access spec checks a navigation to `/?x=1` and the guard strips the parameter if the framework leaves it.
- The late answer after 30 s (D16) can still sign the person in; the message already says the account may exist.
- Sample data in the generated static files: the accepted risk of item 2, now written in the spec (D20); the stored-universes spec must revisit it.
- `pnpm test:e2e` needs Docker, a `.env` with `TEST_DATABASE_URL`, a built application and Chromium; it fails loudly otherwise. It is not part of `pnpm test`.
- The existing `playwright` library stays as a dev dependency; removing it would need approval and is not planned.

## 9. Coverage

Every FR (1 to 34), every NFR (1 to 8) and the manual checks are covered. "T" refers to the work packages of the size check.

| Requirement | Covered by |
|---|---|
| FR-1, FR-2 | Sign-up and sign-in pages (T6, T7); `sign-up.spec.ts`, `sign-in.spec.ts` |
| FR-3 | Forms without browser checks or limits (section 5, "Forms"; T6, T7); sign-up and sign-in specs through the real form |
| FR-4, FR-5 | `interpret-account-action-result`, `account-issue-messages` (T5); sign-up form (T7); `sign-up.spec.ts` |
| FR-6, FR-7 | Same pure files (T5); sign-in form (T6); `sign-in.spec.ts` |
| FR-8, FR-9, FR-10 | Pure interpreter and form state (T5, T6, T7); both specs |
| FR-11 | `run-with-time-limit` and its test (T5); `sign-up.spec.ts` with the Playwright clock |
| FR-12 | Reference guard and disabled control in `use-account-submission` (T5); both specs |
| FR-13 | `leave-account-page`, page props from the return rule (T2, T5, T6, T7) |
| FR-14 | `confirmSessionStartedAction` and its test (T5); both specs with stripped `Set-Cookie` |
| FR-15 | `readSessionForGuard`, `guardPageRequest`, `src/proxy.ts` (T3) |
| FR-16, FR-17 | Cookie lines forwarded by the guard (T3, database-backed test of the reader); `session-renewal.spec.ts` (T10), D10, D11 |
| FR-18, FR-21 | Policy table, guard, matcher excluding exactly the three public resources, access spec including the requests for the public resources and the complete load of the sign pages, and the operation-call refusal of the FR-21 exception (T2, T3, T4); D5, D20 |
| FR-19 | Builders and page props (T2, T6, T7); both specs |
| FR-20 | `return-destination` and its table-driven test, including the three public resources (T2) |
| FR-22 | GET redirect in the guard (T3); form answer "already signed in" (T5, T6, T7); both specs |
| FR-23 | `not-found.tsx`, `MinimalTopbar` (T9); `error-pages.spec.ts` |
| FR-24 | Guard rewrite and `/session-check-failed` (T3, T4), `error.tsx` (T9); for operation calls whose session cannot be checked, the `503` refusal of the guard (T3, D5); `error-pages.spec.ts` on the unreachable-data server (pages, and the sign-out case) |
| FR-25, FR-26 | `user-menu`, `user-menu-loader` (T8); `sign-out.spec.ts`, `narrow-width.spec.ts` |
| FR-27 | D5 and the sign-out control (T3, T8); `sign-out.spec.ts` |
| FR-28 | Interpreter row and the control (T5, T8); `sign-out.spec.ts` |
| FR-29, FR-30 | `no-store` (D9, T4), `leave-account-page` (D6); `sign-out.spec.ts`, both specs |
| FR-31 | Workspace unchanged; spec 001 tests; `sign-out.spec.ts` checks sample data and in-memory creation after sign-in |
| FR-32 | D6; `sign-out.spec.ts` clean-start flows (T8) |
| FR-33 | Init script of the root layout (existing) and `MinimalTopbar`; manual check |
| FR-34 | `next.config.ts` headers (T4); `access.spec.ts` |
| NFR-1 | Native elements and keyboard flows in `narrow-width.spec.ts`; manual check |
| NFR-2 | Labels, `aria-describedby`, `aria-invalid`, alert element and focus move (T5 to T9); `getByLabel` use in the specs; manual check |
| NFR-3 | Existing tokens only, existing contrast tests; manual check |
| NFR-4 | Guard test and `access.spec.ts`, for the redirect of a page and for the refusal of an operation call (T3, T4) |
| NFR-5 | `use-account-submission`, forms (T5 to T7); both specs |
| NFR-6 | `narrow-width.spec.ts` (T10) with layout rules in T6 to T9 |
| NFR-7 | The seven spec files above (T1, T4, T6 to T10) cover each flow of the list |
| NFR-8 | D10, `test-controls-absent.test.ts` (T1) |
| Completion criteria: 002 FR-29 and FR-31 | Manual checks, section 7 |

## Size check

Expected: **10 tasks of 20 to 30 minutes, with no spare.** Work packages, in dependency order:

| # | Work package |
|---|---|
| T1 | Playwright harness: dependency, config, scripts, shared database preparation, two servers, support helpers, a smoke test, the NFR-8 structural test (items 4, 5, 6) |
| T2 | Return-destination rule and page-access policy with their tests; exports (FR-20 and the rest of the policy) |
| T3 | Guard engine: `readSessionForGuard`, `guardPageRequest`, `src/proxy.ts`, first check of D2 and D5 in the production build |
| T4 | Guard in the browser: `/session-check-failed`, `no-store`, security headers, `access.spec.ts` |
| T5 | Form building blocks: messages, issue messages, interpreter, time limit, submission hook, leaving a page, `confirmSessionStartedAction` |
| T6 | Sign-in page and form with `sign-in.spec.ts` |
| T7 | Sign-up page and form with `sign-up.spec.ts` |
| T8 | User menu, sign-out, workspace top bar, clean start, `sign-out.spec.ts` |
| T9 | Not-found, `error.tsx`, `MinimalTopbar`, `error-pages.spec.ts` |
| T10 | Renewal and cookie properties, narrow-width matrix, final consolidation of the E2E suite |

Honest risk: T3 (two unverified framework behaviors and the proxy scope), T6 and T7 (every state of a form plus its browser tests) and T8 (menu, sign-out, back action, clean start) are the likely overruns; each is at the limit. Adding an 11th task is not allowed. The user decided on 2026-11-08 to keep the 10 tasks and not to split the spec now (item 10). If a task overflows during implementation, the implementer stops and proposes the split: **003 (access: rules, guard, renewal, headers) and 003b (screens: forms, user menu, not-found and error pages)**, with 003b depending on 003.
