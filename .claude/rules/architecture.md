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
| Presentation | `src/app`, `src/components`, `src/shared/presentation` | Pages, layouts, Route Handlers, Server Actions, UI components, error-to-response mapping | Module public interfaces (`@/modules/<module>`), `src/shared` |
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
├── shared/
├── support/                          # In-memory fakes, builders, database helpers
└── e2e/                              # Playwright
```

`src/shared` only holds pieces used by several modules and without the business logic of any single module. Moving something into it requires a reason.

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
  command: CreateUniverseCommand,
): Promise<Universe> { ... }
```

- No classes for use cases, no DI library, no inheritance between services.
- `composition.ts` binds use cases to real implementations (`createUniverse.bind(null, { universeRepository: prismaUniverseRepository })` or an equivalent closure).
- `index.ts` exports the composed use cases and the public DTO types. Nothing else.

## 4. Communication between modules

- A module only imports another module through `@/modules/<module>`. Deep imports (`@/modules/entities/domain/...`) are forbidden.
- When a use case needs another module, it declares a port in its own `application` folder (e.g. `EntityLookup` in `relationships`). `composition.ts` implements that port using the other module's public interface.
- Modules never read or write another module's tables through their own repositories.
- No circular dependencies between modules.

## 5. Request flow

**Page reads:** Server Component → session → `ViewerContext` → use case from the module's `index.ts` → DTO → render. Server Components never `fetch` the application's own API.

**Mutations from the UI:** form or client component → Server Action in `actions.ts` → session → Zod validation → use case → mapped result.

**Client-side reads** (graph, live search with TanStack Query) and future external consumers: Route Handler → session → Zod validation → use case → DTO as JSON.

Route Handlers and Server Actions only do four things: get the session, validate input, call one use case and map the result or error. No business logic.

## 6. Authorization and spoiler filtering

- Every use case receives the acting user and checks universe ownership before doing anything else.
- A resource that belongs to another user is reported as not found, never as forbidden, so its existence is not revealed.
- Every read use case receives a `ViewerContext` as a required parameter: viewer user id, universe id, universe mode and progress per work. Omitting it is a compile error.
- The visibility rule lives in the domain (`SpoilerService`). Repositories receive the `ViewerContext` and apply the rule as a query filter. Filtering in memory after loading is only allowed when a test proves it equivalent.
- Until reading progress exists (Phase 4), `ViewerContext` carries ownership data only; its spoiler fields are introduced in that phase.

## 7. Errors

- Use cases throw typed errors that extend the base `DomainError` in `src/shared/domain`, each with a stable `code`.
- One mapper in `src/shared/presentation` turns errors into responses. Route Handlers and Server Actions always go through it.

| Error | HTTP | Notes |
|---|---|---|
| `ValidationError` | 400 | Includes field issues |
| `AuthenticationError` | 401 | |
| `AuthorizationError` | 403 | Only for actions on visible resources |
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

## 11. AI (Phase 5)

- The `ai` module defines an `AiProvider` port in its domain. Each provider is an adapter in its infrastructure.
- Retrieval always receives the `ViewerContext`; nothing reaches a provider without spoiler filtering.
- No further structure until Phase 5 is specified.

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