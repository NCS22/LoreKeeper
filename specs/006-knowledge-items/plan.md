# Plan 006 — Knowledge items: first creation and viewing

Status: approved

Spec: `specs/006-knowledge-items/spec.md` (Status: approved, no open questions; FR-1 to FR-12 and NFR-1 to NFR-4). It builds on spec 004 (acting user, owner isolation, error kinds and result shape, the creation lifecycle of the screen, the workspace shell) and uses its patterns by reference.

Items that `CLAUDE.md` puts under "ASK FIRST" are listed in "Needs approval" below with a recommendation and the alternative; none is decided here. Everything else is a decision with its discarded alternative in section 8.

## 0. Approach in one paragraph

A new server-side module holds works with their units, entities with their optional first fragment, and relationships. Every use case takes the acting user, checks that the universe is an own universe first (one port to the universes module) and answers one single not found error for anything that does not exist or is not the person's. The seed of the eight relationship types belongs to the universe: it is written in the same statement as the universe, so a universe never exists without them, and the same SQL backfills the universes that already exist. Reads reach the screen through Server Actions called from a client provider that loads the knowledge of the selected universe, discards any answer for a universe that is no longer selected (FR-12) and reuses the creation lifecycle of spec 004 (single submission, 30-second and 5-minute rules, late success) for the three new forms. The works area, the entity list and the details panel stop being empty states and show what was created; the graph view and the timeline entry do not change. No new dependency, no new layer and no new top-level folder.

## Inputs already decided (not new decisions)

- Spec 006 records the user's decisions of 2026-11-25: order ahead of the roadmap, minimal works, entities with one optional fragment, predefined relationship types only, no spoiler notice on screen, the temporary exceptions to the spoiler rules (already written in the project rules when the spec was approved) and the independence of the points of entity, fragment and relationship.
- **OD-16 is decided by the user on 2026-11-25:** the seed is the eight types of the data model with these labels (label / inverse label): `MEMBER_OF` (member of / has member), `LEADER_OF` (leader of / led by), `ALLY_OF` (ally of, symmetric), `ENEMY_OF` (enemy of, symmetric), `PARENT_OF` (parent of / child of), `SIBLING_OF` (sibling of, symmetric), `LOCATED_IN` (located in / contains), `POSSESSES` (possesses / possessed by); present in every universe, existing ones included. Recorded here (D5).
- Patterns of specs 002 to 004 used without change: `getActingUser`, `runAction`, `parseActionInput` (plain `z.object` strips unknown keys), `assertSameSiteRequest`, the error mapper and its codes, `runWithTimeLimit`, `leaveAccountPage`, the account guard of other tabs, the creation reducer and its notice codes, vocabulary-as-props (a client component never imports a module index that carries server wiring), and 004 D20 (`ViewerContext` enters with the first read of narrative information).

## 1. Affected modules and layers

**New module `knowledge`** (needs approval, item 1): works and their units, entities, fragments and relationships. One module, because every rule here crosses these items (a boundary is a work and one of its units, a relationship needs two entities and a boundary, the duplicate notice reads entities) and splitting them would need three ports and three compositions for no behavior.

| Layer | What goes in it |
|---|---|
| `domain` | Validation of work title, medium, unit count, unit number, entity name, entity type, fragment content and status; the unit wording of a medium; the comparable name of an entity; the reading of a relationship from one of its two entities; `KnowledgeItemNotFoundError` (one class, one fixed message, for universe, work, unit, entity and type) and the business-rule error for a relationship from an entity to itself; item types; repository ports (`work-repository`, `entity-repository`, `relationship-repository`). |
| `application` | One use case per file: `create-work`, `list-works`, `create-entity`, `list-entities`, `get-entity-details`, `create-relationship`; `resolve-viewer-context` (the ownership check, built on the port `own-universe-lookup`); the port `relationship-type-catalog`; DTO mapping. |
| `infrastructure` | Prisma repositories for works with units, entities with fragments, and relationships; mappers; one function that turns storage failures into infrastructure errors (as `run-universe-storage-operation`). |
| `composition.ts`, `index.ts` | Wires the repositories and the two ports to the public interface of `universes`; exports the composed use cases, DTO types and the field and code constants the screens need. |

**Existing module `universes`** (changes to spec 004 code, needs approval, item 3): creating a universe also stores its eight relationship types in the same statement; a new use case `find-own-universe` (the port of `knowledge` is implemented with it); a new use case `list-relationship-types` and a read-only port `relationship-type-repository` (the catalog is owned by `universes`, D2); the seed constant `predefined-relationship-types`.

**`src/shared`** (item 4): `domain/viewer-context.ts` (ownership data only: viewer user id, universe id, universe mode), `domain/spoiler-boundary.ts` (work id and unit id, a type), and the text rules both modules need (`domain/text-rules.ts`: storable text, characters counted in code points; `domain/comparable-text.ts`: the comparable form of a name), which `universe-text.ts` and `toComparableUniverseName` then delegate to.

**Presentation:** new folder `src/app/knowledge/` (like `src/app/universes/`: Server Actions and their Zod schemas, no page); new folder `src/components/knowledge/`; changes in `src/components/workspace/`, `sidebar/`, `inspector/`, `entities/`, `universes/` and `src/messages/en.ts`.

Dependency direction as always: `presentation → application → domain ← infrastructure`; `knowledge` imports `universes` only through `@/modules/universes`; `universes` never imports `knowledge` (no cycle).

## 2. Data

Schema change and migration (needs approval, item 2). One migration, applied cleanly on an empty database, containing the tables below, the hand-added constraints and the backfill.

New enums: `WorkMedium` (7 values of the spec), `EntityType` (8), `KnowledgeStatus` (`CONFIRMED`, `USER_NOTE`, `SPECULATION`).

| Table | Columns (besides `id` uuid, `createdAt`, `updatedAt`, `deletedAt`) | Integrity |
|---|---|---|
| `RelationshipType` | `universeId`, `key`, `label`, `inverseLabel`, `isSymmetric`, `isPredefined` | FK `universeId` cascade; unique `(id, universeId)` (target of composite FKs); partial unique `(universeId, key)` where `deletedAt` is null (no second copy, FR-3) |
| `Work` | `universeId`, `title`, `medium` | FK cascade; unique `(id, universeId)`; index `(universeId, createdAt, id)`; CHECK title length 1 to 200 in code points |
| `NarrativeUnit` | `workId`, `ordinal`, `label` | FK `workId` cascade; unique `(workId, ordinal)` and `(id, workId)`; index `(workId, label)`; ordinals step 1000 (data model), labels "1" to "N" |
| `Entity` | `universeId`, `type`, `name`, `normalizedName`, `attributes` (jsonb, default `{}`), `boundaryWorkId`, `boundaryUnitId` | composite FKs `(boundaryUnitId, boundaryWorkId) → NarrativeUnit(id, workId)` restrict and `(boundaryWorkId, universeId) → Work(id, universeId)` (the boundary work is in the entity's universe, enforced by the database); unique `(id, universeId)`; indexes `(universeId, createdAt, id)` and `(universeId, type, normalizedName)`; CHECK name length 1 to 120 |
| `KnowledgeEntry` | `universeId`, `entityId`, `content`, `status`, boundary pair | composite FKs `(entityId, universeId) → Entity(id, universeId)`, the two boundary FKs as above; CHECK content length 1 to 5000 |
| `Relationship` | `universeId`, `relationshipTypeId`, `sourceEntityId`, `targetEntityId`, `status`, boundary pair | composite FKs for both entities, the type and the boundary (all with `universeId`, so a cross-universe reference is refused by the database); CHECK `sourceEntityId <> targetEntityId`; indexes by `(universeId, sourceEntityId)` and `(universeId, targetEntityId)` |

Deviations from `data-model.md`, all part of item 2: `Work.unitKind` is not stored (the wording derives from the medium, D10); `displayOrder`, `description`, `coverImageUrl`, `NarrativeUnit.groupLabel` and `Relationship.description` are not created (out of scope; nullable columns can be added later); `KnowledgeEntry` carries `universeId` so the database can check that its entity and its boundary work share the universe. Attributes stay `{}` (OD-7 untouched). `deletedAt` exists on every table and every query filters it (the trash is spec 007).

**Seed and backfill.** The eight rows come from one constant in the universes domain. New universes: the Prisma repository `add` writes the universe and its eight types in one nested create (one transaction), so a failure stores neither (FR-3). Existing universes: the migration ends with an `INSERT ... SELECT ... FROM "Universe" CROSS JOIN (VALUES ...)` that gives each universe the eight types (idempotent thanks to the partial unique index and `ON CONFLICT DO NOTHING`). Labels are written twice (constant and SQL); a database test pins both to the same list.

No data is stored in `localStorage`; the remembered universe is untouched.

## 3. Use cases

Acting user is always the first parameter after the dependencies; no command carries an owner. Every use case begins with the ownership check (`resolve-viewer-context`), which throws `KnowledgeItemNotFoundError` for a foreign, deleted or nonexistent universe, and `ValidationError` for a malformed identifier.

**`ViewerContext` (question of the temporary exception).** The read use cases (`list-works`, `list-entities`, `get-entity-details`) receive a `ViewerContext` as a required parameter, as `architecture.md` section 6 asks and 004 D20 announced; this spec is the first read of narrative information. It carries ownership data only (viewer user id, universe id, mode); it is built by the composition through `resolve-viewer-context` after the ownership check. No visibility rule is applied (temporary exception of spec 006): the repositories return everything of the own universe, and the comment on each read repository method names the exception. Phase 4 adds the progress to the context and the filter to those same methods. Write use cases receive the acting user and run the same resolution themselves.

| Use case | Does | Errors |
|---|---|---|
| `create-work` | Validates title (trimmed, 1 to 200 code points, storable text), medium, unit count text (digits only, spaces around ignored, leading zeros allowed, 1 to 5000); stores the work and N units in one repository call | `ValidationError` (all failing fields in one error), not found, infrastructure |
| `list-works` | The works of the universe in creation order (ties by id) with unit count and unit wording | not found, infrastructure |
| `create-entity` | Validates name, type, fragment (when its content is empty after trimming the fragment is dropped before anything else of it is read: status and boundary are neither validated nor looked up); resolves the boundary(ies) (work of the universe and unit number of that work, else not found); looks for a same-type entity with the same comparable name; stores the entity and the fragment in one call; returns the entity summary and the name of the oldest similar entity or `null` | validation, not found, infrastructure |
| `list-entities` | Entity summaries in creation order (ties by id) | not found, infrastructure |
| `get-entity-details` | The entity (not found if it is not in the universe), its introduction point, its oldest fragment with point, and its relationships in creation order, each already read from this entity (source reading or inverse reading, status, point); labels come from the catalog port | not found, infrastructure |
| `create-relationship` | Validates status and boundary; source equal to target is a business-rule violation; source, target, type and boundary work or unit that do not exist, belong to another account or universe, give the same not found; stores one relationship | validation, business rule, not found, infrastructure |
| `resolve-viewer-context` | Uses the port `own-universe-lookup`; returns the context or throws not found | not found, infrastructure |

Order of checks in `create-relationship` and `create-entity`: shape and field rules first (one `ValidationError`), then references (one not found), then the business rule where it applies. `create-relationship` checks "source is target" after the shape and before the lookups, so it never tells whether the entity exists.

`universes` gains `find-own-universe` (own, not deleted universe or `null`) and `list-relationship-types` (the eight types of an own universe, not found otherwise). Its `create-universe` does not change; the repository does.

## 4. Contracts

New file `src/app/knowledge/actions.ts`, same four steps as `src/app/universes/actions.ts` (same-site check, `getActingUser`, Zod, use case, `runAction`); the actor is read before the input is parsed. Schemas are plain `z.object` (shape only, unknown keys such as a relationship description, attributes, unit labels or an owner are stripped without error, FR-4, FR-7, NFR-2). One schema file per action, next to the actions.

| Action | Input (shape) | Success value |
|---|---|---|
| `createWorkAction` | `{ universeId: string, title: string, medium: string, unitCount: string }` | `{ work: WorkDto }` |
| `createEntityAction` | `{ universeId, name, type, boundary: { workId, unitNumber: string }, fragment?: { content: string, status?, boundary? } \| null }` | `{ entity: EntitySummaryDto, similarEntityName: string \| null }` |
| `createRelationshipAction` | `{ universeId, sourceEntityId, targetEntityId, relationshipTypeId, status, boundary: { workId, unitNumber: string } }` | `{ relationship: { id, sourceEntityId, targetEntityId } }` |
| `loadUniverseKnowledgeAction` | `{ universeId }` | `{ works: WorkDto[], entities: EntitySummaryDto[], relationshipTypes: RelationshipTypeDto[] }` |
| `loadEntityDetailsAction` | `{ universeId, entityId }` | `{ entity: EntityDetailsDto }` |

- The fragment is optional in shape. A fragment whose content is empty or only whitespace is dropped before its other fields are parsed (a preprocess in the schema, the use case does the same on its own, the rule lives in the domain); a fragment without `boundary` takes the entity's.
- Units are referenced by `{ workId, unitNumber }`, not by a unit identifier (D6). `unitNumber` and `unitCount` travel as text so that "1e3", "+12" or "7.0" reach the domain rule and are refused the same way through the form and through a direct call.
- DTOs (dates ISO strings, no ordinals, no owner): `WorkDto { id, title, medium, unitWording, unitCount, createdAt }`; `PointDto { workId, workTitle, unitWording, unitLabel }`; `EntitySummaryDto { id, name, type, createdAt }`; `RelationshipTypeDto { id, key, label, inverseLabel, isSymmetric }`; `EntityDetailsDto { id, name, type, introducedAt: PointDto, firstFragment: { content, status, point } \| null, relationships: [{ id, status, point, subjectName, label, otherName }] }` where `label` is the label or inverse label already chosen for this entity.
- Errors go through the one mapper: validation (400, `fieldErrors` keyed by input path, for example `fragment.content`, `boundary.unitNumber`), authentication, not found (404, the same fixed message for every reference), business rule (422), infrastructure (500, generic). Field names and issue codes are exported constants of the module index, handed to the client as a vocabulary built on the server (as 004 does).
- Route Handlers: none (D8).

## 5. UI

No new route: the workspace at `/` is the screen. Server Components are unchanged except `workspace.tsx`, which adds a `KnowledgeProvider` inside `UniversesProvider`; everything new that reacts is a Client Component under `src/components/knowledge/`.

**State.** `workspace-state.tsx` gains `knowledgeForm: null | "work" | "entity" | "relationship"` and `selectedEntityId: string | null`, with actions `knowledgeFormOpened`, `knowledgeFormClosed` and `entitySelected`. `universeSelected`, `universeCreated` and `universeCreationStarted` clear both (FR-12), and opening a knowledge form closes the universe form. After an entity is created its form closes, the entity is selected and the central view switches to the list.

**`KnowledgeProvider`.** Loads `loadUniverseKnowledgeAction` when the selected universe changes (the same path for the first load and for switching) and `loadEntityDetailsAction` when an entity is selected; remembers which universe an answer was asked for and discards it, without any message, if the selected universe is another by then (FR-12); the item that was stored appears when the person goes back (the load repeats on selection). States: `loading` (a `role="status"` text in the works area and the entity list), `failed` (message with a "Try again" button) and `loaded`. The three creations use the reducer and notice codes of `universe-creation-state.ts` as they are (one request blocks every knowledge form at a time, which is enough because only one form is open), `runWithTimeLimit`, `confirmAccountBeforeSending` (exposed by `UniversesProvider` instead of building a second guard) and a new interpreter `interpret-knowledge-action-result.ts` that reuses the classification of `interpret-universe-action-result.ts` (`classifyEnd` is exported, no behavior change). A late success is applied for the universe it was asked for (D12). After a successful creation the provider reloads the knowledge of that universe and, for a relationship, the details of the selected entity when it is one of the two.

**Components** (`src/components/knowledge/` unless noted):
- Works area: `works-area.tsx` replaces `WorksEmptyState` in `sidebar.tsx` (the empty state text stays while there are no works) with the list of works (title as plain text, medium, "120 chapters") and an always visible "Add work" button; `work-creation-form.tsx` (title, medium, number of units).
- Entity list: `entity-list.tsx` in the list view of `central-area.tsx` (rows are buttons, selected row marked, plain text names); empty state with the entity form, or the "a work is needed first" message with the work form (FR-9); a "New entity" button while a work exists; `entity-creation-form.tsx` (name, type, point, optional fragment: content, status radio with `USER_NOTE` proposed, a checkbox "Same point as the entity" that is checked by default and reveals a second point when unchecked); the duplicate notice (`role="status"`, names the oldest similar entity, stays until another form opens, another entity is selected or the universe changes).
- Point field: `point-field.tsx` = a native select of works (title and medium) and `unit-number-picker.tsx`, a text input (`inputmode="numeric"`) with the wording as label ("Chapter"), the hint "1 to N" linked by `aria-describedby`, "First" and "Last" buttons, the resolved point shown below it and an error linked to the field when the typed number matches no unit. Changing the work proposes the last unit in `AUTHOR` and clears the unit in `READER` (FR-4). No list of 5000 options is rendered (D7).
- Details panel: `entity-details-panel.tsx` goes into `InspectorPanel` instead of the static `InspectorEmptyState`: name, type, introduction point, first fragment or "no fragment yet", relationships as text or "no relationships", a "New relationship" button; states for "select an entity" (entities exist, none selected) and for no entity; `relationship-creation-form.tsx` (source proposed as the selected entity, type, target, status, point; a message "two entities are needed" replaces it while there are fewer than two).
- Text changes: `UniverseEmptyState` keeps name, mode and description and drops the "universe is empty" sentence; `en.inspector.emptyText` speaks only of events, sources and reading positions; `en.entityList.emptyText` and `en.graph.emptyText` stop saying that nothing can exist and the graph text speaks only about the graph; new `en.knowledge` messages. The mode explanation of a `READER` universe ("Protects you from spoilers...") is not touched (D13).
- Pure logic, unit tested: `resolve-typed-unit-number.ts` (digits only, spaces ignored, leading zeros allowed, within 1 to N, else none), `interpret-knowledge-action-result.ts`, `knowledge-issue-messages.ts`, `build-knowledge-form-vocabulary.ts`, `knowledge-load-state.ts` (reducer: loading, loaded, failed, stale answer discarded).

**Accessibility and layout.** Every field has a visible label and its error linked with `aria-describedby`, errors and failure notices follow the pattern of `universe-creation-form.tsx` (`role="alert"`, focus on the first invalid field or the message), the duplicate notice and the "created" confirmation are `role="status"` live regions, contrast and focus as the existing tokens, `min-w-0` and wrapping for every text of the person (004 FR-19), the picker has no horizontal overflow at 320 px with a work of 5000 units, a 200-character title and a 5000-character fragment (NFR-3).

## 6. Spoiler impact

Every item is stored with its boundary (`boundaryWorkId`, `boundaryUnitId`, `NOT NULL`; the database checks that the unit is of the work and the work is of the universe), so Phase 4 can filter without changing data. No read path applies a visibility rule: `list-works`, `list-entities`, `get-entity-details`, `list-relationship-types` and the choices of the forms return everything of the own universe in `READER` and in `AUTHOR` universes (temporary exception of spec 006, in force in the project rules since the spec was approved). The read repository methods carry a comment naming the exception and its end (the implementation of the Phase 4 spec that filters them). Works, units and relationship types are structure and stay always visible in the final design as well. No other path exists: nothing reaches search, AI or another account. Protection in this spec is the owner isolation of every read and write, tested with two accounts (section 7); no spoiler suite is added or run.

## 7. Test design

Levels follow `docs/criticality-inventory.md` and the skill `quality-testing-core`. New production files get inventory entries in the task that creates them (otherwise `pnpm test:coverage` fails on an unmatched file); the ids below are proposals. Tests mirror `src/` in `tests/`.

| Component (new entry or existing entry changed) | Level | Behaviors to protect | Test type |
|---|---|---|---|
| **UNI-3 changed**: `find-own-universe.ts`, `list-relationship-types.ts` (added to the entry) | CORE | Own universe found; foreign, deleted and nonexistent look the same; types listed only for an own universe (protected: never returns the types of another account) | Unit with fakes and database scenarios (as `remember-universe`) |
| **UNI-4 changed**: `prisma-universe-repository.ts` (seed), new `prisma-relationship-type-repository.ts` | CORE | A created universe has exactly the eight types with these labels and symmetric flags; a failure storing a type stores no universe; no second copy; types read only for the given owner's universe; the backfill gives an old universe the eight types without duplicating | Integration against the test database through the repository contract (fake and PostgreSQL pass the same scenarios); a trigger forces the failure; the backfill block of the migration is executed against a universe inserted without types |
| **UNI-1/UNI-3 changed**: `universe-text.ts`, `universe-name.ts` delegate to shared | IMPORTANT / CORE | No behavior change | Existing tests stay green before and after (evidence "green before and after") |
| **SHR-8 new**: `src/shared/domain/text-rules.ts`, `comparable-text.ts` | IMPORTANT | Null character, lone surrogate, code-point counting; case, accents, spacing and composition ignored | Unit |
| **SHR-7 changed (TIER 0)**: `viewer-context.ts`, `spoiler-boundary.ts` | TIER 0 | Types only | None |
| **KNO-1 new**: `domain/` validators (`work-title`, `work-medium`, `unit-count`, `unit-number`, `entity-name`, `entity-type`, `fragment-content`, `knowledge-status`, `unit-wording`, `entity-comparable-name`) | IMPORTANT | Each limit (1, 200, 201; 120, 121; 5000, 5001; N from 1 to 5000, 0, 5001, signs, decimals, exponents, separators, spaces, leading zeros, huge values); trimming; storable text; unknown enum values; wording per medium; comparable name equivalences | Unit, per rule and limit |
| **KNO-2 new**: `domain/relationship-reading.ts`, `knowledge-errors.ts` | CORE | Reading from the source uses the label, from the target the inverse label, symmetric types read the same from both; the not found error has one fixed message for every case; the business-rule error | Unit, exhaustive |
| **KNO-3 new**: `application/*` use cases, `resolve-viewer-context`, DTO mapping | CORE | Owner isolation of every use case (protected tests: another account's universe, work, entity, type and boundary give the same not found as nonexistent and store nothing; read use cases never list items of another account); every validation outcome in one `ValidationError`; atomic work with units and entity with fragment; empty fragment content ignores status and boundary without lookups; duplicate notice by type and comparable name (other type, none); source equals target refused first; points independent; first fragment and relationship order; extra input fields never stored | Unit with fakes that pass the contracts; owner isolation also against the database |
| **KNO-4 new**: `infrastructure/*` repositories, mappers, storage operation | CORE | Persistence and ordering (creation order, ties by id); the composite foreign keys and `CHECK`s refuse a cross-universe reference, a unit of another work and source equals target even by a direct insert (protected); all-or-nothing writes; failures become infrastructure errors; 5000 units stored in one operation | Integration against the test database through repository contracts, fake and PostgreSQL |
| **KNO-5 new**: `composition.ts`, `index.ts` | CORE | The real wiring (ports to `universes`) | Integration test of the real composition (as `tests/modules/universes/composition.test.ts`) |
| **KNO-6 new (TIER 0)**: item types and ports (`work.ts`, `entity.ts`, `relationship.ts`, the three repository ports, `own-universe-lookup.ts`, `relationship-type-catalog.ts`) | TIER 0 | Type declarations | None |
| **APP-8 new**: `src/app/knowledge/actions.ts` and the five input schemas | CORE | Actor read before input; same-site check; strip unknown keys (`ownerId`, `description`, `attributes`); forged owner and universe of another account give the same result as nonexistent; single not found answer for every bad reference; fragment dropped before its shape is parsed when the content is empty; mapped errors with no internals | Integration through the actions with a real session and database (as `tests/app/universes/actions.test.ts`) |
| **CMP-14 new**: `resolve-typed-unit-number.ts`, `interpret-knowledge-action-result.ts`, `knowledge-issue-messages.ts`, `build-knowledge-form-vocabulary.ts`, `knowledge-load-state.ts` | IMPORTANT | Each outcome and message; stale answer for another universe discarded; typed number rules; business-rule violation shown on the target field | Unit |
| **CMP-15 new**: `unit-number-picker.tsx`, `point-field.tsx` | IMPORTANT | Typing, First and Last, resolved point, error linked to the field, last unit proposed in `AUTHOR` only, unit cleared on work change in `READER` | Component tests (`.test.tsx`, jsdom): these hold the riskiest interaction of the spec and reach the target |
| **CMP-16 new**: `knowledge-provider.tsx`, `works-area.tsx`, `entity-list.tsx`, `entity-details-panel.tsx`, the three forms | IMPORTANT | The journeys of the spec in a browser | Protected by browser tests; entry records `floor: lines 0, branches 0, plan: raise it when the component is next touched, with component tests`, as the other interactive entries (decision D-4 of spec 005b; item 5) |
| **CMP-7 changed**: `workspace-state.tsx` | IMPORTANT | New actions; universe selection and creation clear form and selected entity | Existing unit tests extended (red then green) |
| **CMP-8 changed**: `workspace.tsx`, `central-area.tsx`, `sidebar.tsx`, `inspector-panel.tsx`; **CMP-5 changed**: `universe-empty-state.tsx` | IMPORTANT | Browser-protected; their floors stay | Browser tests below |
| **CMP-13 / MSG-1 (TIER 0)**: empty-state texts and `en.ts` | TIER 0 | None | None |
| **CFG-3 changed**: `schema.prisma` and the migration | CORE | Applies on an empty database; the constraints above | Protected by the database tests of KNO-4 and UNI-4; migration applied on an empty database in the verification gate of T1 |

Test support: `tests/support/fakes/` (fake work, entity and relationship repositories, fake relationship type repository), `tests/support/contracts/` (one contract per port, run against fake and PostgreSQL as `universe-repository-contract.ts`), `tests/support/database/postgres-knowledge-storage.ts`, `tests/support/knowledge-repository-factories.ts`. Deleting a user already cascades to every new table (no change to the database reset).

**Spoiler suite:** not required by any task (temporary exception). **E2E** (`tests/e2e/knowledge.spec.ts` with a support file): (1) main journey: create a `READER` universe, a work of 120 units, entity A with a first fragment, entity B, a relationship; both readings in the details panel and after a reload (`MEMBER_OF`: "A — member of → B" and "B — has member → A"; `ALLY_OF` the same on both sides); (2) a second account sees none of it and a name that exists only in the other account makes no notice; (3) the duplicate notice names the existing entity and does not block; (4) switching universe with a half-typed form and a selected entity clears both; (5) a 5000-unit work at 320 px: the picker is usable by keyboard and nothing overflows; (6) the three forms with a lost connection keep the typed values. Existing browser tests that assert the removed texts (`tests/e2e/universes.spec.ts`, `universes-layout.spec.ts`, `sign-out.spec.ts`) are updated in the task that changes the texts. The keyboard and screen-reader items of NFR-3 are a manual check by the user.

## 8. Decisions

| # | Decision | Discarded alternative and why |
|---|---|---|
| D1 | One module `knowledge` (item 1). | `works` + `entities` (relationships inside entities), or the three planned modules: ports and compositions between modules that always change together, for an early version the user wants small. |
| D2 | The relationship type catalog is owned by the universes module and is seeded in the same Prisma statement as the universe; `knowledge` reads it through a port. | A database trigger that seeds (hidden logic, labels in SQL only); a cross-module write inside a `UnitOfWork` (the interface does not exist yet and `universes` and `knowledge` would depend on each other); `knowledge` owning the catalog (a cycle: `universes` must seed, `knowledge` must check ownership). |
| D3 | No `UnitOfWork`: each all-or-nothing operation (work with units, entity with fragment, universe with types) is one repository call with a nested Prisma write. | Introducing `UnitOfWork` now: shared infrastructure that spec 007 needs anyway, but nothing here crosses modules in a write. |
| D4 | `ViewerContext` exists now with ownership data only, required by the read use cases, built after the ownership check. | Reads with only the acting user (as `loadWorkspaceUniverses`): Phase 4 would change every signature and nothing would force the update. |
| D5 | OD-16 is decided as the seed in "Inputs already decided". The row of OD-16 in `docs/open-decisions.md` and the sentence "Proposed seed (to confirm in Phase 2...)" in `data-model.md` are updated by the main agent in the commit that approves this plan (the planner cannot write outside `specs/`); if not done then, the implementer does it in the closing step. | Leaving both until the closing: the rule of `open-decisions.md` says the plan's author removes the row. |
| D6 | The contract refers to a unit by `(workId, unitNumber)`, resolved to the unit of that work on the server; a number with no unit answers not found. A unit of another work cannot be expressed, which meets FR-8 by construction; the database still refuses it. | Sending unit identifiers: the client would need up to 5000 identifiers per work or a second request per work, and nothing is gained. |
| D7 | The unit picker is a typed number with "First" and "Last", not a list. | A `<select>` or `<datalist>` of 5000 options: heavy and unusable at 320 px. |
| D8 | Reads are Server Actions called by the provider. | Route Handlers with TanStack Query (004 D1 discarded it for the same reasons: no operation-call rule in the guard for them and the library is not installed). |
| D9 | The first load goes through the same client action as a switch of universe. | Loading the initial universe on the server: a second path to build, test and keep consistent with FR-12. |
| D10 | `unitKind` is not stored; the wording derives from the medium in one domain function. | Storing it as in the data model: a column that can disagree with the medium. |
| D11 | `normalizedName` is stored with an index and computed with the same function as the comparable name of a universe (shared). | Comparing in memory (004 D7): fine for tens of universes, not for the entities of a long work. |
| D12 | A late answer is applied for the universe it was asked for; if that universe is no longer selected it is discarded silently (FR-12). | Showing the item in the new universe's list (wrong data) or a message (the spec forbids it). |
| D13 | The explanation text of the `READER` mode is left as it is, although it promises protection that does not exist yet; the user decided that no notice is shown (the user was told about this text and it stays as written). | Rewording it: outside the spec. Raised in the report so the user can decide it separately. |
| D14 | The universe repository keeps one `add` that also writes the types. | A separate "seed" call after the add: two statements, a window with a universe without types. |
| D15 | The first fragment is the oldest one (creation order); today there is at most one. | Ordering by boundary as the data model says for lists: no meaning with one fragment; spec 007 or later adds fragments and orders them. |
| D16 | Entity details are loaded per selected entity and reloaded after a relationship is created. | Loading every relationship in the universe load: more data than the panel needs. |
| D17 | Field names of nested input use the dotted path that `parseActionInput` already produces. | Flat names: they would need a second mapping. |

## 9. Coverage

| FR / NFR | Covered by |
|---|---|
| FR-1 | `create-work` and `work-repository` (section 3, 2); `createWorkAction`; work form and works area (section 5); T2, T5 |
| FR-2 | `list-works`; works area with always visible button (section 5); T2, T5 |
| FR-3 | Migration, seed constant, `prisma-universe-repository` nested create, backfill (sections 2, 3); T1 |
| FR-4 | `create-entity`, domain validators, `createEntityAction`, entity form and point field (section 5); T3, T5 |
| FR-5 | Fragment handling in `create-entity` and in the action schema, "same point" checkbox; T3, T5 |
| FR-6 | Duplicate lookup in `create-entity`, notice in the entity form; T3, T5 |
| FR-7 | `create-relationship`, `createRelationshipAction`, relationship form with the "two entities needed" message; T4, T6 |
| FR-8 | One not found error and ordered checks in every use case and in the composite foreign keys; consolidated cross-account tests; T2, T3, T4 |
| FR-9 | `list-entities`, entity list with its three states, selection of the created entity; T3, T5 |
| FR-10 | `get-entity-details`, `relationship-reading`, details panel, reload; T4, T6 |
| FR-11 | Every action and use case (same pattern as spec 004); T2, T3, T4 |
| FR-12 | Workspace state clearing, provider discarding stale answers; T5 (unit and browser), T6 (browser) |
| NFR-1 | Repository contracts run against fake and PostgreSQL, including the seed; T1 to T4 |
| NFR-2 | Two-account tests of every use case, action and repository; T1 to T4, e2e T6 |
| NFR-3 | Picker component tests, layout and keyboard checks in the browser, manual check by the user; T5, T6 |
| NFR-4 | `tests/e2e/knowledge.spec.ts`; T6 |

## Expected task split (for `/sdd-tasks`, six tasks, one commit each)

- **T1 Schema, seed and universes changes** (FR-3, NFR-1, NFR-2): migration with backfill, seed on universe creation, `find-own-universe`, `list-relationship-types`, shared text rules, `ViewerContext` and `SpoilerBoundary` types.
- **T2 Module `knowledge` and works** (FR-1, FR-2, FR-11): module skeleton and composition, works with units, `load` action, work contracts.
- **T3 Entities and first fragment** (FR-4, FR-5, FR-6, FR-9 data): entity with fragment, duplicate notice, entity list use case, action.
- **T4 Relationships and entity details** (FR-7, FR-8, FR-10 data): relationship creation, reading, details use case, actions.
- **T5 Screens: data layer, works area, entity list and the work and entity forms** (FR-1, FR-2, FR-4 to FR-6, FR-9 and FR-12 on screen). The largest task: if it overflows, split it into T5a (provider, state, works area, work form, lists) and T5b (entity form and picker), as 004 D22 allowed.
- **T6 Details panel, relationship form, text changes and the main browser journey** (FR-7, FR-10, NFR-3, NFR-4), plus the update of the existing browser tests that assert removed texts.

## Closing checklist (for the closing step, not for tasks)

- Remove OD-16 from `docs/open-decisions.md` if the plan approval commit did not (D5); update `data-model.md` (seed decided; the models above; the deviations of section 2); roadmap Phase 2 row (works, entities and relationships started by spec 006; OD-16 resolved), Phase 1 row and every mention of "spec 006" as the lifecycle spec changed to 007 (`CLAUDE.md` status paragraph, roadmap, the OD-6 row, `data-model.md`); "Current status" of `CLAUDE.md`.
- Update the planned-modules list in `CLAUDE.md` (Structure: "Planned modules: universes, works, entities, relationships, ...") to reflect the approved `knowledge` module (works, entities and relationships live in it; `events`, `sources` and the rest stay planned), and the module and folder lists of `architecture.md` that name the planned modules, the new `src/app/knowledge/` folder included.
- Check the temporary exceptions are still in place in `CLAUDE.md` and the three rules files; add to `docs/hardening.md` the rows proposed by the spec (several tabs, network cuts, layout stress with hundreds of entities).
- Spec 004 gets the dated note at its top "Superseded in part by spec 006" (FR-15, FR-17, the seeding exclusion, the panel and entity list texts), in the way of 004 D21; it stays `implemented`.
- Inventory: every new file is in exactly one entry; floors and overrides raised or removed; `pnpm test:coverage` passes without notices.

## Needs approval

All six items were answered by the user on 2026-11-25, each as recommended: "Approved by the user on 2026-11-25". Nothing is waiting for approval.

1. **New module `knowledge`, new folders `src/app/knowledge/` and `src/components/knowledge/`.** Recommendation: one module (D1). Alternative: `works` + `entities`, or the three planned modules (`works`, `entities`, `relationships`): more ports and wiring, no extra behavior. **Approved by the user on 2026-11-25.**
2. **Prisma schema change and migration** (tables, enums, composite foreign keys, `CHECK`s, partial unique index, backfill of existing universes), with the deviations of section 2 (no `unitKind`, `displayOrder`, descriptions, cover, `groupLabel`; `universeId` on `KnowledgeEntry`; the relationship type catalog owned by `universes`). Recommendation: as written. Alternative: follow the data model literally (more columns nothing writes) or seed with a trigger (hidden logic). **Approved by the user on 2026-11-25.**
3. **Changes to spec 004 code:** `UniverseRepository.add` also writes the eight types (and its fake); the universes module gains two use cases and one port; `UniversesProvider` exposes `confirmAccountBeforeSending`; `classifyEnd` is exported; `workspace-state`, `central-area`, `sidebar`, `inspector-panel`, `universe-empty-state` and the texts of `en.ts` change; existing browser tests that assert removed texts are updated. Recommendation: yes. Alternative: none that meets FR-3 and FR-15 of spec 004's replacement. **Approved by the user on 2026-11-25.**
4. **New shared pieces:** `ViewerContext`, `SpoilerBoundary`, `text-rules.ts`, `comparable-text.ts`, with `universe-text.ts` and `toComparableUniverseName` delegating to them (behavior-keeping). Recommendation: yes. Alternative: copy the helpers into `knowledge` and leave `universes` untouched (duplicated rules that can drift) and skip `ViewerContext` (D4). **Approved by the user on 2026-11-25.**
5. **Inventory entries for the new components, with a floor of 0 for CMP-16** (browser-protected, as the other interactive entries since decision D-4 of spec 005b) and component tests only for the picker (CMP-15). Recommendation: yes. Alternative: component tests for every new component (about doubles T5 and T6). **Approved by the user on 2026-11-25.**
6. **Units referenced by work and number in the contract (D6).** Recommendation: yes. Alternative: unit identifiers, with a second request or a very large load for long works. **Approved by the user on 2026-11-25.**

No new dependency, layer or top-level folder is proposed.
