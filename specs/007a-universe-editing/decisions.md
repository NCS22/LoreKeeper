# Decisions 007a — Universe editing

Decisions taken after the plan was approved. Design decisions of the plan stay in `plan.md` section 8.

## D-T2-1. The real-change rule trims both texts itself

- **Decided:** `isRealUniverseChange` trims the stored and the edited texts before comparing them in NFC, although the edited values reach it already validated (and so trimmed).
- **Why:** for validated values the result is the same, and the rule stays complete on its own, so its test "whitespace at the ends only is no change" (plan section 7) checks the rule itself, as the Definition "Real change" speaks of the trimmed texts.
- **Discarded:** no trimming in the rule, testing the whitespace case only through the name and description validators; the rule's own test would then not check that case.
- **Approved by:** the user, 2026-11-27, at the implementation gate after T2.

## D-T5-1. The evidence of T5 names only the tests that really start red

- **Decided:** the `Evidence:` line of T5 is "red then green" and names only the tests that fail on the code of T4 (the malformed, empty and missing identifier as a validation error, the malformed identifier reported before the failing fields, the identifier in upper case, which fails on the fake storage, and a foreign or nonexistent universe with invalid fields answering not found and not a validation error). The scenarios that already pass on the code of T4 (the same not found error for a foreign and a nonexistent universe with valid values and with values equal to the stored ones, "never changes a universe of another account", the universe gone before the write, and a failing field reported before the real-change decision) are still added as tests, the protected ones listed in the UNI-3 entry of `docs/criticality-inventory.md`, but are not presented as red then green.
- **Why:** T4 already read the universe before the real-change decision and turned a null read or write into the not found error, so these scenarios hold before the reordering; the evidence line must say what really happened (skill `quality-testing-core`, section 8).
- **Discarded:** writing an artificial failure into the code to make them start red, which proves nothing about the change; calling them characterization tests, which are for a change that keeps behavior on a known gap, while T5 changes behavior.
- **Approved by:** the user, 2026-11-27, at the implementation gate after T4.

## D-T9-1. The edit block and the edit notice are read for one universe

- **Decided:** `universe-edit-state.ts` offers `isEditBlocked(state, universeId)` and `editNoticeFor(state, universeId)`, which answer for the universe asked about only; for any other universe they answer "not blocked" and "no notice".
- **Why:** a universe selected while another universe's request is alive must never inherit that request's block or message (spec 006 FR-12, plan section 5, "Edit state of one request").
- **Discarded:** selectors without the universe identifier, as `isCreationBlocked(state)` of the creation state; the caller would then have to compare identifiers itself, and a forgotten comparison would show one universe's message on another.
- **Approved by:** the user, 2026-11-28, at the implementation gate after T9.

## D-T9-2. Opening the edit form of another universe starts a clean state

- **Decided:** a `formOpened` event for a universe other than the one in the state replaces the state (that universe, no block, no notice), even while the earlier request is alive; its later answers are then ignored by the reducer, while they still reach the navigation entry (T10, T14).
- **Why:** the plan says a submission for another universe replaces the state; applying the same rule when the form of another universe opens keeps the earlier universe's block and messages out of the new form before anything is sent (spec 006 FR-12).
- **Discarded:** keeping the earlier universe's state until the next submission; the selectors of D-T9-1 would hide it, but a late answer of the earlier request could still turn into a stale confirmation once the person returned to that universe.
- **Approved by:** the user, 2026-11-28, at the implementation gate after T9.
