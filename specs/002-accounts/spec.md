# Spec 002 — Accounts

Status: implemented

## Context and goal

LoreKeeper is meant to hold a person's private knowledge bases. Today the application has no notion of who is using it and nothing is stored. Every later feature (universes that belong to someone, their content, reading progress) needs the application to know who is acting on every request.

This feature is the engine of accounts. It adds the rules for accounts, stored accounts and sessions, authentication, the rules of how long a session lasts, the single check that tells every feature who is acting, the shared way of reporting failures, and the three operations through which the interface will ask to sign up, sign in and sign out. It is the first feature of the foundations phase of the roadmap.

This feature changes nothing visible in the application: no page, route, form or menu is added or changed, the workspace stays open to anyone exactly as today, and nothing calls the new operations yet. The sign-up and sign-in pages, the user menu, the protection of the workspace pages and the browser tests of the account flows are spec 003 (account screens), which depends on this one and relies on the requirements listed in its own context. Until spec 003 is delivered, nothing in the application requires an account.

Accounts are the first thing the application stores. They must survive restarts of the application and of its stored data.

This feature does not link universes to users: universes keep running on sample data and in-memory creation exactly as today, and belong to nobody (that is the stored-universes spec). The accessibility preferences stay in the browser. Sign-in uses email and password only.

The feature also defines how failures are reported: a small, consistent set of error kinds with stable codes, and how each one is answered, so that every later feature reports problems the same way.

Change after implementation: FR-40 to FR-42 and NFR-3 were added once this spec was implemented, at the request of spec 003 (account screens), whose user menu shows the display name and the email of the account in use so that the person knows which account they are in, even when two accounts share a display name. Until then the acting-user check gave only the identifier of the account. The addition is read-only: it changes no existing rule, stored data, session, error kind or account action, and no existing requirement was renumbered or reworded.

The feature introduces new dependencies (stored data, authentication and validation of input) and a stored-data schema. The plan must flag each of them as needing approval before anything is installed or created.

## Users

- Reader: follows dense works and wants to remember what they read without spoilers. Needs a private account.
- Author: tracks the details of their own works. Needs a private account.

Both use the same account operations. There are no roles and no administrators.

## User stories

- US-1. As a new user, I want my account created from my display name, email and password so that my knowledge bases will be mine alone.
- US-2. As a returning user, I want my email and password checked so that only I can continue working as my account.
- US-3. As a signed-in user, I want to stay signed in while I keep using the application so that I am not asked for my password again and again.
- US-4. As a signed-in user, I want my session ended on the server when I sign out so that nobody else using my device can act as me.
- US-5. As a developer of any later feature, I want one single way to know who is acting on a request, taken only from the session, so that no feature trusts what the client says about who it is.
- US-6. As the owner of the project, I want every failure answered in one consistent, safe way so that no feature leaks internals or invents its own error format.
- US-7. As a developer of the account screens, I want the acting-user check to also give the display name and the email of the account in use so that the interface can tell the person which account they are in, without a second way to read the session.

The screens that let a person do these things, and the stories about them, are in spec 003.

## Definitions

- **Account**: a registered person, identified by a unique email and having a display name and a password. Display names need not be unique.
- **Session**: the period during which a signed-in person is recognized by the application on each request. It is created by signing in or signing up and ends by signing out or by expiring.
- **Use of a session**: a request that presents a session and in which the session is found valid. (In the application, every visit to a page by a signed-in person is such a request; see spec 003.)
- **Account actions**: the three operations through which the interface asks to sign up, sign in or sign out. Each one answers with a result.
- **Result**: the answer of an account action. It is either a success, or a failure carrying the stable error code, a human-readable message and, only for validation, the issues keyed by field name (FR-39).
- **Character**: a Unicode code point. Every length limit in this feature counts code points, as the universe name does in spec 001 and in the data model. A compound emoji (a flag, a family, an emoji with a skin-tone modifier) can therefore count as more than one character.
- **Comparable email**: an email with surrounding whitespace removed and every letter lower-cased. Two emails are "the same" when their comparable emails are equal. Example: " Ana@Example.com " and "ana@example.com" are the same.
- **Valid email**: after removing surrounding whitespace, an address of at most 254 characters, written only with ASCII characters, with exactly one "@" and no spaces, made of:
  - a local part (before the "@") of one or more parts separated by single dots, where each part is not empty and uses only the letters A to Z (either case), the digits 0 to 9 and the symbols underscore, apostrophe, plus and hyphen. The local part therefore cannot start with a dot, end with a dot or contain two dots in a row, and it cannot end with an apostrophe;
  - a domain (after the "@") of two or more labels separated by single dots, so with at least one dot, where every label starts with a letter or a digit and continues with letters, digits or hyphens, and the last label (the top-level part) has only letters, at least two of them. Apart from the 254-character total, there is no limit on the length of one label.

  Everything else is not valid in this version: other symbols that email standards allow in the local part (for example `!`, `#`, `$`, `%`, `&`, `*`, `/`, `=`, `?`, `^`, a backtick, `{`, `}`, `|`, `~`), quoted forms, a domain that is a bare host name (such as "localhost"), an IP address (with or without brackets), a top-level part with digits or hyphens (including the encoded form of internationalized domains), and letters outside A to Z (for example "ñ" or Chinese characters). The rule is applied to the trimmed value as typed, before lower-casing, so a character that only becomes an ASCII letter when lower-cased (for example the Kelvin sign) is not valid.
  - Valid examples: "ana@example.com", "Ana.Maria@Example.COM", "x+y@example.co", "a_b@example.com", "o'brien@example.com", "a.b-c@sub.example.co.uk", "a@1.example.com".
  - Not valid examples: "a@localhost", "a@b", "a@example.c", "a@example.c0m", "a@192.168.0.1", "a@[192.168.0.1]", "a..b@example.com", ".a@example.com", "a.@example.com", "a'@example.com", "{a}@example.com", "a!b@example.com", "a=b@example.com", "a@-example.com", "a@example..com", "a@example.com.", "a b@example.com", "a@@example.com", "añ@example.com", "a@exämple.com", and a value of 255 characters.
- **Acting user**: the account that the server recognizes from the session of the current request. It is never taken from anything the client sends in the request body, parameters or headers.
- **Acting-user check**: the single reusable way, shared by all features, to obtain the acting user of a request from its session.
- **Acting user details**: the display name and the email of the acting user, exactly as they are stored for the account: the display name without surrounding whitespace and with its inner whitespace as typed (FR-10), and the email in its comparable form (lower-case, without surrounding whitespace), because that is the only form the account keeps. The capitalization the person typed at sign-up is not kept, so it cannot be given back.
- **Error kinds**: validation, authentication, not found, business rule violation, infrastructure failure, external provider failure and unknown. Authorization is a reserved kind that this version never produces. Each kind has one stable error code. How each kind is mapped to a transport-level status is decided in the plan.

## Functional requirements

Sign-up
- FR-1: WHEN the sign-up action receives a valid display name, a valid email that is not yet registered, a valid password and a repeat password equal to it, THE SYSTEM SHALL create an account with that display name, that email (stored as its comparable email) and that can be signed in to with that password.
- FR-2: IF the display name is empty or contains only whitespace, THEN THE SYSTEM SHALL not create the account and SHALL report a validation failure with an issue on the display name field.
- FR-3: IF the display name, after removing surrounding whitespace, is longer than 120 characters, THEN THE SYSTEM SHALL not create the account and SHALL report a validation failure with an issue on the display name field that carries the maximum length.
- FR-4: IF the display name contains a line break or any other control character, THEN THE SYSTEM SHALL not create the account and SHALL report a validation failure with an issue on the display name field.
- FR-5: IF the email is not a valid email (exactly as defined in Definitions: ASCII only, at most 254 characters, one "@", a local part without leading, trailing or consecutive dots made only of letters, digits and the symbols `_ ' + -`, and a domain with at least one dot whose top-level part has at least two letters), THEN THE SYSTEM SHALL not create the account and SHALL report a validation failure with an issue on the email field.
- FR-6: IF the password is shorter than 8 characters or longer than 128 characters, THEN THE SYSTEM SHALL not create the account and SHALL report a validation failure with an issue on the password field that carries the minimum and the maximum length.
- FR-7: IF the repeat password is different from the password, THEN THE SYSTEM SHALL not create the account and SHALL report a validation failure with an issue on the repeat password field.
- FR-8: THE SYSTEM SHALL accept any password of 8 to 128 characters, with no required mix of letter case, digits or symbols, and SHALL treat every character as significant, exactly as typed: no trimming, no truncation and no Unicode normalization.
- FR-9: IF the comparable email equals that of an existing account, THEN THE SYSTEM SHALL not create the account and SHALL report a business rule violation (an account with that email already exists).
- FR-10: WHEN an account is created, THE SYSTEM SHALL store the display name without its surrounding whitespace and keep its inner whitespace as typed.
- FR-11: WHEN two valid sign-ups with the same comparable email arrive at the same time, THE SYSTEM SHALL create exactly one account.
- FR-12: WHEN an account is created, THE SYSTEM SHALL start a session for it, without asking for the password again.

Sign-in
- FR-13: WHEN the sign-in action receives an email whose comparable email matches an account and the correct password, THE SYSTEM SHALL start a session for that account.
- FR-14: IF the email is unknown or the password is wrong, THEN THE SYSTEM SHALL not start a session and SHALL answer with the same authentication error, with the same code and the same generic message, in both cases (illustrative wording: "Email or password incorrect"), so that the answer does not reveal whether the email is registered.
- FR-15: IF the email, after removing surrounding whitespace, is empty or the password is empty, THEN THE SYSTEM SHALL not attempt to sign in and SHALL report a validation failure with an issue on each empty field; THE SYSTEM SHALL check nothing else about the format or length of the email or the password before checking the credentials, so that any other value that fails gets the answer of FR-14.

Sign-out
- FR-16: WHEN the sign-out action is invoked with a valid session, THE SYSTEM SHALL end that session on the server side, so that the old session, if presented again, is rejected as signed out.
- FR-17: WHEN the sign-out action ends a session, THE SYSTEM SHALL end only the session of the device in use and SHALL leave valid the sessions on other devices.
- FR-18: WHEN the sign-out action is invoked without a valid session (already expired, ended from another tab, or deleted), THE SYSTEM SHALL answer with a success and no error.

Requests that already have a session
- FR-19: WHILE a request carries a valid session, WHEN the sign-up or the sign-in action is invoked (for example from another browser tab), THE SYSTEM SHALL process nothing, SHALL leave the current session intact and SHALL answer that the person is already signed in; changing account requires signing out first.

Acting user
- FR-20: THE SYSTEM SHALL provide one single acting-user check for every feature to use; IF a request has no valid session, THEN the acting-user check SHALL fail with an authentication error and the operation that asked for the acting user SHALL not run.
- FR-21: THE SYSTEM SHALL make the acting-user check take the acting user only from the session; a request that carries another account's identifier in its body, parameters or headers SHALL still act as the account of its session.
- FR-22: IF the session of a request cannot be checked because of a failure, THEN the acting-user check SHALL fail with an infrastructure failure error, SHALL not report it as an authentication error and SHALL not treat the request as signed out.

Session
- FR-23: WHILE a person keeps using the application, THE SYSTEM SHALL keep their session valid for 30 days after its last use, extending it automatically at most once a day.
- FR-24: THE SYSTEM SHALL treat a session unused for exactly 30 days as still valid, and WHEN a session has been unused for more than 30 days, THE SYSTEM SHALL treat the request as signed out.
- FR-25: THE SYSTEM SHALL not impose a maximum total lifetime on a session that keeps being used.
- FR-26: IF the session of a request is missing, deleted, expired or tampered with, THEN THE SYSTEM SHALL treat the request as signed out.
- FR-27: THE SYSTEM SHALL keep the session so that scripts running in the page cannot read it.
- FR-28: THE SYSTEM SHALL not send the session on requests that come from other sites.
- FR-29: WHEN the application is served over HTTPS, THE SYSTEM SHALL send the session only over a secure connection.
- FR-30: IF a sign-up, sign-in or sign-out request comes from another site, THEN THE SYSTEM SHALL reject it and SHALL not create an account, start a session or end a session. (Spec 003 relies on this: its forms only ever submit from the application's own site.)

Persistence
- FR-31: THE SYSTEM SHALL keep accounts and sessions after the application and its stored data are restarted; a person signed in before the restart is still signed in after it, and can sign in with the same email and password.
- FR-32: THE SYSTEM SHALL never store, log or return a password in readable form: no response, log entry or stored record contains the password as typed.

Error reporting
- FR-33: THE SYSTEM SHALL answer every failure with exactly one error kind, each with one stable error code taken from a closed list: validation, authentication, not found, business rule violation, infrastructure failure, external provider failure and unknown.
- FR-34: WHEN a validation failure happens (a field that is empty, in the wrong format or out of its length limits), THE SYSTEM SHALL report it as the validation kind with the issues keyed by field.
- FR-35: WHEN credentials do not match an account at sign-in, THE SYSTEM SHALL report it as the authentication kind.
- FR-36: WHEN an infrastructure failure or an unknown error happens, THE SYSTEM SHALL answer with a generic message that contains no stack trace, query, credential or internal name, and SHALL record the details in the server log.
- FR-37: THE SYSTEM SHALL define the not found kind, also for resources that belong to another user, and the external provider failure kind, so that later features use them; this feature produces neither.
- FR-38: THE SYSTEM SHALL not produce an authorization error in this version; that kind stays reserved for the day sharing exists.
- FR-39: WHEN an action triggered from the interface fails, THE SYSTEM SHALL return a result with the stable error code, a human-readable message and, only for validation, the issues keyed by field name, built the same way for every error kind.

Acting user details (added after implementation, at the request of spec 003; numbered after FR-39 so that no existing reference changes)
- FR-40: WHEN the acting-user check succeeds, THE SYSTEM SHALL also give the acting user details (the display name and the email of the account in use, as stored for the account), taken only from the session of the request and never from anything the client sends in the request body, parameters or headers; the account identifier is given as before.
- FR-41: THE SYSTEM SHALL give, with the acting user, only the account identifier, the display name and the email, and SHALL never include in it a password, a password hash, a session token or any other stored field of the account.
- FR-42: IF the acting-user check fails because there is no valid session (FR-20, FR-26) or because the session cannot be checked (FR-22), THEN THE SYSTEM SHALL give no display name and no email, and the failure SHALL be the same one those requirements already define, with the same error kind.

## Non-functional requirements

- NFR-1: THE SYSTEM SHALL validate the shape of every sign-up and sign-in input before any account rule runs, at the point where input enters the system, and SHALL apply the same rules for display name, email and password wherever an account can be created or signed in, with a single definition of those rules. In particular, an email that is valid (FR-5) SHALL never be refused later in the same sign-up because of its format: a sign-up whose input satisfies every rule never ends as an internal failure, and no email is accepted at sign-up that the way accounts are kept would refuse.
- NFR-2: THE SYSTEM SHALL keep the rules of accounts and sessions independent of how they are stored. Verifiable: the same account scenarios (sign-up, sign-in outcomes, duplicate email) pass unchanged against two interchangeable ways of keeping accounts.
- NFR-3: THE SYSTEM SHALL provide the acting user details (FR-40 to FR-42) as a read-only addition: giving them SHALL write nothing, SHALL not renew, extend or end the session any differently than before, and SHALL leave unchanged every rule, stored datum, session behavior, error kind, error code and result of the account actions defined by FR-1 to FR-39. Verifiable: every automated test that existed before this addition passes unchanged, except the ones that compare the full content of the acting user or of what the session check returns (they only gain the two new values and assert nothing else differently), and the stored data needs no change (the display name and the email are already kept for every account).

## Spoiler impact

None. Accounts do not read or write narrative information: there are no works, narrative units, reading progress or spoiler boundaries involved, and nothing here is revealed progressively. The `READER` and `AUTHOR` modes are not touched. No spoiler filtering is applied or testable in this feature. Identifying the acting user is the prerequisite for the ownership checks and spoiler filtering that later features perform. The acting user details added by FR-40 to FR-42 are the display name and the email of an account: they are account data, not narrative information, have no spoiler boundary and are not affected by the `READER` or `AUTHOR` mode, so the addition has no spoiler impact either.

## Edge cases

- Email typed as " ANA@Example.COM ": stored and compared as "ana@example.com"; signing in with "ana@example.com" works.
- Email with a letter outside A to Z (for example "ñ"), two "@", an inner space or more than 254 characters: rejected as not valid (FR-5).
- Email without a dot in the domain or with a top-level part of one letter ("a@localhost", "a@b", "a@example.c"): rejected (FR-5).
- Email whose local part starts or ends with a dot, has two dots in a row, ends with an apostrophe or uses a symbol outside letters, digits and `_ ' + -` (".a@example.com", "a.@example.com", "a..b@example.com", "a'@example.com", "{a}@example.com", "a!b@example.com"): rejected (FR-5).
- Email with an apostrophe inside the local part, a plus sign or an underscore ("o'brien@example.com", "x+y@example.co", "a_b@example.com"): accepted (FR-5).
- Email that starts with the Kelvin sign (U+212A, which looks like a "K" and becomes a plain "k" when lower-cased) followed by "ana@example.com": rejected, because the rule is applied before lower-casing (FR-5).
- Two sign-ups with the same email differing only in case or surrounding spaces: the second is rejected (FR-9).
- Two sign-ups with the same email submitted at the same moment: one account (FR-11).
- Password of exactly 8 characters: accepted. 7: rejected. Exactly 128: accepted. 129: rejected. Characters are code points, so an emoji made of several code points counts as more than one.
- Password with leading or trailing spaces: kept as typed; signing in requires the same spaces.
- Same password typed with a different Unicode encoding on another device (for example a letter with an accent typed as one character or as letter plus accent): may not match. Accepted limitation, because the password is not normalized (FR-8).
- Password made only of the same letter or a common word: accepted (no composition rules; see Out of scope).
- Repeat password different from the password: rejected with an issue on the repeat field (FR-7). A typo is caught at sign-up, but a password that is simply forgotten cannot be recovered in this version (see Out of scope).
- Display name of exactly 120 characters: accepted. 121: rejected (FR-3). The limit applies after removing surrounding whitespace. A compound emoji such as a family can count as several characters, so a name that looks shorter than 120 may be rejected.
- Display name with a line break or another control character: rejected (FR-4).
- Display name with leading and trailing spaces: stored without them; inner spaces are kept (FR-10).
- Display name with emoji, non-Latin characters or punctuation: accepted as long as it is not whitespace only.
- Display name equal to another account's: accepted (display names are not unique).
- Wrong password for an existing email and unknown email: the same error, code and message (FR-14).
- Sign-in with an email of invalid format (for example "ana@localhost") or a password of 3 characters: goes to the credential check and gets the answer of FR-14 (FR-15). Only empty fields get a validation issue.
- Sign-up or sign-in invoked by a request that already has a valid session: nothing is processed, the current session stays, and the answer says the person is already signed in (FR-19).
- Session deleted or tampered with: the request is treated as signed out (FR-26).
- Session unused for exactly 30 days: still valid. Unused for more than 30 days: signed out (FR-24).
- Session used continuously for more than a year: stays valid (FR-25).
- Request that carries an identifier of another account in its data: the acting-user check returns the account of the session (FR-21).
- Sign-out on one device while another device is signed in: the other device stays signed in (FR-17).
- Sign-out when the session had already expired, was ended from another tab or signed out twice: success, no error (FR-18).
- The session cannot be checked because the stored data fail: the acting-user check reports an infrastructure failure; the request is not treated as signed out (FR-22).
- Sign-up or sign-in fails for an internal reason: the result has the infrastructure or unknown kind with a generic message and no internal detail; the password is not in the result (FR-32, FR-36).
- Sign-up, sign-in or sign-out request coming from another site: rejected, nothing created or ended (FR-30).
- Application or its stored data restarted: accounts and sessions are still there (FR-31).
- Forgotten password: cannot be recovered in this version; this is expected (see Out of scope).
- Acting user details of an account that signed up with " Ana@Example.COM " and the display name "  Ana  María ": the email is given as "ana@example.com" (the comparable email, the only form kept) and the display name as "Ana  María" (surrounding whitespace removed, inner double space kept) (FR-40, FR-10).
- Two accounts with the same display name: each is given its own email and identifier, so they can be told apart (FR-40).
- Display name that contains markup (for example `<b>Ana</b>`), emoji, or invisible and direction-control characters that this version accepts (see "Small known limits"): given exactly as stored, without escaping, removal or any other change. Showing it safely is the job of whoever shows it (spec 003, FR-26 there) (FR-40).
- Display name of 120 characters: given in full, never shortened (FR-40).
- Request that carries another account's identifier, display name or email in its body, parameters or headers: the details are those of the account of the session (FR-40, FR-21).
- Session missing, deleted, ended by sign-out, expired (unused for more than 30 days) or tampered with: the request is signed out, the acting-user check fails with the authentication error and no display name or email is given (FR-42, FR-26).
- The session cannot be checked because the stored data fail: the acting-user check fails with the infrastructure failure error, not as signed out, and no display name or email is given. The failure is the one of FR-22, with the same generic message and the details in the server log (FR-42, FR-36).
- The details are given on every successful check, including one that renews the session and a second check in the same request: the same values each time, and a second check does not change the session more than the first (FR-40, NFR-3).
- The acting user never contains a password or a password hash, and no response, log entry or stored record gains one because of this addition (FR-41, FR-32). The results of the three account actions stay as they are: they do not carry the details.

## Out of scope

Checked against `docs/roadmap.md`, `docs/open-decisions.md` and `CLAUDE.md`.

Deferred by decision (OD-12, 2026-11-06), to Phase 5 because they need an email provider (OD-9):
- Sign-in with social accounts (Google, GitHub).
- Email verification: an account can be used without confirming its email, and an email is not proven to belong to the person.
- Password recovery and password reset: until then a forgotten password cannot be recovered.

Deferred to Phase 5 together with the deployment (OD-9):
- Abuse protection on sign-up and sign-in: attempt limits, rate limiting, lockout and captchas. Known and accepted risk during Phase 1: anyone can try passwords without limit. It is accepted only while the application is not publicly exposed; the deployment spec of Phase 5 must include abuse protection before any public exposure.
- Production configuration, including the exact security settings of the session in a deployed environment. This feature only requires the secure-connection property when the application is served over HTTPS (FR-29).

Accepted risks (user decisions):
- Account-existence disclosure: sign-up reports distinctly when an email is already registered (FR-9), so anyone can find out whether an email has an account. This was traded knowingly for usability. The sign-in answer stays generic (FR-14).
- Because of that disclosure, equalizing the response time between an unknown email and a wrong password at sign-in is not required. Both points are revisited together with abuse protection in Phase 5.

Accepted risks and follow-ups (user decision, 2026-11-07, taken when the validation of this spec ended). None of them changes a requirement: they are known limits, and checks that cannot be done until the account pages exist. This spec is closed with them written down; each one names the later work that takes it.
- Manual checks handed to spec 003. FR-29 (the session is marked as secure-connection-only when the application is served over real HTTPS) and FR-31 (a real restart of the application and its stored data keeps accounts and sessions) are checked by the user during the validation of spec 003, when the account pages exist. Reason: they need a real HTTPS address and a visible page to sign in from, which this spec does not have. Their automated parts are verified here.
- Renewal of the session in real use. The session rules of FR-23 and FR-25 are verified by the automated suite in the account engine only. In real use, a session that is used every day only by moving between pages must be renewed at a point where the application is able to write the session to the browser; this spec does not provide that point, because it adds no page. Spec 003 must provide it and must prove it in a real browser (a person who uses the application at least once a day is still signed in after more than 30 simulated days). Until then, FR-23 and FR-25 are not considered met in real use, which is acceptable because nothing in the application requires an account yet.
- Known limits deferred to Phase 5 or to spec 003, accepted until then:
  - No limit on the rate of sign-up and sign-in attempts. This is the abuse protection already deferred above; it also covers the next point.
  - While a sign-up is processing the password, it holds a share of the capacity of the stored data; without a rate limit, a burst of anonymous sign-ups could delay other sign-ups, sign-ins and sign-outs. It was not measured and no data is corrupted. Accepted while the application is not publicly exposed; to be measured and bounded in the deployment phase.
  - The application sets no security headers for the browser. Spec 003 or Phase 5.
  - Session records are never removed and have no cap per account. Phase 5.
  - Whether the session is marked as secure-connection-only depends on the public address the application is configured with, so an address configured as non-HTTPS in a deployed environment would produce an unmarked session. Phase 5, with the production configuration already deferred above.
  - The same-site check of FR-30 compares the request with the request's own headers and not with the configured public address of the application. Phase 5, with the production configuration.
- Small known limits of this version, accepted:
  - A sign-up or sign-in request whose body has the wrong shape (not an object, values that are not text, or unknown fields) is answered with a validation failure even if the person already has a session, instead of "already signed in" (FR-19). A normal form never sends such a request, and answering it differently would move validation out of the single place that validates input. A request of the right shape with invalid values does get "already signed in".
  - When 12 or more unknown fields are sent, only the first 12 are named in the validation failure. The request is rejected anyway.
  - Invisible and direction-control characters (for example the zero-width space and the bidirectional controls) are accepted in a display name, because FR-4 rejects only line breaks and other control characters. Whether the display-name rule should also refuse them is for the user to decide through a future change of this spec.

Other exclusions:
- Everything visible: the sign-up and sign-in pages, the user menu, the protection and redirects of the workspace pages, the return destination after signing in, the clean start of the workspace, the error and not-found pages, the messages shown to the person, the narrow-width and submitting states, the blocked-cookie message and the browser tests of the account flows (spec 003).
- Rejecting requests without a session at a programmatic entry point that reads or changes data: this feature creates none. This feature requires only the acting-user check (FR-20 to FR-22). The first feature that creates such an entry point (the stored-universes spec) must require and verify that rejection using the acting-user check.
- Converting the manual checks of the spec 001 plan into automated tests: decided by the user to be done in a short later spec. This feature automates only the rules and operations of accounts.
- How each error kind is mapped to a transport-level status: decided in the plan.
- A public API for external consumers (OD-14), import and export of data (OD-15) and file uploads such as an avatar (OD-11).
- Linking universes to the account, per-user separation of universes and ownership checks on universes (the stored-universes spec).
- Editing, trash, restore and purge of universes (the universe-lifecycle spec).
- Sharing a universe, collaboration, roles and administrators; one owner per universe (Phase 1 decision). The authorization error is not used.
- Changing the display name, email or password, and deleting the account. The acting user details (FR-40 to FR-42) are only read; nothing here lets anyone change them.
- Everything visible about the acting user details: the user menu, how the display name and the email are shown, escaping them as text, truncating them for a narrow screen and any text around them (spec 003, which also decides how a request without a session is answered on a page). This feature only makes the two values available to the code that builds those screens.
- Any other stored field of the account as part of the acting user (whether the email is verified, the profile image, creation or update dates, the password hash, session data): not given (FR-41). The profile image is also under OD-11 (file uploads); the email verification under OD-12 (Phase 5).
- Giving the email in the capitalization typed at sign-up: not kept, so not given (see the definition of the acting user details).
- Any change to existing rules, stored data (no change to what is stored or to its structure), sessions, error kinds, error codes or account actions caused by this addition (NFR-3).
- Listing, viewing or ending other sessions of the account from the interface.
- A maximum total lifetime of a session; renewal on every request.
- Internationalized email addresses (letters outside A to Z, non-ASCII domains) and the rarer forms that email standards allow but this version does not (symbols such as `!` or `{` in the local part, quoted forms, bare host names such as "localhost", IP addresses as domains, top-level parts with digits). A stricter or looser rule is a later decision through the change flow.
- Normalization of passwords.
- Multi-factor authentication, passkeys and any sign-in method other than email and password.
- Moving the accessibility preferences from the browser to the account's stored data: deferred to a later feature that is not yet assigned to any spec.
- Deployment target (OD-9).
- Any narrative, spoiler or AI behavior.

## Completion criteria

This feature has no screens, so every criterion is checked without a browser: with tests of the rules, tests of the three account actions against real stored accounts and sessions, and tests of the session rules with a controlled clock. Anything that can only be seen in a browser belongs to spec 003.

- Every FR and NFR above is covered by a passing automated test (unit, integration or contract), except these two, whose automated parts are verified here and whose manual parts are checked by the user during the validation of spec 003, when the account pages exist (see "Accepted risks and follow-ups" in Out of scope): FR-29 (secure-connection property of the session when served over HTTPS, which cannot be automated locally) and the real restart of the application and its stored data (FR-31). This spec is closed with their automated parts verified and their manual parts handed to spec 003. FR-23 and FR-25 are verified here in the account engine only; their proof in real use is handed to spec 003 (same section). There is no validation report file: manual checks are a convention of the user, who tells the agent about any problem found during them.
- The session properties of FR-27 and FR-28 are checked automatically by inspecting the session attributes that the sign-up and sign-in actions set.
- Session expiry and renewal (FR-23 to FR-25) are verified with a controlled clock, including the exact 30-day boundary and the once-a-day renewal.
- A person can be signed up through the sign-up action and has a valid session, signed out through the sign-out action (the old session is then rejected), and signed in again through the sign-in action with the same email and password.
- A sign-up with a display name of 121 characters is rejected with a validation issue on that field and creates no account; one of 120 characters is accepted; a name containing a line break is rejected.
- A sign-up with a repeat password that differs is rejected with an issue on the repeat field.
- Every valid-email example of the definition is accepted at sign-up against real stored accounts and sessions, and every not-valid example is rejected with a validation issue on the email field and creates no account; an email of 254 characters is accepted and one of 255 is rejected; an email that starts with the Kelvin sign (U+212A) is rejected.
- Every email that the account rules accept is also accepted by the way accounts are kept: a sign-up with it never ends as an internal failure because of the email (NFR-1).
- A sign-up with an email differing only in case and surrounding spaces from a registered one is rejected as a business rule violation, and signing in with the lower-cased address works.
- Two simultaneous sign-ups with the same comparable email create one account.
- Wrong password and unknown email produce the same error, code and message.
- The acting-user check returns the account of the session even if the request carries another account's identifier, fails with an authentication error, running nothing, when there is no valid session, and fails with an infrastructure failure error, not an authentication error, when the session cannot be checked; verified through tests of that piece.
- After signing out, the old session is rejected, and the other devices' sessions stay valid; signing out with no valid session succeeds with no error.
- A sign-up or sign-in invoked with a valid session processes nothing, leaves the session intact and answers that the person is already signed in.
- A sign-up, sign-in or sign-out request that comes from another site is rejected and changes nothing.
- No response, log entry or stored record contains a password as typed, checked in sign-up, sign-in and in the failure cases.
- A failure of the stored data during sign-up or sign-in produces a result with a generic message and no stack trace, query, credential or internal name; the details are in the server log.
- Failures are answered with the error kinds and stable codes of FR-33 to FR-39, and an unexpected failure shows no internal detail.
- After restarting the application and its stored data, an existing account can still sign in and a session created before is still valid (automated against a new connection to the stored data; the real restart is a manual check by the user, handed to the validation of spec 003).
- The same account scenarios pass against two interchangeable ways of keeping accounts (NFR-2), and the input rules have a single definition (NFR-1).
- Nothing visible changes: the spec 001 tests pass unchanged, and the application works as before without needing an account.
- Acting user details (FR-40 to FR-42, NFR-3), checked without a browser:
  - With a valid session, the acting-user check gives the identifier, the display name and the email of the account of the session; an account signed up with " Ana@Example.COM " and "  Ana  María " is given as "ana@example.com" and "Ana  María".
  - Two accounts with the same display name are given with their own, different emails and identifiers.
  - A display name containing markup, an emoji or a zero-width space, and one of exactly 120 characters, are given exactly as stored.
  - A request carrying another account's identifier, display name or email in its body, parameters or headers is given the details of the account of its session.
  - With no session, a deleted, ended, expired (unused for more than 30 days) or tampered session, the check fails with the authentication error and gives no display name or email; when the session cannot be checked it fails with the infrastructure failure error, not as signed out, and gives no display name or email.
  - The acting user contains exactly the identifier, the display name and the email: it contains no password, no password hash, no session token and no other field of the account, checked by comparing its full content.
  - Giving the details writes nothing and does not change the session beyond what a use of the session already did: the stored accounts and sessions are identical before and after a successful check that does not renew the session, and a second check gives the same values.
  - Every test that existed before this addition passes unchanged, except the ones that compare the full content of the acting user or of what the session check returns, which only gain the two new values; no change to the stored data was needed (NFR-3). The sign-up, sign-in and sign-out actions, the session rules and the error kinds behave exactly as before, and the acting-user check keeps failing and succeeding in the same cases for every caller that only needs the account identifier.

## Open questions

None.
