# Decisions - Spec 002 Accounts

Decisions taken after `plan.md` was approved, during implementation, that the plan did not record. Each one was reported by the implementer, shown to the user and approved by the user on 2026-11-07.

## T1 - Environment, schema and test database

Taken in T1 and not recorded then. Written during validation round 1 (finding M-5, approved by the user on 2026-11-07) from the code and the T1 block of `tasks.md`. Where the reason or the discarded alternative is not written anywhere, the entry says "not recorded" instead of guessing. Entries D-T1-1 and D-T1-3 describe the code as T1 left it; the test-database guard is tightened later in the same round (hacker finding L5).

### D-T1-1. `vitest.config.mts` is split into two projects, `unit` and `database`

- **Decided:** `unit` includes `tests/**/*.test.ts` and excludes the database-backed files; `database` includes only those files: `tests/shared/infrastructure/**`, `tests/modules/*/infrastructure/**` and `tests/app/**` (the list `DATABASE_BACKED_TEST_FILES`; a new database-backed test must go in one of these folders). The `database` project sets `fileParallelism: false`, runs `tests/support/database/global-setup.ts` once per run, and hands `testDatabaseUrl` to its tests with `provide`. A failure of the global setup is not thrown: it is provided as `testDatabaseSetupError`, so the database-backed tests fail with that message while the unit tests still run and nothing is skipped (D24 of the plan).
- **Why:** the comment in the file says the database-backed files share one test database, so they run one file at a time; the unit tests keep running in parallel and need no database. The plan (section 7) asked for global setup and sequential database-backed files.
- **Discarded:** not recorded. `tasks.md` T1 step (f) fixed the need (global setup, sequential execution), not the way to do it.

### D-T1-2. `TEST_DATABASE_URL` comes from the shell or from `.env`, and only that variable is taken from the file

- **Decided:** `readTestDatabaseUrl()` returns `process.env.TEST_DATABASE_URL` if it is set; otherwise, if `.env` exists, it parses the file with `util.parseEnv` and takes only `TEST_DATABASE_URL`; otherwise it returns `undefined` and the setup reports that the variable is missing.
- **Why:** the comment in the file: `.env` is read as tool configuration and the rest of it (the development database address, the auth secret) never reaches the tests.
- **Discarded:** `tasks.md` (rules for every task) named Vite's `loadEnv` as one way to read `.env` from `vitest.config.mts`, and `dotenv` was not approved. Why `util.parseEnv` was chosen over `loadEnv` is not recorded; the code comment gives only the "one variable" reason above.
- **Updated on 2026-11-07 (validation round 1, D-L5-a):** `tests/support/database/global-setup.ts` also reads `DATABASE_URL` (shell first, then `.env`, with `util.parseEnv`) in the setup process, only to refuse a test database that is the same as the development one. That value is a local variable of the setup: it is never provided to the tests. `vitest.config.mts` still takes only `TEST_DATABASE_URL`.

### D-T1-3. The test database name must contain "test"

- **Decided:** `global-setup.ts` accepts the database named in `TEST_DATABASE_URL` only if its name matches `/^[A-Za-z0-9_]*test[A-Za-z0-9_]*$/i` (letters, digits and underscores, containing "test"); otherwise the setup fails with a clear message. The same check is what makes it safe to build `CREATE DATABASE "<name>"` with the name quoted (identifiers cannot be bound as parameters).
- **Why:** the comment in the file: the tests empty tables between files, so any database that does not look like a test one is refused.
- **Discarded:** not recorded.
- **Replaced on 2026-11-07 (validation round 1, D-L5-b):** the guard is now `readSafeTestDatabaseName` in `tests/support/database/test-database-guard.ts`: local host only (`localhost`, `127.0.0.1`, `::1`), a name of letters, digits and underscores that ends with `_test` or starts with `lorekeeper_test` (case-insensitive), and not the same database as `DATABASE_URL`. The pattern "contains test" above no longer applies (it accepted `contest` and `lorekeeper_latest`). The quoting of `CREATE DATABASE "<name>"` stays safe for the same reason.

### D-T1-4. `prisma.config.ts` loads `.env` with `process.loadEnvFile` and never overrides a variable that is already set

- **Decided:** if `.env` exists, `process.loadEnvFile(".env")` runs at the top of `prisma.config.ts`; Node's function does not replace variables already present in the environment. The datasource URL is `process.env.DATABASE_URL`.
- **Why:** the comment in the file: Prisma 7 does not read `.env` by itself, and the test setup relies on not overriding, because it runs `prisma migrate deploy` with `DATABASE_URL` set to the test database address.
- **Discarded:** `dotenv`, which is not approved (`tasks.md`, rules for every task, allowed `process.loadEnvFile`).

### D-T1-5. The generated Prisma client is ignored by git and by ESLint

- **Decided:** `.gitignore` has `/src/shared/infrastructure/generated/` and `eslint.config.mjs` ignores `src/shared/infrastructure/generated/**`.
- **Why:** the folder is the generator output of `pnpm prisma generate` (plan D27) and is not committed. The git entry is in the plan (section 1, `.gitignore`). The ESLint entry is not in the plan; its comment says only "Generated by `pnpm prisma generate`; git-ignored", and no reason beyond that is recorded.
- **Discarded:** not recorded.

### D-T1-6. Timestamps are `Timestamptz(3)`

- **Decided:** every `DateTime` column of the four tables is `@db.Timestamptz(3)`: timestamp with time zone and millisecond precision.
- **Why:** the plan asks for `timestamptz` in UTC (section 2); the `(3)` precision is not explained in the plan or in the schema. Not recorded.
- **Discarded:** not recorded.

### D-T1-7. Primary keys have a database default, `gen_random_uuid()`

- **Decided:** every `id` is `@db.Uuid` with `@default(dbgenerated("gen_random_uuid()"))`, so the default lives in the database (the migration has `DEFAULT gen_random_uuid()`), not in the Prisma client.
- **Why:** the plan (section 2): ids are generated by Better Auth configured for UUIDs, "plus a database default as a safety net". Why `dbgenerated` was used instead of Prisma's own `uuid()` is not recorded.
- **Discarded:** not recorded.

### D-T1-8. The comparable-email `CHECK` is added by hand to the migration

- **Decided:** the migration ends with `ALTER TABLE "User" ADD CONSTRAINT "User_email_comparable_check" CHECK (email = lower(btrim(email)) AND char_length(email) <= 254)`: the stored email is trimmed, lower-case and at most 254 characters. Prisma cannot express it in the schema, so it lives only in the migration SQL.
- **Why:** plan D17: no code path, nor a manual insert, can store `Ana@x.com` beside `ana@x.com` (FR-1, FR-9, FR-11).
- **Discarded:** application-only normalization (plan D17).

## T2 - Shared error vocabulary

### D-T2-1. The server error log context holds only the error code

- **Decided:** `logServerError(error, { errorCode })`. The context type has no place for a request body, a password or any other input.
- **Why:** the mapper does not know the name of the action, and the plan gives `runAction(work)` no extra parameters. The error code is useful in a log and cannot contain a secret.
- **Discarded:** a free-form context object (it would let a caller log a request body or a password by mistake).

### D-T2-2. Log format

- **Decided:** `console.error("[server-error] <code>", error)`, so Node prints the whole `cause` chain.
- **Why:** it is the smallest thing that keeps the cause visible in the server log.
- **Discarded:** a custom serializer (more code, nothing needed yet).

### D-T2-3. Where the unknown-error code and the `ErrorCode` type live

- **Decided:** `UNKNOWN_ERROR_CODE`, the `ErrorCode` type and the generic messages are in `src/shared/presentation/error-messages.ts`. They are not in the dictionary `en.ts`.
- **Why:** the unknown error is not a class, so it does not belong in the domain `error-kinds.ts`; the messages are one generic sentence per code and never repeat the thrown message.
- **Discarded:** putting them in `error-kinds.ts` (domain would know about a presentation fallback) or in `en.ts` (the dictionary is for screens; these messages are part of the action result contract).

### D-T2-4. Errors are classified by class, not by their `code` field

- **Decided:** the mapper uses `instanceof`. A `DomainError` with a code the mapper does not know (for example the ones of spec 001) is treated as unknown and logged.
- **Why:** `InvalidCredentialsError` (T4) extends `AuthenticationError` and so falls on 401 by inheritance, without a new table entry.
- **Discarded:** matching on the `code` string (a new error subclass would need a new entry and could silently map to the wrong status).

### D-T2-5. The mapper imports the logger from `src/shared/infrastructure`

- **Decided:** `map-error-to-response.ts` (presentation) imports `logServerError` from the shared infrastructure folder. Tests replace it with `vi.mock`.
- **Why:** `architecture.md` lets presentation import from `src/shared`, and the T3 lint rules only restrict `domain` and `application`.
- **Discarded:** passing the logger in as a parameter of `mapErrorToResponse` (it would change the signature the plan fixes for every Server Action).

### D-T2-6. `ExternalProviderError` is not logged for now

- **Decided:** only infrastructure and unknown errors are logged, as the plan says. Logging the external provider error too is a one-line change in `ERROR_CODES_THAT_ARE_LOGGED`.
- **Why:** nothing produces this error yet.
- **Discarded:** logging it now (no case to justify it).

### D-T2-7. The logger test runs in the database test project

- **Decided:** `tests/shared/infrastructure/server-error-logger.test.ts` stays where the task puts it, so it runs in the `database` project of `vitest.config.mts` and needs PostgreSQL up even though it does not use it.
- **Why:** the task fixes the path, and the project pattern groups everything under `tests/shared/infrastructure/**`.
- **Discarded:** changing `vitest.config.mts` to carve out an exception (a config change outside the task).

### D-T2-8. Generic messages

- **Decided:** one fixed sentence per error code, never the message of the thrown error.
- **Why:** FR-36 and FR-37: nothing internal reaches a response.
- **Discarded:** forwarding the error message for known kinds (it could leak internals if a message is built from internal data).

## T3 - Acting user, session policy and action guards

Reported by the implementer and approved by the user on 2026-11-07.

### D-T3-1. `parseActionInput` produces one issue per field

- **Decided:** issues are unique per `field` and all carry the code `INVALID_INPUT`. An unknown key rejected by `z.strictObject` (for example `userId`) is reported under the name of that key; a failure at the root (null, string, array) uses the field `input`; nested fields use their dotted path. `INVALID_INPUT_ISSUE_CODE` and `WHOLE_INPUT_FIELD` are exported.
- **Why:** FR-34 needs `fieldErrors` grouped by field.
- **Discarded:** one generic issue for the whole body (it breaks per-field errors) and exposing the Zod message (it could echo what the user typed).

### D-T3-2. `assertSameSiteRequest` is stricter than the plan

- **Decided:** it rejects a present `Sec-Fetch-Site` other than `same-origin` (including `none` and `same-site`), and an `Origin` whose host (with port, lowercase) is not the first value of `X-Forwarded-Host` or, if missing, `Host`. It also rejects what the plan left undefined: an unreadable `Origin`, the literal `null`, and an `Origin` with no host to compare against. With neither header present the request is accepted, as the plan says. Its parameter is the structural type `{ get(name): string | null }`, so it takes `Headers` and test objects. `CROSS_SITE_REQUEST_FIELD` and `CROSS_SITE_REQUEST_ISSUE_CODE` are exported.
- **Why:** FR-30 (cross-site rejection). Task T7 must test it end to end.
- **Discarded:** accepting an `Origin` that cannot be verified (it would let the opaque origin `null` through).

### D-T3-3. `requireActingUser` does not wrap the reader's failure

- **Decided:** whatever the session reader throws reaches the caller unchanged. The reader built in T7 must always throw `InfrastructureError`. If it threw anything else, the mapper would treat it as an unknown error (500), never as authentication.
- **Why:** the plan assigns the conversion to the reader.
- **Discarded:** a `try/catch` inside `requireActingUser` that wraps every error as `InfrastructureError` (more defensive, but it duplicates the reader's job).

### D-T3-4. Type of the session reader port

- **Decided:** `SessionReader` is an `interface` with one method without arguments, `readActiveSession()`; `ActiveSession = { userId }` is exported from the same file.
- **Why:** the acting user always comes from the server session, never from a parameter the caller controls.
- **Discarded:** a reader that takes request headers as an argument (it would make the port depend on the web layer).

## T4 - Accounts domain

Reported by the implementer and approved by the user on 2026-11-07. None of them changes the design.

### D-T4-1. The email grammar is checked before lowercasing

- **Decided:** `validateAccountEmail` validates the trimmed value as typed and only then `toComparableEmail` lowercases it. A test covers the Kelvin sign (U+212A).
- **Why:** lowercasing first turns U+212A into an ASCII `k` and the value would pass the ASCII grammar.
- **Discarded:** validating the already lowercased value.

### D-T4-2. One `EMAIL_INVALID` code at sign-up

- **Decided:** an empty email at sign-up gets `EMAIL_INVALID`, with no code of its own. Sign-in has `EMAIL_REQUIRED` and `PASSWORD_REQUIRED`, as FR-15 asks.
- **Why:** FR-5 only speaks of an email that is not valid.
- **Discarded:** an `EMAIL_REQUIRED` code at sign-up.

### D-T4-3. One `PASSWORD_LENGTH_OUT_OF_RANGE` code

- **Decided:** a short, long or empty password gets the same code, carrying `minimumLength` and `maximumLength`.
- **Why:** FR-6 describes one case with both limits.
- **Discarded:** separate codes for short, long and empty.

### D-T4-4. The repeat-password issue does not depend on the password being valid

- **Decided:** `PASSWORDS_DO_NOT_MATCH` on `repeatPassword` appears whenever repeat and password differ, even if the password is itself invalid. If the repeat equals an invalid password, no repeat issue is added.
- **Why:** literal reading of FR-7.
- **Discarded:** omitting the repeat issue when the password already fails.

### D-T4-5. `parseSignInCredentials` returns the comparable email

- **Decided:** the port receives the email in the form that is stored (trimmed and lowercased).
- **Why:** what is searched is the same as what was saved.
- **Discarded:** returning it as typed and normalizing in the adapter.

### D-T4-6. Validation functions follow the spec 001 pattern

- **Decided:** `validateAccountDisplayName`, `validateAccountEmail` and `validateAccountPassword`, with `*_FIELD` and `*_CODE` constants, return a union `{ isValid }`, like `universe-name.ts`.
- **Why:** same shape across modules.
- **Discarded:** throwing from each validator.

### D-T4-7. Internal messages of the two account errors

- **Decided:** `EmailAlreadyRegisteredError`: "An account with this email already exists."; `InvalidCredentialsError`: "The email or the password is incorrect." (one fixed message).
- **Why:** they are internal text; what the person sees comes from the generic message per code (D-T2-8).
- **Discarded:** messages that say which of the two credentials failed (FR-35).

## T5 - Use cases, authenticator port, fake and contract suite

Reported by the implementer and approved by the user on 2026-11-07.

### D-T5-1. Shape of the contract's test world

- **Decided:** the world each implementation offers to the contract has: `accountAuthenticator`, `sessionReader`, `getCurrentSessionToken`, `holdSessionToken`, `readAccountByEmail`, `countAccounts` and `setTime`. `signInAs` and `readSessionWith` are helpers in the contract file, derived from those pieces; they are not members of the world. `countAccounts` checks "only one account"; the token pair models "devices" (who holds the cookie).
- **Why:** the session token is the only thing that differs between the fake and the real engine (in T6 it is the cookie), so T6 does not repeat the helpers.
- **Discarded:** each implementation providing `signInAs` and `readSessionWith` as members, as the plan suggested.

### D-T5-2. The port receives domain objects

- **Decided:** `registerAndSignIn(newAccount: NewAccount)` and `signInWithPassword(credentials: SignInCredentials)`.
- **Why:** two strings in a row can be swapped without a compiler warning, and `parseSignInCredentials` already returns that object (D-T4-5).
- **Discarded:** the positional signature `signInWithPassword(email, password)` of the plan.

### D-T5-3. The fake's clock is not used yet

- **Decided:** `setTime` moves the fake's clock, which only stores `startedAt` in each session. Expiry and renewal are scenarios of T7; the fake has none.
- **Why:** code without scenarios to test it is outside the scope of T5.
- **Discarded:** implementing expiry in the fake now.

### D-T5-4. The contract goes through the domain

- **Decided:** `registerAccount` and `signInWithPassword` of the contract call `parseNewAccount` and `parseSignInCredentials` before using the port, like the use cases do.
- **Why:** the comparable-email and duplicate-in-another-case scenarios then test something real.
- **Discarded:** passing unnormalized strings to the port (the real implementation has a database `CHECK` and would fail for a different reason).

### D-T5-5. The fake stores the password as typed

- **Decided:** it lives only in test memory, is compared exactly, and a code comment says so. FR-32 is a product rule and does not apply to the fake.
- **Why:** hashing in the fake is complexity with no value.
- **Discarded:** hashing the password in the fake.

## T6 - Better Auth instance, real authenticator and contract suite on the real engine

Reported by the implementer and approved by the user on 2026-11-07.

### Finding on the password (D10 triggered)

Better Auth 1.7.18's default hasher applies `password.normalize("NFKC")` before hashing: composed and decomposed `ñ` verified as the same password, and so did full-width letters against their ASCII twin. The own scrypt hasher on `node:crypto` (plan D10, item 12) was therefore connected to `emailAndPassword.password.{hash,verify}`: same cost parameters as the library, 16-byte random salt, `salt:key` in hexadecimal, `timingSafeEqual`, and a malformed hash returns `false` instead of throwing. No new dependency.

### Finding A: the email rule of the library (resolved through `/sdd-change`)

The library validates the email with its own `z.email()` before any hook and offers no option to turn it off; it rejects values the domain accepted (`a@localhost`, `a@b`, `a@example.c`, `a..b@example.com`, `.a@example.com`, `a.@example.com`, `{a}@example.com`). On 2026-11-07 the user decided to tighten the domain rule to the library's, so there is one definition (NFR-1): spec FR-5, plan D18 and the domain code are changed by the change flow, not here. Discarded: translating the library's `INVALID_EMAIL` at sign-up into an `EMAIL_INVALID` validation error (two definitions) and bypassing the library's sign-up endpoint with `internalAdapter` (fragile).

### Finding B: the library's sign-out swallows database errors

If the database fails while the session row is deleted, the library logs it with `logger.error`, goes on and clears the cookie, so sign-out reports success while the session row and token remain valid. Not handled in T6 because the plan says sign-out without a session is a success; it is left to the validation phase (reviewer and hacker).

### D-T6-1. `server.deps.inline` for `better-auth` in the `database` test project

- **Decided:** `vitest.config.mts` gets `server: { deps: { inline: ["better-auth"] } }` in the `database` project. T8 needs it too.
- **Why:** the library's cookie plugin imports `next/headers.js` dynamically from `node_modules`; without inlining, `vi.mock("next/headers")` does not reach it. Measured: without the line 7 of the 18 contract scenarios failed (the session cookie never reached the jar).
- **Discarded:** replacing the plugin in tests (the real configuration would not be tested).

### D-T6-2. The authenticator asks for the instance on every call

- **Decided:** `createBetterAuthAccountAuthenticator({ getBetterAuthInstance, getRequestHeaders })`. The instance is requested at each call, never at import. The request headers are used only by sign-out, which requires them; sign-up and sign-in pass none, so `ipAddress` and `userAgent` stay null.
- **Why:** nothing is created at import (the app must build without `.env`).
- **Discarded:** always passing the headers.

### D-T6-3. Translation of the library's errors

- **Decided:** at sign-up, `USER_ALREADY_EXISTS[_USE_ANOTHER_EMAIL]` becomes `EmailAlreadyRegisteredError`; any other failure does a second lookup with `internalAdapter.findUserByEmail`: if the account exists, `EmailAlreadyRegisteredError`, otherwise `InfrastructureError` with the cause (an `AggregateError` with both failures if the second lookup also fails). At sign-in, `INVALID_EMAIL_OR_PASSWORD`, `INVALID_EMAIL` and `PASSWORD_TOO_LONG` become `InvalidCredentialsError`. An earlier `InfrastructureError`, such as the environment one, is kept as is.
- **Why:** FR-9 (also for simultaneous sign-ups) and FR-15.
- **Discarded:** leaving `INVALID_EMAIL` and `PASSWORD_TOO_LONG` at sign-in as infrastructure errors (it would contradict FR-15).

### D-T6-4. The session reader of the real world is a provisional test replacement

- **Decided:** it uses `api.getSession` with the headers of the cookie jar, in test support. T7 replaces it with `createBetterAuthSessionReader`.
- **Why:** the real reader is T7's work.
- **Discarded:** creating the real reader now.

### D-T6-5. `setTime` of the real world

- **Decided:** it turns on `vi.useFakeTimers({ toFake: ["Date"] })` and calls `vi.setSystemTime`; `afterEach` restores the real timers. No test uses it until T7 adds the lifecycle scenarios.
- **Why:** the world interface already requires it (D-T5-3).
- **Discarded:** leaving it unimplemented.

### D-T6-6. Cookie shape verified in the emulated jar

- **Decided:** the shape of the cookies the plugin writes is checked in the emulated jar (`readLastWrittenOptions`) as well as in `authCookies`: `HttpOnly`, `SameSite=Strict`, `Secure` only for an `https://` address, persistent, and no `session_data` cookie.
- **Why:** FR-27 to FR-29 are about the cookie really written, not only the configuration.
- **Discarded:** checking only the configuration.

## T7 - Session reader, session lifetime suite, persistence check, composition and public interface

Reported by the implementer and approved by the user on 2026-11-07.

### D-T7-1. `server.deps.inline` for `better-auth` moves to the root of `vitest.config.mts`

- **Decided:** the line `server: { deps: { inline: ["better-auth"] } }` that D-T6-1 put in the `database` project is now at the root, so it applies to every project.
- **Why:** adding `tests/modules/accounts/composition.test.ts` (project `unit`, imports Better Auth) made 20 real-engine scenarios fail in a full `pnpm test`: the session cookie never reached the jar. Measured: database tests alone pass, real-engine tests alone pass, and the pair instance + composition fails; with the line at the root everything passes (681 tests, two full runs).
- **Not verified:** the cause. The implementer's unverified hypothesis is that the `unit` project loads the library natively and that affects the other projects of the same run. It is not the module cache: `--fsModuleCache=false` and `--clearCache` changed nothing.
- **Discarded:** moving the composition test to the `database` project (the path is fixed by the task and it needs no database) and testing the composition without importing the library (not possible).

### D-T7-2. Shape of `createBetterAuthSessionReader`

- **Decided:** it takes one object `{ getBetterAuthInstance, getRequestHeaders }`, like the authenticator (D-T6-2), instead of the literal `createBetterAuthSessionReader(getRequestHeaders)` of the task.
- **Why:** the injection in tests stays explicit.
- **Discarded:** two positional parameters with a default instance.

### D-T7-3. What `request-session-reader.ts` exports

- **Decided:** `requestSessionReader` and `readCurrentRequestHeaders`.
- **Why:** the composition needs the same headers for the authenticator's sign-out.
- **Discarded:** another file just for the headers.

### D-T7-4. `createAccountsModule()` is a function, not a singleton

- **Decided:** `composition.ts` exports `createAccountsModule()`, like `createUniversesInMemory`. T8 decides how to use it.
- **Why:** nothing heavy is created at import (the app builds without `.env`).
- **Discarded:** an `accountsModule` already created at import, and parameters to replace dependencies (YAGNI; T8 can use `vi.mock`).

### D-T7-5. The fake implements expiry and renewal

- **Decided:** same rule as the library: valid up to and including the expiry, renewal when 24 hours have passed since the last renewal. It is what D-T5-3 left for T7.
- **Why:** the lifetime scenarios of FR-23 to FR-25 are written once in the contract and run on both legs.
- **Discarded:** keeping the fake without expiry.

### D-T7-6. The contract's numbers are written in the contract

- **Decided:** 30 days and 1 day are literals in the contract, not imported from `session-policy.ts`.
- **Why:** an independent check of FR-23 to FR-25: if someone changes the policy, the contract detects it.
- **Discarded:** importing the constants (the test would be circular).

## T8 - Server Actions for sign-up, sign-in and sign-out

Reported by the implementer and approved by the user on 2026-11-07.

### D-T8-1. Authenticator failures in the action tests

- **Decided:** `vi.spyOn(getBetterAuthInstance().api, "signUpEmail" | "signInEmail" | "signOut").mockRejectedValue(...)` on the real instance. The session reading keeps working and only the engine call fails, so the real path of the authenticator up to the mapper and the log is tested.
- **Why:** the plan said "authenticator replaced by one that fails"; this keeps the real authenticator in the path.
- **Discarded:** `vi.mock` of the authenticator module (more noise, less real) and an unreachable database (the failure would already happen when the session is read, before the authenticator).

### D-T8-2. Real composition over the test database

- **Decided:** `prepareRealCompositionOverTestDatabase()` points the real composition at `TEST_DATABASE_URL` with `vi.stubEnv` and forgets the Prisma client and the Better Auth instance the app keeps in `globalThis`. It also empties the tables, the emulated browser and the headers before each test.
- **Why:** D-T7-4 leaves `createAccountsModule()` without parameters.
- **Discarded:** adding parameters to `createAccountsModule()` (YAGNI) and `vi.mock` of the composition (it would not be the real composition).

### D-T8-3. `createAccountsModule()` is called inside each action

- **Decided:** not at module level of the `"use server"` file.
- **Why:** it is cheap and touches nothing at import.
- **Discarded:** a module-level constant (valid, no advantage).

### D-T8-4. Sign-in tests register the account with the use case

- **Decided:** they register through the use case and then delete the session the sign-up left, to start from "account without a session". `signUpAction` is not used as a seed.
- **Why:** it does not couple test files.
- **Discarded:** using `signUpAction` as the seed.

### D-T8-5. `emulated-next-headers.ts` is extended, additive only

- **Decided:** `headers()` can now carry extra browser headers (`Origin`, `Host`, `Sec-Fetch-Site`) through `setEmulatedRequestHeader` and `clearEmulatedRequestHeaders`. By default there are none, so the T6 and T7 tests do not change.
- **Why:** the same-site guard (FR-30) needs them.
- **Discarded:** a second replacement module for `next/headers`.

### D-T8-6. Name of the test helper

- **Decided:** `prepareRealCompositionOverTestDatabase`, not `use...`.
- **Why:** a `use` prefix triggers `react-hooks/rules-of-hooks` in the lint. No configuration change.
- **Discarded:** disabling that rule for the file.

## T9 - Email rule equal to the engine's, and the safeguard scenario

Reported by the implementer and approved by the user on 2026-11-07. T9 resolves "Finding A" of the T6 section: the domain rule now equals the engine's own check, confirmed against the installed Zod 4.6.7 pattern and by the contract scenario on the real engine (12 valid examples accepted on the fake and on Better Auth with PostgreSQL; 21 not-valid examples rejected by the domain and, sent directly, by the engine with status 400). A 255-character email is rejected by the domain and was not sent to the engine (its form is valid and only the length fails; the length limit is the domain's and the database CHECK's).

### D-T9-1. The spec's examples live in one support file

- **Decided:** `tests/support/account-email-examples.ts` holds `VALID_EMAIL_EXAMPLES`, `VALID_EMAIL_BOUNDARY_EXAMPLES`, `NOT_VALID_EMAIL_EXAMPLES`, `TOO_LONG_EMAIL_EXAMPLE` and `buildEmailOfLength`, used by the domain test and the contract.
- **Why:** one list, no divergence.
- **Discarded:** duplicating the lists in each test, and putting them in the contract (the domain test would import a contract file).

### D-T9-2. The optional real-engine scenario sits in the authenticator test file

- **Decided:** it is in `better-auth-account-authenticator.test.ts`, not in the contract. It calls `api.signUpEmail` directly, skipping the domain, and checks `statusCode: 400`, that no account is created and that no session cookie is written.
- **Why:** the contract goes through the domain, and the authenticator would turn the failure into `InfrastructureError` (D-T6-3).
- **Discarded:** going through the authenticator, and checking the `APIError` class (it fails on class identity: the body validation error comes from another class).

### D-T9-3. The domain rule is composed from named pieces

- **Decided:** `new RegExp` built from `LOCAL_PART_CHARACTER`, `LOCAL_PART_LAST_CHARACTER`, `DOMAIN_LABEL` and `TOP_LEVEL_LABEL`, in the domain's own words. The domain imports neither Zod nor the library.
- **Why:** readability, and it does not copy the library's wording.
- **Discarded:** copying the library's single literal.

### D-T9-4. Boundary examples in the contract

- **Decided:** an apostrophe before a dot (`a'.b@example.com`), a domain label ending in a hyphen (`a@exam-.com`), a local part starting with a digit (`1a@example.com`), 60-character labels and a 254-character email are contract examples.
- **Why:** their acceptance is also proven on the real engine.
- **Discarded:** testing them only in the domain.

## Validation round 1 (2026-11-07): what the reviewer and the hacker found and what was decided

Reviewer verdict: CHANGES REQUIRED (FR-1..39, NFR-1, NFR-2 covered; 812 tests green; two real defects on failure paths). Hacker verdict: RISKS FOUND (0 critical, 0 high, 2 medium M1/M2, 8 low L1..L10, 9 informational). Both reports agree on the two important findings: reviewer I-1 = hacker L1 (sign-out) and reviewer I-2 = hacker M1 (sign-up atomicity). The original reports are kept by the technical team; there is no validation report file.

**Fixed in round 1 (decided by the user on 2026-11-07):**
- I-1 / L1: sign-out must delete the session row itself and fail visibly (infrastructure error) when the deletion fails, before clearing the cookie; with a real-failure test (finding B of T6 is closed this way, not accepted as a risk).
- I-2 / M1: sign-up must be all-or-nothing (the adapter's `transaction` option), must not answer "already exists" for a failure in the middle, with an injected-failure test. This corrects the premise of plan D22 ("every write is one library call, atomically"): the library's three writes were separate because the adapter's transaction option defaults to off.
- L2, L3, L5: the session reader lets Next.js control-flow signals through and treats the library's own 401 `FAILED_TO_GET_SESSION` as no session; `BETTER_AUTH_SECRET` placeholders from `.env.example` are rejected; the test-database guard is stricter.
- M-4, M-5: own test for `request-session-reader.ts`, and the T1 decisions above.
- M-1 was NOT changed: it is an accepted minor (see "Accepted" below).

**Deferred to spec 003 (decided by the user on 2026-11-07), to be recorded in plan 003:**
- I-3: the manual checks FR-29 (Secure cookie over real HTTPS) and FR-31 (real restart of the app and the database) are done when the pages exist, during the validation of spec 003. Steps: FR-29: set `BETTER_AUTH_URL=https://localhost:3000`, serve over HTTPS, create an account, check in DevTools that the cookie has `Secure`, `HttpOnly`, `SameSite=Strict` and the `__Secure-` prefix, then repeat with `http://localhost:3000` (no `Secure`). FR-31: create an account, stop the app, `docker compose restart postgres`, wait until healthy, start the app, reload (session still valid), sign out and sign in again.
- M2 / O-3: the library skips the session renewal for RSC navigations and silently fails to write the renewed cookie from a Server Component; renewal must happen where cookies can be written (proxy, guard or a Server Action), with an acceptance criterion in a real browser (Playwright against a production build: a session used daily by page navigation for more than 30 simulated days stays valid). FR-23 and FR-25 are not considered met in real use by the contract suite alone.
- M-3: the first real run of Server Actions and cookies in the Next.js runtime comes with the E2E tests of spec 003.
- L4: compare Origin against the host of `BETTER_AUTH_URL` and/or a list of trusted hosts and fail at startup in production if the URL is not https (Phase 5 deployment hardening).
- Informational 4, 5 and 7: security headers / CSP, making the same-site guard mandatory for new actions, and a lint rule so only the accounts infrastructure touches the `Session` and `Account` tables (spec 003 or Phase 5).

**Not covered by the user's choices and still open, to be asked again at the next gate:** L6 (scrypt hash format without version or parameters, cost about four times below the OWASP reference remembered by the auditor, not verified on the web; cheapest to change while there are no real accounts), L7 (pnpm 9 runs install scripts of all dependencies; `onlyBuiltDependencies`), L8 (invisible and direction-control characters `\p{Cf}` accepted in the display name; changing the name rule needs `/sdd-change`), L9 (no retention or cap of session rows; Phase 5), L10 (field names reflected in `fieldErrors`), informational 1, 2, 3, 6, 8, 9, and M-2 (unexplained `server.deps.inline` setting), M-6, M-7, M-8.

(Update, after the re-check of round 1: L6, L7 and L10 were chosen by the user for round 2, see below. L8, L9, informational 1, 2, 3, 6, 8, 9 and M-2, M-6, M-7, M-8 stay open.)

### Decisions of the fix passes of round 1, approved by the user on 2026-11-07

Pass A (reviewer findings I-1, I-2, M-4, M-5; M-1 left unchanged):

- **D-VR1-A1. Sign-out reads, deletes, then clears the cookie.** `signOutCurrentSession` reads the session with `api.getSession`, deletes the row with the library context's `internalAdapter.deleteSession(token)` (a failure propagates as `InfrastructureError`) and only then calls `api.signOut` to clear the cookie. Discarded: leaving `api.signOut` as the only step and checking the row afterwards (the library would already have cleared the cookie and the user could not retry).
- **D-VR1-A2. A 401 `FAILED_TO_GET_SESSION` between the read and the delete in sign-out becomes an `InfrastructureError`** (the retry works). Discarded: treating it as "no session" in the same pass, because the session reader's L2 fix covers a similar case. Revisited in round 2 (N3, M-N2).
- **D-VR1-A3. Failure injection in the sign-up atomicity tests uses spies on the library context's `internalAdapter`**, with the real write done before the failure. Discarded: simulating the failure without writing (it would not prove the rollback).
- **D-VR1-A4. Sign-up atomicity: `transaction: true` in the Prisma adapter** (`better-auth-instance.ts`), verified with Prisma 7.10.1 and `@prisma/adapter-pg` by reading the installed adapter and by two injected-failure tests; `translateSignUpFailure` unchanged because the rollback happens before its second lookup. This corrects the premise of plan D22.

Pass B (hacker findings L2, L3, L5):

- **D-L2. The session reader calls `unstable_rethrow(failure)` first** and maps to "no session" only an `APIError` (`instanceof`, imported from `better-auth`) with status 401 and body code `FAILED_TO_GET_SESSION`; the same code with status 500 (a database failure) stays `InfrastructureError`. Discarded: checking only the shape of the object (it would accept anything similar).
- **D-L3. `BETTER_AUTH_SECRET` and the password of `DATABASE_URL` are rejected when they start with `replace-with`** (case-insensitive; the URL password is percent-decoded before comparing); the error names only the variable. Discarded: comparing the password with the exact placeholder text (a one-word change of the example would let it pass).
- **D-L5-a. The setup also reads `DATABASE_URL`** (see the update in D-T1-2). Discarded: comparing only with `process.env.DATABASE_URL` (almost inert in normal use, because that variable lives in `.env`).
- **D-L5-b. The test database name must end with `_test` or start with `lorekeeper_test`, on a local host and different from `DATABASE_URL`** (see the replacement in D-T1-3). Discarded: only the `_test` suffix (it would refuse the name `.env.example` documents if it were `lorekeeper_testing`).
- **D-L5-c. The guard has one function used by the setup and by `requireTestDatabaseUrl()`; the real-composition helper stubs `DATABASE_URL` to the test database, so the comparison with `DATABASE_URL` is not applied there.** Its tests live next to it in `tests/support/database/` and run in the `unit` project; M-N4 (the mirror rule admits only `tests/lint` as an exception) is left to a later decision.

### Accepted

- **M-1 (accepted minor).** In the sign-up and sign-in actions the same-site check and the strict shape check run before the session is read, so a request with a valid session and a body of the wrong shape (not an object, a non-string value or an unknown key) gets a validation error instead of `already-signed-in`. A request of the right shape with invalid values does get `already-signed-in` (`tests/app/sign-up/actions.test.ts:282-288`). Fixing it would move logic into the action or hand unvalidated data to the use case, which the Rules forbid ("Server Actions only validate input, call one use case and map the result"; Zod only at the boundary). The interface always sends four strings. Approved by the user on 2026-11-07.
- **N1 (accepted risk until Phase 5).** The sign-up transaction opens at the start of the library's handler, so each sign-up holds a database connection while the scrypt hash is computed (about 32 MiB in a pool of 4 threads); with no rate limit (Phase 5, OD-9) an anonymous burst of sign-ups could use most of the connection pool (default about 10) and delay sessions, sign-ins and sign-outs. Not measured; no data is corrupted. To be handled with the rate limit in the deployment plan of Phase 5: measure with the real pool when E2E tests exist and set the pool `max` and the transaction timeout explicitly. Approved by the user on 2026-11-07.

### Round 2 of the fix loop (2026-11-07), chosen by the user

From the hacker re-check (N2, N3, N4, N6, L6, L7, L10) and the reviewer re-check (M-N2, M-N3): the guard rejects URL query parameters (N2, and the Prisma output in the migration error message, N6b); the hash format carries its version and parameters (L6); sign-out treats the library's 401 `FAILED_TO_GET_SESSION` like the session reader and rethrows Next.js control signals (N3, M-N2), with the missing action-level and pending-renewal tests (M-N3, N6a); the undecoded placeholder check (N4), `onlyBuiltDependencies` (L7) and a limit on reflected field names (L10). The decisions it took were approved by the user on 2026-11-07 and are recorded below.

- **D-VR2-1. A `DATABASE_URL` that carries `host`, `hostaddr`, `port`, `dbname` or `database` in its query string is refused for the comparison** (an error that names only the variable; the database tests fail with a message, so nothing is weakened). Discarded: computing the effective location the way `pg-connection-string` does (more code, and it depends on the behavior of another tool: Prisma and `pg` may read the query differently).
- **D-VR2-2. Bounds of the password hash.** Format `scrypt$N$r$p$salt$key` (decimal parameters, lowercase hex salt and key; same cost as before: N=16384, r=16, p=1, 64-byte key, 16-byte salt). On verification: N a power of two greater than 1 and at most 65536, r at most 16, p at most 4, salt 8 to 64 bytes, key 16 to 128 bytes, total text at most 512 characters; the worst allowed hash costs about 128 MiB and 0.9 s. Discarded: higher limits (N up to 2^17 or 2^20), which would let a corrupt hash ask for 256 MiB or more per verification. The old `salt:key` format returns `false` (there are no real accounts).
- **D-VR2-3. The predicate `isSessionRemovedWhileRenewing` is exported from `better-auth-session-reader.ts`** and shared with sign-out (`instanceof APIError`, status 401, code `FAILED_TO_GET_SESSION`). Discarded: a file of its own for one function.
- **D-VR2-4. `parseActionInput` reflects at most 12 field names of at most 64 code points each** (`MAXIMUM_REPORTED_FIELDS`, `MAXIMUM_REPORTED_FIELD_NAME_LENGTH`); invalid input is still always rejected, only the report is capped. Discarded: not limiting the names and only cutting the number.
- **D-VR2-5. The migration error message of the test setup is fixed** (exit status plus "run `pnpm prisma migrate deploy` by hand with `DATABASE_URL` set to the value of `TEST_DATABASE_URL`"), so the development database is never the target. Discarded: leaving only "run migrate deploy", which would run against the development database, and printing the tool's output (it may contain host and database names).

### Remaining findings after the two rounds (reported by the hacker re-check of round 2)

Low: **N-G1** (the comparison with `DATABASE_URL` does not recognize the same host written another way: percent-encoded `%6cocalhost`, trailing dot `localhost.`, `%31%32%37.0.0.1`; verified; only matters if the development database also has a test-looking name; the first line of defense, local host plus test-looking name, is intact) and **N-H1** (the password verifier can throw `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` for hashes with N=2, or N=4 with p>=3, because `maxmem` is set to twice the theoretical minimum, against the comment "never throws"; 30 of 200 tested combinations; only someone with write access to the `Account` table can store such a hash; the password is not leaked; no test covers it). Informational: **N-G2** (the setup reads only `.env`, not `.env.local`), **N-E1** (a placeholder password disguised on purpose, a percent-encoded escape that hides `replace-with` together with a malformed escape, escapes the check), **N-P1** (12 or more unknown keys can push `userId` out of the report; the request is rejected anyway), **N-D1** (two copies of `better-auth` in `node_modules/.pnpm`, only one linked; possible clue for M-2), **N-H2** (old hashes keep their cost if the cost is raised; no automatic upgrade at sign-in). The user chose on 2026-11-07 to accept them in writing through `/sdd-change` and close the spec.
