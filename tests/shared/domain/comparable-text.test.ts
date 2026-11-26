import { describe, expect, it } from "vitest";
import { toComparableText } from "@/shared/domain/comparable-text";

describe("toComparableText", () => {
  it("lower-cases, removes accents, trims and collapses inner whitespace", () => {
    expect(toComparableText("  The Ëmber \t\n Concordát  ")).toBe("the ember concordat");
  });

  it.each([
    ["letter case", "ARAGORN SON OF ARATHORN"],
    ["accents", "Arägorn són of Arathörn"],
    ["repeated inner spaces", "Aragorn   son    of Arathorn"],
    ["tabs and line breaks between words", "Aragorn\tson\nof Arathorn"],
    ["surrounding spaces", "   Aragorn son of Arathorn\t"],
  ])("is the same for texts that differ only in %s", (_description, variant) => {
    expect(toComparableText(variant)).toBe(toComparableText("aragorn son of arathorn"));
  });

  it("is the same for composed and decomposed accents", () => {
    const composedText = "Éowyn";
    const decomposedText = "Éowyn";

    expect(composedText).not.toBe(decomposedText);
    expect(toComparableText(composedText)).toBe(toComparableText(decomposedText));
    expect(toComparableText(composedText)).toBe("eowyn");
  });

  it.each([
    ["a different word", "Aragorn son of Arador"],
    ["words in another order", "son Aragorn of Arathorn"],
    ["words joined together", "Aragornson of Arathorn"],
  ])("is different for %s", (_description, otherText) => {
    expect(toComparableText(otherText)).not.toBe(toComparableText("aragorn son of arathorn"));
  });

  it("keeps letters of scripts without case or accents unchanged", () => {
    expect(toComparableText("星の物語")).toBe("星の物語");
  });

  it("returns an empty text for a whitespace-only text", () => {
    expect(toComparableText(" \t\n ")).toBe("");
  });
});
