// WCAG 2.x contrast math. Pure functions, also covered by tests/styles/tokens-contrast.test.ts.

export const MINIMUM_TEXT_CONTRAST = 4.5;

export function parseHexColor(hexColor: string): [number, number, number] {
  const normalized = hexColor.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    throw new Error(`Expected a #rrggbb color, received "${hexColor}"`);
  }
  return [1, 3, 5].map((start) => parseInt(normalized.slice(start, start + 2), 16)) as [number, number, number];
}

export function relativeLuminance(hexColor: string): number {
  const [red, green, blue] = parseHexColor(hexColor).map((channelValue) => {
    const channel = channelValue / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(firstHexColor: string, secondHexColor: string): number {
  const [lighter, darker] = [relativeLuminance(firstHexColor), relativeLuminance(secondHexColor)].sort(
    (first, second) => second - first,
  );
  return (lighter + 0.05) / (darker + 0.05);
}
