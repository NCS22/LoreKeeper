# Decisions 006 — Knowledge items: first creation and viewing

Decisions taken after the plan was approved. Design decisions of the plan stay in `plan.md` section 8.

## D-T1-1. Relationship types are listed by key

- **Decided:** `listRelationshipTypes` returns the eight types ordered by `key` (`ALLY_OF` … `SIBLING_OF`), which is also the alphabetical order of their labels.
- **Why:** the plan fixed no order, and the eight types of a universe are created at the same instant, so `createdAt` cannot order them.
- **Discarded:** creation order (ties everywhere) or the order of the seed constant (not stored).
- **Approved by:** the user, 2026-11-26, at the implementation gate after T1.

## D-T1-2. Delete actions of the composite foreign keys

- **Decided:** `RESTRICT` on the boundary references (work and unit) and on the relationship type; `CASCADE` from an entity to its fragments and relationships. Deleting a user or a universe still removes everything (checked in a rolled-back transaction with a full graph).
- **Why:** a referenced unit or type must not disappear under an item (data model); fragments and relationships have no meaning without their entity.
- **Discarded:** `CASCADE` everywhere (a unit could take items with it) or `RESTRICT` everywhere (an entity could not be removed with its own content).
- **Approved by:** the user, 2026-11-26, after T1.

## D-T1-3. Index `KnowledgeEntry(entityId, createdAt, id)`

- **Decided:** an index not listed in the plan, to read the first fragment of an entity.
- **Why:** the details read (FR-10) asks for the oldest fragment of one entity.
- **Discarded:** no index (a scan per entity read).
- **Approved by:** the user, 2026-11-26, after T1.

## D-T1-4. The partial unique index lives only in the migration SQL

- **Decided:** the unique `(universeId, key)` among non-deleted types is written by hand in the migration and is not expressed in `schema.prisma`; Prisma reports no difference and does not try to drop it.
- **Why:** Prisma 7.10 needs the preview feature `partialIndexes` to express it, and enabling a preview feature was not approved.
- **Discarded:** enabling the preview feature, or a plain unique index (it would block a type that reuses the key of a deleted one in spec 007).
- **Approved by:** the user, 2026-11-26, after T1.

## D-T1-5. Timestamps of the seeded types

- **Decided:** `createdAt` and `updatedAt` of the eight types take the creation time of their universe (new and backfilled universes alike).
- **Why:** the types are part of the universe from its creation; the backfill does not invent a later date.
- **Discarded:** the time of the migration for backfilled universes.
- **Approved by:** the user, 2026-11-26, after T1.

## D-T1-6. Signature of `findOwnUniverse` and `listRelationshipTypes`

- **Decided:** both receive the acting user and the `universeId` as text, not a `ViewerContext`; a malformed identifier is a `ValidationError`. They are exposed by the universes composition for the `knowledge` module of T2.
- **Why:** they resolve ownership themselves, before any `ViewerContext` exists; the read use cases of `knowledge` receive the `ViewerContext` (plan section 3).
- **Discarded:** a `ViewerContext` parameter (it would have to be built before the ownership check it depends on).
- **Approved by:** the user, 2026-11-26, after T1.

## D-T1-7. The seed constant is TIER 0 (UNI-6)

- **Decided:** `predefined-relationship-types.ts` is classified in UNI-6 (TIER 0).
- **Why:** it is a constant with no logic; the repository contract scenarios compare the stored types with a literal list written in the tests, which protects it.
- **Discarded:** a CORE entry with its own tests (a test that only repeats the constant).
- **Approved by:** the user, 2026-11-26, after T1.

## D-T1-8. Test support for the seed

- **Decided:** the PostgreSQL test storage stores its initial universes through `add` (with their types) instead of `createMany`; failures of the type store are provoked with a temporary trigger, which every new storage removes if one was left.
- **Why:** the contract scenarios must run the same on the fake and on PostgreSQL, including the all-or-nothing case.
- **Discarded:** inserting the types by hand in the storage (it would not exercise `add`).
- **Approved by:** the user, 2026-11-26, after T1.

## D-T2-1. The work repository does not read the `Universe` table

- **Decided:** the work repository filters only by the `universeId` of the `ViewerContext`, which exists only after the ownership check of `resolve-viewer-context` (built on `findOwnUniverse`).
- **Why:** a module does not read the tables of another module; the cross-account protection sits in that check, tested with two accounts in the use cases, the actions and the contract.
- **Discarded:** joining `Universe` and `ownerId` in every work query (the `knowledge` module reading the tables of `universes`).
- **Approved by:** the user, 2026-11-26, at the implementation gate after T2.

## D-T2-2. `create-work` checks the universe before the fields

- **Decided:** ownership is resolved first (plan section 3); a foreign universe with invalid fields answers not found, and a malformed universe identifier gives only the `universeId` validation issue.
- **Why:** an answer that lists field problems for a foreign universe would confirm that it exists.
- **Discarded:** validating the fields first.
- **Approved by:** the user, 2026-11-26, after T2.

## D-T2-3. One `loadUniverseKnowledge(actor, universeId)` operation

- **Decided:** the module exposes one load operation that checks ownership once and lists with the `ViewerContext`; today it returns `{ works }`, and T3 and T4 extend it.
- **Why:** the load action calls a single operation and the ownership check is not repeated per list.
- **Discarded:** one action per list.
- **Approved by:** the user, 2026-11-26, after T2.

## D-T2-4. Files the plan did not name

- **Decided:** `domain/numbered-units.ts` (labels and ordinals of the units) in KNO-1, and `domain/work.ts` (`NewWork`, `Work`, `NewNarrativeUnit` types) in KNO-6; `unit-number.ts` waits for T3.
- **Why:** small single-purpose files in the existing inventory entries.
- **Discarded:** placing those rules inside `create-work.ts`.
- **Approved by:** the user, 2026-11-26, after T2.

## D-T2-5. No "unknown value" branch when mapping the stored medium

- **Decided:** the mapper from the Prisma enum to the domain medium has no fallback branch.
- **Why:** the Prisma enum matches the domain type and the type checker guarantees it; the database cannot store another value, so the branch would be unreachable and need a coverage override.
- **Discarded:** a defensive branch with an override, as in UNI-4.
- **Approved by:** the user, 2026-11-26, after T2.

## D-T2-6. Error codes of the unit count

- **Decided:** `UNIT_COUNT_REQUIRED`, `UNIT_COUNT_INVALID` and `UNIT_COUNT_OUT_OF_RANGE`; the issue carries no limits (a `ValidationIssue` only has length fields), and the module exports `MAXIMUM_UNIT_COUNT`.
- **Why:** the screen can say which rule failed and show the maximum from the constant.
- **Discarded:** extending `ValidationIssue` with numeric limits (a shared change outside the task).
- **Approved by:** the user, 2026-11-26, after T2.
