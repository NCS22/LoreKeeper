import { ENTITY_TYPE_CONFIG, ENTITY_TYPE_ORDER } from "@/components/entities/entity-type-config";
import { resolveCssColor } from "@/components/graph/resolve-css-color";
import type { EntityTypeDto } from "@/dto/entity";

export type GraphTheme = {
  canvas: string;
  ink: string;
  inkMuted: string;
  lineControl: string;
  accent: string;
  fontFamily: string;
  rootFontSizePixels: number;
  entityColors: Record<EntityTypeDto, { color: string; tint: string }>;
};

// Reads the active tokens from the page, so the graph follows the background and text presets.
export function readGraphTheme(): GraphTheme {
  const rootStyle = getComputedStyle(document.documentElement);
  const fromToken = (tokenName: string) => resolveCssColor(`var(${tokenName})`);

  return {
    canvas: fromToken("--canvas"),
    ink: fromToken("--ink"),
    inkMuted: fromToken("--ink-muted"),
    lineControl: fromToken("--line-control"),
    accent: fromToken("--accent"),
    fontFamily: getComputedStyle(document.body).fontFamily,
    rootFontSizePixels: parseFloat(rootStyle.fontSize),
    entityColors: Object.fromEntries(
      ENTITY_TYPE_ORDER.map((type) => [
        type,
        {
          color: fromToken(ENTITY_TYPE_CONFIG[type].colorVariable),
          tint: fromToken(ENTITY_TYPE_CONFIG[type].tintVariable),
        },
      ]),
    ) as GraphTheme["entityColors"],
  };
}
