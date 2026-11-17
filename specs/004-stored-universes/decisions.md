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
