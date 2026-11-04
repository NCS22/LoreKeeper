# CLAUDE.md - LoreKeeper

LoreKeeper is a knowledge management platform for fictional universes. It helps avid readers of dense works build their own interconnected knowledge bases to remember what they read without spoilers, and helps authors keep track of details of their own works written long ago.
This file guides Claude and any AI agent working in this repository.

**Current status:** Phase 0 - design. The only code is the UI shell migrated from the visual prototype: it runs on sample data in `src/mocks/`, with no backend, database, auth or business logic. Nothing marked as pending may be implemented.
**Functional source of truth:** `docs/spec.md` (features, roadmap, out-of-scope list, open decisions).

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), React, TypeScript (strict) |
| UI | Tailwind CSS, shadcn/ui |
| Data fetching | React Server Components + Server Actions by default; TanStack Query only for interactive client views (graph, live search); Zustand only when shared client state is justified |
| API | Next.js Route Handlers (REST), modular monolith |
| Database | PostgreSQL (Docker Compose locally), Prisma ORM, JSONB for type-specific attributes |
| Auth | Better Auth (Prisma adapter, users stored in our PostgreSQL) |
| Visualization | Cytoscape.js (knowledge graph), dedicated timeline component, Recharts only if statistics are needed |
| Validation | Zod |
| Testing | Vitest (unit, integration), Playwright (E2E) |
| Tooling | pnpm, ESLint, Prettier, GitHub Actions |

- Pending (see `docs/spec.md`): deployment target (Phase 6), AI provider details and pgvector (Phase 5), file uploads.
- Exact versions are pinned when the project is initialized. No other dependency is added without approval.

## Structure

```
src/
├── app/                      # Next.js routes, layouts, Route Handlers, Server Actions (presentation)
├── components/               # Shared UI components by feature (shadcn/ui lives in components/ui)
├── messages/                 # Typed UI dictionary (en.ts), no i18n library
├── mocks/                    # Temporary sample DTOs and data for the UI; removed as real modules arrive
├── styles/                   # tokens.css: the only file that defines colors, radii, motion and type scale
├── modules/<module>/
│   ├── domain/               # Entities, value objects, rules, repository interfaces, errors
│   ├── application/          # Use cases and ports
│   ├── infrastructure/       # Prisma repositories, external providers
│   ├── composition.ts        # Wiring
│   └── index.ts              # Public interface
└── shared/                   # Cross-module kernel (errors, ViewerContext, UnitOfWork, Prisma client)
tests/                        # Mirrors src/; support/ for fakes, e2e/ for Playwright
prisma/                       # Schema and migrations
docs/                         # spec.md, decisions/
specs/NNN-feature/            # SDD artifacts per feature (e.g. specs/001-universe-crud/)
```
- Dependency direction: `presentation → application → domain ← infrastructure`. Details in `.claude/rules/architecture.md`.
- Planned modules: universes, works, entities, relationships, events, sources, reading-progress, search, ai. A module is created only when its roadmap phase requires it.
- Modules interact only through their public interface (`modules/<module>/index.ts`).
- The structure is owned by the user: new top-level folders, modules or layers require approval.
- Tests mirror src/: src/.../create-universe.ts → tests/.../create-universe.test.ts

## Conventions

- **Language:** English for code, database, API, comments, docs and commits. Communicate with the user in Spanish.
- **Naming:** names must be descriptive and say what the value is or what the function does: `characterId = findCharacterIdByName(...)` instead of `id = find(...)`; `compareEntityNames(firstEntity, secondEntity)` instead of `compare(a, b)`. No `data`, `utils`, `manager`, `handler`, `temp` or abbreviations when a specific name exists.
- **Casing:** PascalCase for types, classes and components; camelCase for variables, functions and properties; kebab-case for file names; UPPER_SNAKE_CASE for env variables and true global constants.
- **Principles:** SOLID, KISS, YAGNI, DRY (without forcing unrelated code into shared abstractions), composition over inheritance, explicit over implicit.
- **TypeScript:** strict mode, no `any` without written justification, minimal type assertions, immutability where practical, small focused functions, no deep nesting, no circular dependencies.
- **Validation:** every external input is validated with Zod at system boundaries. Business rules are never duplicated between frontend and backend.
- **Errors:** explicit error types: validation, authentication/authorization, not found, business rule violation, infrastructure failure, external provider failure. Never swallow errors; never expose stack traces, credentials or internals in responses.
- **UI:** dark-first, desktop-first responsive, accessible, a research workspace rather than an admin dashboard.

## Data

Full domain model in `.claude/rules/data-model.md`.

**Identifiers and dates**
- UUID primary keys. ISO 8601 timestamps stored in UTC. Enums for closed categories. Foreign keys for integrity. Transactions for multi-record writes.

**Domain concepts**
- `User` - account owner; every universe belongs to one user and all queries are scoped by owner.
- `Universe` - isolated knowledge base with a mode: `READER` (spoiler protection on) or `AUTHOR` (everything visible, boundaries still recorded for chronology).
- `Work` - novel, manga, anime, film... inside a universe; defines its progress units.
- `Entity` - character, location, organization, faction, object, ability, species or concept; no description column; knowledge stored as KnowledgeEntry fragments; aliases in EntityAlias.
- `NarrativeUnit` - ordered index of chapters or episodes from a play.
- `KnowledgeEntry`
- `Relationship` - directed, typed connection between two entities of the same universe.
- `RelationshipType`
- `Event` - narrative occurrence; participants via `EventParticipant` (eventId, entityId, role). Chronological order and discovery order are different fields.
- `Source` - origin of information (chapter, episode, notes...); linked to entities, relationships and events through `Citation` with an optional locator.
- `ReadingProgress` - user position per work.
- `SpoilerBoundary` - work + comparable position.

**Narrative positions**
- Positions reference a NarrativeUnit. The user picks labels; ordinals are system-assigned and only used for comparisons.

**Attributes (JSONB)**
- Only for type-specific attributes, always validated with a Zod schema per entity type. Never a substitute for a proper model.
- Domain types are independent from Prisma-generated types.
- Never store information revealed as the story advances in attributes

**Spoilers**
- Narrative information is created together with its spoiler boundary. How to handle information without a boundary is an open decision.
- Information is classified as confirmed, user note or speculation.
- In `READER` universes, filtering happens in the backend before data reaches the frontend or an AI provider. Hiding it visually is not enough.

**Integrity and lifecycle**
- Relationships across universes are not allowed.
- Soft delete with restorable trash for universes and their content; permanent purge is an explicit user action.
- Images are external URLs only for now.
- User-created information stays distinguishable from source-verified information.

## Workflow

- Go step by step. For any non-trivial task, propose a plan (plan mode) and wait for approval before editing.
- Before implementing: understand the affected code, identify modules, review the relevant rules and spec sections.
- Design decisions are presented with alternatives and trade-offs; never silently choose the complex option.
- Implement the smallest coherent solution, with its tests, without touching unrelated code.
- Follow the SDD flow: specify → plan → tasks → implement, with artifacts in `specs/NNN-feature/` and the `/sdd-*` commands. Rules in `.claude/rules/sdd.md`; run the full flow with `claude --agent coordinator`.
- Closed decisions are recorded in `docs/decisions/` and removed from the open decisions in `docs/spec.md`.
- Delegate broad exploration and reviews to subagents to keep the main context clean.

## Commands

Confirmed and working: `pnpm dev`, `build`, `start`, `lint`, `typecheck`, `test`. The rest are confirmed when their tool is set up.

| Command | Purpose |
|---|---|
| `docker compose up -d` | Start local PostgreSQL |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit and integration tests |
| `pnpm test:e2e` | Playwright tests |
| `pnpm prisma migrate dev` | Create and apply a migration |
| `pnpm prisma generate` | Regenerate the Prisma client |

Project commands: `/sdd-constitution`, `/sdd-spec`, `/sdd-clarify`, `/sdd-plan`, `/sdd-tasks`, `/sdd-implement`, `/sdd-validate`, `/sdd-change`, `/sdd-status`. Subagents in `.claude/agents/`: planner, implementer, reviewer, hacker, explainer, plus the main agent coordinator.

## Rules

Invariants of the system. They are never broken, whatever the task.

- Domain code does not import Prisma, Next.js, React or any infrastructure.
- Application services depend on repository interfaces, not implementations.
- Route Handlers and Server Actions only validate input, call a use case and map the response.
- Visualization libraries stay in the presentation layer; the graph is built from domain entities and relationships.
- Spoiler filtering is enforced in the backend for every read path: pages, API, search, graph, timeline and AI.
- AI never depends on a single provider in business logic and never writes canonical data; suggestions require user approval.
- Every query is scoped to the authenticated user; authorization is checked in the backend.
- API credentials live in environment variables and never reach the frontend.
- No scraping or reproduction of copyrighted works.
- Features listed as out of scope in `docs/spec.md` are not implemented.

## Limits

**ALWAYS**
- Read the relevant rules and spec sections before touching a module.
- Add or update tests with every change.
- Leave the application working at the end of each task.
- Update documentation and decision records when something changes.
- Report what changed, why, and what remains open.

**ASK FIRST**
- Adding, removing or upgrading a dependency.
- Creating modules, layers or top-level folders.
- Changing the Prisma schema or creating migrations.
- Implementing anything marked as pending or open.
- Modifying code outside the scope of the task or rewriting existing implementations.
- Any architectural decision not covered by this file or the spec.

**NEVER**
- Implement features that were not requested or approved.
- Read, edit or print `.env` files or secrets.
- Silence errors, skip or delete tests, or relax strict mode to make something pass.
- Push, force-push, rewrite git history or run destructive commands without permission.
- Store AI-generated content as verified knowledge.

## Verification

Before declaring a task finished:

1. `pnpm typecheck` and `pnpm lint` pass with no new warnings.
2. `pnpm test` passes, including new tests for the change.
3. `pnpm test:e2e` for changes that affect user flows.
4. Any change to queries, visibility or reading progress runs the spoiler protection tests. They are mandatory.
5. Schema changes: the migration applies cleanly on an empty database.
6. The diff contains no secrets and no changes outside the task scope.
7. Final summary to the user: what changed, why, how it was verified, what is still pending.
