# Spec 007a — Universe editing

Status: approved

## Context and goal

Universes are stored and owned by an account (spec 004), but once created a universe cannot be corrected: a typo in the name, or a description that no longer fits, stays forever. The Universe menu already shows a disabled "Rename universe" entry as a placeholder for this.

This feature lets a person change the name and the description of one of their own universes, with the same rules as at creation. The mode (`READER` or `AUTHOR`) is fixed at creation and does not change (project data model, Universe), so the disabled "Switch mode" placeholder of the menu is removed.

**Origin of this spec.** Phase 1 listed one spec, 007 "Universe lifecycle" (edit, trash, restore, purge). On 2026-11-27 the user split it into two specs that share the number 007 with letters: this one, **007a Universe editing**, and **007b Universe trash** (trash, restore and purge of universes and of their content, and the support those need). This spec is the first of the two and does not depend on 007b.

**Where editing is offered (user decision, 2026-11-27).** Editing is offered for the selected universe from the Universe menu and, because that menu is not shown on narrow screens, also from a button in the header of the universe navigation next to the button that creates a universe (the same pair of entry points as the creation, spec 004).

**Dependency.** This spec reuses, by reference and without restating them, the rules and protections of spec 004 (called "004 FR-x" below):
- 004 FR-4, FR-5 and the text rules: name and description validation (name required and at most 120 characters, description optional and at most 2000, characters counted as Unicode code points after trimming, null character and invalid Unicode rejected).
- 004 FR-21 to FR-23: the duplicate-name warning and its comparison against own universes only.
- 004 FR-2, FR-31 to FR-35: acting user taken only from the session, owner isolation, authentication error, unverifiable session, typed errors, validation error for a bad identifier and the same not found answer for another account's universe and for one that does not exist.
- 004 FR-7 to FR-10 and FR-18: the lifecycle of a submitting form (single submission, generic failure, unknown result, late answer, expired session) and the clearing of account-scoped screen state on an account change.
- 004 FR-19: names and descriptions shown as plain text.
- The definition of "own universes" (not deleted, owner is the account) and of "trimming".
- Spec 006 FR-12: an answer that belongs to a universe that is no longer the selected one never changes the selection and never shows a message.

This feature does not trash, restore or purge universes (spec 007b), does not change the mode, and does not edit works, entities, relationships or any other content (Phase 2).

## Users

- Reader: wants to fix the name or description of a `READER` universe without losing what is inside it.
- Author: wants to rename or re-describe an `AUTHOR` universe as the project evolves.

There are no roles and no administrators.

## User stories

- US-1. As a user, I want to rename one of my universes so that I can fix a typo or follow a new project name.
- US-2. As a user, I want to change or remove a universe's description so that it stays accurate.
- US-3. As a user, I want the edit form to look and behave like the creation form, prefilled with the current values, so that I do not have to learn anything new.
- US-4. As a user, I want to see that the mode is fixed, and why I cannot change it, so that I am not left looking for a control that does not exist.
- US-5. As a user, I want the same duplicate-name warning as when creating, which never counts the universe I am editing, so that it helps without getting in the way.
- US-6. As a user, I want nobody else to be able to change my universes so that my work is safe.
- US-7. As a user on a narrow screen, I want to reach the edit from the universe navigation so that editing does not depend on a menu that is not shown there.

## Definitions

Terms of spec 004 keep their meaning here: own universes, stored universe, owner, character, trimming, comparable name, account-scoped screen state, result, error kinds.

- **Edit form**: the form, shown in the central area in place of the current view, that edits the name and the description of the selected universe. It has the layout and fields of the creation form, prefilled, with the mode shown as fixed text.
- **Edited universe**: the universe that was selected when the edit form was opened.
- **Real change**: the trimmed name or the trimmed description differs from the value stored at the moment the system checks it, comparing both texts in their Unicode composed form. Only the system that stores the universe decides it; the screen never decides it. A description that is empty or only whitespace counts as no description. A difference in case, accents or inner spacing is a real change; a difference only in the whitespace at the ends of the text or in the Unicode composition of the same text is not.
- **Current view**: the view of the central area the person selected with the view switcher (graph or list). The forms (edit, creation of a universe, forms of spec 006) are shown in place of the content of the current view, under the view switcher; opening or closing a form never changes the current view, and changing the view while a form is open does not close the form.
- **Other own universes**: the own universes of the acting user except the edited universe.
- **Unavailable control**: a control that is visible, cannot be activated and is announced as unavailable, like the other placeholders of the menu.

## Functional requirements

Entry points and the form
- FR-1: THE SYSTEM SHALL show in the Universe menu an enabled entry "Edit universe" instead of the placeholder "Rename universe", SHALL remove the placeholder "Switch mode", and SHALL keep "Move to trash" as a disabled placeholder; THE SYSTEM SHALL also show an "Edit universe" button in the header of the universe navigation, next to the button that creates a universe, reachable at every screen width at which the navigation can be opened. WHILE no universe is selected, whatever the reason, both entry points SHALL be unavailable controls. The universe cannot be edited from any other place in this version.
- FR-2: WHEN a person activates either entry point while a universe is selected, THE SYSTEM SHALL show in the central area an edit form titled "Edit universe", with the name and the description of that universe prefilled, its mode shown with the same label the creation form uses for it as text that cannot be edited (not as a choice) together with a fixed sentence saying that the mode cannot be changed after the universe is created, and the actions Save and Cancel. WHEN the edit form is already open and the person activates an entry point again, THE SYSTEM SHALL keep it open with the values typed.
- FR-3: WHILE the edit form is open, THE SYSTEM SHALL keep it open with the values typed when the person changes the view (graph or list) or selects a work or an entity, as the creation forms do. WHEN the person cancels, selects any universe (also the one already selected), opens a form of spec 006 or starts the creation of a universe, or the selected universe changes for another reason (for example the late success of a creation selects the new universe, 004 FR-8 and FR-24, because the edited universe is then no longer the selected one, spec 006 FR-12), THE SYSTEM SHALL close the edit form, change nothing, discard the values typed and leave the selection as it is. WHEN the person opens the edit form while a form of spec 006 or the creation form of a universe is open, THE SYSTEM SHALL close that form with its typed values discarded (as the creation of a universe already does); an answer still pending for a form of spec 006 keeps following its own rule.

Saving
- FR-4: WHEN the person saves a valid edit form with a real change, THE SYSTEM SHALL store the new name and description of the edited universe, trimmed (no description if it is empty or only whitespace), with the validation rules of the creation (004 FR-4 and FR-5), and SHALL set its last-update timestamp (UTC) to the time of the change; its identifier, owner, mode and creation timestamp SHALL stay unchanged. The input of an edit has no mode: IF a call sends a mode or any other field that is not part of an edit, THEN THE SYSTEM SHALL ignore it without error and the stored mode SHALL not change.
- FR-5: WHEN the success answer of a save arrives on time (before the unknown-result message of FR-12 is shown), THE SYSTEM SHALL close the form, return the central area to the current view, show no visible notice and announce to assistive technologies that the universe was saved. WHEN any success answer arrives, on time or late, THE SYSTEM SHALL show the new name and description of the universe everywhere it is shown, keep its position in the universe list (creation order, 004 FR-11), leave the remembered universe unchanged and leave every other universe and all content unchanged. The answer SHALL update the entry of that universe in the navigation even when another universe has been selected meanwhile, and SHALL never change the selection, show a message or close the form of another universe (spec 006 FR-12).
- FR-6: IF a rule fails, THEN THE SYSTEM SHALL change nothing, SHALL report a validation failure with the issues keyed by field (002 FR-34) and SHALL keep the edit form open with the values typed.
- FR-7: WHEN a save, from the form or by a direct call, carries a name and a description that are not a real change from the stored ones, THE SYSTEM SHALL run the checks of FR-9 to FR-11 first and then answer success, write nothing and leave the last-update timestamp unchanged; the screen SHALL treat that answer as any stored edit (FR-5). Every save SHALL reach the system that stores universes: the screen never closes a form as saved without its answer, so a save with no real change under an expired session gets the same sign-in message as any other save (FR-10).

Duplicate names
- FR-8: WHILE the name in the field has a comparable name equal to that of one of the other own universes, THE SYSTEM SHALL show the duplicate-name warning of 004 FR-21, also right after the form is opened if the universe already shares its comparable name with another; the edited universe SHALL never count as a duplicate of itself (including when the name changes only in case, accents, spacing or Unicode composition). The warning SHALL never block saving and SHALL not ask for a second confirmation (004 FR-22), and a name that exists only in another account SHALL show no warning (004 FR-23).

Ownership, access and errors
- FR-9: THE SYSTEM SHALL edit only the own universes of the acting user, taking the acting account only from the session of the request; any owner, account or acting-user data sent by the client, also together with the identifier of a universe of another account, SHALL be ignored without error (004 FR-2), and the edit SHALL follow the same rules through every entry point (004 FR-31). THE SYSTEM SHALL run the checks of an edit in this order and stop at the first that fails: the session, the identifier, the ownership of the universe (not found), the validation of the fields, and last whether there is a real change (FR-7), so that no answer ever confirms the existence or the content of a universe of another account.
- FR-10: IF an edit is called without a valid session, or the session cannot be checked, THEN THE SYSTEM SHALL fail as 004 FR-32 and FR-33 define (the authentication error with nothing read or changed; or the infrastructure failure without treating the person as signed out), and the screen SHALL keep the edit form open with the values typed and behave as the creation form does in these cases (004 FR-10). After signing in again the edit form is closed, as all account-scoped screen state is cleared (004 FR-18); the person opens it again, prefilled.
- FR-11: IF the universe identifier of an edit is malformed, empty or missing, THEN THE SYSTEM SHALL report a validation error; IF it is well formed but belongs to another account, does not exist or is deleted, THEN THE SYSTEM SHALL report the same not found error in every case (same kind, code, message and shape, 004 FR-35) and change nothing. WHEN the screen receives that not found error, it SHALL show a message that the universe is not available, without saying which case happened, keep the edit form open with the values typed so that the person can cancel or try again (which gives the same answer), and leave the selection and the navigation as they were.

Lifecycle of the form
- FR-12: THE SYSTEM SHALL give the edit form the lifecycle of the creation form: a single submission however the person repeats it, a generic failure message that stores nothing, a message of unknown result when no usable answer arrives (saying that the universe may have been changed) and the clearing of the form on an account change (004 FR-7 to FR-9 and FR-18), with a failure message and an unknown-result message that differ in text and in message code (004 FR-8). WHEN an answer with success arrives late, THE SYSTEM SHALL apply it to the navigation entry of the universe; IF the form that showed the unknown-result message is still open, THEN THE SYSTEM SHALL replace that message with a visible confirmation (also announced to assistive technologies), keep the form open with the values the person has typed meanwhile, and neither return the central area to the current view nor move the focus (the close and the focus rule of FR-5 and NFR-3 are those of an on-time success only), and IF the form is no longer open, THEN THE SYSTEM SHALL show no message (spec 006 FR-12). WHEN a second submission was sent after the first got no answer and both answers arrive, in any order, THE SYSTEM SHALL keep in the navigation entry the universe data with the later last-update timestamp.

## Non-functional requirements

- NFR-1: THE SYSTEM SHALL give the same results for the same edit scenarios (valid edit, each validation failure, no real change, a mode sent by the client, duplicate detection excluding the universe itself, isolation between two accounts) whichever way universes are kept, with a single definition of the rules for every entry point (as 004 NFR-1 and NFR-2).
- NFR-2: THE SYSTEM SHALL isolate accounts: verifiable with two accounts, where no edit by one ever changes, returns or confirms the existence or the content of a universe of the other, including an edit whose values equal those stored. These account-isolation tests are the protection tests of this feature (see Spoiler impact).
- NFR-3: THE SYSTEM SHALL keep the menu entry, the navigation button and the edit form usable only with the keyboard, with visible labels, errors linked to their fields, text contrast of at least 4.5:1, a visible focus, and SHALL announce the messages of FR-10 to FR-12 and the saved notice of FR-5 to assistive technologies as the creation form does (004 NFR-4). WHEN the form closes by Cancel or by an on-time success (FR-5), THE SYSTEM SHALL move the focus to the control that opened it or, if that control is no longer shown (the navigation of a narrow screen closes after the choice), to the main content of the page; the focus SHALL never end on the document body. At a viewport width of 320 CSS pixels, with a name of 120 characters and a description of 2000 characters, the navigation button and the form SHALL be reachable and usable, with nothing scrolling horizontally and every control reachable (004 NFR-6).
- NFR-4: THE SYSTEM SHALL cover with automated browser tests that drive the application as a person would: editing the name and description from the menu and from the navigation button at a narrow width, and finding them after a reload; the prefilled form with the fixed mode and its sentence; cancelling; the form staying open with the values typed when the view is changed or a work or an entity is selected, and closing with them discarded when another universe is selected or a creation is started; saving with no real change; a validation failure with the values kept; the duplicate-name warning that ignores the universe itself and warns about another own universe; the entry points unavailable with no universe selected; two accounts that do not see each other's change; and the menu with its entries (enabled "Edit universe", no "Switch mode", disabled "Move to trash").

## Spoiler impact

None. The name and the description of a universe are not narrative information and carry no spoiler boundary; no work, unit, reading progress or boundary is read or written. The mode is shown but never changed, so the behavior is the same in `READER` and `AUTHOR` universes. The spoiler suite is not applicable (it starts in Phase 4); in its place the account-isolation tests of NFR-2 protect this feature, as in spec 004. The change does not touch any stored data structure.

## Edge cases

- Save with nothing changed, or with only different whitespace at the ends or a different Unicode composition: the save reaches the system that stores universes, which answers success after the checks, writes nothing and leaves the timestamp unchanged; the form closes as after any stored edit (FR-7, FR-5). The same through a direct call; for a universe of another account the answer is the not found error, never a success (FR-9).
- Expired session with a save that has no real change: the same message asking to sign in again as any save, values kept (FR-7, FR-10).
- Clearing the description (empty or only whitespace): the universe is left with no description, a real change (FR-4).
- Name empty or whitespace only; name of 121 characters; description of 2001 characters; null character or lone surrogate: validation error on the field, nothing changed, values kept (FR-6). Name of 120 and description of 2000 characters are accepted.
- A call that sends a mode, an owner or other fields with a valid edit: the extra data is ignored, the edit is applied for the account of the session and the mode stays as it was (FR-4, FR-9).
- Renaming to the name of another own universe, also if it differs only in case, accents, spacing or composition: warning while typing, saving allowed, both universes exist (FR-8). Opening the form of a universe that already shares its comparable name with another: the warning shows at once (FR-8).
- Renaming a universe to the same name with a different case, accents or inner spacing: no warning, saved as a real change (FR-8, Definitions).
- Name that exists only in another account: no warning (FR-8).
- The universe is edited from a second tab or deleted meanwhile: for an existing universe the last save wins, also when an old form of another tab is saved without touching it: its values are compared with what is stored now and, being different, are stored and revert the other tab's change (accepted risk). If the universe no longer exists, the same not found answer, the message that the universe is not available, the form still open with the values typed, and the navigation as it was until reload (FR-11). A list or form already loaded in another tab can be out of date until reload. Accepted.
- Session expired while the form is open: saving changes nothing, values kept, message asking to sign in again; after signing in again the form is closed and is opened again prefilled (FR-10).
- Person changes the view (graph or list), or selects a work or an entity, with the edit form open: the form stays open with the values typed, and the change of view shows when the form closes (FR-3).
- Person selects any universe (also the same one), opens a form of spec 006 or starts creating a universe with the edit form open: the form closes and the typed values are discarded (FR-3). Person chooses "Edit universe" with a form of spec 006 or a creation form open: that form closes with its typed values discarded and the edit form shows (FR-3). Person activates "Edit universe" with the edit form open: nothing changes (FR-2).
- A creation of a universe was pending when the edit form was opened (which closed the creation form) and its late success selects the new universe: the edit form closes with its typed values discarded, as any change of the selected universe does (FR-3, spec 006 FR-12). Intended.
- Person selects another universe while a save is waiting for its answer: the form closes, the selection stays as chosen, and the answer updates the entry of the edited universe in the navigation without any message (FR-5, FR-3).
- Person signs out and another signs in on the same device: no edit form or typed value of the first account remains (FR-12).
- No universe selected (also while the page has nothing to select): both entry points are unavailable controls (FR-1).
- Narrow screen (below the width at which the menu bar is shown): the menu is not shown; the navigation button is the way to edit (FR-1, NFR-3).
- Name or description with markup, emoji, non-Latin characters, direction-control characters or very long text: stored as written apart from trimming, shown as plain text and wrapped inside its area as in 004 FR-19.
- Double click or repeated Enter on Save: one submission (FR-12).
- A save without an answer: unknown-result message; a late success updates the navigation and, if the form is still open, becomes a visible confirmation and the form keeps what the person typed meanwhile; if the person already left the form, nothing is shown (FR-12). Two submissions whose answers arrive in reverse order: the navigation entry keeps the data with the later last-update timestamp (FR-12).
- A form is opened from the graph view or from the list view and saved on time: the central area returns to the current view, whatever form was open before (FR-5). A late success with the form still open does not return to the view and does not move the focus (FR-12).

## Out of scope

Checked against `docs/roadmap.md`, `docs/open-decisions.md` and `CLAUDE.md`.

Belongs to the next spec (Phase 1):
- Sending a universe to the trash, restoring it, permanent purge, the trash screens and the support those need (spec 007b, OD-6 decided 2026-11-06). The menu keeps "Move to trash" disabled.

Not done in this version:
- Changing the mode of a universe (it is fixed by the data model).
- Editing, trashing or deleting individual works, units, entities, fragments or relationships (Phase 2; OD-19 is still open for trashing a work).
- Offering the edit anywhere other than the Universe menu and the header of the universe navigation, and editing a universe that is not the selected one: not requested.
- Making the menu bar reachable on narrow screens: the navigation button is the user's decision for them.
- Cover image (the universe has none; file uploads are OD-11), sharing and collaboration, addresses that name a universe, import and export (OD-15).
- A history of changes to a universe, conflict detection between two tabs or devices (last write wins) and limits or abuse protection (Phase 5, OD-9). Hardening of several tabs, network cuts with a simulated clock and layout stress stays in the hardening backlog.
- Spoiler filtering, reading progress and AI.

Accepted risks:
- Two tabs or devices that edit the same universe at the same moment: the last one stored wins, and a form already open in another tab can show out-of-date values until it is reloaded. An old form saved untouched in another tab can therefore revert a change made elsewhere; it is the same risk as the several-tabs item already parked in the hardening backlog.

## Completion criteria

- Every FR and NFR above is covered by a passing automated test (unit, integration or browser), except the accessibility items of NFR-3, which are a manual check by the user during the validation.
- A signed-in person can open "Edit universe" on the selected universe from the Universe menu and, at a narrow width, from the button of the universe navigation, see the form prefilled with the current name and description, the mode as fixed text with its sentence, change the name and the description, save, and see the new values in the workspace, after a reload and after signing out and in; the universe keeps its identifier, mode, creation date and position in the list (browser test and integration test).
- The validation cases of the creation (empty and whitespace-only name, 121-character name, 2001-character description, 120 and 2000 as accepted limits, trimming before measuring, code points, null character, lone surrogate) give the same outcomes through the real form and through a direct call, with the typed values kept and nothing changed.
- Saving with no real change reaches the system that stores universes, which answers success after the checks and writes nothing; the form closes and the last-update timestamp stays as it was; a real change sets it to the time of the change; with an expired session a save with no real change gets the sign-in message like any save.
- A mode, owner or other field sent in an edit is ignored without error and the stored mode never changes.
- The duplicate-name warning appears for another own universe (also on opening the form), never for the universe being edited and never for a name that exists only in another account, and never blocks saving.
- An edit sent for another account's universe, for one that does not exist and for a deleted one gives the same not found answer and changes nothing, also when its values equal the stored ones; a malformed, empty or missing identifier gives a validation error; the order of the checks of FR-9 holds. These account-isolation tests stand in for the spoiler suite, which is not applicable.
- An edit without a valid session fails with the authentication error and changes nothing; with an unverifiable session it fails with the infrastructure failure and the person is not treated as signed out; in both cases the typed values stay in the form, and after signing in again the form is closed.
- Single submission, generic failure, unknown result, late success (visible confirmation while the form is open and values typed meanwhile kept; silent when it is not), answers in reverse order and the clearing of the form on an account change behave as FR-12 says (tests of what differs from the creation form only).
- The edit form stays open with the values typed when the view is changed or a work or an entity is selected, and closes with them discarded in each other way listed in FR-3, also when it is opened over another form (FR-3).
- The Universe menu shows an enabled "Edit universe", no "Switch mode" and a disabled "Move to trash"; the navigation shows its "Edit universe" button; both are unavailable controls while no universe is selected.
- The menu entry, the navigation button and the edit form are usable by keyboard and screen reader, usable at 320 px, and have no accessibility regressions; the focus ends as NFR-3 says (manual check by the user, and a test of where the focus ends).
- The project documentation records the split of spec 007: the Phase 1 row of the roadmap describes 007a Universe editing and 007b Universe trash (trash, restore and purge of universes and of the content of spec 006) in place of the single spec 007 and states which is next; the "Current status" of the project guide, the open decision OD-6 (executed by 007b) and the data model (the Universe table, whose trash is written by 007b, and the remembered-universe table, whose clean-up with a purged universe belongs to 007b) are made consistent with it. This is done at the closing of this spec or in the first task that touches those documents, as the plan decides.
- The existing tests of earlier specs keep passing without being deleted or relaxed; if one has to change because the menu entries change, the change is reported to the user.

## Open questions

None.
