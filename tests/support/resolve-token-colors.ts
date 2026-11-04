/*
 * Reads src/styles/tokens.css and resolves its custom properties the way a browser would for a given
 * background and text preset: attribute selectors, specificity, source order, var() and color-mix().
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseHexColor } from "@/components/accessibility/contrast";

const TOKENS_CSS_PATH = fileURLToPath(new URL("../../src/styles/tokens.css", import.meta.url));

type CssRule = {
  selector: string;
  declarations: Record<string, string>;
  order: number;
};

type ParsedSelector = {
  attributes: [string, string][];
  specificity: number;
};

export type TokenValues = Record<string, string>;

function parseRules(css: string): CssRule[] {
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];
  const rulePattern = /([^{}@]+)\{([^{}]*)\}/g;
  let ruleMatch: RegExpExecArray | null;
  while ((ruleMatch = rulePattern.exec(cssWithoutComments)) !== null) {
    const declarations: Record<string, string> = {};
    for (const declaration of ruleMatch[2].split(";")) {
      const separatorIndex = declaration.indexOf(":");
      if (separatorIndex === -1) continue;
      const propertyName = declaration.slice(0, separatorIndex).trim();
      if (propertyName.startsWith("--")) declarations[propertyName] = declaration.slice(separatorIndex + 1).trim();
    }
    for (const selector of ruleMatch[1].split(",")) {
      rules.push({ selector: selector.trim(), declarations, order: rules.length });
    }
  }
  return rules;
}

function parseSelector(selector: string): ParsedSelector | null {
  const attributes = [...selector.matchAll(/\[(data-[a-z]+)="([^"]+)"\]/g)].map(
    (attributeMatch): [string, string] => [attributeMatch[1], attributeMatch[2]],
  );
  const isRoot = selector.includes(":root");
  const remainder = selector.replace(/\[[^\]]+\]/g, "").replace(":root", "").trim();
  if (remainder !== "") return null;
  return { attributes, specificity: attributes.length + (isRoot ? 1 : 0) };
}

const tokenRules = parseRules(readFileSync(TOKENS_CSS_PATH, "utf8"));

export function resolveTokenValues(background: string, text: string): TokenValues {
  const htmlAttributes: Record<string, string> = { "data-bg": background, "data-text": text };
  const matchingRules = tokenRules.flatMap((rule) => {
    const parsedSelector = parseSelector(rule.selector);
    if (parsedSelector === null) return [];
    const matches = parsedSelector.attributes.every(([name, value]) => htmlAttributes[name] === value);
    return matches ? [{ ...rule, specificity: parsedSelector.specificity }] : [];
  });
  matchingRules.sort((first, second) => first.specificity - second.specificity || first.order - second.order);
  const tokenValues: TokenValues = {};
  for (const rule of matchingRules) Object.assign(tokenValues, rule.declarations);
  return tokenValues;
}

function rgbToHex(rgb: number[]): string {
  return "#" + rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("");
}

export function resolveColorToken(tokenName: string, tokenValues: TokenValues): string {
  const tokenValue = tokenValues[tokenName];
  if (tokenValue === undefined) throw new Error(`Token ${tokenName} is not defined`);
  return resolveColorValue(tokenValue, tokenValues);
}

function resolveColorValue(colorValue: string, tokenValues: TokenValues): string {
  const trimmedValue = colorValue.trim();
  const variableMatch = trimmedValue.match(/^var\((--[a-z0-9-]+)\)$/);
  if (variableMatch) return resolveColorToken(variableMatch[1], tokenValues);

  const colorMixMatch = trimmedValue.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/);
  if (colorMixMatch) {
    const firstChannels = parseHexColor(resolveColorValue(colorMixMatch[1], tokenValues));
    const secondChannels = parseHexColor(resolveColorValue(colorMixMatch[3], tokenValues));
    const firstShare = Number(colorMixMatch[2]) / 100;
    return rgbToHex(firstChannels.map((channel, index) => channel * firstShare + secondChannels[index] * (1 - firstShare)));
  }

  if (/^#[0-9a-f]{6}$/i.test(trimmedValue)) return trimmedValue.toLowerCase();
  throw new Error(`Cannot resolve color value: ${colorValue}`);
}
