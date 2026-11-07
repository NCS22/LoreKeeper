---
description: SDD · Validate the spec FR by FR (reviewer and hacker), fix problems and close the spec
argument-hint: <NNN-feature>
---
Read `.claude/rules/sdd.md` first (Flow, Approval gates, Validation, Closing a spec) and follow it.

The first word of $ARGUMENTS is the spec folder name. Read `tasks.md`: if any task is not `- [x]`, tell me which ones and stop (the way forward is `/sdd-implement <folder>`).

Launch these two in the same message so they run in parallel, passing each the folder:
1. @reviewer (Agent tool, subagent_type "reviewer"), following the "If asked to validate the implementation" section of its instructions. It goes through `specs/<folder>/spec.md` requirement by requirement. For each FR it indicates how it is covered (file:line, test) and the result of `pnpm typecheck`, `pnpm lint` and `pnpm test` (plus the spoiler suite when queries, visibility or reading progress changed, and `pnpm test:e2e` if a user flow changed and the script exists). UI FRs are checked on `pnpm dev` (http://localhost:3000): desktop first, then a narrow viewport, dark theme, no console errors. If the browser cannot be run, the FR is reported as "NOT VERIFIED IN BROWSER" with the exact steps for me. If any FR is not covered or fails, it says so clearly and fixes nothing. Then it checks the completion criteria, the architecture rules and the spoiler rules and gives a verdict: is the spec fulfilled?
2. @hacker (Agent tool, subagent_type "hacker"), scoped to the files this spec created or changed (look at the task list and `git status`). It audits security and robustness, spoiler leaks, ownership and validation first, and fixes nothing.

Pass both reports through @explainer (always, as `sdd.md` requires), keeping their order and severity, and show me the result in Spanish.

Git (`.claude/rules/git.md`): commit each fix pass (`fix(NNN): ...`) and the closing (`docs(NNN): close spec`), pushing the branch after each. After the closing summary, ask me separately about the pull request and the merge into `main`; never merge on your own.

Close with the Validation gate (`sdd.md`, Approval gates):
- Both clean (`VERDICT: APPROVED` and `SAFE`): options "Cerrar la spec" and "Parar aquí". On "Cerrar la spec", follow "Closing a spec" in `sdd.md`: @planner sets the spec to `implemented`, @implementer updates "Current status" in `CLAUDE.md`, `docs/open-decisions.md` and `docs/roadmap.md`. Then summarize in Spanish what was done, both verdicts and what is still pending.
- Any problem: options "Corregir los problemas" and "Parar aquí". On "Corregir", follow the fix loop in `sdd.md` (Validation): at most 2 rounds, one @implementer pass for each report with findings, then run again only the checks that had findings, through @explainer, and ask the gate again. A finding that means the requirement is wrong goes through `/sdd-change <folder>` instead of a code fix.
