# Tasks 007a — Universe editing

Status: approved

Spec: `specs/007a-universe-editing/spec.md`. Plan: `specs/007a-universe-editing/plan.md` (approved). Section numbers below refer to the plan.

## Test design

No spoiler impact (spec, "Spoiler impact"): the spoiler suite does not apply and no task carries a "Spoiler suite" line. The protection tests of this feature are the owner-isolation tests (marked "protected" below), as in spec 004. Levels are those of `docs/criticality-inventory.md`; test types follow the skill `quality-testing-core`; tests mirror `src/` in `tests/`. A task that changes a CORE or IMPORTANT component carries an `Evidence:` line, filled when the task is done. Tasks that only add browser tests change no production component and carry none.

| Component | Level (entry) | Behaviors to protect | Test type |
|---|---|---|---|
| `domain/universe-change.ts` (new) | IMPORTANT (UNI-1) | Same text, whitespace at the ends only and composition-only differences are no change; case, accent and inner-spacing differences are a change; the description none/text combinations. | Unit |
| `application/edit-universe.ts` (new) | CORE (UNI-3) | Valid edit stores trimmed texts with the clock's time and leaves id, owner, mode and creation time; every validation failure (limits by code point, null character, lone surrogate, trimming) reports its field and stores nothing; no real change answers success, writes nothing and keeps `updatedAt`; malformed, empty or missing identifier is a validation error; foreign, nonexistent, deleted and gone-on-write universes give the same not found error, also with values equal to the stored ones (protected); order of checks: identifier, ownership, fields, real change. | Unit with the fake and the same scenarios against PostgreSQL |
| `application/is-universe-name-in-use.ts` (edit) | CORE (UNI-3) | The excluded universe never counts (also for case, accents, spacing or composition changes); another own universe still counts; another account's names never count; a malformed or foreign excluded identifier excludes nothing and never throws; no parameter, same as before. | Unit, red then green |
| `domain/universe-repository.ts` (edit) | TIER 0 (UNI-6) | Type declaration, protected by the contract scenarios. | None |
| `infrastructure/prisma-universe-repository.ts` (edit) and the fake | CORE (UNI-4) | Only name, description and update time change; null for another owner's, nonexistent and deleted universes, changing nothing (protected); failures become `InfrastructureError`. | Integration through the contract, fake and PostgreSQL alike |
| `composition.ts`, `index.ts` | CORE (UNI-5) | Seven use cases offered; they run through the real wiring. | Existing composition test (changed list, reported) and the action tests |
| `app/universes/actions.ts` and its schemas | CORE (APP-2) | Real session and database: valid edit persists; forged owner, account, user and mode ignored and the mode unchanged (protected); cross-site refusal; no session, unverifiable session; validation keyed by field; identifier validation; identical not found for foreign, nonexistent and deleted universes, also with equal values (protected); two accounts never see each other's change (protected); name check with the excluded identifier. | Integration through the action (`database` project) |
| `workspace-state.tsx` (edit) | IMPORTANT (CMP-7) | Every transition of plan section 5 (start, close, selection, creation, forms of spec 006, view, entity). | Unit, red then green (the state-shape test changes, reported) |
| `universe-edit-state.ts`, `apply-edited-universe.ts`, `interpret-edit-universe-result.ts` (new) | IMPORTANT (CMP-3) | Lifecycle of one request scoped to one universe; merge by later `updatedAt`; each outcome of plan section 4. | Unit |
| `universe-edit-form.tsx` (new) | IMPORTANT (CMP-17, new entry) | Prefill, mode as text with its sentence, values kept after each failure, errors linked to fields, single submit, duplicate warning, late confirmation, no action after unmount. | Component (jsdom) |
| `use-universe-editing.ts`, `universes-provider.tsx`, `settle-action-call.ts` | IMPORTANT (CMP-4, floor 0, browser-protected) | Lifecycle glue; no visible behavior until the form is wired. | Existing tests green before and after; browser tests from T16 |
| `central-area.tsx`, `sidebar.tsx` | IMPORTANT (CMP-8, floor 0, browser-protected) | Form in the slot, view returns on save, button and its states, focus. | Browser (E2E) |
| `app-menu-bar.tsx` | TIER 0 (CMP-13) | Menu entries. | None of its own; browser test |
| `src/messages/en.ts` | TIER 0 (MSG-1) | - | None |
| Docs, `CLAUDE.md`, `data-model.md` | not production | - | None |

Test support (not classified): fake repository, contract scenarios, builders and e2e locators change in the tasks that need them.

## Tasks

- [x] **T1. Record the split of spec 007 into 007a and 007b in the documentation.** Completion criterion (documentation of the split)
  - Tests: none (docs only; no test gate).
  - Done when: `docs/roadmap.md` Phase 1 row, `docs/open-decisions.md` OD-6, `.claude/rules/data-model.md` (Universe and RememberedUniverse) and the "Current status" of `CLAUDE.md` name 007a (next) and 007b (trash, restore, purge) instead of the single 007; `prisma/schema.prisma` is untouched.

- [x] **T2. Add the domain rule that decides a real change of name and description.** FR-4, FR-7
  - Tests: `tests/modules/universes/domain/universe-change.test.ts`, first, per rule of the Definition "Real change".
  - Done when: the new tests pass and UNI-1 lists `universe-change.ts`.
  - Evidence: red then green: tests/modules/universes/domain/universe-change.test.ts > isRealUniverseChange (all 19 tests, for example "is no change when the name is the same text composed and decomposed", "is a change when the name differs in %s", "is a change when the description is replaced by only whitespace, which counts as none")

- [x] **T3. Add the owner-scoped storage update of name, description and update time.** FR-4, FR-9
  - Tests: new scenarios in `tests/support/contracts/universe-repository-contract.ts`, red first, run on the fake and on PostgreSQL; failure and deleted-row cases in `prisma-universe-repository.test.ts`.
  - Done when: the repository port, the fake and the Prisma repository pass the new scenarios (including "answers null for a universe of another owner, changing nothing"), the outdated "no update method" comment is fixed and UNI-4 and UNI-6 are current.
  - Evidence: red then green: tests/support/contracts/universe-repository-contract.ts > name and description update (7 scenarios, run on the fake by tests/modules/universes/application/fake-universe-storage.test.ts and on PostgreSQL by tests/modules/universes/infrastructure/prisma-universe-repository.test.ts, for example "answers null for a universe of another owner, changing nothing", "answers null for a universe that does not exist, changing nothing", "changes only the name, description and update time of an own universe and returns what a later read returns"); tests/modules/universes/infrastructure/prisma-universe-repository.test.ts > deleted universes > "are not updated, answering null and changing nothing", storage failures > "turn a refused update into an InfrastructureError that keeps the cause and changes nothing", "turn an update that cannot reach the database into an InfrastructureError that keeps the cause"

- [x] **T4. Add `editUniverse`: store a valid edit, report validation failures, and answer success without writing when nothing really changed.** FR-4, FR-6, FR-7
  - Tests: `tests/modules/universes/application/edit-universe.test.ts` (fake and PostgreSQL), red first; `composition.test.ts` list of use cases gains `editUniverse`.
  - Done when: the new tests pass, `editUniverse` is bound in the composition and exported as a type, and UNI-3 and UNI-5 are current.
  - Evidence: red then green: tests/modules/universes/application/edit-universe.test.ts > editUniverse (all 25 scenarios, run on the fake and on PostgreSQL, for example "stores the trimmed name and description with the time of the clock and returns the stored universe", "keeps the identifier, owner, mode and creation time, and the other universes", "clears the description for %j, which is a change stored with the time of the clock", "rejects a name %s on its field and stores nothing", "reports the failing name and description together in one error", "answers success with the stored universe for %s, writing nothing and keeping updatedAt", "turns a failing storage into the InfrastructureError it reports"); tests/modules/universes/composition.test.ts > "offers the seven use cases", "fails every use case that needs the database with the InfrastructureError"

- [x] **T5. Make `editUniverse` check the identifier and the ownership first, in the order of the spec.** FR-9, FR-11
  - Tests: protected scenarios in `edit-universe.test.ts`: same not found for foreign and nonexistent universes (also with equal values and invalid fields), validation error for a bad identifier, a universe gone before the write.
  - Done when: the order identifier, ownership, fields, real change holds and the protected scenarios pass; the UNI-3 protected-test list names them.
  - Evidence: red then green: tests/modules/universes/application/edit-universe.test.ts > editUniverse > identifier and ownership, checked before the fields > "rejects the identifier %j as a validation error on universeId, storing nothing" (4 cases), "rejects a missing identifier as a validation error on universeId, storing nothing", "reports a malformed identifier alone, before the failing fields", "gives the same not found error, never a validation error, for a universe of another account and for a nonexistent one with invalid fields" (all run on the fake and on PostgreSQL), "accepts the identifier of an own universe in upper case" (red on the fake storage; it already passed on PostgreSQL). The scenarios already green on the code of T4 are not named here (D-T5-1).

- [x] **T6. Let the duplicate-name check leave out one universe.** FR-8
  - Tests: new cases in `is-universe-name-in-use.test.ts` and an action case in `tests/app/universes/actions.test.ts`, red first.
  - Done when: the excluded universe never counts, another own universe still does, a malformed or foreign identifier excludes nothing, and the action schema accepts the optional identifier.
  - Evidence: red then green: tests/modules/universes/application/is-universe-name-in-use.test.ts > isUniverseNameInUse > leaving out one universe (spec 007a FR-8) > "never counts the excluded universe itself for its own name", "never counts the excluded universe itself when the name changes only in %s" (case, accents, spacing, composition), "leaves out the excluded universe when its identifier arrives in upper case" (all run on the fake and on PostgreSQL); tests/app/universes/actions.test.ts > with a valid session > "isUniverseNameInUseAction leaves out the excluded universe and still counts another own one (spec 007a FR-8)", "isUniverseNameInUseAction reports an excluded identifier that is not a string as a validation error on that field". The scenarios already green before the change (another own universe still counts, a malformed, foreign or nonexistent identifier excludes nothing, another account's names never count) are not named here (D-T5-1).

- [x] **T7. Add `editUniverseAction` with its input schema.** FR-9, FR-10, FR-11
  - Tests: new scenarios in `tests/app/universes/actions.test.ts` with a real session and database, red first, including the protected forged-input, same-not-found and two-account scenarios.
  - Done when: the new tests pass; APP-2 lists `edit-universe-input-schema.ts` and the protected tests.
  - Evidence: red then green: tests/app/universes/actions.test.ts > editUniverseAction (spec 007a) (all 15 scenarios: "stores the trimmed name and description of an own universe and answers it, keeping its id, owner, mode and creation time (FR-4)", "answers success with the stored universe for a save with no real change, leaving updatedAt as it was (FR-7)", "reports every failing field together, keyed by field, and changes nothing (FR-6)", "reports an input of the wrong shape as a validation error on each failing field and changes nothing", "rejects a %s identifier with the domain issue on universeId (FR-11)" (malformed, empty), "rejects a universeId that is %s as a shape failure on universeId (FR-11)" (missing, not a string), "gives the same not found answer for a universe of another account, a nonexistent one and a deleted one, also with values equal to the stored ones, and changes nothing (FR-9, FR-11)", "gives the same result with forged ownerId, userId, accountId and mode, and the stored owner and mode stay (FR-4, FR-9)", "changes nothing without a session, and invalid input does not turn the answer into a validation error (FR-10)", "changes nothing when the session cannot be checked, answering the infrastructure error (FR-10)", "rejects a request with %s, even for an own universe with a valid session, and changes nothing" (foreign Origin, Sec-Fetch-Site: cross-site), "answers the generic infrastructure result when the storage fails, changing nothing"); tests/app/universes/actions.test.ts > two accounts editing (spec 007a FR-9, NFR-2) > "never see each other's change, in their universes or in the name check"; tests/app/universes/actions.test.ts > without a session (FR-32) > "editUniverseAction answers the authentication error", when the session cannot be checked (FR-33) > "editUniverseAction answers the infrastructure error, not the authentication error, and runs nothing", when the request comes from another site > "every action rejects a request with %s, even with a valid session, and stores nothing" (both cases, now including the edit)

- [x] **T8. Add the "editing a universe" state to the workspace and its transitions.** FR-2, FR-3
  - Tests: new cases in `tests/components/workspace/workspace-state.test.ts`, red first; the state-shape test gains the new key (reported to the user).
  - Done when: every row of the transition table of plan section 5 passes; CMP-7 is current.
  - Evidence: red then green: tests/components/workspace/workspace-state.test.ts > reduceWorkspaceState: the universe edit form (spec 007a, FR-2, FR-3) > "starting the edit with a universe selected opens the form and keeps the selections and the view (FR-2)", "starting the edit closes the universe creation form (FR-3)", "starting the edit closes the open %s form and keeps the selected entity (FR-3)" (work, entity, relationship), "starting the edit with no universe selected is ignored, answering the same state", "starting the edit while the form is open answers the same state, so the typed values stay (FR-2)", "closing the edit form closes it and leaves everything else unchanged (FR-3)", "selecting another universe closes the edit form (FR-3)", "selecting the universe already selected closes the edit form and keeps the selection (FR-3)", "a created universe, also one confirmed late, closes the edit form and is selected (FR-3)", "starting a universe creation closes the edit form and opens the creation form (FR-3)", "opening a knowledge form closes the edit form and opens that form (FR-3)". The scenarios already green before the change (changing the view, selecting an entity, cancelling a creation or closing a knowledge form keep the edit form) and the state-shape test with its new key are not named here (D-T5-1).

- [x] **T9. Add the pure lifecycle of one edit request, scoped to one universe.** FR-12
  - Tests: `tests/components/universes/universe-edit-state.test.ts`, red first.
  - Done when: block, late, cap, on-time and late success, failure after release, own notice codes and events of another universe pass; CMP-3 lists the file.
  - Evidence: red then green: tests/components/universes/universe-edit-state.test.ts (all 34 tests, red because the module did not exist; against an inert stub that answered the same state, 21 failed, for example "a submission blocks the form of that universe only", "a failure releases the form and shows %s" (generic failure, sign-in again, not available, unknown result), "has one code per message, each different from the creation codes", "a late success replaces the message with the confirmation and releases the form", "the cap is five minutes", "an answer after the cap is a late success with the confirmation", "a submission for another universe replaces the state, even while the first one blocks its form", "the answer of the earlier universe's request never gives its message to the universe edited now", "clears a message left by an earlier form of the same universe", "opening the form of another universe starts it with no message and no block, while the earlier request is alive"; the 13 that assert an unchanged state or no message, such as "a request of another universe that %s changes nothing", "a failure after the cap leaves the state as it is" and "keeps the message while a request of the same universe still blocks the form", passed on that stub (D-T5-1)).

- [x] **T10. Add the merge of an edited universe into the list by the later update time.** FR-5, FR-12
  - Tests: `tests/components/universes/apply-edited-universe.test.ts`, red first.
  - Done when: replace, keep position, later entry kept, either order of two answers, unknown identifier ignored pass; CMP-3 lists the file.
  - Evidence: red then green: tests/components/universes/apply-edited-universe.test.ts (all 8 tests, red because the module did not exist; against an inert stub that answered the list unchanged, 5 failed: "replaces the entry with the same identifier by the edited universe (FR-5)", "keeps the position of the edited universe and leaves the other universes untouched (FR-5)", "applies an answer with the same update time as the listed entry, as a save with no real change answers", "ends with the later update time when the %s of two answers arrives first (FR-12)" (earlier, later); against a stub that always replaced, "keeps a listed entry with a later update time instead of an older answer (FR-12)" and the case "later" of the two answers failed; "ignores an edited universe whose identifier is not in the list" and "does not change the list it was given" passed on both stubs (D-T5-1)).

- [ ] **T11. Add the interpreter of the answers of an edit.** FR-6, FR-10, FR-11
  - Tests: `tests/components/universes/interpret-edit-universe-result.test.ts`, red first; the existing interpreter test stays green.
  - Done when: every row of the table of plan section 4 passes and CMP-3 lists the file.
  - Evidence: <filled when the task is done>

- [ ] **T12. Add the edit texts and the menu and navigation labels to the dictionary.** FR-1, FR-2, FR-12
  - Tests: none (TIER 0).
  - Done when: `universeEdit`, `sidebar.editUniverse` and `menus.universe.editUniverse` exist, `menus.universe.items` is `["Move to trash"]` and `pnpm typecheck` passes.

- [ ] **T13. Move `settleActionCall` to its own file.** FR-12
  - Tests: none new; the existing unit, component and browser tests of the universes and knowledge providers stay green.
  - Done when: `universes-provider.tsx` and `knowledge-provider.tsx` import it from `settle-action-call.ts`, nothing else changes and the full verification gate is green.
  - Evidence: <filled when the task is done>

- [ ] **T14. Add the edit lifecycle to the universes provider.** FR-5, FR-10, FR-12
  - Tests: none new (no visible behavior until T16; its pure parts are tested in T9 to T11); existing tests stay green.
  - Done when: the provider offers the edit operation, its notice and block, the entry-point availability and the focus return, wired to the pieces of T9 to T11, and the full verification gate is green; CMP-4 is current.
  - Evidence: <filled when the task is done>

- [ ] **T15. Add the edit form.** FR-2, FR-6, FR-8
  - Tests: `tests/components/universes/universe-edit-form.test.tsx` (jsdom, hook mocked), red first.
  - Done when: the component tests pass, CMP-17 exists in the inventory and `pnpm test:coverage` shows its figure (a floor with its plan if it is under 80 %).
  - Evidence: <filled when the task is done>

- [ ] **T16. Open the edit form from the Universe menu, save, and find the change after a reload.** FR-1, FR-2, FR-5
  - Tests: first browser tests in `tests/e2e/universe-editing.spec.ts`: edit from the menu and reload, the prefilled form with fixed mode and sentence, Cancel and on-time save return the focus to the menu trigger, the menu entries (enabled "Edit universe", no "Switch mode", disabled "Move to trash"), and the entry unavailable with no universe selected.
  - Done when: the browser tests pass (`pnpm test:e2e`), the central area shows the form under the view switcher and returns to the current view on save, and CMP-8, CMP-13 and the support locators are current.
  - Evidence: <filled when the task is done>

- [ ] **T17. Open the edit form from the navigation header button, also at a narrow width.** FR-1, NFR-3
  - Tests: browser tests in `universe-editing.spec.ts`: edit from the button and reload, at 320 px with a 120-character name and a 2000-character description with no horizontal scroll, keyboard only, focus ends on the main content after the drawer closes, and the button unavailable with no universe selected.
  - Done when: the browser tests pass and the sidebar header shows the button next to "New universe".
  - Evidence: <filled when the task is done>

- [ ] **T18. Verify when the edit form stays open and when it closes.** FR-3
  - Tests: browser tests in `universe-editing.spec.ts`: stays open with the typed values on a view change and on selecting a work or an entity; closes with the values discarded on selecting any universe (also the same), opening a form of spec 006 and starting a creation; "Edit universe" over an open form closes it; activating it again keeps the typed values; a late creation success closes it.
  - Done when: the browser tests pass.

- [ ] **T19. Verify validation, saving with no real change and the duplicate-name warning in the browser.** FR-6, FR-7, FR-8
  - Tests: browser tests in `universe-editing.spec.ts`: validation failure keeps the values with linked errors; save with nothing changed, with only different end whitespace and clearing the description; the warning on opening, never for the universe itself or a case-only change, for another own universe, not for another account's name, and never blocking.
  - Done when: the browser tests pass.

- [ ] **T20. Verify the lifecycle of a save that is repeated, fails, gets no answer or answers late.** FR-12
  - Tests: browser tests in `tests/e2e/universe-editing-failures.spec.ts`: single submission on double click and repeated Enter, generic failure, unknown result, late success with the form open (visible confirmation, typed values kept, no return to the view, no focus move) and with the form left (silent), another universe selected while saving, two answers in reverse order.
  - Done when: the browser tests pass.

- [ ] **T21. Verify the expired session and the unavailable universe in the browser.** FR-10, FR-11
  - Tests: browser tests in `universe-editing-failures.spec.ts`: expired session (also a save with no real change) shows the sign-in message with values kept and the form closed after signing in again; the universe deleted meanwhile shows the not-available message with the form open and the navigation unchanged.
  - Done when: the browser tests pass.

- [ ] **T22. Verify in the browser that two accounts never touch each other's universes.** FR-9, NFR-2
  - Tests: browser tests in `tests/e2e/universe-editing-isolation.spec.ts`: two accounts never see each other's change; a replayed action for another account's universe answers not found and changes nothing, also with equal values; forged owner and mode are ignored.
  - Done when: the browser tests pass.
