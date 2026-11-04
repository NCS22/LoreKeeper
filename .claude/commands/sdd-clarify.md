---
description: SDD · Review the spec as QA (only detects, does not resolve)
argument-hint: <NNN-feature>
---
The first word of $ARGUMENTS is the spec folder name. Delegate to the @reviewer subagent (Agent tool, subagent_type "reviewer"), following the "If asked to review a spec" section of its instructions, to review `specs/<folder>/spec.md` as if it were a very professional QA. Pass it the path and tell it to follow `.claude/rules/sdd.md` and read `CLAUDE.md` and `docs/spec.md` (if it exists).
It must list:
1. Remaining ambiguities (requirements that cannot be verified).
2. Contradictions between requirements.
3. Uncovered edge cases.
4. Conflicts with `CLAUDE.md` (Rules, Limits, spoiler and data rules), the out-of-scope list or an open decision.
5. A missing or empty "Spoiler impact".
6. Stack, architecture or file names inside the spec.

Do not propose solutions yet: only detect. Format: numbered list. Show me the result in Spanish, keeping its order and severity (use @explainer if it is too technical for me). Then suggest the next step: fix the spec with `/sdd-change`, or approve it and run `/sdd-plan <folder>`.
