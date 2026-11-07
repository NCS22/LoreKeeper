# CLAUDE.md - LoreKeeper

LoreKeeper is a knowledge management platform for fictional universes. It helps avid readers of dense works build their own interconnected knowledge bases to remember what they read without spoilers, and helps authors keep track of details of their own works written long ago.
This file guides Claude and any AI agent working in this repository.

**Current status:** Phase 0 - design (`docs/roadmap.md`). The UI shell migrated from the visual prototype runs on sample data in `src/mocks/`, and no page uses the database or an account yet. Screens for features that are still pending (entities, graph, timeline, reading position) are design-only on that sample data and store nothing. The only thing stored in the browser is the accessibility preferences (`localStorage`). Spec 001-universe-crud (create a universe) is implemented UI-only: the module `src/modules/universes` has the domain, use cases and an in-memory repository, wired through a temporary client provider; created universes are lost on reload until specs 004 and 005 store them. Spec 002-accounts (accounts engine, first spec of Phase 1) is implemented with no visible change in the application: PostgreSQL via Docker Compose, the Prisma 7 schema and migration, Better Auth with email and password and an own scrypt password hasher, sessions in a cookie backed by a database session (30 days, daily renewal), the three Server Actions for sign-up, sign-in and sign-out with their Zod input schemas, the shared error vocabulary and the acting-user check. There are no account pages yet: spec 003 adds the screens and depends on 002. Nothing marked as pending may be implemented: sample-data screens are allowed because they implement no behavior.
**Where things live:** feature requirements in `specs/NNN-feature/spec.md`; phases and the project out-of-scope list in `docs/roadmap.md`; everything not decided yet in `docs/open-decisions.md`. There is no `docs/spec.md`.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), React, TypeScript (strict) |
| UI | Tailwind CSS, shadcn/ui |
| Data fetching | React Server Components + Server Actions by default; TanStack Query only for interactive client views (graph, live search); Zustand only when shared client state is justified |
| API | Next.js Route Handlers (REST), modular monolith |
| Database | PostgreSQL (Docker Compose locally), Prisma ORM, JSONB for type-specific attributes |
| Vector search | pgvector (pending, Phase 6, see OD-10 in `docs/open-decisions.md`) |
| Auth | Better Auth (Prisma adapter, users stored in our PostgreSQL) |
| Visualization | Cytoscape.js (knowledge graph), dedicated timeline component, Recharts only if statistics are needed |
| Validation | Zod |
| Testing | Vitest (unit, integration), Playwright (E2E) |
| Tooling | pnpm, ESLint, Prettier, GitHub Actions |

- Pending (see `docs/open-decisions.md`): deployment target (Phase 5), AI provider details and pgvector (Phase 6), file uploads.
- Versions: `pnpm-lock.yaml` fixes what is installed; `package.json` pins `next` and `react` exactly and uses caret ranges for the rest. Upgrading a dependency needs approval.
- UI shell dependencies, approved on 2026-11-06 because they came with the migrated interface and are in use: `cytoscape` and `d3-force` (graph canvas and its force layout), `react-resizable-panels` (resizable workspace panels), `tw-animate-css` (animations in `globals.css`), `@tailwindcss/turbopack` (Tailwind loader in `next.config.ts`). The `playwright` library is installed only for the browser checks agents run in disposable scripts; E2E tests are not set up (OD-17).
- Installed by spec 002 (approved 2026-11-06): `zod` (input shape at Server Actions and Route Handlers only; today used only at the Server Action boundary), `better-auth`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `prisma` and `@types/pg`. The install-script allow-list `onlyBuiltDependencies` in `package.json` is limited to `prisma` and `@prisma/engines`.
- Approved on 2026-11-06, to be installed by spec 003 (approval is recorded here; it is NOT installed yet): `@playwright/test` (E2E, local runs). `jsdom` and testing-library are not approved.
- No other dependency is added without approval.

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
└── shared/                   # Cross-module kernel in domain, application, infrastructure and presentation (errors, acting user, session reader, Prisma client, Better Auth instance, error mapper; ViewerContext and UnitOfWork come later)
tests/                        # Mirrors src/; support/ for fakes, e2e/ for Playwright (not set up), lint/ for tests of the ESLint rules
prisma/                       # Schema (Better Auth tables) and migrations
docs/                         # roadmap.md, open-decisions.md
.claude/                      # Agent setup: agents/, commands/ (/sdd-*), rules/, hooks/, skills/ (a local link to .agents/skills; git stores both as identical copies)
.agents/skills/               # Installed skills (frontend-design), locked in skills-lock.json
specs/NNN-feature/            # SDD artifacts per feature: spec, plan, tasks and an optional decisions.md (e.g. specs/001-universe-crud/)
```
- Dependency direction: `presentation → application → domain ← infrastructure`. Details in `.claude/rules/architecture.md`.
- Planned modules: universes, works, entities, relationships, events, sources, reading-progress, search, ai. A module is created only when its phase in `docs/roadmap.md` requires it.
- Modules interact only through their public interface (`modules/<module>/index.ts`).
- The structure is owned by the user: new top-level folders, modules or layers require approval.
- Tests mirror src/: src/.../create-universe.ts → tests/.../create-universe.test.ts. The only tests without a `src/` counterpart are the ones for tooling, in `tests/lint`.

## Conventions

- **Language:** English for code, database, API, comments, docs and commits. Communicate with the user in Spanish.
- **Naming:** names must be descriptive and say what the value is or what the function does: `characterId = findCharacterIdByName(...)` instead of `id = find(...)`; `compareEntityNames(firstEntity, secondEntity)` instead of `compare(a, b)`. No `data`, `utils`, `manager`, `handler`, `temp` or abbreviations when a specific name exists.
- **Casing:** PascalCase for types, classes and components; camelCase for variables, functions and properties; kebab-case for file names; UPPER_SNAKE_CASE for env variables and true global constants.
- **Principles:** SOLID, KISS, YAGNI, DRY (without forcing unrelated code into shared abstractions), composition over inheritance, explicit over implicit.
- **TypeScript:** strict mode, no `any` without written justification, minimal type assertions, immutability where practical, small focused functions, no deep nesting, no circular dependencies.
- **Validation:** every external input is validated with Zod at system boundaries. Business rules are never duplicated between frontend and backend.
- **Errors:** explicit error types: validation, authentication, authorization, not found (also for resources of other users), business rule violation, infrastructure failure, external provider failure. Never swallow errors; never expose stack traces, credentials or internals in responses.
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
- `NarrativeUnit` - ordered index of chapters or episodes of a work.
- `KnowledgeEntry` - a fragment of knowledge about an entity, revealed at a specific point (its spoiler boundary) and classified as confirmed, user note or speculation; an entity's description is the composition of its visible fragments.
- `Relationship` - directed, typed connection between two entities of the same universe.
- `RelationshipType` - per-universe catalog of relationship kinds (a predefined seed plus user-created ones), with a label, an inverse label and a symmetric flag.
- `Event` - narrative occurrence; participants via `EventParticipant` (eventId, entityId, role). Chronological order and discovery order are different fields.
- `Source` - origin of information (chapter, episode, notes...); linked to entities, relationships and events through `Citation` with an optional locator.
- `ReadingProgress` - user position per work.
- `SpoilerBoundary` - value object (work + narrative unit) stored as two columns in each table that needs it; it is not an entity or a table.

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
- Follow the SDD flow: spec → clarification → plan → tasks → implementation → validation → closing (and change when requirements change), with artifacts in `specs/NNN-feature/` and the `/sdd-*` commands. Every phase ends with a question to the user; approving it marks the document `approved` and starts the next phase, so there is no need to type the next command. Start with `/sdd-spec`, resume with `/sdd-status`, or run it all from `claude --agent coordinator`. Rules in `.claude/rules/sdd.md`.
- A resolved open decision is recorded in the `plan.md` of the feature that resolves it (or in that spec's optional `decisions.md` when it is taken after the plan was approved; a cross-cutting one with no feature goes in this file) and removed from `docs/open-decisions.md`. There is no `docs/decisions/` folder.
- Delegate broad exploration and reviews to subagents to keep the main context clean.
- Git: every change goes in its own branch (never directly on `main`), is committed at the points defined in `.claude/rules/git.md` (each approved document and each verified task) and the branch is pushed after every commit. The main agent makes the commits, not the subagents. Merging into `main` is the user's decision, through a pull request.

## Commands

Confirmed and working: `pnpm dev`, `build`, `start`, `lint`, `typecheck`, `test`, `docker compose` and `pnpm prisma ...`. `pnpm test` also runs database-backed tests, so it needs the local PostgreSQL running (`docker compose up -d`) and fails loudly without it; the generated Prisma client is not committed, so run `pnpm prisma generate` once after installing. Not available yet because their tool is not installed: `pnpm format` (Prettier) and `pnpm test:e2e` (Playwright, OD-17). Each is confirmed when its tool is set up.

| Command | Purpose |
|---|---|
| `docker compose up -d` | Start local PostgreSQL |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint, fails on any warning |
| `pnpm format` | Prettier |
| `pnpm typecheck` | `next typegen && tsc --noEmit` |
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
- Features listed as out of scope in `docs/roadmap.md` are not implemented.

## Limits

**ALWAYS**
- Read the relevant rules and spec sections before touching a module.
- Add or update tests with every change.
- Leave the application working at the end of each task.
- Update the documentation, `docs/roadmap.md` and `docs/open-decisions.md` when something changes.
- Report what changed, why, and what remains open.
- Commit finished units of work on a branch, following `.claude/rules/git.md`.

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
- Commit, push or merge on `main`, force-push, rewrite git history (`amend`, `reset`, `rebase`), delete branches or run destructive commands without permission. Creating branches, committing and pushing branches other than `main` is allowed by `.claude/rules/git.md`.
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
