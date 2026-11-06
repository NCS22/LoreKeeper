import { describe, expect, it } from "vitest";
import {
  MAXIMUM_UNIVERSE_NAME_LENGTH,
  toComparableUniverseName,
  validateUniverseName,
} from "@/modules/universes/domain/universe-name";

describe("validateUniverseName", () => {
  it("allows a maximum of 120 characters", () => {
    expect(MAXIMUM_UNIVERSE_NAME_LENGTH).toBe(120);
  });

  it.each([
    ["an empty name", ""],
    ["a name with only spaces", "     "],
    ["a name with only tabs and line breaks", " \t\n "],
  ])("rejects %s as required", (_description, rawName) => {
    expect(validateUniverseName(rawName)).toEqual({
      isValid: false,
      issue: { field: "name", code: "NAME_REQUIRED" },
    });
  });

  it("accepts a name of 1 character", () => {
    expect(validateUniverseName("A")).toEqual({ isValid: true, name: "A" });
  });

  it("accepts a name of exactly the maximum length", () => {
    const name = "a".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH);

    expect(validateUniverseName(name)).toEqual({ isValid: true, name });
  });

  it("rejects a name one character over the maximum and reports the limit", () => {
    const name = "a".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH + 1);

    expect(validateUniverseName(name)).toEqual({
      isValid: false,
      issue: {
        field: "name",
        code: "NAME_TOO_LONG",
        maximumLength: MAXIMUM_UNIVERSE_NAME_LENGTH,
      },
    });
  });

  it("measures the length after removing surrounding spaces", () => {
    const name = "a".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH);

    expect(validateUniverseName(`   ${name}   `)).toEqual({ isValid: true, name });
  });

  it("removes surrounding whitespace and keeps inner spaces", () => {
    expect(validateUniverseName("  The   Ember Concordat \n")).toEqual({
      isValid: true,
      name: "The   Ember Concordat",
    });
  });

  it("counts an emoji as one character", () => {
    const name = "😀".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH);

    expect(validateUniverseName(name)).toEqual({ isValid: true, name });
    expect(validateUniverseName(`${name}😀`)).toMatchObject({
      isValid: false,
      issue: { code: "NAME_TOO_LONG" },
    });
  });

  it("accepts non-Latin characters and punctuation", () => {
    expect(validateUniverseName("星の物語: Vol. 1!")).toEqual({
      isValid: true,
      name: "星の物語: Vol. 1!",
    });
  });
});

describe("toComparableUniverseName", () => {
  it.each([
    ["letter case", "THE EMBER CONCORDAT"],
    ["accents", "The Ëmber Concordát"],
    ["repeated inner spaces", "The   Ember    Concordat"],
    ["surrounding spaces", "   The Ember Concordat\t"],
    ["all of them together", "  The Ëmber   concordat "],
  ])("is the same for names that differ only in %s", (_description, variant) => {
    expect(toComparableUniverseName(variant)).toBe(toComparableUniverseName("the ember concordat"));
  });

  it("is the same for composed and decomposed accents", () => {
    expect(toComparableUniverseName("café")).toBe(toComparableUniverseName("café"));
  });

  it.each([
    ["a different word", "The Ember Compact"],
    ["words in another order", "Concordat The Ember"],
    ["words joined together", "TheEmber Concordat"],
  ])("is different for %s", (_description, otherName) => {
    expect(toComparableUniverseName(otherName)).not.toBe(
      toComparableUniverseName("the ember concordat"),
    );
  });

  it("returns an empty string for a whitespace-only name", () => {
    expect(toComparableUniverseName("   ")).toBe("");
  });
});
