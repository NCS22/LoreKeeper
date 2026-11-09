# Open decisions - LoreKeeper

Everything that is not decided yet. None of these may be implemented, and none may be written in a spec as decided: mark it `[NEEDS CLARIFICATION]` and stop (`.claude/rules/sdd.md`).

**How an item leaves this file.** The user decides. The decision is then recorded in the `plan.md` of the feature that resolves it (or in that spec's `decisions.md` if it is taken after the plan was approved; a cross-cutting decision with no feature is recorded in `CLAUDE.md`), the rules in `.claude/rules/` are updated, and the item is removed from here. The phase that was waiting for it is then unblocked in `roadmap.md`.

"Before" means the decision must be closed before the first spec of that phase is written.

Items marked "Decided" are closed but stay here until the `plan.md` of the spec named in the row records them; that plan's author then removes the row.

## Spoilers and data model

| ID | Decision | Before phase | Notes |
|---|---|---|---|
| OD-1 | Information without a known boundary | 2 | Boundary columns are `NOT NULL` until decided. In `AUTHOR` universes the boundary is stored but ignored by the filter; what a reader does with lore that predates the story, or before choosing a work, is still open. |
| OD-2 | End of a relationship (a character leaves an organization): an end boundary or a new relationship | 2 | |
| OD-3 | Participation-level spoilers: a hidden participant in a visible event | 3 | |
| OD-4 | Links between related events | 3 | |
| OD-5 | Showing that locked information exists (counts or indicators) without revealing it | 4 | |
| OD-6 | Trash retention period and automatic purge | 1 | **Decided 2026-11-06, executed by spec 005:** items stay in the trash until the owner purges them; no automatic purge (it needs a scheduler, which depends on the deployment target, OD-9). Only the owner can purge, since there is no sharing. Reconsider an automatic purge in Phase 5. |
| OD-7 | Concrete attribute schemas per entity type | 2 | One Zod schema per type, defined in the entities domain. |
| OD-19 | Sending a work to the trash while other items have their spoiler boundary on it: block it, send them to the trash too, or keep them pointing to a trashed work | 2 | Raised while closing the soft-delete rules. A unit referenced by any boundary cannot be purged. |
| OD-20 | Visibility in `READER` universes of sources that have no narrative unit (`SUPPLEMENTARY`, `USER_NOTE`, `EXTERNAL`) | 3 | Sources with a unit follow the unit. |
| OD-16 | Seed list of predefined relationship types | 2 | Proposed in `data-model.md`: `MEMBER_OF`, `LEADER_OF`, `ALLY_OF`, `ENEMY_OF`, `PARENT_OF`, `SIBLING_OF`, `LOCATED_IN`, `POSSESSES`. |

## Platform

| ID | Decision | Before phase | Notes |
|---|---|---|---|
| OD-12 | Sign-in with social accounts, email verification and password recovery or reset (the rest of authentication and access was decided 2026-11-06 and executed by specs 002 and 003) | 5 | They need an email provider, which depends on the deployment target (OD-9). Until then a forgotten password cannot be recovered. |
| OD-13 | Search: engine, scope and spoiler-safe indexing | 4 | Normalized names already exist for duplicate detection. |
| OD-9 | Deployment target, hosting and CI/CD | 5 | `.gitignore` already lists `.vercel`; no target is decided. |
| OD-14 | Public API for external consumers and models: authentication, versioning, documentation | 5 | Prerequisite of phase 6. |
| OD-11 | File uploads | none | Images are external URLs only until decided. |
| OD-15 | Import and export of universes | none | |

## AI

| ID | Decision | Before phase | Notes |
|---|---|---|---|
| OD-10 | AI provider details, pgvector and the retrieval design; where the `AiProvider` port lives | 6 | The business logic never depends on a single provider. |
| OD-8 | Origin tracking for AI-approved suggestions | 6 | |

## Tooling and deferred items

| ID | Decision | Before phase | Notes |
|---|---|---|---|
| OD-21 | Permission rules in `.claude/settings.json` so that chaining the SDD phases (the `Skill` and `Agent` tools) does not ask for confirmation at every step | first run of the new flow (spec 002) | Decide by watching which prompts really appear. That first run also proves that chaining between commands works at all. |
| OD-22 | When Prettier (`pnpm format`) and GitHub Actions are set up | none | `CLAUDE.md` lists both in the stack, but neither exists and no phase includes them. Docker Compose is already in phase 1 of the roadmap. |
