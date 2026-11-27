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
