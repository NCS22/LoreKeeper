---
description: SDD · Where we are - current phase, pending approvals and next step of a spec (no argument: all specs)
argument-hint: [NNN-feature]
allowed-tools: Read, Glob, Grep
---
If $ARGUMENTS is empty, list every folder in `specs/` with its phase in one line each (if `specs/` does not exist, say so). Otherwise the first word is the spec folder name: read `specs/<folder>/` (`spec.md`, `plan.md` and `tasks.md`, whichever exist), their `Status:` lines, and the "Current status" section of `CLAUDE.md`.

Tell me in Spanish, in a few lines:
1. Which phase of the SDD flow this spec is in and the `Status:` of each document.
2. What is waiting for my approval, and any open `[NEEDS CLARIFICATION]` questions.
3. Tasks done and pending (x of y).
4. The exact next step, with the `/sdd-*` command I must run.

Do not modify any file.
