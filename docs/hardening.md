# Hardening backlog

Costly and rare protections that are not built inside each spec (see "Spec budget and hardening" in `.claude/rules/sdd.md`). They are decided in one block before Phase 5, not spec by spec. Open this file when a phase starts and move an item into a spec when its risk becomes real.

What is NOT here, because every spec does it: owner isolation, Zod at the boundary, spoiler filtering, typed errors. What is not here either, because it already exists as shared code from spec 004 and is reused: single submission, unanswered and late answers, text rules (Unicode, null character, NFC), clearing account-scoped state on account change, error mapping.

| Item | Why it is parked | Seen in |
|---|---|---|
| Several tabs of the same account at once (state sync, duplicate warning across tabs) | Rare for the current users; large E2E cost | 004 FR-18, `tests/e2e/universes-tabs.spec.ts` |
| Network cuts and slow answers with a simulated clock (30 s, 5-minute cap) | Needs a controlled clock and trigger-based failure injection in tests | 004 FR-8, `tests/e2e/universes-failures.spec.ts` |
| Layout stress at 320 px with hundreds of items and hostile text (direction controls, 2000 characters) | Visual cost far above the real risk today | 004 FR-19, `tests/e2e/universes-layout.spec.ts` |
| Served-files scan for stored data (static files, RSC answers) | Slow broad test; repeat per new kind of data | 004 FR-36, `tests/e2e/sample-data-absent.spec.ts` |
| Several tabs of the same account at once for the knowledge items (works, entities and relationships created in one tab, lists and details panel already loaded in another) | Same as for universes: rare for the current users, large E2E cost; a list loaded in another tab may be out of date until reload (accepted risk of spec 006) | 006 FR-11, FR-12 (Out of scope) |
| Network cuts and slow answers with a simulated clock for the work, entity and relationship forms and the knowledge loads | Same as for universes: needs a controlled clock and failure injection; the shared creation lifecycle of spec 004 is reused, not rebuilt | 006 FR-11 (004 FR-7 to FR-10), `tests/e2e/knowledge.spec.ts` covers only the unknown-result message |
| Layout stress with hundreds of entities or relationships and hostile text in the entity list and the details panel | Visual cost far above the real risk today; the limits of spec 006 (5000 units, 200-character title, 5000-character fragment at 320 px) are covered by NFR-3 | 006 FR-9, FR-10 (Out of scope), `tests/e2e/knowledge.spec.ts` |

When an item is promoted into a spec, remove it from this table and cite the spec.
