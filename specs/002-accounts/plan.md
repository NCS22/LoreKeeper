# Plan 002 — Accounts

Status: approved

Spec: `specs/002-accounts/spec.md` (Status: approved, no open questions; 39 FRs and 2 NFRs). The screens, the page guard and the browser tests are spec 003 (`specs/003-account-screens/spec.md`); what moved there is listed in "Handed over to spec 003".

Every item that `CLAUDE.md` puts under "ASK FIRST" (dependencies, module, layers and folders, schema and migration, environment, edits to existing files, documentation follow-ups) was asked to the user one at a time and answered on 2026-11-06. The 14 answers are recorded, one numbered item each, in the final section "Approvals recorded", and the text of the plan refers to them as "item N". Where an answer leaves a check for the implementer (library versions and compatibility), the plan says what to confirm and that the implementer must stop and ask if the check fails.

## 0. Approach in one paragraph

Accounts become a new module, `accounts`, that owns the rules about display name, email and password, plus the use cases sign up, sign in and sign out. Better Auth is only the engine behind a port: it creates users, checks passwords, creates and deletes sessions and writes the session cookie. It lives in infrastructure and in `src/shared/infrastructure`, never in domain or application. The one acting-user check that every future feature uses lives in `src/shared` (a pure function over a `SessionReader` port), so it is testable without Next.js or a database. The error vocabulary (five new error kinds, one mapper, one action result shape) is built once in `src/shared` so every later feature reports failures the same way. The three Server Actions (sign up, sign in, sign out) are the only entry points; nothing calls them yet and nothing visible changes. Everything is verified with unit, contract and database-backed integration tests, with a controlled clock for the session rules. No browser is needed.

## Inputs already decided (not new decisions)

Recorded here because `docs/open-decisions.md` says the `plan.md` of the executing spec records them (the implementer removes the OD rows at closing, because the planner cannot write outside `specs/`):

- **OD-12 (decided 2026-11-06):** Better Auth with email and password, session in a cookie backed by a database session, one owner per universe, no sharing in Phase 1. `AuthenticationError` is used from the start; a resource of another user is reported as not found; `AuthorizationError` (403) stays reserved. Social sign-in, email verification and password recovery are deferred to Phase 5. This plan records it; the row in `docs/open-decisions.md` is removed only when both this plan and plan 003 have recorded it (item 14).
- **OD-18 (decided 2026-11-06):** `zod` is approved (item 1); it only validates the shape of input at the boundary, business rules stay in the domain. The row is removed at closing of this spec (item 14).
- **Spec decisions:** the accepted risks (account-existence disclosure at sign-up, no abuse protection, no response-time equalization) and the exclusions in the spec's "Out of scope". Social sign-in, email verification, password recovery, abuse protection, public API and the deployment target are not designed here.

(OD-17, the browser test tooling, belongs to spec 003; see "Handed over to spec 003".)

## 1. Affected modules and layers

### New module `accounts` (approved, item 4)

| Layer | File (under `src/modules/accounts/`) | Content | FRs |
|---|---|---|---|
| Domain | `domain/account-display-name.ts` | Display-name rule: empty or whitespace-only rejected; control characters (`\p{Cc}`, `\p{Zl}`, `\p{Zp}`) rejected, checked on the raw value so a trailing line break is not silently trimmed; trimmed value limited to 120 code points; inner whitespace kept. Precedence per field: required, then invalid characters, then too long. | 2, 3, 4, 10 |
| Domain | `domain/account-email.ts` | `toComparableEmail` (trim, lower-case) and the valid-email rule: the practical grammar of the spec's "Valid email" definition, which is the grammar of the authentication engine's own email check, so the domain and the engine have one definition (NFR-1, D18). ASCII only; one `@`, no spaces; local part of non-empty parts separated by single dots, made of letters, digits and `_ ' + -` (so no leading, trailing or double dot, and it cannot end with an apostrophe); domain of two or more dot-separated labels (at least one dot), each label starting with a letter or digit and continuing with letters, digits or hyphens, the last one only letters and at least two. Unchanged: at most 254 characters, trimming, lower-casing for the comparable form, and the rule is checked on the trimmed value as typed, before lower-casing (so the Kelvin sign U+212A is rejected). Letters such as `ñ` are rejected. | 1, 5, 9 |
| Domain | `domain/account-password.ts` | Password rule: 8 to 128 code points, kept exactly as typed (no trim, no truncation, no normalization). Exports the limits so no consumer repeats the numbers. | 6, 8 |
| Domain | `domain/new-account.ts` | `NewAccount` type and `parseNewAccount(input)`: applies the three field rules and the repeat-password match together and throws one `ValidationError` listing every failing field. | 2 to 8 |
| Domain | `domain/sign-in-credentials.ts` | `parseSignInCredentials(input)`: only "email empty after trim" and "password empty" are errors; nothing else is checked before the credential check. | 15 |
| Domain | `domain/account-errors.ts` | `EmailAlreadyRegisteredError` (extends `BusinessRuleViolationError`), `InvalidCredentialsError` (extends `AuthenticationError`). | 9, 14, 35 |
| Application | `application/account-authenticator.ts` | Port (decision D3): `registerAndSignIn(newAccount)`, `signInWithPassword(email, password)`, `signOutCurrentSession()`. Registering also starts the session, because the library does both in one step. | 1, 12, 13, 16 to 18 |
| Application | `application/sign-up.ts`, `sign-in.ts`, `sign-out.ts` | The three use cases (section 3). | 1, 9 to 19 |
| Infrastructure | `infrastructure/better-auth-account-authenticator.ts` | Implements the port with the Better Auth server API. Translates the library's "user already exists" and "invalid email or password" outcomes into the two domain errors, and every other failure into `InfrastructureError` keeping the cause for the log. After a failed sign-up it re-checks whether the comparable email now exists, so the loser of a race (FR-11) gets `EmailAlreadyRegisteredError` and not a generic failure. A sign-out without a session is a success (FR-18). | 1, 9, 11, 12, 13, 14, 16, 17, 18 |
| Wiring | `composition.ts` | Binds the three use cases to the Better Auth authenticator and the shared request session reader. Everything heavy (environment, Prisma client, library instance) is created on first use, not at import (section 4, "Starts and builds without a database"). | all |
| Public interface | `index.ts` | Composed use cases, the field names and stable issue codes, the length limits. Nothing else. | |

There is no domain `Account` type, no repository and no account summary in this spec: nothing reads an account back (YAGNI). The first feature that needs to read accounts adds them.

### Shared kernel (new folders `application`, `infrastructure`, `presentation` under `src/shared`: approved, item 5; `domain` exists)

| Layer | File (under `src/shared/`) | Content | FRs |
|---|---|---|---|
| Domain | `domain/error-kinds.ts` | The five new error classes next to the existing `DomainError` and `ValidationError`: `AuthenticationError`, `NotFoundError`, `BusinessRuleViolationError`, `InfrastructureError`, `ExternalProviderError`, each with its stable code (section 4). No `AuthorizationError` class is created (FR-38, decision D11). | 33, 35 to 38 |
| Domain | `domain/validation-error.ts` (modified) | Additive: `ValidationIssue` gets an optional `minimumLength` (the password issue carries both limits, FR-6). Existing fields and tests are unchanged. | 6 |
| Domain | `domain/acting-user.ts` | `ActingUser = { readonly userId: string }`. | 20 |
| Domain | `domain/session-policy.ts` | The only definition of the session numbers: lifetime 30 days, renewal interval 1 day (in seconds). | 23 to 25 |
| Application | `application/session-reader.ts` | Port `SessionReader`: `readActiveSession(): Promise<{ userId: string } \| null>`. It takes no argument, so nothing the client sends can reach it (FR-21). | 21, 26 |
| Application | `application/require-acting-user.ts` | The acting-user check: `requireActingUser({ sessionReader })` returns the `ActingUser` or throws `AuthenticationError`; a reader failure propagates as `InfrastructureError`. | 20 to 22 |
| Infrastructure | `infrastructure/prisma-client.ts` | The single Prisma client, created on first use (reused across hot reloads in development). | 31 |
| Infrastructure | `infrastructure/server-environment.ts` | Reads and validates (Zod) `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` on first use; a missing value is an `InfrastructureError` with a generic message. | 36 |
| Infrastructure | `infrastructure/better-auth-instance.ts` | The one Better Auth configuration (section 4, "Session cookie and library settings"). | 23 to 29 |
| Infrastructure | `infrastructure/better-auth-session-reader.ts` | `createBetterAuthSessionReader(getRequestHeaders)` implementing `SessionReader`. | 20 to 22, 26 |
| Infrastructure | `infrastructure/request-session-reader.ts` | Binds the reader to the headers of the current Next.js request. | 20, 21 |
| Infrastructure | `infrastructure/scrypt-password-hasher.ts` | Only if the installed Better Auth normalizes passwords (decision D10). Uses `node:crypto`, no dependency. | 8 |
| Infrastructure | `infrastructure/server-error-logger.ts` | `logServerError(error, context)` to the server log; never receives request bodies. | 32, 36 |
| Presentation | `presentation/error-messages.ts` | The generic human-readable sentence of each error kind (decision D29). | 36, 39 |
| Presentation | `presentation/map-error-to-response.ts` | The one mapper: error → `{ status, body }` (section 4). Logs infrastructure and unknown errors. | 33 to 39 |
| Presentation | `presentation/action-result.ts`, `run-action.ts` | `ActionResult<T>` and `runAction(work)`, which runs the work, maps errors, and rethrows the framework's control-flow errors (`unstable_rethrow`). | 39 |
| Presentation | `presentation/parse-action-input.ts` | Runs a Zod schema over unknown input and converts a failure into `ValidationError` (issue code `INVALID_INPUT`). | 34, NFR-1 |
| Presentation | `presentation/assert-same-site-request.ts` | Rejects a mutating request that comes from another site (FR-30, decision D14). | 30 |
| Presentation | `presentation/get-acting-user.ts` | Wires `requireActingUser` to the request session reader: the single entry every future Server Action or Route Handler calls. | 20 to 22 |

Dependencies follow `presentation → application → domain ← infrastructure`. `src/shared/application` and `src/shared/domain` import no Prisma, Next.js, React or Better Auth. `UnitOfWork` is not needed (every write is one library call) and is not created (D22).

### Presentation: Server Actions (no page, no route, no component)

New files (folders `src/app/sign-up` and `src/app/sign-in` approved, item 5), each a plain `"use server"` module with no `page.tsx`, so no route exists and nothing visible appears:
- `src/app/sign-up/actions.ts` (`signUpAction`) and `src/app/sign-up/sign-up-input-schema.ts`.
- `src/app/sign-in/actions.ts` (`signInAction`) and `src/app/sign-in/sign-in-input-schema.ts`.
- `src/app/actions.ts` (`signOutAction`).

Modified existing files (approved, item 9; minimum for this feature):
- `src/shared/domain/validation-error.ts`: the additive `minimumLength` above.
- `eslint.config.mjs`: the same `no-restricted-imports` restrictions applied to `src/shared/domain/**` and `src/shared/application/**` (no `@prisma/client`, `next`, `react`, `better-auth`, `infrastructure`); `tests/lint/import-boundaries.test.ts` gets the matching cases.
- `vitest.config.mts`: global setup for the test database and sequential execution of the database-backed files.
- `.gitignore`: the generated Prisma client.
- `package.json` / `pnpm-lock.yaml`: dependencies.

Not touched: `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/**`, `src/messages/en.ts`, `tsconfig.json`, `src/modules/universes/*`, `src/mocks/*`, and every spec 001 test. The workspace stays open to anyone exactly as today.

### Dependencies (approved, items 1 to 3; the list is in "Approvals recorded")

Compatibility check, as far as this plan can verify. There is no registry access in this environment, so **no package version for a new dependency could be verified by the planner**; the approvals in items 2 and 3 are conditional on the implementer's checks below:

| Package | Approved | Verified here | Implementer must confirm |
|---|---|---|---|
| `next` / `react` (existing) | 16.4.5 / 19.3.0 | Pinned in `package.json`. The local Next docs confirm that Server Actions compare `Origin` with `Host`. | |
| `typescript` / `@types/node` / `vitest` | 5.9.3 / 20.19.43 / 5.1.0 | Installed. Node types at 20.19 match Prisma 7's minimum Node (20.19, to be confirmed). | |
| `zod` (item 1) | `^4` | Version 4.6.7 is already in `pnpm-lock.yaml` (pulled in by tooling), so `^4` adds no new download. | |
| `better-auth` (item 2) | latest stable 1.x at install time, caret range | Nothing. | Its peer range for Next 16.4.5 and React 19.3.0, its Prisma adapter against the confirmed Prisma major, the names of the server API calls and of the cookie options used below. The implementer's first step is to read the package's metadata and peer requirements and to **stop and report** if they conflict with Next 16.4.5 / React 19.3.0. |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `@types/pg` (item 3) | Prisma 7 line with the pg driver adapter (`prisma` and `@types/pg` as dev dependencies) | Nothing. | That Prisma 7 is the current major and compatible with Better Auth's adapter; the generator form and `prisma.config.ts` below are the Prisma 7 form. If it is not current or not compatible, the implementer **stops and asks**. |

If any of these cannot be confirmed, the implementer stops (CLAUDE.md "ASK FIRST") and reports; the plan does not guess versions.

## 2. Data

### Prisma schema and migration (approved, item 7)

Four Better Auth tables, written by hand from the library's documented core schema and checked by the integration tests (the library's CLI is not added). `verification` is unused in this version (no email verification) but kept because the library expects it and `data-model.md` lists it among its tables.

| Model | Columns | Constraints |
|---|---|---|
| `User` | `id` uuid, `name` text (display name, trimmed), `email` text (comparable email), `emailVerified` boolean default false, `image` text null, `createdAt`, `updatedAt` | Primary key `id`; **unique `email`**; the migration SQL adds `CHECK (email = lower(btrim(email)) AND char_length(email) <= 254)` so no code path can store a non-comparable email (FR-1, FR-9, FR-11). |
| `Session` | `id` uuid, `token` text, `expiresAt`, `ipAddress` null, `userAgent` null, `userId` uuid, `createdAt`, `updatedAt` | Unique `token`; index on `userId`; FK to `User`, delete cascade. `ipAddress` and `userAgent` are part of the library schema and stay null unless the library fills them; nothing here reads or shows them. |
| `Account` | `id` uuid, `accountId`, `providerId`, `userId` uuid, `password` text null (the hash), token columns null, `createdAt`, `updatedAt` | Index on `userId`; FK to `User`, delete cascade. |
| `Verification` | `id` uuid, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt` | Index on `identifier`. |

- Identifiers: UUID columns (`@db.Uuid`), generated by Better Auth configured with UUID ids (`data-model.md` section 1), plus a database default as a safety net. Timestamps: `timestamptz`, UTC, serialized as ISO 8601 where they leave the server. No JSONB in this feature.
- `deletedAt` does **not** apply to these tables (decision D16): `data-model.md` section 1 gives `deletedAt` to user-content tables, and these are identity and credential tables managed by the library ("no domain fields are added to Better Auth tables without approval", section 3). Account deletion is out of scope, and a soft-deleted user would need every library query to be filtered. Clarifying this in `data-model.md` is an approved documentation follow-up (item 14).
- The password is stored only as a salted hash in `Account.password`; nothing stores or logs it as typed (FR-32).
- Prisma 7 form: `prisma/schema.prisma` with a generator whose output is inside `src/shared/infrastructure/` (git-ignored), so generated types physically sit where only infrastructure may import them; `prisma.config.ts` at the root; migrations in `prisma/migrations/` (the CHECK constraint is added by editing the generated migration before it is applied). The generated client is not committed and there is no `postinstall`: `pnpm prisma generate` is run once by hand after installing (see item 7).
- The module `accounts` has no domain type that mirrors these tables in this spec (section 1).

### Local database (approved, items 6 and 13)

`docker-compose.yml` with one PostgreSQL service (image PostgreSQL 17, item 13; no pgvector yet: OD-10 is Phase 6), a named volume, a port bound to `127.0.0.1` and a health check. Credentials come from environment variables, never from the committed file. A second database for tests is created by the test global setup if missing (no extra init folder).

### Environment variables (approved, item 8)

`DATABASE_URL`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and the Postgres credentials for Compose. `.env.example` lists names with placeholders only. The user creates their own `.env`; agents never read or print it.

## 3. Use cases

One per file in `src/modules/accounts/application/` unless stated. The acting user is always a separate parameter and never part of a command. Sign up and sign in have no actor because the person has no session yet.

| Use case | Dependencies | Input | Result | Errors |
|---|---|---|---|---|
| `signUp(dependencies, command)` | `accountAuthenticator`, `sessionReader` | `{ displayName, email, password, repeatPassword }` | `{ status: "signed-up" \| "already-signed-in" }` | `ValidationError` (all failing fields together), `EmailAlreadyRegisteredError` (business rule violation), `InfrastructureError` |
| `signIn(dependencies, command)` | `accountAuthenticator`, `sessionReader` | `{ email, password }` | `{ status: "signed-in" \| "already-signed-in" }` | `ValidationError` (empty fields only), `InvalidCredentialsError` (same error for unknown email and wrong password), `InfrastructureError` |
| `signOut(dependencies)` | `accountAuthenticator` | none | `void` (also when there was no valid session) | `InfrastructureError` |
| `requireActingUser(dependencies)` (shared) | `sessionReader` | none | `ActingUser` | `AuthenticationError` when there is no valid session; `InfrastructureError` when it cannot be checked |

- Both `signUp` and `signIn` first ask the `sessionReader`; if a valid session exists they return `already-signed-in` and do nothing else: nothing is validated, created or started and the current session is left intact (FR-19). Otherwise they validate with the domain rules and then call the port.
- The validation of `signUp` and `signIn` happens before any call to the port, so no account rule runs on malformed input (NFR-1).
- Where the person goes after a success (a destination) is not decided here: it is spec 003.

## 4. Contracts

### Server Actions (shape validated with Zod, rules in the domain)

Every action is `runAction(async () => { assertSameSiteRequest; parse input; call one use case })` and returns `ActionResult<T>`. Inputs arrive as plain objects, typed `unknown` at the boundary. Schemas use `z.strictObject`, so an unexpected key (for example a `userId` in the body) is a validation failure (part of FR-21). The schemas check only that each field is a string; lengths, formats and the repeat-password match are the domain's (NFR-1).

| Action (file) | Zod input | Use case | Success value |
|---|---|---|---|
| `signUpAction` (`app/sign-up/actions.ts`) | `{ displayName: string, email: string, password: string, repeatPassword: string }` | `signUp` | `{ status: "signed-up" \| "already-signed-in" }` |
| `signInAction` (`app/sign-in/actions.ts`) | `{ email: string, password: string }` | `signIn` | `{ status: "signed-in" \| "already-signed-in" }` |
| `signOutAction` (`app/actions.ts`) | none | `signOut` | `null` |

Result shape (FR-39), identical for every kind:

```
ActionResult<T> = { ok: true; value: T }
                | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, { code: string; minimumLength?: number; maximumLength?: number }[]> } }
```

`fieldErrors` exists only for `VALIDATION_ERROR`. The `message` is a generic sentence per kind from `error-messages.ts`; a consumer that wants its own text chooses it by code and field.

### Error kinds, codes and HTTP status (decided here; the spec keeps HTTP out)

| Error class | Stable code | HTTP | Where the status applies |
|---|---|---|---|
| `ValidationError` | `VALIDATION_ERROR` | 400 | Includes the cross-site rejection (issue field `request`, code `CROSS_SITE_REQUEST`). |
| `AuthenticationError` | `AUTHENTICATION_ERROR` | 401 | Wrong credentials, no session on a programmatic entry point. |
| `NotFoundError` | `NOT_FOUND` | 404 | Also for resources of other users. Defined now, produced by nobody yet (FR-37). |
| `BusinessRuleViolationError` | `BUSINESS_RULE_VIOLATION` | 422 | At sign-up it means "email already registered" (the only business rule of that action). |
| `InfrastructureError` | `INFRASTRUCTURE_ERROR` | 500 | Generic message only; the cause goes to the log. |
| `ExternalProviderError` | `EXTERNAL_PROVIDER_ERROR` | 502 | Defined now, produced by nobody yet (FR-37). |
| anything else | `UNKNOWN_ERROR` | 500 | Logged; generic message. |
| (reserved) authorization | none | 403 | No class, no code, never produced (FR-38). It arrives with sharing (OD-12). |

The mapper returns `{ status, body }` for every error. Server Actions answer the transport with their normal success status and carry only `body` in the `ActionResult`, so the status is not used there; it is there for future Route Handlers and for the guard of spec 003. A test asserts that the table is complete and closed (seven codes). Only the codes are public: stack traces, queries, credentials and internal names never reach a body (FR-36).

### How the specific requirements are handled

- **Already signed in (FR-19):** the use cases read the session first and answer `already-signed-in`; the action returns it as a success value.
- **Repeat-password match (FR-7):** domain rule in `parseNewAccount`; the action carries both fields.
- **Cross-site rejection (FR-30):** three layers. `SameSite=Strict` on the session cookie (FR-28); Next.js's own `Origin`/`Host` comparison for Server Actions; and `assertSameSiteRequest(headers)`, a pure function called first in the three actions, which rejects when `Sec-Fetch-Site` is present and not `same-origin`, or when `Origin` is present and its host differs from `X-Forwarded-Host`/`Host`. A request with neither header (not a browser) is not rejected by this function; the cookie protection covers the real attack. The Better Auth HTTP route handler is **not** mounted: there is no `/api/auth/*` surface, so the actions are the only entry (decision D15).
- **Failure of an action (FR-36):** the action returns `INFRASTRUCTURE_ERROR` or `UNKNOWN_ERROR` with the generic message; the cause is logged; the password is never in the result or the log.

### Starts and builds without a database

Nothing calls the actions yet, so the application must start and build as before, **without a running database and without a `.env`**, until the guard of spec 003 arrives. To guarantee it: the environment is read, the Prisma client is created and the library instance is built on first use, never at import time; a use with a missing environment or an unreachable database fails with the generic `InfrastructureError`, not with a crash at startup. A test imports `composition.ts` with no environment variables and checks that the import does not throw. The only prerequisite is that the generated Prisma client exists (one `pnpm prisma generate`), because `pnpm typecheck` and `pnpm build` compile the files that import it.

### Session cookie and library settings

Configured in `better-auth-instance.ts`, values taken from `session-policy.ts` and the validated environment (names of the options are the library's documented ones and must be confirmed against the installed version):

- Session lifetime 30 days and renewal interval 1 day (FR-23 to FR-25); cookie cache **disabled**, so a sign-out (FR-16) or a deleted row is effective immediately.
- Cookie: `HttpOnly` (FR-27), `SameSite=Strict` (FR-28, item 11), `Secure` exactly when `BETTER_AUTH_URL` starts with `https://` (FR-29), persistent (survives closing the browser, US-3).
- Ids generated as UUID; email and password enabled; sign-up signs in automatically (FR-12); email verification off; password reset not configured.
- Password limits in the library are neutralized (minimum 1, maximum high enough to never reject a 128-code-point password counted in UTF-16 units, at least 256), so the domain rule is the only definition (NFR-1, FR-8).
- The Next.js cookie plugin of the library is used so Server Actions can set and delete the session cookie.

## 5. UI

None in this spec: no visible change. No page, route, form, menu or component is added or changed, the workspace stays open to anyone exactly as today and the sample universes and in-memory creation are untouched, because the spec states that this feature changes nothing visible (the screens are spec 003). The Server Actions have no page that calls them. The requirement that remains from this section is that the application still starts and builds without a database until the guard of spec 003 arrives (section 4, "Starts and builds without a database").

## 6. Spoiler impact

None. Accounts read and write no narrative information: no works, narrative units, reading progress or spoiler boundaries exist in this feature, nothing here is revealed progressively, and the `READER` and `AUTHOR` modes are not touched. No visibility rule is applied, no `ViewerContext` is built, and the mandatory spoiler suite is not required for any task of this plan. The acting-user check built here is the prerequisite for the ownership checks and filtering of later features.

## 7. Tests

Vitest runs `tests/**/*.test.ts`. Database-backed tests need `docker compose up -d` and `TEST_DATABASE_URL`; if the database is unreachable they **fail with a clear message, they are not skipped** (CLAUDE.md NEVER). They run in one process, file by file, after a global setup that creates the test database if missing and applies the migrations. Spec 001 tests run unchanged. There are no browser tests in this spec.

### Unit and application (no database)

| Layer | Test file (mirrors `src/`) | Covers |
|---|---|---|
| Shared domain | `tests/shared/domain/error-kinds.test.ts` | Each class has its stable code; the code list is closed; no authorization class (FR-33, FR-37, FR-38). |
| Shared domain | `tests/shared/domain/validation-error.test.ts` (extended) | `minimumLength` carried; old behavior unchanged. |
| Shared domain | `tests/shared/domain/session-policy.test.ts` | Constants equal 30 days and 1 day in seconds. |
| Shared application | `tests/shared/application/require-acting-user.test.ts` | Valid session → actor; none → `AuthenticationError` and the dependent operation not run; reader failure → `InfrastructureError`, not an authentication error; an unrelated identifier in a request-like object is ignored by construction (FR-20 to FR-22). |
| Shared presentation | `tests/shared/presentation/map-error-to-response.test.ts` | Every class and unknown → code, status, generic message; `fieldErrors` keyed by field; no stack, query or credential in a body; infrastructure and unknown errors logged with the cause (spy) (FR-33 to FR-39). |
| Shared presentation | `.../run-action.test.ts`, `parse-action-input.test.ts`, `assert-same-site-request.test.ts` | Result shape for success and each kind; control-flow errors rethrown; strict schemas reject unknown keys and non-strings; same-origin accepted, `Sec-Fetch-Site: cross-site` and foreign `Origin` rejected (FR-30, FR-39). |
| Accounts domain | `tests/modules/accounts/domain/account-display-name.test.ts` | Empty, whitespace-only, exactly 120, 121, 120 after trimming, emoji as code points, `\n` inside and trailing, tab, U+2028, inner spaces kept, markup accepted as text (FR-2 to FR-4, FR-10). |
| | `account-email.test.ts` | Comparable form (`" Ana@Example.com "`); every valid example of the spec definition accepted (`ana@example.com`, `Ana.Maria@Example.COM`, `x+y@example.co`, `a_b@example.com`, `o'brien@example.com`, `a.b-c@sub.example.co.uk`, `a@1.example.com`) and every not-valid example rejected (`a@localhost`, `a@b`, `a@example.c`, `a@example.c0m`, `a@192.168.0.1`, `a@[192.168.0.1]`, `a..b@example.com`, `.a@example.com`, `a.@example.com`, `a'@example.com`, `{a}@example.com`, `a!b@example.com`, `a=b@example.com`, `a@-example.com`, `a@example..com`, `a@example.com.`, `a b@example.com`, `a@@example.com`, `añ@example.com`, `a@exämple.com`); the Kelvin sign U+212A followed by `ana@example.com` rejected because the rule runs before lower-casing; a 254-character email accepted and a 255-character one rejected (FR-5). |
| | `account-password.test.ts` | 7, 8, 128, 129 code points; astral characters counted once; leading and trailing spaces kept; no normalization (FR-6, FR-8). |
| | `new-account.test.ts` | All failing fields reported together; repeat mismatch; repeat equal to an invalid password adds no repeat error (FR-7). |
| | `sign-in-credentials.test.ts` | Only empties fail; a 3-character password and an invalid email pass to the credential check (FR-15). |
| Accounts application | `tests/modules/accounts/application/sign-up.test.ts`, `sign-in.test.ts`, `sign-out.test.ts` | Against the fake authenticator: outcomes, `already-signed-in` does nothing and keeps the session (FR-19), nothing created on failure, the same error for unknown email and wrong password (FR-14), sign-out without session succeeds (FR-18). |
| Contract (fake leg) | `tests/modules/accounts/application/fake-account-authenticator.test.ts` | Runs the shared contract suite (below) against `tests/support/fakes/fake-account-authenticator.ts`. |
| Composition | `tests/modules/accounts/composition.test.ts` | Importing `composition.ts` with no environment variables does not throw; a use without environment fails with the generic `InfrastructureError` (starts and builds without a database). |

### The contract suite (NFR-2) and the controlled clock

`tests/support/contracts/account-authenticator-contract.ts` is a function that registers the same scenarios for any implementation of the port plus a small test world (`signInAs`, `readSessionWith`, `readAccountByEmail`, `setTime`): sign-up creates one account and a session without asking for the password again (FR-1, FR-12); comparable email stored; display name trimmed (FR-10); duplicate email in other case or with spaces rejected (FR-9); wrong password and unknown email fail with the same error (FR-14); sign-in (FR-13); passwords with leading/trailing spaces and decomposed vs composed accents are different passwords (FR-8); sign-out ends only the current session and the old one is rejected (FR-16, FR-17); sign-out twice and without session succeed (FR-18); and the session lifetime suite:

- a session unused for exactly 30 days is valid; 30 days plus 1 ms is not (FR-24);
- used every day for 400 simulated days it stays valid (FR-25);
- a use less than 24 hours after the last renewal does not change the expiry; a use at 24 hours does, extending it to 30 days from that moment (FR-23);
- a missing, deleted, expired or tampered session token reads as no session (FR-26).

One more scenario guards NFR-1 and FR-5 on the real engine (work package 9, D18): every valid example of the spec definition plus an email of exactly 254 characters goes through `parseNewAccount` and then `registerAndSignIn`, and none of them fails (no `InfrastructureError` because of the email). Optionally, the not-valid examples are also checked against the engine's own email check and found rejected by it, which shows that the domain is not looser than the engine. The scenario is registered in the shared contract suite, so the fake leg runs it too (it only proves that the fake accepts the same values).

It runs against two implementations: the in-memory fake (its clock is injected) and Better Auth plus PostgreSQL (the clock is `vi.useFakeTimers({ toFake: ["Date"] })` with `vi.setSystemTime`, because the library reads `Date`). If the library's boundary differs from the spec at exactly 30 days, the real leg fails and the implementer stops and reports (decision D8).

### Integration (real database)

- `tests/modules/accounts/infrastructure/better-auth-account-authenticator.test.ts`: the contract suite on the real engine, plus two simultaneous sign-ups with the same comparable email create exactly one account and one returns `EmailAlreadyRegisteredError` (FR-11); a new Prisma client and a new library instance see the same accounts and sessions (FR-31, automated part); no readable password in any stored row, in the logger spy, or in any returned value, in success and failure cases (FR-32).
- `tests/shared/infrastructure/better-auth-session-reader.test.ts`: reader with real cookies; a request carrying another account's identifier in header, query or body still reads the session's account (FR-21); a database failure becomes `InfrastructureError` (FR-22).
- `tests/shared/infrastructure/better-auth-instance.test.ts`: the cookie options for an `https://` base URL (`Secure`) and an `http://` one (FR-29, automated part), `HttpOnly`, `SameSite=Strict` (FR-27, FR-28).
- `tests/app/sign-up/actions.test.ts`, `tests/app/sign-in/actions.test.ts`, `tests/app/actions.test.ts`: the actions with `next/headers` replaced by a helper in `tests/support/` that emulates a cookie jar and request headers, against the real composition and database: success values, each error kind in the result shape (FR-39), unknown input keys rejected, the `Set-Cookie` of sign-up and sign-in carries `HttpOnly` and `SameSite=Strict` (FR-27, FR-28), foreign `Origin` rejected and nothing created, no session started and no session ended (FR-30), a signed-in submission processes nothing and keeps the session (FR-19), an infrastructure failure (the authenticator replaced by a failing one) returns the generic result without echoing the password (FR-32, FR-36), sign-out ends only the session in use and succeeds without one (FR-16 to FR-18).
- Lint: `tests/lint/import-boundaries.test.ts` gains the cases for `src/shared/domain` and `src/shared/application`.

### Manual checks by the user (as the spec states)

FR-29 (the secure-connection property over real HTTPS) and the real restart of the application and of the database (FR-31). Docker Desktop and a `.env` file are prerequisites on the user's machine.

Spoiler suite: not required (no query or visibility over narrative data). Verification gate for the feature: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and the migration applied on an empty database. `pnpm test:e2e` does not exist in this spec.

## 8. Decisions

Ids are kept stable. D5, D6, D7, D20, D21, D23, D25, D26 and the screens part of D22 moved to spec 003 (see "Handed over to spec 003"). D29 is new.

| # | Decision | Discarded alternative and why |
|---|---|---|
| D1 | A new module `accounts` for rules and use cases. | Putting them in `shared`: shared must not hold the business logic of a module. Putting them in `universes`: unrelated and would force it to know about users. |
| D2 | The Better Auth instance, Prisma client and session reader live in `src/shared/infrastructure`; the accounts infrastructure imports them. | The instance inside the module: `shared` would have to deep-import the module to read sessions, which the lint forbids. |
| D3 | One coarse port, `AccountAuthenticator` (register-and-sign-in, sign-in, sign-out). | Separate user-store and session-store ports: we would re-implement hashing, token creation and the cookie that the library already does atomically. |
| D4 | Zod checks only the shape at the actions; all rules are in the domain; the library's own password limits are neutralized. | Zod rules or the library's limits as a second definition: the limits would differ (UTF-16 units against code points) and break NFR-1. |
| D8 | Expiry and renewal are enforced by the library, configured from `session-policy.ts`; a clock-controlled contract suite proves the behavior on the fake and the real engine. See item 10 for the meaning of "30 days after last use". | Re-implementing expiry in our code: two sources of truth over the same rows. A library boundary different from FR-24 is a stop-and-report, not a silent workaround. |
| D9 | The session cookie cache is disabled. | Cache enabled: a signed cookie would stay accepted until it expires, so FR-16 (the old session is rejected after sign-out) would fail. |
| D10 | If the installed library normalizes passwords before hashing (I believe its default hasher applies Unicode compatibility normalization), a custom scrypt hasher over `node:crypto` is plugged in through the library's password hook. A test written first decides: composed and decomposed forms of the same letter must be different passwords. | Accepting the default and changing FR-8: weakens passwords by folding distinct characters; it is the user's call through `/sdd-change`, not mine. A hashing dependency: unnecessary, and not approved. The fallback itself is approved (item 12). |
| D11 | The five new error classes live in one file, `error-kinds.ts`. There is no `AuthorizationError` class. | One file per class: five 5-line files. Creating the class now: unused code for a kind the spec says is never produced (FR-38); adding it with sharing is additive. |
| D12 | One stable code per kind; a consumer reads `BUSINESS_RULE_VIOLATION` from sign-up as "email already registered" and `AUTHENTICATION_ERROR` from sign-in as "wrong credentials". | An extra `reason` code in the body: contradicts FR-39's closed shape ("only for validation, the issues keyed by field"). |
| D13 | The mapper returns `{ status, body }` for every error; Server Actions use the body, future Route Handlers and the guard of spec 003 use the status too. | Two mappers: a second table that can drift. |
| D14 | An explicit `assertSameSiteRequest` in the three actions in addition to Next.js's built-in check and the cookie attribute. Rejection is a `ValidationError` (400) with issue `CROSS_SITE_REQUEST`. | Relying only on the built-in check: it cannot be unit tested, and its behavior is the framework's to change. A 403: reserved and never produced (FR-38). |
| D15 | The Better Auth HTTP handler is not mounted. | Mounting `/api/auth/*`: an extra public surface, outside the spec and close to the public API that OD-14 leaves open. |
| D16 | No `deletedAt` on the four auth tables. | Adding it through library extensions: every library query would need the filter, and account deletion is out of scope. |
| D17 | The email is stored in comparable form with a unique constraint and a `CHECK` that the stored value is trimmed and lower-case. | Application-only normalization: a second code path or a manual insert could create `Ana@x.com` beside `ana@x.com`. |
| D18 (changed 2026-11-07) | Valid email = the practical grammar of the authentication engine's own check (spec "Valid email" definition): a domain with at least one dot and a top-level part of at least two letters, a restricted local part, ASCII only, at most 254 characters. The domain and the engine therefore have one definition (NFR-1). Rejects `a@localhost`, `a@b`, `a@example.c`. At sign-in the engine's `INVALID_EMAIL` outcome still maps to the FR-14/FR-15 answer: it is the mechanism of FR-15 (an email of invalid format goes to the credential check and gets the generic authentication error), not a leftover. | The WHATWG ASCII address grammar with no top-level part required (the previous choice of this decision): the engine validates the email before any hook and cannot be configured, so values the domain accepted (`a@localhost`, `a@b`) reached the engine, were rejected there and ended as a generic 500 (`INFRASTRUCTURE_ERROR`), breaking NFR-1. Decided by the user on 2026-11-07 (option 1, align the domain with the engine). The earlier discarded alternative, "requiring a dot in the domain", is now the chosen one and is extended with the top-level part of two letters and the restricted local part. |
| D19 | Display-name control characters are checked on the raw value, before trimming. | Checking after trimming: `"Ana\n"` would be accepted, contradicting FR-4. |
| D22 | No `UnitOfWork` in this feature (the `ViewerContext` part of this decision moved to spec 003). | Creating it now: it has no multi-record write to serve, every write is one library call. |
| D24 | Database-backed tests are part of `pnpm test` and fail loudly without a database. | Skipping them when the database is down: hides regressions (CLAUDE.md NEVER). A separate script: the verification gate would stop covering them. |
| D27 | Prisma client generated inside `src/shared/infrastructure`, git-ignored. | Default location in `node_modules` or a new `src/generated` folder: the first hides it from the lint boundary, the second is a new top-level source folder. |
| D28 | Fakes live in `tests/support/fakes/`; the shared scenario suite in `tests/support/contracts/`. | Duplicating scenarios per implementation: they would drift and NFR-2 would stop being verifiable. |
| D29 | The generic sentence of each error kind lives in `src/shared/presentation/error-messages.ts`, not in the UI dictionary `src/messages/en.ts`. The Server Action files sit in `src/app/sign-up`, `src/app/sign-in` and `src/app/actions.ts` (no page), where spec 003 will put its pages. | A new `errors` group in `en.ts`: edits a file this spec otherwise does not touch (the dictionary belongs to the screens). Actions in a private folder such as `src/app/_account-actions/`: they would have to move later to sit next to their routes, as `architecture.md` section 2 lays out. |

Risks and notes
- **Renewal of the cookie lifetime.** This spec renews the database session whenever the session reader finds it valid after 24 hours (FR-23, tested). A Server Component or an action cannot always refresh the cookie's own lifetime; without that, a person who keeps using the app would lose the cookie at 30 days after sign-in. Refreshing the cookie on page visits is the guard of spec 003 (its completion criterion on the controlled clock). If the library does not return the renewal cookie on its server API, spec 003 must stop and report; here it is only recorded.
- **Library names and behavior** (server API calls, error codes, option names, password hook, adapter) come from my knowledge of the documented API and could not be checked against the installed package; the contract and integration tests are the safeguard and any difference is reported before working around it.
- **Prisma and `cacheComponents`.** The Prisma client is a process-wide singleton created on first use, to avoid exhausting connections in development.
- **`pnpm test` now needs Docker.** From the first task, the database-backed tests fail without a running database (D24); the user must have Docker Desktop and a `.env`.
- **The engine's email rule can change (D18).** The email grammar of the domain copies the check that the authentication engine applies by itself, and that check comes from the engine and its validation library. A future upgrade of either could change it (looser or stricter), and then the domain and the engine would disagree again, with a generic 500 at sign-up as the symptom. The real-engine contract scenario of work package 9 (every valid example and a 254-character email go through `parseNewAccount` and then `registerAndSignIn` and never fail) is the safeguard: it fails on the upgrade, before release, and the grammar is then revised through `/sdd-change`.
- **Renewal reading (item 10).** Accepted: the session expiry moves when the session is used after 24 hours since its last renewal, so a person can be signed out up to 24 hours earlier than the literal "30 days after the very last use". The tests check the boundaries against the last renewal.

## 9. Coverage

Every FR (1 to 39) and NFR (1 to 2) is covered.

| Requirement | Covered by |
|---|---|
| FR-1 | `parseNewAccount`, `signUp`, `registerAndSignIn`; contract scenario, `sign-up.test.ts`, `sign-up/actions.test.ts`. |
| FR-2, FR-3, FR-4 | `account-display-name` rule; `account-display-name.test.ts` (empty, 121, 120, line break), `new-account.test.ts`. |
| FR-5 | `account-email` rule (engine-aligned grammar, D18); `account-email.test.ts` (valid and not-valid examples, Kelvin sign, 254 and 255), and the real-engine contract scenario with the valid examples and 254 characters. |
| FR-6 | `account-password` rule with `minimumLength` and `maximumLength` on the issue; `account-password.test.ts`, `validation-error.test.ts`. |
| FR-7 | `parseNewAccount` repeat check; `new-account.test.ts`. |
| FR-8 | `account-password` (as typed), library password limits neutralized, hasher decision D10; `account-password.test.ts`, contract scenarios. |
| FR-9 | `EmailAlreadyRegisteredError` → `BUSINESS_RULE_VIOLATION`; unique constraint; contract scenario, `sign-up.test.ts`. |
| FR-10 | Display-name rule plus stored trimmed; `account-display-name.test.ts`, contract scenario. |
| FR-11 | Unique constraint plus re-check in the authenticator; simultaneous sign-up integration test. |
| FR-12 | `registerAndSignIn` starts the session; contract scenario (session valid right after sign-up). |
| FR-13 | `signIn`, `signInWithPassword`; contract scenario, `sign-in.test.ts`. |
| FR-14 | One `InvalidCredentialsError` for both causes; contract scenario, `sign-in.test.ts`. |
| FR-15 | `parseSignInCredentials`; `sign-in-credentials.test.ts`, `sign-in/actions.test.ts`. |
| FR-16, FR-17 | `signOut` deletes only the current server session, cookie cache off; contract scenarios, `actions.test.ts`. |
| FR-18 | `signOut` idempotent; contract scenario, `sign-out.test.ts`, `actions.test.ts`. |
| FR-19 | `already-signed-in` in `signUp` and `signIn`; use case tests, action tests. |
| FR-20 | `requireActingUser`; `require-acting-user.test.ts`. |
| FR-21 | `SessionReader` takes no input; strict Zod schemas; `require-acting-user.test.ts`, `better-auth-session-reader.test.ts`, action tests. |
| FR-22 | Reader failure becomes `InfrastructureError`; `require-acting-user.test.ts`, `better-auth-session-reader.test.ts`. |
| FR-23, FR-24, FR-25 | `session-policy.ts`, library configuration (D8, item 10); clock-controlled lifetime suite on fake and real engine. |
| FR-26 | Session reader and contract scenario (missing, deleted, expired, tampered). |
| FR-27, FR-28 | Cookie options (`HttpOnly`, `SameSite=Strict`); `better-auth-instance.test.ts`, `Set-Cookie` in the sign-up and sign-in action tests. |
| FR-29 | `Secure` derived from the base URL; `better-auth-instance.test.ts`; manual check over HTTPS. |
| FR-30 | `assertSameSiteRequest`, Next.js origin check, cookie; unit test and the three action tests. |
| FR-31 | Database persistence; new-connection integration test; manual real restart. |
| FR-32 | Salted hash only; integration scans of rows, logger and results. |
| FR-33 | `error-kinds.ts`, mapper; `error-kinds.test.ts`, `map-error-to-response.test.ts`. |
| FR-34 | `ValidationError` → `fieldErrors` keyed by field; mapper test, `parse-action-input.test.ts`. |
| FR-35 | `InvalidCredentialsError` is an `AuthenticationError`; contract scenario, mapper test. |
| FR-36 | Mapper generic message and logging; mapper test, action test with a failing authenticator. |
| FR-37 | `NotFoundError` and `ExternalProviderError` defined, mapped, produced by nobody; mapper test. |
| FR-38 | No authorization class or code; table reserves 403; `error-kinds.test.ts` (closed list). |
| FR-39 | `ActionResult` built by the one mapper; `run-action.test.ts`, mapper test, action tests. |
| NFR-1 | Zod shape then domain rules, one definition per rule, library limits neutralized, and the email grammar equal to the engine's own check (D18); `new-account.test.ts`, `sign-in-credentials.test.ts`, action tests, and the real-engine email scenario (every email the domain accepts also passes `registerAndSignIn`). |
| NFR-2 | Port plus contract suite on the fake and the real engine. |

Completion criteria: the automated ones are covered by the rows above (including "nothing visible changes": spec 001 tests unchanged and the composition test); the manual ones (FR-29 over HTTPS, real restart) are listed in section 7 and are done by the user.

## Size check

The engine fits in 10 tasks of 20 to 30 minutes. I expect **9 work packages** (8 before the email-grammar change of 2026-11-07), leaving one spare for a split if a package overruns (limit 10):

| # | Work package |
|---|---|
| 1 | Environment: dependencies, Compose, `.env.example`, schema, migration, Prisma client, test-database setup |
| 2 | Shared error kinds, mapper, `error-messages.ts`, `ActionResult`, `runAction`, input parsing, same-site check |
| 3 | Session policy, acting user, `SessionReader`, `requireActingUser` |
| 4 | Accounts domain rules and errors |
| 5 | Accounts use cases, port, fake authenticator, contract suite (fake leg) |
| 6 | Better Auth instance, authenticator adapter, hasher test, contract suite (real leg, without the lifetime scenarios) |
| 7 | Session reader, lifetime suite on the real engine, request reader and `getActingUser`, composition (lazy), public interface, lint extension |
| 8 | Server Actions with Zod and their integration tests (cookie-jar helper) |
| 9 | Email-grammar safeguard (D18): the real-engine contract scenario (valid examples and 254 characters through `parseNewAccount` and `registerAndSignIn`), added to the shared contract suite; needs packages 4 and 6 |

Honestly: **tasks 1 and 6 are at the 20 to 30 minute limit.** Task 1 installs five groups of dependencies, writes the schema and migration, Compose and the global test setup. Task 6 is the riskiest, because it depends on library behavior I could not verify (hasher, duplicate detection, race handling); if the scrypt fallback (D10) is needed it overruns and splits into two. Task 7 is near the limit. If one splits, the total is 10, still within the limit; a second split would exceed it and would call for splitting the spec instead.

## Handed over to spec 003

This is what moved out of this plan so a future plan 003 can start from it. It is not a plan 003 and decides nothing.

**Work that moved**
- The page guard: `src/proxy.ts`, `page-access-guard.ts`, `session-check-failed-response.ts`, `readSessionForGuard` (also returns the renewal cookie headers; it extends `better-auth-session-reader.ts`), the fail-closed page and `src/app/error.tsx`, `Cache-Control: no-store` on guard answers.
- The routes and forms: `/sign-up` and `/sign-in` pages with `_components`, `src/components/accounts/` (field, form shell, issue messages, `interpretAccountActionResult`, submission hook), the user menu `src/components/topbar/account-menu.tsx`.
- In the accounts module: `return-destination.ts` (rule, path constants and builders), `page-access-policy.ts`, an `AccountRepository` with `findById`, its Prisma implementation and mapper, `account-dto.ts` and the `getAccountSummary` use case; their exports in `index.ts`.
- Actions and use case changes: `confirmSessionStartedAction` (blocked-cookie check), the `returnTo` input and the `destination` in the results of `signUp`, `signIn` and their actions and Zod schemas (002 returns only `status`; 003 adds these to files created here and lists them as edits).
- Edits to existing files: `src/app/page.tsx` (reads the account summary), `workspace.tsx`, `topbar.tsx`, `src/messages/en.ts` (groups `accounts`, `accountMenu`, `errors`-style screen texts, `sessionCheckFailed`; 003 may also move `error-messages.ts` there), `tsconfig.json` (includes `playwright.config.ts`).
- Browser testing: dependency `@playwright/test` (`^1.64.1`, same version as the installed `playwright`) and the Chromium download (OD-17), `playwright.config.ts`, the `test:e2e` script, `tests/e2e/accounts/` (`sign-up`, `sign-in`, `access`, `sign-out`, `layout` specs), the Playwright output in `.gitignore`, the unit tests of the pure interface helpers, and the manual checks of 003 (keyboard, screen reader, contrast, focus, browser back after sign-out, accessibility preferences on the sign pages). OD-17 is removed from `docs/open-decisions.md` when spec 003 closes.
- Section 5 UI as a whole, including the states (submitting, narrow width, blocked cookies), the Suspense/`instant = false` handling that `cacheComponents` requires for pages that read the session or `searchParams`, and the Playwright flows against a production build.

**Decisions it inherits (text and discarded alternatives are in the previous version of this plan; 003 re-states them)**
- D5: the guard is `proxy.ts` with a real database check on every page request, because with `cacheComponents` a page or layout check could let content precede the redirect and a tampered cookie would not be rejected.
- D6: the proxy skips requests with the `next-action` header; each action performs its own checks.
- D7: sign-up and sign-in return the destination, the client confirms the session with a second action and then does a full page load; sign-out also ends in a full page load (the clean start of the in-memory universes).
- D20: the return-destination rule rejects any control character and any backslash (browsers strip tabs and line breaks, so `/<tab>/host` would become `//host`).
- D21: the user menu is a new popover in the top bar, not an item of the existing menubar, which is hidden below `md`.
- D22, screens part: the account summary is a read of the actor's own account, so it takes no `ViewerContext` (documented exception to `architecture.md` section 6); to be asked in plan 003.
- D23: the fail-closed page of the proxy is a small inline HTML document.
- D25: Playwright runs against a production build with unique emails per test.
- D26: pure interface logic is unit tested, the rest in Playwright (jsdom and testing-library are deferred by OD-17).

**What 003 can rely on from this spec**
- `signUpAction`, `signInAction`, `signOutAction` returning `ActionResult`; the error codes of section 4; `getActingUser()` from `src/shared/presentation`; field names, issue codes and length limits exported by `@/modules/accounts`.
- `SameSite=Strict` on the cookie (item 11): someone arriving from another site's link sees sign-in first, then goes to the root after one more step. 003 should state this in its plan.
- The session reader renews the database session; refreshing the cookie lifetime on page visits is 003's guard (see Risks and notes).
- Approvals that moved and are to be asked in plan 003 (not part of this plan): the Playwright dependency, `src/proxy.ts` and the routes, the `test:e2e` script, the edits to `page.tsx`, `workspace.tsx`, `topbar.tsx`, `en.ts` and `tsconfig.json`, and the account summary without `ViewerContext`.

## Approvals recorded

All 14 items were asked to the user one at a time and answered on 2026-11-06. Nothing is open: every item below is approved as stated. Items 2 and 3 carry a check the implementer must do before installing; if it fails the implementer stops and asks (these are conditions of the approval, not open questions).

1. **Dependency `zod` (runtime): approved, `^4`.** Version 4.6.7 is already in `pnpm-lock.yaml`.
2. **Dependency `better-auth` (runtime), OD-12: approved, latest stable 1.x at install time with a caret range.** The implementer reads its peer requirements first and **stops and reports** if they conflict with Next 16.4.5 / React 19.3.0.
3. **Dependencies for the database: approved.** `@prisma/client`, `@prisma/adapter-pg`, `pg` (runtime) and `prisma`, `@types/pg` (dev): the Prisma 7 line with the pg driver adapter, **if the implementer confirms it is the current major and compatible**; otherwise it **stops and asks**.
4. **New module `src/modules/accounts`: approved** (domain, application, infrastructure, `composition.ts`, `index.ts`).
5. **New layers and folders: approved.** `src/shared/application`, `src/shared/infrastructure`, `src/shared/presentation`, `src/app/sign-up` and `src/app/sign-in` (Server Action files only, no pages), `tests/support/contracts`, `tests/support/database`.
6. **New top-level files and folders: approved as proposed.** `prisma/` (schema and migrations), `prisma.config.ts`, `docker-compose.yml`, `.env.example` and the `.gitignore` entries for the generated client.
7. **Prisma schema and first migration: approved as in section 2.** Four Better Auth tables (`User`, `Session`, `Account`, `Verification`), unique comparable email, hand-added `CHECK`. No `postinstall` script: `pnpm prisma generate` is run by hand once after installing.
8. **Environment variables and `.env.example`: approved.** `DATABASE_URL`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and the Postgres Docker credentials. The user creates the real `.env`; agents never read or print it.
9. **Edits to existing files: approved.** `src/shared/domain/validation-error.ts` (optional `minimumLength`), `eslint.config.mjs`, `vitest.config.mts`, `.gitignore` and `tests/lint/import-boundaries.test.ts`.
10. **Meaning of "30 days after the last use" (FR-23, FR-24): accepted.** Daily renewal: the expiry moves when the session is used after 24 hours since its last renewal, so the session may close up to 24 hours earlier than the literal reading. Boundaries are tested against the last renewal.
11. **Session cookie `SameSite`: `Strict`.** Consequence for spec 003: someone who arrives from another site's link sees sign-in first, then goes to the root after one more step.
12. **Own scrypt hasher with `node:crypto`: approved as a conditional fallback**, used only if a test written first confirms that the installed Better Auth normalizes passwords (D10). No new dependency.
13. **PostgreSQL image for Compose: PostgreSQL 17, no pgvector** (OD-10 is Phase 6).
14. **Documentation follow-ups: approved.** In `data-model.md` section 1, clarify that the Better Auth tables carry no `deletedAt`; in `architecture.md`, note that the Better Auth instance lives in `src/shared/infrastructure`. At closing, the implementer updates `CLAUDE.md` ("Current status", commands, structure) and removes OD-18 from `docs/open-decisions.md`. OD-12 is removed only when **both** plan 002 and plan 003 have recorded it: whichever of the two specs closes last removes it, after checking that the other plan records it. The planner cannot write outside `specs/`, so the implementer makes the two rules-file notes and the other documentation edits at closing.

Open: none.

### Changes approved after the plan gate

- **Change of 2026-11-07 (valid email), approved by the user on 2026-11-07 (answer to the Change gate, option 1).** The spec now defines a valid email as exactly what the authentication engine's own check accepts (examples and the NFR-1 clause included), because the engine validates the email before any hook and values accepted by the old domain rule ended as a generic 500. Applied to this plan in section 1 (`account-email.ts`), section 7 (`account-email.test.ts` and the real-engine contract scenario), section 8 (D18 changed, new discarded alternative), "Risks and notes" (engine rule can change), section 9 (FR-5 and NFR-1 rows) and the size check (9 work packages). The 14 approvals above are unchanged; this change adds no dependency, module, layer, folder, schema change or edit to an existing file, so it needs no further approval item. `tasks.md` is updated after the plan gate.
