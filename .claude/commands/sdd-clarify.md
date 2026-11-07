---
description: SDD · Review the spec as QA (only detects, does not resolve)
argument-hint: <NNN-feature>
---
Read `.claude/rules/sdd.md` first (Flow and Approval gates) and follow it.

The first word of $ARGUMENTS is the spec folder name. Delegate to the @reviewer subagent (Agent tool, subagent_type "reviewer"), following the "If asked to review a spec" section of its instructions, to review `specs/<folder>/spec.md` as if it were a very professional QA. Pass it the path and tell it to follow `.claude/rules/sdd.md` and read `CLAUDE.md`, `docs/roadmap.md` and `docs/open-decisions.md`.
It must list:
1. Remaining ambiguities (requirements that cannot be verified).
2. Contradictions between requirements.
3. Uncovered edge cases.
4. Conflicts with `CLAUDE.md` (Rules, Limits, spoiler and data rules), the out-of-scope list or an open decision.
5. A missing or empty "Spoiler impact".
6. Stack, architecture or file names inside the spec.

Do not propose solutions yet: only detect. Format: numbered list. Show me the result in Spanish, keeping its order and severity (always pass it through @explainer first, as `sdd.md` requires).

Then close with the Clarification gate (`sdd.md`, Approval gates):
- No findings and no open `[NEEDS CLARIFICATION]`: options "Aprobar la spec y escribir el plan" (@planner sets `Status: approved` on `spec.md`, then start `/sdd-plan <folder>` through the `Skill` tool), "Pedir cambios", "Parar aquí".
- Git (`.claude/rules/git.md`): when I approve the spec, commit it (`spec(NNN): ...`) and push the branch before starting `/sdd-plan`.
- With findings or open questions: do not offer to approve. Options "Corregir la spec" (start `/sdd-change <folder>` with the findings as the requirement to resolve, and run `/sdd-clarify <folder>` again when the change is approved) and "Parar aquí".
