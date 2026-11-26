# Roadmap - LoreKeeper

What gets built and in which order. A phase is a group of specs; each spec follows the SDD flow (`.claude/rules/sdd.md`). Decisions that block a phase are listed in `open-decisions.md`.

A module is created only when its phase requires it (`CLAUDE.md`, Structure). Anything marked pending cannot be implemented (`CLAUDE.md`, Limits).

## Phases

| Phase | Name | Scope | Modules | Needs resolved first |
|---|---|---|---|---|
| 0 | Design | UI shell on sample data in `src/mocks/` and spec 001 (create a universe) implemented UI-only with an in-memory repository. Both were replaced in Phase 1: spec 004 (2026-11-17) deleted `src/mocks/`, the sample content and the in-memory repository, and universes are now stored. What remains from this phase is the interface shell, with honest empty states where the knowledge features will go. **Current phase** (until Phase 1 is complete). | `universes` | - |
| 1 | Foundations | Prisma, PostgreSQL (Docker Compose), Better Auth, persisted universes owned by a user, acting user in the use cases, Zod at the first Server Action. Universe lifecycle: edit, trash, restore, purge. Replaces the in-memory repository and the temporary client provider (done by 004). Phase 1 is not complete: spec 007 remains. Split into six specs, in this order (numbers not yet used are provisional; specs born from one shared context share a number with consecutive letters): **002 Accounts engine** (implemented 2026-11-07; database, Prisma, Better Auth with email and password, sign-up, sign-in and sign-out as operations, acting user, shared error pieces, its own Server Actions with Zod validation; no visible change in the application; the 2026-11-08 change makes the acting user also give the display name and email of the account), **003 Account screens** (implemented 2026-11-09; sign-up and sign-in pages, user menu, page access guard, return destination, browser tests; depends on 002), **004 Stored universes** (implemented 2026-11-17; universes saved in PostgreSQL with an owner, acting user in the use cases, Server Actions with Zod for creating a universe, the live duplicate-name warning and remembering the universe, removal of the in-memory repository and of the temporary provider; two scope additions decided during the spec: the last-used universe is remembered per account, and all the sample content and `src/mocks/` were removed, so the sections that showed it (graph view, entity list, works area, details panel) show honest empty states; depends on 002 and 003), **005a Quality testing strategy** (implemented 2026-11-24; criticality inventory, coverage measurement, the `quality-testing-core` skill, an audit report with a verdict per group of existing tests and the test-first way of working in the SDD flow; changes no existing test and no production behavior), **005b Test cleanup and coverage thresholds** (implemented 2026-11-25; applied the audit verdicts the user approved group by group and turned on the coverage thresholds defined by 005a, with recorded overrides and floors; `pnpm test:coverage` fails below the targets and on a production file with no inventory entry or two, and is required at the validation of every spec; changes no production behavior; depends on 005a), **007 Universe lifecycle** (edit, trash, restore, purge, `UnitOfWork`; also trashes, restores and purges the works, entities, fragments and relationships of spec 006 with their universe; executes OD-6; renumbered from 005, then from 006 when spec 006 took that number; depends on 005b and 006). | `universes`, `shared` (errors, `ViewerContext`, `UnitOfWork`, Prisma client) | OD-6 (for 007): decided 2026-11-06, see `open-decisions.md` (OD-12, also decided then, was executed by specs 002 and 003 and only its Phase 5 part remains open; OD-17 and OD-18, also decided then, were executed by specs 003 and 002 and removed) |
| 2 | Knowledge core | Works and narrative units, entities with aliases and knowledge entries, relationship types and relationships, JSONB attribute schemas per entity type. Every item is created with its spoiler boundary. Started early, ahead of the roadmap order by the user's decision of 2026-11-25, by **006 Knowledge items: first creation and viewing** (implemented 2026-11-27; minimal works with their units created as 1 to N, entities with an optional first knowledge fragment and the similar-name notice, directed relationships with the eight predefined relationship types seeded in every universe, existing ones included (OD-16, decided 2026-11-25), the works area, the entity list and the details panel; these reads are not filtered by reading position until Phase 4 (temporary exception in `CLAUDE.md`); changes 004 FR-15, FR-17 and its seeding exclusion). Phase 2 is not complete: aliases, further fragments, editing, user-created relationship types, attribute schemas (OD-7), the end of a relationship (OD-2) and trashing a work (OD-19) remain. | `knowledge` (works, units, entities, fragments and relationships in one module, approved 2026-11-25 in spec 006 instead of the planned `works`, `entities` and `relationships`) | OD-1, OD-2, OD-7, OD-19 (lifted for spec 006 only; OD-16 was decided 2026-11-25 and recorded in the plan of spec 006) |
| 3 | Chronology and evidence | Events and participants, sources and citations, timeline, knowledge graph on real data. | `events`, `sources` | OD-3, OD-4, OD-20 |
| 4 | Reading progress and spoiler protection | Reading progress per work, `ViewerContext` with progress, spoiler filtering in the backend for every read path, search. The mandatory spoiler suite starts here. | `reading-progress`, `search` | OD-5, OD-13 |
| 5 | Deployment | Production deployment of the working app and a documented public API that models and other consumers can use. | - | OD-9, OD-14 |
| 6 | AI | Suggestions that need user approval (never canonical data, never stored as verified knowledge), provider-independent, with pgvector for retrieval. | `ai` | OD-8, OD-10 |

Order rationale: the app runs in production, with a usable API, before any AI is added to search or to adding information (user decision, 2026-11-05).

## Out of scope for the project

Decided. These are not implemented in any phase.

- Scraping or reproducing copyrighted works (`CLAUDE.md`, Rules).
- AI writing canonical data or storing AI-generated content as verified knowledge (`CLAUDE.md`, Rules and NEVER). AI only suggests; the user approves.
- Relationships or references between different universes (`data-model.md`, integrity).
- Mapping information between adaptations of the same story: a spoiler boundary is compared only with the reading progress of its own work.

Not decided yet (neither in nor out of scope): sharing and collaboration, import and export, file uploads. They are tracked in `open-decisions.md`.

## Maintenance

- Moving a phase forward, adding a module or changing the order of phases is a decision for the user.
- The order of the specs inside a phase is not fixed here: it is decided when each spec is opened.
- When a spec closes, "Current status" in `CLAUDE.md` is updated and, if a phase is complete, its row here is marked as done.
