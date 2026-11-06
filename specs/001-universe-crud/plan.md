# Plan 001 — Create Universe

Status: approved

Spec: `specs/001-universe-crud/spec.md` (now `implemented`; it was approved with no open questions when this plan was written).

Approvals already given by the user for this plan are recorded in section 10. Nothing in this plan is waiting for approval except the plan itself.

## 0. Approach in one paragraph

The creation rules (name, description, mode, duplicate-name detection, identifier and timestamps) live in a small `universes` module made of domain rules, three use cases and a repository interface. The only repository implementation is an in-memory one, created in the browser by a temporary provider component, so a created universe lives while the page is open and disappears on reload (FR-24). The form, the empty state and the sidebar read and write universes only through the module's public interface. When real storage arrives, a Prisma repository is added and the composition is switched; the domain and the use cases do not change (NFR-1, OCP). Nothing is built for that future beyond the repository interface and the injected id and clock functions (YAGNI).

In addition, this plan adds the architecture's import-boundary lint rules (section 1, "Tooling"). That is project tooling approved by the user to land together with the first module. It is **not a feature requirement**: it adds no FR or NFR and changes none of the spec's FRs.

## 1. Affected modules and layers

### New module `universes` (approved)

| Layer | File | Content |
|---|---|---|
| Domain | `src/modules/universes/domain/universe.ts` | `Universe` type: `id`, `name`, `description` (string or null), `mode`, `createdAt`, `updatedAt` (UTC `Date`s). |
| Domain | `.../domain/universe-mode.ts` | The two modes, `DEFAULT_UNIVERSE_MODE = "READER"`, mode parsing (FR-2, FR-9). |
| Domain | `.../domain/universe-name.ts` | Name rule: trim, reject empty (FR-5), reject over 120 characters counted after trimming (FR-6); `toComparableUniverseName` (case, accents, surrounding and repeated whitespace ignored) used for duplicates (FR-11, FR-13). |
| Domain | `.../domain/universe-description.ts` | Description rule: trim, whitespace-only becomes "no description" (FR-8), reject over 2000 characters counted after trimming (FR-7); line breaks inside are preserved. |
| Domain | `.../domain/universe-repository.ts` | Interface, asynchronous: `findAll(): Promise<readonly Universe[]>` in creation order, and `add(universe): Promise<void>`. There is deliberately no update or delete method (FR-18). |
| Application | `.../application/create-universe.ts` | Use case (FR-5 to FR-10, FR-14 to FR-18, FR-23). |
| Application | `.../application/list-universes.ts` | Use case (FR-17). |
| Application | `.../application/is-universe-name-in-use.ts` | Use case for the duplicate-name warning (FR-11, FR-13). |
| Application | `.../application/universe-dto.ts` | `UniverseDto` (`id`, `name`, `description`, `mode`, `createdAt`, `updatedAt` as ISO 8601 strings) and the domain-to-DTO mapping. No cover image field (FR-16). |
| Infrastructure | `.../infrastructure/in-memory-universe-repository.ts` | Repository kept in memory; receives its starting universes as an argument. |
| Wiring | `.../composition.ts` | `createUniversesInMemory(startingUniverses)` returns the three composed use cases bound to a new in-memory repository, `crypto.randomUUID` and the system clock. Marked as temporary in a comment. |
| Public interface | `.../index.ts` | Exports the composition function, `UniverseDto`, the input type and the mode constants and types needed by the UI. Nothing else. |

Dependencies follow `presentation → application → domain ← infrastructure`. Domain and application import no React, Next.js or Prisma.

### Shared kernel (approved, new folder `src/shared/domain`)

- `src/shared/domain/domain-error.ts`: base `DomainError` with a stable `code` (architecture section 7).
- `src/shared/domain/validation-error.ts`: `ValidationError` carrying a list of field issues (`field`, `code`, optional numeric details such as `maximumLength`).

### Presentation (existing shell, modified with approval)

New files in `src/components/universes/`:
- `universes-provider.tsx` (client): temporary adapter. Creates the in-memory module once per mounted workspace, seeded with the sample universes, and exposes `useUniverses()` with `universes`, `createUniverse` and `isUniverseNameInUse`. It is the only place that knows the storage is in memory; it is replaced by server reads and a Server Action when real storage arrives.
- `universe-creation-form.tsx` (client): the form (FR-1 to FR-4, FR-10 to FR-14, FR-19, FR-20).
- `universe-empty-state.tsx`: the empty state (FR-22).
- `universe-issue-messages.ts`: pure mapping from a validation issue code to the message in the UI dictionary, filling in the limit from the issue details.

Modified existing files:
- `src/components/workspace/workspace-state.tsx`: adds `isCreatingUniverse` and the actions `universeCreationStarted`, `universeCreationCancelled` and `universeCreated`; exports the reducer so it can be unit tested.
- `src/components/workspace/workspace.tsx`: wraps the workspace with `UniversesProvider`.
- `src/components/workspace/central-area.tsx`: shows the form while `isCreatingUniverse`, the empty state when the selected universe has no content, otherwise the current views; takes the universe from `useUniverses()`.
- `src/components/sidebar/sidebar.tsx`: adds a "New universe" icon button to the sidebar header (second entry point, FR-1).
- `src/components/sidebar/sidebar-tree.tsx` and `sidebar-rail.tsx`: read the universe list from `useUniverses()` instead of the sample-data query.
- `src/components/topbar/app-menu-bar.tsx`: the "New universe" item of the Universe menu becomes enabled and starts the creation; the other items stay disabled.
- `src/messages/en.ts`: new `universeCreation` and `universeEmptyState` groups, a `sidebar.newUniverse` label, and the Universe menu entry separates the enabled "New universe" from the disabled placeholders.

Not touched: `src/mocks/` (its universe sample data is the starting content and is still used by the other sample queries), entity creation, graph, list view, inspector, `package.json`, Prisma, `src/app`.

### Tooling: import-boundary lint rules (approved by the user; not a feature requirement)

Files: `eslint.config.mjs` (modified) and `tests/lint/import-boundaries.test.ts` (new).

Rules, from architecture section 9, expressed with ESLint's `no-restricted-imports` using config objects per folder:
- `src/modules/*/domain/**`: forbids `@prisma/client`, `next`, `next/*`, `react`, `better-auth`, and any path that goes through an `infrastructure` or `application` folder.
- `src/modules/*/application/**`: forbids `@prisma/client`, `next`, `next/*`, `react`, `better-auth`, and any path that goes through an `infrastructure` folder.
- All files under `src/`: forbid deep imports of another module, that is `@/modules/<module>/<anything>`; only `@/modules/<module>` is allowed. Files inside a module reach their own files with relative imports.
- ESLint replaces, not merges, the options of a rule when several config objects match the same file, so the domain and application objects repeat the "no deep module imports" pattern.
- `tests/` is exempt from the deep-import rule on purpose: tests mirror `src/` and must import domain and application files directly.
- No new dependency is needed: the rule is built into ESLint and the check uses the `eslint` package already installed.
- Known limit: a relative import that climbs out of a module into another one is not caught by this rule set; it stays a code-review point (architecture section 9 says it is forbidden).

This does not touch application behavior. The current code base has no `src/modules` and no `@/modules` imports, so `pnpm lint` must still pass with no new warnings after the change.

### Future connection (for context, not built)

Add `prisma-universe-repository.ts` implementing the same interface, switch `composition.ts`, move reads to Server Components and writes to a Server Action (with Zod at that boundary), add the acting user and `ViewerContext` to the use cases. The rules in domain and the use case bodies stay as they are.

## 2. Data

- No Prisma schema change, no migration, no JSONB attributes.
- `Universe` follows `data-model.md` with these deliberate omissions, all out of scope in the spec: `ownerId` (no users), `coverImageUrl`, `deletedAt` (no trash).
- Limits: name 1 to 120 characters, description at most 2000 characters, counted in Unicode code points so an emoji counts as one. Domain constants are the only place these numbers appear (NFR-5).
- Mode: `READER` or `AUTHOR`, default `READER`, never changed after creation.
- Identifier: UUID from `crypto.randomUUID`, injected as a function. Timestamps: one `Date` read once from an injected clock and used for both `createdAt` and `updatedAt`, serialized as ISO 8601 UTC in the DTO (FR-15).
- Starting content: the two sample universes from `src/mocks/data/universes.ts`, converted to domain universes in the provider.

## 3. Use cases

No acting user and no `ViewerContext` in this version: there are no users (spec, out of scope). This is a documented, user-accepted exception to architecture section 6. Adding the actor later is a signature change in three use cases and their composition.

Each use case is a function with explicit dependencies, one per file:

1. `createUniverse(dependencies, command)`
   - Dependencies: `universeRepository`, `generateUniverseId: () => string`, `getCurrentTime: () => Date`.
   - Command: `name`, `description` (string or null), `mode` as received from the form.
   - Validates name, description and mode together and throws one `ValidationError` listing every failing field (FR-5 to FR-9). Nothing is stored on failure (FR-10).
   - Does not look at duplicate names: a duplicate never blocks creation (FR-12).
   - Builds the universe empty (no works or other content, FR-14), stores it with `add`, returns `UniverseDto`.
   - Errors: `ValidationError`. Anything the repository throws is propagated unchanged.
2. `listUniverses(dependencies)`
   - Dependencies: `universeRepository`. Returns `UniverseDto[]` in creation order, so a new universe appears after the existing ones (FR-17).
3. `isUniverseNameInUse(dependencies, name)`
   - Dependencies: `universeRepository`. Returns `true` when any stored universe has the same comparable name; returns `false` for an empty or whitespace-only name (FR-11, FR-13). Never throws for invalid names; that is the job of creation.

Read use cases and spoilers: these reads return universe metadata only; no narrative data is involved (section 6).

## 4. Contracts

No Server Actions, no Route Handlers and no Zod schema in this version. Reason: a server action would keep created universes on the server, shared by every visitor and surviving reloads, which breaks FR-24 and the "no backend" decision. Zod is not installed; the user decided to add it together with the first Server Action.

Contract = the module's public interface, called from client components through `useUniverses()`:

```
createUniverse(input: { name: string; description: string | null; mode: string }): Promise<UniverseDto>
  throws ValidationError { issues: { field: "name" | "description" | "mode"; code: ...; maximumLength?: number }[] }
listUniverses(): Promise<UniverseDto[]>
isUniverseNameInUse(name: string): Promise<boolean>
```

Issue codes (stable): `NAME_REQUIRED`, `NAME_TOO_LONG`, `DESCRIPTION_TOO_LONG`, `MODE_INVALID`. The UI turns codes into text using the dictionary and takes the limit from `maximumLength`, so the numbers are never repeated in the UI.

Validation lives only in the domain. A Zod schema at a future Server Action boundary would only parse the shape and delegate the rules to the domain.

## 5. UI

Where and how
- Two entry points that start the same creation: the enabled "New universe" item in the Universe menu (hidden below the `md` breakpoint) and a "New universe" icon button in the sidebar header (the sidebar is a drawer below `md`, so the button is always reachable). Below `md` the button also closes the drawer so the form is visible. The collapsed sidebar rail gets no button: expanding it is one action and the menu item stays available on desktop.
- The form uses the existing pattern of the entity form: it takes over the central area while `isCreatingUniverse` is true. Existing components cover it (`Input`, `Textarea`, `RadioGroup`, `Button`, `Menubar`, and the lucide `Plus` icon already used elsewhere); no new shadcn component and no form library.
- Client components: provider, form. The empty state can be a plain component rendered inside the existing client central area.

Form (FR-1 to FR-4, FR-10 to FR-14, FR-19, FR-20)
- Fields: name (text input), description (textarea, optional), mode (radio group, `READER` preselected, FR-2). Each mode option shows its short explanation (FR-3). A visible note says the mode cannot be changed after creation (FR-4).
- Form is mounted fresh each time it opens, so values start empty and `READER` is selected (FR-2, edge case "reopening starts clean").
- `noValidate` on the form and no `maxLength` attribute, so the domain rules produce the errors and a too-long value can be typed and reported (FR-6, FR-7).
- Duplicate warning (FR-11, FR-12, FR-13): an effect calls `isUniverseNameInUse` when the name changes and ignores stale answers; the warning text appears under the name field while it matches and disappears when it stops matching. Submitting does not repeat the warning or ask for confirmation.
- Submit: on failure, show each issue under its field, keep every typed value, and move focus to the first invalid field (FR-10). An error clears when its field is edited. On success, dispatch `universeCreated`.
- Double submit (FR-19): a synchronous in-flight guard in the form plus a disabled submit button while the call is pending.
- Cancel (FR-20): dispatches `universeCreationCancelled`; nothing is created and `selectedUniverseId` is unchanged.
- Errors that are not `ValidationError` are not caught; they surface to the framework error handling (no swallowing).

After creation (FR-21 to FR-23)
- `universeCreated` selects the new universe (clearing work and entity selection), closes the form and does not touch other universes.
- The sidebar tree and rail list it after the existing universes (FR-17).
- Empty state (FR-22): shown in the central area when the selected universe has no works and no entities, with a heading carrying the universe name and a short text saying it has no content yet and that works and entities will be added here. Text only, no action button, because creating works is out of scope. Focus moves to this heading and a polite live region announces "Universe created: <name>".
- "Is empty" is computed with the same sample-data queries the views use today; it is replaced by the real read when content modules exist.

States
- Empty: the empty state above. Loading: none needed (in-memory, resolves immediately); the submit button shows its disabled state. Error: field errors and the duplicate warning described above.

Accessibility (NFR-2 to NFR-4)
- Every field has a visible `label`. Error and warning texts have their own ids and are referenced by `aria-describedby` on the field; invalid fields set `aria-invalid`. The warning sits in a polite live region that is always rendered, so its appearance is announced.
- Mode options are a labelled `fieldset` with a legend; the explanations are part of each option's label.
- Everything is reachable and operable by keyboard: Enter submits from the text input; Cancel is a real button; the sidebar header button has an accessible name. Focus goes to the name field when the form opens, and to the central area heading when it closes (cancel or success).
- Error and warning use the existing text tokens and focus ring; no new colors.
- Strings go in the typed dictionary `src/messages/en.ts`.

## 6. Spoiler impact

None. Creating and listing universes touches no narrative information: no works, narrative units, boundaries or reading progress exist or are read. No visibility rule is applied and the spoiler suite is not required for any task of this plan. The mode is stored as plain data and unchanged afterwards; nothing in this feature reads it to filter content. The universe's `mode` is carried in the DTO for the future features that will.

## 7. Tests

Vitest only picks up `tests/**/*.test.ts` in a Node environment. The user decided that the UI is verified manually: no DOM test environment, no React testing library and no Playwright for this feature. The plan therefore puts every rule in testable pure code and keeps the UI thin.

Testing debt (recorded on purpose): the behaviors only the interface can show are checked by hand at validation and have no automated regression test. They are FR-1 to FR-4, FR-11 to FR-13 (visible warning), FR-19, FR-20, FR-22, FR-24 and NFR-2 to NFR-4. The first feature that adds component or E2E tooling should turn them into automated tests.

Domain (`tests/modules/universes/domain/`)
- `universe-name.test.ts`: empty, whitespace-only, 1 character, exactly 120, 121, 120 after trimming with surrounding spaces, emoji counted as one, comparable name equal for case, accent and repeated-space variants and different for different words.
- `universe-description.test.ts`: empty, whitespace-only becomes none, exactly 2000, 2001, line breaks preserved.
- `universe-mode.test.ts`: both modes accepted, anything else rejected, default is `READER`.

Application (`tests/modules/universes/application/`), run twice with `describe.each` over two interchangeable repositories (the in-memory one and a fake in `tests/support/fakes/`) to verify NFR-1 with the same scenarios:
- `create-universe.test.ts`: valid `READER` and `AUTHOR` creation; trimmed name; each validation failure; all failures reported together; nothing stored on failure; duplicate name still creates and yields different identifiers; empty at creation; `createdAt` equals `updatedAt`; identifier unique; other universes unchanged; DTO has no cover field; invalid mode rejected.
- `list-universes.test.ts`: creation order, new universe last, sample ones intact.
- `is-universe-name-in-use.test.ts`: match ignoring case, accents and spaces; no match; empty name returns false; becomes false when the name changes.

Infrastructure (`tests/modules/universes/infrastructure/in-memory-universe-repository.test.ts`)
- Shared repository contract run against both repositories: `findAll` order, `add` then `findAll`, returned values cannot be used to alter stored ones. No database is involved in this version.

Shared (`tests/shared/domain/validation-error.test.ts`): issues are kept and the `code` is stable.

Presentation
- `tests/components/workspace/workspace-state.test.ts`: reducer cases for `universeCreationStarted` (also closes entity creation), `universeCreationCancelled` (selection unchanged, FR-20), `universeCreated` (selects the new universe, clears work and entity, closes the form, FR-21), selecting another universe while the form is open closes it.
- `tests/components/universes/universe-issue-messages.test.ts`: each issue code maps to a message including the limit from its details.

Tooling (`tests/lint/import-boundaries.test.ts`): uses the ESLint programmatic API already installed to lint small code snippets with a given file path and the repository's real configuration. It checks that:
- a domain file importing `react`, `next/navigation`, `@prisma/client`, `better-auth`, an `infrastructure` path or an `application` path is reported by `no-restricted-imports`;
- an application file importing `react`, `@prisma/client` or an `infrastructure` path is reported, while importing its own domain by a relative path is not;
- a file under `src/components` importing `@/modules/universes/domain/universe` is reported, while `@/modules/universes` is not;
- a module file importing another module's internal path is reported;
- a file under `tests/` importing a module's internal path is not reported.
Plus, as the manual and baseline check: `pnpm lint` on the whole project passes with no new warnings compared with before the change.

Spoiler suite: not required (no query or visibility change). E2E: none (user decision).

Verification gate: `pnpm typecheck`, `pnpm lint`, `pnpm test`, plus the manual check listed in the debt note. No schema, so no migration check.

## 8. Decisions

| # | Decision | Discarded alternative and why |
|---|---|---|
| D1 | Create the `universes` module with a repository interface and an in-memory implementation. | Put the rules in components or in the sample-data queries: breaks "no business rules in components" and makes NFR-1 unverifiable; adding real storage would mean rewriting creation. |
| D2 | Run the use cases in the browser through a client provider. | A Server Action over a server-side list: the list would be shared by all visitors and survive reloads, contradicting FR-24 and the "no backend" decision. |
| D3 | Asynchronous repository interface. | Synchronous: simpler today but the first real storage forces an interface change, defeating OCP. The cost is a small effect for the live warning. |
| D4 | Duplicate detection as a use case over the repository. | A pure helper called from the form over the list kept in React state: puts a business rule in presentation and cannot be swapped with the storage. |
| D5 | Domain validation, no Zod now (user decision). | Add Zod now: new dependency for a form that has no system boundary yet; deferred to the first Server Action. |
| D6 | Characters counted in Unicode code points. | UTF-16 units: an emoji would count as two. Grapheme clusters: more exact, but needs a segmentation API and adds complexity for no stated need. |
| D7 | Description is trimmed and measured after trimming, like the name. | Measure raw text: a trailing-space-only difference could flip valid and invalid. The spec only fixes the 2000 limit and the whitespace-only case. |
| D8 | Form takes over the central area (existing entity-form pattern). | Dialog: needs a new shadcn component (approval) and a second interaction pattern. |
| D9 | Two entry points: menu item and sidebar header button (user decision). Rail gets none. | Menu item only: unreachable below `md`. Button also in the collapsed rail: more UI for a state where expanding takes one click. |
| D10 | `noValidate` and no `maxLength`. | Browser validation and input limits: would hide the domain errors the spec requires (FR-5 to FR-7). |
| D11 | Injected `generateUniverseId` and `getCurrentTime` functions. | Port interfaces or classes: more ceremony than a function parameter needs (architecture: functions with explicit dependencies, no classes). |
| D12 | The repository is the source of truth; the provider's list is a render cache refreshed after each write. | Appending the returned DTO to React state without re-reading: two sources of truth that can drift. |
| D13 | Focus management: name field on open, central heading on close. | Return focus to the opener: the menu item unmounts when the menu closes, so the target is unreliable. |
| D14 | Starting universes are passed into the composition by the provider. | The module importing the mocks: couples the module to temporary files that are meant to be deleted. |
| D15 | Empty state has text only, no action (user decision). | A "create first work" button: works are out of scope and it would lead nowhere. |
| D16 | Import boundaries enforced with the built-in `no-restricted-imports` and config objects per folder, repeating the shared pattern in each. | A boundary plugin (for example `eslint-plugin-boundaries`): new dependency. Relying on review only: the architecture says the rules are enforced by the linter. |
| D17 | The lint rules are verified by an automated test that lints snippets through the ESLint API. | Checking by hand once with a deliberate violation: leaves no regression protection and the rules could break unnoticed. |
| D18 | `tests/` is exempt from the deep-module-import rule. | Applying it to tests too: unit tests of domain and application files could not import their subject, contradicting architecture section 12. |
| D19 | Lint rules are added in this feature, not in a separate one (user decision). | A separate tooling spec: cleaner scope, but the first module is exactly when the rules start to matter. Cost: this feature carries one non-FR task. |

Risks and notes
- `crypto.randomUUID` needs a secure context (HTTPS or localhost); opening the dev server through a plain-HTTP network address would fail on creation. Acceptable for this version.
- Next.js Fast Refresh may reset the in-memory universes during development; this matches FR-24.
- Seeding the provider on server and client with the same sample data avoids a hydration mismatch; identifiers are generated only in the submit handler.
- Below `md`, closing the sidebar drawer may restore focus to the control that opened it and compete with the form's focus on the name field. To check during the manual verification; if it happens, the drawer's close focus handling must be adjusted.
- The lint test lints with the full project configuration, so it may take a few seconds; it should be given an explicit timeout.
- The relative-import limit of the lint rules (section 1, Tooling) is accepted and left to review.

## 9. Coverage

| Requirement | Covered by |
|---|---|
| FR-1, FR-2 | Menu item and sidebar header button, creation form, fresh mount; manual check; default mode in domain test |
| FR-3, FR-4 | Mode explanations and immutability note in the form and dictionary; manual check |
| FR-5, FR-6 | `universe-name` rule, `createUniverse`, field error display; domain and application tests |
| FR-7, FR-8 | `universe-description` rule, `createUniverse`; domain and application tests |
| FR-9 | `universe-mode` parsing, `createUniverse`; domain and application tests |
| FR-10 | `createUniverse` stores nothing on failure; form keeps values; application test, manual check |
| FR-11, FR-13 | `toComparableUniverseName`, `isUniverseNameInUse`, live warning in the form; domain, application tests, manual check |
| FR-12 | `createUniverse` ignores duplicates; form submits without confirmation; application test, manual check |
| FR-14 | `createUniverse` builds an empty universe with trimmed name, description, mode; application test |
| FR-15 | Injected id and clock, single timestamp; application test |
| FR-16 | `Universe` and `UniverseDto` have no cover field; application test |
| FR-17 | `listUniverses`, sidebar tree and rail via `useUniverses()`; application test, manual check |
| FR-18 | Repository interface without update; no use case changes the mode; review plus application test |
| FR-19 | In-flight guard and disabled submit; manual check |
| FR-20 | `universeCreationCancelled`; reducer test, manual check |
| FR-21 | `universeCreated`; reducer test |
| FR-22 | Empty state in the central area; manual check |
| FR-23 | `add` only appends; application and infrastructure tests |
| FR-24 | In-memory repository created per mounted workspace; manual reload check |
| NFR-1 | Repository interface, `describe.each` over two repositories; application and infrastructure tests |
| NFR-2 | Native form controls, existing menubar, accessible sidebar button; manual keyboard check |
| NFR-3 | Labels, `aria-describedby`, `aria-invalid`, live region; manual screen-reader or accessibility-tree check |
| NFR-4 | Existing tokens only; manual check including contrast presets |
| NFR-5 | Limits and rules only in domain; UI reads limits from issue details; review that no 120 or 2000 appears outside the domain |
| T-1 (tooling, not an FR) | `eslint.config.mjs` rules and `tests/lint/import-boundaries.test.ts`; `pnpm lint` clean on the existing code. Protects the dependency direction used by every requirement above; changes no FR. |

Every FR and NFR is covered. T-1 is project tooling and is not part of the spec's requirements; the spec's out-of-scope list does not mention it and is unchanged.

## 10. Approvals recorded

Given by the user for this plan:
1. New module `src/modules/universes` (domain, application, infrastructure, composition, index).
2. New folder `src/shared/domain` with `DomainError` and `ValidationError`.
3. Modification of the existing shell files listed in section 1.
4. Use cases without acting user and `ViewerContext` in this version (exception to architecture section 6, documented).
5. Validation only in the domain; Zod added later with the first Server Action.
6. UI verified manually; testing debt recorded in section 7.
7. Import-boundary ESLint rules added within this feature (tooling, section 1).
8. Sidebar header "New universe" button as a second entry point; empty state is text only.

Open: none. No new dependency, Prisma change, top-level folder or new shadcn component is needed.
