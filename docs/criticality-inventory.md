# Criticality inventory - LoreKeeper

Living document: every production file of the repository, grouped into entries, with its criticality level, the reason for it, the testing strategy and its protection status. Created by spec 005a; kept current by every task that adds, moves or reclassifies a production file.

## How to read it

- **Levels.** `CORE`, `IMPORTANT` and `TIER 0` are defined in the skill `.claude/skills/quality-testing-core/SKILL.md` (section "Levels and how to classify"), together with the reclassification rule. This file does not restate the definitions; it only applies them.
- **One entry per component or per cohesive group** of files that share level and strategy. Every production file matches exactly one entry; an unmatched or duplicated file is a defect, fixed in the task that finds it.
- **Columns.**
  - `Id`: area prefix and number (for example `ACC-3`). Ids are stable; a removed entry leaves its id unused.
  - `Files`: repository-relative glob patterns, one per line (separated by `<br>`), each in backticks. The coverage report script reads this column, so it holds only patterns.
  - `Responsibility`: what the component does, in one sentence.
  - `Level`: `CORE`, `IMPORTANT` or `TIER 0`.
  - `Why`: the reason for the level.
  - `Strategy`: test types and what they must protect.
  - `Protection`: measured lines and branches by test type with the date of the snapshot (for example `2026-11-23: unit 92/85, database 40/30, combined 95/88`), or `protected by browser test <name>`, or `none: gap`.
  - `Exceptions and gaps`: a target override with its reason, or a gap with the plan to close it, or `-`.
- **Coverage targets** are quality goals, not quotas, on **lines and branches** of each entry (the entry is the sum of its files): `CORE` 100 %, `IMPORTANT` 80 %, `TIER 0` none. Statements and functions are not part of the policy. A test that exercises several components counts toward each of them.
- **Exceptions.** When a target cannot be reached without redundant, fragile or low-value tests, the entry records an override in its `Exceptions and gaps` cell, written exactly as `override: lines 100, branches 92, reason: <why>`; the report script applies it. A component reclassified upward that is below its new target records the gap with the plan to close it and fails nothing.
- **Coverage figures.** The `Protection` column keeps a dated snapshot; the live figures come from `pnpm test:coverage`, which ends by printing, per entry, lines and branches for the `unit`, `database` and `component` test types and combined, the level, the target and the distance to it, plus the unmatched and duplicated files. End-to-end tests are shown as "not measured": the behaviors they alone protect are named in the entry.
- **Thresholds are defined but not active.** The policy above is the one that coverage thresholds will enforce; they are not configured and `pnpm test:coverage` never fails on a gap. They are turned on in spec 005b, after its test cleanup.
- **Authority order.** The constitution (`CLAUDE.md` and `.claude/rules/*`) prevails over the skill, and the skill prevails over this inventory. When this file contradicts either, the file is wrong and is fixed in the same task.

## Accounts

| Id | Files | Responsibility | Level | Why | Strategy | Protection | Exceptions and gaps |
|---|---|---|---|---|---|---|---|

## Universes

| Id | Files | Responsibility | Level | Why | Strategy | Protection | Exceptions and gaps |
|---|---|---|---|---|---|---|---|

## Shared

| Id | Files | Responsibility | Level | Why | Strategy | Protection | Exceptions and gaps |
|---|---|---|---|---|---|---|---|

## App routes, actions and proxy

| Id | Files | Responsibility | Level | Why | Strategy | Protection | Exceptions and gaps |
|---|---|---|---|---|---|---|---|

## Components

| Id | Files | Responsibility | Level | Why | Strategy | Protection | Exceptions and gaps |
|---|---|---|---|---|---|---|---|

## Messages and styles

| Id | Files | Responsibility | Level | Why | Strategy | Protection | Exceptions and gaps |
|---|---|---|---|---|---|---|---|

## Configuration and schema

| Id | Files | Responsibility | Level | Why | Strategy | Protection | Exceptions and gaps |
|---|---|---|---|---|---|---|---|

## Not production (not classified)

Files that are not production components and get no level: tests, test support, generated code, test-runner and browser-test configuration, agent setup, documentation, custom lint rules and their tests. The report script reads the `Files` column of this table too, so a root file listed here is not reported as unmatched.

| Id | Files | Why it is not production |
|---|---|---|

## Open judgment calls

Classifications that could reasonably go either way, each with the level chosen and the alternative, to be confirmed by the user at validation.

- None yet.
