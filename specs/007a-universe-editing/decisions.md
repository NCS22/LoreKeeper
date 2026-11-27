# Decisions 007a — Universe editing

Decisions taken after the plan was approved. Design decisions of the plan stay in `plan.md` section 8.

## D-T2-1. The real-change rule trims both texts itself

- **Decided:** `isRealUniverseChange` trims the stored and the edited texts before comparing them in NFC, although the edited values reach it already validated (and so trimmed).
- **Why:** for validated values the result is the same, and the rule stays complete on its own, so its test "whitespace at the ends only is no change" (plan section 7) checks the rule itself, as the Definition "Real change" speaks of the trimmed texts.
- **Discarded:** no trimming in the rule, testing the whitespace case only through the name and description validators; the rule's own test would then not check that case.
- **Approved by:** the user, 2026-11-27, at the implementation gate after T2.
