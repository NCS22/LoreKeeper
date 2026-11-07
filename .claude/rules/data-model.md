---
paths:
  - "prisma/**"
  - "src/modules/**/domain/**"
  - "src/modules/**/infrastructure/**"
---

# Data Model - LoreKeeper

Domain model and persistence rules. The requirements of each feature live in `specs/NNN-feature/spec.md` and the phases in `docs/roadmap.md`; this file defines how that functionality is represented as data.

Nothing listed in `docs/open-decisions.md` may be implemented until it is resolved.

---

## 1. General conventions

- Primary keys are UUIDs. Better Auth is configured to generate UUIDs for `User`.
- Timestamps are `timestamptz`, stored in UTC and serialized as ISO 8601.
- Every user-content table has `createdAt`, `updatedAt` and `deletedAt` (nullable, soft delete). The only exceptions are tables of user state, not content: `ReadingProgress` and `UserPreferences` have only `updatedAt` and are hard-deleted (with their work or user when it is purged).
- `status` (`CONFIRMED | USER_NOTE | SPECULATION`) lives on `KnowledgeEntry`, `EntityAlias`, `Relationship` and `Event`; `Entity` has none because its knowledge already carries one per entry. `CONFIRMED` does not require a `Citation`; the interface flags confirmed items that have none as "without source".
- Closed categories are enums. User-extensible categories are catalog tables (e.g. `RelationshipType`).
- Foreign keys are always declared. Writes touching several records run in one transaction.
- Every universe belongs to one user. Tables that hang directly from a universe carry `universeId`, so every query can be scoped by owner.
- Three separate type families: domain types (`modules/*/domain`), Prisma types (infrastructure only) and API DTOs (presentation). Mapping happens in repositories and handlers.
- Name normalization (`normalizedName`, `normalizedAlias`): lowercase, Unicode NFD with diacritics removed, trimmed, inner whitespace collapsed. Used for search and duplicate detection.

## 2. Spoiler boundary

A spoiler boundary marks the point of a work where a piece of information is revealed.

- In code it is the `SpoilerBoundary` value object (work + narrative unit, in `src/shared/domain`); there is no table of that name. It is stored as two columns on each table that needs it: `boundaryWorkId` and `boundaryUnitId`.
- Composite foreign key `(boundaryUnitId, boundaryWorkId) → NarrativeUnit(id, workId)`, so the unit always belongs to the referenced work.
- The work must belong to the same universe as the item.
- One boundary per item. A user following several adaptations chooses one work as reference, and the boundary is compared only with the reading progress of its own work (`boundaryWorkId`). There is no mapping between adaptations.
- In `AUTHOR` universes the boundary is still required and stored, because it orders information for chronology, but the visibility filter ignores it. When the author does not pick one, the interface proposes the last unit of the work.
- Boundary columns are `NOT NULL` for now (see OD-1 in `docs/open-decisions.md`).

Tables with a boundary: `Entity` (introduction), `KnowledgeEntry`, `EntityAlias`, `Relationship`, `Event` (discovery).

## 3. Entities

### User
Managed by Better Auth (its own tables, named after the Prisma models with an initial capital: `User`, `Session`, `Account`, `Verification`). The domain only references `User.id`. No domain fields are added to Better Auth tables without approval.

These four are identity and credential tables, not user content, so they carry no `deletedAt` (spec 002, decision D16; deleting an account is out of scope). They follow the other conventions of section 1: UUID primary keys and `timestamptz(3)` timestamps (UTC). `User.email` is stored in comparable form (trimmed, lower-case, at most 254 characters), unique and guarded by a `CHECK` constraint in the migration.

### Universe
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| ownerId | uuid | FK User |
| name | text | 1-120 characters (Unicode code points), trimmed |
| description | text? | at most 2000 characters (Unicode code points), trimmed; only whitespace counts as none |
| coverImageUrl | text? | external URL only |
| mode | enum `READER` \| `AUTHOR` | default `READER`; cannot change after creation |
| createdAt, updatedAt, deletedAt | timestamptz | |

### Work
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| universeId | uuid | FK Universe |
| title | text | |
| medium | enum `NOVEL` \| `MANGA` \| `COMIC` \| `ANIME` \| `TV_SERIES` \| `FILM` \| `OTHER` | |
| unitKind | enum `CHAPTER` \| `EPISODE` \| `OTHER` | wording for the UI |
| description | text? | |
| coverImageUrl | text? | |
| displayOrder | int | order of works inside the universe |
| createdAt, updatedAt, deletedAt | timestamptz | |

### NarrativeUnit
Ordered index of the chapters or episodes of a work. Created only by the user, in bulk ("chapters 1-500") or one by one. The system never infers units. AI may suggest units, but they exist only once the user approves them.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| workId | uuid | FK Work; unique `(id, workId)` for composite FKs |
| ordinal | int | assigned by the system; unique per work |
| label | text | what the user sees ("Vol. 2, Ch. 1", "Interlude") |
| groupLabel | text? | grouping for selectors ("Volume 2", "Season 1") |
| createdAt, updatedAt, deletedAt | timestamptz | |

- The user only sees and picks labels. `ordinal` is never user input and is only used for comparisons.
- New units get ordinals with gaps (step 1000). Inserting between two units takes the midpoint; when no gap is left, the work's ordinals are rebalanced in one transaction.
- A unit referenced by any boundary or reading progress cannot be deleted (`ON DELETE RESTRICT`).

### Entity
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| universeId | uuid | FK Universe |
| type | enum `CHARACTER` \| `LOCATION` \| `ORGANIZATION` \| `FACTION` \| `OBJECT` \| `ABILITY` \| `SPECIES` \| `CONCEPT` | |
| name | text | name under which it is introduced |
| normalizedName | text | indexed |
| attributes | jsonb | default `{}`, see section 6 |
| boundaryWorkId, boundaryUnitId | uuid | introduction point |
| createdAt, updatedAt, deletedAt | timestamptz | |

- An entity has no description column. Its description is the composition of its visible `KnowledgeEntry` fragments.
- A secret identity or later name is an `EntityAlias`, never a rename.

### KnowledgeEntry
A fragment of knowledge about an entity, revealed at a specific point.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| entityId | uuid | FK Entity |
| content | text | |
| status | enum `CONFIRMED` \| `USER_NOTE` \| `SPECULATION` | |
| boundaryWorkId, boundaryUnitId | uuid | |
| createdAt, updatedAt, deletedAt | timestamptz | |

- Displayed ordered by boundary ordinal, then `createdAt`.
- **Edit vs create rule:** editing a fragment corrects or extends it with information from the same point of the work, and keeps its boundary unless the user changes it explicitly. Information from a later point is always a new fragment with its own boundary. The edit flow asks the user which case applies.

### EntityAlias
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| entityId | uuid | FK Entity |
| alias | text | |
| normalizedAlias | text | indexed |
| status | enum `CONFIRMED` \| `USER_NOTE` \| `SPECULATION` | a secret identity can be a speculation |
| boundaryWorkId, boundaryUnitId | uuid | an alias can reveal an identity |
| createdAt, updatedAt, deletedAt | timestamptz | |

### RelationshipType
Catalog per universe. Predefined types are seeded when a universe is created; the user can add their own.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| universeId | uuid | FK Universe |
| key | text | UPPER_SNAKE_CASE, unique per universe among the non-deleted types |
| label | text | "member of" |
| inverseLabel | text | "has member" |
| isSymmetric | boolean | if true, `inverseLabel` equals `label` |
| isPredefined | boolean | seeded types cannot be deleted |
| createdAt, updatedAt, deletedAt | timestamptz | |

Proposed seed (to confirm in Phase 2, OD-16 in `docs/open-decisions.md`): `MEMBER_OF`, `LEADER_OF`, `ALLY_OF` (symmetric), `ENEMY_OF` (symmetric), `PARENT_OF`, `SIBLING_OF` (symmetric), `LOCATED_IN`, `POSSESSES`.

Rules for user-created types:
- `label` and `inverseLabel` can always be edited.
- `isSymmetric` is locked while any relationship uses the type.
- A type used by any relationship cannot be deleted until it is removed from those relationships. Predefined types can never be deleted.

### Relationship
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| universeId | uuid | FK Universe |
| relationshipTypeId | uuid | FK RelationshipType |
| sourceEntityId | uuid | FK Entity |
| targetEntityId | uuid | FK Entity |
| description | text? | |
| status | enum `CONFIRMED` \| `USER_NOTE` \| `SPECULATION` | |
| boundaryWorkId, boundaryUnitId | uuid | |
| createdAt, updatedAt, deletedAt | timestamptz | |

- Directed: `source —type→ target`. The inverse reading uses `inverseLabel`; no relationship is implicitly equivalent to another.
- `sourceEntityId ≠ targetEntityId`. Both entities and the type belong to the relationship's universe.
- Duplicates are allowed (the same pair can have the same type again at a different point).

### Event
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| universeId | uuid | FK Universe |
| title | text | |
| description | text? | |
| chronologicalOrder | numeric? | in-world order; null if unknown |
| chronologicalLabel | text? | free in-world date ("Year 3 of the Fifth Epoch") |
| status | enum `CONFIRMED` \| `USER_NOTE` \| `SPECULATION` | |
| boundaryWorkId, boundaryUnitId | uuid | discovery point |
| createdAt, updatedAt, deletedAt | timestamptz | |

- Chronological order (when it happens in the story) and discovery order (boundary) are independent.
- `numeric` allows inserting an event between two others without renumbering.

### EventParticipant
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| eventId | uuid | FK Event |
| entityId | uuid | FK Entity, same universe as the event |
| role | enum `PROTAGONIST` \| `PARTICIPANT` \| `AFFECTED` \| `LOCATION` \| `MENTIONED` | |
| createdAt, updatedAt, deletedAt | timestamptz | |

Unique `(eventId, entityId, role)`.

### Source
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| universeId | uuid | FK Universe |
| type | enum `WORK_UNIT` \| `SUPPLEMENTARY` \| `USER_NOTE` \| `EXTERNAL` | |
| workId | uuid? | FK Work |
| narrativeUnitId | uuid? | FK NarrativeUnit of that work |
| title | text | |
| reference | text? | URL, ISBN or free reference |
| createdAt, updatedAt, deletedAt | timestamptz | |

`WORK_UNIT` requires `workId` and `narrativeUnitId`. Other types may leave them null.

### Citation
Links a source to one piece of knowledge.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| sourceId | uuid | FK Source |
| locator | text? | page, paragraph, timestamp |
| entityId | uuid? | FK Entity |
| knowledgeEntryId | uuid? | FK KnowledgeEntry |
| relationshipId | uuid? | FK Relationship |
| eventId | uuid? | FK Event |
| createdAt, updatedAt, deletedAt | timestamptz | |

`CHECK`: exactly one of the four target columns is not null. Source and target belong to the same universe.

### ReadingProgress
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| userId | uuid | FK User |
| workId | uuid | FK Work |
| currentUnitId | uuid | composite FK `(currentUnitId, workId) → NarrativeUnit(id, workId)` |
| updatedAt | timestamptz | |

Unique `(userId, workId)`. Only the current position is stored; no history.

### UserPreferences
Per-user accessibility preferences. Today they live in the browser (`localStorage`, key `lorekeeper.accessibility`); with accounts they move here so they follow the user. User state, not content.

| Field | Type | Notes |
|---|---|---|
| userId | uuid | PK and FK User; no row means the defaults |
| background | closed set of background presets | same values as the interface (`obsidian`, `midnight`, `nocturne`, `parchment`) |
| text | closed set of text presets | same values as the interface (`vellum`, `ash`, `bright`) |
| textScalePercent | numeric | between 87.5 and 137.5, step 2.5; 100 by default |
| updatedAt | timestamptz | |

The allowed values and the range have one definition, shared by the interface and the validation at the boundary.

## 4. Spoiler visibility

Visibility is computed in the backend (`SpoilerService` in the domain, applied by repositories as query filters). Nothing is filtered in the frontend only.

1. Universe in `AUTHOR` mode → everything is visible.
2. Universe in `READER` mode → an item with a boundary is visible only if the user has progress on `boundaryWorkId` and `ordinal(currentUnit) >= ordinal(boundaryUnit)`.
3. No progress on a work → nothing bounded to that work is visible.
4. Dependent visibility (applied with read-only joins on the other module's tables, see `architecture.md` section 4):
   - `KnowledgeEntry`, `EntityAlias`: own boundary **and** entity visible.
   - `Relationship`: own boundary **and** both entities visible.
   - `EventParticipant`: event visible **and** entity visible.
   - `Citation`: its target visible. Its `Source` and `locator` are included only when the `Source` is visible too: the locator inherits the visibility of its `Source`.
5. Structure and sources, in `READER` universes:
   - `Work`, the list of `NarrativeUnit` and `RelationshipType` are always visible. The unit labels are written by the user, and the reader needs the whole list to set a reading position.
   - `Source`: visible once its narrative unit has been reached (the same comparison as a boundary, on its `workId`). Sources that have no unit are not decided yet (OD-20 in `docs/open-decisions.md`).
6. The same rules apply to every read path: pages, API, search, graph, timeline and AI retrieval.

Spoiler visibility rules have mandatory unit tests covering: boundary equal to progress, one unit before and after, no progress, `AUTHOR` mode, and every dependent case above.

## 5. Integrity and lifecycle

- No cross-universe references: every FK between user-content tables must stay inside one universe (checked in the application layer and covered by integration tests).
- **Soft delete:** deleting an item sets `deletedAt` on it and on all its dependents in one transaction, with the same timestamp. Restoring uses that timestamp to restore the same set. A child cannot be restored while its parent is deleted. The cascade crosses modules, so one use case orchestrates it through each module's public interface (`architecture.md` section 4).
  - Universe → works and their narrative units, entities and everything below them, relationship types, relationships, events, sources, citations.
  - Work → its narrative units. What happens to the items whose boundary points to that work is not decided yet (OD-19 in `docs/open-decisions.md`).
  - Entity → knowledge entries, aliases, relationships where it is source or target, event participations, citations.
- **Purge:** explicit user action from the trash. Hard delete with database cascade.
- **Duplicates:** creating an entity whose `normalizedName` matches an existing entity name or alias of the same type in the same universe returns a warning, not an error. Universes follow the same idea: creating one whose normalized name matches a non-deleted universe of the same owner shows a warning and never blocks the creation.
- `NarrativeUnit` in use cannot be deleted (section 3).

## 6. Attributes (JSONB)

- One Zod schema per entity type, in the entities domain. Unknown keys are rejected. Default `{}`.
- Attributes hold stable metadata that is safe from the introduction point onward. They are not spoiler-filtered field by field.
- Anything revealed as the story advances (affiliations, identities, abilities, traits that change) goes to `KnowledgeEntry`, `EntityAlias` or `Relationship`, never to attributes.
- The concrete fields of each schema are defined in Phase 2.

## 7. API representation example

Entity detail as seen by a reader at "Vol. 3, Ch. 12". Hidden items are absent from the response, not flagged.

```json
{
  "id": "entity-uuid",
  "universeId": "universe-uuid",
  "type": "CHARACTER",
  "name": "Example Character",
  "attributes": {},
  "introducedAt": { "workId": "work-uuid", "unitId": "unit-uuid", "label": "Vol. 1, Ch. 3" },
  "aliases": [
    { "id": "alias-uuid", "alias": "The Wanderer", "revealedAt": { "workId": "work-uuid", "unitId": "unit-uuid", "label": "Vol. 2, Ch. 8" } }
  ],
  "knowledge": [
    {
      "id": "entry-uuid",
      "content": "A fictional character used as an example.",
      "status": "CONFIRMED",
      "revealedAt": { "workId": "work-uuid", "unitId": "unit-uuid", "label": "Vol. 1, Ch. 3" },
      "citations": [{ "sourceId": "source-uuid", "locator": "p. 41" }]
    }
  ],
  "createdAt": "2026-11-03T12:00:00.000Z",
  "updatedAt": "2026-11-03T12:00:00.000Z"
}
```

This is an API DTO, not the database structure. Ordinals are never exposed.

## 8. Open decisions

Tracked in `docs/open-decisions.md`. The ones that affect this model: OD-1 to OD-8 (information without a known boundary, end of a relationship, participation-level spoilers, links between events, indicators of locked information, trash retention, attribute schemas, origin tracking of AI suggestions), OD-16 (relationship type seed), OD-19 (trashing a work that has bounded items) and OD-20 (sources without a unit). Do not implement until resolved.