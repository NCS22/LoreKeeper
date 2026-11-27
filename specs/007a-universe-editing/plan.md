# Plan 007a — Universe editing

Status: approved

Spec: `specs/007a-universe-editing/spec.md` (approved 2026-11-27, 12 FR, 4 NFR, no open questions). "004 FR-x" and "006 FR-x" refer to the specs of the same names.

## 0. Approach in one paragraph

One new use case, `editUniverse`, in the `universes` module, reached through one new Server Action. It checks in the order of FR-9 (session in the action, then identifier, ownership, fields, real change), writes nothing when the text has no real change and otherwise replaces name, description and last-update time of the own universe in one conditional statement. The duplicate-name check that already exists gets an optional "except this universe" parameter, so the same rule serves the creation and the edit. On the screen, the edit form is a sibling of the creation form: the workspace state gets one flag, the universes provider gets an edit lifecycle (its own small pure reducer, scoped to one universe, plus a merge by the later last-update time), the central area shows the form in the slot of the forms, and two entry points (Universe menu, navigation header button) open it. No schema change, no migration, no dependency, no new module, layer or folder. Nothing of spec 007b is planned (no `UnitOfWork`, no trash).

## Inputs already decided (not new decisions)

- Spec 004 plan: the single-submission, unknown-result, late-answer and account-change lifecycle (D-numbers of that plan), the 30-second limit and 5-minute cap, the 250 ms name-check pause (D10), `parseUniverseId`, the one `UniverseNotFoundError`, text rules, plain-text rendering of names (D11), the Server Action order (same-site check, acting user, then input; D2).
- Spec 006 FR-12: an answer for a universe that is no longer selected never changes the selection and never shows a message.
- The data model: `Universe.updatedAt` exists and a universe's mode never changes (`data-model.md`, Universe).
- Spec 007a, "Where editing is offered" (user decision 2026-11-27): Universe menu plus the header of the universe navigation.

## 1. Affected modules and layers

No new module, layer or top-level folder. Everything below lives in existing folders.

| Layer | File | Change | FR / NFR |
|---|---|---|---|
| Domain (`src/modules/universes/domain/`) | `universe-change.ts` (new) | `isRealUniverseChange(storedUniverse, validatedName, validatedDescription)`: pure rule of the Definition "Real change". Both texts are compared in their Unicode composed form (NFC), the description as "none" when empty. Case, accents and inner spacing differences are real changes; whitespace at the ends (already removed by the validators) and composition are not. | 4, 7 |
| Domain | `universe-repository.ts` (edit) | Adds `updateNameAndDescription(ownerId, universeId, change)` where `change = { name, description, updatedAt }`. It matches id, owner and not deleted in one statement and returns the updated `Universe`, or `null` when the universe is not an own, not deleted one. It cannot write the mode, the owner or the creation time. The comment "deliberately no update or delete method (spec 005)" is rewritten: update of name and description exists (spec 007a), delete is still absent (007b). | 4, 9, 11 |
| Application (`.../application/`) | `edit-universe.ts` (new) | The use case, section 3. | 4, 6, 7, 9, 11 |
| Application | `is-universe-name-in-use.ts` (edit) | Optional fourth input `excludedUniverseId`: the universe with that identifier is left out of the comparison. A malformed value excludes nothing and never throws (the use case never throws for bad input). | 8 |
| Infrastructure (`.../infrastructure/`) | `prisma-universe-repository.ts` (edit) | Implements `updateNameAndDescription` as one conditional write (`id`, `ownerId`, `deletedAt: null`) that returns the stored row, mapped by the existing mapper; failures go through `runUniverseStorageOperation` (generic `InfrastructureError`). | 4, 9 |
| Composition and public interface | `composition.ts`, `index.ts` (edit) | `editUniverse(actor, command)` bound with `universeRepository` and `getCurrentTime`; `isUniverseNameInUse` gets the optional identifier; `index.ts` exports the `EditUniverseCommand` type. | NFR-1 |
| Presentation, actions (`src/app/universes/`) | `actions.ts` (edit), `edit-universe-input-schema.ts` (new), `is-universe-name-in-use-input-schema.ts` (edit) | `editUniverseAction`; the name-check schema gets the optional identifier. | 9, 10, 11 |
| Presentation, workspace state | `src/components/workspace/workspace-state.tsx` (edit) | `isEditingUniverse` flag and two actions (section 5). | 2, 3 |
| Presentation, universes | `universe-edit-state.ts`, `apply-edited-universe.ts`, `interpret-edit-universe-result.ts`, `settle-action-call.ts` (new); `use-universe-editing.ts` (new hook); `universe-edit-form.tsx` (new); `universes-provider.tsx`, `interpret-universe-action-result.ts` (edit) | Section 5. `settleActionCall` moves to its own file (no behavior change) so the new hook and the provider do not import each other; its two importers, `universes-provider.tsx` and `knowledge-provider.tsx`, are updated. `interpret-universe-action-result.ts` only exports two helpers it already has (the field-error reader and the universe-shape check). | 2 to 12 |
| Presentation, entry points and area | `central-area.tsx`, `sidebar.tsx`, `app-menu-bar.tsx` (edit) | The form is shown in the central area; the navigation header gets its "Edit universe" button; the menu gets its enabled entry and loses "Switch mode". | 1, 2, 3, 5 |
| Presentation, messages | `src/messages/en.ts` (edit) | `universeEdit` texts, `sidebar.editUniverse`, `menus.universe.editUniverse`; `menus.universe.items` becomes `["Move to trash"]`. | 1, 2, 5, 10 to 12 |
| Docs | `docs/roadmap.md`, `docs/open-decisions.md` (OD-6), `.claude/rules/data-model.md`, `CLAUDE.md` | Record the split 007 -> 007a + 007b; see "Documentation" below. | Completion criteria |
| Inventory | `docs/criticality-inventory.md` | Entries updated in the task that adds each file; see section 7. | Skill, section 9 |

Dependency direction holds: the screen imports only `@/modules/universes` and the action file; the use case depends on the repository interface; the Prisma repository implements it.

## 2. Data

- No change to `prisma/schema.prisma` and no migration. `name`, `description` and `updatedAt` already exist; the `CHECK` constraints on the lengths already protect the update; `updatedAt` is written explicitly (a given value wins over the `@updatedAt` default), so the stored time is the one the use case returned.
- The stale schema comment "written by the trash of spec 005" is not touched: changing the schema file, even a comment, is a schema change that needs approval, and the trash is written by 007b, which will correct it when it touches the schema.
- No JSONB attribute is involved. No new identifier is generated.
- The remembered universe is not read or written by an edit (FR-5).
- Data model prose (documentation, not schema): the `Universe` row says `deletedAt` is "written by the trash of spec 007" and `RememberedUniverse` says "the lifecycle of spec 007 decides"; both become "spec 007b" (Documentation).

## 3. Use cases

All take the acting user as a separate first-after-dependencies parameter, never inside the command (`architecture.md`, section 3).

**`editUniverse(dependencies, actor, command)`** in `edit-universe.ts`.

- Dependencies: `universeRepository`, `getCurrentTime`.
- Command: `{ universeId: string, name: string, description: string | null }`. There is no mode, owner or any other field: the type cannot carry them and the action's schema drops them (FR-4, FR-9).
- Returns the `UniverseDto` (the same one creation returns), with the new `updatedAt` or, for no real change, the stored one.
- Steps, stopping at the first failure (FR-9). The session is checked before the use case, in the action.
  1. `parseUniverseId(command.universeId)` -> `ValidationError` with the `universeId` issue (malformed, empty, missing; FR-11).
  2. `findOwnedById(actor.userId, universeId)` -> `null` throws `UniverseNotFoundError` (foreign, deleted and nonexistent look the same; FR-9, FR-11).
  3. `validateUniverseName` and `validateUniverseDescription`, every failing field reported in one `ValidationError`, nothing written (FR-6).
  4. `isRealUniverseChange(stored, name, description)`: when false, return the DTO of the stored universe, write nothing, `updatedAt` unchanged (FR-7).
  5. `updateNameAndDescription(actor.userId, universeId, { name, description, updatedAt: getCurrentTime() })`; a `null` answer (the universe was deleted or changed owner between the read and the write) throws `UniverseNotFoundError`. Returns the DTO of the updated universe (FR-4).
- Errors: `ValidationError`, `UniverseNotFoundError` (a `NotFoundError`), `InfrastructureError` (from the repository). No `UnitOfWork`: one row, one statement.

**`isUniverseNameInUse(dependencies, actor, name, excludedUniverseId?)`** (edit). Parses the optional identifier with `parseUniverseId`; compares the comparable name with every own universe except that one. An identifier of another account excludes nothing among the own universes, so the answer reveals nothing about it (FR-8).

Nothing else changes: `createUniverse`, `findOwnUniverse`, `rememberUniverse`, `loadWorkspaceUniverses` and the knowledge module are not touched.

## 4. Contracts

### Server Actions (`src/app/universes/actions.ts`)

Same shape as `createUniverseAction`: `runAction`, `assertSameSiteRequest`, then `getActingUser`, then `parseActionInput`, then the use case (spec 004 D2).

| Action | Input schema (Zod, shape only) | Response |
|---|---|---|
| `editUniverseAction(input: unknown)` (new) | `edit-universe-input-schema.ts`: `z.object({ universeId: z.string(), name: z.string(), description: z.string().nullable() })`. Unknown keys (mode, owner, account, user) are dropped without error (FR-4, FR-9). | `{ ok: true, value: { universe: UniverseDto } }`, or `{ ok: false, error }` from the shared mapper: validation (400, `fieldErrors` keyed by field), authentication (401), not found (404, one fixed message), infrastructure failure (500, generic message). |
| `isUniverseNameInUseAction(input)` (edit) | adds `excludedUniverseId: z.string().optional()`. | unchanged: `{ isInUse }`. |

The business rules (limits, trimming, real change, order after the session) stay in the use case; the schema only fixes the shape, so a rule failure on a foreign universe is a not found, never a validation error (FR-9). A missing identifier is a shape failure and is a validation error (FR-11). No log line is added for a refused identifier (the spec asks for none; the mapper already logs infrastructure failures).

### What the screen does with each answer (pure, `interpret-edit-universe-result.ts`)

Reuses `classifyEnd` and the existing readers of `interpret-universe-action-result.ts`, which is not changed in behavior. The knowledge interpreters are not touched: the not found answer is read here, before `classifyEnd`, so the shared kinds do not grow.

| End of the call | Outcome | What the screen does |
|---|---|---|
| Success with a well-formed universe | `saved` | Merges the universe into the list (section 5); closes the form when it arrived on time, and keeps it open with a confirmation when it arrived late (FR-5, FR-12). |
| Validation failure | `field-errors` (messages for name and description) | Keeps the form and the typed values, message under each field, focus on the first invalid one (FR-6). A failure with no field of the form is a `generic-failure`. |
| Authentication error, or the signed-out refusal | `sign-in-again` | Message with a sign-in link; values kept (FR-10). |
| Unverifiable session refusal, any other answer or error code, malformed answer | `generic-failure` | Failure message; nothing stored; values kept (FR-10, FR-12). |
| Not found | `not-available` | Message that the universe is not available, without saying why; form open, values kept, selection and navigation unchanged (FR-11). |
| No answer in 30 seconds, or an unrecognised rejection | `result-unknown` | Unknown-result message ("may have been changed"); the request stays alive (FR-12). |

## 5. UI

### Routes and rendering

No new route or page. The workspace at `/` stays a Server Component that hands the universes and the form vocabulary to the client providers; the edit form is a client component under `UniversesProvider`. `buildUniverseFormVocabulary` is not changed: the edit form needs only the field names and issue codes it already carries, and the mode text comes from the dictionary.

### Workspace state (`workspace-state.tsx`)

- New field `isEditingUniverse: boolean`, new actions `universeEditingStarted` and `universeEditingClosed`.
- The edited universe is always the selected one, because every way of changing the selection closes the form (below). So the form needs no stored identifier.
- Transitions (FR-2, FR-3):

| Action | Effect on `isEditingUniverse` |
|---|---|
| `universeEditingStarted` | `true` when a universe is selected, otherwise ignored; closes the universe creation form and the open knowledge form (typed values discarded); already open: the same state, so the form is not remounted and the typed values stay |
| `universeEditingClosed` | `false` |
| `universeSelected` (also the same universe), `universeCreated` (late creation included) | `false` |
| `universeCreationStarted`, `knowledgeFormOpened` | `false` |
| `viewChanged`, `entitySelected`, a work selected | unchanged |
| `universeCreationCancelled`, `knowledgeFormClosed` | unchanged |

### Edit state of one request (`universe-edit-state.ts`, pure reducer)

A sibling of `universe-creation-state.ts`, with its own notice codes (`EDIT_FAILED`, `EDIT_RESULT_UNKNOWN`, `EDIT_CONFIRMED_AFTER_DELAY`, `EDIT_SIGN_IN_AGAIN`, `EDIT_NOT_AVAILABLE`), different from the creation ones (FR-12: the failure and the unknown-result messages differ in text and code). It carries the same block, the same 30-second late event and the same 5-minute cap, and the success rule: a success is plain when the person was still waiting for a normal answer, and late (confirmation code) when the unknown-result message was shown or the request was already released.

Difference from creation: the state belongs to **one universe**. Its events carry the universe identifier; a request for another universe than the one in the state never changes a message, and a submission for another universe replaces the state. A universe selected meanwhile therefore never receives the message of an earlier universe's request (spec 006 FR-12), while that earlier answer still reaches the navigation entry (below). A `formOpened` event clears an old message unless a request of that universe still blocks the form.

### Merge of an answer into the list (`apply-edited-universe.ts`, pure)

`applyEditedUniverse(universes, editedUniverse)`: replaces the entry with the same identifier unless the entry already in the list has a strictly later `updatedAt`; never reorders (position stays the creation order, FR-5); an unknown identifier is ignored. Two answers in any order leave the data with the later last-update time (FR-12). A no-change answer carries the stored time, so it can never overwrite a newer entry.

### The edit lifecycle hook (`use-universe-editing.ts`) and the provider

`UniversesProvider` calls `useUniverseEditing({ confirmAccountBeforeSending, signInAddress, vocabulary, setUniverses })` and adds its results to the context, so the provider file does not grow by the whole lifecycle. The hook:

- `canEditSelectedUniverse`: a universe is selected and is in the list; both entry points use it (FR-1).
- `editUniverse(command)`: ignores a call while a request of the edited universe blocks the form (single submission, run through a ref so a double click or repeated Enter sees the block at once, as the creation does); asks `confirmAccountBeforeSending` first (a changed account leaves the page and sends nothing, 004 FR-18); calls `editUniverseAction`; settles with `runWithTimeLimit` (30 s) without ever rejecting; interprets the result; on `saved` merges the universe into the list **always, whichever universe is selected now**, reports the outcome with `arrivedLate`; on a failure sets the notice and returns the outcome only when the request was the one blocking the form, as the creation does. An answer for a universe other than the selected one changes no selection and no message.
- `editNoticeCode` and `isEditBlocked`, already filtered to the selected universe; `dismissEditNotice`; `startUniverseEditing(openerElement)` (dispatches `universeEditingStarted`, sends `formOpened`, remembers the opener) and `returnFocusAfterEditing()`.
- Reads `isUniverseNameInUse(name, excludedUniverseId)` through the provider's existing function, which gets the optional second argument.

### Components

| Component | Kind | Role |
|---|---|---|
| `universe-edit-form.tsx` (new) | Client | Title "Edit universe"; name and description fields prefilled from the selected universe **once, when the form mounts** (a late update of the list never overwrites what the person typed); the mode as plain text with the same label the creation form uses and the same fixed sentence ("The mode cannot be changed after the universe is created"), not a choice; Save and Cancel. Same layout, labels, error linking (`aria-invalid`, `aria-describedby`), `role="alert"` message that takes focus when it appears, `aria-busy`, polite live region for the duplicate warning (always in the accessibility tree, collapsed when empty) as the creation form. Name field focused when it opens. The duplicate-name check runs after the same 250 ms pause, also for the prefilled name, so the warning appears right after the form opens (a person-scale delay; D9); it asks with `excludedUniverseId` set to the edited universe. The warning never blocks saving. The sign-in link, the failure, the unknown-result and the not-available messages are shown inside the form; the late confirmation replaces the unknown-result message inside the form (visible `role="status"`, with a Dismiss button, as creation's) while the form stays open with what was typed. The form acts on an answer only while it is still mounted, so a form that was cancelled and opened again is never closed by an old answer. |
| `central-area.tsx` (edit) | Client | In the slot of the forms, under the view switcher, shows the edit form when `isEditingUniverse` and a universe is selected (the other forms are already exclusive in the state). On an on-time save it closes the form (the current view returns, since the view is not touched), puts "Universe saved: <name>" in its polite live region (the one the knowledge announcements use, renamed `workspaceAnnouncement` inside this file, still kept with its universe so it is never read in another one) and returns the focus. On Cancel it closes and returns the focus. It shows no visible notice on an on-time success (FR-5). |
| `sidebar.tsx` (edit) | Client | Next to the "+" button, a "Edit universe" icon button (pencil), unavailable (`disabled`, announced as unavailable) while `canEditSelectedUniverse` is false. It opens the form and closes the drawer on narrow screens, like the creation button. The collapsed rail, which has no creation button either, has none; the button is there at every width at which the navigation is open (FR-1). |
| `app-menu-bar.tsx` (edit) | Client | Universe menu: "New universe", separator, enabled "Edit universe" (disabled placeholder style while `canEditSelectedUniverse` is false), then the disabled "Move to trash". "Rename universe" and "Switch mode" are gone. Like "New universe", an activation that opens the form skips the return of focus to the trigger so the form keeps its name field; if the form was already open the focus goes back to the trigger as usual (never to the body). |

Notices and texts live in `en.ts` under `universeEdit` (title, labels reused from `universeCreation` where the text is the same, Save, Cancel, the five notices, "Universe saved: <name>" announcement, an edit-specific duplicate warning: "A universe with this name already exists. You can still save this one.", because the creation text says "create"). The mode label and the immutable sentence are the creation ones (`universeCreation.modes[...]`, `universeCreation.modeImmutableNote`), not copied.

### Focus (NFR-3)

The element that opened the form is remembered when it opens: the Universe menu trigger (menu entry) or the header button (navigation). When the form closes by Cancel or by an on-time success, `returnFocusAfterEditing()` waits for the re-render and tries that element; if it is not shown or not focusable (the drawer of a narrow screen closed after the choice, the menu bar hidden below the md width) it focuses the main content (`#main-content`, already focusable). Focus is never left on the body. When the form closes because of another action (a universe selected, a form opened), that action owns the focus.

### States and accessibility

- Loading: Save disabled and `aria-busy` while a request blocks the form; no spinner (as creation).
- Empty: no universe selected: both entry points unavailable, the form cannot open (reducer guard and `canEditSelectedUniverse`).
- Error: field errors linked to their fields, notices as `role="alert"` with focus; a late confirmation as `role="status"`.
- Everything reachable by keyboard, visible labels, existing tokens (contrast already tested by `tokens-contrast.test.ts`), 320 px: the form is the creation form's layout (`max-w-xl`, wrapped text, no horizontal scroll); the header gets one more icon button (checked in the browser at 320 px with 120 and 2000 characters).
- Names and descriptions are rendered as plain text (`UniverseNameText`, 004 FR-19); the sidebar and the heading re-render from the list, so the new text shows everywhere at once (FR-5).

## 6. Spoiler impact

None. The name and the description of a universe carry no spoiler boundary; no work, unit, reading progress or boundary is read or written; the mode is shown, never changed; behaviour is the same in `READER` and `AUTHOR`. The spoiler suite is not applicable (it starts in Phase 4; the temporary exception of `CLAUDE.md` concerns the reads of spec 006, which this spec does not touch). The account-isolation tests of section 7 are the protection tests. Every read and write goes through the owner-scoped repository methods; no read path of narrative information is added.

## 7. Test design

Levels from `docs/criticality-inventory.md`; test types from the skill `quality-testing-core`, section 4. A change that alters behavior of a CORE or IMPORTANT component is test-first (red then green); new files are red-then-green. TIER 0 gets none. Tests mirror `src/` in `tests/`.

### Components, level and what to protect

| Component | Entry, level | Behaviors to protect | Test type and file |
|---|---|---|---|
| `domain/universe-change.ts` (new) | UNI-1, IMPORTANT | Same text is no change; whitespace at the ends only is no change; the same text composed and decomposed is no change; a difference in case, accent or inner spacing is a change; the description: none vs none, none vs text, text vs none, text vs whitespace-only (none), text vs different text. | Unit, per rule: `tests/modules/universes/domain/universe-change.test.ts` |
| `application/edit-universe.ts` (new) | UNI-3, CORE | Valid edit stores trimmed name and description and sets the update time from the clock; id, owner, mode and creation time unchanged; clearing the description is a change; every validation failure (empty and whitespace name, 121 name, 2001 description, null character, lone surrogate; 120 and 2000 accepted; trimming before measuring; code points) reports the field and stores nothing, several fields together; a malformed, empty or missing identifier is a validation error; the order of checks (session aside): malformed id before ownership, ownership before fields (a foreign or nonexistent universe with invalid fields is not found, not a validation error), fields before real change; no real change answers success with the stored data and writes nothing, the timestamp unchanged (also whitespace-only and composition-only differences); a write that finds the universe gone is not found; a storage failure is an infrastructure error; the actor is the owner, a command cannot name another. **Protected owner-isolation tests (join the UNI-3 list):** "gives the same not found error for a universe of another account and for a nonexistent one, storing nothing" and the same when the values equal the stored ones; "never changes a universe of another account". | Unit with the fake and the same scenarios against PostgreSQL (`universeStorageFactories`, like `create-universe.test.ts`): `tests/modules/universes/application/edit-universe.test.ts` |
| `application/is-universe-name-in-use.ts` (edit) | UNI-3, CORE | Excluding a universe: the universe itself never counts, also when the name differs only in case, accents, spacing or composition; another own universe with the same comparable name still counts; a name only in another account never counts; a malformed or foreign excluded identifier excludes nothing and never throws; without the parameter, behavior as before. | Unit, red then green: `tests/modules/universes/application/is-universe-name-in-use.test.ts` (new cases) |
| `domain/universe-repository.ts` (edit) | UNI-6, TIER 0 | Type declaration; protected by the contract scenarios below. | None |
| `infrastructure/prisma-universe-repository.ts` (edit) | UNI-4, CORE | Changes only name, description and update time; id, owner, mode, creation time, other universes and the relationship types are unchanged; null for another owner's, a nonexistent and a deleted universe, writing nothing; a storage failure becomes `InfrastructureError`; the result equals what a later read returns. **Protected:** "answers null for a universe of another owner, changing nothing". | Integration against the test database through the shared contract (fake and PostgreSQL alike): `tests/support/contracts/universe-repository-contract.ts` (new scenarios), run by the existing `prisma-universe-repository.test.ts` (deleted row and failure by direct database access) and the fake's test |
| `composition.ts`, `index.ts` | UNI-5, CORE | The module offers the seventh use case; the use cases run through the real wiring. | The existing `composition.test.ts` (its list of use cases and the "fails every use case that needs the database" scenario gain `editUniverse`; this is a change to an existing test, reported to the user) and the action tests |
| `src/app/universes/actions.ts`, `edit-universe-input-schema.ts`, `is-universe-name-in-use-input-schema.ts` | APP-2, CORE | Valid edit through a real session and the database persists and answers the universe; the same result with forged `ownerId`, `userId`, `accountId` and `mode` in the input, the stored mode unchanged (**protected**); cross-site request refused; no session -> authentication error, nothing read or changed, and no validation detail leaks; unverifiable session -> infrastructure failure; validation failures keyed by field; malformed, empty and missing identifier -> validation; another account's, nonexistent and deleted universe -> the identical not found answer (same kind, code, message and shape), also with values equal to the stored ones, and nothing changed (**protected**); a no-change save answers success and leaves `updatedAt` as it was; two accounts never see each other's change (**protected**); the name check with `excludedUniverseId` ignores that universe. | Integration through the action in the `database` project: `tests/app/universes/actions.test.ts` (new scenarios) |
| `workspace-state.tsx` (edit) | CMP-7, IMPORTANT | Every row of the transition table in section 5. | Unit, red then green: `tests/components/workspace/workspace-state.test.ts` (new cases; the existing test "holds only the selected universe, the view, ..." lists the keys of the state and must gain `isEditingUniverse`: a change to an existing test, reported to the user) |
| `universe-edit-state.ts` (new) | CMP-3, IMPORTANT | The lifecycle: submission blocks; a second submission while blocked is ignored; late event shows the unknown-result code; the cap releases; on-time success clears; late success (after the unknown-result message or after release) gives the confirmation code; a failure after release changes nothing; each failure notice code; events of another universe never change a message; a submission for another universe replaces the state; opening the form clears a stale message unless the same universe is blocked. | Unit: `tests/components/universes/universe-edit-state.test.ts` |
| `apply-edited-universe.ts` (new) | CMP-3, IMPORTANT | Replaces the entry; keeps the position; a later entry is not overwritten by an older answer; either order of two answers ends with the later `updatedAt`; an equal stamp is applied; an unknown identifier is ignored; the other universes are untouched. | Unit: `tests/components/universes/apply-edited-universe.test.ts` |
| `interpret-edit-universe-result.ts` (new) and the two exports in `interpret-universe-action-result.ts` | CMP-3, IMPORTANT | Each row of the table in section 4: success, malformed success, field errors (name, description, none of them), authentication and signed-out refusal, unverifiable-session refusal, not found with its code, another error, timed out, rejected. | Unit: `tests/components/universes/interpret-edit-universe-result.test.ts`; the existing interpreter test stays green |
| `universe-edit-form.tsx` (new) | CMP-17 (new entry), IMPORTANT | Prefilled name and description; the mode as text (not a control) with the creation label and the fixed sentence; Save and Cancel; the typed values stay after a field error, a failure, an unknown result and the not-available message; field errors linked to their fields and focus on the first invalid one; a double submit sends once; the duplicate warning appears for an answer about the current name and never blocks saving; the late confirmation replaces the unknown-result message and keeps the typed values; an old answer does nothing after the form was unmounted. | Component (jsdom), with the provider's hook mocked: `tests/components/universes/universe-edit-form.test.tsx`. If the entry stays under 80 % it records a floor with its plan (skill, section 3) |
| `use-universe-editing.ts`, `universes-provider.tsx`, `settle-action-call.ts` | CMP-4, IMPORTANT (floor 0, protected by browser tests) | Single submission, unknown result, late success, answers in reverse order, an answer after another universe was selected, account change, the entry points' availability. The file move of `settleActionCall` keeps behavior: the existing tests stay green before and after. | Browser tests below; no component test of the provider (its pure parts are in CMP-3). Behavior-keeping move: green before and after |
| `central-area.tsx`, `sidebar.tsx` | CMP-8, IMPORTANT (floor 0, protected by browser tests) | The form in the slot under the view switcher; the view returns on save; the header button, its unavailable state and the narrow-width drawer; the focus after Cancel and after an on-time save. | Browser tests below (E2E) |
| `app-menu-bar.tsx` | CMP-13, TIER 0 | The menu entries (enabled "Edit universe", no "Switch mode", disabled "Move to trash"). It still holds no logic of its own beyond one disabled state taken from the provider and the focus skip already confirmed TIER 0 (D-V-2); if the implementer finds more logic it is reclassified before any decision about its tests. | None of its own; covered by the browser test of the menu |
| `src/messages/en.ts` | MSG-1, TIER 0 | - | None |
| `docs/*`, `CLAUDE.md`, `.claude/rules/data-model.md` | not production | - | None |

Test support (not classified): `fake-universe-repository.ts` gets `updateNameAndDescription` (it must pass the contract); `universe-repository-contract.ts` and `universe-repository-factories.ts` gain the scenarios and builders; `tests/e2e/support/universe-workspace-support.ts` gets locators for the edit form, its button and the menu entry.

### Playwright (`tests/e2e/`, production build, same servers and database helpers as the universes specs)

Three files, in the style of `universes.spec.ts`, `universes-failures.spec.ts` and `universes-isolation.spec.ts` (NFR-4):

- `universe-editing.spec.ts`: edit name and description from the menu and find them after a reload and after signing out and in, the universe keeping identifier, mode, creation date and position; the same from the navigation button at a narrow width (the drawer closes, focus ends on the main content); the prefilled form with the mode as fixed text and its sentence (no radio); Cancel returns the focus to the menu trigger and to the navigation button; the form stays open with the typed values when the view is changed or a work or an entity is selected and closes with them discarded when another universe (also the same) is selected, a form of spec 006 is opened or a creation is started; "Edit universe" over an open knowledge form or creation form closes it; save with nothing changed closes the form and keeps `updatedAt`; clearing the description; a validation failure keeps the values and links the error; the duplicate-name warning (shown after opening, ignored for the universe itself and for a case-only change, shown for another own universe, not for a name that exists only in another account) never blocks saving; both entry points unavailable with no universe selected; the menu with its entries; 320 px with 120 and 2000 characters, no horizontal scroll; keyboard-only use.
- `universe-editing-failures.spec.ts`: single submission on double click and repeated Enter; generic failure and unknown result keep the values; a late success shows the visible confirmation while the form is open, keeps what was typed meanwhile and does not move the focus or return to the view, and shows nothing when the form was left; selecting another universe while a save waits updates the entry silently; two submissions answered in reverse order keep the later data; expired session (also for a save with no real change) shows the sign-in message with values kept and the form is closed after signing in again; the not-available message when the universe was deleted in the database meanwhile, with the form open and the navigation unchanged. (Techniques as in `universes-failures.spec.ts`; no simulated clock beyond what that file already does.)
- `universe-editing-isolation.spec.ts`: two accounts that never see each other's change; a direct call (replayed Server Action, as `universes-isolation.spec.ts`) for another account's universe gives the not found answer and changes nothing, also with equal values; forged owner and mode are ignored.

### Manual checks by the user (completion criteria)

Screen reader and keyboard pass over the menu entry, the navigation button and the form, and the announcements of the saved notice and of the messages (NFR-3); the focus end is also a browser test.

### Inventory upkeep (skill, section 9)

Updated in the task that adds each file: UNI-1 (`universe-change.ts`), UNI-3 (`edit-universe.ts`, the protected tests named above), UNI-4 and UNI-6 (protection text, repository port), UNI-5 (seven use cases), APP-2 (`edit-universe-input-schema.ts`, protected tests), CMP-3 (three pure files), CMP-4 (`use-universe-editing.ts`, `settle-action-call.ts`, new browser tests under Protection), CMP-7, CMP-8 (new browser tests), CMP-13 (menu description), new entry CMP-17 (`universe-edit-form.tsx`, IMPORTANT, component test). At validation, `pnpm test:coverage` must show no floor or override notice: any record that the new tests raise (CMP-3 figures, UNI-4's override if its figure changes) is raised or removed (`sdd.md`, "Validation").

## 8. Decisions

| # | Decision | Alternative discarded and why |
|---|---|---|
| D1 | One use case, `editUniverse`, takes `{ universeId, name, description }` and a repository method that can change only name, description and update time. | A generic `update(universe)`: it could write the mode or the owner, against FR-4 and the data model; a command with a mode that the use case ignores: an input that means nothing. |
| D2 | The use case reads the universe, decides the real change in a domain function and writes in one conditional statement that matches id, owner and not deleted; no `UnitOfWork`. | A transaction or a lock around read and write: one row, and last write wins is the accepted risk of the spec; the conditional write alone covers a universe removed between the two steps (the later trash of 007b). Deciding the change in the screen: the spec says the screen never decides it. |
| D3 | The check order of FR-9 is the order of the calls: session in the action, then the schema (shape only), then identifier, ownership, fields, real change in the use case. | A schema that also checks limits: a foreign universe with an invalid name would answer validation instead of not found, which tells the caller something about the universe. |
| D4 | The duplicate check takes an optional excluded identifier, on the same use case and the same action. | A second use case and action for the edit: two definitions of the same rule (NFR-1). Comparing in the screen with the list it already has: duplicates the comparison rule and uses a list that can be stale in another tab (004 D7). |
| D5 | The edit has its own small reducer with its own notice codes, scoped to one universe. | Parametrizing the creation reducer with the codes: touches a tested file of another feature for a small saving, and still needs the universe scoping. The duplication of the cap and late rules (about 40 lines) is accepted. A second request slot per universe: not needed, the form of one universe exists at a time. |
| D6 | The edit lifecycle lives in a hook used by the existing provider, not in a second provider or a store. | Adding it to the provider body (it is already 250 lines); a second provider: it needs the list setter and the account guard of the first; Zustand: not approved and not needed. |
| D7 | The merge into the list keeps the entry with the later `updatedAt` and never reorders. | Replacing always: a late older answer would overwrite newer data (FR-12). Reloading the list from the server: an extra request with the failure cases of its own. |
| D8 | `isEditingUniverse` is a flag, not an identifier of the edited universe. | Storing the identifier: it can only equal the selected one, because every change of selection closes the form. |
| D9 | The first duplicate check of a prefilled form uses the normal 250 ms pause. | An immediate first check: a special case in `check-name-after-pause.ts` (IMPORTANT, tested) for a delay a person does not notice; the browser test waits for the warning. |
| D10 | The edit warning has its own text ("You can still save this one"); the mode label and the fixed sentence are the creation form's. | Reusing the creation warning: it says "create" in a form that saves. Copying the mode texts: two sources for one text. |
| D11 | Focus returns to the element that opened the form, else to `#main-content`, tried in that order, by checking where the focus ended. | Always the universe heading, as the creation does: the spec asks for the opener (NFR-3). Deciding by screen width: the same result with a second rule. |
| D12 | The duplicated waiting step (30 s, then wait for the answer) is written again in the hook rather than extracted from the provider; only `settleActionCall` moves to its own file, which both providers need. | Extracting the whole wait from the creation: changes the creation path for a saving of eight lines (out of scope). Importing between provider and hook: a circular dependency. |
| D13 | The documentation of the split is the first task, as a docs-only commit, so the repository says what is next from the start of the branch; the closing step adds the result of 007a to `CLAUDE.md` and the roadmap as usual. | Leaving it all for the closing: the roadmap would say "007" for the whole life of the branch. |

## 9. Coverage

| FR / NFR | Covered by |
|---|---|
| FR-1 | `app-menu-bar.tsx`, `sidebar.tsx`, `en.ts`, `canEditSelectedUniverse` in the hook; browser tests (menu entries, button, unavailable with no universe) |
| FR-2 | `workspace-state.tsx` (`universeEditingStarted`, no remount when open), `central-area.tsx`, `universe-edit-form.tsx`; reducer unit tests, form component test, browser tests |
| FR-3 | `workspace-state.tsx` transition table; reducer unit tests; browser tests (view, work, entity, universe, forms of spec 006, creation, late creation success) |
| FR-4 | `universe-change.ts`, `edit-universe.ts`, repository method, `editUniverseAction` and its schema (extra keys dropped); unit, contract, action tests |
| FR-5 | `use-universe-editing.ts`, `apply-edited-universe.ts`, `central-area.tsx` (close, view, announcement, focus), `universe-edit-state.ts`; unit and browser tests |
| FR-6 | `edit-universe.ts` (all issues together, nothing written), `interpret-edit-universe-result.ts`, `universe-edit-form.tsx`; unit, component, action and browser tests |
| FR-7 | `edit-universe.ts` step 4, the form always sending the save; use case, action and browser tests (also with an expired session) |
| FR-8 | `is-universe-name-in-use.ts` with the excluded identifier, the action schema, the form's check; unit, action and browser tests |
| FR-9 | `editUniverseAction` (session only, extra keys dropped), `edit-universe.ts` order; action and use case tests, protected isolation tests |
| FR-10 | `interpret-edit-universe-result.ts` (`sign-in-again`, unverifiable session as `generic-failure`), the form's messages, the account guard; unit, component and browser tests |
| FR-11 | `edit-universe.ts` steps 1 and 2, the shared mapper, `not-available` outcome and message; unit, action and browser tests |
| FR-12 | `universe-edit-state.ts`, `use-universe-editing.ts`, `apply-edited-universe.ts`, the form's late confirmation; unit, component and browser tests |
| NFR-1 | One `editUniverse` and one name-check rule for every entry point; the contract scenarios run on the fake and on PostgreSQL |
| NFR-2 | Protected tests of `edit-universe.test.ts`, the repository contract, `actions.test.ts` and `universe-editing-isolation.spec.ts` |
| NFR-3 | Form markup and focus helper (section 5); browser tests of keyboard, 320 px and where the focus ends; manual screen-reader check by the user |
| NFR-4 | The three Playwright files of section 7 |
| Completion criterion: documentation of the split | The docs task (below) and the closing step |

## Documentation (the split of spec 007, decided here: first task)

Done in one docs-only task at the start, with no test gate (only `.md` files change):
- `docs/roadmap.md`, Phase 1 row: "007 Universe lifecycle" becomes two specs sharing a number: **007a Universe editing** (this one, next) and **007b Universe trash** (trash, restore and purge of universes and of the content of spec 006, `UnitOfWork`, executes OD-6; depends on 007a being merged only for ordering, not for code), and "Phase 1 is not complete: spec 007 remains" is reworded to say 007a and 007b remain.
- `docs/open-decisions.md`: OD-6 says "executed by spec 007b".
- `.claude/rules/data-model.md`: the `Universe` row (`deletedAt` "written by the trash of spec 007b") and the `RememberedUniverse` note (what happens to the row with a purged universe belongs to spec 007b).
- `CLAUDE.md` "Current status": "(edit, trash, restore, purge: spec 007, next)" becomes "editing: spec 007a, next; trash, restore and purge: spec 007b". At the closing, the implementer adds what 007a made real.
- `prisma/schema.prisma` comment: not touched (section 2); 007b corrects it.

## Size check

Estimated 15 tasks, each one result and one commit, none above 3 FR: documentation of the split; domain rule `universe-change.ts`; repository port, fake, contract scenarios and Prisma method; `editUniverse` with its composition; the excluded identifier of the name check; `editUniverseAction` and the schema; workspace state; edit state and merge; interpreter; messages, `settle-action-call.ts` move and the hook with the provider; the edit form with its component test; the central area wiring; the two entry points and the focus; and three browser test files. This is the size of spec 004's slice; no split of the spec is proposed.

## Approvals and items to report

Needs approval: **none**. Checked against `CLAUDE.md` "ASK FIRST": no dependency added, removed or upgraded; no module, layer or top-level folder (new files go in existing folders); no Prisma schema change or migration (the stale schema comment is deliberately left for 007b for that reason); nothing marked pending or open is implemented (OD-6 is executed by 007b; trash, restore, purge, mode change, cover image, sharing and conflict detection are out of scope); no architectural decision outside `architecture.md` (a use case, a repository method and a hook in the existing patterns).

To report to the user when they happen (not approvals):
- Two existing tests change because the shape they pin changes: `tests/components/workspace/workspace-state.test.ts` (the list of state keys gains `isEditingUniverse`) and `tests/modules/universes/composition.test.ts` (the list of use cases gains `editUniverse`). Nothing is deleted or relaxed.
- `src/components/universes/settle-action-call.ts` is a file move of an existing function, with `knowledge-provider.tsx` as the second importer; behavior stays.
- CMP-4, CMP-8 and CMP-13 are protected by browser tests (floor 0 and TIER 0): the new browser tests are named under their Protection; if the implementer finds the menu component holds real logic, it is reclassified before any decision about its tests.
