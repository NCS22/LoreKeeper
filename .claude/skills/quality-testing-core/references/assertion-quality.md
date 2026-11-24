# Assertion quality - reference of `quality-testing-core`

Read it when you write or review a test, when you validate a spec (FR-18) and during an audit. It expands section 5 of `SKILL.md` (FR-6).

The rule: **a test is weak when it would still pass if the result were wrong.** Assertion quality is a review criterion, never a percentage; a covered line is not a checked line.

Every example names a real test with its file and line (the line of the `it` or of the assertion cited). The examples illustrate the criterion: they are **not audit verdicts**. The verdict of each test group is given only in `specs/005a-quality-testing/audit-report.md` and decided by the user at the 005b gate. Where the repository has no real weak case, the example says so and is an illustrative rewrite of a named real test.

## How to apply it

For each assertion, ask: "If the code returned a wrong value, the wrong error or nothing at all, would this line fail?" A test passes review when at least one of its assertions answers yes for each behavior its name promises. A weak line next to strong lines in the same test is not a defect; a test whose only checks are weak lines is.

## The six criteria

### 1. It asserts the outcome, not only that something ran

Weak forms: `not.toThrow()` on code whose result is not otherwise checked, `toHaveBeenCalled()` alone, `toBeDefined()` on the value the behavior produces.

- Weak line: `tests/modules/accounts/composition.test.ts:43` `expect(() => createAccountsModule()).not.toThrow();`. On its own it would pass for a composition that wires the wrong pieces. The test at line 40 ("can be imported and composed without throwing and without building anything heavy") is strong because lines 46-47 check the real promise: no Better Auth instance and no Prisma client were built.
- Strong: `tests/shared/presentation/assert-same-site-request.test.ts:23` ("accepts a request marked same-origin") uses `not.toThrow()` legitimately: the function's only outcome is throwing or not, and the rejecting cases right after it (line 49 `rejects Sec-Fetch-Site: %s`, line 55 `rejects a foreign Origin`) prove it can throw a `ValidationError`, so an implementation that never throws fails.

### 2. It would fail if the rule were inverted, the boundary moved by one, or the error type changed

Test both sides of every limit, at the exact limit and one past it, and check the issue reported, not only "invalid".

- Weak (illustrative rewrite; no real test of this kind was found): a version of `tests/modules/universes/domain/universe-name.test.ts:35` that sends 200 characters and checks only `isValid: false`. A limit moved to 150, or the issue code changed to `NAME_REQUIRED`, would still pass.
- Strong: the real test at `tests/modules/universes/domain/universe-name.test.ts:35` ("rejects a name one character over the maximum and reports the limit") sends `MAXIMUM_UNIVERSE_NAME_LENGTH + 1` and checks the whole issue (`field`, `code: "NAME_TOO_LONG"`, `maximumLength`); line 29 checks the exact maximum is accepted. Same pattern on both limits in `tests/modules/accounts/domain/account-password.test.ts:21` (7 rejected), `:29` (8 accepted), `:36` (128 accepted) and `:43` (129 rejected).

### 3. It checks the specific value or typed error, not a truthy shape

Weak forms: `toBeTruthy()`, `toBeDefined()`, `toBeInstanceOf(Error)` when a more specific value or class is known.

- Weak line: `tests/modules/universes/infrastructure/prisma-universe-repository.test.ts:112` `expect((failure as InfrastructureError).cause).toBeDefined();` in the test at line 105 ("turn a failed write into an InfrastructureError that keeps the cause"). Any cause, including an unrelated one, passes; the error class is checked at line 111, the cause only by shape.
- Strong: `tests/shared/domain/error-kinds.test.ts:46` `expect(new InfrastructureError("x", { cause: originalFailure }).cause).toBe(originalFailure);` in the test at line 43 ("keeps the cause of an infrastructure or external provider failure"): it checks the identity of the cause, and line 48 checks there is none when none was given.
- In end-to-end tests a truthy check can be the honest limit of what a browser sees (a session cookie value is opaque): `tests/e2e/sign-in.spec.ts:74` `toBeTruthy()` on the session cookie is backed by the URL and workspace checks at lines 72-73. Accept it there only when the stronger value is not observable.

### 4. It exercises a behavior no lower-level test already proves

A higher-level test earns its cost by what only that level can show. Before writing one, search the lower levels (section 6 of `SKILL.md`).

- Overlap to examine (a candidate, not a verdict): the cases generated at `tests/e2e/access.spec.ts:244` ("ignores <destination> and uses the workspace root", six destinations listed from line 234) repeat in the browser the destination rule that `tests/modules/accounts/domain/return-destination.test.ts:144` ("refuses %s") proves at unit level. Whether the browser adds something (real redirects after a real sign-in) is decided per group in the audit (`testing-evaluation.md` section 1.7, point 5).
- Strong: `tests/e2e/access.spec.ts:58` ("gets 303 to sign-in, with no workspace text and no cookie, for <request>") checks what only a real request shows: status 303, the `location`, `cache-control: no-store` and no `set-cookie` header, per HTTP method.

### 5. It does not depend on private structure, call order or exact markup

A correct refactor must not break the test. Spies on internals are acceptable to provoke a situation or to confirm a precondition, not as the proof of the behavior.

- Weak line: `tests/modules/accounts/infrastructure/better-auth-account-authenticator.test.ts:349` `expect(renewalSpy).toHaveBeenCalled();` (spy created at line 343 on the library's internal `internalAdapter.updateSession`). As the only check it would tie the test to a private method of Better Auth. In the test at line 335 ("ends a session whose renewal is pending...") it only confirms the scenario happened; the behavior is proved by lines 350-351 (no session row left, no cookie).
- Strong: `tests/modules/universes/application/remember-universe.test.ts:118` ("keeps the remembered universe of each account apart") reads the result through the public repository port (`findRememberedUniverseId`), not through calls or private state, so it runs unchanged on the fake and on PostgreSQL.

### 6. Its name says the behavior, so a failure explains itself

Write the name as the behavior and its condition: what is answered, for which input.

- Weak (illustrative rewrite; no real name of this kind was found): renaming `tests/modules/accounts/application/sign-in.test.ts:49` to "handles bad credentials". A failure would not say whether the two answers differed, a session started, or the error type changed.
- Strong: the real name at `tests/modules/accounts/application/sign-in.test.ts:49` "answers a wrong password and an unknown email with the same error and starts no session", whose assertions (lines 61-64) check exactly those three promises.
- Borderline: a short name that relies on its `describe` path, like `tests/app/actions.test.ts:107` "succeeds a second time" under `signOutAction > without a valid session (FR-18)` (lines 53 and 102), is readable in the runner's full path; keep the full path meaningful when you nest.

## Coverage-only tests

A test written to turn a line green fails criterion 1 or 3 by construction. Do not write it: record an override in the inventory entry (`SKILL.md` section 3). Incidental coverage of TIER 0 code is never a target.

## Checklist for the reviewer

- [ ] Each behavior in the test name has an assertion that would fail if it were wrong (1, 6).
- [ ] Limits checked at the exact value and one past it, issue or error type checked (2).
- [ ] No bare `toBeTruthy`, `toBeDefined` or `toBeInstanceOf(Error)` where a specific value is observable (3).
- [ ] No lower-level test already proves the same thing, or the higher level proves something extra (4).
- [ ] Spies on internals only provoke or confirm a precondition; results read through public ports (5).
