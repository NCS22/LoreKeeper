---
description: SDD · Validate the spec FR by FR (typecheck, lint, tests and browser testing)
argument-hint: <NNN-feature>
---
The first word of $ARGUMENTS is the spec folder name. Delegate to the @reviewer subagent (Agent tool, subagent_type "reviewer"), following the "If asked to validate the implementation" section of its instructions, and pass it the folder.

It goes through `specs/<folder>/spec.md` requirement by requirement. For each FR it indicates how it is covered (file:line, test) and the result of `pnpm typecheck`, `pnpm lint` and `pnpm test` (plus the spoiler suite when queries, visibility or reading progress changed, and `pnpm test:e2e` if a user flow changed and the script exists).

UI FRs are checked on `pnpm dev` (http://localhost:3000): desktop first, then a narrow viewport, dark theme, no console errors. If the browser cannot be run, the FR is reported as "NOT VERIFIED IN BROWSER" with the exact steps for me.

If any FR is not covered or fails, it says so clearly. Do NOT fix anything yet. Then it checks the completion criteria, the architecture rules and the spoiler rules, and gives me a verdict: is the spec fulfilled?

Show me the result in Spanish, keeping its order and severity (use @explainer if it is too technical for me).
