# Spec 003 — Account screens

Status: draft

## Context and goal

Spec 002 (accounts) gives the application an engine for accounts: rules, stored accounts and sessions, authentication, the rules of how long a session lasts, the single acting-user check, the shared error kinds and the three account actions (sign up, sign in, sign out) with their results. It changes nothing visible. This feature is the visible side: the screens and the rules of access that let a person use that engine, and the browser tests that prove the account flows work as a person would live them.

**Dependency.** This spec depends on spec 002 and cannot be delivered before it. It relies on these requirements of spec 002 (called "002 FR-x" below):
- 002 FR-1 to FR-12: creating an account and the validation failures of the sign-up action (issues keyed by field, carrying the limits), the duplicate-email business rule violation, and the automatic start of a session at sign-up.
- 002 FR-13 to FR-15: starting a session at sign-in, the identical authentication error for unknown email and wrong password, and the validation failure for empty fields.
- 002 FR-16 to FR-19: sign-out ends only the session in use on the server, succeeds without a valid session, and a sign-up or sign-in invoked with a valid session processes nothing and answers that the person is already signed in.
- 002 FR-20 to FR-22: the acting-user check, taken only from the session, and the infrastructure failure when the session cannot be checked.
- 002 FR-23 to FR-30: session lifetime and renewal (30 days after last use, no maximum total lifetime), a missing, deleted, expired or tampered session read as signed out, the session unreadable by scripts, not sent from other sites, secure over HTTPS, and the rejection of sign-up, sign-in and sign-out requests from other sites.
- 002 FR-31 and FR-32: accounts and sessions survive restarts, and no password is stored, logged or returned.
- 002 FR-33 to FR-39: the error kinds, stable codes and the shape of the result of every failed action.

Today the workspace is open to anyone. This feature adds the sign-up and sign-in pages, a user menu with the account's name and email and the sign-out action, the protection of every workspace page (a signed-out person is sent to sign in and comes back to the address they asked for), the clean start of the workspace for whoever uses the device next, the standard not-found and error pages, and the states of the forms (submitting, narrow width, blocked cookies).

This feature does not link universes to users: universes keep running on sample data and in-memory creation exactly as today, and belong to nobody (that is the stored-universes spec). The accessibility preferences stay in the browser. Sign-in uses email and password only.

This feature introduces browser test tooling. The plan must flag it as needing approval before anything is installed.

## Users

- Reader: follows dense works and wants to remember what they read without spoilers. Needs a private account.
- Author: tracks the details of their own works. Needs a private account.

Both use the same account flows. There are no roles and no administrators.

## User stories

- US-1. As a new user, I want to create an account with my name, email and password in a form so that my knowledge bases will be mine alone.
- US-2. As a returning user, I want to sign in with my email and password so that I can continue working, and to stay signed in while I keep using the application so that I am not asked for my password again and again.
- US-3. As a signed-in user, I want to sign out, and find a clean workspace for whoever uses the device next, so that nobody else using my device can act as me or see what I did.
- US-4. As a signed-out person, I want to be sent to sign in when I open a workspace address, and to come back to that address afterwards, so that I do not lose my place.
- US-5. As a signed-in user, I want to see the name and email of the account I am using so that I know I am in the right one, even if two accounts share a name.

## Definitions

Terms defined in spec 002 keep their meaning here: account, session, use of a session, account actions, result, character, comparable email, valid email, acting user, acting-user check and error kinds.

- **Workspace root**: the application's current single workspace entry page, at its root address. It is where a signed-in person lands by default.
- **Workspace page**: any address of the application other than the sign-up page, the sign-in page and the static resources those two pages need. Addresses that do not exist are workspace pages for this purpose.
- **Return destination**: the path and query (not the fragment) of the workspace address that a signed-out person asked for before being sent to sign in.
- **Clean start**: the workspace showing only its sample data, as it does after the page is reloaded, with no universe created earlier in memory.

## Functional requirements

Sign-up and sign-in pages
- FR-1: WHEN a signed-out person opens the sign-up page, THE SYSTEM SHALL show a form with display name, email, password and repeat password fields.
- FR-2: WHEN a signed-out person opens the sign-up page, THE SYSTEM SHALL show a link to the sign-in page.
- FR-3: WHEN a signed-out person opens the sign-in page, THE SYSTEM SHALL show a form with email and password fields and a link to the sign-up page.
- FR-4: WHEN the sign-up action reports a validation failure (002 FR-2 to FR-7), THE SYSTEM SHALL show an error on the field of each issue (display name, email, password, repeat password); the error for a display name that is too long SHALL state the maximum length, and the error for a password out of its limits SHALL state the minimum and the maximum length.
- FR-5: WHEN the sign-up action reports that the email is already registered (002 FR-9), THE SYSTEM SHALL show an error on the email field saying that an account with that email already exists.
- FR-6: WHEN the sign-in action reports a validation failure for empty fields (002 FR-15), THE SYSTEM SHALL show an error on each empty field.
- FR-7: WHEN the sign-in action reports an authentication error (002 FR-14), THE SYSTEM SHALL show the same generic message, in the same place, whether the email is unknown or the password is wrong (illustrative wording: "Email or password incorrect").
- FR-8: WHEN a sign-up fails (validation or email already registered), THE SYSTEM SHALL keep the display name and email the user typed and SHALL clear the password and repeat password fields.
- FR-9: WHEN a sign-in fails, THE SYSTEM SHALL keep the email the user typed and clear the password field.
- FR-10: WHEN a sign-up, sign-in or sign-out fails because of an infrastructure failure or an unknown error (002 FR-36), THE SYSTEM SHALL show a generic message in the form (in the user menu for sign-out) (illustrative wording: "Something went wrong. Try again."), keep the display name and email the person typed, and never keep the password.
- FR-11: WHEN the same valid sign-up is submitted more than once in quick succession, THE SYSTEM SHALL create exactly one account, SHALL leave the person signed in and in the workspace, and SHALL show no error caused by the repeated submission.
- FR-12: WHEN the same sign-in is submitted more than once in quick succession, THE SYSTEM SHALL leave the person with one valid session and SHALL show no error caused by the repeated submission.
- FR-13: WHEN a sign-up or a sign-in succeeds, THE SYSTEM SHALL take the person to the return destination (see FR-17) or, if there is none, to the workspace root.
- FR-14: IF, after a sign-up or sign-in attempt that succeeded, the browser does not keep the session because it blocks the storage the session needs, THEN THE SYSTEM SHALL show a clear message that the site needs that storage to keep the person signed in (illustrative wording: "This site needs cookies to keep you signed in"), instead of redirecting silently in a loop.

Access to pages
- FR-15: THE SYSTEM SHALL identify the acting user from the session of the request on every request to a workspace page, to the sign-up page and to the sign-in page.
- FR-16: IF a signed-out person opens a workspace page, THEN THE SYSTEM SHALL redirect them to the sign-in page, carrying the return destination, and SHALL not show any workspace content.
- FR-17: WHEN a person is redirected to sign in and then signs in or signs up, THE SYSTEM SHALL take them to the return destination, keeping its path and query.
- FR-18: THE SYSTEM SHALL keep the return destination when the person moves between the sign-in and sign-up pages and after a failed sign-in or sign-up submission.
- FR-19: IF the return destination belongs to another site, is malformed, or points to the sign-up or sign-in page, THEN THE SYSTEM SHALL ignore it and take the person to the workspace root.
- FR-20: THE SYSTEM SHALL let a signed-out person open only the sign-up page, the sign-in page and the static resources those pages need.
- FR-21: WHILE a person has a valid session, WHEN they open the sign-up or the sign-in page, THE SYSTEM SHALL redirect them to the workspace root.
- FR-22: WHILE a person has a valid session, WHEN they submit the sign-up or the sign-in form (for example from another browser tab) and the action answers that the person is already signed in (002 FR-19), THE SYSTEM SHALL take them to the workspace root.
- FR-23: WHILE a person has a valid session, WHEN they ask for an address that does not exist, THE SYSTEM SHALL show the standard "not found" page.
- FR-24: IF the session of a request cannot be checked because of a failure (002 FR-22), THEN THE SYSTEM SHALL show a generic error page with no workspace content and SHALL not treat the person as signed out.

Sign-out and user menu
- FR-25: WHILE a person is signed in, THE SYSTEM SHALL show, in the user menu of the existing top bar, the display name and the email of the account next to an action to sign out.
- FR-26: THE SYSTEM SHALL always show the display name and the email as plain text, never interpreted as markup.
- FR-27: WHEN the person signs out, THE SYSTEM SHALL take them to the sign-in page.
- FR-28: WHEN a person signs out without a valid session (already expired, ended from another tab, or deleted), THE SYSTEM SHALL take them to the sign-in page with no error.
- FR-29: IF the sign-out does not reach the server, THEN THE SYSTEM SHALL tell the person that the session is still open and SHALL leave them in the workspace.
- FR-30: WHEN the person uses the browser's back action after signing out, THE SYSTEM SHALL not show workspace content of the ended session; the person ends at the sign-in page.

Existing workspace
- FR-31: WHILE a person is signed in, THE SYSTEM SHALL show the workspace with the same sample universes, the same in-memory universe creation and the same creation rules as before this feature, for any account and not tied to it.
- FR-32: WHEN a person signs out or signs in, THE SYSTEM SHALL start the workspace clean, so that universes created in memory before are no longer shown to whoever uses the device next.
- FR-33: THE SYSTEM SHALL keep the accessibility preferences stored in the browser as they are, and SHALL apply them also on the sign-up and sign-in pages.

## Non-functional requirements

- NFR-1: THE SYSTEM SHALL let the sign-up and sign-in forms and the sign-out action be completed and submitted using only the keyboard.
- NFR-2: THE SYSTEM SHALL associate every field of those forms with a visible label and SHALL expose each error message to assistive technologies, linked to its field.
- NFR-3: THE SYSTEM SHALL use in those forms only the project's existing design tokens, which pass the existing contrast checks, and SHALL show the same visible focus indicator as the rest of the application, including in error states.
- NFR-4: THE SYSTEM SHALL answer a request to a workspace page without a session with a redirect before any workspace content is produced; verifiable: the response to a signed-out request contains none of the workspace's text.
- NFR-5: WHILE a sign-up or sign-in submission is being processed, THE SYSTEM SHALL disable the submit control and show that it is in progress.
- NFR-6: THE SYSTEM SHALL keep the sign-up and sign-in pages and the sign-out action usable at the narrowest viewport the application already supports.
- NFR-7: THE SYSTEM SHALL cover the account flows with automated browser tests that drive the application as a person would: sign-up, sign-in with wrong and right credentials, redirect to sign-in and return to the requested address (including the query, for example `/?x=1`), sign-out, the redirect after sign-out, the clean start of the workspace, repeated submission, and a signed-in person submitting the sign-up or sign-in form.

## Spoiler impact

None. The screens of accounts do not read or write narrative information: there are no works, narrative units, reading progress or spoiler boundaries involved, and nothing here is revealed progressively. The `READER` and `AUTHOR` modes are not touched, and the workspace keeps showing the same sample data as before. No spoiler filtering is applied or testable in this feature.

## Edge cases

- Display name of exactly 120 characters in a narrow viewport: the user menu keeps working (NFR-6).
- Display name or email containing markup or a script: shown as plain text (FR-26).
- Sign-up fails (invalid field or email already registered): typed display name and email are kept, passwords cleared, and the errors are shown on their fields (FR-4, FR-5, FR-8).
- Sign-in with a wrong password or an unknown email: the same message in the same place; the email is kept and the password cleared (FR-7, FR-9).
- Sign-in with empty fields: an error on each empty field (FR-6).
- Double click on "Create account" with a valid form: one account, the person ends signed in, and no error is shown (FR-11).
- Sign-in submitted twice quickly: the person ends up with a valid session; no error is shown for the second submission (FR-12).
- Signed-in person (for example in another tab) submits the sign-up or sign-in form: nothing is processed, the current session stays, and the person lands on the workspace root (FR-22).
- Return address after sign-in that points to another site, is malformed, or is the sign-up or sign-in page: ignored; the workspace root is used (FR-19).
- Return address with a query (for example `/?x=1`): the query is kept. A fragment is never kept (FR-17).
- Person goes from sign-in to sign-up and back, or fails a submission: the return destination is not lost (FR-18).
- Signed-out person asks for an address that does not exist: sent to sign-in, like any other workspace page (FR-16). Once signed in, that address shows the standard "not found" page (FR-23).
- Signed-in person opens the sign-in page by typing its address: redirected to the workspace root (FR-21).
- Session deleted or tampered with: the request is treated as signed out and, on a workspace page, redirected to sign-in without showing any workspace text (002 FR-26; FR-16 and NFR-4 here).
- Sign-out when the session had already expired, was ended from another tab or signed out twice: the person lands on the sign-in page with no error (FR-28).
- Sign-out while offline: the person is told the session is still open and stays in the workspace (FR-29).
- The session cannot be checked because the stored data fail: a generic error page; never workspace content, and not treated as signed out (FR-24).
- Browser that blocks the storage the session needs: after the attempt, a clear message is shown instead of a loop (FR-14).
- Sign-up or sign-in fails for an internal reason: generic message in the form; display name and email are kept, the password is not (FR-10).
- Universes created in memory by a signed-in person are still lost on reload, are not tied to the account, and are also gone when that person signs out or someone signs in (FR-32); until the stored-universes spec the sample and in-memory data are not scoped to the account.
- A person who keeps using the application is not signed out by the pages 30 days after signing in (see Completion criteria).

## Out of scope

Checked against `docs/roadmap.md`, `docs/open-decisions.md` and `CLAUDE.md`.

Deferred by decision (OD-12, 2026-11-06), to Phase 5 because they need an email provider (OD-9): screens and flows for sign-in with social accounts, email verification and password recovery or reset. Until then a forgotten password cannot be recovered.

Deferred to Phase 5 together with the deployment (OD-9):
- Abuse protection on sign-up and sign-in: attempt limits, rate limiting, lockout and captchas. Known and accepted risk during Phase 1, as in spec 002.
- Production configuration of the application, including how the screens behave behind a deployed address.

Accepted risks (user decisions):
- Account-existence disclosure: the sign-up form says clearly when an email is already registered (FR-5), so anyone can find out whether an email has an account (002 FR-9). This was traded knowingly for usability. The sign-in message stays generic (FR-7).
- Sample and in-memory data are not scoped to the account until the stored-universes spec, apart from the clean start on sign-out and sign-in (FR-32).

Other exclusions:
- Changes to the engine of accounts (rules, stored data, sessions, error kinds, account actions): spec 002.
- Converting the manual checks of the spec 001 plan into automated tests: decided by the user to be done in a short later spec. This feature automates only the account flows (NFR-7).
- Rejecting requests without a session at a programmatic entry point that reads or changes data: this feature creates none. It only redirects pages (FR-16). The first feature that creates such an entry point (the stored-universes spec) must require and verify that rejection using the acting-user check of spec 002.
- A public API for external consumers (OD-14), import and export of data (OD-15) and file uploads such as an avatar (OD-11).
- Linking universes to the account, per-user separation of universes and ownership checks on universes (the stored-universes spec).
- Editing, trash, restore and purge of universes (the universe-lifecycle spec).
- Sharing a universe, collaboration, roles and administrators.
- Screens to change the display name, email or password, to delete the account, or to list, view or end other sessions of the account.
- Moving the accessibility preferences from the browser to the account's stored data: deferred to a later feature that is not yet assigned to any spec.
- Deployment target (OD-9).
- Any narrative, spoiler or AI behavior.

## Completion criteria

- Every FR and NFR above is covered by a passing automated test (unit, integration or browser), except these, which are checked manually by the user: NFR-1 to NFR-3 (keyboard, screen reader, contrast and focus), FR-30 (browser back action after sign-out) and FR-33 (preferences applied on the account pages). There is no validation report file: manual checks are a convention of the user, who tells the agent about any problem found during them.
- A person can open the sign-up page, create an account, land in the workspace root already signed in, sign out from the user menu, and sign in again with the same email and password.
- A sign-up with a display name of 121 characters shows an error on that field; one of 120 characters is accepted; a name containing a line break shows an error; a repeat password that differs shows an error on the repeat field; an email differing only in case and surrounding spaces from a registered one shows the "already exists" error on the email field, and signing in with the lower-cased address works.
- After a failed sign-up the typed display name and email are kept and the passwords are cleared; after a failed sign-in the email is kept and the password is cleared.
- Wrong password and unknown email show the same generic message in the same place; empty fields show an error on each.
- A signed-out person who types the address of a workspace page, including one with a query such as `/?x=1`, is sent to sign in and, after signing in, arrives at that address with the query kept; the rules of the return destination (other site, malformed, sign-up or sign-in page, kept between sign-in and sign-up, kept after a failed submission) are verified by automated tests of the rule.
- The response to a signed-out request to a workspace page is a redirect that contains none of the workspace's text.
- A signed-out person who asks for an address that does not exist is sent to sign in; a signed-in person sees the standard "not found" page.
- A signed-in person who opens the sign-up or sign-in page is redirected to the workspace root, and one who submits the sign-up or sign-in form keeps their session and lands on the workspace root.
- A failure while checking the session shows a generic error page with no workspace content and does not send the person to sign in.
- After signing out the person is on the sign-in page, the old session is rejected and the session of another device stays valid (the server-side behavior is verified in spec 002, here in the browser); signing out with no valid session shows no error, and signing out while the request does not reach the server tells the person that the session is still open.
- After signing out and signing in, the workspace shows only the sample data (verified in a browser test); the workspace of a signed-in person otherwise shows the same sample content and in-memory universe creation as before, unchanged (the spec 001 tests pass unchanged).
- A repeated sign-up or sign-in submission leaves one account and a valid session with no visible error; the submit control is disabled while submitting.
- When the browser blocks the storage the session needs, a clear message is shown after the attempt and the person is not redirected in a loop.
- A failure of the stored data during sign-up or sign-in shows the generic message in the form, keeps the display name and email and clears the password.
- The user menu of the signed-in person shows the display name and the email, as plain text even when they contain markup, next to the sign-out action.
- The guard of pages keeps the session of a person who keeps using the application valid in the browser as 002 FR-23 to FR-25 require: a person who uses the application at least once a day is still signed in after more than 30 days; verified by an automated test of the guard with a controlled clock.
- The session cookie delivered in a real browser sign-up or sign-in carries the properties of 002 FR-27 and FR-28 (checked in a browser test, as an extra check of the same properties that spec 002 verifies without a browser).
- The sign-up and sign-in pages, the user menu and the sign-out action work at the narrowest supported viewport with a display name of 120 characters and nothing scrolls horizontally.
- The sign-up and sign-in pages and the sign-out action are usable by keyboard and screen reader and have no accessibility regressions (manual check by the user).

## Open questions

None.
