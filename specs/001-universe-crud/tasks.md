Status: approved

Spec: `specs/001-universe-crud/spec.md` (now `implemented`). Plan: `specs/001-universe-crud/plan.md` (approved).

Rules for every task: it ends with `pnpm typecheck`, `pnpm lint` (no new warnings) and `pnpm test` passing, and touches only the files its plan section names. The spoiler suite is not required by any task (the plan, section 6, says this feature touches no narrative data). Items that only the interface can show are verified by hand because the user decided against UI test tooling (plan section 7, "Testing debt").

- [x] **T1. Tooling: import-boundary lint rules (not a feature requirement).** No FR; plan section 1 "Tooling", section 9 row T-1
  - Touches: `eslint.config.mjs`
  - Tests: `tests/lint/import-boundaries.test.ts`, which lints code snippets with the project's real configuration through the ESLint API and checks that: a domain file importing `react`, `next/navigation`, `@prisma/client`, `better-auth`, an `infrastructure` path or an `application` path is reported by `no-restricted-imports`; an application file importing `react`, `@prisma/client` or an `infrastructure` path is reported while a relative import of its own domain is not; a file under `src/components` importing `@/modules/universes/domain/universe` is reported while `@/modules/universes` is not; a module file importing another module's internal path is reported; a file under `tests/` importing a module's internal path is not reported. The test sets an explicit timeout.
  - Done when: the new test passes; `pnpm lint` on the whole project passes with no new warnings compared with before the change; no dependency was added.

- [x] **T2. Shared errors, universe mode and the `Universe` type.** FR-2, FR-9, FR-16, FR-18
  - Touches: `src/shared/domain/domain-error.ts`, `src/shared/domain/validation-error.ts`, `src/modules/universes/domain/universe.ts`, `src/modules/universes/domain/universe-mode.ts`
  - Tests: `tests/shared/domain/validation-error.test.ts` (issues are kept; the `code` is stable); `tests/modules/universes/domain/universe-mode.test.ts` (both modes accepted, anything else rejected, default is `READER`).
  - Done when: both tests pass; `Universe` has no cover image, owner or deletion field; domain files import no React, Next.js or Prisma (T1 rules pass).

- [x] **T3. Name and description rules.** FR-5, FR-6, FR-7, FR-8, FR-11, FR-13, NFR-5
  - Touches: `src/modules/universes/domain/universe-name.ts`, `src/modules/universes/domain/universe-description.ts`
  - Tests: `tests/modules/universes/domain/universe-name.test.ts` (empty, whitespace-only, 1 character, exactly 120, 121, 120 after trimming surrounding spaces, an emoji counts as one character, comparable name equal for case, accent and repeated-space variants and different for different words); `tests/modules/universes/domain/universe-description.test.ts` (empty, whitespace-only becomes none, exactly 2000, 2001, line breaks preserved).
  - Done when: both tests pass; the numbers 120 and 2000 each exist as one named constant in the domain and nowhere else in `src/`.

- [x] **T4. Repository interface, DTO and in-memory repository.** FR-16, FR-17, FR-18, FR-23, NFR-1
  - Touches: `src/modules/universes/domain/universe-repository.ts` (`findAll` in creation order, `add`, no update or delete), `src/modules/universes/application/universe-dto.ts`, `src/modules/universes/infrastructure/in-memory-universe-repository.ts`, and the test fake `tests/support/fakes/` (a second, differently built repository implementation)
  - Tests: `tests/modules/universes/infrastructure/in-memory-universe-repository.test.ts` runs one shared repository contract against both the in-memory repository and the fake: `findAll` order, `add` then `findAll`, adding does not change the others, returned values cannot alter stored ones.
  - Done when: the contract passes for both implementations; the DTO has no cover field and carries ISO 8601 UTC strings.

- [x] **T5. Use cases: create, list and name-in-use.** FR-5 to FR-10, FR-12, FR-14, FR-15, FR-16, FR-17, FR-18, FR-23, NFR-1, NFR-5
  - Touches: `src/modules/universes/application/create-universe.ts`, `list-universes.ts`, `is-universe-name-in-use.ts`
  - Tests: `tests/modules/universes/application/create-universe.test.ts`, `list-universes.test.ts` and `is-universe-name-in-use.test.ts`, each run with `describe.each` over the in-memory repository and the fake from T4. Create: valid `READER` and `AUTHOR`; trimmed name; each validation failure; all failures reported together in one `ValidationError`; nothing stored on failure; a duplicate name still creates and yields different identifiers; universe born empty; `createdAt` equals `updatedAt`; identifier unique; other universes unchanged; invalid mode rejected. List: creation order, new universe last. Name in use: match ignoring case, accents and spaces; no match; empty name returns false; false again once the name changes.
  - Done when: all scenarios pass unchanged on both repositories (this is the check for NFR-1); the use cases take explicit dependencies (repository, id function, clock function) and no user or `ViewerContext` (plan section 3).

- [x] **T6. Composition, public interface, provider and sidebar reading from it.** FR-17, FR-23, FR-24
  - Touches: `src/modules/universes/composition.ts` (`createUniversesInMemory(startingUniverses)`, marked temporary), `src/modules/universes/index.ts`, `src/components/universes/universes-provider.tsx`, `src/components/workspace/workspace.tsx`, `src/components/sidebar/sidebar-tree.tsx`, `src/components/sidebar/sidebar-rail.tsx`
  - Tests: `tests/modules/universes/composition.test.ts` (starting universes are listed; a created universe appears last; two compositions do not share data).
  - Done when: the test passes; the sidebar tree and rail show the two sample universes exactly as before (manual); the only imports of the module from outside it go through `@/modules/universes` (T1 rules pass); after a reload the app shows only the sample universes (manual, covers the in-memory part of FR-24).

- [x] **T7. Workspace state for universe creation.** FR-20, FR-21
  - Touches: `src/components/workspace/workspace-state.tsx` (adds `isCreatingUniverse` and the actions `universeCreationStarted`, `universeCreationCancelled`, `universeCreated`; exports the reducer)
  - Tests: `tests/components/workspace/workspace-state.test.ts`: starting the creation also closes entity creation; cancelling leaves `selectedUniverseId` unchanged; `universeCreated` selects the new universe, clears work and entity selection and closes the form; selecting another universe while the form is open closes it.
  - Done when: the reducer tests pass and the existing entity creation behavior is unchanged (manual).

- [x] **T8. Dictionary, issue messages and empty state.** FR-22, FR-3, FR-4, FR-6, FR-7, NFR-3, NFR-5
  - Touches: `src/messages/en.ts` (`universeCreation` and `universeEmptyState` groups, `sidebar.newUniverse` label, Universe menu entry split into the enabled "New universe" and the disabled placeholders), `src/components/universes/universe-issue-messages.ts`, `src/components/universes/universe-empty-state.tsx`, `src/components/workspace/central-area.tsx` (shows the empty state when the selected universe has no works and no entities)
  - Tests: `tests/components/universes/universe-issue-messages.test.ts` (each issue code maps to a message; the limit comes from the issue details and is not written in the UI).
  - Done when: the test passes; manual check with a temporary empty universe or by reading the code path: the empty state shows the universe name as heading, says it has no content yet, has no action button, takes focus and is announced in a polite live region; sample universes still show their graph and list.

- [x] **T9. Creation form.** FR-1, FR-2, FR-3, FR-4, FR-5 to FR-14, FR-17, FR-19, FR-20, FR-21, FR-22, NFR-2, NFR-3, NFR-4, NFR-5
  - Touches: `src/components/universes/universe-creation-form.tsx`, `src/components/workspace/central-area.tsx` (renders the form while `isCreatingUniverse`)
  - Tests: none new; the rules were tested in T3 to T5 and the state in T7. Manual checks recorded as testing debt (plan section 7).
  - Done when, by hand: the form opens empty with `READER` selected, both modes explained and a note that the mode cannot change; the duplicate warning appears while typing a name equal to an existing one (ignoring case, accents and spaces), disappears when the name stops matching, and submitting then creates the universe with no second warning; each of FR-5, FR-6 and FR-7 shows its error under its field, stating the limit, keeps the typed values and moves focus to the first invalid field; a valid submit creates one universe even on a double click or repeated Enter, selects it, closes the form and shows the empty state; Cancel creates nothing and keeps the selection; everything works with the keyboard only; errors and the warning are linked to their fields; contrast is acceptable in every accessibility preset. `grep` finds no literal 120 or 2000 outside the domain (NFR-5).

- [x] **T10. Entry points and final manual verification.** FR-1, FR-24, NFR-2, NFR-3
  - Touches: `src/components/topbar/app-menu-bar.tsx` ("New universe" item enabled; other items stay disabled), `src/components/sidebar/sidebar.tsx` (icon button "New universe" in the sidebar header; below the `md` breakpoint it also closes the drawer)
  - Tests: none new (UI only). Both entry points dispatch the action already tested in T7.
  - Done when, by hand: the menu item and the header button both open the same form; the header button has an accessible name and is reachable by keyboard; the collapsed sidebar rail has no button (plan decision D9); below `md` the button works and, after the drawer closes, the name field has focus (if the drawer restores focus to its opener instead, adjust the close focus handling, plan section 8, risks); creating two universes in a row adds both and selects the latest; reloading the page removes the created universes (FR-24); the sample universes are unchanged after creating one. Then run the full gate: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

Coverage check against the spec:
- FR-1: T9, T10. FR-2: T2, T9. FR-3, FR-4: T8, T9. FR-5, FR-6: T3, T5, T8, T9. FR-7, FR-8: T3, T5, T8, T9. FR-9: T2, T5. FR-10: T5, T9. FR-11, FR-13: T3, T5, T9. FR-12: T5, T9. FR-14: T5, T9. FR-15: T5. FR-16: T2, T4, T5. FR-17: T4, T5, T6, T9. FR-18: T2, T4, T5. FR-19: T9. FR-20: T7, T9. FR-21: T7, T9. FR-22: T8, T9. FR-23: T4, T5, T6. FR-24: T6, T10.
- NFR-1: T4, T5. NFR-2: T9, T10. NFR-3: T8, T9, T10. NFR-4: T9. NFR-5: T3, T5, T8, T9.
- Tooling (not an FR): T1.
