# Roadmap - LoreKeeper

What gets built and in which order. A phase is a group of specs; each spec follows the SDD flow (`.claude/rules/sdd.md`). Decisions that block a phase are listed in `open-decisions.md`.

A module is created only when its phase requires it (`CLAUDE.md`, Structure). Anything marked pending cannot be implemented (`CLAUDE.md`, Limits).

## Phases

| Phase | Name | Scope | Modules | Needs resolved first |
|---|---|---|---|---|
| 0 | Design | UI shell on sample data in `src/mocks/`. Spec 001 (create a universe) implemented UI-only with an in-memory repository. No backend, database or auth. **Current phase.** | `universes` (UI-only) | - |
| 1 | Foundations | Prisma, PostgreSQL (Docker Compose), Better Auth, persisted universes owned by a user, acting user in the use cases, Zod at the first Server Action. Universe lifecycle: edit, trash, restore, purge. Replaces the in-memory repository and the temporary client provider. | `universes`, `shared` (errors, `ViewerContext`, `UnitOfWork`, Prisma client) | OD-6, OD-12, OD-17, OD-18 |
| 2 | Knowledge core | Works and narrative units, entities with aliases and knowledge entries, relationship types and relationships, JSONB attribute schemas per entity type. Every item is created with its spoiler boundary. | `works`, `entities`, `relationships` | OD-1, OD-2, OD-7, OD-16, OD-19 |
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
