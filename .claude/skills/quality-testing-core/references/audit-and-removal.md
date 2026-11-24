# Audit and removal - reference of `quality-testing-core`

Read it when you audit tests, when you propose to simplify or delete a test, and when spec 005b starts. It expands section 7 of `SKILL.md` (FR-9, FR-10, FR-15, D-3, D-6).

## Test groups and verdicts

A **test group** is one test file, or a set of test files that protect the same component. Every test file belongs to exactly one group; test support and the tests of lint rules are groups of their own. Each group gets an id (`A-01`, ...), stable once written, and **exactly one verdict**:

| Verdict | Meaning | Required in the row |
|---|---|---|
| `KEEP` | Gives real protection | Behavior protected |
| `REFACTOR` | Valid intention, deficient implementation (for example weak assertions, see `assertion-quality.md`) | What to change |
| `DELETE` | Redundant, artificial or without value | `Protection kept`: the test or strategy that keeps the protection |
| `REPLACE` | A better strategy exists to protect the behavior | `Protection kept`: the replacement and why it protects at least as much |
| `REVIEW` | Information is missing to decide | `Missing information` |

Before a verdict, check the group against the six criteria of `assertion-quality.md`, the distribution of `test-type-strategies.md`, and the inventory entries it protects. Overlap with a lower level is a reason to examine, not a verdict by itself: say what the higher level adds, or that it adds nothing.

The verdicts live in `specs/005a-quality-testing/audit-report.md`. The report is not an approval: the user approves group by group as the answer at the 005b approval gate, and the 005b spec lists the approved group ids. Producing the report changes no test.

## Protected tests

**Protected tests** are the tests that prove one user cannot read or change another user's data (owner isolation) and, from Phase 4, the tests that prove spoiler filtering. Protection applies **per test, not per file**. Today they are, for example:
- `tests/support/contracts/universe-repository-contract.ts:102` ("never lists the universes of another owner") and `:119` ("answers null for a universe of another owner and for one that does not exist alike"), run on the fake and on PostgreSQL.
- `tests/modules/universes/application/remember-universe.test.ts:99`, `:118` and `:133` (foreign and nonexistent universe give the same not found error; each account's remembered universe kept apart; an account cannot remember the other's universe).
- `tests/e2e/universes-isolation.spec.ts:136` (a foreign identifier and a nonexistent one give the same answer through a real call).

The complete individual list is section C of the audit report. Rules (FR-10):
- The tests themselves are not classified; the components they protect are always `CORE`.
- Each protected test is listed individually, with file, describe and test name, line and what it proves, and gets only `KEEP` or `REVIEW`, individually.
- **A group verdict never applies to a protected test inside the group**, and approving the group in 005b does not cover it.
- Any change to a protected test needs its own explicit approval of the user at a flow gate and never reduces what it checks.
- A new spoiler-filtering test is protected from the moment it is written.

### The D-6 case: the only way a protected test may be proposed for deletion

Only when the production behavior it protects is **removed entirely**. Then:
1. The proposal goes test by test, never as a group.
2. It shows that no other remaining path loses its protection: list every read or write path of the same data and the test that still protects each.
3. It needs the explicit approval of the user at a flow gate.

If the behavior is only partly removed, or a protected test is still exercised by remaining behavior, it is not proposed.

## Proposal format

From the closing of 005b on, deletions and simplifications are proposed case by case, with a written justification that no protection is lost, and nothing is deleted or simplified without the user's explicit approval at a flow gate (FR-15). The tests of a removed behavior are proposed before the change that removes it (`SKILL.md` section 8). One block per test or group:

```
Proposal: DELETE | SIMPLIFY <test file> > <describe> > <test name>
Protects: <behavior and inventory entry id>
Why no protection is lost: <the test or strategy that keeps it>
Protected test: no | yes, behavior removed entirely (D-6), other paths checked: <list>
```

Example (illustrative only; this is not a verdict and it is not proposed):

```
Proposal: SIMPLIFY tests/e2e/access.spec.ts > the return destination in the browser (FR-13, FR-19, FR-20) > ignores <destination> and uses the workspace root
Protects: the return destination rule after sign-in (ACC-2)
Why no protection is lost: tests/modules/accounts/domain/return-destination.test.ts > resolveReturnDestination > refuses %s keeps every refused destination; one browser case keeps the real redirect
Protected test: no
```

## The 005b re-check by blob ids (FR-9)

The audit report stores, for each test file, the **first 12 characters of its git blob id** at the time the report is closed (`git hash-object <file>`). When 005b starts:
1. Recompute the ids at the commit that closes 005a. It equals the commit where the report was written, because 005a changes no test (NFR-1).
2. Compare them with the current ids: one `git hash-object <file>` per file listed. No script is needed.
3. Mark `REVIEW` every group with at least one different id, an added file or a removed file, **before** the user is asked.

The protected tests of a group marked `REVIEW` this way are re-checked individually as well.

## Audit checklist

- [ ] Every test file is in exactly one group, with its 12-character blob id.
- [ ] Each group has exactly one verdict and the column it requires.
- [ ] Every protected test is listed individually with `KEEP` or `REVIEW` and marked untouchable.
- [ ] No row is worded as an approval; approval is the answer at the 005b gate.
