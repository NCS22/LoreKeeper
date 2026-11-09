---
description: SDD · Validate the spec FR by FR (reviewer and hacker), fix problems and close the spec
argument-hint: <NNN-feature>
---
Read `.claude/rules/sdd.md` first (Flow, Approval gates, Validation, Closing a spec) and follow it.

The first word of $ARGUMENTS is the spec folder name. Read `tasks.md`: if any task is not `- [x]`, tell me which ones and stop (the way forward is `/sdd-implement <folder>`).

Launch these in the same message so they run in parallel, passing each the folder (all follow "Reading budget" in `sdd.md`; give @hacker the file list, not just the folder). The third only if the spec has UI FRs:
1. @reviewer (Agent tool, subagent_type "reviewer"), following the "If asked to validate the implementation" section of its instructions. It goes through `specs/<folder>/spec.md` requirement by requirement. For each FR it indicates how it is covered (file:line, test) and the result of `pnpm typecheck`, `pnpm lint` and `pnpm test` (plus the spoiler suite when queries, visibility or reading progress changed, and `pnpm test:e2e` if a user flow changed and the script exists). It does not open a browser: for UI FRs it names the E2E test that covers each one, or "UI: see frontend-tester report". If any FR is not covered or fails, it says so clearly and fixes nothing. Then it checks the completion criteria, the architecture rules and the spoiler rules and gives a verdict: is the spec fulfilled?
2. @hacker (Agent tool, subagent_type "hacker"), scoped to the files this spec created or changed (look at the task list and `git status`). It audits security and robustness, spoiler leaks, ownership and validation first, and fixes nothing.

3. @frontend-tester (Agent tool, subagent_type "frontend-tester"), with the spec folder, "whole spec" and the list of UI FR ids (search `spec.md` for them). It checks them in a real browser (desktop, 320 px, dark theme, console, keyboard) and fixes nothing. Its failures count as problems for the gate, and a UI FR not covered by an E2E test is only OK if the tester reports it OK. If its report ends in `INCOMPLETE (DATABASE NEEDED)`, before showing anything ask me with `AskUserQuestion`: "Ya la he arrancado" (`docker compose up -d`, with Docker Desktop open; run it again only on its "NECESITA BASE DE DATOS" list), "Seguir sin ella" (those FRs are listed as not verified in browser and I accept them) or "Parar aquí". Never start the database yourself.

Pass all reports through @explainer (always, as `sdd.md` requires), keeping their order and severity, and show me the result in Spanish.

Git (`.claude/rules/git.md`): commit each fix pass (`fix(NNN): ...`) and the closing (`docs(NNN): close spec`), pushing the branch after each. After the closing summary, ask me separately about the pull request and the merge into `main`; never merge on your own.

Close with the Validation gate (`sdd.md`, Approval gates):
- All clean (`VERDICT: APPROVED`, `SAFE` and, if it ran, `UI VERDICT: PASSES`, or `INCOMPLETE (DATABASE NEEDED)` that I accepted with "Seguir sin ella"): options "Cerrar la spec" and "Parar aquí". On "Cerrar la spec", follow "Closing a spec" in `sdd.md`: @planner sets the spec to `implemented`, @implementer updates "Current status" in `CLAUDE.md`, `docs/open-decisions.md` and `docs/roadmap.md`; then you empty `.playwright-mcp/` as step 3 of "Closing a spec" says (count the files first, e.g. `ls .playwright-mcp .playwright-mcp/snapshot | wc -l`). Then summarize in Spanish what was done, the verdicts and what is still pending.
- Any problem: options "Corregir los problemas" and "Parar aquí". On "Corregir", follow the fix loop in `sdd.md` (Validation): at most 2 rounds, one @implementer pass for each report with findings, then run again only the checks that had findings, through @explainer, and ask the gate again. A finding that means the requirement is wrong goes through `/sdd-change <folder>` instead of a code fix.
