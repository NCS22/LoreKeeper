# Spec 004 — Stored universes

Status: approved

## Context and goal

Today a universe lives only in the memory of the open page (spec 001): it is lost on reload, it belongs to nobody, and the workspace is filled with two sample universes that are the same for everyone. Accounts exist (specs 002 and 003), but nothing in the application is tied to them yet. Both earlier specs handed this work to "the stored-universes spec".

This feature makes universes real. A universe the user creates is kept in the application's stored data, belongs to the account that created it, and is seen and used by that account alone, in any browser or device. The application also remembers, per account, the universe the user used last, so that the user lands in it the next time.

**Dependency.** This spec depends on specs 001 (the creation form and its rules), 002 (the acting-user check, the error kinds and the shape of the results) and 003 (the screens of accounts and the page access guard). It relies on these requirements (called "001 FR-x", "002 FR-x" and "003 FR-x" below):
- 001 FR-1 to FR-24 and NFR-1 to NFR-5: the creation form, its validation, the duplicate-name warning, the creation itself, the selection after creation and the empty state. This spec keeps them, with the changes listed in the next paragraph.
- 002 FR-20 to FR-22: the single acting-user check, taken only from the session of the request, and the infrastructure failure when the session cannot be checked. 002 FR-33 to FR-39: the error kinds, their stable codes and the shape of the result of a failed action.
- 003 FR-18, FR-21 and FR-24: pages and operation calls of a signed-out person are redirected or refused before any workspace content is produced, and a session that cannot be checked is never treated as signed out. 003 FR-26: text of the person is shown as plain text with direction characters isolated. 003 FR-32: a sign-up, sign-in or sign-out starts the workspace clean.

**Single definition of universe operations.** This spec is the only definition of what a universe operation does when the session is missing or cannot be checked (FR-32, FR-33). 003 FR-21 and FR-24 describe the same outcomes seen from the page access guard and are consistent with it: nothing is run, nothing is read or changed, a missing session is read by the screen as "signed out", and a session that cannot be checked is never read as "signed out".

**What this feature changes of earlier specs (user decision, 2026-11-12).** The list is complete as far as known; the plan and the closing must check the earlier specs once more and report anything else that stops being true (see Completion criteria).
- 001 FR-24 (a created universe is gone on reload) no longer holds: a created universe stays. Nothing created in memory by spec 001 is kept or migrated.
- 001 NFR-1, last sentence ("No code for a real storage is added in this version"), no longer holds: this version keeps universes in the application's stored data. Its first part (rules independent of where universes are kept) stays, restated in NFR-1 here.
- 001 FR-22 (the empty state of a universe "invites the user to continue") changes: the empty state is honest, says that the universe is empty and that works, entities and relationships arrive in future versions, and offers no button or link to an action that does not exist (FR-17).
- 001 FR-11 and FR-13 (the duplicate-name warning compares with "an existing universe") are narrowed: the comparison is with the own, stored universes of the acting user only (FR-21, FR-23).
- 001 FR-5 to FR-8 (name and description lengths) are made precise: a character is a Unicode code point, the description is trimmed like the name, and a description with only whitespace is no description (FR-4); text with the null character or invalid Unicode is a validation error (FR-5).
- 003 FR-31 (the workspace shows the two sample universes and creates universes in memory, tied to no account) no longer holds: the sample universes disappear from the workspace. Each account sees only its own stored universes, and an account with none sees the empty state that invites it to create its first universe.
- 003 FR-32 and its definition of "clean start" (the workspace shows only its sample data and drops what was created in memory) are widened: on sign-up, sign-in and sign-out all account-scoped state of the screen is cleared, also in other open tabs (FR-18).
- 003 NFR-4 (verification by searching for the names of the sample universes) keeps its meaning, but the sample names are no longer a valid marker; the text a signed-in person sees in the workspace (labels of the top bar and the side panels) is.
- The edge cases, accepted risks and completion criteria of specs 001 and 003 that describe sample data, memory-only creation, "universes tied to nobody" or "the workspace shows sample data only" stop being true, as does the accepted risk of spec 003 about static files that contain the sample data (closed by FR-36 and FR-37).
- Known consequence, accepted by the user: the sample entities, graph, timeline, works and sources are tied to the sample universes. They are retired from the application now (decided by the user on 2026-11-12): their data is not shown or sent to the browser. The workspace sections that showed them stay, with an honest empty state (FR-15). Real content replaces the sample content when Phases 2 and 3 create it, and the sample content has to be recovered or rebuilt then. Every stored universe is empty in this version (001 FR-22).

**Hand-offs from earlier specs taken by this feature.**
- 002 and 003 asked that the first operation that reads or changes data requires and verifies the rejection of a request without a session by itself, using the acting-user check, and not only through the page access guard. FR-31 to FR-35 do it.
- 003 asked that the spec that first stores real data revisit the accepted risk of public static files that contain the sample data. Resolved by this spec: the sample data is retired and no stored data is served without a session (FR-36, FR-37).
- 003 handed over an accepted risk about the session cookie (decision D-V1-4 of spec 003, "to revisit if sessions become the access path to real data"). The user decided on 2026-11-12 to keep it as an accepted risk; this spec states what it can and cannot cause (Out of scope, accepted risks).

This feature does not edit, delete, restore or purge universes (spec 005), does not store works, entities or any other content, does not add sharing and does not give a universe an address of its own (FR-29).

## Users

- Reader: follows dense works and wants to remember what they read without spoilers. Creates `READER` universes and expects them to be there on every visit.
- Author: tracks the details of their own works. Creates `AUTHOR` universes and expects them to be private to the account.
- A person who uses the same account from several devices and expects to find the same universes and the same last-used universe on each.

There are no roles and no administrators.

## User stories

- US-1. As a reader, I want the universes I create to be kept in my account so that they are still there when I reload the page, close the browser or come back another day.
- US-2. As an author, I want my universes to be visible only to my account so that nobody else sees or touches them.
- US-3. As a user, I want to find the same universes on any browser or device where I sign in so that I can continue my work anywhere.
- US-4. As a user, I want to land in the universe I used last so that I continue where I stopped.
- US-5. As a new user, I want a clear invitation to create my first universe so that I know how to start.
- US-6. As a user, I want the duplicate-name warning to compare only with my own universes so that it helps me without revealing what other people have created.
- US-7. As a user, I want the sections and universes that have no content to say so honestly so that I am not invited to do things that do not exist yet.

## Definitions

Terms defined in specs 001, 002 and 003 keep their meaning here: universe, mode, comparable name, empty universe, account, session, acting user, acting-user check, result, error kinds, workspace page, operation call, clean start.

- **Stored universe**: a universe kept in the application's stored data, with an owner. In this version it is the only kind of universe.
- **Owner**: the account that created the universe. It never changes in this version.
- **Own universes** (of an account): the stored universes whose owner is that account and that are not deleted. Nothing deletes a universe in this version; universes sent to the trash by spec 005 will not count as own, neither for the remembered universe nor for the duplicate-name warning.
- **Universe operation**: any operation of the application that reads or changes universes or the remembered universe: listing the own universes, creating one and remembering the last-used one. Anything the interface needs to check about the own universes (for example the duplicate-name warning) is also a universe operation if it asks the stored data.
- **Remembered universe**: the own universe that the account used last, kept in the account's stored data, one per account.
- **Available universe**: an own universe that exists and can be selected. A remembered universe that does not exist among the own universes is not available.
- **Character**: a Unicode code point. Lengths of name and description are counted in code points, after trimming.
- **Trimming**: removing the whitespace at the start and at the end of a text. Name and description are trimmed before their length is measured and before they are saved.
- **Account-scoped screen state**: everything the screen holds that depends on the account in use: the selected universe, the loaded list of universes, an open creation form with half-typed values, and every notice or message about them. The accessibility preferences kept in the browser are not account-scoped.
- **Honest empty state**: a text that says that there is nothing there yet and, when it applies, that works, entities and relationships arrive in future versions; it contains no button or link to an action that does not exist.
- **Unverifiable session**: a session that cannot be checked because of a failure (002 FR-22), as opposed to a missing or expired session.

## Functional requirements

Creation and storage
- FR-1: WHEN a signed-in person submits a valid creation form, THE SYSTEM SHALL store a new empty universe owned by the acting user, with the given name and description trimmed (no description if it is empty or only whitespace) and the chosen mode.
- FR-2: THE SYSTEM SHALL take the owner of a new universe, and the acting account of every universe operation, only from the session of the request (002 FR-21); any owner, account or acting-user data sent by the client in any form (body, parameters or headers), also together with the identifier of a universe of another account, SHALL be ignored without error, and the operation SHALL act for the account of the session only.
- FR-3: WHEN a universe is stored, THE SYSTEM SHALL give it an identifier different from every other universe's, creation and last-update timestamps with the same value in UTC, no cover image (001 FR-15 and FR-16), and a mode that no action of this version changes (001 FR-18).
- FR-4: THE SYSTEM SHALL apply to the creation of a stored universe the validation rules of 001 FR-5 to FR-10 on the trimmed values (name required and at most 120 characters, description at most 2000 characters and optional, mode `READER` or `AUTHOR`, characters counted as Unicode code points); IF a rule fails, THEN THE SYSTEM SHALL store nothing and SHALL report a validation failure with the issues keyed by field (002 FR-34), and the interface SHALL keep the values typed (001 FR-10).
- FR-5: IF the name or the description contains the null character or an invalid Unicode sequence (for example a lone surrogate), THEN THE SYSTEM SHALL store nothing and SHALL report a validation failure on that field, not an infrastructure failure.
- FR-6: THE SYSTEM SHALL keep a stored universe, with all its data, after the page is reloaded, after the person signs out and signs in again, and after the application and its stored data are restarted (verified with an integration test).
- FR-7: IF the universe cannot be stored because of a failure, THEN THE SYSTEM SHALL store nothing (no partial universe), SHALL answer with the generic infrastructure failure of 002 FR-36 and SHALL show a generic message in the form with the typed values kept and the form usable again.
- FR-8: IF a creation has no usable answer (the connection is lost, the answer cannot be read, or no answer arrives within 30 seconds counted from the submission), THEN THE SYSTEM SHALL show a message saying that the result is unknown and that the universe may have been created, SHALL keep the typed values and, once the request has ended, SHALL make the form usable again. The message of FR-7 and the message of this requirement SHALL differ both in their text and in their message code. WHILE the request is still alive after the 30 seconds, THE SYSTEM SHALL keep the form blocked against a new submission and the rest of the workspace usable; WHEN the answer arrives late and the universe was created, THE SYSTEM SHALL apply it as a normal success (the universe is added to the list and selected, FR-24) and replace the unknown-result message with a confirmation.
- FR-9: WHILE a creation is waiting for its answer, THE SYSTEM SHALL not send a second creation from the same form, however the person tries to repeat it (a second click, a repeated Enter, or both), so that one repeated action ends with exactly one universe (001 FR-19). Two creations submitted on purpose, even with the same name, create two universes (FR-22).
- FR-10: IF a creation reaches a missing or expired session, THEN THE SYSTEM SHALL create nothing, SHALL keep the typed values in the form and SHALL show a message asking the person to sign in again, with the way to do it; after signing in again the form starts empty (FR-18). IF the session of a creation is an unverifiable session, THEN THE SYSTEM SHALL create nothing, SHALL keep the typed values and SHALL show the generic failure message of FR-7, without treating the person as signed out (FR-33).

Listing and ownership
- FR-11: WHEN a signed-in person opens the workspace, THE SYSTEM SHALL list in the universe navigation exactly their own universes, in creation order (oldest first) and, between universes created at the same instant, by universe identifier ascending, so that the order is always the same.
- FR-12: THE SYSTEM SHALL never include a universe of one account, or any datum of it (name, description, mode, existence, count), in anything shown to or answered to another account.
- FR-13: WHEN a universe is created, THE SYSTEM SHALL list it with the other own universes of the creator (001 FR-17) and SHALL leave the own universes of every other account unchanged.
- FR-14: THE SYSTEM SHALL not show the sample universes of the earlier versions nor any content tied to them, and SHALL not keep any universe only in the memory of the page; the universes shown are exactly the stored ones.
- FR-15: THE SYSTEM SHALL keep in the workspace the sections that showed sample content (graph, timeline, entities, works, sources and reading position) and the navigation to them, and WHILE a stored universe is selected, SHALL show in each of them an honest empty state; those states offer no button or link to an action that does not exist, and no sample data is shown.
- FR-16: WHILE a person has no own universe, THE SYSTEM SHALL select none and SHALL show an empty state that says that there are no universes yet and invites the person to create the first one, with the creation form reachable from it.
- FR-17: WHILE the selected universe is empty, THE SYSTEM SHALL show the honest empty state of a new universe (changes 001 FR-22), saying that the universe is empty and that works, entities and relationships arrive in future versions. In this version every stored universe is empty.
- FR-18: WHEN a sign-up succeeds, a sign-in succeeds or a person signs out, THE SYSTEM SHALL clear all account-scoped screen state (selected universe, loaded list, open form with half-typed values, notices and messages), so that only the universes of the account now in use are shown and nothing of the earlier account remains (003 FR-32 keeps applying). WHEN another open tab detects that the session is no longer the one of the account whose state it shows, THE SYSTEM SHALL send nothing from that state under the new account (no creation, no remembered universe). Only things that do not belong to the account (the accessibility preferences kept in the browser) stay.
- FR-19: THE SYSTEM SHALL show the name and the description of a universe always as plain text, never interpreted as markup, without breaking the layout: a long name is shortened or wrapped inside its area and its full text stays accessible to the person, and direction-control or invisible characters cannot alter the order or direction of the text around them (as in 003 FR-26).
- FR-20: THE SYSTEM SHALL list every own universe, with no pagination and no limit on their number in this version; WHEN the list is longer than its area, THE SYSTEM SHALL let the navigation scroll inside its own area without breaking the page.

Duplicate names
- FR-21: WHILE the person types a name whose comparable name equals that of one of their own universes, THE SYSTEM SHALL show the duplicate-name warning of 001 FR-11; WHEN the name matches no own universe, THE SYSTEM SHALL show no warning (001 FR-13). The comparison uses the comparable name of 001 after normalizing the text to its composed form, and is made against the stored data at the moment of comparison, so that a universe created from another tab counts; the stored name keeps the text as written, apart from trimming.
- FR-22: WHILE the warning is shown, THE SYSTEM SHALL still allow creating the universe on submit, with no second warning or confirmation (001 FR-12); creation is never blocked by a duplicate name.
- FR-23: THE SYSTEM SHALL compare a typed name only with the own universes of the acting user; a name that exists only in another account SHALL show no warning, so that the warning never reveals what another account has created.

Selection and last-used universe
- FR-24: WHEN a universe is created, THE SYSTEM SHALL select it (001 FR-21) and SHALL store it as the remembered universe of the account.
- FR-25: WHEN a person selects one of their own universes, THE SYSTEM SHALL store it as the remembered universe of the account.
- FR-26: WHEN the workspace is opened (a page load, a reload, after signing in or signing up, or in a browser or device where the account had not been used), THE SYSTEM SHALL select the remembered universe of the account if it is available.
- FR-27: IF the account has no remembered universe, or the remembered universe is not available, THEN THE SYSTEM SHALL select the oldest own universe (the first in the order of FR-11); IF the account has no own universe, THEN FR-16 applies. THE SYSTEM SHALL not show an error because the remembered universe is not available.
- FR-28: THE SYSTEM SHALL keep the remembered universe with the account, not with the browser or the device, so that another browser or device of the same account selects the same universe (FR-26), and SHALL never show it to, nor let it affect, any other account.
- FR-29: THE SYSTEM SHALL keep the selected universe out of the web address in this version: the selection lives on screen and in the remembered universe of the account, no address names a universe, and no return destination carries a universe identifier. Addresses that name a universe belong to a later spec.
- FR-30: IF storing the remembered universe fails for a reason other than a missing session (an infrastructure failure, no answer within 30 seconds, or an identifier that is stale or belongs to another account), THEN THE SYSTEM SHALL return to the client a typed error with its stable code (FR-34) in every case, SHALL not show any error message to the person, SHALL keep working with the selection the person made in the current page, SHALL record the failure in the server log (002 FR-36), and SHALL never fail or undo a creation because of it; the next opening of the workspace follows FR-26 and FR-27 with what is stored. IF the failure is the authentication error of a missing session, THEN FR-32 applies instead and the person is treated as signed out.

Access and errors
- FR-31: THE SYSTEM SHALL apply the same universe rules to every entry point through which a universe operation can arrive (the screens of the application and any direct call), running it only for the acting user given by the acting-user check, and every query of universes SHALL be limited to the own universes of that user.
- FR-32: IF a universe operation is called without a valid session, THEN THE SYSTEM SHALL fail with the authentication error of 002 FR-20 (result shape of 002 FR-33 to FR-39) by itself, independently of the page access guard and of the page the call comes from (including the public pages), and SHALL not read or change any universe or any remembered universe; the screen SHALL treat the person as signed out and take them to the sign-in page, as spec 003 does, with the exception of a creation (FR-10), which first keeps the typed values and offers the sign-in.
- FR-33: IF the session of a universe operation cannot be checked because of a failure (an unverifiable session, 002 FR-22), THEN THE SYSTEM SHALL fail with the infrastructure failure error, SHALL not run the operation and SHALL not treat the person as signed out.
- FR-34: THE SYSTEM SHALL answer every failed universe operation with exactly one error kind, a stable code and the result shape of 002 FR-33 to FR-39, with a generic message for infrastructure failures and unknown errors that contains no stack trace, query, credential or internal name; what the person sees on screen is decided by the requirement of each case (for example FR-7, FR-8, FR-10 and FR-30), not by the error returned.
- FR-35: IF a universe operation receives a universe identifier that is malformed, empty or missing, THEN THE SYSTEM SHALL report a validation error; IF the identifier is well formed but belongs to another account or does not exist, THEN THE SYSTEM SHALL report a not found error that is the same in both cases (same kind, code, message and shape), so that the existence of the universe is not revealed.
- FR-36: THE SYSTEM SHALL not place the data of any stored universe (names, descriptions, modes, identifiers or the remembered universe) in anything served without a session, including the static files of the application (the public resources of spec 003).
- FR-37: THE SYSTEM SHALL not send to the browser, in any page, static file or answer, any of the sample data of the earlier versions (the sample universes and their works, entities, relationships, events, sources and reading positions), for a signed-in person or a signed-out one, and SHALL not leave any source of that data reachable from the browser, so that the accepted risk of spec 003 about public files that contain sample data no longer exists.

## Non-functional requirements

- NFR-1: THE SYSTEM SHALL give the same results for the same scenarios whichever way universes are kept. Verifiable: the scenarios (valid creation, each validation failure, duplicate-name detection, listing by owner, isolation between two accounts, the remembered universe and its fallbacks) pass unchanged against two interchangeable ways of keeping universes, as in 001 NFR-1 and 002 NFR-2.
- NFR-2: THE SYSTEM SHALL apply the same universe rules (validation of name, description and mode, ownership and access) to every entry point through which a universe can be created or read, with a single definition of the rules (001 NFR-5). Verifiable: the same invalid and valid inputs give the same outcomes through the form and through a direct call.
- NFR-3: THE SYSTEM SHALL isolate accounts: verifiable with two accounts, where no universe operation of one ever returns, changes or confirms the existence of a universe or a remembered universe of the other. These account-isolation tests are the protection tests of this feature (see Spoiler impact).
- NFR-4: THE SYSTEM SHALL keep the creation form, the empty states and the navigation usable only with the keyboard (for the form, 001 NFR-2; for the navigation and the empty states, the same: every control reachable and operable, in a logical order, with no keyboard trap), with visible labels and errors linked to their fields (001 NFR-3), with a contrast of at least 4.5:1 for text and the existing focus-visibility standard (001 NFR-4), and SHALL announce to assistive technologies the messages of FR-7, FR-8 and FR-10 in the same way as the messages of 003 NFR-2.
- NFR-5: THE SYSTEM SHALL cover the flows with automated browser tests that drive the application as a person would: creating a universe and finding it after a reload and after signing out and in, two accounts that do not see each other's universes, a name that exists only in another account (no warning), the remembered universe across two independent browser contexts of the same account, the fallbacks of FR-27, the empty state of a new account, the creation failures of FR-7 and FR-8, a late success after the unknown-result message, a session that expires while creating (FR-10) and two tabs with an account change (FR-18). The means that tests use to provoke a failure of the stored data stay unavailable in a production configuration (003 NFR-8).
- NFR-6: THE SYSTEM SHALL keep the creation form, the empty states and the navigation usable at a viewport width of 320 CSS pixels, with a name of 120 characters and a description of 2000 characters, with nothing scrolling horizontally outside the navigation's own area and every control reachable.

## Spoiler impact

None. A universe has no works, narrative units, reading progress or spoiler boundaries yet, and the remembered universe is a pointer, not narrative information. Nothing created or read here is revealed progressively. The mode (`READER` or `AUTHOR`) is stored and stays fixed, and no spoiler filtering is applied or testable in this feature.

The spoiler protection suite is therefore explicitly not applicable to this feature (there is nothing with a spoiler boundary to filter); it starts in Phase 4. In its place this spec requires account-isolation tests (NFR-3): what one account must never see of another is checked at the level of the operations and in the browser.

What this feature does prepare: every later read of narrative information depends on knowing, in the backend, which account is acting, which universe it asks for and that the universe is its own. FR-2, FR-31, FR-32, FR-35 and NFR-3 are that foundation.

## Edge cases

- Account with no universes (new account): empty state that invites creating the first one; nothing selected (FR-16). The sections of the workspace show no content and no sample data.
- First universe created: it is selected and remembered (FR-24); reload selects it (FR-26).
- Several universes, user selects the second and reloads: the second is selected (FR-25, FR-26). Signing in from another browser: the second is selected (FR-28).
- Remembered universe not among the own universes (for example a stale or forged value): the oldest own universe is selected and no error is shown (FR-27); the stale value is replaced when the person next creates or selects a universe.
- Request to remember a universe of another account or a universe that does not exist: not found, the same answer in both cases, nothing stored, nothing shown to the person (FR-35, FR-30). A malformed, empty or missing identifier: validation error (FR-35).
- Request that carries another account's universe identifier or owner data together with a valid session: the data is ignored, acts as the account of the session and finds nothing (FR-2).
- Universe operation called without a session from a public page, or forged without a browser: authentication error, nothing read or changed (FR-32).
- Session cannot be checked while listing or creating: infrastructure failure, nothing is run, the person is not treated as signed out (FR-33).
- Session expired while the person fills the form: submitting creates nothing, the typed values stay in the form with a message asking to sign in again; after signing in again the form starts empty (FR-10, FR-18).
- Name of exactly 120 characters (code points) is accepted; 121 is rejected; whitespace-only name is rejected; description of exactly 2000 characters is accepted; 2001 is rejected; description with only whitespace is none; whitespace around name and description is not counted (001 edge cases, FR-4). An emoji counts as one character; a letter followed by a combining accent counts as two.
- Name or description with the null character or a lone surrogate: validation error on the field (FR-5).
- Name and description with markup, emoji or non-Latin characters: stored as written except for the trimming, shown as plain text (FR-19).
- Very long name or description, or text with direction-control characters: wrapped or shortened inside its area, layout intact, full name accessible (FR-19).
- Same name as an own universe, differing only in case, accents, spacing or Unicode composition: warning while typing, creation allowed, both exist (FR-21, FR-22).
- Same name as a universe of another account: no warning (FR-23). Same name as a universe the same account created a moment ago in another tab: warning (FR-21).
- Two universes with the same name created one after the other: two universes, different identifiers, listed in creation order (FR-9, FR-11). Two universes created at the same instant are listed by identifier ascending (FR-11).
- Double click or repeated Enter on "Create": one submission, one universe (FR-9).
- Creation sent from two tabs at the same moment with the same name: both are created, which is the same as two deliberate creations; the duplicate warning is only a warning.
- Two tabs of the same account: each keeps its own current selection until it is reloaded or the person selects again; the remembered universe is the last one stored (last write wins). A list already loaded in a tab can be out of date until the page is reloaded. Accepted.
- Person signs out and another signs in on the same device, also with a second tab open: only the second account's universes are shown; nothing of the first remains, and the old tab sends nothing under the new account (FR-18).
- Creation succeeds but the remembered universe cannot be stored: the universe exists and is selected on screen; no error is shown; after a reload the previous remembered universe (or the oldest) is selected (FR-30).
- Failure while storing a new universe: nothing is stored, generic message, typed values kept (FR-7). No answer within 30 seconds: message of unknown result, values kept, form blocked while the request is alive and usable again when it ends (FR-8). The answer arrives late with the universe created: the universe is added and selected and the unknown-result message becomes a confirmation (FR-8). A retry after an unknown result can create a second universe if the first was stored; the duplicate warning then appears while typing the name.
- Universes created in memory under spec 001 before this version is deployed: they were never stored and are gone; nothing is migrated.
- Many universes (hundreds): all are listed, the navigation scrolls in its own area, the page does not break (FR-20).
- Narrow viewport (320 px): the form, the empty states and the navigation stay usable (NFR-6).
- A person opens a bookmarked or typed address that tries to name a universe: the address carries no meaning for the selection (FR-29); no universe-specific addresses exist.

## Out of scope

Checked against `docs/roadmap.md`, `docs/open-decisions.md` and `CLAUDE.md`.

Belongs to the next spec (Phase 1):
- Editing or renaming a universe, sending it to the trash, restoring it, permanent purge, trash screens and the transaction support those need (spec 005, with OD-6 decided on 2026-11-06). This feature offers no action that deletes or changes a universe.

Deferred or undecided:
- Sharing, collaboration, roles and administrators: no sharing exists, so no universe is ever visible to another account; the authorization error kind stays reserved (002 FR-38).
- Addresses (deep links) that name a universe, and per-universe links of any kind: a later spec (FR-29).
- Import and export of universes (OD-15) and file uploads or cover images (OD-11).
- Pagination of the universe list, a limit on the number of universes per account and abuse protection: this version imposes none (FR-20); the limit and the abuse limits are deferred to Phase 5 together with the deployment (OD-9), as in specs 002 and 003.
- Deployment and production configuration (OD-9) and a public API for external consumers (OD-14).
- Seeding predefined relationship types or any content when a universe is created (decided out of scope in spec 001; confirmed in Phase 2).
- Works, narrative units, entities, relationships, events, sources, reading progress, spoiler filtering (Phases 2 to 4) and AI (Phase 6).
- The sample entities, graph, timeline, works and sources: retired from the application by this feature (known consequence, see Context). Recovering or rebuilding that content, and the interface that shows it, belongs to Phases 2 and 3; the sections stay only with an honest empty state (FR-15).
- Moving the accessibility preferences from the browser to the account: stays deferred, not assigned to any spec (see "Low-severity points kept for later review"). The remembered universe is the only new datum kept per account here.
- Changes to the engine or the screens of accounts (specs 002 and 003); the text of those specs and of spec 001 is made consistent with this one at the closing (see Completion criteria), without changing their requirements.

Accepted risks (user decisions):
- Session cookie race (decision D-V1-4 of spec 003, kept as accepted by the user on 2026-11-12): with two requests in flight that carry the same dead session cookie, the later response can replace the new valid cookie. The worst effect is that a person sees a spurious sign-out or the message of 003 FR-14 and signs in again. The risk fails closed: it can only leave a person without a session, never lets anybody act as another account or see or change the universes of another account, because every universe operation takes the acting user only from a valid session (FR-2, FR-31, FR-32) and gives the same not found answer for other accounts' universes (FR-35). It never changes the ownership of a universe.
- Two tabs or devices of one account that select a universe at the same moment: the last one to be stored is remembered (last write wins), and each tab keeps its own selection until reload.
- Two creations from two tabs at the same moment, or a retry after an unknown result, can leave two universes with the same name; the duplicate warning is only a warning (001 FR-12).
- The list of universes has no limit and no pagination (FR-20): a very large list is accepted in this version.

## Completion criteria

- Every FR and NFR above is covered by a passing automated test (unit, integration or browser), except the accessibility items of NFR-4, which are checked manually by the user during the validation. There is no validation report file: manual checks are a convention of the user, who tells the agent about any problem found during them.
- A signed-in person can create a `READER` universe and an `AUTHOR` universe and see each one selected with the empty state right after creation; after a reload and after signing out and in, both are still listed with the same name, description, mode and order (checked in a browser test). That a universe survives a restart of the application and its stored data (FR-6) is checked with an integration test.
- The validation cases of 001 (empty and whitespace-only name, 121-character name, 2001-character description, invalid mode, 120 and 2000 as accepted limits), the trimming before measuring, the counting by code points (emoji and combining accents), the null character and the lone surrogate give the same outcomes through the real form and through a direct call; the typed values are kept after a failure and nothing is stored. A description with only whitespace is saved as no description.
- A duplicate name among one's own universes shows the warning while typing (also for a universe created from another tab and for a name that differs only in case, accents, spacing or Unicode composition) and still creates the universe with no second warning; a name that exists only in another account shows no warning.
- Two accounts on the same application each see only their own universes; no operation of one returns, confirms or changes anything of the other (verified with two accounts at the level of the operations and in a browser test); a universe identifier of another account and an identifier that does not exist give the same not found answer, and a malformed, empty or missing identifier gives a validation error. These account-isolation tests stand in for the spoiler suite, which is not applicable (Spoiler impact).
- A universe operation called without a valid session, also from a public page or forged without a browser, fails with the authentication error and reads or changes nothing, and the screen takes the person to sign-in; when the session cannot be checked it fails with the infrastructure failure, runs nothing and does not treat the person as signed out. A creation with an expired session creates nothing, keeps the typed values and asks to sign in again; with an unverifiable session it creates nothing, keeps the values and shows the generic failure message.
- An owner or account identifier sent by the client in a creation or in a request to remember a universe is ignored without error; the universe is owned by the account of the session.
- A new account sees no universe and the empty state that invites creating the first one; the sample universes appear nowhere in the workspace. For any stored universe, the sections that showed sample content (graph, timeline, entities, works, sources, reading position) are reachable from the navigation and show an honest empty state with no button or link to a missing action.
- The last-used universe is remembered when a universe is created and when one is selected, and is selected again after a reload and in an independent browser context of the same account; with a missing or not available remembered universe the oldest one is selected with no error; with no universes the empty state is shown; the remembered universe of one account never appears in another.
- When storing the remembered universe fails (infrastructure failure, timeout, stale or foreign identifier), the selection of the page still works, no error message is shown, a typed error with a stable code is returned to the client, the failure is logged and the creation is not undone; when the failure is a missing session, the person is treated as signed out.
- A failure while storing a universe stores nothing and shows the generic message with the values kept; a creation with no usable answer shows the unknown-result message, with a text and a code different from the generic one, and lets the person retry once the request has ended; a late successful answer adds and selects the universe and replaces the notice with a confirmation; a repeated click or Enter sends one submission and creates one universe.
- After signing out and another person signing in on the same device, only the second account's universes are shown and no account-scoped state of the first remains (selected universe, list, half-typed form, notices); a second tab open during the change sends nothing under the new account.
- Names and descriptions with markup, direction-control characters and very long text are shown as plain text without breaking the layout, with the full name accessible; the form, the empty states and the navigation are usable at 320 px; a list of many universes scrolls inside the navigation's own area.
- The files served without a session (the static files of the application) contain no data of any stored universe (checked in a browser test or a response test).
- None of the sample data appears in any page, static file or answer, with or without a session: the check searches the served responses and the served files for a unique marker of each type of sample data (universes, works, entities, relationships, events, sources and reading positions), and checks that no source of sample data is reachable. The markers are chosen so that a person cannot reproduce them by accident: a universe the user creates with the same name as a sample universe does not count as a leftover. The accepted risk of spec 003 about public static files that contain sample data is closed.
- The creation scenarios pass unchanged against two interchangeable ways of keeping universes (NFR-1), and the existing tests of specs 001 to 003 keep passing without being deleted or relaxed; if one has to change because the sample universes and the in-memory creation are gone, the change is reported to the user.
- At closing, the user is told which requirements and texts of specs 001, 002 and 003 stopped being true (at least those listed in Context: 001 FR-24, FR-22 and NFR-1, 003 FR-31 and FR-32, the definition of clean start, the edge cases and accepted risks about sample data) and the text of those specs is made consistent with this spec; how (a note in each spec or an edit) is decided in the plan or at the closing.
- At closing, the documentation records the change: the Phase 1 row of `docs/roadmap.md` and the "Current status" of `CLAUDE.md` state that the sample content was removed and that the remembered universe exists, and `.claude/rules/data-model.md` records where the remembered universe is stored. The pointer about the accessibility preferences (Low-severity points) is recorded in `docs/open-decisions.md`.
- The creation form, the empty states and the navigation are usable by keyboard and screen reader and have no accessibility regressions (manual check by the user).

## Notes for the plan

Pointers for the plan, not decisions.
- The remembered universe is a new datum kept per account, and stored universes themselves are new stored data: both are a schema change that the plan must mark "needs approval" (CLAUDE.md, Limits, ASK FIRST), with the migration applying cleanly on an empty database.
- The plan decides how to make the text of specs 001 and 003 consistent (Completion criteria), how the unique sample-data markers are chosen, and how the screen reads the authentication error of FR-32 for the creation form (FR-10) and for the other operations.
- The plan should record where in `.claude/rules/data-model.md` the remembered universe is documented.

## Low-severity points kept for later review

Defaults applied by the user's decision (2026-11-12), not reviewed in depth. They are listed so they can be revisited if any becomes a problem.
- Double submission (QA 1.10): only the form prevents it (FR-9). Two deliberate direct duplicate requests create two universes; a single submission, even retried by the system, creates exactly one.
- Restart persistence (QA 1.11): FR-6 is verified with an integration test (stated in FR-6 and in the completion criteria).
- Accessibility (QA 1.12): keyboard-only use of the navigation and the empty states, and a measurable contrast of 4.5:1 for text, are in NFR-4; the reference to 001 NFR-2 covers the form only.
- Returned versus seen (QA 2.3): covered by the wording of FR-30 and FR-34 (what is returned is always a typed error; what the person sees is decided per case).
- Sample-content sections (QA 2.4): covered by FR-15.
- Other tabs (QA 3.8): covered by FR-18.
- Deleted universes (QA 3.9): universes sent to the trash by spec 005 do not count as own for the remembered universe nor for the duplicate warning (Definitions).
- Out-of-date list (QA 3.10): a list already loaded in another tab can be out of date; accepted, resolved by reloading.
- Accessibility preferences (QA 4.3): the deferred move of the accessibility preferences from the browser to the account has no owner yet. Pointer: record it in `docs/open-decisions.md` during the closing (this spec does not edit that file).
- Behavior wording (QA 6.1): NFR-1, NFR-2 and FR-31 state behavior (same results whichever way universes are kept; the same universe rules at every entry point) without describing architecture.
- QA 6.2: no change.

## Open questions

None.
