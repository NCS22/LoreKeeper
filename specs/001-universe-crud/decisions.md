# Decisions after the plan - Spec 001 Create Universe

Decisions taken during implementation and manual verification that `plan.md` does not record. The decisions taken before implementation are in `plan.md`, section 8.

## 1. Live regions are always present

**Decision.** The duplicate-name warning (`universe-creation-form.tsx`) and the creation announcement (`universe-empty-state.tsx`) are always rendered as live regions (`role="status"`, `aria-live="polite"`), with their text filled in when needed.

**Why.** Screen readers only announce changes in a live region that already exists when the text appears (NFR-3). A region added together with its text may not be announced.

**Alternative discarded.** Rendering the warning only when there is a duplicate.

## 2. Selected-mode explanation uses `text-ink`

**Decision.** The explanation of the selected mode uses `text-ink` over the selection background (`text-ink-muted group-has-[[data-state=checked]]:text-ink`), with a contrast of at least 4.5 in all 12 accessibility presets, checked by `tests/styles/tokens-contrast.test.ts`.

**Why.** Manual verification found that the muted text did not reach the contrast the application requires over the selected background (NFR-4).

**Alternative discarded.** A new color token; the existing tokens were enough.

## 3. Focus handling in the drawers (`workspace-layout.tsx`)

**Decision.** `src/components/workspace/workspace-layout.tsx` is modified (user approved). Each drawer remembers the element that opened it. When the drawer closes, focus returns to that element only if nothing else holds the focus (`document.activeElement` is `null` or `document.body`). If the user's action already moved the focus, for example to the name field of the creation form, that focus is kept.

**Why.** Plan section 8 listed this as a risk: below `md`, closing the sidebar drawer after choosing "New universe" returned the focus to the opener and competed with the form's focus on the name field. It happened in manual verification (FR-1, NFR-2).

**Alternative discarded.** Never returning focus to the opener: it breaks keyboard navigation for the other ways of closing a drawer.

**Consequences.** This file was not in the list of modified shell files in `plan.md`, section 1.

## 4. Manual screen-reader check

The manual check for NFR-3 (labels, errors and warning linked to their fields, announcement after creation) was done and confirmed by the user. There is no separate validation report file: manual checks are done by the user, who reports any problem to the agent, and this note is the only written trace.
