import { contrastRatio } from "@/accessibility/contrast";
import type { BackgroundPresetId, TextPresetId } from "@/accessibility/presets";

const SURFACE_TOKENS = ["--canvas", "--surface", "--raised"] as const;
const TEXT_TOKENS = ["--ink", "--ink-muted"] as const;

// Reads the colors a background + text pair resolves to from tokens.css (the single source of
// truth) by styling a hidden probe with the same attributes <html> uses, then returns the worst
// contrast ratio between any text token and any surface token.
export function measureCombinationContrast(background: BackgroundPresetId, text: TextPresetId): number {
  const probe = document.createElement("div");
  probe.dataset.bg = background;
  probe.dataset.text = text;
  probe.hidden = true;
  document.body.appendChild(probe);
  try {
    const computedStyle = getComputedStyle(probe);
    const surfaceColors = SURFACE_TOKENS.map((token) => computedStyle.getPropertyValue(token));
    const textColors = TEXT_TOKENS.map((token) => computedStyle.getPropertyValue(token));
    return Math.min(
      ...textColors.flatMap((textColor) => surfaceColors.map((surfaceColor) => contrastRatio(textColor, surfaceColor))),
    );
  } finally {
    probe.remove();
  }
}
