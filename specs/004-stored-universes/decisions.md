# Decisions taken after the plan was approved (spec 004)

## D-T2-1. Application tests of the universes run in the database project

- What: `vitest.config.mts` adds `tests/modules/universes/application/**/*.test.ts` to `DATABASE_BACKED_TEST_FILES`, so the use case scenarios can run `describe.each` over the fake and PostgreSQL (NFR-1) in the one-file-at-a-time database project.
- Why: the plan requires both storages in the application tests, and only that project provides the test database.
- Discarded: a second copy of every application test under `infrastructure/`, which would duplicate the scenarios.
- Approved by: pending the user.

## D-T2-2. Two scenarios are fake-only, and the contract no longer holds one of them

- What: "keeps two storages independent" left the shared contract and lives in `fake-universe-storage.test.ts`; "falls back to the oldest universe when the remembered one is not an own universe" (`load-workspace-universes.test.ts`) runs on the fake only.
- Why: PostgreSQL is one shared database, so two storages over it are never independent; and the composite foreign key makes it impossible to store a remembered universe that is not an own one (that refusal, and a deleted remembered universe reading as none, are tested in `prisma-remembered-universe-repository.test.ts`). The use case fallback on "no remembered universe" still runs on both storages.
- Discarded: skipping them for PostgreSQL (no skipped tests are allowed) or weakening the foreign key.
- Approved by: pending the user.

## D-T2-3. Remembered universe: a deleted universe reads as none, saving is a plain upsert

- What: `findRememberedUniverseId` returns `null` when the universe is deleted (`deletedAt` set); `saveRememberedUniverse` is an upsert that the composite foreign key protects against other owners. It does not itself refuse a deleted universe; the use case already checks the universe with `findOwnedById`, which never returns deleted rows.
- Why: smallest code that keeps FR-11/FR-12; a conditional write would need raw SQL for a case no code path produces before spec 005.
- Discarded: a raw `INSERT ... SELECT ... WHERE deletedAt IS NULL`.
- Approved by: pending the user.

## D-T2-4. Repositories receive a client getter; one extra infrastructure file

- What: `createPrismaUniverseRepository(getPrismaClient)` and `createPrismaRememberedUniverseRepository(getPrismaClient)` take a function, as the accounts authenticator does, so building them touches no database (T3 composition). `run-universe-storage-operation.ts` holds the one place that turns a failure into an `InfrastructureError` with its cause.
- Why: "touches nothing at creation" (T3) and the persistence test needs to swap the client; avoids repeating the try/catch in five methods.
- Discarded: passing a client instance; a try/catch in every method.
- Approved by: pending the user.

## D-T2-5. Test support files added

- What: `tests/support/universe-owners.ts` (owner constants and `buildActingUser`, re-exported by `universe-repository-factories.ts`, to avoid an import cycle), `tests/support/database/postgres-universe-storage.ts` (empties the tables, creates the two accounts, inserts the universes), and `tests/modules/universes/infrastructure/universe-persistence.test.ts` (FR-6 test in its own file because it terminates every connection of the test database).
- Why: the database requires the owner to exist; terminating connections must not break the client other files share.
- Approved by: pending the user.

## D-T3-1. The bridge moves to its own file; the composition is only the real one

- What: `createUniversesInMemory` and its type (renamed `PrototypeUniversesModule`) moved from `composition.ts` to `prototype-composition.ts`, with their tests in `tests/modules/universes/prototype-composition.test.ts` (the old cases, unchanged). `composition.ts` holds only `createUniversesModule()`, whose four functions take the acting user first (`createUniverse(actor, command)`, `loadWorkspaceUniverses(actor)`, `isUniverseNameInUse(actor, name)`, `rememberUniverse(actor, command)`). Both files are deleted or reduced with the bridge in T4.
- Why: the plan says `composition.test.ts` is rewritten for the real composition, and the bridge still needs its own tests until T4.
- Discarded: keeping both compositions in one file (the real-composition test would also import the in-memory code).
- Approved by: pending the user.

## D-T3-2. Shape of the form vocabulary

- What: `UniverseFormVocabulary` has `fieldNames` (`name`, `description`, `mode`), `issueCodes` (`nameRequired`, `nameTooLong`, `nameInvalidCharacters`, `descriptionTooLong`, `descriptionInvalidCharacters`, `modeInvalid`), `modes` and `defaultMode`, like the accounts vocabulary. It has no `universeId` entry: the interpreter of T4 does not need to tell it from the form fields.
- Why: smallest shape that covers FR-4, FR-5 and the mode choice; T4 and T5 can add an entry if a screen needs it.
- Discarded: adding every code the module exports (YAGNI).
- Approved by: pending the user.

## D-T3T4-1. T3 and T4 are one step; the bridge is deleted now

- What: the T3 gap (the module index exports the Prisma server composition, and client components import that index, so `pnpm build` failed) is closed by merging T3 and T4 into one step. The client provider no longer imports the module index at runtime and no longer builds an in-memory module; it reads the list and the remembered universe from the server and calls the actions. The form and the issue-messages file receive the vocabulary (`UniverseFormVocabulary`, D-T3-2) by props instead of importing constants from the index (003 D13). The bridge (`prototype-composition.ts`, `createUniversesInMemory`), `in-memory-universe-repository.ts` with its test, `prototype-composition.test.ts` and the provider's import of the sample universes are deleted. Client files keep only type-only imports of the index (`UniverseDto`, `CreateUniverseCommand`), which are erased at build time.
- Why: it is the only way to leave the build green without a lint exception, a relaxed rule or a second public entry point for the module.
- Discarded: the other ways of keeping the bridge reachable from the client until T4 (options a and b put to the user): a lint exception or deep import so the client keeps the in-memory module, or a second entry point of the module for the client (a new public surface the architecture does not describe). Both would have left the bridge alive for one more task.
- Approved by: the user.

## D-T3T4-2. Page loader test in the database project; extra pure helper and test files

- What: `vitest.config.mts` adds `tests/components/workspace/load-workspace-universes-for-page.test.ts` to `DATABASE_BACKED_TEST_FILES` (same reason as D-T2-1: it needs the session and the test database). Two small files not named in the plan: `insert-universe-in-creation-order.ts` (a universe whose answer arrives late is inserted in the order the server lists them, instead of appended; tested in `insert-universe-in-creation-order.test.ts`) and `account-guard-decision.ts` (the pure decision, as the plan asks) next to `use-account-guard.ts`. `workspace-loading.tsx` holds the loading fallback.
- Why: FR-8 (a late answer is applied) and FR-11 (the list keeps the creation order) both need the insertion to be ordered; the rest is what the plan section 5 lists.
- Discarded: appending (the list would differ from the order after a reload); a new test project for one file.
- Approved by: pending the user.

## D-T3T4-3. Wiring choices of the client data layer

- What: (1) `WorkspaceStateProvider` is now the outer provider and `UniversesProvider` sits inside it, so a created universe (also one whose answer is late) is selected from the provider with `universeCreated`; the sidebar tree and rail select through `selectUniverse` of the provider, which also remembers it. (2) `EntityListView`, `GraphView` and `EntityCreationForm` receive `universeId` as a prop from the central area, because the selected universe is nullable now (they are deleted in T7). (3) The form shows a minimal message paragraph (`role="alert"`, `role="status"` for the late confirmation, `data-message-code`) and a sign-in link, because without it a failed creation would be silent; the full form rewrite stays in T5. A fourth code, `CREATION_SIGN_IN_AGAIN`, is used for the sign-in message. (4) A failure answer that arrives after the 5-minute cap is ignored by the reducer (the unknown-result message stays); only a success is applied late. (5) With no universe selected the central area shows the form when it is open and otherwise a plain sentence; the final empty states are T6. (6) `universe-issue-messages.ts` already takes the vocabulary and has the two new `INVALID_CHARACTERS` messages (T5 lists them; they were needed to remove the index import). (7) The name check is still called on every change of the name, as before; the 250 ms wait and the stale-answer rule are T5.
- Why: smallest code that leaves the application working and the build green.
- Approved by: pending the user.

## D-T5-1. The confirmation of a late success lives in the workspace, not in the form

- What: the form shows only the failure messages (`CREATION_FAILED`, `CREATION_RESULT_UNKNOWN`, `CREATION_SIGN_IN_AGAIN`, all `role="alert"`, `tabIndex={-1}`, focused when they appear). `CREATION_CONFIRMED_AFTER_DELAY` (`role="status"`) is rendered by the new `late-creation-confirmation.tsx` in `central-area.tsx`, above the content, with a "Dismiss" button (new text `notices.dismiss`).
- Why: every success selects the new universe and closes the form (`universeCreated`), so a confirmation placed inside the form would never be seen (FR-8: "replace the unknown-result message with a confirmation").
- Discarded: keeping the form open after a late success (contradicts FR-24, the universe is selected); leaving the confirmation inside the form, where it is invisible.
- Approved by: pending the user.

## D-T5-2. Duplicate-name warning: answer tied to the checked name; no request for an empty name

- What: `check-name-after-pause.ts` holds `scheduleNameCheck` (250 ms pause, returns a cancel function used by the effect cleanup) and `isDuplicateNameWarningShown`. The answer carries the name it was about and the warning shows only when it equals the name in the field now, so a stale answer can never show or hide it. No request is sent for an empty name (the field is empty when the form opens). The previous behavior (one call per change, including on mount) is gone.
- Why: D10 (250 ms, stale answers ignored, failure shows nothing); tying the answer to its name also avoids a warning for a name the person already changed during the 250 ms.
- Discarded: keeping the last answer visible until the next one arrives (a misleading warning while typing).
- Approved by: pending the user.

## D-T5-3. Final messages kept; small form changes

- What: the notice texts of T4 are kept as the final ones (they already say what happened, that the entries are kept and what to do). The form also clears its field messages when a submission starts, so a later failure without field issues does not show an old field message, and a message that was already shown when the form opens does not take focus from the name field.
- Approved by: pending the user.
