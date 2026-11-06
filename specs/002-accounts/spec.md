# Spec 002 — Accounts

Status: approved

## Context and goal

LoreKeeper is meant to hold a person's private knowledge bases. Today the application has no notion of who is using it: anyone who opens it sees the workspace, and nothing is stored. Every later feature (universes that belong to someone, their content, reading progress) needs the application to know who is acting on every request.

This feature adds accounts. A person can register, sign in and sign out, the application knows who they are on every request, and the pages of the workspace are only available to a signed-in person. It is the first feature of the foundations phase of the roadmap.

Accounts are the first thing the application stores. They must survive restarts of the application and of its stored data.

This feature does not link universes to users: universes keep running on sample data and in-memory creation exactly as today, and belong to nobody (that is spec 003). The accessibility preferences stay in the browser. Sign-in uses email and password only.

The feature also defines how failures are reported: a small, consistent set of error kinds with stable codes, and how each one is answered, so that every later feature reports problems the same way.

The feature introduces new dependencies (stored data, authentication, validation of input and browser test tooling) and a stored-data schema. The plan must flag each of them as needing approval before anything is installed or created.

## Users

- Reader: follows dense works and wants to remember what they read without spoilers. Needs a private account.
- Author: tracks the details of their own works. Needs a private account.

Both use the same account flows. There are no roles and no administrators.

## User stories

- US-1. As a new user, I want to create an account with my name, email and password so that my knowledge bases will be mine alone.
- US-2. As a returning user, I want to sign in with my email and password so that I can continue working.
- US-3. As a signed-in user, I want to stay signed in while I keep using the application so that I am not asked for my password again and again.
- US-4. As a signed-in user, I want to sign out, and find a clean workspace for whoever uses the device next, so that nobody else using my device can act as me or see what I did.
- US-5. As a signed-out person, I want to be sent to sign in when I open a workspace address, and to come back to that address afterwards, so that I do not lose my place.
- US-6. As a signed-in user, I want to see the name and email of the account I am using so that I know I am in the right one, even if two accounts share a name.
- US-7. As the owner of the project, I want every failure answered in one consistent, safe way so that no feature leaks internals or invents its own error format.

## Definitions

- **Account**: a registered person, identified by a unique email and having a display name and a password. Display names need not be unique.
- **Session**: the period during which a signed-in person is recognized by the application on each request. It is created by signing in or signing up and ends by signing out or by expiring.
- **Use of a session**: a visit to a workspace page by a person with a valid session.
- **Workspace root**: the application's current single workspace entry page, at its root address. It is where a signed-in person lands by default.
- **Workspace page**: any address of the application other than the sign-up page, the sign-in page and the static resources those two pages need. Addresses that do not exist are workspace pages for this purpose.
- **Character**: a Unicode code point. Every length limit in this feature counts code points, as the universe name does in spec 001 and in the data model. A compound emoji (a flag, a family, an emoji with a skin-tone modifier) can therefore count as more than one character.
- **Comparable email**: an email with surrounding whitespace removed and every letter lower-cased. Two emails are "the same" when their comparable emails are equal. Example: " Ana@Example.com " and "ana@example.com" are the same.
- **Valid email**: after removing surrounding whitespace, a single address with exactly one "@", no spaces, at most 254 characters, and written in the common address format with the letters, digits and symbols of that format. Addresses with letters outside that format (for example "ñ" or Chinese characters) are not valid in this version.
- **Return destination**: the path and query (not the fragment) of the workspace address that a signed-out person asked for before being sent to sign in.
- **Acting user**: the account that the server recognizes from the session of the current request. It is never taken from anything the client sends in the request body, parameters or headers.
- **Acting-user check**: the single reusable way, shared by all features, to obtain the acting user of a request from its session.
- **Clean start**: the workspace showing only its sample data, as it does after the page is reloaded, with no universe created earlier in memory.
- **Error kinds**: validation, authentication, not found, business rule violation, infrastructure failure, external provider failure and unknown. Authorization is a reserved kind that this version never produces. Each kind has one stable error code. How each kind is mapped to a transport-level status is decided in the plan.

## Functional requirements

Sign-up
- FR-1: WHEN a signed-out person opens the sign-up page, THE SYSTEM SHALL show a form with display name, email, password and repeat password fields.
- FR-2: WHEN a person submits the sign-up form with a valid display name, a valid email that is not yet registered, a valid password and a repeat password equal to it, THE SYSTEM SHALL create an account with that display name, that email (stored as its comparable email) and that can be signed in to with that password.
- FR-3: IF the display name is empty or contains only whitespace, THEN THE SYSTEM SHALL not create the account and SHALL show an error on the display name field.
- FR-4: IF the display name, after removing surrounding whitespace, is longer than 120 characters, THEN THE SYSTEM SHALL not create the account and SHALL show an error on the display name field stating the maximum length.
- FR-5: IF the display name contains a line break or any other control character, THEN THE SYSTEM SHALL not create the account and SHALL show an error on the display name field.
- FR-6: IF the email is not a valid email, THEN THE SYSTEM SHALL not create the account and SHALL show an error on the email field.
- FR-7: IF the password is shorter than 8 characters or longer than 128 characters, THEN THE SYSTEM SHALL not create the account and SHALL show an error on the password field stating the minimum and maximum length.
- FR-8: IF the repeat password is different from the password, THEN THE SYSTEM SHALL not create the account and SHALL show an error on the repeat password field.
- FR-9: THE SYSTEM SHALL accept any password of 8 to 128 characters, with no required mix of letter case, digits or symbols, and SHALL treat every character as significant, exactly as typed: no trimming, no truncation and no Unicode normalization.
- FR-10: IF the comparable email equals that of an existing account, THEN THE SYSTEM SHALL not create the account and SHALL show an error on the email field saying that an account with that email already exists; this failure is a business rule violation.
- FR-11: WHEN sign-up validation or the email check fails, THE SYSTEM SHALL keep the display name and email the user typed, SHALL clear the password and repeat password fields, and SHALL create no account.
- FR-12: WHEN an account is created, THE SYSTEM SHALL sign the person in automatically, without asking for the password again, and SHALL take them to the return destination (see FR-36) or, if there is none, to the workspace root.
- FR-13: WHEN an account is created, THE SYSTEM SHALL store the display name without its surrounding whitespace and keep its inner whitespace as typed.
- FR-14: WHEN the same valid sign-up is submitted more than once in quick succession, THE SYSTEM SHALL create exactly one account, SHALL leave the person signed in and in the workspace, and SHALL show no error caused by the repeated submission.
- FR-15: WHEN two valid sign-ups with the same comparable email arrive at the same time, THE SYSTEM SHALL create exactly one account.

Sign-in
- FR-16: WHEN a signed-out person opens the sign-in page, THE SYSTEM SHALL show a form with email and password fields and a link to the sign-up page.
- FR-17: WHEN a signed-out person opens the sign-up page, THE SYSTEM SHALL show a link to the sign-in page.
- FR-18: WHEN a person submits an email whose comparable email matches an account and the correct password, THE SYSTEM SHALL start a session for that account and take them to the return destination (see FR-36) or, if there is none, to the workspace root.
- FR-19: IF the email is unknown or the password is wrong, THEN THE SYSTEM SHALL not start a session and SHALL show the same generic message, in the same place, in both cases (illustrative wording: "Email or password incorrect"), so that the answer does not reveal whether the email is registered; this failure is an authentication error.
- FR-20: IF the email, after removing surrounding whitespace, is empty or the password is empty, THEN THE SYSTEM SHALL not attempt to sign in and SHALL show an error on each empty field; THE SYSTEM SHALL check nothing else about the format or length of the email or the password before checking the credentials, so that any other value that fails gets the generic message of FR-19.
- FR-21: WHEN sign-in fails, THE SYSTEM SHALL keep the email the user typed and clear the password field.
- FR-22: WHEN the same sign-in is submitted more than once in quick succession, THE SYSTEM SHALL leave the person with one valid session and SHALL show no error caused by the repeated submission.

Session
- FR-23: THE SYSTEM SHALL identify the acting user from the session of the request on every request to a workspace page, to the sign-up page and to the sign-in page.
- FR-24: THE SYSTEM SHALL provide one single acting-user check for every feature to use; IF a request has no valid session, THEN the acting-user check SHALL fail with an authentication error and the operation that asked for the acting user SHALL not run.
- FR-25: THE SYSTEM SHALL make the acting-user check take the acting user only from the session; a request that carries another account's identifier in its body, parameters or headers SHALL still act as the account of its session.
- FR-26: WHILE a person keeps using the application, THE SYSTEM SHALL keep their session valid for 30 days after its last use, extending it automatically at most once a day.
- FR-27: THE SYSTEM SHALL treat a session unused for exactly 30 days as still valid, and WHEN a session has been unused for more than 30 days, THE SYSTEM SHALL treat the request as signed out.
- FR-28: THE SYSTEM SHALL not impose a maximum total lifetime on a session that keeps being used.
- FR-29: IF the session of a request is missing, deleted, expired or tampered with, THEN THE SYSTEM SHALL treat the request as signed out.
- FR-30: THE SYSTEM SHALL keep the session so that scripts running in the page cannot read it.
- FR-31: THE SYSTEM SHALL not send the session on requests that come from other sites.
- FR-32: WHEN the application is served over HTTPS, THE SYSTEM SHALL send the session only over a secure connection.
- FR-33: IF a sign-up, sign-in or sign-out request comes from another site, THEN THE SYSTEM SHALL reject it and SHALL not create an account, start a session or end a session.
- FR-34: IF, after a sign-up or sign-in attempt that succeeded, the browser does not keep the session because it blocks the storage the session needs, THEN THE SYSTEM SHALL show a clear message that the site needs that storage to keep the person signed in (illustrative wording: "This site needs cookies to keep you signed in"), instead of redirecting silently in a loop.

Access to pages
- FR-35: IF a signed-out person opens a workspace page, THEN THE SYSTEM SHALL redirect them to the sign-in page, carrying the return destination, and SHALL not show any workspace content.
- FR-36: WHEN a person is redirected to sign in and then signs in or signs up, THE SYSTEM SHALL take them to the return destination, keeping its path and query.
- FR-37: THE SYSTEM SHALL keep the return destination when the person moves between the sign-in and sign-up pages and after a failed sign-in or sign-up submission.
- FR-38: IF the return destination belongs to another site, is malformed, or points to the sign-up or sign-in page, THEN THE SYSTEM SHALL ignore it and take the person to the workspace root.
- FR-39: THE SYSTEM SHALL let a signed-out person open only the sign-up page, the sign-in page and the static resources those pages need.
- FR-40: WHILE a person has a valid session, WHEN they open the sign-up or the sign-in page, THE SYSTEM SHALL redirect them to the workspace root.
- FR-41: WHILE a person has a valid session, WHEN they submit the sign-up or the sign-in form (for example from another browser tab), THE SYSTEM SHALL process nothing, SHALL leave the current session intact and SHALL take them to the workspace root; changing account requires signing out first.
- FR-42: WHILE a person has a valid session, WHEN they ask for an address that does not exist, THE SYSTEM SHALL show the standard "not found" page.
- FR-43: IF the session of a request cannot be checked because of a failure, THEN THE SYSTEM SHALL show a generic error page with no workspace content and SHALL not treat the person as signed out.

Sign-out
- FR-44: WHILE a person is signed in, THE SYSTEM SHALL show, in the user menu of the existing top bar, the display name and the email of the account next to an action to sign out.
- FR-45: THE SYSTEM SHALL always show the display name and the email as plain text, never interpreted as markup.
- FR-46: WHEN the person signs out, THE SYSTEM SHALL end the session on the server side, so that the old session, if presented again, is rejected as signed out.
- FR-47: WHEN the person signs out, THE SYSTEM SHALL take them to the sign-in page.
- FR-48: WHEN the person signs out, THE SYSTEM SHALL end only the session of the device in use and SHALL leave valid the sessions on other devices.
- FR-49: WHEN a person signs out without a valid session (already expired, ended from another tab, or deleted), THE SYSTEM SHALL take them to the sign-in page with no error.
- FR-50: IF the sign-out does not reach the server, THEN THE SYSTEM SHALL tell the person that the session is still open and SHALL leave them in the workspace.
- FR-51: WHEN the person uses the browser's back action after signing out, THE SYSTEM SHALL not show workspace content of the ended session; the person ends at the sign-in page.

Existing workspace
- FR-52: WHILE a person is signed in, THE SYSTEM SHALL show the workspace with the same sample universes, the same in-memory universe creation and the same creation rules as before this feature, for any account and not tied to it.
- FR-53: WHEN a person signs out or signs in, THE SYSTEM SHALL start the workspace clean, so that universes created in memory before are no longer shown to whoever uses the device next.
- FR-54: THE SYSTEM SHALL keep the accessibility preferences stored in the browser as they are, and SHALL apply them also on the sign-up and sign-in pages.

Persistence
- FR-55: THE SYSTEM SHALL keep accounts and sessions after the application and its stored data are restarted; a person signed in before the restart is still signed in after it, and can sign in with the same email and password.
- FR-56: THE SYSTEM SHALL never store, log or return a password in readable form: no response, log entry or stored record contains the password as typed.

Error reporting
- FR-57: THE SYSTEM SHALL answer every failure with exactly one error kind, each with one stable error code taken from a closed list: validation, authentication, not found, business rule violation, infrastructure failure, external provider failure and unknown.
- FR-58: WHEN a validation failure happens (a field that is empty, in the wrong format or out of its length limits), THE SYSTEM SHALL report it as the validation kind with the issues keyed by field.
- FR-59: WHEN credentials do not match an account at sign-in, THE SYSTEM SHALL report it as the authentication kind.
- FR-60: WHEN an infrastructure failure or an unknown error happens, THE SYSTEM SHALL answer with a generic message that contains no stack trace, query, credential or internal name, and SHALL record the details in the server log.
- FR-61: WHEN a sign-up, sign-in or sign-out fails because of an infrastructure failure or an unknown error, THE SYSTEM SHALL show a generic message in the form (illustrative wording: "Something went wrong. Try again."), keep the display name and email the person typed, and never keep the password.
- FR-62: THE SYSTEM SHALL define the not found kind, also for resources that belong to another user, and the external provider failure kind, so that later features use them; this feature produces neither.
- FR-63: THE SYSTEM SHALL not produce an authorization error in this version; that kind stays reserved for the day sharing exists.
- FR-64: WHEN an action triggered from the interface fails, THE SYSTEM SHALL return a result with the stable error code, a human-readable message and, only for validation, the issues keyed by field name, built the same way for every error kind.

## Non-functional requirements

- NFR-1: THE SYSTEM SHALL validate the shape of every sign-up and sign-in input before any account rule runs, at the point where input enters the system, and SHALL apply the same rules for display name, email and password wherever an account can be created or signed in, with a single definition of those rules.
- NFR-2: THE SYSTEM SHALL let the sign-up and sign-in forms and the sign-out action be completed and submitted using only the keyboard.
- NFR-3: THE SYSTEM SHALL associate every field of those forms with a visible label and SHALL expose each error message to assistive technologies, linked to its field.
- NFR-4: THE SYSTEM SHALL use in those forms only the project's existing design tokens, which pass the existing contrast checks, and SHALL show the same visible focus indicator as the rest of the application, including in error states.
- NFR-5: THE SYSTEM SHALL answer a request to a workspace page without a session with a redirect before any workspace content is produced; verifiable: the response to a signed-out request contains none of the workspace's text.
- NFR-6: THE SYSTEM SHALL keep the rules of accounts and sessions independent of how they are stored. Verifiable: the same account scenarios (sign-up, sign-in outcomes, duplicate email) pass unchanged against two interchangeable ways of keeping accounts.
- NFR-7: WHILE a sign-up or sign-in submission is being processed, THE SYSTEM SHALL disable the submit control and show that it is in progress.
- NFR-8: THE SYSTEM SHALL keep the sign-up and sign-in pages and the sign-out action usable at the narrowest viewport the application already supports.
- NFR-9: THE SYSTEM SHALL cover the account flows with automated browser tests that drive the application as a person would: sign-up, sign-in with wrong and right credentials, redirect to sign-in and return to the requested address (including the query, for example `/?x=1`), sign-out, the redirect after sign-out, the clean start of the workspace, repeated submission, and a signed-in person submitting the sign-up or sign-in form.

## Spoiler impact

None. Accounts do not read or write narrative information: there are no works, narrative units, reading progress or spoiler boundaries involved, and nothing here is revealed progressively. The `READER` and `AUTHOR` modes are not touched. No spoiler filtering is applied or testable in this feature. Identifying the acting user is the prerequisite for the ownership checks and spoiler filtering that later features perform.

## Edge cases

- Email typed as " ANA@Example.COM ": stored and compared as "ana@example.com"; signing in with "ana@example.com" works.
- Email with a letter outside the common address format (for example "ñ"), two "@", an inner space or more than 254 characters: rejected as not valid (FR-6).
- Two sign-ups with the same email differing only in case or surrounding spaces: the second is rejected (FR-10).
- Two sign-ups with the same email submitted at the same moment: one account (FR-15).
- Double click on "Create account" with a valid form: one account, the person ends signed in, and no error is shown (FR-14).
- Password of exactly 8 characters: accepted. 7: rejected. Exactly 128: accepted. 129: rejected. Characters are code points, so an emoji made of several code points counts as more than one.
- Password with leading or trailing spaces: kept as typed; signing in requires the same spaces.
- Same password typed with a different Unicode encoding on another device (for example a letter with an accent typed as one character or as letter plus accent): may not match. Accepted limitation, because the password is not normalized (FR-9).
- Password made only of the same letter or a common word: accepted (no composition rules; see Out of scope).
- Repeat password different from the password: rejected with an error on the repeat field (FR-8). A typo is caught at sign-up, but a password that is simply forgotten cannot be recovered in this version (see Out of scope).
- Display name of exactly 120 characters: accepted. 121: rejected (FR-4). The limit applies after removing surrounding whitespace. A compound emoji such as a family can count as several characters, so a name that looks shorter than 120 may be rejected.
- Display name with a line break or another control character: rejected (FR-5).
- Display name with leading and trailing spaces: stored without them; inner spaces are kept (FR-13).
- Display name with emoji, non-Latin characters or punctuation: accepted as long as it is not whitespace only.
- Display name equal to another account's: accepted (display names are not unique).
- Display name or email containing markup or a script: shown as plain text (FR-45).
- Display name of 120 characters in a narrow viewport: the user menu keeps working (NFR-8).
- Wrong password for an existing email and unknown email: same message (FR-19).
- Sign-in with an email of invalid format or a password of 3 characters: goes to the credential check and gets the generic message (FR-20). Only empty fields get a field error.
- Sign-in submitted twice quickly: the person ends up with a valid session; no error is shown for the second submission (FR-22).
- Signed-in person (for example in another tab) submits the sign-up or sign-in form: nothing is processed, the current session stays, and the person lands on the workspace root (FR-41).
- Session deleted or tampered with: the request is treated as signed out (redirect on pages) (FR-29).
- Session unused for exactly 30 days: still valid. Unused for more than 30 days: signed out (FR-27).
- Session used continuously for more than a year: stays valid (FR-28).
- Request that carries an identifier of another account in its data: the acting-user check returns the account of the session (FR-25).
- Return address after sign-in that points to another site, is malformed, or is the sign-up or sign-in page: ignored; the workspace root is used (FR-38).
- Return address with a query (for example `/?x=1`): the query is kept. A fragment is never kept (FR-36).
- Person goes from sign-in to sign-up and back, or fails a submission: the return destination is not lost (FR-37).
- Signed-out person asks for an address that does not exist: sent to sign-in, like any other workspace page (FR-35). Once signed in, that address shows the standard "not found" page (FR-42).
- Signed-in person opens the sign-in page by typing its address: redirected to the workspace root (FR-40).
- Sign-out on one device while another device is signed in: the other device stays signed in (FR-48).
- Sign-out when the session had already expired, was ended from another tab or signed out twice: the person lands on the sign-in page with no error (FR-49).
- Sign-out while offline: the person is told the session is still open and stays in the workspace (FR-50).
- The session cannot be checked because the stored data fail: a generic error page; never workspace content, and not treated as signed out (FR-43).
- Browser that blocks the storage the session needs: after the attempt, a clear message is shown instead of a loop (FR-34).
- Sign-up or sign-in fails for an internal reason: generic message in the form; display name and email are kept, the password is not (FR-61).
- Application or its stored data restarted: accounts and sessions are still there (FR-55).
- Forgotten password: cannot be recovered in this version; this is expected (see Out of scope).
- Universes created in memory by a signed-in person are still lost on reload, are not tied to the account, and are also gone when that person signs out or someone signs in (FR-53); until spec 003 the sample and in-memory data are not scoped to the account.

## Out of scope

Checked against `docs/roadmap.md`, `docs/open-decisions.md` and `CLAUDE.md`.

Deferred by decision (OD-12, 2026-11-06), to Phase 5 because they need an email provider (OD-9):
- Sign-in with social accounts (Google, GitHub).
- Email verification: an account can be used without confirming its email, and an email is not proven to belong to the person.
- Password recovery and password reset: until then a forgotten password cannot be recovered.

Deferred to Phase 5 together with the deployment (OD-9):
- Abuse protection on sign-up and sign-in: attempt limits, rate limiting, lockout and captchas. Known and accepted risk during Phase 1: anyone can try passwords without limit. It is accepted only while the application is not publicly exposed; the deployment spec of Phase 5 must include abuse protection before any public exposure.
- Production configuration, including the exact security settings of the session in a deployed environment. This feature only requires the secure-connection property when the application is served over HTTPS (FR-32).

Accepted risks (user decisions):
- Account-existence disclosure: the sign-up form says clearly when an email is already registered (FR-10), so anyone can find out whether an email has an account. This was traded knowingly for usability. The sign-in message stays generic (FR-19).
- Because of that disclosure, equalizing the response time between an unknown email and a wrong password at sign-in is not required. Both points are revisited together with abuse protection in Phase 5.
- Sample and in-memory data are not scoped to the account until spec 003, apart from the clean start on sign-out and sign-in (FR-53).

Other exclusions:
- Rejecting requests without a session at a programmatic entry point that reads or changes data: this feature creates none. This feature requires only the redirect of pages (FR-35) and the acting-user check (FR-24, FR-25). The first feature that creates such an entry point (spec 003) must require and verify that rejection using the acting-user check.
- Converting the manual checks of the spec 001 plan into automated tests: decided by the user to be done in a short later spec. This feature automates only the account flows (NFR-9).
- How each error kind is mapped to a transport-level status: decided in the plan.
- A public API for external consumers (OD-14), import and export of data (OD-15) and file uploads such as an avatar (OD-11).
- Linking universes to the account, per-user separation of universes and ownership checks on universes (spec 003).
- Editing, trash, restore and purge of universes (spec 004).
- Sharing a universe, collaboration, roles and administrators; one owner per universe (Phase 1 decision). The authorization error is not used.
- Changing the display name, email or password, and deleting the account.
- Listing, viewing or ending other sessions of the account from the interface.
- A maximum total lifetime of a session; renewal on every request.
- Email addresses with letters outside the common address format (internationalized addresses).
- Normalization of passwords.
- Multi-factor authentication, passkeys and any sign-in method other than email and password.
- Moving the accessibility preferences from the browser to the account's stored data: deferred to a later feature that is not yet assigned to any spec.
- Deployment target (OD-9).
- Any narrative, spoiler or AI behavior.

## Completion criteria

- Every FR and NFR above is covered by a passing automated test (unit, integration or browser), except these, which are checked manually by the user: NFR-2 to NFR-4 (keyboard, screen reader, contrast and focus), FR-32 (secure-connection property of the session when served over HTTPS, which cannot be automated locally), FR-51 (browser back action after sign-out), FR-54 (preferences applied on the account pages) and the real restart of the application and its stored data (FR-55). There is no validation report file: manual checks are a convention of the user, who tells the agent about any problem found during them.
- The session properties of FR-30 and FR-31 are checked automatically by inspecting the stored session attributes in the browser test.
- Session expiry and renewal (FR-26 to FR-28) are verified with a controlled clock, including the exact 30-day boundary and the once-a-day renewal.
- A person can sign up, land in the workspace root already signed in, sign out, and sign in again with the same email and password.
- A sign-up with a display name of 121 characters is rejected with an error on that field and creates no account; one of 120 characters is accepted; a name containing a line break is rejected.
- A sign-up with a repeat password that differs is rejected with an error on the repeat field.
- A sign-up with an email differing only in case and surrounding spaces from a registered one is rejected, and signing in with the lower-cased address works.
- Wrong password and unknown email show the same generic message in the same place.
- A signed-out person who types the address of a workspace page, including one with a query such as `/?x=1`, is sent to sign in and, after signing in, arrives at that address with the query kept; the rules of the return destination (other site, malformed, sign-up or sign-in page, kept between sign-in and sign-up, kept after a failed submission) are verified by automated tests of the rule.
- A signed-out person who asks for an address that does not exist is sent to sign in; a signed-in person sees the standard "not found" page.
- The acting-user check returns the account of the session even if the request carries another account's identifier, and fails with an authentication error, running nothing, when there is no valid session; verified through tests of that piece.
- After signing out, the old session is rejected, and the other devices' sessions stay valid.
- After signing out and signing in, the workspace shows only the sample data (verified in a browser test); the workspace of a signed-in person otherwise shows the same sample content and in-memory universe creation as before, unchanged (the spec 001 tests pass unchanged).
- Signing out shows no error when there was no valid session, and tells the person that the session is still open when the request does not reach the server.
- A repeated sign-up or sign-in submission leaves one account and a valid session with no visible error; the submit control is disabled while submitting; a signed-in person who submits the sign-up or sign-in form keeps their session and lands on the workspace root.
- A request to sign up, sign in or sign out that comes from another site is rejected.
- When the browser blocks the storage the session needs, a clear message is shown after the attempt.
- No response, log entry or stored record contains a password as typed, checked in sign-up, sign-in and in the failure cases.
- A failure of the stored data during sign-up or sign-in shows the generic message in the form, keeps the display name and email, clears the password, and shows no stack trace, query, credential or internal name; the details are in the server log. A failure while checking the session shows a generic error page with no workspace content.
- The user menu of the signed-in person shows the display name and the email next to the sign-out action.
- Failures are answered with the error kinds and stable codes of FR-57 to FR-64, and an unexpected failure shows no internal detail to the person.
- After restarting the application and its stored data, an existing account can still sign in and a signed-in browser is still signed in (automated against a new connection to the stored data; the real restart is a manual check by the user).
- The sign-up and sign-in pages and the sign-out action are usable by keyboard and screen reader and have no accessibility regressions (manual check by the user).

## Open questions

None.
