# Spec 003 — Account screens

Status: approved

## Context and goal

Spec 002 (accounts) gives the application an engine for accounts: rules, stored accounts and sessions, authentication, the rules of how long a session lasts, the single acting-user check, the shared error kinds and the three account actions (sign up, sign in, sign out) with their results. It changes nothing visible. This feature is the visible side: the screens and the rules of access that let a person use that engine, the point where a session that is being used is renewed in the browser, and the browser tests that prove the account flows work as a person would live them.

**Dependency.** This spec depends on spec 002 and cannot be delivered before it. It relies on these requirements of spec 002 (called "002 FR-x" below):
- 002 FR-1 to FR-12: creating an account and the validation failures of the sign-up action (issues keyed by field, carrying the limits), the duplicate-email business rule violation, and the automatic start of a session at sign-up.
- 002 FR-13 to FR-15: starting a session at sign-in, the identical authentication error for unknown email and wrong password, and the validation failure for empty fields.
- 002 FR-16 to FR-19: sign-out ends only the session in use on the server, succeeds without a valid session, and a sign-up or sign-in invoked with a valid session processes nothing and answers that the person is already signed in. This feature needs that answer to be told apart from a normal success and from every failure.
- 002 FR-20 to FR-22: the acting-user check, taken only from the session, and the infrastructure failure when the session cannot be checked.
- 002 FR-23 to FR-30: session lifetime and renewal (30 days after last use, no maximum total lifetime), a missing, deleted, expired or tampered session read as signed out, the session unreadable by scripts, not sent from other sites, secure over HTTPS, and the rejection of sign-up, sign-in and sign-out requests from other sites (answered as a validation failure that has no issue on any field of the forms).
- 002 FR-31 and FR-32: accounts and sessions survive restarts, and no password is stored, logged or returned.
- 002 FR-33 to FR-39: the error kinds, stable codes and the shape of the result of every failed action.
- The 002 requirement added by the change that exposes the display name and the email of the account in use (called "the 002 name-and-email requirement" below): the acting-user check can also give the display name and the email of the account in use, as a read-only addition that changes no existing rule, stored data, session, error kind or account action. This requirement does not exist yet: it is added to spec 002 through the change flow of spec 002. **Spec 003 cannot be planned or implemented until that change to spec 002 is approved** (and the requirement is delivered before 003 is implemented). FR-25 and US-5 depend on it.

**Hand-offs from spec 002.** Spec 002 was closed with these items handed to this feature ("Accepted risks and follow-ups" of 002): the renewal of the session of a person who keeps using the application, written to the browser and proven in a real browser (FR-16 here); the manual check that the session is sent only over a secure connection when served over real HTTPS (002 FR-29) and the manual check that a real restart of the application and its stored data keeps accounts and sessions (002 FR-31), both done by the user during the validation of this spec (Completion criteria); and the absence of security headers, which is treated in FR-34. The other known limits of spec 002 stay deferred to Phase 5 as written there.

Today the workspace is open to anyone. This feature adds the sign-up and sign-in pages, a user menu with the account's name and email and the sign-out action, the protection of every workspace page (a signed-out person is sent to sign in and comes back to the address they asked for), the renewal of the session of a person who keeps using the application, the clean start of the workspace for whoever uses the device next, the not-found and error pages, and the states of the forms (submitting, narrow width, blocked browser storage, no answer).

This feature does not link universes to users: universes keep running on sample data and in-memory creation exactly as today, and belong to nobody (that is the stored-universes spec). The accessibility preferences stay in the browser. Sign-in uses email and password only.

Change after approval (2026-11-08, at the request of the plan): the definition of public resources now names the addresses served without a session (the static files, the optimized images and the site icon), FR-20 and FR-21 and their edge case and completion criteria follow it, and a new accepted risk records that the static files, which contain the sample data, can be requested without a session. No requirement was added or renumbered.

This feature installs the browser test tooling whose use was approved on 2026-11-06 (OD-17, recorded in `CLAUDE.md`); that approval covers account flows only. Any other new dependency still needs approval, and the plan must flag it before anything is installed.

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
- **Public resources**: exactly the files the application serves to anyone, with or without a session, so that the sign-up page and the sign-in page can be displayed and can work: the application's static files (styles, scripts, fonts and images), served from the address `/_next/static`; the images the framework optimizes, served from the address `/_next/image`; and the site icon, at `/favicon.ico`. The framework serves the static files of every page, including the workspace page, from that one address, so these files include those of the workspace page, which contain the sample data (see the accepted risk in Out of scope). A public resource is a file, not a page: it never renders a workspace page and it is never redirected.
- **Public pages**: the sign-up page, the sign-in page and the public resources. Nothing else is public.
- **Workspace page**: any address of the application that is not a public page. Addresses that do not exist are workspace addresses for this purpose. A request to a workspace address counts whatever its method is and whether the person or the application itself made it (for example a background request that loads a page in advance).
- **Return destination**: the path and query (never the fragment) of the workspace address that a signed-out person asked for before being sent to sign in. A return destination is valid only if it passes the rule of FR-20.
- **Clean start**: the workspace in the same state as right after a full reload of the application: it shows only its sample data, no universe created earlier in memory, and all other in-memory state of the workspace (selection, open panels, positions) at its initial value. The accessibility preferences are not part of it (FR-33).
- **Submission**: a sign-up, sign-in or sign-out request made from a form or control of this feature, from the moment it is sent until its answer is shown.
- **Answer of a submission**, one of: a success; "already signed in" (002 FR-19); a failure with a result of one error kind; or no usable answer (the connection is lost, the answer cannot be read, or no answer arrives within the wait limit of FR-11).
- **Simulated passage of time**: a way, available only to automated tests, to make the running application behave as if a given amount of time had passed since the last use of a session. It is not available in a production configuration (NFR-8).

## Functional requirements

Sign-up and sign-in pages
- FR-1: WHEN a signed-out person opens the sign-up page, THE SYSTEM SHALL show a form with display name, email, password and repeat password fields, and a link to the sign-in page.
- FR-2: WHEN a signed-out person opens the sign-in page, THE SYSTEM SHALL show a form with email and password fields and a link to the sign-up page.
- FR-3: WHEN a person submits the sign-up or the sign-in form, THE SYSTEM SHALL send to the account rules exactly what was typed, without any check of the browser itself stopping the submission and without any limit on how many characters can be typed, so that every error shown comes from the account rules and never from a second copy of them.
- FR-4: WHEN the sign-up action reports a validation failure (002 FR-2 to FR-7), THE SYSTEM SHALL show, on the field of each issue (display name, email, password, repeat password), an error message that says what is wrong, in these cases: display name empty or whitespace only (it is required); display name too long (it states the maximum length); display name with a line break or another control character (it says these are not allowed); email not valid (it says the email is not valid); password out of its limits (it states the minimum and the maximum length); repeat password different (it says the passwords differ). WHEN a field has more than one issue, THE SYSTEM SHALL show all its messages together on that field.
- FR-5: WHEN the sign-up action reports that the email is already registered (002 FR-9), THE SYSTEM SHALL show an error on the email field saying that an account with that email already exists.
- FR-6: WHEN the sign-in action reports a validation failure for empty fields (002 FR-15), THE SYSTEM SHALL show an error on each empty field.
- FR-7: WHEN the sign-in action reports an authentication error (002 FR-14), THE SYSTEM SHALL show the same generic message, in the same place, whether the email is unknown or the password is wrong (illustrative wording: "Email or password incorrect").
- FR-8: WHEN a sign-up fails with any answer that keeps the person on the form, THE SYSTEM SHALL keep the display name and email the person typed and clear the password and repeat password fields; WHEN a sign-in fails in the same way, THE SYSTEM SHALL keep the email and clear the password field.
- FR-9: IF a sign-up, sign-in or sign-out ends with a failure that FR-4 to FR-7 do not cover (infrastructure failure, unknown error, external provider failure, not found, a validation failure with no issue on any field of the form such as a request rejected for coming from another site, or any other result), THEN THE SYSTEM SHALL show one generic message that contains no internal detail, in the form (in the user menu for sign-out) (illustrative wording: "Something went wrong. Try again."), keep the display name and email the person typed, and never keep the password.
- FR-10: IF a submission has no usable answer, THEN THE SYSTEM SHALL show a message, different from the one of FR-9, saying that the application could not be reached or the result is unknown, SHALL keep the typed values as FR-8 and FR-9 do, and SHALL make the form usable again so that the person can retry. For a sign-up the message SHALL also say that the account may have been created and that signing in can be tried (illustrative wording: "We could not confirm the result. If you already created your account, try signing in."). For a sign-out, FR-28 applies.
- FR-11: THE SYSTEM SHALL treat a submission whose answer has not arrived within 30 seconds as having no usable answer.
- FR-12: WHILE a submission of a sign-up, sign-in or sign-out is waiting for its answer, THE SYSTEM SHALL not send a second submission of the same form from the same page, however the person tries to repeat it (a second click, a repeated Enter, or both), so that one repeated action ends with one account created, the person signed in and in the workspace, and no error caused by the repetition. Submissions from two tabs or devices at the same moment are not prevented (accepted risk).
- FR-13: WHEN a sign-up or a sign-in succeeds, THE SYSTEM SHALL take the person to the return destination if it is valid (FR-20) or, if there is none, to the workspace root.
- FR-14: IF, right after a sign-up or sign-in that succeeded, the next page request of the person still arrives without a session because the browser does not keep what the session needs, THEN THE SYSTEM SHALL show a clear message that the site needs to store data in the browser to keep the person signed in, instead of redirecting in a loop; after a sign-up the message SHALL also say that the account was created and that the person can sign in once the browser allows it.

Access to pages
- FR-15: THE SYSTEM SHALL identify the acting user from the session of the request on every request to a workspace page, to the sign-up page and to the sign-in page.
- FR-16: WHEN a signed-in person uses a workspace page and the session is due for renewal under 002 FR-23, THE SYSTEM SHALL make the renewed session reach the browser, so that a person who opens a workspace page at least once a day is still signed in after more than 30 days, and a person who does not use the application for more than 30 days is signed out (002 FR-24). Verified in a real browser with a simulated passage of time that exists only in tests and never in a production configuration (NFR-8).
- FR-17: THE SYSTEM SHALL give the session kept in the browser the properties of 002 FR-27, FR-28 and FR-29 (unreadable by scripts, not sent from other sites, sent only over a secure connection when served over HTTPS) at sign-up, at sign-in and every time it is renewed.
- FR-18: IF a signed-out person opens a workspace page, THEN THE SYSTEM SHALL redirect them to the sign-in page, carrying the return destination, and SHALL not show any workspace content.
- FR-19: THE SYSTEM SHALL keep the return destination when the person moves between the sign-in and sign-up pages and after a failed sign-in or sign-up submission, and WHEN the person signs in or signs up SHALL take them to it, keeping its path and query.
- FR-20: IF a requested return destination is not valid, THEN THE SYSTEM SHALL ignore it silently and take the person to the workspace root. A return destination is valid only if, after decoding it once, it starts with a single "/" and every rule below holds; it is not valid in any of these cases:
  - it belongs to another site or can be read as such: it starts with "//", "/\", "\" or "\\", it is an absolute address, it starts with a scheme such as "javascript:" or "data:", or any of these appears in its encoded form (for example "%2f%2f" or "%5c" at the start);
  - it contains a control character (for example a line break, a tab or the null character), raw or encoded;
  - it is longer than 2,048 characters;
  - it points to the sign-up or the sign-in page in any form: with a trailing slash, with any letter case ("/sign-in/", "/Sign-In") or with a query ("/sign-in?x=1");
  - it points to a public resource (an address under `/_next/static` or `/_next/image`, or `/favicon.ico`);
  - its query already carries a return destination of its own.
  A fragment is never kept. The rule is verified over every case in this list and over these valid ones: "/", "/?x=1", "/a/b?x=1&y=2".
- FR-21: THE SYSTEM SHALL answer a request of a signed-out person only for the sign-up page, the sign-in page and the public resources (which are answered as they are, never redirected); for any other request, whatever its method and whether it is a navigation or a background request, it SHALL produce no workspace content and SHALL answer it as FR-18 says (a redirect to the sign-in page).
- FR-22: WHILE a person has a valid session, WHEN they open the sign-up or the sign-in page, or submit the sign-up or the sign-in form (for example from another browser tab) and the action answers that the person is already signed in (002 FR-19), THE SYSTEM SHALL take them to the return destination if it is valid or, if there is none, to the workspace root, and SHALL not treat this as a sign-in or sign-up (FR-32 does not apply).
- FR-23: WHILE a person has a valid session, WHEN they ask for an address that does not exist, THE SYSTEM SHALL show a not-found page designed for the application, using the project's design tokens and respecting the accessibility preferences, with a clear message and a link back to the workspace root, and carrying the top bar and the user menu so that the person can sign out from it.
- FR-24: IF the session of a request to a workspace page, to the sign-up page or to the sign-in page cannot be checked because of a failure (002 FR-22), THEN THE SYSTEM SHALL show a generic error page designed for the application, using the project's design tokens and respecting the accessibility preferences, with no workspace content and no user menu (the session is unknown), offering an action to try again, and SHALL not treat the person as signed out.

Sign-out and user menu
- FR-25: WHILE a person is signed in, THE SYSTEM SHALL show, in a user menu of the top bar, the display name and the email of the account next to an action to sign out, at every width the application supports. At narrow widths the user menu SHALL stay in the top bar, collapsed into a single button that opens a panel with the display name, the email and the sign-out action. The display name and the email come from the 002 name-and-email requirement (see Dependency).
- FR-26: THE SYSTEM SHALL show the display name and the email as plain text, never interpreted as markup, SHALL show each in full (wrapping onto several lines, never cut without a way to read all of it, with nothing scrolling horizontally), and SHALL show them so that invisible or direction-control characters they contain cannot alter the order or direction of the text around them.
- FR-27: WHEN a person signs out, THE SYSTEM SHALL take them to the sign-in page, without a return destination and without any error, in every case, including when the session was already expired, ended from another tab or deleted.
- FR-28: IF a sign-out has no usable answer, THEN THE SYSTEM SHALL tell the person that the sign-out could not be confirmed and that the session may still be open, SHALL leave them in the workspace and SHALL let them retry.
- FR-29: WHEN the person uses the browser's back action after signing out, THE SYSTEM SHALL not show workspace content of the ended session, and the person ends at the sign-in page; a page that needed the ended session is requested again and never shown from what the browser stored.
- FR-30: WHEN a person has signed up or signed in, THE SYSTEM SHALL not keep the sign-in or sign-up page as a step they can go back to, so that the browser's back action does not bounce the person between pages or loop.

Existing workspace
- FR-31: WHILE a person is signed in, THE SYSTEM SHALL show the workspace with the same sample universes, the same in-memory universe creation and the same creation rules as before this feature, for any account and not tied to it.
- FR-32: WHEN a sign-up succeeds, a sign-in succeeds or a person signs out, THE SYSTEM SHALL start the workspace with a clean start, so that nothing created in memory before is shown to whoever uses the device next. A failed submission and an "already signed in" answer leave the workspace as it is.
- FR-33: THE SYSTEM SHALL keep the accessibility preferences stored in the browser as they are, and SHALL apply them also on the sign-up, sign-in, not-found and error pages, including after a sign-out (they stay on the device for whoever uses it next; accepted risk).
- FR-34: THE SYSTEM SHALL send with its pages the browser protections that stop another site from embedding them in a frame, stop the browser from guessing the type of a file and limit what is sent to other sites as the page of origin.

## Non-functional requirements

- NFR-1: THE SYSTEM SHALL let the sign-up and sign-in forms, the user menu and the sign-out action, and the actions of the not-found and error pages, be completed and submitted using only the keyboard.
- NFR-2: THE SYSTEM SHALL associate every field of those forms with a visible label, SHALL expose each error message to assistive technologies linked to its field, and WHEN a submission returns with errors SHALL announce them to assistive technologies and move the focus to the first field with an error (or to the general message when there is no field error). General messages (FR-9, FR-10, FR-14, FR-28) SHALL be announced in the same way.
- NFR-3: THE SYSTEM SHALL use in the account pages, the user menu, the not-found page and the error page only the project's existing design tokens, which pass the existing contrast checks, and SHALL show the same visible focus indicator as the rest of the application, including in error states.
- NFR-4: THE SYSTEM SHALL answer a request to a workspace page without a session with a redirect before any workspace content is produced; verifiable: neither the body nor the headers of the response contain any text that a signed-in person sees in the workspace root (for example the names of the sample universes and the labels of the top bar and the side panels).
- NFR-5: WHILE a submission is waiting for its answer, THE SYSTEM SHALL make its submit control impossible to activate and SHALL show that it is in progress with a change that can be seen and that is also exposed to assistive technologies (for example a different label or state of the control).
- NFR-6: THE SYSTEM SHALL keep the sign-up page, the sign-in page, the user menu, the sign-out action, the not-found page and the error page usable at a viewport width of 320 CSS pixels, with a display name of 120 characters and an email of 254 characters, with nothing scrolling horizontally and every control reachable.
- NFR-7: THE SYSTEM SHALL cover the account flows with automated browser tests that drive the application as a person would: sign-up, sign-in with wrong and right credentials, redirect to sign-in and return to the requested address (including the query, for example `/?x=1`), sign-out (also with an already expired session and without reaching the server), the redirect after sign-out and the back action, the clean start of the workspace, repeated submission, a signed-in person opening or submitting the sign-up or sign-in form, a browser that blocks the storage the session needs, a not-found address with and without a session, the error page, the renewal of the session over a simulated passage of time, and the narrow viewport of NFR-6.
- NFR-8: THE SYSTEM SHALL keep every means that automated tests use to provoke a failure of the stored data or a simulated passage of time unavailable in a production configuration; verifiable: in a production configuration the application does not react to them.

## Spoiler impact

None. The screens of accounts do not read or write narrative information: there are no works, narrative units, reading progress or spoiler boundaries involved, and nothing here is revealed progressively. The `READER` and `AUTHOR` modes are not touched, and the workspace keeps showing the same sample data as before. No spoiler filtering is applied or testable in this feature.

## Edge cases

- Display name of exactly 120 characters and email of 254 characters at the narrowest supported width: the user menu shows both in full and keeps working (FR-26, NFR-6).
- Display name or email containing markup or a script: shown as plain text (FR-26). Display name containing invisible or direction-control characters (accepted by spec 002): shown without altering the text around it (FR-26).
- Sign-up fails (invalid field or email already registered): typed display name and email are kept, passwords cleared, and the errors are shown on their fields (FR-4, FR-5, FR-8).
- Sign-up with several problems in one field (for example a too long name with a line break): all its messages are shown on that field (FR-4).
- Browser that would reject an email or a value by itself: the submission is still sent and the account rules answer (FR-3).
- Sign-in with a wrong password or an unknown email: the same message in the same place; the email is kept and the password cleared (FR-7, FR-8).
- Sign-in with empty fields: an error on each empty field (FR-6).
- Double click or repeated Enter on "Create account" with a valid form: one submission is sent, one account, the person ends signed in, and no error is shown (FR-12).
- The same sign-up submitted from two tabs or devices at the same moment: not prevented; one account is created and the other submission shows what the account rules answer (for example that the email already exists). Accepted risk.
- Signed-in person (for example in another tab) opens or submits the sign-up or sign-in form: nothing is processed, the current session stays, and the person lands on the valid return destination if there is one, or on the workspace root (FR-22).
- Return destination that points to another site, is malformed, is longer than the limit, contains control characters, or is the sign-up or sign-in page in any form: ignored; the workspace root is used (FR-20).
- Return destination with a query (for example `/?x=1`): the query is kept. A fragment is never kept (FR-20).
- Person goes from sign-in to sign-up and back, or fails a submission: the return destination is not lost (FR-19).
- Signed-out person asks for an address that does not exist: sent to sign-in, like any other workspace page (FR-18). Once signed in, that address shows the not-found page (FR-23).
- Signed-out request that is not a navigation (another method, a background request): no workspace content is produced (FR-21).
- Signed-out request for a public resource (a file under `/_next/static` or `/_next/image`, or `/favicon.ico`): answered as it is, not redirected, so the sign-up and sign-in pages load completely; every other signed-out request that is not for the sign-up or sign-in page is redirected to the sign-in page (FR-18, FR-21).
- Signed-in person opens the sign-in page by typing its address: redirected to the workspace root, or to the return destination if one was given (FR-22).
- Session deleted or tampered with: the request is treated as signed out and, on a workspace page, redirected to sign-in without showing any workspace text (002 FR-26; FR-18 and NFR-4 here).
- Person who uses a workspace page every day: stays signed in beyond 30 days; a person who is absent for more than 30 days is signed out (FR-16).
- Sign-out when the session had already expired, was ended from another tab or signed out twice: the person lands on the sign-in page with no error and no return destination (FR-27).
- Sign-out or sign-up or sign-in whose answer is lost or does not arrive in 30 seconds: the person is told the result is unknown (the session may still be open, for a sign-out; the account may exist, for a sign-up) and can retry (FR-10, FR-11, FR-28). A person who retries a sign-up whose first attempt did create the account sees "already exists" and can sign in (FR-5).
- The session cannot be checked because the stored data fail, on a workspace page or on the sign-up or sign-in page: a generic error page; never workspace content, and not treated as signed out (FR-24).
- Browser that blocks the storage the session needs: after the attempt, a clear message is shown instead of a loop; after a sign-up it says the account exists (FR-14). A person who blocks that storage from the start gets the same message after the first attempt.
- Sign-up or sign-in fails for an internal reason, or the request is rejected for coming from another site: the generic message in the form; display name and email are kept, the password is not (FR-9).
- Universes created in memory by a signed-in person are still lost on reload, are not tied to the account, and are also gone when that person signs out, signs in or signs up (FR-32); until the stored-universes spec the sample and in-memory data are not scoped to the account.
- Back action after signing out: the workspace of the ended session is not shown and the person ends at sign-in (FR-29). Back action after signing in or signing up: it does not return to the sign-in or sign-up page (FR-30).
- Workspace open in a second tab when the session is ended in the first: the second tab keeps what it already shows until its next request to the application, which is then treated as signed out. Accepted risk.
- A person leaves the device and the next person signs up or signs in: the workspace starts clean (FR-32); the accessibility preferences stay (FR-33), so the next person sees those settings. Accepted risk.

## Out of scope

Checked against `docs/roadmap.md`, `docs/open-decisions.md` and `CLAUDE.md`.

Deferred by decision (OD-12, 2026-11-06), to Phase 5 because they need an email provider (OD-9): screens and flows for sign-in with social accounts, email verification and password recovery or reset. Until then a forgotten password cannot be recovered.

Deferred to Phase 5 together with the deployment (OD-9):
- Abuse protection on sign-up and sign-in: attempt limits, rate limiting, lockout and captchas. Known and accepted risk during Phase 1, as in spec 002.
- Production configuration of the application, including how the screens behave behind a deployed address.
- The browser protections that depend on the deployed address or that could break the pages if set without knowing it (for example forcing HTTPS and restricting what content a page may load). FR-34 only covers the protections that do not depend on it. Decided by the user: forcing HTTPS and restricting what content a page may load go to Phase 5 with the deployment (OD-9).
- The other known limits listed in spec 002 ("Accepted risks and follow-ups"): session records without a cap, the secure-connection property depending on the configured public address, the same-site check comparing with the request's own headers, and the capacity used by password processing.

Accepted risks (user decisions):
- Account-existence disclosure: the sign-up form says clearly when an email is already registered (FR-5), so anyone can find out whether an email has an account (002 FR-9). This was traded knowingly for usability. The sign-in message stays generic (FR-7).
- Sample and in-memory data are not scoped to the account until the stored-universes spec, apart from the clean start on sign-up, sign-in and sign-out (FR-32).
- Invisible and direction-control characters are accepted in a display name by spec 002. This feature only shows them safely (FR-26); whether the display-name rule should refuse them is a change of spec 002.
- A sign-up or sign-in repeated from two tabs or devices at the same moment is not prevented; the second submission shows what the account rules answer (FR-12).
- A second tab keeps showing the workspace until its next request after the session ended elsewhere; it shows sample data only today.
- Static files of the application (public resources): they can be requested without a session. Their names are generated and not guessable, and the files of the workspace page contain only the sample data, which is already public in the repository; no real data exists in them. Decided by the user on 2026-11-08, because the sign-up and sign-in pages would not load if a session were required for the files that every page shares. This risk must be revisited by the spec that first stores real data (the stored-universes spec).
- The accessibility preferences stay on the device after a sign-out, so the next person who uses the device sees those settings (FR-33). They are display settings, not personal data.

Other exclusions:
- Changes to the engine of accounts (rules, stored data, sessions, error kinds, account actions): spec 002, with no exception. Making the display name and the email of the account in use available is a change of spec 002 (see Dependency), not part of this feature.
- Converting the manual checks of the spec 001 plan into automated tests: decided by the user to be done in a short later spec. This feature automates only the account flows (NFR-7).
- Rejecting requests without a session at a programmatic entry point that reads or changes data: this feature creates none. It only redirects pages (FR-18). The first feature that creates such an entry point (the stored-universes spec) must require and verify that rejection using the acting-user check of spec 002.
- A public API for external consumers (OD-14), import and export of data (OD-15) and file uploads such as an avatar (OD-11).
- Linking universes to the account, per-user separation of universes and ownership checks on universes (the stored-universes spec).
- Editing, trash, restore and purge of universes (the universe-lifecycle spec).
- Sharing a universe, collaboration, roles and administrators.
- Screens to change the display name, email or password, to delete the account, or to list, view or end other sessions of the account.
- Moving the accessibility preferences from the browser to the account's stored data: deferred to a later feature that is not yet assigned to any spec.
- Making an already open workspace react at once when the session ends elsewhere (decided by the user as an accepted risk).
- Deployment target (OD-9).
- Any narrative, spoiler or AI behavior.

## Completion criteria

- Every FR and NFR above is covered by a passing automated test (unit, integration or browser), except these, which are checked manually by the user during the validation: NFR-1 to NFR-3 (keyboard, screen reader, contrast and focus), FR-33 (preferences applied on the account, not-found and error pages), and the two checks handed over by spec 002: (a) 002 FR-29, that the session is sent only over a secure connection when the application is served over real HTTPS, and (b) 002 FR-31, that a real restart of the application and its stored data keeps accounts and sessions (an account created before the restart still signs in, and a session open before it is still valid). There is no validation report file: manual checks are a convention of the user, who tells the agent about any problem found during them.
- A person can open the sign-up page, create an account, land in the workspace root already signed in, sign out from the user menu, and sign in again with the same email and password.
- A sign-up with a display name of 121 characters shows an error on that field that states the maximum; one of 120 characters is accepted; a name containing a line break shows an error that says it is not allowed; a repeat password that differs shows an error on the repeat field; an empty or whitespace-only name, an invalid email and a password out of its limits each show their error on their field; an email differing only in case and surrounding spaces from a registered one shows the "already exists" error on the email field, and signing in with the lower-cased address works. These cases are submitted through the real form, so the browser does not stop any of them.
- After a failed sign-up the typed display name and email are kept and the passwords are cleared; after a failed sign-in the email is kept and the password is cleared.
- Wrong password and unknown email show the same generic message in the same place; empty fields show an error on each.
- A signed-out person who types the address of a workspace page, including one with a query such as `/?x=1`, is sent to sign in and, after signing in, arrives at that address with the query kept; the rule of the return destination is verified by automated tests over every case listed in FR-20 and over the valid examples there, and the return destination is kept between sign-in and sign-up and after a failed submission.
- The response to a signed-out request to a workspace page is a redirect whose body and headers contain none of the workspace's text; a signed-out request that is not a navigation (another method, a background request) gets no workspace content either.
- A signed-out request for each public resource (a static file under `/_next/static`, an address under `/_next/image` and `/favicon.ico`) is not redirected and the sign-up and sign-in pages load completely with a signed-out browser; a signed-out request for any other address that is not the sign-up or the sign-in page is redirected (checked in a browser test or a response test).
- A signed-out person who asks for an address that does not exist is sent to sign in; a signed-in person sees the not-found page.
- A signed-in person who opens the sign-up or sign-in page is redirected to the valid return destination or, without one, to the workspace root, and one who submits the sign-up or sign-in form keeps their session and lands in the same place.
- A failure while checking the session shows a generic error page with no workspace content and does not send the person to sign in, on a workspace page and on the sign-up and sign-in pages.
- A person who opens a workspace page at least once a day stays signed in after more than 30 simulated days, and one who is absent for more than 30 simulated days is signed out; verified in a real browser with a simulated passage of time (FR-16).
- The session kept by the browser after a real sign-up, sign-in and renewal carries the properties of 002 FR-27 and FR-28 (checked in a browser test, as an extra check of the same properties that spec 002 verifies without a browser); the secure-connection property is the manual check above.
- After signing out the person is on the sign-in page without a return destination, the old session is rejected and the session of another device stays valid (the server-side behavior is verified in spec 002, here in the browser); signing out with no valid session or with an expired one shows no error; signing out while the request does not reach the server tells the person that the sign-out could not be confirmed.
- The browser's back action after signing out shows no workspace content and ends at the sign-in page; after signing in the back action does not bounce back to the sign-in page (browser tests).
- A sign-up, sign-in or sign-out with no usable answer (connection lost, no answer within the wait limit) shows the message of FR-10 or FR-28, keeps the typed values and lets the person retry; a failure of the stored data during sign-up or sign-in, and a request rejected for coming from another site, show the generic message of FR-9 in the form, keep the display name and email and clear the password.
- After signing out, signing in and signing up, the workspace shows only the sample data and every other in-memory state at its initial value (verified in a browser test); a failed submission and an "already signed in" answer leave it as it is; the workspace of a signed-in person otherwise shows the same sample content and in-memory universe creation as before, and the existing tests of spec 001 keep passing without being deleted or relaxed (if one has to change to allow the clean start, the change is reported to the user).
- A repeated sign-up or sign-in submission (second click, repeated Enter) sends one submission, leaves one account and the person signed in with no visible error; while a submission waits, its control cannot be activated and shows the in-progress change.
- When the browser blocks the storage the session needs, a clear message is shown after the attempt and the person is not redirected in a loop; after a sign-up the message says the account was created.
- The user menu of the signed-in person shows the display name and the email, in full, as plain text even when they contain markup, next to the sign-out action, at the narrowest supported width and with a name of 120 characters and an email of 254 characters.
- The pages carry the browser protections of FR-34 (checked in a browser test or a response test).
- The means used by tests to provoke failures and to simulate the passage of time do not work in a production configuration (NFR-8).
- The sign-up, sign-in, not-found and error pages, the user menu and the sign-out action work at the width of NFR-6 and nothing scrolls horizontally.
- The sign-up and sign-in pages, the user menu and the sign-out action are usable by keyboard and screen reader and have no accessibility regressions (manual check by the user).

## Open questions

None. One external condition remains, which is not a question: spec 003 cannot be planned or implemented until the change to spec 002 that adds the name-and-email requirement is approved (see Dependency).
