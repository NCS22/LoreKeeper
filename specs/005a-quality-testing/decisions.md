# Decisions 005a — Quality testing strategy

Decisions taken after the plan was approved, not recorded in `plan.md`.

## D-T3-1. The empty `component` project passes through a script flag

- **Decided:** the `component` step of `test:coverage` runs with `--passWithNoTests`; the `unit` and `database` steps do not, so an empty run of those still fails. The flag can be removed once the first `.test.tsx` exists.
- **Why:** Vitest 5 does not accept `passWithNoTests` inside a project definition (the type check rejects it), and the plan only asked for "the setting that allows an empty project".
- **Discarded:** a global `passWithNoTests` in the Vitest configuration, because it would also let an empty `unit` or `database` run pass silently.
- **Approved by:** the user, 2026-11-20, at the T3 implementation gate.
