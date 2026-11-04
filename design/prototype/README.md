# LoreKeeper visual prototype

A navigable design prototype of the LoreKeeper interface, used to validate the design before Phase 1.
It is standalone (its own `package.json`) and not part of the application: no backend, database,
authentication or real logic. Everything shown comes from invented sample data.

## Run it

```
pnpm install
pnpm dev -p 3100
```

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm contrast` | Resolves every background x text preset from `tokens.css` and fails if any pair is below WCAG AA |
| `node scripts/screenshot.mjs --out screenshots/x.png` | Screenshot of the running prototype (Playwright) |

## Where things are

- `src/styles/tokens.css`: the only file that defines colors, radii, motion and type scale. Themes are
  selected with `data-bg` and `data-text` on `<html>`. Meant to be ported to the real app.
- `messages/en.ts`: every UI string, in a typed dictionary (no i18n library).
- `src/dto/` and `src/data/`: sample data typed with DTOs that follow `.claude/rules/data-model.md`.
- `src/components/graph/graph-canvas.tsx`: the only file that imports Cytoscape.
- `src/accessibility/`: presets, contrast math, and the preferences stored in `localStorage`.
- `screenshots/`: captures at 1440 px and 390 px, dark default and Parchment.

## Known limits

- Menus (`Universe`, `View`, `Help`) are placeholders; all their items are disabled.
- `Save` in the creation form only explains that saving is not implemented.
- Spoiler filtering is out of scope: the prototype behaves like an AUTHOR universe.
- The layout is chosen after hydration, so a phone briefly renders the desktop layout.
