---
description: SDD · Where we are - current phase, pending approvals and next step of a spec (no argument: all specs)
argument-hint: [NNN-feature]
allowed-tools: Read, Glob, Grep, AskUserQuestion, Skill, Bash(git status:*), Bash(git log:*), Bash(git branch:*)
---
Read `.claude/rules/sdd.md` first (Flow, Approval gates and the "Resuming" table).

If $ARGUMENTS is empty, list every folder in `specs/` with its phase in one line each (if `specs/` does not exist, say so). Then ask me with `AskUserQuestion` which spec I want to continue (or none).

Otherwise the first word is the spec folder name: read `specs/<folder>/` (`spec.md`, `plan.md` and `tasks.md`, whichever exist), their `Status:` lines, and the "Current status" section of `CLAUDE.md`.

Tell me in Spanish, in a few lines:
1. Which phase of the SDD flow this spec is in and the `Status:` of each document.
2. What is waiting for my approval, and any open `[NEEDS CLARIFICATION]` questions.
3. Tasks done and pending (x of y).
4. The next step, taken from the "Resuming" table in `sdd.md`.
5. Git (`.claude/rules/git.md`): the current branch, whether the tree is clean and the last commit (`git status -sb`, `git log --oneline -3`). If there are uncommitted changes, say so and ask what to do before continuing.

Then ask me with `AskUserQuestion` whether to continue: "Continuar con <next step>" runs that command (or asks the pending gate again) through the `Skill` tool; "Parar aquí" ends. If the spec is `implemented`, offer instead to start a new spec with `/sdd-spec` or to change this one with `/sdd-change`.

Do not modify any file yourself; any change is made by the command you start.
