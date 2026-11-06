import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/components/accessibility/contrast";
import { BACKGROUND_PRESET_IDS, TEXT_PRESET_IDS } from "@/components/accessibility/presets";
import { resolveColorToken, resolveTokenValues, type TokenValues } from "../support/resolve-token-colors";

const MINIMUM_TEXT_CONTRAST = 4.5;
const MINIMUM_GRAPHIC_CONTRAST = 3;
const SURFACE_TOKENS = ["--canvas", "--surface", "--raised"];
const ENTITY_TYPES = ["character", "location", "organization", "faction", "object", "ability", "species", "concept"];

function worstContrast(foregroundToken: string, backgroundTokens: string[], tokenValues: TokenValues): number {
  const foregroundColor = resolveColorToken(foregroundToken, tokenValues);
  return Math.min(
    ...backgroundTokens.map((backgroundToken) =>
      contrastRatio(foregroundColor, resolveColorToken(backgroundToken, tokenValues)),
    ),
  );
}

describe("token resolution", () => {
  it("resolves known colors from tokens.css, so the contrast checks below measure real values", () => {
    expect(resolveColorToken("--canvas", resolveTokenValues("obsidian", "vellum"))).toBe("#14110f");
    expect(resolveColorToken("--canvas", resolveTokenValues("parchment", "vellum"))).toBe("#f2e8d5");
  });

  it("applies the text preset that matches the background polarity", () => {
    const darkInk = resolveColorToken("--ink", resolveTokenValues("obsidian", "vellum"));
    const parchmentInk = resolveColorToken("--ink", resolveTokenValues("parchment", "vellum"));
    expect(contrastRatio(darkInk, "#14110f")).toBeGreaterThan(MINIMUM_TEXT_CONTRAST);
    expect(contrastRatio(parchmentInk, "#f2e8d5")).toBeGreaterThan(MINIMUM_TEXT_CONTRAST);
    expect(darkInk).not.toBe(parchmentInk);
  });
});

const presetCombinations =BACKGROUND_PRESET_IDS.flatMap((background) =>
  TEXT_PRESET_IDS.map((text) => ({ background, text, tokenValues: resolveTokenValues(background, text) })),
);

describe.each(presetCombinations)("$background background with $text text", ({ tokenValues }) => {
  it("keeps primary and muted text readable on every surface", () => {
    expect(worstContrast("--ink", SURFACE_TOKENS, tokenValues)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    expect(worstContrast("--ink-muted", SURFACE_TOKENS, tokenValues)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });

  it("keeps text readable on hover and selection backgrounds", () => {
    expect(worstContrast("--ink", ["--hover", "--selection"], tokenValues)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    expect(worstContrast("--ink-muted", ["--hover"], tokenValues)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });

  // The selected universe mode explanation (universe-creation-form.tsx) uses ink over the selection surface,
  // because ink-muted on selection is below the minimum in the accessibility presets.
  it("keeps the text used over the selected-option background readable", () => {
    expect(worstContrast("--ink", ["--selection"], tokenValues)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });

  it("keeps the accent, its hover state, danger and button text readable", () => {
    expect(worstContrast("--accent", SURFACE_TOKENS, tokenValues)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    expect(worstContrast("--accent-hover", SURFACE_TOKENS, tokenValues)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    expect(worstContrast("--danger", SURFACE_TOKENS, tokenValues)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    expect(worstContrast("--accent-ink", ["--accent"], tokenValues)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });

  it("keeps control borders visible on every surface", () => {
    expect(worstContrast("--line-control", SURFACE_TOKENS, tokenValues)).toBeGreaterThanOrEqual(MINIMUM_GRAPHIC_CONTRAST);
  });

  it.each(ENTITY_TYPES)("keeps the %s color readable on surfaces and on its own tint", (entityType) => {
    const entityColorToken = `--entity-${entityType}`;
    expect(worstContrast(entityColorToken, SURFACE_TOKENS, tokenValues)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    expect(worstContrast(entityColorToken, [`${entityColorToken}-tint`], tokenValues)).toBeGreaterThanOrEqual(
      MINIMUM_TEXT_CONTRAST,
    );
  });
});
