# Hardening backlog

Costly and rare protections that are not built inside each spec (see "Spec budget and hardening" in `.claude/rules/sdd.md`). They are decided in one block before Phase 5, not spec by spec. Open this file when a phase starts and move an item into a spec when its risk becomes real.

What is NOT here, because every spec does it: owner isolation, Zod at the boundary, spoiler filtering, typed errors. What is not here either, because it already exists as shared code from spec 004 and is reused: single submission, unanswered and late answers, text rules (Unicode, null character, NFC), clearing account-scoped state on account change, error mapping.

| Item | Why it is parked | Seen in |
|---|---|---|
| Several tabs of the same account at once (state sync, duplicate warning across tabs) | Rare for the current users; large E2E cost | 004 FR-18, `tests/e2e/universes-tabs.spec.ts` |
| Network cuts and slow answers with a simulated clock (30 s, 5-minute cap) | Needs a controlled clock and trigger-based failure injection in tests | 004 FR-8, `tests/e2e/universes-failures.spec.ts` |
| Layout stress at 320 px with hundreds of items and hostile text (direction controls, 2000 characters) | Visual cost far above the real risk today | 004 FR-19, `tests/e2e/universes-layout.spec.ts` |
| Served-files scan for stored data (static files, RSC answers) | Slow broad test; repeat per new kind of data | 004 FR-36, `tests/e2e/sample-data-absent.spec.ts` |

When an item is promoted into a spec, remove it from this table and cite the spec.
