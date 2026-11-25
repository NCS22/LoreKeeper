# Spec 006 — Knowledge items: first creation and viewing

Status: approved

## Context and goal

Universes are real and stored (spec 004), but they are empty: the works area, the entity list and the details panel show honest empty states, and nothing can be added to them. The user wants a small, early version of the knowledge core: create the items, see how they look and see how they connect, before building the screens to edit, delete and manage them.

This feature adds only the basics of creation and simple viewing: a minimal work with its chapters or episodes, entities with an optional first knowledge fragment, and directed relationships between entities, chosen from a predefined list of relationship types. Everything is created together with its spoiler boundary, as the data model requires, and everything is shown as plain text in the works area, the entity list and the details panel.

**Decisions of the user (2026-11-25), recorded as decided.**
1. **Order.** This spec goes ahead of the roadmap order. It is an intentional, user-approved advance of part of Phase 2 (works, entities, relationships) before Phase 1 is complete (roadmap, "Maintenance": moving a phase forward is the user's decision). As a consequence, the rule that the open decisions of Phase 2 (OD-1, OD-2, OD-7, OD-19) are closed before the first spec of that phase is lifted for this spec only; those four stay open and nothing here decides them (see Out of scope). The spec takes number 006; the universe lifecycle (edit, trash, restore, purge, OD-6), which was spec 006, becomes spec 007, and the documents that name it are updated at the closing (Completion criteria).
2. **Works.** A minimal work creation exists only so that entities, fragments and relationships can carry their spoiler boundary, which is required. A work has a title, a medium and a number of units that are created in bulk, "1 to N", labelled with the plain number. OD-1 is untouched: a boundary stays required.
3. **Entities.** An entity has a name, a type (the eight types of the data model) and an introduction boundary. Optionally one first knowledge fragment is created together with it. Attributes stay empty (OD-7 untouched).
4. **Relationships.** A directed relationship between two different entities of the same universe, with one predefined relationship type, a status and a boundary.
5. **OD-16 decided.** The seed of eight predefined relationship types is accepted as proposed (FR-3), present in every universe, including the ones created before this spec. The plan of this spec records the decision and removes OD-16 from `docs/open-decisions.md`.
6. **Viewing.** The entity list of the selected universe, and the details panel of the selected entity with its first fragment and its relationships written as text in both directions. The works area shows the created works. The knowledge graph is not part of this spec; the user wants it later, in Phase 3.
7. **Small.** The user wants few tasks and the basics only. The list of what stays out is in "Out of scope".

**Dependency.** This spec depends on spec 004 and uses its patterns by reference, without restating them (called "004 FR-x" below):
- 004 FR-2, FR-31 to FR-35 and NFR-3: the acting account taken only from the session, the same rules at every entry point, the authentication and infrastructure failures, typed errors with stable codes, "another account's or nonexistent resource gives the same not found answer, a malformed identifier gives a validation error", and the isolation tests between two accounts.
- 004 FR-4, FR-5 and FR-19: text trimmed and measured in Unicode code points, the null character and invalid Unicode as validation errors, text always shown as plain text without breaking the layout.
- 004 FR-7 to FR-10: a failed store keeps nothing and shows a generic message with the typed values kept; a creation without a usable answer and a late answer; no second submission while one is waiting; an expired session keeps the typed values and offers to sign in again, an unverifiable session shows the generic message (applied here to the three new forms).
- 004 FR-11: listing in creation order, ties by identifier.
- 004 FR-18: a change of account clears the account-scoped screen state, which now also covers the new forms and the selected entity.
- 004 NFR-4 and NFR-6: keyboard use, linked errors, contrast, announcements and 320 px.

**What this feature changes of spec 004.**
- 004 FR-15 and FR-17 ("every stored universe is empty"; the works area, the entity list and the details panel are always an honest empty state) no longer hold: those three sections show the created content, and keep an honest empty state while they have nothing to show. The graph view and the timeline entry stay as they are in 004 FR-15, and the graph view's text speaks only about the graph.
- The details panel text of 004 FR-15 that says knowledge and relationships arrive in future versions is no longer true: the panel says only that events, sources and reading positions arrive in future versions.
- The universe-level empty state of 004 FR-17 ("the universe is empty and works, entities and relationships arrive in future versions") is removed. The empty states of FR-2, FR-9 and FR-10 replace it, and no text says that works, entities or relationships are not available.
- 004 Out of scope, "Seeding predefined relationship types ... when a universe is created": replaced by FR-3. A new universe is stored with its relationship types (FR-3); it still has no work, entity or relationship.

**Hand-off to the next spec.** The lifecycle spec (now 007) must trash, restore and purge these new items with their universe, and the open decision on trashing a work that other items point to (OD-19) becomes relevant there.

## Users

- Reader: follows dense works and wants to note characters, places and how they connect, tied to the point of the story where they were learned.
- Author: tracks the details of their own works.

There are no roles. As in spec 004, every item belongs to the account that owns the universe.

## User stories

- US-1. As a reader or author, I want to create a work with its chapters or episodes so that I can say at which point of a work each piece of information appears.
- US-2. As a user, I want to create an entity with its type and the point where it is introduced so that I start my knowledge base of the universe.
- US-3. As a user, I want to write a first fragment of knowledge together with the entity, marked as confirmed, my note or a speculation, so that what I know and how sure I am is kept from the start.
- US-4. As a user, I want to connect two entities with a relationship so that I can see how they relate.
- US-5. As a user, I want to see the list of my entities and, for one of them, its fragment and its relationships read in both directions so that I can check that everything was saved as I intended.

## Definitions

Terms defined in specs 001 to 004 keep their meaning here: universe, mode (`READER`, `AUTHOR`), account, acting user, owner, own universe, selected universe, comparable name, trimming, character (Unicode code point), account-scoped screen state, honest empty state.

- **Work**: a novel, manga, comic, anime, TV series, film or other work, inside one universe. It has a title and a medium.
- **Narrative unit** (unit): a numbered chapter or episode of a work. Its label is what the person sees; the system also keeps a hidden order, which is never shown or typed.
- **Unit wording**: the word used for the units of a work, derived from its medium and never chosen by the person: "chapter" for `NOVEL`, `MANGA` and `COMIC`; "episode" for `ANIME` and `TV_SERIES`; "unit" for `FILM` and `OTHER`. It appears in the label of the unit choice, in the works area ("120 chapters") and in the text of a point.
- **Spoiler boundary** (boundary, "point"): a work and one of its units, marking where a piece of information is revealed. It is shown as "<work title> · <unit wording> <unit label>", for example "My Novel · chapter 12".
- **Entity**: a character, location, organization, faction, object, ability, species or concept. It has no description of its own: what is known about it is its fragments.
- **Comparable name of an entity**: its name made comparable in the same way as the name of a universe (001, applied as in 004 FR-21): case, accents, spacing and Unicode composition are ignored.
- **Fragment** (knowledge entry): a piece of text about an entity, with a status and a boundary.
- **Status**: `CONFIRMED` (comes from the work), `USER_NOTE` (the person's note) or `SPECULATION`.
- **Relationship type**: a predefined kind of relationship with a label, an inverse label and a symmetric flag.
- **Reading of a relationship**: the text of a relationship seen from one of its two entities. From the source: "<this entity> — <label> → <other entity>". From the target: "<this entity> — <inverse label> → <other entity>". For a symmetric type both readings use the same label.
- **Items**: works, units, entities, fragments and relationships.

## Functional requirements

Works
- FR-1: WHEN a signed-in person submits a valid work form in one of their own universes, THE SYSTEM SHALL store the work and its units in one all-or-nothing operation: a title (trimmed, 1 to 200 characters), a medium (`NOVEL`, `MANGA`, `COMIC`, `ANIME`, `TV_SERIES`, `FILM` or `OTHER`) and a number of units N (written only with digits, surrounding spaces ignored, leading zeros allowed, from 1 to 5000), with N units in order labelled "1" to "N". IF a rule fails (a sign, a decimal point, an exponent, a separator, text, a value of 0 or above 5000, however large, or a missing number), THEN THE SYSTEM SHALL store nothing, report a validation failure keyed by field and keep the values typed. A unit label, order or any other data of the units sent by a direct call is ignored.
- FR-2: THE SYSTEM SHALL show in the works area of the selected universe the works it has, in creation order, each with its title, medium and number of units written with the unit wording ("120 chapters"), WHILE the universe has no work an honest empty state, and, whether it has works or not, an always reachable way to open the work form. Two works with the same title are allowed; wherever a work is chosen, its medium is shown next to its title.

Relationship types
- FR-3: THE SYSTEM SHALL provide in every universe, whether created before or after this feature, exactly these eight predefined relationship types (label / inverse label): `MEMBER_OF` (member of / has member), `LEADER_OF` (leader of / led by), `ALLY_OF` (ally of, symmetric), `ENEMY_OF` (enemy of, symmetric), `PARENT_OF` (parent of / child of), `SIBLING_OF` (sibling of, symmetric), `LOCATED_IN` (located in / contains) and `POSSESSES` (possesses / possessed by), and SHALL not give a universe a second copy of any of them. A universe is never stored without them: creating a universe stores its types in the same all-or-nothing operation, and IF the types cannot be stored, THEN THE SYSTEM SHALL store no universe (the failure of 004 FR-7). Any type can be used between any two entities, whatever their entity types.

Entities and fragments
- FR-4: WHEN a signed-in person submits a valid entity form in one of their own universes that has at least one work, THE SYSTEM SHALL store an entity with a name (trimmed, 1 to 120 characters), a type (`CHARACTER`, `LOCATION`, `ORGANIZATION`, `FACTION`, `OBJECT`, `ABILITY`, `SPECIES` or `CONCEPT`), an introduction boundary (a work of that universe and a unit of that work) and empty attributes. IF a field rule fails or an identifier is malformed, THEN THE SYSTEM SHALL store nothing, report a validation failure keyed by field and keep the values typed; a reference that does not exist, belongs to another account or universe, or (for a unit) is not of the chosen work answers not found, as in FR-8. The unit choice of this form and of FR-5 and FR-7 works the same way: the person picks a work and then a unit of it by choosing or by typing its number; the typed number follows the format rules of N in FR-1 (only digits, surrounding spaces ignored, leading zeros allowed), and a number that matches no unit of the chosen work picks nothing and shows an error linked to the field. WHILE the selected universe is in `AUTHOR` mode, THE SYSTEM SHALL propose the last unit of the chosen work for the boundary of an entity and of a relationship, and WHEN the person changes the work, THE SYSTEM SHALL propose the last unit of the new work; in `READER` mode the person chooses the unit, and changing the work leaves the unit empty. Any other field sent by a direct call (attributes with content, a description) is ignored.
- FR-5: WHERE the person fills the optional first fragment of the entity form (content of 1 to 5000 characters after trimming, a status, and a boundary), THE SYSTEM SHALL store the entity and the fragment in one all-or-nothing operation; IF the fragment is invalid, THEN THE SYSTEM SHALL store neither. The status is required: the form proposes `USER_NOTE`, and a request without a status or with an unknown one is a validation failure. A fragment boundary the person has not touched always equals the entity boundary chosen in the form at the moment of submission, whether the person changed the entity boundary before or after opening the fragment; once the person chooses a different point for the fragment, it stays. WHEN the fragment content is empty or only whitespace, THE SYSTEM SHALL store the entity alone and SHALL ignore everything else of the fragment (status and boundary): they are neither validated nor looked up, whatever was typed or sent.
- FR-6: WHEN an entity is created and another entity of the same type in the same universe has the same comparable name, THE SYSTEM SHALL still create it and SHALL show, next to the result of the creation, a notice that names the existing entity (the oldest one when there are several) and says that a similar entity already exists; the notice stays until another form is opened, another entity is selected or the selected universe changes, and is announced to assistive technologies like the other messages. A duplicate name never blocks a creation and is not checked while the name is typed. The notice belongs to the answer of the creation, so it also appears when that answer arrives late (004 FR-8).

Relationships
- FR-7: WHEN a signed-in person submits a valid relationship form in one of their own universes that has at least two entities, THE SYSTEM SHALL store a directed relationship from a source entity to a target entity with one predefined relationship type, a status (`CONFIRMED`, `USER_NOTE` or `SPECULATION`, required, `USER_NOTE` proposed by the form, a request without it or with an unknown one is a validation failure) and a boundary (a work and one of its units), and nothing else (a description or any other field sent by a direct call is ignored). The same pair of entities may have the same type more than once, in either direction, and the points of an entity, a fragment and a relationship are independent of each other: a point earlier than the introduction of an entity, or in another work, is accepted. WHILE the universe has fewer than two entities, THE SYSTEM SHALL show, instead of the relationship form, a message that two entities are needed.
- FR-8: IF the source and the target are the same entity, THEN THE SYSTEM SHALL store nothing and SHALL report a business rule violation. IF the source entity, the target entity, the relationship type, the work of a boundary or the unit of a boundary does not exist, belongs to another account, belongs to another universe than the one named in the request, or (for the unit) does not belong to the chosen work, THEN THE SYSTEM SHALL store nothing and SHALL report one and the same not found answer for all of those cases, so that no answer confirms that something exists; a malformed identifier is a validation failure. The same checks apply to the entity and the fragment of FR-4 and FR-5.

Viewing
- FR-9: THE SYSTEM SHALL list in the entity list of the selected universe its entities, each with its name and type, in creation order (oldest first, ties by identifier), WHEN the person selects one THE SYSTEM SHALL show it in the details panel, and WHEN an entity is created THE SYSTEM SHALL select it. Nothing is selected after a reload or when the selected universe changes. WHILE entities exist and none is selected, THE SYSTEM SHALL show in the details panel a statement that an entity can be selected to see its details. WHILE the universe has no entity, THE SYSTEM SHALL show an honest empty state with the entity form reachable from it, or, if there is no work yet, a message that a work is needed first with the work form reachable from it. The entity form is always reachable from the entity list while the universe has a work.
- FR-10: WHILE an entity is selected, THE SYSTEM SHALL show in the details panel its name, its type, its introduction point, its first fragment (content, status and point) or a statement that it has no fragment yet, and all its relationships in creation order, each as the reading seen from that entity with its status and point, or a statement that it has no relationships; a symmetric relationship has the same text from both entities. The relationship form is reachable from the details panel of the selected entity, which it proposes as source (the person may change it). A created item appears without leaving the screen (a created relationship appears in the panel when the selected entity is one of its two entities) and is still there after a reload. The content of a fragment keeps its line breaks, is shown in full and wraps inside its area, as does a long title in a point (004 FR-19).

Access and protections
- FR-11: THE SYSTEM SHALL apply to every operation of this feature (creating a work, an entity and a relationship, and reading the works, units, entities, fragments, relationships and relationship types of a universe, including what the forms read to offer their choices) the patterns of spec 004 listed in the Context: the acting account only from the session, every query limited to the own universes of that account, the same rules at every entry point, typed errors with stable codes, a not found answer that is the same for another account's and for a nonexistent universe, a validation error for a malformed identifier, input validated at the boundary, text rules and plain text display, a failed store keeping nothing, and no second submission while one is waiting.
- FR-12: WHEN the selected universe changes, THE SYSTEM SHALL close the open forms with their typed values and clear the selected entity, and a response that belongs to the previously selected universe SHALL be discarded without any message, not added to the list or the panel of the new universe (the item was stored in the universe it was sent for, and appears when the person goes back to that universe).

## Non-functional requirements

- NFR-1: THE SYSTEM SHALL give the same results for the same scenarios whichever way items are kept (as 004 NFR-1): valid creation of each item, each validation failure, the isolation between two accounts, the seed of FR-3 and the refusals of FR-8 pass unchanged against two interchangeable ways of keeping them.
- NFR-2: THE SYSTEM SHALL isolate accounts for every operation of this feature, reads included: verifiable with two accounts, where no operation of one returns, changes or confirms the existence of a work, a unit, an entity, a fragment, a relationship or a relationship type of the other. These account-isolation tests are the protection tests of this feature (see Spoiler impact).
- NFR-3: THE SYSTEM SHALL keep the three forms, the unit choice, the works area, the entity list and the details panel usable only with the keyboard, with visible labels and errors linked to their fields, with a way to choose a unit of a work of up to 5000 units by typing its number, and at a viewport width of 320 CSS pixels, also with a work of 5000 units, a title of 200 characters and a fragment of 5000 characters (004 NFR-4 and NFR-6). It SHALL announce to assistive technologies the notice of FR-6 and the failure and unknown-result messages of the three forms, as 004 NFR-4 does.
- NFR-4: THE SYSTEM SHALL cover with browser tests the main journey: create a work, create two entities (one with a first fragment), connect them, see the relationship from both entities after a reload, and see nothing of another account's items with a second account.

## Spoiler impact

Yes, this feature writes information with a spoiler boundary: every entity, fragment and relationship is stored together with its boundary (a work and a unit of that work in the same universe), and the boundary is required (OD-1 is untouched). A work and its units are structure, always visible in `READER` universes.

**Known and accepted limitation, until Phase 4 (user decision, 2026-11-25).** There is no reading progress yet, so nothing can be hidden by it. Everything created is visible to its owner, in `READER` universes as well as in `AUTHOR` universes, whatever its boundary, in every place that reads items: the works area, the entity list, the details panel and the choices the forms offer (entities as source and target, the units of a work and the relationship types). This differs from the visibility rules of the data model and from the invariant that spoiler filtering is enforced in the backend for every read path; it is accepted because the only person who can read these items is their owner, who wrote them. No notice about it is shown on screen: no text or indicator about spoiler protection or hidden information appears in the works area, the entity list or the details panel (user decision, 2026-11-25). Because the boundary is stored for every item, Phase 4 can filter the same data without changing it.

Nothing created here is sent to any other account, to any AI provider or to any search, and no read path other than those listed exists. The spoiler protection suite is not applicable to this feature (there is no filter to test); account-isolation tests stand in for it (NFR-2), as in spec 004. Phase 4 must add the visibility filter and its mandatory suite to every read introduced here. 

**Temporary exception to the project rules (user decision, 2026-11-25).** The reads of this spec do not meet the project rules on spoiler filtering and spoiler tests: the invariant that spoiler filtering is enforced in the backend for every read path, the data rule that `READER` filtering happens in the backend, the verification step that makes the spoiler tests mandatory, the rule of the development flow that spoiler filtering is always in the spec, its verification point on spoiler tests, the spoiler section of the data model with its mandatory tests, and the mandatory spoiler visibility tests for every read use case of the architecture. The project rule that flags `CONFIRMED` items without a citation as "without source" is not met either, because no source exists yet. The exception is written in each of those rules when this spec is approved, so that it is in force during implementation and validation. Each exception is short, dated 2026-11-25 and names the read paths of this spec (the works area, the entity list, the details panel and the choices of the forms). The spoiler exceptions expire when the Phase 4 spec that filters these reads is implemented, and that spec must filter them and add the spoiler suite to them; the "without source" exception expires when the Phase 3 spec for sources is implemented, which brings the flag. At the closing, this spec only checks that the exceptions are still in place.

## Edge cases

- A universe with no work: the entity form is not offered; a message says a work is needed first (FR-9). A universe with fewer than two entities: a message says two entities are needed instead of the relationship form (FR-7).
- Work with 1 unit and with 5000 units are accepted; 0 and 5001, a decimal, a negative number, "1e3", "+12", a missing number and a value beyond any integer range are rejected; " 12 " and "05" are accepted as 12 and 5 (FR-1). A typed unit number follows the same format rules (" 7 " and "007" pick unit 7; "1e3", "+7", "7.0" pick nothing); a number that matches no unit of the chosen work (0, or above the number of units) picks nothing and shows an error (FR-4). Changing the work proposes the last unit of the new work in `AUTHOR` and leaves the unit empty in `READER` (FR-4).
- Title of exactly 200 characters accepted, 201 rejected, only whitespace rejected; entity name 120 accepted, 121 rejected; fragment content 5000 accepted, 5001 rejected, only whitespace is no fragment (FR-1, FR-4, FR-5).
- A fragment content is empty and a status or boundary was changed, or sent invalid or pointing to something that does not exist: no fragment is stored, its status and boundary are not validated or looked up, and the entity is created alone (FR-5). The entity point is changed after the fragment was opened and the fragment point was never touched: the fragment takes the new entity point (FR-5).
- A request without status for a fragment or a relationship, or with an unknown one: validation failure (FR-5, FR-7).
- A boundary that points to another universe's or another account's work or unit, to a nonexistent one, or a unit that does not belong to the chosen work: nothing is stored, always the same not found answer (FR-8).
- Same name and type as an existing entity, also differing only in case, accents or spacing: created, with the notice of FR-6, also when the answer arrives late. Same name with another type: no notice.
- Relationship from an entity to itself: business rule violation (FR-8). An entity or a type of another universe, of another account or nonexistent: the same not found answer (FR-8).
- The same pair with the same type twice, also in the opposite direction, and a symmetric type created in both directions: separate relationships whose lines may look alike except for status and point; accepted (FR-7).
- A relationship or fragment point earlier than the entity's introduction, or in another work: accepted (FR-7).
- A type that makes little sense between two entity types (`PARENT_OF` between two locations): accepted (FR-3).
- Symmetric type: "A — ally of → B" and "B — ally of → A" on the two sides (FR-10). Non-symmetric: "A — member of → B" and, from B, "B — has member → A".
- Entity with no relationships or no fragment: the panel says so (FR-10). Entities exist but none is selected: the panel invites selecting one (FR-9). After a reload nothing is selected (FR-9).
- Two works with the same title: both listed, the medium shown next to the title when choosing; the text of a point shows the title only, so two points can read alike; accepted.
- Work, entity or relationship creation fails or has no usable answer, or the session is missing, expired or unverifiable: the patterns of spec 004 FR-7 to FR-10 (nothing stored or unknown result, values kept, sign-in offered). A late success is applied as a normal success for the universe it was sent for: the work appears in the works area, the entity is added and selected, the relationship appears in the panel when it involves the selected entity (FR-12), and the unknown-result message becomes a confirmation.
- The selected universe changes while a form is half typed, an entity is selected or a submission is waiting: forms, selection and the duplicate-name notice are cleared, and a response of the previous universe is discarded without any message; the item was stored and appears when the person goes back to that universe (FR-6, FR-12).
- Account change or sign-out with a half-typed form or a selected entity: cleared (004 FR-18).
- A universe that existed before this feature: it gets the eight relationship types and no work, entity or relationship (FR-3). A universe whose creation fails while storing its types is not stored (FR-3).
- Any request that carries extra data (a description of a relationship, attributes with content, the label or order of units): ignored without error and never stored (FR-1, FR-4, FR-7).
- Text with markup, emoji, direction-control characters, line breaks in a fragment or very long words: shown as plain text, layout intact (004 FR-19, FR-10).

## Out of scope

Checked against `docs/roadmap.md`, `docs/open-decisions.md` and `CLAUDE.md`.

Decided out of this spec (user, 2026-11-25):
- Editing, deleting, trashing, restoring or purging any item (the lifecycle, spec 007), including a work (OD-19) and the cascade of a universe's trash over these items.
- Aliases of an entity.
- More than one fragment per entity at creation, and adding, editing or removing fragments later.
- Relationship types created or edited by the user: only the eight predefined ones exist; and any rule that limits which entity types a relationship type can connect.
- A description on a relationship: not offered (the field stays empty).
- Attributes and per-type attribute schemas (OD-7): attributes stay empty.
- The end of a relationship (OD-2).
- Adding units to a work later, inserting units, labels other than the plain number, groups of units ("Volume 2"), a work description and a work cover image.
- Events, sources, citations (Phase 3, OD-3, OD-4, OD-20), the knowledge graph and the timeline (Phase 3). Marking a `CONFIRMED` item as "without source" belongs with sources: no source exists yet, so no item is flagged (temporary exception, see Spoiler impact).
- Reading progress, the visibility filter and every other spoiler protection, search (Phase 4: OD-5, OD-13). OD-1 is not decided: a boundary is always required.
- Sharing, import and export (OD-15), file uploads (OD-11), AI (Phase 6), deployment and public API (Phase 5), pagination and limits of the lists (as 004 FR-20, abuse limits stay in Phase 5).
- Costly hardening (several tabs at once, network cuts with a simulated clock, layout stress with hundreds of entities or relationships and hostile text): proposed for `docs/hardening.md`, not built here. The 5000-unit work at 320 px is part of NFR-3, because it is a limit of this spec.

Accepted risks (user decisions):
- Everything created is visible to its owner in `READER` universes until Phase 4 (see Spoiler impact).
- A list already loaded in another tab can be out of date until the page is reloaded (as 004).
- Mistakes cannot be corrected until spec 007 (no edit, no delete): an item created by error stays.
- Two works with the same title, and relationships that look alike, can be hard to tell apart (FR-2, FR-7).

## Completion criteria

- Every FR and NFR is covered by a passing automated test (unit, integration or browser), except the keyboard and screen-reader items of NFR-3, which are a manual check by the user during the validation.
- A person can create a work of N units, see it in the works area, create an entity with and without a first fragment, create a second entity, connect them, and see each relationship read in both directions in the details panel, in a browser test that also reloads the page.
- Every universe, including one created before this feature and one created after it, has exactly the eight relationship types of FR-3 with the given labels and no second copy; a universe whose types cannot be stored is not stored.
- The validation limits of FR-1, FR-4 and FR-5, the required status of FR-5 and FR-7 and the refusals of FR-8 (same entity, another universe, another account, nonexistent, a unit of another work) give the same outcomes through the forms and through a direct call, storing nothing in each failure, and the answers to the references that do not exist, belong to another account or universe, or do not match are identical.
- Two accounts see none of each other's works, units, entities, fragments, relationships or types, and a universe or item of another account gives the same not found answer as a nonexistent one.
- The duplicate-name notice of FR-6 appears after the creation, names the existing entity, does not block, and no check is made while the name is typed. The entity list, the works area and the details panel contain no text or indicator about spoiler protection or hidden information.
- Changing the selected universe clears the open forms and the selected entity, and a response of the previous universe is discarded without any message and does not alter the new universe (FR-12).
- The graph view and the timeline entry are unchanged, and no text anywhere says that works, entities or relationships are not available.
- At closing, the documents record what is real (works with units, entities, first fragments, relationships and the seed of types), that the spoiler filter is still pending for these items, and the change to 004 FR-15 and FR-17 and to its seeding exclusion. Every document that names spec 006 as the universe lifecycle (the status paragraph of the project guide, the Phase 1 row of the roadmap, the open-decision row of the trash retention, the data model notes that mention the lifecycle spec) is updated to 007, and the Phase 2 row of the roadmap records that works, entities and relationships were started early by this spec. OD-16 is removed from the open decisions by the plan that records it.
- When this spec is approved, the temporary exceptions of Spoiler impact are written in every project rule they name (spoiler filtering and spoiler tests, and the "without source" flag), dated 2026-11-25, naming the read paths of this spec and their expiry (the implementation of the Phase 4 spec that filters these reads; the implementation of the Phase 3 spec for sources for the flag). At closing, they are checked to be still in place.

## Open questions

None.

Resolved by the user on 2026-11-25: the project rules on spoiler filtering and spoiler tests get a temporary, dated exception, written when this spec is approved (Spoiler impact, Completion criteria); the points of an entity, a fragment and a relationship are independent, with no extra rule (FR-7).
