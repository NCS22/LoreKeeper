# Plan 004 — Stored universes

Status: approved

Spec: `specs/004-stored-universes/spec.md` (Status: approved, no open questions; FR-1 to FR-37 and NFR-1 to NFR-6). It builds on specs 001 (the creation rules and form), 002 (acting-user check, error kinds, result shape) and 003 (account screens, page access guard, new-document clean start).

Every item that `CLAUDE.md` puts under "ASK FIRST" was asked to the user and answered; the answers are recorded in section "Approvals recorded" at the end (items 1 to 9), and the decisions with their discarded alternatives are in section 8 (D14 to D22). Two answers also changed the spec, with the user's agreement: FR-8 (5-minute cap on the blocked form) and FR-15 (the exact sections that keep an empty state); the spec stays `approved`. The text of the plan refers to the answers as "item N". Nothing is waiting for approval.

## 0. Approach in one paragraph

The `universes` module stops being a client-side, in-memory toy and becomes a server-side module over PostgreSQL, with the shape the earlier specs prepared: use cases that take the acting user as a separate parameter, a repository port scoped to the owner, a second port for the remembered universe, and a Prisma implementation. Four Server Actions (create, check a name, remember, confirm the account) are the only entry points from the browser; they follow the pattern of specs 002 and 003 (`runAction`, `assertSameSiteRequest`, `getActingUser`, Zod for the shape, the one error mapper). The workspace page reads the own universes and the remembered one on the server, inside a `Suspense` boundary, and hands them to the client as props; the client keeps no copy of the truth other than what it was handed plus what the actions returned. The sample data and everything that can only show it are retired from the application, and the sections that showed it keep their place with honest empty states. Account switching in other tabs is handled on the client by comparing an account key (the user's own identifier, derived on the server) before anything is sent. No new dependency, no new module, no new layer and no new top-level folder; the schema change and the removal of temporary code were approved (items 1 to 3).

## Inputs already decided (not new decisions)

- **Spec 004 itself** records the user's decisions of 2026-11-12: sample content retired now, session-cookie race kept as accepted risk, remembered universe per account, no addresses naming a universe, no limit or pagination of the list.
- **Specs 002 and 003** define the patterns reused here without change: `getActingUser()` (`src/shared/presentation/get-acting-user.ts`), `runAction`, `parseActionInput`, `assertSameSiteRequest`, `mapErrorToResponse` and the closed list of error codes; the page guard (`src/proxy.ts`) with its `401`/`503` plain-text refusals of operation calls (003 D5); `leaveAccountPage` (new document, 003 D6); `runWithTimeLimit` (003 D16); the vocabulary-as-props rule (003 D13: a client component never imports a module index that exports server wiring).
- **OD-6** (decided 2026-11-06, executed by spec 005): nothing here deletes, edits or restores a universe. This plan only prepares the column that spec 005 will use (see section 2).
- **Testing stack** (OD-17, decided): Vitest and Playwright only; `jsdom` and testing-library are not approved, so logic of the interface is extracted into pure functions and unit tested, and behavior in the browser is covered by Playwright (003 D14).

## 1. Affected modules and layers

No new module, no new layer, no new top-level folder. The existing `universes` module is rewritten inside its own folders; `shared` gets nothing new. Layers: `presentation → application → domain ← infrastructure` holds; domain and application import no Prisma, Next.js, React or Better Auth.

| Layer | File (all new or rewritten unless stated) | Content | FRs |
|---|---|---|---|
| Domain (`src/modules/universes/domain/`) | `universe.ts` (edit) | Adds `ownerId`. A universe always has an owner; the type keeps no deletion marker (the repository filters deleted rows, section 2). | 1, 2, 12 |
| Domain | `universe-text.ts` | Pure rule shared by name and description: a text is invalid when it contains the null character or a lone surrogate (`String.prototype.isWellFormed`, Node 20 or later; the implementer confirms the TypeScript library setting and otherwise uses an equivalent regular expression). | 5 |
| Domain | `universe-name.ts`, `universe-description.ts` (edit) | Trim, then validity (new codes `NAME_INVALID_CHARACTERS`, `DESCRIPTION_INVALID_CHARACTERS` on the same fields), then the length in code points; `toComparableUniverseName` first normalizes to NFC and then applies the existing comparison (case, accents, spacing), so composition cannot change the result. Constants and codes stay exported. | 4, 5, 21 |
| Domain | `universe-id.ts` | `parseUniverseId(text)`: a well-formed UUID or a `ValidationError` issue (`UNIVERSE_ID_INVALID`, field `universeId`) for empty, malformed or non-string values. | 35 |
| Domain | `universe-repository.ts` (rewrite) | Port scoped by owner: `findAllOwnedBy(ownerId)` (non-deleted, ordered by creation instant ascending, then identifier ascending), `findOwnedById(ownerId, universeId)` (null when it does not exist, belongs to another owner or is deleted: one answer), `add(universe)`. Still no update or delete method (spec 005). | 11, 12, 31, 35 |
| Domain | `remembered-universe-repository.ts` | Port: `findRememberedUniverseId(ownerId)` and `saveRememberedUniverse(ownerId, universeId)`. One per owner, last write wins. | 24 to 28 |
| Domain | `initial-universe-selection.ts` | Pure rule of FR-26 and FR-27: `chooseInitialUniverseId(ownUniverses, rememberedUniverseId)` returns the remembered one when it is among the own universes, else the first in order, else `null`. | 26, 27, 16 |
| Domain | `universe-errors.ts` | `UniverseNotFoundError` (extends the shared `NotFoundError`, one fixed message, so a foreign and a missing universe look identical). | 35 |
| Application (`.../application/`) | `create-universe.ts` (rewrite) | `createUniverse(dependencies, actor, command)`. Validates name, description and mode together (all failing fields in one `ValidationError`), builds the universe with `ownerId = actor.userId`, one timestamp for `createdAt` and `updatedAt`, a new identifier, and stores it. Returns the DTO. | 1 to 5 |
| Application | `load-workspace-universes.ts` | `loadWorkspaceUniverses(dependencies, actor)`: reads the own universes and the remembered identifier and returns `{ universes, initialUniverseId }` using the domain rule. Replaces `list-universes.ts`. | 11, 16, 26, 27 |
| Application | `is-universe-name-in-use.ts` (rewrite) | `isUniverseNameInUse(dependencies, actor, name)`: compares the comparable name with the own universes only. An empty comparable name is never "in use". | 21, 23 |
| Application | `remember-universe.ts` | `rememberUniverse(dependencies, actor, command)`: validates the identifier (`parseUniverseId`), checks that it is one of the own universes (`UniverseNotFoundError` otherwise, same for foreign and missing) and saves it. | 24, 25, 30, 35 |
| Application | `universe-dto.ts` (edit) | Unchanged shape: no `ownerId` in what leaves the module. | 12 |
| Application | `list-universes.ts` | Deleted (replaced by `load-workspace-universes.ts`). | |
| Infrastructure (`.../infrastructure/`) | `prisma-universe-repository.ts`, `prisma-remembered-universe-repository.ts`, `universe-prisma-mapper.ts` | Prisma implementations. Every query carries `ownerId` and `deletedAt: null`. Any Prisma failure is translated to `InfrastructureError` with the cause attached (the mapper then logs it and answers the generic message). The generated Prisma types never leave this folder. They use the new tables (approved, item 1). | 6, 7, 11, 12, 28 |
| Infrastructure | `in-memory-universe-repository.ts` | Deleted, with its test (approved, item 3). | |
| Module root | `composition.ts` (rewrite) | `createUniversesModule()`: binds the four use cases to the Prisma repositories, `crypto.randomUUID()` and the clock. Touches nothing at creation: the Prisma client is built on first use (as in `accounts`), so importing it and calling it needs no database or `.env`. | 31 |
| Module root | `index.ts` (rewrite) | Exports `createUniversesModule`, its type, `UniverseDto`, the command types and the field names, issue codes and mode list. The index now also pulls in server-only wiring: **client components never import it at runtime** (003 D13). | 31 |
| Presentation, actions (`src/app/universes/`) | `actions.ts`, `create-universe-input-schema.ts`, `is-universe-name-in-use-input-schema.ts`, `remember-universe-input-schema.ts` | Four Server Actions (section 4). A folder with no `page.tsx` is not a route (precedent: `src/app/confirm-session-started/`). | 1 to 3, 7, 10, 24, 25, 30 to 35 |
| Presentation, server | `src/components/workspace/load-workspace-universes-for-page.ts` | Server function used by the workspace page: `getActingUser()`, the module, and the translation of the two session failures (section 3). Returns `loaded`, or `signed-out` for the redirect; an unverifiable session is rethrown to `error.tsx`. | 11, 26, 27, 32, 33 |
| Presentation, server | `src/components/universes/build-universe-form-vocabulary.ts` | SERVER ONLY, like `build-account-form-vocabulary.ts`: reads field names, issue codes, the mode list and the default mode from the module and hands them to the client as a prop. | 4, 5 |
| Presentation, client (`src/components/universes/`) | `universe-form-vocabulary.ts` (types), `universe-issue-messages.ts` (edit: takes the vocabulary, new codes), `interpret-universe-action-result.ts` (pure), `universe-creation-state.ts` (pure reducer), `use-account-guard.ts`, `universes-provider.tsx` (rewrite), `universe-creation-form.tsx` (rewrite), `universe-empty-state.tsx` (edit), `no-universes-empty-state.tsx`, `universe-name-text.tsx` | The client data layer and the form (section 5). The temporary adapter that builds the module in the browser and imports the sample universes disappears. | 4 to 10, 13 to 19, 21 to 25, 29, 30 |
| Presentation, client (`src/components/workspace/`, `sidebar/`, `inspector/`) | `workspace.tsx`, `workspace-state.tsx`, `central-area.tsx`, `sidebar.tsx`, `sidebar-tree.tsx`, `sidebar-rail.tsx`, `inspector-content.tsx`, `inspector-empty-state.tsx` (edits) | Selection comes from props; no work, entity or sample data; empty states (section 5). | 14 to 17, 19, 20 |
| Presentation | `src/messages/en.ts` (edit) | New groups: creation messages (generic failure, unknown result, confirmation, sign in again), no-universes state, empty states of the sections, loading. Existing groups of removed screens are deleted. | 7, 8, 10, 15 to 17 |
| Sample data and its screens | `src/mocks/**` and every component that can only show sample data: graph view, canvas, legend and theme; entity list, badges, icons, type configuration, status badge and the entity creation form; details sheet and knowledge ribbon; work rows of the sidebar and its medium configuration | Deleted with their tests (approved, item 2). Kept: the pure helpers `graph/force-layout.ts`, `graph/label-visibility.ts`, `graph/resolve-css-color.ts` and their tests. | 14, 15, 37 |
| Presentation (small replacements) | `graph-empty-state.tsx`, `entity-list-empty-state.tsx`, `works-empty-state.tsx` (new, tiny) | Honest empty texts of the graph view, the entity list and the works area (D14). The details panel reuses `inspector-empty-state.tsx` with new text. | 15 |
| Presentation | `src/proxy.ts`, `next.config.ts`, `src/shared/**`, `src/modules/accounts/**`, `src/components/accounts/**` | Not touched. `run-with-time-limit.ts` and `signed-out-action-response.ts` are imported as they are. | |

Not touched: the accounts engine and screens, the error mapper and its closed list of codes, `parseActionInput`, `vitest.config.mts`, `.env.example` (no new variable), `package.json` (no new dependency; the dependencies `cytoscape` and `d3-force` stay installed and unused until Phase 3, item 2).

## 2. Data

**Prisma schema change and migration: approved (item 1, option a).** Shape (names follow `data-model.md`, section 3):

```
enum UniverseMode { READER AUTHOR }

model Universe {
  id           String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ownerId      String       @db.Uuid
  name         String
  description  String?
  mode         UniverseMode @default(READER)
  createdAt    DateTime     @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime     @default(now()) @updatedAt @db.Timestamptz(3)
  deletedAt    DateTime?    @db.Timestamptz(3)
  owner        User         @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  rememberedBy RememberedUniverse[]

  @@unique([id, ownerId])
  @@index([ownerId, createdAt, id])
}

model RememberedUniverse {
  userId     String   @id @db.Uuid
  universeId String   @db.Uuid
  updatedAt  DateTime @default(now()) @updatedAt @db.Timestamptz(3)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  universe   Universe @relation(fields: [universeId, userId], references: [id, ownerId], onDelete: Cascade)
}
```

- `Universe` follows the `data-model.md` table with two deliberate differences: **no `coverImageUrl`** (nothing writes it in this version, YAGNI; the column arrives with the spec that needs it) and `deletedAt` **is present** although nothing writes it yet, so "own universes" is correct from day one and spec 005 needs no new column for the trash. Repositories already filter `deletedAt IS NULL`; an integration test inserts a deleted row directly and checks it is neither listed, nor counted for the duplicate warning, nor accepted as remembered.
- `RememberedUniverse` is user state, not content: `updatedAt` only, hard-deleted with its user or universe (`data-model.md`, section 1). The composite foreign key `(universeId, userId) → Universe(id, ownerId)` makes the database refuse a remembered universe that belongs to another account, even if a bug in the application tried. One row per account (the primary key is `userId`); writing is an upsert, last write wins (FR-28 and the accepted risk).
- The `User` model gets two relation fields (`universes`, `rememberedUniverse`); no column of a Better Auth table changes. `data-model.md` says no domain field is added to those tables without approval; the relation fields add no column and were part of the approval of item 1.
- The migration also adds `CHECK` constraints: `char_length(name) BETWEEN 1 AND 120` and `description IS NULL OR char_length(description) BETWEEN 1 AND 2000` (PostgreSQL counts code points in a UTF-8 database, the same unit as the domain). The null character cannot be stored by PostgreSQL and a lone surrogate would be silently replaced by the driver, which is why FR-5 is enforced before storage. The migration must apply cleanly on an empty database (`pnpm prisma migrate dev`, and `migrate deploy` in the test setup).
- `ownerId` references `User` with `ON DELETE CASCADE` so that the existing test helper `emptyAuthenticationTables` (it deletes users) keeps emptying everything without change. Deleting an account is out of scope; the cascade only serves tests and the future purge.
- JSONB attributes: none. Information stored per universe is closed (name, description, mode).
- Dates: UTC, `timestamptz(3)`. The use case supplies one `Date` for both timestamps, so they are identical (FR-3); the millisecond precision of `Date` and of the column match.
- The remembered universe is documented at closing in `data-model.md` as a new section after `UserPreferences` (which it does not touch).

## 3. Use cases

One per file in `src/modules/universes/application/`. The acting user is always the second parameter and never part of a command. `ViewerContext` is not used: these operations receive the acting user only (approved, item 8, D20).

| Use case | Dependencies | Input | Result | Errors it throws |
|---|---|---|---|---|
| `createUniverse(dependencies, actor, command)` | `universeRepository`, `generateUniverseId`, `getCurrentTime` | `{ name, description: string \| null, mode }` as typed, before trimming | `UniverseDto` | `ValidationError` (all failing fields together: `name`, `description`, `mode`; a text with the null character or a lone surrogate is a validation issue on its field, never an infrastructure failure); `InfrastructureError` from the repository |
| `loadWorkspaceUniverses(dependencies, actor)` | `universeRepository`, `rememberedUniverseRepository` | none | `{ universes: UniverseDto[], initialUniverseId: string \| null }` | `InfrastructureError`. A remembered identifier that is not among the own universes is not an error (FR-27). |
| `isUniverseNameInUse(dependencies, actor, name)` | `universeRepository` | the name as typed | `boolean` | `InfrastructureError`. Never a validation error: an invalid or empty name is simply "not in use". |
| `rememberUniverse(dependencies, actor, command)` | `universeRepository`, `rememberedUniverseRepository` | `{ universeId: string }` | `void` | `ValidationError` (empty or malformed identifier, field `universeId`); `UniverseNotFoundError` (well formed but foreign, deleted or nonexistent: the same error, the same message); `InfrastructureError` |

Acting-user and session failures (FR-32, FR-33):

- Server Actions call `getActingUser()` before anything else (after the same-site check). It throws `AuthenticationError` for a missing or expired session and `InfrastructureError` when the session cannot be checked; in both cases the use case is not called and nothing is read or changed (002 FR-20 to FR-22).
- The page loader `load-workspace-universes-for-page.ts` translates the same two failures: `AuthenticationError` becomes the `signed-out` outcome (the page redirects to the sign-in address); `InfrastructureError` is rethrown, so `error.tsx` shows the generic page and the person is not treated as signed out.
- Unknown keys, owner or account data sent by the client never reach a use case (section 4, schemas strip them). The owner of a new universe is `actor.userId`, nothing else.
- Creating and remembering are separate use cases and separate actions on purpose (FR-30: a failure to remember must never fail or undo a creation, so they cannot share a transaction); the client calls the second after the first (D3).
- No `UnitOfWork`: every write is one statement.

## 4. Contracts

### Server Actions (`src/app/universes/actions.ts`)

Every action is: `runAction(async () => { assertSameSiteRequest(await headers()); const actor = await getActingUser(); const command = parseActionInput(schema, input); return module.useCase(actor, command); })`. **The order differs from 002 on purpose**: the actor is read before the input is parsed, so a person without a session gets the authentication error and learns nothing about validation (FR-32).

| Action | Input schema (Zod, shape only) | Use case | Success value |
|---|---|---|---|
| `createUniverseAction(input: unknown)` | `z.object({ name: z.string(), description: z.string().nullable(), mode: z.string() })` | `createUniverse` | `{ universe: UniverseDto }` |
| `isUniverseNameInUseAction(input: unknown)` | `z.object({ name: z.string() })` | `isUniverseNameInUse` | `{ isInUse: boolean }` |
| `rememberUniverseAction(input: unknown)` | `z.object({ universeId: z.string() })` | `rememberUniverse` | `null` |
| `confirmAccountAction()` (no input) | none | none (only `getActingUser()`) | `{ accountKey: string }` (the identifier of the acting account, derived on the server; used by the tab to detect an account change, section 5) |

- **Unknown keys are stripped, not rejected.** The schemas use `z.object` (the default strips extra keys), unlike the `z.strictObject` of specs 002 and 003, because FR-2 says owner, account or acting-user data sent by the client is "ignored without error". A test sends `ownerId`, `userId`, `accountId` and a foreign `universeId` together with valid data and checks that the result is the same as without them. A missing key is a shape failure (`VALIDATION_ERROR`, code `INVALID_INPUT` on that field); an empty or malformed identifier is a domain failure (`UNIVERSE_ID_INVALID`). Both are the same error kind (FR-35).
- Result shape (FR-34), unchanged from 002: `{ ok: true, value } | { ok: false, error: { code, message, fieldErrors? } }`, built only by the one mapper. Codes used here: `VALIDATION_ERROR` (with `fieldErrors` keyed by `name`, `description`, `mode` or `universeId`), `AUTHENTICATION_ERROR`, `NOT_FOUND`, `INFRASTRUCTURE_ERROR`, `UNKNOWN_ERROR`. The generic message of the last two contains no stack trace, query, credential or internal name; the cause goes to the server log.
- The mapper logs only infrastructure and unknown failures. FR-30 also asks to record a stale or foreign identifier: `rememberUniverseAction` logs a `NOT_FOUND` or `VALIDATION_ERROR` outcome itself with `logServerError` (log and rethrow, no swallowing) and leaves the infrastructure case to the mapper, so nothing is logged twice. A missing session is not logged (it is not a failure).
- Cross-site requests are rejected by `assertSameSiteRequest` exactly as in 002 and 003.
- **Without a session**: a call from a workspace address is refused by the proxy before it runs, with the `401` text "Signed out." (the session cannot be checked: `503`, "The session could not be checked."); a call that reaches an action from a public page (the sign-in page lets action calls through) is refused by `getActingUser()` with `AUTHENTICATION_ERROR`. Both nothing-read, nothing-changed (FR-32). The tests cover both doors.

### What the screen does with each answer (pure, `interpret-universe-action-result.ts`)

The function receives how the call ended (the `TimeLimitedOutcome` of 003: answered, timed out, or rejected) and the kind of operation, and returns a closed outcome. The refusals of the proxy arrive as thrown errors whose text is compared with the two constants of `signed-out-action-response.ts` (client-safe).

| Answer | Create | Check name | Remember | Load (server) |
|---|---|---|---|---|
| ok | `created(universe)` | the boolean | nothing | the data |
| `VALIDATION_ERROR` with issues on `name`, `description`, `mode` | `field-errors` (keep values, focus the first field) | no warning | ignored | not applicable |
| `VALIDATION_ERROR` on `request`, `input` or `universeId` | `generic-failure` | no warning | ignored | |
| `AUTHENTICATION_ERROR`, or the `401` text | `sign-in-again` (FR-10: keep values, message with the sign-in link) | `signed-out` (go to sign-in) | `signed-out` | redirect to sign-in |
| `INFRASTRUCTURE_ERROR`, `UNKNOWN_ERROR`, any other code, malformed result, or the `503` text | `generic-failure` (FR-7, FR-10 second sentence; never treated as signed out) | no warning (silent) | ignored (silent) | `error.tsx` |
| `NOT_FOUND` | not produced | not produced | ignored (silent, logged by the server) | not produced |
| thrown error that is neither refusal (connection lost, answer unreadable) | `result-unknown` (FR-8) | no warning | ignored | |
| no answer in 30 s | `result-unknown`, request still alive, form still blocked (FR-8) | no warning | ignored | |
| no answer in 5 minutes | the form is released, `result-unknown` stays; a later answer is still applied (FR-8, D17) | no warning | ignored | |

`generic-failure` and `result-unknown` have different texts and different message codes (`CREATION_FAILED` and `CREATION_RESULT_UNKNOWN`, written as an inert `data-message-code` attribute on the message element so the browser tests can tell them apart). A late success after `result-unknown` is `created(universe)` plus the code `CREATION_CONFIRMED_AFTER_DELAY`.

## 5. UI

### Routes, rendering and data flow

- No new route and no address names a universe (FR-29): selecting a universe changes no URL, `returnTo` never carries an identifier, and the workspace stays at `/`.
- `src/app/page.tsx` still renders `<Workspace />`. `Workspace` becomes a Server Component that renders the static shell inside `<Suspense fallback={<WorkspaceLoading />}>` and, inside it, an async server component that calls `load-workspace-universes-for-page.ts` and renders the existing providers with `initialUniverses`, `initialSelectedUniverseId`, `accountKey`, `signInAddress` (built with `buildSignInAddress(null)`, as the user menu does) and the form vocabulary as plain props. With `cacheComponents` the dynamic reads must live inside the boundary, as the user menu loader already does. The loading fallback has a polite status ("Loading your universes") and no universe data.
- **Client state is split in two.** `UniversesProvider` owns the list, the creation lifecycle and the calls to the actions; `WorkspaceStateProvider` keeps interface state (selected universe, view, form open, panels). The selected universe starts from the server's `initialUniverseId` (remembered, else oldest, else none). `selectedWorkId`, `selectedEntityId`, `highlightedEntityId`, `expandedUniverseIds` and `isCreatingEntity` disappear from the state (items 2 and 5); `workspace-state.test.ts` changes with them.
- **Selecting a universe** updates the screen at once and then, if it is a different universe, calls the confirm-account check and `rememberUniverseAction` without waiting; every failure of the second is silent (FR-30). Next.js runs a client's Server Actions one after another, so two quick selections are stored in order and the last wins.

### Account change in other tabs (FR-18) and clean start

- The new-document rule of 003 (D6) already gives the clean start after sign-up, sign-in and sign-out in the tab that does it: `window.location.replace` creates a fresh document, so selection, list, an open form with half-typed values and every notice are gone. A browser test with a half-typed form and a pending notice proves the widened definition of "account-scoped state".
- **Other tabs.** The workspace carries the `accountKey` it was rendered for. `use-account-guard.ts` does two things: (1) on load it posts that key on a `BroadcastChannel` named `lorekeeper-account` and listens; a tab that hears a different key replaces its own document with the workspace root (the guard then decides what the new session may see), so nothing of the earlier account stays in it; (2) **before every create and every remember**, the tab calls `confirmAccountAction` and compares the key it holds with the answer: different, it sends nothing and replaces the document; authentication error, it follows FR-32 (a creation keeps its values and offers sign-in, FR-10); infrastructure failure or no answer in a short time, it goes on (the real call will fail by itself). The key is never sent back to the server as identity: the server ignores any account data (FR-2), so this check is purely client-side and cannot be used to act for another account (D4).
- The name check is a read of the own universes of whoever the session is now; it is not guarded by the probe, but the broadcast clears the tab as soon as another tab loads the workspace under a new account.

### Components and states

| Component | Rendering | Notes |
|---|---|---|
| `Workspace` (edit) | Server, static shell + `Suspense` | Skeleton while the data loads (state: loading). |
| `UniversesProvider` (rewrite) | Client | Holds `universes`, the creation lifecycle (`universe-creation-state.ts`, a pure reducer: `idle`, `submitting`, `result-unknown` with the request alive, and `result-unknown` released after 5 minutes, with the message code), `createUniverse`, `isUniverseNameInUse`, `rememberSelection`, `signInAddress`, the vocabulary. The lifecycle lives here, not in the form, so a late answer is applied even if the form was closed meanwhile (FR-8). |
| `UniverseCreationForm` (rewrite) | Client | Same fields, labels, mode choice and rules as 001. Values are kept on every failure. A message area (`role="alert"`, `tabIndex={-1}`, focus moved to it, as in the account forms) shows `generic-failure`, `result-unknown` and `sign-in-again` (with a link to the sign-in address); the confirmation after a late success is `role="status"`. The submit button is disabled and the form has `aria-busy` while the request is alive; a synchronous reference blocks a second submission from a click, Enter or both (FR-9). While the answer is late (after 30 s, until it arrives or 5 minutes have passed since the submission) the form stays blocked, the rest of the workspace usable and Cancel enabled. After the 5 minutes (client-side cap, a timer started with the submission, D17) the submit button is enabled again with the unknown-result message still shown; the request is not aborted (Server Actions cannot be), and if its answer arrives later and the universe was created it is applied as a normal success and the message becomes the confirmation. A second submission started after the cap can leave two universes; the live duplicate-name warning helps the person notice it (spec FR-8). |
| Duplicate-name warning | Client, inside the form | Same live region as today. The check is a Server Action called after the person stops typing for 250 ms; an answer that arrives after the name changed again is ignored; a failed check shows nothing. The comparison is made on the server against the stored data (FR-21), so a universe created in another tab counts. |
| `NoUniversesEmptyState` (new) | Client | Shown when no universe is selected: says there are no universes yet and has one button "Create your first universe" that opens the form (FR-16). The toolbar of views is not shown because there is no universe. |
| `UniverseEmptyState` (edit) | Client | Shown for the selected (always empty) universe: name, mode (Reader or Author, with its short explanation) and description as plain text, then the honest text "This universe is empty. Works, entities and relationships arrive in future versions." No button, no link. Focus moves to the heading and "Universe created: <name>" is announced only right after a creation, as today. Showing mode and description is the minimum that lets a person (and the browser test of the completion criteria) see that name, description and mode were kept (D8). |
| Sections that showed sample content (items 2, 4, 5; spec FR-15 as clarified) | Client | The graph view and the entity list each show an honest empty text; the works area of the sidebar shows "No works yet" under the universe list; the details panel's empty state says that knowledge, relationships, events, sources and reading positions arrive in future versions. The disabled "Open timeline" entry of the menu bar stays disabled, as do the other "Not available in this prototype" entries. The enabled "New element" button and the entity creation form are removed (item 5). No section offers a control that does nothing. The view switcher, the sidebar rail and the panel toggles stay. |
| Sidebar tree (edit) | Client | Keeps the single-tab-stop tree pattern, now with the universes only (the level of works and the expansion state go with the sample works). Scrolls inside its own area with no limit and no pagination (FR-20). |
| Texts of the person | Client | A universe name or description is always a React text node inside a `<bdi>` with `unicode-bidi: isolate` and `overflow-wrap: anywhere` (component `universe-name-text.tsx`), never HTML. Names wrap, they are not cut with an ellipsis, so the full text is visible and nothing needs a tooltip to be read; the rail's tooltip and accessible label carry the full name. Description keeps its line breaks (`whitespace-pre-line`). |

Accessibility (NFR-4): native controls and the existing roving-focus tree; every field keeps its visible `<label>` and its linked error; the three messages are announced (`role="alert"` for failures and sign-in-again, `role="status"` for the confirmation) in the same way as the account messages of 003; no new colors or tokens (the existing contrast tests keep covering the tokens); focus order is toolbar, content, form. Keyboard-only completion and screen-reader behavior are checked manually by the user, as the spec's completion criteria say; the browser tests assert tab order and Enter/Escape where they can. Layout at 320 px (NFR-6): the form and the empty states are single columns with `min-w-0` and wrapping, the navigation is the existing drawer with its own scroll, and a test with a 120-character name and a 2000-character description asserts that nothing scrolls horizontally outside the navigation.

### Sample data and `src/mocks` (approved, item 2, option A)

After this spec: no file under `src/` imports `@/mocks`, no sample string is in any served page, static file or answer (FR-37), and a structural test fails if a sample marker or a `@/mocks` import appears in `src/` again. The unique markers are taken from the sample files themselves **before they are deleted**, as the first step of that task, one per type, chosen so a person cannot type them by accident: identifiers and long phrases, never a plain name (for example the universe identifier `universe-ember-concordat` and a distinctive sentence of its description; the work title "Ashes of the Concordat: The Animation"; the event identifier `event-signing-of-the-concordat`; a source title such as "Author afterword, Volume 2"; and the first identifier of an entity, a relationship and a reading position read from `entities.ts`, `relationships.ts` and `positions.ts`). A universe the user names "The Ember Concordat" is therefore not a leftover.

## 6. Spoiler impact

None, as the spec states: there are no works, narrative units, reading progress or spoiler boundaries, and the remembered universe is a pointer. No visibility rule exists to apply, no `ViewerContext` is built (item 8, D20) and the spoiler suite is not required in any task. In its place:

- **Account-isolation tests (NFR-3)**, at three levels: (1) use cases, with two actors, run against both storages (fake and PostgreSQL): the lists never cross, the name check ignores the other account's names, `rememberUniverse` with a foreign identifier and with a nonexistent one give identical errors and store nothing, the remembered universe of one account never appears in the other; (2) Server Actions with a real session and database: forged `ownerId`, `userId`, `accountId` and foreign `universeId` are ignored; (3) browser: two accounts in two contexts see only their own universes, a name that exists only in the other account shows no warning, a forged action call without a session reads and changes nothing.
- Every read path touched is owner-scoped in the repository (`ownerId` in every query), not in the interface.

## 7. Tests

Tests live in `tests/`, mirroring `src/`. `pnpm test` runs database-backed tests as today (PostgreSQL running, `pnpm prisma generate` once). No test needs `jsdom`.

### Vitest

| Layer | Test file | Covers |
|---|---|---|
| Domain | `tests/modules/universes/domain/universe-text.test.ts` (new) | Null character, lone high and low surrogate, valid emoji (a surrogate pair), valid text (FR-5) |
| Domain | `.../universe-name.test.ts`, `universe-description.test.ts` (edit) | Existing cases plus FR-5 codes on the right field; exact limits (120 and 121, 2000 and 2001) by code points after trimming; an emoji counts one, a letter plus a combining accent counts two; a whitespace-only description is `null`; comparable name equal for composed and decomposed forms, different case, accents and spacing (FR-4, FR-21) |
| Domain | `.../universe-id.test.ts`, `initial-universe-selection.test.ts`, `universe-errors.test.ts` (new) | Empty, malformed and valid identifiers; remembered available, remembered missing, no remembered, no universes; same message for any not-found (FR-26, FR-27, FR-35) |
| Application (both storages) | `tests/modules/universes/application/create-universe.test.ts`, `load-workspace-universes.test.ts`, `is-universe-name-in-use.test.ts`, `remember-universe.test.ts` (rewrite, replace `list-universes.test.ts`) | `describe.each` over the **two storages** of NFR-1: a fake in `tests/support/fakes/` and the PostgreSQL repositories. Scenarios: valid creation (owner, identifiers, equal timestamps, no description when blank), every validation failure together, nothing stored on failure, listing by owner in creation order with ties by identifier, the name check against own universes only, remembered universe and its fallbacks, isolation between two actors, foreign and nonexistent identifier identical (FR-1 to FR-5, FR-11, FR-12, FR-21, FR-23 to FR-28, FR-31, FR-35, NFR-1, NFR-3) |
| Application | `tests/modules/universes/composition.test.ts` (rewrite) | Importing the module and calling `createUniversesModule()` needs no environment and no database; the four functions exist (as the accounts composition test) |
| Infrastructure (database) | `tests/modules/universes/infrastructure/prisma-universe-repository.test.ts`, `prisma-remembered-universe-repository.test.ts` | The repository contract (`tests/support/contracts/universe-repository-contract.ts`, run also against the fake: NFR-1); database refuses a remembered universe of another owner; a row with `deletedAt` set is invisible; limits enforced by the `CHECK` constraints; a Prisma failure becomes `InfrastructureError` with the cause; **persistence (FR-6)**: after writing, the application's Prisma client is disconnected and forgotten, all backend connections are terminated from a second connection, a new client is built and the universes and the remembered one are read back unchanged. Restarting the PostgreSQL process itself is not done by a test (a test cannot safely restart Docker); durability across that restart is the database's guarantee and is reported as such at validation (D9) |
| Presentation (database) | `tests/app/universes/actions.test.ts` (new, same style as `tests/app/confirm-session-started/actions.test.ts`) | Each action with a session; without a session (`AUTHENTICATION_ERROR`, nothing stored: the test counts rows); unverifiable session (the session reader is made to fail: `INFRASTRUCTURE_ERROR`, nothing run, not authentication); cross-site rejection; forged owner data ignored; malformed, empty and missing `universeId`; foreign versus nonexistent `universeId` deep-equal; the generic message has no stack, query or internal name; the failure is logged (FR-2, FR-7, FR-30 to FR-35, NFR-2, NFR-3) |
| Presentation (database) | `tests/components/workspace/load-workspace-universes-for-page.test.ts` (new) | Loaded, signed-out and unverifiable outcomes of the page loader (FR-32, FR-33 for listing) |
| Presentation | `tests/shared/presentation/parse-action-input.test.ts` (unchanged) | Still asserts the strict behavior for 002 and 003; the strip behavior of the new schemas is tested with the schemas themselves |
| Components (pure) | `tests/components/universes/interpret-universe-action-result.test.ts`, `universe-creation-state.test.ts`, `universe-issue-messages.test.ts` (edit), `build-universe-form-vocabulary.test.ts` | Every row of the table in section 4; the creation reducer: single in-flight, 30 s, late success replaces the notice, rejection ends the request, release only when the request has ended or the 5-minute cap is reached, a second submission after the cap is accepted, and an answer that arrives after the cap (with the form already released) is applied as a normal success with the confirmation; every exported issue code has a message and limits come from the issue (FR-4 to FR-10, FR-30) |
| Components (pure) | `tests/components/universes/account-guard-decision.test.ts` (new) | The pure comparison behind `use-account-guard.ts`: same key, different key, no answer (FR-18) |
| Components (pure) | `tests/components/workspace/workspace-state.test.ts` (edit) | New state shape (nullable selection, no work or entity fields), selecting, form open and close, creation selects the new universe |
| Lint | `tests/lint/sample-data-absent.test.ts` (new) | No file in `src/` imports `@/mocks` or contains a sample marker (FR-37); `tests/lint/test-controls-absent.test.ts` gets the new test-only identifiers of the E2E support added to its list (NFR-5, 003 NFR-8) |

Existing tests of specs 001 to 003 that change, and why: the application tests of 001 (use cases now take an actor and an owner; they become two-storage tests); `composition.test.ts`; `fake-universe-repository.ts` and `universe-repository-factories.ts` (owner-scoped); `universe-issue-messages.test.ts` (vocabulary and new codes); `workspace-state.test.ts`; `in-memory-universe-repository.test.ts` (deleted with its file, item 3); the tests of the deleted sample-data components, if any exist (item 2; none were found under `tests/` besides the E2E files, which only name sample data through the helper). `tests/components/graph/force-layout.test.ts` and `label-visibility.test.ts` stay unchanged (the helpers are kept). The E2E files that name sample data change their marker (below). **None is relaxed; every deletion is reported to the user** (completion criteria).

### Playwright (`tests/e2e/`, Chromium, production build, healthy server on 3100, unreachable-data server on 3101)

Support added: `seed-universes-in-database.ts` (creates universes for an account directly, so the "many universes" case does not take minutes), `provoke-storage-failure.ts` and `capture-server-action-id.ts` (reads the action identifier from a real browser call, to replay it without a browser). Failures of the stored data are provoked **outside the application** (003 D10): the test connects to the **test database only** and installs a trigger on `Universe` or `RememberedUniverse` that raises an error, or sleeps, `WHEN` the new row's owner is the unique account of that test, and removes it afterwards (the global setup also drops any left over). Nothing is added to `src/` or to the migrations, so nothing exists in a production configuration (NFR-5), and the identifiers of the helpers are added to the structural test. A universe-storage failure cannot be provoked with the unreachable-data server, because there the session cannot be checked either (that server covers the unverifiable-session half of FR-10 and FR-33).

| Spec file | Flows |
|---|---|
| `universes.spec.ts` | New account sees the empty state that invites creating the first universe and the sections' empty states, with none of the sample data (FR-14 to FR-17); create a `READER` and an `AUTHOR` universe: each is selected, shows the empty state and is announced; reload and sign out/in keep name, description, mode and order; two universes with the same name; a name differing in case, accents, spacing or composition shows the warning and still creates; whitespace-only description is none; limits 120/121 and 2000/2001, emoji and combining accents, null character through the form's value, same outcomes through a direct call (FR-1, FR-4, FR-5, FR-6, FR-11, FR-13, FR-21, FR-22, FR-24) |
| `universes-isolation.spec.ts` | Two accounts in two contexts: each sees only its own; a name that exists only in the other account shows no warning; a request replayed with another account's universe identifier and with a nonexistent one gives the same answer; a forged action call without a session from the sign-in page and from a workspace address reads and changes nothing; owner data in a creation is ignored (FR-2, FR-12, FR-23, FR-32, FR-35, NFR-3) |
| `universes-remembered.spec.ts` | Select the second universe, reload: it stays; a second independent browser context of the same account selects the same universe; forged or stale remembered value selects the oldest with no error; failure to remember (trigger on `RememberedUniverse`) shows no message, selection keeps working, creation is not undone, reload falls back; a missing session on remember sends the person to sign-in; the address never changes when selecting (FR-24 to FR-30) |
| `universes-failures.spec.ts` | Storage failure on creation (trigger): generic message, values kept, form usable, nothing created; lost connection and no answer in 30 s (`page.route` and the Playwright clock): unknown-result message with its own text and code, values kept, form blocked while the request is alive and usable when it ends; **5-minute cap**: a trigger that sleeps longer than the test keeps the request alive, the Playwright clock moves 30 s and the unknown-result message appears with the form blocked, then moves to 5 minutes and the form is usable again with the message still shown and the values kept, a second submission is accepted, and the late answer of the first (the sleep ends) adds and selects its universe and replaces the message with the confirmation, with the duplicate-name warning visible for the second typed name; late success: universe added and selected, notice replaced by the confirmation; double click and repeated Enter: one universe; session expired mid-form (session rows moved back in the test database): nothing created, values kept, sign-in link, empty form after signing in; unverifiable session (unreachable-data server): generic message, not treated as signed out (FR-7 to FR-10, FR-33) |
| `universes-tabs.spec.ts` | Two tabs: an account change in one clears the other and it sends nothing under the new account; half-typed form and notices disappear after sign-out and sign-in; a universe created in tab one triggers the duplicate warning in tab two (FR-18, FR-21) |
| `universes-layout.spec.ts` | Names and descriptions with markup, direction-control characters and 120/2000 characters are plain text and break nothing at desktop and at 320 px, with the full name readable; 200 seeded universes scroll inside the navigation; the form, the empty states and the navigation are reachable by keyboard at 320 px (FR-19, FR-20, NFR-4 where assertable, NFR-6) |
| `sample-data-absent.spec.ts` | Signed out and signed in: the served pages, the RSC answers and every static file referenced by the pages contain none of the sample markers and none of the data of a stored universe created in the test; `/favicon.ico` and `/_next/image` carry none (FR-36, FR-37, accepted risk of 003 closed) |
| Existing specs (edit) | `support/workspace-content.ts`: the marker of "the workspace is shown" and `WORKSPACE_ONLY_TEXTS` switch from the sample universe names to the labels of the top bar and the side panels (`en.workspace.sidebarLabel`, `mainLabel`, `inspectorLabel`, the menu label…). `smoke`, `access`, `sign-out`: the checks that read `SAMPLE_UNIVERSE_NAME` use the new marker; in `sign-out.spec.ts` the two tests about universes "created in memory" become tests about stored universes of the account that signed out (clean start of an account-scoped screen, "already signed in" leaves the other tab as it is). Every other spec changes only through the helper. |

### Manual checks by the user (completion criteria)

Keyboard and screen-reader use of the form, the empty states and the navigation; contrast and focus (NFR-4). The user may optionally also run the restart check of 002 FR-31 (`docker compose restart postgres`, reload) to see FR-6 across a real restart of the database.

Spoiler suite: not applicable. Verification gate per task: `pnpm typecheck`, `pnpm lint`, `pnpm test`, plus `pnpm test:e2e` for every task that changes a user flow, and the migration applying cleanly on an empty database for the schema task.

## 8. Decisions

| # | Decision | Discarded alternative and why |
|---|---|---|
| D1 | All four operations are Server Actions, including the live name check and the account confirmation, with the existing result shape. The proxy already answers `401`/`503` to operation calls and `getActingUser()` answers calls that reach an action from a public page, so FR-32 holds at both doors with the code of 003. | Route Handlers with TanStack Query for the name check (the architecture's wording for client reads): the proxy has no operation-call rule for them, so a signed-out call would be redirected with `303` instead of failing with the authentication error by itself, a new rule in the guard would be needed, and TanStack Query is not installed. |
| D2 | The actor is read before the input is parsed, and the schemas strip unknown keys. | `z.strictObject` and parse-first, as in 002/003: an unknown owner key would be an error, which FR-2 forbids, and an unauthenticated caller would see validation errors. |
| D3 | Creating and remembering are two actions; the client calls the second after the first succeeds, so a failure to remember can never undo or fail a creation (FR-30). If the tab is closed between the two, the previous remembered universe (or the oldest) is selected on the next visit, which is what FR-30 already describes. | One action that creates and remembers and returns a partial success with an embedded error: it needs a catch and a logger inside the use case and a result shape unlike every other action. One transaction: it would make the failure of remembering undo the creation. |
| D4 | Account change in other tabs is detected on the client with an account key (the user's own identifier, returned by `confirmAccountAction`), compared before every create and remember, plus a `BroadcastChannel` message when a tab loads the workspace. The key is never used as identity by the server. | A server-side precondition ("act only if the account is X"): it sends account data from the client, against FR-2. A marker in `localStorage`: it stores account data in the browser, which CLAUDE.md keeps to the accessibility preferences only. A probe on every focus: more traffic and not testable deterministically. |
| D5 | The selection of the first universe and its fallback is a pure domain rule (`initial-universe-selection.ts`) used by one use case. A failure to read the remembered universe is an infrastructure failure (error page), not a silent fallback. | Reading the remembered universe in the interface: duplicates a rule. Silent fallback on a failed read: it would hide an infrastructure failure the person should see. |
| D6 | `Universe.deletedAt` is created now and filtered always; `coverImageUrl` is not created (approved, item 1). | Creating neither: spec 005 would add a column and the repositories would need changing again. Creating both: a column nothing writes. |
| D7 | The comparison for the duplicate warning stays in the application (all own universes are read and compared with the existing `toComparableUniverseName`). With hundreds of universes it is a small query. | A stored `normalizedName` column with an index: a second schema change and a second source of truth for the normalization; justified only when search arrives (OD-13). |
| D8 | The empty state of a universe shows its name, mode and description, and the sidebar lists names. Without this a person (and the completion-criteria test) could not see that description and mode were kept. | Showing only the name, as the empty state does today: the completion criteria ("same name, description, mode and order") could not be checked in a browser. |
| D9 | FR-6 is verified by an integration test that drops the application's database client and every connection and reads the data back with a new client. The restart of the PostgreSQL process is left to the database and to the optional manual check. | Restarting the Docker container from a test: unsafe on a developer's machine, depends on Docker permissions and slows the suite. |
| D10 | The name check waits 250 ms after typing stops and ignores stale answers; a failed check shows nothing. | A call per keystroke without a pause: many requests, queued one by one by the framework. A visible error on failure: FR-21 asks for none and the helper must not block creation. |
| D11 | Text of the person is wrapped, never cut with an ellipsis. | Truncation with a tooltip: the full text is then not readable by keyboard or on touch. |
| D12 | Failures of the stored data in browser tests are provoked with database triggers installed and removed by the test in the test database, keyed to the account of that test. | A hook or environment switch inside the application: forbidden by NFR-5 and 003 NFR-8. The unreachable-data server alone: it also breaks the session check, so it cannot reach FR-7 or FR-30. |
| D13 | Until the client data layer replaces the temporary adapter, the old in-memory composition is kept working by binding the new use cases to a fixed prototype actor, so every task leaves the application running; that bridge, and the in-memory repository it uses (item 3), are deleted in the task that replaces the provider (T4). | Making the engine and the screens one task: it cannot stay inside 20 to 30 minutes. |
| D14 | **Approved, item 4 (and the clarification of FR-15 in the spec).** FR-15 is read as "the places that showed sample content": the graph view, the entity list, the works area of the sidebar and the details panel (which names knowledge, relationships, events, sources and reading positions as future). "Open timeline" stays a disabled menu entry. | New navigation entries and empty screens for Timeline, Sources and Reading position: new UI nothing else in the spec describes. Leaving FR-15 as written: a literal review would find sections that never existed. |
| D15 | **Approved, item 1, option a.** Tables `Universe` (with enum `UniverseMode`) and `RememberedUniverse` (the account is the primary key; composite foreign key `(universeId, userId) → Universe(id, ownerId)`); `deletedAt` created now and always filtered; no `coverImageUrl`; `CHECK` length limits; `ON DELETE CASCADE` from the owner; no column of a Better Auth table changes. | A nullable column on `User`: edits a Better Auth table (forbidden without approval) and the foreign key cannot check ownership. `UserPreferences` created now with this single column: a table whose purpose (accessibility preferences) is deferred and has no owner. |
| D16 | **Approved, item 2, option A.** `src/mocks/` is deleted and so is every component that can only show sample data, with their tests (if any). The pure helpers `force-layout.ts`, `label-visibility.ts`, `resolve-css-color.ts` and their two tests stay; `cytoscape` and `d3-force` stay installed and unused until Phase 3 (removing a dependency would need its own approval). | Deleting only the data and rewiring the components with empty props (B): ships dead code and the graph libraries for nothing. Leaving everything disconnected (C): dead code and a typecheck that still needs the folder. |
| D17 | **Approved, item 7, option B.** A client cap of 5 minutes on the blocked creation form: when it passes, the form is usable again with the unknown-result message still shown, and a very late answer is still applied as a normal success. Spec FR-8 was edited to say it. The request itself is not aborted (Server Actions cannot be). | No cap (A): a stalled request leaves the person with a blocked form and lost values. A database statement timeout (C): edits shared infrastructure of spec 002 and covers only database stalls. |
| D18 | **Approved, item 3, option a.** `in-memory-universe-repository.ts` and its test are deleted; the two interchangeable stores of NFR-1 are the fake in `tests/support/fakes/` and the PostgreSQL repositories. | Keeping the in-memory repository in `src/` as the second implementation: production code that no feature uses. |
| D19 | **Approved, item 5, option a.** The enabled "New element" button and the entity creation form are removed; the disabled "Not available in this prototype" menu entries stay. | Removing the disabled entries too: loses the signposts of the design. Keeping "New element": an enabled control to a missing action, against FR-15. |
| D20 | **Approved, item 8, option a.** The universe operations receive only `ActingUser`. `ViewerContext` enters with the first read of narrative information (Phase 2 or 4), where its universe, mode and progress fields have meaning. The account-isolation tests (section 6) still apply to every read. | A minimal `ViewerContext` now with only the user identifier: a type with one field that duplicates `ActingUser`. |
| D21 | **Approved, item 6, option a.** At closing, each of specs 001, 002 and 003 gets a dated note at its top, "Superseded in part by spec 004", listing the requirements and texts affected, without editing requirement text; the three stay `implemented`. | Editing the sentences in place (or both): rewrites approved requirements and puts three implemented specs back to `approved`. |
| D22 | **Approved, item 9, option A.** The tasks are exactly 10 (T1 domain and use cases, T2 schema and repositories, T3 actions, T4 client data layer, T5 form, T6 workspace views, T7 retirement of the sample data, T8 to T10 browser tests). If a task overflows, the spec is split between T3 and T4 into 004 (engine) and 004b (screens). | Splitting the spec now, or allowing 12 or 13 tasks: the user kept the same arrangement as spec 003. |

## 9. Coverage

"W" refers to the work packages of the size check and "T" to the tasks they are grouped into. Every FR (1 to 37) and NFR (1 to 6) is covered.

| Requirement | Covered by |
|---|---|
| FR-1 | `createUniverse`, `createUniverseAction`, creation form (W1, W2, W4, W6); application tests, `actions.test.ts`, `universes.spec.ts` |
| FR-2 | `getActingUser()` before parsing, schemas that strip unknown keys, owner taken from `actor` (W2, W4); `actions.test.ts`, `universes-isolation.spec.ts` |
| FR-3 | Use case (identifier, one timestamp), schema without cover image or update method, fixed mode (W2, W3); application and repository contract tests |
| FR-4 | Domain rules and codes, client keeps values (W1, W6); domain, application and `universes.spec.ts` through the form and a direct call |
| FR-5 | `universe-text.ts` and the new issue codes (W1, W6); domain, application, `actions.test.ts`, `universes.spec.ts` |
| FR-6 | Prisma persistence (W3); the persistence integration test (D9), reload and sign-out/in in `universes.spec.ts` |
| FR-7 | Prisma failures become `InfrastructureError`; interpreter and form message (W3, W5, W6); repository test, `actions.test.ts`, `universes-failures.spec.ts` (trigger) |
| FR-8 | Creation reducer, `runWithTimeLimit` plus the late-answer handlers, the 5-minute client cap (D17), two distinct messages and codes (W5, W6); reducer test (cap, second submission after the cap, answer after the cap) and `universes-failures.spec.ts` (Playwright clock) |
| FR-9 | Synchronous reference guard in the provider and disabled control (W5, W6); reducer test, `universes-failures.spec.ts` |
| FR-10 | Interpreter rows `sign-in-again` and `generic-failure` for the unverifiable session, link from the server (W5, W6); interpreter test, `universes-failures.spec.ts` (expired session and unreachable-data server) |
| FR-11 | `findAllOwnedBy` ordering and `loadWorkspaceUniverses` (W1 to W3); contract test with equal timestamps, `universes.spec.ts` |
| FR-12 | Owner-scoped port and queries, DTO without owner, composite foreign key (W1 to W3); isolation tests at three levels |
| FR-13 | Provider adds the created universe to the list (W5); `universes.spec.ts`, `universes-isolation.spec.ts` |
| FR-14 | Provider and workspace state without sample data or in-memory repository (W5, W8; items 2 and 3); `sample-data-absent` lint test and spec |
| FR-15 | Empty states of graph, list, works area and details panel (W7; items 2, 4, 5; D14; FR-15 as clarified); `universes.spec.ts` |
| FR-16 | `NoUniversesEmptyState`, selection rule (W1, W7); `universes.spec.ts` |
| FR-17 | `UniverseEmptyState` text (W7); `universes.spec.ts` |
| FR-18 | New-document rule of 003, account key, broadcast and pre-send check (W5); `account-guard-decision` test, `universes-tabs.spec.ts` |
| FR-19 | `universe-name-text.tsx`, wrapping rules (W7); `universes-layout.spec.ts` |
| FR-20 | Whole list from the loader, scroll area of the sidebar (W2, W7); `universes-layout.spec.ts` with 200 seeded universes |
| FR-21 | `isUniverseNameInUse`, NFC-then-compare, debounced warning (W1, W2, W6); domain and application tests, `universes.spec.ts`, `universes-tabs.spec.ts` |
| FR-22 | Form keeps submit enabled while the warning shows (W6); `universes.spec.ts` |
| FR-23 | Use case compares only own universes (W2); isolation tests |
| FR-24 | Creation, then `rememberUniverseAction` for the new universe (W2, W5); `universes-remembered.spec.ts` |
| FR-25 | Selection calls the remember action (W5); `universes-remembered.spec.ts` |
| FR-26 | `loadWorkspaceUniverses` with the domain rule, initial selection from props (W1, W2, W5); `universes-remembered.spec.ts` |
| FR-27 | Same rule, no error shown (W1, W2); domain and application tests, `universes-remembered.spec.ts` |
| FR-28 | `RememberedUniverse` per account (W3); second independent context in `universes-remembered.spec.ts`, isolation tests |
| FR-29 | No route, no URL state (W5, W7); `universes-remembered.spec.ts` checks the address does not change |
| FR-30 | Silent interpreter row, typed error returned, server log, creation never undone (W2, W4, W5); `actions.test.ts`, `universes-remembered.spec.ts` (trigger) |
| FR-31 | One module, owner-scoped repository, one definition of the rules for every door (W1 to W4); NFR-2 tests |
| FR-32 | `getActingUser()` first, proxy refusals, interpreter `signed-out` (W4, W5); `actions.test.ts`, `load-workspace-universes-for-page.test.ts`, `universes-isolation.spec.ts` |
| FR-33 | Same, infrastructure failure never read as signed out (W4, W5); same tests plus `universes-failures.spec.ts` |
| FR-34 | `runAction` and the one mapper (W4); `actions.test.ts` |
| FR-35 | `parseUniverseId`, `UniverseNotFoundError`, one answer (W1, W2); domain, application and `actions.test.ts` (foreign versus nonexistent deep-equal) |
| FR-36 | Nothing stored is in static files; the pages read data only after the guard (W4, W8); `sample-data-absent.spec.ts` |
| FR-37 | Retirement of the sample data and its sources (W8; item 2); lint test and `sample-data-absent.spec.ts` |
| NFR-1 | Two storages (fake and PostgreSQL) with `describe.each` and one contract suite (W2, W3) |
| NFR-2 | One set of rules in the domain, one use case per operation; tests that send the same inputs through the form and through a direct call (W2, W4, W6) |
| NFR-3 | Isolation tests at three levels (section 6) |
| NFR-4 | Section 5 (accessibility): native controls, labels, linked errors, `role="alert"` and `role="status"`, existing tokens; E2E where assertable; manual check by the user |
| NFR-5 | The seven spec files above and the failure helpers that exist only in `tests/` (W9 to W11); structural test of test-only identifiers |
| NFR-6 | `universes-layout.spec.ts` at 320 px (W11) with layout rules in W6 and W7 |
| Completion criteria on documents | Closing: see "Closing checklist" |

## Size check

The spec cannot be implemented in 10 tasks of 20 to 30 minutes without being tight. Work packages, in dependency order:

| # | Work package |
|---|---|
| W1 | Domain: owner, text rule, id, selection rule, errors, ports |
| W2 | Use cases (four) and the fake storage; application tests on the fake |
| W3 | Schema, migration, Prisma repositories, contract suite on PostgreSQL, persistence test |
| W4 | Composition, public interface, vocabulary, schemas, four Server Actions, presentation integration tests |
| W5 | Client data layer: interpreter, creation reducer, account guard, new provider, workspace state, page loader and `Suspense` |
| W6 | Creation form, messages, duplicate warning |
| W7 | Workspace views: empty states, sidebar and rail, details panel, text rendering, 320 px |
| W8 | Retirement of the sample data and temporary code, markers, structural test, update of the existing E2E helper and specs |
| W9 | E2E support and `universes.spec.ts`, `universes-isolation.spec.ts`, `universes-remembered.spec.ts` |
| W10 | `universes-failures.spec.ts`, `universes-tabs.spec.ts` |
| W11 | `universes-layout.spec.ts`, `sample-data-absent.spec.ts` |

Honest estimate: 11 packages of real size, above the maximum of 10 tasks. Decision of the user (item 9, D22): **exactly 10 tasks, with no spare**, as spec 003 did: T1 = W1+W2, T2 = W3, T3 = W4, T4 = W5, T5 = W6, T6 = W7, T7 = W8, T8 = W9, T9 = W10, T10 = W11. The likely overruns are T1, T4 and T9. If a task overflows, the implementer stops and proposes the split, whose cut is already defined between T3 and T4: **004 stored universes engine** (T1 to T3) and **004b stored universes screens** (T4 to T10), with 004b depending on 004. The tasks keep the application working at the end of each one (bridge of D13: the old in-memory composition runs with a fixed prototype actor until T4 replaces the provider and deletes the in-memory repository).

## Closing checklist (for the closing step, not for tasks)

Done by the implementer at closing, as in specs 002 and 003, because the planner cannot write outside `specs/`: `CLAUDE.md` "Current status" (sample content removed, universes stored and owned, remembered universe exists), `docs/roadmap.md` (Phase 1 row; Phase 0 wording about sample data), `.claude/rules/data-model.md` (a section for `RememberedUniverse`, the `Universe` differences of item 1, the note that the accessibility preferences are still in the browser), `.claude/rules/architecture.md` (the `src/app/universes/` actions folder and `src/mocks/` status), `docs/open-decisions.md` (a new item for the deferred move of the accessibility preferences to the account, as the spec's low-severity points ask), and the text of specs 001, 002 and 003 as decided in item 6 (D21): the planner, at closing, adds to the top of each of the three a dated note "Superseded in part by spec 004" that lists the affected requirements and texts (001 FR-24, FR-22, NFR-1 and the narrowing of FR-11 and FR-13; the "belong to nobody" sentence of 002; 003 FR-31, FR-32, the definition of clean start, the marker of NFR-4, and the sentences about sample data and in-memory creation in the context, the edge cases, the accepted risks and the completion criteria, including the accepted risk about public static files that contain sample data) without editing any requirement text; the three stay `implemented`. The final report lists which requirements and texts stopped being true (at least 001 FR-24, FR-22 and NFR-1, 003 FR-31, FR-32, the definition of clean start, NFR-4's marker, the edge cases and accepted risks about sample data), and every deleted or changed existing test.

## Approvals recorded

Every item below was asked to the user and answered (after the first draft of this plan). The discarded alternatives are in section 8 (D14 to D22). Nothing is waiting for approval.

1. **Prisma schema and migration: approved, option (a).** Tables `Universe` (with enum `UniverseMode`) and `RememberedUniverse` (account as primary key, composite foreign key forcing the universe to belong to that account); `deletedAt` created now and filtered from the start; no `coverImageUrl`; `CHECK` length limits and `ON DELETE CASCADE` from the owner; relation fields on `User` only, no change to Better Auth columns. The migration must apply cleanly on an empty database. (D15)

2. **Sample-data code: approved, option (A).** `src/mocks/` is deleted entirely, and so is every component that can only show sample data, with their tests. The pure helpers `force-layout.ts`, `label-visibility.ts`, `resolve-css-color.ts` and their tests stay. `cytoscape` and `d3-force` stay installed and unused until Phase 3. (D16)

3. **In-memory repository: approved, option (a).** `in-memory-universe-repository.ts` and its test are deleted; the two interchangeable stores of NFR-1 are the test fake and the PostgreSQL repository. (D18)

4. **FR-15 read as "the places that showed sample content": approved.** Graph view, entity list, works area of the sidebar and details panel (which names knowledge, relationships, events, sources and reading positions as future); "Open timeline" stays disabled. The user also asked to clarify FR-15 in the spec with a minimal edit naming exactly those sections: done. (D14)

5. **"New element" and the entity form: approved, option (a).** The enabled "New element" button and the entity creation form are removed; the disabled "Not available in this prototype" menu entries stay. (D19)

6. **Text of specs 001, 002 and 003: approved, option (a).** A dated note at the top of each, "Superseded in part by spec 004", listing what is affected, without editing requirement text; the three stay `implemented`. Done at closing (see the closing checklist). (D21)

7. **Request that never ends: approved, option (B).** A client-side cap of 5 minutes: after it the form is released with the unknown-result message and a very late answer is still applied. The user also asked to edit FR-8 in the spec accordingly (the 5-minute cap, and the duplicate-name warning as the mitigation of a second submission while the first may be alive): done. A test is part of section 7. (D17)

8. **`ViewerContext`: approved, option (a).** The universe operations receive only `ActingUser`; `ViewerContext` enters with the first read of narrative information (Phase 2 or 4). The account-isolation tests still apply. (D20)

9. **Task count: approved, option (A).** Exactly 10 tasks: T1 domain and use cases, T2 schema and repositories, T3 actions, T4 client data layer, T5 creation form, T6 workspace views, T7 retirement of the sample data, T8 to T10 browser tests; fallback cut between T3 and T4. (D22)
