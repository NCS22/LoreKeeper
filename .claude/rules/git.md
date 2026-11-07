# Git workflow - LoreKeeper

How work gets from the working tree to `main`. Complements `CLAUDE.md` (Workflow, Limits) and `sdd.md` (the gates that trigger commits); it never overrides them. Validated by the user on 2026-11-07.

## Who does what

- The main agent (the conversation, the `/sdd-*` command or the `coordinator`) makes every branch, commit and push. Subagents (`planner`, `implementer`, `reviewer`, `hacker`, `explainer`) never run a git command that writes: no `add`, `commit`, `switch`, `push`. Their prompts say so.
- The user decides what reaches `main`.

## Permissions

Durable permission, no question needed: create branches, stage and commit, push branches other than `main` (never forced).

Ask first, every time: merge into `main` or open/merge a pull request, commit or push on `main`, delete a branch (the approval of a merge includes deleting that merged branch, local and remote, unless the user says otherwise), create tags, `commit --amend`, `reset`, `rebase`, `clean`, `restore` or `checkout --` over uncommitted work, force push, change git config or hooks, add `.gitattributes`.

## Branches

Never work on `main`. If you find yourself on `main` with changes, `git switch -c <branch>` first (the changes come along).

Names are lowercase kebab-case; `NNN-name` is the spec folder.

| Situation | Branch | Starts from |
|---|---|---|
| New spec | `spec-NNN-name` (e.g. `spec-003-account-screens`) | up-to-date `main` |
| Change to a spec already merged (`/sdd-change`) | `change-NNN-name` | up-to-date `main` |
| Change to a spec whose branch is still open | the same branch | - |
| Bug that changes no requirement | `fix-name` | up-to-date `main` |
| Bug that shows a wrong requirement | goes through `/sdd-change` | up-to-date `main` |
| Docs, rules, `CLAUDE.md`, constitution | `docs-name` | up-to-date `main` |
| Dependencies or tooling (with approval) | `chore-name` | up-to-date `main` |
| Experiment that may be thrown away | `spike-name`: deleted, or turned into a spec | up-to-date `main` |

Before creating a branch: `git fetch`, `git status -sb`; the tree must be clean. If it has changes that are not part of the new work, ask the user what to do (commit them on their own branch, or leave them); never mix them in. Then `git switch main`, `git pull --ff-only`, `git switch -c <branch>`. The branch exists before the first file of the work is written (for `/sdd-spec`, take the next free number from `specs/` yourself so branch and folder agree).

One active spec at a time. The next spec starts from `main` after the previous one is merged (003 after 002). If it needs code that is not merged yet, use a stacked branch and tell the user.

## When to commit

A commit is made when a document or a task reaches its final state for that step, never "when I remember". Examples are `type(NNN): summary`.

| Moment | Commit |
|---|---|
| Spec approved (clarification gate) | `spec(003): account screens` |
| Change to a spec approved | `spec(002): record accepted risks` |
| Plan approved | `plan(003): account screens plan` |
| Tasks approved | `tasks(003): split into 8 tasks` |
| **Each task done and verified** | `feat(002): T4 accounts domain rules` (code, tests, checkbox and the decisions of that task together; `fix`, `test`, `refactor` or `chore` when it fits better) |
| Each fix pass of the validation | `fix(002): sign-out deletes the session row` |
| Spec closed | `docs(002): close spec` |
| The user answers "Parar aquí" at any gate | commit what is in a good state, so nothing stays loose |
| Work stops in the middle of a task (waiting for the user, end of the day) | `wip(002): T5 partial`, only on a branch, never on `main`; the branch is merged as it is |
| Docs, rules, chore, fix branches | one commit per logical change |

Rules for the content of a commit:
- One logical unit. Tests, the migration, `package.json` with `pnpm-lock.yaml`, and the checkbox of a task go in the same commit as the change they belong to.
- Code is committed only after the verification gate of `CLAUDE.md` is green (`pnpm typecheck`, `pnpm lint`, `pnpm test`, plus what the task requires). Never commit red, except a `wip`. Docs-only commits need no test run.
- A commit made at a gate happens after the user's approval when the approval changes the document (`Status: approved`), and after the verification gate for code (before asking the gate).

## Before every commit

1. `git status --short` and `git diff --stat`: only files of this unit of work.
2. No secrets: no `.env*` (only `.env.example`), keys, tokens or URLs with real credentials, no `node_modules`, no `.next`, no `src/shared/infrastructure/generated/`, no scratch files. If something looks like a secret, stop and tell the user.
3. Stage with explicit paths, or `git add -A` only after the status shows nothing unrelated.
4. Never skip hooks (`--no-verify`). If a hook fails, fix the cause and make a new commit.
5. Files that tools generate (for example `AGENTS.md`, written by `next dev`): ask the user once whether they are committed or ignored, and follow the answer.

## Message format

English. `type(scope): imperative summary`, at most 72 characters, scope is the spec number or an area (`git`, `docs`). Types: `spec`, `plan`, `tasks`, `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `wip`. A body only when the why is not obvious. Commit messages end with the attribution line given in the session.

## Push

Push the branch after every commit (backup), with `git push -u origin <branch>` the first time. Never force. Never push `main` without the user's order.

## Pull request and merge

When a spec is closed (or a `docs`, `fix` or `chore` branch is finished), ask the user separately whether to open the pull request.
- The pull request has its title and description in English: what changed, how it was verified, notes. The description ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- With the GitHub CLI (`gh`) installed, create it with `gh pr create`. Without it (today it is not installed), give the user the compare link `https://github.com/NCS22/LoreKeeper/pull/new/<branch>` and the title and description to paste.
- Merge with a merge commit (no squash, no rebase), so `main` keeps one commit per task and one merge commit per spec. The user merges in GitHub, or tells the agent to merge locally (`git switch main`, `git pull --ff-only`, `git merge --no-ff <branch>`, `git push origin main`).
- Before merging: `git fetch`. If `main` moved on, merge `main` into the branch (never rebase), run the verification gate again, push.
- After the merge: `git switch main`, `git pull --ff-only`, delete the merged branch locally (`git branch -d`) and remotely.

## Special cases

- Uncommitted changes when starting: see "Branches".
- Merge conflicts: stop, explain them in Spanish, and do not resolve them silently.
- Wrong commit: fix it with a new commit or `git revert`. `amend`, `reset` and `rebase` need the user's permission; if the commit is not pushed, propose `git reset --soft HEAD~1` and wait for the answer.
- Resuming a session: `/sdd-status` shows the branch, whether the tree is clean and the last commit; if there are uncommitted changes, ask what to do before starting.
- Hook, build or test fails on the branch: fix before committing; do not commit around it.
- The user asks for a commit by hand: follow these rules; if the tree is on `main`, create a branch first.
- Line endings: on this machine `core.autocrlf` is `true`, so git prints "LF will be replaced by CRLF" warnings; they are harmless. A `.gitattributes` would silence them and needs the user's approval.
- Local branches already merged and left over are cleaned up only with the user's permission.
