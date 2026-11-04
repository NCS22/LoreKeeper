import { describe, expect, it } from "vitest";
import { contrastRatio, parseHexColor, relativeLuminance } from "@/components/accessibility/contrast";

describe("parseHexColor", () => {
  it("reads the three channels of a #rrggbb color", () => {
    expect(parseHexColor("#E3A93B")).toEqual([227, 169, 59]);
  });

  it("rejects colors that are not #rrggbb", () => {
    expect(() => parseHexColor("#fff")).toThrow();
    expect(() => parseHexColor("amber")).toThrow();
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("is 21 between black and white, in either order", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("is 1 between identical colors", () => {
    expect(contrastRatio("#14110f", "#14110f")).toBe(1);
  });
});
