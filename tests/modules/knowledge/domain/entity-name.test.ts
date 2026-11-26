import { describe, expect, it } from "vitest";
import { MAXIMUM_ENTITY_NAME_LENGTH, validateEntityName } from "@/modules/knowledge/domain/entity-name";

describe("validateEntityName", () => {
  it("allows a maximum of 120 characters", () => {
    expect(MAXIMUM_ENTITY_NAME_LENGTH).toBe(120);
  });

  it.each([
    ["an empty name", ""],
    ["a name with only spaces", "     "],
    ["a name with only tabs and line breaks", " \t\n "],
  ])("rejects %s as required", (_description, rawName) => {
    expect(validateEntityName(rawName)).toEqual({
      isValid: false,
      issue: { field: "name", code: "NAME_REQUIRED" },
    });
  });

  it("accepts a name of 1 character", () => {
    expect(validateEntityName("A")).toEqual({ isValid: true, name: "A" });
  });

  it("accepts a name of exactly 120 characters", () => {
    const name = "a".repeat(120);

    expect(validateEntityName(name)).toEqual({ isValid: true, name });
  });

  it("rejects a name of 121 characters and reports the limit", () => {
    expect(validateEntityName("a".repeat(121))).toEqual({
      isValid: false,
      issue: { field: "name", code: "NAME_TOO_LONG", maximumLength: 120 },
    });
  });

  it("measures the length after removing surrounding whitespace, and keeps inner spaces", () => {
    const name = `${"a".repeat(59)}  ${"b".repeat(59)}`;

    expect(validateEntityName(`  \t${name}\n `)).toEqual({ isValid: true, name });
  });

  it("counts characters as code points, so 120 emoji fit and 121 do not", () => {
    const name = "\u{1F409}".repeat(120);

    expect(validateEntityName(name)).toEqual({ isValid: true, name });
    expect(validateEntityName(`${name}\u{1F409}`)).toMatchObject({
      isValid: false,
      issue: { code: "NAME_TOO_LONG" },
    });
  });

  it.each([
    ["a null character", "Frodo\u0000Baggins"],
    ["a lone surrogate", "Frodo\uD800Baggins"],
  ])("rejects a name with %s as invalid characters", (_description, rawName) => {
    expect(validateEntityName(rawName)).toEqual({
      isValid: false,
      issue: { field: "name", code: "NAME_INVALID_CHARACTERS" },
    });
  });

  it("checks the characters before the length, so a long name with a null character is invalid, not too long", () => {
    expect(validateEntityName(`${"a".repeat(150)}\u0000`)).toMatchObject({
      issue: { code: "NAME_INVALID_CHARACTERS" },
    });
  });
});
