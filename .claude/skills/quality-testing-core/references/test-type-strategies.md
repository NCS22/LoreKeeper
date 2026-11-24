# Test type strategies - reference of `quality-testing-core`

Read it when you choose the test type for a behavior, when you decide between a fake and the real implementation, and when you write the test design section of a plan. It expands section 4 of `SKILL.md` (FR-12) and follows the recommended distribution of `specs/005a-quality-testing/testing-evaluation.md` section 2. **The proportion between types is a consequence of this table, never a quota.**

## Where each type runs

| Type | Runner and project | Files | Environment | Cost (evaluation 1.4) |
|---|---|---|---|---|
| Unit | Vitest `unit` | `tests/**/*.test.ts` not in the database list | Node, no I/O | About 6 s for 1315 unit and lint cases |
| Integration (database) | Vitest `database` | The `DATABASE_BACKED_TEST_FILES` list in `vitest.config.mts` (infrastructure, universes use cases, `tests/app`, the workspace page loader) | Node, the shared test PostgreSQL, one file at a time | About 55 s for 485 cases |
| Component | Vitest `component` | `tests/**/*.test.tsx` | jsdom, testing-library | None written yet; written when an interactive component is touched |
| End-to-end | Playwright (`pnpm test:e2e`) | `tests/e2e/*.spec.ts` | Production build, real browser | The slowest: about 76 s with 8 workers; not measured by coverage |
| Tooling | Vitest `unit` | `tests/lint/*.test.ts`, `tests/support/database/test-database-guard.test.ts` | Node | Not classified; see the tooling rule in `SKILL.md` section 8 |

## What each type protects, and what it must not do

| Level | Component kind (inventory ids) | Type | Protects | Must not |
|---|---|---|---|---|
| CORE | Domain rules and value objects (ACC-1, ACC-2, SHR-4, `session-policy.ts`) | Unit, exhaustive | Every rule and branch, every input boundary | Re-test the same rule through a use case or a page |
| CORE | Use cases (ACC-3, UNI-3, SHR-2) | Unit with fakes that pass the contracts, plus database scenarios for owner isolation | Order of rules, acting user, typed errors, owner isolation | Repeat every domain branch; run against PostgreSQL what a contract-checked fake proves |
| CORE | Infrastructure: repositories, authenticator, session reading, schema (ACC-4, UNI-4, SHR-1, CFG-3) | Integration against the test database | Owner scoping of every query, persistence, storage failures as typed errors | Test a mapper branch twice, by unit and by integration |
| CORE | Presentation boundary: Server Actions, input schemas, error mapping, page loader (APP-1, APP-2, SHR-3, CMP-6) | Integration through the action; unit for the shared mapper and parsers | Zod validation, acting-user check, mapped response, nothing internal exposed | Restate the use case's rules |
| CORE | Composition and security configuration (ACC-5, UNI-5, CFG-2) | None of their own; CFG-2 keeps its structural test and browser checks | That the real wiring is the one tested; the security headers | Test the wiring itself |
| IMPORTANT | Validators, reducers, interpreters, layout math (UNI-1, UNI-2, SHR-5, CMP-1, CMP-3, CMP-7 reducers, CMP-11) | Unit | The resulting state, the message chosen | Assert private details or every literal text |
| IMPORTANT | Interactive components, hooks, providers (APP-5, APP-6, CMP-2, CMP-4, CMP-5, CMP-7 provider, CMP-8, CMP-9, CMP-10) | Component test, when the component is touched | Roles, labels, focus, the result of an interaction | Snapshot markup; repeat a reducer already unit-tested |
| IMPORTANT | Pages of Server Components, the proxy (APP-3, APP-4) | End-to-end journey; unit for logic extracted from them | The page is reached and shows what it composes | Test layout a TIER 0 piece owns |
| Any | User flows | End-to-end, a small set of critical journeys | What only a browser shows: cookies, headers, real redirects, 320 px, keyboard, an unreachable data store | Repeat a rule or message a lower level proves |
| TIER 0 | Types, `ui` primitives, empty states, messages, styles, configuration, lockfile | None | - | Add tests to raise a percentage |

## Strategy per type, with a real example

**Unit (domain and pure logic).** Call the function directly, cover each branch and both sides of each limit, compare the whole result with `toEqual`. Example: `tests/modules/accounts/domain/account-password.test.ts:21`, `:29`, `:36`, `:43` (7, 8, 128 and 129 characters). Time-dependent logic uses fake timers, as `tests/components/universes/check-name-after-pause.test.ts:29` ("asks nothing before the person has paused for 250 ms").

**Use case scenarios.** One scenario file runs against both storages through `universeStorageFactories` (`tests/support/universe-repository-factories.ts`), so the same assertions prove the fake and PostgreSQL: `tests/modules/universes/application/remember-universe.test.ts:27` (`describe.each(universeStorageFactories)`). The accounts use cases run on the contract-checked fake: `tests/modules/accounts/application/sign-in.test.ts:49`.

**Integration (database).** Use the test database from `tests/support/database/`, never the development one. Prove owner scoping by seeding two owners and checking each sees only its own rows, and map storage failures to typed errors: `tests/modules/universes/infrastructure/prisma-universe-repository.test.ts:105` ("turn a failed write into an InfrastructureError that keeps the cause"). Server Actions are tested through the action: `tests/app/actions.test.ts:103` ("succeeds when the person never signed in").

**Component.** `.test.tsx` files only, so the other projects keep the Node environment (plan D9). Query by role and label, act as a person would, assert what changes for the person. Only `@testing-library/react` and `@testing-library/dom` are approved; `user-event` and `jest-dom` are asked when a test needs them. No component test exists yet.

**End-to-end.** One test per critical journey or browser-only fact, data seeded through `tests/e2e/support/`. Example of what only a browser shows: `tests/e2e/access.spec.ts:58` (303 status, `location`, `no-store`, no cookie). Owner isolation through real forged calls: `tests/e2e/universes-isolation.spec.ts:136` ("a foreign identifier and a nonexistent one give the same answer...").

## Fake versus real

| Situation | Use | Example |
|---|---|---|
| A port with an in-memory fake that passes the same contract test as the real implementation | The fake, in unit tests | Universe storage contract `tests/support/contracts/universe-repository-contract.ts`, run on the fake at `tests/modules/universes/application/fake-universe-storage.test.ts:10` and on PostgreSQL at `tests/modules/universes/infrastructure/prisma-universe-repository.test.ts:12`; account authenticator contract run on the fake at `tests/modules/accounts/application/fake-account-authenticator.test.ts:4` and on Better Auth at `tests/modules/accounts/infrastructure/better-auth-account-authenticator.test.ts:69` |
| SQL, owner scoping, constraints, provider behavior | The real implementation against the test database | `tests/support/contracts/universe-repository-contract.ts:102` ("never lists the universes of another owner") running on PostgreSQL |
| A plain callback with no behavior of its own | `vi.fn()` | `checkName` in `tests/components/universes/check-name-after-pause.test.ts:30` |
| Provoking a failure the real dependency cannot be made to produce | A spy on the real object that rejects once, inside an integration test | `tests/modules/accounts/infrastructure/better-auth-account-authenticator.test.ts:223` (`deleteSession` rejects) in the test at line 217 |
| Confirming the real code did not reach a collaborator | A spy on the contract-checked fake | `tests/modules/accounts/application/sign-in.test.ts:81` (`signInWithPassword` not called after a validation error) |

A fake hides real errors when it is a hand-written stub that no contract checks against the real implementation: it can accept what the database refuses (a missing owner, a 121-character name) or return in an order the real query does not. Rules:
- A new port with a fake gets a contract in `tests/support/contracts/`, run on both.
- A fake change that the contract does not cover adds the case to the contract, not to the fake's own test.
- Never mock Prisma or Better Auth to prove a query or a session rule; use the test database.
