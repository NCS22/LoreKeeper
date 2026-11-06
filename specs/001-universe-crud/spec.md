# Spec 001 — Create Universe

Status: implemented

## Context and goal

LoreKeeper organizes knowledge in universes: isolated knowledge bases, one per fictional world. Today the application only shows two sample universes and offers no way to start a new one.

This feature lets the user create a new, empty universe by giving it a name, an optional description and a mode (`READER` or `AUTHOR`). The goal is for a reader or an author to start a fresh knowledge base that is separate from every other universe.

In this version the application has no backend, no accounts and no stored data. A created universe lives only while the application is open and is lost when the page is reloaded. This is intentional: the feature delivers the creation experience and its rules now.

Design intent for later: creating a universe must not depend on where universes are kept. A real storage can then be added without changing how creation behaves. Nothing is built for that storage in this version; it only must not be made harder (see NFR-1).

## Users

- Reader: follows dense works and wants to remember what they read without spoilers. Typically creates `READER` universes.
- Author: tracks the details of their own works. Typically creates `AUTHOR` universes.

Both use the same creation flow. The mode is chosen at creation.

## User stories

- US-1. As a reader, I want to create a universe with a name, a description and a mode so that I can start a knowledge base that is isolated from my other universes.
- US-2. As an author, I want to create a universe in `AUTHOR` mode so that everything I record is always visible to me.
- US-3. As a user, I want to understand the difference between the two modes before choosing so that I pick the right one, knowing it cannot be changed later.
- US-4. As a user, I want to be warned when my new universe has the same name as one I already have so that I do not create one by mistake, while still being able to do it on purpose.
- US-5. As a user, I want the new universe to be selected right after creation so that I can continue working in it.

## Definitions

- **Universe**: an isolated knowledge base with a name, an optional description and a mode.
- **Mode**: `READER` (spoiler protection on) or `AUTHOR` (everything visible; spoiler boundaries are still recorded for chronology).
- **Comparable name**: a universe name with letter case, accents and surrounding or repeated whitespace ignored. Two names are "the same" when their comparable names are equal. Example: "  The Ëmber   concordat " and "the ember concordat" are the same.
- **Empty universe**: a universe with no works, no entities, no relationships, no events, no sources and no relationship types.

## Functional requirements

Creation form
- FR-1: WHEN the user chooses "New universe", THE SYSTEM SHALL show a form with a name field, a description field and a mode choice.
- FR-2: WHEN the form is shown, THE SYSTEM SHALL have `READER` preselected as the mode and the name and description empty.
- FR-3: THE SYSTEM SHALL show, next to the mode choice, a short explanation of both modes: `READER` protects the user from spoilers, and `AUTHOR` shows everything while still recording boundaries for chronology.
- FR-4: THE SYSTEM SHALL tell the user in the form that the mode cannot be changed after the universe is created.

Validation
- FR-5: IF the name is empty or contains only whitespace, THEN THE SYSTEM SHALL not create the universe and SHALL show an error on the name field.
- FR-6: IF the name, after removing surrounding whitespace, is longer than 120 characters, THEN THE SYSTEM SHALL not create the universe and SHALL show an error on the name field stating the maximum length.
- FR-7: IF the description is longer than 2000 characters, THEN THE SYSTEM SHALL not create the universe and SHALL show an error on the description field stating the maximum length.
- FR-8: THE SYSTEM SHALL accept an empty description.
- FR-9: IF the mode is neither `READER` nor `AUTHOR`, THEN THE SYSTEM SHALL not create the universe.
- FR-10: WHEN validation fails, THE SYSTEM SHALL keep the values the user typed and SHALL not create any universe.

Duplicate names
- FR-11: WHILE the user types a name whose comparable name equals that of an existing universe, THE SYSTEM SHALL show a warning, at the moment of typing, that a universe with that name already exists.
- FR-12: WHILE the duplicate-name warning is shown, THE SYSTEM SHALL still allow the user to create the universe, and WHEN the user submits the form, THE SYSTEM SHALL create it without a second warning or any additional confirmation step.
- FR-13: WHEN the name does not match any existing universe, THE SYSTEM SHALL show no duplicate-name warning.

Creation
- FR-14: WHEN the user submits a valid form, THE SYSTEM SHALL create a new empty universe with the given name (surrounding whitespace removed), the given description (or none) and the chosen mode.
- FR-15: WHEN a universe is created, THE SYSTEM SHALL give it an identifier different from every other universe's, and creation and last-update timestamps with the same value in UTC.
- FR-16: WHEN a universe is created, THE SYSTEM SHALL create it with no cover image.
- FR-17: WHEN a universe is created, THE SYSTEM SHALL list it together with the existing universes in the universe navigation.
- FR-18: THE SYSTEM SHALL keep the mode of a universe fixed after creation; no action in this version changes it.
- FR-19: WHEN the user submits the same valid form more than once in quick succession (double click or repeated key press), THE SYSTEM SHALL create exactly one universe.
- FR-20: WHEN the user cancels or closes the form without submitting, THE SYSTEM SHALL create nothing and SHALL leave the current selection unchanged.

After creation
- FR-21: WHEN a universe is created, THE SYSTEM SHALL select it as the current universe.
- FR-22: WHILE the current universe is empty, THE SYSTEM SHALL show an empty state that says the universe has no content yet and invites the user to continue.
- FR-23: WHEN a universe is created, THE SYSTEM SHALL leave all other universes and their content unchanged.
- FR-24: WHILE the application stays open, THE SYSTEM SHALL keep the created universe available; WHEN the page is reloaded, THE SYSTEM SHALL no longer show it.

## Non-functional requirements

- NFR-1: THE SYSTEM SHALL keep the rules and outcomes of universe creation independent of where universes are stored. Verifiable: the same creation scenarios (valid creation, each validation failure, duplicate-name detection) pass unchanged against two different interchangeable ways of keeping universes. No code for a real storage is added in this version.
- NFR-2: THE SYSTEM SHALL let the creation form be completed and submitted using only the keyboard.
- NFR-3: THE SYSTEM SHALL associate every form field with a visible label and SHALL expose each validation error and the duplicate-name warning to assistive technologies, linked to its field.
- NFR-4: THE SYSTEM SHALL meet the application's existing contrast and focus-visibility standards in the form, including the error and warning states.
- NFR-5: THE SYSTEM SHALL apply the same validation rules for name, description and mode wherever a universe can be created, with a single definition of those rules.

## Spoiler impact

None. Creating a universe does not read or write narrative information: it has no works, narrative units, reading progress or spoiler boundaries, and nothing created here is revealed progressively.

The chosen mode only determines how future features will behave: `READER` universes will hide bounded information beyond the user's reading progress, and `AUTHOR` universes will show everything. No spoiler filtering is applied or testable in this feature. The mode's fixed nature (FR-18) avoids any inconsistency in spoiler visibility caused by switching modes.

## Edge cases

- Name of exactly 120 characters: accepted. 121 characters: rejected.
- Name with leading and trailing spaces: saved without them; the 120 limit applies after trimming.
- Name with only spaces or empty: rejected.
- Name equal to an existing one except for case, accents or repeated inner spaces: warning shown while typing, creation allowed on submit with no further warning.
- Name edited so that it stops matching an existing universe: the warning disappears (FR-13).
- Two universes with the exact same name created one after the other: both exist, with different identifiers.
- Name with emoji, non-Latin characters or punctuation: accepted as long as it is not whitespace only.
- Description of exactly 2000 characters: accepted. 2001: rejected. Only whitespace: treated as no description.
- Description with line breaks: accepted and preserved.
- Submit pressed twice quickly: one universe (FR-19).
- Form closed with unsaved text: nothing is created; reopening starts clean (FR-2).
- Page reloaded after creating: the universe is gone (FR-24); this is expected in this version.
- Creating several universes in a row: each is added and the latest one is selected.

## Out of scope

Checked against `CLAUDE.md` and `.claude/rules/*`.

- Editing or renaming a universe.
- Switching the mode of an existing universe.
- Deleting a universe, trash and restore, permanent purge.
- Sharing a universe.
- Importing a universe or its content.
- Cover image (any form, including external image URLs) and file uploads.
- Saving universes beyond the current page session; any database, server or backend.
- Accounts, sign-in, ownership by a user and per-user separation of universes.
- Seeding predefined relationship types or any other content when a universe is created (decided out of scope for this version; the list of types is confirmed in Phase 2).
- Creating works, narrative units, entities, relationships, events or sources.
- Reading progress and spoiler filtering.
- AI features.

## Completion criteria

- Every FR and NFR above is covered by a passing automated test, or, for the accessibility items (NFR-2 to NFR-4), by a manual check done by the user. There is no validation report file: manual checks are a convention of the user, who tells the agent about any problem found during them.
- A user can open the form, create a `READER` universe and an `AUTHOR` universe, and see each one selected with the empty state right after creation.
- A duplicate name shows a warning while the name is typed and still creates the universe on submit, with no second warning.
- Reloading the page removes the created universes and shows only the sample ones.
- The sample universes and their content are unchanged by creating a new one.
- The universe navigation, the form and the empty state are usable by keyboard and have no new accessibility regressions.

## Open questions

None.
