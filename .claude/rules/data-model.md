---
paths:
  - "prisma/**"
  - "src/modules/**/domain/**"
  - "src/modules/**/infrastructure/**"
---

# Data Model - LoreKeeper

Domain model and persistence rules. `docs/spec.md` remains the functional source of truth; this file defines how that functionality is represented as data.

Nothing listed under "Open decisions" may be implemented until it is resolved.

---

## 1. General conventions

- Primary keys are UUIDs. Better Auth is configured to generate UUIDs for `User`.
- Timestamps are `timestamptz`, stored in UTC and serialized as ISO 8601.
- Every user-content table has `createdAt`, `updatedAt` and `deletedAt` (nullable, soft delete).
- Closed categories are enums. User-extensible categories are catalog tables (e.g. `RelationshipType`).
- Foreign keys are always declared. Writes touching several records run in one transaction.
- Every universe belongs to one user. Tables that hang directly from a universe carry `universeId`, so every query can be scoped by owner.
- Three separate type families: domain types (`modules/*/domain`), Prisma types (infrastructure only) and API DTOs (presentation). Mapping happens in repositories and handlers.
- Name normalization (`normalizedName`, `normalizedAlias`): lowercase, Unicode NFD with diacritics removed, trimmed, inner whitespace collapsed. Used for search and duplicate detection.

## 2. Spoiler boundary

A spoiler boundary marks the point of a work where a piece of information is revealed.

- Stored as two columns on each table that needs it: `boundaryWorkId` and `boundaryUnitId`.
- Composite foreign key `(boundaryUnitId, boundaryWorkId) → NarrativeUnit(id, workId)`, so the unit always belongs to the referenced work.
- The work must belong to the same universe as the item.
- One boundary per item. A user following several adaptations chooses one work as reference.
- Boundary columns are `NOT NULL` for now (see open decisions).

Tables with a boundary: `Entity` (introduction), `KnowledgeEntry`, `EntityAlias`, `Relationship`, `Event` (discovery).

## 3. Entities

### User
Managed by Better Auth (its own tables: user, session, account, verification). The domain only references `User.id`. No domain fields are added to Better Auth tables without approval.

### Universe
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| ownerId | uuid | FK User |
| name | text | 1-120 chars |
| description | text? | |
| coverImageUrl | text? | external URL only |
| mode | enum `READER` \| `AUTHOR` | default `READER` |
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
Ordered index of the chapters or episodes of a work. Created by the user or by an agent on request, in bulk ("chapters 1-500") or one by one. The system never infers units.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| workId | uuid | FK Work; unique `(id, workId)` for composite FKs |
| ordinal | int | assigned by the system; unique per work |
| label | text | what the user sees ("Vol. 2, Ch. 1", "Interlude") |
| groupLabel | text? | grouping for selectors ("Volume 2", "Season 1") |
| createdAt, updatedAt | timestamptz | |

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
| boundaryWorkId, boundaryUnitId | uuid | an alias can reveal an identity |
| createdAt, updatedAt, deletedAt | timestamptz | |

### RelationshipType
Catalog per universe. Predefined types are seeded when a universe is created; the user can add their own.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| universeId | uuid | FK Universe |
| key | text | UPPER_SNAKE_CASE, unique per universe |
| label | text | "member of" |
| inverseLabel | text | "has member" |
| isSymmetric | boolean | if true, `inverseLabel` equals `label` |
| isPredefined | boolean | seeded types cannot be deleted |
| createdAt, updatedAt, deletedAt | timestamptz | |

Proposed seed (to confirm in Phase 2): `MEMBER_OF`, `LEADER_OF`, `ALLY_OF` (symmetric), `ENEMY_OF` (symmetric), `PARENT_OF`, `SIBLING_OF` (symmetric), `LOCATED_IN`, `POSSESSES`.

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
| createdAt | timestamptz | |

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
| createdAt | timestamptz | |

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

## 4. Spoiler visibility

Visibility is computed in the backend (`SpoilerService` in the domain, applied by repositories as query filters). Nothing is filtered in the frontend only.

1. Universe in `AUTHOR` mode → everything is visible.
2. Universe in `READER` mode → an item with a boundary is visible only if the user has progress on `boundaryWorkId` and `ordinal(currentUnit) >= ordinal(boundaryUnit)`.
3. No progress on a work → nothing bounded to that work is visible.
4. Dependent visibility:
   - `KnowledgeEntry`, `EntityAlias`: own boundary **and** entity visible.
   - `Relationship`: own boundary **and** both entities visible.
   - `EventParticipant`: event visible **and** entity visible.
   - `Citation`: its target visible.
5. The same rules apply to every read path: pages, API, search, graph, timeline and AI retrieval.

Spoiler visibility rules have mandatory unit tests covering: boundary equal to progress, one unit before and after, no progress, `AUTHOR` mode, and every dependent case above.

## 5. Integrity and lifecycle

- No cross-universe references: every FK between user-content tables must stay inside one universe (checked in the application layer and covered by integration tests).
- **Soft delete:** deleting an item sets `deletedAt` on it and on all its dependents in one transaction, with the same timestamp. Restoring uses that timestamp to restore the same set. A child cannot be restored while its parent is deleted.
  - Universe → works, units' dependents, entities, relationship types, relationships, events, sources.
  - Entity → knowledge entries, aliases, relationships where it is source or target, event participations, citations.
- **Purge:** explicit user action from the trash. Hard delete with database cascade.
- **Duplicates:** creating an entity whose `normalizedName` matches an existing entity name or alias of the same type in the same universe returns a warning, not an error.
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

Tracked in `docs/spec.md`. Do not implement until resolved.

- Information without a known boundary (columns are `NOT NULL` until decided).
- End of a relationship (e.g. a character leaves an organization): end boundary or a new relationship.
- Participation-level spoilers (a hidden participant in a visible event).
- Links between related events.
- Showing that locked information exists (counts or indicators) without revealing it.
- Trash retention period and automatic purge.
- Concrete attribute schemas per entity type (Phase 2).
- Origin tracking for AI-approved suggestions (Phase 5).