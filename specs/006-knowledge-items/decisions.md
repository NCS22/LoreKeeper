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

## D-T3-1. A well-formed unit number with no unit answers not found

- **Decided:** a unit number that passes the format rules but matches no unit (0, beyond the unit count, or huge) answers the single not found; only the format rules give a validation failure (`UNIT_NUMBER_REQUIRED`, `UNIT_NUMBER_INVALID`).
- **Why:** FR-4 asks only for the format rules of FR-1; a missing unit is a bad reference like the others of FR-8.
- **Discarded:** a range validation error (it would need the unit count of the work, which is a lookup).
- **Approved by:** the user, 2026-11-26, at the implementation gate after T3.

## D-T3-2. The unit is found by its label

- **Decided:** the boundary unit is the unit whose label equals the number, through `WorkRepository.findBoundaryOfUnitNumber`, ignoring deleted works and units.
- **Why:** labels are "1" to "N" (FR-1) and the contract sends work + unit number (plan D6).
- **Discarded:** computing the ordinal from the number (it ties the lookup to the step 1000 that rebalancing may change).
- **Approved by:** the user, 2026-11-26, after T3.

## D-T3-3. `domain/knowledge-item-id.ts`

- **Decided:** a validator of the identifier format with the code `ID_INVALID`, following the pattern of the universe identifier.
- **Why:** modules interact only through their public interface, so the universes rule cannot be imported.
- **Discarded:** exporting the universe identifier rule from `universes` for another module's validation.
- **Approved by:** the user, 2026-11-26, after T3.

## D-T3-4. One code for the fragment status

- **Decided:** `STATUS_INVALID` both when the status is missing and when it is unknown.
- **Why:** the form always proposes `USER_NOTE`, so a missing status only comes from a direct call; one message covers both.
- **Discarded:** a separate `STATUS_REQUIRED`.
- **Approved by:** the user, 2026-11-26, after T3.

## D-T3-5. Input shape of the fragment

- **Decided:** the fragment status and boundary accept `null` as well as being absent; without a boundary the fragment takes the entity's. The module exports `isBlankFragmentContent` so the Zod schema drops an empty fragment by the same domain rule.
- **Why:** an empty fragment is dropped before its shape is parsed (plan section 4) and the rule is not duplicated.
- **Discarded:** a second blank check written in the schema.
- **Approved by:** the user, 2026-11-26, after T3.

## D-T3-6. The duplicate notice is computed before storing

- **Decided:** the notice compares with the stored normalized names, ignoring deleted entities, before the write; the fragment gets the creation time of its entity.
- **Why:** the oldest existing entity is the one named; computing it after the write would have to exclude the new row.
- **Discarded:** a query after the write.
- **Approved by:** the user, 2026-11-26, after T3.

## D-T3-7. The fake entity repository refuses foreign boundaries too

- **Decided:** the fake refuses a boundary outside the universe or a unit of another work, so those refusals are contract scenarios run on the fake and on PostgreSQL; the direct database insert is tested only on PostgreSQL.
- **Why:** the use-case tests on fakes then see the same answers as production.
- **Discarded:** testing those refusals only on PostgreSQL.
- **Approved by:** the user, 2026-11-26, after T3.

## D-T4-1. The relationship type catalog port receives the `ViewerContext`

- **Decided:** `RelationshipTypeCatalog.listRelationshipTypes(viewerContext)`; the composition binds the port to the acting user of each operation and calls `listRelationshipTypes(actor, universeId)` of the universes module. The test storages read the relationship type repository of the universes module scoped by the viewer as owner.
- **Why:** `get-entity-details` is a read use case and receives only the `ViewerContext` (plan section 3), while the universes module reads the catalog for an acting user (D-T1-6).
- **Discarded:** a port with the acting user (the read use case would need the actor besides its context), or building an acting user from the context (it has no name or email).
- **Approved by:** pending, to be asked at the implementation gate after T4.

## D-T4-2. The point reading and lookup are shared by the entity and relationship use cases

- **Decided:** `readBoundary`, `resolveBoundary` and the `BoundaryCommand` type moved from `create-entity.ts` to `application/boundary-reference.ts` (KNO-3), and the Zod point schema from `create-entity-input-schema.ts` to `src/app/knowledge/boundary-input-schema.ts` (APP-8); `create-relationship` and its schema reuse them. `BoundaryCommand` is still exported by the module index.
- **Why:** the same point rules (format, then one not found) apply to the three forms (FR-4, FR-7); a copy could drift.
- **Discarded:** a second copy in `create-relationship.ts`.
- **Approved by:** pending, to be asked at the implementation gate after T4.

## D-T4-3. References of a relationship are looked up before the write

- **Decided:** after the fields and the "same entity" rule, `create-relationship` looks up the source and the target (new `EntityRepository.findInUniverse`), the type (in the catalog of the universe) and the point (`findBoundaryOfUnitNumber`), in that order, each giving the single not found. The database constraints stay as a second barrier.
- **Why:** a refusal by a foreign key would reach the person as an infrastructure error, not as the not found of FR-8.
- **Discarded:** relying on the constraints and translating their failures (it would read the meaning of database errors).
- **Approved by:** pending, to be asked at the implementation gate after T4.

## D-T4-4. Details are read with their points described in the same query

- **Decided:** `EntityRepository.findDetailsInUniverse` returns the entity with its introduction point and its oldest fragment that is not deleted (ties by identifier), and `RelationshipRepository.findAllOfEntity` returns the relationships where the entity is source or target with the names of both entities; each point carries the title and medium of its work and the label of its unit (`domain/narrative-point.ts`). Both join only tables of the knowledge module; the labels of the types come from the catalog port.
- **Why:** the panel shows names, titles, unit wording and labels (FR-10); one query per read instead of one lookup per item.
- **Discarded:** separate lookups of names and points per relationship.
- **Approved by:** pending, to be asked at the implementation gate after T4.

## D-T4-5. A relationship with a deleted end is not listed

- **Decided:** `findAllOfEntity` leaves out a deleted relationship and one whose source or target is deleted.
- **Why:** a deleted entity is not found anywhere else (`findInUniverse`, lists), so a relationship to it would name an entity that cannot be opened; the trash of spec 007 restores both together.
- **Discarded:** listing it while only the relationship row is not deleted.
- **Approved by:** pending, to be asked at the implementation gate after T4.

## D-T4-6. A relationship whose type is not in the catalog fails with the infrastructure error

- **Decided:** when the catalog of the universe does not hold the type of a stored relationship, `get-entity-details` throws the `InfrastructureError` (generic answer, logged).
- **Why:** the composite foreign key keeps the type in the universe, so it only happens when the storage disagrees with itself; a reading without a label would be wrong data.
- **Discarded:** leaving the relationship out silently (data hidden without notice) or showing it without a label.
- **Approved by:** pending, to be asked at the implementation gate after T4.

## D-T4-7. Shape of the relationship and details input

- **Decided:** the relationship status accepts `null` or absence in shape and the domain answers `STATUS_INVALID` for both, as the fragment status (D-T3-4); a malformed entity identifier of the details action is a validation error on `entityId`, checked after the universe (as D-T2-2); field names are the exported `RELATIONSHIP_*_FIELD` constants and `ENTITY_ID_FIELD`.
- **Why:** one message per rule, the same through the form and through a direct call.
- **Discarded:** a required status in the Zod schema (a missing status would be a shape failure with another code).
- **Approved by:** pending, to be asked at the implementation gate after T4.

## D-T4-8. The universe load returns the relationship types through the catalog port

- **Decided:** `loadUniverseKnowledge` now also returns `relationshipTypes` (plan section 4), read in the composition through the same catalog port, with no use case of its own in the knowledge module.
- **Why:** the catalog is listed by the universes use case; a knowledge use case would only forward it.
- **Discarded:** a `list-relationship-types` use case in the knowledge module.
- **Approved by:** pending, to be asked at the implementation gate after T4.

## D-T5-1. The reads of the knowledge provider do not pass the tab account guard

- **Decided:** the load of a universe and the load of the details of an entity are sent without `confirmAccountBeforeSending`; only the three creations pass it (plan section 5).
- **Why:** the server takes the account from the session and answers not found for an identifier of another account, so nothing leaks; a guard probe before every read would double the calls. The tabs test counts these calls apart from the remember calls (D-T5-2).
- **Discarded:** passing every read through the guard.
- **Approved by:** the user, 2026-11-26, during T5.

## D-T5-2. Browser tests recognize a Server Action by its identifier

- **Decided:** the end-to-end support reads the identifier of each action from `.next/server/server-reference-manifest.json` (its `exportedName`) and compares it with the `next-action` header (`tests/e2e/support/server-action-ids.ts`). `isRememberCall` of `universes-tabs.spec.ts`, `waitForRememberAnswer` and `captureServerActionId` use it instead of the text of the body. No action contract changes.
- **Why:** `loadUniverseKnowledgeAction` and `rememberUniverseAction` send the same body (`{ universeId }`), so the body no longer tells them apart; the identifier does, exactly.
- **Discarded:** telling them apart by the answer (it cannot be used by the predicates that look at the request); changing the input of an action.
- **Approved by:** the user, 2026-11-26, during T5.

## D-T5-3. The text of the graph view

- **Decided:** "There is nothing to draw yet" is replaced by a text that speaks only about the graph: it arrives in a future version and the list view shows the entities.
- **Why:** with entities stored, "nothing to draw" says that the universe has no entities (T5 done-when: no text says that entities are unavailable), and the list view is where they are now.
- **Discarded:** leaving it for T7 (it would be wrong as soon as an entity exists).
- **Approved by:** the user, 2026-11-26, at the implementation gate after T5.

## D-T5-4. Ends of the universe load

- **Decided:** a load without a session leaves the page for the sign-in, as remembering a universe does; any other end (not found, validation, storage failure, no answer in 30 seconds, an unverifiable session, an answer of the wrong shape) is the `failed` state with "Try again". Loading the shown universe again (after a creation) keeps its content on screen until the new answer; an earlier answer of the same universe that arrives after a later request is discarded.
- **Why:** a read stores nothing, so trying again is safe; the list does not flash empty after every creation.
- **Discarded:** a separate unknown-result state for reads.
- **Approved by:** the user, 2026-11-26, at the implementation gate after T5.

## D-T5-5. The creation state belongs to the universe of its last submission

- **Decided:** the provider keeps the universe each creation was sent for. In another selected universe that creation neither blocks the forms nor shows its message, a new submission there releases it silently, and its answer is discarded without any message (the item appears when the person goes back, because the selection loads that universe again). The late-success confirmation of a work is shown only in its universe.
- **Why:** FR-12 and plan D12: a response of the previous universe is discarded without any message and does not alter the new one; the reducer of `universe-creation-state.ts` is reused as it is.
- **Discarded:** one global block for every universe (a form of the new universe would stay disabled without a reason shown).
- **Approved by:** the user, 2026-11-26, at the implementation gate after T5.

## D-T5-6. Where the work form opens, and the entity form entry

- **Decided:** the work form opens in the central area in place of the view, as the universe form does, from the "Add work" button of the works area (the drawer closes on a narrow screen) and from the "a work is needed first" state of the entity list. Selecting a universe, also the one already selected, closes it, as it closes the universe form. The "New entity" entry of the entity list arrives with the entity form in T6.
- **Why:** the sidebar is too narrow for a form and is a drawer below the md breakpoint; T5 does not build the entity form.
- **Discarded:** the form inside the works area.
- **Approved by:** the user, 2026-11-26, at the implementation gate after T5.

## D-T5-7. Files the plan did not name, and the files removed

- **Decided:** `src/components/knowledge/knowledge-form-vocabulary.ts` (type only, CMP-13, as `universe-form-vocabulary.ts`) and `src/components/knowledge/late-knowledge-creation-confirmation.tsx` (CMP-16). `works-empty-state.tsx` and `entity-list-empty-state.tsx` are removed (replaced by `works-area.tsx` and `entity-list.tsx`), and with them the folder `src/components/entities/`. `classifyEnd` and `readIssues` of `interpret-universe-action-result.ts` and `settleActionCall` of `universes-provider.tsx` are exported for the knowledge provider and interpreter, with no behavior change.
- **Why:** small single-purpose files in the planned entries, and no second copy of the classification of an action end.
- **Discarded:** copying the classification into the knowledge interpreter.
- **Approved by:** the user, 2026-11-26, at the implementation gate after T5.
