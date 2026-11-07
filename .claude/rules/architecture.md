---
paths:
  - "src/**"
  - "tests/**"
---

# Architecture - LoreKeeper

How the code is organized and what may depend on what. Modular monolith with layered modules inside a single Next.js application.

---

## 1. Layers and dependency rule

| Layer | Location | Contains | May import |
|---|---|---|---|
| Presentation | `src/app`, `src/components`, `src/messages`, `src/styles`, `src/shared/presentation` | Pages, layouts, Route Handlers, Server Actions, UI components, UI dictionary, design tokens, error-to-response mapping | Module public interfaces (`@/modules/<module>`), `src/shared` |
| Application | `src/modules/<module>/application` | Use cases, application services, ports to other modules | Own `domain`, `src/shared/domain`, `src/shared/application` |
| Domain | `src/modules/<module>/domain` | Entities, value objects, domain rules, repository interfaces, domain errors | Own `domain`, `src/shared/domain` |
| Infrastructure | `src/modules/<module>/infrastructure` | Prisma repositories, external providers | Own `domain` and `application`, `src/shared` |

Direction: `presentation → application → domain ← infrastructure`.

- Domain and application never import Prisma, Next.js, React, Better Auth or any SDK.
- Presentation never imports a module's `domain`, `application` or `infrastructure` folders directly; only its `index.ts`.

## 2. Folder layout

```
src/
├── app/                              # Next.js routes (presentation)
│   └── <route>/
│       ├── page.tsx
│       ├── actions.ts                # Server Actions used by this route
│       └── _components/              # Components used only by this route
├── components/
│   ├── ui/                           # shadcn/ui
│   └── <feature>/                    # Components shared across routes
├── messages/                         # Typed UI dictionary (en.ts), no i18n library
├── mocks/                            # Temporary sample DTOs and data for the UI; removed as real modules arrive
├── styles/                           # tokens.css: the only file that defines colors, radii, motion and type scale
├── modules/<module>/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   ├── composition.ts                # Wires infrastructure into use cases
│   └── index.ts                      # Public interface
└── shared/
    ├── domain/                       # Base errors, SpoilerBoundary, ViewerContext
    ├── application/                  # UnitOfWork interface
    ├── infrastructure/               # Prisma client, auth session access
    └── presentation/                 # Error mapper, response helpers
tests/                                # Mirrors src/
├── modules/<module>/{domain,application,infrastructure}/
├── components/                       # Component tests, mirroring src/components
├── styles/                           # Design token tests (contrast)
├── shared/
├── support/                          # In-memory fakes, builders, database helpers
├── lint/                             # Tests of the ESLint rules; the only folder with no src/ counterpart
└── e2e/                              # Playwright (not set up yet)
```

`src/shared` only holds pieces used by several modules and without the business logic of any single module. Moving something into it requires a reason. Its subfolders are created when first needed; today `domain`, `application`, `infrastructure` and `presentation` exist. The Better Auth instance, the Prisma client (generated into `src/shared/infrastructure/generated/`, git-ignored), the session reader and the scrypt password hasher live in `src/shared/infrastructure`; the accounts module's infrastructure imports them from there.

## 3. Module anatomy

File names are kebab-case and say what the file contains:

| Kind | Example |
|---|---|
| Domain entity | `domain/universe.ts` |
| Value object | `domain/universe-name.ts` |
| Repository interface | `domain/universe-repository.ts` |
| Domain error | `domain/universe-errors.ts` |
| Use case | `application/create-universe.ts` |
| Port to another module | `application/entity-lookup.ts` |
| Prisma repository | `infrastructure/prisma-universe-repository.ts` |
| Prisma ↔ domain mapping | `infrastructure/universe-prisma-mapper.ts` |

Use cases are functions with explicit dependencies, one use case per file:

```ts
export type CreateUniverseDependencies = {
  universeRepository: UniverseRepository;
};

export async function createUniverse(
  dependencies: CreateUniverseDependencies,
  actor: ActingUser,
  command: CreateUniverseCommand,
): Promise<Universe> { ... }
```

The acting user is always a separate parameter, never part of the command: the command holds only validated input, and the server sets the actor from the session, so an identity never travels inside data the client controls. (Spec 001 has no actor yet, a documented exception that ends when authentication arrives.)

- No classes for use cases, no DI library, no inheritance between services.
- `composition.ts` binds use cases to real implementations (`createUniverse.bind(null, { universeRepository: prismaUniverseRepository })` or an equivalent closure).
- `index.ts` exports the composed use cases and the public DTO types. Nothing else.

## 4. Communication between modules

- A module only imports another module through `@/modules/<module>`. Deep imports (`@/modules/entities/domain/...`) are forbidden.
- When a use case needs another module, it declares a port in its own `application` folder (e.g. `EntityLookup` in `relationships`). `composition.ts` implements that port using the other module's public interface.
- Modules never read or write another module's tables through their own repositories, with one exception for reads described below.
- A write that crosses modules (soft delete and restore of an entity, a work or a universe) is orchestrated by one use case in the module that starts it. That use case calls the public interface of each other module inside one `UnitOfWork`, with the same timestamp.
- Exception, only to apply spoiler visibility: the infrastructure of the module that owns an item may use read-only joins on another module's tables (for example, a relationship is visible only if both of its entities are). It covers visibility filters, not reading data to display. The spoiler suite covers every such join. The import-boundary lint cannot detect it, so code review checks that it stays read-only and limited to visibility.
- No circular dependencies between modules.

## 5. Request flow

**Page reads:** Server Component → session → `ViewerContext` → use case from the module's `index.ts` → DTO → render. Server Components never `fetch` the application's own API.

**Mutations from the UI:** form or client component → Server Action in `actions.ts` → session → Zod validation → use case → mapped result.

**Client-side reads** (graph, live search with TanStack Query) and future external consumers: Route Handler → session → Zod validation → use case → DTO as JSON.

Route Handlers and Server Actions only do four things: get the session, validate input, call one use case and map the result or error. No business logic.

## 6. Authorization and spoiler filtering

- Every use case receives the acting user and checks universe ownership before doing anything else.
- A resource that belongs to another user is reported as not found, never as forbidden, so its existence is not revealed.
- Every read use case receives a `ViewerContext` as a required parameter. Omitting it is a compile error. It is a pure data type in `src/shared/domain`: viewer user id, universe id, universe mode and a map from work id to the ordinal position the viewer has reached. It imports nothing from `reading-progress`; that module fills the progress when the context is built, in the composition.
- The visibility rule lives in the domain (`SpoilerService`). Repositories receive the `ViewerContext` and apply the rule as a query filter. Filtering in memory after loading is only allowed when a test proves it equivalent.
- Until reading progress exists (Phase 4), `ViewerContext` carries ownership data only; its spoiler fields are introduced in that phase.

## 7. Errors

- Use cases throw typed errors that extend the base `DomainError` in `src/shared/domain`, each with a stable `code`.
- One mapper in `src/shared/presentation` turns errors into responses. Route Handlers and Server Actions always go through it.

| Error | HTTP | Notes |
|---|---|---|
| `ValidationError` | 400 | Includes field issues |
| `AuthenticationError` | 401 | |
| `AuthorizationError` | 403 | Only for actions on visible resources; only meaningful once sharing exists (OD-12 in `docs/open-decisions.md`) |
| `NotFoundError` | 404 | Also used for resources of other users |
| `BusinessRuleViolationError` | 422 | |
| `InfrastructureError` | 500 | Generic message, details only in logs |
| `ExternalProviderError` | 502 | |
| Unknown error | 500 | Logged, generic message |

- Server Actions return `{ ok: true, value }` or `{ ok: false, error: { code, message, fieldErrors? } }` built by the same mapper.
- No `catch` that ignores the error. Catching is only allowed to translate it into a typed error or to log and rethrow.

## 8. Transactions

- `UnitOfWork` interface in `src/shared/application`: `runInTransaction(work)` gives the work function repositories bound to the same transaction.
- The Prisma implementation uses `prisma.$transaction` and lives in `src/shared/infrastructure`.
- Transaction boundaries are decided in use cases, never in repositories or presentation.

## 9. Import enforcement

ESLint `no-restricted-imports` with overrides per folder:

- `src/shared/domain/**` and `src/shared/application/**` carry the same restrictions as the `domain` and `application` folders of the modules (domain: also no `application` path).
- `src/modules/*/domain/**`: forbids `@prisma/client`, `next`, `next/*`, `react`, `better-auth`, any `infrastructure` or `application` path.
- `src/modules/*/application/**`: forbids `@prisma/client`, `next`, `next/*`, `react`, `better-auth`, any `infrastructure` path.
- Everywhere outside a module: forbids `@/modules/*/*` (only `@/modules/<module>` is allowed).
- Modules are always imported through the `@/` alias; relative imports never cross a module boundary.

## 10. Frontend

- Server Components by default. `"use client"` only on leaf components that need interactivity or browser APIs.
- Client components receive DTOs as props; they never import modules or Prisma.
- shadcn/ui in `src/components/ui`. Route-specific components in `_components/` next to the route; components shared by several routes in `src/components/<feature>/`.
- Cytoscape.js lives in a single client adapter component that turns graph DTOs into Cytoscape elements. No other file imports Cytoscape.
- TanStack Query only in client components that call Route Handlers. Zustand only with an approved reason.

## 11. AI (Phase 6)

- The `ai` module defines an `AiProvider` port in its domain. Each provider is an adapter in its infrastructure.
- Retrieval always receives the `ViewerContext`; nothing reaches a provider without spoiler filtering.
- No further structure until Phase 6 is specified.

## 12. Tests

Tests live in `tests/`, mirroring `src/`: `src/modules/universes/application/create-universe.ts` → `tests/modules/universes/application/create-universe.test.ts`.

| Layer | Type | How |
|---|---|---|
| Domain | Unit | Pure functions and objects, no mocks |
| Application | Unit | In-memory fake repositories from `tests/support/` |
| Infrastructure | Integration | Against the Docker PostgreSQL test database, reset between suites |
| Presentation | Integration | Route Handlers and Server Actions with a real session and database |
| User flows | E2E | Playwright in `tests/e2e/` |

- Fakes implement the same repository interfaces as Prisma repositories and live in `tests/support/fakes/`.
- Spoiler visibility tests are mandatory for every read use case.

## 13. Anti-patterns

Never:
- Prisma, `next/*` or React imported in domain or application code.
- Business rules in pages, components, Route Handlers or Server Actions.
- A Server Component calling the application's own API with `fetch`.
- A read use case without `ViewerContext`, or spoiler filtering done only in the UI.
- Deep imports into another module or a repository touching another module's tables.
- Prisma-generated types leaving the infrastructure layer.
- Generic folders such as `utils/`, `helpers/` or `lib/` collecting unrelated code.
- Classes, inheritance or a DI container added "for the future".